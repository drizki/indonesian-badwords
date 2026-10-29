import { acceptsEnd, acceptsStart, type CensorSpan, type Entry, type Match, type MatcherNode } from '../core/matcher.ts';
import type { EvasionCompiler, EvasionRuntime, TrieLimit } from '../evasion/types.ts';
import type { Normalization, NormalizedText } from '../text/normalize.ts';
import type { FuzzyConfig } from './types.ts';
import type { FuzzyLimit } from './policy.ts';
import { FuzzyIndex, type FuzzyMeter } from './candidates.ts';

type Fail = (limit: FuzzyLimit, maximum: number, used: number) => never;
const ascii = (code: number) => (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
interface Projection {
    origin: number; text: string; length: number; last: number; repeatRun: number; repeats: number;
    gap: number; gaps: number; maps: number; ascii: boolean; cuts: string; front?: Int32Array;
}
interface Cluster { start: number; end: number; entries: Set<Entry> }
function contribute(spans: Cluster[], start: number, end: number, entries: Set<Entry>): void {
    let current: Cluster = { start, end, entries };
    while (spans.length && start < spans[spans.length - 1].end) {
        const previous = spans.pop()!; start = Math.min(start, previous.start);
        const larger = current.entries.size >= previous.entries.size ? current : previous;
        const smaller = larger === current ? previous : current;
        for (const entry of smaller.entries) larger.entries.add(entry);
        current = larger; current.start = start; current.end = end;
    }
    spans.push(current);
}

/** Does a within-budget alignment align a key scalar with the first and with the last separator-delimited segment? */
function anchored(a: readonly number[], b: readonly number[], first: number, last: number, config: FuzzyConfig, meter: FuzzyMeter): boolean {
    const n = a.length, m = b.length, k = config.maxEdits, inf = k + 1, width = m + 1;
    const bits = (j: number) => (j < first ? 1 : 0) | (j >= last ? 2 : 0);
    const cost = new Uint8Array((n + 1) * width * 4).fill(inf);
    const at = (i: number, j: number, mask: number) => (i * width + j) * 4 + mask;
    meter.tick((n + 1) * width);
    cost[at(0, 0, 0)] = 0;
    const relax = (i: number, j: number, mask: number, value: number) => { const slot = at(i, j, mask); if (value < cost[slot]) cost[slot] = value; };
    for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) for (let mask = 0; mask < 4; mask++) {
        const value = cost[at(i, j, mask)];
        if (value > k) continue;
        if (i < n && j < m) {
            if (a[i] === b[j]) relax(i + 1, j + 1, mask | bits(j), value);
            else if (config.substitutions) relax(i + 1, j + 1, mask | bits(j), value + 1);
        }
        if (i < n && config.deletions) relax(i + 1, j, mask, value + 1);
        if (j < m && config.insertions) relax(i, j + 1, mask, value + 1);
        if (config.model === 'osa' && i + 1 < n && j + 1 < m && a[i] === b[j + 1] && a[i + 1] === b[j])
            relax(i + 2, j + 2, mask | bits(j) | bits(j + 1), value + 1);
    }
    return cost[at(n, m, 3)] <= k;
}

