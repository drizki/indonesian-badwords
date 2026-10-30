import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

// Differential test for the flag() pattern path and the bang fast paths. tests/fixtures/flag-golden.json holds a
// short digest of every API's result for seeded random inputs, produced by the 2.6.0 engine, which still tokenized
// flag() and ran the full bang analysis. To regenerate it from a baseline build:
//   BADWORDS_BASELINE=<dir containing dist/esm> BADWORDS_WRITE_GOLDEN=1 node tests/flag-pattern-differential.test.mjs
const base = process.env.BADWORDS_BASELINE ? pathToFileURL(`${process.env.BADWORDS_BASELINE}/dist/esm/`).href : new URL('../dist/esm/', import.meta.url).href;
const { Badwords, expandedDictionary } = await import(`${base}index.js`);
const { boundedEvasion, latinLookalikes } = await import(`${base}evasion.js`);
const { boundedFuzzy } = await import(`${base}fuzzy.js`);
const golden = new URL('./fixtures/flag-golden.json', import.meta.url);
const writing = process.env.BADWORDS_WRITE_GOLDEN === '1';

function random(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const evasion = () => boundedEvasion({ minLength: 3, separators: { characters: [' ', '.', '_', '-'], maxGap: 1, maxTotal: 8 },
    repetitions: { maxExtraPerLetter: 2, maxTotal: 8 }, confusables: { mappings: latinLookalikes, maxTotal: 2 } });
const custom = ['goblok', 'bangsat', 'kontol', 'anjing', 'asu', 'babi hutan', 'cebong', 'ngentot', 'idiot', 'bodoh'];
const configs = {
    default: {}, expanded: { dictionary: [...expandedDictionary] },
    substring: { dictionary: custom, mode: 'substring' }, repeated: { dictionary: custom, ignoreRepeatedLetters: true },
    none: { dictionary: custom, normalization: 'none' }, standard: { dictionary: custom, normalization: 'standard' },
    allowed: { dictionary: custom, allowPhrases: ['anjing laut', 'asu kaya'] },
    evasion: { dictionary: custom, evasion: evasion() },
    fuzzy: { dictionary: custom, fuzzy: boundedFuzzy({ maxEdits: 1, model: 'osa' }) },
    combined: { dictionary: custom, evasion: evasion(), fuzzy: boundedFuzzy() },
    limited: { dictionary: custom, maxMatches: 3 },
    unicodeWord: { dictionary: [...custom, 'ｇｏｂｌｏｋ', 'cebongé'] }
};
const words = [...new Badwords().dict.slice(0, 40), ...custom];
const fragments = ['gob', 'lok', 'kont', 'ol', 'anj', 'ing', 'b!', '!ot', 'g0', 'k!ntol', 'id!ot', 'p!', 'bod0h', 'asu', 'ngen', 'tot'];
const atoms = ['!', '!', '!!', 'a', 'i', 'g', 'o', 'b', 'l', 'k', 'n', 't', 's', 'e', '0', '1', '3', '4', '5', '7', '@', '$', '|', '(', '_',
    ' ', ' ', ' ', '-', '.', ',', '\n', "'", 'é', 'ｇ', 'о', '😀', '​', 'İ', 'ǆ', '？', '！'];
function build(next) {
    const pick = (list) => list[Math.floor(next() * list.length)];
    let value = '';
    for (let count = 1 + Math.floor(next() * 14); count > 0; count--) {
        const roll = next();
        if (roll < 0.28) value += pick(words);
        else if (roll < 0.5) value += pick(fragments);
        else if (roll < 0.58) value += pick(['a!', '!a', 'ab!', 'x!y ', 'g-o-', '! ']).repeat(1 + Math.floor(next() * 60));
        else value += pick(atoms).repeat(1 + Math.floor(next() * 3));
        if (next() < 0.5) value += pick([' ', '', '!', '-', ' ', '.']);
    }
    return value;
}
const digest = (value) => createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 10);
const run = (operation) => { try { return operation(); } catch (error) { return `${error.name}`; } };
function observe(checker, input, range) {
    const calls = range ? { ignoreRanges: [range] } : undefined;
    return digest([
        run(() => checker.flag(input, calls)), run(() => checker.badwords(input, calls)), run(() => checker.censor(input, '*', calls)),
        run(() => checker.find(input, calls)), run(() => checker.analyze(input, calls)),
        run(() => checker.find(input, { ...calls, onMaxMatches: 'truncate' }))
    ]);
}
const total = 220;
function sample(name) {
    const next = random([...name].reduce((n, c) => Math.imul(n, 31) + c.charCodeAt(0) | 0, 37));
    return Array.from({ length: total }, (_, at) => {
        const input = build(next);
        const range = at % 5 === 0 && input.length > 4 ? { index: 1, end: Math.min(input.length, 4 + Math.floor(next() * 12)) } : undefined;
        return { input, range };
    });
}
const results = Object.fromEntries(Object.entries(configs).map(([name, options]) => {
    const checker = new Badwords(options);
    return [name, sample(name).map(({ input, range }) => observe(checker, input, range))];
}));

