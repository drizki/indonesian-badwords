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
| clean-short (32 chars: clean ASCII) | 0.41 µs | **0.33 µs** | 289.0 µs | differs | 2.28 µs | 15.7 µs | 580.5 µs |
| clean-chat (280 chars: clean ASCII) | 2.46 µs | **2.17 µs** | 311.6 µs | differs | 15.9 µs | 15.8 µs | 366.7 µs |
| match-chat (280 chars: one plain match in the middle) | **1.46 µs** | 2.38 µs | 321.2 µs | 515.4 µs | 16.3 µs | 16.2 µs | 373.8 µs |
| leet-chat (280 chars: one leetspeak match) | **4.00 µs** | 6.95 µs | 313.3 µs | 507.9 µs | 16.2 µs | differs | 370.7 µs |
| unicode-clean-chat (280 chars: clean, accents and emoji) | **1.76 µs** | 12.6 µs | 307.0 µs | differs | 15.4 µs | 15.7 µs | 354.8 µs |
| unicode-match-chat (280 chars: one match, accents and emoji) | **2.64 µs** | 20.0 µs | 311.8 µs | 531.6 µs | 15.6 µs | 16.1 µs | 354.7 µs |
| fullwidth-chat (280 chars: one full-width match) | **6.22 µs** | 9.46 µs | differs | 531.0 µs | differs | differs | differs |
| invisible-chat (280 chars: one match split by a zero-width space) | **7.94 µs** | 21.1 µs | 302.6 µs | 514.2 µs | differs | differs | 352.7 µs |
| separator-chat (280 chars: one match spelled with hyphens) | differs | **11.1 µs** | 302.3 µs | 509.4 µs | 15.7 µs | differs | 343.9 µs |

#### Paragraph (4,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-paragraph (4,000 chars: clean ASCII) | 32.0 µs | 44.6 µs | 525.6 µs | differs | 216.4 µs | **27.6 µs** | 438.4 µs |
| unicode-clean-paragraph (4,000 chars: clean, accents and emoji) | **19.2 µs** | 183.2 µs | 511.8 µs | differs | 221.1 µs | 26.7 µs | 439.5 µs |
| match-start-paragraph (4,000 chars: one match at the start) | **3.33 µs** | 26.1 µs | 527.2 µs | 1.17 ms | 214.2 µs | 27.3 µs | 431.1 µs |
| match-middle-paragraph (4,000 chars: one match at the middle) | **17.4 µs** | 29.3 µs | 532.9 µs | 1.18 ms | 212.9 µs | 27.4 µs | 444.7 µs |
| match-end-paragraph (4,000 chars: one match at the end) | 31.5 µs | 32.2 µs | 537.3 µs | 1.55 ms | 217.1 µs | **27.4 µs** | 475.4 µs |

#### Long text (64,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long (64,000 chars: clean ASCII) | 507.3 µs | 466.9 µs | 4.08 ms | differs | 3.64 ms | **212.9 µs** | 2.10 ms |

#### Adversarial inputs

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long-token (64,000 chars: one unbroken 64,000-letter token) | **80.7 µs** | 397.5 µs | 3.98 ms | 10.13 ms | 1.36 ms | 123.3 µs | 540.5 µs |
| dense-paragraph (4,000 chars: a match every 7 characters) | **3.32 µs** | 27.9 µs | 2.19 ms | 4.51 ms | 223.3 µs | 182.9 µs | 1.05 ms |
| bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 75.6 µs | 168.7 µs | 485.1 µs | 950.2 µs | **4.98 µs** | 15.6 µs | 10.2 s † |
| separator-run-paragraph (4,000 chars: letters joined by hyphens, no match) | 41.3 µs | 43.1 µs | 477.2 µs | 955.4 µs | 70.7 µs | **15.5 µs** | 378.9 µs |

### Censor

Equivalent calls: this package `censor(text)`, `filter(text).filtered` (@sideid), `clean()` (sopan), `censorId()` (censorship-id).

