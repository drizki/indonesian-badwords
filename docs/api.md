# API and matching

[Documentation](README.md)

Use `new Badwords()` for an independent checker, or the named functions for a
shared default instance. All text methods use the same matching policy.

- [Constructor options](#constructor-options) and [methods](#methods)
- [Instances and dictionaries](#instances-and-dictionaries)
- [Results and errors](#results-and-errors)
- [Matching and normalization](#matching)
- [Scoped exceptions](#scoped-exceptions)
- [Custom censorship](#custom-censorship)
- [Bounded evasion](#bounded-evasion)
- [Bounded fuzzy matching](#bounded-fuzzy-matching)

## Constructor options

```ts
import { Badwords } from 'indonesian-badwords';

const checker = new Badwords({ mode: 'word' });
checker.flag('dasar g0bl0k!'); // => true
```

`new Badwords(options?)` accepts a `BadwordsOptions` object:

| Option | Default | Meaning |
| --- | --- | --- |
| `dictionary` | `dictionary` export | Readonly string array of terms to match. An empty array detects nothing. |
| `allowPhrases` | No exceptions | Readonly string array of literal phrases whose contained matches are exempt. See [scoped exceptions](#scoped-exceptions). |
| `mode` | `'word'` | `'word'` checks whole words; `'substring'` also checks fragments. |
| `normalization` | `'standard'` | Unicode normalization and substitutions. `'none'` keeps exact spelling and case. |
| `ignoreRepeatedLetters` | `false` | Collapse repeated letters in dictionary keys and input. Incompatible with bounded evasion. |
| `maxMatches` | `10_000` | Maximum accepted occurrences for `find` and `analyze`; positive safe integer or `Infinity`. |
| `evasion` | Disabled | Policy created by the optional [`boundedEvasion`](#bounded-evasion) helper. |
| `fuzzy` | Disabled | Policy created by the optional [`boundedFuzzy`](#bounded-fuzzy-matching) helper. |

Compile a checker once and reuse it across messages. Optional policies have
their own finite work limits, independent of `maxMatches`.

## Methods

`text` is a string. `options` is an optional `CheckOptions` object containing
per-call `ignoreRanges`. `replacement` is a string or synchronous callback.

| Method | Returns | Behavior |
| --- | --- | --- |
| `flag(text, options?)` | `boolean` | Whether any accepted occurrence exists; stops at the first match. |
| `find(text, options?)` | `BadwordLocation[]` | Every accepted occurrence, including overlaps. |
| `badwords(text, options?)` | `string[]` | Unique matching dictionary terms, in dictionary insertion order. |
| `censor(text, replacement?, options?)` | `string` | Replace matching spans; default replacement is `'***'`. |
| `filter(text, options?)` | `string` | Remove matching spans, collapse whitespace, and trim. |
| `analyze(text, options?)` | `AnalysisResult` | Original text, censorship, counts, unique terms, and locations. |
| `addWords(words)` | `void` | Add a string or readonly string array to this checker. |
| `removeWords(words)` | `void` | Remove a string or readonly string array from this checker. |
| `dict` | `string[]` | A normalized dictionary snapshot; changing the array does not change the checker. |

All methods above are also named exports except the `dict` property. Named
functions and the default export use the same instance. See
[instance ownership](#instances-and-dictionaries) before changing its dictionary.

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
region, and editorial severity, and `classify()` to attach categories, severity,
regions, and a register-intensity score to matches. `indonesian-badwords/catalog` provides source
claims and policy explanations. Both are separate from the root runtime; they
do not change the three existing lists.

Use the default checker for conservative matching, or opt in to the expanded
list when your application also needs words with common literal uses:

```ts
import { Badwords, expandedDictionary } from 'indonesian-badwords';

const conservative = new Badwords();
const expanded = new Badwords({ dictionary: expandedDictionary });
conservative.flag('anjing peliharaan'); // => false
expanded.flag('anjing peliharaan'); // => true
```

You can also supply your own list:

```ts
import { Badwords } from 'indonesian-badwords';

const custom = new Badwords({ dictionary: ['customterm'] });
custom.addWords(['anotherterm']);
custom.removeWords('customterm');
const snapshot = custom.dict; // a copy; changing it does not mutate the checker
```

Entries are trimmed, normalized using the configured settings, and deduplicated.
Blank entries are ignored. Invalid types throw `TypeError` before any mutation.
`addWords` and `removeWords` are also named exports that change the shared default.

## Classifying matches

`classify(input)` is exported from the optional `indonesian-badwords/metadata`
entry point, so the root import does not grow.

```text
classify<T extends { word: string }>(
    input: readonly T[] | { locations: readonly T[] },
): ClassificationResult<T>
```

`input` is the array from `find()` or the whole result of `analyze()`. It throws
`TypeError` for other input, for a location without a string `word`, and for holes
in a sparse array.

| Result field | Value |
| --- | --- |
| `occurrences` | Each input location, fields passed through, plus `classified`, `variantIds`, `senseIds`, `categories`, `severity`, `regionIds`, and `profiles`. Custom words are `classified: false`. |
| `summary` | `categories`, `maxSeverity`, `bySeverity`, `byCategory`, `classified`, `unclassified`, and `unrated`. |
| `score` | Integer 0-100 editorial register intensity, `0` with no occurrences, `null` when none has a severity. |
| `level` | `none`, `mild`, `moderate`, `strong`, `extreme`, or `unrated`. |

The score measures the register intensity of matched words. It is not a toxicity
probability and infers no intent. The formula, score bands, and how to gate on
`level` and `summary.unrated` are in the [metadata guide](metadata.md#classify-matches).

## Results and errors

`find(text)` returns all occurrences. `analyze(text)` returns:

| Field | Meaning |
| --- | --- |
| `text` | Original input. |
| `words` | Number of nonempty whitespace-separated tokens. |
| `censored` | Input with matched spans replaced by `***`. |
| `badwords` | Unique matching terms, in dictionary insertion order. |
| `count` | Number of unique matching terms. |
| `occurrenceCount` | Number of occurrences. |
| `locations` | All occurrences as `{ word, index, end, match, via }`. |

Locations are sorted by source index, then dictionary insertion order. `index`
and exclusive `end` are JavaScript UTF-16 offsets. `match` equals
`text.slice(index, end)`, including any invisible characters inside the span.

### How an occurrence matched

`via` is plain data that says how that occurrence reached its word, so the
application can decide what to do with it. The library reports; it does not
infer intent.

| `via` | Meaning |
| --- | --- |
| `{ kind: 'exact' }` | `match` equals the dictionary word. |
| `{ kind: 'normalized' }` | Only case, width, compatibility or invisible-character normalization differs. |
| `{ kind: 'leetspeak', folds }` | Digits or symbols were folded into letters; `folds` counts them. |
| `{ kind: 'evasion', transforms }` | Bounded evasion applied; `transforms` is `{ separators, repetitions, confusables }` counts. `ignoreRepeatedLetters` reports `repetitions`. |
| `{ kind: 'fuzzy', edits, model, transforms? }` | `edits` edits under `'levenshtein'` or `'osa'`; `transforms` appears when evasion was also used. |

When several paths reach the same word and span, the most literal wins:
`exact`, `normalized`, `leetspeak`, `evasion`, then `fuzzy`, and within the last
two the fewest edits and transforms. Leetspeak combined with repeated-letter
folding reports `leetspeak`. `find` and `analyze` always agree. `flag`,
`badwords`, `censor` with a string and `filter` never compute `via`.

A censor callback receives a second argument, `detail`.
`detail.occurrences(context)` returns the occurrences inside a merged span, as
`find` reports them, with their `via`. It scans once per `censor` call, only when
first used, applies the same `allowPhrases` and `ignoreRanges`, and can throw the
same `RangeError` as `find`. `CensorContext` itself is unchanged. See
[act on how a word matched](guides/chat-moderation.md#act-on-how-a-word-matched).

Results include overlapping occurrences. Censorship replaces overlapping spans
once and adjacent matches separately. Replacement strings are literal.
`filter` removes matches, collapses whitespace, and trims the result.

Empty strings return no matches, zero counts, and unchanged text. Non-string
inputs and invalid options throw `TypeError`.

`find` and `analyze` throw `RangeError` beyond 10,000 occurrences by default.
`maxMatches` accepts a positive safe integer or `Infinity`. `flag` stops at the
first match; `badwords`, `censor`, and `filter` aggregate results without keeping
every occurrence in memory. These four methods have no occurrence cap. Optional
evasion and fuzzy work limits still apply to every method.

Types exported from the package root include `BadwordsOptions`, `MatchMode`,
`Normalization`, `BadwordLocation`, `MatchVia`, `EvasionTransforms`,
`AnalysisResult`, `CensorContext`, `CensorDetail`, `CensorCallback`, `CensorReplacement`, `CheckOptions`, `IgnoreRange`, and the
dictionary word types. `indonesian-badwords/censor` also exports the censorship
types, `KeepOptions`, `MaskOptions`, and `GrawlixOptions`.

## Matching

Every text method uses the same settings. Whole-word matching is the default:

```ts
import { Badwords } from 'indonesian-badwords';

const checker = new Badwords();
checker.flag('kontol'); // => true
checker.flag('kontolnya');    // false: no automatic stemming
checker.flag('intelektual'); // => false
```

The list includes specific inflections such as `kontolmu`, `gobloknya`, and
`ngentotin`. The checker does not apply general stemming or translation, or infer
intent from context.

Substring mode catches joined words ([issue #3](https://github.com/drizki/indonesian-badwords/issues/3)).
It also matches fragments in ordinary words:

```ts
import { Badwords, expandedDictionary } from 'indonesian-badwords';

const joined = new Badwords({ dictionary: expandedDictionary, mode: 'substring' });
joined.censor('kamuasu'); // => 'kamu***'
joined.censor('asusila'); // => '***sila'
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
import { Badwords } from 'indonesian-badwords';

const literal = new Badwords({ dictionary: ['Kontol'], normalization: 'none' });
literal.flag('kontol'); // false: exact, case-sensitive spelling

const stretched = new Badwords({ ignoreRepeatedLetters: true });
stretched.censor('gooooblokk!'); // => '***!'
```

Repeated-letter matching is off by default. When enabled, it collapses repeated
letters in both lookup keys and input, keeping the complete source span. This can
make distinct spellings match the same word.

## Scoped exceptions

See the [scoped exceptions guide](guides/exceptions.md) for complete examples and contracts.

## Custom censorship

See the [custom censorship guide](guides/censoring.md) for complete examples and contracts.

### Grapheme-safe strategies

See [mask and grawlix](guides/censoring.md#grapheme-safe-strategies).

## Bounded evasion

See the [bounded evasion guide](guides/evasion.md) for complete examples and contracts.

### Resource limits

See [evasion limits](guides/evasion.md#resource-limits).

## Bounded fuzzy matching

See the [bounded fuzzy matching guide](guides/fuzzy-matching.md) for complete examples and contracts.

### Combining fuzzy matching and evasion

See [policy composition](guides/fuzzy-matching.md#combining-fuzzy-matching-and-evasion).

### Fuzzy resource limits

See [fuzzy limits](guides/fuzzy-matching.md#fuzzy-resource-limits).
