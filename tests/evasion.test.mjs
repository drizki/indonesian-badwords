import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Badwords } from '../dist/esm/index.js';
import { boundedEvasion, latinLookalikes, EvasionLimitError } from '../dist/esm/evasion.js';

const separators = { characters: [' ', '.', '_', '-'], maxGap: 1, maxTotal: 8 };
const repetitions = { maxExtraPerLetter: 2, maxTotal: 8 };
const confusables = { mappings: latinLookalikes, maxTotal: 2 };
const profile = options => boundedEvasion({ separators, repetitions, confusables, ...options });
function spans(locations) {
    const result = [];
    for (const { index, end } of locations) {
        const previous = result.at(-1);
        if (previous && index < previous.end) previous.end = Math.max(previous.end, end);
        else result.push({ index, end });
    }
    return result;
}
function render(text, locations, replacement = '***') {
    let from = 0, result = '';
    for (const span of spans(locations)) { result += text.slice(from, span.index) + replacement; from = span.end; }
    return result + text.slice(from);
}
function consistent(checker, text, options) {
    const locations = checker.find(text, options);
    const words = checker.dict.filter(word => locations.some(hit => hit.word === word));
    const result = checker.analyze(text, options);
    assert.equal(checker.flag(text, options), locations.length > 0);
    assert.deepEqual(checker.badwords(text, options), words);
    assert.deepEqual(result.locations, locations);
    assert.equal(result.occurrenceCount, locations.length);
    assert.equal(result.count, words.length);
    assert.deepEqual(result.badwords, words);
    assert.equal(result.censored, render(text, locations));
    assert.equal(checker.censor(text, '$&', options), render(text, locations, '$&'));
    assert.equal(checker.filter(text, options), render(text, locations, '').replace(/\s+/gu, ' ').trim());
    const calls = [];
    assert.equal(checker.censor(text, context => { calls.push(context); return '#'; }, options), render(text, locations, '#'));
    assert.deepEqual(calls.map(({ index, end, match, words }) => ({ index, end, match, words })),
        spans(locations).map(({ index, end }) => ({ index, end, match: text.slice(index, end),
            words: checker.dict.filter(word => locations.some(hit => hit.word === word && hit.index < end && hit.end > index)) })));
    for (const hit of locations) assert.equal(hit.match, text.slice(hit.index, hit.end));
    return locations;
}

test('explicit transformations compose with original-source spans across every API', () => {
    const checker = new Badwords({ dictionary: ['goblok', 'kontol', 'babi'], evasion: profile() });
    for (const text of ['g-o-b-l-o-k', 'gοblοk', 'g_o_o_b_l_o_k', 'g-o-b-l-o-k kontol', 'goblok!kontol',
        '😀 ｇ－ｏ－ｂ－ｌ－ｏ－ｋ!', 'go\u200bblok', 'goblok-k', 'k0nt0l', '👩‍💻 g-o-b-l-o-k'])
        assert.ok(consistent(checker, text).length, text);
    for (const text of ['g--o-b-l-o-k', 'g\no-b-l-o-k', 'g\ro-b-l-o-k', 'g\r\no-b-l-o-k', 'goblók',
        'xg-o-b-l-o-k', 'g-o-b-l-o-kx', 'gooooblok', 'gοblοк', 'cat dog', 'Saya pergi ke pantai.'])
        assert.equal(consistent(checker, text).length, 0, text);
    assert.deepEqual(checker.find('goblok-k').map(({ index, end }) => [index, end]), [[0, 6], [0, 8]]);
    assert.deepEqual(checker.find('_goblok_'), [{ word: 'goblok', index: 1, end: 7, match: 'goblok' }]);
    assert.equal(new Badwords({ dictionary: ['goblok'], evasion: profile({ separators: undefined, confusables: undefined }) }).flag('g-o-b-l-o-k'), false);
});

