import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { Badwords } from '../dist/esm/index.js';
import { boundedEvasion } from '../dist/esm/evasion.js';
import { boundedFuzzy } from '../dist/esm/fuzzy.js';
import { classify } from '../dist/esm/metadata.js';
import { evaluate, compare } from '../dist/esm/evaluate.js';

const plain = new Badwords({ dictionary: ['goblok', 'tolol'] });
// A scripted checker makes every confusion-matrix cell exact and independent of the dictionary.
const scripted = (table) => ({
    find: (text) => (table[text] ?? []).map(([word, index, end, kind]) => ({ word, index, end, match: text.slice(index, end), via: { kind } }))
});

describe('evaluate: counts and rates', () => {
    const checker = scripted({
        tp1: [['a', 0, 3, 'exact']],
        tp2: [['a', 0, 3, 'exact']],
        tp3: [['a', 0, 3, 'exact']],
        fp1: [['b', 0, 3, 'fuzzy']],
        fn1: [],
        fn2: [],
        tn1: [], tn2: [], tn3: [], tn4: []
    });
    const cases = [
        ...['tp1', 'tp2', 'tp3'].map((text) => ({ text, expected: true })),
        { text: 'fp1', expected: false },
        { text: 'fn1', expected: true }, { text: 'fn2', expected: true },
        ...['tn1', 'tn2', 'tn3', 'tn4'].map((text) => ({ text, expected: false }))
    ];

    test('distinguishes TP, FP, FN and TN with distinct counts', () => {
        const result = evaluate(checker, cases);
        assert.deepEqual(result.counts, { tp: 3, fp: 1, fn: 2, tn: 4 });
        assert.equal(result.total, 10);
        assert.equal(result.correct, 7);
    });

    test('uses the right denominators', () => {
        const { precision, recall, falsePositiveRate } = evaluate(checker, cases);
        assert.deepEqual([precision.count, precision.n, precision.value], [3, 4, 0.75]);
        assert.deepEqual([recall.count, recall.n, recall.value], [3, 5, 0.6]);
        assert.deepEqual([falsePositiveRate.count, falsePositiveRate.n, falsePositiveRate.value], [1, 5, 0.2]);
    });

    test('reports a Wilson interval that contains the estimate and stays within [0, 1]', () => {
        const { precision } = evaluate(checker, cases);
        assert.ok(precision.low < precision.value && precision.value < precision.high);
        assert.equal(precision.low, 0.300636);
        assert.equal(precision.high, 0.954414);
        const perfect = evaluate(scripted({ x: [['a', 0, 1, 'exact']] }), [{ text: 'x', expected: true }]);
        assert.equal(perfect.precision.high, 1);
        assert.ok(perfect.precision.low < 1 && perfect.precision.low > 0);
    });

    test('empty cases give null rates, never NaN', () => {
        const result = evaluate(plain, []);
        assert.equal(result.total, 0);
        assert.deepEqual(result.counts, { tp: 0, fp: 0, fn: 0, tn: 0 });
        for (const rate of [result.precision, result.recall, result.falsePositiveRate]) {
            assert.deepEqual(rate, { count: 0, n: 0, value: null, low: null, high: null });
        }
        assert.deepEqual(result.failures, []);
        assert.deepEqual(result.topFalsePositiveWords, []);
        assert.ok(!JSON.stringify(result).includes('NaN'));
    });

    test('all-clean input: precision and recall are undefined, FP rate is 0 of n', () => {
        const result = evaluate(plain, [{ text: 'terima kasih', expected: false }, { text: 'selamat pagi', expected: false }]);
        assert.deepEqual(result.counts, { tp: 0, fp: 0, fn: 0, tn: 2 });
        assert.equal(result.precision.value, null);
        assert.equal(result.recall.value, null);
        assert.equal(result.falsePositiveRate.value, 0);
        assert.equal(result.falsePositiveRate.n, 2);
        assert.equal(result.falsePositiveRate.low, 0);
    });

    test('all-flagged input: FP rate is undefined, recall is 1', () => {
        const result = evaluate(plain, [{ text: 'dasar goblok', expected: true }, { text: 'tolol', expected: true }]);
        assert.deepEqual(result.counts, { tp: 2, fp: 0, fn: 0, tn: 0 });
        assert.equal(result.falsePositiveRate.value, null);
        assert.equal(result.falsePositiveRate.n, 0);
        assert.equal(result.recall.value, 1);
        assert.equal(result.precision.value, 1);
    });

    test('is deterministic and JSON round-trips', () => {
        const first = evaluate(checker, cases);
        const second = evaluate(checker, [...cases]);
        assert.equal(JSON.stringify(first), JSON.stringify(second));
        assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
    });
});

