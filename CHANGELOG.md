# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/). Release PRs update this file; see
[release preparation](docs/maintaining.md#prepare-a-release-pr).

## [Unreleased]

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
