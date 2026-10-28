<p align="center">
  <img src="https://raw.githubusercontent.com/drizki/indonesian-badwords/main/assets/readme-banner.svg" alt="Indonesian Badwords. Fast checks and exact matches for Bahasa Indonesia." width="1440" />
</p>

# Indonesian Badwords

[![npm](https://img.shields.io/npm/v/indonesian-badwords.svg)](https://www.npmjs.com/package/indonesian-badwords) [![CI](https://github.com/drizki/indonesian-badwords/actions/workflows/ci.yml/badge.svg)](https://github.com/drizki/indonesian-badwords/actions/workflows/ci.yml) [![Downloads](https://img.shields.io/npm/dt/indonesian-badwords.svg)](https://www.npmjs.com/package/indonesian-badwords) [![MIT license](https://img.shields.io/npm/l/indonesian-badwords.svg)](https://github.com/drizki/indonesian-badwords/blob/main/LICENSE)

[English](https://github.com/drizki/indonesian-badwords#readme) · [Bahasa Indonesia](https://github.com/drizki/indonesian-badwords/blob/main/README.id.md)

**Catch more than the obvious spelling.**

A fast profanity checker for Bahasa Indonesia, built for chat, comments, and
user-generated text. Catch disguised words and typos, choose what your app should
allow, and decide exactly how matches appear to your users.

<table>
  <tr>
    <td align="center" width="33%"><h3>1.77 µs</h3>Clean ASCII chat check<br />280 characters</td>
    <td align="center" width="33%"><h3>~12 KB</h3>Default browser bundle<br />minified + gzip</td>
    <td align="center" width="33%"><h3>0</h3>Runtime dependencies</td>
  </tr>
</table>

Timing is a warmed synthetic median on Node.js 24.22.1 with the default checker.
[See the measurements](https://github.com/drizki/indonesian-badwords/blob/main/docs/performance.md).

## Try it in your app

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

Use it with JavaScript or TypeScript. ESM and CommonJS are included. Requires
Node.js 22+; browser bundles need ES2022 support and `Intl.Segmenter`.

## Catch spelling changes

`g0bl0k` and `ＧＯＢＬＯＫ` already match with the default checker. Invisible
characters inside a word are handled too. Enable the optional evasion and fuzzy
policies when you also want to catch inserted separators, stretched spellings,
lookalikes, or typos.

With those policies configured below, these spellings all get censored:

| Message | Output | What was handled |
| --- | --- | --- |
| `dasar g-o-b-l-o-k!` | `dasar ***!` | Inserted separators |
| `dasar gobloook!` | `dasar ***!` | Repeated letters |
| `dasar gοblοk!` | `dasar ***!` | Selected Greek lookalikes |
| `dasar goblox!` | `dasar ***!` | A substituted letter |
| `dasar golbok!` | `dasar ***!` | An adjacent letter swap |
| `dasar g-o-b-l-o-x!` | `dasar ***!` | Separators and a typo together |

Fuzzy matching supports Levenshtein spelling edits and OSA adjacent swaps. Choose
the transformations and edit tolerance your app needs; each optional scanner has
finite work limits. Broader matching can also flag ordinary words, so test the
policy on your application's text.

<details>
<summary>Try the matching policy used above</summary>

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

[Evasion options](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/evasion.md)
· [Fuzzy matching](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/fuzzy-matching.md)

</details>

## Choose what your users see

Replace the entire word, keep its edges, or turn a match into your own label.
These are actual outputs from the same message:

| Replacement | Input | Output |
| --- | --- | --- |
| Default | `dasar g0bl0k!` | `dasar ***!` |
| Keep first and last letters | `dasar g0bl0k!` | `dasar g****k!` |
| Custom callback | `dasar g0bl0k!` | `dasar [goblok]!` |

```ts
import { Badwords } from 'indonesian-badwords';
import { mask } from 'indonesian-badwords/censor';

const checker = new Badwords();
const message = 'dasar g0bl0k!';

checker.censor(message);
checker.censor(message, mask({ keepFirst: 1, keepLast: 1 }));
checker.censor(message, ({ words }) => `[${words[0]}]`);
```

Custom mask characters and random grawlix symbols are available too. Callbacks
receive the original text, match positions, and contributing dictionary words,
so you can produce replacements that fit your interface. All censorship styles
use the same matching rules as detection.
[Censorship examples](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/censoring.md).

## Let the right words through

An allowed phrase should not exempt an entire message. Keep a known name such as
`Baju Bodo` while still catching insults elsewhere, including another `bodo`:

```ts
import { Badwords } from 'indonesian-badwords';

const checker = new Badwords({ allowPhrases: ['Baju Bodo'] });

checker.censor('Baju Bodo goblok bodo'); // => 'Baju Bodo *** ***'
```

Your app can also exclude specific source ranges, such as quotes or code it has
already identified. The rest of the message stays checked.
[Phrase and range exceptions](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/exceptions.md).

Dictionary choice is part of your policy too. The default list excludes words
with common literal uses, including `anjing` and `babi`. Opt into the expanded
list when you need to flag those words regardless of their use:

| Text | Default dictionary | Expanded dictionary |
| --- | --- | --- |
| `anjing peliharaan` | Clean | Flags `anjing` |

Regional vocabulary is included, such as Javanese `jancuk` and Sundanese `kehed`.
Use the optional metadata to select reviewed words by category, documented
regional usage, and editorial severity, or supply your own list. The source
catalog lets you inspect explanations, citations, and review status behind those
choices. [Choose a dictionary](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/dictionaries.md).

## Build highlights and review tools

Find the spelling that appeared in the message and the dictionary word it
matched. Positions refer to the original text, so you can highlight the right
characters even when normalization was needed:

```ts
import { Badwords } from 'indonesian-badwords';

const checker = new Badwords();

checker.find('👩🏽‍💻 g0bl0k!');
// [{ word: 'goblok', index: 8, end: 14, match: 'g0bl0k' }]
```

Unicode graphemes stay intact, including combining marks and emoji sequences.
Use `analyze()` for unique terms, occurrence counts, censored text, and locations
in one result, or `filter()` to remove matches and clean up whitespace.
[Result formats](https://github.com/drizki/indonesian-badwords/blob/main/docs/api.md#results-and-errors).

## Add capabilities as your app needs them

The default browser bundle is about 12 KB minified and gzipped. Censor helpers,
evasion, fuzzy matching, metadata, and source catalogs have separate imports.
Adding typo detection does not require loading the source catalog; selecting
dictionary categories happens during setup rather than on each message.

The same public methods work with every policy. Keep your detection,
censorship, and reporting code as you add matching options.

## Measure the speed

The maintained benchmark covers ASCII and Unicode input, match positions,
censorship, callbacks, custom dictionaries, scoped exceptions, evasion, and fuzzy
matching. A few measured default-policy results:

| Workload | Operation | Median per call |
| --- | --- | ---: |
| Clean ASCII paragraph, 4,000 characters | `flag` | 24.45 µs |
| Clean ASCII paragraph, 4,000 characters | `censor` | 5.56 µs |
| Accents, emoji, and one literal match, 4,000 UTF-16 units | `flag` | 29.79 µs |

These are warmed synthetic medians on Node.js 24.22.1, with setup excluded.
Optional policies have their own costs. Run `npm run benchmark` from the
repository to measure your runtime.
[Full results and methodology](https://github.com/drizki/indonesian-badwords/blob/main/docs/performance.md).

## Documentation

Start with the [documentation index](https://github.com/drizki/indonesian-badwords/blob/main/docs/README.md)
for setup, configuration guides, browser/framework examples, and troubleshooting.

[API reference](https://github.com/drizki/indonesian-badwords/blob/main/docs/api.md)
· [Dictionaries and sources](https://github.com/drizki/indonesian-badwords/blob/main/docs/metadata.md)
· [Benchmarks](https://github.com/drizki/indonesian-badwords/blob/main/docs/performance.md)

## Contributing

Missing a word or getting a false positive? Open an issue with the example, the
result you expected, and a similar benign case. For dictionary additions, include
sources showing the abusive usage. Use the [dictionary report form](https://github.com/drizki/indonesian-badwords/issues/new?template=dictionary-report.yml)
and the [contribution guide](https://github.com/drizki/indonesian-badwords/blob/main/docs/contributing.md).

Semoga bermanfaat 😉