describe('evaluate: expectations', () => {
    test('word expectations count words, compare as sets, and ignore expectation order', () => {
        const result = evaluate(plain, [
            { id: 'a', text: 'goblok dan tolol', expected: ['tolol', 'goblok'] },
            { id: 'b', text: 'goblok goblok', expected: ['goblok'] },
            { id: 'c', text: 'tolol', expected: ['goblok'] },
            { id: 'd', text: 'goblok', expected: [] }
        ]);
        assert.deepEqual(result.cases.map(({ id, correct }) => [id, correct]), [['a', true], ['b', true], ['c', false], ['d', false]]);
        assert.deepEqual([result.words.cases, result.words.tp, result.words.fp, result.words.fn], [4, 3, 2, 1]);
        assert.equal(result.words.precision.value, 0.6);
        assert.equal(result.words.recall.value, 0.75);
        // The empty expectation of case d also counts at the span level: one case, one false positive.
        assert.deepEqual([result.spans.cases, result.spans.tp, result.spans.fp, result.spans.fn], [1, 0, 1, 0]);
        assert.equal(result.spans.precision.value, 0);
        assert.equal(result.spans.recall.value, null);
        // c is flagged and expected flagged: a case-level TP with wrong words, so correct is false.
        assert.equal(result.cases[2].outcome, 'tp');
        assert.deepEqual(result.cases[0].expected, ['goblok', 'tolol']);
        assert.equal(result.cases[3].outcome, 'fp');
    });

    test('span expectations are exact source spans', () => {
        const result = evaluate(plain, [
            { id: 'exact', text: 'dasar goblok', expected: [{ index: 6, end: 12 }] },
            { id: 'shifted', text: 'dasar goblok', expected: [{ index: 5, end: 12 }] },
            { id: 'missed', text: 'dasar baik', expected: [{ index: 6, end: 10 }] }
        ]);
        assert.deepEqual(result.cases.map(({ correct }) => correct), [true, false, false]);
        assert.deepEqual([result.spans.tp, result.spans.fp, result.spans.fn], [1, 1, 2]);
        assert.equal(result.cases[2].outcome, 'fn');
        assert.deepEqual(result.failures.map(({ id }) => id), ['shifted', 'missed']);
        assert.deepEqual(result.failures[0].matches, [{ word: 'goblok', index: 6, end: 12, match: 'goblok', via: 'exact' }]);
    });

    test('overlapping matches form one detection, judged by any expected span', () => {
        const overlapping = new Badwords({ dictionary: ['goblok', 'blok'], mode: 'substring' });
        const text = 'goblok';
        const spans = overlapping.find(text).map(({ index, end }) => ({ index, end }));
        assert.equal(spans.length, 2);
        const result = evaluate(overlapping, [
            { id: 'both', text, expected: spans },
            { id: 'one', text, expected: [{ index: 0, end: 6 }] }
        ]);
        // The cluster 0-6 / 2-6 is one detection: expecting either span (or both) is correct.
        assert.deepEqual(result.cases.map(({ correct }) => correct), [true, true]);
        assert.deepEqual([result.spans.tp, result.spans.fp, result.spans.fn], [3, 0, 0]);
        assert.deepEqual(result.topFalsePositiveWords, []);
        const unmatched = evaluate(overlapping, [{ id: 'elsewhere', text, expected: [{ index: 0, end: 2 }] }]);
        assert.deepEqual([unmatched.spans.tp, unmatched.spans.fp, unmatched.spans.fn], [0, 2, 1]);
        assert.deepEqual(unmatched.topFalsePositiveWords, [{ word: 'blok', cases: 1 }, { word: 'goblok', cases: 1 }]);
    });

    test('Unicode: spans are UTF-16 offsets and surrogate splits are rejected', () => {
        const text = '😀 goblok 😀';
        const [location] = plain.find(text);
        assert.equal(location.index, 3);
        assert.ok(evaluate(plain, [{ text, expected: [{ index: 3, end: 9 }] }]).cases[0].correct);
        // Code-point offsets are the plausible mistake; they are simply wrong spans.
        assert.equal(evaluate(plain, [{ text, expected: [{ index: 2, end: 8 }] }]).cases[0].correct, false);
        assert.throws(() => evaluate(plain, [{ text, expected: [{ index: 1, end: 9 }] }]), /surrogate pair/);
        assert.throws(() => evaluate(plain, [{ text, expected: [{ index: 3, end: 13 }] }]), /outside/);
        assert.equal(evaluate(plain, [{ text, expected: [{ index: 0, end: 2 }] }]).cases[0].outcome, 'tp');
    });

    test('ignoreRanges are passed to find()', () => {
        const result = evaluate(plain, [
            { id: 'ignored', text: 'dasar goblok', expected: false, ignoreRanges: [{ index: 6, end: 12 }] },
            { id: 'not-ignored', text: 'dasar goblok', expected: false }
        ]);
        assert.deepEqual(result.cases.map(({ outcome }) => outcome), ['tn', 'fp']);
        const seen = [];
        evaluate({ find: (text, options) => { seen.push(options); return []; } }, [
            { text: 'x', expected: false }, { text: 'y', expected: false, ignoreRanges: [{ index: 0, end: 1 }] }
        ]);
        assert.deepEqual(seen, [undefined, { ignoreRanges: [{ index: 0, end: 1 }] }]);
    });
});

