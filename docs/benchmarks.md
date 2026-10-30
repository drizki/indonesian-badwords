# Benchmarks: comparison with other Indonesian filters

[Documentation](README.md) · [Performance and benchmark tooling](performance.md)

This page compares `indonesian-badwords` with three other npm packages that
filter Indonesian profanity. Every package is named and pinned to an exact
version, every operation compared is equivalent across packages (same task, each
package's own call; they are not byte-for-byte the same work), and the script that
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
  timed. The expected verdicts in the speed tables come from constructed inputs,
  not from a corpus, and say nothing about precision or recall; those are
  reported separately in the Accuracy section, on a small corpus with stated
  limits.
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
| zlib (gzip sizes) | 1.3.2 |
| Architecture | x64 |
| This package | indonesian-badwords 2.6.0 (the 2.6.0 runtime, built from the repository working tree) |
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

Method: each package runs in its own Node.js process with a 256 MiB heap and
a minimal environment. Every case uses 257 distinct inputs of identical length:
a fixed-width identifier (`q`, two letters, `q`) at the start of the text
changes the input, never its length or match structure, so single-input caches
cannot help. The identifier is not assumed to be neutral: before timing, every
identifier used is run through every configuration on this page (all three
operations, alone and before a clean sentence) and the run fails if any
configuration flags one. One identifier (`qcdq`, which `@sideid/id-profanity-filter`
1.13.0 with `detectSplit` reads as "kondom") is excluded for that reason.
A verdict is valid only if all 257 variants agree with the expected result for
the operation; when they do not, the case is reported as a disagreement with the
variants that produced each result, and it is not timed. Then each case warms up
for 100 ms, calibrates a batch of at least 2 ms, and takes 31 batches. The
tables show the median of the per-call batch averages; the fastest correct cell
in each row is bold. Results are consumed through a cheap sink (a boolean, or the
length of the returned string or list) that is the same for every package, so
the timings do not include building a string from a result. Locate and censor
timings include whatever the call returns (offsets, `via`, or only matched words).
Gzip sizes depend on the zlib that Node.js bundles (the version is in the
Environment table); minified sizes do not.

## Speed

Lower is better. `n/a` means the package has no equivalent operation.

<!-- benchmarks:begin speed -->
### Boolean check

Equivalent calls: this package `flag()`, `isProfane()` (both censorship-id and @sideid), `containsProfanity()` (sopan).

#### Chat-sized (32 and 280 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-short (32 chars: clean ASCII) | **0.09 µs** | 0.34 µs | 325.2 µs | differs | 2.95 µs | 14.8 µs | 607.1 µs |
| clean-chat (280 chars: clean ASCII) | **0.44 µs** | 2.21 µs | 365.1 µs | differs | 22.1 µs | 15.0 µs | 621.7 µs |
| match-chat (280 chars: one plain match in the middle) | **0.34 µs** | 2.50 µs | 381.5 µs | 598.9 µs | 21.9 µs | 15.4 µs | 629.9 µs |
| leet-chat (280 chars: one leetspeak match) | **4.06 µs** | 7.42 µs | 375.3 µs | 587.9 µs | 21.9 µs | differs | 371.1 µs |
| unicode-clean-chat (280 chars: clean, accents and emoji) | **1.63 µs** | 13.5 µs | 364.7 µs | differs | 21.5 µs | 14.8 µs | 361.8 µs |
| unicode-match-chat (280 chars: one match, accents and emoji) | **2.50 µs** | 17.1 µs | 368.1 µs | 613.9 µs | 21.6 µs | 15.2 µs | 473.1 µs |
| fullwidth-chat (280 chars: one full-width match) | **6.49 µs** | 9.52 µs | differs | 585.6 µs | differs | differs | differs |
| invisible-chat (280 chars: one match split by a zero-width space) | **8.21 µs** | 21.9 µs | 380.4 µs | 599.4 µs | differs | differs | 558.3 µs |
| separator-chat (280 chars: one match spelled with hyphens) | differs | **10.8 µs** | 353.7 µs | 567.8 µs | 21.2 µs | differs | 559.5 µs |

#### Paragraph (4,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-paragraph (4,000 chars: clean ASCII) | **5.43 µs** | 28.7 µs | 601.1 µs | differs | 491.3 µs | 26.4 µs | 695.1 µs |
| unicode-clean-paragraph (4,000 chars: clean, accents and emoji) | **16.1 µs** | 175.3 µs | 583.3 µs | differs | 297.4 µs | 25.8 µs | 720.7 µs |
| match-start-paragraph (4,000 chars: one match at the start) | **1.74 µs** | 26.0 µs | 612.5 µs | 1.31 ms | 291.6 µs | 26.6 µs | 728.2 µs |
| match-middle-paragraph (4,000 chars: one match at the middle) | **3.48 µs** | 29.0 µs | 608.5 µs | 1.33 ms | 290.0 µs | 26.7 µs | 691.4 µs |
| match-end-paragraph (4,000 chars: one match at the end) | **5.22 µs** | 33.9 µs | 606.5 µs | 1.31 ms | 292.0 µs | 26.6 µs | 436.2 µs |

#### Long text (64,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long (64,000 chars: clean ASCII) | **85.9 µs** | 455.9 µs | 4.48 ms | differs | 5.34 ms | 213.1 µs | 2.69 ms |

#### Adversarial inputs

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long-token (64,000 chars: one unbroken 64,000-letter token) | **64.0 µs** | 394.4 µs | 4.46 ms | 9.74 ms | 2.47 ms | 137.9 µs | 891.0 µs |
| dense-paragraph (4,000 chars: a match every 7 characters) | **1.72 µs** | 28.3 µs | 2.42 ms | 4.18 ms | 288.2 µs | 178.1 µs | 1.06 ms |
| bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 7.16 µs | 25.2 µs | 570.2 µs | 916.5 µs | **5.44 µs** | 14.8 µs | 10.6 s † |
| separator-run-paragraph (4,000 chars: letters joined by hyphens, no match) | **4.25 µs** | 46.9 µs | 544.2 µs | 942.0 µs | 136.2 µs | 14.8 µs | 386.5 µs |

### Censor

Equivalent calls: this package `censor(text)`, `filter(text).filtered` (@sideid), `clean()` (sopan), `censorId()` (censorship-id).

#### Chat-sized (32 and 280 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-short (32 chars: clean ASCII) | **0.11 µs** | 0.37 µs | 333.4 µs | 934.7 µs | 3.20 µs | 13.6 µs | 295.2 µs |
| clean-chat (280 chars: clean ASCII) | **0.47 µs** | 2.07 µs | 360.1 µs | 1.07 ms | 19.5 µs | 14.3 µs | 296.8 µs |
| match-chat (280 chars: one plain match in the middle) | **0.49 µs** | 2.42 µs | 743.6 µs | 1.11 ms | 21.3 µs | 14.9 µs | 297.8 µs |
| leet-chat (280 chars: one leetspeak match) | **5.86 µs** | 8.49 µs | 741.7 µs | 1.09 ms | 20.8 µs | differs | 299.7 µs |
| unicode-clean-chat (280 chars: clean, accents and emoji) | **1.63 µs** | 13.0 µs | 357.1 µs | 1.08 ms | 20.6 µs | 14.2 µs | 299.6 µs |
| unicode-match-chat (280 chars: one match, accents and emoji) | **3.00 µs** | 17.8 µs | 740.0 µs | 1.14 ms | 21.0 µs | 14.9 µs | 299.4 µs |
| fullwidth-chat (280 chars: one full-width match) | **7.69 µs** | 10.6 µs | differs | differs | differs | differs | differs |
| invisible-chat (280 chars: one match split by a zero-width space) | **9.77 µs** | 23.0 µs | differs | differs | differs | differs | 296.2 µs |
| separator-chat (280 chars: one match spelled with hyphens) | differs | **14.2 µs** | differs | 1.06 ms | 18.7 µs | differs | 299.3 µs |

#### Paragraph (4,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-paragraph (4,000 chars: clean ASCII) | **5.32 µs** | 26.3 µs | 599.7 µs | 2.50 ms | 265.7 µs | 25.9 µs | 366.8 µs |
| unicode-clean-paragraph (4,000 chars: clean, accents and emoji) | **16.5 µs** | 169.9 µs | 561.5 µs | 2.51 ms | 272.9 µs | 25.5 µs | 376.3 µs |
| match-start-paragraph (4,000 chars: one match at the start) | **5.24 µs** | 29.6 µs | 1.22 ms | 2.42 ms | 286.0 µs | 26.4 µs | 372.2 µs |
| match-middle-paragraph (4,000 chars: one match at the middle) | **5.38 µs** | 29.9 µs | 1.23 ms | 2.49 ms | 268.6 µs | 26.5 µs | 364.6 µs |
| match-end-paragraph (4,000 chars: one match at the end) | **5.35 µs** | 29.4 µs | 1.24 ms | 2.77 ms | 281.1 µs | 26.6 µs | 366.6 µs |

#### Long text (64,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long (64,000 chars: clean ASCII) | **82.6 µs** | 421.4 µs | 4.41 ms | 23.23 ms | 4.28 ms | 209.4 µs | 1.49 ms |

#### Adversarial inputs

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long-token (64,000 chars: one unbroken 64,000-letter token) | **67.7 µs** | 396.7 µs | 4.49 ms | 10.99 ms | 2.21 ms | 137.0 µs | 430.9 µs |
| dense-paragraph (4,000 chars: a match every 7 characters) | **7.80 µs** | 34.4 µs | 5.03 ms | 16.86 ms | 260.3 µs | 181.3 µs | 539.9 µs |
| bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 7.17 µs | 23.4 µs | 567.6 µs | 1.05 ms | **4.95 µs** | 14.2 µs | 8.6 s † |
| separator-run-paragraph (4,000 chars: letters joined by hyphens, no match) | **4.38 µs** | 38.8 µs | 538.5 µs | 1.08 ms | 121.3 µs | 14.1 µs | 386.0 µs |

### Locate

Equivalent calls: this package `find()`, `findProfanity()` (sopan), `detect()` (censorship-id). @sideid has no locate operation: `analyze()` returns matched words without offsets (verified by running).

#### Chat-sized (32 and 280 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-short (32 chars: clean ASCII) | **0.14 µs** | 0.38 µs | n/a | n/a | 2.56 µs | 14.0 µs | 312.1 µs |
| clean-chat (280 chars: clean ASCII) | **0.64 µs** | 2.23 µs | n/a | n/a | 18.4 µs | 15.0 µs | 325.0 µs |
| match-chat (280 chars: one plain match in the middle) | **0.83 µs** | 2.85 µs | n/a | n/a | 18.6 µs | 15.4 µs | 324.2 µs |
| leet-chat (280 chars: one leetspeak match) | **6.16 µs** | 8.90 µs | n/a | n/a | 18.6 µs | differs | 325.7 µs |
| unicode-clean-chat (280 chars: clean, accents and emoji) | **1.80 µs** | 13.1 µs | n/a | n/a | 18.4 µs | 15.0 µs | 344.3 µs |
| unicode-match-chat (280 chars: one match, accents and emoji) | **3.11 µs** | 17.8 µs | n/a | n/a | 18.4 µs | 15.4 µs | 346.0 µs |
| fullwidth-chat (280 chars: one full-width match) | **8.19 µs** | 11.0 µs | n/a | n/a | differs | differs | differs |
| invisible-chat (280 chars: one match split by a zero-width space) | **10.0 µs** | 23.6 µs | n/a | n/a | differs | differs | 347.8 µs |
| separator-chat (280 chars: one match spelled with hyphens) | differs | **14.6 µs** | n/a | n/a | 18.5 µs | differs | 365.8 µs |

#### Paragraph (4,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-paragraph (4,000 chars: clean ASCII) | **7.81 µs** | 28.8 µs | n/a | n/a | 255.4 µs | 55.3 µs | 425.5 µs |
| unicode-clean-paragraph (4,000 chars: clean, accents and emoji) | **17.4 µs** | 171.4 µs | n/a | n/a | 252.6 µs | 53.1 µs | 459.8 µs |
| match-start-paragraph (4,000 chars: one match at the start) | **8.21 µs** | 32.4 µs | n/a | n/a | 257.2 µs | 55.5 µs | 487.7 µs |
| match-middle-paragraph (4,000 chars: one match at the middle) | **8.17 µs** | 32.3 µs | n/a | n/a | 256.3 µs | 55.6 µs | 430.4 µs |
| match-end-paragraph (4,000 chars: one match at the end) | **8.00 µs** | 32.8 µs | n/a | n/a | 251.7 µs | 54.9 µs | 417.2 µs |

#### Long text (64,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long (64,000 chars: clean ASCII) | **127.1 µs** | 459.9 µs | n/a | n/a | 4.25 ms | 416.2 µs | 1.69 ms |

#### Adversarial inputs

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long-token (64,000 chars: one unbroken 64,000-letter token) | **67.8 µs** | 386.5 µs | n/a | n/a | 2.17 ms | 160.0 µs | 490.5 µs |
| dense-paragraph (4,000 chars: a match every 7 characters) | **63.6 µs** | 90.4 µs | n/a | n/a | 259.1 µs | 304.1 µs | 580.8 µs |
| bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 6.05 µs | 23.7 µs | n/a | n/a | **4.96 µs** | 17.9 µs | 9.1 s † |
| separator-run-paragraph (4,000 chars: letters joined by hyphens, no match) | **12.3 µs** | 46.8 µs | n/a | n/a | 120.6 µs | 17.4 µs | 412.3 µs |

† Reduced protocol: one call took over 200 ms, so the cell is the median of three single calls on different inputs (not 31 calibrated batches), and only those three variants were checked against the expected result. Such a cell shows a package that degrades on that input, not a precise timing.

`differs`: at least one of the checked input variants returned something other than the expected result, so the cell is not timed. The variants and their results are in "Verdict disagreements".
<!-- benchmarks:end speed -->

### Where this package is slower

Generated from the same run: every measured speed cell where another package was
faster than `indonesian-badwords` under comparable options, followed by the
startup, memory and bundle-size measures where another configuration is lower
(load time, first-call time and bundle size are costs this package pays for its
dictionary and its optional features). The inputs with a large gap are the ones
to weigh when judging this package for your workload.

<!-- benchmarks:begin slower -->
**Default options against default options**

| Operation | Input | indonesian-badwords | Fastest other | Ratio |
| --- | --- | ---: | --- | ---: |
| Boolean check | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 7.16 µs | @fldx/sopan 5.44 µs | 1.3x |
| Censor | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 7.17 µs | @fldx/sopan 4.95 µs | 1.4x |
| Locate | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 6.05 µs | @fldx/sopan 4.96 µs | 1.2x |

**Evasion policy against the other packages' opt-in modes (sopan has no separate mode)**

| Operation | Input | indonesian-badwords + evasion | Fastest other | Ratio |
| --- | --- | ---: | --- | ---: |
| Boolean check | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 25.2 µs | @fldx/sopan 5.44 µs | 4.6x |
| Censor | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 23.4 µs | @fldx/sopan 4.95 µs | 4.7x |
| Locate | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 23.7 µs | @fldx/sopan 4.96 µs | 4.8x |

**Startup, memory and bundle size: where another configuration is lower**

| Measure | This package | Value | Lower in |
| --- | --- | ---: | --- |
| Load and construct | indonesian-badwords | 1.68 ms | censorship-id 0.99 ms; censorship-id + smart 1.56 ms |
| First clean boolean check | indonesian-badwords | 0.38 ms | @fldx/sopan 0.26 ms |
| Retained JS heap after load | indonesian-badwords | 0.2 MiB | censorship-id 0.1 MiB; @fldx/sopan 0.1 MiB |
| Load and construct | indonesian-badwords + evasion | 5.13 ms | censorship-id 0.99 ms; censorship-id + smart 1.56 ms; @sideid/id-profanity-filter + split 2.53 ms; @fldx/sopan 2.55 ms; @sideid/id-profanity-filter 2.59 ms |
| First clean boolean check | indonesian-badwords + evasion | 2.14 ms | @fldx/sopan 0.26 ms; censorship-id 0.61 ms |
| Retained JS heap after load | indonesian-badwords + evasion | 0.6 MiB | censorship-id 0.1 MiB; @fldx/sopan 0.1 MiB; censorship-id + smart 0.2 MiB |
| Bundle, minified | indonesian-badwords (default import) | 40,691 B | @fldx/sopan 3,553 B; censorship-id 8,641 B |
| Bundle, gzip level 9 | indonesian-badwords (default import) | 14,220 B | @fldx/sopan 1,622 B; censorship-id 2,006 B; @sideid/id-profanity-filter 13,142 B |
| Bundle, minified | indonesian-badwords + evasion + fuzzy | 72,898 B | @fldx/sopan 3,553 B; censorship-id 8,641 B; @sideid/id-profanity-filter 63,083 B |
| Bundle, gzip level 9 | indonesian-badwords + evasion + fuzzy | 24,931 B | @fldx/sopan 1,622 B; censorship-id 2,006 B; @sideid/id-profanity-filter 13,142 B |
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

Every row below holds for all the checked variants unless it says otherwise.
For example, `@sideid/id-profanity-filter` with `detectSplit: true` flags the
clean sentences used here (they begin `Pesanan sudah sampai. Terima kasih ...`)
in all 257 variants, with `analyze().matches` equal to `["asu"]` (verified by
running); the same package without the option does not. Whether that is a false
positive or an accepted trade-off of split detection is for that package's
users to judge; it is listed because it makes those cells incomparable.

<!-- benchmarks:begin disagreements -->
| Package | Operation | Input | Expected | Got |
| --- | --- | --- | --- | --- |
| indonesian-badwords | Boolean check | separator-chat | true | false (all 257 variants) |
| indonesian-badwords | Censor | separator-chat | text changed | text unchanged (all 257 variants) |
| indonesian-badwords | Locate | separator-chat | 1 occurrence | 0 occurrences (all 257 variants) |
| @sideid/id-profanity-filter | Boolean check | fullwidth-chat | true | false (all 257 variants) |
| @sideid/id-profanity-filter | Censor | fullwidth-chat | text changed | text unchanged (all 257 variants) |
| @sideid/id-profanity-filter | Censor | invisible-chat | text changed | text unchanged (all 257 variants) |
| @sideid/id-profanity-filter | Censor | separator-chat | text changed | text unchanged (all 257 variants) |
| @sideid/id-profanity-filter + split | Boolean check | clean-short | false | true (all 257 variants) |
| @sideid/id-profanity-filter + split | Boolean check | clean-chat | false | true (all 257 variants) |
| @sideid/id-profanity-filter + split | Boolean check | unicode-clean-chat | false | true (all 257 variants) |
| @sideid/id-profanity-filter + split | Boolean check | clean-paragraph | false | true (all 257 variants) |
| @sideid/id-profanity-filter + split | Boolean check | unicode-clean-paragraph | false | true (all 257 variants) |
| @sideid/id-profanity-filter + split | Boolean check | clean-long | false | true (all 257 variants) |
| @sideid/id-profanity-filter + split | Censor | fullwidth-chat | text changed | text unchanged (all 257 variants) |
| @sideid/id-profanity-filter + split | Censor | invisible-chat | text changed | text unchanged (all 257 variants) |
| @fldx/sopan | Boolean check | fullwidth-chat | true | false (all 257 variants) |
| @fldx/sopan | Boolean check | invisible-chat | true | false (all 257 variants) |
| @fldx/sopan | Censor | fullwidth-chat | text changed | text unchanged (all 257 variants) |
| @fldx/sopan | Censor | invisible-chat | text changed | text unchanged (all 257 variants) |
| @fldx/sopan | Locate | fullwidth-chat | 1 occurrence | 0 occurrences (all 257 variants) |
| @fldx/sopan | Locate | invisible-chat | 1 occurrence | 0 occurrences (all 257 variants) |
| censorship-id | Boolean check | leet-chat | true | false (all 257 variants) |
| censorship-id | Boolean check | fullwidth-chat | true | false (all 257 variants) |
| censorship-id | Boolean check | invisible-chat | true | false (all 257 variants) |
| censorship-id | Boolean check | separator-chat | true | false (all 257 variants) |
| censorship-id | Censor | leet-chat | text changed | text unchanged (all 257 variants) |
| censorship-id | Censor | fullwidth-chat | text changed | text unchanged (all 257 variants) |
| censorship-id | Censor | invisible-chat | text changed | text unchanged (all 257 variants) |
| censorship-id | Censor | separator-chat | text changed | text unchanged (all 257 variants) |
| censorship-id | Locate | leet-chat | 1 occurrence | 0 occurrences (all 257 variants) |
| censorship-id | Locate | fullwidth-chat | 1 occurrence | 0 occurrences (all 257 variants) |
| censorship-id | Locate | invisible-chat | 1 occurrence | 0 occurrences (all 257 variants) |
| censorship-id | Locate | separator-chat | 1 occurrence | 0 occurrences (all 257 variants) |
| censorship-id + smart | Boolean check | fullwidth-chat | true | false (all 257 variants) |
| censorship-id + smart | Censor | fullwidth-chat | text changed | text unchanged (all 257 variants) |
| censorship-id + smart | Locate | fullwidth-chat | 1 occurrence | 0 occurrences (all 257 variants) |
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

This section scores every compared configuration on the package's evaluation corpus. Read
the limits first; they decide how much the numbers can support.

- **A small constructed corpus, labelled by the maintainer.** The cases were drafted by an AI
  agent and labelled by the maintainer as a single native-speaker reviewer, with no second
  annotator and no agreement statistic. It is not a sample of real chat and it is not a
  population estimate. See [accuracy.md](accuracy.md) for how it was built and
  [evaluation-protocol.md](evaluation-protocol.md) for the labelling rules and the split.
- **The labels follow this package's labelling policy.** For example, quoted or reported
  profanity is labelled `uncertain` and never scored, friendly exclamations of listed words
  are labelled `flag`, and an ordinary word that is also a listed term is labelled `benign`
  when it is used literally. Another package may target a different definition of
  profanity, so a low score here can mean "a different policy", not "a worse filter".
- **Every package is scored the same way.** The corpus runs through [`evaluate()`](guides/evaluation.md)
  with a `{ find }` adapter per package (stored in `benchmarks/comparison.json`). A package
  with a locate operation is scored on its own offsets. A package without one has
  `isProfane()` decide, and a profane text becomes one whole-text location, so only the
  case-level numbers (precision, recall, benign false-positive rate) mean anything and span
  recall is `n/a`.
- **Default and opt-in modes as configured above.** The columns are the same configurations as
  the speed tables, plus this package's `tolerant` recipe from the README. Opt-in modes trade
  more recall for more false positives; compare the false-positive column too.
- **Never speed as accuracy.** Nothing in the speed tables says anything about these results,
  and nothing here says anything about speed.
- **Small strata.** A figure marked † has fewer than 10 cases behind it. Every rate shows its
  count `n` and a 95% Wilson interval, which is wide at these sizes: differences smaller than
  the intervals are not evidence that one package is better.

<!-- benchmarks:begin accuracyCorpus -->
Corpus: `evaluation/corpus.json`, SHA-256 `5e6277f580d42cab4df46f611ba9f8ba6634c038e8058763668ce0802d9ba4fc`: 142 cases, of which 137 are scored (flag or benign) and 5 are `uncertain` and never scored. Labels: The maintainer, as a single native-speaker reviewer.
<!-- benchmarks:end accuracyCorpus -->

The corpus hash is stored in `benchmarks/comparison.json`; `npm run benchmark:compare --
--check` fails if `evaluation/corpus.json` changes without a new run.

### Holdout

The holdout is 30% of the case families, chosen by a pinned, salted hash; the protocol forbids
tuning on it (rule T8), so it is the figure to read first.

<!-- benchmarks:begin accuracyHoldout -->
Scored cases: 26 flag, 15 benign.

| Configuration | Precision | Recall | Benign false-positive rate | Span recall |
| --- | --- | --- | --- | --- |
| indonesian-badwords | 86% (67%–95%) 19/22 | 73% (54%–86%) 19/26 | 20% (7%–45%) 3/15 | 74% (55%–87%) 20/27 |
| indonesian-badwords + evasion | 86% (67%–95%) 19/22 | 73% (54%–86%) 19/26 | 20% (7%–45%) 3/15 | 74% (55%–87%) 20/27 |
| indonesian-badwords + README `tolerant` | 73% (54%–86%) 19/26 | 73% (54%–86%) 19/26 | 47% (25%–70%) 7/15 | 74% (55%–87%) 20/27 |
| @sideid/id-profanity-filter | 88% (64%–97%) 14/16 | 54% (35%–71%) 14/26 | 13% (4%–38%) 2/15 | n/a |
| @sideid/id-profanity-filter + split | 81% (60%–92%) 17/21 | 65% (46%–81%) 17/26 | 27% (11%–52%) 4/15 | n/a |
| @fldx/sopan | 86% (60%–96%) 12/14 | 46% (29%–65%) 12/26 | 13% (4%–38%) 2/15 | 44% (28%–63%) 12/27 |
| censorship-id | 89% (56%–98%) 8/9 † | 31% (17%–50%) 8/26 | 7% (1%–30%) 1/15 | 30% (16%–48%) 8/27 |
| censorship-id + smart | 92% (65%–99%) 11/12 | 42% (26%–61%) 11/26 | 7% (1%–30%) 1/15 | 41% (25%–59%) 11/27 |
<!-- benchmarks:end accuracyHoldout -->

### All scored cases

Dev and holdout together. The protocol says changes to this package are designed and tuned
against the dev split, so this figure is less independent of the package than the holdout.

<!-- benchmarks:begin accuracyAll -->
Scored cases: 81 flag, 56 benign.

| Configuration | Precision | Recall | Benign false-positive rate | Span recall | Uncertain cases flagged |
| --- | --- | --- | --- | --- | --- |
| indonesian-badwords | 78% (67%–86%) 56/72 | 69% (58%–78%) 56/81 | 29% (18%–41%) 16/56 | 70% (59%–78%) 57/82 | 4 of 5 |
| indonesian-badwords + evasion | 79% (69%–87%) 60/76 | 74% (64%–82%) 60/81 | 29% (18%–41%) 16/56 | 73% (63%–82%) 60/82 | 4 of 5 |
| indonesian-badwords + README `tolerant` | 68% (58%–77%) 64/94 | 79% (69%–86%) 64/81 | 54% (41%–66%) 30/56 | 79% (69%–87%) 65/82 | 5 of 5 |
| @sideid/id-profanity-filter | 72% (58%–83%) 36/50 | 44% (34%–55%) 36/81 | 25% (16%–38%) 14/56 | n/a | 4 of 5 |
| @sideid/id-profanity-filter + split | 67% (56%–77%) 49/73 | 60% (50%–70%) 49/81 | 43% (31%–56%) 24/56 | n/a | 5 of 5 |
| @fldx/sopan | 70% (58%–80%) 44/63 | 54% (44%–65%) 44/81 | 34% (23%–47%) 19/56 | 52% (42%–63%) 43/82 | 5 of 5 |
| censorship-id | 69% (51%–83%) 20/29 | 25% (17%–35%) 20/81 | 16% (9%–28%) 9/56 | 23% (15%–33%) 19/82 | 4 of 5 |
| censorship-id + smart | 77% (62%–87%) 30/39 | 37% (27%–48%) 30/81 | 16% (9%–28%) 9/56 | 35% (26%–46%) 29/82 | 4 of 5 |
<!-- benchmarks:end accuracyAll -->

### Where another configuration does better

Compared with this package's default configuration, on the measures above. Differences inside
the intervals shown are within the noise of this small corpus.

<!-- benchmarks:begin accuracyBetter -->
| Split | Configuration | Better than this package's default on |
| --- | --- | --- |
| holdout | @sideid/id-profanity-filter | higher precision (88% against 86%); lower benign false-positive rate (13% against 20%) |
| holdout | @fldx/sopan | lower benign false-positive rate (13% against 20%) |
| holdout | censorship-id | higher precision (89% against 86%); lower benign false-positive rate (7% against 20%) |
| holdout | censorship-id + smart | higher precision (92% against 86%); lower benign false-positive rate (7% against 20%) |
| all cases | indonesian-badwords + evasion | higher recall (74% against 69%); higher precision (79% against 78%) |
| all cases | indonesian-badwords + README `tolerant` | higher recall (79% against 69%) |
| all cases | @sideid/id-profanity-filter | lower benign false-positive rate (25% against 29%) |
| all cases | censorship-id | lower benign false-positive rate (16% against 29%) |
| all cases | censorship-id + smart | lower benign false-positive rate (16% against 29%) |
<!-- benchmarks:end accuracyBetter -->

## Bundle size

Browser bundle of the default checker API with esbuild (ES2022, minified ES
module, gzip level 9). Dictionaries and APIs differ, so these sizes compare
what each package ships, not equal functionality. The second row of this
package adds the optional evasion and fuzzy entrypoints. Minified sizes do not
depend on the Node.js version, but gzip sizes do: they were produced here with
Node.js and zlib as listed in the Environment table, and the same default import
gzips to 13,099 B (rather than 13,022 B) with the zlib of Node.js 22 and 24, so
read gzip figures as accurate to about one percent.

<!-- benchmarks:begin bundles -->
| Import | Minified | Gzip level 9 (zlib 1.3.2) |
| --- | ---: | ---: |
| indonesian-badwords (default import) | 40,691 B (39.7 KB) | 14,220 B (13.9 KB) |
| indonesian-badwords + evasion + fuzzy | 72,898 B (71.2 KB) | 24,931 B (24.3 KB) |
| @sideid/id-profanity-filter | 63,083 B (61.6 KB) | 13,142 B (12.8 KB) |
| @fldx/sopan | 3,553 B (3.5 KB) | 1,622 B (1.6 KB) |
| censorship-id | 8,641 B (8.4 KB) | 2,006 B (2.0 KB) |
<!-- benchmarks:end bundles -->

## Startup and memory

Single observations in a fresh process per package, excluding Node.js startup:
loading and constructing the checker; the first clean boolean check, which is
each package's own call (`flag()`, `isProfane()` or `containsProfanity()`, see
the Speed section); the JS heap retained after a forced GC taken right after
that first call, minus the same process's heap before the package was loaded
(before any benchmark workload runs); and the whole-process peak resident
memory. The peak includes Node.js itself, the benchmark harness and all
workloads of the run; it is not the memory cost of the library alone.

