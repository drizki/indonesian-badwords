import { acceptsEnd, acceptsStart, type CensorSpan, type Entry, type Match, type MatcherNode } from '../core/matcher.ts';
import type { EvasionRuntime, TrieLimit } from './types.ts';
import type { Normalization, NormalizedText } from '../text/normalize.ts';
import type { EvasionLimit } from './policy.ts';

export interface CompiledOptions {
    readonly minLength: number; readonly maxLength: number;
    readonly separators: readonly string[]; readonly mappings: readonly (readonly [string, string])[];
    readonly maxGap: number; readonly maxGaps: number; readonly extra: number; readonly maxRepeats: number;
    readonly maxConfusables: number; readonly requireAsciiLetter: boolean;
    readonly maxInputLength: number; readonly maxStates: number; readonly maxSteps: number;
    readonly maxCompileStates: number; readonly maxDictionaryLength: number;
}
type Fail = (limit: EvasionLimit, maximum: number, used: number) => never;
interface Meter { tick(): void }
const FIELDS = 8;
function ascii(code: number): boolean { return (code >= 65 && code <= 90) || (code >= 97 && code <= 122); }
function hash(a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number): number {
    let n = Math.imul(a ^ b, 0x9e3779b1);
    n = Math.imul(n ^ c, 16777619); n = Math.imul(n ^ d, 16777619);
    n = Math.imul(n ^ e, 16777619); n = Math.imul(n ^ f, 16777619);
    return Math.imul(Math.imul(n ^ g, 16777619) ^ h, 16777619) >>> 0;
}

