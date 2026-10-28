import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { Badwords, flag, find, badwords, censor, filter, analyze } from '../dist/esm/index.js';
import { mask } from '../dist/esm/censor.js';

function consistent(checker, text, options, expected) {
    const locations = checker.find(text, options);
    assert.deepEqual(locations.map(({ word, index, end }) => [word, index, end]), expected);
    const words = checker.dict.filter(word => locations.some(match => match.word === word));
    assert.equal(checker.flag(text, options), locations.length > 0);
    assert.deepEqual(checker.badwords(text, options), words);
    const result = checker.analyze(text, options);
    assert.deepEqual(result.locations, locations);
    assert.deepEqual(result.badwords, words);
    assert.equal(result.occurrenceCount, locations.length);
    assert.equal(result.count, words.length);
    assert.equal(result.censored, checker.censor(text, undefined, options));
    assert.equal(checker.censor(text, () => '***', options), result.censored);
    assert.equal(checker.filter(text, options), checker.censor(text, '', options).replace(/\s+/gu, ' ').trim());
    for (const match of locations) assert.equal(match.match, text.slice(match.index, match.end));
    return result;
}

test('allow phrases exempt occurrences inside each phrase, with no message-wide immunity', () => {
    const checker = new Badwords({ allowPhrases: ['Baju Bodo'] });
    consistent(checker, 'Baju Bodo goblok bodo', undefined, [['goblok', 10, 16], ['bodo', 17, 21]]);
    assert.equal(checker.censor('Baju Bodo goblok bodo'), 'Baju Bodo *** ***');
    assert.equal(checker.flag('Baju Bodo'), false);
    assert.equal(checker.flag('bodo Baju Bodo'), true);
});

test('literal phrases use case, NFKC and ignorables, without leet, repeats or whitespace guessing', () => {
    const checker = new Badwords({ dictionary: ['bodo'], allowPhrases: ['  Baju Bodo  '], ignoreRepeatedLetters: true });
    for (const text of ['BAJU BODO', 'Ｂａｊｕ Ｂｏｄｏ', 'Ba\u200bju Bo\u2060do']) {
        consistent(checker, text, undefined, []);
    }
    for (const text of ['Baju B0d0', 'Baju Bodooo', 'Baju  Bodo', 'Baju\nBodo', 'xbaju bodo']) {
        assert.equal(checker.flag(text), true, text);
    }
    assert.equal(new Badwords({ dictionary: ['bodo'], allowPhrases: ['Baju B0d0'] }).flag('Baju Bodo'), true);
    const stableCase = new Badwords({ dictionary: ['ẗ'], allowPhrases: ['ẗ'] });
    consistent(stableCase, 'T\u0308', undefined, []);
});

test('normalization none preserves literal case and invisibles in allowed phrases', () => {
    const checker = new Badwords({ dictionary: ['Bodo'], normalization: 'none', allowPhrases: ['Baju Bodo'] });
    consistent(checker, 'Baju Bodo Bodo', undefined, [['Bodo', 10, 14]]);
    assert.equal(checker.flag('baju Bodo'), true);
    assert.equal(checker.flag('Ba\u200bju Bodo'), true);
});

test('Unicode literal phrases preserve complete source atoms through composition and expansion', () => {
    for (const [word, phrase, text] of [
        ['ος', 'ΟΣ', 'ΟΣ'], ['가', '가', '\u3131\u314f'], ['à\u0315', 'à\u0315', 'a\u0315\u0300'],
        ['ffi', 'ffi', 'ﬃ'], ['tel', 'TEL', '℡'], ['½', '½', '½'], ['👩‍💻', '👩‍💻', '👩‍💻'],
        ['\u0600bodo', '\u0600bodo', '\u0600bodo'], ['a\r\nb', 'a\r\nb', 'a\r\nb']
    ]) {
        const checker = new Badwords({ dictionary: [word], allowPhrases: [phrase] });
        assert.equal(new Badwords({ dictionary: [word] }).flag(text), true, JSON.stringify(text));
        consistent(checker, text, undefined, []);
    }
});

