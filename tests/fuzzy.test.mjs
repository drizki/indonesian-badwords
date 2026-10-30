import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Badwords } from '../dist/esm/index.js';
import { boundedFuzzy, FuzzyLimitError } from '../dist/esm/fuzzy.js';
import { boundedEvasion, EvasionLimitError } from '../dist/esm/evasion.js';
import { bare } from './bare.mjs';

const basic = (options = {}, dictionary = ['goblok']) => new Badwords({ dictionary, fuzzy: boundedFuzzy(options) });
const evasion = () => boundedEvasion({ minLength: 2, separators: { characters: ['-', ' '], maxGap: 1, maxTotal: 8 },
    repetitions: { maxExtraPerLetter: 2, maxTotal: 4 }, confusables: { mappings: [['ο', 'o']], maxTotal: 4 } });
function matrix(key, candidate, options) {
    const a = [...key], b = [...candidate], inf = Infinity;
    const ins = options.insertions === false ? inf : 1, del = options.deletions === false ? inf : 1, sub = options.substitutions === false ? inf : 1;
    const d = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(inf)); d[0][0] = 0;
    for (let i = 1; i <= a.length; i++) d[i][0] = d[i - 1][0] + del;
    for (let j = 1; j <= b.length; j++) d[0][j] = d[0][j - 1] + ins;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + del, d[i][j - 1] + ins, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : sub));
        if (options.model === 'osa' && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
}

test('bounded fuzzy preserves exact matching and detects explicit directed edit families', () => {
    const checker = basic();
    for (const text of ['goblok', 'goblox', 'goblk', 'gobllok']) assert.equal(checker.flag(text), true, text);
    assert.equal(checker.flag('goblxx'), false);
    for (const [enabled, text] of [['insertions', 'gobllok'], ['deletions', 'goblk'], ['substitutions', 'goblox']]) {
        const options = { insertions: false, deletions: false, substitutions: false, [enabled]: true };
        assert.equal(basic(options).flag(text), true, enabled);
        assert.equal(basic({ ...options, [enabled]: false }).flag(text), false, enabled);
    }
    assert.equal(basic({ maxEdits: 0 }).flag('goblox'), false);
});

test('OSA supports swaps alone and retains pending swaps during bounded pruning', () => {
    const checker = basic({ model: 'osa', minLength: 1, insertions: false, deletions: false, substitutions: false }, ['ab', 'abcd']);
    assert.deepEqual(checker.badwords('ba acbd'), ['ab', 'abcd']);
    assert.equal(basic({ model: 'levenshtein', minLength: 1 }, ['ab']).flag('ba'), false);
    assert.equal(basic({ model: 'osa', minLength: 1 }, ['CA']).flag('ABC'), false);
});

test('all edit-family combinations agree with an independent scalar matrix', () => {
    const words = ['a', 'ab', 'aba', 'baba', '𐐨a', 'éa'];
    const candidates = ['a', 'b', '1', 'ab', 'ba', 'aab', 'bba', 'abab', 'baab', '𐐨b', 'é', 'éab'];
    for (const model of ['levenshtein', 'osa']) for (let bits = 0; bits < 8; bits++) for (const maxEdits of [0, 1, 2]) {
        const options = { model, maxEdits, minLength: 1, insertions: !!(bits & 1), deletions: !!(bits & 2), substitutions: !!(bits & 4) };
        const checker = new Badwords({ dictionary: words, normalization: 'none', fuzzy: boundedFuzzy(options) });
        for (const candidate of candidates) assert.deepEqual(checker.badwords(candidate), words.filter(word => matrix(word, candidate, options) <= maxEdits), JSON.stringify({ options, candidate }));
    }
});

test('scalar lengths, Myers sign bit and the full supported edit range preserve exact thresholds', () => {
    for (const length of [31, 32, 33, 64, 65]) {
        const key = 'a'.repeat(length - 1) + 'b';
        assert.equal(basic({ maxLength: 128 }, [key]).flag('a'.repeat(length)), true);
    }
    for (const maxEdits of [31, 32, 33, 64]) {
        const checker = basic({ maxEdits, minLength: 1, maxLength: 128, limits: { maxSteps: 1_000_000 } }, ['a'.repeat(65)]);
        assert.equal(checker.flag('b'.repeat(65)), maxEdits >= 65);
        assert.equal(checker.flag('a'.repeat(65 - maxEdits)), true);
    }
    assert.equal(basic({ minLength: 1 }, ['𐐨']).flag('b'), true);
});

