# Troubleshoot a result

[Documentation](../README.md)

Reproduce with the installed version, the exact text, and the effective
constructor options and per-call exceptions. Do not publish private messages;
use an original or anonymized example that preserves the behavior.

## A word was missed

1. Check vocabulary. The default list deliberately excludes common literal uses;
   try the [expanded or reviewed lists](dictionaries.md) if your policy needs them.
2. Check boundaries. Word mode does not stem arbitrary endings or split joined
   words. `kontolnya` is not automatically derived from `kontol`.
3. Check transformations. Inserted punctuation, stretched letters, and typos need
   their corresponding [evasion](evasion.md) or [fuzzy](fuzzy-matching.md) policy.
4. Check exceptions. A configured phrase or ignored source range may suppress the
   occurrence. Remove exceptions in a minimal reproduction to compare results.

`getMetadata` performs exact spelling lookup; it is not a detector. Use a text
method to detect first, then look up the returned dictionary `word`.

## Ordinary text was flagged

Expanded dictionaries include literal terms such as `anjing`. Substring mode
can match `asu` inside `asusila`. Fuzzy matching can match `kontrol` against
`kontol`. Narrow the dictionary, use word mode, or reduce explicit tolerance.
A known phrase can exempt a specific expression while retaining detection
elsewhere. Avoid removing a word globally when only one phrase needs an exception.

## Censorship or counts look unexpected

`find` returns overlapping occurrences. `censor` merges overlapping coverage;
adjacent matches remain separate. `analyze().count` counts unique dictionary
words, while `occurrenceCount` includes every accepted occurrence. A callback
receives one merged span and its unique contributing words. See [result
contracts](../api.md#results-and-errors) and [censoring](censoring.md).

Replacement strings are literal. `$&` is not a regex substitution. Returning a
promise from a callback throws because callbacks must be synchronous.

## Highlight positions look wrong

`index` and exclusive `end` are UTF-16 offsets into the original input. Use
`text.slice(index, end)` rather than slicing normalized text or counting visible
characters. Emoji can occupy several UTF-16 units. Keep the original text until
rendering and use text nodes or framework escaping. See the [app
examples](browser-and-frameworks.md).

## A check throws

| Error | Likely cause | Next step |
| --- | --- | --- |
| `TypeError` | Invalid input/options or a non-string callback result | Validate the caller and read the relevant contract. |
| `RangeError` from `find`/`analyze` | Accepted occurrences exceeded `maxMatches` | Set `onMaxMatches: 'truncate'` and check `truncated`, handle the error, or deliberately choose a new cap. |
| `EvasionLimitError` | An evasion input, compilation, or scan quota was exceeded. Compile budgets are thrown by `addWords`/`removeWords` themselves, which then change nothing | Inspect `limit`, `maximum`, and `used`; narrow the policy or adjust that bound. |
| `FuzzyLimitError` | A fuzzy input, compilation, index, or scan quota was exceeded. Compile and index budgets are thrown by `addWords`/`removeWords` themselves, which then change nothing | Inspect the typed fields and review edit breadth and workload size. |
| `RangeError` with ignored ranges | Numeric bounds or grapheme boundaries are invalid | Recompute offsets in the original text. |

Optional limit errors extend `RangeError`, so check the specific class first.
An incomplete check is not a clean verdict. Do not retry unchanged expensive
input without changing a meaningful bound or policy.

## Browser or TypeScript imports fail

Use the root package or its documented `/censor`, `/metadata`, `/catalog`,
`/evasion`, and `/fuzzy` entrypoints. Internal `src`/`dist` paths are not public
imports. Browser builds need ES2022 and `Intl.Segmenter`; ESM and CommonJS consumers
should use their normal resolution mode. See [getting started](../getting-started.md)
and the [framework guide](browser-and-frameworks.md).

If the behavior still looks wrong, use the [report
form](https://github.com/drizki/indonesian-badwords/issues/new?template=dictionary-report.yml)
with the package version, complete policy, expected and actual results, and a
benign counterexample. [Contribution guidance](../contributing.md) explains sources.
