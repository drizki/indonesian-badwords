const { test } = require('node:test');
const assert = require('node:assert/strict');

const badwords = require('../dist/cjs/index.js');

test('CommonJS require keeps the familiar method API', () => {
    assert.equal(typeof badwords.flag, 'function');
    assert.equal(badwords.flag('dasar goblok'), true);
    assert.equal(badwords.censor('dasar goblok'), 'dasar ***');
    assert.deepEqual(badwords.badwords('lorem goblok goblok'), ['goblok']);
});

test('CommonJS build also exposes the default export and class', () => {
    assert.equal(typeof badwords.default.flag, 'function');
    assert.equal(badwords.default.flag('dasar goblok'), true);
    assert.equal(typeof badwords.Badwords, 'function');
    assert.equal(badwords.Badwords.name, 'Badwords');
    assert.deepEqual(new badwords.Badwords().find('goblok GOBLOK g0bl0k').map(({ via }) => via), [
        { kind: 'exact' }, { kind: 'normalized' }, { kind: 'leetspeak', folds: 2 }]);
    const { boundedEvasion } = require('../dist/cjs/evasion.js');
    const { boundedFuzzy } = require('../dist/cjs/fuzzy.js');
    const layered = new badwords.Badwords({ dictionary: ['goblok'],
        evasion: boundedEvasion({ separators: { characters: ['.'], maxGap: 1, maxTotal: 8 } }), fuzzy: boundedFuzzy() });
    const hits = layered.find('g.o.b.l.o.k goblox');
    assert.deepEqual(hits.find(hit => hit.match === 'g.o.b.l.o.k').via,
        { kind: 'evasion', transforms: { separators: 5, repetitions: 0, confusables: 0 } });
    assert.deepEqual(hits.find(hit => hit.match === 'goblox').via, { kind: 'fuzzy', edits: 1, model: 'levenshtein' });
    let occurrences;
    layered.censor('g0bl0k', (context) => { occurrences = context.occurrences(); return '#'; });
    assert.deepEqual(occurrences.map(({ via }) => via.kind), ['leetspeak']);
    assert.equal(new badwords.Badwords({ dictionary: ['kucel'] }).flag('kucel'), true);
    assert.equal(new badwords.Badwords({ dictionary: ['asu'], mode: 'substring' }).censor('kamuasu'), 'kamu***');
});

test('CommonJS exposes presets, occurrence spans, and matching policies', () => {
    assert.deepEqual(badwords.find('😀 k0nt0l!'), [
        { word: 'kontol', index: 3, end: 9, match: 'k0nt0l', via: { kind: 'leetspeak', folds: 2 } }
    ]);
    const analysis = badwords.analyze('kontol kontol');
    assert.equal(analysis.count, 1);
    assert.equal(analysis.occurrenceCount, 2);
    assert.equal(analysis.locations.length, 2);
    for (const preset of [badwords.dictionary, badwords.contextualDictionary, badwords.expandedDictionary]) {
        assert.ok(Array.isArray(preset));
        assert.ok(Object.isFrozen(preset));
    }
    assert.equal(badwords.flag('anjing'), false);
    assert.equal(new badwords.Badwords({ dictionary: badwords.expandedDictionary }).flag('anjing'), true);
    assert.equal(new badwords.Badwords({ dictionary: ['goblok'], normalization: 'none' }).flag('GOBLOK'), false);
    assert.equal(new badwords.Badwords({ ignoreRepeatedLetters: true }).flag('gooooblok'), true);
});

test('ESM and CommonJS share class identity and mutable dictionary state', async () => {
    const esm = await import('../dist/esm/index.js');
    assert.equal(esm.Badwords, badwords.Badwords);
    assert.equal(esm.default, badwords.default);
    assert.equal(esm.flag, badwords.flag);
    assert.equal(esm.find, badwords.find);
    assert.equal(esm.dictionary, badwords.dictionary);
    assert.equal(esm.contextualDictionary, badwords.contextualDictionary);
    assert.equal(esm.expandedDictionary, badwords.expandedDictionary);
    assert.ok(new esm.Badwords() instanceof badwords.Badwords);
    assert.ok(new badwords.Badwords() instanceof esm.Badwords);

    const customWord = 'paketkontrol';
    assert.equal(esm.flag(customWord), false);
    try {
        esm.addWords(customWord);
        assert.equal(badwords.flag(customWord), true);
        badwords.removeWords(customWord);
        assert.equal(esm.flag(customWord), false);
        badwords.addWords(customWord);
        assert.equal(esm.flag(customWord), true);
    } finally {
        esm.removeWords(customWord);
    }
});
