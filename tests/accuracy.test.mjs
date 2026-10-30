import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { Badwords, dictionary, expandedDictionary } from '../dist/esm/index.js';
import { evaluate } from '../dist/esm/evaluate.js';
import { bare } from './bare.mjs';

const corpus = JSON.parse(readFileSync(new URL('./fixtures/accuracy-corpus.json', import.meta.url), 'utf8'));

function replaceAnnotatedSpans(text, matches, replacement) {
    let output = '';
    let cursor = 0;
    for (const { index, end } of matches) {
        output += text.slice(cursor, index) + replacement;
        cursor = end;
    }
    return output + text.slice(cursor);
}

describe('handcrafted Bahasa Indonesia regression corpus', () => {
    test('has unique case IDs and valid source spans', () => {
        assert.equal(corpus.schemaVersion, 1);

        const ids = new Set();
        for (const fixture of corpus.cases) {
            assert.ok(!ids.has(fixture.id), `duplicate case ID: ${fixture.id}`);
            ids.add(fixture.id);
            assert.equal(typeof fixture.category, 'string', fixture.id);
            assert.ok(fixture.category.length > 0, fixture.id);
            let previousEnd = 0;
            for (const match of fixture.expected.matches) {
                assert.ok(Number.isInteger(match.index) && Number.isInteger(match.end), fixture.id);
                assert.ok(match.index >= previousEnd && match.end > match.index, fixture.id);
                assert.equal(fixture.text.slice(match.index, match.end), match.raw, fixture.id);
                previousEnd = match.end;
            }
            assert.equal(
                replaceAnnotatedSpans(fixture.text, fixture.expected.matches, '***'),
                fixture.expected.censored,
                `censorship annotation disagrees with source spans: ${fixture.id}`
            );
        }
    });

    for (const fixture of corpus.cases) {
        test(`${fixture.id} [${fixture.category}]`, () => {
            const detector = new Badwords({
                ...(fixture.dictionary === 'expanded' ? { dictionary: expandedDictionary } : {}),
                ...(fixture.mode ? { mode: fixture.mode } : {}),
                ...(fixture.normalization ? { normalization: fixture.normalization } : {}),
                ...(fixture.ignoreRepeatedLetters ? { ignoreRepeatedLetters: true } : {})
            });
            const { text, expected } = fixture;
            const expectedWords = [...new Set(expected.matches.map(({ word }) => word))].sort();
            const expectedLocations = expected.matches.map(({ word, index, end, raw }) => ({
                word, index, end, match: raw
            }));
            const analysis = detector.analyze(text);

            assert.equal(detector.flag(text), expected.matches.length > 0);
            assert.deepEqual(bare(detector.find(text)), expectedLocations);
            assert.deepEqual(detector.badwords(text).sort(), expectedWords);
            assert.equal(detector.censor(text), expected.censored);
            assert.equal(
                detector.filter(text),
                replaceAnnotatedSpans(text, expected.matches, '').replace(/\s+/gu, ' ').trim()
            );
            assert.equal(analysis.text, text);
            assert.equal(analysis.censored, expected.censored);
            assert.equal(analysis.count, expectedWords.length);
            assert.equal(analysis.occurrenceCount, expected.matches.length);
            assert.deepEqual([...analysis.badwords].sort(), expectedWords);
            assert.deepEqual(bare(analysis.locations), expectedLocations);
        });
    }

    test('scores every fixture through evaluate() as exact spans and words', () => {
        const groups = new Map();
        for (const fixture of corpus.cases) {
            const key = JSON.stringify([fixture.dictionary ?? null, fixture.mode ?? null, fixture.normalization ?? null, fixture.ignoreRepeatedLetters ?? false]);
            groups.set(key, [...(groups.get(key) ?? []), fixture]);
        }
        let total = 0;
        let flagged = 0;
        for (const fixtures of groups.values()) {
            const [{ dictionary: preset, mode, normalization, ignoreRepeatedLetters }] = fixtures;
            const detector = new Badwords({
                ...(preset === 'expanded' ? { dictionary: expandedDictionary } : {}),
                ...(mode ? { mode } : {}),
                ...(normalization ? { normalization } : {}),
                ...(ignoreRepeatedLetters ? { ignoreRepeatedLetters: true } : {})
            });
            for (const expectation of ['spans', 'words']) {
                const result = evaluate(detector, fixtures.map(({ id, text, expected }) => ({
                    id, text,
                    expected: expectation === 'spans'
                        ? expected.matches.map(({ index, end }) => ({ index, end }))
                        : [...new Set(expected.matches.map(({ word }) => word))]
                })));
                assert.deepEqual(result.failures, [], `${expectation} failures`);
                assert.equal(result.correct, fixtures.length);
                if (expectation === 'spans') {
                    total += result.total;
                    flagged += result.counts.tp;
                    assert.equal(result.counts.fp + result.counts.fn, 0);
                    assert.equal(result.counts.tn, fixtures.filter(({ expected }) => expected.matches.length === 0).length);
                }
            }
        }
        assert.equal(total, corpus.cases.length);
        assert.equal(flagged, corpus.cases.filter(({ expected }) => expected.matches.length > 0).length);
    });

    test('preserves terminal punctuation for every literal bundled term', () => {
        const detector = new Badwords();
        for (const word of dictionary) {
            for (const delimiter of ['!', '?', '.', ',', ';', ':']) {
                assert.equal(detector.censor(`😀 ${word}${delimiter}`), `😀 ***${delimiter}`, `${word}${delimiter}`);
                assert.deepEqual(
                    detector.analyze(`😀 ${word}${delimiter}`).locations.map(({ word, index }) => ({ word, index })),
                    [{ word, index: 3 }],
                    `${word}${delimiter}`
                );
            }
        }
    });
});
