# Migrating to v2

[Documentation](README.md)

## Update construction and imports

Pass an options object to the constructor:

```ts
import { Badwords } from 'indonesian-badwords';

const words = ['goblok'];
// Before: new Badwords(words)
const checker = new Badwords({ dictionary: words });
```

Replace source-file imports with the root package or a documented public
entrypoint: `indonesian-badwords/censor`, `/metadata`, `/catalog`, `/evasion`, or
`/fuzzy`. The package supports ESM and CommonJS.

```js
const { Badwords } = require('indonesian-badwords');
const checker = new Badwords();
```

## Review policy and result handling

| Change | Action |
| --- | --- |
| The default list excludes ambiguous animal, identity, medical, and ordinary vocabulary. | Use `dictionary: expandedDictionary` if your policy needs those terms. Check literal uses in your application's text too. |
| Every text method matches whole words by default. | Set `mode: 'substring'` if joined words must match, including in censorship and filtering. Expect matches inside ordinary words too. |
| Empty strings return clean results; non-string inputs throw `TypeError`. | Handle empty messages as clean and validate non-string input before checking it. |
| Standard normalization recognizes Unicode compatibility forms and invisible obfuscation. Numeric-only runs and terminal punctuation stay literal. | Test your accepted spelling variants. Use `normalization: 'none'` when you need exact spelling and case. |
| Locations include exclusive `end` and original `match`; analysis includes `occurrenceCount`. | Distinguish unique-term `count` from occurrence count and use UTF-16 offsets for locations. |
| `find` and `analyze` cap detailed results at 10,000 occurrences by default. | Handle `RangeError`, set `onMaxMatches: 'truncate'`, or choose a positive safe integer or `Infinity` for `maxMatches`. This cap does not apply to `flag`, `badwords`, `censor`, or `filter`; optional scanner work limits are separate. |
| `dict` returns a normalized copy. | Use `addWords` and `removeWords` on your own `new Badwords()` instance to change its dictionary. The module-level functions and the default export share one process-wide checker; the functions are deprecated. |

See the [API reference](api.md) for current matching rules, optional policies, and
result types, or the [dictionary guide](guides/dictionaries.md) for source-reviewed selection.
