# Moderate chat and comments

[Documentation](../README.md)

Start with the words your application should flag. Broader dictionaries and
spelling tolerance detect more candidates, but also match more ordinary text.
Test both abusive and benign examples from your application's language before
choosing a policy.

## Pick a vocabulary

| Policy choice | Configuration | Consequence |
| --- | --- | --- |
| Conservative starting point | `new Badwords()` | Excludes common literal animal, identity, and medical terms. |
| Flag ambiguous vocabulary too | `dictionary: expandedDictionary` | Also flags literal uses such as `anjing peliharaan`. |
| Select source-reviewed vocabulary | `dictionary: selectDictionary(...)` | Explicit profiles, categories, documented usage regions, and editorial severity. |

These are choices you configure, rather than built-in light/moderate/strict
presets. A severity threshold describes a dictionary sense, not the toxicity or
intent of a message. [Dictionary selection](dictionaries.md) explains the tradeoffs.

## Keep exceptions local

This example allows a known phrase and ignores a quote the application has
already identified. It still checks the new comment:

```ts
import { Badwords } from 'indonesian-badwords';

const checker = new Badwords({ allowPhrases: ['Baju Bodo'] });
const quote = 'goblok';
const comment = 'Baju Bodo goblok bodo';
const text = `${quote}\n${comment}`;
const options = { ignoreRanges: [{ index: 0, end: quote.length + 1 }] };

const result = checker.analyze(text, options);
result.censored; // => 'goblok\nBaju Bodo *** ***'
result.occurrenceCount; // => 2
result.badwords; // => ['bodo', 'goblok']
```

Your application must decide which text is quoted. Do not let an untrusted
client choose arbitrary ignored ranges on the server. Keep ranges in the
original text and on complete grapheme boundaries. A phrase exempts only fully
contained occurrences; a range suppresses any intersecting occurrence. Neither
exempts the rest of the message. See [exceptions](exceptions.md).

## Use one result for each input update

Use `flag` when you only need a boolean. For a review interface, call `analyze`
once when the text changes and store its result. It includes censorship,
counts, and original locations, so rendering does not need another scan.
Recheck on the server with the same policy before accepting content; client
validation alone cannot enforce moderation.

Handle a failed check separately from a clean message:

```ts
import { Badwords } from 'indonesian-badwords';
import { boundedFuzzy, FuzzyLimitError } from 'indonesian-badwords/fuzzy';

const checker = new Badwords({
  fuzzy: boundedFuzzy({ limits: { maxInputLength: 1000 } }),
});
const text = 'terima kasih';

try {
  const result = checker.analyze(text);
  console.log(result.censored);
} catch (error) {
  if (!(error instanceof FuzzyLimitError)) throw error;
  // Hold the message for review or ask the user to shorten it.
  console.error(`Check incomplete: ${error.limit}`);
}
```

The 1,000-unit input bound above is an example app policy. Optional scanners
also have work quotas. A limit error means the check did not finish, so do not
convert it to `false`. Detailed occurrence caps can throw `RangeError` too.
[Errors and limits](../api.md#results-and-errors) distinguish those cases.

To get a bounded report instead of an exception from a flood of matches, set
`onMaxMatches: 'truncate'`. The result keeps the first `maxMatches` occurrences in
source order, `censored` still hides every match, and `truncated` tells you the
list is partial, so you can queue the message for review:

```ts
import { Badwords } from 'indonesian-badwords';

const checker = new Badwords({ dictionary: ['goblok'], maxMatches: 3, onMaxMatches: 'truncate' });
const result = checker.analyze('goblok '.repeat(50));
result.locations.length; // => 3
result.truncated; // => true
result.censored.includes('goblok'); // => false
```

Pass `{ replacement }` to `analyze` to render `censored` your own way, with the
same string or callback that `censor` accepts. For multi-line posts,
`filter(text, { preserveLineBreaks: true })` keeps paragraphs and lines.
See [match limits](../api.md#match-limits-and-truncation).

## Act on how a word matched

Every occurrence from `find` and `analyze` carries a `via` that says how it
matched, so you can treat kinds differently without scanning again. This
censors exact, normalized and leetspeak matches and queues fuzzy ones for review:

```ts
import { Badwords } from 'indonesian-badwords';
import { boundedFuzzy } from 'indonesian-badwords/fuzzy';

const checker = new Badwords({ dictionary: ['goblok'], fuzzy: boundedFuzzy() });
const review: string[] = [];

const output = checker.censor('goblok g0bl0k goblox', (context) => {
  const kinds = context.occurrences().map(({ via }) => via.kind);
  if (kinds.every((kind) => kind === 'fuzzy')) {
    review.push(context.match);
    return context.match;
  }
  return '***';
});
output; // => '*** *** goblox'
review; // => ['goblox']

checker.find('goblox')[0].via; // => { kind: 'fuzzy', edits: 1, model: 'levenshtein' }
```

A merged span can have several contributors, so `context.occurrences()`
lists each with its own `via`. Detail is computed only when you ask for it. See
the [result shape](../api.md#how-an-occurrence-matched).

## Add spelling tolerance deliberately

The default checker recognizes `g0bl0k`. [Evasion](evasion.md) adds configured
separators, repeated letters, and selected lookalikes. [Fuzzy
matching](fuzzy-matching.md) adds edits and adjacent swaps. Enable only the
families your app needs: for example, fuzzy matching can mistake `kontrol` for
`kontol`. Keep a benign regression for each broader rule you introduce.

Use the [runnable app examples](browser-and-frameworks.md) for input updates,
original highlights, phrase/range exceptions, and visible incomplete-check
states. Report a missed word or false positive with the [dictionary report
form](https://github.com/drizki/indonesian-badwords/issues/new?template=dictionary-report.yml).
