import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

// Public comparison (docs/benchmarks.md). Explicitly opt-in: reference packages are installed in a temporary
// directory with lifecycle scripts disabled; no project dependency or lockfile is changed.
//   npm run benchmark:compare                       run, print the summary JSON (nothing is written)
//   npm run benchmark:compare -- --write            run, then update benchmarks/comparison.json and the page tables
//   npm run benchmark:compare -- --check            no install, no timing: fail if the page tables differ from the checked JSON
//   npm run benchmark:compare -- --render          regenerate the page tables from the checked JSON without measuring
//   --quick (smoke run, never written), --json <file> (copy the summary), --packages <dir> (reuse an install)
const references = ['@sideid/id-profanity-filter@1.13.0', '@fldx/sopan@1.0.1', 'censorship-id@2.0.3'];
const PINS_CHECKED_ON = '2026-10-30'; // `npm view <package> version` showed no newer release on this date.
const root = fileURLToPath(new URL('../', import.meta.url));
const dataFile = join(root, 'benchmarks/comparison.json');
const pageFile = join(root, 'docs/benchmarks.md');
const quick = process.argv.includes('--quick');
const argument = (name) => { const index = process.argv.indexOf(`--${name}`); return index < 0 ? null : process.argv[index + 1]; };
const variants = 257; // Exceeds the small exact-input caches used by some filters.
const bounded = { separators: { characters: ['-', '_', '.', '*'], maxGap: 1, maxTotal: 8 }, repetitions: { maxExtraPerLetter: 2, maxTotal: 8 } };
// `package` is the npm package; `options` is the effective policy shown on the page.
const configs = [
    { id: 'ours', package: 'indonesian-badwords', title: 'indonesian-badwords', options: 'defaults (word mode, standard normalization, leetspeak folding)' },
    { id: 'ours-evasion', package: 'indonesian-badwords', title: 'indonesian-badwords + evasion', options: '`boundedEvasion`: single separators `- _ . *`, up to 2 repeated letters per letter' },
    { id: 'sideid', package: '@sideid/id-profanity-filter', title: '@sideid/id-profanity-filter', options: 'defaults' },
    { id: 'sideid-split', package: '@sideid/id-profanity-filter', title: '@sideid/id-profanity-filter + split', options: '`detectSplit: true`' },
    { id: 'sopan', package: '@fldx/sopan', title: '@fldx/sopan', options: 'defaults' },
    { id: 'censorship', package: 'censorship-id', title: 'censorship-id', options: 'defaults' },
    { id: 'censorship-smart', package: 'censorship-id', title: 'censorship-id + smart', options: '`smartMode: true`' }
];
const operations = [
    { id: 'flag', title: 'Boolean check', ours: '`flag()`' },
    { id: 'censor', title: 'Censor', ours: '`censor()`' },
    { id: 'locate', title: 'Locate', ours: '`find()`' }
];
const repeat = (text, length) => text.repeat(Math.ceil(length / text.length)).slice(0, length);
const plain = 'Pesanan sudah sampai. Terima kasih atas bantuan dan informasinya. ';
const unicode = '😀 Terima kasih, café baru itu nyaman. Pengiriman sudah sampai. ';
const cases = [
    { id: 'clean-short', group: 'chat', length: 32, what: 'clean ASCII' },
    { id: 'clean-chat', group: 'chat', length: 280, what: 'clean ASCII' },
    { id: 'match-chat', group: 'chat', length: 280, position: 'middle', term: 'goblok', what: 'one plain match in the middle' },
    { id: 'leet-chat', group: 'chat', length: 280, position: 'middle', term: 'g0bl0k', what: 'one leetspeak match' },
    { id: 'unicode-clean-chat', group: 'chat', length: 280, seed: unicode, what: 'clean, accents and emoji' },
    { id: 'unicode-match-chat', group: 'chat', length: 280, seed: unicode, position: 'middle', term: 'goblok', what: 'one match, accents and emoji' },
    { id: 'fullwidth-chat', group: 'chat', length: 280, position: 'middle', term: 'ＧＯＢＬＯＫ', what: 'one full-width match' },
    { id: 'invisible-chat', group: 'chat', length: 280, position: 'middle', term: 'kon​tol', what: 'one match split by a zero-width space' },
    { id: 'separator-chat', group: 'chat', length: 280, position: 'middle', term: 'k-o-n-t-o-l', what: 'one match spelled with hyphens' },
    { id: 'clean-paragraph', group: 'paragraph', length: 4_000, what: 'clean ASCII' },
    { id: 'unicode-clean-paragraph', group: 'paragraph', length: 4_000, seed: unicode, what: 'clean, accents and emoji' },
    ...['start', 'middle', 'end'].map((position) => ({ id: `match-${position}-paragraph`, group: 'paragraph', length: 4_000, position, term: 'goblok', what: `one match at the ${position}` })),
    { id: 'clean-long', group: 'long', length: 64_000, what: 'clean ASCII' },
    { id: 'clean-long-token', group: 'adversarial', length: 64_000, seed: 'pengembanganinfrastrukturpendidikan', what: 'one unbroken 64,000-letter token' },
    { id: 'dense-paragraph', group: 'adversarial', length: 4_000, seed: 'goblok kontol ', whole: true, what: 'a match every 7 characters' },
    { id: 'bang-dense-paragraph', group: 'adversarial', length: 4_000, seed: '!', what: '`!` repeated (no letters)' },
    { id: 'separator-run-paragraph', group: 'adversarial', length: 4_000, seed: 'a-', what: 'letters joined by hyphens, no match' }
];
const groups = [['chat', 'Chat-sized (32 and 280 characters)'], ['paragraph', 'Paragraph (4,000 characters)'], ['long', 'Long text (64,000 characters)'], ['adversarial', 'Adversarial inputs']];

