import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Badwords, dictionary, expandedDictionary } from '../dist/esm/index.js';
import { metadata, categoryIds, profileIds, usageRegions, selectDictionary,
    getMetadata, reviewedDictionary, reviewedExpandedDictionary } from '../dist/esm/metadata.js';
import { catalog, sources, catalogReview, severityRubric, getCatalogEntry, getSource } from '../dist/esm/catalog.js';
import { loadCatalog, registrySource, validateCatalog } from '../scripts/catalog-data.mjs';

function frozen(value) {
    if (value !== null && typeof value === 'object') {
        assert.ok(Object.isFrozen(value));
        for (const child of Object.values(value)) frozen(child);
    }
}
function namesSurface(claim, surface) {
    const key = surface.normalize('NFKC').toLowerCase();
    if (claim.attestationType === 'dictionary-compound-notation') {
        return claim.scope === 'compound' && claim.expandedForms.some(form => form.normalize('NFKC').toLowerCase() === key);
    }
    const escaped = Array.from(key, character => '\\u{' + character.codePointAt(0).toString(16) + '}').join('');
    const boundary = String.raw`[^\p{L}\p{N}\p{M}]`;
    const whole = new RegExp('(?:^|' + boundary + ')' + escaped + '(?=$|' + boundary + ')', 'u');
    return claim.subjectForms.some(form => claim.scope === 'exact-surface'
        ? form.normalize('NFKC').toLowerCase() === key
        : claim.scope === 'compound' && whole.test(form.normalize('NFKC').toLowerCase()));
}
function oracle(options = {}) {
    const accepted = [];
    const profiles = options.profiles ?? ['reviewed-core'];
    for (const sense of catalog) for (const variant of sense.variants) {
        if (!profiles.some(id => variant.profiles.includes(id))) continue;
        if (options.categories && !options.categories.some(id => variant.categories.includes(id))) continue;
        if (options.regions && !options.regions.some(id => variant.abusiveRegionIds.includes(id))) continue;
        if (options.minSeverity !== undefined && !(variant.severity !== null && variant.severity >= options.minSeverity)) continue;
        if (!accepted.includes(variant.surface)) accepted.push(variant.surface);
    }
    return accepted;
}

test('optional metadata is an exact thin projection, with frozen shared module identities', async () => {
    const { metadata: projected, registry } = await loadCatalog();
    assert.deepEqual(metadata, projected);
    assert.equal(await readFile(new URL('../src/dictionary/registry.ts', import.meta.url), 'utf8'), registrySource(registry));
    const require = createRequire(import.meta.url);
    const cjsMetadata = require('../dist/cjs/metadata.js');
    const cjsCatalog = require('../dist/cjs/catalog.js');
    assert.equal(metadata, cjsMetadata.metadata);
    assert.equal(getMetadata, cjsMetadata.getMetadata);
    assert.equal(selectDictionary, cjsMetadata.selectDictionary);
    assert.equal(catalog, cjsCatalog.catalog);
    assert.equal(getSource, cjsCatalog.getSource);
    for (const value of [metadata, categoryIds, profileIds, usageRegions, catalog, sources,
        reviewedDictionary, reviewedExpandedDictionary, catalogReview, severityRubric]) frozen(value);
    assert.throws(() => metadata[0].categories.push('changed'), TypeError);
    assert.throws(() => { metadata[0].surface = 'changed'; }, TypeError);
    assert.throws(() => { sources[0].url = 'changed'; }, TypeError);
    assert.deepEqual(metadata.map(({ surface }) => surface).sort(), [...expandedDictionary].sort());
    assert.equal(dictionary.length, 227);
    assert.equal(expandedDictionary.length, 344);
});