test('allow phrases require whole Unicode words and whole source expansions', () => {
    const checker = new Badwords({ dictionary: ['bodo'], mode: 'substring', allowPhrases: ['baju bodo'] });
    assert.equal(checker.flag('xbaju bodo'), true);
    assert.equal(checker.flag('baju bodox'), true);
    assert.equal(checker.flag('ébaju bodo'), true);
    assert.equal(checker.flag('baju bodo\u0301'), false); // No partial source-grapheme detector occurrence.
    assert.equal(checker.flag('(baju bodo)'), false);
    const expansion = new Badwords({ dictionary: ['ffi'], allowPhrases: ['ff'] });
    consistent(expansion, 'ﬃ', undefined, [['ffi', 0, 1]]);
    assert.equal(new Badwords({ dictionary: ['ffi'], allowPhrases: ['FFI'] }).flag('ﬃ'), false);
    const crlf = new Badwords({ dictionary: ['x'], mode: 'substring', normalization: 'none', allowPhrases: ['a\nx'] });
    assert.equal(crlf.flag('a\r\nx'), true);
});

test('overlapping and adjacent allow phrases never combine to exempt a longer occurrence', () => {
    const checker = new Badwords({ dictionary: ['foo bar baz', 'foo bar', 'bar baz'], mode: 'substring',
        allowPhrases: ['foo bar', 'bar baz'] });
    consistent(checker, 'foo bar baz', undefined, [['foo bar baz', 0, 11]]);
    const adjacent = new Badwords({ dictionary: ['foo bar'], allowPhrases: ['foo', 'bar'] });
    assert.equal(adjacent.flag('foo bar'), true);
    const crossing = new Badwords({ dictionary: ['aju bodo x', 'bodo'], mode: 'substring', allowPhrases: ['baju bodo'] });
    consistent(crossing, 'baju bodo x', undefined, [['aju bodo x', 1, 11]]);
});

test('phrase configuration is copied, deduplicated and independent of dictionary mutation', () => {
    const phrases = ['Baju Bodo', 'baju bodo'];
    const checker = new Badwords({ dictionary: ['bodo'], allowPhrases: phrases });
    phrases[0] = 'goblok';
    phrases.push('goblok');
    checker.addWords('goblok');
    consistent(checker, 'Baju Bodo goblok', undefined, [['goblok', 10, 16]]);
    checker.removeWords('bodo');
    checker.addWords('baju bodo');
    consistent(checker, 'Baju Bodo goblok', undefined, [['goblok', 10, 16]]);
    checker.removeWords('goblok');
    assert.equal(checker.flag('Baju Bodo'), false);
});

test('invalid allow phrases fail explicitly', () => {
    for (const allowPhrases of [null, 'bodo', 1, {}, [null], ['valid', false]]) {
        assert.throws(() => new Badwords({ allowPhrases }), TypeError);
    }
    for (const allowPhrases of [[''], [' \t\r\n '], ['\u200b\u2060']]) {
        assert.throws(() => new Badwords({ allowPhrases }), RangeError);
    }
    assert.equal(new Badwords({ allowPhrases: [] }).flag('bodo'), true);
});

test('ignored ranges use any source intersection, merge their union, and preserve touching edges', () => {
    const checker = new Badwords({ dictionary: ['bodo', 'goblok'] });
    consistent(checker, 'bodo goblok bodo', { ignoreRanges: [{ index: 1, end: 2 }] },
        [['goblok', 5, 11], ['bodo', 12, 16]]);
    consistent(checker, 'bodo goblok bodo', { ignoreRanges: [
        { index: 13, end: 14 }, { index: 0, end: 1 }, { index: 1, end: 4 }, { index: 2, end: 3 }
    ] }, [['goblok', 5, 11]]);
    consistent(checker, 'bodo goblok', { ignoreRanges: [{ index: 4, end: 5 }] }, [['bodo', 0, 4], ['goblok', 5, 11]]);
    consistent(checker, 'bodo', { ignoreRanges: [{ index: 1, end: 1 }, { index: 4, end: 4 }] }, [['bodo', 0, 4]]);
});