test('each family is opt-in, and key length eligibility does not change literal matching', () => {
    for (const selected of [{ separators }, { repetitions }, { confusables }]) {
        const checker = new Badwords({ dictionary: ['goblok', 'asu', 'a b', 'é', '👩‍💻'], evasion: boundedEvasion(selected) });
        assert.equal(checker.flag('g-o-b-l-o-k'), Boolean(selected.separators));
        assert.equal(checker.flag('goooblok'), Boolean(selected.repetitions));
        assert.equal(checker.flag('gοblοk'), Boolean(selected.confusables));
        for (const literal of checker.dict) assert.ok(consistent(checker, literal).length, literal);
        assert.equal(checker.flag('a-s-u'), false);
    }
    assert.equal(new Badwords({ dictionary: ['asu'], evasion: boundedEvasion({ minLength: 3, separators }) }).flag('a-s-u'), true);
    assert.equal(new Badwords({ dictionary: ['goblok'], evasion: boundedEvasion({ maxLength: 5, separators }) }).flag('g-o-b-l-o-k'), false);
    const exactCase = new Badwords({ dictionary: ['GOBLOK'], normalization: 'none', evasion: profile() });
    assert.equal(exactCase.flag('G-O-B-L-O-K'), true);
    assert.equal(exactCase.flag('GOOBLOK'), true);
    assert.equal(exactCase.flag('GooBLOK'), false);
    assert.equal(exactCase.flag('g-o-b-l-o-k'), false);
    assert.equal(exactCase.flag('GΟBLΟK'), false);
    assert.equal(new Badwords({ dictionary: ['aa'], normalization: 'none', evasion: profile({ minLength: 1 }) }).find('aaaa').length, 1);
});

test('whole original graphemes and compatibility expansions cannot be split', () => {
    const checker = new Badwords({ dictionary: ['i', 'ffi', 'é', '👩‍💻', '\ud800'], evasion: profile({ minLength: 1 }) });
    assert.deepEqual(consistent(checker, 'ﬃ').map(hit => hit.word), ['ffi']);
    assert.deepEqual(consistent(checker, 'e\u0301').map(hit => hit.word), ['é']);
    assert.equal(consistent(new Badwords({ dictionary: ['a'], evasion: profile({ minLength: 1 }) }), 'a\u0301').length, 0);
    consistent(checker, '👩‍💻 \ud800');
    const unicode = new Badwords({ dictionary: ['goblok'], normalization: 'none', evasion: profile() });
    assert.equal(unicode.flag('ｇ－ｏ－ｂ－ｌ－ｏ－ｋ'), false);
    assert.equal(unicode.flag('go\u200bblok'), false);
});

test('scopes reject original-span intersections and contained phrases without expanding exceptions', () => {
    const checker = new Badwords({ dictionary: ['bodo', 'goblok'], allowPhrases: ['Baju Bodo'], evasion: profile() });
    assert.deepEqual(consistent(checker, 'Baju Bodo, b-o-d-o').map(hit => hit.match), ['b-o-d-o']);
    assert.equal(consistent(checker, 'Baju b-o-d-o').length, 1);
    assert.equal(consistent(checker, 'g-o-b-l-o-k', { ignoreRanges: [{ index: 1, end: 2 }] }).length, 0);
    assert.equal(consistent(checker, 'g-o-b-l-o-k goblok', { ignoreRanges: [{ index: 1, end: 2 }] }).length, 1);
    assert.equal(consistent(checker, 'g-o-b-l-o-k', { ignoreRanges: [{ index: 11, end: 11 }] }).length, 1);
    assert.throws(() => checker.flag('👩‍💻', { ignoreRanges: [{ index: 1, end: 2 }] }), RangeError);
    const adjacent = new Badwords({ dictionary: ['aa'], mode: 'substring', allowPhrases: ['a a'], evasion: profile({ minLength: 1 }) });
    consistent(adjacent, 'a a a a');
    const none = new Badwords({ dictionary: ['goblok'], allowPhrases: ['goblok'], evasion: profile() });
    assert.equal(consistent(none, 'goblok g-o-b-l-o-k').length, 1);
});

test('dictionary mutation is atomic on compile/material errors and invalidates all compiled policy data', () => {
    const evasion = boundedEvasion({ minLength: 1, separators, limits: { maxCompileStates: 5, maxDictionaryLength: 12 } });
    const checker = new Badwords({ dictionary: ['ab'], evasion });
    const other = new Badwords({ dictionary: ['cd'], evasion });
    assert.equal(checker.flag('a-b'), true);
    assert.throws(() => checker.addWords(['cd', 'ef']), error => error instanceof EvasionLimitError && error.limit === 'compileStates');
    assert.deepEqual(checker.dict, ['ab']);
    assert.equal(checker.flag('a-b'), true);
    assert.equal(checker.flag('c-d'), false);
    checker.addWords('cd');
    assert.equal(checker.flag('c-d'), true);
    checker.removeWords('ab');
    assert.deepEqual(checker.dict, ['cd']);
    assert.equal(checker.flag('a-b'), false);
    assert.deepEqual(other.dict, ['cd']);
    assert.equal(other.flag('a-b'), false);
    assert.throws(() => checker.removeWords('x'.repeat(13)), EvasionLimitError);
    assert.deepEqual(checker.dict, ['cd']);
    const expanded = new Badwords({ dictionary: [], evasion: boundedEvasion({ repetitions, limits: { maxDictionaryLength: 2 } }) });
    assert.throws(() => expanded.addWords('ﬃ'), error => error instanceof EvasionLimitError && error.limit === 'dictionaryLength');
    assert.deepEqual(expanded.dict, []);
});

