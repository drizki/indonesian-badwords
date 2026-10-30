import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { boundedEvasionPolicy as bounded, createChecker, identifier, median, percentile, sink as sinkValue } from './lib/bench-common.mjs';

// Paired regression timing: compares two builds of this package on the same machine, in the same process
// per workload, with alternating A/B batches. Use it for speed-regression decisions; absolute numbers from
// shared CI are noisy and are never a gate.
//
//   node scripts/benchmark-paired.mjs --base npm            published latest vs the working tree
//   node scripts/benchmark-paired.mjs --base npm:2.5.3      a published version vs the working tree
//   node scripts/benchmark-paired.mjs --base git:v2.6.0 --head git:HEAD
//   node scripts/benchmark-paired.mjs --base dir:../other-checkout   a built checkout (needs dist/)
// Options: --head <spec> (default: the working tree, which must be built), --rounds <n>, --quick,
//   --cases <id,id>, --json <file>, --list
const root = fileURLToPath(new URL('../', import.meta.url));
const argument = (name) => {
    const joined = process.argv.find((item) => item.startsWith(`--${name}=`));
    if (joined) return joined.slice(name.length + 3);
    const index = process.argv.indexOf(`--${name}`);
    return index < 0 ? null : process.argv[index + 1];
};
const quick = process.argv.includes('--quick');
const rounds = Number(argument('rounds') ?? (quick ? 9 : 31));
const CLEAN = 'Pesanan sudah sampai. Terima kasih atas bantuan dan informasinya. ';
const UNICODE = '😀 Pesan: ＧＯＢＬＯＫ dan kon​tol. ';
const repeat = (text, length) => text.repeat(Math.ceil(length / text.length)).slice(0, length);
const tag = (index) => `${identifier(index)} `;
const clean = (length) => (index) => (tag(index) + repeat(CLEAN, length)).slice(0, length);
const placed = (length, term) => (index) => {
    const text = clean(length)(index), at = Math.floor(length / 2);
    return text.slice(0, at) + ` ${term} ` + text.slice(at + term.length + 2);
};
const dense = (length, chunk) => (index) => (tag(index) + repeat(chunk, length)).slice(0, length);
const workloads = [];
const add = (id, op, make, policy = {}) => workloads.push({ id, op, make, policy });
const fuzzyOne = { options: { dictionary: ['goblok'] }, fuzzy: {} };
for (const op of ['flag', 'censor', 'find']) add(`clean-chat-${op}`, op, clean(280));
for (const op of ['flag', 'censor', 'find', 'analyze']) add(`clean-paragraph-${op}`, op, clean(4_000));
for (const op of ['flag', 'censor', 'find']) add(`match-chat-${op}`, op, placed(280, 'goblok'));
for (const op of ['flag', 'censor', 'find']) add(`match-paragraph-${op}`, op, placed(4_000, 'goblok'));
add('leetspeak-chat-find', 'find', placed(280, 'g0bl0k'));
for (const op of ['flag', 'find', 'analyze']) add(`leetspeak-paragraph-${op}`, op, placed(4_000, 'g0bl0k'));
add('leetspeak-dense-paragraph-find', 'find', dense(4_000, 'g0bl0k k0nt0l '));
add('unicode-dense-paragraph-find', 'find', dense(4_000, UNICODE));
for (const op of ['find', 'censor']) add(`dense-20000-${op}`, op, dense(20_000, 'kontol goblok ngentot '));
for (const op of ['flag', 'censor', 'find']) add(`bang-dense-paragraph-${op}`, op, (index) => tag(index) + '!'.repeat(3_996));
for (const op of ['flag', 'censor', 'find']) add(`bang-letters-paragraph-${op}`, op, dense(4_000, 'a!'));
for (const op of ['flag', 'censor']) add(`separator-run-${op}`, op, dense(5_000, 'g-o-b-l-o-'));
for (const op of ['flag', 'censor', 'find']) add(`clean-long-text-${op}`, op, clean(64_000));
add('long-token-flag', 'flag', (index) => (tag(index).trim() + 'pengembanganinfrastruktur'.repeat(3_000)).slice(0, 64_000));
add('evasion-clean-paragraph-flag', 'flag', clean(4_000), { evasion: bounded });
add('evasion-separated-chat-censor', 'censor', placed(280, 'g-o-b-l-o-k'), { evasion: bounded });
add('fuzzy-clean-paragraph-flag', 'flag', clean(4_000), fuzzyOne);
add('fuzzy-typo-chat-censor', 'censor', placed(280, 'goblox'), fuzzyOne);
add('fuzzy-substring-clean-chat-flag', 'flag', clean(280), { options: { dictionary: ['goblok'], mode: 'substring' }, fuzzy: {} });
add('composed-typo-chat-censor', 'censor', placed(280, 'g-o-b-l-o-x'), { ...fuzzyOne, evasion: bounded });
add('composed-clean-chat-flag', 'flag', clean(280), { evasion: bounded, fuzzy: {} });