test('ignored text is not deleted before normalization or matching', () => {
    const checker = new Badwords({ dictionary: ['bodo'] });
    consistent(checker, 'bo<code>do', { ignoreRanges: [{ index: 2, end: 8 }] }, []);
    const text = '😀 b0do kon\u200btol';
    const unicode = new Badwords({ dictionary: ['bodo', 'kontol'] });
    consistent(unicode, text, { ignoreRanges: [{ index: 4, end: 5 }] }, [['kontol', 8, 15]]);
    assert.equal(unicode.censor(text, mask(), { ignoreRanges: [{ index: 8, end: 15 }] }), '😀 **** kon\u200btol');
});

test('range validation rejects wrong types, nonintegers, invalid bounds and malformed options', () => {
    const checker = new Badwords();
    const methods = [
        (text, options) => checker.flag(text, options), (text, options) => checker.find(text, options),
        (text, options) => checker.badwords(text, options), (text, options) => checker.censor(text, '*', options),
        (text, options) => checker.censor(text, () => '*', options), (text, options) => checker.filter(text, options),
        (text, options) => checker.analyze(text, options)
    ];
    for (const check of methods) {
        for (const options of [null, [], 1, '', { ignoreRanges: null }, { ignoreRanges: 'x' },
            { ignoreRanges: [null] }, { ignoreRanges: [[0, 1]] }, { ignoreRanges: [{ index: '0', end: 1 }] },
            { ignoreRanges: [{ index: 0 }] }]) assert.throws(() => check('clean', options), TypeError);
        for (const range of [{ index: -1, end: 1 }, { index: 2, end: 1 }, { index: 0, end: 6 },
            { index: 0.5, end: 1 }, { index: NaN, end: 1 }, { index: 0, end: Infinity }]) {
            assert.throws(() => check('clean', { ignoreRanges: [range] }), RangeError);
        }
        assert.throws(() => check('', { ignoreRanges: [{ index: 0, end: 1 }] }), RangeError);
    }
    assert.throws(() => new Badwords({ dictionary: [] }).flag('clean', { ignoreRanges: [{ index: 0, end: 6 }] }), RangeError);
});

test('range endpoints must be original extended grapheme boundaries, including empty ranges', () => {
    const checker = new Badwords();
    for (const [text, split] of [['😀 bodo', 1], ['e\u0301 bodo', 1], ['👩‍💻 bodo', 2],
        ['🇮🇩 bodo', 2], ['a\r\nbodo', 2], ['\u1100\u1161 bodo', 1], ['\u0600a bodo', 1]]) {
        for (const range of [{ index: 0, end: split }, { index: split, end: split }]) {
            assert.throws(() => checker.flag(text, { ignoreRanges: [range] }), RangeError, JSON.stringify(text));
        }
        assert.equal(checker.flag(text, { ignoreRanges: [{ index: 0, end: text.length }] }), false);
    }
    assert.equal(checker.flag('', { ignoreRanges: [{ index: 0, end: 0 }] }), false);
});

test('callback contributors and merged coverage contain only accepted occurrences', () => {
    const checker = new Badwords({ dictionary: ['ab', 'abc', 'bc', 'bcd', 'cd'], mode: 'substring', normalization: 'none' });
    const options = { ignoreRanges: [{ index: 0, end: 1 }] };
    consistent(checker, 'abcd', options, [['bc', 1, 3], ['bcd', 1, 4], ['cd', 2, 4]]);
    const contexts = [];
    assert.equal(checker.censor('abcd', context => { contexts.push(context); return '*'; }, options), 'a*');
    assert.deepEqual(contexts.map(({ index, end, words }) => ({ index, end, words })),
        [{ index: 1, end: 4, words: ['bc', 'bcd', 'cd'] }]);
    const shorter = new Badwords({ dictionary: ['a', 'ab', 'b'], mode: 'substring', allowPhrases: ['ab'] });
    assert.equal(shorter.censor('ab', () => { throw new Error('suppressed callback'); }), 'ab');
    const bridging = new Badwords({ dictionary: ['a', 'abc', 'c'], mode: 'substring', normalization: 'none' });
    const spans = [];
    assert.equal(bridging.censor('abc', context => { spans.push(context); return '*'; },
        { ignoreRanges: [{ index: 1, end: 2 }] }), '*b*');
    assert.deepEqual(spans.map(({ index, end, words }) => [index, end, words]), [[0, 1, ['a']], [2, 3, ['c']]]);
});

