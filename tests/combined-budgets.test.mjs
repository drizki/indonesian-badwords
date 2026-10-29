import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Badwords } from '../dist/esm/index.js';
import { boundedEvasion, EvasionLimitError, latinLookalikes } from '../dist/esm/evasion.js';
import { boundedFuzzy, FuzzyLimitError } from '../dist/esm/fuzzy.js';

const separators = { characters: [' ', '.', '_', '-'], maxGap: 1, maxTotal: 8 };
const evasion = (limits, extra = {}) => boundedEvasion({ separators, repetitions: { maxExtraPerLetter: 2, maxTotal: 8 },
    confusables: { mappings: latinLookalikes, maxTotal: 2 }, limits, ...extra });
const dashes = options => boundedEvasion({ separators: { characters: ['-'], maxGap: 1, maxTotal: 8 }, ...options });
const message = 'nngg-ee-nntt-оо-tt '.repeat(15).slice(0, 268);
const prose = 'Saya sedang makan siang bersama teman-teman di kantor, lalu kami membahas rencana liburan akhir tahun. '.repeat(4);
const detailed = ['find', 'badwords', 'censor', 'analyze'];
const call = (checker, api, text) => api === 'callback' ? checker.censor(text, () => '*') : checker[api](text);

// The smallest maxSteps (or maxStateCells) under which `run` completes. Counting is deterministic.
function minimum(make, run, high = 2 ** 32 - 1) {
    let low = 1;
    const ok = value => {
        try { run(make(value)); return true; } catch (error) {
            if (error instanceof FuzzyLimitError || error instanceof EvasionLimitError) return false;
            throw error;
        }
    };
    assert.ok(ok(high));
    while (low < high) { const mid = Math.floor((low + high) / 2); if (ok(mid)) high = mid; else low = mid + 1; }
    return low;
}
const fuzzyOf = (limits, options = {}, mode = 'word') => new Badwords({ mode, fuzzy: boundedFuzzy({ ...options, limits }) });
const combinedOf = (limits, mode = 'word', dictionary) => new Badwords({ mode, dictionary, evasion: evasion(), fuzzy: boundedFuzzy({ limits }) });

test('the reported separator-heavy message completes under the default combined budget', () => {
    const checker = new Badwords({ evasion: evasion(), fuzzy: boundedFuzzy() });
    const found = checker.find(message);
    assert.ok(found.length >= 28);
    for (const item of found) assert.equal(item.match, message.slice(item.index, item.end));
    assert.equal(checker.flag(message), true);
    for (const api of ['badwords', 'censor', 'analyze', 'callback']) assert.doesNotThrow(() => call(checker, api, message));
    assert.ok(new Badwords({ evasion: evasion() }).find(message).length >= 28);
});

test('unbroken substring runs complete under default fuzzy budgets', () => {
    const checker = new Badwords({ mode: 'substring', fuzzy: boundedFuzzy() });
    assert.equal(checker.flag('x'.repeat(20_000)), false);
    assert.deepEqual(checker.find('x'.repeat(40_000)), []);
    const both = new Badwords({ mode: 'substring', evasion: evasion(), fuzzy: boundedFuzzy() });
    assert.deepEqual(both.find('x'.repeat(20_000)), []);
});

test('step counts stay within documented per-character envelopes', () => {
    const cases = [
        ['fuzzy word run', limits => fuzzyOf(limits), 'x'.repeat(4_000), 3],
        ['fuzzy word prose', limits => fuzzyOf(limits), prose, 8],
        ['fuzzy substring run', limits => fuzzyOf(limits, {}, 'substring'), 'x'.repeat(2_000), 260],
        ['fuzzy substring prose', limits => fuzzyOf(limits, {}, 'substring'), prose, 25],
        ['combined prose', limits => combinedOf(limits), prose, 90],
        ['combined adversarial', limits => combinedOf(limits), message, 560],
        ['combined spaced letters', limits => combinedOf(limits), 'a b '.repeat(500), 250],
        ['combined substring run', limits => combinedOf(limits, 'substring'), 'x'.repeat(2_000), 520],
        ['combined substring adversarial', limits => combinedOf(limits, 'substring'), message, 1700]
    ];
    for (const [name, make, input, perCharacter] of cases) {
        const steps = minimum(value => make({ maxSteps: value }), checker => checker.find(input));
        assert.ok(steps <= perCharacter * input.length, `${name}: ${steps} steps for ${input.length} characters`);
        assert.throws(() => make({ maxSteps: steps - 1 }).find(input), error => error.limit === 'steps' && error.used === steps);
    }
});

