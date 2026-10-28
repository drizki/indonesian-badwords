import { acceptsEnd, acceptsStart, type CensorSpan, type Entry, type Match, type MatcherNode } from './matcher.ts';
import type { EvasionCompiler, EvasionRuntime, TrieLimit } from './evasion-types.ts';
import type { Normalization, NormalizedText } from './normalize.ts';
import type { FuzzyConfig } from './fuzzy-types.ts';
import type { FuzzyLimit } from './fuzzy.ts';
import { FuzzyIndex, type FuzzyMeter } from './fuzzy-index.ts';

type Fail = (limit: FuzzyLimit, maximum: number, used: number) => never;
const ascii = (code: number) => (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
interface Projection {
    origin: number; text: string; length: number; last: number; repeatRun: number; repeats: number;
    gap: number; gaps: number; maps: number; ascii: boolean;
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
        let exact = 0, active: Projection[] = [], activeCells = 0, tokenStart = 0;
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
            if (plan && evasionWords.size) {
                const next = new Map<string, Projection>(); let cells = 0;
                const store = (state: Projection) => {
                    work.tick(state.text.length + 1);
                    if (state.length > maximum) return;
                    const key = `${state.origin}|${state.repeatRun}|${state.repeats}|${state.gap}|${state.gaps}|${state.maps}|${+state.ascii}|${state.text}`;
                    if (next.has(key)) return;
                    bounded('states', config.maxStates, plan.maxStates, next.size + 1);
                    cells += state.text.length + 9; work.cells(index.workspaceCells + activeCells + cells); next.set(key, state);
                };
                const advance = (state: Projection) => {
                    work.tick();
                    if (plan.gaps.has(code)) {
                        if (state.length && state.gap < plan.maxGap && state.gaps < plan.maxGaps)
                            store({ ...state, gap: state.gap + 1, gaps: state.gaps + 1 });
                        return;
                    }
                    if (!lexical) return;
                    const consume = (symbol: number, mapped: boolean) => {
                        work.tick(); const maps = state.maps + Number(mapped), hasAscii = state.ascii || (!mapped && ascii(code));
                        const base = { ...state, gap: 0, maps, ascii: hasAscii };
                        store({ ...base, text: state.text + String.fromCodePoint(symbol), length: state.length + 1, last: symbol, repeatRun: 0 });
                        if (ascii(symbol) && symbol === state.last && state.repeatRun < plan.extra && state.repeats < plan.maxRepeats)
                            store({ ...base, repeats: state.repeats + 1, repeatRun: state.repeatRun + 1 });
                    };
                    consume(code, false);
                    const mapped = plan.mappings.get(code);
                    if (mapped !== undefined && state.maps < plan.maxConfusables) consume(mapped, true);
                };
                if (lexical && acceptsStart(value, from, wholeWords)) advance({ origin: from, text: '', length: 0, last: -1, repeatRun: 0, repeats: 0, gap: 0, gaps: 0, maps: 0, ascii: false });
                for (const state of active) advance(state);
                active = [...next.values()]; activeCells = cells;
                if (endOK) {
                    const queried = new Set<string>();
                    for (const state of active) {
                        if (state.gap || !(state.gaps || state.repeats || state.maps) || (state.maps && plan.requireAsciiLetter && !state.ascii)) continue;
                        const key = `${state.origin}|${state.text}`;
                        if (queried.has(key)) continue; queried.add(key);
                        for (const entry of evasionWords.get(state.text) ?? []) { add(entry, state.origin); if (stopped) return []; }
                        const units = Array.from(state.text, character => character.codePointAt(0)!);
                        index.query(units, work, group => { for (const entry of group.entries) { add(entry, state.origin); if (stopped) return false; } }, true);
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
