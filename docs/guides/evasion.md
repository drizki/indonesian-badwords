# Catch disguised spellings

[Documentation](../README.md) · [API reference](../api.md)

`indonesian-badwords/evasion` exports `boundedEvasion`, `latinLookalikes`, and
`EvasionLimitError`. Root imports do not load this scanner or its mapping data.
Pass the returned immutable policy to `new Badwords({ evasion })`. Omitted
transformation families are disabled; select at least one explicitly.

```ts
import { Badwords } from 'indonesian-badwords';
import { boundedEvasion, latinLookalikes } from 'indonesian-badwords/evasion';

const checker = new Badwords({
  evasion: boundedEvasion({
    separators: { characters: [' ', '.', '_', '-'], maxGap: 1, maxTotal: 8 },
    repetitions: { maxExtraPerLetter: 2, maxTotal: 8 },
    confusables: { mappings: latinLookalikes, maxTotal: 2 }
  })
});
checker.find('g-o-b-l-o-k');
// [
//   { word: 'goblo', index: 0, end: 9, match: 'g-o-b-l-o' },
//   { word: 'goblok', index: 0, end: 11, match: 'g-o-b-l-o-k' }
// ]
checker.censor('gοblοk'); // => '***'
```

The policy transforms only dictionary keys made of ASCII Latin letters, with
`minLength: 4` and `maxLength: 64` by default. Set those limits explicitly to
include shorter or longer terms. Every other dictionary key keeps its ordinary
literal matching. Numbers, punctuation, phrases and non-ASCII dictionary keys
are not given new evasion interpretations. This is lexical matching with
selected transformations, not intent detection or fuzzy spelling correction.

| Setting | Meaning |
| --- | --- |
| `separators.characters` | Nonempty readonly array of individual punctuation or horizontal-space scalars. |
| `separators.maxGap` | Maximum consecutive separators between consumed letters or repeated copies. |
| `separators.maxTotal` | Maximum separators in the entire occurrence; at least `maxGap`. |
| `repetitions.maxExtraPerLetter` | Maximum additional copies of each dictionary letter. |
| `repetitions.maxTotal` | Maximum extra copies across the occurrence; at least `maxExtraPerLetter`. |
| `confusables.mappings` | Nonempty readonly array of `[sourceLetter, asciiTargetLetter]` tuples. |
| `confusables.maxTotal` | Maximum mapped source letters, including mapped repeated copies. |
| `confusables.requireAsciiLetter` | Require at least one unmapped canonical ASCII input letter; defaults to `true`. |

Transformation budgets are positive integers no greater than 4,294,967,295.
Minimum and maximum key lengths have the same integer range and must be ordered.
Unknown options, invalid types, conflicting normalized mappings, unpaired
surrogates, and empty/multiple-scalar mapping values are rejected. Mapping
sources must be individual letters excluding combining and format characters;
source acceptance still requires complete grapheme boundaries.
All arrays and values are copied when the policy is created. Policies can be
reused between independent instances; dictionary mutations rebuild their own
compiled snapshot and leave the previous snapshot intact if validation fails.

Separators are consumed only inside an occurrence. Leading/trailing punctuation
is preserved. Newlines, controls, emoji and arbitrary letters cannot be skipped.
Both literal transitions and additional-copy transitions remain possible, so
legitimate doubled dictionary letters are preserved. Every budget applies
together: a mapped repeated copy uses both one mapping and one extra-copy unit.

These bounds apply **after the checker's existing normalization**. Standard mode
still handles NFKC, case, default ignorables and its existing leetspeak rules;
this policy does not cap those existing transformations. Separators that become
letters, expansions or incompatible values during normalization are rejected.
In standard mode this also rejects contextual substitutions such as `@`, `!`
and `(` as separators. With `normalization: 'none'`, case and spelling remain
exact before the explicitly configured transformations. Bounded evasion cannot
be combined with unlimited `ignoreRepeatedLetters: true`.

`latinLookalikes` contains twelve selected Cyrillic/Greek one-letter mappings
from Unicode 17.0.0: `а→a`, `е→e`, `о→o`, `р→p`, `с→c`, `у→y`, `х→x`, `і→i`,
`ј→j`, `ѕ→s`, `ο→o`, `ρ→p`. It is an optional application mapping, not the full
Unicode security skeleton or transliteration. Its notice ships in
`THIRD_PARTY_NOTICES`. Broader mappings and lower length thresholds can also
match benign text; evaluate the explicit policy on your application's text.

