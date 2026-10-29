import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { Badwords, dictionary } from '../dist/esm/index.js';
import { bare } from './bare.mjs';

// A non-ASCII dictionary entry disables the bounded native ASCII matcher but
// cannot match these inputs. This provides the same policy through the general
// automaton, independently of which optimization a caller happens to exercise.
function paired(dictionary, options = {}) {
    return [new Badwords({ dictionary, ...options }), new Badwords({ dictionary: [...dictionary, 'Ω'], ...options })];
}

function agree(checkers, text) {
    const [native, general] = checkers;
    for (const method of ['flag', 'find', 'badwords', 'filter', 'analyze']) {
        assert.deepEqual(native[method](text), general[method](text), `${method}: ${JSON.stringify(text)}`);
    }
    for (const replacement of ['***', '', '$&$1$$', "$`$'", '[$<name>]', '\n']) {
        assert.equal(native.censor(text, replacement), general.censor(text, replacement), `censor: ${JSON.stringify(text)}`);
    }
}

describe('native matching and general scanner equivalence', () => {
    test('shares case, boundary, punctuation, and literal replacement semantics', () => {
        const checkers = paired(['goblok', 'kontol', 'tolol']);
        for (const text of [
            '', 'Pesanan sudah sampai.', 'Nomor pesanan 12345.', 'GOBLOK! (Kontol), tolol?',
            'goblok_kontol', '_goblok_', "'goblok'", 'xgoblokx',
            'g0bl0k', 'goblok!kontol', 'k0nt0l', 'goblok@kontol', 'tolol\tkontol\ngoblok',
            '😀goblok👍', 'égoblok', 'gobloké', 'goblok\u0301', 'ＧＯＢＬＯＫ', 'go\u200bblok'
        ]) agree(checkers, text);
    });

    test('exact spelling mode retains uppercase and numeric custom entries', () => {
        const checkers = paired(['Bad', 'bad', '123', 'UPPER'], { normalization: 'none' });
        for (const text of ['Bad bad BAD UPPER upper', '123 1234', '_Bad_', 'Bad!bad', 'éBad', '😀Bad']) {
            agree(checkers, text);
        }
    });

    test('complex literal terms retain overlapping occurrences and union spans', () => {
        const checkers = paired(['a', 'b', 'c', 'a.b', 'b.c', "a'b", "b'c", 'a b', 'b c', '[bad]', 'x+y']);
        for (const text of ['a.b.c', "a'b'c", 'a b c', '[bad] x+y', 'axb xxy', 'A.B.C']) agree(checkers, text);
        assert.equal(checkers[0].censor('a.b.c'), '***');
        assert.equal(checkers[0].find('a.b.c').length, 5);
    });

    test('censoring safe literal phrases still merges crossing and repeated spans', () => {
        for (const words of [['a.b', 'b.c'], ['a b', 'b c'], ['esek-esek']]) {
            const checkers = paired(words);
            for (const text of ['a.b.c', 'a b c', 'esek-esek-esek', 'ESEK-ESEK-ESEK-ESEK']) agree(checkers, text);
        }
        assert.equal(new Badwords({ dictionary: ['esek-esek'] }).censor('esek-esek-esek'), '***');
        assert.equal(new Badwords({ dictionary: ['a.b', 'b.c'] }).censor('a.b.c'), '***');
    });

    test('candidate checks retain normalized boundaries and Unicode source graphemes', () => {
        const checkers = paired(['goblok', 'kontol', 'tai', 'idiot', 'ai', 'aib', 'ib']);
        for (const text of [
            'Pesanan #123: nama@example.org; status=(OK).', 'goblok!kontol', 'a!b!a',
            'goblok@kontol', 't41', '741', '_goblok_', '123_goblok_456',
            '😀goblok👍kontol', 'goblok🏻', 'goblok\ufe0f', 'goblok\u200d👍',
            '🇮🇩goblok', '™goblok', 'ℹgoblok', '😀g0bl0k👍', '😀go\u200bblok👍'
        ]) agree(checkers, text);
        assert.deepEqual(bare(checkers[0].find('😀goblok👍')), [{ word: 'goblok', index: 2, end: 8, match: 'goblok' }]);
        for (let code = 0; code < 128; code++) {
            const separator = String.fromCharCode(code);
            agree(checkers, `${separator}goblok${separator}kontol${separator}`);
        }
    });

    test('long ordinary words stay clean without changing substring or repeat policies', () => {
        const checker = new Badwords({ dictionary: ['goblok'] });
        for (const text of ['goblokx', 'xgoblok', 'g0bl0kx', '741'.repeat(2_000), 'goblok'.repeat(2_000)]) {
            assert.equal(checker.flag(text), false);
            assert.equal(checker.censor(text), text);
            assert.deepEqual(bare(checker.find(text)), []);
        }
        assert.equal(checker.flag('g0bl0k'), true);
        assert.equal(new Badwords({ dictionary: ['goblok'], mode: 'substring' }).flag('xgoblokx'), true);
        assert.equal(new Badwords({ dictionary: ['goblok'], ignoreRepeatedLetters: true }).flag('goooblok'), true);
        assert.equal(new Badwords({ dictionary: ['123'], normalization: 'none' }).flag('123'), true);
    });

    test('invalidates every cached matcher after dictionary changes', () => {
        const detector = new Badwords({ dictionary: ['goblok'] });
        assert.equal(detector.censor('goblok kontol'), '*** kontol');
        detector.addWords('kontol');
        assert.equal(detector.censor('goblok kontol'), '*** ***');
        detector.removeWords('goblok');
        assert.equal(detector.flag('goblok'), false);
        detector.addWords('Ω');
        assert.equal(detector.flag('kontol'), true);
        detector.removeWords('Ω');
        assert.deepEqual(bare(detector.find('kontol')), [{ word: 'kontol', index: 0, end: 6, match: 'kontol' }]);
        detector.addWords('a.b');
        assert.equal(detector.censor('a.b'), '***');
        detector.removeWords('a.b');
        assert.equal(detector.censor('a.b'), 'a.b');
    });

    test('reuses global native patterns without leaking their last index', () => {
        const detector = new Badwords({ dictionary: ['goblok'] });
        for (let index = 0; index < 10; index++) {
            assert.equal(detector.flag('goblok'), true);
            assert.equal(detector.flag('kalimat bersih'), false);
            assert.equal(detector.censor('goblok'), '***');
            assert.equal(detector.find('goblok goblok').length, 2);
            assert.equal(detector.flag('goblok'), true);
        }
    });

    test('keeps the detailed-match budget and streaming censorship separate', () => {
        const detector = new Badwords({ dictionary: ['goblok'], maxMatches: 2 });
        const text = 'goblok goblok goblok';
        assert.throws(() => detector.find(text), RangeError);
        assert.throws(() => detector.analyze(text), RangeError);
        assert.equal(detector.censor(text), '*** *** ***');
        assert.deepEqual(detector.badwords(text), ['goblok']);

        const prefixes = new Badwords({ dictionary: ['a', 'aa', 'aaa'], mode: 'substring', maxMatches: 2 });
        assert.equal(prefixes.censor('aaaa'), '***');
        assert.throws(() => prefixes.find('aaaa'), RangeError);
    });

    test('trusted default dictionaries stay canonical and instance-owned', () => {
        const first = new Badwords();
        const second = new Badwords({ dictionary });
        assert.deepEqual(first.dict, second.dict);
        first.removeWords(dictionary[0]);
        assert.ok(second.dict.includes(dictionary[0]));
        assert.ok(dictionary.includes(dictionary[0]));
    });
});
