import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { bundleSize } from './lib/bundle-size.mjs';
import { createChecker } from './lib/bench-common.mjs';

// Correctness and size budgets (benchmarks/budgets.json) for the built package. Speed is never a gate here:
// shared CI timings are too noisy; use `npm run benchmark:paired` for regression decisions.
//   node scripts/check-budgets.mjs            check correctness + sizes, then verify every benchmark workload
//   node scripts/check-budgets.mjs --measure  print current sizes next to their budgets
//   node scripts/check-budgets.mjs --no-workloads  skip the (slower) benchmark workload verification
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const budgets = JSON.parse(readFileSync(new URL('../benchmarks/budgets.json', import.meta.url), 'utf8'));
const measureOnly = process.argv.includes('--measure');

const strip = (list) => list.map(({ via, ...rest }) => rest);
const checker = (policy = {}) => createChecker(join(root, 'dist/cjs'), policy);
function run(entry) {
    const instance = checker(entry.policy);
    switch (entry.op) {
        case 'flag': case 'censor': case 'badwords': case 'find': return instance[entry.op](entry.input);
        case 'analyze': { const { locations, ...rest } = instance.analyze(entry.input); return { ...rest, locations }; }
        case 'classify': {
            const { classify } = require('../dist/cjs/metadata.js');
            const { occurrences, score, level, summary } = classify(instance.find(entry.input));
            return { score, level, classified: summary.classified, unclassified: summary.unclassified, words: occurrences.map((item) => item.word) };
        }
        default: throw new Error(`Unknown budget operation: ${entry.op}`);
    }
}

let correctness = 0;
if (!measureOnly) {
    for (const entry of budgets.correctness) {
        if (entry.throws) {
            assert.throws(() => run(entry), (error) => error.name === entry.throws.name && new RegExp(entry.throws.message).test(error.message),
                `${entry.id}: expected ${entry.throws.name}`);
        } else assert.deepEqual(run(entry), entry.expected, `Correctness budget failed: ${entry.id}`);
        correctness++;
    }
    // Provenance must stay informational: stripped results equal the plain span fields.
    const spans = checker().find('dasar goblok');
    assert.deepEqual(strip(spans), [{ word: 'goblok', index: 6, end: 12, match: 'goblok' }]);
}

const importSpecifier = (entry) => `export * from ${JSON.stringify(fileURLToPath(new URL(`../dist/esm/${entry.file}`, import.meta.url)))};`;
const sizes = [];
for (const entry of budgets.sizes) {
    const contents = entry.entries.map((file) => importSpecifier({ file })).join('\n');
    const { minifiedBytes, gzipBytes } = await bundleSize(contents, root);
    sizes.push({ id: entry.id, minified: minifiedBytes, gzip: gzipBytes, entry });
}
if (measureOnly) {
    console.log(`Node ${process.version}, zlib ${process.versions.zlib}`);
    for (const { id, minified, gzip, entry } of sizes) console.log(`${id.padEnd(18)} minified ${String(minified).padStart(7)} (budget ${entry.maxMinifiedBytes})  gzip ${String(gzip).padStart(6)} (budget ${entry.maxGzipBytes})`);
} else {
    for (const { id, minified, gzip, entry } of sizes) {
        assert.ok(minified <= entry.maxMinifiedBytes, `Size budget exceeded for ${id}: ${minified} B minified > ${entry.maxMinifiedBytes} B. Justify and raise benchmarks/budgets.json, or shrink the bundle.`);
        assert.ok(gzip <= entry.maxGzipBytes, `Size budget exceeded for ${id}: ${gzip} B gzipped > ${entry.maxGzipBytes} B. Justify and raise benchmarks/budgets.json, or shrink the bundle.`);
    }
    let workloads = 'without benchmark workload verification';
    if (!process.argv.includes('--no-workloads')) {
        const verified = spawnSync(process.execPath, [fileURLToPath(new URL('./benchmark.mjs', import.meta.url)), '--verify'], { encoding: 'utf8' });
        if (verified.status !== 0) { process.stderr.write(verified.stdout + verified.stderr); process.exit(1); }
        workloads = verified.stdout.trim().replace(/^Verified expected output for /, 'verified expected output of ').replace(/ \(no timing\)\.$/, '');
    }
    // The public comparison page must still match its checked JSON (no install, no timing).
    const page = spawnSync(process.execPath, [fileURLToPath(new URL('./benchmark-compare.mjs', import.meta.url)), '--check'], { encoding: 'utf8' });
    if (page.status !== 0) { process.stderr.write(page.stdout + page.stderr); process.exit(1); }
    console.log(`Budgets met: ${correctness} correctness cases, ${sizes.length} bundle sizes, ${workloads}.`);
}
