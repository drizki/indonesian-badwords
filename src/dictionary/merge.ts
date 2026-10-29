import { categoryIds, profileIds, usageRegions } from './registry.ts';
import type { Classification, Severity, VariantMetadata } from './types.ts';

const regionOrder: readonly string[] = usageRegions.map(({ id }) => id);

/** Union of values in registry order, so results do not depend on catalog row order. */
function ordered<T extends string>(order: readonly string[], values: Iterable<T>): readonly T[] {
    const set = new Set<string>(values);
    return Object.freeze(order.filter(id => set.has(id)) as T[]);
}

/**
 * Merge every variant of one spelling: highest severity, registry-ordered unions,
 * and deduplicated IDs. Internal; covered by tests through the built workspace.
 */
export function mergeVariants(variants: readonly VariantMetadata[]): Classification {
    let severity: Severity | null = null;
    for (const variant of variants) {
        if (variant.severity !== null && (severity === null || variant.severity > severity)) severity = variant.severity;
    }
    return {
        classified: variants.length > 0,
        variantIds: Object.freeze(Array.from(new Set(variants.map(variant => variant.id)))),
        senseIds: Object.freeze(Array.from(new Set(variants.map(variant => variant.senseId)))),
        categories: ordered(categoryIds, variants.flatMap(variant => variant.categories)),
        severity,
        regionIds: ordered(regionOrder, variants.flatMap(variant => variant.abusiveRegionIds)),
        profiles: ordered(profileIds, variants.flatMap(variant => variant.profiles)),
    };
}
