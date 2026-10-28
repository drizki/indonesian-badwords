import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { test } from 'node:test';

import { Badwords } from '../dist/esm/index.js';

const require = createRequire(import.meta.url);
const { canonicalCandidatePattern, prepareNativePatterns } = require('../dist/cjs/core/pattern.js');

function paired(dictionary, options = {}) {
    // This unused non-ASCII key selects the general scanner as an oracle.
    return [new Badwords({ dictionary, ...options }),
        new Badwords({ dictionary: [...dictionary, '\u{10ffff}'], ...options })];
}

function agree(checkers, text) {
    for (const method of ['flag', 'find', 'badwords', 'filter', 'analyze']) {
        assert.deepEqual(checkers[0][method](text), checkers[1][method](text), `${method}: ${JSON.stringify(text)}`);
    }
    for (const replacement of ['***', '', '$&$1$$', '\n']) {
        assert.equal(checkers[0].censor(text, replacement), checkers[1].censor(text, replacement),
            `censor: ${JSON.stringify(text)}`);
    }
}

test('clean Unicode avoids allocating grapheme provenance for every API', () => {
    const runtime = require.resolve('../dist/cjs/index.js');
    const child = spawnSync(process.execPath, ['-e', `
        const assert = require('node:assert/strict');
        Intl.Segmenter = class { constructor() { throw new Error('unexpected segmentation'); } };
        const { Badwords } = require(${JSON.stringify(runtime)});
        const checker = new Badwords();
        for (const text of ['😀 Terima kasih, café baru itu nyaman.', 'cafe\\u0301',
            '普通の文章', '\\ud800 pengiriman selesai \\udfff', 'e\\u0301\\u200b café']) {
            assert.equal(checker.flag(text), false);
            assert.deepEqual(checker.find(text), []);
            assert.deepEqual(checker.badwords(text), []);
            assert.equal(checker.censor(text), text);
            assert.equal(checker.filter(text), text.replace(/\\s+/gu, ' ').trim());
            assert.deepEqual(checker.analyze(text), { text, words: text.match(/\\S+/gu)?.length ?? 0,
                censored: text, badwords: [], count: 0, occurrenceCount: 0, locations: [] });
        }
    `], { encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
});

test('canonical candidate search retains normalization and complete source spans', () => {
    const checkers = paired(['anjing', 'goblok', 'tai', 'ffi', 'a', 't']);
    for (const text of [
        'é 😀 4NJ1NG!', 'İ anjing', 'é ＡＮＪＩＮＧ', 'é an\u200bjing',
        'é an\u00adjing', 'é an\u034fjing', 'é an\u200djing', 'é 𝐚𝐧𝐣𝐢𝐧𝐠',
        'é ﬃ', 'é a\u0301', 'é t\u0308', 'é \u0600anjing', 'é \u1100\u1161 anjing',
        'é anjing🏻', 'é anjing\ufe0f', 'é anjing\u200d👍', 'é 🇮🇩anjing',
        'é \r\u200b\nanjing', '\ud800 é anjing \udfff', 'e\u0301\u200b anjing'
    ]) agree(checkers, text);
    assert.deepEqual(checkers[0].find('é 😀 4NJ1NG!'),
        [{ word: 'anjing', index: 5, end: 11, match: '4NJ1NG' }]);
    assert.deepEqual(checkers[0].find('é ﬃ'), [{ word: 'ffi', index: 2, end: 3, match: 'ﬃ' }]);
});

test('candidate aliases include literal and folded bang policies and numeric runs', () => {
    const checkers = paired(['goblok', 'tolol', 'cuk', 'cukima', 'tai', 'aib', 'ib', '!', '741']);
    for (const text of [
        'é goblok!tolol', 'é cuk!ma', 'é cuk!ma!tolol', 'é goblok！tolol',
        'é goblok\u200b!\u200btolol', 'é t41', 'é 741', 'é ７４１', 'é a!b!a',
        'é !', 'é 1!1', 'é go8lok', 'é tol0l', 'é goblok@tolol'
    ]) agree(checkers, text);
    assert.deepEqual(checkers[0].badwords('é goblok!tolol'), ['goblok', 'tolol']);
    assert.equal(checkers[0].flag('é cuk!ma'), true);
});

test('literal custom keys cannot inject candidate regex operators', () => {
    const checkers = paired(['a.b', '[bad]', 'x+y', '\\literal', 'a|b', '^$', '(bad)', 'a b']);
    for (const text of [
        'é a.b [bad] x+y \\literal a|b ^$ (bad) a b', 'é axb bad xxy literal ab',
        'é ［bad］', 'é a.\u200bb', 'é x+ｙ', 'é a\u00ad b', 'é (b4d)'
    ]) agree(checkers, text);
});

test('dictionary mutation invalidates literal, alias, and disabled native policies', () => {
    const checkers = paired(['goblok']);
    for (const text of ['é kucel', 'é kuc3l']) agree(checkers, text);
    for (const checker of checkers) checker.addWords('KUCEL');
    for (const text of ['é kucel', 'é kuc3l']) {
        agree(checkers, text);
        assert.equal(checkers[0].flag(text), true);
    }
    for (const checker of checkers) checker.removeWords('kucel');
    for (const text of ['é kucel', 'é kuc3l']) {
        agree(checkers, text);
        assert.equal(checkers[0].flag(text), false);
    }
    for (const checker of checkers) checker.addWords('café');
    agree(checkers, 'é café');
    assert.equal(checkers[0].flag('é café'), true);
    for (const checker of checkers) checker.removeWords('café');
    agree(checkers, 'é café');
    assert.equal(checkers[0].flag('é café'), false);
});

test('unsupported policies retain the general scanner and detailed-match limits', () => {
    for (const [options, text] of [
        [{ mode: 'substring' }, 'é xgoblokx'],
        [{ ignoreRepeatedLetters: true }, 'é gooooblok'],
        [{ normalization: 'none' }, 'é GOBLOK goblok g0bl0k']
    ]) agree(paired(['goblok', 'GOBLOK'], options), text);
    agree(paired(['café', 'goblok']), 'é café goblok');
    const limited = new Badwords({ dictionary: ['goblok'], maxMatches: 1 });
    assert.throws(() => limited.find('é goblok goblok'), RangeError);
    assert.throws(() => limited.analyze('é goblok goblok'), RangeError);
    assert.equal(limited.censor('é goblok goblok'), 'é *** ***');
    assert.deepEqual(limited.find('é kalimat bersih'), []);
});

function wideWord(index, width = 64) {
    const alphabet = 'abcegiostz';
    let prefix = '';
    for (let position = 0; position < 3; position++) {
        prefix += alphabet[index % alphabet.length];
        index = Math.floor(index / alphabet.length);
    }
    return prefix + 'a'.repeat(width - prefix.length);
}

test('oversized candidate patterns and dictionaries conservatively fall back', () => {
    const words = Array.from({ length: 256 }, (_, index) => wideWord(index));
    const prepared = prepareNativePatterns(words);
    assert.equal(canonicalCandidatePattern(prepared, true), undefined);
    assert.equal(canonicalCandidatePattern(prepared, false).test(words[0]), true);
    const checkers = paired(words);
    const obfuscated = `é ${words[0].slice(0, -1)}4`;
    for (let repeat = 0; repeat < 3; repeat++) agree(checkers, obfuscated);
    assert.equal(checkers[0].flag(obfuscated), true);
    agree(paired(Array.from({ length: 513 }, (_, index) => wideWord(index, 8))), 'é aaaaaaaa');
    agree(paired(['a'.repeat(65)]), `é ${'a'.repeat(65)}`);
});
