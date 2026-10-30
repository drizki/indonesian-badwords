import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Badwords, analyze, filter } from '../dist/esm/index.js';
import { classify } from '../dist/esm/metadata.js';
import { boundedEvasion } from '../dist/esm/evasion.js';
import { boundedFuzzy, FuzzyLimitError } from '../dist/esm/fuzzy.js';

const bare = new Badwords({ dictionary: ['goblok', 'kontol'] });
const evade = () => boundedEvasion({ separators: { characters: ['-'], maxGap: 1, maxTotal: 4 } });
const dense = (options = {}) => new Badwords({ dictionary: ['a', 'aa', 'aaa'], mode: 'substring', ...options });

test('filter keeps the collapsing default and gains preserveLineBreaks', () => {
    const text = '  halo   goblok \n\n  dunia\t\t kontol  \r\n  selesai  ';
    assert.equal(bare.filter(text), 'halo dunia selesai');
    assert.equal(bare.filter(text, {}), 'halo dunia selesai');
    assert.equal(bare.filter(text, { preserveLineBreaks: false }), 'halo dunia selesai');
    assert.equal(filter('a\nb'), 'a b');
    assert.equal(bare.filter(text, { preserveLineBreaks: true }), 'halo\n\ndunia\r\nselesai');
});

test('preserveLineBreaks semantics: CRLF, mixed endings, blank lines, trailing and indentation whitespace', () => {
    const keep = { preserveLineBreaks: true };
    assert.equal(bare.filter('a\r\nb', keep), 'a\r\nb');
    assert.equal(bare.filter('a\r\n\r\nb', keep), 'a\r\n\r\nb');
    assert.equal(bare.filter('a\nb\r\nc\rd', keep), 'a\nb\r\nc\rd');
    assert.equal(bare.filter('a\n\n\n\nb', keep), 'a\n\n\n\nb');
    assert.equal(bare.filter('a   \t \n \t  b', keep), 'a\nb');
    assert.equal(bare.filter('a  \r\n　 b', keep), 'a\r\nb');
    assert.equal(bare.filter('a b c', keep), 'a b c');
    // Runs without a line break are still one space, including vertical tab and form feed.
    assert.equal(bare.filter('a \t\u000b\f b', keep), 'a b');
    // Leading and trailing whitespace, line breaks included, is trimmed.
    assert.equal(bare.filter('\n\n a\nb \r\n', keep), 'a\nb');
    // A removed word on its own line leaves a blank line; the surrounding breaks are kept verbatim.
    assert.equal(bare.filter('satu\ngoblok\ndua', keep), 'satu\n\ndua');
    assert.equal(bare.filter('satu goblok\r\nkontol dua', keep), 'satu\r\ndua');
    assert.equal(bare.filter('', keep), '');
    assert.equal(bare.filter(' \n ', keep), '');
    assert.equal(bare.filter('a\r\n', keep), 'a');
});

test('filter options are validated and combine with CheckOptions', () => {
    for (const value of [1, 'true', null, {}]) assert.throws(() => bare.filter('a\nb', { preserveLineBreaks: value }), TypeError);
    assert.equal(bare.filter('goblok\n kontol dua', { preserveLineBreaks: true, ignoreRanges: [{ index: 0, end: 6 }] }), 'goblok\ndua');
    assert.equal(bare.filter('goblok\n kontol dua', { ignoreRanges: [{ index: 0, end: 6 }] }), 'goblok dua');
});

