import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { boundedEvasionPolicy as bounded, createChecker, percentile } from './lib/bench-common.mjs';

// Informational, self-checking local measurements; no timing assertions.
// Each case has a fresh process, a 256 MiB V8 heap and a 20-second timeout.
const require = createRequire(import.meta.url);
const quick = process.argv.includes('--quick');
const LIMIT = Symbol('expected match limit');
const CLEAN = 'Apa kabar? Pesanan sudah sampai. Kami menyiapkan layanan pendidikan. Terima kasih atas bantuan Anda. ';
const EMOJI = '😀 Pesanan sudah sampai. Terima kasih atas bantuan Anda. ';
const ACCENT = '😀 Pesanan dari café sudah sampai. Terima kasih atas bantuan Anda. ';
const UNICODE = '😀 Pesan: ＧＯＢＬＯＫ dan kon\u200btol. ';
const terms = (surface, word = surface) => [{ surface, word, offset: 0 }];
const jobs = [];
function add(id, kind, length, method, extra = {}) { jobs.push({ id, kind, length, method, ...extra }); }
for (const length of [280, 4_000]) {
    for (const method of ['flag', 'censor', 'analyze']) add(`clean-${length}-${method}`, 'clean', length, method);
    for (const position of ['start', 'middle', 'end']) {
        for (const method of ['flag', 'censor']) add(`matched-${position}-${length}-${method}`, 'placed', length, method,
            { position, surface: 'goblok', terms: terms('goblok') });
    }
    add(`matched-middle-${length}-analyze`, 'placed', length, 'analyze',
        { position: 'middle', surface: 'goblok', terms: terms('goblok') });
    for (const method of ['flag', 'censor']) add(`leetspeak-${length}-${method}`, 'placed', length, method,
        { position: 'middle', surface: 'g0bl0k', terms: terms('g0bl0k', 'goblok') });
    add(`clean-emoji-${length}-flag`, 'clean', length, 'flag', { base: EMOJI });
    add(`clean-accent-emoji-${length}-flag`, 'clean', length, 'flag', { base: ACCENT });
}
add('clean-accent-emoji-4000-analyze', 'clean', 4_000, 'analyze', { base: ACCENT });
for (const length of [280, 4_000]) for (const method of ['flag', 'censor', 'analyze']) {
    add(`matched-accent-emoji-${length}-${method}`, 'placed', length, method, {
        base: ACCENT, position: 'middle', surface: 'goblok', terms: terms('goblok')
    });
}
for (const method of ['flag', 'censor', 'analyze']) add(`leetspeak-accent-emoji-4000-${method}`, 'placed', 4_000, method, {
    base: ACCENT, position: 'middle', surface: 'g0bl0k', terms: terms('g0bl0k', 'goblok')
});
for (const method of ['flag', 'find', 'analyze']) add(`unicode-dense-4000-${method}`, 'dense', 4_000, method, {
    chunk: UNICODE, terms: [{ surface: 'ＧＯＢＬＯＫ', word: 'goblok', offset: UNICODE.indexOf('ＧＯＢＬＯＫ') },
        { surface: 'kon\u200btol', word: 'kontol', offset: UNICODE.indexOf('kon\u200btol') }]
});
for (const method of ['badwords', 'find', 'censor', 'analyze']) add(`dense-20000-${method}`, 'dense', 20_000, method, {
    chunk: 'kontol goblok ngentot ', terms: [{ surface: 'kontol', word: 'kontol', offset: 0 },
        { surface: 'goblok', word: 'goblok', offset: 7 }, { surface: 'ngentot', word: 'ngentot', offset: 14 }]
});
add('benign-token-64000', 'long', 64_000, 'flag');
add('custom-10000-terms', 'clean', 4_000, 'flag', { dictionary: 'large-custom' });
add('overlap-5000-word-clean', 'prefixes', 5_000, 'flag', { dictionary: 'prefixes', options: { mode: 'word' } });
for (const method of ['flag', 'badwords', 'find', 'censor', 'analyze']) add(`overlap-5000-${method}`, 'prefixes', 5_000, method,
    { dictionary: 'prefixes', options: { mode: 'substring' }, limited: ['find', 'analyze'].includes(method) });
