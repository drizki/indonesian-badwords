# Migrating to v2

[Back to the README](../README.md)

| Change | What to do |
| --- | --- |
| The default list excludes ambiguous animal, identity, medical, and ordinary vocabulary. | Pass `dictionary: expandedDictionary` if your policy needs those words. |
| Every method now matches whole words by default. | Choose `mode: 'substring'` for joined words, including censorship and filtering. |
| The constructor takes an options object. | Replace `new Badwords(words)` with `new Badwords({ dictionary: words })`. |
| Empty strings return clean results. | Invalid inputs throw `TypeError`. |
| Numeric-only runs and terminal punctuation stay literal. | Unicode compatibility forms and invisible obfuscation are recognized. |
| Locations include `end` and `match`; analysis adds `occurrenceCount`. | Check code that consumes these results. Detailed results have a configurable occurrence limit. |
| `dict` returns a normalized copy. | Use `addWords` and `removeWords` to change the checker. |
| Source-file subpaths are no longer public. | Import from `indonesian-badwords`. |

[API and matching details](api.md)