test('sound prefilters lose no occurrence against an always-scan reference', () => {
    const brand = Symbol.for('indonesian-badwords.evasion.v2');
    const exhaustive = policy => {
        const compiler = policy[brand];
        return Object.freeze({ [brand]: Object.freeze({ ...compiler, plan: (...args) => ({ ...compiler.plan(...args), prefilter: false }) }) });
    };
    let seed = 7;
    const next = () => (seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff) / 0x7fffffff;
    const alphabet = ['g', 'o', 'b', 'l', 'k', 'a', 'n', 'j', 'i', 'g', 'o', 'о', 'о', '-', '-', ' ', '.', 'x', 'l', 'l'];
    const dictionary = ['goblok', 'anjing', 'asu', 'babi'];
    const policies = [{}, { mode: 'substring' }, { fuzzy: { model: 'osa' } }, { fuzzy: { maxEdits: 2 } }, { fuzzy: { insertions: false } }]
        .map(({ mode, fuzzy }) => ({ mode, fuzzy: boundedFuzzy({ minLength: 3, ...fuzzy }) }));
    let hits = 0;
    for (const { mode, fuzzy } of policies) {
        const policy = evasion({}, { minLength: 3 });
        const fast = new Badwords({ mode, dictionary, evasion: policy, fuzzy });
        const reference = new Badwords({ mode, dictionary, evasion: exhaustive(policy), fuzzy });
        for (let n = 0; n < 250; n++) {
            const input = Array.from({ length: 1 + Math.floor(next() * 4) }, () => {
                if (next() < 0.25) return alphabet[Math.floor(next() * alphabet.length)].repeat(1 + Math.floor(next() * 3));
                let word = [...dictionary[Math.floor(next() * dictionary.length)]];
                for (let edits = Math.floor(next() * 4); edits > 0; edits--) {
                    const at = Math.floor(next() * word.length), pick = next(), symbol = alphabet[Math.floor(next() * alphabet.length)];
                    if (pick < 0.3) word.splice(at, 0, symbol); else if (pick < 0.45) word.splice(at, 1);
                    else if (pick < 0.6) word[at] = symbol; else if (pick < 0.75) word.splice(at, 0, word[at]);
                    else if (pick < 0.85 && at) [word[at - 1], word[at]] = [word[at], word[at - 1]]; else word.splice(at, 0, '-');
                }
                return word.join('');
            }).join(next() < 0.5 ? '-' : ' ');
            const found = fast.find(input);
            hits += found.length;
            assert.deepEqual(found, reference.find(input), JSON.stringify(input));
            assert.equal(fast.censor(input), reference.censor(input), JSON.stringify(input));
        }
        const sample = 'x-goblok k.o.n.t.o.l zzz anjinnng goooblok-aa '.repeat(4);
        const steps = checker => minimum(value => checker(value), item => item.find(sample));
        const limited = (policy, value) => new Badwords({ mode, dictionary, evasion: policy, fuzzy: boundedFuzzy({ minLength: 3, limits: { maxSteps: value } }) });
        assert.ok(steps(value => limited(policy, value)) < steps(value => limited(exhaustive(policy), value)));
    }
    assert.ok(hits > 500, `only ${hits} occurrences compared`);
});

test('an insertion edit does not absorb a separator-delimited neighbour', () => {
    const checker = new Badwords({ dictionary: ['goblok'], fuzzy: boundedFuzzy(), evasion: dashes() });
    assert.equal(checker.censor('x-goblok'), 'x-***');
    assert.equal(checker.censor('goblok-x'), '***-x');
    assert.equal(checker.censor('x-goblok-x'), 'x-***-x');
    assert.deepEqual(checker.find('g-o-b-l-o-k-s').map(item => item.match), ['g-o-b-l-o', 'g-o-b-l-o-k', 'o-b-l-o-k']);
    // Separators between key letters and ordinary edits still compose.
    assert.equal(checker.censor('g-o-b-l-o-x'), '***');
    assert.equal(checker.censor('go-bllok'), '***');
    assert.equal(checker.censor('xgoblok'), '***');
});