export function compileFuzzy(config: FuzzyConfig, entries: readonly Entry[], normalization: Normalization,
    canonicalize: (text: string, normalization: Normalization) => string,
    trie: (limit: TrieLimit) => readonly MatcherNode[], _candidateText: (text: string) => string | undefined,
    fail: Fail, evasion?: EvasionCompiler): EvasionRuntime {
    const plan = evasion?.plan?.(normalization, canonicalize);
    if (evasion && (!plan || plan.version !== 1)) throw new TypeError('evasion descriptor does not support fuzzy composition');
    const bounded = (limit: 'input' | 'states' | 'steps' | 'compileStates' | 'dictionaryLength', own: number, other: number | undefined, used: number) => {
        if (other !== undefined && other < own) { if (used > other) plan!.exceeded(limit, other, used); }
        else if (used > own) fail(limit, own, used);
    };
    const compileMaximum = Math.min(config.maxCompileStates, plan?.maxCompileStates ?? Infinity);
    const nodes = trie({ maximum: compileMaximum, exceeded: used => bounded('compileStates', config.maxCompileStates, plan?.maxCompileStates, used) as never });
    let material = 0;
    for (const entry of entries) { material += entry.key.length; bounded('dictionaryLength', config.maxDictionaryLength, plan?.maxDictionaryLength, material); }
    const evasionEligible = (key: string) => Boolean(plan && /^[a-z]+$/i.test(key) && key.length >= plan.minLength && key.length <= plan.maxLength);
    const index = new FuzzyIndex(entries, config, evasionEligible, fail);
    const evasionWords = new Map<string, Entry[]>(); let maximumEvasion = 0;
    for (const entry of entries) if (evasionEligible(entry.key)) {
        const list = evasionWords.get(entry.key) ?? []; list.push(entry); evasionWords.set(entry.key, list);
        maximumEvasion = Math.max(maximumEvasion, entry.key.length);
    }
    const maximum = Math.max(index.maximum + config.maxEdits, maximumEvasion);
    const enabled = index.groups.length > 0 || evasionWords.size > 0;
    // Transformed paths exist only around a separator, a doubled letter or a mapped letter.
    const escape = (chars: Iterable<number>) => [...chars].map(code => String.fromCodePoint(code).replace(/[\\\]\[\-^]/g, '\\$&')).join('');
    const gate = plan && plan.prefilter !== false ? [
        plan.gaps.size ? new RegExp(`[\\p{L}\\p{N}\\p{M}][${escape(plan.gaps)}]+[\\p{L}\\p{N}\\p{M}]`, 'u') : undefined,
        plan.extra ? /([A-Za-z])\1/ : undefined,
        plan.mappings.size ? new RegExp(`[${escape(plan.mappings.keys())}]`, 'u') : undefined
    ].filter((pattern): pattern is RegExp => Boolean(pattern)) : undefined;
    // Edit distance to some key prefix, bounded by T, is necessary for any extension of a projection
    // to match. An OSA swap costs two Levenshtein edits. Astral keys keep exhaustive projection.
    const radius = plan && plan.prefilter !== false && !entries.some(entry => /[\ud800-\udfff]/.test(entry.key))
        ? (index.groups.length ? config.maxEdits * (config.model === 'osa' ? 2 : 1) : 0) : Infinity;
    const levels = radius <= 2 ? radius + 1 : 0;
    function widen(front: Int32Array, symbol: number | undefined, work: FuzzyMeter): Int32Array {
        const best = new Map<number, number>(), queue: number[] = []; let ops = 0;
        const put = (node: number, value: number) => {
            ops++; const old = best.get(node);
            if (value <= radius && (old === undefined || value < old)) { best.set(node, value); queue.push(node); }
        };
        for (const packed of front) {
            const node = Math.floor(packed / levels), value = packed % levels;
            if (symbol === undefined) { put(node, value); continue; }
            put(node, value + 1);
            for (const [code, child] of nodes[node].next) put(child, value + (code === symbol ? 0 : 1));
        }
        for (let i = 0; i < queue.length; i++) {
            const node = queue[i], value = best.get(node)!;
            if (value < radius) for (const child of nodes[node].next.values()) put(child, value + 1);
        }
        work.tick(ops);
        return Int32Array.from(best, ([node, value]) => node * levels + value);
    }
    const start = levels && enabled ? widen(Int32Array.of(0), undefined, { tick() {}, candidate() {}, cells() {} }) : undefined;
    function meter(): FuzzyMeter {
        let steps = 0, candidates = 0;
        return {
            tick(count = 1) { steps += count; bounded('steps', config.maxSteps, plan?.maxSteps, steps); },
            candidate() { if (++candidates > config.maxCandidates) fail('candidates', config.maxCandidates, candidates); },
            cells(used) { if (used > config.maxStateCells) fail('stateCells', config.maxStateCells, used); }
        };
    }
    function run(value: NormalizedText, wholeWords: boolean, selection: 'all' | 'spans' | 'unique' | 'censor',
        visit?: (match: Match) => boolean | void, accept?: (start: number, end: number) => boolean): CensorSpan[] {
        const work = meter(), clusters: Cluster[] = [], unique = selection === 'unique' ? new Uint8Array(entries.length) : undefined;
        let exact = 0, active: Projection[] = [], activeCells = 0, tokenStart = 0, transformable: boolean | undefined;
        const token: number[] = [], offsets: number[] = [];
        for (let from = 0; from < value.text.length;) {
            const code = value.text.codePointAt(from)!, to = from + (code > 0xffff ? 2 : 1), lexical = value.wordCharacters[from];
            const matches = new Map<number, Map<number, Match>>(); let stopped = false;
            const add = (entry: Entry, origin: number): void => {
                work.tick();
                if (unique?.[entry.order] || !acceptsStart(value, origin, wholeWords)) return;
                const start = value.starts[origin], end = value.ends[to - 1];
                if (accept && !accept(start, end)) return;
                let origins = matches.get(entry.order);
                if (!origins) matches.set(entry.order, origins = new Map());
                if (origins.has(start)) return;
                const match = { word: entry.word, order: entry.order, start, end, from: origin, to };
                origins.set(start, match);
                if (selection === 'all' || selection === 'unique') {
                    if (unique) unique[entry.order] = 1;
                    stopped = visit!(match) === false;
                }
            };
            // Exact Aho–Corasick and fuzzy candidates share one end-ordered sink.
            for (let at = from; at < to; at++) {
                const unit = value.text.charCodeAt(at); work.tick();
                while (exact && !nodes[exact].next.has(unit)) { work.tick(); exact = nodes[exact].fail; }
                exact = nodes[exact].next.get(unit) ?? 0;
            }
            const endOK = acceptsEnd(value, to, wholeWords);
            if (endOK) for (let state = exact; state >= 0; state = nodes[state].output)
                for (const entry of nodes[state].entries) { work.tick(); add(entry, to - entry.key.length); if (stopped) return []; }
            if (lexical) {
                if (!token.length) tokenStart = from;
                token.push(code); offsets.push(from);
                if (token.length > maximum) { token.shift(); offsets.shift(); }
                if (endOK) {
                    const first = wholeWords ? (offsets[0] === tokenStart ? 0 : token.length) : 0;
                    for (let at = first; at < token.length; at++) {
                        const origin = offsets[at];
                        if (!acceptsStart(value, origin, wholeWords)) continue;
                        work.tick();
                        index.query(at ? token.slice(at) : token, work, group => { for (const entry of group.entries) { add(entry, origin); if (stopped) return false; } });
                        if (stopped) return [];
                        if (wholeWords) break;
                    }
                }
            } else { token.length = 0; offsets.length = 0; }
            if (plan && evasionWords.size && (!gate || (transformable ??= gate.some(pattern => pattern.test(value.text))))) {
                const next = new Map<string, Projection>(), fronts = new Map<string, Int32Array>(); let cells = 0;
                const store = (state: Projection) => {
                    work.tick(state.text.length + 1);
                    if (state.length > maximum) return;
                    const key = `${state.cuts}|${state.origin}|${state.repeatRun}|${state.repeats}|${state.gap}|${state.gaps}|${state.maps}|${+state.ascii}|${state.text}`;
                    if (next.has(key)) return;
                    bounded('states', config.maxStates, plan.maxStates, next.size + 1);
                    cells += state.text.length + state.cuts.length + 9; work.cells(index.workspaceCells + activeCells + cells); next.set(key, state);
                };
                const advance = (state: Projection) => {
                    work.tick();
                    if (plan.gaps.has(code)) {
                        if (state.length && state.gap < plan.maxGap && state.gaps < plan.maxGaps)
                            store({ ...state, gap: state.gap + 1, gaps: state.gaps + 1,
                                cuts: state.cuts.endsWith(`,${state.length}`) ? state.cuts : `${state.cuts},${state.length}` });
                        return;
                    }
                    if (!lexical) return;
                    const consume = (symbol: number, mapped: boolean) => {
                        work.tick(); const maps = state.maps + Number(mapped), hasAscii = state.ascii || (!mapped && ascii(code));
                        const base = { ...state, gap: 0, maps, ascii: hasAscii }, text = state.text + String.fromCodePoint(symbol);
                        let front = state.front;
                        if (front) {
                            let known = fronts.get(text);
                            if (!known) { known = widen(front, symbol > 0xffff ? -1 : symbol, work); fronts.set(text, known); cells += known.length; }
                            front = known;
                        }
                        if (!front || front.length) store({ ...base, text, front, length: state.length + 1, last: symbol, repeatRun: 0 });
                        if (ascii(symbol) && symbol === state.last && state.repeatRun < plan.extra && state.repeats < plan.maxRepeats)
                            store({ ...base, repeats: state.repeats + 1, repeatRun: state.repeatRun + 1 });
                    };
                    consume(code, false);
                    const mapped = plan.mappings.get(code);
                    if (mapped !== undefined && state.maps < plan.maxConfusables) consume(mapped, true);
                };
                if (lexical && acceptsStart(value, from, wholeWords)) advance({ origin: from, text: '', length: 0, last: -1, repeatRun: 0, repeats: 0, gap: 0, gaps: 0, maps: 0, ascii: false, cuts: '', front: start });
                for (const state of active) advance(state);
                active = [...next.values()]; activeCells = cells;
                if (endOK) {
                    const queried = new Set<string>();
                    for (const state of active) {
                        if (state.gap || !(state.gaps || state.repeats || state.maps) || (state.maps && plan.requireAsciiLetter && !state.ascii)) continue;
                        const key = `${state.origin}|${state.cuts}|${state.text}`;
                        if (queried.has(key)) continue; queried.add(key);
                        for (const entry of evasionWords.get(state.text) ?? []) { add(entry, state.origin); if (stopped) return []; }
                        const units = Array.from(state.text, character => character.codePointAt(0)!);
                        // An insertion edit must not absorb a neighbouring word delimited by a separator.
                        const cuts = state.cuts ? state.cuts.slice(1).split(',').map(Number).filter(cut => cut < units.length) : [];
                        index.query(units, work, group => {
                            if (cuts.length && !anchored(group.units, units, cuts[0], cuts[cuts.length - 1], config, work)) return;
                            for (const entry of group.entries) { add(entry, state.origin); if (stopped) return false; }
                        }, true);
                        if (stopped) return [];
                    }
                }
            }
            if (matches.size) {
                let coverage = Infinity, longest: Match | undefined; const contributors = new Set<Entry>();
                for (const [order, origins] of matches) for (const match of origins.values()) {
                    if (selection === 'censor') { coverage = Math.min(coverage, match.start); contributors.add(entries[order]); }
                    else if (selection === 'spans') { if (!longest || match.start < longest.start) longest = match; }

                }
                if (contributors.size) contribute(clusters, coverage, value.ends[to - 1], contributors);
                if (longest && visit!(longest) === false) return [];
            }
            from = to;
        }
        return clusters.map(({ start, end, entries }) => ({ start, end, entries: [...entries] }));
    }
    return Object.freeze<EvasionRuntime>({
        checkInput(text: string) { bounded('input', config.maxInputLength, plan?.maxInputLength, text.length); },
        potential: () => enabled,
        scan: (value, wholeWords, visit, selection, accept) => { run(value, wholeWords, selection, visit, accept); },
        censor: (value, wholeWords, accept) => run(value, wholeWords, 'censor', undefined, accept)
    });
}
