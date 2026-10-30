# Benchmarks: comparison with other Indonesian filters

[Documentation](README.md) · [Performance and benchmark tooling](performance.md)

This page compares `indonesian-badwords` with three other npm packages that
filter Indonesian profanity. Every package is named and pinned to an exact
version, every operation is identical across packages, and the script that
produced the numbers is in the repository. Results where this package loses and
inputs where outputs disagree are listed, not hidden.

The tables between `benchmarks:begin` and `benchmarks:end` markers are generated
by `scripts/benchmark-compare.mjs` from the checked-in
[`benchmarks/comparison.json`](../benchmarks/comparison.json); `npm run
benchmark:compare -- --check` fails if they are edited by hand or drift from
that file. The run was made for one release on one machine (see Environment);
it is repeated for each minor release.

## Honesty rules

- Each claim names the operation (boolean check, censor, locate) and the input
  it was measured on. Nothing here is a universal "fastest" claim.
- Speed is not accuracy. A faster package that disagrees with the expected
  verdict did different work; such cells are shown as `differs` and are not
  timed. The expected verdicts come from constructed inputs, not from a corpus,
  and say nothing about precision or recall.
- Dictionaries, matching rules and options differ between packages. Each
  package runs its default options; the columns marked `+ evasion`, `+ split`
  and `+ smart` show the nearest opt-in modes of the same package.
- Timings are medians of per-call batch averages on one machine. They are not
  request latency percentiles and do not predict your application. Rerun the
  script on your own hardware before drawing conclusions.
