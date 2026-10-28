import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

// Explicitly opt-in: reference packages are installed in a temporary directory,
// with lifecycle scripts disabled. No project dependency or lockfile is changed.
const references = ['@sideid/id-profanity-filter@1.13.0', '@fldx/sopan@1.0.1', 'censorship-id@2.0.3'];
const labels = ['indonesian-badwords', '@sideid/id-profanity-filter', '@fldx/sopan', 'censorship-id', 'censorship-id/smart'];
const root = fileURLToPath(new URL('../', import.meta.url));
const quick = process.argv.includes('--quick');
const variants = 257; // Exceeds the small exact-input caches used by some filters.
const repeat = (text, length) => text.repeat(Math.ceil(length / text.length)).slice(0, length);
const plain = 'Pesanan sudah sampai. Terima kasih atas bantuan dan informasinya. ';
const unicode = '😀 Terima kasih, café baru itu nyaman. Pengiriman sudah sampai. ';
const cases = [
    { id: 'clean-short', length: 32 },
    { id: 'clean-chat', length: 280 },
    { id: 'clean-paragraph', length: 4_000 },
    { id: 'clean-long-token', length: 64_000, seed: 'pengembanganinfrastrukturpendidikan' },
    ...[280, 4_000].flatMap(length => ['start', 'middle', 'end'].map(position => ({
        id: `match-${position}-${length}`, length, position, term: 'goblok'
    }))),
    { id: 'leet-chat', length: 280, position: 'middle', term: 'g0bl0k' },
    { id: 'dense-paragraph', length: 4_000, seed: 'goblok kontol ', expected: true },
    { id: 'unicode-clean-chat', length: 280, seed: unicode },
    { id: 'unicode-clean-paragraph', length: 4_000, seed: unicode },
    { id: 'unicode-match', length: 280, seed: unicode, position: 'middle', term: 'goblok' },
    { id: 'fullwidth-match', length: 280, position: 'middle', term: 'ＧＯＢＬＯＫ' },
    { id: 'invisible-match', length: 280, position: 'middle', term: 'kon\u200btol' },
    { id: 'separator-match', length: 280, position: 'middle', term: 'k-o-n-t-o-l' }
];

function inputsFor(test) {
    return Array.from({ length: variants }, (_, index) => {
        // A fixed-width neutral identifier changes every input without changing
        // its length, matching content, or the surrounding word boundaries.
        const identifier = `q${String.fromCharCode(97 + Math.floor(index / 26), 97 + index % 26)}q `;
        let text = identifier + repeat(test.seed ?? plain, test.length - identifier.length);
        if (test.term) {
            const insertion = ` ${test.term} `;
            const index = test.position === 'start' ? identifier.length
                : test.position === 'end' ? text.length - insertion.length
                    : Math.floor(text.length / 2);
            text = text.slice(0, index) + insertion + text.slice(index + insertion.length);
        }
        return text;
    });
}

function loadChecker(label, directory) {
    const external = createRequire(join(directory, 'package.json'));
    if (label === labels[0]) {
        const { Badwords } = createRequire(import.meta.url)('../dist/cjs/index.js');
        return new Badwords();
    }
    if (label === labels[1]) {
        const module = external(label);
        const Filter = module.IDProfanityFilter ?? module.default;
        const checker = new Filter();
        return { flag: text => checker.isProfane(text) };
    }
    if (label === labels[2]) {
        const checker = external(label);
        return { flag: text => checker.containsProfanity(text) };
    }
    const checker = external('censorship-id');
    return { flag: label.endsWith('/smart')
        ? text => checker.isProfane(text, { smartMode: true })
        : text => checker.isProfane(text) };
}

function percentile(sorted, value) {
    return sorted[Math.ceil(sorted.length * value) - 1];
}

function measure(checker, test) {
    const inputs = inputsFor(test);
    const expected = test.expected ?? Boolean(test.term);
    for (const text of inputs) {
        const actual = checker.flag(text);
        if (actual !== expected) return { id: test.id, status: 'different-output', expected, actual };
    }
    let cursor = 0;
    let observed = 0;
    function batch(count) {
        const start = performance.now();
        for (let index = 0; index < count; index++) {
            observed += Number(checker.flag(inputs[cursor]));
            cursor = (cursor + 1) % inputs.length;
        }
        return performance.now() - start;
    }
    const warmupEnd = performance.now() + (quick ? 10 : 100);
    do { batch(16); } while (performance.now() < warmupEnd);
    let calls = 1;
    while (batch(calls) < (quick ? 0.25 : 2) && calls < 16_384) calls *= 2;
    const samples = Array.from({ length: quick ? 7 : 31 }, () => batch(calls) * 1_000 / calls);
    samples.sort((a, b) => a - b);
    return {
        id: test.id, status: 'measured', inputUtf16: inputs[0].length,
        expected, variants, callsPerSample: calls, samples: samples.length,
        medianUs: Number(percentile(samples, 0.5).toFixed(3)),
        p95Us: Number(percentile(samples, 0.95).toFixed(3)), observed
    };
}