describe('evaluate: diagnostics', () => {
    test('failures carry id, text, expected, outcome and matches in input order', () => {
        const result = evaluate(plain, [
            { id: 'ok', text: 'dasar goblok', expected: true },
            { id: 'bad-fp', text: 'dasar tolol', expected: false },
            { id: 'bad-fn', text: 'dasar baik', expected: true }
        ]);
        assert.deepEqual(result.failures, [
            { id: 'bad-fp', expected: false, outcome: 'fp', correct: false, words: ['tolol'], text: 'dasar tolol',
                matches: [{ word: 'tolol', index: 6, end: 11, match: 'tolol', via: 'exact' }] },
            { id: 'bad-fn', expected: true, outcome: 'fn', correct: false, words: [], text: 'dasar baik', matches: [] }
        ]);
        assert.equal(result.cases.length, 3);
        assert.ok(result.cases.every((entry) => !('text' in entry)));
    });

    test('top false-positive words sort by count desc then word asc and honour top', () => {
        const checker = scripted({
            one: [['zebra', 0, 1, 'exact']], two: [['zebra', 0, 1, 'exact']],
            three: [['alpha', 0, 1, 'exact']], four: [['beta', 0, 1, 'exact']],
            five: [['mid', 0, 1, 'exact'], ['mid', 1, 2, 'exact']]
        });
        const cases = ['one', 'two', 'three', 'four', 'five'].map((text) => ({ text, expected: false }));
        const full = evaluate(checker, cases);
        assert.deepEqual(full.topFalsePositiveWords, [
            { word: 'zebra', cases: 2 }, { word: 'alpha', cases: 1 }, { word: 'beta', cases: 1 }, { word: 'mid', cases: 1 }
        ]);
        assert.deepEqual(evaluate(checker, cases, { top: 2 }).topFalsePositiveWords.map(({ word }) => word), ['zebra', 'alpha']);
        assert.deepEqual(evaluate(checker, cases, { top: 0 }).topFalsePositiveWords, []);
        assert.deepEqual(evaluate(checker, [...cases].reverse()).topFalsePositiveWords, full.topFalsePositiveWords);
    });

    test('should-flag cases never contribute false-positive words', () => {
        const result = evaluate(plain, [{ text: 'goblok', expected: true }, { id: 'w', text: 'goblok', expected: ['goblok'] }]);
        assert.deepEqual(result.topFalsePositiveWords, []);
    });

    test('via breakdown separates fuzzy false positives from exact hits', () => {
        const fuzzy = new Badwords({ dictionary: ['goblok'], fuzzy: boundedFuzzy({ model: 'osa', maxEdits: 1 }) });
        const result = evaluate(fuzzy, [
            { text: 'dasar goblok', expected: true },
            { text: 'goblox', expected: false },
            { text: 'goblos', expected: false },
            { text: 'baik', expected: false }
        ]);
        assert.deepEqual(result.byVia, {
            evasion: { truePositives: 0, falsePositives: 0 },
            exact: { truePositives: 1, falsePositives: 0 },
            fuzzy: { truePositives: 0, falsePositives: 2 },
            leetspeak: { truePositives: 0, falsePositives: 0 },
            normalized: { truePositives: 0, falsePositives: 0 }
        });
        assert.deepEqual(result.failures.map(({ matches }) => matches[0].via), ['fuzzy', 'fuzzy']);
    });

    test('via breakdown records evasion and leetspeak matches', () => {
        const evasive = new Badwords({
            dictionary: ['goblok'],
            evasion: boundedEvasion({ separators: { characters: ['-'], maxGap: 1, maxTotal: 8 } })
        });
        const result = evaluate(evasive, [
            { text: 'g-o-b-l-o-k', expected: true },
            { text: 'g0bl0k', expected: false },
            { text: 'GOBLOK', expected: true }
        ]);
        assert.deepEqual(result.byVia.evasion, { truePositives: 1, falsePositives: 0 });
        assert.deepEqual(result.byVia.leetspeak, { truePositives: 0, falsePositives: 1 });
        assert.deepEqual(result.byVia.normalized, { truePositives: 1, falsePositives: 0 });
    });

    test('checkers without via are reported as unknown', () => {
        const result = evaluate({ find: () => [{ word: 'x', index: 0, end: 1 }] }, [{ text: 'x', expected: false }]);
        assert.deepEqual(result.byVia.unknown, { truePositives: 0, falsePositives: 1 });
        assert.equal(result.failures[0].matches[0].match, 'x');
    });
});

describe('evaluate: classify option', () => {
    test('is null without classify and breaks down by category and severity with it', () => {
        const checker = new Badwords({ dictionary: ['goblok', 'kontol', 'zzzcustom'] });
        const cases = [
            { text: 'dasar goblok', expected: true },
            { text: 'kontol', expected: false },
            { text: 'zzzcustom', expected: false }
        ];
        const without = evaluate(checker, cases);
        assert.equal(without.byCategory, null);
        assert.equal(without.bySeverity, null);

        const result = evaluate(checker, cases, { classify });
        const goblok = classify([{ word: 'goblok' }]).occurrences[0];
        const kontol = classify([{ word: 'kontol' }]).occurrences[0];
        assert.equal(classify([{ word: 'zzzcustom' }]).occurrences[0].classified, false);
        assert.deepEqual(result.bySeverity.unclassified, { truePositives: 0, falsePositives: 1 });
        assert.ok(result.bySeverity[String(goblok.severity)].truePositives >= 1);
        assert.ok(result.bySeverity[String(kontol.severity)].falsePositives >= 1);
        for (const category of goblok.categories) assert.ok(result.byCategory[category].truePositives >= 1);
        for (const category of kontol.categories) assert.ok(result.byCategory[category].falsePositives >= 1);
        assert.deepEqual(Object.keys(result.byCategory), Object.keys(result.byCategory).sort());
        const total = (table) => Object.values(table).reduce((sum, row) => sum + row.truePositives + row.falsePositives, 0);
        assert.equal(total(result.bySeverity), 3);
        assert.equal(total(result.byVia), 3);
    });

    test('does not change anything else in the result', () => {
        const cases = [{ text: 'dasar goblok', expected: true }, { text: 'tolol', expected: false }];
        const { byCategory, bySeverity, ...withClassify } = evaluate(plain, cases, { classify });
        const { byCategory: a, bySeverity: b, ...without } = evaluate(plain, cases);
        assert.ok(byCategory && bySeverity && a === null && b === null);
        assert.deepEqual(withClassify, without);
    });

    test('rejects a non-function classify', () => {
        assert.throws(() => evaluate(plain, [], { classify: {} }), /classify must be a function/);
    });
});

