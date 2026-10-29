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
    assert.deepEqual([result.score, result.level], [null, 'unrated']);
    assert.deepEqual([result.summary.classified, result.summary.unclassified, result.summary.unrated], [0, 1, 0]);
    const mixed = classify([at('zzcustom'), at(words[2], 9)]);
    assert.deepEqual([mixed.summary.classified, mixed.summary.unclassified, mixed.level], [1, 1, 'moderate']);
});

test('catalog words without a severity are classified but unrated', () => {
    const result = classify([at(unrated)]);
    assert.equal(result.occurrences[0].classified, true);
    assert.equal(result.occurrences[0].severity, null);
    assert.deepEqual([result.score, result.level, result.summary.unrated, result.summary.classified], [null, 'unrated', 1, 1]);
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
        [[at('zzcustom')], 'unrated', null],
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

test('score is a bounded integer, monotone, order independent, and inside its level band', () => {
    const bands = { mild: [15, 34], moderate: [35, 59], strong: [60, 79], extreme: [80, 100] };
    let seed = 0x2545f491;
    const next = () => {
        seed ^= seed << 13; seed >>>= 0;
        seed ^= seed >>> 17;
        seed ^= seed << 5; seed >>>= 0;
        return seed;
    };
    const pool = [...Object.values(words), unrated, 'zzcustom'];
    // null (unrated only) to a number counts as an increase; a number never goes back to null.
    const rank = score => score === null ? -1 : score;
    for (let run = 0; run < 200; run++) {
        const input = [];
        let previous = 0;
        let last;
        for (let step = 0; step < 60; step++) {
            input.push(at(pool[next() % pool.length], step * 10));
            const { score, level } = classify(input);
            if (score === null) assert.equal(level, 'unrated');
            else {
                assert.ok(Number.isInteger(score) && score >= 0 && score <= 100);
                assert.ok(score >= bands[level][0] && score <= bands[level][1], `${score} outside ${level}`);
            }
            assert.ok(step === 0 || rank(score) >= previous, `score fell from ${previous} to ${score}`);
            previous = rank(score);
            last = score;
        }
        const shuffled = [...input].sort(() => next() % 2 - 0.5);
        assert.equal(classify(shuffled).score, last);
    }
});

test('score bands do not overlap even with many matches', () => {
    const many = (word, count) => classify(Array.from({ length: count }, (_, i) => at(word, i * 10)));
    assert.equal(many(words[1], 100).score, 34);
    assert.equal(many(words[2], 100).score, 54);
    assert.equal(many(words[3], 100).score, 79);
    assert.equal(many(words[4], 100).score, 100);
});

test('unrated-only input has a null score that never reads as clean', () => {
    const result = classify(find('dasar gebleg'));
    assert.deepEqual([result.occurrences.length, result.score, result.level], [1, null, 'unrated']);
    assert.ok(result.summary.unrated + result.summary.unclassified > 0);
});

test('classification fields take precedence over same-named input fields', () => {
    const [hit] = classify([{ word: 'zzz', severity: 4, classified: true, categories: ['insult'] }]).occurrences;
    assert.deepEqual([hit.severity, hit.classified, hit.categories], [null, false, []]);
});

test('catalog words report their documented regions', () => {
    const [hit] = classify([at('araranjay')]).occurrences;
    assert.deepEqual(hit.regionIds, ['sundanese']);
    assert.equal(hit.severity, 1);
    assert.deepEqual(classify([at('kontol')]).occurrences[0].regionIds, []);
});

test('multiple variants merge to the highest severity and registry-ordered unions', () => {
    const { mergeVariants } = require('../dist/cjs/dictionary/merge.js');
    const variant = (id, senseId, over) => ({
        id, senseId, surface: 'x', categories: [], severity: null, attestation: 'attested',
        registerEvidence: 'attested', abusiveRegionIds: [], profiles: [], ...over,
    });
    const merged = mergeVariants([
        variant('v2', 's2', { severity: 2, categories: ['sexual-vulgarity', 'insult'], abusiveRegionIds: ['javanese'], profiles: ['reviewed-contextual'] }),
        variant('v1', 's1', { severity: 4, categories: ['insult', 'identity-slur'], abusiveRegionIds: ['indonesian', 'javanese'], profiles: ['reviewed-core'] }),
        variant('v1', 's1', { severity: null, categories: ['blasphemy'] }),
    ]);
    assert.deepEqual(merged, {
        classified: true,
        variantIds: ['v2', 'v1'],
        senseIds: ['s2', 's1'],
        categories: ['insult', 'sexual-vulgarity', 'identity-slur', 'blasphemy'],
        severity: 4,
        regionIds: ['indonesian', 'javanese'],
        profiles: ['reviewed-core', 'reviewed-contextual'],
    });
    assert.equal(mergeVariants([variant('a', 'b', {})]).severity, null);
    assert.deepEqual(mergeVariants([]).variantIds, []);
    assert.equal(mergeVariants([]).classified, false);
});

test('sparse arrays are rejected instead of producing phantom occurrences', () => {
    assert.throws(() => classify([,]), TypeError);
    assert.throws(() => classify(new Array(3)), TypeError);
    assert.throws(() => classify([at(words[1]), , at(words[2])]), TypeError);
    assert.throws(() => classify({ locations: new Array(1) }), TypeError);
});

test('results are deterministic, frozen, and reject invalid input', () => {
    const input = find('goblok kontol');
    assert.deepEqual(classify(input), classify(input));
    const result = classify(input);
    assert.ok(Object.isFrozen(result) && Object.isFrozen(result.occurrences) && Object.isFrozen(result.summary));
    assert.ok(Object.isFrozen(result.summary.categories) && Object.isFrozen(result.summary.bySeverity) && Object.isFrozen(result.summary.byCategory));
    assert.throws(() => result.summary.categories.push('insult'), TypeError);
    assert.ok(Object.isFrozen(result.occurrences[0]) && Object.isFrozen(result.occurrences[0].categories));
    for (const bad of [undefined, null, 'goblok', 3, {}, { locations: 'x' }, [null], [{ index: 0 }], [{ word: 1 }]]) {
        assert.throws(() => classify(bad), TypeError);
    }
});

test('classify works from CommonJS, including evasion and fuzzy matches', () => {
    const cjs = require('../dist/cjs/metadata.js');
    const root = require('../dist/cjs/index.js');
    const { boundedEvasion: evasion } = require('../dist/cjs/evasion.js');
    const { boundedFuzzy: fuzzy } = require('../dist/cjs/fuzzy.js');
    assert.deepEqual(cjs.classify(root.analyze('dasar goblok')), classify(analyze('dasar goblok')));
    const tolerant = new root.Badwords({
        evasion: evasion({ separators: { characters: ['-'], maxGap: 1, maxTotal: 8 } }),
        fuzzy: fuzzy({ model: 'osa', maxEdits: 1 }),
    });
    for (const spelling of ['g-o-b-l-o-k', 'goblox']) {
        const [hit] = cjs.classify(tolerant.find(`dasar ${spelling}`)).occurrences;
        assert.equal(hit.match, spelling);
        assert.equal(hit.classified, true);
    }
});
