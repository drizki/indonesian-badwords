import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Badwords, censor } from '../dist/esm/index.js';
import { mask, grawlix } from '../dist/esm/censor.js';

const context = (match) => ({ text: match, index: 0, end: match.length, match, words: [] });

test('mask counts original graphemes across combining, compatibility, emoji and lone surrogates', () => {
    const clusters = ['e\u0301', 'ﬃ', '👨‍👩‍👧‍👦', '🇮🇩', '\ud800', '\udc00'];
    for (const value of clusters) {
        assert.equal(mask()(context(value)), '*', JSON.stringify(value));
        assert.equal(mask({ keepFirst: 100, keepLast: 100 })(context(value)), '*');
        const match = `A${value}B`;
        assert.equal(mask({ keepFirst: 1, keepLast: 1 })(context(match)), 'A*B');
        assert.equal(mask({ character: '🇮🇩' })(context(match)), '🇮🇩🇮🇩🇮🇩');
    }
    assert.equal(mask()(context('')), '');
    assert.equal(mask()(context('éﬃ👩‍💻🇮🇩')), '****');
});

test('edge preservation clamps with first priority and always replaces at least one grapheme', () => {
    assert.equal(mask({ keepFirst: 2, keepLast: 1 })(context('goblok')), 'go***k');
    assert.equal(mask({ keepFirst: 100, keepLast: 100 })(context('abc')), 'ab*');
    assert.equal(mask({ keepLast: 100 })(context('abc')), '*bc');
    assert.equal(mask({ keepFirst: 1, keepLast: 1 })(context('ab')), 'a*');
    assert.equal(mask({ keepFirst: 2 })(context('e\u0301👩‍💻🇮🇩')), 'e\u0301👩‍💻*');
});

test('strategies operate on merged original source and preserve surrounding punctuation', () => {
    assert.equal(censor('dasar g0bl0k!', mask({ keepFirst: 1 })), 'dasar g*****!');
    const checker = new Badwords({ dictionary: ['ffi', '👩‍💻', 'é'] });
    assert.equal(checker.censor('ﬃ, 👩‍💻! é?', mask()), '*, *! *?');
    const overlap = new Badwords({ dictionary: ['a', 'aba', 'bab'], mode: 'substring', maxMatches: 1 });
    assert.equal(overlap.censor('ababa!', mask({ keepFirst: 1, keepLast: 1 })), 'a***a!');
    assert.equal(overlap.censor('ababa!', grawlix({ symbols: ['$', '!'], random: () => 0 })), '$$$$$!');
});

test('grawlix is deterministic with injection and calls random once per replaced grapheme', () => {
    const values = [0, 0.49, 0.5, 1 - Number.EPSILON];
    let calls = 0;
    const replace = grawlix({ symbols: ['@', '👩‍💻'], random: () => values[calls++], keepFirst: 1, keepLast: 1 });
    assert.equal(replace(context('ae\u0301ﬃ🇮🇩bc')), 'a@@👩‍💻👩‍💻c');
    assert.equal(calls, 4);
    const symbols = ['$', '#'];
    const copied = grawlix({ symbols, random: () => 0 });
    symbols[0] = 'changed';
    assert.equal(copied(context('ab')), '$$');
    assert.equal(grawlix({ symbols: '👩‍💻🇮🇩', random: () => 0.99 })(context('ab')), '🇮🇩🇮🇩');
    const error = new Error('rng failed');
    assert.throws(() => grawlix({ random: () => { throw error; } })(context('a')), (value) => value === error);
});

