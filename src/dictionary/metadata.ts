import { categoryIds, profileIds, usageRegions } from './registry.ts';
import { freezeData } from './freeze.ts';
import type {
    CategoryId, ClassifiableLocation, ClassificationLevel, ClassificationResult, ClassificationSummary,
    ClassifiedOccurrence, ClassifyInput, DictionarySelection, ReviewedProfileId, Severity, UsageRegionId, VariantMetadata,
} from './types.ts';
export type * from './types.ts';
export { categoryIds, profileIds, usageRegions } from './registry.ts';

declare const __BADWORDS_METADATA__: readonly VariantMetadata[];

/** Reviewed spellings and explicit uncertainties, separate from the root presets. */
export const metadata: readonly VariantMetadata[] = freezeData(__BADWORDS_METADATA__);
const empty: readonly VariantMetadata[] = Object.freeze([]);
let bySurface: Map<string, readonly VariantMetadata[]> | undefined;

/** Exact spelling lookup. No case folding, normalization, or engine import. */
export function getMetadata(surface: string): readonly VariantMetadata[] {
    if (typeof surface !== 'string') throw new TypeError('surface must be a string');
    if (!bySurface) {
        const index = new Map<string, VariantMetadata[]>();
        for (const entry of metadata) {
            const entries = index.get(entry.surface);
            if (entries) entries.push(entry);
            else index.set(entry.surface, [entry]);
        }
        bySurface = new Map(Array.from(index, ([key, value]) => [key, Object.freeze(value)]));
    }
    return bySurface.get(surface) ?? empty;
}

const regionIds = usageRegions.map(({ id }) => id);
const optionKeys = new Set(['profiles', 'categories', 'regions', 'minSeverity']);
function selection(values: unknown, choices: readonly string[], name: string): ReadonlySet<string> | undefined {
    if (values === undefined) return undefined;
    if (!Array.isArray(values)) throw new TypeError(`${name} must be an array`);
    const result = new Set<string>();
    for (const value of values) {
        if (typeof value !== 'string') throw new TypeError(`${name} must contain string IDs`);
        if (!choices.includes(value)) throw new RangeError(`Unknown ${name} ID: ${value}`);
        result.add(value);
    }
    return result;
}

/** OR within filters, AND across filters. Empty arrays intentionally select none. */
export function selectDictionary(options: DictionarySelection = {}): readonly string[] {
    if (options === null || typeof options !== 'object' || Array.isArray(options)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(options))) {
        throw new TypeError('selection must be a plain object');
    }
    for (const key of Reflect.ownKeys(options)) {
        if (typeof key !== 'string' || !optionKeys.has(key)) throw new TypeError(`Unknown selection option: ${String(key)}`);
    }
    const profiles = selection(options.profiles, profileIds, 'profiles') ?? new Set(['reviewed-core']);
    const categories = selection(options.categories, categoryIds, 'categories');
    const regions = selection(options.regions, regionIds, 'regions');
    const threshold = options.minSeverity;
    if (threshold !== undefined) {
        if (typeof threshold !== 'number') throw new TypeError('minSeverity must be a number');
        if (!Number.isInteger(threshold) || threshold < 1 || threshold > 4) throw new RangeError('minSeverity must be 1, 2, 3, or 4');
    }
    const surfaces = new Set<string>();
    for (const entry of metadata) {
        if (!entry.profiles.some(id => profiles.has(id))) continue;
        if (categories && !entry.categories.some(id => categories.has(id))) continue;
        if (regions && !entry.abusiveRegionIds.some(id => regions.has(id))) continue;
        if (threshold !== undefined && (entry.severity === null || entry.severity < threshold)) continue;
        surfaces.add(entry.surface);
    }
    return Object.freeze(Array.from(surfaces));
}

/** Explicit opt-in profiles; these do not change the package's legacy defaults. */
export const reviewedDictionary: readonly string[] = selectDictionary();
export const reviewedExpandedDictionary: readonly string[] = selectDictionary({ profiles: profileIds });

const levels: Readonly<Record<Severity, ClassificationLevel>> = { 1: 'mild', 2: 'moderate', 3: 'strong', 4: 'extreme' };
const baseScore: Readonly<Record<Severity, number>> = { 1: 15, 2: 35, 3: 60, 4: 80 };
const severities: readonly Severity[] = [1, 2, 3, 4];

/** Union of values in registry order, so results do not depend on catalog row order. */
function ordered<T extends string>(order: readonly string[], values: Iterable<T>): readonly T[] {
    const set = new Set<string>(values);
    return Object.freeze(order.filter(id => set.has(id)) as T[]);
}

/**
 * Join catalog metadata to matches. Accepts `find()` locations or an `analyze()` result.
 * Every input field is passed through unchanged. Words without catalog entries are
 * `classified: false`. The score is the editorial register intensity of the matched
 * words (see docs/metadata.md); it is not a toxicity probability and infers no intent.
 */
export function classify<T extends ClassifiableLocation>(input: ClassifyInput<T>): ClassificationResult<T> {
    const locations: unknown = Array.isArray(input) ? input
        : input !== null && typeof input === 'object' ? (input as { locations?: unknown }).locations : undefined;
    if (!Array.isArray(locations)) throw new TypeError('input must be an array of locations or an analyze() result');
    const bySeverity: Record<Severity, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const byCategory = Object.fromEntries(categoryIds.map(id => [id, 0])) as Record<CategoryId, number>;
    let classified = 0;
    let unrated = 0;
    let maxSeverity: Severity | null = null;
    const occurrences = (locations as T[]).map(location => {
        if (location === null || typeof location !== 'object' || typeof location.word !== 'string') {
            throw new TypeError('each location must be an object with a string word');
        }
        const variants = getMetadata(location.word);
        let severity: Severity | null = null;
        for (const variant of variants) {
            if (variant.severity !== null && (severity === null || variant.severity > severity)) severity = variant.severity;
        }
        const categories = ordered<CategoryId>(categoryIds, variants.flatMap(variant => variant.categories));
        if (variants.length > 0) {
            classified++;
            for (const id of categories) byCategory[id]++;
            if (severity === null) unrated++;
            else {
                bySeverity[severity]++;
                if (maxSeverity === null || severity > maxSeverity) maxSeverity = severity;
            }
        }
        return Object.freeze({
            ...location,
            classified: variants.length > 0,
            variantIds: Object.freeze(variants.map(variant => variant.id)),
            senseIds: Object.freeze(Array.from(new Set(variants.map(variant => variant.senseId)))),
            categories,
            severity,
            regionIds: ordered<UsageRegionId>(regionIds, variants.flatMap(variant => variant.abusiveRegionIds)),
            profiles: ordered<ReviewedProfileId>(profileIds, variants.flatMap(variant => variant.profiles)),
        }) as ClassifiedOccurrence<T>;
    });
    const rated = severities.reduce((sum, value) => sum + bySeverity[value], 0);
    const summary: ClassificationSummary = Object.freeze({
        categories: categoryIds.filter(id => byCategory[id] > 0),
        maxSeverity,
        bySeverity: Object.freeze(bySeverity),
        byCategory: Object.freeze(byCategory),
        classified,
        unclassified: occurrences.length - classified,
        unrated,
    });
    return Object.freeze({
        occurrences: Object.freeze(occurrences),
        summary,
        score: maxSeverity === null ? 0 : baseScore[maxSeverity] + Math.min(20, rated - 1),
        level: occurrences.length === 0 ? 'none' : maxSeverity === null ? 'unrated' : levels[maxSeverity],
    });
}