test('ignored ranges are snapshotted before callbacks and combine with allow phrases', () => {
    const ranges = [{ index: 5, end: 9 }];
    const checker = new Badwords({ dictionary: ['bodo'] });
    const calls = [];
    assert.equal(checker.censor('bodo bodo bodo', context => {
        calls.push(context.index);
        ranges[0].index = 0;
        ranges[0].end = 14;
        ranges.push({ index: 10, end: 14 });
        return '*';
    }, { ignoreRanges: ranges }), '* bodo *');
    assert.deepEqual(calls, [0, 10]);
    const scoped = new Badwords({ dictionary: ['bodo', 'goblok'], allowPhrases: ['baju bodo'] });
    consistent(scoped, 'baju bodo goblok bodo', { ignoreRanges: [{ index: 10, end: 16 }] }, [['bodo', 17, 21]]);
});

test('accepted matches alone consume detailed limits and flag retains early exit', () => {
    const checker = new Badwords({ dictionary: ['bodo'], maxMatches: 1 });
    consistent(checker, 'bodo bodo bodo', { ignoreRanges: [{ index: 0, end: 10 }] }, [['bodo', 10, 14]]);
    assert.throws(() => checker.find('bodo bodo', { ignoreRanges: [] }), RangeError);
    assert.throws(() => checker.analyze('bodo bodo', {}), RangeError);
    checker.find = () => { throw new Error('flag must not collect occurrences'); };
    assert.equal(checker.flag('bodo bodo', { ignoreRanges: [{ index: 0, end: 4 }] }), true);
    assert.equal(checker.flag('bodo '.repeat(20_000), { ignoreRanges: [{ index: 0, end: 4 }] }), true);
});

test('native, folded, bang-aware, Unicode and repeated-letter paths share exception semantics', () => {
    const inputs = ['bodo!goblok', 'b0do!g0bl0k', 'ＢＯＤＯ！ＧＯＢＬＯＫ', 'bo\u200bdo goblok',
        '😀 bodo goblok', 'booodooo goooblok', 'bodo_goblok', 'bodo!cuk!ma'];
    for (const mode of ['word', 'substring']) for (const ignoreRepeatedLetters of [false, true]) {
        const checker = new Badwords({ dictionary: ['bodo', 'goblok', 'cuk', 'cukima'], mode, ignoreRepeatedLetters });
        for (const text of inputs) {
            const all = checker.find(text);
            const first = all[0];
            if (!first) continue;
            const options = { ignoreRanges: [{ index: first.index, end: first.end }] };
            const expected = all.filter(match => match.index >= first.end || match.end <= first.index)
                .map(({ word, index, end }) => [word, index, end]);
            consistent(checker, text, options, expected);
        }
    }
});

test('all named functions accept per-call options without changing the shared dictionary', () => {
    const text = 'bodo goblok';
    const options = { ignoreRanges: [{ index: 0, end: text.length }] };
    assert.equal(flag(text, options), false);
    assert.deepEqual(find(text, options), []);
    assert.deepEqual(badwords(text, options), []);
    assert.equal(censor(text, undefined, options), text);
    assert.equal(filter(text, options), text);
    assert.equal(analyze(text, options).occurrenceCount, 0);
    assert.equal(flag(text), true);
});

