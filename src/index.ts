import { dictionary as defaultDictionary } from './dictionary/presets.ts';
import { Matcher, type Match } from './core/matcher.ts';
import { describe, occurrencesWithin, type MatchVia, type ProvenanceSettings } from './core/provenance.ts';
import type { FuzzyCompiler } from './fuzzy/types.ts';
import type { EvasionCompiler, EvasionRuntime } from './evasion/types.ts';
import { compileAllowedPhrases, matchAcceptance, type AllowedPhrases, type MatchAcceptance } from './core/exceptions.ts';
import { canonicalSearchView, foldCandidateText, isSimpleUnicodeAtom, normalize, normalizeKey, trimDictionaryWord,
    type Normalization, type NormalizedText } from './text/normalize.ts';
import { bangCandidates, minimumRun, prepareNativePatterns, potentialPattern, type NativePatterns } from './core/pattern.ts';
import { UnicodeMatcher, UnicodeView } from './text/unicode.ts';
import type { DictionaryBudget } from './core/budget.ts';
import { collapseWhitespace, MatchWindow, maxMatchesMode, type MaxMatchesMode } from './core/pipeline.ts';

declare const __BADWORDS_PRESET_PATTERNS__: NativePatterns | undefined;
const presetPatterns = typeof __BADWORDS_PRESET_PATTERNS__ === 'undefined' ? undefined : __BADWORDS_PRESET_PATTERNS__;

export { dictionary, contextualDictionary, expandedDictionary } from './dictionary/presets.ts';
export type { DictionaryWord, ContextualDictionaryWord, ExpandedDictionaryWord } from './dictionary/presets.ts';
export type { Normalization } from './text/normalize.ts';
export type { FuzzyPolicy } from './fuzzy/types.ts';
export type { EvasionPolicy } from './evasion/types.ts';
export type { EvasionTransforms, MatchVia } from './core/provenance.ts';
export type { MaxMatchesMode } from './core/pipeline.ts';

export type { BadwordLocation, MatchedLocation, CensorContext, DetailedCensorContext, CensorCallback, CensorReplacement, IgnoreRange, CheckOptions, FilterOptions, FindOptions, AnalyzeOptions, FindResult, AnalysisResult, AnalysisReport, MatchMode, BadwordsOptions } from './core/types.ts';
import type { MatchedLocation, DetailedCensorContext, CheckOptions, FilterOptions, FindOptions, AnalyzeOptions, FindResult, AnalysisReport, MatchMode, BadwordsOptions } from './core/types.ts';

function validateText(text: unknown): asserts text is string {
    if (typeof text !== 'string') throw new TypeError('string expected');
}
function wordsArray(words: string | readonly string[]): readonly string[] {
    if (typeof words === 'string') return [words];
    if (!Array.isArray(words)) {
        throw new TypeError('dictionary words must be a string or an array of strings');
    }
    for (const word of words) {
        if (typeof word !== 'string') throw new TypeError('dictionary entries must be strings');
    }
    return words;
}
function location(text: string, match: Match, settings: ProvenanceSettings, seen: Map<string, MatchVia>): MatchedLocation {
    const source = text.slice(match.start, match.end);
    let via: MatchVia | undefined;
    // Without a scanner trace, via depends only on the surface and the word; dense inputs repeat both.
    if (match.trace || source === match.word) via = describe(source, match, settings);
    else {
        const key = match.word + '\0' + source;
        via = seen.get(key);
        if (!via) seen.set(key, via = describe(source, match, settings));
    }
    return { word: match.word, index: match.start, end: match.end, match: source, via };
}
function mergeSpan(spans: Array<{ start: number; end: number }>, match: Match): void {
    let { start, end } = match;
    // End-ordered scanner results can subsume several prior spans.
    while (spans.length && start < spans[spans.length - 1].end) {
        const previous = spans.pop()!;
        start = Math.min(start, previous.start);
        end = Math.max(end, previous.end);
    }
    spans.push({ start, end });
}
function replaceSpans(text: string, spans: readonly { start: number; end: number }[], replacement: string): string {
    const pieces: string[] = [];
    let index = 0;
    for (const span of spans) {
        pieces.push(text.slice(index, span.start), replacement);
        index = span.end;
    }
    pieces.push(text.slice(index));
    return pieces.join('');
}

interface NativeMatcher {
    pattern?: RegExp;
    orders?: Map<string, number>;
    complex: RegExp | undefined;
    censorPattern: RegExp | undefined;
    crossing: RegExp | undefined;
    crossingTrigger: string | undefined;
    hazards: RegExp;
    quiet: RegExp;
    words: readonly string[];
    patterns: NativePatterns;
    potential?: RegExp;
    bangPotential?: RegExp;
    bangGuard?: RegExp | null;
    run?: RegExp | null;
    tokenWork?: number;
    unicode?: UnicodeMatcher;
}

