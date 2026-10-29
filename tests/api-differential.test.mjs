import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Badwords, expandedDictionary } from '../dist/esm/index.js';
import { boundedEvasion, latinLookalikes } from '../dist/esm/evasion.js';
import { boundedFuzzy } from '../dist/esm/fuzzy.js';

// Seeded and deterministic: every public API must describe one set of occurrences.
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
const custom = ['goblok', 'bangsat', 'kontol', 'anjing', 'asu', 'babi hutan', 'cebong', 'ngentot'];
const configs = {
    default: { dictionary: undefined },
    expanded: { dictionary: [...expandedDictionary] },
    substring: { dictionary: custom, mode: 'substring' },
    repeated: { dictionary: custom, ignoreRepeatedLetters: true },
    none: { dictionary: custom, normalization: 'none' },
    phrases: { dictionary: custom },
    allowed: { dictionary: custom, allowPhrases: ['anjing laut', 'asu kaya'] },
    evasion: { dictionary: custom, evasion: evasion() },
    fuzzy: { dictionary: custom, fuzzy: boundedFuzzy({ maxEdits: 1, model: 'osa' }) },
    combined: { dictionary: custom, evasion: evasion(), fuzzy: boundedFuzzy() },
    combinedSubstring: { dictionary: custom, mode: 'substring', evasion: evasion(), fuzzy: boundedFuzzy({ model: 'osa' }) }
};
const pieces = [...custom, 'goblox', 'bangsaat', 'g-o-b-l-o-k', 'k.o.n.t.o.l', 'gооblok', 'g0blok', 'b4bi', 'anj1ng', 'a.s.u', 'GOBLOK',
    'anjing laut', 'asu kaya', 'babi  hutan', 'goooblok', 'x', 'ok', 'halo', 'selamat pagi', 'teman', 'kata-kata', '!', '?', '😀', 'é', 'ｇｏｂｌｏｋ', 'g​o​blok'];
const joiners = [' ', ' ', ' ', '', '-', '.', ', ', '\n', '_'];
function text(next) {
    let value = '';
    for (let i = 1 + Math.floor(next() * 7); i > 0; i--) {
        value += pieces[Math.floor(next() * pieces.length)] + joiners[Math.floor(next() * joiners.length)];
        if (next() < 0.1) value += 'xyz'[Math.floor(next() * 3)];
    }
    return value;
}
function merge(locations) {
    const spans = [];
    for (const { index, end } of [...locations].sort((a, b) => a.index - b.index || a.end - b.end)) {
        const last = spans[spans.length - 1];
        if (last && index < last.end) last.end = Math.max(last.end, end); else spans.push({ index, end });
    }
    return spans;
}

for (const [name, options] of Object.entries(configs)) test(`seeded differential: every API agrees (${name})`, () => {
    const checker = new Badwords(options);
    const order = new Map(checker.dict.map((word, at) => [word, at]));
    const next = random([...name].reduce((n, c) => Math.imul(n, 31) + c.charCodeAt(0) | 0, 2025));
    let hits = 0;
    for (let n = 0; n < 300; n++) {
        const input = text(next), label = `${name}: ${JSON.stringify(input)}`;
        const found = checker.find(input);
        hits += found.length;
        assert.equal(checker.flag(input), found.length > 0, label);
        for (const location of found) {
            assert.equal(location.match, input.slice(location.index, location.end), label);
            assert.ok(order.has(location.word), label);
        }
        assert.deepEqual(checker.badwords(input), [...new Set(found.map(item => item.word))].sort((a, b) => order.get(a) - order.get(b)), label);
        const spans = merge(found);
        let expected = '', at = 0;
        for (const span of spans) { expected += input.slice(at, span.index) + '***'; at = span.end; }
        expected += input.slice(at);
        assert.equal(checker.censor(input), expected, label);
        const contexts = [];
        assert.equal(checker.censor(input, context => { contexts.push(context); return '***'; }), expected, label);
        assert.deepEqual(contexts.map(({ index, end }) => ({ index, end })), spans, label);
        for (const context of contexts) {
            assert.equal(context.match, input.slice(context.index, context.end), label);
            assert.equal(context.text, input, label);
            const inside = found.filter(item => item.index >= context.index && item.end <= context.end).map(item => item.word);
            assert.deepEqual([...context.words], [...new Set(inside)].sort((a, b) => order.get(a) - order.get(b)), label);
        }
        const analysis = checker.analyze(input);
        assert.deepEqual(analysis.locations, found, label);
        assert.equal(analysis.censored, expected, label);
        assert.equal(analysis.occurrenceCount, found.length, label);
        assert.deepEqual(analysis.badwords, checker.badwords(input), label);
        assert.equal(analysis.count, analysis.badwords.length, label);
        assert.equal(analysis.text, input, label);
    }
    assert.ok(hits > 20, `${name} generated too few matches (${hits})`);
});