for (const enabled of [false, true]) add(`repeated-letters-${enabled ? 'enabled' : 'default'}-280`, 'placed', 280, 'flag', {
    position: 'middle', surface: 'gooooblok', terms: enabled ? terms('gooooblok', 'goblok') : [],
    options: { ignoreRepeatedLetters: enabled }
});
for (const method of ['flag', 'censor']) add(`substring-joined-280-${method}`, 'placed', 280, method, {
    position: 'middle', surface: 'kamugoblok', terms: [{ surface: 'goblok', word: 'goblok', offset: 4 }], options: { mode: 'substring' }
});
for (const expanded of [false, true]) add(`contextual-${expanded ? 'expanded' : 'core'}-280`, 'placed', 280, 'flag', {
    position: 'middle', surface: 'anjing', terms: expanded ? terms('anjing') : [], dictionary: expanded ? 'expanded' : 'core'
});
add('literal-normalization-280', 'placed', 280, 'flag', {
    position: 'middle', surface: 'goblok', terms: terms('goblok'), options: { normalization: 'none' }
});
for (const length of [280, 4_000]) {
    add(`callback-clean-${length}-censor`, 'clean', length, 'censor', { replacement: 'callback' });
    for (const replacement of ['callback', 'mask', 'grawlix']) {
        add(`${replacement}-matched-${length}-censor`, 'placed', length, 'censor', {
            position: 'middle', surface: 'g0bl0k', terms: terms('g0bl0k', 'goblok'), replacement,
            replacements: replacement === 'mask' ? ['g****k'] : ['######']
        });
    }
    add(`allow-phrase-contained-${length}-censor`, 'placed', length, 'censor', {
        position: 'middle', surface: 'Baju Bodo', terms: [], options: { allowPhrases: ['Baju Bodo'] }
    });
    add(`allow-phrase-outside-${length}-analyze`, 'placed', length, 'analyze', {
        position: 'middle', surface: 'Baju Bodo goblok bodo', options: { allowPhrases: ['Baju Bodo'] },
        terms: [{ surface: 'goblok', word: 'goblok', offset: 10 }, { surface: 'bodo', word: 'bodo', offset: 17 }]
    });
    for (const replacement of [undefined, 'callback']) {
        const offset = replacement ? 10 : 0;
        add(`ignore-range-${replacement ?? 'literal'}-${length}-censor`, 'placed', length, 'censor', {
            position: 'middle', surface: replacement ? 'Baju Bodo goblok kontol' : 'goblok kontol', replacement,
            options: replacement ? { allowPhrases: ['Baju Bodo'] } : undefined,
            ignoreRanges: [{ index: offset + 1, end: offset + 2 }],
            terms: [{ surface: 'kontol', word: 'kontol', offset: offset + 7 }]
        });
    }
}
add('callback-overlap-5000-censor', 'prefixes', 5_000, 'censor', { dictionary: 'prefixes', replacement: 'callback',
    options: { mode: 'substring', normalization: 'none', maxMatches: 1 } });
add('callback-bridge-16512-censor', 'bridge', 16_512, 'censor', { dictionary: 'bridge-prefixes', replacement: 'callback',
    options: { mode: 'substring', normalization: 'none', maxMatches: 1 } });
for (const replacement of ['mask', 'grawlix']) add(`${replacement}-graphemes-280-censor`, 'placed', 280, 'censor', {
    dictionary: 'unicode-strategies', options: { dictionary: ['ffi', 'é', '👩‍💻'] }, replacement,
    position: 'middle', surface: 'ﬃ e\u0301 👩‍💻', replacements: Array(3).fill(replacement === 'mask' ? '*' : '#'),
    terms: [{ surface: 'ﬃ', word: 'ffi', offset: 0 }, { surface: 'e\u0301', word: 'é', offset: 2 },
        { surface: '👩‍💻', word: '👩💻', offset: 5 }]
});

for (const length of [280, 4_000]) add(`bounded-clean-${length}-flag`, 'clean', length, 'flag', { evasion: bounded });
for (const method of ['flag', 'censor', 'analyze']) add(`bounded-separated-280-${method}`, 'placed', 280, method, {
    position: 'middle', surface: 'g-o-b-l-o-k',
    terms: [{ surface: 'g-o-b-l-o', word: 'goblo', offset: 0 }, ...terms('g-o-b-l-o-k', 'goblok')], evasion: bounded
});
for (const method of ['flag', 'censor']) add(`bounded-lookalikes-280-${method}`, 'placed', 280, method, {
    position: 'middle', surface: 'gοblοk', terms: terms('gοblοk', 'goblok'),
    evasion: { confusables: { mappings: [['ο', 'o']], maxTotal: 2 } }
});
add('bounded-repeats-280-flag', 'placed', 280, 'flag', {
    position: 'middle', surface: 'goooblok', terms: terms('goooblok', 'goblok'), evasion: bounded
});

for (const length of [280, 4_000]) {
    for (const method of ['flag', 'censor', 'analyze']) add(`fuzzy-clean-${length}-${method}`, 'clean', length, method,
        { options: { dictionary: ['goblok'] }, fuzzy: {} });
    for (const method of ['flag', 'censor', 'analyze']) add(`fuzzy-typo-${length}-${method}`, 'placed', length, method,
        { options: { dictionary: ['goblok'] }, position: 'middle', surface: 'goblox', terms: terms('goblox', 'goblok'), fuzzy: {} });
}
add('fuzzy-osa-transpose-280-censor', 'placed', 280, 'censor', {
    options: { dictionary: ['goblok'] }, position: 'middle', surface: 'golbok', terms: terms('golbok', 'goblok'), fuzzy: { model: 'osa' }
});
for (const method of ['flag', 'censor', 'analyze']) add(`fuzzy-composed-280-${method}`, 'placed', 280, method, {
    options: { dictionary: ['goblok'] }, position: 'middle', surface: 'g-o-b-l-o-x',
    terms: [{ surface: 'g-o-b-l-o', word: 'goblok', offset: 0 }, ...terms('g-o-b-l-o-x', 'goblok')], fuzzy: {}, evasion: bounded
});
add('fuzzy-scoped-callback-280-censor', 'placed', 280, 'censor', {
    options: { dictionary: ['goblok'], allowPhrases: ['goblox aman'] }, position: 'middle', surface: 'goblox aman goblox',
    terms: [{ surface: 'goblox', word: 'goblok', offset: 12 }], fuzzy: {}, replacement: 'callback'
});

// Coverage added for 2.7.0 baselines (#24). Provenance (`via`) has no off switch: its cost shows in
// `find`/`analyze` here and against a previous release with `npm run benchmark:paired`.
const LEET_DENSE = { chunk: 'g0bl0k k0nt0l ', terms: [{ surface: 'g0bl0k', word: 'goblok', offset: 0 },
    { surface: 'k0nt0l', word: 'kontol', offset: 7 }] };
