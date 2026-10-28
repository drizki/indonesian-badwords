import { dictionary as defaultDictionary } from './dictionary.ts';
import { Matcher, type Match } from './matcher.ts';
import { canonicalSearchText, isSimpleUnicodeAtom, normalize, normalizeKey, trimDictionaryWord,
    type Normalization, type NormalizedText } from './normalize.ts';
import { canonicalCandidatePattern, prepareNativePatterns, potentialPattern, type NativePatterns } from './pattern.ts';

declare const __BADWORDS_PRESET_PATTERNS__: NativePatterns | undefined;
const presetPatterns = typeof __BADWORDS_PRESET_PATTERNS__ === 'undefined' ? undefined : __BADWORDS_PRESET_PATTERNS__;

export { dictionary, contextualDictionary, expandedDictionary } from './dictionary.ts';
export type { DictionaryWord, ContextualDictionaryWord, ExpandedDictionaryWord } from './dictionary.ts';
export type { Normalization } from './normalize.ts';

/** One occurrence with exclusive end and UTF-16 offsets into the original input. */
export interface BadwordLocation {
    word: string;
    index: number;
    end: number;
    /** Exact matched source text, including any obfuscation. */
    match: string;
}

/** One merged source span passed to a censorship callback. */
export interface CensorContext {
    readonly text: string;
    readonly index: number;
    readonly end: number;
    readonly match: string;
    /** Unique contributing dictionary words, in dictionary insertion order. */
    readonly words: readonly string[];
}
export type CensorCallback = (context: CensorContext) => string;
export type CensorReplacement = string | CensorCallback;

export interface AnalysisResult {
    text: string;
    /** Nonempty whitespace-separated tokens, not linguistic word segmentation. */
    words: number;
    censored: string;
    /** Unique dictionary words in dictionary insertion order. */
    badwords: string[];
    /** Unique matched dictionary words. */
    count: number;
    /** Every occurrence, including overlapping dictionary matches. */
    occurrenceCount: number;
    locations: BadwordLocation[];
}

export type MatchMode = 'substring' | 'word';
export interface BadwordsOptions {
    dictionary?: readonly string[];
    /** Defaults to whole-word matching. */
    mode?: MatchMode;
    /** Standard: NFKC, lowercase, invisible-character removal and internal leetspeak. */
    normalization?: Normalization;
    /** Opt in to stretched spellings such as gooooblok. Defaults to false. */
    ignoreRepeatedLetters?: boolean;
    /** Maximum detailed occurrences for find/analyze. Defaults to 10,000; Infinity disables the cap. */
    maxMatches?: number;
}

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
function location(text: string, match: Match): BadwordLocation {
    return { word: match.word, index: match.start, end: match.end, match: text.slice(match.start, match.end) };
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
    words: readonly string[];
    patterns: NativePatterns;
    potential?: RegExp;
    bangPotential?: RegExp;
    canonicalLiteral?: RegExp | null;
    canonicalFolding?: RegExp | null;
}