function inputsFor(test) {
    return Array.from({ length: variants }, (_, index) => {
        // A fixed-width neutral identifier changes every input without changing its length,
        // matching content, or the surrounding word boundaries.
        const identifier = `q${String.fromCharCode(97 + Math.floor(index / 26), 97 + index % 26)}q `;
        // `whole` keeps only complete repeats (padding with spaces) so no repeat is cut into another word.
        let text = identifier + (test.whole ? test.seed.repeat(Math.floor((test.length - identifier.length) / test.seed.length)).padEnd(test.length - identifier.length)
            : repeat(test.seed ?? plain, test.length - identifier.length));
        if (test.term) {
            const insertion = ` ${test.term} `;
            const at = test.position === 'start' ? identifier.length
                : test.position === 'end' ? text.length - insertion.length : Math.floor(text.length / 2);
            text = text.slice(0, at) + insertion + text.slice(at + insertion.length);
        }
        return text;
    });
}
const expectedCount = (test) => test.id === 'dense-paragraph' ? (inputsFor(test)[0].match(/\b(?:goblok|kontol)\b/g) ?? []).length : test.term ? 1 : 0;

function loadAdapter(id, directory) {
    const external = createRequire(join(directory, 'package.json'));
    if (id.startsWith('ours')) {
        const local = createRequire(import.meta.url);
        const options = id === 'ours-evasion' ? { evasion: local('../dist/cjs/evasion.js').boundedEvasion(bounded) } : {};
        const checker = new (local('../dist/cjs/index.js').Badwords)(options);
        return { flag: (text) => checker.flag(text), censor: (text) => checker.censor(text), locate: (text) => checker.find(text) };
    }
    if (id.startsWith('sideid')) {
        const module = external('@sideid/id-profanity-filter');
        const Filter = module.IDProfanityFilter ?? module.default;
        const checker = new Filter(id === 'sideid-split' ? { detectSplit: true } : {});
        // analyze() reports matched words without offsets, so there is no equivalent locate operation.
        return { flag: (text) => checker.isProfane(text), censor: (text) => checker.filter(text).filtered, locate: null,
            analyze: (text) => checker.analyze(text) };
    }
    if (id === 'sopan') {
        const checker = external('@fldx/sopan');
        return { flag: (text) => checker.containsProfanity(text), censor: (text) => checker.clean(text), locate: (text) => checker.findProfanity(text) };
    }
    const checker = external('censorship-id');
    const options = id === 'censorship-smart' ? { smartMode: true } : undefined;
    return { flag: (text) => checker.isProfane(text, options), censor: (text) => checker.censorId(text, options), locate: (text) => checker.detect(text, options) };
}

