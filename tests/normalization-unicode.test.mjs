import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { normalize } from '../dist/cjs/text/normalize.js';

test('simple Unicode substitutions preserve emoji and original fullwidth source spans', () => {
    assert.deepEqual(normalize('😀 Ｂ＠ＢＩ\u200b!', 'standard'), {
        text: '😀 babi!',
        starts: [0, 0, 2, 3, 4, 5, 6, 8],
        ends: [2, 2, 3, 4, 5, 6, 7, 9],
        wordCharacters: [false, false, false, true, true, true, true, false]
    });
    assert.deepEqual(normalize('😀™!', 'standard'), {
        text: '😀tm!', starts: [0, 0, 2, 2, 3], ends: [2, 2, 3, 3, 4],
        wordCharacters: [false, false, true, true, false]
    });
});

test('simple Unicode retains CRLF graphemes formed across removed controls', () => {
    assert.deepEqual(normalize('😀\r\u200b\nX', 'standard'), {
        text: '😀\r\nx', starts: [0, 0, 2, 2, 5], ends: [2, 2, 5, 5, 6],
        wordCharacters: [false, false, false, false, true]
    });
});

test('simple Unicode uses original UTF-16 offsets when protecting internal exclamations', () => {
    assert.equal(normalize('😀a!1 b!1', 'standard', false, new Set([3])).text, '😀a!1 bii');
    assert.equal(normalize('😀a!1 b!1', 'standard', false, new Set([7])).text, '😀aii b!1');
    assert.equal(normalize('😀a!1 b!1', 'standard', false, true).text, '😀a!1 b!1');
});

test('simple Unicode repeated letters retain their full original normalized spans', () => {
    assert.deepEqual(normalize('ＧＯＯ０ＢＬ０Ｋ', 'standard', true), {
        text: 'goblok', starts: [0, 1, 4, 5, 6, 7], ends: [1, 4, 5, 6, 7, 8],
        wordCharacters: [true, true, true, true, true, true]
    });
});

test('exact Unicode repeats preserve complete supplementary letters and emoji graphemes', () => {
    assert.deepEqual(normalize('𐐀𐐀', 'none', true), {
        text: '𐐀', starts: [0, 0], ends: [4, 4], wordCharacters: [true, true]
    });
    assert.deepEqual(normalize('👩‍💻', 'none'), {
        text: '👩‍💻', starts: [0, 0, 0, 0, 0], ends: [5, 5, 5, 5, 5],
        wordCharacters: [false, false, false, false, false]
    });
});

test('ASCII defers Unicode regexes and bounded Unicode defers the grapheme segmenter', () => {
    const modulePath = fileURLToPath(new URL('../dist/cjs/text/normalize.js', import.meta.url));
    const child = spawnSync(process.execPath, ['-e', `
        const assert = require('node:assert/strict');
        const NativeSegmenter = Intl.Segmenter;
        const NativeRegExp = RegExp;
        let constructions = 0;
        let patterns = 0;
        global.RegExp = class extends NativeRegExp {
            constructor(...args) { super(...args); patterns++; }
        };
        Intl.Segmenter = class extends NativeSegmenter {
            constructor(...args) { super(...args); constructions++; }
        };
        const { normalize } = require(${JSON.stringify(modulePath)});
        normalize('plain ASCII 741!', 'standard');
        assert.equal(patterns, 0);
        normalize('😀 ＧＯＢＬＯＫ dan kon\\u200btol. 👍', 'standard');
        assert.equal(constructions, 0);
        assert.equal(patterns, 3);
        normalize('cafe\\u0301', 'standard');
        normalize('👩‍💻', 'none');
        assert.equal(constructions, 1);
        assert.equal(patterns, 5);
    `], { encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
});
