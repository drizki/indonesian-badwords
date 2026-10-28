import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { Badwords } from '../dist/esm/index.js';

describe('normalized matching spans', () => {
    const detector = new Badwords({ dictionary: ['anjing', 'babi', "blo'on"] });

    test('uses the same spelling normalization for detection, locations and censorship', () => {
        for (const [spelling, word] of [
            ['4NJ1NG', 'anjing'],
            ['anj!ng', 'anjing'],
            ['b@bi', 'babi'],
            ['b4b1', 'babi'],
            ["BLO'ON", "blo'on"]
        ]) {
            const text = `hei ${spelling}!`;
            assert.equal(detector.flag(text), true, text);
            assert.deepEqual(detector.badwords(text), [word], text);
            assert.equal(detector.censor(text), 'hei ***!', text);
            assert.equal(detector.filter(`hei ${spelling}`), 'hei', text);
            assert.deepEqual(detector.analyze(text).locations.map(({ word, index }) => ({ word, index })), [{ word, index: 4 }], text);
        }
    });

    test('preserves punctuation, tabs, newlines and apostrophes outside matched spans', () => {
        assert.equal(
            detector.censor("(ANJ!NG!),\tb@bi?\n'BLO'ON'."),
            "(***!),\t***?\n'***'."
        );
    });

    test('keeps original UTF-16 locations after lowercase expansions and emoji', () => {
        const text = '😀İ\t4NJ1NG, b@bi; anj!ng';
        assert.deepEqual(detector.analyze(text).locations.map(({ word, index }) => ({ word, index })), [
            { word: 'anjing', index: 4 },
            { word: 'babi', index: 12 },
            { word: 'anjing', index: 18 }
        ]);
        assert.equal(detector.censor(text), '😀İ\t***, ***; ***');
        assert.deepEqual(detector.analyze('İ anjing').locations.map(({ word, index }) => ({ word, index })), [{ word: 'anjing', index: 2 }]);
    });

    test('preserves the complete original character when lowercase expands it', () => {
        const expanded = new Badwords({ dictionary: ['i\u0307'] });
        assert.deepEqual(expanded.analyze('😀İ!').locations.map(({ word, index }) => ({ word, index })), [{ word: 'i\u0307', index: 2 }]);
        assert.equal(expanded.censor('😀İ!'), '😀***!');
    });

    test('supports contextual Unicode case conversion', () => {
        const greek = new Badwords({ dictionary: ['ος'] });
        assert.equal(greek.censor('ΟΣ!'), '***!');
    });

    test('returns all occurrences in source order and unique words in dictionary order', () => {
        const text = 'B@BI anj!ng babi 4nj1ng';
        const result = detector.analyze(text);
        assert.deepEqual(result.badwords, ['anjing', 'babi']);
        assert.equal(result.count, 2);
        assert.deepEqual(result.locations.map(({ word, index }) => ({ word, index })), [
            { word: 'babi', index: 0 },
            { word: 'anjing', index: 5 },
            { word: 'babi', index: 12 },
            { word: 'anjing', index: 17 }
        ]);
        assert.equal(result.censored, '*** *** *** ***');
    });

    test('treats a replacement as a literal string', () => {
        assert.equal(detector.censor('anjing babi', '$&$1$$'), '$&$1$$ $&$1$$');
    });

    test('matches custom punctuation literally without building a dictionary regex', () => {
        const custom = new Badwords({ dictionary: ['a.b', 'x+y', '[bad]'] });
        assert.equal(custom.flag('axb xxxy bad'), false);
        assert.equal(custom.censor('a.b x+y [bad]'), '*** *** ***');
    });
});