/** Two bounded frontiers, without per-transition tuple objects or string keys. */
class Frontier {
    values: Uint32Array;
    size = 0;
    #capacity: number;
    #slots: Uint32Array;
    #stamps: Uint32Array;
    #epoch = 1;
    constructor(readonly maximum: number, readonly fail: Fail, readonly meter: Meter) {
        this.#capacity = Math.min(16, maximum);
        this.values = new Uint32Array(this.#capacity * FIELDS);
        let slots = 1; while (slots < this.#capacity * 2) slots *= 2;
        this.#slots = new Uint32Array(slots); this.#stamps = new Uint32Array(slots);
    }
    clear(): void {
        this.size = 0;
        if (++this.#epoch > 0xffff_ffff) { this.#stamps.fill(0); this.#epoch = 1; }
    }
    #grow(): void {
        const old = this.values;
        this.#capacity = Math.min(this.maximum, this.#capacity * 2);
        this.values = new Uint32Array(this.#capacity * FIELDS); this.values.set(old);
        let slots = 1; while (slots < this.#capacity * 2) slots *= 2;
        this.#slots = new Uint32Array(slots); this.#stamps = new Uint32Array(slots);
        for (let i = 0; i < this.size; i++) {
            const p = i * FIELDS, v = this.values;
            let at = hash(v[p], v[p + 1], v[p + 2], v[p + 3], v[p + 4], v[p + 5], v[p + 6], v[p + 7]) & (slots - 1);
            while (this.#stamps[at] === this.#epoch) { this.meter.tick(); at = (at + 1) & (slots - 1); }
            this.#stamps[at] = this.#epoch; this.#slots[at] = i;
        }
    }
    add(a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number): void {
        this.meter.tick();
        const fingerprint = hash(a, b, c, d, e, f, g, h);
        let at = fingerprint & (this.#slots.length - 1);
        while (this.#stamps[at] === this.#epoch) {
            this.meter.tick();
            const p = this.#slots[at] * FIELDS, v = this.values;
            if (v[p] === a && v[p + 1] === b && v[p + 2] === c && v[p + 3] === d
                && v[p + 4] === e && v[p + 5] === f && v[p + 6] === g && v[p + 7] === h) return;
            at = (at + 1) & (this.#slots.length - 1);
        }
        if (this.size >= this.maximum) this.fail('states', this.maximum, this.size + 1);
        if (this.size === this.#capacity) {
            this.#grow(); at = fingerprint & (this.#slots.length - 1);
            while (this.#stamps[at] === this.#epoch) { this.meter.tick(); at = (at + 1) & (this.#slots.length - 1); }
        }
        const p = this.size * FIELDS, v = this.values;
        v[p] = a; v[p + 1] = b; v[p + 2] = c; v[p + 3] = d;
        v[p + 4] = e; v[p + 5] = f; v[p + 6] = g; v[p + 7] = h;
        this.#stamps[at] = this.#epoch; this.#slots[at] = this.size++;
    }
}

interface Cluster { start: number; end: number; entries: Set<Entry> }
function contribute(spans: Cluster[], start: number, end: number, entries: Set<Entry>): void {
    let current: Cluster = { start, end, entries };
    while (spans.length && start < spans[spans.length - 1].end) {
        const previous = spans.pop()!;
        start = Math.min(start, previous.start);
        const larger = current.entries.size >= previous.entries.size ? current : previous;
        const smaller = larger === current ? previous : current;
        for (const word of smaller.entries) larger.entries.add(word);
        current = larger; current.start = start; current.end = end;
    }
    spans.push(current);
}

export function prepareEvasion(config: CompiledOptions, normalization: Normalization,
    canonicalize: (text: string, normalization: Normalization) => string) {
    const gaps = new Set<number>(), mappings = new Map<number, number>();
    for (const character of config.separators) {
        const canonical = canonicalize(character, normalization);
        if ([...canonical].length !== 1 || !/^[\p{P}\p{Zs}]$/u.test(canonical)
            || (normalization === 'standard' && /[@!(]/.test(canonical)))
            throw new TypeError('separator changes into a letter, expansion, or incompatible character during normalization');
        gaps.add(canonical.codePointAt(0)!);
    }
    for (const [source, target] of config.mappings) {
        const a = canonicalize(source, normalization), b = canonicalize(target, normalization);
        if ([...a].length !== 1 || !/^\p{L}$/u.test(a) || /\p{Grapheme_Extend}/u.test(a) || !/^[a-z]$/i.test(b) || a === b)
            throw new TypeError('mapping must remain one distinct source letter and one ASCII letter after normalization');
        const code = a.codePointAt(0)!, replacement = b.charCodeAt(0);
        if (mappings.has(code) && mappings.get(code) !== replacement) throw new TypeError('conflicting normalized mapping sources');
        mappings.set(code, replacement);
    }
    return { gaps, mappings };
}

export function compileEvasion(config: CompiledOptions, entries: readonly Entry[], normalization: Normalization,
    canonicalize: (text: string, normalization: Normalization) => string,
    trie: (limit: TrieLimit) => readonly MatcherNode[], candidateText: (text: string) => string | undefined, fail: Fail): EvasionRuntime {
    const { gaps, mappings } = prepareEvasion(config, normalization, canonicalize);
    const nodes = trie({ maximum: config.maxCompileStates,
        exceeded: used => fail('compileStates', config.maxCompileStates, used) });
    const expandable = new Uint8Array(nodes.length), eligible = new Uint8Array(entries.length);
    const last = new Uint16Array(nodes.length), bigrams = new Set<number>(), repeatLetters = new Set<number>();
    for (const node of nodes) for (const [code, child] of node.next) last[child] = code;
    for (const entry of entries) {
        if (!/^[a-z]+$/i.test(entry.key) || entry.key.length < config.minLength || entry.key.length > config.maxLength) continue;
        eligible[entry.order] = 1;
        let state = 0; expandable[0] = 1;
        for (let i = 0; i < entry.key.length; i++) {
            const code = entry.key.charCodeAt(i);
            state = nodes[state].next.get(code)!; expandable[state] = 1; repeatLetters.add(code);
            if (i) bigrams.add(entry.key.charCodeAt(i - 1) * 128 + code);
            if (config.extra) bigrams.add(code * 128 + code);
        }
    }
    const separatorChars = [...gaps].map(code => String.fromCodePoint(code).replace(/[\\\]\[\-^]/g, '\\$&')).join('');
    const separatorPattern = separatorChars ? new RegExp(`(?=([a-zA-Z])[${separatorChars}]+([a-zA-Z]))`, 'gu') : undefined;
    const repetitions = config.extra ? new RegExp('([a-zA-Z])\\1', normalization === 'standard' ? 'gi' : 'g') : undefined;
    const nonAscii = /[^\x00-\x7f]/;
    const folding = /[@$(|!]|[a-z][0-9]|[0-9][a-z]/i;
    const enabled = eligible.some(Boolean);
    const parents = new Map<number, number>();
    const root = (code: number): number => {
        let at = code;
        while (parents.has(at)) at = parents.get(at)!;
        return at;
    };
    for (const [source, target] of mappings) {
        const a = root(source), b = root(target);
        if (a !== b) parents.set(a, b);
    }
    const classes = new Map<number, number>();
    for (const source of parents.keys()) classes.set(source, root(source));
    const mappingChars = [...classes.keys()].map(code => String.fromCodePoint(code)).join('');
    const mappingPattern = mappingChars ? new RegExp(`[${mappingChars}]`, 'gu') : undefined;
    const gapPattern = separatorChars ? new RegExp(`[${separatorChars}]`, 'gu') : undefined;
    function skeleton(text: string): string {
        const mapped = mappingPattern ? text.replace(mappingPattern,
            character => String.fromCodePoint(classes.get(character.codePointAt(0)!)!)) : text;
        const joined = gapPattern ? mapped.replace(gapPattern, '') : mapped;
        return joined.replace(/([a-zA-Z])\1+/g, '$1');
    }
    let candidatePattern: RegExp | undefined;
    // A rejected skeleton proves absence only. Mapping equivalence, gap deletion
    // and run collapse overapproximate every bounded path and every exact term.
    // Whole-source run merging preserves a matched window as a substring.
    // Candidate text uses the shared fold and final NFKC; ambiguous bangs fall back.
    if (enabled && entries.every(entry => /^[\x00-\x7f]*$/.test(entry.key))) {
        const patterns = new Set<string>(); let length = 0, valid = true;
        for (const entry of entries) {
            const key = skeleton(entry.key).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
            length += key.length + 1;
            if (!key || length > 65_536) { valid = false; break; }
            patterns.add(key);
        }
        if (valid && patterns.size) candidatePattern = new RegExp([...patterns].join('|'), 'u');
    }
    function trigger(text: string): boolean {
        for (const code of mappings.keys()) {
            const character = String.fromCodePoint(code);
            if (text.includes(character) || (normalization === 'standard' && code < 128 && text.includes(character.toUpperCase()))) return true;
        }
        if (repetitions) {
            repetitions.lastIndex = 0;
            let found: RegExpExecArray | null;
            while ((found = repetitions.exec(text))) {
                let code = found[1].charCodeAt(0);
                if (normalization === 'standard') code |= 32;
                if (repeatLetters.has(code)) return true;
            }
        }
        if (separatorPattern) {
            separatorPattern.lastIndex = 0;
            let found: RegExpExecArray | null;
            while ((found = separatorPattern.exec(text))) {
                separatorPattern.lastIndex = found.index + 1;
                let a = found[1].charCodeAt(0), b = found[2].charCodeAt(0);
                if (normalization === 'standard') { a |= 32; b |= 32; }
                if (bigrams.has(a * 128 + b)) return true;
            }
        }
        return false;
    }
    function potential(text: string): boolean {
        if (!enabled) return false;
        let canonical = normalization === 'standard' && (nonAscii.test(text) || folding.test(text))
            ? candidateText(text) : text;
        // Internal bangs have dictionary-dependent literal/fold interpretations.
        if (canonical === undefined) return true;
        if (!trigger(canonical)) return false;
        if (!candidatePattern) return true;
        if (normalization === 'standard' && canonical === text) canonical = text.toLowerCase();
        return candidatePattern.test(skeleton(canonical));
    }

    function run(value: NormalizedText, wholeWords: boolean,
        selection: 'all' | 'spans' | 'unique' | 'censor', visit?: (match: Match) => boolean | void,
        accept?: (start: number, end: number) => boolean): CensorSpan[] {
        let steps = 0;
        const meter = { tick() { if (++steps > config.maxSteps) fail('steps', config.maxSteps, steps); } };
        let active = new Frontier(config.maxStates, fail, meter), next = new Frontier(config.maxStates, fail, meter);
        const unique = selection === 'unique' ? new Uint8Array(entries.length) : undefined;
        const clusters: Cluster[] = [];
        for (let from = 0; from < value.text.length;) {
            const code = value.text.codePointAt(from)!, width = code > 0xffff ? 2 : 1, to = from + width;
            next.clear();
            const advance = (node: number, start: number, gapRun: number, totalGaps: number,
                repeatRun: number, repeats: number, conf: number, hasAscii: number): void => {
                meter.tick();
                const current = nodes[node];
                const consume = (symbol: number, newConf: number) => {
                    let child: number | undefined;
                    if (symbol > 0xffff) {
                        const first = current.next.get(((symbol - 0x10000) >>> 10) + 0xd800);
                        child = first === undefined ? undefined : nodes[first].next.get(((symbol - 0x10000) & 1023) + 0xdc00);
                    } else child = current.next.get(symbol);
                    const asciiInput = hasAscii || Number(ascii(code) && newConf === conf);
                    if (child !== undefined && (!(totalGaps || repeats || newConf) || expandable[child]))
                        next.add(child, start, 0, totalGaps, 0, repeats, newConf, asciiInput);
                    if (node && expandable[node] && symbol === last[node] && ascii(symbol)
                        && repeatRun < config.extra && repeats < config.maxRepeats)
                        next.add(node, start, 0, totalGaps, repeatRun + 1, repeats + 1, newConf, asciiInput);
                };
                consume(code, conf);
                if (expandable[node] && mappings.has(code) && conf < config.maxConfusables)
                    consume(mappings.get(code)!, conf + 1);
                if (node && expandable[node] && gaps.has(code) && gapRun < config.maxGap && totalGaps < config.maxGaps)
                    next.add(node, start, gapRun + 1, totalGaps + 1, repeatRun, repeats, conf, hasAscii);
            };
            if (acceptsStart(value, from, wholeWords)) advance(0, from, 0, 0, 0, 0, 0, 0);
            for (let p = 0; p < active.size * FIELDS; p += FIELDS) {
                const a = active.values;
                advance(a[p], a[p + 1], a[p + 2], a[p + 3], a[p + 4], a[p + 5], a[p + 6], a[p + 7]);
            }
            if (acceptsEnd(value, to, wholeWords)) {
                let longestStart = Infinity, longestOrigin = 0, longestEntry: Entry | undefined;
                let coverage = Infinity, contributors: Set<Entry> | undefined;
                const seen = selection === 'all' ? new Map<number, Set<number>>() : undefined;
                const accepted = accept ? new Map<number, boolean>() : undefined;
                for (let p = 0; p < next.size * FIELDS; p += FIELDS) {
                    const a = next.values, node = a[p], origin = a[p + 1];
                    if (a[p + 2] || (a[p + 6] && config.requireAsciiLetter && !a[p + 7])) continue;
                    for (const entry of nodes[node].entries) {
                        meter.tick();
                        if ((a[p + 3] || a[p + 5] || a[p + 6]) && !eligible[entry.order]) continue;
                        if (unique?.[entry.order]) continue;
                        const start = value.starts[origin], end = value.ends[to - 1];
                        if (accept) {
                            let allowed = accepted!.get(start);
                            if (allowed === undefined) { allowed = accept(start, end); accepted!.set(start, allowed); }
                            if (!allowed) continue;
                        }
                        if (selection === 'censor') {
                            coverage = Math.min(coverage, start);
                            (contributors ??= new Set()).add(entry);
                            continue;
                        }
                        if (selection === 'spans') {
                            if (start < longestStart) { longestStart = start; longestOrigin = origin; longestEntry = entry; }
                            continue;
                        }
                        if (seen) {
                            let origins = seen.get(entry.order);
                            if (origins?.has(start)) continue;
                            if (!origins) seen.set(entry.order, origins = new Set());
                            origins.add(start);
                        }
                        if (unique) unique[entry.order] = 1;
                        if (visit!({ word: entry.word, start, end, order: entry.order, from: origin, to }) === false) return [];
                    }
                }
                if (contributors) contribute(clusters, coverage, value.ends[to - 1], contributors);
                if (longestEntry && visit!({ word: longestEntry.word, start: longestStart, end: value.ends[to - 1],
                    order: longestEntry.order, from: longestOrigin, to }) === false) return [];
            }
            [active, next] = [next, active]; from = to;
        }
        return clusters.map(({ start, end, entries }) => ({ start, end, entries: [...entries] }));
    }
    return Object.freeze<EvasionRuntime>({
        checkInput(text: string) { if (text.length > config.maxInputLength) fail('input', config.maxInputLength, text.length); },
        potential,
        scan: (value, wholeWords, visit, selection, accept) => { run(value, wholeWords, selection, visit, accept); },
        censor: (value, wholeWords, accept) => run(value, wholeWords, 'censor', undefined, accept)
    });
}
