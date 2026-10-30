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
/** Expected outcome: should it be flagged, which dictionary words match, or the exact source spans. */
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
    /** Pass `classify` from `indonesian-badwords/metadata` to break matches down by category and severity. */
    readonly classify?: EvaluateClassifier;
    /** How many false-positive words to list. Default 10. */
    readonly top?: number;
}

/** `count` of `n` with a 95% Wilson interval. Everything but `n` is `null` when `n` is 0. */
export interface EvaluateRate { count: number; n: number; value: number | null; low: number | null; high: number | null }
export interface EvaluateConfusion { tp: number; fp: number; fn: number; tn: number }
/** Set-level counts over the cases whose expectation is words (or spans). */
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
    /** Boolean: flag equals expectation. Words or spans: the exact set matches. */
    correct: boolean;
    /** Unique matched dictionary words in source order. */
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
    /** Per `via.kind`: matches in should-flag cases or on expected words/spans are true positives, the rest false positives. */
    byVia: Record<string, EvaluateMatchCounts>;
    /** Present only with `options.classify`. An occurrence counts once in each of its categories. */
    byCategory: Record<string, EvaluateMatchCounts> | null;
    /** Keys `1`-`4`, `unrated` (classified without severity) and `unclassified`. Present only with `options.classify`. */
    bySeverity: Record<string, EvaluateMatchCounts> | null;
    /** Words that caused false positives, by number of cases (desc) then word (asc). */
    topFalsePositiveWords: { word: string; cases: number }[];
    /** Every case, in input order, without text. */
    cases: EvaluateCaseSummary[];
    /** The incorrect cases, in input order, with text and matches. */
    failures: EvaluateFailure[];
}

export interface EvaluateChange {
    id: string;
    before: { outcome: EvaluateOutcome; words: string[] };
    after: { outcome: EvaluateOutcome; words: string[] };
}
export interface EvaluateComparison {
    schemaVersion: 1;
    /** after minus before. */
    delta: EvaluateConfusion & { correct: number };
    /** Incorrect before, correct after. */
    fixed: EvaluateChange[];
    /** Correct before, incorrect after. */
    broken: EvaluateChange[];
    /** Incorrect in both, with a different outcome or different matched words. */
    shifted: EvaluateChange[];
    /** Ids only in `after`. */
    added: string[];
    /** Ids only in `before`. */
    removed: string[];
}

const KINDS = ['exact', 'normalized', 'leetspeak', 'evasion', 'fuzzy'];
const Z = 1.96;
const round = (value: number) => Math.round(value * 1e6) / 1e6;
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const isInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);
const isSpan = (value: unknown): value is EvaluateSpan =>
    value !== null && typeof value === 'object' && isInteger((value as EvaluateSpan).index) && isInteger((value as EvaluateSpan).end);

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
const bump = (table: Record<string, EvaluateMatchCounts>, key: string, positive: boolean) => {
    const row = table[key] ??= { truePositives: 0, falsePositives: 0 };
    if (positive) row.truePositives++; else row.falsePositives++;
};
const sortKeys = <T>(table: Record<string, T>) => Object.fromEntries(Object.entries(table).sort(([a], [b]) => byText(a, b)));

/**
 * Score a checker against labelled cases. Deterministic, JSON-serializable, local-only.
 * Throws `TypeError` for malformed cases up front; errors thrown by `checker.find` propagate unchanged.
 */
