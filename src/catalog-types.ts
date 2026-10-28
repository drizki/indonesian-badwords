import type { CategoryId, ReviewedProfileId, UsageRegionId } from './catalog-registry.ts';

export type { CategoryId, ReviewedProfileId, UsageRegionId } from './catalog-registry.ts';
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
