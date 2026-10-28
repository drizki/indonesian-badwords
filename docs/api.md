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
`CensorCallback`, `CensorReplacement`, and the dictionary word types. The optional
entry point also exports the censorship types, `KeepOptions`, `MaskOptions`, and
`GrawlixOptions`.