test('analyze replacement: string, callback and default', () => {
    const text = 'halo goblok dan kontol 😀 goblok';
    assert.equal(bare.analyze(text).censored, 'halo *** dan *** 😀 ***');
    assert.equal(bare.analyze(text, {}).censored, 'halo *** dan *** 😀 ***');
    assert.equal(bare.analyze(text, { replacement: undefined }).censored, 'halo *** dan *** 😀 ***');
    assert.equal(bare.analyze(text, { replacement: '[x]' }).censored, 'halo [x] dan [x] 😀 [x]');
    assert.equal(bare.analyze(text, { replacement: '' }).censored, 'halo  dan  😀 ');
    assert.equal(bare.analyze(text, { replacement: '$& $1 $$' }).censored, 'halo $& $1 $$ dan $& $1 $$ 😀 $& $1 $$');
    const called = [];
    const result = bare.analyze(text, { replacement: ({ match, words, index }) => { called.push([index, match, words]); return `<${match.length}>`; } });
    assert.equal(result.censored, 'halo <6> dan <6> 😀 <6>');
    assert.deepEqual(called, [[5, 'goblok', ['goblok']], [16, 'kontol', ['kontol']], [26, 'goblok', ['goblok']]]);
    assert.equal(analyze('x goblok', { replacement: '#' }).censored, 'x #');
    for (const value of [1, null, {}, true]) assert.throws(() => bare.analyze(text, { replacement: value }), TypeError);
    assert.throws(() => bare.analyze(text, { replacement: () => 1 }), TypeError);
});

test('analyze replacement matches censor() for the same replacement on every path', () => {
    const dictionary = ['goblok', 'kontol', 'bab', 'aba'];
    const text = '😀 G0BL0K, kon-tol, ababa gobloook!';
    const checkers = [new Badwords({ dictionary }), new Badwords({ dictionary, mode: 'substring' }),
        new Badwords({ dictionary, evasion: boundedEvasion({ separators: { characters: ['-'], maxGap: 1, maxTotal: 2 } }) }),
        new Badwords({ dictionary, fuzzy: boundedFuzzy() })];
    for (const checker of checkers) {
        for (const replacement of ['***', '[x]', ({ match }) => '#'.repeat(match.length), ({ words }) => words.join('+')]) {
            assert.equal(checker.analyze(text, { replacement }).censored, checker.censor(text, replacement));
        }
    }
});

test('analyze replacement callbacks can use context.occurrences()', () => {
    const checker = new Badwords({ dictionary: ['a', 'aba', 'bab'], mode: 'substring' });
    const text = 'ababa x aba';
    const seen = [];
    const result = checker.analyze(text, { replacement: (context) => {
        const occurrences = context.occurrences();
        seen.push(occurrences.map(({ word, index }) => word + index));
        return `{${occurrences.length}}`;
    } });
    assert.equal(result.censored, `{${checker.find('ababa').length}} x {${checker.find('aba').length}}`);
    assert.deepEqual(seen, [['a0', 'aba0', 'bab1', 'a2', 'aba2', 'a4'], ['a8', 'aba8', 'a10']]);
    assert.deepEqual(result.locations, checker.find(text));
    // Without a replacement callback the same call must not scan twice or mutate anything.
    assert.equal(checker.analyze(text).censored, '*** x ***');
});

test('analyze callback occurrences() follows the call-level overflow mode', () => {
    const checker = dense({ maxMatches: 2 });
    const text = 'aaa';
    assert.throws(() => checker.analyze(text, { replacement: (context) => String(context.occurrences().length) }), RangeError);
    const truncating = checker.analyze(text, { onMaxMatches: 'truncate', replacement: (context) => String(context.occurrences().length) });
    assert.equal(truncating.censored, '2');
    assert.equal(truncating.truncated, true);
});

test("maxMatches 'throw' stays the default", () => {
    const checker = dense({ maxMatches: 4 });
    assert.equal(checker.find('aa').length, 3);
    assert.throws(() => checker.find('aaa'), { name: 'RangeError', message: /maxMatches/ });
    assert.throws(() => checker.analyze('aaa'), RangeError);
    assert.throws(() => checker.find('aaa', { onMaxMatches: 'throw' }), RangeError);
    assert.throws(() => dense({ maxMatches: 4, onMaxMatches: 'throw' }).find('aaa'), RangeError);
});

