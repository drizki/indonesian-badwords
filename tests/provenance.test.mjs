import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Badwords } from '../dist/esm/index.js';
import { boundedEvasion, latinLookalikes } from '../dist/esm/evasion.js';
import { boundedFuzzy } from '../dist/esm/fuzzy.js';

const evasion = () => boundedEvasion({ minLength: 3, separators: { characters: ['.', '-', ' '], maxGap: 1, maxTotal: 8 },
    repetitions: { maxExtraPerLetter: 2, maxTotal: 8 }, confusables: { mappings: latinLookalikes, maxTotal: 2 } });
const via = (checker, text, word = 'goblok') => {
    // Fuzzy and evasion also report shorter partial spans; take the one ending the text.
    const hits = checker.find(text).filter(hit => hit.word === word && hit.end === text.length).sort((a, b) => a.index - b.index);
    assert.ok(hits.length, text);
    return hits[0].via;
};
const transforms = (separators, repetitions, confusables) => ({ separators, repetitions, confusables });

test('exact, normalized and leetspeak are decided by comparing the source slice with the word', () => {
    // The preset takes the native regex path; a custom non-ASCII dictionary takes the automaton.
    for (const checker of [new Badwords(), new Badwords({ dictionary: ['goblok', 'café'] }), new Badwords({ mode: 'substring' })]) {
        assert.deepEqual(via(checker, 'dasar goblok'), { kind: 'exact' });
        assert.deepEqual(via(checker, 'dasar GOBLOK'), { kind: 'normalized' });
        assert.deepEqual(via(checker, 'dasar ＧＯＢＬＯＫ'), { kind: 'normalized' });
        assert.deepEqual(via(checker, 'dasar gob​lok'), { kind: 'normalized' });
        assert.deepEqual(via(checker, 'dasar g0bl0k'), { kind: 'leetspeak', folds: 2 });
        assert.deepEqual(via(checker, 'dasar G0blok'), { kind: 'leetspeak', folds: 1 });
        assert.deepEqual(via(checker, 'dasar ｇ０ｂｌｏｋ'), { kind: 'leetspeak', folds: 1 });
    }
    assert.deepEqual(via(new Badwords({ dictionary: ['café'] }), 'café', 'café'), { kind: 'normalized' });
    assert.deepEqual(via(new Badwords({ normalization: 'none' }), 'goblok'), { kind: 'exact' });
});

test('repeated-letter folding is reported as an evasion repetition count', () => {
    const checker = new Badwords({ ignoreRepeatedLetters: true });
    assert.deepEqual(via(checker, 'gooooblok'), { kind: 'evasion', transforms: transforms(0, 3, 0) });
    assert.deepEqual(via(checker, 'goblok'), { kind: 'exact' });
});

test('bounded evasion reports separator, repetition and confusable counts', () => {
    const checker = new Badwords({ evasion: evasion() });
    assert.deepEqual(via(checker, 'g.o.b.l.o.k'), { kind: 'evasion', transforms: transforms(5, 0, 0) });
    assert.deepEqual(via(checker, 'goooblok'), { kind: 'evasion', transforms: transforms(0, 2, 0) });
    assert.deepEqual(via(checker, 'gοblοk'), { kind: 'evasion', transforms: transforms(0, 0, 2) });
    assert.deepEqual(via(checker, 'g.ooblok'), { kind: 'evasion', transforms: transforms(1, 1, 0) });
    assert.deepEqual(via(checker, 'goblok'), { kind: 'exact' });
    assert.deepEqual(via(checker, 'GOBLOK'), { kind: 'normalized' });
    assert.deepEqual(via(checker, 'g0bl0k'), { kind: 'leetspeak', folds: 2 });
});

test('fuzzy reports edit count and model, and the most literal path wins for one word and span', () => {
    const dictionary = ['goblok'];
    const checker = new Badwords({ dictionary, fuzzy: boundedFuzzy({ maxEdits: 2 }) });
    assert.deepEqual(via(checker, 'goblox'), { kind: 'fuzzy', edits: 1, model: 'levenshtein' });
    assert.deepEqual(via(checker, 'gobxxk'), { kind: 'fuzzy', edits: 2, model: 'levenshtein' });
    assert.deepEqual(via(checker, 'goblo'), { kind: 'fuzzy', edits: 1, model: 'levenshtein' });
    // The exact path also reaches this span with zero edits, so the literal kind is reported.
    assert.deepEqual(via(checker, 'goblok'), { kind: 'exact' });
    assert.deepEqual(via(checker, 'GOBLOK'), { kind: 'normalized' });
    const osa = new Badwords({ dictionary, fuzzy: boundedFuzzy({ model: 'osa' }) });
    assert.deepEqual(via(osa, 'gobolk'), { kind: 'fuzzy', edits: 1, model: 'osa' });
    assert.equal(via(new Badwords({ dictionary, fuzzy: boundedFuzzy({ model: 'levenshtein', maxEdits: 2 }) }), 'gobolk').edits, 2);
});

test('fuzzy composed with evasion keeps both kinds of evidence', () => {
    const checker = new Badwords({ dictionary: ['goblok'], evasion: evasion(), fuzzy: boundedFuzzy() });
    assert.deepEqual(via(checker, 'g.o.b.l.o.k'), { kind: 'evasion', transforms: transforms(5, 0, 0) });
    assert.deepEqual(via(checker, 'g.o.b.l.o.x'), { kind: 'fuzzy', edits: 1, model: 'levenshtein', transforms: transforms(5, 0, 0) });
    assert.deepEqual(via(checker, 'goooblox'), { kind: 'fuzzy', edits: 1, model: 'levenshtein', transforms: transforms(0, 2, 0) });
    assert.deepEqual(via(checker, 'goblox'), { kind: 'fuzzy', edits: 1, model: 'levenshtein' });
});

