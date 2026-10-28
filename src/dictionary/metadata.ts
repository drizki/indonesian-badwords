import { categoryIds, profileIds, usageRegions } from './registry.ts';
import { freezeData } from './freeze.ts';
import type { DictionarySelection, VariantMetadata } from './types.ts';
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