#### Chat-sized (32 and 280 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-short (32 chars: clean ASCII) | **0.10 µs** | 0.35 µs | 292.0 µs | 917.6 µs | 2.26 µs | 14.4 µs | 288.4 µs |
| clean-chat (280 chars: clean ASCII) | **0.45 µs** | 2.05 µs | 301.8 µs | 1.05 ms | 15.7 µs | 15.1 µs | 295.7 µs |
| match-chat (280 chars: one plain match in the middle) | **0.46 µs** | 2.26 µs | 657.5 µs | 1.06 ms | 15.9 µs | 15.7 µs | 295.1 µs |
| leet-chat (280 chars: one leetspeak match) | **5.28 µs** | 8.25 µs | 620.1 µs | 1.08 ms | 16.0 µs | differs | 295.0 µs |
| unicode-clean-chat (280 chars: clean, accents and emoji) | **1.52 µs** | 12.2 µs | 305.4 µs | 1.02 ms | 15.6 µs | 15.1 µs | 296.7 µs |
| unicode-match-chat (280 chars: one match, accents and emoji) | **2.87 µs** | 17.1 µs | 626.1 µs | 1.11 ms | 15.6 µs | 15.8 µs | 305.1 µs |
| fullwidth-chat (280 chars: one full-width match) | **7.22 µs** | 9.87 µs | differs | differs | differs | differs | differs |
| invisible-chat (280 chars: one match split by a zero-width space) | **9.02 µs** | 21.6 µs | differs | differs | differs | differs | 292.8 µs |
| separator-chat (280 chars: one match spelled with hyphens) | differs | **12.7 µs** | differs | 1.04 ms | 15.6 µs | differs | 296.6 µs |

#### Paragraph (4,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-paragraph (4,000 chars: clean ASCII) | **4.86 µs** | 25.4 µs | 537.5 µs | 2.31 ms | 214.0 µs | 26.5 µs | 367.4 µs |
| unicode-clean-paragraph (4,000 chars: clean, accents and emoji) | **14.7 µs** | 173.6 µs | 511.3 µs | 2.48 ms | 212.6 µs | 26.4 µs | 373.7 µs |
| match-start-paragraph (4,000 chars: one match at the start) | **4.93 µs** | 30.0 µs | 1.10 ms | 2.35 ms | 216.5 µs | 27.3 µs | 370.2 µs |
| match-middle-paragraph (4,000 chars: one match at the middle) | **4.91 µs** | 29.7 µs | 1.09 ms | 2.39 ms | 213.3 µs | 27.2 µs | 377.9 µs |
| match-end-paragraph (4,000 chars: one match at the end) | **4.98 µs** | 27.9 µs | 1.12 ms | 2.34 ms | 213.8 µs | 27.1 µs | 377.6 µs |

#### Long text (64,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long (64,000 chars: clean ASCII) | **79.3 µs** | 382.7 µs | 4.00 ms | 21.02 ms | 3.83 ms | 212.8 µs | 1.51 ms |

#### Adversarial inputs

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long-token (64,000 chars: one unbroken 64,000-letter token) | **72.2 µs** | 353.7 µs | 4.00 ms | 10.05 ms | 1.40 ms | 154.5 µs | 436.3 µs |
| dense-paragraph (4,000 chars: a match every 7 characters) | **7.84 µs** | 31.4 µs | 4.78 ms | 7.90 ms | 218.3 µs | 194.0 µs | 551.4 µs |
| bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 74.9 µs | 162.1 µs | 477.9 µs | 895.8 µs | **4.88 µs** | 15.0 µs | 8.0 s † |
| separator-run-paragraph (4,000 chars: letters joined by hyphens, no match) | **4.07 µs** | 35.5 µs | 473.5 µs | 909.5 µs | 73.5 µs | 16.4 µs | 821.5 µs |

### Locate

Equivalent calls: this package `find()`, `findProfanity()` (sopan), `detect()` (censorship-id). @sideid has no locate operation: `analyze()` returns matched words without offsets (verified by running).

