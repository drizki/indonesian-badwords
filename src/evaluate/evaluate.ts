// Pure local computation: no I/O, no clock, no randomness, and no import of the root runtime or the catalog.

/** A source range, UTF-16 offsets with an exclusive end. */
export interface EvaluateSpan { readonly index: number; readonly end: number }
/** Anything with the `find()` shape of `Badwords`; `via` is optional for hand-written checkers. */
export interface EvaluateChecker {
    find(text: string, options?: { readonly ignoreRanges?: readonly EvaluateSpan[] }): readonly {
        readonly word: string;
        readonly index: number;
        readonly end: number;
        readonly match?: string;
        readonly via?: { readonly kind: string };
    }[];
}
/**
 * Expected outcome: should it be flagged, which words match, or the exact source spans.
 * Words are the `word` that `find()` reports: the dictionary key after the checker's normalization
 * (`goblok` for `GOBLOK` or fullwidth input), not the matched text. Label raw text with spans or a boolean.
 */
export type EvaluateExpectation = boolean | readonly string[] | readonly EvaluateSpan[];
export interface EvaluateCase {
    /** Unique within a run. Defaults to `case-N` (1-based position); give ids to compare runs. */
    readonly id?: string;
    readonly text: string;
    readonly expected: EvaluateExpectation;
    /** Passed to `find()` as `ignoreRanges`. */
    readonly ignoreRanges?: readonly EvaluateSpan[];
}
/** The shape of `classify` from `indonesian-badwords/metadata`, kept structural so this bundle stays independent. */
export type EvaluateClassifier = (input: readonly { readonly word: string }[]) => {
    readonly occurrences: readonly { readonly classified: boolean; readonly categories: readonly string[]; readonly severity: number | null }[];
};
export interface EvaluateOptions {
    /** Pass `classify` from `indonesian-badwords/metadata` to break detections down by category and severity. */
    readonly classify?: EvaluateClassifier;
    /** How many false-positive words to list. A non-negative integer or `Infinity`. Default 10. */
    readonly top?: number;
}

/** `count` of `n` with a 95% Wilson interval (z = 1.96). Everything but `count` and `n` is `null` when `n` is 0. */
export interface EvaluateRate { count: number; n: number; value: number | null; low: number | null; high: number | null }
export interface EvaluateConfusion { tp: number; fp: number; fn: number; tn: number }
/** Set-level counts over the cases whose expectation is words or spans. */
export interface EvaluateSetCounts { cases: number; tp: number; fp: number; fn: number; precision: EvaluateRate; recall: EvaluateRate }
export type EvaluateOutcome = 'tp' | 'fp' | 'fn' | 'tn';
/** Normalized expectation: words sorted, spans sorted by position. */
export type EvaluateExpected = boolean | string[] | EvaluateSpan[];
export interface EvaluateMatchCounts { truePositives: number; falsePositives: number }
export interface EvaluateMatch { word: string; index: number; end: number; match: string; via: string }
export interface EvaluateCaseSummary {
    id: string;
    expected: EvaluateExpected;
    /** Flagged-versus-expected-flagged. Wrong words or spans in a flagged case stay `tp` but `correct` is false. */
    outcome: EvaluateOutcome;
    /** Boolean: flag equals expectation. Words or spans: no false positive and no false negative. */
    correct: boolean;
    /** Unique reported dictionary words in source order, including every word reported on a shared span. */
    words: string[];
}
export interface EvaluateFailure extends EvaluateCaseSummary { text: string; matches: EvaluateMatch[] }
export interface EvaluateResult {
    schemaVersion: 1;
    total: number;
    correct: number;
    /** Case level: flagged versus expected flagged. */
    counts: EvaluateConfusion;
    /** TP / (TP + FP) over cases. */
    precision: EvaluateRate;
    /** TP / (TP + FN) over cases. */
    recall: EvaluateRate;
    /** FP / (FP + TN): the share of should-not-flag cases that were flagged. */
    falsePositiveRate: EvaluateRate;
    words: EvaluateSetCounts;
    spans: EvaluateSetCounts;
    /** Per `via.kind`, one count per detection (a cluster of overlapping matches), credited to its strongest kind. */
    byVia: Record<string, EvaluateMatchCounts>;
    /** Present only with `options.classify`; each detection is classified by its strongest-kind word. */
    byCategory: Record<string, EvaluateMatchCounts> | null;
    /** Keys `1`-`4`, `unrated` (classified without severity) and `unclassified`. Present only with `options.classify`. */
    bySeverity: Record<string, EvaluateMatchCounts> | null;
    /** Words reported on detections nothing expected, by number of cases (desc) then word (asc). */
    topFalsePositiveWords: { word: string; cases: number }[];
    /** Every case, in input order, without text. */
    cases: EvaluateCaseSummary[];
    /** The incorrect cases, in input order, with text and every reported match. */
    failures: EvaluateFailure[];
}

