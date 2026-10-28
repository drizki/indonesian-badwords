# API and matching

[Back to the README](../README.md)

## Instances and dictionaries

ESM and CommonJS share the same class, functions, and default instance within one
installed copy. Changing the default instance also changes the behavior of the
named functions. Use `new Badwords()` for an independent checker.

The package exports three frozen lists:

| Export | Contents |
| --- | --- |
| `dictionary` | 227 default profanity terms and spelling variants. |
| `contextualDictionary` | 117 additional terms with common literal uses. |
| `expandedDictionary` | Both lists, 344 entries in total. |

Contextual terms include `anjing`, `babi`, `asu`, `monyet`, `buta`, and `homo`.
The expanded list flags these words in ordinary sentences too. Names and unrelated
slang such as `Riyad`, `item`, `suhu`, and `sepuh` are absent from both lists.

The optional [`indonesian-badwords/metadata` entry point](metadata.md) adds
reviewed profiles and selection by lexical category, documented abusive-use
region, and editorial severity. `indonesian-badwords/catalog` provides source
claims and policy explanations. Both are separate from the root runtime; they
do not change the three existing lists.

With `Badwords` imported as shown in the README, you can supply your own list:

```ts
const custom = new Badwords({ dictionary: ['customterm'] });
custom.addWords(['anotherterm']);
custom.removeWords('customterm');
const snapshot = custom.dict; // a copy; changing it does not mutate the checker
```

Entries are trimmed, normalized using the configured settings, and deduplicated.
Blank entries are ignored. Invalid types throw `TypeError` before any mutation.
`addWords` and `removeWords` are also named exports that change the shared default.

## Matching

Every text method uses the same settings. Whole-word matching is the default:

```ts
const checker = new Badwords();
checker.flag('kontol');       // true
checker.flag('kontolnya');    // false: no automatic stemming
checker.flag('intelektual');  // false
```

The list includes specific inflections such as `kontolmu`, `gobloknya`, and
`ngentotin`. The checker does not apply general stemming or translation, or infer
intent from context.