test('a word reachable by several evasion paths reports the fewest transforms, deterministically', () => {
    // goblokk is a literal word and also goblok with one repeated k.
    const checker = new Badwords({ dictionary: ['goblokk'], evasion: evasion() });
    for (let round = 0; round < 3; round++) assert.deepEqual(via(checker, 'goblokk', 'goblokk'), { kind: 'exact' });
    assert.deepEqual(via(checker, 'goblokkk', 'goblokk'), { kind: 'evasion', transforms: transforms(0, 1, 0) });
    const both = new Badwords({ dictionary: ['goblok'], evasion: evasion(), fuzzy: boundedFuzzy() });
    assert.deepEqual(via(both, 'goblok'), { kind: 'exact' });
});

test('overlapping and multi-contributor spans keep one via per occurrence', () => {
    const checker = new Badwords({ dictionary: ['asu', 'asusila', 'sila'], mode: 'substring' });
    const hits = checker.find('ASUS1LA');
    assert.deepEqual(hits.map(({ word, via }) => [word, via.kind]), [['asu', 'normalized'], ['asusila', 'leetspeak'], ['sila', 'leetspeak']]);
    const contexts = [], inside = [];
    assert.equal(checker.censor('x ASUS1LA y asu', (context, detail) => {
        contexts.push(context); inside.push(detail.occurrences(context)); return '#';
    }), 'x # y #');
    assert.equal(contexts.length, 2);
    assert.deepEqual(inside[0].map(({ word }) => word), ['asu', 'asusila', 'sila']);
    assert.deepEqual(inside[0], checker.find('x ASUS1LA y asu').slice(0, 3));
    assert.deepEqual(inside[1].map(({ word, via }) => [word, via.kind]), [['asu', 'exact']]);
    assert.deepEqual([...contexts[0].words], ['asu', 'asusila', 'sila']);
});

test('censor detail is lazy, leaves the context unchanged and honours scoped exceptions and caps', () => {
    const checker = new Badwords({ allowPhrases: ['goblok banget'] });
    const seen = [];
    const text = 'goblok banget, goblok g0bl0k';
    const options = { ignoreRanges: [{ index: 22, end: 28 }] };
    checker.censor(text, (context, detail) => { seen.push([context, detail.occurrences(context)]); return '#'; }, options);
    assert.equal(seen.length, 1);
    const [context, occurrences] = seen[0];
    assert.deepEqual(Object.keys(context), ['text', 'index', 'end', 'match', 'words']);
    assert.ok(Object.isFrozen(context) && Object.isFrozen(occurrences));
    assert.deepEqual(occurrences, checker.find(text, options));
    assert.deepEqual(occurrences.map(({ index, via }) => [index, via.kind]), [[15, 'exact']]);
    assert.deepEqual(occurrences, [...checker.analyze(text, options).locations]);
    // A callback that never asks for detail never runs the detailed scan, so the cap cannot fire.
    const capped = new Badwords({ maxMatches: 1 });
    assert.equal(capped.censor('goblok kontol', () => '#'), '# #');
    assert.throws(() => capped.censor('goblok kontol', (context, detail) => detail.occurrences(context).length + ''), RangeError);
});

test('scoped exceptions and ignoreRanges remove occurrences without changing the rest', () => {
    const checker = new Badwords({ dictionary: ['anjing'], allowPhrases: ['anjing laut'], evasion: evasion() });
    const text = 'anjing laut, ANJING, a.n.j.i.n.g';
    const found = checker.find(text);
    assert.deepEqual(found.map(({ index, via }) => [index, via.kind]), [[13, 'normalized'], [21, 'evasion']]);
    const ignored = checker.find(text, { ignoreRanges: [{ index: 13, end: 19 }] });
    assert.deepEqual(ignored, found.slice(1));
    assert.deepEqual(checker.analyze(text, { ignoreRanges: [{ index: 13, end: 19 }] }).locations, ignored);
});

test('via is plain, serializable data and identical in find() and analyze()', () => {
    const checker = new Badwords({ dictionary: ['goblok'], evasion: evasion(), fuzzy: boundedFuzzy() });
    const text = 'goblok GOBLOK g0bl0k g.o.b.l.o.k goblox';
    const found = checker.find(text);
    const tokens = [[0, 6], [7, 13], [14, 20], [21, 32], [33, 39]];
    assert.deepEqual(tokens.map(([index, end]) => found.find(hit => hit.index === index && hit.end === end && hit.word === 'goblok').via.kind),
        ['exact', 'normalized', 'leetspeak', 'evasion', 'fuzzy']);
    assert.deepEqual(checker.analyze(text).locations, found);
    assert.deepEqual(JSON.parse(JSON.stringify(found)), found);
});

test('the review pattern: censor exact and leetspeak, queue fuzzy', () => {
    const checker = new Badwords({ dictionary: ['goblok'], fuzzy: boundedFuzzy() });
    const text = 'goblok g0bl0k goblox';
    const queue = [];
    const censored = checker.censor(text, (context, detail) => {
        const { match, index, end } = context;
        if (detail.occurrences(context).every(({ via }) => via.kind === 'fuzzy')) { queue.push({ match, index, end }); return match; }
        return '***';
    });
    assert.equal(censored, '*** *** goblox');
    assert.deepEqual(queue, [{ match: 'goblox', index: 14, end: 20 }]);
});