test('input, state, work, dictionary and compile budget exhaustion are typed and never clean', () => {
    const invoke = checker => [() => checker.flag('aaaaab'), () => checker.find('aaaaab'), () => checker.badwords('aaaaab'),
        () => checker.censor('aaaaab'), () => checker.censor('aaaaab', () => '*'), () => checker.filter('aaaaab'), () => checker.analyze('aaaaab')];
    for (const [limit, limits] of [['input', { maxInputLength: 5 }], ['states', { maxStates: 1 }], ['steps', { maxSteps: 1 }]]) {
        const checker = new Badwords({ dictionary: ['aab'], mode: 'substring', evasion: boundedEvasion({ minLength: 1, repetitions, limits }) });
        for (const call of invoke(checker)) assert.throws(call, error => error instanceof EvasionLimitError && error instanceof RangeError
            && error.limit === limit && error.used > error.maximum);
    }
    for (const dictionary of [[], ['a']]) {
        const checker = new Badwords({ dictionary, evasion: boundedEvasion({ repetitions, limits: { maxInputLength: 1 } }) });
        assert.throws(() => checker.flag('clean'), error => error instanceof EvasionLimitError && error.limit === 'input');
    }
    assert.throws(() => new Badwords({ dictionary: ['a'], evasion: boundedEvasion({ repetitions, limits: { maxCompileStates: 1 } }) }), EvasionLimitError);
    assert.throws(() => new Badwords({ dictionary: ['aa', 'aa'], evasion: boundedEvasion({ repetitions, limits: { maxDictionaryLength: 3 } }) }), EvasionLimitError);
    const checker = new Badwords({ dictionary: ['goblok'], evasion: boundedEvasion({ separators, limits: { maxSteps: 120 } }) });
    const text = 'g-o-b-l-o-k ' + 'g-o-'.repeat(200);
    assert.equal(checker.flag(text), true);
    let callbacks = 0;
    assert.throws(() => checker.censor(text, () => { callbacks++; return '*'; }), EvasionLimitError);
    assert.equal(callbacks, 0);
});

test('streaming and aggregated sinks remain usable beyond the detailed occurrence cap', () => {
    const dictionary = Array.from({ length: 24 }, (_, i) => 'a'.repeat(i + 1));
    const checker = new Badwords({ dictionary, mode: 'substring', maxMatches: 1, evasion: boundedEvasion({ minLength: 1, repetitions }) });
    const text = 'a'.repeat(128);
    assert.throws(() => checker.find(text), RangeError);
    assert.throws(() => checker.analyze(text), RangeError);
    assert.equal(checker.flag(text), true);
    assert.deepEqual(checker.badwords(text), dictionary);
    assert.equal(checker.censor(text), '***');
    let calls = 0;
    assert.equal(checker.censor(text, ({ index, end, words }) => {
        calls++; assert.equal(index, 0); assert.equal(end, text.length); assert.deepEqual(words, dictionary); return '$&';
    }), '$&');
    assert.equal(calls, 1);
    const hidden = { ignoreRanges: [{ index: 0, end: 128 }] };
    assert.equal(checker.flag(text, hidden), false);
    assert.deepEqual(checker.badwords(text, hidden), []);
    assert.equal(checker.censor(text, hiddenText => hiddenText.match, hidden), text);
});

