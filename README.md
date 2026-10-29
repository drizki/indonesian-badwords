<p align="center">
  <img src="https://raw.githubusercontent.com/drizki/indonesian-badwords/main/assets/readme-banner.svg" alt="Indonesian Badwords. Fast checks and exact matches for Bahasa Indonesia." width="1440" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/indonesian-badwords"><img src="https://shieldcn.dev/npm/v/indonesian-badwords.svg?variant=default&color=acf274&labelColor=18382b&labelTextColor=eff5eb&font=geist-mono&split=true&size=sm" alt="npm version" /></a>
  <a href="https://github.com/drizki/indonesian-badwords/actions/workflows/ci.yml"><img src="https://shieldcn.dev/github/ci/drizki/indonesian-badwords.svg?variant=default&color=acf274&labelColor=18382b&labelTextColor=eff5eb&font=geist-mono&split=true&size=sm" alt="CI status" /></a>
  <a href="https://www.npmjs.com/package/indonesian-badwords"><img src="https://shieldcn.dev/npm/dm/indonesian-badwords.svg?variant=default&color=acf274&labelColor=18382b&labelTextColor=eff5eb&font=geist-mono&split=true&size=sm" alt="npm downloads per month" /></a>
  <a href="https://github.com/drizki/indonesian-badwords/blob/main/LICENSE"><img src="https://shieldcn.dev/github/license/drizki/indonesian-badwords.svg?variant=default&color=acf274&labelColor=18382b&labelTextColor=eff5eb&font=geist-mono&split=true&size=sm" alt="License" /></a>
</p>

<p align="center">
  <a href="https://github.com/drizki/indonesian-badwords/blob/main/docs/README.md">Documentation</a> ·
  <a href="https://github.com/drizki/indonesian-badwords/blob/main/docs/api.md">API</a> ·
  <a href="https://github.com/drizki/indonesian-badwords/tree/main/docs/guides">Guides</a> ·
  <a href="https://github.com/drizki/indonesian-badwords/blob/main/CHANGELOG.md">Changelog</a> ·
  <a href="https://github.com/drizki/indonesian-badwords/blob/main/docs/contributing.md">Contributing</a> ·
  <a href="https://github.com/drizki/indonesian-badwords/blob/main/README.id.md">Bahasa Indonesia</a>
</p>

---

# Indonesian Badwords

**Keep chat, comments and usernames civil in Bahasa Indonesia, and stay in control of what counts as "bad".**

People type `g0bl0k` or `ＧＯＢＬＯＫ` (both caught by default), or spaced-out `g-o-b-l-o-k` (caught with the opt-in evasion policy), to slip past a filter. Your team also needs to let a name like `Baju Bodo` through, treat a mild word differently from a severe one, and send doubtful cases to a person. Indonesian Badwords does all of that, and it reports what it found instead of guessing what the writer meant.

```bash
npm install indonesian-badwords
```

```ts
import { Badwords } from 'indonesian-badwords';

const checker = new Badwords();

checker.flag('terima kasih'); // => false
checker.flag('dasar g0bl0k!'); // => true
checker.censor('dasar g0bl0k!'); // => 'dasar ***!'
```

Requires Node.js 22+ (browser bundles need ES2022 and `Intl.Segmenter`). ESM, CommonJS and TypeScript types are included, with zero runtime dependencies.

## What it can do