const percentile = (sorted, value) => sorted[Math.ceil(sorted.length * value) - 1];
function verdictFor(operation, adapter, test, inputs) {
    const count = expectedCount(test);
    for (const text of inputs) {
        if (operation === 'flag') { const actual = adapter.flag(text); if (actual !== count > 0) return { status: 'different-output', expected: count > 0, actual }; }
        else if (operation === 'censor') { const changed = adapter.censor(text) !== text; if (changed !== count > 0) return { status: 'different-output', expected: count > 0 ? 'text changed' : 'text unchanged', actual: changed ? 'text changed' : 'text unchanged' }; }
        else { const found = adapter.locate(text).length; if (found !== count) return { status: 'different-output', expected: `${count} ${count === 1 ? 'occurrence' : 'occurrences'}`, actual: `${found} ${found === 1 ? 'occurrence' : 'occurrences'}` }; }
    }
    return null;
}
function measure(operation, adapter, test) {
    const inputs = inputsFor(test);
    const run = adapter[operation];
    // A single call over 200 ms (some packages degrade badly on adversarial input) cannot be sampled 257 x 31
    // times: verify and time three single calls on distinct inputs and mark the cell as reduced.
    const begin = performance.now();
    let wrong = verdictFor(operation, adapter, test, inputs.slice(0, 1));
    const firstMs = performance.now() - begin;
    if (wrong) return { id: test.id, ...wrong };
    if (firstMs > 200) {
        const times = [firstMs];
        for (const text of inputs.slice(1, 3)) {
            const start = performance.now();
            wrong = verdictFor(operation, adapter, test, [text]);
            times.push(performance.now() - start);
            if (wrong) return { id: test.id, ...wrong };
        }
        times.sort((a, b) => a - b);
        return { id: test.id, status: 'measured', reduced: true, medianUs: Number((times[1] * 1_000).toPrecision(4)), p95Us: Number((times[2] * 1_000).toPrecision(4)) };
    }
    wrong = verdictFor(operation, adapter, test, inputs);
    if (wrong) return { id: test.id, ...wrong };
    let cursor = 0, observed = 0;
    function batch(count) {
        const start = performance.now();
        for (let index = 0; index < count; index++) { observed += String(run(inputs[cursor])).length; cursor = (cursor + 1) % inputs.length; }
        return performance.now() - start;
    }
    const warmupEnd = performance.now() + (quick ? 10 : 100);
    do { batch(8); } while (performance.now() < warmupEnd);
    let calls = 1;
    while (batch(calls) < (quick ? 0.25 : 2) && calls < 16_384) calls *= 2;
    const samples = Array.from({ length: quick ? 7 : 31 }, () => batch(calls) * 1_000 / calls).sort((a, b) => a - b);
    return { id: test.id, status: 'measured', medianUs: Number(percentile(samples, 0.5).toPrecision(4)), p95Us: Number(percentile(samples, 0.95).toPrecision(4)) };
}

// Behaviour probes: each cell is produced by calling the installed package ("verified").
const probes = [
    ['Plain match (`goblok`)', 'dasar goblok kamu'],
    ['Leetspeak (`g0bl0k`)', 'dasar g0bl0k kamu'],
    ['Full-width letters (`ＧＯＢＬＯＫ`)', 'dasar ＧＯＢＬＯＫ kamu'],
    ['Zero-width space inside a word','dasar kon​tol kamu'],
    ['Hyphen-separated letters (`k-o-n-t-o-l`)', 'dasar k-o-n-t-o-l kamu'],
    ['Repeated letters (`gooobloook`)', 'dasar gooobloook kamu'],
    ['One-letter typo (`goblox`)', 'dasar goblox kamu'],
    ['Clean sentence not flagged (control)', 'Pesanan sudah sampai, terima kasih atas bantuannya.']
];
function probeResults(adapter) {
    return probes.map(([, text]) => adapter.flag(text));
}
function offsetsProbe(adapter) {
    if (adapter.locate) {
        const found = adapter.locate('halo goblok');
        return Array.isArray(found) && found.length === 1 && Number.isInteger(found[0].index) && found[0].index === 5;
    }
    return adapter.analyze('halo goblok').matchDetails.some((item) => 'index' in item);
}
function censorProbe(adapter) {
    return adapter.censor('dasar goblok kamu');
}