describe('evaluate: validation', () => {
    const bad = (cases, pattern, checker = plain) => assert.throws(() => evaluate(checker, cases), (error) => error instanceof TypeError && pattern.test(error.message));

    test('rejects malformed input before running anything', () => {
        let calls = 0;
        const spy = { find: () => { calls++; return []; } };
        bad([{ text: 'a', expected: true }, { text: 42, expected: true }], /text must be a string/, spy);
        assert.equal(calls, 0);
        bad('nope', /cases must be an array/);
        bad([null], /must be an object/);
        bad([{ text: 'a' }], /expected must be/);
        bad([{ text: 'a', expected: 'goblok' }], /expected must be/);
        bad([{ text: 'a', expected: [1, 2] }], /expected must be/);
        bad([{ text: 'a', expected: ['x', 1] }], /expected must be/);
        bad([{ text: 'a', expected: [''] }], /non-empty/);
        bad([{ text: 'a', expected: ['x', 'x'] }], /once/);
        bad([{ id: '', text: 'a', expected: true }], /id must be a non-empty string/);
        bad([{ id: 5, text: 'a', expected: true }], /id must be a non-empty string/);
    });

    test('rejects duplicate ids, including generated ones', () => {
        bad([{ id: 'x', text: 'a', expected: true }, { id: 'x', text: 'b', expected: true }], /duplicate case id "x"/);
        bad([{ text: 'a', expected: true }, { id: 'case-1', text: 'b', expected: true }], /duplicate case id "case-1"/);
        assert.deepEqual(evaluate(plain, [{ text: 'a', expected: false }, { text: 'b', expected: false }]).cases.map(({ id }) => id), ['case-1', 'case-2']);
    });

    test('rejects spans that are out of range, empty, fractional or duplicated', () => {
        bad([{ text: 'abc', expected: [{ index: 0, end: 4 }] }], /outside/);
        bad([{ text: 'abc', expected: [{ index: -1, end: 2 }] }], /outside/);
        bad([{ text: 'abc', expected: [{ index: 2, end: 2 }] }], /outside/);
        bad([{ text: 'abc', expected: [{ index: 2, end: 1 }] }], /outside/);
        bad([{ text: 'abc', expected: [{ index: 0.5, end: 2 }] }], /expected must be/);
        bad([{ text: 'abc', expected: [{ index: 0, end: 2 }, { index: 0, end: 2 }] }], /twice/);
        bad([{ text: 'abc', expected: false, ignoreRanges: [{ index: 0, end: 9 }] }], /ignoreRanges range/);
        bad([{ text: 'abc', expected: false, ignoreRanges: 'x' }], /ignoreRanges must be an array/);
        bad([{ text: 'abc', expected: false, ignoreRanges: [{ index: 'a', end: 1 }] }], /ignoreRanges entries/);
        // Empty ignore ranges are documented no-ops for find(), so they stay valid.
        evaluate(plain, [{ text: 'abc', expected: false, ignoreRanges: [{ index: 1, end: 1 }] }]);
    });

    test('rejects bad checkers and options', () => {
        assert.throws(() => evaluate(null, []), /find/);
        assert.throws(() => evaluate({}, []), /find/);
        assert.throws(() => evaluate(plain, [], { top: -1 }), /top/);
        assert.throws(() => evaluate(plain, [], { top: 1.5 }), /top/);
        assert.throws(() => evaluate(plain, [], null), /options/);
        assert.throws(() => evaluate({ find: () => 'x' }, [{ text: 'a', expected: false }]), /return an array/);
        assert.throws(() => evaluate({ find: () => [{ word: 'x' }] }, [{ text: 'a', expected: false }]), /locations/);
    });

    test('does not mutate the cases', () => {
        const cases = Object.freeze([Object.freeze({ id: 'a', text: 'tolol goblok', expected: Object.freeze(['tolol', 'goblok']) })]);
        evaluate(plain, cases);
        assert.deepEqual(cases[0].expected, ['tolol', 'goblok']);
    });
});