const comparable = (value) => JSON.stringify(value, (key, item) => key === 'via' ? undefined : item);

function worker({ id, base, head }) {
    const workload = workloads.find((item) => item.id === id);
    const inputs = Array.from({ length: 257 }, (_, index) => workload.make(index));
    const builds = {};
    for (const [name, directory] of Object.entries({ base, head })) {
        try {
            const checker = createChecker(join(directory, 'dist/cjs'), workload.policy);
            if (typeof checker[workload.op] !== 'function') throw new Error(`no ${workload.op}()`);
            builds[name] = (text) => checker[workload.op](text);
        } catch (error) { return { id, status: 'unsupported', reason: `${name}: ${error.message}` }; }
    }
    // Outputs may differ legitimately between releases (for example `via`, which is ignored); report it.
    const same = inputs.slice(0, 16).every((text) => comparable(builds.base(text)) === comparable(builds.head(text)));
    let cursor = 0, sink = 0;
    const batch = (run, calls) => {
        const begin = performance.now();
        for (let index = 0; index < calls; index++) { sink += sinkValue(run(inputs[cursor])); cursor = (cursor + 1) % inputs.length; }
        return (performance.now() - begin) * 1_000 / calls;
    };
    const warmupEnd = performance.now() + (quick ? 40 : 250);
    do { batch(builds.base, 16); batch(builds.head, 16); } while (performance.now() < warmupEnd);
    const target = quick ? 1 : 3;
    let calls = 1;
    while (batch(builds.base, calls) * calls / 1_000 < target && calls < 65_536) calls *= 2;
    const samples = { base: [], head: [] }, ratios = [];
    for (let round = 0; round < rounds; round++) {
        const order = round % 2 ? ['head', 'base'] : ['base', 'head'];
        const taken = {};
        for (const name of order) taken[name] = batch(builds[name], calls);
        samples.base.push(taken.base); samples.head.push(taken.head); ratios.push(taken.head / taken.base);
    }
    return { id, status: 'measured', op: workload.op, inputUtf16: inputs[0].length, callsPerBatch: calls, rounds,
        baseMedianUs: median(samples.base), headMedianUs: median(samples.head), ratio: median(ratios),
        ratioQ25: percentile(ratios, 0.25), ratioQ75: percentile(ratios, 0.75), outputsMatchIgnoringVia: same, sinkTotal: sink };
}

const scratch = [];
function run(command, args, options) {
    const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
    if (result.error || result.status !== 0) throw new Error(`${command} ${args.slice(0, 2).join(' ')} failed: ${result.error?.message ?? result.stderr}`);
    return result.stdout;
}
function resolveSpec(spec) {
    if (spec === '.' || spec === 'working-tree') return { directory: root, label: 'working tree' };
    if (spec.startsWith('dir:')) return { directory: resolve(spec.slice(4)), label: 'checkout' };
    const temporary = mkdtempSync(join(os.tmpdir(), 'badwords-paired-'));
    scratch.push(temporary);
    if (spec === 'npm' || spec.startsWith('npm:')) {
        const version = spec === 'npm' ? 'latest' : spec.slice(4);
        run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--prefix', temporary, '--ignore-scripts', '--package-lock=false',
            '--no-audit', '--no-fund', '--save=false', `indonesian-badwords@${version}`]);
        return { directory: join(temporary, 'node_modules', 'indonesian-badwords'), label: 'npm' };
    }
    if (spec.startsWith('git:')) {
        const ref = spec.slice(4);
        const archive = spawnSync('git', ['archive', '--format=tar', ref], { cwd: root, maxBuffer: 256 * 1024 * 1024 });
        if (archive.status !== 0) throw new Error(`git archive ${ref} failed`);
        run('tar', ['-x', '-C', temporary], { input: archive.stdout, encoding: 'buffer' });
        symlinkSync(join(root, 'node_modules'), join(temporary, 'node_modules'), 'dir');
        run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: temporary });
        return { directory: temporary, label: `git ${ref}` };
    }
    throw new Error(`Unknown build spec: ${spec}`);
}
const describe = ({ directory, label }) => {
    const version = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')).version;
    assertBuilt(directory);
    return `${label} (${version})`;
};
function assertBuilt(directory) {
    if (!existsSync(join(directory, 'dist/cjs/index.js'))) throw new Error('A build has no dist/; run `npm run build` in it first.');
}