describe('explicit matching policies', () => {
    const dictionary = ['tai', 'asu', 'anjing', 'babi'];
    const defaultMode = new Badwords({ dictionary });
    const wordMode = new Badwords({ dictionary, mode: 'word' });

    test('keeps longer benign words and joined terms clean in the default word mode', () => {
        for (const text of ['pantai', 'santai', 'kamuasu', 'asusila', 'anjingbabi']) {
            assert.equal(defaultMode.flag(text), false, text);
            assert.equal(defaultMode.censor(text), text, text);
            assert.equal(defaultMode.filter(text), text, text);
            assert.deepEqual(defaultMode.badwords(text), [], text);
            assert.deepEqual(defaultMode.analyze(text).locations.map(({ word, index }) => ({ word, index })), [], text);
        }
    });

    test('uses word mode consistently across detection and analysis', () => {
        for (const text of ['pantai', 'santai', 'kamuasu', 'asusila', 'anjingbabi']) {
            assert.equal(wordMode.flag(text), false, text);
            assert.deepEqual(wordMode.badwords(text), [], text);
            assert.deepEqual(wordMode.analyze(text).locations.map(({ word, index }) => ({ word, index })), [], text);
            assert.equal(wordMode.censor(text), text, text);
        }
        assert.equal(wordMode.flag('anj!ng, b@bi!'), true);
        assert.deepEqual(wordMode.analyze('anj!ng, b@bi!').locations.map(({ word, index }) => ({ word, index })), [
            { word: 'anjing', index: 0 },
            { word: 'babi', index: 8 }
        ]);
        assert.equal(wordMode.censor('anj!ng, b@bi!'), '***, ***!');
    });

    test('offers explicit substring censorship for issue #3 and its false-positive tradeoff', () => {
        const substring = new Badwords({ dictionary: ['asu'], mode: 'substring' });
        assert.equal(substring.censor('kamuasu'), 'kamu***');
        assert.equal(substring.censor('asusila'), '***sila');
        assert.equal(substring.analyze('kamuasu').censored, 'kamu***');
        assert.equal(substring.filter('kamuasu'), 'kamu');
    });

    test('replaces adjacent matches separately and overlapping spans once', () => {
        const adjacent = new Badwords({ dictionary: ['anjing', 'babi'], mode: 'substring' });
        assert.equal(adjacent.censor('anjingbabi'), '******');

        const overlap = new Badwords({ dictionary: ['aba', 'bab'], mode: 'substring' });
        const result = overlap.analyze('ababa');
        assert.deepEqual(result.locations.map(({ word, index }) => ({ word, index })), [
            { word: 'aba', index: 0 },
            { word: 'bab', index: 1 },
            { word: 'aba', index: 2 }
        ]);
        assert.equal(result.censored, '***');
    });

    test('uses Unicode letters, numbers and combining marks as word constituents', () => {
        for (const text of [
            'éanjing', 'anjingé', '猫anjing', 'anjing猫',
            '𐐀anjing', 'anjing𐐀', '2anjing', 'anjing2',
            '\u0301anjing', 'anjing\u0301'
        ]) {
            assert.equal(wordMode.flag(text), false, text);
            assert.equal(wordMode.censor(text), text, text);
        }
        assert.equal(wordMode.flag('😀anjing😀'), true);
        assert.equal(wordMode.censor('😀anjing😀'), '😀***😀');
    });

    test('uses one substring policy across every text method', () => {
        const custom = new Badwords({ dictionary: ['asu'], mode: 'substring' });
        const result = custom.analyze('kamuasu');
        assert.equal(custom.flag('kamuasu'), true);
        assert.deepEqual(custom.badwords('kamuasu'), ['asu']);
        assert.deepEqual(result.badwords, ['asu']);
        assert.deepEqual(result.locations.map(({ word, index }) => ({ word, index })), [{ word: 'asu', index: 4 }]);
        assert.equal(result.censored, 'kamu***');
        assert.equal(custom.censor('kamuasu'), 'kamu***');
        assert.equal(custom.filter('kamuasu'), 'kamu');
    });
});

describe('dictionary lifecycle and input behavior', () => {
    test('canonicalizes, deduplicates and ignores blank entries on construction and mutation', () => {
        const input = Object.freeze([' KUCEL ', 'kucel', '4NJ1NG', 'anjing', '', '\t']);
        const custom = new Badwords({ dictionary: input });
        assert.deepEqual(custom.dict, ['kucel', 'anjing']);
        assert.equal(custom.flag('KUCEL'), true);

        custom.addWords(Object.freeze([' KUCEL', 'B@BI ', 'babi', '  ']));
        assert.deepEqual(custom.dict, ['kucel', 'anjing', 'babi']);
        custom.removeWords(Object.freeze([' KUCEL ', '4NJ!NG', 'B@BI']));
        assert.deepEqual(custom.dict, []);
        assert.equal(custom.flag('kucel anjing babi'), false);
        assert.equal(custom.censor('kucel anjing babi'), 'kucel anjing babi');
    });

    test('keeps instances isolated and returns a dictionary copy', () => {
        const first = new Badwords({ dictionary: ['anjing'] });
        const second = new Badwords({ dictionary: ['anjing'] });
        const copied = first.dict;
        copied.push('babi');
        first.removeWords('anjing');
        assert.deepEqual(first.dict, []);
        assert.deepEqual(second.dict, ['anjing']);
        assert.equal(second.flag('babi'), false);
    });

    test('counts nonempty words across whitespace and handles whitespace-only input', () => {
        const detector = new Badwords({ dictionary: ['anjing'] });
        assert.equal(detector.analyze(' \tone\n two\r\nanjing  ').words, 3);
        assert.deepEqual(detector.analyze(' \t\n'), {
            text: ' \t\n', words: 0, censored: ' \t\n', badwords: [], count: 0, occurrenceCount: 0, locations: []
        });
    });

    test('preserves the validation contract for every text method', () => {
        const detector = new Badwords({ dictionary: [] });
        for (const method of ['flag', 'badwords', 'censor', 'filter', 'analyze']) {
            assert.doesNotThrow(() => detector[method](''));
            for (const input of [undefined, null, 1, {}, []]) {
                assert.throws(() => detector[method](input), /string expected/);
            }
        }
    });
});

