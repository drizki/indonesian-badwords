# Allow phrases and source ranges

[Documentation](../README.md) · [API reference](../api.md)

Use `allowPhrases` for a known literal phrase. Only dictionary occurrences fully
contained in that phrase are exempt; other occurrences in the message still match.

```ts
import { Badwords } from 'indonesian-badwords';

const checker = new Badwords({ allowPhrases: ['Baju Bodo'] });
checker.censor('Baju Bodo goblok bodo'); // => 'Baju Bodo *** ***'
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
import { Badwords } from 'indonesian-badwords';

const checker = new Badwords();
const text = 'bodo goblok';
const options = { ignoreRanges: [{ index: 0, end: 4 }] } as const;
checker.flag(text, options);                  // true: goblok still matches
checker.censor(text, '[removed]', options); // => 'bodo [removed]'
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

See [chat moderation](chat-moderation.md) to combine this with your application policy.