if (writing) {
    writeFileSync(golden, `${JSON.stringify(results)}\n`);
    console.log(`wrote ${Object.keys(results).length} configurations`);
} else {
    const expected = JSON.parse(readFileSync(golden, 'utf8'));
    for (const [name, options] of Object.entries(configs)) {
        const cases = sample(name);
        test(`results match the 2.6.0 engine: ${name}`, () => {
            const warmed = new Badwords(options);
            warmed.censor('warm up the compiled pattern');
            for (const [at, { input, range }] of cases.entries()) {
                assert.equal(results[name][at], expected[name][at], `${name} #${at} ${JSON.stringify(input)}`);
                assert.equal(observe(warmed, input, range), expected[name][at], `warmed ${name} #${at} ${JSON.stringify(input)}`);
                assert.equal(observe(new Badwords(options), input, range), expected[name][at], `fresh ${name} #${at} ${JSON.stringify(input)}`);
            }
        });
    }
}

test('flag, find, censor and analyze describe the same occurrences on bang-heavy input', () => {
    for (const [name, options] of Object.entries(configs)) {
        if (options.maxMatches) continue;
        const checker = new Badwords(options);
        for (const { input } of sample(name).slice(0, 120)) {
            const found = checker.find(input);
            assert.equal(checker.flag(input), found.length > 0, `${name} ${JSON.stringify(input)}`);
            assert.deepEqual(checker.analyze(input).locations, found, `${name} ${JSON.stringify(input)}`);
            assert.equal(checker.analyze(input).censored, checker.censor(input), `${name} ${JSON.stringify(input)}`);
            assert.deepEqual([...new Set(found.map((item) => item.word))].sort(), [...checker.badwords(input)].sort(), `${name} ${JSON.stringify(input)}`);
        }
    }
});

test('flag switches to the compiled pattern after enough work without changing a verdict', () => {
    for (const options of [{}, { dictionary: custom }, { dictionary: custom, normalization: 'none' }]) {
        const checker = new Badwords(options);
        const inputs = ['halo apa kabar', 'kamu goblok', 'g!oblok', 'a!'.repeat(900), 'k!ntol di sini', 'Goblok', 'bodoh_sekali', '!'.repeat(500), 'cebong, kontol!', 'ngentot'];
        const expected = inputs.map((input) => new Badwords(options).find(input).length > 0);
        const filler = 'terima kasih banyak atas bantuannya '.repeat(2_000);
        for (let round = 0; round < 6; round++) {
            assert.deepEqual(inputs.map((input) => checker.flag(input)), expected, JSON.stringify(options));
            assert.equal(checker.flag(filler), false);
        }
        checker.addWords('terima kasih');
        assert.equal(checker.flag(filler), true);
        checker.removeWords('terima kasih');
        assert.equal(checker.flag(filler), false);
    }
});

test('symbol runs and bang neighborhoods do not hide or invent matches', () => {
    const checker = new Badwords({ dictionary: custom });
    for (const [input, flagged] of [['!!!!!!!!', false], ['id!ot', true], ['idi!!ot', false], ['goblok!!!!', true], ['!!!goblok', true], ['a!!!!b id!ot', true],
        ['aaaa___goblok', true], ['__g0blok__', true], ['goblok!kontol', true], ['x!goblok', true], ['goblok!x', true], ['a!goblok!b', true], ['x@@@@y k0ntol', true], ['bod!h', false], ['b0d0h', true]]) {
        assert.equal(checker.flag(input), flagged, input);
        assert.equal(checker.find(input).length > 0, flagged, input);
    }
});

test('substring mode folds a bang that joins runs away from any i neighborhood', () => {
    assert.equal(new Badwords({ mode: 'substring' }).censor('Hey!7417'), 'Hey!***7');
    const ize = new Badwords({ dictionary: ['ize'], mode: 'substring' });
    assert.equal(ize.flag('abc!123'), true);
    assert.deepEqual(ize.find('abc!123').map(({ word, index, end }) => [word, index, end]), [['ize', 4, 7]]);
    assert.equal(new Badwords({ dictionary: ['o'], mode: 'substring' }).flag(' !0!s'), true);
});