test('truncate keeps exactly the first N occurrences in source order, not the first N emitted', () => {
    const texts = ['aaa', 'aaaaaa', 'a aa aaa a', 'baaab aab'];
    const full = dense({ maxMatches: Infinity });
    for (const text of texts) {
        const everything = full.find(text);
        for (let limit = 1; limit <= everything.length + 1; limit++) {
            const checker = dense({ maxMatches: limit, onMaxMatches: 'truncate' });
            const found = checker.find(text);
            assert.deepEqual(found, everything.slice(0, limit), `${text} limit ${limit}`);
            assert.equal(found.truncated, limit < everything.length ? true : undefined, `${text} limit ${limit}`);
            const analysis = checker.analyze(text);
            assert.deepEqual(analysis.locations, everything.slice(0, limit));
            assert.equal(analysis.occurrenceCount, Math.min(limit, everything.length));
            assert.equal(analysis.truncated, limit < everything.length ? true : undefined);
        }
    }
    // 'aaa' emits a@0, a@1, aa@0 ... by end position; the first two in source order are a@0 and aa@0.
    assert.deepEqual(dense({ maxMatches: 2, onMaxMatches: 'truncate' }).find('aaa').map(({ word, index }) => word + index), ['a0', 'aa0']);
});

test('truncation is exact at the limit, one past it, and across buffer cuts', () => {
    const checker = (limit) => new Badwords({ dictionary: ['goblok'], maxMatches: limit, onMaxMatches: 'truncate' });
    const text = (count) => Array.from({ length: count }, () => 'goblok').join(' ');
    for (const limit of [1, 2, 3, 7]) {
        const exact = checker(limit).find(text(limit));
        assert.equal(exact.length, limit);
        assert.equal(exact.truncated, undefined);
        assert.equal(checker(limit).analyze(text(limit)).truncated, undefined);
        const past = checker(limit).find(text(limit + 1));
        assert.equal(past.length, limit);
        assert.equal(past.truncated, true);
        assert.deepEqual(past.map(({ index }) => index), Array.from({ length: limit }, (_, i) => i * 7));
        // Many multiples of the internal buffer.
        const many = checker(limit).find(text(limit * 5 + 3));
        assert.equal(many.length, limit);
        assert.equal(many.truncated, true);
        assert.deepEqual(many.map(({ index }) => index), Array.from({ length: limit }, (_, i) => i * 7));
    }
    assert.deepEqual(checker(3).find(''), []);
    assert.equal(checker(3).find('').truncated, undefined);
});

test('truncate keeps Unicode offsets and original match text', () => {
    const checker = new Badwords({ dictionary: ['goblok'], maxMatches: 2, onMaxMatches: 'truncate' });
    const text = '😀 gobl0k café ｇｏｂｌｏｋ 👨‍👩‍👧 GOBLOK goblok';
    const found = checker.find(text);
    assert.equal(found.length, 2);
    assert.equal(found.truncated, true);
    assert.deepEqual(found.map(({ match }) => match), ['gobl0k', 'ｇｏｂｌｏｋ']);
    for (const item of found) assert.equal(text.slice(item.index, item.end), item.match);
    assert.deepEqual(found, new Badwords({ dictionary: ['goblok'], maxMatches: Infinity }).find(text).slice(0, 2));
    const analysis = checker.analyze(text);
    assert.equal(analysis.truncated, true);
    assert.equal(analysis.censored, '😀 *** café *** 👨‍👩‍👧 *** ***');
    assert.deepEqual(analysis.locations, found);
});

test('truncated analysis censors every match and describes only the kept occurrences', () => {
    const checker = new Badwords({ dictionary: ['goblok', 'kontol'], maxMatches: 1, onMaxMatches: 'truncate' });
    const text = 'goblok lalu kontol lalu goblok';
    const result = checker.analyze(text);
    assert.equal(result.censored, '*** lalu *** lalu ***');
    assert.deepEqual(result.badwords, ['goblok']);
    assert.equal(result.count, 1);
    assert.equal(result.occurrenceCount, 1);
    assert.equal(result.locations.length, 1);
    assert.equal(result.words, 5);
    assert.equal(result.truncated, true);
    assert.equal(checker.censor(text), result.censored);
    assert.deepEqual(checker.badwords(text), ['goblok', 'kontol']);
    assert.equal(checker.flag(text), true);
});