test('exact metadata and stable catalog/source IDs preserve original claim scope', () => {
    for (const entry of metadata) {
        const result = getMetadata(entry.surface);
        frozen(result);
        assert.ok(result.includes(entry));
        assert.equal(result, getMetadata(entry.surface));
        const sense = getCatalogEntry(entry.senseId);
        assert.ok(sense.variants.some(variant => variant.id === entry.id));
        assert.equal(sense, catalog.find(candidate => candidate.id === entry.senseId));
        for (const variant of sense.variants) {
            for (const claim of [...variant.evidence, ...variant.literalSenseEvidence,
                ...variant.literalRiskEvidence.flatMap(risk => risk.claims),
                ...variant.abusiveRegions.flatMap(region => region.evidence),
                ...variant.literalSenseRegions.flatMap(region => region.evidence),
                ...variant.lexicalSenseRegions.flatMap(region => region.evidence),
                ...variant.unverifiedRegionLeads.flatMap(region => region.evidence)]) {
                const source = getSource(claim.sourceId);
                assert.ok(source);
                assert.ok([source.url, ...source.alternateUrls].includes(claim.url));
                assert.ok(claim.subjectForms.length > 0);
                assert.ok(claim.subjectSense.length > 0);
                assert.ok(claim.scope.length > 0 && claim.usageScope.length > 0);
            }
        }
    }
    assert.deepEqual(getMetadata('unknown-surface'), []);
    assert.equal(getMetadata('unknown-surface'), getMetadata('another-unknown'));
    assert.deepEqual(getMetadata('KONTOL'), []);
    assert.deepEqual(getMetadata(' kontol '), []);
    assert.equal(getCatalogEntry('unknown-id'), undefined);
    assert.equal(getSource('unknown-id'), undefined);
    for (const value of [null, 0, [], {}, undefined]) {
        assert.throws(() => getMetadata(value), TypeError);
        assert.throws(() => getCatalogEntry(value), TypeError);
        assert.throws(() => getSource(value), TypeError);
    }
});

test('selectors combine OR within dimensions and AND across dimensions against the rich catalog', () => {
    const regions = usageRegions.map(({ id }) => id);
    const dimensions = [
        {}, { profiles: [] }, { profiles: ['reviewed-core'] },
        { profiles: ['reviewed-contextual'] }, { profiles: profileIds },
        { categories: [] }, ...categoryIds.map(id => ({ categories: [id] })),
        { categories: categoryIds }, { regions: [] }, ...regions.map(id => ({ regions: [id] })),
        { regions }, ...[1, 2, 3, 4].map(minSeverity => ({ minSeverity }))
    ];
    for (const left of dimensions) for (const right of dimensions) {
        const options = { ...left, ...right };
        const result = selectDictionary(options);
        assert.deepEqual(result, oracle(options), JSON.stringify(options));
        frozen(result);
        assert.equal(new Set(result).size, result.length);
    }
    assert.deepEqual(reviewedDictionary, oracle());
    assert.deepEqual(reviewedExpandedDictionary, oracle({ profiles: profileIds }));
    const options = { profiles: ['reviewed-core'], categories: ['insult'] };
    const snapshot = selectDictionary(options);
    options.profiles.length = 0;
    options.categories.push('sexual-vulgarity');
    assert.deepEqual(snapshot, oracle({ profiles: ['reviewed-core'], categories: ['insult'] }));
    const empty = new Badwords({ dictionary: selectDictionary({ profiles: [] }) });
    assert.equal(empty.flag('goblok kontol anjing'), false);
    const checker = new Badwords({ dictionary: reviewedExpandedDictionary });
    for (const surface of reviewedExpandedDictionary) assert.equal(checker.flag(surface), true, surface);
});

test('unknown severity, unresolved forms, and literal-only regions never silently become coarse evidence', () => {
    for (const entry of metadata) {
        if (entry.attestation === 'unresolved' || entry.registerEvidence === 'unverified') assert.deepEqual(entry.profiles, []);
        if (entry.severity === null) for (const minSeverity of [1, 2, 3, 4]) {
            assert.ok(!selectDictionary({ profiles: profileIds, minSeverity }).includes(entry.surface));
        }
        const variant = getCatalogEntry(entry.senseId).variants.find(candidate => candidate.id === entry.id);
        assert.deepEqual(entry.abusiveRegionIds, variant.abusiveRegions.map(({ id }) => id));
        for (const region of variant.abusiveRegions) {
            assert.ok(region.evidence.some(claim => claim.verification === 'read'
                && claim.usageScope === 'coarse-use' && namesSurface(claim, entry.surface)
                && claim.supports.includes('regional-use')));
        }
    }
    assert.equal(catalogReview.humanReviewed, false);
    assert.equal(catalogReview.nativeReviewed, false);
    assert.equal(catalogReview.corpusValidated, false);
    assert.equal(catalogReview.method, 'ai-source-review');
});

