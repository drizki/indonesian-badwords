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
| This package | indonesian-badwords 2.7.0 (the 2.7.0 runtime, built from the repository working tree) |
| @sideid/id-profanity-filter | 1.13.0 (latest on npm on 2026-10-30) |
| @fldx/sopan | 1.0.1 (latest on npm on 2026-10-30) |
| censorship-id | 2.0.3 (latest on npm on 2026-10-30) |
| Command | `npm run benchmark:compare -- --write` |
<!-- benchmarks:end environment -->

Compared configurations (the column titles used below):

<!-- benchmarks:begin configurations -->
| Column | Package | Effective options |
| --- | --- | --- |
| indonesian-badwords | indonesian-badwords@2.7.0 | defaults (word mode, standard normalization, leetspeak folding) |
| indonesian-badwords + evasion | indonesian-badwords@2.7.0 | `boundedEvasion`: single separators `- _ . *`, up to 2 repeated letters per letter |
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
| clean-short (32 chars: clean ASCII) | **0.09 µs** | 0.37 µs | 329.2 µs | differs | 2.44 µs | 16.1 µs | 326.2 µs |
| clean-chat (280 chars: clean ASCII) | **0.44 µs** | 2.35 µs | 350.6 µs | differs | 16.9 µs | 16.9 µs | 331.4 µs |
| match-chat (280 chars: one plain match in the middle) | **0.32 µs** | 2.69 µs | 358.9 µs | 596.1 µs | 17.2 µs | 17.0 µs | 333.8 µs |
| leet-chat (280 chars: one leetspeak match) | **4.14 µs** | 7.57 µs | 646.0 µs | 641.0 µs | 17.3 µs | differs | 319.6 µs |
| unicode-clean-chat (280 chars: clean, accents and emoji) | **1.60 µs** | 13.4 µs | 584.7 µs | differs | 16.5 µs | 16.5 µs | 327.9 µs |
| unicode-match-chat (280 chars: one match, accents and emoji) | **2.52 µs** | 17.2 µs | 369.8 µs | 600.9 µs | 16.6 µs | 17.0 µs | 332.5 µs |
| fullwidth-chat (280 chars: one full-width match) | **6.32 µs** | 9.41 µs | differs | 587.0 µs | differs | differs | differs |
| invisible-chat (280 chars: one match split by a zero-width space) | **8.27 µs** | 21.8 µs | 348.9 µs | 578.9 µs | differs | differs | 324.8 µs |
| separator-chat (280 chars: one match spelled with hyphens) | differs | **10.7 µs** | 353.2 µs | 1.12 ms | 16.9 µs | differs | 323.0 µs |

#### Paragraph (4,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-paragraph (4,000 chars: clean ASCII) | **5.40 µs** | 29.5 µs | 876.1 µs | differs | 235.8 µs | 28.4 µs | 394.3 µs |
| unicode-clean-paragraph (4,000 chars: clean, accents and emoji) | **16.3 µs** | 176.4 µs | 633.8 µs | differs | 230.5 µs | 27.5 µs | 394.9 µs |
| match-start-paragraph (4,000 chars: one match at the start) | **1.74 µs** | 28.0 µs | 613.2 µs | 1.32 ms | 229.3 µs | 28.8 µs | 386.8 µs |
| match-middle-paragraph (4,000 chars: one match at the middle) | **3.53 µs** | 28.4 µs | 662.5 µs | 2.57 ms | 229.9 µs | 28.6 µs | 405.0 µs |
| match-end-paragraph (4,000 chars: one match at the end) | **5.28 µs** | 34.0 µs | 1.09 ms | 1.31 ms | 228.2 µs | 30.1 µs | 403.4 µs |

#### Long text (64,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long (64,000 chars: clean ASCII) | **86.2 µs** | 467.2 µs | 4.56 ms | differs | 4.14 ms | 230.3 µs | 1.60 ms |

