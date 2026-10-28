import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { Badwords, censor } from '../dist/esm/index.js';

function capture(checker, text, replacement = '*') {
    const contexts = [];
    const output = checker.censor(text, (context) => {
        contexts.push(context);
        return replacement;
    });
    return { contexts, output };
}

test('callbacks receive merged original spans and insertion-ordered contributors', () => {
    const checker = new Badwords({ dictionary: ['bab', 'aba', 'ababa'], mode: 'substring' });
    const text = '😀 ababa! ababa';
    const { contexts, output } = capture(checker, text, '$&');
    assert.equal(output, '😀 $&! $&');
    assert.deepEqual(contexts, [
        { text, index: 3, end: 8, match: 'ababa', words: ['bab', 'aba', 'ababa'] },
        { text, index: 10, end: 15, match: 'ababa', words: ['bab', 'aba', 'ababa'] }
    ]);
    for (const context of contexts) {
        assert.ok(Object.isFrozen(context));
        assert.ok(Object.isFrozen(context.words));
        assert.equal(context.match, context.text.slice(context.index, context.end));
    }
});

test('later matches bridge clusters, while adjacent spans receive separate calls', () => {
    const bridge = new Badwords({ dictionary: ['a', 'c', 'e', 'abcde'], mode: 'substring' });
    assert.deepEqual(capture(bridge, 'abcde').contexts, [
        { text: 'abcde', index: 0, end: 5, match: 'abcde', words: ['a', 'c', 'e', 'abcde'] }
    ]);
    const adjacent = new Badwords({ dictionary: ['a', 'b'], mode: 'substring' });
    assert.deepEqual(capture(adjacent, 'ab').contexts.map(({ index, end, words }) => ({ index, end, words })), [
        { index: 0, end: 1, words: ['a'] }, { index: 1, end: 2, words: ['b'] }
    ]);
    const repeated = new Badwords({ dictionary: ['bad', 'baad'], ignoreRepeatedLetters: true });
    assert.deepEqual(capture(repeated, 'baaad!').contexts[0].words, ['bad', 'baad']);
});

test('callback coordinates preserve Unicode expansions, ignored characters and punctuation', () => {
    const checker = new Badwords({ dictionary: ['ffi', 'é', 'kontol', 'goblok'] });
    const text = '😀 ﬃ! e\u0301, kon\u200btol? Ｇ０ＢＬＯＫ.';
    const { contexts, output } = capture(checker, text);
    assert.equal(output, '😀 *! *, *? *.');
    assert.deepEqual(contexts.map(({ match, index, end, words }) => ({ match, index, end, words })), [
        { match: 'ﬃ', index: 3, end: 4, words: ['ffi'] },
        { match: 'e\u0301', index: 6, end: 8, words: ['é'] },
        { match: 'kon\u200btol', index: 10, end: 17, words: ['kontol'] },
        { match: 'Ｇ０ＢＬＯＫ', index: 19, end: 25, words: ['goblok'] }
    ]);
    const partial = new Badwords({ dictionary: ['f'], mode: 'substring' });
    assert.equal(partial.censor('ﬃ', () => '*'), 'ﬃ');
});

test('callbacks are a per-call snapshot and errors propagate in source order', () => {
    const checker = new Badwords({ dictionary: ['a'], mode: 'substring' });
    const matches = [];
    assert.equal(checker.censor('a a', (context) => {
        matches.push(context.index);
        checker.removeWords('a');
        checker.addWords('new');
        return '';
    }), ' ');
    assert.deepEqual(matches, [0, 2]);
    assert.equal(checker.flag('a'), false);
    const error = new Error('replacement failed');
    let calls = 0;
    assert.throws(() => censor('goblok kontol', () => { calls++; throw error; }), (value) => value === error);
    assert.equal(calls, 1);
    assert.equal(censor('goblok!', () => '$& $1 $$'), '$& $1 $$!');
});