Substring mode catches joined words ([issue #3](https://github.com/drizki/indonesian-badwords/issues/3)).
It also matches fragments in ordinary words:

```ts
const joined = new Badwords({ dictionary: expandedDictionary, mode: 'substring' });
joined.censor('kamuasu'); // 'kamu***'
joined.censor('asusila'); // '***sila'
```

### Normalization

Standard normalization applies Unicode NFKC, lowercase, and internal character
substitutions. It removes default-ignorable characters for matching, including
the zero-width space in `kon\u200btol`, while preserving the original text and offsets.

Word boundaries use normalized Unicode letters, numbers, and combining marks.
That keeps `a$u$ila` as one word instead of matching its `asu` fragment.

| Input | Standard behavior |
| --- | --- |
| `g0bl0k`, `b@col` | Recognizes the disguised word. |
| `741`, `8@81` | Keeps numeric-only runs literal; substitutions require a real letter. |
| `pukima!` | Replaces the word and keeps `!`. |
| `b4b\|` | Does not treat the final symbol as a letter. |
| `goblok!tolol` | Matches both words and keeps the separator. |
| `anj!ng` | Can treat the internal `!` as `i`. |
| `cuk!ma` | Prefers the complete `cukima` match over a shorter `cuk` prefix. |

Removing invisible separators can join words. Ordinary spaces and inserted
periods remain separators. Accents and combining marks are preserved.

Exact spelling and repeated-letter matching are separate options:

```ts
const literal = new Badwords({ dictionary: ['Kontol'], normalization: 'none' });
literal.flag('kontol'); // false: exact, case-sensitive spelling

const stretched = new Badwords({ ignoreRepeatedLetters: true });
stretched.censor('gooooblokk!'); // '***!'
```

Repeated-letter matching is off by default. When enabled, it collapses repeated
letters in both lookup keys and input, keeping the complete source span. This can
make distinct spellings match the same word.

## Scoped exceptions

Use `allowPhrases` for a known literal phrase. Only dictionary occurrences fully
contained in that phrase are exempt; other occurrences in the message still match.

```ts
const checker = new Badwords({ allowPhrases: ['Baju Bodo'] });
checker.censor('Baju Bodo goblok bodo'); // 'Baju Bodo *** ***'
```

Phrases are copied and compiled at construction, independently of dictionary
changes. Standard mode applies NFKC, lowercase, and default-ignorable removal to
both phrases and text. It preserves accents and finishes in NFKC form. Phrases
do not use leetspeak substitutions, repeated-letter collapsing, fuzzy matching,
or whitespace guessing: `Baju B0d0` and `Baju  Bodo` remain detectable. With
`normalization: 'none'`, phrases require exact spelling, case, and invisibles.

Phrase edges must be complete source graphemes and whole Unicode word boundaries
(letters, numbers, and combining marks count as word characters), even in
substring mode. A partial compatibility expansion cannot grant an exemption.
Overlapping or adjacent phrases never combine into a larger exemption, and a
longer dictionary occurrence merely overlapping a phrase still matches. Leading
and trailing complete whitespace graphemes are trimmed from configured phrases.
Empty entries after the configured normalization throw `RangeError`; invalid
types throw `TypeError`. An empty list disables phrase exceptions.

Pass `CheckOptions` to ignore spans such as code or quotes identified by your
application. Every text method accepts it as the second argument, except
`censor(text, replacement?, options?)`, which accepts it as the third.

```ts
const text = 'bodo goblok';
const options = { ignoreRanges: [{ index: 0, end: 4 }] } as const;
checker.flag(text, options);                  // true: goblok still matches
checker.censor(text, '[removed]', options);   // 'bodo [removed]'
checker.find(text, options);                  // goblok at [5, 11)
```

Ranges use half-open original UTF-16 offsets, with integer bounds satisfying
`0 <= index <= end <= text.length`. Both endpoints must be complete original
extended grapheme boundaries; splitting emoji, combining sequences, or CRLF is
invalid. Ranges are copied, sorted, and united across overlaps and adjacency.
Any occurrence intersecting a nonempty range is suppressed; touching an edge
does not count. Empty ranges `[n, n)` are no-ops, with the same boundary validation.
Invalid option or bound types throw `TypeError`; invalid numeric bounds or
grapheme splits throw `RangeError`, including for clean text and empty dictionaries.

Ignored text is never removed before matching, so surrounding fragments cannot
join into a new match. Exceptions filter original occurrences before merging,
callbacks, counts, and `maxMatches`. Callback word lists contain accepted
contributors only. Configured phrases and per-call ranges can be used together.
Without exceptions, detection retains its ordinary streaming and native paths.

## Custom censorship

`censor(text, replacement)` accepts a literal string (default `***`) or a
synchronous callback. It invokes the callback once per merged overlapping span,
in original source order. Adjacent matches receive separate calls. All matching
and merging finishes before callbacks run. Dictionary changes inside a callback
take effect on the next check.

```ts
import { censor, type CensorCallback } from 'indonesian-badwords';

const replace: CensorCallback = ({ text, index, end, match, words }) => {
    // match === text.slice(index, end)
    return `[${words.join(',')}]`;
};
censor('dasar g0bl0k!', replace); // 'dasar [goblok]!'
```

The frozen `CensorContext` contains:

| Field | Meaning |
| --- | --- |
| `text` | Complete original input. |
| `index`, `end` | Original UTF-16 offsets; `end` is exclusive. |
| `match` | Exact source covered by the merged span. |
| `words` | Frozen list of unique contributing dictionary words, in dictionary insertion order. |

The callback must return a string. Empty strings remove the span; `$` characters
are literal. Other return types (including promises) throw `TypeError`.
Exceptions from the callback propagate and stop further callbacks. Callback
censorship aggregates spans and contributors without retaining every overlapping
occurrence, and does not consume the `maxMatches` limit.

### Grapheme-safe strategies

`indonesian-badwords/censor` exports `mask` and `grawlix`, which create callbacks.
These optional helpers do not load with root imports. They use `Intl.Segmenter`
on the original matched text, preserving complete combining sequences, emoji
ZWJ sequences, and flags. A compatibility character such as `ﬃ` counts as one
original grapheme even when matching expands it to `ffi`.

```ts
import { censor } from 'indonesian-badwords';
import { mask, grawlix } from 'indonesian-badwords/censor';

censor('g0bl0k!', mask());                       // '******!'
censor('g0bl0k!', mask({ keepFirst: 1, keepLast: 1 })); // 'g****k!'
censor('goblok', mask({ character: '●' }));      // '●●●●●●'
censor('goblok', grawlix({ symbols: '$#', random: () => 0 })); // '$$$$$$'
```

| Option | Applies to | Default | Meaning |
| --- | --- | --- | --- |
| `keepFirst` | Both | `0` | Original leading graphemes to keep. |
| `keepLast` | Both | `0` | Original trailing graphemes to keep. |
| `character` | `mask` | `'*'` | One replacement grapheme per masked source grapheme. |
| `symbols` | `grawlix` | `'@#$%!'` | A string of symbols or a readonly array of individual graphemes. |
| `random` | `grawlix` | `Math.random` | Called once per masked grapheme; must return a finite number in `[0, 1)`. |

Keep counts must be nonnegative safe integers. Counts are clamped so every
nonempty match has at least one grapheme replaced, with `keepFirst` taking
priority over `keepLast`. For example, keeping both ends of `ab` yields `a*`,
and keeping any number from a one-grapheme match yields `*`.

Replacement characters and each symbol must be one visible standalone,
well-formed grapheme. Control characters, line and paragraph separators, and
graphemes made entirely of formatting, default-ignorable characters, combining
marks, or whitespace are invalid. This includes zero-width spaces, bidi controls,
standalone variation selectors, and invisible Hangul fillers. Empty or multiple
graphemes, lone surrogates, orphan combining marks, and incomplete regional
indicators are invalid too. Complete emoji sequences and flags are supported,
including internal ZWJ, tag characters, and variation selectors with a visible
base. To replace spans with spaces, pass a literal string to `censor`.
Invalid options or
non-number random output throw `TypeError`; out-of-range random output throws
`RangeError`. Exceptions from `random` propagate. Symbol arrays are copied when
the strategy is created.

## Bounded evasion

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
checker.censor('gοblοk'); // '***'
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

### Resource limits

All methods enforce `limits.maxInputLength` before normalization, including
empty dictionaries. The optional scanner also enforces finite work/frontier
budgets. A proved-negative transformation trigger or bounded literal prefilter can reuse ordinary matching
without running that scanner. `flag` may stop after a fully accepted match;
detailed results and censorship must complete or throw. Callbacks run only
after a complete successful scan, so a scan-budget error invokes no callbacks.

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

```ts
import { EvasionLimitError } from 'indonesian-badwords/evasion';

try {
  checker.find(text);
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

## Results and errors

`find(text)` returns all occurrences. `analyze(text)` returns:

| Field | Meaning |
| --- | --- |
| `text` | Original input. |
| `words` | Nonempty whitespace-separated tokens. |
| `censored` | Input with matched spans replaced by `***`. |
| `badwords` | Unique matching terms, in dictionary insertion order. |
| `count` | Number of unique matching terms. |
| `occurrenceCount` | Number of occurrences. |
| `locations` | All occurrences as `{ word, index, end, match }`. |

Locations are sorted by source index, then dictionary insertion order. `index`
and exclusive `end` are JavaScript UTF-16 offsets. `match` equals
`text.slice(index, end)`, including any invisible characters inside the span.

Results include overlapping occurrences. Censorship replaces overlapping spans
once and adjacent matches separately. Replacement strings are literal.
`filter` removes matches, collapses whitespace, and trims the result.

Empty strings return no matches, zero counts, and unchanged text. Non-string
inputs and invalid options throw `TypeError`.

`find` and `analyze` throw `RangeError` beyond 10,000 occurrences by default.
`maxMatches` accepts a positive safe integer or `Infinity`. `flag` stops at the
first match; `badwords` and `censor` stream results without keeping every
occurrence in memory. These three methods have no occurrence cap.

Types exported from the package root include `BadwordsOptions`, `MatchMode`,
`Normalization`, `BadwordLocation`, `AnalysisResult`, `CensorContext`,
`CensorCallback`, `CensorReplacement`, `CheckOptions`, `IgnoreRange`, and the dictionary word types. The optional
entry point also exports the censorship types, `KeepOptions`, `MaskOptions`, and
`GrawlixOptions`.


## Bounded fuzzy matching

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
OSA is not unrestricted Damerau–Levenshtein distance. Swaps remain available
when all three ordinary edit families are disabled. With Levenshtein and all
three disabled, only exact spelling is accepted.

`maxEdits` defaults to 1 and accepts integers from 0 through 64. Dictionary keys
must consist only of Unicode letters, numbers and marks, contain at least one
letter, and have 5–64 scalars by default. Set `minLength`/`maxLength` to change
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
import { boundedEvasion } from 'indonesian-badwords/evasion';
const composed = new Badwords({
  dictionary: ['goblok'],
  fuzzy: boundedFuzzy(),
  evasion: boundedEvasion({
    separators: { characters: ['-'], maxGap: 1, maxTotal: 8 }
  })
});
composed.censor('g-o-b-l-o-x'); // '***'
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
lexical and can match benign words, so choose thresholds using your own corpus.
