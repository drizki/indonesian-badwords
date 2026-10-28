# Indonesian Badwords

[![CI](https://github.com/drizki/indonesian-badwords/actions/workflows/ci.yml/badge.svg)](https://github.com/drizki/indonesian-badwords/actions/workflows/ci.yml) [![Downloads](https://img.shields.io/npm/dt/indonesian-badwords.svg)](https://www.npmjs.com/package/indonesian-badwords) ![License MIT](https://img.shields.io/npm/l/indonesian-badwords.svg)

Check Indonesian text for profanity, find matches, or replace them. Includes
TypeScript types, ESM and CommonJS, with no runtime dependencies.

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

## Performance

A browser bundle with the default checker is about 9 KB minified and gzipped.

| Operation | Input length | Median time |
| --- | ---: | ---: |
| `flag` | 280 characters | 1.74 µs |
| `flag` | 4,000 characters | 19.86 µs |
| `censor` | 4,000 characters | 5.04 µs |
| `analyze` | 4,000 characters | 12.56 µs |

Measured with the default dictionary on synthetic clean Indonesian ASCII text,
using Node.js 24.22.1 and 151 calls per case after warmup. Times exclude import
and first-call setup. Results vary with input, hardware, and runtime.
Run `npm run benchmark` for local measurements.

## Choose a dictionary

The default has 227 profanity terms and spelling variants. Words with common
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

## Options

Pass options to `new Badwords(options)`:

| Option | Default | Purpose |
| --- | --- | --- |
| `dictionary` | Bundled list | Supply your own words or `expandedDictionary`. |
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
| `censor(text, replacement = '***')` | Text with matched spans replaced. |
| `filter(text)` | Text with matches removed and whitespace cleaned up. |
| `analyze(text)` | Censored text, counts, words, and locations. |

Use `addWords` and `removeWords` to change a checker's dictionary. `dict` returns a
copy. Create a separate `new Badwords()` when you need settings or words that
shouldn't affect the shared default instance.

Empty strings are valid. Invalid inputs throw `TypeError`; `find` and `analyze`
throw `RangeError` if they exceed `maxMatches`.

## Documentation

- [API, matching rules, and customization](https://github.com/drizki/indonesian-badwords/blob/main/docs/api.md)
- [Migrating to v2](https://github.com/drizki/indonesian-badwords/blob/main/docs/migrating-v2.md)
- [Development and npm releases](https://github.com/drizki/indonesian-badwords/blob/main/docs/maintaining.md)

## Contributing

For dictionary changes, include an abusive example and a nearby benign case.
Open a pull request if a term is missing.

Semoga bermanfaat 😉