test('maxMatches Infinity never truncates, and the cap can be overridden per call in both directions', () => {
    const unlimited = dense({ maxMatches: Infinity, onMaxMatches: 'truncate' });
    const text = 'a'.repeat(300);
    const found = unlimited.find(text);
    assert.equal(found.length, 300 + 299 + 298);
    assert.equal(found.truncated, undefined);
    assert.equal(unlimited.analyze(text).truncated, undefined);
    const throwing = dense({ maxMatches: 3 });
    assert.equal(throwing.find('aaaa', { onMaxMatches: 'truncate' }).length, 3);
    assert.equal(throwing.analyze('aaaa', { onMaxMatches: 'truncate' }).truncated, true);
    const truncating = dense({ maxMatches: 3, onMaxMatches: 'truncate' });
    assert.throws(() => truncating.find('aaaa', { onMaxMatches: 'throw' }), RangeError);
    assert.throws(() => truncating.analyze('aaaa', { onMaxMatches: 'throw' }), RangeError);
    assert.equal(truncating.find('aaaa', {}).truncated, true);
});

test('the truncated flag does not disturb equality, enumeration, JSON or spreading of find()', () => {
    const checker = dense({ maxMatches: 2, onMaxMatches: 'truncate' });
    const found = checker.find('aaa');
    assert.equal(found.truncated, true);
    assert.deepEqual(found, [...found]);
    assert.deepEqual(Object.keys(found), ['0', '1']);
    assert.equal(JSON.stringify(found), JSON.stringify([...found]));
    assert.equal(Array.isArray(found), true);
    assert.equal(Object.getOwnPropertyDescriptor(found, 'truncated').enumerable, false);
    assert.equal(dense({ maxMatches: Infinity }).find('aaa').truncated, undefined);
    assert.deepEqual(Object.keys(checker.analyze('aaa')).sort(), ['badwords', 'censored', 'count', 'locations', 'occurrenceCount', 'text', 'truncated', 'words']);
    assert.deepEqual(Object.keys(dense().analyze('aaa')).sort(), ['badwords', 'censored', 'count', 'locations', 'occurrenceCount', 'text', 'words']);
});

test('onMaxMatches is validated for the constructor and for each call', () => {
    for (const value of ['', 'Truncate', 'drop', 1, null, true]) {
        assert.throws(() => new Badwords({ onMaxMatches: value }), { name: 'TypeError', message: /onMaxMatches/ });
        assert.throws(() => bare.find('goblok', { onMaxMatches: value }), TypeError);
        assert.throws(() => bare.analyze('goblok', { onMaxMatches: value }), TypeError);
    }
    assert.doesNotThrow(() => new Badwords({ onMaxMatches: undefined }));
});

test('truncate works with evasion and fuzzy matching and with censor callbacks', () => {
    for (const [policy, text] of [[{ evasion: evade() }, 'goblok go-blok goblok'], [{ fuzzy: boundedFuzzy() }, 'goblok goblox goblok']]) {
        const checker = new Badwords({ dictionary: ['goblok'], maxMatches: 2, onMaxMatches: 'truncate', ...policy });
        const unlimited = new Badwords({ dictionary: ['goblok'], maxMatches: Infinity, ...policy });
        const found = checker.find(text);
        assert.equal(found.truncated, true);
        assert.deepEqual(found, unlimited.find(text).slice(0, 2));
        assert.equal(checker.analyze(text).censored, unlimited.censor(text));
    }
    const checker = dense({ maxMatches: 1, onMaxMatches: 'truncate' });
    assert.equal(checker.censor('aaa', (context) => String(context.occurrences().length)), '1');
    assert.throws(() => dense({ maxMatches: 1 }).censor('aaa', (context) => String(context.occurrences().length)), RangeError);
});

