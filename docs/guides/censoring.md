# Choose a censorship style

[Documentation](../README.md) · [API reference](../api.md)

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
censor('dasar g0bl0k!', replace); // => 'dasar [goblok]!'
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

censor('g0bl0k!', mask()); // => '******!'
censor('g0bl0k!', mask({ keepFirst: 1, keepLast: 1 })); // => 'g****k!'
censor('goblok', mask({ character: '●' })); // => '●●●●●●'
censor('goblok', grawlix({ symbols: '$#', random: () => 0 })); // => '$$$$$$'
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

See [chat moderation](chat-moderation.md) to combine this with your application policy.