test('all APIs share original UTF-16 spans, callbacks, exclusions and accepted occurrence caps', () => {
    const text = '😀 ｇｏｂｌｏｘ! goblоk goblox';
    const checker = new Badwords({ dictionary: ['goblok'], fuzzy: boundedFuzzy(), maxMatches: 1 });
    const options = { ignoreRanges: [{ index: 11, end: 17 }] };
    assert.equal(checker.flag(text), true);
    assert.throws(() => checker.find(text), /Match limit/);
    assert.deepEqual(bare(checker.find(text, { ignoreRanges: [{ index: 11, end: text.length }] })), [{ word: 'goblok', index: 3, end: 9, match: 'ｇｏｂｌｏｘ' }]);
    assert.equal(checker.censor(text, 'x', options), '😀 x! goblоk x');
    assert.equal(checker.filter(text, options), '😀 ! goblоk');
    assert.deepEqual(checker.badwords(text), ['goblok']);
    const seen = [];
    assert.equal(checker.censor(text, context => { seen.push(context); return '$&'; }, options), '😀 $&! goblоk $&');
    assert.deepEqual(seen.map(({ index, end, words }) => [index, end, words]), [[3, 9, ['goblok']], [18, 24, ['goblok']]]);
    assert.ok(seen.every(Object.isFrozen));
    assert.equal(new Badwords({ dictionary: ['goblok'], allowPhrases: ['goblox aman'], fuzzy: boundedFuzzy() }).censor('goblox aman goblox'), 'goblox aman ***');
});

test('substring mode preserves every nonempty lexical window and unions callback contributors', () => {
    const checker = new Badwords({ dictionary: ['abc', 'bcd', 'bc'], normalization: 'none', mode: 'substring', fuzzy: boundedFuzzy({ minLength: 2 }) });
    const actual = checker.find('xabcd').map(({ word, index, end }) => [word, index, end]);
    const expected = [];
    for (let from = 0; from < 5; from++) for (let to = from + 1; to <= 5; to++)
        for (const word of checker.dict) if (matrix(word, 'xabcd'.slice(from, to), {}) <= 1) expected.push([word, from, to]);
    expected.sort((a, b) => a[1] - b[1] || checker.dict.indexOf(a[0]) - checker.dict.indexOf(b[0]) || a[2] - b[2]);
    assert.deepEqual(actual, expected);
    const seen = []; assert.equal(checker.censor('xabcd', context => { seen.push(context); return '*'; }), '*');
    assert.deepEqual(seen.map(({ index, end, words }) => [index, end, words]), [[0, 5, ['abc', 'bcd', 'bc']]]);
});

test('eligibility applies to compiled keys and preserves coincident dictionary identities', () => {
    const checker = new Badwords({ dictionary: ['bibi', 'bbibi', 'x.y', 'hi'], ignoreRepeatedLetters: true, fuzzy: boundedFuzzy({ minLength: 4 }) });
    assert.deepEqual(checker.badwords('bibx'), ['bibi', 'bbibi']);
    assert.deepEqual(checker.badwords('x.y hi'), ['x.y', 'hi']);
    assert.equal(checker.flag('xz y'), false);
    assert.equal(basic({ minLength: 1 }, ['a']).flag('1'), true);
    assert.equal(basic({ minLength: 1 }, ['1']).flag('2'), false);
});

test('real evasion composition preserves family eligibility, source spans and OSA adjacency', () => {
    const checker = new Badwords({ dictionary: ['goblok', 'caféx', 'ab'], fuzzy: boundedFuzzy(), evasion: evasion() });
    for (const text of ['g-o-b-l-o-x', 'gοbb-lοx', 'ｇ-o-b-l-o-x', 'g-o-b-l-o-k', 'a-b']) assert.equal(checker.flag(text), true, text);
    assert.equal(checker.flag('c-a-f-é-x'), false);
    assert.equal(checker.flag('caféz'), true);
    const text = '😀 g-o-b-l-o-x!';
    assert.deepEqual(bare(checker.find(text)), [{ word: 'goblok', index: 3, end: 12, match: 'g-o-b-l-o' }, { word: 'goblok', index: 3, end: 14, match: 'g-o-b-l-o-x' }]);
    assert.equal(checker.censor(text), '😀 ***!');
    assert.equal(new Badwords({ dictionary: ['goblok'], evasion: evasion(), fuzzy: boundedFuzzy({ model: 'osa' }) }).flag('g-o-l-b-o-k'), true);
    assert.equal(checker.flag('g-o-l-b-o-k'), false);
    assert.throws(() => new Badwords({ fuzzy: boundedFuzzy(), evasion: evasion(), ignoreRepeatedLetters: true }), /unlimited/);
});

