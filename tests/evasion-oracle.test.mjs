import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Badwords } from '../dist/esm/index.js';
import { boundedEvasion } from '../dist/esm/evasion.js';

// Deliberately independent per-word recursion, without the production trie,
// state hash, prefilter, source mapper, or output aggregation.
function reference(text, dictionary, config, whole) {
    const input = []; let offset = 0;
    for (const character of text) { input.push({ character, from: offset }); offset += character.length; }
    const boundaries = new Set([0, text.length]);
    for (const segment of new Intl.Segmenter('id', { granularity: 'grapheme' }).segment(text)) boundaries.add(segment.index);
    const isWord = index => input[index] && /[\p{L}\p{N}\p{M}]/u.test(input[index].character);
    const found = new Map();
    for (const word of dictionary) {
        const letters = [...word], advanced = /^[a-z]+$/i.test(word) && word.length >= config.minLength;
        for (let start = 0; start < input.length; start++) {
            if (!boundaries.has(input[start].from) || (whole && isWord(start - 1))) continue;
            const seen = new Set();
            function consume(pos, at, gapRun, gaps, repeatRun, repeats, mapped, hasAscii, gapLast) {
                const key = [pos, at, gapRun, gaps, repeatRun, repeats, mapped, +hasAscii, +gapLast].join(',');
                if (seen.has(key)) return; seen.add(key);
                if (at === letters.length && !gapLast && pos > start) {
                    const end = input[pos]?.from ?? text.length;
                    if (boundaries.has(end) && (!whole || !isWord(pos)) && (!mapped || hasAscii)) {
                        const hit = { word, index: input[start].from, end, match: text.slice(input[start].from, end) };
                        found.set(`${word}:${hit.index}:${end}`, hit);
                    }
                }
                if (pos === input.length) return;
                const character = input[pos].character;
                const literalAscii = /^[a-z]$/i.test(character);
                if (character === letters[at]) consume(pos + 1, at + 1, 0, gaps, 0, repeats, mapped, hasAscii || literalAscii, false);
                if (!advanced) return;
                if (at && character === letters[at - 1] && repeatRun < config.extra && repeats < config.repeats)
                    consume(pos + 1, at, 0, gaps, repeatRun + 1, repeats + 1, mapped, hasAscii || literalAscii, false);
                const target = new Map([['а', 'a'], ['с', 'c']]).get(character);
                if (target && mapped < config.mapped) {
                    if (target === letters[at]) consume(pos + 1, at + 1, 0, gaps, 0, repeats, mapped + 1, hasAscii, false);
                    if (at && target === letters[at - 1] && repeatRun < config.extra && repeats < config.repeats)
                        consume(pos + 1, at, 0, gaps, repeatRun + 1, repeats + 1, mapped + 1, hasAscii, false);
                }
                if (at && ['_', '-'].includes(character) && gapRun < config.gap && gaps < config.gaps)
                    consume(pos + 1, at, gapRun + 1, gaps + 1, repeatRun, repeats, mapped, hasAscii, true);
            }
            consume(start, 0, 0, 0, 0, 0, 0, false, false);
        }
    }
    return [...found.values()].sort((a, b) => a.index - b.index || dictionary.indexOf(a.word) - dictionary.indexOf(b.word) || a.end - b.end);
}
function censor(text, locations) {
    const union = [];
    for (const hit of locations) {
        if (union.length && hit.index < union.at(-1).end) union.at(-1).end = Math.max(union.at(-1).end, hit.end);
        else union.push({ index: hit.index, end: hit.end });
    }
    let value = '', from = 0;
    for (const hit of union) { value += text.slice(from, hit.index) + '*'; from = hit.end; }
    return value + text.slice(from);
}

test('bounded trie traversal, trigger rejection and every sink agree with an independent occurrence oracle', () => {
    let seed = 0x204bad;
    const random = n => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) % n; };
    const alphabet = ['a', 'b', 'c', '_', '-', ' ', 'а', 'с', '🙂', '\u0301'];
    for (let trial = 0; trial < 1200; trial++) {
        const config = { minLength: 1 + random(4), extra: 1 + random(2), repeats: 2 + random(4),
            gap: 1 + random(2), gaps: 2 + random(4), mapped: 1 + random(3) };
        const dictionary = [];
        for (let count = 1 + random(5); count; count--) {
            let word = ''; for (let length = 1 + random(5); length; length--) word += 'abc'[random(3)];
            if (!dictionary.includes(word)) dictionary.push(word);
        }
        let text = ''; for (let length = random(17); length; length--) text += alphabet[random(alphabet.length)];
        if (trial % 3 === 0) text = dictionary[0].split('').map(letter => letter.repeat(1 + random(2))).join('_');
        const mode = random(2) ? 'word' : 'substring';
        const evasion = boundedEvasion({ minLength: config.minLength,
            separators: { characters: ['_', '-'], maxGap: config.gap, maxTotal: config.gaps },
            repetitions: { maxExtraPerLetter: config.extra, maxTotal: config.repeats },
            confusables: { mappings: [['а', 'a'], ['с', 'c']], maxTotal: config.mapped } });
        const checker = new Badwords({ dictionary, normalization: 'none', mode, evasion });
        const expected = reference(text, dictionary, config, mode === 'word');
        const context = JSON.stringify({ text, dictionary, config, mode });
        assert.deepEqual(checker.find(text), expected, context);
        assert.equal(checker.flag(text), Boolean(expected.length), context);
        assert.deepEqual(checker.badwords(text), dictionary.filter(word => expected.some(hit => hit.word === word)), context);
        assert.deepEqual(checker.analyze(text).locations, expected, context);
        assert.equal(checker.censor(text, '*'), censor(text, expected), context);
        const callbackCalls = [];
        assert.equal(checker.censor(text, value => { callbackCalls.push(value); return '*'; }), censor(text, expected), context);
        for (const span of callbackCalls) assert.deepEqual(span.words,
            dictionary.filter(word => expected.some(hit => hit.word === word && hit.index < span.end && hit.end > span.index)), context);
    }
});
