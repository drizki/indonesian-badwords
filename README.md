<p align="center">
  <img src="https://raw.githubusercontent.com/drizki/indonesian-badwords/main/assets/readme-banner.svg" alt="Indonesian Badwords. Fast checks. Exact spans. A Bahasa Indonesia profanity checker with TypeScript, ESM, CommonJS, and zero runtime dependencies." width="1440" />
</p>

# Indonesian Badwords

[![npm](https://img.shields.io/npm/v/indonesian-badwords.svg)](https://www.npmjs.com/package/indonesian-badwords) [![CI](https://github.com/drizki/indonesian-badwords/actions/workflows/ci.yml/badge.svg)](https://github.com/drizki/indonesian-badwords/actions/workflows/ci.yml) [![Downloads](https://img.shields.io/npm/dt/indonesian-badwords.svg)](https://www.npmjs.com/package/indonesian-badwords) [![MIT license](https://img.shields.io/npm/l/indonesian-badwords.svg)](https://github.com/drizki/indonesian-badwords/blob/main/LICENSE)

Fast Indonesian profanity filtering for JavaScript and TypeScript. Catch disguised
spellings, censor matches, and get exact locations in the original text.

- **Fast checks for chat, comments, and forms.** Early-exit detection, about 12 KB
  minified and gzipped, and zero runtime dependencies. [See the benchmarks](#performance).
- **Precise Unicode matches.** Recognizes `g0bl0k`, `ＧＯＢＬＯＫ`, and words containing
  invisible characters. Censoring preserves the surrounding text and punctuation.
- **Your moderation policy.** Choose the default or expanded dictionary, supply
  your own words, or select reviewed categories, regions, and severity levels.

Includes TypeScript declarations, ESM, and CommonJS. Runs in Node.js and browser bundles.

## Install

```bash
npm install indonesian-badwords
```

Requires Node.js 22+. Browser apps need a bundler, ES2022 support, and `Intl.Segmenter`.

## Quick start

```ts
import badwords, { flag, find, censor } from 'indonesian-badwords';

flag('terima kasih');             // false
flag('dasar g0bl0k!');            // true
censor('dasar g0bl0k!');          // 'dasar ***!'
badwords.badwords('goblok goblok'); // ['goblok']
find('dasar g0bl0k!');
// [{ word: 'goblok', index: 6, end: 12, match: 'g0bl0k' }]
```

Matching ignores case and recognizes spellings such as `g0bl0k`. It checks whole
words by default and keeps the surrounding text intact.

For CommonJS:

```js
const { Badwords, flag, censor } = require('indonesian-badwords');
flag('dasar goblok'); // true
```

## Bounded evasion

Opt in to separated letters, limited stretching, or selected lookalikes without
loading the optional scanner into ordinary imports:

```ts
import { Badwords } from 'indonesian-badwords';
import { boundedEvasion } from 'indonesian-badwords/evasion';

const checker = new Badwords({
  evasion: boundedEvasion({
    separators: { characters: ['-', '_'], maxGap: 1, maxTotal: 8 }
  })
});
checker.censor('g-o-b-l-o-k'); // '***'
```

Each transformation has explicit bounds. Original spans, scoped exceptions, and
all checker methods follow the same policy. [Configure repeats, mappings, and resource limits](docs/api.md#bounded-evasion).

## Performance

A browser bundle with the default checker is about 12 KB minified and gzipped.

| Workload | Operation | Median per call |
| --- | --- | ---: |
| Clean ASCII chat, 280 characters | `flag` | 1.75 µs |
| Clean ASCII paragraph, 4,000 characters | `flag` | 22.98 µs |
| Clean ASCII paragraph, 4,000 characters | `censor` | 5.56 µs |
| Clean ASCII paragraph, 4,000 characters | `analyze` | 15.53 µs |
| Clean paragraph with accents and emoji, 4,000 UTF-16 units | `flag` | 21.66 µs |
| Paragraph with accents, emoji, and one literal match, 4,000 UTF-16 units | `flag` | 30.32 µs |

Node.js 24.22.1, default dictionary, synthetic inputs with a unique reference per
call. Each case warms up for at least 250 ms, then measures 41 calibrated batches.
These are medians of per-call batch averages; import, setup, input generation,
and correctness checks are excluded. Results vary with input, hardware, and runtime.

Run `npm run benchmark` for 87 self-checking workloads, including cold calls,
match positions, Unicode, callbacks, masking, scoped exceptions, custom dictionaries,
bounded evasion, and memory. Run
`npm run benchmark:compare` to compare with pinned Indonesian libraries; different
detection outputs are reported separately from timings.

## Choose a dictionary

The default dictionary has 227 terms and spelling variants. Words with common
literal uses, such as `anjing` and `babi`, are excluded. `anjing peliharaan`,
`suhu udara`, and `buang sampah` stay clean.

To include those terms, use the expanded dictionary. It adds 117 words, for 344 total:

```ts
import { Badwords, expandedDictionary } from 'indonesian-badwords';

const strict = new Badwords({ dictionary: expandedDictionary });
strict.flag('anjing');             // true
strict.censor('anjing peliharaan'); // '*** peliharaan'
```

The expanded list also flags literal uses. Neither list determines whether
someone means to insult another person.

For a source-reviewed policy, import `reviewedDictionary` or
`selectDictionary` from `indonesian-badwords/metadata`. These optional profiles
separate uncertain entries and document ambiguous uses:

```ts
import { reviewedDictionary } from 'indonesian-badwords/metadata';

const reviewed = new Badwords({ dictionary: reviewedDictionary });
```

Select by category,
documented regional usage, or editorial severity; inspect original explanations
and citations through the separate `indonesian-badwords/catalog` import.
[See reviewed dictionaries and sources](docs/metadata.md). Neither optional
entry point increases the default checker's bundle.

## Options

Pass options to `new Badwords(options)`:

| Option | Default | Purpose |
| --- | --- | --- |
| `dictionary` | Bundled list | Supply your own words or `expandedDictionary`. |
| `allowPhrases` | `[]` | Exempt only occurrences inside known literal phrases. |
| `mode` | `'word'` | Use `'substring'` to catch joined words such as `kamuasu`. |
| `normalization` | `'standard'` | Use `'none'` for exact, case-sensitive matching. |
| `ignoreRepeatedLetters` | `false` | Catch stretched words such as `gooooblokk`. |
| `maxMatches` | `10000` | Set the occurrence limit for `find` and `analyze`; `Infinity` removes it. |

Substring mode can flag parts of ordinary words. Repeated-letter matching can
also increase false positives. See [matching rules and examples](https://github.com/drizki/indonesian-badwords/blob/main/docs/api.md#matching).

## Methods

These work on an instance, the default export, or as named imports.

| Method | Returns |
| --- | --- |
| `flag(text)` | Whether any word matches. |
| `find(text)` | Occurrences as `{ word, index, end, match }`. |
| `badwords(text)` | Unique matching dictionary words. |
| `censor(text, replacement = '***')` | Text with matched spans replaced by a literal string or callback result. |
| `filter(text)` | Text with matches removed and whitespace cleaned up. |
| `analyze(text)` | Censored text, counts, words, and locations. |

Allow a known phrase without exempting the whole message:

```ts
const checker = new Badwords({ allowPhrases: ['Baju Bodo'] });
checker.censor('Baju Bodo goblok bodo'); // 'Baju Bodo *** ***'

const text = 'bodo goblok';
const options = { ignoreRanges: [{ index: 0, end: 4 }] } as const;
checker.censor(text, '[removed]', options); // 'bodo [removed]'
```

Every text method accepts per-call `CheckOptions` as its second argument;
`censor` accepts them as the third. Ranges use original half-open UTF-16 offsets
on complete grapheme boundaries. Any intersecting occurrence is ignored.
Phrases use literal normalization without leetspeak or repeat guessing. See
[scoped exception rules](https://github.com/drizki/indonesian-badwords/blob/main/docs/api.md#scoped-exceptions).

Use `addWords` and `removeWords` to change a checker's dictionary. `dict` returns a
copy. Create a separate `new Badwords()` when you need settings or words that
shouldn't affect the shared default instance.

Empty strings are valid. Invalid inputs throw `TypeError`; `find` and `analyze`
throw `RangeError` if they exceed `maxMatches`.

Use a callback for custom replacements, or import grapheme-safe strategies from
the optional `censor` entry point:

```ts
import { censor } from 'indonesian-badwords';
import { mask, grawlix } from 'indonesian-badwords/censor';

censor('dasar g0bl0k!', mask({ keepFirst: 1 })); // 'dasar g*****!'
censor('goblok', grawlix({ symbols: '@#$' }));
censor('goblok', ({ match, words }) => `[${words.join(',')}:${match}]`);
```

Strategies count original graphemes and always mask at least one, including short
matches. See [callback and strategy options](https://github.com/drizki/indonesian-badwords/blob/main/docs/api.md#custom-censorship).

## Documentation

- [API, matching rules, and customization](https://github.com/drizki/indonesian-badwords/blob/main/docs/api.md)
- [Migrating to v2](https://github.com/drizki/indonesian-badwords/blob/main/docs/migrating-v2.md)
- [Development and npm releases](https://github.com/drizki/indonesian-badwords/blob/main/docs/maintaining.md)

## Contributing

For dictionary changes, include an abusive example and a nearby benign case.
Open a pull request if a term is missing.

Semoga bermanfaat 😉
