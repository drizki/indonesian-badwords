# Performance and benchmarks

[Documentation](README.md)

## Measured snapshot

These measurements were recorded for `indonesian-badwords@2.5.0` with the default
dictionary and matching settings on Node.js 24.22.1. The documentation and examples patches through 2.5.2
leave the runtime unchanged.

| Workload | Operation | Median per call |
| --- | --- | ---: |
| Clean ASCII chat, 280 characters | `flag` | 1.77 µs |
| Clean ASCII paragraph, 4,000 characters | `flag` | 24.45 µs |
| Clean ASCII paragraph, 4,000 characters | `censor` | 5.56 µs |
| Clean ASCII paragraph, 4,000 characters | `analyze` | 16.10 µs |
| Clean paragraph with accents and emoji, 4,000 UTF-16 units | `flag` | 21.79 µs |
| Paragraph with accents, emoji, and one literal match, 4,000 UTF-16 units | `flag` | 29.79 µs |

Each case uses synthetic inputs with a unique reference per call, warms up for at
least 250 ms, then measures 41 calibrated batches. The table reports medians of
per-call batch averages. Import, setup, input generation, and correctness checks
are excluded. Results vary with input, hardware, and runtime.

These are separate operation measurements. The methods use different paths for
their outputs, so a boolean check need not be faster than censorship on every
input. Cold startup and optional matching policies have separate costs.

## Bundle size

A browser bundle using the default checker is about 12 KB after minification and
gzip. This describes an ES2022 consumer bundle, not the npm download or the size
of every optional feature combined. The package has zero runtime dependencies.

Root imports include the default dictionary and checker. Censor strategies,
metadata, source catalogs, evasion, and fuzzy policies have separate entrypoints.
Measure the imports and configuration your application actually uses.

## Run the benchmarks

From a repository checkout with Node.js 22 or newer:

```bash
npm ci
npm run benchmark
```

The command builds the library and prints newline-delimited JSON for 104
self-checking workloads. It covers match positions, Unicode, callbacks, masking,
scoped exceptions, custom dictionaries, bounded evasion, fuzzy matching and
composition, and memory. Cold import, construction, and first-call measurements
are reported separately from warmed calls. Memory figures describe the reported
heap scope; they are not a complete application memory budget.

To compare against pinned Indonesian profanity libraries:

```bash
npm run benchmark:compare
npm run benchmark:compare -- --quick
```

The comparison downloads pinned packages into a temporary directory with
lifecycle scripts disabled, then removes them. It checks expected booleans before
timing, rotates 257 input variants, and reports different outputs separately.
Use `--quick` for a smoke check; use the full run for measurements.

Both benchmark commands report their runtime, workloads, warmup, sampling, and
memory scope. Dictionary and policy differences matter: a faster result with a
different verdict is not equivalent work, and timings do not rank detection
accuracy. The 80 hand-authored language regressions check expected behavior;
they do not establish real-world precision or recall.