describe('compare', () => {
    const cases = [
        { id: 'c-fp', text: 'dasar goblok', expected: false },
        { id: 'a-fn', text: 'dasar gblk', expected: true },
        { id: 'b-ok', text: 'dasar tolol', expected: true },
        { id: 'd-words', text: 'goblok', expected: ['goblok'] }
    ];
    const before = new Badwords({ dictionary: ['goblok', 'tolol'] });
    const after = new Badwords({ dictionary: ['gblk', 'goblok'], allowPhrases: ['dasar goblok'] });

    test('lists fixed, broken and shifted cases in id order', () => {
        const diff = compare(evaluate(before, cases), evaluate(after, cases));
        assert.deepEqual(diff.fixed.map(({ id }) => id), ['a-fn', 'c-fp']);
        assert.deepEqual(diff.broken.map(({ id }) => id), ['b-ok']);
        assert.deepEqual(diff.shifted, []);
        assert.deepEqual(diff.fixed[0], { id: 'a-fn', before: { outcome: 'fn', words: [] }, after: { outcome: 'tp', words: ['gblk'] } });
        assert.deepEqual(diff.broken[0], { id: 'b-ok', before: { outcome: 'tp', words: ['tolol'] }, after: { outcome: 'fn', words: [] } });
        assert.deepEqual(diff.delta, { tp: 0, fp: -1, fn: 0, tn: 1, correct: 1 });
        assert.deepEqual([diff.added, diff.removed], [[], []]);
    });

    test('is independent of case order and symmetric', () => {
        const forward = compare(evaluate(before, cases), evaluate(after, cases));
        const shuffled = compare(evaluate(before, [...cases].reverse()), evaluate(after, [...cases].reverse()));
        assert.deepEqual(shuffled, forward);
        const backward = compare(evaluate(after, cases), evaluate(before, cases));
        assert.deepEqual(backward.fixed.map(({ id }) => id), ['b-ok']);
        assert.deepEqual(backward.broken.map(({ id }) => id), forward.fixed.map(({ id }) => id));
    });

    test('comparing a result with itself is empty, and survives a JSON snapshot', () => {
        const result = evaluate(before, cases);
        const snapshot = JSON.parse(JSON.stringify(result));
        assert.deepEqual(compare(snapshot, result), {
            schemaVersion: 1, delta: { tp: 0, fp: 0, fn: 0, tn: 0, correct: 0 }, fixed: [], broken: [], shifted: [], added: [], removed: []
        });
    });

    test('reports shifted cases that stay wrong in a different way', () => {
        const x = scripted({ t: [['one', 0, 1, 'exact']] });
        const y = scripted({ t: [['two', 0, 1, 'exact']] });
        const z = scripted({ t: [] });
        const only = [{ id: 't', text: 't', expected: false }];
        assert.deepEqual(compare(evaluate(x, only), evaluate(y, only)).shifted.map(({ id }) => id), ['t']);
        assert.deepEqual(compare(evaluate(x, only), evaluate(x, only)).shifted, []);
        assert.deepEqual(compare(evaluate(x, only), evaluate(z, only)).fixed.map(({ id }) => id), ['t']);
    });

    test('reports added and removed ids and rejects changed expectations', () => {
        const a = evaluate(plain, [{ id: 'x', text: 'a', expected: false }, { id: 'old', text: 'a', expected: false }]);
        const b = evaluate(plain, [{ id: 'x', text: 'a', expected: false }, { id: 'new', text: 'a', expected: false }]);
        const diff = compare(a, b);
        assert.deepEqual([diff.added, diff.removed], [['new'], ['old']]);
        const c = evaluate(plain, [{ id: 'x', text: 'a', expected: true }]);
        assert.throws(() => compare(a, c), /different expectation/);
        assert.throws(() => compare({}, a), /before must be an evaluate\(\) result/);
        assert.throws(() => compare(a, null), /after must be an evaluate\(\) result/);
    });
});