| Capability | How to use it |
| --- | --- |
| Whole-word matching with Unicode, case, width and invisible-character normalization, plus leetspeak (`g0bl0k`) | On by default (`mode: 'word'`, `normalization: 'standard'`) |
| A conservative default list, an expanded list, and your own words | `dictionary`, `expandedDictionary`, `new Badwords({ dictionary: [...] })` |
| Reviewed lists, selected by category, severity and region | `selectDictionary()` from `indonesian-badwords/metadata` |
| How each match was found: `exact`, `normalized`, `leetspeak`, `evasion` or `fuzzy` | `via` on every item from `find()` and `analyze().locations` |
| Category, editorial severity, region, and a 0-100 `score` with a `level` | `classify()` from `indonesian-badwords/metadata` |
| Inserted separators, stretched letters and lookalike characters (opt-in, bounded) | `boundedEvasion()` from `indonesian-badwords/evasion` |
| Typos and swapped letters (opt-in, bounded) | `boundedFuzzy()` from `indonesian-badwords/fuzzy` |
| Exceptions at the narrowest scope: a phrase, or a range in one call | `allowPhrases` option, `ignoreRanges` call option |
| Censoring with `***`, `mask()`, `grawlix()` or your own callback | `indonesian-badwords/censor` |
| Exact UTF-16 offsets into your original text, for highlights | `find()`, `analyze()` |
| Typed errors and finite work limits on untrusted input | `maxMatches` and the `limits` of each policy |

Methods: `flag`, `find`, `badwords`, `censor`, `filter`, `analyze`. Evasion and fuzzy matching are off unless you pass a policy.

## Principles

- **Correctness first.** A false positive is a bug. The default list leaves out words with everyday meanings, such as `anjing` and `babi`; broader matching is something you opt into.
- **No guessing from context.** The library says what matched and how. Your app decides what to do about it. A `score` rates the matched words, never the intent of a message.
- **Control at the narrowest scope.** Change one word, one phrase, one category or one call, not the whole checker.
- **Reliable on untrusted input.** Results are deterministic, work is bounded, and a limit throws a typed error instead of quietly returning "clean".
- **Fast.** Chat-sized checks take microseconds, and optional features never grow the default import.

## Recipes

### Censor exact and leetspeak matches, queue fuzzy ones for review

Every occurrence carries `via`, so one pass can treat sure matches and guesses differently.

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
```

### Classify a message and decide what to do

`classify()` adds category, severity and region to each match and summarizes the message. `level` is `none`, `unrated`, `mild`, `moderate`, `strong` or `extreme`. A `level` of `unrated` (with a `score` of `null`) means words matched but have no severity, such as custom words. It is never clean.

```ts
import { Badwords } from 'indonesian-badwords';
import { classify } from 'indonesian-badwords/metadata';

const checker = new Badwords();

function decide(message: string): 'allow' | 'mask' | 'review' | 'block' {
  const result = classify(checker.analyze(message));
  if (result.level === 'none') return 'allow';
  // Matched but unrated is never clean: a person looks at it.
  if (result.level === 'unrated' || result.summary.unrated + result.summary.unclassified > 0) return 'review';
  return (result.score ?? 0) >= 60 ? 'block' : 'mask';
}

decide('terima kasih'); // => 'allow'
decide('dasar g0bl0k!'); // => 'mask'
decide('dasar cibai'); // => 'review'
```

[How the score and level are defined](https://github.com/drizki/indonesian-badwords/blob/main/docs/metadata.md#the-score)

### Choose your vocabulary

```ts
import { Badwords } from 'indonesian-badwords';
import { selectDictionary } from 'indonesian-badwords/metadata';

const checker = new Badwords({
  dictionary: selectDictionary({ categories: ['insult'], minSeverity: 2 }),
});

checker.flag('dasar goblok'); // => true
```

Selectors are `profiles`, `categories`, `regions` and `minSeverity` (1 to 4). Regional vocabulary includes Javanese, such as `jancuk`, and Sundanese, such as `kehed`. Severity describes a dictionary entry, not a whole message. [Dictionary guide](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/dictionaries.md).

### Catch disguised spellings and typos

`g0bl0k` and full-width text already match with no setup. Evasion and fuzzy policies catch more, and also match ordinary words: with `maxEdits: 1`, `bangsa`, `kampung` and `kontrol` are each one edit from a listed word. Test on text from your app, and send `fuzzy` matches to review (first recipe) instead of censoring them.

```ts
import { Badwords } from 'indonesian-badwords';
import { boundedEvasion, latinLookalikes } from 'indonesian-badwords/evasion';
import { boundedFuzzy } from 'indonesian-badwords/fuzzy';