if (process.argv.includes('--worker')) {
    const { id, directory, tests } = JSON.parse(readFileSync(0, 'utf8'));
    const start = performance.now();
    const adapter = loadAdapter(id, directory);
    const loadAndConstructMs = performance.now() - start;
    const firstStart = performance.now();
    if (adapter.flag('Terima kasih atas bantuannya.') !== false) throw new Error(`${id}: unexpected clean first-call result`);
    const firstFlagMs = performance.now() - firstStart;
    const results = {};
    for (const operation of ['flag', 'censor', 'locate']) {
        if (!adapter[operation]) { results[operation] = 'unsupported'; continue; }
        results[operation] = Object.fromEntries(tests.map((test) => {
            const begin = performance.now(), cell = measure(operation, adapter, test);
            if (process.env.BENCHMARK_PROGRESS) console.error(`${id} ${operation} ${test.id}: ${cell.status} ${(performance.now() - begin).toFixed(0)} ms`);
            return [test.id, cell];
        }));
    }
    globalThis.gc?.();
    console.log(JSON.stringify({ id, loadAndConstructMs, firstFlagMs, results, probes: probeResults(adapter), offsets: offsetsProbe(adapter), censorSample: censorProbe(adapter),
        endingHeapMiB: process.memoryUsage().heapUsed / 1_048_576, processPeakRssMiB: process.resourceUsage().maxRSS / 1_024 }));
}

function formatTime(us) {
    if (us >= 1e6) return `${(us / 1e6).toFixed(1)} s`;
    return us < 10 ? `${us.toFixed(2)} µs` : us < 1000 ? `${us.toFixed(1)} µs` : `${(us / 1000).toFixed(2)} ms`;
}
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const bytes = (value) => value.toLocaleString('en-US');

// Documented rows come from each package's own README at the pinned version; "verified" rows are
// derived above from calls or from the installed manifest. Nothing here is a guess: an absent
// README statement is recorded as "not described".
const documentedRows = [
    ['Severity or category in results', { ours: 'yes: `classify()` in `/metadata`', sideid: 'yes: severity score, categories', sopan: 'not described', censorship: 'yes: severity, category' }],
    ['Region labels in results', { ours: 'yes: region IDs in `/metadata`', sideid: 'yes: regions', sopan: 'not described', censorship: 'not described' }],
    ['Allow list or exceptions', { ours: 'yes: `allowPhrases`, `ignoreRanges`', sideid: 'yes: whitelist', sopan: 'not described', censorship: 'yes: `allowedWords`' }],
    ['Custom dictionary', { ours: 'yes: `dictionary` option', sideid: 'yes: `wordList`', sopan: 'yes: `createFilter`, `addWords`', censorship: 'yes: `customWords`, `addWords`' }],
    ['Why a span matched (provenance)', { ours: 'yes: `via` on `find()`/`analyze()`', sideid: 'not described', sopan: 'normalized token in `findProfanity()`', censorship: 'not described' }],
    ['Opt-in typo tolerance', { ours: 'yes: `/fuzzy`', sideid: 'yes: similarity, Levenshtein', sopan: 'not described', censorship: 'not described' }]
];