for (const length of [280, 4_000]) {
    add(`clean-${length}-find`, 'clean', length, 'find');
    add(`matched-middle-${length}-find`, 'placed', length, 'find', { position: 'middle', surface: 'goblok', terms: terms('goblok') });
    for (const method of ['find', 'analyze']) add(`leetspeak-${length}-${method}`, 'placed', length, method,
        { position: 'middle', surface: 'g0bl0k', terms: terms('g0bl0k', 'goblok') });
}
for (const method of ['flag', 'find', 'analyze']) add(`leetspeak-dense-4000-${method}`, 'dense', 4_000, method, LEET_DENSE);
add('classify-chat-280', 'placed', 280, 'classify', { position: 'middle', surface: 'g0bl0k', terms: terms('g0bl0k', 'goblok') });
add('classify-dense-4000', 'dense', 4_000, 'classify', LEET_DENSE);
add('classify-dense-20000', 'dense', 20_000, 'classify', { chunk: 'kontol goblok ngentot ', terms: [{ surface: 'kontol', word: 'kontol', offset: 0 },
    { surface: 'goblok', word: 'goblok', offset: 7 }, { surface: 'ngentot', word: 'ngentot', offset: 14 }] });
add('classify-9800-locations', 'dense', 72_000, 'classify', { chunk: 'kontol goblok ngentot ',
    terms: [{ surface: 'kontol', word: 'kontol', offset: 0 }, { surface: 'goblok', word: 'goblok', offset: 7 },
        { surface: 'ngentot', word: 'ngentot', offset: 14 }] });
add('classify-100000-locations', 'dense', 733_400, 'classify', { sparse: true, heavy: true, options: { maxMatches: 200_000 }, chunk: 'kontol goblok ngentot ',
    terms: [{ surface: 'kontol', word: 'kontol', offset: 0 }, { surface: 'goblok', word: 'goblok', offset: 7 },
        { surface: 'ngentot', word: 'ngentot', offset: 14 }] });
// Combined evasion + fuzzy, with the one-word and the full default dictionary.
const composedTypo = { surface: 'g-o-b-l-o-x', terms: [{ surface: 'g-o-b-l-o', word: 'goblok', offset: 0 }, ...terms('g-o-b-l-o-x', 'goblok')] };
for (const length of [280, 4_000]) add(`fuzzy-composed-clean-${length}-flag`, 'clean', length, 'flag',
    { options: { dictionary: ['goblok'] }, fuzzy: {}, evasion: bounded });
for (const method of ['flag', 'censor']) add(`fuzzy-composed-4000-${method}`, 'placed', 4_000, method,
    { options: { dictionary: ['goblok'] }, position: 'middle', ...composedTypo, fuzzy: {}, evasion: bounded });
for (const length of [280, 4_000]) add(`composed-default-dictionary-clean-${length}-flag`, 'clean', length, 'flag',
    { fuzzy: {}, evasion: bounded });
add('composed-default-dictionary-typo-280-censor', 'placed', 280, 'censor', { position: 'middle', surface: 'g-o-b-l-o-k',
    terms: [{ surface: 'g-o-b-l-o-k', word: 'goblok', offset: 0 }], fuzzy: {}, evasion: bounded });
// Fuzzy substring mode.
for (const length of [280, 4_000]) add(`fuzzy-substring-clean-${length}-flag`, 'clean', length, 'flag',
    { options: { dictionary: ['goblok'], mode: 'substring' }, fuzzy: {} });
add('fuzzy-substring-typo-280-flag', 'placed', 280, 'flag', { options: { dictionary: ['goblok'], mode: 'substring' },
    position: 'middle', surface: 'kamugoblox', terms: terms('kamugoblox', 'goblok'), fuzzy: {} });
add('fuzzy-substring-default-dictionary-clean-280-flag', 'clean', 280, 'flag', { options: { mode: 'substring' }, fuzzy: {} });
// Long unbroken runs (no spaces, no match) under each scanner.
add('long-run-letters-64000-censor', 'long', 64_000, 'censor');
add('long-run-letters-64000-find', 'long', 64_000, 'find');
add('long-run-substring-64000-flag', 'long', 64_000, 'flag', { options: { mode: 'substring' } });
add('long-run-bangs-64000-flag', 'long', 64_000, 'flag', { unit: '!' });
add('long-run-bangs-4000-flag', 'long', 4_000, 'flag', { unit: '!' });
add('long-run-bangs-64000-censor', 'long', 64_000, 'censor', { unit: '!' });
add('long-run-bounded-16000-flag', 'long', 16_000, 'flag', { evasion: bounded });
add('long-run-separators-16000-flag', 'long', 16_000, 'flag', { evasion: bounded, unit: '-x' });
add('long-run-fuzzy-16000-flag', 'long', 16_000, 'flag', { options: { dictionary: ['goblok'] }, fuzzy: {} });
add('long-run-composed-8000-flag', 'long', 8_000, 'flag', { options: { dictionary: ['goblok'] }, fuzzy: {}, evasion: bounded });