describe('evaluate: detections (overlapping matches on one span)', () => {
    const fuzzy = new Badwords({ fuzzy: boundedFuzzy({ model: 'osa', maxEdits: 1 }) });
    const evasive = new Badwords({
        dictionary: ['goblok'],
        fuzzy: boundedFuzzy({ model: 'osa', maxEdits: 1 }),
        evasion: boundedEvasion({ separators: { characters: ['-'], maxGap: 1, maxTotal: 8 } })
    });

    test('a real fuzzy checker reports several words on one span', () => {
        const kinds = fuzzy.find('dasar goblok').map(({ word, index, end, via }) => [word, index, end, via.kind]);
        assert.ok(kinds.length > 1, 'the premise: fuzzy neighbours share the exact span');
        assert.ok(kinds.every(([, index, end]) => index === 6 && end === 12));
        assert.ok(kinds.some(([word, , , kind]) => word === 'goblok' && kind === 'exact'));
    });

    test('an expected word makes its whole detection a true positive, without blaming the neighbours', () => {
        const result = evaluate(fuzzy, [
            { id: 'bool', text: 'dasar goblok', expected: true },
            { id: 'words', text: 'dasar goblok', expected: ['goblok'] },
            { id: 'span', text: 'dasar goblok', expected: [{ index: 6, end: 12 }] }
        ]);
        assert.deepEqual(result.cases.map(({ correct }) => correct), [true, true, true]);
        assert.deepEqual([result.words.tp, result.words.fp, result.words.fn, result.words.precision.value], [1, 0, 0, 1]);
        assert.deepEqual([result.spans.tp, result.spans.fp, result.spans.fn], [1, 0, 0]);
        assert.deepEqual(result.topFalsePositiveWords, []);
        // Three detections, each credited once, all to the strongest kind.
        assert.deepEqual(result.byVia.exact, { truePositives: 3, falsePositives: 0 });
        assert.deepEqual(result.byVia.fuzzy, { truePositives: 0, falsePositives: 0 });
        // The per-match detail is still there when a case fails.
        const failing = evaluate(fuzzy, [{ id: 'f', text: 'dasar goblok', expected: false }]);
        assert.equal(failing.failures[0].matches.length, fuzzy.find('dasar goblok').length);
        assert.ok(failing.failures[0].matches.length > 1);
    });

    test('a detection nothing expected is one false positive, with each word listed once', () => {
        const matches = fuzzy.find('goblox');
        assert.ok(matches.length >= 1 && matches.every(({ via }) => via.kind === 'fuzzy'));
        const result = evaluate(fuzzy, [{ id: 'typo', text: 'goblox', expected: false }, { id: 'typo2', text: 'goblox', expected: false }]);
        assert.deepEqual(result.byVia.fuzzy, { truePositives: 0, falsePositives: 2 });
        assert.deepEqual(result.byVia.exact, { truePositives: 0, falsePositives: 0 });
        assert.deepEqual(result.topFalsePositiveWords, [...new Set(matches.map(({ word }) => word))].sort().map((word) => ({ word, cases: 2 })));
    });

    test('a wrong expected word is a false positive and a false negative at the word level', () => {
        const result = evaluate(fuzzy, [{ id: 'w', text: 'dasar goblok', expected: ['tolol'] }]);
        const reported = new Set(fuzzy.find('dasar goblok').map(({ word }) => word));
        assert.deepEqual([result.words.tp, result.words.fp, result.words.fn], [0, reported.size, 1]);
        assert.equal(result.cases[0].correct, false);
    });

    test('evasion plus fuzzy: one spelling is one detection, credited to evasion', () => {
        const found = evasive.find('g-o-b-l-o-k');
        assert.deepEqual(found.map(({ index, end, via }) => [index, end, via.kind]), [[0, 9, 'fuzzy'], [0, 11, 'evasion'], [2, 11, 'fuzzy']]);
        const result = evaluate(evasive, [
            { id: 'bool', text: 'g-o-b-l-o-k', expected: true },
            { id: 'span', text: 'g-o-b-l-o-k', expected: [{ index: 0, end: 11 }] },
            { id: 'word', text: 'g-o-b-l-o-k', expected: ['goblok'] },
            { id: 'plain', text: 'dasar goblok', expected: true }
        ]);
        assert.deepEqual(result.cases.map(({ correct }) => correct), [true, true, true, true]);
        assert.deepEqual(result.byVia.evasion, { truePositives: 3, falsePositives: 0 });
        assert.deepEqual(result.byVia.fuzzy, { truePositives: 0, falsePositives: 0 });
        assert.deepEqual(result.byVia.exact, { truePositives: 1, falsePositives: 0 });
        assert.deepEqual([result.spans.tp, result.spans.fp, result.spans.fn], [1, 0, 0]);
        // Only touching, not overlapping, spans stay separate detections.
        const touching = scripted({ ab: [['a', 0, 1, 'exact'], ['b', 1, 2, 'exact']] });
        assert.deepEqual(evaluate(touching, [{ text: 'ab', expected: false }]).byVia.exact, { truePositives: 0, falsePositives: 2 });
    });

    test('via is credited to the strongest kind in the documented order', () => {
        const order = ['fuzzy', 'evasion', 'leetspeak', 'normalized', 'exact'];
        for (let at = 0; at < order.length; at++) {
            const kinds = order.slice(at);
            const checker = { find: () => kinds.map((kind, i) => ({ word: `w${i}`, index: 0, end: 3, via: { kind } })) };
            const result = evaluate(checker, [{ text: 'abc', expected: true }]);
            const credited = Object.entries(result.byVia).filter(([, row]) => row.truePositives > 0);
            assert.deepEqual(credited, [[order[order.length - 1], { truePositives: 1, falsePositives: 0 }]]);
        }
        const mixed = evaluate({ find: () => [{ word: 'a', index: 0, end: 1, via: { kind: 'fuzzy' } }, { word: 'b', index: 0, end: 1, via: { kind: 'leetspeak' } }] }, [{ text: 'a', expected: false }]);
        assert.deepEqual(mixed.byVia.leetspeak, { truePositives: 0, falsePositives: 1 });
        assert.deepEqual(mixed.byVia.fuzzy, { truePositives: 0, falsePositives: 0 });
    });

    test('span false positives count unique spans in unexpected detections, not matches', () => {
        const checker = scripted({ abcdef: [['x', 3, 6, 'exact'], ['y', 3, 6, 'exact'], ['z', 0, 1, 'exact']] });
        const result = evaluate(checker, [{ id: 's', text: 'abcdef', expected: [{ index: 0, end: 1 }] }]);
        assert.deepEqual([result.spans.tp, result.spans.fp, result.spans.fn], [1, 1, 0]);
        assert.deepEqual(result.topFalsePositiveWords, [{ word: 'x', cases: 1 }, { word: 'y', cases: 1 }]);
        assert.deepEqual(result.byVia.exact, { truePositives: 1, falsePositives: 1 });
        assert.equal(result.cases[0].correct, false);
    });

    test('an empty expectation counts at both the word and the span level', () => {
        const checker = scripted({ abcdef: [['x', 3, 6, 'exact'], ['y', 3, 6, 'exact']] });
        const result = evaluate(checker, [{ id: 'none', text: 'abcdef', expected: [] }, { id: 'quiet', text: 'ab', expected: [] }]);
        assert.deepEqual([result.words.cases, result.words.tp, result.words.fp, result.words.fn], [2, 0, 2, 0]);
        assert.deepEqual([result.spans.cases, result.spans.tp, result.spans.fp, result.spans.fn], [2, 0, 1, 0]);
        assert.deepEqual(result.cases.map(({ correct }) => correct), [false, true]);
        assert.deepEqual(result.counts, { tp: 0, fp: 1, fn: 0, tn: 1 });
    });

    test('expected words are the reported dictionary key, not the matched text', () => {
        const checker = new Badwords({ dictionary: ['goblok'] });
        assert.equal(checker.find('dasar GOBLOK')[0].word, 'goblok');
        const result = evaluate(checker, [
            { id: 'key', text: 'dasar GOBLOK', expected: ['goblok'] },
            { id: 'wide', text: 'dasar Ｇｏｂｌｏｋ', expected: ['goblok'] },
            { id: 'raw', text: 'dasar GOBLOK', expected: ['GOBLOK'] }
        ]);
        assert.deepEqual(result.cases.map(({ correct }) => correct), [true, true, false]);
    });
});