function render(data) {
    const byId = Object.fromEntries(configs.map((config) => [config.id, config]));
    const env = data.environment;
    const sections = {};
    sections.environment = [
        `| Item | Value |`, `| --- | --- |`,
        `| Run date | ${data.date} |`, `| CPU | ${env.cpuModel} (${env.cpuCount} threads) |`, `| OS | ${env.os} |`,
        `| Node.js | ${env.node} (V8 ${env.v8}) |`, `| Architecture | ${env.architecture} |`,
        `| This package | indonesian-badwords ${env.libraryVersion}, built from commit ${env.commit} |`,
        ...data.packages.filter((item) => item.package !== 'indonesian-badwords').map((item) => `| ${item.package} | ${item.version} (latest on npm on ${data.pinsCheckedOn}) |`),
        `| Command | \`${data.command}\` |`
    ].join('\n');
    sections.configurations = [
        `| Column | Package | Effective options |`, `| --- | --- | --- |`,
        ...configs.map((config) => `| ${config.title} | ${config.package}@${data.packages.find((item) => item.package === config.package).version} | ${config.options} |`)
    ].join('\n');
    const speed = [];
    for (const operation of operations) {
        speed.push(`### ${operation.title}\n`);
        speed.push(`${operation.id === 'flag' ? 'Equivalent calls: this package `flag()`, `isProfane()` (both censorship-id and @sideid), `containsProfanity()` (sopan).'
            : operation.id === 'censor' ? 'Equivalent calls: this package `censor(text)`, `filter(text).filtered` (@sideid), `clean()` (sopan), `censorId()` (censorship-id).'
                : 'Equivalent calls: this package `find()`, `findProfanity()` (sopan), `detect()` (censorship-id). @sideid has no locate operation: `analyze()` returns matched words without offsets (verified by running).'}\n`);
        for (const [group, heading] of groups) {
            const rows = cases.filter((test) => test.group === group);
            speed.push(`#### ${heading}\n`, `| Input | ${configs.map((config) => config.title).join(' | ')} |`, `| --- | ${configs.map(() => '---:').join(' | ')} |`);
            for (const test of rows) {
                const cells = configs.map((config) => data.results[config.id][operation.id]);
                const measured = cells.map((cell) => cell === 'unsupported' ? null : cell[test.id]);
                const fastest = Math.min(...measured.filter((cell) => cell?.status === 'measured').map((cell) => cell.medianUs));
                speed.push(`| ${test.id} (${bytes(test.length)} chars: ${test.what}) | ${measured.map((cell) => !cell ? 'n/a'
                    : cell.status !== 'measured' ? 'differs' : (cell.medianUs === fastest ? `**${formatTime(cell.medianUs)}**` : formatTime(cell.medianUs)) + (cell.reduced ? ' †' : '')).join(' | ')} |`);
            }
            speed.push('');
        }
    }
    speed.push('† Reduced protocol: one call took over 200 ms, so the cell is the median of three single calls on different inputs (not 31 calibrated batches). Such a cell shows a package that degrades on that input, not a precise timing.');
    sections.speed = speed.join('\n').trim();
    // Automatic: every measured cell where this package is slower than the fastest correct rival under comparable options.
    const slowerTable = (oursId, rivalIds, heading) => {
        const rows = [];
        for (const operation of operations) for (const test of cases) {
            const ours = data.results[oursId][operation.id][test.id];
            if (ours?.status !== 'measured') continue;
            const rivals = rivalIds.map((id) => [id, data.results[id][operation.id]]).filter(([, cell]) => cell !== 'unsupported' && cell[test.id]?.status === 'measured')
                .map(([id, cell]) => [id, cell[test.id].medianUs]).sort((a, b) => a[1] - b[1]);
            if (rivals.length && rivals[0][1] < ours.medianUs) rows.push(`| ${operation.title} | ${test.id} (${bytes(test.length)} chars: ${test.what}) | ${formatTime(ours.medianUs)} | ${byId[rivals[0][0]].title} ${formatTime(rivals[0][1])} | ${(ours.medianUs / rivals[0][1]).toFixed(1)}x |`);
        }
        return rows.length ? [`**${heading}**\n`, `| Operation | Input | ${byId[oursId].title} | Fastest other | Ratio |`, '| --- | --- | ---: | --- | ---: |', ...rows].join('\n')
            : `**${heading}**: no measured cell in this run was faster for another package.`;
    };
    sections.slower = [slowerTable('ours', ['sideid', 'sopan', 'censorship'], 'Default options against default options'),
        slowerTable('ours-evasion', ['sideid-split', 'sopan', 'censorship-smart'], 'Evasion policy against the other packages\' opt-in modes (sopan has no separate mode)')].join('\n\n');
    const disagree = data.disagreements.map((item) => `| ${byId[item.config].title} | ${operations.find((operation) => operation.id === item.operation).title} | ${item.case} | ${item.expected} | ${item.actual} |`);
    sections.disagreements = disagree.length ? [`| Package | Operation | Input | Expected | Got |`, `| --- | --- | --- | --- | --- |`, ...disagree].join('\n') : 'No disagreements in this run.';
    sections.probes = [`| Behaviour | ${configs.map((config) => config.title).join(' | ')} |`, `| --- | ${configs.map(() => ':---:').join(' | ')} |`,
        ...probes.map(([label], index) => `| ${label} (verified by running) | ${configs.map((config) => (data.probes[config.id][index] ? 'flagged' : 'not flagged')).join(' | ')} |`)].join('\n');
    const featureColumns = ['ours', 'sideid', 'sopan', 'censorship'];
    sections.features = [`| Capability | ${featureColumns.map((id) => byId[id].package).join(' | ')} |`, `| --- | ${featureColumns.map(() => '---').join(' | ')} |`,
        ...data.verifiedFeatures.map((row) => `| ${row.label} (verified by running) | ${featureColumns.map((id) => row.values[id]).join(' | ')} |`),
        ...documentedRows.map(([label, values]) => `| ${label} (documented) | ${featureColumns.map((id) => values[id]).join(' | ')} |`)].join('\n');
    sections.startup = [`| Package | Load and construct | First clean \`flag()\` | JS heap after GC | Process peak RSS |`, `| --- | ---: | ---: | ---: | ---: |`,
        ...configs.map((config) => { const cold = data.startup[config.id]; return `| ${config.title} | ${cold.loadAndConstructMs.toFixed(2)} ms | ${cold.firstFlagMs.toFixed(2)} ms | ${cold.endingHeapMiB.toFixed(1)} MiB | ${cold.processPeakRssMiB.toFixed(0)} MiB |`; })].join('\n');
    sections.bundles = [`| Import | Minified | Gzip level 9 |`, `| --- | ---: | ---: |`,
        ...data.bundles.map((bundle) => `| ${bundle.title} | ${bytes(bundle.minifiedBytes)} B (${kb(bundle.minifiedBytes)}) | ${bytes(bundle.gzipBytes)} B (${kb(bundle.gzipBytes)}) |`)].join('\n');
    return sections;
}
const marker = (name, edge) => `<!-- benchmarks:${edge} ${name} -->`;
function inject(page, sections) {
    let output = page;
    for (const [name, content] of Object.entries(sections)) {
        const begin = output.indexOf(marker(name, 'begin')), end = output.indexOf(marker(name, 'end'));
        if (begin < 0 || end < begin) throw new Error(`docs/benchmarks.md is missing the generated section "${name}"`);
        output = output.slice(0, begin + marker(name, 'begin').length) + `\n${content}\n` + output.slice(end);
    }
    return output;
}