test('selection validates all options before returning even an intentionally empty list', () => {
    for (const options of [null, [], 'core', 1, new Date(), { typo: true }, { [Symbol('categories')]: [] }]) {
        assert.throws(() => selectDictionary(options), TypeError);
    }
    for (const name of ['categories', 'regions', 'profiles']) {
        for (const value of [null, 1, 'insult', {}, [1], [null], new Set()]) {
            assert.throws(() => selectDictionary({ [name]: value }), TypeError);
        }
        for (const value of [['unknown'], ['']]) assert.throws(() => selectDictionary({ [name]: value }), RangeError);
    }
    for (const minSeverity of [null, '1', true, {}, []]) assert.throws(() => selectDictionary({ minSeverity }), TypeError);
    for (const minSeverity of [NaN, Infinity, 0, 5, 1.5]) assert.throws(() => selectDictionary({ minSeverity }), RangeError);
    assert.throws(() => selectDictionary({ profiles: [], regions: ['unknown'] }), RangeError);
    assert.throws(() => selectDictionary({ categories: [], minSeverity: 5 }), RangeError);
    assert.deepEqual(selectDictionary(Object.assign(Object.create(null), { profiles: [] })), []);
    assert.deepEqual(selectDictionary({ profiles: ['reviewed-core', 'reviewed-core'] }), reviewedDictionary);
});

test('catalog validator rejects dangling claims, fabricated coarse regions, private paths, and active unresolved forms', async () => {
    const { data, registry } = await loadCatalog();
    function reject(change) {
        const copy = structuredClone(data);
        change(copy);
        assert.throws(() => validateCatalog(copy, registry));
    }
    reject(copy => { copy.entries[0].variants[0].evidence[0].sourceId = 'missing-source'; });
    reject(copy => { copy.entries[0].variants[0].evidence[0].subjectForms = []; });
    reject(copy => { copy.entries[0].variants[0].evidence[0].scope = 'unscoped'; });
    reject(copy => { copy.entries[0].variants[0].profiles = ['reviewed-core']; copy.entries[0].variants[0].attestation = 'unresolved'; });
    reject(copy => { copy.entries[0].variants[0].profiles = ['reviewed-core']; copy.entries[0].variants[0].registerEvidence = 'unverified'; });
    reject(copy => { copy.entries[0].explanation = ['', 'home', 'private', 'person'].join('/'); });
    reject(copy => { copy.entries[0].variants[0].derivation = { baseSenseId: 'missing', baseSurface: null, operation: 'alias', basis: 'Synthetic alias.', exactSurfaceAttested: false }; });
    reject(copy => { copy.entries[0].variants[0].abusiveRegionIds = [registry.regions[0].id]; });
    reject(copy => {
        const variant = copy.entries[0].variants[0];
        const id = registry.regions[0].id;
        const evidence = [{ ...variant.evidence[0], usageScope: 'literal-use', supports: ['regional-use'] }];
        variant.abusiveRegionIds = [id];
        variant.abusiveRegions = [{ id, sourceLabels: ['Literal context'], evidence }];
    });
});

