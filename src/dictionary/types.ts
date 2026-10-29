import type { CategoryId, ReviewedProfileId, UsageRegionId } from './registry.ts';

export type { CategoryId, ReviewedProfileId, UsageRegionId } from './registry.ts';
/** Editorial register intensity, not a toxicity probability or intent score. */
export type Severity = 1 | 2 | 3 | 4;
export type Attestation = 'attested' | 'editorial-alias' | 'unresolved';
export type RegisterEvidence = 'attested' | 'editorial-inference' | 'unverified';

export interface VariantMetadata {
    readonly id: string;
    readonly senseId: string;
    readonly surface: string;
    readonly categories: readonly CategoryId[];
    readonly severity: Severity | null;
    readonly attestation: Attestation;
    readonly registerEvidence: RegisterEvidence;
    readonly abusiveRegionIds: readonly UsageRegionId[];
    readonly profiles: readonly ReviewedProfileId[];
}

export interface DictionarySelection {
    /** Omitted: reviewed-core. Supply both IDs for reviewed expanded coverage. */
    readonly profiles?: readonly ReviewedProfileId[];
    readonly categories?: readonly CategoryId[];
    /** Only documented coarse/abusive usage labels, never literal homonyms. */
    readonly regions?: readonly UsageRegionId[];
    /** Entries with unknown severity are excluded when a threshold is supplied. */
    readonly minSeverity?: Severity;
}

export type ClaimKind = 'surface' | 'sense' | 'variant-relation' | 'register' | 'regional-use' | 'literal-use';
export type ClaimVerification = 'read' | 'inherited-reference' | 'unavailable';
export interface CatalogClaim {
    readonly sourceId: string;
    readonly url: string;
    readonly locator: string;
    readonly supports: readonly ClaimKind[];
    readonly statement: string;
    readonly verification: ClaimVerification;
    readonly subjectForms: readonly string[];
    readonly subjectSense: string;
    readonly usageScope: 'coarse-use' | 'literal-use' | 'lexical-sense' | 'form-relation' | 'unverified-lead';
    readonly scope: 'exact-surface' | 'canonical-base' | 'related-form' | 'record-family' | 'compound';
    readonly attestationType?: string;
    readonly expandedForms?: readonly string[];
    readonly method?: string;
}
export interface CatalogDerivation {
    readonly baseSenseId: string;
    readonly baseSurface: string | null;
    readonly operation: string;
    readonly basis: string;
    readonly exactSurfaceAttested: boolean;
}
export interface CatalogRegion {
    readonly id: UsageRegionId;
    readonly sourceLabels: readonly string[];
    readonly evidence: readonly CatalogClaim[];
}
export interface CatalogVariant extends VariantMetadata {
    readonly explanation: string;
    readonly presetReason: string;
    readonly severityRationale: string;
    readonly registerRationale: string;
    readonly notes: readonly string[];
    readonly literalUseRisks: readonly string[];
    readonly literalUseRiskCoverage: string;
    readonly literalRiskEvidence: readonly {
        readonly riskIndex: number;
        readonly claims: readonly CatalogClaim[];
    }[];
    readonly evidence: readonly CatalogClaim[];
    readonly abusiveRegions: readonly CatalogRegion[];
    readonly literalSenseEvidence: readonly CatalogClaim[];
    readonly literalSenseRegions: readonly CatalogRegion[];
    readonly lexicalSenseRegions: readonly CatalogRegion[];
    readonly unverifiedRegionLeads: readonly CatalogRegion[];
    readonly derivation: CatalogDerivation | null;
}
export interface CatalogEntry {
    readonly id: string;
    readonly canonical: string;
    readonly canonicalNote: string;
    readonly explanation: string;
    readonly variants: readonly CatalogVariant[];
}
export interface CatalogSource {
    readonly id: string;
    readonly title: string;
    readonly url: string;
    readonly alternateUrls: readonly string[];
    readonly type: string;
    readonly license: string | null;
    readonly rightsNote: string;
}
export interface CatalogReview {
    readonly reviewedOn: string;
    readonly method: 'ai-source-review';
    readonly humanReviewed: boolean;
    readonly nativeReviewed: boolean;
    readonly corpusValidated: boolean;
}
export interface SeverityRubric {
    readonly version: string;
    readonly levels: Readonly<Record<Severity, string>>;
    readonly note: string;
}

/** Minimal location shape accepted by `classify`; `find()` locations satisfy it. */
export interface ClassifiableLocation {
    readonly word: string;
}
/** Input to `classify`: `find()` locations or an `analyze()` result. */
export type ClassifyInput<T extends ClassifiableLocation = ClassifiableLocation> =
    readonly T[] | { readonly locations: readonly T[] };

/** Metadata joined to one occurrence. Unknown words are never guessed. */
export interface Classification {
    /** False when the matched dictionary word has no catalog entry (for example a custom word). */
    readonly classified: boolean;
    readonly variantIds: readonly string[];
    readonly senseIds: readonly string[];
    readonly categories: readonly CategoryId[];
    /** Highest severity among the word's variants, or null when none is rated. */
    readonly severity: Severity | null;
    readonly regionIds: readonly UsageRegionId[];
    readonly profiles: readonly ReviewedProfileId[];
}
/** The input location with every field passed through unchanged, plus its classification. */
export type ClassifiedOccurrence<T extends ClassifiableLocation = ClassifiableLocation> = T & Classification;

export type ClassificationLevel = 'none' | 'mild' | 'moderate' | 'strong' | 'extreme' | 'unrated';
export interface ClassificationSummary {
    /** Categories present, in registry order. */
    readonly categories: readonly CategoryId[];
    readonly maxSeverity: Severity | null;
    /** Occurrences per severity; occurrences without a severity are counted in `unrated`. */
    readonly bySeverity: Readonly<Record<Severity, number>>;
    /** Occurrences per category; an occurrence counts once in each of its categories. */
    readonly byCategory: Readonly<Record<CategoryId, number>>;
    readonly classified: number;
    readonly unclassified: number;
    /** Classified occurrences whose severity is unresolved (null). */
    readonly unrated: number;
}
export interface ClassificationResult<T extends ClassifiableLocation = ClassifiableLocation> {
    readonly occurrences: readonly ClassifiedOccurrence<T>[];
    readonly summary: ClassificationSummary;
    /**
     * Integer 0-100 editorial register intensity of the matched words; not a toxicity
     * probability. 0 with no occurrences; null when occurrences exist but none has a severity.
     */
    readonly score: number | null;
    readonly level: ClassificationLevel;
}
