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
for (const required of ['package.json', 'README.md', 'README.id.md', 'LICENSE', 'THIRD_PARTY_NOTICES', 'dist/cjs/package.json']) {
    assert.ok(files.has(required), `Missing ${required} in packed package`);
}
for (const path of files) {
    if (path.endsWith('/')) continue;
    assert.ok(path.startsWith('dist/') || ['package.json', 'README.md', 'README.id.md', 'LICENSE', 'THIRD_PARTY_NOTICES'].includes(path),
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
    ['dist/cjs/catalog.js', 'dist/cjs/censor.js', 'dist/cjs/evasion.js', 'dist/cjs/fuzzy.js', 'dist/cjs/index.js', 'dist/cjs/metadata.js',
        'dist/esm/catalog.js', 'dist/esm/censor.js', 'dist/esm/evasion.js', 'dist/esm/fuzzy.js', 'dist/esm/index.js', 'dist/esm/metadata.js'],
    'Publish each optional runtime with its ESM facade');
const evasionSource = run('tar', ['-xOf', archivePath, 'package/dist/cjs/evasion.js']);
assert.ok(!evasionSource.includes('kontol') && !evasionSource.includes('defaultDictionary'), 'Evasion must share the supplied dictionary');
const fuzzySource = run('tar', ['-xOf', archivePath, 'package/dist/cjs/fuzzy.js']);
assert.ok(!fuzzySource.includes('kontol') && !fuzzySource.includes('defaultDictionary'), 'Fuzzy must share the supplied dictionary');
const rootSource = run('tar', ['-xOf', archivePath, 'package/dist/cjs/index.js']);
assert.ok(!rootSource.includes('maxExtraPerLetter') && !rootSource.includes('maxConfusables') && !rootSource.includes('maxIndexPostings'), 'Root must not embed the optional scanner or config');
const strategySource = run('tar', ['-xOf', archivePath, 'package/dist/cjs/censor.js']);
assert.ok(!strategySource.includes('kontol') && !strategySource.includes('defaultDictionary'),
    'Optional strategies must not duplicate the dictionary or root runtime');

const workspace = mkdtempSync(join(tmpdir(), 'indonesian-badwords-consumer-'));
try {
    writeFileSync(join(workspace, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    run(npm, ['install', archivePath, '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'], workspace);
    writeFileSync(join(workspace, 'consumer.mjs'), `
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import instance, * as api from 'indonesian-badwords';
import { mask, grawlix } from 'indonesian-badwords/censor';
import { boundedEvasion, latinLookalikes, EvasionLimitError } from 'indonesian-badwords/evasion';
import { boundedFuzzy, FuzzyLimitError } from 'indonesian-badwords/fuzzy';
import * as metadataApi from 'indonesian-badwords/metadata';
import * as catalogApi from 'indonesian-badwords/catalog';
const require = createRequire(import.meta.url);
const cjs = require('indonesian-badwords');
const strategies = require('indonesian-badwords/censor');
const cjsMetadata = require('indonesian-badwords/metadata');
const cjsCatalog = require('indonesian-badwords/catalog');
for (const name of Object.keys(metadataApi)) assert.equal(metadataApi[name], cjsMetadata[name]);
for (const name of Object.keys(catalogApi)) assert.equal(catalogApi[name], cjsCatalog[name]);
assert.ok(metadataApi.reviewedDictionary.length > 0);
assert.equal(metadataApi.metadata.length, 344);
assert.equal(metadataApi.getMetadata('kontol')[0].surface, 'kontol');
assert.deepEqual(metadataApi.selectDictionary({ profiles: [] }), []);
assert.equal(new api.Badwords({ dictionary: metadataApi.reviewedDictionary }).flag('kontol'), true);
assert.ok(catalogApi.catalog.length > 0 && catalogApi.sources.length > 0);
assert.equal(catalogApi.catalogReview.humanReviewed, false);
assert.ok(Object.isFrozen(metadataApi.metadata[0]));
assert.equal(typeof metadataApi.classify, 'function');
assert.equal(metadataApi.classify(api.analyze('dasar goblok')).level, 'moderate');
assert.equal(cjsMetadata.classify([]).level, 'none');
assert.ok(Object.isFrozen(catalogApi.catalog[0].variants));
const evasions = require('indonesian-badwords/evasion');
assert.equal(boundedEvasion, evasions.boundedEvasion);
assert.equal(latinLookalikes, evasions.latinLookalikes);
assert.equal(EvasionLimitError, evasions.EvasionLimitError);
const fuzzies = require('indonesian-badwords/fuzzy');
assert.equal(boundedFuzzy, fuzzies.boundedFuzzy);
assert.equal(FuzzyLimitError, fuzzies.FuzzyLimitError);
assert.equal(new api.Badwords({ dictionary: ['goblok'], fuzzy: boundedFuzzy() }).censor('goblox'), '***');
assert.equal(new api.Badwords({ dictionary: ['goblok'], fuzzy: boundedFuzzy(), evasion: boundedEvasion({ separators: { characters: ['-'], maxGap: 1, maxTotal: 8 } }) }).censor('g-o-b-l-o-x'), '***');
const evasion = boundedEvasion({ separators: { characters: ['-'], maxGap: 1, maxTotal: 8 },
    confusables: { mappings: latinLookalikes, maxTotal: 2 } });
const evasive = new api.Badwords({ dictionary: ['goblok'], evasion });
assert.equal(evasive.censor('g-o-b-l-o-k gοblοk', mask()), '*********** ******');
assert.equal(evasive.flag('g-o-b-l-o-k', { ignoreRanges: [{ index: 1, end: 2 }] }), false);
assert.equal(new api.Badwords({ dictionary: metadataApi.reviewedDictionary, evasion }).flag('g-o-b-l-o-k'), true);
assert.equal(mask, strategies.mask);
assert.equal(grawlix, strategies.grawlix);
assert.equal(api.Badwords, cjs.Badwords);
assert.equal(instance, cjs.default);
assert.equal(api.flag, cjs.flag);
assert.equal(api.find, cjs.find);
assert.ok(new api.Badwords() instanceof cjs.Badwords);
assert.ok(new cjs.Badwords() instanceof api.Badwords);
assert.equal(api.flag('dasar kontol'), true);
assert.equal(instance.censor('dasar kontol'), 'dasar ***');
assert.equal(api.censor('dasar g0bl0k!', mask({ keepFirst: 1 })), 'dasar g*****!');
assert.equal(api.censor('kontol', grawlix({ symbols: '$#', random: () => 0 })), '$$$$$$');
assert.equal(api.censor('😀 k0nt0l!', context => {
    assert.deepEqual(context, { text: '😀 k0nt0l!', index: 3, end: 9, match: 'k0nt0l', words: ['kontol'] });
    return '$&';
}), '😀 $&!');
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
const scoped = new api.Badwords({ dictionary: ['bodo', 'goblok'], allowPhrases: ['Baju Bodo'] });
const scopedText = 'Baju Bodo goblok bodo';
const checks = { ignoreRanges: [{ index: 10, end: 16 }] };
assert.deepEqual(scoped.find(scopedText, checks), [{ word: 'bodo', index: 17, end: 21, match: 'bodo' }]);
assert.equal(scoped.censor(scopedText, mask(), checks), 'Baju Bodo goblok ****');
assert.equal(scoped.analyze(scopedText, checks).occurrenceCount, 1);
assert.equal(scoped.flag(scopedText, { ignoreRanges: [{ index: 10, end: 21 }] }), false);
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
const { mask, grawlix } = require('indonesian-badwords/censor');
const { boundedEvasion } = require('indonesian-badwords/evasion');
const { boundedFuzzy } = require('indonesian-badwords/fuzzy');
assert.equal(new api.Badwords({ fuzzy: boundedFuzzy() }).flag('goblox'), true);
assert.equal(new api.Badwords({ evasion: boundedEvasion({ separators: { characters: ['-'], maxGap: 1, maxTotal: 8 } }) }).flag('g-o-b-l-o-k'), true);
const metadataApi = require('indonesian-badwords/metadata');
const catalogApi = require('indonesian-badwords/catalog');
assert.equal(metadataApi.getMetadata('kontol')[0].surface, 'kontol');
assert.ok(catalogApi.getCatalogEntry(metadataApi.getMetadata('kontol')[0].senseId));
assert.deepEqual(metadataApi.selectDictionary({ profiles: [] }), []);
assert.equal(api.flag('dasar kontol'), true);
assert.equal(api.default.censor('dasar kontol'), 'dasar ***');
assert.equal(api.censor('goblok', mask({ keepLast: 1 })), '*****k');
assert.equal(api.censor('goblok', grawlix({ symbols: '#', random: () => 0 })), '######');
assert.deepEqual(api.find('k0nt0l'), [{ word: 'kontol', index: 0, end: 6, match: 'k0nt0l' }]);
assert.equal(api.analyze('kontol kontol').occurrenceCount, 2);
assert.equal(new api.Badwords({ dictionary: api.expandedDictionary }).flag('anjing'), true);
assert.equal(new api.Badwords({ dictionary: ['customterm'] }).flag('customterm'), true);
const scoped = new api.Badwords({ allowPhrases: ['Baju Bodo'] });
assert.equal(scoped.censor('Baju Bodo goblok', '*'), 'Baju Bodo *');
assert.equal(api.flag('goblok', { ignoreRanges: [{ index: 0, end: 6 }] }), false);
`);
    run(process.execPath, ['consumer.mjs'], workspace);
    run(process.execPath, ['consumer.cjs'], workspace);

    // Bundle the installed tarball, so this also verifies that internal modules
    // needed by browser consumers made it into the published files.
    const browserEntry = join(workspace, 'consumer.browser.mjs');
    writeFileSync(browserEntry, `
import instance, { Badwords, find, dictionary, expandedDictionary } from 'indonesian-badwords';
import { mask, grawlix } from 'indonesian-badwords/censor';
import { boundedEvasion, latinLookalikes, EvasionLimitError } from 'indonesian-badwords/evasion';
import { boundedFuzzy, FuzzyLimitError } from 'indonesian-badwords/fuzzy';
import { reviewedDictionary, selectDictionary, getMetadata, usageRegions } from 'indonesian-badwords/metadata';
import { getCatalogEntry, getSource, catalogReview } from 'indonesian-badwords/catalog';
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
    callback: instance.censor('😀 k0nt0l!', ({ index, end, match, words }) =>
        String(index) + ':' + end + ':' + match + ':' + words.join(',')),
    mask: instance.censor('g0bl0k!', mask({ keepFirst: 1 })),
    graphemes: new Badwords({ dictionary: ['ffi', '👩‍💻', 'é'] }).censor('ﬃ 👩‍💻 e\\u0301', mask()),
    grawlix: instance.censor('kontol', grawlix({ symbols: '$#', random: () => 0 })),
    scoped: new Badwords({ allowPhrases: ['Baju Bodo'] }).censor('Baju Bodo goblok bodo', mask(),
        { ignoreRanges: [{ index: 10, end: 16 }] }),
    evasion: new Badwords({ dictionary: reviewedDictionary, evasion: boundedEvasion({ separators: { characters: ['-'], maxGap: 1, maxTotal: 8 },
        confusables: { mappings: latinLookalikes, maxTotal: 2 } }) }).censor('g-o-b-l-o-k gοblοk'),
    fuzzy: new Badwords({ dictionary: ['goblok'], fuzzy: boundedFuzzy(), evasion: boundedEvasion({ separators: { characters: ['-'], maxGap: 1, maxTotal: 8 } }) }).censor('g-o-b-l-o-x'),
    matchLimitEnforced,
    reviewed: new Badwords({ dictionary: reviewedDictionary }).flag('kontol'),
    emptyProfile: selectDictionary({ profiles: [] }).length,
    exactMetadata: getMetadata('KONTOL').length,
    reviewedSense: getCatalogEntry(getMetadata('kontol')[0].senseId).variants.some(variant => variant.surface === 'kontol'),
    sourceLinked: Boolean(getSource(getCatalogEntry(getMetadata('kontol')[0].senseId).variants[0].evidence[0].sourceId)),
    reviewedByAI: catalogReview.method === 'ai-source-review' && !catalogReview.humanReviewed,
    regionIDs: usageRegions.some(region => region.id === 'javanese')
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
        callback: '😀 3:9:k0nt0l:kontol!',
        mask: 'g*****!',
        graphemes: '* * *',
        grawlix: '$$$$$$',
        scoped: 'Baju Bodo goblok ****',
        evasion: '*** ***',
        fuzzy: '***',
        matchLimitEnforced: true,
        reviewed: true,
        emptyProfile: 0,
        exactMetadata: 0,
        reviewedSense: true,
        sourceLinked: true,
        reviewedByAI: true,
        regionIDs: true
    });

    const rootOnly = await build({
        stdin: { contents: "export { flag, censor } from 'indonesian-badwords';", resolveDir: workspace },
        bundle: true, platform: 'browser', target: 'es2022', format: 'esm',
        write: false, metafile: true, logLevel: 'silent'
    });
    assert.ok(Object.keys(rootOnly.metafile.inputs).every(path => !/[/\\](?:censor|evasion|fuzzy|metadata|catalog)\.js$/.test(path)),
        'Default imports must not load optional strategies, evasion, metadata, or rich sources');
    const strategyOnly = await build({
        stdin: { contents: "export { mask, grawlix } from 'indonesian-badwords/censor';", resolveDir: workspace },
        bundle: true, platform: 'browser', target: 'es2022', format: 'esm',
        write: false, metafile: true, logLevel: 'silent'
    });
    assert.ok(Object.keys(strategyOnly.metafile.inputs).every(path => !/[/\\](?:index|evasion|fuzzy|metadata|catalog)\.js$/.test(path)),
        'Optional strategies must stay independent of other runtimes');
    for (const output of Object.values(strategyOnly.metafile.outputs)) assert.deepEqual(output.imports, []);
    for (const entry of ['metadata', 'catalog']) {
        const optionalOnly = await build({
            stdin: { contents: `export * from 'indonesian-badwords/${entry}';`, resolveDir: workspace },
            bundle: true, platform: 'browser', target: 'es2022', format: 'esm',
            write: false, metafile: true, logLevel: 'silent'
        });
        const otherEntries = entry === 'metadata' ? /[/\\](?:index|censor|evasion|fuzzy|catalog)\.js$/ : /[/\\](?:index|censor|evasion|fuzzy|metadata)\.js$/;
        assert.ok(Object.keys(optionalOnly.metafile.inputs).every(path => !otherEntries.test(path)),
            `${entry} imports must stay independent of other runtimes`);
        for (const output of Object.values(optionalOnly.metafile.outputs)) assert.deepEqual(output.imports, []);
        if (entry === 'metadata') {
            assert.ok(!optionalOnly.outputFiles[0].text.includes('rightsNote')
                && !optionalOnly.outputFiles[0].text.includes('subjectForms'),
            'Thin metadata must not load rich source explanations or claims');
        }
    }

    const fuzzyOnly = await build({
        stdin: { contents: "export { boundedFuzzy } from 'indonesian-badwords/fuzzy';", resolveDir: workspace },
        bundle: true, platform: 'browser', target: 'es2022', format: 'esm', write: false, metafile: true, logLevel: 'silent'
    });
    assert.ok(Object.keys(fuzzyOnly.metafile.inputs).every(path => !/[/\\](?:index|censor|evasion|metadata|catalog)\.js$/.test(path)),
        'Optional fuzzy must stay independent of other runtimes');
    for (const output of Object.values(fuzzyOnly.metafile.outputs)) assert.deepEqual(output.imports, []);

    const evasionOnly = await build({
        stdin: { contents: "export { boundedEvasion } from 'indonesian-badwords/evasion';", resolveDir: workspace },
        bundle: true, platform: 'browser', target: 'es2022', format: 'esm',
        write: false, metafile: true, logLevel: 'silent'
    });
    assert.ok(Object.keys(evasionOnly.metafile.inputs).every(path => !/[/\\](?:index|censor|fuzzy|metadata|catalog)\.js$/.test(path)),
        'Optional evasion must stay independent of other runtimes');
    for (const output of Object.values(evasionOnly.metafile.outputs)) assert.deepEqual(output.imports, []);

    const types = `
import instance, { Badwords, flag, find, analyze, dictionary, contextualDictionary, expandedDictionary,
    type AnalysisResult, type BadwordLocation, type BadwordsOptions, type MatchMode,
    type Normalization, type DictionaryWord, type ContextualDictionaryWord,
    type ExpandedDictionaryWord, type CensorContext, type CensorCallback,
    type CensorReplacement, type CheckOptions, type IgnoreRange } from 'indonesian-badwords';
import { mask, grawlix, type MaskOptions, type GrawlixOptions,
    type CensorContext as StrategyContext } from 'indonesian-badwords/censor';
import { metadata, reviewedDictionary, reviewedExpandedDictionary, selectDictionary, getMetadata,
    categoryIds, profileIds, usageRegions, type CategoryId, type UsageRegionId,
    type ReviewedProfileId, type Severity, type VariantMetadata, type DictionarySelection,
    classify, type ClassificationResult, type ClassificationLevel, type ClassificationSummary,
    type ClassifiedOccurrence, type ClassifyInput } from 'indonesian-badwords/metadata';
import { catalog, sources, getCatalogEntry, getSource, catalogReview, severityRubric,
    type CatalogEntry, type CatalogClaim, type CatalogSource } from 'indonesian-badwords/catalog';
const region: UsageRegionId = 'javanese';
const category: CategoryId = 'insult';
const profile: ReviewedProfileId = 'reviewed-core';
const severity: Severity = 2;
const selection: DictionarySelection = { profiles: [profile], categories: [category], regions: [region], minSeverity: severity };
const selected: readonly string[] = selectDictionary(selection);
new Badwords({ dictionary: selected });
new Badwords({ dictionary: reviewedDictionary });
new Badwords({ dictionary: reviewedExpandedDictionary });
const entries: readonly VariantMetadata[] = getMetadata('kontol');
const sense: CatalogEntry | undefined = getCatalogEntry('ibw-0001');
const source: CatalogSource | undefined = getSource('source-id');
const reviewIsHuman: boolean = catalogReview.humanReviewed;
const rubricLabel: string = severityRubric.levels[severity];
const classified: ClassificationResult<BadwordLocation> = classify(find('dasar goblok'));
const fromAnalysis: ClassificationResult<BadwordLocation> = classify(analyze('dasar goblok'));
const classifyInput: ClassifyInput<BadwordLocation> = find('goblok');
const occurrence: ClassifiedOccurrence<BadwordLocation> | undefined = classified.occurrences[0];
const occurrenceIndex: number | undefined = occurrence?.index;
const occurrenceSeverity: Severity | null | undefined = occurrence?.severity;
const classifiedSummary: ClassificationSummary = classified.summary;
const classifiedLevel: ClassificationLevel = fromAnalysis.level;
const classifiedScore: number = classified.score;
// @ts-expect-error classification levels are a closed set
const badLevel: ClassificationLevel = 'severe';
// @ts-expect-error classification results are immutable
classified.occurrences.push(occurrence);
// @ts-expect-error classify needs locations
classify('goblok');
// @ts-expect-error unknown category IDs must be rejected
selectDictionary({ categories: ['misspelled'] });
// @ts-expect-error unknown region IDs must be rejected
selectDictionary({ regions: ['misspelled'] });
// @ts-expect-error unknown profile IDs must be rejected
selectDictionary({ profiles: ['expanded'] });
// @ts-expect-error severity must be in the documented ordinal range
selectDictionary({ minSeverity: 5 });
// @ts-expect-error selection option names are checked
selectDictionary({ category: 'insult' });
// @ts-expect-error public metadata is immutable
metadata.push(entries[0]);
// @ts-expect-error public profile arrays are immutable
reviewedDictionary.push('new');
if (entries[0]) {
    // @ts-expect-error metadata fields are immutable
    entries[0].severity = 1;
}
import { boundedEvasion, latinLookalikes, EvasionLimitError, type EvasionPolicy, type EvasionOptions,
    type EvasionLimit } from 'indonesian-badwords/evasion';
import { boundedFuzzy, FuzzyLimitError, type FuzzyOptions, type FuzzyLimit, type FuzzyPolicy } from 'indonesian-badwords/fuzzy';
const fuzzyOptions: FuzzyOptions = { model: 'osa', maxEdits: 1, insertions: false, limits: { maxStateCells: 100000 } };
const fuzzyPolicy: FuzzyPolicy = boundedFuzzy(fuzzyOptions);
const rootFuzzy: import('indonesian-badwords').FuzzyPolicy = fuzzyPolicy;
new Badwords({ fuzzy: rootFuzzy, evasion: boundedEvasion({ separators: { characters: ['-'], maxGap: 1, maxTotal: 4 } }) });
const fuzzyLimit: FuzzyLimit = new FuzzyLimitError('candidates', 10, 11).limit;
// @ts-expect-error fuzzy policies are opaque
new Badwords({ fuzzy: {} });
// @ts-expect-error full Damerau is not OSA
boundedFuzzy({ model: 'damerau' });
// @ts-expect-error unknown fuzzy options must be rejected
boundedFuzzy({ distance: 1 });
const evasiveOptions: EvasionOptions = { separators: { characters: ['-'] as const, maxGap: 1, maxTotal: 8 },
    confusables: { mappings: latinLookalikes, maxTotal: 2 } };
const selectedEvasion: EvasionPolicy = boundedEvasion(evasiveOptions);
new Badwords({ evasion: selectedEvasion }).find('g-o-b-l-o-k');
const limit: EvasionLimit = new EvasionLimitError('steps', 1, 2).limit;
// @ts-expect-error policies are opaque factory results
new Badwords({ evasion: {} });
// @ts-expect-error mapping targets must be strings
boundedEvasion({ confusables: { mappings: [['а', 1]], maxTotal: 1 } });
// @ts-expect-error transformation limits must be numeric
boundedEvasion({ repetitions: { maxExtraPerLetter: '2', maxTotal: 3 } });
// @ts-expect-error selected lookalikes are immutable
latinLookalikes.push(['b', 'd']);
new Badwords({ dictionary: reviewedDictionary, evasion: selectedEvasion });
const mode: MatchMode = 'substring';
const normalization: Normalization = 'standard';
const options: BadwordsOptions = { dictionary: ['customterm'] as const, mode,
    normalization, ignoreRepeatedLetters: true, maxMatches: 1_000, allowPhrases: ['Baju Bodo'] as const };
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
const callback: CensorCallback = (context: CensorContext) => {
    const strategyContext: StrategyContext = context;
    const source: string = context.text.slice(context.index, context.end);
    const original: string = context.match;
    const words: readonly string[] = context.words;
    // @ts-expect-error callback words are immutable
    context.words.push('changed');
    // @ts-expect-error callback coordinates are immutable
    context.index = 0;
    return source;
};
const replacement: CensorReplacement = callback;
const callbackResult: string = checker.censor('customterm', replacement);
const range: IgnoreRange = { index: 0, end: 6 };
const checks: CheckOptions = { ignoreRanges: [range] as const };
flag('kontol', checks);
find('kontol', checks);
analyze('kontol', checks);
checker.badwords('kontol', checks);
checker.filter('kontol', checks);
checker.censor('kontol', replacement, checks);
checker.censor('kontol', undefined, checks);
// @ts-expect-error source ranges are immutable
range.index = 1;
// @ts-expect-error check options are immutable
checks.ignoreRanges = [];
// @ts-expect-error source range arrays are immutable
checks.ignoreRanges?.push(range);
// @ts-expect-error source offsets must be numbers
flag('kontol', { ignoreRanges: [{ index: '0', end: 6 }] });
// @ts-expect-error allowed phrases must be strings
new Badwords({ allowPhrases: [1] });
const maskOptions: MaskOptions = { keepFirst: 1, keepLast: 1, character: '*' };
const grawlixOptions: GrawlixOptions = { symbols: ['$', '#'] as const, random: () => 0 };
instance.censor('kontol', mask(maskOptions));
instance.censor('kontol', grawlix(grawlixOptions));
// @ts-expect-error callback replacements must return strings
instance.censor('kontol', () => 1);
// @ts-expect-error async callback replacements are unsupported
instance.censor('kontol', async () => 'x');
// @ts-expect-error keep counts are numbers
mask({ keepFirst: '1' });
// @ts-expect-error random must return a number
grawlix({ random: () => '0' });
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
import cjsStrategies = require('indonesian-badwords/censor');
import cjsMetadata = require('indonesian-badwords/metadata');
import cjsCatalog = require('indonesian-badwords/catalog');
import cjsEvasion = require('indonesian-badwords/evasion');
const policyFromImport: cjsEvasion.EvasionPolicy = selectedEvasion;
const policyFromRequire: EvasionPolicy = cjsEvasion.boundedEvasion(evasiveOptions);
const fromImport: cjs.Badwords = checker;
const fromRequire: Badwords = new cjs.Badwords();
const defaultFromImport: cjs.Badwords = instance;
const defaultFromRequire: Badwords = cjs.default;
const callbackFromImport: cjs.CensorCallback = callback;
const callbackFromRequire: CensorCallback = cjsStrategies.mask();
const optionsFromImport: cjsStrategies.MaskOptions = maskOptions;
const metadataFromImport: readonly cjsMetadata.VariantMetadata[] = entries;
const metadataFromRequire: readonly VariantMetadata[] = cjsMetadata.metadata;
const selectionFromImport: cjsMetadata.DictionarySelection = selection;
const classifiedFromRequire: cjsMetadata.ClassificationResult<BadwordLocation> = cjsMetadata.classify(find('goblok'));
const levelFromImport: cjsMetadata.ClassificationLevel = classifiedLevel;
const catalogFromImport: readonly cjsCatalog.CatalogEntry[] = catalog;
const sourceFromRequire: CatalogSource | undefined = cjsCatalog.getSource('source-id');
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
    console.log(`Verified packed files, shared ESM/CommonJS identities and state, optional strategies, bounded evasion/fuzzy composition and reviewed data, isolated browser ES2022 bundles without Node globals or external imports, and TypeScript ${compilerVersion} (NodeNext/Node16/Bundler, including cross-format assignment).`);
} finally {
    rmSync(workspace, { recursive: true, force: true });
}
