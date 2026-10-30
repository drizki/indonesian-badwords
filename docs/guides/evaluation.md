# Evaluate and tune a checker

[Documentation](../README.md) · [API reference](../api.md#evaluating-a-checker)

Every change to a dictionary, allow phrase, or policy fixes some messages and can
break others. `evaluate()` from the optional `indonesian-badwords/evaluate` entry
point measures that on your own labelled examples, so you can tune one change at a
time. It runs locally, never sends or stores your text, and adds nothing to the
root import.

## Label some examples

A case has a `text` and what you `expected`:

| `expected` | Meaning |
| --- | --- |
| `true` / `false` | The text should / should not be flagged. |
| `['goblok']` | The text should match exactly these dictionary words (compared as a set). |
| `[{ index: 6, end: 12 }]` | The text should match exactly these source spans (UTF-16 offsets, end exclusive). |
| `[]` | Nothing should match. Counts at both the word level and the span level. |

Expected words are the `word` that `find()` reports: the dictionary key after the
checker's `normalization`, not the matched text. `GOBLOK` and `Ｇｏｂｌｏｋ` both report
`goblok`, so label `['goblok']`. When you label raw text, prefer spans or a boolean.

Give every case a unique `id`. Ids are what `compare()` joins on, so they keep a
case the same when you add others. Without an id a case is called `case-N` by position.

## The tuning loop

Start with the expanded list, which includes `anjing`. In chat it is both an insult
and a pet.

```ts
import { Badwords, expandedDictionary } from 'indonesian-badwords';
import { evaluate, compare, type EvaluateCase } from 'indonesian-badwords/evaluate';

const cases: EvaluateCase[] = [
  { id: 'pet', text: 'Anjing saya lucu sekali', expected: false },
  { id: 'insult', text: 'Dasar anjing!', expected: true },
  { id: 'leet', text: 'dasar g0bl0k', expected: ['goblok'] },
  { id: 'polite', text: 'Terima kasih', expected: false },
];

// 1. Evaluate.
const before = evaluate(new Badwords({ dictionary: expandedDictionary }), cases);
before.counts; // => { tp: 2, fp: 1, fn: 0, tn: 1 }
before.falsePositiveRate.value; // => 0.5
before.topFalsePositiveWords; // => [{ word: 'anjing', cases: 1 }]
before.failures.map(({ id }) => id); // => ['pet']

// 2. Change one thing: allow the literal phrase.
const allowed = new Badwords({ dictionary: expandedDictionary, allowPhrases: ['anjing saya'] });
const afterAllow = evaluate(allowed, cases);

// 3. Compare.
compare(before, afterAllow).fixed.map(({ id }) => id); // => ['pet']
compare(before, afterAllow).broken; // => []

// The blunt alternative removes the word everywhere, and compare() shows the cost.
const removed = new Badwords({ dictionary: expandedDictionary });
removed.removeWords('anjing');
compare(before, evaluate(removed, cases)).broken.map(({ id }) => id); // => ['insult']
```

Keep the change that fixes cases without breaking others. `compare()` lists:

- `fixed`: incorrect before, correct after;
- `broken`: correct before, incorrect after;
- `shifted`: incorrect both times, but with a different outcome or different matched words;
- `added` and `removed`: ids present in only one result;
- `delta`: the change in each count.

Every list is sorted by id, so the output does not depend on case order. A shared id
with a different expectation throws `TypeError`, because the two runs would not be
measuring the same thing.

## Read the result

```ts
import { Badwords } from 'indonesian-badwords';
import { evaluate } from 'indonesian-badwords/evaluate';

const checker = new Badwords({ dictionary: ['goblok', 'tolol'] });
const result = evaluate(checker, [
  { id: 'a', text: 'dasar goblok', expected: true },
  { id: 'b', text: 'dasar tolol', expected: false },
  { id: 'c', text: 'dasar baik', expected: true },
  { id: 'd', text: 'terima kasih', expected: false },
]);

result.counts; // => { tp: 1, fp: 1, fn: 1, tn: 1 }
result.precision; // => { count: 1, n: 2, value: 0.5, low: 0.094529, high: 0.905471 }
result.recall.n; // => 2
result.falsePositiveRate.n; // => 2
result.failures[1]; // => { id: 'c', expected: true, outcome: 'fn', correct: false, words: [], text: 'dasar baik', matches: [] }
```

- `counts` are case level: a case is flagged or not, and was expected to be or not.
- `precision` is TP / (TP + FP), `recall` is TP / (TP + FN), and `falsePositiveRate`
  is FP / (FP + TN), the share of should-not-flag cases that were flagged. Each
  carries its sample size `n` and a 95% Wilson interval. Small samples have wide
  intervals; trust the interval before the point value. The interval uses z = 1.96. A rate with `n: 0` has
  `value`, `low` and `high` of `null`, never `NaN`.
- `words` and `spans` hold the same counts at the level of individual words or spans,
  over only the cases whose `expected` is a word list or a span list (an empty list counts
  in both).
- Matches on identical or overlapping spans are one **detection**. With fuzzy matching on,
  `dasar goblok` reports `goblok` (exact) and neighbours such as `goblik` (fuzzy) on the same
  span. If any word of the detection is expected, the whole detection is a true positive and
  the neighbours are not blamed. Otherwise it is one false positive, and each of its words
  is listed once in `topFalsePositiveWords`. `byVia` counts the detection once, under its
  strongest kind (`exact`, `normalized`, `leetspeak`, `evasion`, `fuzzy`). `failures` still
  show every match.
- A flagged case with the wrong words or spans keeps outcome `tp` (it was flagged,
  as expected), but `correct` is `false` and it appears in `failures`.
- `failures` have the `text` and each match with its `via` kind. `cases` lists every
  case without its text.
- `topFalsePositiveWords` ranks the dictionary words behind the false positives by
  number of cases, then alphabetically. Set `top` (an integer or `Infinity`) to change the default of 10.

## See which matching option causes the problem

`byVia` counts matches by how they were found, so you can see whether false
positives come from the literal dictionary or from a looser option.

```ts
import { Badwords } from 'indonesian-badwords';
import { boundedFuzzy } from 'indonesian-badwords/fuzzy';
import { evaluate } from 'indonesian-badwords/evaluate';

const checker = new Badwords({ dictionary: ['goblok'], fuzzy: boundedFuzzy({ model: 'osa', maxEdits: 1 }) });
const result = evaluate(checker, [
  { text: 'dasar goblok', expected: true },
  { text: 'goblox', expected: false },
  { text: 'goblos', expected: false },
]);

result.byVia.exact; // => { truePositives: 1, falsePositives: 0 }
result.byVia.fuzzy; // => { truePositives: 0, falsePositives: 2 }
```

All the false positives here are `fuzzy`: tighten `maxEdits` or the policy, or add
those spellings to your cases' expectations if you do want them.

To break matches down by category and severity, pass `classify` from the metadata
entry point. Evaluate does not import it itself, so the catalog data is loaded
only when you ask for it.

```ts
import { Badwords } from 'indonesian-badwords';
import { classify } from 'indonesian-badwords/metadata';
import { evaluate } from 'indonesian-badwords/evaluate';

const checker = new Badwords({ dictionary: ['goblok', 'my-term'] });
const result = evaluate(checker, [
  { text: 'dasar goblok', expected: true },
  { text: 'my-term', expected: false },
], { classify });

result.bySeverity?.['2']; // => { truePositives: 1, falsePositives: 0 }
result.bySeverity?.unclassified; // => { truePositives: 0, falsePositives: 1 }
```

`byCategory` and `bySeverity` stay `null` without `classify`. Severity keys are
`1` to `4`, `unrated` for classified words without a severity, and `unclassified`
for words outside the catalog, such as your own. A match counts once in each of its
categories.

## Spans, exceptions and Unicode

Span expectations are exact. Pass the same `ignoreRanges` you give `find()` per case,
and they are passed through:

```ts
import { Badwords } from 'indonesian-badwords';
import { evaluate } from 'indonesian-badwords/evaluate';

const checker = new Badwords({ dictionary: ['goblok'] });
const result = evaluate(checker, [
  { id: 'quoted', text: 'dia bilang "goblok"', expected: false, ignoreRanges: [{ index: 11, end: 19 }] },
  { id: 'emoji', text: '😀 goblok', expected: [{ index: 3, end: 9 }] },
]);

result.correct; // => 2
```

Offsets are UTF-16 code units, as in `find()`, so `😀` counts as two. Cases are checked
before `find()` runs: a duplicate id, a sparse array, a span outside the text or splitting a
surrogate pair, a duplicate word or span, or a wrong type throws `TypeError` with the
case id. Errors that `find()` itself raises during the run, such as the `RangeError` for
an `ignoreRanges` bound inside a grapheme, propagate unchanged.

## Snapshots in CI

The result is plain JSON and deterministic: no timestamps, no randomness, the
breakdown tables (`byVia`, `byCategory`, `bySeverity`) with sorted keys, rates rounded
to six decimals. Store it, or only the parts you care about,
and diff it in a test.

```ts
import { Badwords } from 'indonesian-badwords';
import { evaluate, compare } from 'indonesian-badwords/evaluate';

const checker = new Badwords();
const cases = [{ id: 'polite', text: 'Terima kasih', expected: false }];
const stored = JSON.parse(JSON.stringify(evaluate(checker, cases)));

compare(stored, evaluate(checker, cases)).broken; // => []
```

`compare()` identifies cases by id alone, so editing the text of a case under the same
id shows up as a change, and `delta` covers only the ids present in both results; use
`added` and `removed` for the rest.

A snapshot of the full result includes your case text in `failures`. Keep it out of
public logs if the texts are private; the library itself never transmits or stores them.

Any object with a `find(text, options?)` method returning `{ word, index, end }`
locations works as a checker, and `via` is optional. See the
[API reference](../api.md#evaluating-a-checker) for the exact shapes and
[Allow phrases and source ranges](exceptions.md) for the exceptions you can tune.