test('attestation validation preserves accents, bare-form scope, compound boundaries, and explicit dictionary notation', async () => {
    const { registry } = await loadCatalog();
    const source = { id: 'fixture', title: 'Synthetic validator fixture', url: 'https://example.com/fixture',
        alternateUrls: [], type: 'test-fixture', license: null, rightsNote: 'Synthetic test data; no factual lexical claim.' };
    function fixture(surface, changes = {}) {
        const claim = { sourceId: source.id, url: source.url, locator: 'Synthetic fixture',
            supports: ['surface', 'register'], statement: 'Synthetic claim used to exercise validation.',
            verification: 'read', subjectForms: [surface], subjectSense: 'Synthetic sense',
            usageScope: 'coarse-use', scope: 'exact-surface', ...changes };
        return { schemaVersion: 1, review: { reviewedOn: '2026-10-28', method: 'ai-source-review',
            humanReviewed: false, nativeReviewed: false, corpusValidated: false },
        severityRubric: { version: 'fixture', levels: { 1: 'one', 2: 'two', 3: 'three', 4: 'four' }, note: 'Synthetic rubric.' },
        sources: [source], entries: [{ id: 'sense', canonical: 'Synthetic sense', canonicalNote: 'Synthetic fixture.', explanation: 'Synthetic fixture.',
            variants: [{ id: 'variant', senseId: 'sense', surface, categories: ['insult'], severity: 2,
                attestation: 'attested', registerEvidence: 'attested', abusiveRegionIds: [], profiles: ['reviewed-core'],
                explanation: 'Synthetic fixture.', presetReason: 'Synthetic fixture.', severityRationale: 'Synthetic fixture.',
                registerRationale: 'Synthetic fixture.', notes: [], literalUseRiskCoverage: 'Synthetic fixture.', literalRiskEvidence: [],
                literalUseRisks: [], evidence: [claim], abusiveRegions: [], literalSenseEvidence: [], literalSenseRegions: [],
                lexicalSenseRegions: [], unverifiedRegionLeads: [], derivation: null }] }] };
    }
    const accept = (surface, changes) => assert.doesNotThrow(() => validateCatalog(fixture(surface, changes), registry));
    const reject = (surface, changes) => assert.throws(() => validateCatalog(fixture(surface, changes), registry));
    accept('term');
    accept('term', { subjectForms: ['TERM'] });
    accept('térm', { subjectForms: ['te\u0301rm'] });
    reject('term', { subjectForms: ['térm'] });
    reject('term', { subjectForms: ['terms'], scope: 'related-form' });
    reject('term', { subjectForms: ['terms'], scope: 'canonical-base' });
    accept('term', { subjectForms: ['dasar term'], scope: 'compound' });
    reject('term', { subjectForms: ['terma word'], scope: 'compound' });
    reject('term', { subjectForms: ['éterm'], scope: 'compound' });
    reject('term', { subjectForms: ['termé'], scope: 'compound' });
    reject('term', { subjectForms: ['term\u0301'], scope: 'compound' });
    reject('term', { verification: 'inherited-reference' });
    reject('term', { usageScope: 'literal-use' });
    const notation = fixture('term pair', { subjectForms: ['--pair'], scope: 'compound',
        attestationType: 'dictionary-compound-notation', expandedForms: ['term pair'] });
    assert.throws(() => validateCatalog(notation, registry), /separate read expansion/);
    notation.entries[0].variants[0].evidence.push({ ...notation.entries[0].variants[0].evidence[0],
        supports: ['variant-relation'], usageScope: 'form-relation', attestationType: 'dictionary-headword-expansion',
        statement: 'Synthetic notation expansion explanation.' });
    assert.doesNotThrow(() => validateCatalog(notation, registry));
    notation.entries[0].variants[0].evidence[0].expandedForms = ['different pair'];
    assert.throws(() => validateCatalog(notation, registry), /Attestation needs exact/);

    const linked = fixture('term');
    const base = structuredClone(linked.entries[0]);
    base.id = 'base-sense';
    base.variants[0].id = 'base-variant';
    base.variants[0].senseId = base.id;
    base.variants[0].surface = 'base';
    base.variants[0].evidence[0].subjectForms = ['base'];
    linked.entries.push(base);
    const derived = linked.entries[0].variants[0];
    derived.derivation = { baseSenseId: 'sense', baseSurface: 'base', operation: 'Synthetic transformation.',
        basis: 'Synthetic fixture.', exactSurfaceAttested: true };
    assert.throws(() => validateCatalog(linked, registry), /sense containing its known base/);
    derived.derivation.baseSenseId = 'base-sense';
    assert.doesNotThrow(() => validateCatalog(linked, registry));
    derived.derivation.exactSurfaceAttested = false;
    assert.throws(() => validateCatalog(linked, registry), /attestation must agree/);
    derived.derivation.exactSurfaceAttested = true;
    derived.derivation.baseSurface = 'bàse';
    assert.throws(() => validateCatalog(linked, registry), /External derivation base/);
    const baseClaim = { ...derived.evidence[0], subjectForms: ['bàse'], scope: 'canonical-base',
        supports: ['sense'], usageScope: 'lexical-sense' };
    derived.evidence.push(baseClaim);
    assert.throws(() => validateCatalog(linked, registry), /External derivation base/);
    base.variants[0].evidence.push(structuredClone(baseClaim));
    assert.doesNotThrow(() => validateCatalog(linked, registry));
    baseClaim.subjectForms = ['base'];
    assert.throws(() => validateCatalog(linked, registry), /External derivation base/);
});