Matches use the ordinary original UTF-16/grapheme and word-boundary rules.
Allowed phrases retain their literal normalization and do not acquire evasion
expansions. Any ignored-range intersection rejects the complete original match.
Different paths to one term and one source span produce one occurrence.
Separator positions remain word boundaries. The default dictionary therefore
also reports its shorter `goblo` variant inside `g-o-b-l-o-k`. Distinct
overlapping source spans remain separate occurrences: `goblok-k` can
contain the exact `goblok` span and its longer repeat-enabled span. Censorship
merges that coverage once; callbacks receive the merged span and unique terms.

Leetspeak folding does not currently cross inserted separators: `g0blok` and
`g0-blok` match through the checker's ordinary folding, but `g-0-b-l-0-k` does
not. Opt-in support is tracked in
[#39](https://github.com/drizki/indonesian-badwords/issues/39).

### Resource limits

All methods enforce `limits.maxInputLength` before normalization, including
empty dictionaries. Additional scanning has finite work and active-state limits;
calls that can use ordinary matching skip that extra work. `flag` may stop after
a fully accepted match. Methods that collect or replace all matches must finish
or throw. Callbacks run after a successful scan, so a scan-budget error invokes
no callbacks.

| Limit | Default | Unit |
| --- | ---: | --- |
| `maxInputLength` | 1,000,000 | Original input UTF-16 units. |
| `maxStates` | 4,096 | Unique active candidate states at one input position; maximum 1,048,576. |
| `maxSteps` | 10,000,000 | State visits, attempted transitions, hash-collision probes and candidate inspections. |
| `maxCompileStates` | 65,536 | Shared dictionary-trie states, including its root. |
| `maxDictionaryLength` | 1,000,000 | Supplied dictionary/mutation batch and staged canonical snapshot UTF-16 units. |

Except `maxSteps`, resource limits are positive integers no greater than
4,294,967,295, with the lower `maxStates` bound above. `maxSteps` accepts positive
safe integers. `Infinity` is rejected. These limits bound the optional matching
work; they are not wall-clock deadlines. Existing `maxMatches` independently
limits detailed accepted occurrences after exclusions and path deduplication.
Boolean, unique-term and censorship methods aggregate without retaining every
occurrence, but their optional work budgets still apply.

### Supported input size

Steps are deterministic counts, not time; a scan that uses the whole default
budget takes roughly 0.2–0.6 s on a current laptop CPU. Measured with the
bundled dictionary and the separators, repetitions and `latinLookalikes` policy
shown above, using complete `censor()` scans, rounded down. Evasion alone is
gated by a prefilter, so clean text costs about one step per character.

| Policy combination | Ordinary text completes up to | Worst tested adversarial text completes up to |
| --- | ---: | ---: |
| Evasion, word mode | 1,000,000 characters | 1,000,000 characters |
| Evasion, substring mode | 1,000,000 characters | 600,000 characters (separator-heavy or doubled letters) |
| Evasion + fuzzy | see [fuzzy matching](fuzzy-matching.md#supported-input-size) | 4,000–15,000 characters |

Applications should cap message length; raise `limits.maxSteps` only for larger
trusted documents, at a proportional CPU cost. With both policies the smaller applicable bound applies, so the lower of the two
`maxSteps` values governs.

### Which APIs can hit a budget

`flag()` may stop after the first fully accepted occurrence, so it can return
`true` for text whose complete scan would exhaust `maxSteps`. `find`,
`badwords`, `censor` (string and callback) and `analyze` must finish the whole
scan and throw `EvasionLimitError` instead. Input-length, compile and
dictionary limits apply to every method alike. Treat the error as an incomplete
check, never as clean text.

```ts
import { Badwords } from 'indonesian-badwords';
import { boundedEvasion, EvasionLimitError } from 'indonesian-badwords/evasion';

const checker = new Badwords({
  evasion: boundedEvasion({
    separators: { characters: ['-'], maxGap: 1, maxTotal: 8 },
    limits: { maxInputLength: 1000 },
  }),
});

try {
  checker.find('g-o-b-l-o-k');
} catch (error) {
  if (!(error instanceof EvasionLimitError)) throw error;
  // Decide how your application handles an incomplete moderation check.
  console.error(error.limit, error.maximum, error.used);
}
```

`EvasionLimitError` extends `RangeError`. Its `limit` is `input`, `states`,
`steps`, `compileStates`, or `dictionaryLength`. Exhaustion never returns a
clean verdict or silently drops matches. The module also exports the
`EvasionOptions`, `EvasionPolicy`, and `EvasionLimit` types; `EvasionPolicy` is
available as a type from the package root too.

See [chat moderation](chat-moderation.md) to combine this with your application policy.