describe('matching edge cases', () => {
    test('uses normalized lexical boundaries and preserves terminal punctuation', () => {
        const detector = new Badwords({ dictionary: ['asu', 'bacol', 'coli', 'pukima', 'pukimai'] });
        for (const text of ['asusila', 'a$u$ila', 'a5u5ila']) {
            assert.equal(detector.flag(text), false, text);
            assert.equal(detector.censor(text), text, text);
        }
        assert.deepEqual(detector.find('b@col! pukima!'), [
            { word: 'bacol', index: 0, end: 5, match: 'b@col' },
            { word: 'pukima', index: 7, end: 13, match: 'pukima' }
        ]);
        assert.equal(detector.censor('b@col! pukima!'), '***! ***!');
        assert.equal(new Badwords({ dictionary: ['babi'] }).flag('b4b|'), false);
    });

    test('keeps numeric-only inputs literal while folding mixed alphanumeric words', () => {
        const detector = new Badwords({ dictionary: ['tai', 'babi'] });
        for (const text of ['741', '8481', '７４１', 'nomor 741']) assert.equal(detector.flag(text), false, text);
        for (const mode of ['word', 'substring']) {
            const precise = new Badwords({ dictionary: ['tai', 'babi', 'goblok'], mode });
            for (const text of mode === 'word' ? ['741!halo', 'halo!8481', '741@halo', '8481$halo'] : ['741', '8481']) {
                assert.equal(precise.flag(text), false, `${mode}: ${text}`);
            }
            assert.deepEqual(precise.badwords('741!goblok'), ['goblok']);
        }
        assert.equal(detector.censor('t41 b4bi'), '*** ***');
        assert.equal(new Badwords({ dictionary: ['741'] }).censor('741'), '***');
    });

    test('does not let internal exclamations hide complete literal terms', () => {
        const detector = new Badwords({ dictionary: ['goblok', 'tolol', 'anjing', 'asu'] });
        for (const text of ['goblok!tolol', 'goblok！tolol', 'goblok\u200b!tolol']) {
            assert.equal(detector.censor(text), '***' + (text.includes('\u200b') ? '\u200b' : '')
                + (text.includes('！') ? '！' : '!') + '***', text);
            assert.equal(detector.analyze(text).censored, detector.censor(text));
        }
        assert.equal(detector.censor('anj!ng'), '***');
        assert.equal(detector.flag('a$u$ila'), false);
        assert.equal(detector.censor('goblok!baik'), '***!baik');
        for (const delimiter of ['︕', '﹗']) {
            assert.equal(detector.censor(`goblok${delimiter}tolol`), `***${delimiter}***`);
        }
    });

    test('rejects partial Unicode expansions even in substring mode', () => {
        for (const mode of ['word', 'substring']) {
            const detector = new Badwords({ dictionary: ['babi', 'i', 'f'], mode });
            for (const text of ['BABİ', 'babi\u0307', 'ﬃ']) assert.equal(detector.flag(text), false, text);
        }
        const full = new Badwords({ dictionary: ['ffi'], mode: 'substring' });
        assert.deepEqual(full.find('😀ﬃ!'), [{ word: 'ffi', index: 2, end: 3, match: 'ﬃ' }]);
        assert.equal(new Badwords({ dictionary: ['ff'], mode: 'substring' }).flag('ﬃ\u200b\u0301'), false);
        assert.equal(new Badwords({ dictionary: ['f'], mode: 'substring' }).flag('ﬀ\u200b\u0301'), false);
    });

    test('normalizes composed accents, compatibility Hangul and fullwidth spellings', () => {
        const detector = new Badwords({ dictionary: ['café', '가', 'kontol'] });
        assert.equal(detector.censor('cafe\u0301 ㄱㅏ ＫＯＮＴＯＬ!'), '*** *** ***!');
        assert.deepEqual(detector.find('😀cafe\u0301'), [{ word: 'café', index: 2, end: 7, match: 'cafe\u0301' }]);
    });

    test('matches invisibly split words without changing unmatched original text', () => {
        const detector = new Badwords({ dictionary: ['kontol'] });
        const text = '👩‍💻 kon\u200btol!';
        assert.deepEqual(detector.find(text), [{ word: 'kontol', index: 6, end: 13, match: 'kon\u200btol' }]);
        assert.equal(detector.censor(text), '👩‍💻 ***!');
        assert.equal(new Badwords({ dictionary: ['👩'], mode: 'substring' }).flag('👩‍💻'), false);
    });

    test('supports exact spelling and opt-in repeated-letter matching', () => {
        const exact = new Badwords({ dictionary: ['Kontol'], normalization: 'none' });
        assert.equal(exact.censor('kontol K0ntol Ｋontol Kontol'), 'kontol K0ntol Ｋontol ***');
        const stretched = new Badwords({ dictionary: ['goblok', 'bloon'], ignoreRepeatedLetters: true });
        assert.equal(stretched.censor('gooooblokk bloooon'), '*** ***');
        assert.equal(new Badwords({ dictionary: ['goblok'] }).flag('gooooblok'), false);
    });

    test('validates JavaScript options and dictionary mutations atomically', () => {
        for (const options of [null, [], { mode: 'invalid' }, { normalization: 'invalid' },
            { dictionary: 'word' }, { dictionary: [null] }, { ignoreRepeatedLetters: 1 },
            { maxMatches: 0 }, { maxMatches: NaN }, { maxMatches: '1' }, { maxMatches: null }]) {
            assert.throws(() => new Badwords(options), TypeError);
        }
        const detector = new Badwords({ dictionary: [] });
        assert.throws(() => detector.addWords(['newword', null]), TypeError);
        assert.throws(() => detector.addWords(['newword', ,]), TypeError);
        assert.deepEqual(detector.dict, []);
        assert.throws(() => detector.censor('word', null), TypeError);
        for (const method of ['flag', 'find', 'badwords', 'censor', 'filter', 'analyze']) {
            assert.throws(() => detector[method](null), TypeError);
            assert.doesNotThrow(() => detector[method](''));
        }
    });

    test('refreshes cached automata after adding and removing normalized entries', () => {
        const detector = new Badwords({ dictionary: ['kontol'] });
        assert.equal(detector.flag('goblok'), false);
        detector.addWords('G0BLOK');
        assert.equal(detector.flag('goblok'), true);
        detector.removeWords('g0blok');
        assert.equal(detector.flag('goblok'), false);
    });

    test('canonical dictionary keys round-trip through mixed obfuscation and Unicode spaces', () => {
        for (const spelling of ['b@81', 'b!81', '8@81', 'b@@81', '¨a', '¯a', '\u200b\tword', 'word\t\u200b',
            '1\u0301a', '0\u0301a', 'b|\u0301a']) {
            const detector = new Badwords({ dictionary: [spelling] });
            const snapshot = detector.dict;
            assert.equal(detector.flag(spelling), true, spelling);
            assert.equal(detector.flag(snapshot[0]), true, spelling);
            const clone = new Badwords({ dictionary: snapshot });
            assert.deepEqual(clone.dict, snapshot, spelling);
            assert.equal(clone.flag(spelling), true, spelling);
            detector.addWords(snapshot);
            assert.deepEqual(detector.dict, snapshot, spelling);
            detector.removeWords(snapshot);
            assert.deepEqual(detector.dict, [], spelling);
        }
        const detector = new Badwords({ dictionary: ['babi'] });
        assert.equal(detector.censor('b@81'), '***');
        assert.equal(detector.flag('8@81'), false);
    });

    test('longer folded terms take precedence over shorter literal prefixes at exclamations', () => {
        const detector = new Badwords({ dictionary: ['cuk', 'cukima', 'cukimak', 'goblok'] });
        assert.deepEqual(detector.badwords('cuk!ma'), ['cukima']);
        assert.equal(detector.censor('cuk!mak'), '***');
        assert.deepEqual(detector.badwords('goblok!cuk!ma'), ['cukima', 'goblok']);
        assert.equal(detector.censor('goblok!cuk!ma'), '***!***');
        const repeated = new Badwords({ dictionary: ['coli', 'colima'], ignoreRepeatedLetters: true });
        assert.deepEqual(repeated.badwords('coli!ma'), ['colima']);
        assert.equal(repeated.censor('coli!ma'), '***');
    });

    test('caps materialized matches while streaming unique words and censorship', () => {
        const detector = new Badwords({ dictionary: ['a', 'aa', 'aaa'], mode: 'substring', maxMatches: 4 });
        assert.equal(detector.find('aa').length, 3);
        assert.throws(() => detector.find('aaa'), { name: 'RangeError', message: /maxMatches/ });
        assert.throws(() => detector.analyze('aaa'), RangeError);
        assert.equal(detector.flag('a'.repeat(1000)), true);
        assert.deepEqual(detector.badwords('a'.repeat(1000)), ['a', 'aa', 'aaa']);
        assert.equal(detector.censor('a'.repeat(1000)), '***');
        assert.equal(new Badwords({ dictionary: ['a'], mode: 'substring', maxMatches: Infinity }).find('aaaaa').length, 5);
    });
});
