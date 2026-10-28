<p align="center">
  <img src="https://raw.githubusercontent.com/drizki/indonesian-badwords/main/assets/readme-banner.svg" alt="Indonesian Badwords. Fast checks. Exact spans. A Bahasa Indonesia profanity checker with TypeScript, ESM, CommonJS, and zero runtime dependencies." width="1440" />
</p>

# Indonesian Badwords

[![npm](https://img.shields.io/npm/v/indonesian-badwords.svg)](https://www.npmjs.com/package/indonesian-badwords) [![CI](https://github.com/drizki/indonesian-badwords/actions/workflows/ci.yml/badge.svg)](https://github.com/drizki/indonesian-badwords/actions/workflows/ci.yml) [![Downloads](https://img.shields.io/npm/dt/indonesian-badwords.svg)](https://www.npmjs.com/package/indonesian-badwords) [![MIT license](https://img.shields.io/npm/l/indonesian-badwords.svg)](https://github.com/drizki/indonesian-badwords/blob/main/LICENSE)

[English](https://github.com/drizki/indonesian-badwords#readme) · [Bahasa Indonesia](https://github.com/drizki/indonesian-badwords/blob/main/README.id.md)

Fast profanity checking for Bahasa Indonesia. Catch disguised words, censor
matches, and highlight exactly what matched in the original text.

Use it with JavaScript or TypeScript in Node.js and browser bundles. It includes
ESM and CommonJS exports, with zero runtime dependencies.

## Get started

```bash
npm install indonesian-badwords
```

```ts
import { Badwords } from 'indonesian-badwords';

const checker = new Badwords();

checker.flag('terima kasih');    // false
checker.flag('dasar g0bl0k!');   // true
checker.censor('dasar g0bl0k!'); // 'dasar ***!'
checker.find('dasar g0bl0k!');
// [{ word: 'goblok', index: 6, end: 12, match: 'g0bl0k' }]
```

Requires Node.js 22+. Browser bundles need ES2022 support and `Intl.Segmenter`.

## What you can do

- Catch common disguises such as `g0bl0k`, fullwidth letters, and invisible
  characters. Optional evasion and fuzzy policies also handle separated letters,
  stretched spellings, selected lookalikes, and typos.
- Highlight matches with exact original-text offsets. Matching and censorship
  preserve complete Unicode graphemes, including combining marks and emoji.
- Choose conservative, expanded, or custom dictionaries. Optional metadata adds
  selection by category, documented regional usage, and editorial severity.
- Censor with a fixed replacement, custom masks, grawlix, or your own
  callback. Matching and censorship use the same policy.
- Exempt known phrases or source ranges, so an allowed occurrence does not hide
  unrelated matches elsewhere in the message.
- Inspect dictionary explanations and citations through a separate source
  catalog. Optional scanners, metadata, and sources stay outside ordinary imports.

Whole-word matching is the default. Common literal words such as `anjing` and
`babi` are excluded from the default dictionary; the expanded list includes them.
[Choose the word list and matching rules for your app](https://github.com/drizki/indonesian-badwords/blob/main/docs/api.md#instances-and-dictionaries).

## Performance

| Default checker | Result |
| --- | ---: |
| Clean ASCII chat, 280 characters, `flag` | 1.77 µs per call |
| Clean ASCII paragraph, 4,000 characters, `flag` | 24.45 µs per call |
| Browser bundle, minified and gzipped | About 12 KB |

Timings are warmed synthetic medians on Node.js 24.22.1. Results vary with input,
hardware, and runtime. [See the full measurements and run the benchmarks](https://github.com/drizki/indonesian-badwords/blob/main/docs/performance.md).

## Documentation

- [API, matching rules, and customization](https://github.com/drizki/indonesian-badwords/blob/main/docs/api.md)
- [Dictionaries, categories, regional usage, and sources](https://github.com/drizki/indonesian-badwords/blob/main/docs/metadata.md)
- [Performance and benchmarks](https://github.com/drizki/indonesian-badwords/blob/main/docs/performance.md)
- [Migrating to v2](https://github.com/drizki/indonesian-badwords/blob/main/docs/migrating-v2.md)
- [Development and npm releases](https://github.com/drizki/indonesian-badwords/blob/main/docs/maintaining.md)

## Contributing

Missing a word or getting a false positive? Open an issue with the example, the
result you expected, and a nearby benign case. Propose dictionary additions with
sources that document the abusive usage.

Semoga bermanfaat 😉