export function evaluate(checker: EvaluateChecker, cases: readonly EvaluateCase[], options: EvaluateOptions = {}): EvaluateResult {
    if (checker == null || typeof checker.find !== 'function') {
        throw new TypeError('checker must have a find(text, options) method');
    }
    if (options === null || typeof options !== 'object') throw new TypeError('options must be an object');
    const { classify, top = 10 } = options;
    if (classify !== undefined && typeof classify !== 'function') throw new TypeError('options.classify must be a function');
    if (!isInteger(top) || top < 0) throw new TypeError('options.top must be a non-negative integer');
    const prepared = prepare(cases);

    const counts: EvaluateConfusion = { tp: 0, fp: 0, fn: 0, tn: 0 };
    const wordSet = { cases: 0, tp: 0, fp: 0, fn: 0 };
    const spanSet = { cases: 0, tp: 0, fp: 0, fn: 0 };
    const byVia: Record<string, EvaluateMatchCounts> = Object.fromEntries(KINDS.map((kind) => [kind, { truePositives: 0, falsePositives: 0 }]));
    const byCategory: Record<string, EvaluateMatchCounts> = {};
    const bySeverity: Record<string, EvaluateMatchCounts> = {};
    const falseWords = new Map<string, number>();
    const summaries: EvaluateCaseSummary[] = [];
    const failures: EvaluateFailure[] = [];
    let correctCount = 0;

    for (const { id, text, expected, ignoreRanges } of prepared) {
        const found = checker.find(text, ignoreRanges ? { ignoreRanges } : undefined);
        if (!Array.isArray(found)) throw new TypeError(`case ${JSON.stringify(id)}: checker.find must return an array`);
        const matches: EvaluateMatch[] = found.map((location) => {
            if (location === null || typeof location !== 'object' || typeof location.word !== 'string' || !isInteger(location.index) || !isInteger(location.end)) {
                throw new TypeError(`case ${JSON.stringify(id)}: checker.find must return { word, index, end } locations`);
            }
            return {
                word: location.word, index: location.index, end: location.end,
                match: typeof location.match === 'string' ? location.match : text.slice(location.index, location.end),
                via: typeof location.via?.kind === 'string' ? location.via.kind : 'unknown'
            };
        });
        const words = [...new Set(matches.map(({ word }) => word))];
        const flagged = matches.length > 0;
        const expectedFlag = typeof expected === 'boolean' ? expected : expected.length > 0;
        const outcome: EvaluateOutcome = flagged ? (expectedFlag ? 'tp' : 'fp') : (expectedFlag ? 'fn' : 'tn');
        counts[outcome]++;

        // A match is a true positive when the case expects a flag (boolean) or lists its word or span.
        let verdict: (match: EvaluateMatch) => boolean;
        let correct: boolean;
        if (typeof expected === 'boolean') {
            verdict = () => expected;
            correct = flagged === expected;
        } else if (expected.length === 0 || typeof expected[0] === 'string') {
            const wanted = new Set(expected as string[]);
            const hit = words.filter((word) => wanted.has(word)).length;
            // An empty array has no kind; it contributes to the word level too (extra words are false positives).
            wordSet.cases++;
            wordSet.tp += hit; wordSet.fp += words.length - hit; wordSet.fn += wanted.size - hit;
            correct = words.length === wanted.size && hit === wanted.size;
            verdict = ({ word }) => wanted.has(word);
        } else {
            const wanted = new Set((expected as EvaluateSpan[]).map(({ index, end }) => spanKey(index, end)));
            const actual = new Set(matches.map(({ index, end }) => spanKey(index, end)));
            let hit = 0;
            for (const key of actual) if (wanted.has(key)) hit++;
            spanSet.cases++;
            spanSet.tp += hit; spanSet.fp += actual.size - hit; spanSet.fn += wanted.size - hit;
            correct = actual.size === wanted.size && hit === wanted.size;
            verdict = ({ index, end }) => wanted.has(spanKey(index, end));
        }
        if (correct) correctCount++;

        const wrong = new Set<string>();
        for (const match of matches) {
            const positive = verdict(match);
            bump(byVia, match.via, positive);
            if (!positive) wrong.add(match.word);
            if (classify) {
                const [classified] = classify([{ word: match.word }]).occurrences;
                if (!classified) throw new TypeError('options.classify must return one occurrence per input location');
                for (const category of classified.categories) bump(byCategory, category, positive);
                bump(bySeverity, !classified.classified ? 'unclassified' : classified.severity === null ? 'unrated' : String(classified.severity), positive);
            }
        }
        for (const word of wrong) falseWords.set(word, (falseWords.get(word) ?? 0) + 1);

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
        byVia: sortKeys(byVia),
        byCategory: classify ? sortKeys(byCategory) : null,
        bySeverity: classify ? sortKeys(bySeverity) : null,
        topFalsePositiveWords: [...falseWords].map(([word, n]) => ({ word, cases: n }))
            .sort((a, b) => b.cases - a.cases || byText(a.word, b.word)).slice(0, top),
        cases: summaries,
        failures
    };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function table(result: EvaluateResult, label: string) {
    if (result === null || typeof result !== 'object' || result.schemaVersion !== 1 || !Array.isArray(result.cases)) {
        throw new TypeError(`${label} must be an evaluate() result`);
    }
    return new Map(result.cases.map((entry) => [entry.id, entry]));
}

/**
 * List the cases whose outcome changed between two `evaluate()` results over the same labelled cases.
 * Lists are sorted by id, so the output does not depend on case order. Throws `TypeError` when a shared id carries a different expectation.
 */
export function compare(before: EvaluateResult, after: EvaluateResult): EvaluateComparison {
    const was = table(before, 'before'), now = table(after, 'after');
    const fixed: EvaluateChange[] = [], broken: EvaluateChange[] = [], shifted: EvaluateChange[] = [];
    for (const [id, next] of now) {
        const prior = was.get(id);
        if (!prior) continue;
        if (!same(prior.expected, next.expected)) throw new TypeError(`case ${JSON.stringify(id)} has a different expectation in each result`);
        const change: EvaluateChange = {
            id,
            before: { outcome: prior.outcome, words: [...prior.words] },
            after: { outcome: next.outcome, words: [...next.words] }
        };
        if (!prior.correct && next.correct) fixed.push(change);
        else if (prior.correct && !next.correct) broken.push(change);
        else if (!prior.correct && !next.correct && (prior.outcome !== next.outcome || !same(prior.words, next.words))) shifted.push(change);
    }
    const byId = (a: { id: string }, b: { id: string }) => byText(a.id, b.id);
    const delta = (key: keyof EvaluateConfusion) => after.counts[key] - before.counts[key];
    return {
        schemaVersion: 1,
        delta: { tp: delta('tp'), fp: delta('fp'), fn: delta('fn'), tn: delta('tn'), correct: after.correct - before.correct },
        fixed: fixed.sort(byId),
        broken: broken.sort(byId),
        shifted: shifted.sort(byId),
        added: [...now.keys()].filter((id) => !was.has(id)).sort(byText),
        removed: [...was.keys()].filter((id) => !now.has(id)).sort(byText)
    };
}