#### Chat-sized (32 and 280 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-short (32 chars: clean ASCII) | **0.13 µs** | 0.34 µs | n/a | n/a | 2.26 µs | 17.3 µs | 598.8 µs |
| clean-chat (280 chars: clean ASCII) | **0.62 µs** | 2.04 µs | n/a | n/a | 15.6 µs | 19.6 µs | 537.2 µs |
| match-chat (280 chars: one plain match in the middle) | **0.78 µs** | 2.60 µs | n/a | n/a | 15.7 µs | 20.0 µs | 348.8 µs |
| leet-chat (280 chars: one leetspeak match) | **5.67 µs** | 8.47 µs | n/a | n/a | 15.7 µs | differs | 354.7 µs |
| unicode-clean-chat (280 chars: clean, accents and emoji) | **1.61 µs** | 12.5 µs | n/a | n/a | 15.5 µs | 19.4 µs | 345.3 µs |
| unicode-match-chat (280 chars: one match, accents and emoji) | **2.84 µs** | 16.6 µs | n/a | n/a | 15.5 µs | 20.0 µs | 348.5 µs |
| fullwidth-chat (280 chars: one full-width match) | **7.69 µs** | 10.0 µs | n/a | n/a | differs | differs | differs |
| invisible-chat (280 chars: one match split by a zero-width space) | **9.34 µs** | 21.3 µs | n/a | n/a | differs | differs | 596.4 µs |
| separator-chat (280 chars: one match spelled with hyphens) | differs | **13.0 µs** | n/a | n/a | 15.4 µs | differs | 588.8 µs |

#### Paragraph (4,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-paragraph (4,000 chars: clean ASCII) | **7.38 µs** | 26.5 µs | n/a | n/a | 215.0 µs | 33.1 µs | 729.4 µs |
| unicode-clean-paragraph (4,000 chars: clean, accents and emoji) | **16.0 µs** | 165.4 µs | n/a | n/a | 216.9 µs | 33.6 µs | 750.9 µs |
| match-start-paragraph (4,000 chars: one match at the start) | **7.58 µs** | 31.6 µs | n/a | n/a | 223.0 µs | 34.0 µs | 728.2 µs |
| match-middle-paragraph (4,000 chars: one match at the middle) | **7.53 µs** | 30.4 µs | n/a | n/a | 220.1 µs | 34.4 µs | 730.0 µs |
| match-end-paragraph (4,000 chars: one match at the end) | **7.40 µs** | 30.0 µs | n/a | n/a | 220.7 µs | 33.9 µs | 738.1 µs |

#### Long text (64,000 characters)

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long (64,000 chars: clean ASCII) | **125.0 µs** | 414.1 µs | n/a | n/a | 3.60 ms | 248.5 µs | 3.01 ms |

#### Adversarial inputs

| Input | indonesian-badwords | indonesian-badwords + evasion | @sideid/id-profanity-filter | @sideid/id-profanity-filter + split | @fldx/sopan | censorship-id | censorship-id + smart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-long-token (64,000 chars: one unbroken 64,000-letter token) | **62.5 µs** | 354.4 µs | n/a | n/a | 1.37 ms | 146.3 µs | 865.9 µs |
| dense-paragraph (4,000 chars: a match every 7 characters) | **60.6 µs** | 89.2 µs | n/a | n/a | 224.8 µs | 210.3 µs | 601.1 µs |
| bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 70.9 µs | 163.7 µs | n/a | n/a | **4.78 µs** | 20.0 µs | 8.6 s † |
| separator-run-paragraph (4,000 chars: letters joined by hyphens, no match) | **11.5 µs** | 42.2 µs | n/a | n/a | 70.8 µs | 19.7 µs | 446.4 µs |

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
| Boolean check | clean-paragraph (4,000 chars: clean ASCII) | 32.0 µs | censorship-id 27.6 µs | 1.2x |
| Boolean check | match-end-paragraph (4,000 chars: one match at the end) | 31.5 µs | censorship-id 27.4 µs | 1.1x |
| Boolean check | clean-long (64,000 chars: clean ASCII) | 507.3 µs | censorship-id 212.9 µs | 2.4x |
| Boolean check | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 75.6 µs | @fldx/sopan 4.98 µs | 15.2x |
| Boolean check | separator-run-paragraph (4,000 chars: letters joined by hyphens, no match) | 41.3 µs | censorship-id 15.5 µs | 2.7x |
| Censor | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 74.9 µs | @fldx/sopan 4.88 µs | 15.3x |
| Locate | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 70.9 µs | @fldx/sopan 4.78 µs | 14.8x |

**Evasion policy against the other packages' opt-in modes (sopan has no separate mode)**

