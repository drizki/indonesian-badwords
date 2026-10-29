import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { Badwords } from '../dist/esm/index.js';
import { bare } from './bare.mjs';

function paired(dictionary, settings = {}) {
    // An unused non-ASCII key selects the complete normalization/scanner path.
    return [new Badwords({ dictionary, ...settings }),
        new Badwords({ dictionary: [...dictionary, '\u{10ffff}'], ...settings })];
}

function callback(checker, text, options) {
    const contexts = [];
    const output = checker.censor(text, context => {
        assert.ok(Object.isFrozen(context));
        assert.ok(Object.isFrozen(context.words));
        contexts.push(context);
        return '$&$1$$';
    }, options);
    return { contexts, output };
}

function agree(checkers, text, options) {
    for (const method of ['flag', 'find', 'badwords', 'filter', 'analyze']) {
        assert.deepEqual(checkers[0][method](text, options), checkers[1][method](text, options), method + JSON.stringify(text));
    }
    assert.equal(checkers[0].censor(text, '$&$1$$', options), checkers[1].censor(text, '$&$1$$', options));
    assert.deepEqual(callback(checkers[0], text, options), callback(checkers[1], text, options));
}

test('stable Unicode matches use original offsets without constructing source maps', () => {
    const module = new URL('../dist/esm/index.js', import.meta.url).href;
    execFileSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        Intl.Segmenter = class { constructor() { throw new Error('unexpected segmentation'); } };
        const { Badwords } = await import(${JSON.stringify(module)});
        const bare = (list) => list.map(({ via, ...rest }) => rest);
        const checker = new Badwords();
        const text = 'café GOBLOK, g0bl0k!';
        const all = [{ word: 'goblok', index: 5, end: 11, match: 'GOBLOK' },
            { word: 'goblok', index: 13, end: 19, match: 'g0bl0k' }];
        for (const options of [undefined, { ignoreRanges: [{ index: 5, end: 11 }] }]) {
            const expected = options ? all.slice(1) : all;
            assert.equal(checker.flag(text, options), true);
            assert.deepEqual(bare(checker.find(text, options)), expected);
            assert.deepEqual(checker.badwords(text, options), ['goblok']);
            const censored = options ? 'café GOBLOK, ***!' : 'café ***, ***!';
            assert.equal(checker.censor(text, undefined, options), censored);
            assert.equal(checker.analyze(text, options).censored, censored);
            assert.deepEqual(bare(checker.analyze(text, options).locations), expected);
            assert.equal(checker.filter(text, options), options ? 'café GOBLOK, !' : 'café , !');
            const contexts = [];
            assert.equal(checker.censor(text, context => { contexts.push(context); return '***'; }, options), censored);
            assert.deepEqual(contexts.map(({ index, end, match }) => ({ index, end, match })),
                expected.map(({ index, end, match }) => ({ index, end, match })));
        }
        assert.equal(checker.flag('ΟΣ goblok'), true);
        assert.equal(checker.flag('café Ref 000000000012. goblok'), true);
    `]);
});

test('Unicode case, composition, word edges and original grapheme edges agree with the general scanner', () => {
    const checkers = paired(['goblok', 'tai', 'a', 'i', 't', 'ab', 'cd', 'ef']);
    for (const text of [
        'café GOBLOK goblok', 'é 😀 g0bl0k!', 'ΟΣ goblok', 'İ goblok', 'é T\u0308 goblok',
        'é 1\u0301 tai', 'é g0bl0k🏻', 'é \u0600goblok', 'é goblok\ufe0f',
        'é goblok\u200d👍', 'é 🇮🇩goblok', 'é gobloké', 'égoblok', 'é goblok\u0301',
        'é ＧＯＢＬＯＫ', 'é go\u200bblok', 'é go\u034fblok', 'é 𝐠𝐨𝐛𝐥𝐨𝐤',
        'é \r\u200b\ngoblok', 'é \u1100\u1161 goblok', '\ud800 é goblok \udfff',
        'Ref q000000000012q. café goblok', 'café Ref 000000000012. t41', 'café 741'
    ]) agree(checkers, text);
});

test('folded multipart candidates retain every overlapping callback contributor', () => {
    const dictionary = ['ab cd ef', 'cd ef', 'ab', 'ab cd', 'cd', 'ef'];
    const checkers = paired(dictionary);
    const text = 'café 4b cd 3f';
    agree(checkers, text);
    assert.deepEqual(callback(checkers[0], text).contexts, [
        { text, index: 5, end: 13, match: '4b cd 3f', words: dictionary }
    ]);
    const options = { ignoreRanges: [{ index: 7, end: 8 }] };
    agree(checkers, text, options);
    assert.deepEqual(callback(checkers[0], text, options).contexts.map(({ index, end, words }) => ({ index, end, words })), [
        { index: 5, end: 7, words: ['ab'] }, { index: 8, end: 13, words: ['cd ef', 'cd', 'ef'] }
    ]);
});

test('dense folded multipart dictionaries preserve uncapped contributor aggregation and scoped coverage', () => {
    const dictionary = Array.from({ length: 21 }, (_, index) => Array(index + 1).fill('aa').join(' '));
    const checkers = paired(dictionary, { maxMatches: 1 });
    const text = 'café ' + '4a '.repeat(128) + 'fin';
    for (const options of [undefined, { ignoreRanges: [{ index: 68, end: 69 }] }]) {
        assert.equal(checkers[0].flag(text, options), checkers[1].flag(text, options));
        assert.deepEqual(checkers[0].badwords(text, options), checkers[1].badwords(text, options));
        assert.equal(checkers[0].censor(text, '$&', options), checkers[1].censor(text, '$&', options));
        assert.deepEqual(callback(checkers[0], text, options), callback(checkers[1], text, options));
        assert.throws(() => checkers[0].find(text, options), RangeError);
    }
    assert.deepEqual(callback(checkers[0], text).contexts.map(({ index, end, words }) => ({ index, end, words })),
        [{ index: 5, end: text.length - 4, words: dictionary }]);
});

test('exceptions precede detailed limits, callback clustering and contributor deduplication', () => {
    const dictionary = ['goblok', 'tolol'];
    const checkers = paired(dictionary, { allowPhrases: ['café g0bl0k'], maxMatches: 1 });
    const text = 'café g0bl0k tolol g0bl0k';
    const options = { ignoreRanges: [{ index: 12, end: 17 }] };
    agree(checkers, text, options);
    assert.deepEqual(bare(checkers[0].find(text, options)), [{ word: 'goblok', index: 18, end: 24, match: 'g0bl0k' }]);
    assert.deepEqual(callback(checkers[0], text, options).contexts.map(({ index, end, words }) => ({ index, end, words })),
        [{ index: 18, end: 24, words: ['goblok'] }]);
    assert.throws(() => checkers[0].find(text), RangeError);
    assert.throws(() => checkers[0].analyze(text), RangeError);
    assert.equal(checkers[0].censor(text, '*'), 'café g0bl0k * *');
    const ignored = { ignoreRanges: [{ index: 0, end: text.length }] };
    assert.equal(checkers[0].flag(text, ignored), false);
    assert.equal(checkers[0].censor(text, () => assert.fail('suppressed callback'), ignored), text);
});

test('callback spans snapshot Unicode matches before dictionary and range mutations', () => {
    const checker = new Badwords({ dictionary: ['goblok'], maxMatches: 1 });
    const text = 'café g0bl0k g0bl0k';
    const ranges = [{ index: 0, end: 4 }];
    const contexts = [];
    assert.equal(checker.censor(text, context => {
        contexts.push(context);
        checker.removeWords('goblok');
        checker.addWords('new');
        ranges[0].end = text.length;
        return '$&';
    }, { ignoreRanges: ranges }), 'café $& $&');
    assert.deepEqual(contexts.map(({ index, end, words }) => ({ index, end, words })), [
        { index: 5, end: 11, words: ['goblok'] }, { index: 12, end: 18, words: ['goblok'] }
    ]);
    assert.equal(checker.flag(text), false);
    const failure = new Error('callback failed');
    const another = new Badwords({ dictionary: ['goblok'] });
    let calls = 0;
    assert.throws(() => another.censor(text, () => { calls++; throw failure; }), error => error === failure);
    assert.equal(calls, 1);
    assert.throws(() => another.censor(text, () => 1), /callback must return a string/);
});

test('Unicode candidate caches and the shared automaton refresh together after mutations', () => {
    const checkers = paired(['goblok']);
    for (const checker of checkers) { checker.flag('café kucel'); checker.censor('café goblok!tolol', () => '*'); }
    for (const [method, words] of [['addWords', ['KUCEL', 'ab cd']], ['removeWords', 'goblok'],
        ['addWords', 'café'], ['removeWords', 'café'], ['addWords', 'goblok']]) {
        for (const checker of checkers) checker[method](words);
        for (const text of ['café goblok kuc3l', 'café 4b cd', 'café goblok!tolol']) agree(checkers, text);
    }
});

test('unsupported policies and ambiguous bangs retain exact matching behavior with scopes and callbacks', () => {
    for (const settings of [{ mode: 'substring' }, { ignoreRepeatedLetters: true }, { normalization: 'none' }]) {
        const checkers = paired(['goblok', 'GOBLOK', 'cuk', 'cukima'], settings);
        for (const text of ['é xgoblokx GOBLOK', 'é gooooblok g0bl0k', 'é goblok!cuk!ma']) {
            agree(checkers, text, { ignoreRanges: [{ index: 0, end: 1 }] });
        }
    }
    const checkers = paired(['goblok', 'tolol', 'cuk', 'cukima']);
    for (const text of ['é goblok!tolol', 'é cuk!ma!tolol', 'é goblok！tolol', 'é goblok!goblok']) {
        agree(checkers, text);
    }
});

test('candidate callback aggregation matches independently clustered accepted locations', () => {
    let seed = 0x221c0de;
    const random = limit => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed >>> 4) % limit; };
    const words = ['ab', 'cd', 'ef', 'ab cd', 'cd ef', 'ab cd ef', 'ab-cd', 'cd-ef', 'ab-cd-ef'];
    for (let run = 0; run < 160; run++) {
        const dictionary = [...new Set(Array.from({ length: 1 + random(words.length) }, () => words[random(words.length)]))];
        const checkers = paired(dictionary, { allowPhrases: run % 2 ? ['cd 3f'] : [] });
        const text = 'café ' + Array.from({ length: 1 + random(6) }, () => random(2) ? '4b cd 3f' : '4b-cd-3f').join(' ; ');
        const options = { ignoreRanges: [{ index: 0, end: random(2) ? 4 : 7 }] };
        agree(checkers, text, options);
        const clusters = [];
        for (const location of checkers[1].find(text, options)) {
            const previous = clusters.at(-1);
            if (previous && location.index < previous.end) {
                previous.end = Math.max(previous.end, location.end);
                previous.words.add(location.word);
            } else clusters.push({ index: location.index, end: location.end, words: new Set([location.word]) });
        }
        assert.deepEqual(callback(checkers[0], text, options).contexts.map(({ index, end, words }) => ({ index, end, words })),
            clusters.map(({ index, end, words }) => ({ index, end, words: dictionary.filter(word => words.has(word)) })));
    }
});