const ASCII_TEXT = /^[\x00-\x7f]*$/;
// Pure numbers do not fold. Digits attached to letters, or joining symbols,
// require the normalization engine and its original-source span mapping.
const ASCII_WORD = /^[A-Za-z0-9]+$/;
const WORD_TOKENS = /[a-z0-9]+/gi;
// Compiling the dictionary regex costs ~1 ms: flag() stays on the Set path until it has tokenized this much text.
const PATTERN_WARMUP = 262_144;
let internalBang: RegExp | undefined;
let bareEmoji: RegExp | undefined;
const emojiDelimiters = new Map<number, boolean>();
const CLEAN = 'clean';
const RETAINED_BUDGET_WORDS = 2048;
function asciiLetter(code: number): boolean { return (code >= 65 && code <= 90) || (code >= 97 && code <= 122); }
function asciiWord(code: number): boolean { return asciiLetter(code) || (code >= 48 && code <= 57); }
function emojiDelimiter(character: string): boolean {
    const code = character.codePointAt(0)!;
    let safe = emojiDelimiters.get(code);
    if (safe === undefined) {
        bareEmoji ??= new RegExp(String.raw`^(?![\p{L}\p{N}\p{M}])\p{Extended_Pictographic}$`, 'u');
        safe = bareEmoji.test(character) && character.normalize('NFKC') === character;
        if (emojiDelimiters.size < 128) emojiDelimiters.set(code, safe);
    }
    return safe;
}

/** An isolated dictionary matcher. It does not infer intent or context. */
export class Badwords {
    #dictionary = new Set<string>();
    readonly #evasionCompiler: EvasionCompiler | undefined;
    readonly #fuzzyCompiler: FuzzyCompiler | undefined;
    #evasion: EvasionRuntime | undefined;
    readonly #mode: MatchMode;
    readonly #normalization: Normalization;
    readonly #ignoreRepeatedLetters: boolean;
    readonly #maxMatches: number;
    readonly #onMaxMatches: MaxMatchesMode;
    #stale = false;
    #budget: DictionaryBudget | undefined;
    readonly #allowed: AllowedPhrases | undefined;
    #matcher: Matcher | undefined;
    #maxKeyLength = 0;
    #maxWordLength = 0;
    #native: NativeMatcher | null | undefined;
    #preset = false;
    #version = 0;
    #bangGuard: { matcher: Matcher; pattern: RegExp | undefined } | undefined;
    readonly #provenance: ProvenanceSettings;