- Where another package is faster, this page says so (see "Where this package
  is slower").

## Environment

<!-- benchmarks:begin environment -->
| Item | Value |
| --- | --- |
| Run date | 2026-10-30 |
| CPU | AMD Ryzen 7 9700X 8-Core Processor (16 threads) |
| OS | Linux 7.2.6-arch2-1 |
| Node.js | v26.10.0 (V8 14.6.202.34-node.34) |
| Architecture | x64 |
| This package | indonesian-badwords 2.6.0, built from commit fdc0829b04f3 |
| @sideid/id-profanity-filter | 1.13.0 (latest on npm on 2026-10-30) |
| @fldx/sopan | 1.0.1 (latest on npm on 2026-10-30) |
| censorship-id | 2.0.3 (latest on npm on 2026-10-30) |
| Command | `npm run benchmark:compare -- --write` |
<!-- benchmarks:end environment -->

Compared configurations (the column titles used below):

<!-- benchmarks:begin configurations -->
| Column | Package | Effective options |
| --- | --- | --- |
| indonesian-badwords | indonesian-badwords@2.6.0 | defaults (word mode, standard normalization, leetspeak folding) |
| indonesian-badwords + evasion | indonesian-badwords@2.6.0 | `boundedEvasion`: single separators `- _ . *`, up to 2 repeated letters per letter |
| @sideid/id-profanity-filter | @sideid/id-profanity-filter@1.13.0 | defaults |
| @sideid/id-profanity-filter + split | @sideid/id-profanity-filter@1.13.0 | `detectSplit: true` |
| @fldx/sopan | @fldx/sopan@1.0.1 | defaults |
| censorship-id | censorship-id@2.0.3 | defaults |
| censorship-id + smart | censorship-id@2.0.3 | `smartMode: true` |
<!-- benchmarks:end configurations -->

Method: each package runs in its own Node.js process with a 256 MiB heap. Every
case uses 257 distinct inputs of identical length (a fixed-width neutral
identifier changes the text, never its length or match structure) so
single-input caches cannot help. Before timing, every input must produce the
expected result for the operation; otherwise the case is reported as a
disagreement and not timed. Then each case warms up for 100 ms, calibrates a
batch of at least 2 ms, and takes 31 batches. The tables show the median of the
per-call batch averages; the fastest correct cell in each row is bold.

## Speed

Lower is better. `n/a` means the package has no equivalent operation.

<!-- benchmarks:begin speed -->
### Boolean check

Equivalent calls: this package `flag()`, `isProfane()` (both censorship-id and @sideid), `containsProfanity()` (sopan).

#### Chat-sized (32 and 280 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-short (32 chars: clean ASCII) | 0.45 µs | **0.34 µs** | 306.4 µs | differs | 4.60 µs | 32.8 µs | 299.6 µs |
| clean-chat (280 chars: clean ASCII) | 2.86 µs | **2.31 µs** | 310.4 µs | differs | 33.0 µs | 33.8 µs | 304.8 µs |
| match-chat (280 chars: one plain match in the middle) | **1.64 µs** | 2.47 µs | 311.1 µs | 1.06 ms | 29.1 µs | 34.6 µs | 304.3 µs |
| leet-chat (280 chars: one leetspeak match) | **4.22 µs** | 7.07 µs | 306.3 µs | 1.06 ms | 33.4 µs | differs | 302.6 µs |
| unicode-clean-chat (280 chars: clean, accents and emoji) | **2.02 µs** | 12.6 µs | 299.5 µs | differs | 33.7 µs | 31.8 µs | 299.8 µs |
| unicode-match-chat (280 chars: one match, accents and emoji) | **3.01 µs** | 16.7 µs | 306.8 µs | 1.10 ms | 33.3 µs | 33.4 µs | 311.7 µs |
| fullwidth-chat (280 chars: one full-width match) | **6.71 µs** | 9.36 µs | differs | 638.4 µs | differs | differs | differs |
| invisible-chat (280 chars: one match split by a zero-width space) | **8.44 µs** | 21.7 µs | 302.8 µs | 622.5 µs | differs | differs | 300.5 µs |
| separator-chat (280 chars: one match spelled with hyphens) | differs | **11.4 µs** | 308.7 µs | 619.5 µs | 32.3 µs | differs | 308.9 µs |

#### Paragraph (4,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-paragraph (4,000 chars: clean ASCII) | 34.8 µs | **30.9 µs** | 535.6 µs | differs | 442.2 µs | 54.3 µs | 371.2 µs |
| unicode-clean-paragraph (4,000 chars: clean, accents and emoji) | **21.1 µs** | 174.3 µs | 529.2 µs | differs | 438.9 µs | 53.4 µs | 374.3 µs |
| match-start-paragraph (4,000 chars: one match at the start) | **3.57 µs** | 27.8 µs | 542.6 µs | 1.33 ms | 245.1 µs | 55.3 µs | 364.9 µs |
| match-middle-paragraph (4,000 chars: one match at the middle) | **19.0 µs** | 29.1 µs | 546.7 µs | 1.38 ms | 245.0 µs | 54.1 µs | 368.9 µs |
| match-end-paragraph (4,000 chars: one match at the end) | 34.4 µs | **34.2 µs** | 544.9 µs | 1.39 ms | 245.5 µs | 54.4 µs | 412.7 µs |

#### Long text (64,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long (64,000 chars: clean ASCII) | 573.2 µs | 463.1 µs | 4.14 ms | differs | 7.39 ms | **425.4 µs** | 1.59 ms |

#### Adversarial inputs

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long-token (64,000 chars: one unbroken 64,000-letter token) | **89.7 µs** | 392.6 µs | 4.13 ms | differs | 1.67 ms | 307.6 µs | 505.2 µs |
| dense-paragraph (4,000 chars: a match every 7 characters) | **3.70 µs** | 28.6 µs | 2.57 ms | 8.16 ms | 244.2 µs | 340.9 µs | 631.8 µs |
| bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 96.7 µs | 182.2 µs | 569.5 µs | differs | **5.95 µs** | 30.7 µs | 10.1 s † |
| separator-run-paragraph (4,000 chars: letters joined by hyphens, no match) | 46.4 µs | 46.1 µs | 561.3 µs | differs | 87.2 µs | **30.7 µs** | 425.5 µs |

### Censor

Equivalent calls: this package `censor(text)`, `filter(text).filtered` (@sideid), `clean()` (sopan), `censorId()` (censorship-id).

#### Chat-sized (32 and 280 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-short (32 chars: clean ASCII) | **0.13 µs** | 0.37 µs | 336.4 µs | 1.00 ms | 2.60 µs | 27.5 µs | 322.0 µs |
| clean-chat (280 chars: clean ASCII) | **0.50 µs** | 2.32 µs | 632.0 µs | 1.18 ms | 18.0 µs | 30.5 µs | 338.5 µs |
| match-chat (280 chars: one plain match in the middle) | **0.50 µs** | 2.52 µs | 722.5 µs | 1.29 ms | 18.5 µs | 30.7 µs | 319.8 µs |
| leet-chat (280 chars: one leetspeak match) | **5.83 µs** | 8.31 µs | 1.31 ms | 1.18 ms | 18.8 µs | differs | 338.7 µs |
| unicode-clean-chat (280 chars: clean, accents and emoji) | **1.64 µs** | 12.3 µs | 636.1 µs | 1.17 ms | 18.7 µs | 16.2 µs | 326.2 µs |
| unicode-match-chat (280 chars: one match, accents and emoji) | **3.14 µs** | 17.2 µs | 1.32 ms | 1.31 ms | 19.0 µs | 17.3 µs | 314.5 µs |
| fullwidth-chat (280 chars: one full-width match) | **7.74 µs** | 10.2 µs | differs | differs | differs | differs | differs |
| invisible-chat (280 chars: one match split by a zero-width space) | **9.58 µs** | 22.9 µs | differs | differs | differs | differs | 297.2 µs |
| separator-chat (280 chars: one match spelled with hyphens) | differs | **13.1 µs** | differs | 1.22 ms | 18.2 µs | differs | 289.8 µs |

#### Paragraph (4,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-paragraph (4,000 chars: clean ASCII) | **5.27 µs** | 25.4 µs | 1.11 ms | 2.67 ms | 465.3 µs | 29.4 µs | 427.1 µs |
| unicode-clean-paragraph (4,000 chars: clean, accents and emoji) | **15.8 µs** | 170.6 µs | 1.05 ms | 2.89 ms | 458.1 µs | 28.1 µs | 458.7 µs |
| match-start-paragraph (4,000 chars: one match at the start) | **5.32 µs** | 29.4 µs | 1.29 ms | 2.84 ms | 444.5 µs | 29.1 µs | 745.0 µs |
| match-middle-paragraph (4,000 chars: one match at the middle) | **5.31 µs** | 28.6 µs | 1.31 ms | 2.82 ms | 460.1 µs | 27.4 µs | 417.3 µs |
| match-end-paragraph (4,000 chars: one match at the end) | **5.09 µs** | 29.3 µs | 1.26 ms | 2.75 ms | 445.0 µs | 27.0 µs | 421.1 µs |

#### Long text (64,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long (64,000 chars: clean ASCII) | **82.6 µs** | 425.3 µs | 4.83 ms | 24.87 ms | 4.38 ms | 213.1 µs | 1.77 ms |

#### Adversarial inputs

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long-token (64,000 chars: one unbroken 64,000-letter token) | **67.7 µs** | 403.5 µs | 4.82 ms | 9.74 ms | 1.69 ms | 132.4 µs | 494.2 µs |
| dense-paragraph (4,000 chars: a match every 7 characters) | **7.96 µs** | 34.4 µs | 5.48 ms | 9.68 ms | 446.2 µs | 195.9 µs | 601.8 µs |
| bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 96.5 µs | 180.3 µs | 563.4 µs | 1.02 ms | **9.41 µs** | 14.5 µs | 14.1 s † |
| separator-run-paragraph (4,000 chars: letters joined by hyphens, no match) | **3.62 µs** | 41.3 µs | 553.3 µs | 1.06 ms | 172.7 µs | 14.5 µs | 843.8 µs |

### Locate

Equivalent calls: this package `find()`, `findProfanity()` (sopan), `detect()` (censorship-id). @sideid has no locate operation: `analyze()` returns matched words without offsets (verified by running).

#### Chat-sized (32 and 280 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-short (32 chars: clean ASCII) | **0.12 µs** | 0.41 µs | n/a | n/a | 4.38 µs | 14.5 µs | 626.3 µs |
| clean-chat (280 chars: clean ASCII) | **0.59 µs** | 2.30 µs | n/a | n/a | 31.8 µs | 15.5 µs | 649.3 µs |
| match-chat (280 chars: one plain match in the middle) | **0.91 µs** | 4.20 µs | n/a | n/a | 31.5 µs | 15.9 µs | 372.3 µs |
| leet-chat (280 chars: one leetspeak match) | **5.84 µs** | 9.60 µs | n/a | n/a | 31.2 µs | differs | 366.3 µs |
| unicode-clean-chat (280 chars: clean, accents and emoji) | **1.68 µs** | 13.4 µs | n/a | n/a | 31.6 µs | 15.6 µs | 359.5 µs |
| unicode-match-chat (280 chars: one match, accents and emoji) | **3.16 µs** | 19.3 µs | n/a | n/a | 31.4 µs | 16.0 µs | 650.1 µs |
| fullwidth-chat (280 chars: one full-width match) | **7.82 µs** | 11.8 µs | n/a | n/a | differs | differs | differs |
| invisible-chat (280 chars: one match split by a zero-width space) | **9.53 µs** | 22.3 µs | n/a | n/a | differs | differs | 643.4 µs |
| separator-chat (280 chars: one match spelled with hyphens) | differs | **14.2 µs** | n/a | n/a | 31.1 µs | differs | 624.7 µs |

#### Paragraph (4,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-paragraph (4,000 chars: clean ASCII) | **7.54 µs** | 27.8 µs | n/a | n/a | 442.7 µs | 27.4 µs | 745.8 µs |
| unicode-clean-paragraph (4,000 chars: clean, accents and emoji) | **16.1 µs** | 165.2 µs | n/a | n/a | 438.5 µs | 26.8 µs | 726.9 µs |
| match-start-paragraph (4,000 chars: one match at the start) | **7.94 µs** | 31.7 µs | n/a | n/a | 436.1 µs | 27.6 µs | 696.9 µs |
| match-middle-paragraph (4,000 chars: one match at the middle) | **8.12 µs** | 33.5 µs | n/a | n/a | 443.8 µs | 27.6 µs | 701.0 µs |
| match-end-paragraph (4,000 chars: one match at the end) | **8.41 µs** | 31.0 µs | n/a | n/a | 241.5 µs | 27.6 µs | 716.3 µs |

#### Long text (64,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long (64,000 chars: clean ASCII) | **128.0 µs** | 481.6 µs | n/a | n/a | 7.85 ms | 213.7 µs | 2.96 ms |

#### Adversarial inputs

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long-token (64,000 chars: one unbroken 64,000-letter token) | **65.1 µs** | 446.9 µs | n/a | n/a | 1.67 ms | 135.5 µs | 865.6 µs |
| dense-paragraph (4,000 chars: a match every 7 characters) | **77.0 µs** | 99.0 µs | n/a | n/a | 453.0 µs | 190.4 µs | 610.0 µs |
| bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 96.7 µs | 172.4 µs | n/a | n/a | **9.53 µs** | 15.5 µs | 10.6 s † |
| separator-run-paragraph (4,000 chars: letters joined by hyphens, no match) | **11.7 µs** | 42.2 µs | n/a | n/a | 90.5 µs | 15.5 µs | 457.5 µs |

† Reduced protocol: one call took over 200 ms, so the cell is the median of three single calls on different inputs (not 31 calibrated batches). Such a cell shows a package that degrades on that input, not a precise timing.
<!-- benchmarks:end speed -->

### Where this package is slower

Generated from the same run: every measured cell where another package was
faster than `indonesian-badwords` under comparable options. The inputs with a
large gap are the ones to weigh when judging this package for your workload.

<!-- benchmarks:begin slower -->
**Default options against default options**

| Operation | Input | indonesian-badwords | Fastest other | Ratio |
| --- | --- | ---: | --- | ---: |
| Boolean check | clean-long (64,000 chars: clean ASCII) | 573.2 µs | censorship-id 425.4 µs | 1.3x |
| Boolean check | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 96.7 µs | @fldx/sopan 5.95 µs | 16.2x |
| Boolean check | separator-run-paragraph (4,000 chars: letters joined by hyphens, no match) | 46.4 µs | censorship-id 30.7 µs | 1.5x |
| Censor | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 96.5 µs | @fldx/sopan 9.41 µs | 10.3x |
| Locate | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 96.7 µs | @fldx/sopan 9.53 µs | 10.1x |

**Evasion policy against the other packages' opt-in modes (sopan has no separate mode)**

| Operation | Input | indonesian-badwords + evasion | Fastest other | Ratio |
| --- | --- | ---: | --- | ---: |
| Boolean check | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 182.2 µs | @fldx/sopan 5.95 µs | 30.6x |
| Censor | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 180.3 µs | @fldx/sopan 9.41 µs | 19.2x |
| Locate | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 172.4 µs | @fldx/sopan 9.53 µs | 18.1x |
<!-- benchmarks:end slower -->

## Correctness

### Verdict disagreements

A disagreement means a package returned a different result from the expected
one on a constructed input: a boolean for the boolean check, a changed or
unchanged text for censor, and the number of occurrences for locate. The
expected value is the one a reader of the input would assign (a clean sentence
has no match; a planted `goblok`, `kontol` or a spelled-out variant is one
occurrence). Whether a package should detect a variant (for example, one that
requires opt-in options) is a product decision, not a defect, but it changes
what the speed numbers mean, so it is listed.

<!-- benchmarks:begin disagreements -->
| Package | Operation | Input | Expected | Got |
| --- | --- | --- | --- | --- |
| indonesian-badwords | Boolean check | separator-chat | true | false |
| indonesian-badwords | Censor | separator-chat | text changed | text unchanged |
| indonesian-badwords | Locate | separator-chat | 1 occurrence | 0 occurrences |
| @sideid/id-profanity-filter | Boolean check | fullwidth-chat | true | false |
| @sideid/id-profanity-filter | Censor | fullwidth-chat | text changed | text unchanged |
| @sideid/id-profanity-filter | Censor | invisible-chat | text changed | text unchanged |
| @sideid/id-profanity-filter | Censor | separator-chat | text changed | text unchanged |
| @sideid/id-profanity-filter + split | Boolean check | clean-short | false | true |
| @sideid/id-profanity-filter + split | Boolean check | clean-chat | false | true |
| @sideid/id-profanity-filter + split | Boolean check | unicode-clean-chat | false | true |
| @sideid/id-profanity-filter + split | Boolean check | clean-paragraph | false | true |
| @sideid/id-profanity-filter + split | Boolean check | unicode-clean-paragraph | false | true |
| @sideid/id-profanity-filter + split | Boolean check | clean-long | false | true |
| @sideid/id-profanity-filter + split | Boolean check | clean-long-token | false | true |
| @sideid/id-profanity-filter + split | Boolean check | bang-dense-paragraph | false | true |
| @sideid/id-profanity-filter + split | Boolean check | separator-run-paragraph | false | true |
| @sideid/id-profanity-filter + split | Censor | fullwidth-chat | text changed | text unchanged |
| @sideid/id-profanity-filter + split | Censor | invisible-chat | text changed | text unchanged |
| @fldx/sopan | Boolean check | fullwidth-chat | true | false |
| @fldx/sopan | Boolean check | invisible-chat | true | false |
| @fldx/sopan | Censor | fullwidth-chat | text changed | text unchanged |
| @fldx/sopan | Censor | invisible-chat | text changed | text unchanged |
| @fldx/sopan | Locate | fullwidth-chat | 1 occurrence | 0 occurrences |
| @fldx/sopan | Locate | invisible-chat | 1 occurrence | 0 occurrences |
| censorship-id | Boolean check | leet-chat | true | false |
| censorship-id | Boolean check | fullwidth-chat | true | false |
| censorship-id | Boolean check | invisible-chat | true | false |
| censorship-id | Boolean check | separator-chat | true | false |
| censorship-id | Censor | leet-chat | text changed | text unchanged |
| censorship-id | Censor | fullwidth-chat | text changed | text unchanged |
| censorship-id | Censor | invisible-chat | text changed | text unchanged |
| censorship-id | Censor | separator-chat | text changed | text unchanged |
| censorship-id | Locate | leet-chat | 1 occurrence | 0 occurrences |
| censorship-id | Locate | fullwidth-chat | 1 occurrence | 0 occurrences |
| censorship-id | Locate | invisible-chat | 1 occurrence | 0 occurrences |
| censorship-id | Locate | separator-chat | 1 occurrence | 0 occurrences |
| censorship-id + smart | Boolean check | fullwidth-chat | true | false |
| censorship-id + smart | Censor | fullwidth-chat | text changed | text unchanged |
| censorship-id + smart | Locate | fullwidth-chat | 1 occurrence | 0 occurrences |
<!-- benchmarks:end disagreements -->

### Behaviour probes

Each cell is the result of calling the installed package on one planted
sentence with its boolean check. Typo tolerance in this package is the opt-in
`/fuzzy` policy, which is not part of the speed columns above (its cost is in
the [performance notes](performance.md)).

<!-- benchmarks:begin probes -->
| Behaviour | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Plain match (`goblok`) (verified by running) | flagged | flagged | flagged | flagged | flagged | flagged | flagged |
| Leetspeak (`g0bl0k`) (verified by running) | flagged | flagged | flagged | flagged | flagged | not flagged | flagged |
| Full-width letters (`ＧＯＢＬＯＫ`) (verified by running) | flagged | flagged | not flagged | not flagged | not flagged | not flagged | not flagged |
| Zero-width space inside a word (verified by running) | flagged | flagged | flagged | flagged | not flagged | not flagged | flagged |
| Hyphen-separated letters (`k-o-n-t-o-l`) (verified by running) | not flagged | flagged | flagged | flagged | flagged | not flagged | flagged |
| Repeated letters (`gooobloook`) (verified by running) | not flagged | flagged | not flagged | not flagged | flagged | not flagged | flagged |
| One-letter typo (`goblox`) (verified by running) | not flagged | not flagged | not flagged | not flagged | not flagged | not flagged | not flagged |
| Clean sentence not flagged (control) (verified by running) | not flagged | not flagged | not flagged | flagged | not flagged | not flagged | not flagged |
<!-- benchmarks:end probes -->

## Accuracy

Not measured yet. Precision, recall and benign false-positive rate on a shared,
source-aware labelled corpus arrive with the evaluation corpus (issue #23) and
the `evaluate` helper (issue #42). Until then this page makes no accuracy claim:
the constructed inputs above check expected behaviour, and dictionary size or
speed are not evidence of accuracy.

## Bundle size

Browser bundle of the default checker API with esbuild (ES2022, minified ES
module, gzip level 9). Dictionaries and APIs differ, so these sizes compare
what each package ships, not equal functionality. The second row of this
package adds the optional evasion and fuzzy entrypoints.

<!-- benchmarks:begin bundles -->
| Import | Minified | Gzip level 9 |
| --- | ---: | ---: |
| indonesian-badwords (default import) | 37,290 B (36.4 KB) | 13,022 B (12.7 KB) |
| indonesian-badwords + evasion + fuzzy | 66,114 B (64.6 KB) | 22,811 B (22.3 KB) |
| @sideid/id-profanity-filter | 63,083 B (61.6 KB) | 13,142 B (12.8 KB) |
| @fldx/sopan | 3,553 B (3.5 KB) | 1,622 B (1.6 KB) |
| censorship-id | 8,641 B (8.4 KB) | 2,006 B (2.0 KB) |
<!-- benchmarks:end bundles -->

## Startup and memory

Single observations in a fresh process per package, excluding Node.js startup:
loading and constructing the checker, the first clean `flag()`, the JS heap
after a forced GC and the whole-process peak resident memory. The peak includes
Node.js itself, the benchmark harness and all workloads of the run; it is not
the memory cost of the library alone.

<!-- benchmarks:begin startup -->
| Package | Load and construct | First clean `flag()` | JS heap after GC | Process peak RSS |
| --- | ---: | ---: | ---: | ---: |
| indonesian-badwords | 2.42 ms | 0.49 ms | 6.2 MiB | 201 MiB |
| indonesian-badwords + evasion | 4.88 ms | 1.93 ms | 6.7 MiB | 183 MiB |
| @sideid/id-profanity-filter | 2.54 ms | 5.19 ms | 15.4 MiB | 195 MiB |
| @sideid/id-profanity-filter + split | 4.13 ms | 49.15 ms | 26.0 MiB | 214 MiB |
| @fldx/sopan | 2.81 ms | 0.25 ms | 4.1 MiB | 186 MiB |
| censorship-id | 1.94 ms | 1.06 ms | 5.4 MiB | 190 MiB |
| censorship-id + smart | 1.09 ms | 6.59 ms | 6.9 MiB | 189 MiB |
<!-- benchmarks:end startup -->

## Features

Cells marked "verified by running" are produced by the script by calling the
installed package or reading its installed manifest. Cells marked "documented"
restate the package's own README at the pinned version; "not described" means
the README does not mention the capability, not that the package lacks it.

<!-- benchmarks:begin features -->
| Capability | indonesian-badwords | @sideid/id-profanity-filter | @fldx/sopan | censorship-id |
| --- | --- | --- | --- | --- |
| Locates matches with offsets (verified by running) | yes | no | yes | yes |
| Replaces matched text (`dasar goblok kamu` censored) (verified by running) | yes: `dasar *** kamu` | yes: `dasar ****** kamu` | yes: `dasar *** kamu` | yes: `dasar ****** kamu` |
| Zero runtime dependencies (installed manifest) (verified by running) | yes | yes | yes | yes |
| Ships TypeScript declarations (installed manifest) (verified by running) | yes | yes | yes | yes |
| Severity or category in results (documented) | yes: `classify()` in `/metadata` | yes: severity score, categories | not described | yes: severity, category |
| Region labels in results (documented) | yes: region IDs in `/metadata` | yes: regions | not described | not described |
| Allow list or exceptions (documented) | yes: `allowPhrases`, `ignoreRanges` | yes: whitelist | not described | yes: `allowedWords` |
| Custom dictionary (documented) | yes: `dictionary` option | yes: `wordList` | yes: `createFilter`, `addWords` | yes: `customWords`, `addWords` |
| Why a span matched (provenance) (documented) | yes: `via` on `find()`/`analyze()` | not described | normalized token in `findProfanity()` | not described |
| Opt-in typo tolerance (documented) | yes: `/fuzzy` | yes: similarity, Levenshtein | not described | not described |
<!-- benchmarks:end features -->

## Reproduce

From a repository checkout with Node.js 22 or newer:

```bash
npm ci
npm run benchmark:compare -- --quick   # smoke run, nothing is written
npm run benchmark:compare -- --write   # full run; updates the JSON and this page's tables
npm run benchmark:compare -- --check   # verify this page against the checked JSON
```

The run installs the pinned packages into a temporary directory with lifecycle
scripts disabled, then removes it. No project dependency or lockfile changes.
Use a quiet machine and no other heavy processes. To regression-test this
package against a previous release, use the paired timing tool described in
[performance.md](performance.md#compare-two-builds) instead.
