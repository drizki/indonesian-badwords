import { freezeData } from './catalog-freeze.ts';
import type { CatalogEntry, CatalogReview, CatalogSource, SeverityRubric } from './catalog-types.ts';
export type * from './catalog-types.ts';

declare const __BADWORDS_CATALOG__: {
    readonly entries: readonly CatalogEntry[];
    readonly sources: readonly CatalogSource[];
    readonly review: CatalogReview;
    readonly severityRubric: SeverityRubric;
};
const data = freezeData(__BADWORDS_CATALOG__);
export const catalog: readonly CatalogEntry[] = data.entries;
export const sources: readonly CatalogSource[] = data.sources;
export const catalogReview: CatalogReview = data.review;
export const severityRubric: SeverityRubric = data.severityRubric;
let byId: Map<string, CatalogEntry> | undefined;
let sourceById: Map<string, CatalogSource> | undefined;

/** Look up a stable sense ID. Unknown IDs return undefined. */
export function getCatalogEntry(id: string): CatalogEntry | undefined {
    if (typeof id !== 'string') throw new TypeError('catalog ID must be a string');
    byId ??= new Map(catalog.map(entry => [entry.id, entry]));
    return byId.get(id);
}

/** Look up a bibliography ID used by the exact claims in the catalog. */
export function getSource(id: string): CatalogSource | undefined {
    if (typeof id !== 'string') throw new TypeError('source ID must be a string');
    sourceById ??= new Map(sources.map(source => [source.id, source]));
    return sourceById.get(id);
}
