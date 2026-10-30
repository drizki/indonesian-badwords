# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/). Release PRs update this file; see
[release preparation](docs/maintaining.md#prepare-a-release-pr).

## [Unreleased]

- `filter(text, { preserveLineBreaks: true })` keeps line breaks: a whitespace run containing LF, CR, CRLF, U+2028 or U+2029 collapses to exactly those breaks (blank lines kept, trailing and leading spaces on a line dropped, CRLF kept as one unit). The default still collapses everything to one space. New `FilterOptions` type.
- `analyze(text, { replacement })` accepts the same string or callback as `censor()`, including `mask()`/`grawlix()` and callbacks that use `context.occurrences()`, for `censored`. The default stays `***`. New `AnalyzeOptions` type.
- New `onMaxMatches: 'throw' | 'truncate'` option for the constructor and, per call, for `find()` and `analyze()`. `'throw'` (default) keeps the `RangeError`; `'truncate'` keeps the first `maxMatches` occurrences in source order and sets `truncated`: `true` on the `analyze()` result (the field is absent otherwise, so untruncated results are unchanged) and a non-enumerable `truncated` property on the `find()` array (new `FindResult` type; deep equality and JSON are unaffected). `censored` still covers every match, and `classify()` accepts truncated results. A constructor `onMaxMatches: 'truncate'` also applies to `censor()` callbacks: `context.occurrences()` then lists only the kept occurrences, and carries a non-enumerable `truncated: true` when the span reaches past the last kept one (so an empty list is distinguishable from a clean span). Truncation stops scanning early where it can prove nothing later qualifies (the general matcher and the native word pattern), so a flood of matches no longer costs more than throwing; the evasion and fuzzy scanners still scan the whole input.
- `addWords()`/`removeWords()` build the evasion or fuzzy matcher on the next scan instead of on every call, so 300 single-word `addWords` calls with a fuzzy policy cost a few milliseconds of checks plus one compile instead of 300 compiles (about 300 ms). Limits are unchanged and still enforced by the call itself: `maxDictionaryLength`, `maxCompileStates`, `maxIndexPostings` and `maxStateCells` throw their typed error from `addWords`/`removeWords` and leave the dictionary untouched, pending updates included, because the same budgets are checked incrementally on the exact quantities the compiler counts. `dict` reflects updates immediately.
- Deprecates the module-level `addWords` and `removeWords` (`@deprecated`): they mutate a process-wide checker. Use an isolated `new Badwords()`. They keep working throughout 2.x, with no runtime warning. The default export is the same shared instance, so `badwords.addWords(...)` on it mutates it without any deprecation hint.
- Performance (#37): `flag()` now uses the same compiled pattern as `censor()` and stops at the first match, so it is no longer slower than `censor()` on long clean text or separator runs (4 KB clean prose: about 6x faster than 2.6.0 in paired timing). The first checks of a fresh checker still use the cheaper-to-start token path until about 256 KB of text has been checked or another operation has built the pattern, so one-off calls do not pay the one-time regex compile. Text dense with `!` or other symbol runs skips repeated hazard scans, the protected-bang analysis and normalization when no dictionary word can contain a folded bang. Results are unchanged; differential tests compare every API with the 2.6.0 engine across the default, expanded, substring, repeated-letter, `normalization` none and standard, allowed-phrase, `ignoreRanges`, evasion, fuzzy, combined and `onMaxMatches` configurations.
- Docs: new public comparison page, [docs/benchmarks.md](docs/benchmarks.md), benchmarking this package against three other Indonesian profanity filters at pinned versions (speed per operation and input size, verdict disagreements, bundle sizes, startup, a verified/documented feature matrix, and the cases where this package is slower). Maintainer tooling: the benchmark records its environment and writes a JSON summary (`--json`) and covers `via` cost, `classify()`, combined evasion and fuzzy policies, fuzzy substring mode, long unbroken runs, cold start and memory; `npm test` now checks correctness and bundle-size budgets (`benchmarks/budgets.json`); and `npm run benchmark:paired` compares two builds with alternating timing. No runtime change (the tarball's `package.json` gains the new maintainer scripts).
- Adds `evaluate(checker, cases)` and `compare(before, after)` in the optional `indonesian-badwords/evaluate` entry point (#42): score a checker on your own labelled examples (an expected flag, words, or exact spans) for case-level and word/span-level counts, precision, recall and false-positive rate with 95% Wilson intervals, failures with matched words and `via`, the top false-positive words (matches on overlapping spans count as one detection), breakdowns by `via` (and by category and severity when you pass `classify`), and a stable before/after list of fixed and broken cases. It is pure local computation with deterministic, JSON-serializable output; the root import is unchanged.
- Adds a source-aware evaluation corpus (#23): `evaluation/corpus.json` (142 constructed cases labelled flag, benign or uncertain, with spans, catalog-sense term families, a deterministic dev/holdout split with a pinned salt, variety and phenomenon labels; 103 reviewed by the maintainer, 39 #56 evidence cases still `proposed`), the [evaluation protocol](docs/evaluation-protocol.md) with acceptance thresholds for default-list and preset changes, and a reproducible baseline of the default, expanded, reviewed, evasion, fuzzy, evasion + fuzzy and substring setups on the [accuracy page](docs/accuracy.md) (`npm run evaluate:corpus`, checked in `npm test`). A single native reviewer, the maintainer, reviewed the first 103 labels; no agreement metric exists. The corpus and tooling are repository-only and not in the npm package.

## [2.6.0] - 2026-10-30

- Docs: the READMEs, `package.json` description and keywords, and a new `llms.txt` now lead with capabilities (classification, `via`, evasion, fuzzy matching, exceptions, censoring, offsets) before performance; `test:docs` checks `llms.txt` links and recipes.
- Adds `classify()` to `indonesian-badwords/metadata`: it joins variant and sense IDs, categories, severity, regions, and profiles to `find()` or `analyze()` matches and returns a summary, a deterministic 0-100 editorial register-intensity `score` (`null` when matches exist but none has a severity), and a `level`. Custom words are reported as unclassified. The root import size is unchanged.
- `find()` and `analyze().locations` return `MatchedLocation`, a `BadwordLocation` with `via` describing how the occurrence matched (`exact`, `normalized`, `leetspeak`, `evasion` with transform counts, or `fuzzy` with edit count and model). Censor contexts gain a non-enumerable `occurrences()` method for the occurrences behind a merged span. `flag`, `badwords` and string `censor` pay nothing.
- Compatibility: locations from `find()`/`analyze()` gain a `via` field, so deep-equality tests, snapshots and strict JSON schemas see a new field. Strip it with `locations.map(({ via, ...location }) => location)`. `BadwordLocation`, `CensorContext` enumerable fields and callback signatures are unchanged.
- Catalog metadata (#35): resolves severities and categories across the catalog, with values set or confirmed by the maintainer's native-speaker review (2026-10-29) for the covered terms (marked per variant in `notes`; the catalog-wide `nativeReviewed` and `humanReviewed` flags stay `false` because the review was partial) and the remaining values taken only where fetched sources allow or left `null`. Adds `identity-slur` for `homo` and `monyet` (`monyet` keeps `insult`), records keep/guard/remove recommendations and literal-use risks for default-list terms and for expanded-list terms the maintainer judged not coarse. The recommendations are metadata only: `dictionary`, `contextualDictionary` and `expandedDictionary` are unchanged, but `selectDictionary` results and `classify` results change where severity or category filters and categories apply (for example, the `minSeverity: 1` selection grows and `homo` and `monyet` now classify as `identity-slur`).

## [2.5.3] - 2026-10-29

- Combined evasion and fuzzy scans, and fuzzy substring mode, now complete within the default step budget: projections are pruned soundly, one-edit signatures are hashed in linear time, and insertion edits no longer absorb separator-delimited neighbours (`censor('x-goblok')` is now `x-***`). The default `maxSteps` stays at 10,000,000; supported input sizes per policy combination are documented in the evasion and fuzzy guides.
- Policy checks are stricter: policies carry a v2 brand and are validated at construction, so forged objects and policies created by a different installed copy of the package are rejected with `TypeError`.
- Adds this changelog, a security policy with private vulnerability reporting, grouped Dependabot updates, and a CI coverage report. TypeScript is pinned to an exact version.

## [2.5.2] - 2026-10-28

- READMEs in English and Bahasa Indonesia now show real input/output examples for capabilities such as Levenshtein and OSA matching, custom censorship, scoped exceptions, Unicode positions, and measured performance.
- Technical documentation starts at a new documentation index, with focused guides for setup, moderation, dictionaries, censorship, exceptions, evasion, fuzzy matching, integration, and troubleshooting.
- Adds runnable browser, React, Vue, and Svelte examples and a structured dictionary report form.
- The release workflow checks executable docs and all four example apps against the exact package artifact before publishing. No API, dictionary, banner, or runtime dependency changes.

## [2.5.1] - 2026-10-28

- Adds a Bahasa Indonesia README and trims the English README to library features, a quick start, and measured performance.
- Completes the constructor and method reference, adds metadata enrichment guidance, and moves the full benchmark snapshot to a performance guide.
- Corrects migration and package-validation instructions and includes both READMEs in the npm package.

## [2.5.0] - 2026-10-28

- Adds opt-in bounded fuzzy matching through `indonesian-badwords/fuzzy`, with configurable scalar edits, restricted adjacent transpositions, original source spans, and composition with bounded evasion.
- Organizes `src/` into six focused folders while preserving supported package imports and shared ESM/CommonJS identities.
- Fuzzy matching can match benign spellings, so choose its policy using your application's text.

## [2.4.0] - 2026-10-28

- Adds the optional `indonesian-badwords/evasion` import for separated letters, bounded stretching, and selected lookalike letters, with application-chosen mappings and budgets.
- Detection, analysis, and censorship share original source spans and scoped exclusions; censorship merges overlapping coverage.
- Dictionary updates compile atomically, and finite resource limits throw `EvasionLimitError` when a complete answer cannot be produced.

## [2.3.0] - 2026-10-28

- Adds the optional `indonesian-badwords/metadata` import for selecting dictionaries by lexical category, documented coarse-use region, or editorial severity.
- Adds the optional `indonesian-badwords/catalog` import with explanations, scoped source claims, and literal-use risks behind each dictionary row.
- Existing default dictionaries, matching behavior, and runtime bytes are unchanged; neither optional module is loaded by the default checker.

## [2.2.1] - 2026-10-28

- Speeds up stable Unicode inputs while preserving matching behavior and original source locations across detection, analysis, and censor callbacks.
- Expands the recurring benchmark suite to 79 workloads and refreshes README statistics.
- No API or dictionary changes.

## [2.2.0] - 2026-10-28

- Adds occurrence-scoped exceptions through `allowPhrases` and per-call `ignoreRanges`, across detection, analysis, and censorship.
- Exceptions exempt only detections fully contained in each literal phrase; other profanity in the same message still matches.
- Existing behavior is unchanged when exceptions are disabled.

## [2.1.0] - 2026-10-28

- Adds custom censorship: `censor(text, callback)` receives frozen source text, exclusive UTF-16 offsets, matched text, and contributing dictionary words.
- Adds the optional `indonesian-badwords/censor` import with grapheme-safe `mask()` and `grawlix()` strategies.
- Fixed-string censorship and dictionary behavior remain compatible.

## [2.0.2] - 2026-10-28

- Clean complex-Unicode messages avoid unnecessary grapheme and source-map allocation, with returned words, UTF-16 locations, and censorship behavior preserved.
- Cached candidate searches are invalidated with dictionary changes.
- Adds regressions for Unicode composition, custom literals, mutation, limits, and fallback guards.

## [2.0.1] - 2026-10-28

- Redesigns the README with working examples and measured performance.
- Adds 50 self-checking benchmark workloads and an optional comparison against pinned Indonesian libraries.
- Improves npm search metadata and project and support links. Matching behavior and the public API are unchanged.