export interface EvaluateChange {
    id: string;
    before: { outcome: EvaluateOutcome; words: string[] };
    after: { outcome: EvaluateOutcome; words: string[] };
}
export interface EvaluateComparison {
    schemaVersion: 1;
    /** after minus before, over the ids present in both results only. */
    delta: EvaluateConfusion & { correct: number };
    /** Incorrect before, correct after. */
    fixed: EvaluateChange[];
    /** Correct before, incorrect after. */
    broken: EvaluateChange[];
    /** Incorrect in both, with a different outcome or a different set of reported words. */
    shifted: EvaluateChange[];
    /** Ids only in `after`. */
    added: string[];
    /** Ids only in `before`. */
    removed: string[];
}

// Strongest first. A detection is credited to the most literal way any of its words matched.
const KINDS = ['exact', 'normalized', 'leetspeak', 'evasion', 'fuzzy'];
const Z = 1.96;
const round = (value: number) => Math.round(value * 1e6) / 1e6;
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const isInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);
const isSpan = (value: unknown): value is EvaluateSpan =>
    value !== null && typeof value === 'object' && isInteger((value as EvaluateSpan).index) && isInteger((value as EvaluateSpan).end);
const sparse = (items: readonly unknown[]) => { for (let at = 0; at < items.length; at++) if (!(at in items)) return true; return false; };
const rank = (kind: string) => { const at = KINDS.indexOf(kind); return at < 0 ? KINDS.length : at; };

function rate(count: number, n: number): EvaluateRate {
    if (n === 0) return { count, n, value: null, low: null, high: null };
    const p = count / n;
    const denominator = 1 + (Z * Z) / n;
    const center = (p + (Z * Z) / (2 * n)) / denominator;
    const half = (Z * Math.sqrt((p * (1 - p)) / n + (Z * Z) / (4 * n * n))) / denominator;
    return { count, n, value: round(p), low: round(Math.max(0, center - half)), high: round(Math.min(1, center + half)) };
}

function splitsPair(text: string, offset: number) {
    const high = text.charCodeAt(offset - 1), low = text.charCodeAt(offset);
    return offset > 0 && offset < text.length && high >= 0xd800 && high <= 0xdbff && low >= 0xdc00 && low <= 0xdfff;
}

function validateRanges(label: string, value: unknown, text: string, spans: boolean): readonly EvaluateSpan[] {
    if (!Array.isArray(value)) throw new TypeError(`${label} must be an array of { index, end } ranges`);
    if (sparse(value)) throw new TypeError(`${label} must not be a sparse array`);
    const seen = new Set<string>();
    for (const range of value) {
        if (!isSpan(range)) throw new TypeError(`${label} entries must be { index, end } integers`);
        const { index, end } = range;
        // Empty ignore ranges are documented no-ops; expected spans must cover text.
        if (index < 0 || end > text.length || (spans ? end <= index : end < index)) {
            throw new TypeError(`${label} range ${index}-${end} is outside the ${text.length}-unit text (UTF-16 offsets, end exclusive)`);
        }
        if (spans) {
            if (splitsPair(text, index) || splitsPair(text, end)) throw new TypeError(`${label} range ${index}-${end} splits a surrogate pair; offsets are UTF-16 code units`);
            const key = `${index}:${end}`;
            if (seen.has(key)) throw new TypeError(`${label} lists span ${index}-${end} twice`);
            seen.add(key);
        }
    }
    return value;
}