if (process.argv.includes('--worker')) {
    const { label, directory } = JSON.parse(readFileSync(0, 'utf8'));
    const start = performance.now();
    const checker = loadChecker(label, directory);
    const loadAndConstructMs = performance.now() - start;
    const firstStart = performance.now();
    const first = checker.flag('Terima kasih atas bantuannya.');
    const firstFlagMs = performance.now() - firstStart;
    if (first !== false) throw new Error(`${label}: unexpected clean first-call result`);
    const results = cases.map(test => measure(checker, test));
    globalThis.gc?.();
    console.log(JSON.stringify({
        package: label, loadAndConstructMs, firstFlagMs, results,
        endingHeapMiB: process.memoryUsage().heapUsed / 1_048_576,
        processPeakRssMiB: process.resourceUsage().maxRSS / 1_024
    }));
} else {
    const suppliedIndex = process.argv.indexOf('--packages');
    const temporary = suppliedIndex < 0;
    const directory = temporary ? mkdtempSync(join(tmpdir(), 'indonesian-badwords-benchmark-'))
        : process.argv[suppliedIndex + 1];
    if (!directory) throw new Error('--packages needs a directory containing node_modules');
    try {
        if (temporary) {
            console.error(`Installing pinned benchmark references (scripts disabled): ${references.join(', ')}`);
            const install = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
                'install', '--prefix', directory, '--ignore-scripts', '--package-lock=false',
                '--no-audit', '--no-fund', '--save=false', ...references
            ], { cwd: root, encoding: 'utf8', timeout: 120_000 });
            if (install.error || install.status !== 0) throw new Error(install.error?.message ?? install.stderr);
        }
        const packageVersions = Object.fromEntries(labels.slice(0, 4).map(label => {
            // Read manifests from their physical paths: some packages do not
            // expose package.json through the exports map.
            const manifest = label === labels[0] ? join(root, 'package.json')
                : join(directory, 'node_modules', label, 'package.json');
            const version = JSON.parse(readFileSync(manifest, 'utf8')).version;
            const pinned = references.find(reference => reference.startsWith(`${label}@`));
            if (pinned && !pinned.endsWith(`@${version}`)) throw new Error(`Reference version mismatch: ${label}@${version}`);
            return [label, version];
        }));
        console.log(JSON.stringify({
            type: 'environment', node: process.version, v8: process.versions.v8,
            platform: process.platform, architecture: process.arch, packageVersions,
            method: 'Boolean checks; default policies except censorship-id/smart explicitly enables smartMode. Local working-tree build is compared with pinned published references.',
            timing: '257 varied synthetic inputs per case; 100ms warmup, calibrated >=2ms batches, 31 samples (quick: 10ms, >=0.25ms, 7). Median/p95 are per-call batch averages, not request latency percentiles. Cold load/construct and first call are single observations excluding Node startup.',
            correctness: 'Every input must return the expected boolean before timing. Different output is reported without timing; these targeted fixtures are not accuracy scores. Dictionaries, features, and policies differ.',
            memory: 'Ending JS heap after GC and peak RSS for each isolated package process, across all workloads, with a 256 MiB V8 heap. Includes the harness and package.',
            quick
        }));
        for (const label of labels) {
            console.error(`Measuring ${label}...`);
            const child = spawnSync(process.execPath, [
                '--max-old-space-size=256', '--expose-gc', fileURLToPath(import.meta.url),
                '--worker', ...(quick ? ['--quick'] : [])
            ], {
                input: JSON.stringify({ label, directory }), encoding: 'utf8',
                timeout: 60_000, maxBuffer: 1_048_576
            });
            if (child.error || child.status !== 0) throw new Error(`${label}: ${child.error?.message ?? child.stderr}`);
            console.log(child.stdout.trim());
        }
        const { build } = await import('esbuild');
        const bundles = [];
        for (const label of labels.slice(0, 4)) {
            const contents = label === labels[0] ? `export { default } from ${JSON.stringify(join(root, 'dist/esm/index.js'))};`
                : label === labels[1] ? `import Filter from '${label}'; export default new Filter();`
                    : `import * as checker from '${label}'; export default checker;`;
            const result = await build({
                stdin: { contents, resolveDir: directory }, bundle: true, platform: 'browser',
                target: 'es2022', format: 'esm', minify: true, legalComments: 'none', write: false
            });
            const bytes = result.outputFiles[0].contents;
            bundles.push({ package: label, minifiedBytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 9 }).length });
        }
        console.log(JSON.stringify({ type: 'browser-bundles', method: 'Default checker API exposed; esbuild, ES2022, minified ESM, gzip level 9. APIs and dictionaries differ.', bundles }));
    } finally {
        if (temporary) rmSync(directory, { recursive: true, force: true });
    }
}
