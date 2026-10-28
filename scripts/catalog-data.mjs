import assert from 'node:assert/strict';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const claimKinds = ['surface', 'sense', 'variant-relation', 'register', 'regional-use', 'literal-use'];
const claimScopes = ['exact-surface', 'canonical-base', 'related-form', 'record-family', 'compound'];
const usageScopes = ['coarse-use', 'literal-use', 'lexical-sense', 'form-relation', 'unverified-lead'];
const metadataKeys = ['id', 'senseId', 'surface', 'categories', 'severity', 'attestation', 'registerEvidence', 'abusiveRegionIds', 'profiles'];

function object(value, name) {
    assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`);
}
function keys(value, names, name, optional = []) {
    object(value, name);
    assert.ok(names.every(key => Object.hasOwn(value, key)), `${name} has missing fields`);
    assert.ok(Object.keys(value).every(key => names.includes(key) || optional.includes(key)), `${name} has unknown fields`);
}
function text(value, name) {
    assert.equal(typeof value, 'string', `${name} must be a string`);
    assert.ok(value.trim().length > 0, `${name} must not be blank`);
}
function array(value, name) {
    assert.ok(Array.isArray(value), `${name} must be an array`);
}
function strings(value, name) {
    array(value, name);
    value.forEach(item => text(item, name));
    assert.equal(new Set(value).size, value.length, `${name} must not contain duplicates`);
}
function oneOf(value, values, name) {
    assert.ok(values.includes(value), `Unknown ${name}: ${String(value)}`);
}
function subset(value, values, name) {
    strings(value, name);
    value.forEach(item => oneOf(item, values, name));
}
function url(value, name) {
    text(value, name);
    const parsed = new URL(value);
    oneOf(parsed.protocol, ['https:', 'http:'], `${name} protocol`);
    assert.ok(!parsed.username && !parsed.password, `${name} must not contain credentials`);
    assert.ok(!/^(localhost|127\.|\[?::1\]?)/u.test(parsed.hostname), `${name} must be public`);
}
function noPrivatePaths(value) {
    if (typeof value === 'string') {
        assert.ok(!/(?:\/home\/|\/Users\/|\/mnt\/|\/tmp\/|codex-clipboard-|\.codex\/|file:\/\/|[A-Za-z]:\\Users\\)/u.test(value),
            'Catalog must not contain private filesystem or attachment paths');
    } else if (value !== null && typeof value === 'object') {
        for (const child of Object.values(value)) noPrivatePaths(child);
    }
}
function registryList(value, name) {
    array(value, name);
    const seen = new Set();
    for (const row of value) {
        object(row, name);
        for (const field of ['id', 'label']) text(row[field], `${name}.${field}`);
        assert.match(row.id, /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u, `${name} IDs must be stable ASCII slugs`);
        assert.ok(!seen.has(row.id), `Duplicate ${name} ID: ${row.id}`);
        seen.add(row.id);
    }
    return [...seen];
}
function namesSurface(claim, surface) {
    const key = surface.normalize('NFKC').toLowerCase();
    if (claim.scope === 'exact-surface') return claim.subjectForms.some(form => form.normalize('NFKC').toLowerCase() === key);
    if (claim.scope !== 'compound') return false;
    if (claim.attestationType === 'dictionary-compound-notation') {
        return claim.expandedForms.some(form => form.normalize('NFKC').toLowerCase() === key);
    }
    for (const form of claim.subjectForms) {
        const text = form.normalize('NFKC').toLowerCase();
        let index = text.indexOf(key);
        while (index !== -1) {
            const before = Array.from(text.slice(0, index)).at(-1) ?? '';
            const after = Array.from(text.slice(index + key.length))[0] ?? '';
            if (!/[\p{L}\p{N}\p{M}]/u.test(before) && !/[\p{L}\p{N}\p{M}]/u.test(after)) return true;
            index = text.indexOf(key, index + 1);
        }
    }
    return false;
}

/** Validate source-owned data before producing either optional runtime projection. */
export function validateCatalog(data, registry) {
    keys(data, ['schemaVersion', 'review', 'severityRubric', 'entries', 'sources'], 'catalog');
    object(registry, 'selector registry');
    noPrivatePaths(data);
    noPrivatePaths(registry);
    assert.equal(data.schemaVersion, 1);
    assert.equal(registry.schemaVersion, 1);
    const categories = registryList(registry.categories, 'categories');
    const regions = registryList(registry.regions, 'regions');
    const profiles = registryList(registry.profiles, 'profiles');
    assert.deepEqual([...categories].sort(), ['blasphemy', 'coarse-exclamation', 'excretion-vulgarity', 'identity-slur', 'insult', 'sexual-vulgarity']);
    assert.deepEqual([...profiles].sort(), ['reviewed-contextual', 'reviewed-core']);
    for (const region of registry.regions) oneOf(region.kind,
        ['language', 'language-variety', 'language-family', 'regional-usage', 'geographic-setting'], 'region.kind');
    for (const profile of registry.profiles) text(profile.description, 'profile.description');
    keys(data.review, ['reviewedOn', 'method', 'humanReviewed', 'nativeReviewed', 'corpusValidated'], 'review');
    assert.match(data.review.reviewedOn, /^\d{4}-\d{2}-\d{2}$/u);
    assert.equal(new Date(`${data.review.reviewedOn}T00:00:00Z`).toISOString().slice(0, 10), data.review.reviewedOn);
    assert.equal(data.review.method, 'ai-source-review');
    for (const field of ['humanReviewed', 'nativeReviewed', 'corpusValidated']) assert.equal(data.review[field], false);
    keys(data.severityRubric, ['version', 'levels', 'note'], 'severityRubric');
    keys(data.severityRubric.levels, ['1', '2', '3', '4'], 'severityRubric.levels');
    text(data.severityRubric.version, 'severityRubric.version');
    text(data.severityRubric.note, 'severityRubric.note');
    for (const level of [1, 2, 3, 4]) text(data.severityRubric.levels[level], `severityRubric.levels.${level}`);
    array(data.sources, 'sources');
    const sources = new Map();
    for (const source of data.sources) {
        keys(source, ['id', 'title', 'url', 'alternateUrls', 'type', 'license', 'rightsNote'], 'source');
        for (const field of ['id', 'title', 'type', 'rightsNote']) text(source[field], `source.${field}`);
        assert.ok(!sources.has(source.id), `Duplicate source ID: ${source.id}`);
        url(source.url, 'source.url');
        strings(source.alternateUrls, 'source.alternateUrls');
        source.alternateUrls.forEach(value => url(value, 'source.alternateUrls'));
        if (source.license !== null) text(source.license, 'source.license');
        sources.set(source.id, source);
    }
    function claim(value) {
        keys(value, ['sourceId', 'url', 'locator', 'supports', 'statement', 'verification', 'subjectForms', 'subjectSense', 'usageScope', 'scope'], 'claim', ['attestationType', 'expandedForms', 'method']);
        for (const field of ['sourceId', 'locator', 'statement', 'subjectSense']) text(value[field], `claim.${field}`);
        url(value.url, 'claim.url');
        const source = sources.get(value.sourceId);
        assert.ok(source, `Dangling claim source: ${value.sourceId}`);
        assert.ok([source.url, ...source.alternateUrls].includes(value.url), `Claim URL absent from source registry: ${value.url}`);
        subset(value.supports, claimKinds, 'claim.supports');
        assert.ok(value.supports.length > 0 || (value.usageScope === 'unverified-lead' && value.verification !== 'read'),
            'Only an explicitly unverified, unread lead may have no supported claims');
        strings(value.subjectForms, 'claim.subjectForms');
        assert.ok(value.subjectForms.length > 0, 'Claim subject forms must be explicit');
        oneOf(value.scope, claimScopes, 'claim.scope');
        oneOf(value.usageScope, usageScopes, 'claim.usageScope');
        oneOf(value.verification, ['read', 'inherited-reference', 'unavailable'], 'claim.verification');
        if (value.method !== undefined) text(value.method, 'claim.method');
        if (value.attestationType !== undefined) text(value.attestationType, 'claim.attestationType');
        if (value.expandedForms !== undefined || ['dictionary-compound-notation', 'dictionary-headword-expansion'].includes(value.attestationType)) {
            oneOf(value.attestationType, ['dictionary-compound-notation', 'dictionary-headword-expansion'], 'claim expansion type');
            strings(value.expandedForms, 'claim.expandedForms');
            assert.ok(value.expandedForms.length > 0, 'Dictionary notation must identify its explicit expansion');
        }
    }
    function claims(value) { array(value, 'evidence'); value.forEach(claim); }
    array(data.entries, 'entries');
    assert.ok(data.entries.length > 0, 'Catalog must not be an empty placeholder');
    const senses = new Set();
    const variants = new Set();
    const surfaces = new Set();
    const derivations = [];
    const metadata = [];
    for (const entry of data.entries) {
        keys(entry, ['id', 'canonical', 'canonicalNote', 'explanation', 'variants'], 'entry');
        for (const field of ['id', 'canonical', 'canonicalNote', 'explanation']) text(entry[field], `entry.${field}`);
        assert.ok(!senses.has(entry.id), `Duplicate sense ID: ${entry.id}`);
        senses.add(entry.id);
        array(entry.variants, 'variants');
        assert.ok(entry.variants.length > 0, 'A sense must have matching surfaces');
        for (const variant of entry.variants) {
            keys(variant, [...metadataKeys, 'explanation', 'presetReason', 'severityRationale', 'literalUseRisks',
                'registerRationale', 'notes', 'literalUseRiskCoverage', 'literalRiskEvidence', 'evidence', 'abusiveRegions',
                'literalSenseEvidence', 'literalSenseRegions', 'lexicalSenseRegions', 'unverifiedRegionLeads', 'derivation'], 'variant');
            for (const field of ['id', 'surface', 'explanation', 'presetReason', 'severityRationale', 'registerRationale',
                'literalUseRiskCoverage']) text(variant[field], `variant.${field}`);
            assert.equal(variant.senseId, entry.id, `Mismatched sense ID for ${variant.surface}`);
            assert.equal(variant.surface, variant.surface.trim(), 'Surface forms must be trimmed');
            assert.ok(!variants.has(variant.id), `Duplicate variant ID: ${variant.id}`);
            // A future multi-sense surface requires explicit profile conflict rules.
            assert.ok(!surfaces.has(variant.surface), `Duplicate surface: ${variant.surface}`);
            variants.add(variant.id);
            surfaces.add(variant.surface);
            subset(variant.categories, categories, 'categories');
            if (variant.severity !== null) oneOf(variant.severity, [1, 2, 3, 4], 'severity');
            oneOf(variant.attestation, ['attested', 'editorial-alias', 'unresolved'], 'attestation');
            oneOf(variant.registerEvidence, ['attested', 'editorial-inference', 'unverified'], 'registerEvidence');
            subset(variant.abusiveRegionIds, regions, 'abusiveRegionIds');
            subset(variant.profiles, profiles, 'profiles');
            assert.ok(variant.profiles.length <= 1, 'Core and contextual profiles must be disjoint');
            if (variant.profiles.length) {
                assert.notEqual(variant.attestation, 'unresolved', 'Unresolved variants cannot enter reviewed profiles');
                assert.notEqual(variant.registerEvidence, 'unverified', 'Unverified coarse register cannot enter reviewed profiles');
            }
            if (variant.registerEvidence === 'unverified') assert.equal(variant.severity, null,
                `Unverified coarse register must retain unknown severity: ${variant.surface}`);
            strings(variant.literalUseRisks, 'literalUseRisks');
            strings(variant.notes, 'notes');
            claims(variant.evidence);
            claims(variant.literalSenseEvidence);
            array(variant.literalRiskEvidence, 'literalRiskEvidence');
            for (const risk of variant.literalRiskEvidence) {
                keys(risk, ['riskIndex', 'claims'], 'literalRiskEvidence');
                assert.ok(Number.isSafeInteger(risk.riskIndex) && risk.riskIndex >= 0
                    && risk.riskIndex < variant.literalUseRisks.length, 'Literal evidence must name an existing risk');
                claims(risk.claims);
            }
            const allEvidence = [...variant.evidence, ...variant.literalSenseEvidence,
                ...variant.literalRiskEvidence.flatMap(risk => risk.claims)];
            if (allEvidence.some(item => item.attestationType === 'dictionary-compound-notation')) {
                assert.ok(allEvidence.some(item => item.verification === 'read' && item.usageScope === 'form-relation'
                    && item.supports.includes('variant-relation')), 'Dictionary notation needs a separate read expansion explanation');
            }
            if (variant.attestation === 'attested') assert.ok(allEvidence.some(item => item.verification === 'read'
                && (item.supports.includes('surface') || (item.attestationType === 'dictionary-compound-notation' && item.supports.includes('sense')))
                && namesSurface(item, variant.surface)), `Attestation needs exact read surface evidence: ${variant.surface}`);
            if (variant.registerEvidence === 'attested') assert.ok(variant.evidence.some(item => item.verification === 'read'
                && item.usageScope === 'coarse-use' && item.supports.includes('register')
                && namesSurface(item, variant.surface)), `Attested register needs exact read coarse-use evidence: ${variant.surface}`);
            for (const [field, coarse] of [['abusiveRegions', true], ['literalSenseRegions', false],
                ['lexicalSenseRegions', false], ['unverifiedRegionLeads', false]]) {
                array(variant[field], field);
                const ids = [];
                for (const region of variant[field]) {
                    keys(region, ['id', 'sourceLabels', 'evidence'], field);
                    oneOf(region.id, regions, `${field}.id`);
                    strings(region.sourceLabels, `${field}.sourceLabels`);
                    assert.ok(region.sourceLabels.length > 0, `${field} must retain its source labels`);
                    assert.ok(!ids.includes(region.id), `Duplicate ${field} ID`);
                    ids.push(region.id);
                    claims(region.evidence);
                    assert.ok(region.evidence.length > 0, `${field} must retain its evidence`);
                    if (coarse) assert.ok(region.evidence.some(item => item.verification === 'read'
                        && item.usageScope === 'coarse-use' && item.supports.includes('regional-use')
                        && namesSurface(item, variant.surface)), `Coarse region needs exact-surface coarse-use evidence: ${variant.surface}`);
                }
                if (coarse) assert.deepEqual([...ids].sort(), [...variant.abusiveRegionIds].sort(), 'Thin regions must equal documented coarse regions');
            }
            if (variant.derivation !== null) {
                keys(variant.derivation, ['baseSenseId', 'baseSurface', 'operation', 'basis', 'exactSurfaceAttested'], 'derivation');
                text(variant.derivation.baseSenseId, 'derivation.baseSenseId');
                if (variant.derivation.baseSurface !== null) text(variant.derivation.baseSurface, 'derivation.baseSurface');
                text(variant.derivation.operation, 'derivation.operation');
                text(variant.derivation.basis, 'derivation.basis');
                assert.equal(typeof variant.derivation.exactSurfaceAttested, 'boolean');
                assert.equal(variant.derivation.exactSurfaceAttested, variant.attestation === 'attested',
                    `Derivation attestation must agree with public metadata: ${variant.surface}`);
                derivations.push({ derivation: variant.derivation, variant });
            }
            if (variant.attestation === 'editorial-alias') assert.ok(variant.derivation, 'Editorial aliases must explain the derivation');
            metadata.push(Object.fromEntries(metadataKeys.map(key => [key, variant[key]])));
        }
    }
    const keyed = new Map(metadata.map(entry => [entry.surface.normalize('NFKC').toLowerCase(), entry]));
    const bySense = new Map(data.entries.map(entry => [entry.id, entry]));
    for (const { derivation, variant } of derivations) {
        assert.ok(senses.has(derivation.baseSenseId), `Dangling derivation sense: ${derivation.baseSenseId}`);
        if (derivation.baseSurface !== null) {
            const key = derivation.baseSurface.normalize('NFKC').toLowerCase();
            const base = keyed.get(key);
            if (base) assert.equal(derivation.baseSenseId, base.senseId,
                `Derivation must identify the sense containing its known base: ${variant.surface}`);
            else {
                const provesBase = item => item.verification === 'read'
                    && (item.scope === 'canonical-base' || item.usageScope === 'form-relation')
                    && item.subjectForms.some(form => form.normalize('NFKC').toLowerCase() === key);
                assert.ok(variant.evidence.some(provesBase)
                    && bySense.get(derivation.baseSenseId).variants.some(base => base.evidence.some(provesBase)),
                `External derivation base must retain read base/form evidence in its linked sense: ${variant.surface}`);
            }
        }
    }
    return { data, registry, metadata };
}

export async function loadCatalog() {
    const [data, registry] = await Promise.all([
        readFile(new URL('data/catalog.json', root), 'utf8').then(JSON.parse),
        readFile(new URL('data/selector-registry.json', root), 'utf8').then(JSON.parse)
    ]);
    return validateCatalog(data, registry);
}

export function registrySource(registry) {
    const ids = (name) => JSON.stringify(registry[name].map(({ id }) => id));
    return [
        '// Generated from data/selector-registry.json by npm run catalog:generate.',
        `export const categoryIds = Object.freeze(${ids('categories')} as const);`,
        `export const profileIds = Object.freeze(${ids('profiles')} as const);`,
        `export const usageRegions = Object.freeze([${registry.regions.map(row => `Object.freeze(${JSON.stringify(row)})`).join(',')} ] as const);`,
        'export type CategoryId = (typeof categoryIds)[number];',
        'export type ReviewedProfileId = (typeof profileIds)[number];',
        'export type UsageRegionId = (typeof usageRegions)[number]["id"];',
        ''
    ].join('\n');
}

if (process.argv[1] && await realpath(process.argv[1]).catch(() => undefined) === fileURLToPath(import.meta.url)) {
    const { registry, metadata } = await loadCatalog();
    const path = new URL('src/catalog-registry.ts', root);
    const expected = registrySource(registry);
    if (process.argv.includes('--write')) await writeFile(path, expected);
    else assert.equal(await readFile(path, 'utf8'), expected, 'Registry types are stale; run npm run catalog:generate');
    console.log(`Validated catalog: ${metadata.length} surface forms; selector registry matches public types.`);
}
