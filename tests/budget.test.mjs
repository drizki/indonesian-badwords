import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Badwords } from '../dist/esm/index.js';
import { boundedEvasion, EvasionLimitError } from '../dist/esm/evasion.js';
import { boundedFuzzy, FuzzyLimitError } from '../dist/esm/fuzzy.js';

// Dictionary updates enforce every compile budget eagerly, with a pre-check that must reach the same verdict as a full
// compile. These tests sweep each limit across its boundary and compare the two verdicts, including the error fields.
let seed = 99;
const random = (n) => { seed = (seed * 48271) % 2147483647; return seed % n; };
const words = (count, min, max, alphabet = 26) => Array.from({ length: count }, () =>
    Array.from({ length: min + random(max - min + 1) }, () => String.fromCharCode(97 + random(alphabet))).join(''));
const verdict = (run) => {
    try { run(); return { ok: true }; } catch (error) {
        assert.ok(error instanceof EvasionLimitError || error instanceof FuzzyLimitError, String(error));
        return { name: error.name, limit: error.limit, maximum: error.maximum, used: error.used };
    }
};
const evasion = (limits = {}) => boundedEvasion({ separators: { characters: ['-'], maxGap: 1, maxTotal: 4 }, limits });

/** Compares addWords/removeWords against compiling the resulting dictionary from scratch, for each policy factory. */
function agree(policies, base, change, remove = false, options = {}) {
    let failures = 0, passes = 0;
    for (const policy of policies) {
        let checker;
        try { checker = new Badwords({ dictionary: base, ...policy, ...options }); } catch { continue; }
        const next = remove ? base.filter(word => !change.includes(word)) : [...base, ...change];
        const expected = verdict(() => new Badwords({ dictionary: next, ...policy, ...options }));
        const actual = verdict(() => (remove ? checker.removeWords(change) : checker.addWords(change)));
        assert.deepEqual(actual, expected);
        if (actual.ok) {
            passes++;
            assert.deepEqual(checker.dict.sort(), [...next].sort());
            assert.doesNotThrow(() => checker.flag('halo'), 'a deferred compile never fails on a budget');
        } else {
            failures++;
            assert.deepEqual(checker.dict, base, 'a failed update leaves the dictionary unchanged');
            assert.doesNotThrow(() => checker.flag('halo'));
        }
    }
    return { failures, passes };
}
const sweep = (from, to, step, make) => { const out = []; for (let value = from; value <= to; value += step) out.push(make(value)); return out; };

test('evasion: the pre-check agrees with the compiler across the compileStates boundary', () => {
    const base = words(15, 5, 9), add = words(8, 5, 11);
    const { failures, passes } = agree(sweep(1, 260, 1, limit => ({ evasion: evasion({ maxCompileStates: limit }) })), base, add);
    assert.ok(failures > 5 && passes > 5, `${failures}/${passes}`);
    const kept = agree(sweep(1, 260, 1, limit => ({ evasion: evasion({ maxCompileStates: limit }) })), [...base, ...add], add.slice(0, 5), true);
    assert.ok(kept.passes > 5);
});

test('fuzzy: the pre-check agrees across compileStates, indexPostings and stateCells, in both index modes', () => {
    const base = words(20, 5, 9), add = words(10, 5, 14);
    for (const extra of [{}, { maxEdits: 2 }, { maxEdits: 2, model: 'osa' }, { model: 'osa' }, { maxEdits: 3, deletions: false }]) {
        for (const [key, to, step] of [['maxCompileStates', 260, 1], ['maxIndexPostings', 420, 1], ['maxStateCells', 1800, 1]]) {
            const { failures, passes } = agree(sweep(1, to, step, limit => ({ fuzzy: boundedFuzzy({ ...extra, limits: { [key]: limit } }) })), base, add);
            assert.ok(failures > 0 && passes > 0, `${key} ${JSON.stringify(extra)} ${failures}/${passes}`);
        }
    }
});