interface Prepared { id: string; text: string; expected: EvaluateExpected; ignoreRanges?: readonly EvaluateSpan[] }
function prepare(cases: unknown): Prepared[] {
    if (!Array.isArray(cases)) throw new TypeError('cases must be an array');
    for (let at = 0; at < cases.length; at++) if (!(at in cases)) throw new TypeError(`case ${at} is missing (sparse array)`);
    const ids = new Set<string>();
    return cases.map((entry: unknown, position): Prepared => {
        if (entry === null || typeof entry !== 'object') throw new TypeError(`case ${position} must be an object`);
        const { id = `case-${position + 1}`, text, expected, ignoreRanges } = entry as EvaluateCase;
        if (typeof id !== 'string' || id === '') throw new TypeError(`case ${position}: id must be a non-empty string`);
        if (ids.has(id)) throw new TypeError(`duplicate case id ${JSON.stringify(id)}`);
        ids.add(id);
        const label = `case ${JSON.stringify(id)}`;
        if (typeof text !== 'string') throw new TypeError(`${label}: text must be a string`);
        let normalized: EvaluateExpected;
        if (typeof expected === 'boolean') normalized = expected;
        else if (Array.isArray(expected) && sparse(expected)) throw new TypeError(`${label}: expected must not be a sparse array`);
        else if (Array.isArray(expected) && expected.every((item) => typeof item === 'string')) {
            if (expected.some((word) => word === '')) throw new TypeError(`${label}: expected words must be non-empty`);
            if (new Set(expected).size !== expected.length) throw new TypeError(`${label}: expected words are compared as a set; list each word once`);
            normalized = [...expected as string[]].sort(byText);
        } else if (Array.isArray(expected)) {
            if (!expected.every(isSpan)) throw new TypeError(`${label}: expected must be a boolean, an array of words, or an array of { index, end } spans`);
            normalized = [...validateRanges(`${label}: expected`, expected, text, true)].map(({ index, end }) => ({ index, end }))
                .sort((a, b) => a.index - b.index || a.end - b.end);
        } else throw new TypeError(`${label}: expected must be a boolean, an array of words, or an array of { index, end } spans`);
        const prepared: Prepared = { id, text, expected: normalized };
        if (ignoreRanges !== undefined) prepared.ignoreRanges = validateRanges(`${label}: ignoreRanges`, ignoreRanges, text, false);
        return prepared;
    });
}

const spanKey = (index: number, end: number) => `${index}:${end}`;
/** Matches on identical or overlapping spans: one detection of the text, however many words reach it. */
interface Cluster { matches: EvaluateMatch[]; words: string[]; spans: string[]; via: string; representative: EvaluateMatch }
function cluster(matches: EvaluateMatch[]): Cluster[] {
    const ordered = [...matches].sort((a, b) => a.index - b.index || a.end - b.end);
    const groups: EvaluateMatch[][] = [];
    let reach = -1;
    for (const match of ordered) {
        if (groups.length && match.index < reach) { groups[groups.length - 1]!.push(match); reach = Math.max(reach, match.end); }
        else { groups.push([match]); reach = match.end; }
    }
    return groups.map((group) => {
        let representative = group[0]!;
        for (const match of group) if (rank(match.via) < rank(representative.via)) representative = match;
        return {
            matches: group,
            words: [...new Set(group.map(({ word }) => word))],
            spans: [...new Set(group.map(({ index, end }) => spanKey(index, end)))],
            via: representative.via,
            representative
        };
    });
}

type Tally = Map<string, EvaluateMatchCounts>;
const bump = (table: Tally, key: string, positive: boolean) => {
    let row = table.get(key);
    if (!row) table.set(key, row = { truePositives: 0, falsePositives: 0 });
    if (positive) row.truePositives++; else row.falsePositives++;
};
// Built from entries, so keys such as __proto__ stay ordinary own properties.
const toTable = (table: Tally) => Object.fromEntries([...table].sort(([a], [b]) => byText(a, b)));

/** Expected keys against what the checker reported: hits, misses, and the keys on detections nothing expected. */
function score(wanted: ReadonlySet<string>, clusters: Cluster[], keysOf: (cluster: Cluster) => string[]) {
    const found = new Set<string>(), extra = new Set<string>();
    for (const detection of clusters) {
        const keys = keysOf(detection);
        for (const key of keys) found.add(key);
        if (!keys.some((key) => wanted.has(key))) for (const key of keys) extra.add(key);
    }
    let tp = 0;
    for (const key of wanted) if (found.has(key)) tp++;
    return { tp, fp: extra.size, fn: wanted.size - tp };
}

/**
 * Score a checker against labelled cases. Deterministic, JSON-serializable, local-only.
 *
 * Matches on identical or overlapping spans form one detection. A detection is a true positive when
 * its case expects a flag, or any of its words (words mode) or spans (spans mode) is expected; it is
 * credited once to `byVia`, under its strongest kind (exact, normalized, leetspeak, evasion, fuzzy).
 * Words of detections nothing expected are the false-positive words, each counted once per case.
 *
 * Throws `TypeError` for malformed cases up front, before `checker.find` runs. Errors thrown by
 * `find` itself during the run, such as a `RangeError` for a bad `ignoreRanges`, propagate unchanged.
 */
