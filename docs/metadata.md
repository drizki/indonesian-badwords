# Reviewed dictionaries and sources

[Back to the README](../README.md)

The optional `indonesian-badwords/metadata` entry point builds dictionaries from
reviewed lexical metadata. It does not load the detection engine or the larger
source catalog. The root `dictionary`, `contextualDictionary`, and
`expandedDictionary` retain their existing entries and behavior.

```ts
import { Badwords } from 'indonesian-badwords';
import {
  reviewedDictionary,
  reviewedExpandedDictionary,
  selectDictionary,
} from 'indonesian-badwords/metadata';

const reviewed = new Badwords({ dictionary: reviewedDictionary });
const broader = new Badwords({ dictionary: reviewedExpandedDictionary });
const policy = new Badwords({
  dictionary: selectDictionary({
    profiles: ['reviewed-core', 'reviewed-contextual'],
    categories: ['sexual-vulgarity', 'identity-slur'],
    minSeverity: 2,
  }),
});
```

Choose a dictionary once and reuse the checker. Selection runs during your setup;
it adds no category or source lookup to each detection call.

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

`metadata` includes every reviewed inventory surface, including unresolved or
excluded ones. Each `VariantMetadata` has a stable `id`, `senseId`, `surface`,
`categories`, nullable `severity`, `attestation`, `registerEvidence`,
`abusiveRegionIds`, and `profiles`. An exact lexical citation and evidence of
coarse use are separate fields. An editorial alias is identified as derived;
it is not presented as an observed spelling.

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