function alphabeticId(number) {
    let value = '';
    do { value = String.fromCharCode(97 + number % 26) + value; number = Math.floor(number / 26); } while (number);
    return value;
}
function fill(length, reference = '', base = CLEAN) {
    const prefix = reference ? `Ref ${reference}. ` : '';
    const value = (prefix + base.repeat(Math.ceil(length / base.length))).slice(0, length);
    return /[\ud800-\udbff]$/.test(value) ? value.slice(0, -1) + ' ' : value;
}
function makeSample(job, serial) {
    const reference = String(serial).padStart(12, '0');
    if (job.kind === 'long') return { text: (reference + (job.unit ? job.unit.repeat(Math.ceil(job.length / job.unit.length))
        : CLEAN.replace(/[^a-z]/gi, '').repeat(1_000))).slice(0, job.length), count: 0 };
    if (job.kind === 'prefixes') return { text: 'a'.repeat(job.length) + ' ' + reference,
        count: job.options.mode === 'word' ? 0 : 1, suffix: ' ' + reference };
    if (job.kind === 'bridge') return { text: 'a'.repeat(128) + ' x a'.repeat((job.length - 128) / 4) + ' ' + reference,
        count: 1, suffix: ' ' + reference };
    if (job.kind === 'clean') return { text: fill(job.length, reference, job.base), count: 0 };
    if (job.kind === 'dense') {
        const prefix = `Ref ${reference}. `;
        const repeats = Math.floor((job.length - prefix.length) / job.chunk.length);
        const suffix = ' '.repeat(job.length - prefix.length - repeats * job.chunk.length);
        return { text: prefix + job.chunk.repeat(repeats) + suffix, start: prefix.length,
            repeats, prefix, suffix, count: repeats * job.terms.length };
    }
    const space = job.length - job.surface.length - 2;
    const before = job.position === 'start' ? 0 : job.position === 'end' ? space + 1 : Math.floor(space / 2);
    const start = before ? before + 1 : 0;
    const left = before ? fill(before, reference, job.base) + ' ' : '';
    const right = job.length - start - job.surface.length;
    return { text: left + job.surface + (right ? ' ' + fill(right - 1, before ? '' : reference, job.base) : ''),
        start, count: job.terms.length, ...(job.ignoreRanges ? { checkOptions: { ignoreRanges:
            job.ignoreRanges.map(({ index, end }) => ({ index: start + index, end: start + end })) } } : {}) };
}
function locations(job, sample) {
    const found = [];
    for (let repeat = 0; repeat < (sample.repeats ?? 1); repeat++) for (const term of job.terms ?? []) {
        const index = sample.start + repeat * (job.chunk?.length ?? 0) + term.offset;
        found.push({ word: term.word, index, end: index + term.surface.length, match: term.surface });
    }
    return found;
}
function replaceTerms(text, entries, replacements = '***') {
    if (!Array.isArray(replacements)) {
        const merged = [];
        for (const span of [...entries].sort((a, b) => a.index - b.index || a.end - b.end)) {
            const previous = merged.at(-1);
            if (previous && span.index < previous.end) previous.end = Math.max(previous.end, span.end);
            else merged.push({ index: span.index, end: span.end });
        }
        entries = merged;
    }
    let result = '', index = 0;
    for (let entry = 0; entry < entries.length; entry++) {
        const term = entries[entry];
        result += text.slice(index, term.index) + (Array.isArray(replacements) ? replacements[entry] : replacements);
        index = term.end;
    }
    return result + text.slice(index);
}
function censored(job, sample, orders) {
    if (!sample.count) return sample.text;
    if (job.replacement === 'callback') {
        if (job.kind === 'prefixes' || job.kind === 'bridge') return `$[${[...orders.keys()].join('|')}]` + sample.suffix;
        return replaceTerms(sample.text, locations(job, sample), job.terms.map(({ word }) => `$[${word}]`));
    }
    if (job.replacement) return replaceTerms(sample.text, locations(job, sample), job.replacements);
    if (job.kind === 'prefixes') return '***' + sample.suffix;
    if (job.kind === 'dense') {
        const entries = job.terms.map((term) => ({ index: term.offset, end: term.offset + term.surface.length }));
        return sample.prefix + replaceTerms(job.chunk, entries).repeat(sample.repeats) + sample.suffix;
    }
    return replaceTerms(sample.text, locations(job, sample));
}
// Provenance is verified in tests; benchmarks compare the stable span fields.
function plain(list) { return list.map(({ via, ...rest }) => (assert.ok(via?.kind), rest)); }
function check(job, sample, result, orders, wordCount, callbackCalls) {
    if (job.replacement === 'callback') assert.equal(callbackCalls, sample.count, 'Expected one callback per merged span');
    if (job.limited) { assert.equal(result, LIMIT, 'Expected the detailed-match safety limit'); return; }
    if (job.method === 'flag') { assert.equal(result, sample.count > 0); return; }
    if (job.method === 'censor') { assert.equal(result, censored(job, sample, orders)); return; }
    const words = !sample.count ? [] : job.kind === 'prefixes' ? [...orders.keys()]
        : [...new Set(job.terms.map((term) => term.word))].sort((a, b) => orders.get(a) - orders.get(b));
    if (job.method === 'badwords') { assert.deepEqual(result, words); return; }
    const expected = locations(job, sample);
    if (job.method === 'find') { assert.deepEqual(plain(result), expected); return; }
    if (job.method === 'classify') {
        const got = result.occurrences.map(({ word, index, end, match, via }) => ({ word, index, end, match, via }));
        // Sparse (100k-location) cases compare the count, ends and every 997th occurrence instead of all of them.
        if (job.sparse) { assert.equal(got.length, expected.length); for (let i = 0; i < got.length; i += 997) assert.deepEqual(plain([got[i]]), [expected[i]]); assert.deepEqual(plain(got.slice(-1)), expected.slice(-1)); }
        else assert.deepEqual(plain(got), expected);
        assert.equal(result.summary.classified + result.summary.unclassified, sample.count);
        assert.ok(Number.isInteger(result.score) && result.score >= 0 && result.score <= 100 && typeof result.level === 'string');
        return;
    }
    assert.deepEqual({ ...result, locations: plain(result.locations) }, { text: sample.text, words: wordCount,
        censored: censored(job, sample, orders), badwords: words, count: words.length,
        occurrenceCount: expected.length, locations: expected });
}
function summary(job, result) {
    if (result === LIMIT) return { kind: 'RangeError', reason: 'detailed match limit', limit: 10_000 };
    if (typeof result === 'boolean') return { kind: 'boolean', value: result };
    if (typeof result === 'string') return { kind: 'censored text', length: result.length, prefix: result.slice(0, 72) };
    if (job.method === 'badwords') return { kind: 'unique words', count: result.length, words: result };
    if (job.method === 'classify') return { kind: 'classify', occurrences: result.occurrences.length, score: result.score,
        level: result.level, summary: result.summary };
    const found = Array.isArray(result) ? result : result.locations;
    return { kind: job.method, occurrences: found.length, first: found[0] ?? null, last: found.at(-1) ?? null,
        ...(job.method === 'analyze' ? { uniqueWords: result.count, words: result.badwords, censoredLength: result.censored.length } : {}) };
}
function us(milliseconds) { return milliseconds * 1_000; }

