import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

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
for (const method of ['flag', 'analyze']) add(`unicode-dense-4000-${method}`, 'dense', 4_000, method, {
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
    if (job.kind === 'long') return { text: (reference + CLEAN.replace(/[^a-z]/gi, '').repeat(1_000)).slice(0, job.length), count: 0 };
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
function check(job, sample, result, orders, wordCount, callbackCalls) {
    if (job.replacement === 'callback') assert.equal(callbackCalls, sample.count, 'Expected one callback per merged span');
    if (job.limited) { assert.equal(result, LIMIT, 'Expected the detailed-match safety limit'); return; }
    if (job.method === 'flag') { assert.equal(result, sample.count > 0); return; }
    if (job.method === 'censor') { assert.equal(result, censored(job, sample, orders)); return; }
    const words = !sample.count ? [] : job.kind === 'prefixes' ? [...orders.keys()]
        : [...new Set(job.terms.map((term) => term.word))].sort((a, b) => orders.get(a) - orders.get(b));
    if (job.method === 'badwords') { assert.deepEqual(result, words); return; }
    const expected = locations(job, sample);
    if (job.method === 'find') { assert.deepEqual(result, expected); return; }
    assert.deepEqual(result, { text: sample.text, words: wordCount,
        censored: censored(job, sample, orders), badwords: words, count: words.length,
        occurrenceCount: expected.length, locations: expected });
}
function summary(job, result) {
    if (result === LIMIT) return { kind: 'RangeError', reason: 'detailed match limit', limit: 10_000 };
    if (typeof result === 'boolean') return { kind: 'boolean', value: result };
    if (typeof result === 'string') return { kind: 'censored text', length: result.length, prefix: result.slice(0, 72) };
    if (job.method === 'badwords') return { kind: 'unique words', count: result.length, words: result };
    const found = Array.isArray(result) ? result : result.locations;
    return { kind: job.method, occurrences: found.length, first: found[0] ?? null, last: found.at(-1) ?? null,
        ...(job.method === 'analyze' ? { uniqueWords: result.count, words: result.badwords, censoredLength: result.censored.length } : {}) };
}
function percentile(values, fraction) { return [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1]; }
function us(milliseconds) { return milliseconds * 1_000; }

async function measure(job) {
    let serial = 0;
    const sample = () => makeSample(job, ++serial);
    const first = sample();
    // Only the fixed-width numeric reference varies; token structure is fixed.
    const wordCount = first.text.trim().split(/\s+/u).length;
    globalThis.gc?.();
    const baselineHeapMiB = process.memoryUsage().heapUsed / 1_048_576;
    let start = performance.now();
    const api = require('../dist/cjs/index.js');
    const importUs = us(performance.now() - start);
    const options = { ...job.options };
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
    const operation = job.replacement || job.ignoreRanges
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
        policy: { dictionary: job.dictionary ?? 'core', dictionaryTerms: orders.size, mode: options.mode ?? 'word',
            normalization: options.normalization ?? 'standard', ignoreRepeatedLetters: options.ignoreRepeatedLetters ?? false,
            maxMatches: options.maxMatches ?? 10_000, allowPhrases: options.allowPhrases ?? [],
            ignoreRanges: first.checkOptions?.ignoreRanges ?? [],
            replacement: !['censor', 'analyze'].includes(job.method) ? null
                : job.replacement === 'mask' ? { kind: 'mask', keepFirst: 1, keepLast: 1 }
                : job.replacement === 'grawlix' ? { kind: 'grawlix', symbols: '@#$%', random: 'constant 0.25' }
                    : job.replacement === 'callback' ? { kind: 'callback', operation: 'format unique contributor words' } : 'literal ***' },
        input: { kind: job.kind, position: job.position ?? null, utf16Units: first.text.length, payloadUnits: job.length,
            referenceIds: 'unique per operation; generation excluded from timings' },
        cold: { importUs, constructionUs, helperImportUs, replacementSetupUs, firstCallUs,
            totalUs: importUs + constructionUs + helperImportUs + replacementSetupUs + firstCallUs },
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

if (process.argv.includes('--worker')) {
    try { console.log(JSON.stringify(await measure(JSON.parse(readFileSync(0, 'utf8'))))); }
    catch (error) { console.error(`${error.name}: ${error.message}`); process.exitCode = 1; }
} else {
    const selection = process.argv.find((argument) => argument.startsWith('--cases='))?.slice(8).split(',');
    if (selection) for (const id of selection) assert.ok(jobs.some((job) => job.id === id), `Unknown benchmark case: ${id}`);
    const selected = jobs.filter((job) => !selection || selection.includes(job.id));
    console.log(JSON.stringify({ type: 'environment', libraryVersion: JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version,
        node: process.version, v8: process.versions.v8, platform: process.platform, architecture: process.arch, quick,
        cases: selected.length, warmupMinimumMs: quick ? 40 : 250, timedSamples: quick ? 15 : 41,
        measurements: 'Own-library synthetic workloads. Inputs are unique; input/range-fixture generation and every-result correctness checks are outside timings. Dispatch, callback execution/call-count capture, library range validation and result storage are included; no overhead subtraction, accuracy or production-throughput claim.',
        cold: 'Fresh process root CommonJS require, explicit instance construction, optional helper require, replacement factory setup and first operation are separate. Helpers load only in mask/grawlix cases. Excludes process startup and fixture generation. One cold observation per case.',
        memory: 'Peak process RSS includes Node, library, corpus generation, collected batch results, assertions and GC. Not library-only memory.',
        limits: 'Match-limit RangeErrors are expected only for the two overlapping-prefix detail cases. All other errors, wrong results and 20-second child timeouts fail the run.',
        nodeCompileCache: Boolean(process.env.NODE_COMPILE_CACHE) }));
    for (const definition of selected) {
        const job = { ...definition, warmupMs: quick ? 40 : 250, minWarmupCalls: quick ? 32 : 128,
            targetBatchMs: quick ? 1 : 5, samples: quick ? 15 : 41 };
        const child = spawnSync(process.execPath, ['--max-old-space-size=256', '--expose-gc', fileURLToPath(import.meta.url), '--worker'],
            { input: JSON.stringify(job), encoding: 'utf8', timeout: 20_000, maxBuffer: 1_048_576 });
        if (child.error || child.status !== 0) {
            console.error(JSON.stringify({ type: 'failure', id: job.id, signal: child.signal,
                message: child.error?.message ?? child.stderr.trim() }));
            process.exitCode = 1; break;
        }
        console.log(child.stdout.trim());
    }
}