#### Adversarial inputs

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long-token (64,000 chars: one unbroken 64,000-letter token) | **66.9 µs** | 391.4 µs | 5.12 ms | 10.96 ms | 1.57 ms | 133.1 µs | 467.6 µs |
| dense-paragraph (4,000 chars: a match every 7 characters) | **1.74 µs** | 28.3 µs | 4.78 ms | 4.75 ms | 230.4 µs | 203.0 µs | 564.5 µs |
| bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 7.14 µs | 25.0 µs | 566.4 µs | 990.1 µs | **5.36 µs** | 16.2 µs | 8.6 s † |
| separator-run-paragraph (4,000 chars: letters joined by hyphens, no match) | **4.24 µs** | 46.8 µs | 574.5 µs | 1.01 ms | 80.9 µs | 15.2 µs | 380.5 µs |

### Censor

Equivalent calls: this package `censor(text)`, `filter(text).filtered` (@sideid), `clean()` (sopan), `censorId()` (censorship-id).

#### Chat-sized (32 and 280 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-short (32 chars: clean ASCII) | **0.10 µs** | 0.35 µs | 340.7 µs | 994.9 µs | 2.44 µs | 15.1 µs | 326.1 µs |
| clean-chat (280 chars: clean ASCII) | **0.45 µs** | 2.12 µs | 367.7 µs | 1.20 ms | 17.4 µs | 15.4 µs | 347.8 µs |
| match-chat (280 chars: one plain match in the middle) | **0.48 µs** | 2.53 µs | 731.5 µs | 1.24 ms | 17.0 µs | 16.0 µs | 320.1 µs |
| leet-chat (280 chars: one leetspeak match) | **5.58 µs** | 8.49 µs | 736.2 µs | 1.24 ms | 16.8 µs | differs | 351.3 µs |
| unicode-clean-chat (280 chars: clean, accents and emoji) | **1.59 µs** | 13.0 µs | 641.3 µs | 1.21 ms | 16.6 µs | 16.0 µs | 335.2 µs |
| unicode-match-chat (280 chars: one match, accents and emoji) | **3.15 µs** | 17.8 µs | 728.2 µs | 1.31 ms | 16.7 µs | 15.6 µs | 341.4 µs |
| fullwidth-chat (280 chars: one full-width match) | **7.73 µs** | 10.8 µs | differs | differs | differs | differs | differs |
| invisible-chat (280 chars: one match split by a zero-width space) | **9.83 µs** | 23.1 µs | differs | differs | differs | differs | 357.1 µs |
| separator-chat (280 chars: one match spelled with hyphens) | differs | **14.8 µs** | differs | 1.17 ms | 16.9 µs | differs | 345.8 µs |

#### Paragraph (4,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-paragraph (4,000 chars: clean ASCII) | **5.37 µs** | 28.2 µs | 1.15 ms | 2.62 ms | 220.2 µs | 27.5 µs | 430.4 µs |
| unicode-clean-paragraph (4,000 chars: clean, accents and emoji) | **16.1 µs** | 177.5 µs | 582.7 µs | 2.75 ms | 225.3 µs | 27.1 µs | 428.9 µs |
| match-start-paragraph (4,000 chars: one match at the start) | **5.31 µs** | 31.3 µs | 1.24 ms | 2.61 ms | 219.0 µs | 28.5 µs | 455.5 µs |
| match-middle-paragraph (4,000 chars: one match at the middle) | **5.22 µs** | 30.4 µs | 1.54 ms | 2.67 ms | 226.4 µs | 28.8 µs | 424.7 µs |
| match-end-paragraph (4,000 chars: one match at the end) | **5.36 µs** | 30.6 µs | 1.48 ms | 2.66 ms | 222.0 µs | 28.6 µs | 748.9 µs |

#### Long text (64,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long (64,000 chars: clean ASCII) | **84.3 µs** | 428.7 µs | 4.67 ms | 23.78 ms | 4.31 ms | 221.3 µs | 1.68 ms |

#### Adversarial inputs

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long-token (64,000 chars: one unbroken 64,000-letter token) | **68.0 µs** | 389.9 µs | 4.48 ms | 9.42 ms | 1.43 ms | 143.4 µs | 436.9 µs |
| dense-paragraph (4,000 chars: a match every 7 characters) | **7.94 µs** | 34.4 µs | 5.17 ms | 9.16 ms | 226.8 µs | 191.2 µs | 622.3 µs |
| bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 7.19 µs | 50.2 µs | 539.7 µs | 961.8 µs | **5.42 µs** | 15.0 µs | 13.8 s † |
| separator-run-paragraph (4,000 chars: letters joined by hyphens, no match) | **4.29 µs** | 40.1 µs | 538.4 µs | 1.04 ms | 79.5 µs | 15.9 µs | 877.7 µs |