describe('evaluate: ordering, tallies and the classify buckets', () => {
    test('uses code-unit ordering for ids and words, not locale ordering', () => {
        const checker = scripted({ ttt: [['zeta', 0, 1, 'exact'], ['éta', 1, 2, 'exact']] });
        const result = evaluate(checker, [{ id: 'a', text: 'ttt', expected: false }]);
        assert.deepEqual(result.topFalsePositiveWords.map(({ word }) => word), ['zeta', 'éta']);
        const reference = (words) => scripted({ xxx: words.map((word, i) => [word, 0, 1, 'exact']) });
        const cases = ['B', 'a', 'A', 'b'].map((id) => ({ id, text: 'xxx', expected: false }));
        const none = evaluate(scripted({}), cases);
        const flagged = evaluate(reference(['one']), cases);
        assert.deepEqual(compare(none, flagged).broken.map(({ id }) => id), ['A', 'B', 'a', 'b']);
        assert.deepEqual(compare(flagged, none).fixed.map(({ id }) => id), ['A', 'B', 'a', 'b']);
        const table = scripted({ xxx: [['w', 0, 1, 'zz'], ['v', 2, 3, 'Zz']] });
        assert.deepEqual(Object.keys(evaluate(table, [{ text: 'xxx', expected: false }]).byVia).slice(0, 2), ['Zz', 'evasion']);
    });

    test('categories and severities are counted once per detection, with exact counts', () => {
        const checker = new Badwords({ dictionary: ['goblok', 'kontol', 'bodo', 'zzzcustom'] });
        const result = evaluate(checker, [
            { text: 'goblok', expected: true },
            { text: 'kontol', expected: true },
            { text: 'bodo', expected: false },
            { text: 'zzzcustom', expected: false }
        ], { classify });
        // goblok: insult/2; kontol: insult + sexual-vulgarity/3; bodo: insult/unrated; zzzcustom: unclassified.
        assert.deepEqual(result.byCategory, {
            insult: { truePositives: 2, falsePositives: 1 },
            'sexual-vulgarity': { truePositives: 1, falsePositives: 0 }
        });
        assert.deepEqual(result.bySeverity, {
            2: { truePositives: 1, falsePositives: 0 },
            3: { truePositives: 1, falsePositives: 0 },
            unclassified: { truePositives: 0, falsePositives: 1 },
            unrated: { truePositives: 0, falsePositives: 1 }
        });
    });

    test('classifies a detection by its strongest-kind word', () => {
        const checker = { find: () => [{ word: 'kontol', index: 0, end: 3, via: { kind: 'fuzzy' } }, { word: 'bodo', index: 0, end: 3, via: { kind: 'exact' } }] };
        const result = evaluate(checker, [{ text: 'abc', expected: false }], { classify });
        assert.deepEqual(result.bySeverity, { unrated: { truePositives: 0, falsePositives: 1 } });
    });

    test('prototype-looking keys neither pollute nor vanish', () => {
        const keys = ['__proto__', 'toString', 'constructor', 'hasOwnProperty'];
        const checker = { find: () => keys.map((kind, i) => ({ word: kind, index: i, end: i + 1, via: { kind } })) };
        const classifier = () => ({ occurrences: [{ classified: true, categories: keys, severity: 2 }] });
        const result = evaluate(checker, [{ text: 'abcd', expected: false }], { classify: classifier });
        for (const key of keys) {
            assert.ok(Object.hasOwn(result.byVia, key), key);
            assert.deepEqual(result.byVia[key], { truePositives: 0, falsePositives: 1 }, key);
            assert.ok(Object.hasOwn(result.byCategory, key), key);
            assert.deepEqual(result.byCategory[key], { truePositives: 0, falsePositives: 4 }, key);
        }
        assert.equal(Object.getPrototypeOf(result.byVia), Object.prototype);
        assert.equal(Object.prototype.falsePositives, undefined);
        assert.equal(Object.prototype.truePositives, undefined);
        assert.deepEqual(result.topFalsePositiveWords.map(({ word }) => word), [...keys].sort());
        assert.equal(JSON.parse(JSON.stringify(result)).byVia.toString.falsePositives, 1);
    });

    test('top accepts Infinity', () => {
        const words = Array.from({ length: 12 }, (_, i) => ['w' + String(i).padStart(2, '0'), 0, 1, 'exact']);
        const checker = scripted({ xxx: words });
        assert.equal(evaluate(checker, [{ text: 'xxx', expected: false }]).topFalsePositiveWords.length, 10);
        assert.equal(evaluate(checker, [{ text: 'xxx', expected: false }], { top: Infinity }).topFalsePositiveWords.length, 12);
        assert.throws(() => evaluate(checker, [], { top: NaN }), /top/);
    });
});