    constructor(options: BadwordsOptions = {}) {
        if (!options || typeof options !== 'object' || Array.isArray(options)) {
            throw new TypeError('options must be an object');
        }
        const { mode = 'word', normalization = 'standard', ignoreRepeatedLetters = false } = options;
        if (mode !== 'word' && mode !== 'substring') throw new TypeError('invalid matching mode');
        if (normalization !== 'standard' && normalization !== 'none') throw new TypeError('invalid normalization');
        if (typeof ignoreRepeatedLetters !== 'boolean') throw new TypeError('ignoreRepeatedLetters must be a boolean');
        const maxMatches = options.maxMatches === undefined ? 10_000 : options.maxMatches;
        if (maxMatches !== Infinity && (!Number.isSafeInteger(maxMatches) || maxMatches < 1)) {
            throw new TypeError('maxMatches must be a positive safe integer or Infinity');
        }
        this.#onMaxMatches = maxMatchesMode(options.onMaxMatches) ?? 'throw';
        if (options.dictionary !== undefined && !Array.isArray(options.dictionary)) {
            throw new TypeError('dictionary must be an array of strings');
        }
        if (options.evasion !== undefined) {
            if (ignoreRepeatedLetters) throw new TypeError('bounded evasion cannot use unlimited ignoreRepeatedLetters');
            if (!options.evasion || typeof options.evasion !== 'object' || !Object.isFrozen(options.evasion))
                throw new TypeError('evasion must be created by boundedEvasion()');
            const compiler = Reflect.get(options.evasion, Symbol.for('indonesian-badwords.evasion.v2')) as EvasionCompiler | undefined;
            if (!compiler || compiler.version !== 2 || typeof compiler.compile !== 'function' || typeof compiler.checkDictionary !== 'function' || typeof compiler.budget !== 'function')
                throw new TypeError('evasion must be created by boundedEvasion()');
            this.#evasionCompiler = compiler;
        }
        if (options.fuzzy !== undefined) {
            if (!options.fuzzy || typeof options.fuzzy !== 'object' || !Object.isFrozen(options.fuzzy))
                throw new TypeError('fuzzy must be created by boundedFuzzy()');
            const compiler = Reflect.get(options.fuzzy, Symbol.for('indonesian-badwords.fuzzy.v2')) as FuzzyCompiler | undefined;
            if (!compiler || compiler.version !== 2 || typeof compiler.compile !== 'function' || typeof compiler.checkDictionary !== 'function' || typeof compiler.budget !== 'function')
                throw new TypeError('fuzzy must be created by boundedFuzzy()');
            this.#fuzzyCompiler = compiler;
        }
        if (this.#evasionCompiler || this.#fuzzyCompiler) this.#checkDictionary(wordsArray(options.dictionary ?? defaultDictionary));
        this.#mode = mode;
        this.#normalization = normalization;
        this.#ignoreRepeatedLetters = ignoreRepeatedLetters;
        this.#provenance = { normalization, ignoreRepeatedLetters };
        this.#maxMatches = maxMatches;
        this.#allowed = compileAllowedPhrases(options.allowPhrases, normalization);
        if (options.dictionary === undefined || (options.dictionary as readonly string[]) === defaultDictionary) {
            // The bundled, frozen lexicon is already canonical. Copy its values
            // without allocating normalization maps for every term at import.
            this.#preset = true;
            for (const word of defaultDictionary) {
                this.#dictionary.add(word);
                this.#maxWordLength = Math.max(this.#maxWordLength, word.length);
            }
        } else {
            // The first compile below is the authority for the initial dictionary; the budget starts at the first update.
            if (this.#evasionCompiler || this.#fuzzyCompiler) this.#changeDictionary(options.dictionary, true, false);
            else this.addWords(options.dictionary);
        }
        if ((this.#evasionCompiler || this.#fuzzyCompiler) && !this.#evasion) this.#setEvasion(this.#dictionary, this.#preset);
    }

    /** A snapshot; mutating it does not change the checker. */
    get dict(): string[] { return [...this.#dictionary]; }

    addWords(words: string | readonly string[]): void {
        if (this.#evasionCompiler || this.#fuzzyCompiler) { this.#changeDictionary(words, true); return; }
        for (const word of wordsArray(words)) {
            // Canonical keys may themselves contain whitespace introduced by
            // compatibility normalization. A snapshot must round-trip unchanged.
            if (this.#dictionary.has(word)) continue;
            const canonical = trimDictionaryWord(normalizeKey(trimDictionaryWord(word), this.#normalization));
            if (canonical && !this.#dictionary.has(canonical)) {
                this.#dictionary.add(canonical);
                this.#maxWordLength = Math.max(this.#maxWordLength, canonical.length);
                this.#matcher = undefined;
                this.#native = undefined;
                this.#version++;
                this.#preset = false;
            }
        }
    }
    removeWords(words: string | readonly string[]): void {
        if (this.#evasionCompiler || this.#fuzzyCompiler) { this.#changeDictionary(words, false); return; }
        for (const word of wordsArray(words)) {
            if (this.#dictionary.delete(word)
                || this.#dictionary.delete(trimDictionaryWord(normalizeKey(trimDictionaryWord(word), this.#normalization)))) {
                this.#matcher = undefined;
                this.#native = undefined;
                this.#version++;
                this.#preset = false;
            }
        }
    }

    #checkDictionary(words: readonly string[]): void {
        if (this.#fuzzyCompiler) this.#fuzzyCompiler.checkDictionary(words, this.#evasionCompiler);
        else this.#evasionCompiler?.checkDictionary(words);
    }

    #setEvasion(words: Set<string>, preset = false): void {
        const entries = [...words].map((word, order) => ({ word, order,
            key: this.#ignoreRepeatedLetters ? normalize(word, 'none', true).text : word }));
        this.#checkDictionary([...words]);
        let matcher: Matcher | undefined;
        const runtime = (this.#fuzzyCompiler ?? this.#evasionCompiler)!.compile(entries, this.#normalization, normalizeKey, limit => {
            matcher = new Matcher(entries, limit);
            return matcher.view();
        }, text => foldCandidateText(canonicalSearchView(text).text)?.normalize('NFKC'), this.#evasionCompiler);
        // Policy objects cross bundle boundaries, so a brand alone cannot prove origin.
        if (!matcher || !runtime || (['checkInput', 'potential', 'scan', 'censor'] as const).some(name => typeof runtime[name] !== 'function'))
            throw new TypeError(`${this.#fuzzyCompiler ? 'fuzzy' : 'evasion'} policy did not compile; create it with ${this.#fuzzyCompiler ? 'boundedFuzzy()' : 'boundedEvasion()'}`);
        this.#dictionary = words;
        this.#matcher = matcher;
        this.#evasion = runtime;
        this.#maxKeyLength = entries.reduce((maximum, entry) => Math.max(maximum, entry.key.length), 0);
        this.#maxWordLength = this.#maxKeyLength;
        this.#native = undefined;
        this.#stale = false;
        // Large dictionaries release the budget trie and footprints (re-seeded on the next update); small ones keep them so
        // interleaved updates and scans don't pay a re-seed each time.
        if (words.size > RETAINED_BUDGET_WORDS) this.#budget = undefined;
        this.#preset = preset;
    }

    /** Build the runtime for pending updates. Budgets were already enforced by #changeDictionary, so this cannot fail on them. */
    #refresh(): void { this.#setEvasion(this.#dictionary); }

    #key(word: string): string { return this.#ignoreRepeatedLetters ? normalize(word, 'none', true).text : word; }

    /** Seeded with the current dictionary, pending updates included; released when a large dictionary's runtime compiles. */
    #newBudget(): DictionaryBudget {
        const budget = this.#fuzzyCompiler ? this.#fuzzyCompiler.budget(this.#normalization, normalizeKey, this.#evasionCompiler)
            : this.#evasionCompiler!.budget();
        budget.change([...this.#dictionary].map(word => this.#key(word)), []);
        return budget;
    }

    /** Enforces every budget eagerly and applies atomically, but defers building the (expensive) runtime to the next scan. */
    #changeDictionary(words: string | readonly string[], add: boolean, enforce = true): void {
        const batch = wordsArray(words);
        this.#checkDictionary(batch);
        const dictionary = this.#dictionary;
        const changes = new Set<string>();
        for (const word of batch) {
            if (dictionary.has(word)) { if (!add) changes.add(word); continue; }
            const canonical = trimDictionaryWord(normalizeKey(trimDictionaryWord(word), this.#normalization));
            if (add ? canonical && !dictionary.has(canonical) : dictionary.has(canonical)) changes.add(canonical);
        }
        if (!changes.size) return;
        if (add) this.#checkDictionary([...dictionary, ...changes]);
        if (enforce) {
            const budget = this.#budget ??= this.#newBudget();
            const keys = [...changes].map(word => this.#key(word));
            if (add) budget.change(keys, []); else budget.change([], keys);
        }
        for (const word of changes) { if (add) dictionary.add(word); else dictionary.delete(word); }
        this.#stale = true;
        this.#native = undefined;
        this.#version++;
        this.#preset = false;
    }

    #longWord(text: string): boolean {
        // A single unbroken ASCII word cannot contain a shorter whole-word
        // entry. Standard folding preserves its length unless repeats are enabled.
        return this.#mode === 'word' && !this.#ignoreRepeatedLetters
            && text.length > this.#maxWordLength && ASCII_WORD.test(text);
    }

    #canonicalSearch(text: string, native: NativeMatcher): typeof CLEAN | UnicodeView | undefined {
        native.unicode ??= new UnicodeMatcher(native.patterns, () => this.#compileMatcher());
        return native.unicode.search(text);
    }

    #nativeFor(text: string, censorship = false, literal?: string): NativeMatcher | typeof CLEAN | UnicodeView | undefined {
        if (this.#mode !== 'word' || this.#ignoreRepeatedLetters) return;
        if (this.#native === undefined) {
            // Keep custom/adversarial dictionaries on the automaton. A bounded
            // literal alternation has no dictionary-supplied regex operators.
            const words = this.#preset ? defaultDictionary : [...this.#dictionary];
            if (!this.#preset && (!words.length || words.length > 512 || words.some((word) =>
                word.length > 64 || !ASCII_TEXT.test(word))
                || words.reduce((size, word) => size + word.length, 0) > 16_384)) {
                this.#native = null;
            } else {
                const patterns = (this.#preset && presetPatterns) || prepareNativePatterns(words);
                this.#native = {
                    complex: undefined,
                    censorPattern: undefined,
                    crossing: undefined,
                    crossingTrigger: undefined,
                    hazards: /[0-9@$(|!_\x80-\uffff]/g,
                    quiet: /[0-9@$(|_\x80-\uffff]/g,
                    words, patterns
                };
            }
        }
        const native = this.#native;
        if (native && censorship && native.patterns.censor && !native.censorPattern) {
            native.censorPattern = new RegExp(`\\b(?:${native.patterns.censor})\\b`,
                this.#normalization === 'standard' ? 'gi' : 'g');
            native.crossingTrigger = native.patterns.crossingTrigger;
            if (native.patterns.crossing) native.crossing = new RegExp(native.patterns.crossing,
                this.#normalization === 'standard' ? 'i' : '');
        }
        // Multi-part literal terms may overlap across apostrophes. The general
        // scanner retains all such occurrences and merges their complete spans.
        if (!native) return;
        if (censorship && native.censorPattern) {
            if (native.crossing && (!native.crossingTrigger || text.includes(native.crossingTrigger)) && native.crossing.test(text)) return;
        } else if (native.patterns.complex) {
            if (literal !== undefined) {
                if (native.patterns.complexWords!.some((word) => literal.includes(word))) return;
            } else {
                native.complex ??= new RegExp(native.patterns.complex, this.#normalization === 'standard' ? 'i' : '');
                if (native.complex.test(text)) return;
            }
        }
        let hazards = native.hazards;
        hazards.lastIndex = 0;
        let hazard: RegExpExecArray | null;
        let folding = false;
        let bangs = false;
        while ((hazard = hazards.exec(text)) !== null) {
            const code = hazard[0].charCodeAt(0);
            if (code > 127) {
                const point = text.codePointAt(hazard.index)!;
                // Common bare pictographs need no temporary string or Unicode
                // classification; modifiers immediately after these ranges do.
                if (!((point >= 0x1f300 && point <= 0x1f3fa) || (point >= 0x1f400 && point <= 0x1f64f))
                    && !emojiDelimiter(String.fromCodePoint(point))) {
                    // Keep already-inexpensive fullwidth/control/symbol paths.
                    if (this.#normalization === 'standard' && !isSimpleUnicodeAtom(String.fromCodePoint(point))) {
                        return this.#canonicalSearch(text, native);
                    }
                    return;
                }
                hazards.lastIndex += point > 0xffff ? 1 : 0;
                continue;
            }
            let end = hazard.index + 1;
            if ((code < 48 || code > 57) && text.charCodeAt(end) === code) {
                // Only a lone symbol between word characters can join letters; skip runs.
                while (text.charCodeAt(end) === code) end++;
                hazards.lastIndex = end;
                if (code === 95) folding = true;
                continue;
            }
            if (code === 95) { folding = true; continue; }
            if (this.#normalization === 'none') continue;
            const before = text.charCodeAt(hazard.index - 1);
            if (code >= 48 && code <= 57) {
                while (text.charCodeAt(end) >= 48 && text.charCodeAt(end) <= 57) end++;
                hazards.lastIndex = end;
            }
            const after = text.charCodeAt(end);
            if (code >= 48 && code <= 57) {
                if (asciiLetter(before) || asciiLetter(after)) folding = true;
            } else if (asciiWord(before) && asciiWord(after)) {
                if (code === 33) {
                    bangs = true;
                    native.quiet.lastIndex = hazards.lastIndex;
                    hazards = native.quiet;
                } else folding = true;
            }
            if (folding) {
                native.potential ??= potentialPattern(native.words, false, native.patterns);
                return native.potential.test(text) ? undefined : CLEAN;
            }
        }
        // The candidate pattern permits every ASCII substitution. Its outer
        // checks only reject alphanumeric neighbors, which cannot become separators.
        if (folding) {
            native.potential ??= potentialPattern(native.words, false, native.patterns);
            return native.potential.test(text) ? undefined : CLEAN;
        }
        if (bangs) {
            native.bangGuard ??= bangCandidates(native.words) ?? null;
            if (native.bangGuard === null || native.bangGuard.test(text)) {
                native.bangPotential ??= potentialPattern(native.words, true);
                if (native.bangPotential.test(text)) return;
            }
        }
        // No alphanumeric run as long as the shortest entry's longest one: nothing can match.
        native.run ??= minimumRun(native.words);
        if (native.run && !native.run.test(text)) return CLEAN;
        if (native.pattern) native.pattern.lastIndex = 0;
        if (native.censorPattern) native.censorPattern.lastIndex = 0;
        return native;
    }

    #pattern(native: NativeMatcher): RegExp {
        return native.pattern ??= new RegExp(`\\b(?:${native.patterns.simple})\\b`,
            this.#normalization === 'standard' ? 'gi' : 'g');
    }

    #compileMatcher(): Matcher {
        if (!this.#matcher) {
            const entries = [...this.#dictionary].map((word, order) => ({ word, order,
                key: this.#ignoreRepeatedLetters ? normalize(word, 'none', true).text : word }));
            this.#maxKeyLength = entries.reduce((maximum, entry) => Math.max(maximum, entry.key.length), 0);
            this.#matcher = new Matcher(entries);
        }
        return this.#matcher;
    }

    #acceptance(text: string, options?: CheckOptions): MatchAcceptance | undefined {
        if (this.#stale) this.#refresh();
        if (this.#evasion) { validateText(text); this.#evasion.checkInput(text); }
        if (options === undefined && !this.#allowed) return;
        validateText(text);
        return matchAcceptance(text, options, this.#allowed);
    }

    #scan(text: string, visit: (match: Match) => boolean | void, spansOnly = false, skipNative = false,
        accept?: MatchAcceptance, unique = false, knownEvasion?: boolean, detail = false, window?: MatchWindow): void {
        validateText(text);
        if (!text.length || !this.#dictionary.size) return;
        if (knownEvasion === undefined ? this.#evasion?.potential(text) : knownEvasion) {
            this.#evasion!.scan(this.#normalizeInput(text), this.#mode === 'word', visit,
                unique ? 'unique' : spansOnly ? 'spans' : 'all', accept, detail);
            return;
        }
        if (this.#longWord(text)) return;
        const native = skipNative ? undefined : this.#nativeFor(text);
        if (native === CLEAN) return;
        if (native instanceof UnicodeView) { native.scan(visit, accept); return; }
        if (native) {
            const pattern = this.#pattern(native);
            window?.ordered();
            let occurrence: RegExpExecArray | null;
            while ((occurrence = pattern.exec(text)) !== null) {
                native.orders ??= new Map(native.words.map((word, order) => [word, order]));
                const start = occurrence.index;
                const end = start + occurrence[0].length;
                if (accept && !accept(start, end)) continue;
                const word = this.#normalization === 'standard' ? occurrence[0].toLowerCase() : occurrence[0];
                if (visit({ word, start, end, from: start, to: end, order: native.orders.get(word)! }) === false) break;
            }
            return;
        }
        const matcher = this.#compileMatcher();
        const value = this.#normalizeInput(text, true);
        window?.frontier(value.starts, this.#maxKeyLength);
        matcher.scan(value, this.#mode === 'word', visit, spansOnly, undefined, accept);
    }

    /** `plain`: the result feeds only the exact matcher, so bangs no word can use may stay literal. */
    #normalizeInput(text: string, plain = false): NormalizedText {
        if (this.#normalization !== 'standard' || (!text.includes('!') && !/[^\x00-\x7f]/.test(text))) {
            return normalize(text, this.#normalization, this.#ignoreRepeatedLetters);
        }
        const literal = normalize(text, 'standard', this.#ignoreRepeatedLetters, true);
        internalBang ??= new RegExp(String.raw`[\p{L}\p{N}\p{M}]![\p{L}\p{N}\p{M}]`, 'u');
        if (!internalBang.test(literal.text)) return literal;
        // A folded bang only adds matches beside an `i` neighborhood; without one the literal form holds every match.
        if (plain && !this.#ignoreRepeatedLetters && ASCII_TEXT.test(text) && !this.#bangNeighborhood(text)) return literal;
        const starts = new Set<number>();
        const ends = new Set<number>();
        // An exclamation between already complete literal dictionary words is
        // punctuation, rather than a way to hide them by joining them with i.
        this.#matcher!.scan(literal, true, (match) => { starts.add(match.start); ends.add(match.end); });
        const protectedBangs = new Set<number>();
        for (let index = 0; index < literal.text.length; index++) {
            if (literal.text[index] === '!' && (ends.has(literal.ends[index - 1]) || starts.has(literal.starts[index + 1]))) {
                protectedBangs.add(literal.starts[index]);
            }
        }
        if (protectedBangs.size) {
            const folded = normalize(text, 'standard', this.#ignoreRepeatedLetters);
            const bangOffsets = [...new Set(literal.starts.filter((_, index) => literal.text[index] === '!'))];
            let firstBang = 0;
            const bangs = folded.starts.map((start, index) => {
                while (firstBang < bangOffsets.length && bangOffsets[firstBang] < start) firstBang++;
                return folded.wordCharacters[index] && firstBang < bangOffsets.length
                    && bangOffsets[firstBang] < folded.ends[index];
            });
            const prefix = [0];
            for (const bang of bangs) prefix.push(prefix[prefix.length - 1] + Number(bang));
            const covered = new Int32Array(folded.text.length + 1);
            // A complete folded word takes precedence over a shorter literal
            // prefix, even when another exclamation separates it from a neighbor.
            this.#matcher!.scan(folded, false, ({ from, to }) => {
                if ((folded.wordCharacters[from - 1] && !bangs[from - 1])
                    || (folded.wordCharacters[to] && !bangs[to]) || prefix[to] === prefix[from]) return;
                covered[from]++;
                covered[to]--;
            }, false, (end) => (!folded.wordCharacters[end] || bangs[end])
                && prefix[end] > prefix[Math.max(0, end - this.#maxKeyLength)]);
            let depth = 0;
            firstBang = 0;
            for (let index = 0; index < folded.text.length; index++) {
                depth += covered[index];
                while (firstBang < bangOffsets.length && bangOffsets[firstBang] < folded.starts[index]) firstBang++;
                if (depth && bangs[index]) {
                    for (let bang = firstBang; bang < bangOffsets.length && bangOffsets[bang] < folded.ends[index]; bang++) {
                        protectedBangs.delete(bangOffsets[bang]);
                    }
                }
            }
        }
        return normalize(text, 'standard', this.#ignoreRepeatedLetters, protectedBangs);
    }

    #bangNeighborhood(text: string): boolean {
        const matcher = this.#compileMatcher();
        if (this.#bangGuard?.matcher !== matcher) this.#bangGuard = { matcher, pattern: bangCandidates([...this.#dictionary]) };
        return !this.#bangGuard.pattern || this.#bangGuard.pattern.test(text);
    }

    #window(mode?: MaxMatchesMode): MatchWindow {
        return new MatchWindow(this.#maxMatches, (mode ?? this.#onMaxMatches) === 'truncate');
    }

    /** True if any dictionary word matches. Empty input is clean. */
    flag(text: string, options?: CheckOptions): boolean {
        validateText(text);
        const accept = this.#acceptance(text, options);
        if (accept || this.#evasion) {
            let found = false;
            this.#scan(text, () => { found = true; return false; }, false, false, accept);
            return found;
        }
        if (!text.length || !this.#dictionary.size) return false;
        if (this.#longWord(text)) return false;
        const warm = this.#native?.censorPattern ?? this.#native?.pattern ?? ((this.#native?.tokenWork ?? 0) >= PATTERN_WARMUP);
        const value = warm || this.#normalization !== 'standard' ? text : text.toLowerCase();
        const native = this.#nativeFor(text, !!warm, warm ? undefined : value);
        if (native === CLEAN) return false;
        if (native instanceof UnicodeView) {
            let found = false;
            native.scan(() => { found = true; return false; });
            return found;
        }
        if (native) {
            if (warm) {
                const pattern = native.censorPattern ?? this.#pattern(native);
                pattern.lastIndex = 0;
                return pattern.test(text);
            }
            native.tokenWork = (native.tokenWork ?? 0) + text.length;
            WORD_TOKENS.lastIndex = 0;
            let token: RegExpExecArray | null;
            while ((token = WORD_TOKENS.exec(value)) !== null) {
                if (this.#dictionary.has(token[0])) return true;
            }
            return false;
        }
        let found = false;
        this.#scan(text, () => { found = true; return false; }, false, true);
        return found;
    }
    #locations(text: string, accept?: MatchAcceptance, window = this.#window()): FindResult {
        this.#scan(text, (match) => window.add(match), false, false, accept, false, undefined, true, window);
        const seen = new Map<string, MatchVia>();
        const result = window.finish().map((match) => location(text, match, this.#provenance, seen));
        return (window.truncated ? Object.defineProperty(result, 'truncated', { value: true }) : result) as FindResult;
    }
    /**
     * All occurrences in source order; dictionary order breaks ties. Past maxMatches it throws a RangeError, or with
     * onMaxMatches: 'truncate' returns the first maxMatches in source order and sets `truncated`.
     */
    find(text: string, options?: FindOptions): FindResult {
        return this.#locations(text, this.#acceptance(text, options), this.#window(maxMatchesMode(options?.onMaxMatches)));
    }
    /** Unique found dictionary words in dictionary insertion order. */
    badwords(text: string, options?: CheckOptions): string[] {
        const accept = this.#acceptance(text, options);
        const found = new Set<string>();
        this.#scan(text, ({ word }) => { found.add(word); return found.size < this.#dictionary.size; }, false, false, accept, true);
        return [...this.#dictionary].filter((word) => found.has(word));
    }
    #censorCallback(text: string, replacement: (context: DetailedCensorContext) => string, accept?: MatchAcceptance, mode?: MaxMatchesMode): string {
        validateText(text);
        const advanced = this.#evasion?.potential(text);
        if (!text.length || !this.#dictionary.size || (!advanced && this.#longWord(text))) return text;
        const native = advanced ? undefined : this.#nativeFor(text);
        if (native === CLEAN) return text;
        const spans = advanced ? this.#evasion!.censor(this.#normalizeInput(text), this.#mode === 'word', accept)
            : native ? [] : this.#compileMatcher().scanCensor(this.#normalizeInput(text, true), this.#mode === 'word', accept);
        if (native) {
            const collect = ({ word, start, end, order }: Match) => {
                spans.push({ start, end, entries: [{ word, key: word, order }] });
            };
            // Unicode views only accept independent simple whole-word matches.
            if (native instanceof UnicodeView) native.scan(collect, accept);
            else this.#scan(text, collect, false, false, accept);
        }
        const pieces: string[] = [];
        let index = 0;
        const version = this.#version;
        const within = occurrencesWithin(() => {
            if (version !== this.#version) throw new TypeError('dictionary changed during censor()');
            return this.#locations(text, accept, this.#window(mode));
        });
        for (const span of spans) {
            const words = Object.freeze(span.entries.sort((a, b) => a.order - b.order).map((entry) => entry.word));
            const context = { text, index: span.start, end: span.end, match: text.slice(span.start, span.end), words };
            // A closure, not a this-bound method, so destructured callbacks work.
            Object.defineProperty(context, 'occurrences', { value: () => within(context) });
            const value = replacement(Object.freeze(context) as DetailedCensorContext);
            if (typeof value !== 'string') throw new TypeError('censor callback must return a string');
            pieces.push(text.slice(index, span.start), value);
            index = span.end;
        }
        pieces.push(text.slice(index));
        return pieces.join('');
    }

    /** Replace merged spans in source order; adjacent occurrences stay separate. */
    censor(text: string, replacement: string | ((context: DetailedCensorContext) => string) = '***', options?: CheckOptions): string {
        const accept = this.#acceptance(text, options);
        if (typeof replacement === 'function') return this.#censorCallback(text, replacement, accept);
        validateText(text);
        validateText(replacement);
        if (!text.length || !this.#dictionary.size) return text;
        const advanced = this.#evasion?.potential(text);
        if (!advanced && this.#longWord(text)) return text;
        const native = accept || advanced ? undefined : this.#nativeFor(text, true);
        if (native === CLEAN) return text;
        if (native instanceof UnicodeView) {
            const spans: Array<{ start: number; end: number }> = [];
            native.scan((match) => { mergeSpan(spans, match); });
            return replaceSpans(text, spans, replacement);
        }
        if (native) {
            // Native replacement strings interpret $&, $1, $` and $'. Escape
            // dollars once so the public replacement remains entirely literal.
            return text.replace(native.censorPattern ?? this.#pattern(native),
                replacement.includes('$') ? replacement.split('$').join('$$') : replacement);
        }
        const spans: Array<{ start: number; end: number }> = [];
        this.#scan(text, (match) => { mergeSpan(spans, match); }, true, !accept, accept, false, advanced);
        return replaceSpans(text, spans, replacement);
    }
    /** Remove matches and collapse whitespace runs to one space (or, with preserveLineBreaks, to their line breaks); the result is trimmed. */
    filter(text: string, options?: FilterOptions): string {
        const keep = options?.preserveLineBreaks;
        if (keep !== undefined && typeof keep !== 'boolean') throw new TypeError('preserveLineBreaks must be a boolean');
        return collapseWhitespace(this.censor(text, '', options), keep === true);
    }
    /**
     * Scan once for source spans, unique words, counts and censored output. `censored` always covers every match.
     * Past maxMatches it throws a RangeError, or with onMaxMatches: 'truncate' every field except `censored` and
     * `words` describes the first maxMatches occurrences in source order, and `truncated: true` is added.
     */
    analyze(text: string, options?: AnalyzeOptions): AnalysisReport {
        const accept = this.#acceptance(text, options);
        const mode = maxMatchesMode(options?.onMaxMatches);
        const replacement = options?.replacement === undefined ? '***' : options.replacement;
        if (typeof replacement !== 'function') validateText(replacement);
        const window = this.#window(mode);
        const spans: Array<{ start: number; end: number }> = [];
        const found = new Set<string>();
        const merge = typeof replacement !== 'function';
        // Without a callback, `censored` needs every span, so the scan continues past a full window (which then ignores the rest).
        this.#scan(text, merge
            ? (match) => { window.add(match); found.add(match.word); mergeSpan(spans, match); }
            : (match) => window.add(match), false, false, accept, false, undefined, true, window);
        const matches = window.finish();
        // A truncating window may have seen (and ignored) more words than it kept.
        if (window.truncating || !merge) { found.clear(); for (const match of matches) found.add(match.word); }
        const seen = new Map<string, MatchVia>();
        const badwords = [...this.#dictionary].filter((word) => found.has(word));
        const censored = merge ? replaceSpans(text, spans, replacement) : this.#censorCallback(text, replacement, accept, mode);
        const result: AnalysisReport = { text, words: text.match(/\S+/gu)?.length ?? 0, censored,
            badwords, count: badwords.length, occurrenceCount: matches.length,
            locations: matches.map((match) => location(text, match, this.#provenance, seen)) };
        return window.truncated ? { ...result, truncated: true } : result;
    }
}

const instance = new Badwords();
export default instance;
export const flag = instance.flag.bind(instance);
export const find = instance.find.bind(instance);
export const badwords = instance.badwords.bind(instance);
export const filter = instance.filter.bind(instance);
export const censor = instance.censor.bind(instance);
export const analyze = instance.analyze.bind(instance);
/** @deprecated Mutates the process-wide default checker, so one dependency can change another's results. Use an isolated `new Badwords({ dictionary })` and its `addWords()`. The default export is the same shared instance, so `badwords.addWords()` does the same without a deprecation hint. Still works throughout 2.x. */
export const addWords = instance.addWords.bind(instance);
/** @deprecated Mutates the process-wide default checker, so one dependency can change another's results. Use an isolated `new Badwords({ dictionary })` and its `removeWords()`. The default export is the same shared instance, so `badwords.removeWords()` does the same without a deprecation hint. Still works throughout 2.x. */
export const removeWords = instance.removeWords.bind(instance);