### Locate

Equivalent calls: this package `find()`, `findProfanity()` (sopan), `detect()` (censorship-id). @sideid has no locate operation: `analyze()` returns matched words without offsets (verified by running).

#### Chat-sized (32 and 280 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-short (32 chars: clean ASCII) | **0.12 µs** | 0.55 µs | n/a | n/a | 2.35 µs | 15.7 µs | 678.4 µs |
| clean-chat (280 chars: clean ASCII) | **0.63 µs** | 2.40 µs | n/a | n/a | 16.8 µs | 17.4 µs | 683.6 µs |
| match-chat (280 chars: one plain match in the middle) | **0.79 µs** | 3.14 µs | n/a | n/a | 17.0 µs | 17.5 µs | 644.5 µs |
| leet-chat (280 chars: one leetspeak match) | **6.00 µs** | 9.18 µs | n/a | n/a | 16.6 µs | differs | 520.2 µs |
| unicode-clean-chat (280 chars: clean, accents and emoji) | **1.77 µs** | 13.5 µs | n/a | n/a | 16.6 µs | 16.4 µs | 621.6 µs |
| unicode-match-chat (280 chars: one match, accents and emoji) | **3.08 µs** | 18.0 µs | n/a | n/a | 16.1 µs | 17.3 µs | 569.7 µs |
| fullwidth-chat (280 chars: one full-width match) | **8.24 µs** | 11.4 µs | n/a | n/a | differs | differs | differs |
| invisible-chat (280 chars: one match split by a zero-width space) | **10.1 µs** | 47.0 µs | n/a | n/a | differs | differs | 669.3 µs |
| separator-chat (280 chars: one match spelled with hyphens) | differs | 27.6 µs | n/a | n/a | **16.3 µs** | differs | 618.2 µs |

#### Paragraph (4,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-paragraph (4,000 chars: clean ASCII) | **8.05 µs** | 29.4 µs | n/a | n/a | 221.6 µs | 27.2 µs | 724.5 µs |
| unicode-clean-paragraph (4,000 chars: clean, accents and emoji) | **17.6 µs** | 182.1 µs | n/a | n/a | 222.2 µs | 27.6 µs | 741.8 µs |
| match-start-paragraph (4,000 chars: one match at the start) | **8.28 µs** | 33.5 µs | n/a | n/a | 231.8 µs | 29.5 µs | 729.4 µs |
| match-middle-paragraph (4,000 chars: one match at the middle) | **8.21 µs** | 33.9 µs | n/a | n/a | 241.0 µs | 29.3 µs | 707.7 µs |
| match-end-paragraph (4,000 chars: one match at the end) | **8.13 µs** | 33.0 µs | n/a | n/a | 232.9 µs | 29.8 µs | 800.9 µs |

#### Long text (64,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long (64,000 chars: clean ASCII) | **130.6 µs** | 989.5 µs | n/a | n/a | 4.25 ms | 214.1 µs | 3.26 ms |

#### Adversarial inputs

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long-token (64,000 chars: one unbroken 64,000-letter token) | **67.8 µs** | 415.3 µs | n/a | n/a | 1.54 ms | 139.5 µs | 941.4 µs |
| dense-paragraph (4,000 chars: a match every 7 characters) | **62.5 µs** | 102.9 µs | n/a | n/a | 226.0 µs | 190.7 µs | 1.15 ms |
| bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 6.03 µs | 24.7 µs | n/a | n/a | **5.32 µs** | 15.1 µs | 18.1 s † |
| separator-run-paragraph (4,000 chars: letters joined by hyphens, no match) | **12.3 µs** | 48.6 µs | n/a | n/a | 78.3 µs | 17.3 µs | 382.4 µs |

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
| Boolean check | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 7.14 µs | @fldx/sopan 5.36 µs | 1.3x |
| Censor | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 7.19 µs | @fldx/sopan 5.42 µs | 1.3x |
| Locate | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 6.03 µs | @fldx/sopan 5.32 µs | 1.1x |