test('classify() accepts truncated find() and analyze() results', () => {
    const checker = new Badwords({ maxMatches: 2, onMaxMatches: 'truncate' });
    const text = 'dasar goblok kontol anjing bangsat';
    const found = checker.find(text);
    const analysis = checker.analyze(text);
    assert.equal(found.truncated, true);
    assert.equal(analysis.truncated, true);
    assert.equal(found.length, 2);
    const viaFind = classify(found);
    assert.equal(viaFind.occurrences.length, 2);
    assert.deepEqual(classify(analysis), viaFind);
    assert.deepEqual(classify(found), classify([...found]));
    assert.deepEqual(classify(found), classify(new Badwords({ maxMatches: Infinity }).find(text).slice(0, 2)));
    assert.equal(classify(found).summary.maxSeverity, classify([...found]).summary.maxSeverity);
});

test('addWords and removeWords reflect immediately in dict while compilation is deferred', () => {
    for (const policy of [{ fuzzy: boundedFuzzy() }, { evasion: evade() }, { fuzzy: boundedFuzzy(), evasion: evade() }, {}]) {
        const checker = new Badwords({ dictionary: ['goblok'], ...policy });
        assert.deepEqual(checker.dict, ['goblok']);
        checker.addWords('Kontol');
        assert.deepEqual(checker.dict, ['goblok', 'kontol']);
        checker.addWords(['anjing', 'GOBLOK']);
        assert.deepEqual(checker.dict, ['goblok', 'kontol', 'anjing']);
        checker.removeWords('goblok');
        assert.deepEqual(checker.dict, ['kontol', 'anjing']);
        assert.equal(checker.flag('goblok'), false);
        assert.deepEqual(checker.badwords('Kontol dan anjing'), ['kontol', 'anjing']);
        assert.deepEqual(checker.find('anjing').map(({ word }) => word), ['anjing']);
        assert.equal(checker.censor('kontol anjing'), '*** ***');
        assert.deepEqual(checker.dict, ['kontol', 'anjing']);
    }
});

test('every scanning API sees a pending update on its first call', () => {
    for (const method of ['flag', 'find', 'badwords', 'censor', 'filter', 'analyze']) {
        const checker = new Badwords({ dictionary: ['goblok'], fuzzy: boundedFuzzy() });
        checker.addWords('kontol');
        const result = checker[method]('kontol');
        assert.ok(method === 'flag' ? result === true : method === 'filter' ? result === '' : method === 'censor' ? result === '***' : result.length !== 0 || result.count === 1, method);
    }
    const preset = new Badwords({ fuzzy: boundedFuzzy() });
    preset.addWords('katakasarbaru');
    assert.equal(preset.flag('katakasarbaru'), true);
    assert.equal(preset.flag('katakasarbaro'), true);
    preset.removeWords('katakasarbaru');
    assert.equal(preset.flag('katakasarbaru'), false);
    assert.equal(preset.flag('goblok'), true);
});

test('deferred compile followed by an immediate removeWords of the same word', () => {
    const checker = new Badwords({ dictionary: ['goblok'], fuzzy: boundedFuzzy(), evasion: evade() });
    checker.addWords('kontol');
    checker.removeWords('kontol');
    assert.deepEqual(checker.dict, ['goblok']);
    assert.equal(checker.flag('kontol'), false);
    assert.equal(checker.flag('goblok'), true);
    // The other order: remove a compiled word, then add it back before any scan.
    checker.removeWords('goblok');
    checker.addWords('goblok');
    assert.deepEqual(checker.dict, ['goblok']);
    assert.equal(checker.flag('g-o-b-l-o-k'), true);
    // Removing everything leaves an empty, scannable checker.
    checker.removeWords('goblok');
    assert.deepEqual(checker.dict, []);
    assert.equal(checker.flag('goblok'), false);
    assert.deepEqual(checker.find('goblok'), []);
});

