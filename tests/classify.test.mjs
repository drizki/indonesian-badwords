import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { Badwords, find, analyze } from '../dist/esm/index.js';
import { classify, metadata, categoryIds } from '../dist/esm/metadata.js';
import { boundedEvasion } from '../dist/esm/evasion.js';
import { boundedFuzzy } from '../dist/esm/fuzzy.js';

const require = createRequire(import.meta.url);
const bySeverity = severity => metadata.find(entry => entry.severity === severity).surface;
const words = { 1: bySeverity(1), 2: bySeverity(2), 3: bySeverity(3), 4: bySeverity(4) };
const unrated = metadata.find(entry => entry.severity === null).surface;
const at = (word, index = 0) => ({ word, index, end: index + word.length, match: word });

test('classifies find() locations with catalog metadata', () => {
    const result = classify(find('dasar k0nt0l'));
    assert.equal(result.occurrences.length, 1);
    const [hit] = result.occurrences;
    assert.deepEqual([hit.word, hit.index, hit.end, hit.match], ['kontol', 6, 12, 'k0nt0l']);
    assert.equal(hit.classified, true);
    assert.deepEqual(hit.variantIds, ['ibwv-0087']);
    assert.deepEqual(hit.senseIds, ['ibw-0027']);
    assert.deepEqual(hit.categories, ['insult', 'sexual-vulgarity']);
    assert.equal(hit.severity, 3);
    assert.deepEqual(hit.profiles, ['reviewed-core']);
    assert.ok(Array.isArray(hit.regionIds));
    assert.deepEqual([result.score, result.level, result.summary.maxSeverity], [60, 'strong', 3]);
});

test('analyze() and find() inputs give the same result', () => {
    const text = 'goblok kontol, dasar g0bl0k';
    const checker = new Badwords();
    assert.deepEqual(classify(checker.analyze(text)), classify(checker.find(text)));
    assert.deepEqual(classify(analyze(text)), classify(find(text)));
    assert.equal(classify(analyze(text)).occurrences.length, 3);
});

test('empty input is level none with zero counts', () => {
    for (const input of [[], find('halo dunia'), analyze('halo dunia')]) {
        const result = classify(input);
        assert.deepEqual(result.occurrences, []);
        assert.deepEqual([result.score, result.level, result.summary.maxSeverity], [0, 'none', null]);
        assert.deepEqual(result.summary.categories, []);
        assert.deepEqual(result.summary.bySeverity, { 1: 0, 2: 0, 3: 0, 4: 0 });
        assert.deepEqual([result.summary.classified, result.summary.unclassified, result.summary.unrated], [0, 0, 0]);
        for (const id of categoryIds) assert.equal(result.summary.byCategory[id], 0);
    }
});

test('custom words are unclassified and never guessed', () => {
    const checker = new Badwords({ dictionary: ['zzcustom'] });
    const result = classify(checker.analyze('hai zzcustom'));
    const [hit] = result.occurrences;
    assert.deepEqual(
        [hit.classified, hit.variantIds, hit.senseIds, hit.categories, hit.severity, hit.regionIds, hit.profiles],
        [false, [], [], [], null, [], []],
    );
    assert.deepEqual([result.score, result.level], [0, 'unrated']);
    assert.deepEqual([result.summary.classified, result.summary.unclassified, result.summary.unrated], [0, 1, 0]);
    const mixed = classify([at('zzcustom'), at(words[2], 9)]);
    assert.deepEqual([mixed.summary.classified, mixed.summary.unclassified, mixed.level], [1, 1, 'moderate']);
});

test('catalog words without a severity are classified but unrated', () => {
    const result = classify([at(unrated)]);
    assert.equal(result.occurrences[0].classified, true);
    assert.equal(result.occurrences[0].severity, null);
    assert.deepEqual([result.score, result.level, result.summary.unrated, result.summary.classified], [0, 'unrated', 1, 1]);
    const withRated = classify([at(unrated), at(words[1], 9)]);
    assert.deepEqual([withRated.level, withRated.summary.unrated, withRated.summary.bySeverity[1]], ['mild', 1, 1]);
});

test('overlapping matches from different dictionary words are separate occurrences', () => {
    const checker = new Badwords({ dictionary: ['goblok', 'blok', 'kontol', 'zzcustom'], mode: 'substring' });
    const locations = checker.find('goblok');
    assert.ok(locations.length >= 2);
    const overlapping = locations.some((a, i) => locations.some((b, j) => i !== j && a.index < b.end && b.index < a.end));
    assert.ok(overlapping);
    const result = classify(locations);
    assert.equal(result.occurrences.length, locations.length);
    assert.deepEqual(result.occurrences.map(hit => [hit.word, hit.index, hit.end]), locations.map(hit => [hit.word, hit.index, hit.end]));
    const known = result.occurrences.filter(hit => hit.classified).length;
    assert.deepEqual([result.summary.classified, result.summary.unclassified], [known, locations.length - known]);
});