| Operation | Input | indonesian-badwords + evasion | Fastest other | Ratio |
| --- | --- | ---: | --- | ---: |
| Boolean check | unicode-match-chat (280 chars: one match, accents and emoji) | 20.0 µs | @fldx/sopan 15.6 µs | 1.3x |
| Boolean check | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 168.7 µs | @fldx/sopan 4.98 µs | 33.8x |
| Censor | unicode-match-chat (280 chars: one match, accents and emoji) | 17.1 µs | @fldx/sopan 15.6 µs | 1.1x |
| Censor | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 162.1 µs | @fldx/sopan 4.88 µs | 33.2x |
| Locate | unicode-match-chat (280 chars: one match, accents and emoji) | 16.6 µs | @fldx/sopan 15.5 µs | 1.1x |
| Locate | bang-dense-paragraph (4,000 chars: `!` repeated (no letters)) | 163.7 µs | @fldx/sopan 4.78 µs | 34.3x |

**Startup, memory and bundle size: where another configuration is lower**

| Measure | This package | Value | Lower in |
| --- | --- | ---: | --- |
| Load and construct | indonesian-badwords | 1.43 ms | censorship-id 1.07 ms |
| First clean boolean check | indonesian-badwords | 0.32 ms | @fldx/sopan 0.13 ms |
| Retained JS heap after load | indonesian-badwords | 0.2 MiB | censorship-id 0.1 MiB; @fldx/sopan 0.1 MiB |
| Load and construct | indonesian-badwords + evasion | 4.33 ms | censorship-id 1.07 ms; @fldx/sopan 1.52 ms; censorship-id + smart 1.75 ms; @sideid/id-profanity-filter + split 2.33 ms; @sideid/id-profanity-filter 2.48 ms |
| First clean boolean check | indonesian-badwords + evasion | 1.86 ms | @fldx/sopan 0.13 ms; censorship-id 0.62 ms |
| Retained JS heap after load | indonesian-badwords + evasion | 0.6 MiB | censorship-id 0.1 MiB; @fldx/sopan 0.1 MiB; censorship-id + smart 0.2 MiB |
| Bundle, minified | indonesian-badwords (default import) | 37,290 B | @fldx/sopan 3,553 B; censorship-id 8,641 B |
| Bundle, gzip level 9 | indonesian-badwords (default import) | 13,022 B | @fldx/sopan 1,622 B; censorship-id 2,006 B |
| Bundle, minified | indonesian-badwords + evasion + fuzzy | 66,114 B | @fldx/sopan 3,553 B; censorship-id 8,641 B; @sideid/id-profanity-filter 63,083 B |
| Bundle, gzip level 9 | indonesian-badwords + evasion + fuzzy | 22,811 B | @fldx/sopan 1,622 B; censorship-id 2,006 B; @sideid/id-profanity-filter 13,142 B |
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

Not measured yet. Precision, recall and benign false-positive rate on a shared,
source-aware labelled corpus arrive with the evaluation corpus (issue #23) and
the `evaluate` helper (issue #42). Until then this page makes no accuracy claim:
the constructed inputs above check expected behaviour, and dictionary size or
speed are not evidence of accuracy.

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
| indonesian-badwords (default import) | 37,290 B (36.4 KB) | 13,022 B (12.7 KB) |
| indonesian-badwords + evasion + fuzzy | 66,114 B (64.6 KB) | 22,811 B (22.3 KB) |
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
| indonesian-badwords | 1.43 ms | 0.32 ms | 0.2 MiB | 190 MiB |
| indonesian-badwords + evasion | 4.33 ms | 1.86 ms | 0.6 MiB | 212 MiB |
| @sideid/id-profanity-filter | 2.48 ms | 5.18 ms | 1.2 MiB | 189 MiB |
| @sideid/id-profanity-filter + split | 2.33 ms | 27.74 ms | 2.6 MiB | 212 MiB |
| @fldx/sopan | 1.52 ms | 0.13 ms | 0.1 MiB | 187 MiB |
| censorship-id | 1.07 ms | 0.62 ms | 0.1 MiB | 188 MiB |
| censorship-id + smart | 1.75 ms | 9.96 ms | 0.2 MiB | 190 MiB |
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