test('invalid updates throw immediately; a failed addWords after a successful pending one is atomic', () => {
    const fuzzy = boundedFuzzy({ limits: { maxDictionaryLength: 20 } });
    const checker = new Badwords({ dictionary: ['goblok'], fuzzy });
    checker.addWords('kontol');
    assert.throws(() => checker.addWords(['bangsat', 12]), TypeError);
    assert.throws(() => checker.addWords(12), TypeError);
    assert.throws(() => checker.removeWords([null]), TypeError);
    assert.deepEqual(checker.dict, ['goblok', 'kontol']);
    assert.throws(() => checker.addWords(['anjing', 'x'.repeat(30)]), error => error instanceof FuzzyLimitError && error.limit === 'dictionaryLength');
    assert.deepEqual(checker.dict, ['goblok', 'kontol']);
    assert.throws(() => checker.addWords(['anjing', 'babi', 'bangsat']), FuzzyLimitError);
    assert.deepEqual(checker.dict, ['goblok', 'kontol']);
    assert.equal(checker.flag('kontol'), true);
    assert.equal(checker.flag('goblok'), true);
    assert.equal(checker.flag('anjing'), false);
    assert.equal(checker.flag('bangsat'), false);
    checker.addWords('babi');
    assert.deepEqual(checker.dict, ['goblok', 'kontol', 'babi']);
    assert.equal(checker.flag('babi'), true);
});

test('compile-time limits surface on the next scan and roll the whole pending update back', () => {
    const checker = new Badwords({ dictionary: ['goblok'], fuzzy: boundedFuzzy({ limits: { maxCompileStates: 40 } }) });
    checker.addWords('kontol');
    checker.addWords('x'.repeat(40));
    assert.deepEqual(checker.dict, ['goblok', 'kontol', 'x'.repeat(40)]);
    assert.throws(() => checker.flag('goblok'), error => error instanceof FuzzyLimitError && error.limit === 'compileStates');
    assert.deepEqual(checker.dict, ['goblok']);
    assert.equal(checker.flag('goblok'), true);
    assert.equal(checker.flag('kontol'), false);
    checker.addWords('kontol');
    assert.equal(checker.flag('kontol'), true);
    // The bundled dictionary is restored exactly, including its fast paths.
    const preset = new Badwords({ fuzzy: boundedFuzzy({ limits: { maxCompileStates: 200_000, maxDictionaryLength: 1_000_000 } }) });
    const before = preset.dict;
    preset.addWords('y'.repeat(900_000));
    assert.throws(() => preset.flag('x'));
    assert.deepEqual(preset.dict, before);
    assert.equal(preset.flag('goblok'), true);
});

test('context.occurrences() still throws TypeError when the dictionary changes mid-censor, including deferred updates', () => {
    for (const policy of [{}, { fuzzy: boundedFuzzy() }, { evasion: evade() }]) {
        const checker = new Badwords({ dictionary: ['goblok', 'kontol'], ...policy });
        assert.throws(() => checker.censor('goblok kontol', (context) => { checker.addWords('anjing'); return context.occurrences().length + ''; }), TypeError);
        assert.throws(() => checker.censor('goblok kontol', (context) => { checker.removeWords('kontol'); return context.occurrences().length + ''; }), TypeError);
        assert.throws(() => checker.analyze('goblok', { replacement: (context) => { checker.addWords('babi'); return context.occurrences().length + ''; } }), TypeError);
        // A scan inside the callback compiles the pending update; the guarantee holds for contexts from before it.
        assert.throws(() => checker.censor('goblok', (context) => { checker.addWords('bangsat'); checker.flag('x'); return context.occurrences().length + ''; }), TypeError);
        assert.equal(checker.censor('goblok bangsat', () => '#'), '# #');
    }
});

test('module-level addWords and removeWords are deprecated in the type declarations and still work', () => {
    const declarations = readFileSync(new URL('../dist/cjs/index.d.ts', import.meta.url), 'utf8');
    for (const name of ['addWords', 'removeWords']) {
        assert.match(declarations, new RegExp(`@deprecated[^*]*\\*/\\s*export declare const ${name}\\b`), name);
    }
    assert.doesNotMatch(declarations, /@deprecated[^*]*\*\/\s*addWords\(/);
});