<!-- benchmarks:begin startup -->
| Package | Load and construct | First clean boolean check (own call) | Retained JS heap after load | Process peak RSS |
| --- | ---: | ---: | ---: | ---: |
| indonesian-badwords | 1.68 ms | 0.38 ms | 0.2 MiB | 195 MiB |
| indonesian-badwords + evasion | 5.13 ms | 2.14 ms | 0.6 MiB | 203 MiB |
| @sideid/id-profanity-filter | 2.59 ms | 5.74 ms | 1.2 MiB | 188 MiB |
| @sideid/id-profanity-filter + split | 2.53 ms | 29.97 ms | 2.6 MiB | 209 MiB |
| @fldx/sopan | 2.55 ms | 0.26 ms | 0.1 MiB | 185 MiB |
| censorship-id | 0.99 ms | 0.61 ms | 0.1 MiB | 184 MiB |
| censorship-id + smart | 1.56 ms | 9.08 ms | 0.2 MiB | 186 MiB |
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

<!-- benchmarks:begin featureNotes -->
@sideid/id-profanity-filter has `analyzeWithContext(text, windowSize)`, but its `position` is the span of the context window, not of the match (verified by running: for `satu dua tiga anjing empat lima enam` with window 1 the match `anjing` is at 14-20 and the reported position is 9-26, the span of `tiga anjing empat`). The "Locates matches with offsets" row therefore says "no".
<!-- benchmarks:end featureNotes -->

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