**Evasion policy against the other packages' opt-in modes (sopan has no separate mode)**

| Operation | Input | indonesian-badwords + evasion | Fastest other | Ratio |
| --- | --- | ---: | --- | ---: |
| Boolean check | unicode-match-chat (280 chars: one match, accents and emoji) | 17.2 µs | @fldx/sopan 16.6 µs | 1.0x |
| Boolean check | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 25.0 µs | @fldx/sopan 5.36 µs | 4.7x |
| Censor | unicode-match-chat (280 chars: one match, accents and emoji) | 17.8 µs | @fldx/sopan 16.7 µs | 1.1x |
| Censor | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 50.2 µs | @fldx/sopan 5.42 µs | 9.3x |
| Locate | unicode-match-chat (280 chars: one match, accents and emoji) | 18.0 µs | @fldx/sopan 16.1 µs | 1.1x |
| Locate | separator-chat (280 chars: one match spelled with hyphens) | 27.6 µs | @fldx/sopan 16.3 µs | 1.7x |
| Locate | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 24.7 µs | @fldx/sopan 5.32 µs | 4.7x |

**Startup, memory and bundle size: where another configuration is lower**

| Measure | This package | Value | Lower in |
| --- | --- | ---: | --- |
| Load and construct | indonesian-badwords | 1.60 ms | censorship-id + smart 1.27 ms |
| First clean boolean check | indonesian-badwords | 0.36 ms | @fldx/sopan 0.15 ms |
| Retained JS heap after load | indonesian-badwords | 0.2 MiB | @fldx/sopan 0.1 MiB; censorship-id 0.1 MiB |
| Load and construct | indonesian-badwords + evasion | 4.98 ms | censorship-id + smart 1.27 ms; @fldx/sopan 1.66 ms; censorship-id 1.96 ms; @sideid/id-profanity-filter 2.69 ms |
| First clean boolean check | indonesian-badwords + evasion | 2.11 ms | @fldx/sopan 0.15 ms; censorship-id 0.88 ms |
| Retained JS heap after load | indonesian-badwords + evasion | 0.6 MiB | @fldx/sopan 0.1 MiB; censorship-id 0.1 MiB; censorship-id + smart 0.2 MiB |
| Bundle, minified | indonesian-badwords (default import) | 40,709 B | @fldx/sopan 3,553 B; censorship-id 8,641 B |
| Bundle, gzip level 9 | indonesian-badwords (default import) | 14,223 B | @fldx/sopan 1,622 B; censorship-id 2,006 B; @sideid/id-profanity-filter 13,142 B |
| Bundle, minified | indonesian-badwords + evasion + fuzzy | 72,916 B | @fldx/sopan 3,553 B; censorship-id 8,641 B; @sideid/id-profanity-filter 63,083 B |
| Bundle, gzip level 9 | indonesian-badwords + evasion + fuzzy | 24,932 B | @fldx/sopan 1,622 B; censorship-id 2,006 B; @sideid/id-profanity-filter 13,142 B |
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
| indonesian-badwords (default import) | 40,709 B (39.8 KB) | 14,223 B (13.9 KB) |
| indonesian-badwords + evasion + fuzzy | 72,916 B (71.2 KB) | 24,932 B (24.3 KB) |
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
| indonesian-badwords | 1.60 ms | 0.36 ms | 0.2 MiB | 197 MiB |
| indonesian-badwords + evasion | 4.98 ms | 2.11 ms | 0.6 MiB | 197 MiB |
| @sideid/id-profanity-filter | 2.69 ms | 5.59 ms | 1.2 MiB | 188 MiB |
| @sideid/id-profanity-filter + split | 6.69 ms | 36.86 ms | 2.6 MiB | 208 MiB |
| @fldx/sopan | 1.66 ms | 0.15 ms | 0.1 MiB | 184 MiB |
| censorship-id | 1.96 ms | 0.88 ms | 0.1 MiB | 186 MiB |
| censorship-id + smart | 1.27 ms | 7.15 ms | 0.2 MiB | 187 MiB |
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