test('policies not created by this package version are rejected at construction', () => {
    const run = { checkInput() {}, potential: () => true, scan() {}, censor: () => [] };
    const forge = (name, compiler) => Object.freeze({ [Symbol.for(`indonesian-badwords.${name}`)]: Object.freeze(compiler) });
    const dictionary = ['goblok'];
    const compile = () => run;
    for (const brand of ['evasion.v1', 'evasion.v2']) for (const version of [undefined, 1, 2]) {
        const forged = forge(brand, { version, checkDictionary() {}, compile });
        assert.throws(() => new Badwords({ dictionary, evasion: forged }), TypeError, `${brand}/${version}`);
    }
    for (const brand of ['fuzzy.v1', 'fuzzy.v2'])
        assert.throws(() => new Badwords({ dictionary, fuzzy: forge(brand, { version: 2, checkDictionary() {}, compile }) }), TypeError, brand);
    assert.throws(() => new Badwords({ dictionary, evasion: forge('evasion.v2', { version: 2, checkDictionary() {}, compile: (...args) => { args[3]({ maximum: 9, exceeded() {} }); return {}; } }) }), TypeError);
    assert.throws(() => new Badwords({ dictionary, evasion: {} }), TypeError);
    assert.throws(() => new Badwords({ dictionary, fuzzy: dashes() }), TypeError);
    assert.throws(() => new Badwords({ dictionary, evasion: boundedFuzzy() }), TypeError);
    assert.doesNotThrow(() => new Badwords({ dictionary, evasion: dashes(), fuzzy: boundedFuzzy() }));
});

test('detailed APIs can exhaust a budget that flag() does not', () => {
    const input = `goblok ${'abcd '.repeat(1_000)}`;
    for (const make of [
        () => fuzzyOf({ maxSteps: 3_000 }),
        () => combinedOf({ maxSteps: 3_000 }),
        () => new Badwords({ evasion: evasion({ maxSteps: 3_000 }) })
    ]) {
        const checker = make();
        assert.equal(checker.flag(input), true);
        for (const api of [...detailed, 'callback'])
            assert.throws(() => call(checker, api, input), error => error instanceof RangeError && error.limit === 'steps', api);
    }
    // Without an accepted early hit, flag() scans the same work as the detailed APIs.
    const checker = fuzzyOf({ maxSteps: 3_000 });
    assert.throws(() => checker.flag('abcd '.repeat(1_000)), FuzzyLimitError);
    assert.throws(() => checker.flag('x'.repeat(2_000_000)), error => error.limit === 'input');
});

test('maxStates and maxStateCells bound projection work deterministically', () => {
    const input = 'g-o-b-l-o-k g-o-b-l-o-k';
    const tight = new Badwords({ dictionary: ['goblok'], evasion: dashes(), fuzzy: boundedFuzzy({ limits: { maxStates: 2 } }) });
    assert.throws(() => tight.flag(input), error => error instanceof FuzzyLimitError && error.limit === 'states' && error.maximum === 2 && error.used === 3);
    const wide = (limits, text) => new Badwords({ dictionary: ['goblok'], evasion: dashes({ limits: { maxStates: 1_000 } }), fuzzy: boundedFuzzy({ limits }) }).find(text);
    const cells = minimum(value => ({ maxStateCells: value }), limits => wide(limits, input));
    assert.throws(() => wide({ maxStateCells: cells - 1 }, input), error => error instanceof FuzzyLimitError && error.limit === 'stateCells' && error.maximum === cells - 1);
    assert.equal(wide({ maxStateCells: cells }, input).length, 6);
    // A workspace larger than the budget is rejected before any input is seen.
    assert.throws(() => new Badwords({ dictionary: ['goblok'], fuzzy: boundedFuzzy({ maxEdits: 2, limits: { maxStateCells: 10 } }) }),
        error => error.limit === 'stateCells');
    // The number of unique states bounds a long run too.
    const run = new Badwords({ dictionary: ['goblok'], evasion: dashes(), fuzzy: boundedFuzzy({ limits: { maxStates: 1 } }) });
    assert.doesNotThrow(() => run.find('x'.repeat(5_000)));
});

test('leetspeak folding does not cross inserted separators', () => {
    const checker = new Badwords({ dictionary: ['goblok'], evasion: dashes() });
    assert.equal(checker.flag('g0blok'), true);
    assert.equal(checker.flag('g-o-b-l-o-k'), true);
    assert.equal(checker.flag('g0-blok'), true);
    assert.equal(checker.flag('g-0-b-l-0-k'), false);
});
