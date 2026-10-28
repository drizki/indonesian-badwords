# Reviewed dictionaries and sources

[Documentation](README.md)

Use `indonesian-badwords/metadata` to choose terms by profile, category,
documented regional usage, or editorial severity. Selection happens during setup
and adds no metadata lookup to each detection call. This optional entrypoint
loads neither the detection engine nor the larger source catalog.

- [Choose a dictionary](#choose-a-dictionary)
- [Selection rules](#selection-rules)
- [Attach metadata to matches](#attach-metadata-to-matches)
- [What the metadata means](#what-the-metadata-means)
- [Inspect a policy decision](#inspect-a-policy-decision)
- [Review limits](#review-limits)

## Choose a dictionary

| List | Use |
| --- | --- |
| Root `dictionary` | Default conservative policy. |
| Root `expandedDictionary` | Includes terms with common literal uses. |
| `reviewedDictionary` | Entries accepted into the source-reviewed core profile. |
| `reviewedExpandedDictionary` | Both source-reviewed profiles, including contextual terms. |
| `selectDictionary(options)` | A subset of reviewed entries matching your selectors. |

The reviewed lists are separate selections; they do not replace or change the
root `dictionary`, `contextualDictionary`, or `expandedDictionary`. “Reviewed”
describes the source-checking process and its [limits](#review-limits).

See the [dictionary guide](guides/dictionaries.md) for complete default, expanded,
reviewed-selection, and custom-vocabulary recipes.

## Selection rules

`selectDictionary(options?)` returns a frozen, deduplicated list of matching
spellings in catalog order. `reviewedDictionary` is the default selection;
`reviewedExpandedDictionary` selects both reviewed profiles.

| Option | Omitted | Meaning |
| --- | --- | --- |
| `profiles` | `['reviewed-core']` | `reviewed-contextual` adds ambiguous terms for explicit opt-in. Pending and excluded rows belong to neither profile. |
| `categories` | Unrestricted | Any of the selected lexical categories. |
| `regions` | Unrestricted | Any of the selected documented coarse/abusive usage labels. |
| `minSeverity` | Includes unknown values | Editorial ordinal threshold from 1 to 4. Supplying it excludes unknown (`null`) values. |

Values within an array are alternatives; different options must all match.
An empty array deliberately selects nothing. Duplicate IDs are harmless. Invalid
types, unknown option names, or unknown selector IDs throw rather than silently
broadening the dictionary. Returned lists and metadata are immutable.

Category IDs are `insult`, `sexual-vulgarity`, `excretion-vulgarity`, `identity-slur`,
`coarse-exclamation`, and `blasphemy`. An ID can exist without currently selected
entries; the registry is a vocabulary, not a claim of coverage.

```ts
import { categoryIds, profileIds, usageRegions, getMetadata } from 'indonesian-badwords/metadata';

usageRegions; // { id, label, kind } records for available region selectors
getMetadata('kontol'); // frozen array of exact-spelling variant metadata
getMetadata('KONTOL'); // []: this lookup does not normalize or detect text
```

## Attach metadata to matches

Detection returns dictionary words and original-text spans. Look up metadata
only when you need it for display or a moderation report:

```ts
import { Badwords } from 'indonesian-badwords';
import { reviewedDictionary, getMetadata } from 'indonesian-badwords/metadata';

const checker = new Badwords({ dictionary: reviewedDictionary });
const matches = checker.find('dasar g0bl0k!').map(hit => ({
  ...hit,
  metadata: getMetadata(hit.word),
}));
```

Use `hit.word`, the matched dictionary spelling, rather than `hit.match`, which
may contain obfuscation from the original text. A spelling can have several
senses, so the lookup returns an array.

## What the metadata means

`metadata` contains every inventoried surface, including entries that remain
unresolved or were excluded. Presence in the inventory does not mean an entry
is accepted for matching: `profiles` records its accepted selections.
Each `VariantMetadata` has a stable `id`, `senseId`, `surface`,
`categories`, nullable `severity`, `attestation`, `registerEvidence`,
`abusiveRegionIds`, and `profiles`. An exact lexical citation and evidence of
coarse use are separate fields. An editorial alias is identified as derived;
it is not presented as an observed spelling.

| `VariantMetadata` field | Contract |
| --- | --- |
| `id`, `senseId` | Stable variant and canonical-sense IDs. |
| `surface` | Exact matching spelling. |
| `categories` | Readonly lexical `CategoryId` values. |
| `severity` | `1`, `2`, `3`, `4`, or `null` when unresolved. |
| `attestation` | `attested`, `editorial-alias`, or `unresolved`. |
| `registerEvidence` | `attested`, `editorial-inference`, or `unverified`. |
| `abusiveRegionIds` | Readonly region IDs supported for coarse/abusive use. |
| `profiles` | Accepted `reviewed-core` / `reviewed-contextual` selections; empty for unaccepted entries. |

`categoryIds` and `profileIds` expose frozen selector ID arrays. `usageRegions`
exposes frozen `{ id, label, kind }` records. `metadata` is the frozen variant
inventory. `reviewedDictionary` and `reviewedExpandedDictionary` are frozen
spelling arrays. Every export in this paragraph comes from `/metadata`.

Regions identify cited language, variety, or usage settings. They do not imply
exclusive origin, current popularity, or a speaker's identity. A citation for a
literal homonym does not add that region to the abusive-use filter. Unknown
regions remain empty and do not pass an explicit region selection. Matching does
not translate between dialects or infer variants beyond the selected spellings.

Severity measures editorial register intensity under a documented coarse use:
1 is a mild coarse exclamation or taunt; 2 a direct coarse insult; 3 strong vulgar
sexual or excretory usage; 4 extreme fixed identity or family-directed humiliation.
It is neither a toxicity probability nor an assessment of the current message.

## Inspect a policy decision

`indonesian-badwords/catalog` is a separate, larger entry point for explanations
and source inspection. It does not load the checker or thin metadata module.

```ts
import { getMetadata } from 'indonesian-badwords/metadata';
import { getCatalogEntry, getSource, catalogReview, severityRubric } from 'indonesian-badwords/catalog';

const [word] = getMetadata('kontol');
const sense = word && getCatalogEntry(word.senseId);
const variant = sense?.variants.find(entry => entry.id === word?.id);
const claim = variant?.evidence[0];
const source = claim && getSource(claim.sourceId);
```

`catalog` contains canonical sense records and their matching variants; display
labels are not extra matching patterns. Variants explain their spelling,
profile choice, severity, derivation, and literal-use risks. Claims retain exact
URLs and locators, original paraphrases, subject spellings and senses, the
supported claim types, scope, and verification status. `abusiveRegions` and
`literalSenseRegions` keep their evidence separate; dictionary meanings and
unverified locality leads have their own fields. Literal-risk citations identify
the risk they explain. Empty risk lists mean the review has no documented risk
for that spelling and provide no guarantee about other uses. `sources` contains the linked
bibliography and rights notes; public access does not grant permission to copy
the original source material.

`getCatalogEntry(id)` and `getSource(id)` return frozen records, or `undefined`
for unknown IDs. `getMetadata(surface)` returns a frozen array, or `[]` for an
unknown exact spelling. All three reject non-string arguments.

### Catalog records

All catalog exports and nested records are frozen. `/catalog` exports `catalog`,
`sources`, `catalogReview`, `severityRubric`, `getCatalogEntry`, and `getSource`.

| Record | Fields |
| --- | --- |
| `CatalogEntry` | Stable `id`, display `canonical`, `canonicalNote`, `explanation`, and `variants`. |
| `CatalogVariant` | All metadata fields plus `explanation`, `presetReason`, `severityRationale`, `registerRationale`, `notes`, evidence, literal risks, region records, and nullable `derivation`. |
| `CatalogSource` | `id`, `title`, `url`, `alternateUrls`, `type`, nullable `license`, and `rightsNote`. |
| `CatalogReview` | `reviewedOn`, `method: 'ai-source-review'`, `humanReviewed`, `nativeReviewed`, and `corpusValidated`. |
| `SeverityRubric` | `version`, `levels` keyed by severity, and a scope `note`. |

A variant's `literalUseRisks` are explanatory strings. `literalRiskEvidence`
links each `riskIndex` to its supporting `claims`; `literalUseRiskCoverage`
explains the review scope. Its separate region arrays are `abusiveRegions`,
`literalSenseRegions`, `lexicalSenseRegions`, and `unverifiedRegionLeads`.
Each region record has `id`, `sourceLabels`, and `evidence`. `evidence` and
`literalSenseEvidence` retain the claim records rather than only source IDs.

A `CatalogClaim` has `sourceId`, `url`, `locator`, paraphrased `statement`,
`subjectForms`, `subjectSense`, and the following scope fields:

| Field | Values |
| --- | --- |
| `supports` | Array drawn from `surface`, `sense`, `variant-relation`, `register`, `regional-use`, `literal-use`. |
| `verification` | `read`, `inherited-reference`, `unavailable`. |
| `usageScope` | `coarse-use`, `literal-use`, `lexical-sense`, `form-relation`, `unverified-lead`. |
| `scope` | `exact-surface`, `canonical-base`, `related-form`, `record-family`, `compound`. |

Optional claim fields are `attestationType`, `expandedForms`, and `method`.
A non-null `derivation` records `baseSenseId`, nullable `baseSurface`, `operation`,
`basis`, and `exactSurfaceAttested`. These fields explain an editorial relation;
they do not turn an unattested alias into an observed spelling.

## Review limits

AI agents checked the catalog against the cited material. There is no native
human panel or independent corpus validation; `catalogReview` exposes those
limits. Source evidence can support one claim without establishing another,
and lexical matches do not determine intent, hostility, or whole-message safety.

## CommonJS

```js
const { Badwords } = require('indonesian-badwords');
const { reviewedDictionary, selectDictionary } = require('indonesian-badwords/metadata');
const { getCatalogEntry } = require('indonesian-badwords/catalog');
```

ESM and CommonJS share the same frozen data and functions within one installed
copy. TypeScript exports include `DictionarySelection`, `VariantMetadata`,
`CategoryId`, `UsageRegionId`, `ReviewedProfileId`, `Severity`, `CatalogEntry`,
`CatalogVariant`, `CatalogClaim`, and `CatalogSource`.