test('invalid callback returns throw and clean/empty text never invokes callbacks', () => {
    for (const result of [undefined, null, false, 1, 1n, Symbol('x'), () => 'x', {}, [], Promise.resolve('x'), new String('x')]) {
        assert.throws(() => censor('goblok', () => result), /callback must return a string/);
    }
    const fail = () => assert.fail('clean text invoked callback');
    assert.equal(censor('', fail), '');
    assert.equal(censor('terima kasih', fail), 'terima kasih');
    assert.equal(new Badwords({ dictionary: [] }).censor('goblok', fail), 'goblok');
    for (const value of [null, 1, {}, []]) {
        assert.throws(() => censor(value, () => '*'), TypeError);
        assert.throws(() => censor('goblok', value), TypeError);
    }
});

test('dense overlaps aggregate contributors without consuming maxMatches', () => {
    const dictionary = Array.from({ length: 64 }, (_, index) => 'a'.repeat(index + 1));
    const checker = new Badwords({ dictionary, mode: 'substring', maxMatches: 1 });
    const text = 'a'.repeat(10_000);
    const { contexts, output } = capture(checker, text);
    assert.equal(output, '*');
    assert.equal(contexts.length, 1);
    assert.deepEqual(contexts[0].words, dictionary);
    assert.equal(contexts[0].end, text.length);
    assert.throws(() => checker.find(text), RangeError);
    assert.throws(() => checker.analyze(text), RangeError);
});

test('merged callback metadata agrees with an independent all-occurrences oracle', () => {
    let state = 0x214021;
    const random = (limit) => {
        state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
        return (state >>> 0) % limit;
    };
    const atoms = ['a', 'b', 'c', ' ', '!', 'é', 'e\u0301', 'ﬃ', '😀', '\u200b', 'Ａ', '0'];
    for (let trial = 0; trial < 1200; trial++) {
        const dictionary = Array.from({ length: 1 + random(10) }, () =>
            Array.from({ length: 1 + random(5) }, () => atoms[random(atoms.length)]).join(''));
        const text = Array.from({ length: 1 + random(45) }, () => atoms[random(atoms.length)]).join('');
        const checker = new Badwords({ dictionary, mode: trial & 1 ? 'word' : 'substring',
            normalization: trial & 2 ? 'standard' : 'none', ignoreRepeatedLetters: !!(trial & 4), maxMatches: Infinity });
        const order = new Map(checker.dict.map((word, index) => [word, index]));
        const expected = [];
        for (const location of checker.find(text)) {
            const previous = expected.at(-1);
            if (previous && location.index < previous.end) {
                previous.end = Math.max(previous.end, location.end);
                previous.words.add(location.word);
            } else expected.push({ index: location.index, end: location.end, words: new Set([location.word]) });
        }
        const contexts = expected.map(({ index, end, words }) => ({ text, index, end,
            match: text.slice(index, end), words: [...words].sort((a, b) => order.get(a) - order.get(b)) }));
        const actual = capture(checker, text);
        assert.deepEqual(actual.contexts, contexts, `trial ${trial}: ${JSON.stringify({ dictionary, text })}`);
        assert.equal(actual.output, checker.censor(text, '*'), `literal parity trial ${trial}`);
    }
});

test('optional strategies retain ESM/CommonJS identity and import lazily', async () => {
    const esm = await import('../dist/esm/censor.js');
    const cjs = createRequire(import.meta.url)('../dist/cjs/censor.js');
    assert.equal(esm.mask, cjs.mask);
    assert.equal(esm.grawlix, cjs.grawlix);
    const script = `
        let calls = 0;
        Intl.Segmenter = class { constructor() { calls++; throw Error('eager segmenter'); } };
        const api = require('./dist/cjs/index.js');
        if (!api.flag('goblok') || api.censor('goblok') !== '***') throw Error('root behavior');
        if (Object.keys(require.cache).some(path => path.endsWith('/censor.js'))) throw Error('root loaded strategies');
        require('./dist/cjs/censor.js');
        if (calls) throw Error('import eagerly created Intl.Segmenter');
    `;
    execFileSync(process.execPath, ['-e', script], { cwd: new URL('..', import.meta.url) });
});