test('fuzzy with evasion: both budgets apply, and the tighter limit names the error', () => {
    const base = words(12, 5, 8), add = words(8, 5, 12);
    for (const [fuzzyStates, evasionStates] of [[40, 90], [90, 40], [70, 70]]) {
        for (const limit of sweep(1, 130, 1, value => value)) {
            const cases = [{ fuzzy: boundedFuzzy({ limits: { maxCompileStates: limit } }), evasion: evasion({ maxCompileStates: evasionStates }) },
                { fuzzy: boundedFuzzy({ limits: { maxCompileStates: fuzzyStates } }), evasion: evasion({ maxCompileStates: limit }) },
                { fuzzy: boundedFuzzy({ limits: { maxIndexPostings: limit * 3, maxCompileStates: fuzzyStates } }), evasion: evasion({ maxCompileStates: evasionStates }) },
                { fuzzy: boundedFuzzy({ limits: { maxStateCells: limit * 12 } }), evasion: evasion() }];
            agree(cases, base, add);
        }
    }
    const names = new Set();
    for (const [fuzzy, evade] of [[30, 90], [90, 30]]) {
        const checker = new Badwords({ dictionary: ['goblok'], fuzzy: boundedFuzzy({ limits: { maxCompileStates: fuzzy } }), evasion: evasion({ maxCompileStates: evade }) });
        names.add(verdict(() => checker.addWords(words(5, 12, 12))).name);
    }
    assert.deepEqual([...names].sort(), ['EvasionLimitError', 'FuzzyLimitError']);
});

test('fuzzy: ignoreRepeatedLetters budgets the folded keys', () => {
    const base = ['gooooblok', 'koooontol', 'anjiiing'], add = ['bangsaaaat', 'goooooblok', 'tolooooool', 'memeeeek'];
    const policies = [...sweep(1, 80, 1, limit => ({ fuzzy: boundedFuzzy({ limits: { maxCompileStates: limit } }) })),
        ...sweep(1, 60, 1, limit => ({ fuzzy: boundedFuzzy({ limits: { maxIndexPostings: limit } }) }))];
    const { failures, passes } = agree(policies, base, add, false, { ignoreRepeatedLetters: true });
    assert.ok(failures > 5 && passes > 5);
});

test('a removal can itself exceed a budget (the index switches representation), exactly as a full compile does', () => {
    // 700 ten-letter words use q-gram postings (5,600); after removing 150 the compact deletion index needs 6,050.
    const base = [...new Set(words(900, 10, 10))].slice(0, 700), gone = base.slice(0, 150);
    const policies = sweep(5000, 6500, 50, limit => ({ fuzzy: boundedFuzzy({ limits: { maxIndexPostings: limit } }) }));
    const { failures, passes } = agree(policies, base, gone, true);
    assert.ok(failures > 0 && passes > 0, `${failures}/${passes}`);
});

test('a rejected add never undoes pending removals or drops accepted words', () => {
    const checker = new Badwords({ dictionary: ['goblok', 'bodo'], fuzzy: boundedFuzzy({ limits: { maxCompileStates: 60 } }) });
    checker.removeWords('bodo');
    assert.throws(() => checker.addWords('x'.repeat(60)), error => error instanceof FuzzyLimitError && error.limit === 'compileStates');
    assert.deepEqual(checker.dict, ['goblok']);
    assert.equal(checker.flag('dasar bodo'), false, 'bodo stays removed');
    assert.equal(checker.flag('dasar goblox'), true);
    checker.addWords('kontol');
    assert.throws(() => checker.addWords('y'.repeat(60)), FuzzyLimitError);
    assert.equal(checker.flag('kontox'), true, 'an accepted word survives a later rejection');
    assert.deepEqual(checker.dict, ['goblok', 'kontol']);
});

test('loading words one at a time rejects exactly the over-budget ones and never fails a later scan', () => {
    const limits = { maxCompileStates: 3000 };
    const eager = new Badwords({ fuzzy: boundedFuzzy({ limits }) }), reference = new Badwords({ fuzzy: boundedFuzzy({ limits }) });
    const list = words(400, 12, 12);
    let rejected = 0, accepted = 0;
    for (const word of list) {
        let expected = verdict(() => new Badwords({ dictionary: [...reference.dict, word], fuzzy: boundedFuzzy({ limits }) }));
        if (expected.ok) reference.addWords(word);
        const actual = verdict(() => eager.addWords(word));
        assert.deepEqual(actual, expected);
        if (actual.ok) accepted++; else rejected++;
        if ((accepted + rejected) % 40 === 0) assert.doesNotThrow(() => eager.flag('halo'));
    }
    assert.ok(rejected > 100 && accepted > 100, `${accepted}/${rejected}`);
    assert.deepEqual(eager.dict, reference.dict);
    assert.doesNotThrow(() => eager.flag('halo'));
    assert.equal(eager.flag('goblok'), true);
});