async function measure(job) {
    let serial = 0;
    // `prepare` runs outside timings; classify() consumes find() results.
    let prepare = (value) => value;
    const sample = () => prepare(makeSample(job, ++serial));
    const first = makeSample(job, ++serial);
    // Only the fixed-width numeric reference varies; token structure is fixed.
    const wordCount = first.text.trim().split(/\s+/u).length;
    globalThis.gc?.();
    const baselineHeapMiB = process.memoryUsage().heapUsed / 1_048_576;
    let start = performance.now();
    const api = require('../dist/cjs/index.js');
    const importUs = us(performance.now() - start);
    const options = { ...job.options };
    let optionalSetupUs = 0;
    if (job.evasion) {
        const setupStart = performance.now();
        options.evasion = require('../dist/cjs/evasion.js').boundedEvasion(job.evasion);
        optionalSetupUs += us(performance.now() - setupStart);
    }
    if (job.fuzzy) {
        const setupStart = performance.now();
        options.fuzzy = require('../dist/cjs/fuzzy.js').boundedFuzzy(job.fuzzy);
        optionalSetupUs += us(performance.now() - setupStart);
    }
    if (job.dictionary === 'expanded') options.dictionary = api.expandedDictionary;
    if (job.dictionary === 'prefixes') options.dictionary = Array.from({ length: 64 }, (_, index) => 'a'.repeat(index + 1));
    if (job.dictionary === 'bridge-prefixes') options.dictionary =
        [...Array.from({ length: 128 }, (_, index) => 'a'.repeat(index + 1)), 'x', 'a x a'];
    if (job.dictionary === 'large-custom') options.dictionary = Array.from({ length: 10_000 }, (_, index) => `x${alphabeticId(index)}x`);
    start = performance.now();
    const detector = new api.Badwords(options);
    const constructionUs = us(performance.now() - start);
    let replacement, helperImportUs = 0, replacementSetupUs = 0, callbackCalls = 0;
    if (job.replacement) {
        let strategies;
        if (job.replacement !== 'callback') {
            start = performance.now();
            strategies = require('../dist/cjs/censor.js');
            helperImportUs = us(performance.now() - start);
        }
        start = performance.now();
        replacement = job.replacement === 'callback' ? ({ words }) => { callbackCalls++; return `$[${words.join('|')}]`; }
            : job.replacement === 'mask' ? strategies.mask({ keepFirst: 1, keepLast: 1 })
                : strategies.grawlix({ symbols: '@#$%', random: () => 0.25 });
        replacementSetupUs = us(performance.now() - start);
    }
    let operation;
    if (job.method === 'classify') {
        const { classify } = require('../dist/cjs/metadata.js');
        prepare = (value) => ({ ...value, found: detector.find(value.text) });
        Object.assign(first, prepare(first));
        operation = (sample) => classify(sample.found);
    } else operation = job.replacement || job.ignoreRanges
        ? (sample) => detector.censor(sample.text, replacement, sample.checkOptions)
        : (sample) => detector[job.method](sample.text);
    const invoke = job.limited ? (sample) => {
        try { operation(sample); } catch (error) {
            if (error instanceof RangeError && /Match limit exceeded/.test(error.message)) return LIMIT;
            throw error;
        }
        assert.fail('Expected a match-limit RangeError');
    } : operation;
    start = performance.now();
    let result = invoke(first);
    const firstCallUs = us(performance.now() - start);
    const orders = new Map(detector.dict.map((word, index) => [word, index]));
    check(job, first, result, orders, wordCount, callbackCalls);
    globalThis.gc?.();
    const readyHeapMiB = process.memoryUsage().heapUsed / 1_048_576;
    const maxBatch = Math.max(1, Math.min(16_384, Math.floor(2_000_000 / first.text.length)));
    function batch(count) {
        const inputs = Array.from({ length: count }, sample);
        const results = new Array(count);
        const calls = job.replacement === 'callback' ? new Array(count) : undefined;
        const begin = performance.now();
        if (calls) for (let index = 0; index < count; index++) {
            const before = callbackCalls;
            results[index] = invoke(inputs[index]);
            calls[index] = callbackCalls - before;
        } else for (let index = 0; index < count; index++) results[index] = invoke(inputs[index]);
        const elapsedMs = performance.now() - begin;
        for (let index = 0; index < count; index++) check(job, inputs[index], results[index], orders, wordCount, calls?.[index]);
        result = results.at(-1);
        return elapsedMs;
    }
    // --verify: assert the expected output on a few unique inputs and stop before warmup/timing.
    if (job.verify) { batch(Math.min(4, maxBatch)); return { type: 'verified', id: job.id }; }
    const warmBatch = Math.min(maxBatch, 128);
    let warmupMs = 0, warmupCalls = 0;
    const recent = [];
    do {
        const elapsed = batch(warmBatch);
        warmupMs += elapsed; warmupCalls += warmBatch;
        recent.push(elapsed / warmBatch);
        if (recent.length > 5) recent.shift();
    } while (warmupMs < job.warmupMs || warmupCalls < job.minWarmupCalls);
    const perCallMs = percentile(recent, 0.5);
    const batchSize = Math.max(1, Math.min(maxBatch, Math.ceil(job.targetBatchMs / Math.max(perCallMs, 0.000001))));
    const samples = Array.from({ length: job.samples }, () => batch(batchSize));
    const perCallUs = samples.map((elapsed) => us(elapsed / batchSize));
    globalThis.gc?.();
    return { type: 'measurement', id: job.id, status: job.limited ? 'limited' : 'measured', method: job.method,
        policy: { dictionary: job.dictionary ?? (options.dictionary ? 'explicit-custom' : 'core'), dictionaryTerms: orders.size, mode: options.mode ?? 'word',
            normalization: options.normalization ?? 'standard', ignoreRepeatedLetters: options.ignoreRepeatedLetters ?? false,
            maxMatches: options.maxMatches ?? 10_000, evasion: job.evasion ?? null, fuzzy: job.fuzzy ?? null, allowPhrases: options.allowPhrases ?? [],
            ignoreRanges: first.checkOptions?.ignoreRanges ?? [],
            replacement: !['censor', 'analyze'].includes(job.method) ? null
                : job.replacement === 'mask' ? { kind: 'mask', keepFirst: 1, keepLast: 1 }
                : job.replacement === 'grawlix' ? { kind: 'grawlix', symbols: '@#$%', random: 'constant 0.25' }
                    : job.replacement === 'callback' ? { kind: 'callback', operation: 'format unique contributor words' } : 'literal ***' },
        input: { kind: job.kind, position: job.position ?? null, utf16Units: first.text.length, payloadUnits: job.length,
            referenceIds: 'unique per operation; generation excluded from timings' },
        cold: { importUs, optionalSetupUs, constructionUs, helperImportUs, replacementSetupUs, firstCallUs,
            totalUs: importUs + optionalSetupUs + constructionUs + helperImportUs + replacementSetupUs + firstCallUs },
        warmup: { timedMs: warmupMs, calls: warmupCalls },
        timing: { samples: job.samples, batchSize, operations: job.samples * batchSize,
            medianUs: percentile(perCallUs, 0.5), p95Us: percentile(perCallUs, 0.95),
            medianBatchMs: percentile(samples, 0.5), targetBatchMs: job.targetBatchMs,
            statistic: 'per-operation batch means; p95 is not individual-request tail latency' },
        correctness: { checkedEveryResult: true, distinctInputs: serial, result: summary(job, result),
            ...(job.replacement === 'callback' ? { callbacksPerOperation: first.count } : {}) },
        memory: { baselineHeapMiB, readyHeapMiB, endingHeapMiB: process.memoryUsage().heapUsed / 1_048_576,
            maxRssMiB: process.resourceUsage().maxRSS / 1_024, heapLimitMiB: 256 } };
}