test('a word with several variants takes the highest severity and the union of metadata', () => {
    // The catalog has one variant per spelling today; exercise the union through repeated spellings.
    const result = classify([at(words[2]), at(words[2], 20), at(words[4], 40)]);
    assert.deepEqual(result.summary.bySeverity, { 1: 0, 2: 2, 3: 0, 4: 1 });
    assert.equal(result.summary.maxSeverity, 4);
    const expected = new Set(metadata.filter(entry => [words[2], words[4]].includes(entry.surface)).flatMap(entry => entry.categories));
    assert.deepEqual(result.summary.categories, categoryIds.filter(id => expected.has(id)));
    for (const id of categoryIds) {
        const count = result.occurrences.filter(hit => hit.categories.includes(id)).length;
        assert.equal(result.summary.byCategory[id], count);
    }
});

test('evasion and fuzzy matches classify through the matched dictionary word', () => {
    const tolerant = new Badwords({
        evasion: boundedEvasion({ separators: { characters: ['-'], maxGap: 1, maxTotal: 8 } }),
        fuzzy: boundedFuzzy({ model: 'osa', maxEdits: 1 }),
    });
    for (const spelling of ['g-o-b-l-o-k', 'goblox', 'golbok']) {
        const [hit] = classify(tolerant.find(`dasar ${spelling}`)).occurrences;
        const [entry] = metadata.filter(item => item.surface === hit.word);
        assert.equal(hit.match, spelling);
        assert.equal(hit.classified, true);
        assert.equal(hit.severity, entry.severity);
        assert.deepEqual(hit.variantIds, [entry.id]);
    }
});

test('scoped exceptions remove occurrences before classification', () => {
    const scoped = new Badwords({ allowPhrases: ['Baju Bodo'] });
    const result = classify(scoped.analyze('Baju Bodo goblok'));
    assert.deepEqual(result.occurrences.map(hit => hit.word), ['goblok']);
});

test('location fields pass through unchanged, including unknown ones', () => {
    const extra = { word: words[3], index: 4, end: 10, match: 'x', segment: 7, nested: { a: [1] }, classified: undefined };
    const { occurrences } = classify([{ ...extra }]);
    assert.equal(occurrences[0].segment, 7);
    assert.equal(occurrences[0].nested.a[0], 1);
    assert.equal(occurrences[0].index, 4);
    assert.equal(occurrences[0].match, 'x');
    assert.equal(occurrences[0].classified, true);
    const input = [{ word: 'zzcustom', index: 0, end: 8, match: 'zzcustom', tag: 'kept' }];
    const before = JSON.stringify(input);
    assert.equal(classify({ locations: input }).occurrences[0].tag, 'kept');
    assert.equal(JSON.stringify(input), before);
});

test('every level is reachable with its documented score', () => {
    const cases = [
        [[], 'none', 0],
        [[at('zzcustom')], 'unrated', 0],
        [[at(words[1])], 'mild', 15],
        [[at(words[2])], 'moderate', 35],
        [[at(words[3])], 'strong', 60],
        [[at(words[4])], 'extreme', 80],
    ];
    for (const [input, level, score] of cases) {
        const result = classify(input);
        assert.deepEqual([result.level, result.score], [level, score]);
    }
    const many = classify(Array.from({ length: 50 }, (_, i) => at(words[4], i * 10)));
    assert.deepEqual([many.score, many.level], [100, 'extreme']);
    assert.equal(classify([at(words[1]), at(words[1], 9), at(words[1], 18)]).score, 17);
});

test('score is a bounded integer and never drops when an occurrence is added', () => {
    let seed = 0x2545f491;
    const next = () => {
        seed ^= seed << 13; seed >>>= 0;
        seed ^= seed >>> 17;
        seed ^= seed << 5; seed >>>= 0;
        return seed;
    };
    const pool = [...Object.values(words), unrated, 'zzcustom'];
    for (let run = 0; run < 200; run++) {
        const input = [];
        let previous = 0;
        for (let step = 0; step < 40; step++) {
            input.push(at(pool[next() % pool.length], step * 10));
            const { score } = classify(input);
            assert.ok(Number.isInteger(score) && score >= 0 && score <= 100);
            assert.ok(score >= previous, `score fell from ${previous} to ${score}`);
            previous = score;
        }
        const shuffled = [...input].sort(() => next() % 2 - 0.5);
        assert.equal(classify(shuffled).score, previous);
    }
});

test('results are deterministic, frozen, and reject invalid input', () => {
    const input = find('goblok kontol');
    assert.deepEqual(classify(input), classify(input));
    const result = classify(input);
    assert.ok(Object.isFrozen(result) && Object.isFrozen(result.occurrences) && Object.isFrozen(result.summary));
    assert.ok(Object.isFrozen(result.occurrences[0]) && Object.isFrozen(result.occurrences[0].categories));
    for (const bad of [undefined, null, 'goblok', 3, {}, { locations: 'x' }, [null], [{ index: 0 }], [{ word: 1 }]]) {
        assert.throws(() => classify(bad), TypeError);
    }
});

test('classify works from CommonJS', () => {
    const cjs = require('../dist/cjs/metadata.js');
    const root = require('../dist/cjs/index.js');
    assert.deepEqual(cjs.classify(root.analyze('dasar goblok')), classify(analyze('dasar goblok')));
});
