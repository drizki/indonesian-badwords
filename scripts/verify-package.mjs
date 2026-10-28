import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { build } from 'esbuild';

const archive = process.argv[2];
if (!archive) throw new Error('Usage: npm run test:package -- <package.tgz>');
const archivePath = resolve(archive);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, cwd) {
    return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

const files = new Set(run('tar', ['-tzf', archivePath]).trim().split(/\r?\n/)
    .map((path) => path.replace(/^package\//, '')));
const manifest = JSON.parse(run('tar', ['-xOf', archivePath, 'package/package.json']));
assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0, 'Library must have zero runtime dependencies');
for (const required of ['package.json', 'README.md', 'LICENSE', 'dist/cjs/package.json']) {
    assert.ok(files.has(required), `Missing ${required} in packed package`);
}
for (const path of files) {
    if (path.endsWith('/')) continue;
    assert.ok(path.startsWith('dist/') || ['package.json', 'README.md', 'LICENSE'].includes(path),
        `Unexpected published file: ${path}`);
}
function verifyTargets(value) {
    if (typeof value === 'string') {
        assert.ok(value.startsWith('./') && files.has(value.slice(2)), `Missing export target: ${value}`);
    } else {
        for (const target of Object.values(value)) verifyTargets(target);
    }
}
verifyTargets(manifest.exports);
for (const field of ['main', 'module', 'types']) verifyTargets(manifest[field]);
assert.equal(JSON.parse(run('tar', ['-xOf', archivePath, 'package/dist/cjs/package.json'])).type, 'commonjs');
assert.deepEqual([...files].filter(path => path.endsWith('.js')).sort(),
    ['dist/cjs/index.js', 'dist/esm/index.js'], 'Publish one bundled runtime and its ESM facade');

const workspace = mkdtempSync(join(tmpdir(), 'indonesian-badwords-consumer-'));
try {
    writeFileSync(join(workspace, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    run(npm, ['install', archivePath, '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'], workspace);
    writeFileSync(join(workspace, 'consumer.mjs'), `
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import instance, * as api from 'indonesian-badwords';
const cjs = createRequire(import.meta.url)('indonesian-badwords');
assert.equal(api.Badwords, cjs.Badwords);
assert.equal(instance, cjs.default);
assert.equal(api.flag, cjs.flag);
assert.equal(api.find, cjs.find);
assert.ok(new api.Badwords() instanceof cjs.Badwords);
assert.ok(new cjs.Badwords() instanceof api.Badwords);
assert.equal(api.flag('dasar kontol'), true);
assert.equal(instance.censor('dasar kontol'), 'dasar ***');
assert.equal(api.flag('pantai'), false);
assert.deepEqual(api.find('😀 k0nt0l!'), [
    { word: 'kontol', index: 3, end: 9, match: 'k0nt0l' }
]);
const repeated = api.analyze('kontol kontol');
assert.equal(repeated.count, 1);
assert.equal(repeated.occurrenceCount, 2);
assert.equal(repeated.locations.length, 2);
for (const preset of ['dictionary', 'contextualDictionary', 'expandedDictionary']) {
    assert.equal(api[preset], cjs[preset]);
    assert.ok(Array.isArray(api[preset]));
    assert.ok(Object.isFrozen(api[preset]));
}
assert.equal(api.flag('anjing'), false);
assert.equal(new api.Badwords({ dictionary: api.expandedDictionary }).flag('anjing'), true);
assert.equal(new api.Badwords({ dictionary: ['goblok'], normalization: 'none' }).flag('GOBLOK'), false);
assert.equal(new api.Badwords({ ignoreRepeatedLetters: true }).flag('gooooblok'), true);
const custom = new api.Badwords({ dictionary: ['customterm'] });
assert.equal(custom.flag('customterm'), true);
assert.equal(custom.flag('kontol'), false);
const sharedWord = 'paketkontrol';
assert.equal(api.flag(sharedWord), false);
try {
    api.addWords(sharedWord);
    assert.equal(cjs.flag(sharedWord), true);
    cjs.removeWords(sharedWord);
    assert.equal(api.flag(sharedWord), false);
    cjs.addWords(sharedWord);
    assert.equal(api.flag(sharedWord), true);
} finally {
    api.removeWords(sharedWord);
}
`);
    writeFileSync(join(workspace, 'consumer.cjs'), `
const assert = require('node:assert/strict');
const api = require('indonesian-badwords');
assert.equal(api.flag('dasar kontol'), true);
assert.equal(api.default.censor('dasar kontol'), 'dasar ***');
assert.deepEqual(api.find('k0nt0l'), [{ word: 'kontol', index: 0, end: 6, match: 'k0nt0l' }]);
assert.equal(api.analyze('kontol kontol').occurrenceCount, 2);
assert.equal(new api.Badwords({ dictionary: api.expandedDictionary }).flag('anjing'), true);
assert.equal(new api.Badwords({ dictionary: ['customterm'] }).flag('customterm'), true);
`);
    run(process.execPath, ['consumer.mjs'], workspace);
    run(process.execPath, ['consumer.cjs'], workspace);

    // Bundle the installed tarball, so this also verifies that internal modules
    // needed by browser consumers made it into the published files.
    const browserEntry = join(workspace, 'consumer.browser.mjs');
    writeFileSync(browserEntry, `
import instance, { Badwords, find, dictionary, expandedDictionary } from 'indonesian-badwords';
let matchLimitEnforced = false;
try {
    new Badwords({ dictionary: ['a'], mode: 'substring', maxMatches: 2 }).find('aaa');
} catch (error) {
    matchLimitEnforced = error instanceof RangeError;
}
globalThis.browserResults = {
    flag: instance.flag('kontol'),
    censored: instance.censor('dasar k0nt0l'),
    unicodeSpans: find('😀 ｋ０ｎｔ０ｌ!'),
    invisibleSpans: find('kon\\u200btol'),
    repeatedLetters: new Badwords({ ignoreRepeatedLetters: true }).flag('gooooblok'),
    exactCase: new Badwords({ dictionary: ['goblok'], normalization: 'none' }).flag('GOBLOK'),
    defaultContextual: instance.flag('anjing'),
    expandedContextual: new Badwords({ dictionary: expandedDictionary }).flag('anjing'),
    frozenPresets: Object.isFrozen(dictionary) && Object.isFrozen(expandedDictionary),
    occurrences: instance.analyze('kontol kontol').occurrenceCount,
    matchLimitEnforced
};
`);
    const browserBundle = await build({
        entryPoints: [browserEntry], bundle: true, platform: 'browser',
        target: 'es2022', format: 'iife', write: false, metafile: true, logLevel: 'silent'
    });
    assert.equal(browserBundle.outputFiles.length, 1, 'Browser consumer must produce one self-contained bundle');
    for (const output of Object.values(browserBundle.metafile.outputs)) {
        assert.deepEqual(output.imports, [], 'Browser bundle must not leave external imports');
    }
    for (const input of Object.values(browserBundle.metafile.inputs)) {
        for (const dependency of input.imports) {
            assert.ok(!dependency.external, `Unexpected browser external import: ${dependency.path}`);
        }
    }
    const browser = createContext(Object.create(null));
    function verifyBrowserGlobals() {
        const globals = JSON.parse(runInContext('JSON.stringify([typeof require, typeof process, typeof Buffer])', browser));
        assert.deepEqual(globals, ['undefined', 'undefined', 'undefined']);
    }
    verifyBrowserGlobals();
    runInContext(browserBundle.outputFiles[0].text, browser, { timeout: 10_000 });
    verifyBrowserGlobals();
    const browserResults = JSON.parse(runInContext('JSON.stringify(globalThis.browserResults)', browser));
    assert.deepEqual(browserResults, {
        flag: true,
        censored: 'dasar ***',
        unicodeSpans: [{ word: 'kontol', index: 3, end: 9, match: 'ｋ０ｎｔ０ｌ' }],
        invisibleSpans: [{ word: 'kontol', index: 0, end: 7, match: 'kon\u200btol' }],
        repeatedLetters: true,
        exactCase: false,
        defaultContextual: false,
        expandedContextual: true,
        frozenPresets: true,
        occurrences: 2,
        matchLimitEnforced: true
    });

    const types = `
import instance, { Badwords, flag, find, analyze, dictionary, contextualDictionary, expandedDictionary,
    type AnalysisResult, type BadwordLocation, type BadwordsOptions, type MatchMode,
    type Normalization, type DictionaryWord, type ContextualDictionaryWord,
    type ExpandedDictionaryWord } from 'indonesian-badwords';
const mode: MatchMode = 'substring';
const normalization: Normalization = 'standard';
const options: BadwordsOptions = { dictionary: ['customterm'] as const, mode,
    normalization, ignoreRepeatedLetters: true, maxMatches: 1_000 };
const checker = new Badwords(options);
new Badwords({ normalization: 'none', dictionary: expandedDictionary });
new Badwords({ maxMatches: Infinity });
const defaultPreset: readonly string[] = dictionary;
const contextualPreset: readonly string[] = contextualDictionary;
const expandedPreset: readonly string[] = expandedDictionary;
const defaultWord: DictionaryWord = 'kontol';
const contextualWord: ContextualDictionaryWord = 'anjing';
const expandedWord: ExpandedDictionaryWord = contextualWord;
const found: boolean = flag('kontol');
const result: AnalysisResult = analyze('kontol');
const occurrences: number = result.occurrenceCount;
const locations: BadwordLocation[] = result.locations;
const matches: BadwordLocation[] = find('k0nt0l');
const instanceMatches: BadwordLocation[] = checker.find('customterm');
for (const location of matches) {
    const start: number = location.index;
    const end: number = location.end;
    const original: string = location.match;
}
const censored: string = instance.censor('kontol');
checker.addWords(['added'] as const);
checker.removeWords(['added'] as const);
// @ts-expect-error invalid matching mode
new Badwords({ mode: 'invalid' });
// @ts-expect-error invalid normalization policy
new Badwords({ normalization: 'invalid' });
// @ts-expect-error repeated-letter matching requires a boolean
new Badwords({ ignoreRepeatedLetters: 'yes' });
// @ts-expect-error match limits require a number
new Badwords({ maxMatches: '1000' });
// @ts-expect-error public presets are immutable
dictionary.push('customterm');
// @ts-expect-error invalid text type
flag(123);
// @ts-expect-error flag returns boolean
const invalid: string = flag('kontol');
`;
    for (const extension of ['mts', 'cts', 'ts']) {
        writeFileSync(join(workspace, `consumer.${extension}`), types + (extension === 'mts' ? `
import cjs = require('indonesian-badwords');
const fromImport: cjs.Badwords = checker;
const fromRequire: Badwords = new cjs.Badwords();
const defaultFromImport: cjs.Badwords = instance;
const defaultFromRequire: Badwords = cjs.default;
` : extension === 'cts' ? `
import cjs = require('indonesian-badwords');
const required: boolean = cjs.flag('kontol');
new cjs.Badwords({ dictionary: ['customterm'] });
` : ''));
    }
    const compiler = join(root, 'node_modules/typescript/bin/tsc');
    for (const mode of ['NodeNext', 'Node16', 'Bundler']) {
        const config = `tsconfig-${mode}.json`;
        writeFileSync(join(workspace, config), JSON.stringify({
            compilerOptions: {
                strict: true, noEmit: true, target: 'ES2022', skipLibCheck: false,
                module: mode === 'Bundler' ? 'ESNext' : mode, moduleResolution: mode,
                exactOptionalPropertyTypes: true, noUncheckedIndexedAccess: true
            },
            files: mode === 'Bundler' ? ['consumer.ts'] : ['consumer.mts', 'consumer.cts']
        }));
        run(process.execPath, [compiler, '-p', config], workspace);
    }
    const compilerVersion = JSON.parse(readFileSync(join(root, 'node_modules/typescript/package.json'))).version;
    console.log(`Verified packed files, shared ESM/CommonJS runtime identity and state, browser ES2022 bundle without Node globals or external imports, and TypeScript ${compilerVersion} (NodeNext/Node16/Bundler, including cross-format assignment).`);
} finally {
    rmSync(workspace, { recursive: true, force: true });
}