// Fresh-process scenarios. Each child imports only what its scenario needs, so import, compile
// (construction) and first-call cost are observed cold, with no earlier warmup in that process.
const SMALL_CLEAN = 'Apa kabar? Pesanan sudah sampai. Terima kasih.';
const LONG_CLEAN = fill(4_000, '000000000001');
const coldScenarios = {
    default: async (step) => {
        const api = await step('import root (CommonJS require)', () => require('../dist/cjs/index.js'));
        const checker = await step('construct default Badwords', () => new api.Badwords());
        await step('first flag, clean chat', () => assert.equal(checker.flag(SMALL_CLEAN), false));
        await step('first find, one match', () => assert.equal(checker.find('dasar goblok kamu').length, 1));
        await step('first censor, 4 KB clean', () => assert.equal(checker.censor(LONG_CLEAN), LONG_CLEAN));
    },
    'default-esm': async (step) => {
        const api = await step('import root (ES module)', () => import('../dist/esm/index.js'));
        await step('first flag, clean chat (shared default instance)', () => assert.equal(api.flag(SMALL_CLEAN), false));
        await step('first censor, one match', () => assert.equal(api.censor('dasar goblok kamu'), 'dasar *** kamu'));
    },
    metadata: async (step) => {
        const api = require('../dist/cjs/index.js');
        const checker = new api.Badwords();
        const meta = await step('import metadata', () => require('../dist/cjs/metadata.js'));
        await step('first classify', () => assert.equal(meta.classify(checker.find('dasar goblok kamu')).occurrences.length, 1));
    },
    'evasion-fuzzy': async (step) => {
        const api = require('../dist/cjs/index.js');
        const evasion = await step('import evasion', () => require('../dist/cjs/evasion.js'));
        const fuzzy = await step('import fuzzy', () => require('../dist/cjs/fuzzy.js'));
        const policies = await step('create bounded policies', () => ({
            evasion: evasion.boundedEvasion(bounded),
            fuzzy: fuzzy.boundedFuzzy({}) }));
        const checker = await step('construct evasion+fuzzy Badwords', () => new api.Badwords(policies));
        await step('first flag, 4 KB clean', () => assert.equal(checker.flag(LONG_CLEAN), false));
        await step('first censor, separated typo', () => assert.equal(checker.censor('dasar g-o-b-l-o-x kamu'), 'dasar *** kamu'));
    }
};
async function coldWorker(scenario) {
    const steps = [];
    const step = async (name, action) => {
        const begin = performance.now();
        const value = await action();
        steps.push({ name, us: us(performance.now() - begin) });
        return value;
    };
    await coldScenarios[scenario](step);
    return steps;
}
function spawnNode(args, input, timeout = 60_000) {
    const child = spawnSync(process.execPath, ['--max-old-space-size=256', '--expose-gc', fileURLToPath(import.meta.url), ...args],
        { input, encoding: 'utf8', timeout, maxBuffer: 16_777_216 });
    if (child.error || child.status !== 0) throw new Error(child.error?.message ?? child.stderr.trim());
    return JSON.parse(child.stdout.trim());
}
function coldSummary(scenario) {
    const runs = Array.from({ length: quick ? 3 : 9 }, () => spawnNode([`--cold-worker=${scenario}`]));
    const names = runs[0].map((entry) => entry.name);
    const steps = names.map((name, index) => {
        const values = runs.map((run) => run[index].us);
        return { name, medianUs: percentile(values, 0.5), minUs: Math.min(...values), maxUs: Math.max(...values) };
    });
    const totals = runs.map((run) => run.reduce((sum, entry) => sum + entry.us, 0));
    return { type: 'cold-start', id: `cold-${scenario}`, scenario, freshProcesses: runs.length, steps,
        totalMedianUs: percentile(totals, 0.5), totalMinUs: Math.min(...totals), totalMaxUs: Math.max(...totals) };
}

