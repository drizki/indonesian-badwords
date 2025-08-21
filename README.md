# Indonesian Badwords

![Downloads](https://img.shields.io/npm/dt/indonesian-badwords.svg) ![License MIT](https://img.shields.io/npm/l/indonesian-badwords.svg) 

A small JavaScript library designed for the detection, censorship, and analysis of profane words within the Indonesian language. The library is engineered for efficiency, accuracy, and flexibility, with capabilities to identify not only standard profanity but also disguised lexical variations, such as leetspeak and concatenated terms.

A live demonstration is available for further examination.

## Features

This utility is distinguished by several key features. It is computationally efficient, employing a `Set` data structure to achieve O(1) average time complexity for lexical lookups. The library is equipped with an extensive dictionary containing over 200 curated terms, which includes regional dialects, contemporary internet slang, and common abbreviations. Furthermore, it incorporates functionality for leetspeak detection, enabling the identification of words with common character substitutions (e.g., `4nj1ng` is recognized as `anjing`). The `flag()` and `badwords()` methods are capable of detecting profanity within concatenated strings where standard delimiters are absent (e.g., `bajingankontol`). The dictionary is also designed to be fully customizable, allowing for the addition or removal of terms at runtime.

## Installation

The package can be installed via NPM or Yarn.

**NPM:**
```bash
npm install indonesian-badwords
```

**Yarn:**
```bash
yarn add indonesian-badwords
```

## Usage

### Fundamental Usage

The following examples illustrate the basic functionality of the library.

```javascript
const badwords = require("indonesian-badwords");

// Check for the presence of profane words
console.log(badwords.flag("kalimat ini bersih")); // Returns: false
console.log(badwords.flag("dasar monyet")); // Returns: true

// Censor profane words
console.log(badwords.censor("dasar monyet")); // Returns: "dasar ***"

// Retrieve a list of profane words found
console.log(badwords.badwords("dasar monyet dan babi")); // Returns: ['monyet', 'babi']
```

### Advanced Detection Capabilities

The library is designed to automatically handle leetspeak and can identify concatenated profanities.

```javascript
// Leetspeak detection and censorship
console.log(badwords.flag("dasar 4nj1ng")); // Returns: true
console.log(badwords.censor("dasar 4nj1ng")); // Returns: "dasar ***"

// Concatenated word detection
console.log(badwords.flag("dasarbajingankontol")); // Returns: true
console.log(badwords.badwords("dasarbajingankontol")); // Returns: ['bajingan', 'kontol']
```

### Dictionary Customization

The dictionary can be modified programmatically during runtime.

```javascript
const badwords = require("indonesian-badwords");

// Add a new term to the dictionary
badwords.addWords('kucel');
console.log(badwords.flag('muka kamu kucel')); // Returns: true

// Remove an existing term from the dictionary
badwords.removeWords('monyet');
console.log(badwords.flag('dasar monyet')); // Returns: false
```

## API Reference

| Function | Parameter | Type | Required | Default | Return Type | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `flag` | `text` | `string` | Yes | | `boolean` | Performs a comprehensive substring search to detect profane words. |
| `badwords` | `text` | `string` | Yes | | `string[]` | Returns an array of all dictionary-defined words found within the text. |
| `filter` | `text` | `string` | Yes | | `string` | Removes profane words from the text, with accurate handling of leetspeak. |
| `censor` | `text` | `string` | Yes | | `string` | Replaces profane words with a substitute string. |
| | `replacement` | `string` | No | `***` | | Specifies the string to be used for replacement. |
| `analyze` | `text` | `string` | Yes | | `object` | Returns a detailed analysis object of the provided text. |
| `addWords` | `words` | `string` or `string[]` | Yes | | `void` | Appends one or more terms to the dictionary. |
| `removeWords`| `words` | `string` or `string[]` | Yes | | `void` | Deletes one or more terms from the dictionary. |

## Testing

To execute the test suite, clone the repository and run the following commands:

```bash
npm install
npm run test
```

## Contributing

Contributions to the project are encouraged. If the dictionary is observed to be missing a significant profane term, please submit a Pull Request for consideration.

Semoga bermanfaat 😉
