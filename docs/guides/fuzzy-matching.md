# Catch typos and letter swaps

[Documentation](../README.md) · [API reference](../api.md)

`indonesian-badwords/fuzzy` exports `boundedFuzzy`, `FuzzyLimitError`, and the
`FuzzyPolicy`, `FuzzyOptions`, and `FuzzyLimit` types. The root exports the policy
type without loading the optional scanner or index.

```ts
import { Badwords } from 'indonesian-badwords';
import { boundedFuzzy } from 'indonesian-badwords/fuzzy';

const checker = new Badwords({
  dictionary: ['goblok'],
  fuzzy: boundedFuzzy({ maxEdits: 1, model: 'osa' })
});
checker.censor('goblox'); // '***' (substitution)
checker.censor('goblk');  // '***' (deletion)
checker.censor('golbok'); // '***' (adjacent transposition)
```

Edits operate on **Unicode scalars after the shared normalization**, directed
from a dictionary key to a candidate. An insertion adds a candidate scalar; a
deletion removes a dictionary scalar; a substitution changes one scalar. Each
costs one. `insertions`, `deletions`, and `substitutions` default to `true` and
can be disabled independently. `model: 'levenshtein'` is the default. `model:
'osa'` also permits a unit-cost adjacent transposition under restricted optimal
string alignment: a substring cannot be edited again after a transposition.
OSA is not unrestricted Damerau-Levenshtein distance. Swaps remain available
when all three ordinary edit families are disabled. With Levenshtein and all
three disabled, only exact spelling is accepted.

`maxEdits` defaults to 1 and accepts integers from 0 through 64. Dictionary keys
must consist only of Unicode letters, numbers and marks, contain at least one
letter, and have 5 to 64 scalars by default. Set `minLength`/`maxLength` to change
those positive, ordered bounds. Other dictionary entries retain exact matching.
Candidate spellings may consist entirely of numbers or marks. Empty source
spans never match. With `ignoreRepeatedLetters: true`, fuzzy eligibility and
edits use the same repeat-folded key as exact matching; distinct dictionary
identities remain distinct even when those keys coincide.

Word mode checks complete lexical runs. Substring mode checks every nonempty
lexical window within the length/edit bounds. All results retain the shared
original UTF-16 offsets, complete grapheme/normalization-expansion boundaries,
and dictionary-aware exclamation behavior. Different edit paths producing the
same dictionary identity and original span are reported once. Distinct spans
are retained, including overlaps. Exceptions apply before occurrence limits
and censorship; callbacks receive unioned coverage and unique contributing
words in dictionary order. Callback execution starts after the scan succeeds.

### Combining fuzzy matching and evasion

Passing both `fuzzy` and `evasion` applies **shared normalization → bounded
evasion transformations → edits**, including paths with no transformation or
no edit. The composition retains each family's key eligibility: mixed paths
apply only to their intersection. A Unicode key such as `caféx` can use fuzzy
edits, but does not acquire ASCII evasion transformations. A short ASCII key
below the fuzzy minimum can still use its eligible evasion transformations.
Unlimited repeat folding remains incompatible with bounded evasion.

```ts
import { Badwords } from 'indonesian-badwords';
import { boundedFuzzy } from 'indonesian-badwords/fuzzy';
import { boundedEvasion } from 'indonesian-badwords/evasion';
const composed = new Badwords({
  dictionary: ['goblok'],
  fuzzy: boundedFuzzy(),
  evasion: boundedEvasion({
    separators: { characters: ['-'], maxGap: 1, maxTotal: 8 }
  })
});
composed.censor('g-o-b-l-o-x'); // => '***'
```

Gap, repetition, mapping, and edit budgets are independent. OSA adjacency is
measured among retained intermediate scalars, so skipped separators and repeated
copies do not break a swap. A mapped repeated copy consumes both evasion
budgets. The ASCII-input requirement counts an unmapped ASCII letter consumed
by the evasion stage, including one later removed by an edit. Separators still
form word boundaries: both a shorter deletion-enabled span and its longer
substitution-enabled span may be reported in `g-o-b-l-o-x`.

### Fuzzy resource limits

All methods check `limits.maxInputLength` before normalization, even for an
empty dictionary or a clean input. Resource exhaustion throws `FuzzyLimitError`
(a `RangeError`) with stable `limit`, `maximum`, and `used` fields. It never
returns a partial clean answer. With both policies, shared limits use the smaller
bound and one cumulative scan budget; an evasion bound throws `EvasionLimitError`
when it is the smaller applicable bound. Exact accepted boolean hits may return
early. Detailed caps remain controlled separately by `maxMatches`.

| Limit | Default | Unit |
| --- | ---: | --- |
| `maxInputLength` | 1,000,000 | Original UTF-16 units. |
| `maxDictionaryLength` | 1,000,000 | Supplied/canonical dictionary UTF-16 material, including mutation batches. |
| `maxCompileStates` | 65,536 | Shared exact trie nodes, including root. |
| `maxIndexPostings` | 250,000 | Compiled signature/key or gram/key postings. |
| `maxStates` | 4,096 | Unique projection states at one source position; maximum 1,048,576. |
| `maxSteps` | 10,000,000 | Scan transitions, string/gram processing, postings and verifier cells. |
| `maxCandidates` | 100,000 | Full key verifications during one scan. |
| `maxStateCells` | 1,000,000 | Numeric query workspace cells plus simultaneous UTF-16 projection-string cells and state fields. |

Limits are positive integers through 4,294,967,295, except `maxSteps` may reach
`Number.MAX_SAFE_INTEGER`. Unknown options and invalid types are rejected.
Dictionary updates stage the trie and every index before replacing the previous
snapshot. Failed updates preserve dictionary contents and matching behavior.
No full-message or result cache is used. Larger edit budgets, substring windows,
and ambiguous transformation combinations can reach their finite work bounds;
handle the typed error or deliberately increase the relevant bound.

The implementation chooses bounded one-edit deletion signatures for compact
profiles, otherwise packed length/q-gram postings. Hash collisions can increase
candidate overlap estimates and cannot remove candidates; every candidate is
verified. Cached bit-vector verification covers ordinary Levenshtein keys up to
32 scalars; longer keys, OSA, and disabled edit families use bounded dynamic
programming. These choices preserve the same edit semantics. Fuzzy spelling is
lexical and can match benign words: `kontrol` is one insertion from `kontol`.
Choose thresholds using your own corpus.

See [chat moderation](chat-moderation.md) to combine this with your application policy.