test('budget boundaries and ambiguous repeated letters retain every distinct source span once', () => {
    for (const [settings, text, expected] of [
        [{ separators: { ...separators, maxTotal: 4 } }, 'g-o-b-l-o-k', false],
        [{ separators: { ...separators, maxTotal: 5 } }, 'g-o-b-l-o-k', true],
        [{ repetitions: { maxExtraPerLetter: 1, maxTotal: 1 } }, 'gooblook', false],
        [{ repetitions: { maxExtraPerLetter: 1, maxTotal: 2 } }, 'gooblook', true],
        [{ confusables: { mappings: latinLookalikes, maxTotal: 1 } }, 'gοblοk', false],
        [{ confusables: { mappings: latinLookalikes, maxTotal: 2 } }, 'gοblοk', true]
    ]) assert.equal(new Badwords({ dictionary: ['goblok'], evasion: boundedEvasion(settings) }).flag(text), expected);
    const checker = new Badwords({ dictionary: ['aa', 'aaa'], mode: 'substring', evasion: profile({ minLength: 1 }) });
    const found = consistent(checker, 'a-a-a-a');
    assert.equal(new Set(found.map(hit => `${hit.word}:${hit.index}:${hit.end}`)).size, found.length);
    const wholeScript = new Badwords({ dictionary: ['aaaa'], evasion: boundedEvasion({ confusables: { mappings: latinLookalikes, maxTotal: 4 } }) });
    assert.equal(wholeScript.flag('аааа'), false);
    assert.equal(new Badwords({ dictionary: ['aaaa'], evasion: boundedEvasion({ confusables: { mappings: latinLookalikes, maxTotal: 4, requireAsciiLetter: false } }) }).flag('аааа'), true);
    const asciiMapping = new Badwords({ dictionary: ['aaaa'], evasion: boundedEvasion({ confusables: { mappings: [['b', 'a']], maxTotal: 4 } }) });
    assert.equal(asciiMapping.flag('bbbb'), false);
    assert.equal(asciiMapping.flag('abbb'), true);
    assert.equal(asciiMapping.flag('ABBB'), true);
});

test('configuration is explicit, strictly validated and copied immutably', () => {
    const invalid = [undefined, null, [], {}, { minLength: null, repetitions }, { minLength: 0, repetitions },
        { maxLength: 3, repetitions }, { fuzzy: true }, { repetitions: null }, { repetitions: {} },
        { repetitions: { ...repetitions, extra: 1 } }, { repetitions: { maxExtraPerLetter: 0, maxTotal: 1 } },
        { separators: { ...separators, characters: [] } }, { separators: { ...separators, characters: ['a'] } },
        { separators: { ...separators, characters: ['👩‍💻'] } }, { separators: { ...separators, characters: ['\n'] } },
        { separators: { ...separators, characters: ['\ud800'] } }, { separators: { ...separators, characters: ['\u200b'] } },
        { confusables: { mappings: [['ab', 'a']], maxTotal: 1 } }, { confusables: { mappings: [['a', 'aa']], maxTotal: 1 } },
        { confusables: { mappings: [['\uff9e', 'a']], maxTotal: 1 } }, { confusables: { mappings: latinLookalikes, maxTotal: 1, requireAsciiLetter: 1 } },
        { repetitions, limits: { maxInputLength: null } }, { repetitions, limits: { maxStates: 1_048_577 } },
        { repetitions, limits: { maxSteps: Infinity } }, { repetitions, limits: { surprise: 1 } },
        { repetitions, limits: new Date() }, { repetitions, [Symbol('unknown')]: true }];
    for (const options of invalid) assert.throws(() => boundedEvasion(options), undefined, JSON.stringify(options));
    assert.throws(() => new Badwords({ evasion: profile(), ignoreRepeatedLetters: true }), TypeError);
    for (const evasion of [{}, Object.freeze({}), null, 'yes']) assert.throws(() => new Badwords({ evasion }), TypeError);
    for (const character of ['@', '!', '(']) assert.throws(() => new Badwords({ evasion: boundedEvasion({ separators: { characters: [character], maxGap: 1, maxTotal: 1 } }) }), TypeError);
    assert.throws(() => new Badwords({ evasion: boundedEvasion({ confusables: { mappings: [['а', 'a'], ['А', 'b']], maxTotal: 1 } }) }), TypeError);
    assert.throws(() => new Badwords({ evasion: boundedEvasion({ confusables: { mappings: [['Ａ', 'a']], maxTotal: 1 } }) }), TypeError);
    const characters = ['-'], mappings = [['а', 'a']];
    const configuration = { minLength: 1, separators: { characters, maxGap: 1, maxTotal: 4 }, confusables: { mappings, maxTotal: 1 } };
    const selected = boundedEvasion(configuration);
    characters[0] = '!'; mappings[0][1] = 'z'; configuration.minLength = 100;
    const checker = new Badwords({ dictionary: ['babi'], evasion: selected });
    assert.equal(checker.flag('b-а-b-i'), true);
    assert.equal(checker.flag('b!a!b!i'), false);
    assert.ok(Object.isFrozen(selected));
    assert.ok(Object.isFrozen(latinLookalikes));
    assert.ok(latinLookalikes.every(Object.isFrozen));
});