test('source exceptions agree with independent occurrence filtering and callback clustering', () => {
    let seed = 20261028;
    const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
    const tokens = ['a', 'ab', 'abc', 'b', 'bc', 'cd', 'a b', 'a!b', 'A', 'b0do', 'bodo', 'booodo', 'goblok'];
    const word = character => character !== undefined && /[a-z0-9]/i.test(character);
    for (let iteration = 0; iteration < 350; iteration++) {
        const dictionary = [...new Set(Array.from({ length: 1 + random(10) }, () => tokens[random(tokens.length)]))];
        const phrases = [...new Set(Array.from({ length: random(4) }, () => tokens[random(tokens.length)]))];
        const text = Array.from({ length: 1 + random(12) }, () => tokens[random(tokens.length)]).join(random(2) ? ' ' : '!');
        const settings = { dictionary, mode: random(2) ? 'word' : 'substring',
            normalization: random(2) ? 'none' : 'standard', ignoreRepeatedLetters: !!random(2) };
        const checker = new Badwords({ ...settings, allowPhrases: phrases });
        const plain = new Badwords(settings);
        const ranges = Array.from({ length: random(4) }, () => {
            const one = random(text.length + 1), two = random(text.length + 1);
            return { index: Math.min(one, two), end: Math.max(one, two) };
        });
        const literal = settings.normalization === 'standard' ? text.toLowerCase() : text;
        const allowed = [];
        for (const raw of phrases) {
            const phrase = settings.normalization === 'standard' ? raw.toLowerCase() : raw;
            for (let index = literal.indexOf(phrase); index !== -1; index = literal.indexOf(phrase, index + 1)) {
                if (!word(literal[index - 1]) && !word(literal[index + phrase.length])) {
                    allowed.push({ index, end: index + phrase.length });
                }
            }
        }
        const expected = plain.find(text).filter(match => !ranges.some(range => range.index !== range.end
            && range.index < match.end && range.end > match.index)
            && !allowed.some(range => range.index <= match.index && range.end >= match.end));
        const options = { ignoreRanges: ranges };
        consistent(checker, text, options, expected.map(({ word, index, end }) => [word, index, end]));
        const clusters = [];
        for (const occurrence of [...expected].sort((a, b) => a.index - b.index || a.end - b.end)) {
            const previous = clusters.at(-1);
            if (previous && occurrence.index < previous.end) {
                previous.end = Math.max(previous.end, occurrence.end);
                previous.words.add(occurrence.word);
            } else clusters.push({ index: occurrence.index, end: occurrence.end, words: new Set([occurrence.word]) });
        }
        const actual = [];
        checker.censor(text, ({ index, end, words }) => { actual.push([index, end, [...words]]); return '*'; }, options);
        assert.deepEqual(actual, clusters.map(({ index, end, words }) => [index, end, checker.dict.filter(word => words.has(word))]));
    }
});

test('off path and ASCII ranges do not construct Intl.Segmenter', () => {
    const module = new URL('../dist/esm/index.js', import.meta.url).href;
    execFileSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        Intl.Segmenter = class { constructor() { throw new Error('unexpected segmentation'); } };
        const { Badwords } = await import(${JSON.stringify(module)});
        for (const checker of [new Badwords(), new Badwords({ allowPhrases: [] }),
            new Badwords({ allowPhrases: ['baju bodo'] })]) {
            for (const options of [undefined, {}, { ignoreRanges: [] }, { ignoreRanges: [{ index: 0, end: 0 }] }]) {
                checker.flag('clean', options);
                checker.find('bodo', options);
                checker.badwords('bodo', options);
                checker.censor('bodo', undefined, options);
                checker.filter('bodo', options);
                checker.analyze('bodo', options);
                if (!options?.ignoreRanges?.length) {
                    for (const method of ['flag', 'find', 'badwords', 'filter', 'analyze']) {
                        checker[method]('café résumé', options);
                    }
                    checker.censor('café résumé', undefined, options);
                    checker.censor('café résumé', () => '*', options);
                }
            }
        }
        assert.equal(new Badwords().flag('bodo', { ignoreRanges: [{ index: 0, end: 4 }] }), false);
    `]);
});