// Retained and peak memory. Scope: JS heap (`heapUsed`, after forced GC) retained by the loaded
// library plus one checker, compared with the same fresh process before anything was loaded; and
// whole-process peak RSS, which includes Node itself and is reported with the RSS at the same baseline.
const memoryScenarios = {
    default: { description: 'root import, one default checker, 2,000 unique 4 KB clean checks and 200 censor calls',
        build: (api) => new api.Badwords(), operations: 2_000 },
    'evasion-fuzzy': { description: 'bounded evasion + fuzzy checker over the default dictionary, 50 unique 4 KB clean checks and 20 censor calls',
        build: () => createChecker(fileURLToPath(new URL('../dist/cjs', import.meta.url)), { evasion: bounded, fuzzy: {} }), operations: 50 },
    'custom-10000-terms': { description: 'root import, a checker over a 10,000-term custom dictionary, 200 unique 4 KB clean checks',
        build: (api) => new api.Badwords({ dictionary: Array.from({ length: 10_000 }, (_, index) => `x${alphabeticId(index)}x`) }), operations: 200 }
};
function memoryWorker(scenario) {
    const { build, operations } = memoryScenarios[scenario];
    globalThis.gc();
    const base = process.memoryUsage();
    const rssAtBaseline = base.rss;
    const api = require('../dist/cjs/index.js');
    const checker = build(api);
    let flagged = 0;
    for (let index = 0; index < operations; index++) {
        const text = fill(4_000, String(index + 1).padStart(12, '0'));
        flagged += Number(checker.flag(text));
        if (index % 10 === 0) assert.equal(checker.censor(text), text);
    }
    assert.equal(flagged, 0);
    globalThis.gc();
    const after = process.memoryUsage();
    assert.equal(checker.flag(scenario === 'custom-10000-terms' ? 'dasar xax' : 'dasar goblok'), true);
    return { retainedHeapMiB: (after.heapUsed - base.heapUsed) / 1_048_576, baselineHeapMiB: base.heapUsed / 1_048_576,
        heapUsedMiB: after.heapUsed / 1_048_576, externalDeltaMiB: (after.external - base.external) / 1_048_576,
        baselineRssMiB: rssAtBaseline / 1_048_576, peakRssMiB: process.resourceUsage().maxRSS / 1_024 };
}