// Authored contrasts exercise each selected letter mapping and benign word edges.
// They are deterministic regression examples, not independently reviewed traffic data.
test('selected lookalikes preserve benign Indonesian text and foreign-script word boundaries', () => {
    const pairs = { a: ['babi', 'abadi'], e: ['memek', 'mereka'], o: ['goblok', 'sekolah'],
        p: ['perek', 'periksa'], c: ['bacot', 'bicara'], y: ['yatim', 'sayur'],
        x: ['sex', 'taksi'], i: ['babi', 'istirahat'], j: ['jancuk', 'jadwal'], s: ['setan', 'sesama'] };
    for (const [source, target] of latinLookalikes) {
        const [term, benign] = pairs[target];
        const checker = new Badwords({ dictionary: [term], evasion: boundedEvasion({ minLength: 3,
            confusables: { mappings: [[source, target]], maxTotal: 1 } }) });
        const attack = term.replace(target, source), harmless = benign.replace(target, source);
        assert.equal(checker.flag(`Dasar ${attack}!`), true, `${source} -> ${target}`);
        assert.equal(checker.flag(`Kami membahas ${harmless} hari ini.`), false);
        assert.equal(checker.flag(`ж${attack}ж`), false);
        assert.equal(checker.flag(`Kami membahas ${benign} hari ini.`), false);
    }
});


test('untransformed Unicode, punctuation and mixed dictionaries retain exact baseline semantics', () => {
    const dictionary = ['goblok', 'kontol', 'i', 'ffi', 'é', '👩‍💻', 'a b', 'a!', '!b', 'a.b',
        '가', 'İ', 'a/c', '(', '$', 'foo_bar', 'GreekΣ', '\ud800'];
    const sources = ['goblok!kontol', 'anj!ng!a', 'goblok!tolol', 'goblók', 'a!b', 'a b', 'a.b',
        'ﬃ é é', '👩‍💻', '가', 'İ i i̇', '℀', 'foo_bar', '( $', 'GreekΣ', '\ud800',
        'g0bl0k', 'ｇｏｂｌｏｋ', 'kon\u200btol', '😀 k0nt0l!', 'goblok-k'];
    for (const normalization of ['standard', 'none']) for (const mode of ['word', 'substring']) {
        const baseline = new Badwords({ dictionary, normalization, mode });
        const configured = new Badwords({ dictionary, normalization, mode, evasion: boundedEvasion({
            confusables: { mappings: [['ҁ', 'a']], maxTotal: 1 }
        }) });
        for (const text of sources) {
            assert.deepEqual(configured.find(text), baseline.find(text), JSON.stringify({ text, mode, normalization }));
            assert.equal(configured.censor(text), baseline.censor(text));
            consistent(configured, text);
        }
    }
});


test('candidate rejection preserves post-fold composition, transitive classes and literal punctuation', () => {
    const checker = new Badwords({ dictionary: ['gabc'], evasion: boundedEvasion({
        confusables: { mappings: [['é', 'a']], maxTotal: 1 }
    }) });
    assert.equal(checker.flag('g3́bc'), true);
    consistent(checker, 'g3́bc');
    const classes = new Badwords({ dictionary: ['abcd'], evasion: boundedEvasion({ minLength: 1,
        confusables: { mappings: [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a']], maxTotal: 4, requireAsciiLetter: false }
    }) });
    assert.equal(classes.flag('dabc'), true);
    assert.equal(classes.flag('aaaa'), false); // Equivalence filtering cannot accept directed substitutions.
    const literal = new Badwords({ dictionary: ['goblok', '-'], evasion: boundedEvasion({ separators }) });
    assert.equal(literal.flag('-'), true);
    assert.equal(literal.flag('g-o-b-l-o-k'), true);
    const astral = new Badwords({ dictionary: ['goblok'], normalization: 'none', evasion: boundedEvasion({
        separators: { characters: ['𐄀'], maxGap: 1, maxTotal: 8 }
    }) });
    assert.equal(consistent(astral, 'g𐄀o𐄀b𐄀l𐄀o𐄀k').length, 1);
});


test('the default dictionary reports overlapping separated variants and censors their union once', () => {
    const checker = new Badwords({ evasion: boundedEvasion({ separators }) });
    const found = consistent(checker, 'g-o-b-l-o-k');
    assert.deepEqual(found.map(({ word, index, end }) => ({ word, index, end })), [
        { word: 'goblo', index: 0, end: 9 }, { word: 'goblok', index: 0, end: 11 }
    ]);
    assert.equal(checker.censor('g-o-b-l-o-k'), '***');
});