if (process.argv.includes('--worker')) {
    console.log(JSON.stringify(worker(JSON.parse(readFileSync(0, 'utf8')))));
} else if (process.argv.includes('--list')) {
    for (const item of workloads) console.log(item.id);
} else {
    const baseSpec = argument('base');
    if (!baseSpec) { console.error('Usage: node scripts/benchmark-paired.mjs --base <npm[:version]|git:<ref>|dir:<path>> [--head <spec>] [--quick] [--rounds n] [--cases a,b] [--json file]'); process.exit(2); }
    try {
        const base = resolveSpec(baseSpec), head = resolveSpec(argument('head') ?? '.');
        const baseLabel = describe(base), headLabel = describe(head);
        const wanted = argument('cases')?.split(',');
        for (const id of wanted ?? []) if (!workloads.some((item) => item.id === id)) throw new Error(`Unknown workload: ${id}`);
        const selected = workloads.filter((item) => !wanted || wanted.includes(item.id));
        const results = [];
        console.log(`Paired timing, ${rounds} alternating rounds per workload (A = ${baseLabel}, B = ${headLabel}); ratio = B/A, below 1 is faster.`);
        console.log(`Node ${process.version} on ${os.cpus()[0]?.model ?? 'unknown CPU'} (${os.type()} ${os.release()}); run on a quiet machine, repeat to confirm.`);
        console.log(`${'workload'.padEnd(36)}${'A median'.padStart(12)}${'B median'.padStart(12)}${'ratio B/A'.padStart(11)}  q25-q75        verdict`);
        for (const item of selected) {
            const child = spawnSync(process.execPath, ['--max-old-space-size=256', fileURLToPath(import.meta.url), '--worker', ...(quick ? ['--quick'] : []), '--rounds', String(rounds)],
                { input: JSON.stringify({ id: item.id, base: base.directory, head: head.directory }), encoding: 'utf8', timeout: 120_000, maxBuffer: 1_048_576 });
            if (child.error || child.status !== 0) throw new Error(`${item.id}: ${child.error?.message ?? child.stderr}`);
            const result = JSON.parse(child.stdout.trim());
            results.push(result);
            if (result.status !== 'measured') { console.log(`${item.id.padEnd(36)}  skipped: ${result.reason}`); continue; }
            // Noise guard: only call a change when the whole interquartile range of paired ratios clears 5%.
            const verdict = result.ratioQ25 > 1.05 ? 'SLOWER' : result.ratioQ75 < 0.95 ? 'faster' : 'no clear change';
            console.log(`${item.id.padEnd(36)}${(result.baseMedianUs.toFixed(2) + ' us').padStart(12)}${(result.headMedianUs.toFixed(2) + ' us').padStart(12)}${result.ratio.toFixed(3).padStart(11)}  ${result.ratioQ25.toFixed(3)}-${result.ratioQ75.toFixed(3)}   ${verdict}${result.outputsMatchIgnoringVia ? '' : ' (outputs differ)'}`);
        }
        const file = argument('json');
        if (file) writeFileSync(file, JSON.stringify({ schema: 1, a: baseLabel, b: headLabel, node: process.version, cpuModel: os.cpus()[0]?.model ?? 'unknown',
            os: `${os.type()} ${os.release()}`, quick, rounds, results }, null, 1) + '\n');
    } finally { for (const directory of scratch) rmSync(directory, { recursive: true, force: true }); }
}