function git(args) {
    const run = spawnSync('git', args, { cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8' });
    return run.status === 0 ? run.stdout.trim() : null;
}
function environment(selected) {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
    const api = require('../dist/cjs/index.js');
    const commit = git(['rev-parse', '--short=12', 'HEAD']);
    return { type: 'environment', schema: 2, libraryVersion: manifest.version, commit,
        workingTreeClean: commit ? git(['status', '--porcelain'])?.length === 0 : null,
        node: process.version, v8: process.versions.v8, os: `${os.type()} ${os.release()}`, platform: process.platform,
        architecture: process.arch, cpuModel: os.cpus()[0]?.model ?? 'unknown', cpuCount: os.cpus().length,
        memoryGiB: Math.round(os.totalmem() / 2 ** 30), quick,
        defaults: { mode: 'word', normalization: 'standard', ignoreRepeatedLetters: false, maxMatches: 10_000,
            dictionary: 'core', coreTerms: api.dictionary.length, contextualTerms: api.contextualDictionary.length,
            expandedTerms: api.expandedDictionary.length },
        cases: selected.length, warmupMinimumMs: quick ? 40 : 250, timedSamples: quick ? 15 : 41,
        samplingMethod: `Each workload runs in a fresh child process (256 MiB heap, --expose-gc). Inputs are unique per call (fixed-width reference id). Warmup runs batches of up to 128 calls until ${quick ? 40 : 250} ms and ${quick ? 32 : 128} calls pass; the batch size is then calibrated to about ${quick ? 1 : 5} ms; ${quick ? 15 : 41} timed batches follow. Medians and p95 are of per-call batch means. Every result is checked against its expected output after timing, outside the timed region.`,
        workloads: selected.map(({ id, method, length }) => ({ id, method, payloadUnits: length })),
        measurements: 'Own-library synthetic workloads. Inputs are unique; input/range-fixture generation and every-result correctness checks are outside timings. Dispatch, callback execution/call-count capture, library range validation and result storage are included; no overhead subtraction, accuracy or production-throughput claim.',
        cold: 'Per-workload cold fields: fresh process root CommonJS require, explicit instance construction, optional helper require, replacement factory setup and first operation are separate. Excludes process startup and fixture generation. One cold observation per case. The cold-start records repeat this over several fresh processes per scenario.',
        memory: 'Per-workload memory: peak process RSS includes Node, library, corpus generation, collected batch results, assertions and GC; not library-only memory. The memory records use a dedicated fresh process per scenario: retained JS heap after forced GC versus the same process before loading the library, plus whole-process peak RSS (includes Node itself).',
        limits: 'Match-limit RangeErrors are expected only for the two overlapping-prefix detail cases. All other errors, wrong results and 20-second child timeouts fail the run.',
        nodeCompileCache: Boolean(process.env.NODE_COMPILE_CACHE) };
}

const workerArgument = (name) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
if (process.argv.includes('--worker')) {
    try { console.log(JSON.stringify(await measure(JSON.parse(readFileSync(0, 'utf8'))))); }
    catch (error) { console.error(`${error.name}: ${error.message}`); process.exitCode = 1; }
} else if (workerArgument('cold-worker')) {
    try { console.log(JSON.stringify(await coldWorker(workerArgument('cold-worker')))); }
    catch (error) { console.error(`${error.name}: ${error.message}`); process.exitCode = 1; }
} else if (workerArgument('memory-worker')) {
    try { console.log(JSON.stringify(memoryWorker(workerArgument('memory-worker')))); }
    catch (error) { console.error(`${error.name}: ${error.message}`); process.exitCode = 1; }
} else {
    const selection = workerArgument('cases')?.split(',');
    const processIds = [...Object.keys(coldScenarios).map((name) => `cold-${name}`), ...Object.keys(memoryScenarios).map((name) => `memory-${name}`)];
    if (selection) for (const id of selection) assert.ok(jobs.some((job) => job.id === id) || processIds.includes(id), `Unknown benchmark case: ${id}`);
    const jsonIndex = process.argv.indexOf('--json');
    const jsonFile = jsonIndex < 0 ? null : process.argv[jsonIndex + 1];
    assert.ok(jsonIndex < 0 || (jsonFile && !jsonFile.startsWith('--')), '--json needs a file path');
    const verify = process.argv.includes('--verify');
    const selected = jobs.filter((job) => !selection || selection.includes(job.id));
    const records = [];
    const emit = (record) => { records.push(record); console.log(JSON.stringify(record)); };
    // --verify is a correctness check (npm test): no environment record (it runs git), no timing.
    const header = verify ? null : environment(selected);
    if (!verify) emit(header);
    let failed = false;
    for (const definition of selected) {
        const job = { ...definition, verify, warmupMs: quick ? 40 : 250, minWarmupCalls: definition.heavy ? 2 : quick ? 32 : 128,
            targetBatchMs: quick ? 1 : 5, samples: definition.heavy ? 9 : quick ? 15 : 41 };
        if (verify) {
            // Verification asserts outputs only, so it runs in this process: fresh-process isolation matters for
            // cold-start and memory observations, which --verify does not make.
            try { records.push(await measure(job)); } catch (error) {
                console.error(`${error.name}: ${error.message}`);
                emit({ type: 'failure', id: job.id, message: error.message }); failed = true; break;
            }
            continue;
        }
        const child = spawnSync(process.execPath, ['--max-old-space-size=256', '--expose-gc', fileURLToPath(import.meta.url), '--worker'],
            { input: JSON.stringify(job), encoding: 'utf8', timeout: definition.heavy ? 180_000 : 20_000, maxBuffer: 1_048_576 });
        if (child.error || child.status !== 0) {
            emit({ type: 'failure', id: job.id, signal: child.signal, message: child.error?.message ?? child.stderr.trim() });
            failed = true; break;
        }
        emit(JSON.parse(child.stdout.trim()));
    }
    if (verify && !failed) console.log(`Verified expected output for ${selected.length} benchmark workloads (no timing).`);
    if (!verify && !failed) for (const name of Object.keys(coldScenarios)) {
        if (selection && !selection.includes(`cold-${name}`)) continue;
        try { emit(coldSummary(name)); } catch (error) { emit({ type: 'failure', id: `cold-${name}`, message: error.message }); failed = true; break; }
    }
    if (!verify && !failed) for (const [name, scenario] of Object.entries(memoryScenarios)) {
        if (selection && !selection.includes(`memory-${name}`)) continue;
        try { emit({ type: 'memory', id: `memory-${name}`, scenario: name, description: scenario.description,
            ...spawnNode([`--memory-worker=${name}`]), scope: 'heapUsed after forced GC minus the same fresh process before the library loads (retained by library + checker); peak RSS is whole-process and includes Node itself.' }); }
        catch (error) { emit({ type: 'failure', id: `memory-${name}`, message: error.message }); failed = true; break; }
    }
    if (failed) process.exitCode = 1;
    if (jsonFile && !verify) {
        const groups = (type) => records.filter((record) => record.type === type);
        writeFileSync(jsonFile, JSON.stringify({ schema: 2, environment: header, measurements: groups('measurement'),
            coldStart: groups('cold-start'), memory: groups('memory'), failures: groups('failure') }, null, 1) + '\n');
    }
}