async function main() {
    if (process.argv.includes('--render')) {
        writeFileSync(pageFile, inject(readFileSync(pageFile, 'utf8'), render(JSON.parse(readFileSync(dataFile, 'utf8')))));
        console.log('Regenerated the tables in docs/benchmarks.md from benchmarks/comparison.json.');
        return;
    }
    if (process.argv.includes('--check')) {
        const data = JSON.parse(readFileSync(dataFile, 'utf8'));
        const pinned = Object.fromEntries(references.map((reference) => [reference.slice(0, reference.lastIndexOf('@')), reference.slice(reference.lastIndexOf('@') + 1)]));
        for (const item of data.packages) if (pinned[item.package] !== undefined && pinned[item.package] !== item.version) throw new Error(`benchmarks/comparison.json was measured with ${item.package}@${item.version}, the script pins ${pinned[item.package]}: rerun with --write.`);
        if (data.pinsCheckedOn !== PINS_CHECKED_ON) throw new Error('Pin check date differs between the script and benchmarks/comparison.json: rerun with --write.');
        const page = readFileSync(pageFile, 'utf8');
        if (inject(page, render(data)) !== page) throw new Error('docs/benchmarks.md tables differ from benchmarks/comparison.json: run `npm run benchmark:compare -- --write` (or revert the manual edit).');
        const current = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
        console.log(`docs/benchmarks.md matches benchmarks/comparison.json (measured ${data.date} on indonesian-badwords ${data.environment.libraryVersion}${current === data.environment.libraryVersion ? '' : `; package is now ${current}, rerun for the next minor release`}).`);
        return;
    }
    const supplied = argument('packages');
    const directory = supplied ?? mkdtempSync(join(os.tmpdir(), 'indonesian-badwords-benchmark-'));
    try {
        if (!supplied) {
            console.error(`Installing pinned benchmark references (scripts disabled): ${references.join(', ')}`);
            const install = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--prefix', directory, '--ignore-scripts', '--package-lock=false',
                '--no-audit', '--no-fund', '--save=false', ...references], { cwd: root, encoding: 'utf8', timeout: 120_000 });
            if (install.error || install.status !== 0) throw new Error(install.error?.message ?? install.stderr);
        }
        const packages = ['indonesian-badwords', ...references.map((reference) => reference.slice(0, reference.lastIndexOf('@')))].map((name) => {
            // Read manifests from their physical paths: some packages do not expose package.json through exports.
            const manifest = JSON.parse(readFileSync(name === 'indonesian-badwords' ? join(root, 'package.json') : join(directory, 'node_modules', name, 'package.json'), 'utf8'));
            const pinned = references.find((reference) => reference.startsWith(`${name}@`));
            if (pinned && !pinned.endsWith(`@${manifest.version}`)) throw new Error(`Reference version mismatch: ${name}@${manifest.version}`);
            return { package: name, version: manifest.version, runtimeDependencies: Object.keys(manifest.dependencies ?? {}).length, types: Boolean(manifest.types ?? manifest.typings) };
        });
        const results = {}, startup = {}, probeData = {}, offsets = {}, censorSamples = {};
        for (const config of configs) {
            console.error(`Measuring ${config.title}...`);
            const child = spawnSync(process.execPath, ['--max-old-space-size=256', '--expose-gc', fileURLToPath(import.meta.url), '--worker', ...(quick ? ['--quick'] : [])],
                { input: JSON.stringify({ id: config.id, directory, tests: cases }), encoding: 'utf8', timeout: 600_000, maxBuffer: 16_777_216,
                    ...(process.env.BENCHMARK_PROGRESS ? { stdio: ['pipe', 'pipe', 'inherit'] } : {}) });
            if (child.error || child.status !== 0) throw new Error(`${config.id}: ${child.error?.message ?? child.stderr}`);
            const worker = JSON.parse(child.stdout.trim());
            results[config.id] = worker.results; probeData[config.id] = worker.probes; offsets[config.id] = worker.offsets; censorSamples[config.id] = worker.censorSample;
            startup[config.id] = { loadAndConstructMs: worker.loadAndConstructMs, firstFlagMs: worker.firstFlagMs, endingHeapMiB: worker.endingHeapMiB, processPeakRssMiB: worker.processPeakRssMiB };
        }
        const disagreements = [];
        for (const config of configs) for (const operation of operations) {
            const cells = results[config.id][operation.id];
            if (cells !== 'unsupported') for (const test of cases) if (cells[test.id].status === 'different-output') {
                disagreements.push({ config: config.id, operation: operation.id, case: test.id, expected: String(cells[test.id].expected), actual: String(cells[test.id].actual) });
            }
        }
        const { build } = await import('esbuild');
        const bundleOf = async (title, contents) => {
            const result = await build({ stdin: { contents, resolveDir: directory }, bundle: true, platform: 'browser', target: 'es2022', format: 'esm', minify: true, legalComments: 'none', write: false });
            const output = result.outputFiles[0].contents;
            return { title, minifiedBytes: output.length, gzipBytes: gzipSync(output, { level: 9 }).length };
        };
        const dist = (file) => JSON.stringify(join(root, 'dist/esm', file));
        const bundles = [
            await bundleOf('indonesian-badwords (default import)', `export * from ${dist('index.js')};`),
            await bundleOf('indonesian-badwords + evasion + fuzzy', `export * from ${dist('index.js')}; export * from ${dist('evasion.js')}; export * from ${dist('fuzzy.js')};`),
            await bundleOf('@sideid/id-profanity-filter', `import Filter from '@sideid/id-profanity-filter'; export default new Filter();`),
            await bundleOf('@fldx/sopan', `import * as checker from '@fldx/sopan'; export default checker;`),
            await bundleOf('censorship-id', `import * as checker from 'censorship-id'; export default checker;`)
        ];
        const verifiedFeatures = [
            { label: 'Locates matches with offsets', values: Object.fromEntries(['ours', 'sideid', 'sopan', 'censorship'].map((id) => [id, offsets[id] === true ? 'yes' : 'no'])) },
            { label: 'Replaces matched text (`dasar goblok kamu` censored)', values: Object.fromEntries(['ours', 'sideid', 'sopan', 'censorship'].map((id) => [id, censorSamples[id] !== 'dasar goblok kamu' ? `yes: \`${censorSamples[id]}\`` : 'no'])) },
            { label: 'Zero runtime dependencies (installed manifest)', values: Object.fromEntries(packages.map((item) => [item.package === 'indonesian-badwords' ? 'ours' : item.package.includes('sideid') ? 'sideid' : item.package.includes('sopan') ? 'sopan' : 'censorship', item.runtimeDependencies === 0 ? 'yes' : `no (${item.runtimeDependencies})`])) },
            { label: 'Ships TypeScript declarations (installed manifest)', values: Object.fromEntries(packages.map((item) => [item.package === 'indonesian-badwords' ? 'ours' : item.package.includes('sideid') ? 'sideid' : item.package.includes('sopan') ? 'sopan' : 'censorship', item.types ? 'yes' : 'no'])) }
        ];
        const commit = spawnSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
        const data = {
            schema: 1, date: new Date().toISOString().slice(0, 10), pinsCheckedOn: PINS_CHECKED_ON, quick,
            command: 'npm run benchmark:compare -- --write',
            environment: { node: process.version, v8: process.versions.v8, os: `${os.type()} ${os.release()}`, architecture: process.arch,
                cpuModel: os.cpus()[0]?.model ?? 'unknown', cpuCount: os.cpus().length, libraryVersion: packages[0].version, commit },
            packages: packages.map(({ package: name, version }) => ({ package: name, version })),
            method: { warmupMs: quick ? 10 : 100, samples: quick ? 7 : 31, variants, minimumBatchMs: quick ? 0.25 : 2 },
            results, startup, probes: probeData, verifiedFeatures, disagreements, bundles
        };
        if (argument('json')) writeFileSync(argument('json'), JSON.stringify(data, null, 1) + '\n');
        if (process.argv.includes('--write')) {
            if (quick) throw new Error('--quick results are a smoke test and are never written; rerun without --quick.');
            writeFileSync(dataFile, JSON.stringify(data, null, 1) + '\n');
            writeFileSync(pageFile, inject(readFileSync(pageFile, 'utf8'), render(data)));
            console.log(`Wrote benchmarks/comparison.json and the generated tables in docs/benchmarks.md (${data.date}).`);
        } else console.log(JSON.stringify({ date: data.date, disagreements: data.disagreements.length, bundles, note: 'Nothing written; pass --write to update the page.' }));
    } finally {
        if (!supplied) rmSync(directory, { recursive: true, force: true });
    }
}
if (!process.argv.includes('--worker')) await main();
