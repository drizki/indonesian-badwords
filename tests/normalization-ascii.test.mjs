import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalize, normalizeKey } from '../dist/cjs/normalize.js';

test('ASCII exact normalization preserves every character, control byte and source offset', () => {
    const text = Array.from({ length: 128 }, (_, code) => String.fromCharCode(code)).join('');
    const result = normalize(text, 'none');
    assert.equal(result.text, text);
    assert.deepEqual(result.starts, Array.from({ length: 128 }, (_, index) => index));
    assert.deepEqual(result.ends, Array.from({ length: 128 }, (_, index) => index + 1));
    assert.deepEqual(result.wordCharacters, [...text].map((character) => /[A-Za-z0-9]/.test(character)));
});

test('ASCII substitutions require a letter in the original joined run', () => {
    assert.equal(normalize('741 8481 8@81 123$456', 'standard').text, '741 8481 8@81 123$456');
    assert.equal(normalize('T41 B4BI b@81 b!81', 'standard').text, 'tai babi babi bibi');
    assert.equal(normalize('b@@bi b4b| @babi babi!', 'standard').text, 'b@@bi bab| @babi babi!');
    assert.equal(normalize('A!1 b!1', 'standard').text, 'aii bii');
});

test('ASCII protected exclamations split runs before numeric substitutions', () => {
    assert.equal(normalize('a!1 b!1', 'standard', false, true).text, 'a!1 b!1');
    assert.equal(normalize('a!1 b!1', 'standard', false, new Set([1])).text, 'a!1 bii');
    assert.equal(normalize('a!1 b!1', 'standard', false, new Set([5])).text, 'aii b!1');
});

test('ASCII repeated-letter folding preserves the entire substituted source span', () => {
    assert.deepEqual(normalize('GOOO0BL00K', 'standard', true), {
        text: 'goblok',
        starts: [0, 1, 5, 6, 7, 9],
        ends: [1, 5, 6, 7, 9, 10],
        wordCharacters: [true, true, true, true, true, true]
    });
    assert.deepEqual(normalize('AAaa111$$', 'none', true), {
        text: 'Aa111$$',
        starts: [0, 2, 4, 5, 6, 7, 8],
        ends: [2, 4, 5, 6, 7, 8, 9],
        wordCharacters: [true, true, true, true, true, false, false]
    });
});

test('ASCII separators and controls keep their original source spans', () => {
    const text = '\0\tB@BI\r\nANJ!NG!\x7f';
    const result = normalize(text, 'standard');
    assert.equal(result.text, '\0\tbabi\r\nanjing!\x7f');
    assert.deepEqual(result.starts, Array.from({ length: text.length }, (_, index) => index));
    assert.deepEqual(result.ends, Array.from({ length: text.length }, (_, index) => index + 1));
});

test('non-ASCII grapheme and compatibility normalization retains Unicode provenance', () => {
    assert.deepEqual(normalize('A\u0301', 'standard'), {
        text: 'á', starts: [0], ends: [2], wordCharacters: [true]
    });
    assert.deepEqual(normalize('ﬃ', 'standard'), {
        text: 'ffi', starts: [0, 0, 0], ends: [1, 1, 1], wordCharacters: [true, true, true]
    });
});

test('dictionary key normalization agrees with source-aware text normalization', () => {
    for (const normalization of ['standard', 'none']) {
        for (const text of ['KONTOL', '741', '8@81', 'B@81', 'b!81', 'b@@81',
            'A!1', 'cafe\u0301', 'ㄱㅏ', 'ＡＮＪＩＮＧ', 'ﬃ', '😀 Ｂ＠ＢＩ']) {
            assert.equal(normalizeKey(text, normalization), normalize(text, normalization).text);
        }
    }
});