test('normalization, complete source graphemes and dictionary-aware bangs remain shared', () => {
    const checker = basic({ minLength: 1 }, ['a', 'ab', 'goblok', 'babi']);
    assert.equal(checker.flag('a\u0301'), true); // composed á is one substitution
    assert.equal(checker.flag('\u0600a'), false);
    assert.deepEqual(checker.find('goblok!goblok').map(({ index, end }) => [index, end]), [[0, 6], [7, 13]]);
    assert.deepEqual(checker.find('gοblοx\u200b').map(({ index, end }) => [index, end]), []);
    const exact = basic({ maxEdits: 0 }, ['goblok']);
    assert.deepEqual(bare(exact.find('😀 g\u200boblok')), [{ word: 'goblok', index: 3, end: 10, match: 'g\u200boblok' }]);
    assert.equal(new Badwords({ dictionary: ['AB'], normalization: 'none', fuzzy: boundedFuzzy({ minLength: 1, maxEdits: 0 }) }).flag('ab'), false);
    assert.equal(checker.flag('\ud800'), false);
});

test('resource exhaustion is typed and callback side effects are atomic', () => {
    const checker = basic({ limits: { maxSteps: 80 } }); let calls = 0;
    assert.throws(() => checker.censor('goblok ' + 'abcdefghij '.repeat(100), () => { calls++; return '*'; }), error => error instanceof FuzzyLimitError && error.limit === 'steps');
    assert.equal(calls, 0);
    assert.equal(basic({ minLength: 1, limits: { maxCandidates: 1 } }, ['a', 'b', 'c']).flag('a'), true);
    for (const method of ['flag', 'find', 'badwords', 'censor', 'filter', 'analyze']) assert.throws(() => basic({ limits: { maxInputLength: 2 } }, [])[method]('abc'), error => error instanceof FuzzyLimitError && error.limit === 'input');
});

test('both policies enforce the smaller shared input and dictionary limits', () => {
    const limits = { maxInputLength: 2, maxDictionaryLength: 4 };
    const e = boundedEvasion({ separators: { characters: ['-'], maxGap: 1, maxTotal: 1 }, limits });
    const checker = new Badwords({ dictionary: ['abc'], fuzzy: boundedFuzzy({ minLength: 1, limits: { maxInputLength: 5 } }), evasion: e });
    assert.throws(() => checker.flag('abcdef'), error => error instanceof EvasionLimitError && error.maximum === 2);
    assert.throws(() => new Badwords({ dictionary: ['abcdef'], evasion: e, fuzzy: boundedFuzzy({ limits: { maxDictionaryLength: 2 } }) }), error => error instanceof FuzzyLimitError && error.maximum === 2);
});

test('dictionary recompilation is atomic and refreshes every index', () => {
    const checker = basic({ limits: { maxCompileStates: 10 } }, ['goblok']);
    // Compile-time limits surface on the next scan (compilation is deferred); the update is then rolled back whole.
    checker.addWords('unrelatedlongword');
    assert.throws(() => checker.flag('goblox'), error => error instanceof FuzzyLimitError && error.limit === 'compileStates');
    assert.deepEqual(checker.dict, ['goblok']); assert.equal(checker.flag('goblox'), true);
    checker.removeWords('goblok'); assert.equal(checker.flag('goblox'), false);
    checker.addWords('KONTOL'); assert.equal(checker.flag('kontox'), true);
    const small = basic({ limits: { maxIndexPostings: 1 } }, []);
    small.addWords('goblok');
    assert.throws(() => small.flag('goblox'), error => error instanceof FuzzyLimitError && error.limit === 'indexPostings');
    assert.deepEqual(small.dict, []);
});

test('fuzzy descriptor validation rejects ignored options and mutable forgeries', () => {
    for (const options of [null, [], { model: 'damerau' }, { maxEdits: -1 }, { maxEdits: 65 }, { insertions: 1 }, { minLength: 0 }, { minLength: 10, maxLength: 3 }, { typo: true }, { limits: { silent: true } }]) assert.throws(() => boundedFuzzy(options));
    assert.ok(Object.isFrozen(boundedFuzzy()));
    assert.throws(() => new Badwords({ fuzzy: {} }), /boundedFuzzy/);
});


test('packed postings retain scalar and length recall in larger lexicons', () => {
    const alphabetic = index => { let out = ''; do { out = String.fromCharCode(97 + index % 26) + out; index = Math.floor(index / 26); } while (index); return out; };
    const dictionary = Array.from({ length: 700 }, (_, index) => 'prefix' + alphabetic(index) + 'suffix');
    dictionary.push('𐐨abcd', 'abcd𐐨');
    for (const model of ['levenshtein', 'osa']) {
        const checker = new Badwords({ dictionary, normalization: 'none', fuzzy: boundedFuzzy({ minLength: 1, model }) });
        for (const candidate of ['prefixasuffiy', 'prefixbasuffix', '𐐨abdc', 'abdc𐐨'])
            assert.deepEqual(checker.badwords(candidate), dictionary.filter(word => matrix(word, candidate, { model }) <= 1));
    }
});