describe('evaluate: strict inputs', () => {
    test('rejects sparse arrays naming the case', () => {
        assert.throws(() => evaluate(plain, [{ text: 'a', expected: false }, , { text: 'b', expected: false }]), /case 1 is missing/);
        assert.throws(() => evaluate(plain, [{ id: 'w', text: 'a', expected: [, 'x'] }]), /"w".*sparse/);
        assert.throws(() => evaluate(plain, [{ id: 's', text: 'abc', expected: [{ index: 0, end: 1 }, ,] }]), /"s".*sparse/);
        assert.throws(() => evaluate(plain, [{ id: 'r', text: 'abc', expected: false, ignoreRanges: [, { index: 0, end: 1 }] }]), /"r".*sparse/);
    });

    test('rejects find() locations that are not valid offsets, naming the case', () => {
        for (const bad of [{ index: 0.5, end: 1 }, { index: -1, end: 1 }, { index: 2, end: 1 }, { index: 0, end: 4 }, { index: 0, end: Infinity }]) {
            const checker = { find: () => [{ word: 'x', ...bad }] };
            assert.throws(() => evaluate(checker, [{ id: 'named', text: 'abc', expected: false }]), (error) => error instanceof TypeError && /"named"/.test(error.message), JSON.stringify(bad));
        }
        evaluate({ find: () => [{ word: 'x', index: 3, end: 3 }] }, [{ text: 'abc', expected: false }]);
    });

    test('find() errors during the run propagate unchanged', () => {
        const checker = { find: () => { throw new RangeError('boom'); } };
        assert.throws(() => evaluate(checker, [{ text: 'a', expected: false }]), RangeError);
        assert.throws(() => evaluate(new Badwords(), [{ text: '👨‍👩‍👧', expected: false, ignoreRanges: [{ index: 2, end: 3 }] }]), RangeError);
    });
});

describe('compare: inputs and deltas', () => {
    test('delta counts only ids present in both results', () => {
        const base = [{ id: 'a', text: 'goblok', expected: true }, { id: 'b', text: 'halo', expected: false }];
        const small = evaluate(new Badwords(), base);
        const large = evaluate(new Badwords(), [...base, { id: 'c', text: 'tolol', expected: true }, { id: 'd', text: 'pagi', expected: false }]);
        const diff = compare(small, large);
        assert.deepEqual(diff.delta, { tp: 0, fp: 0, fn: 0, tn: 0, correct: 0 });
        assert.deepEqual(diff.added, ['c', 'd']);
        assert.deepEqual(compare(large, small).removed, ['c', 'd']);
    });

    test('shifted compares word sets, not order', () => {
        const at = (words) => scripted({ ttt: words.map((word, i) => [word, i, i + 1, 'exact']) });
        const only = [{ id: 'x', text: 'ttt', expected: ['tolol'] }];
        const first = evaluate(at(['anjing', 'babi']), only);
        const second = evaluate(at(['babi', 'anjing']), only);
        const third = evaluate(at(['babi', 'celeng']), only);
        assert.deepEqual(compare(first, second).shifted, []);
        assert.deepEqual(compare(first, third).shifted.map(({ id }) => id), ['x']);
    });

    test('validates its inputs', () => {
        const result = evaluate(plain, [{ id: 'a', text: 'goblok', expected: true }]);
        const duplicate = JSON.parse(JSON.stringify(result));
        duplicate.cases.push(duplicate.cases[0]);
        assert.throws(() => compare(result, duplicate), /after lists case id "a" twice/);
        const { counts, ...withoutCounts } = result;
        assert.throws(() => compare(withoutCounts, result), /before must be an evaluate\(\) result/);
        assert.throws(() => compare(result, { schemaVersion: 1, counts }), /after must be an evaluate\(\) result/);
        assert.throws(() => compare(result, { ...result, cases: [{ id: 'a' }] }), /malformed case entry/);
    });

    test('identifies cases by id only: edited text under one id is a change', () => {
        const before = evaluate(plain, [{ id: 'z', text: 'goblok', expected: true }]);
        const after = evaluate(plain, [{ id: 'z', text: 'halo', expected: true }]);
        assert.deepEqual(compare(before, after).broken.map(({ id }) => id), ['z']);
    });
});