export function evaluate(checker: EvaluateChecker, cases: readonly EvaluateCase[], options: EvaluateOptions = {}): EvaluateResult {
    if (checker == null || typeof checker.find !== 'function') {
        throw new TypeError('checker must have a find(text, options) method');
    }
    if (options === null || typeof options !== 'object') throw new TypeError('options must be an object');
    const { classify, top = 10 } = options;
    if (classify !== undefined && typeof classify !== 'function') throw new TypeError('options.classify must be a function');
    if (top !== Infinity && (!isInteger(top) || top < 0)) throw new TypeError('options.top must be a non-negative integer or Infinity');
    const prepared = prepare(cases);

    const counts: EvaluateConfusion = { tp: 0, fp: 0, fn: 0, tn: 0 };
    const wordSet = { cases: 0, tp: 0, fp: 0, fn: 0 };
    const spanSet = { cases: 0, tp: 0, fp: 0, fn: 0 };
    const byVia: Tally = new Map(KINDS.map((kind) => [kind, { truePositives: 0, falsePositives: 0 }]));
    const byCategory: Tally = new Map();
    const bySeverity: Tally = new Map();
    const falseWords = new Map<string, number>();
    const summaries: EvaluateCaseSummary[] = [];
    const failures: EvaluateFailure[] = [];
    let correctCount = 0;

    for (const { id, text, expected, ignoreRanges } of prepared) {
        const label = `case ${JSON.stringify(id)}`;
        const found = checker.find(text, ignoreRanges ? { ignoreRanges } : undefined);
        if (!Array.isArray(found)) throw new TypeError(`${label}: checker.find must return an array`);
        const matches: EvaluateMatch[] = found.map((location) => {
            if (location === null || typeof location !== 'object' || typeof location.word !== 'string' || !isInteger(location.index) || !isInteger(location.end)) {
                throw new TypeError(`${label}: checker.find must return { word, index, end } locations`);
            }
            if (location.index < 0 || location.end < location.index || location.end > text.length) {
                throw new TypeError(`${label}: checker.find returned location ${location.index}-${location.end} outside the ${text.length}-unit text`);
            }
            return {
                word: location.word, index: location.index, end: location.end,
                match: typeof location.match === 'string' ? location.match : text.slice(location.index, location.end),
                via: typeof location.via?.kind === 'string' ? location.via.kind : 'unknown'
            };
        });
        const words = [...new Set(matches.map(({ word }) => word))];
        const clusters = cluster(matches);
        const flagged = matches.length > 0;
        const expectedFlag = typeof expected === 'boolean' ? expected : expected.length > 0;
        const outcome: EvaluateOutcome = flagged ? (expectedFlag ? 'tp' : 'fp') : (expectedFlag ? 'fn' : 'tn');
        counts[outcome]++;

        let verdict: (detection: Cluster) => boolean;
        let correct: boolean;
        if (typeof expected === 'boolean') {
            verdict = () => expected;
            correct = flagged === expected;
        } else {
            // An empty array expects nothing to match and counts at both levels; any detection is then a false positive.
            const asWords = expected.length === 0 || typeof expected[0] === 'string';
            const asSpans = expected.length === 0 || typeof expected[0] !== 'string';
            const wantedWords = new Set(asWords ? expected as string[] : []);
            const wantedSpans = new Set(asSpans ? (expected as EvaluateSpan[]).map(({ index, end }) => spanKey(index, end)) : []);
            correct = true;
            if (asWords) {
                const result = score(wantedWords, clusters, (detection) => detection.words);
                wordSet.cases++; wordSet.tp += result.tp; wordSet.fp += result.fp; wordSet.fn += result.fn;
                correct &&= result.fp === 0 && result.fn === 0;
            }
            if (asSpans) {
                const result = score(wantedSpans, clusters, (detection) => detection.spans);
                spanSet.cases++; spanSet.tp += result.tp; spanSet.fp += result.fp; spanSet.fn += result.fn;
                correct &&= result.fp === 0 && result.fn === 0;
            }
            verdict = asWords ? (detection) => detection.words.some((word) => wantedWords.has(word))
                : (detection) => detection.spans.some((key) => wantedSpans.has(key));
        }
        if (correct) correctCount++;

        const extra = new Set<string>();
        for (const detection of clusters) {
            const positive = verdict(detection);
            bump(byVia, detection.via, positive);
            if (!positive) for (const word of detection.words) extra.add(word);
            if (classify) {
                const [classified] = classify([{ word: detection.representative.word }]).occurrences;
                if (!classified) throw new TypeError('options.classify must return one occurrence per input location');
                for (const category of classified.categories) bump(byCategory, category, positive);
                bump(bySeverity, !classified.classified ? 'unclassified' : classified.severity === null ? 'unrated' : String(classified.severity), positive);
            }
        }
        for (const word of extra) falseWords.set(word, (falseWords.get(word) ?? 0) + 1);

        const summary: EvaluateCaseSummary = { id, expected, outcome, correct, words };
        summaries.push(summary);
        if (!correct) failures.push({ ...summary, text, matches });
    }

    // Boolean cases carry no word list, so the word and span levels cover only the cases that do.
    const setCounts = ({ cases: n, tp, fp, fn }: typeof wordSet): EvaluateSetCounts =>
        ({ cases: n, tp, fp, fn, precision: rate(tp, tp + fp), recall: rate(tp, tp + fn) });
    return {
        schemaVersion: 1,
        total: prepared.length,
        correct: correctCount,
        counts,
        precision: rate(counts.tp, counts.tp + counts.fp),
        recall: rate(counts.tp, counts.tp + counts.fn),
        falsePositiveRate: rate(counts.fp, counts.fp + counts.tn),
        words: setCounts(wordSet),
        spans: setCounts(spanSet),
        byVia: toTable(byVia),
        byCategory: classify ? toTable(byCategory) : null,
        bySeverity: classify ? toTable(bySeverity) : null,
        topFalsePositiveWords: [...falseWords].map(([word, n]) => ({ word, cases: n }))
            .sort((a, b) => b.cases - a.cases || byText(a.word, b.word)).slice(0, top),
        cases: summaries,
        failures
    };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const sorted = (words: readonly string[]) => [...words].sort(byText);
function table(result: EvaluateResult, label: string) {
    if (result === null || typeof result !== 'object' || result.schemaVersion !== 1 || !Array.isArray(result.cases)
        || result.counts === null || typeof result.counts !== 'object') {
        throw new TypeError(`${label} must be an evaluate() result`);
    }
    const entries = new Map<string, EvaluateCaseSummary>();
    for (const entry of result.cases) {
        if (entry === null || typeof entry !== 'object' || typeof entry.id !== 'string' || !Array.isArray(entry.words)) {
            throw new TypeError(`${label} has a malformed case entry`);
        }
        if (entries.has(entry.id)) throw new TypeError(`${label} lists case id ${JSON.stringify(entry.id)} twice`);
        entries.set(entry.id, entry);
    }
    return entries;
}

/**
 * List the cases whose outcome changed between two `evaluate()` results.
 * Cases are identified by id only, so text edited under the same id shows up as a change.
 * Lists are sorted by id, so the output does not depend on case order, and `delta` covers only ids present in both.
 * Throws `TypeError` for malformed results or when a shared id carries a different expectation.
 */
export function compare(before: EvaluateResult, after: EvaluateResult): EvaluateComparison {
    const was = table(before, 'before'), now = table(after, 'after');
    const fixed: EvaluateChange[] = [], broken: EvaluateChange[] = [], shifted: EvaluateChange[] = [];
    const delta = { tp: 0, fp: 0, fn: 0, tn: 0, correct: 0 };
    for (const [id, next] of now) {
        const prior = was.get(id);
        if (!prior) continue;
        if (!same(prior.expected, next.expected)) throw new TypeError(`case ${JSON.stringify(id)} has a different expectation in each result`);
        delta[next.outcome]++; delta[prior.outcome]--;
        delta.correct += Number(next.correct) - Number(prior.correct);
        const change: EvaluateChange = {
            id,
            before: { outcome: prior.outcome, words: [...prior.words] },
            after: { outcome: next.outcome, words: [...next.words] }
        };
        if (!prior.correct && next.correct) fixed.push(change);
        else if (prior.correct && !next.correct) broken.push(change);
        else if (!prior.correct && !next.correct && (prior.outcome !== next.outcome || !same(sorted(prior.words), sorted(next.words)))) shifted.push(change);
    }
    const byId = (a: { id: string }, b: { id: string }) => byText(a.id, b.id);
    return {
        schemaVersion: 1,
        delta,
        fixed: fixed.sort(byId),
        broken: broken.sort(byId),
        shifted: shifted.sort(byId),
        added: [...now.keys()].filter((id) => !was.has(id)).sort(byText),
        removed: [...was.keys()].filter((id) => !now.has(id)).sort(byText)
    };
}
