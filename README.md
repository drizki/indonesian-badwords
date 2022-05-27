# Indonesian Badwords

![Downloads](https://img.shields.io/npm/dt/indonesian-badwords.svg) ![License MIT](https://img.shields.io/npm/l/indonesian-badwords.svg) ![Size](https://img.shields.io/bundlephobia/min/indonesian-badwords)

This is a small JavaScript utility library to find and replace bad/swearing/cursing words in Bahasa Indonesia.

[Live Demo](https://codesandbox.io/s/indonesian-badwords-fm36vs?file=/src/index.js)

## Installation

Using NPM

```bash
npm install indonesian-badwords
```

Using Yarn

```bash
yarn add indonesian-badwords
```

## Usage

A basic example looks like this:

```javascript
const badwords = require("indonesian-badwords");

console.log(badwords.flag("halo, namaku budi")); // false
console.log(badwords.flag("halo, namaku babi")); // true

console.log(badwords.filter("halo, namaku budi")); // halo, namaku budi
console.log(badwords.filter("halo, namaku babi")); // halo, namaku

console.log(badwords.badwords("halo, namaku budi")); // []
console.log(badwords.badwords("halo, namaku babi")); // ['anjing']

console.log(badwords.censor("halo, namaku budi")); // halo, namaku budi
console.log(badwords.censor("halo, namaku babi")); // halo, namaku ***

console.log(badwords.analyze("halo, namaku budi")); // Returns object, see table below
console.log(badwords.analyze("halo, namaku babi")); // Returns object, see table below
```

## Available Functions

| Function | Params      | Type     | Required | Default | Return    | Description                                                                                                                                 |
| -------- | ----------- | -------- | -------- | ------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| flag     | text        | `string` | yes      |         | `boolean` | Checks if passed text contains bad word.                                                                                                    |
| badwords | text        | `string` | yes      |         | `array`   | Get all contained bad words from text.                                                                                                      |
| filter   | text        | `string` | yes      |         | `string`  | Trim bad words from text.                                                                                                                   |
| censor   | text        | `string` | yes      |         | `string`  | Censors passed text with replacement.                                                                                                       |
|          | replacement | `string` | no       | `***`   | `string`  |                                                                                                                                             |
| analyze  | text        | `string` | yes      |         | `object`  | Outputs object of original text, number of words, censored text, array of bad words, count of bad words, and index of individual bad words. |

## Test

Clone this repository and run the following:

```bash
npm run test
```

## Contributing

If you think the dictionary is missing a bad word, feel free to submit a PR.

Semoga bermanfaat 😉