const ASCII_TEXT = /^[\x00-\x7f]*$/;
// Pure numbers do not fold. Digits attached to letters, or joining symbols,
// require the normalization engine and its original-source span mapping.
const ASCII_WORD = /^[A-Za-z0-9]+$/;
const WORD_TOKENS = /[a-z0-9]+/gi;
const FOLDING_CHARACTERS = /[0-9@$(|!]/;
let internalBang: RegExp | undefined;
let bareEmoji: RegExp | undefined;
const emojiDelimiters = new Map<number, boolean>();
const CLEAN = 'clean';
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
    readonly #dictionary = new Set<string>();
    readonly #mode: MatchMode;
    readonly #normalization: Normalization;
    readonly #ignoreRepeatedLetters: boolean;
    readonly #maxMatches: number;
    #matcher: Matcher | undefined;
    #maxKeyLength = 0;
    #maxWordLength = 0;
    #native: NativeMatcher | null | undefined;
    #preset = false;

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
        if (options.dictionary !== undefined && !Array.isArray(options.dictionary)) {
            throw new TypeError('dictionary must be an array of strings');
        }
        this.#mode = mode;
        this.#normalization = normalization;
        this.#ignoreRepeatedLetters = ignoreRepeatedLetters;
        this.#maxMatches = maxMatches;
        if (options.dictionary === undefined || (options.dictionary as readonly string[]) === defaultDictionary) {
            // The bundled, frozen lexicon is already canonical. Copy its values
            // without allocating normalization maps for every term at import.
            this.#preset = true;
            for (const word of defaultDictionary) {
                this.#dictionary.add(word);
                this.#maxWordLength = Math.max(this.#maxWordLength, word.length);
            }
        } else {
            this.addWords(options.dictionary);
        }
    }

    /** A snapshot; mutating it does not change the checker. */
    get dict(): string[] { return [...this.#dictionary]; }

    addWords(words: string | readonly string[]): void {
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
                this.#preset = false;
            }
        }
    }
    removeWords(words: string | readonly string[]): void {
        for (const word of wordsArray(words)) {
            if (this.#dictionary.delete(word)
                || this.#dictionary.delete(trimDictionaryWord(normalizeKey(trimDictionaryWord(word), this.#normalization)))) {
                this.#matcher = undefined;
                this.#native = undefined;
                this.#preset = false;
            }
        }
    }

    #longWord(text: string): boolean {
        // A single unbroken ASCII word cannot contain a shorter whole-word
        // entry. Standard folding preserves its length unless repeats are enabled.
        return this.#mode === 'word' && !this.#ignoreRepeatedLetters
            && text.length > this.#maxWordLength && ASCII_WORD.test(text);
    }

    #canonicalSearch(text: string, native: NativeMatcher): typeof CLEAN | undefined {
        const canonical = canonicalSearchText(text);
        const folding = FOLDING_CHARACTERS.test(canonical);
        const key = folding ? 'canonicalFolding' : 'canonicalLiteral';
        if (native[key] === undefined) native[key] = canonicalCandidatePattern(native.patterns, folding) ?? null;
        const pattern = native[key];
        // The canonical text precedes ASCII substitutions. Aliases include
        // every possible fold and protected literal bang. Final composition
        // cannot create an ASCII key; boundaries only remove occurrences.
        return pattern && !pattern.test(canonical) ? CLEAN : undefined;
    }

    #nativeFor(text: string, censorship = false, literal?: string): NativeMatcher | typeof CLEAN | undefined {
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
        native.hazards.lastIndex = 0;
        let hazard: RegExpExecArray | null;
        let folding = false;
        let bangs = false;
        while ((hazard = native.hazards.exec(text)) !== null) {
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
                native.hazards.lastIndex += point > 0xffff ? 1 : 0;
                continue;
            }
            if (code === 95) { folding = true; continue; }
            if (this.#normalization === 'none') continue;
            const before = text.charCodeAt(hazard.index - 1);
            let end = hazard.index + 1;
            if (code >= 48 && code <= 57) {
                while (text.charCodeAt(end) >= 48 && text.charCodeAt(end) <= 57) end++;
                native.hazards.lastIndex = end;
            }
            const after = text.charCodeAt(end);
            if (code >= 48 && code <= 57) {
                if (asciiLetter(before) || asciiLetter(after)) folding = true;
            } else if (asciiWord(before) && asciiWord(after)) {
                if (code === 33) bangs = true;
                else folding = true;
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
            native.bangPotential ??= potentialPattern(native.words, true);
            if (native.bangPotential.test(text)) return;
        }
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

    #scan(text: string, visit: (match: Match) => boolean | void, spansOnly = false, skipNative = false): void {
        validateText(text);
        if (!text.length || !this.#dictionary.size) return;
        if (this.#longWord(text)) return;
        const native = skipNative ? undefined : this.#nativeFor(text);
        if (native === CLEAN) return;
        if (native) {
            const pattern = this.#pattern(native);
            let occurrence: RegExpExecArray | null;
            while ((occurrence = pattern.exec(text)) !== null) {
                native.orders ??= new Map(native.words.map((word, order) => [word, order]));
                const start = occurrence.index;
                const end = start + occurrence[0].length;
                const word = this.#normalization === 'standard' ? occurrence[0].toLowerCase() : occurrence[0];
                if (visit({ word, start, end, from: start, to: end, order: native.orders.get(word)! }) === false) break;
            }
            return;
        }
        this.#compileMatcher().scan(this.#normalizeInput(text), this.#mode === 'word', visit, spansOnly);
    }

    #normalizeInput(text: string): NormalizedText {
        if (this.#normalization !== 'standard' || (!text.includes('!') && !/[^\x00-\x7f]/.test(text))) {
            return normalize(text, this.#normalization, this.#ignoreRepeatedLetters);
        }
        const literal = normalize(text, 'standard', this.#ignoreRepeatedLetters, true);
        internalBang ??= new RegExp(String.raw`[\p{L}\p{N}\p{M}]![\p{L}\p{N}\p{M}]`, 'u');
        if (!internalBang.test(literal.text)) return literal;
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

    #append(matches: Match[], match: Match): void {
        if (matches.length >= this.#maxMatches) {
            throw new RangeError('Match limit exceeded; increase maxMatches or use flag(), badwords(), or censor()');
        }
        matches.push(match);
    }

    /** True if any dictionary word matches. Empty input is clean. */
    flag(text: string): boolean {
        validateText(text);
        if (!text.length || !this.#dictionary.size) return false;
        if (this.#longWord(text)) return false;
        const value = this.#normalization === 'standard' ? text.toLowerCase() : text;
        const native = this.#nativeFor(text, false, value);
        if (native === CLEAN) return false;
        if (native) {
            // Lexical Set lookups stop at the first matched token and avoid
            // compiling the full dictionary search regex for boolean checks.
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
    /** All occurrences in source order; dictionary order breaks ties. */
    find(text: string): BadwordLocation[] {
        const matches: Match[] = [];
        this.#scan(text, (match) => { this.#append(matches, match); });
        matches.sort((a, b) => a.start - b.start || a.order - b.order || a.end - b.end);
        return matches.map((match) => location(text, match));
    }
    /** Unique found dictionary words in dictionary insertion order. */
    badwords(text: string): string[] {
        const found = new Set<string>();
        this.#scan(text, ({ word }) => { found.add(word); return found.size < this.#dictionary.size; });
        return [...this.#dictionary].filter((word) => found.has(word));
    }
    #censorCallback(text: string, replacement: CensorCallback): string {
        validateText(text);
        if (!text.length || !this.#dictionary.size || this.#longWord(text)) return text;
        const native = this.#nativeFor(text);
        if (native === CLEAN) return text;
        const spans = native ? [] : this.#compileMatcher().scanCensor(this.#normalizeInput(text), this.#mode === 'word');
        if (native) this.#scan(text, ({ word, start, end, order }) => {
            spans.push({ start, end, entries: [{ word, key: word, order }] });
        });
        const pieces: string[] = [];
        let index = 0;
        for (const span of spans) {
            const words = Object.freeze(span.entries.sort((a, b) => a.order - b.order).map((entry) => entry.word));
            const context: CensorContext = Object.freeze({ text, index: span.start, end: span.end,
                match: text.slice(span.start, span.end), words });
            const value = replacement(context);
            if (typeof value !== 'string') throw new TypeError('censor callback must return a string');
            pieces.push(text.slice(index, span.start), value);
            index = span.end;
        }
        pieces.push(text.slice(index));
        return pieces.join('');
    }

    /** Replace merged spans in source order; adjacent occurrences stay separate. */
    censor(text: string, replacement: CensorReplacement = '***'): string {
        if (typeof replacement === 'function') return this.#censorCallback(text, replacement);
        validateText(text);
        validateText(replacement);
        if (!text.length || !this.#dictionary.size) return text;
        if (this.#longWord(text)) return text;
        const native = this.#nativeFor(text, true);
        if (native === CLEAN) return text;
        if (native) {
            // Native replacement strings interpret $&, $1, $` and $'. Escape
            // dollars once so the public replacement remains entirely literal.
            return text.replace(native.censorPattern ?? this.#pattern(native),
                replacement.includes('$') ? replacement.split('$').join('$$') : replacement);
        }
        const spans: Array<{ start: number; end: number }> = [];
        this.#scan(text, (match) => { mergeSpan(spans, match); }, true, true);
        return replaceSpans(text, spans, replacement);
    }
    filter(text: string): string { return this.censor(text, '').replace(/\s+/gu, ' ').trim(); }
    /** Scan once for source spans, unique words, counts and censored output. */
    analyze(text: string): AnalysisResult {
        const matches: Match[] = [];
        const found = new Set<string>();
        const spans: Array<{ start: number; end: number }> = [];
        this.#scan(text, (match) => { this.#append(matches, match); found.add(match.word); mergeSpan(spans, match); });
        matches.sort((a, b) => a.start - b.start || a.order - b.order || a.end - b.end);
        const badwords = [...this.#dictionary].filter((word) => found.has(word));
        return { text, words: text.match(/\S+/gu)?.length ?? 0, censored: replaceSpans(text, spans, '***'),
            badwords, count: badwords.length, occurrenceCount: matches.length,
            locations: matches.map((match) => location(text, match)) };
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
export const addWords = instance.addWords.bind(instance);
export const removeWords = instance.removeWords.bind(instance);