test('invalid strategy configuration and random output fail explicitly', () => {
    for (const options of [null, [], 1, false, 'x']) {
        assert.throws(() => mask(options), TypeError);
        assert.throws(() => grawlix(options), TypeError);
    }
    for (const count of [-1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null]) {
        for (const keep of ['keepFirst', 'keepLast']) {
            assert.throws(() => mask({ [keep]: count }), TypeError);
            assert.throws(() => grawlix({ [keep]: count }), TypeError);
        }
    }
    for (const character of ['', 'ab', '\ud800', '\udc00', '\n', '\u007f', '\u0301', '\u200d', '🇮']) {
        assert.throws(() => mask({ character }), TypeError, JSON.stringify(character));
        assert.throws(() => grawlix({ symbols: [character] }), TypeError, JSON.stringify(character));
    }
    for (const character of [null, 1, [], {}]) assert.throws(() => mask({ character }), TypeError);
    for (const symbols of ['', [], null, 1, {}, [undefined], [1], new Array(1)]) {
        assert.throws(() => grawlix({ symbols }), TypeError);
    }
    for (const random of [null, 1, {}, 'x']) assert.throws(() => grawlix({ random }), TypeError);
    for (const value of [-1, 1, Infinity, -Infinity, NaN]) {
        assert.throws(() => grawlix({ random: () => value })(context('a')), RangeError);
    }
    for (const value of [undefined, null, '0', false, {}]) {
        assert.throws(() => grawlix({ random: () => value })(context('a')), TypeError);
    }
    assert.throws(() => mask()({ match: 1 }), TypeError);
});

test('replacement symbols reject invisible controls, fillers, selectors and whitespace', () => {
    const invalid = [
        '\u200b', '\u202e', '\ufeff', '\u00ad', '\u2028', '\u2029', '\u061c',
        '\u200e', '\u200f', '\u202a', '\u202b', '\u202c', '\u202d',
        '\u2066', '\u2067', '\u2068', '\u2069', '\u2060', '\u034f',
        '\ufe0f', '\u{e0100}', '\u{e0067}', '\u{e007f}', '\u200c', '\u200d',
        '\u115f', '\u1160', '\u3164', '\uffa0', '\u115f\u1160',
        ' ', '\t', '\n', '\r', '\u00a0', '\u2007', '\u202f', '\u3000'
    ];
    for (const value of invalid) {
        const label = [...value].map(point => `U+${point.codePointAt(0).toString(16)}`).join(' ');
        assert.throws(() => mask({ character: value }), TypeError, label);
        assert.throws(() => grawlix({ symbols: [value] }), TypeError, label);
        assert.throws(() => grawlix({ symbols: value }), TypeError, label);
    }
});

test('visible bases retain complete ZWJ, flag, tag, selector and combining sequences', () => {
    const england = '\u{1f3f4}\u{e0067}\u{e0062}\u{e0065}\u{e006e}\u{e0067}\u{e007f}';
    for (const value of ['👩‍💻', '👨‍👩‍👧‍👦', '🇮🇩', england, '✈️', '1\ufe0f\u20e3', 'e\u0301', '한', '●']) {
        assert.equal(mask({ character: value })(context('ab')), value + value);
        assert.equal(grawlix({ symbols: [value], random: () => 0 })(context('ab')), value + value);
        assert.equal(grawlix({ symbols: value, random: () => 0 })(context('ab')), value + value);
    }
});

test('mask preserves exact grapheme edges over a deterministic generated corpus', () => {
    const segments = ['a', 'e\u0301', 'ﬃ', '👩‍💻', '🇮🇩', '\ud800'];
    const segmenter = new Intl.Segmenter('id', { granularity: 'grapheme' });
    for (let length = 1; length <= 12; length++) {
        const parts = Array.from({ length }, (_, index) => segments[(index + length) % segments.length]);
        const text = parts.join('');
        const source = Array.from(segmenter.segment(text), ({ segment }) => segment);
        for (let first = 0; first <= 14; first++) for (let last = 0; last <= 14; last++) {
            const keptFirst = Math.min(first, source.length - 1);
            const keptLast = Math.min(last, source.length - keptFirst - 1);
            assert.equal(mask({ keepFirst: first, keepLast: last })(context(text)),
                source.slice(0, keptFirst).join('') + '*'.repeat(source.length - keptFirst - keptLast)
                + (keptLast ? source.slice(-keptLast).join('') : ''));
        }
    }
});