const tolerant = new Badwords({
  fuzzy: boundedFuzzy({ model: 'osa', maxEdits: 1 }),
  evasion: boundedEvasion({
    separators: { characters: [' ', '.', '_', '-'], maxGap: 1, maxTotal: 8 },
    repetitions: { maxExtraPerLetter: 2, maxTotal: 8 },
    confusables: { mappings: latinLookalikes, maxTotal: 2 },
  }),
});

tolerant.censor('dasar g-o-b-l-o-x!'); // => 'dasar ***!'
```

[Evasion options](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/evasion.md) · [Fuzzy matching](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/fuzzy-matching.md)

### Decide how it looks, and what it leaves alone

```ts
import { Badwords } from 'indonesian-badwords';
import { mask } from 'indonesian-badwords/censor';

const plain = new Badwords();
plain.censor('dasar g0bl0k!', mask({ keepFirst: 1, keepLast: 1 })); // => 'dasar g****k!'
plain.censor('dasar g0bl0k!', ({ words }) => `[${words[0]}]`); // => 'dasar [goblok]!'

const checker = new Badwords({ allowPhrases: ['Baju Bodo'] });
checker.censor('Baju Bodo goblok bodo'); // => 'Baju Bodo *** ***'
checker.censor('goblok\nBaju Bodo goblok', '***', { ignoreRanges: [{ index: 0, end: 7 }] }); // => 'goblok\nBaju Bodo ***'
```

An allowed phrase exempts only itself, never the rest of the message. [Censoring](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/censoring.md) · [Exceptions](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/exceptions.md)

### Highlight the original text

`index` and `end` are UTF-16 offsets into the text you passed in, and `match` equals `text.slice(index, end)`, even after normalization.

```ts
import { Badwords } from 'indonesian-badwords';

const checker = new Badwords();

checker.find('👩🏽‍💻 g0bl0k!').map(({ word, index, end, match }) => ({ word, index, end, match }));
// [{ word: 'goblok', index: 8, end: 14, match: 'g0bl0k' }]
```

## Speed

Measured with the default checker on Node.js 24.22.1 (warmed synthetic medians, setup excluded).

<table>
  <tr>
    <td align="center" width="33%"><h3>1.77 µs</h3>Clean ASCII chat check<br />280 characters</td>
    <td align="center" width="33%"><h3>~12 KB</h3>Default browser bundle<br />minified + gzip</td>
    <td align="center" width="33%"><h3>0</h3>Runtime dependencies</td>
  </tr>
</table>

| Workload | Operation | Median per call |
| --- | --- | ---: |
| Clean ASCII paragraph, 4,000 characters | `flag` | 24.45 µs |
| Clean ASCII paragraph, 4,000 characters | `censor` | 5.56 µs |
| Accents, emoji, and one literal match, 4,000 UTF-16 units | `flag` | 29.79 µs |

Optional policies have their own costs. Run `npm run benchmark` from the repository to measure your runtime. [Methodology and full results](https://github.com/drizki/indonesian-badwords/blob/main/docs/performance.md).

## Documentation

[Documentation index](https://github.com/drizki/indonesian-badwords/blob/main/docs/README.md) · [API reference](https://github.com/drizki/indonesian-badwords/blob/main/docs/api.md) · [Dictionaries and metadata](https://github.com/drizki/indonesian-badwords/blob/main/docs/metadata.md) · [Chat moderation guide](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/chat-moderation.md) · [Troubleshooting](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/troubleshooting.md) · [llms.txt](https://github.com/drizki/indonesian-badwords/blob/main/llms.txt)

## Contributing

Missing a word or getting a false positive? Open an issue with the example, the result you expected, and a similar benign case. For dictionary additions, include sources showing the abusive usage. Use the [dictionary report form](https://github.com/drizki/indonesian-badwords/issues/new?template=dictionary-report.yml) and the [contribution guide](https://github.com/drizki/indonesian-badwords/blob/main/docs/contributing.md).

Semoga bermanfaat 😉
