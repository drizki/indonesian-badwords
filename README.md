# Indonesian Badwords

[![CI](https://github.com/drizki/indonesian-badwords/actions/workflows/ci.yml/badge.svg)](https://github.com/drizki/indonesian-badwords/actions/workflows/ci.yml) [![Downloads](https://img.shields.io/npm/dt/indonesian-badwords.svg)](https://www.npmjs.com/package/indonesian-badwords) ![License MIT](https://img.shields.io/npm/l/indonesian-badwords.svg)

A small, zero-dependency TypeScript library for detecting, censoring, and analyzing profanity in Bahasa Indonesia. It ships ESM, CommonJS, and bundled type declarations, and handles disguised words such as leetspeak (`4nj1ng`) and concatenated terms (`bajingankontol`).

## Features

- **210+ dictionary entries**, including regional dialects, internet slang, and abbreviations
- **Leetspeak detection** via a character substitution map
- **Concatenated-word detection** for `flag()` and `badwords()`
- **Runtime dictionary customization** with `addWords()` / `removeWords()`
- **Dual module support** — ESM and CommonJS from one import path
- **First-class TypeScript** — declarations are generated from the source
- **Zero runtime dependencies**

## Installation

```bash
npm install indonesian-badwords
# or
yarn add indonesian-badwords
# or
pnpm add indonesian-badwords
```

## Usage

### ESM / TypeScript

```ts
import badwords from 'indonesian-badwords';

badwords.flag('kalimat ini bersih');     // false
badwords.flag('dasar monyet');           // true
badwords.censor('dasar monyet');         // 'dasar ***'
badwords.badwords('dasar monyet dan babi'); // ['monyet', 'babi']
```

Named exports are also available, which is friendlier for tree-shaking:

```ts
import { analyze, censor, flag } from 'indonesian-badwords';

flag('dasar anjing');      // true
censor('dasar anjing');    // 'dasar ***'
analyze('lorem anjing!');  // typed AnalysisResult object
```

### CommonJS

```js
const badwords = require('indonesian-badwords');

badwords.flag('dasar monyet'); // true
badwords.censor('dasar monyet'); // 'dasar ***'
```

### Advanced detection

```ts
import badwords from 'indonesian-badwords';

// Leetspeak
badwords.flag('dasar 4nj1ng');   // true
badwords.censor('dasar 4nj1ng'); // 'dasar ***'

// Concatenated words
badwords.flag('dasarbajingankontol'); // true
badwords.badwords('dasarbajingankontol'); // ['bajingan', 'kontol']
```

### Dictionary customization

Use a separate instance when you want an isolated dictionary:

```ts
import { Badwords } from 'indonesian-badwords';

const custom = new Badwords(['kucel']);

custom.flag('muka kamu kucel'); // true
custom.flag('dasar anjing');    // false
```

Or mutate the shared instance:

```ts
import badwords, { addWords, removeWords } from 'indonesian-badwords';

addWords('kucel');
badwords.flag('muka kamu kucel'); // true

removeWords('kucel');
badwords.flag('muka kamu kucel'); // false
```

## API Reference

Every method is available on the default export, as a named export, and on `new Badwords(dictionary)`.

| Function | Parameters | Returns | Description |
| :--- | :--- | :--- | :--- |
| `flag` | `text: string` | `boolean` | Substring search for any dictionary word. |
| `badwords` | `text: string` | `string[]` | All unique dictionary words found in the text. |
| `filter` | `text: string` | `string` | Removes bad words and cleans up whitespace. |
| `censor` | `text: string, replacement = '***'` | `string` | Replaces whole words, preserving delimiters. |
| `analyze` | `text: string` | `AnalysisResult` | Censored text, matches, count, and locations. |
| `addWords` | `words: string \| string[]` | `void` | Adds words to the dictionary. |
| `removeWords` | `words: string \| string[]` | `void` | Removes words from the dictionary. |

`AnalysisResult` contains `text`, `words`, `censored`, `badwords`, `count`, and `locations` (`Array<{ word: string; index: number }>`).

## Development

```bash
npm install
npm run build   # emits dist/esm and dist/cjs
npm test        # builds, then runs the node:test suite
```

The build uses only `tsc`: ESM is compiled with `NodeNext`, CommonJS with `CommonJS`, and a small post-build script writes the `dist/cjs/package.json` type marker. The published package contains only `dist/`.

## Releasing

Publishing is tag-driven. The tag must match the `package.json` version exactly, including the `v` prefix.

```bash
# 1. Bump the version and create the tag in one step
npm version patch   # or: minor / major

# 2. Push the commit and the tag
git push origin main --follow-tags
```

Pushing the tag runs the `Publish` workflow, which tests the package, validates the tag, and publishes it to npm with provenance. Re-running a tag whose version is already on npm is a no-op.

## Contributing

Contributions are welcome. If a significant profane term is missing from the dictionary, please open a Pull Request.

Semoga bermanfaat 😉
