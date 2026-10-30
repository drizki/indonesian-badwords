# Performance and benchmarks

[Documentation](README.md) · [Comparison with other packages](benchmarks.md)

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
Measure the imports and configuration your application actually uses. The
checked size budgets for each entrypoint are in
[`benchmarks/budgets.json`](../benchmarks/budgets.json).

## Run the benchmarks

From a repository checkout with Node.js 22 or newer:

```bash
npm ci
npm run benchmark                          # all workloads, newline-delimited JSON
npm run benchmark -- --quick               # smoke run: fewer samples, same checks
npm run benchmark -- --json summary.json   # also persist one JSON summary
npm run benchmark -- --cases=clean-280-find,classify-chat-280
```

The command builds the library and prints newline-delimited JSON for 142
self-checking workloads. Each workload runs in a fresh process, and its expected
output is asserted on every result outside the timed region. The workloads cover
match positions, Unicode, `find()` and `analyze()` (which pay for `via`
provenance), `classify()` from `indonesian-badwords/metadata` up to 100,000
locations, callbacks, masking, scoped exceptions, custom dictionaries, bounded
evasion, fuzzy matching (including substring mode), combined evasion and fuzzy
policies, and long unbroken runs of letters, separators and `!`.

The first record describes the environment: Node.js and V8 versions, OS, CPU
model, package version and commit, the effective defaults (policy and dictionary
sizes), the warmup and sampling method, and the exact input size of every
workload. Two more record types follow the workloads:

- `cold-start`: import, construction and first-call cost in several fresh
  processes per scenario (default CommonJS, default ES module, `/metadata`,
  evasion and fuzzy). Each step reports the median, minimum and maximum.
- `memory`: retained JS heap after a forced GC, compared with the same process
  before the library loaded, and whole-process peak RSS, for a default checker,
  an evasion and fuzzy checker and a 10,000-term custom dictionary. Peak RSS
  includes Node.js itself; it is not library-only memory.

Memory and cold-start figures describe the stated scope; they are not a complete
application budget. Quick runs are only a smoke check.

CI uploads a quick run's JSON summary as the `benchmark-summary` artifact on
Node.js 24 for every validation run. It is informational: shared runners are too
noisy to gate on speed.

## Budgets: correctness and size

```bash
npm run test:budgets                       # also part of npm test
node scripts/check-budgets.mjs --measure   # current sizes next to their budgets
npm run benchmark -- --verify              # assert every workload's expected output, no timing
```

[`benchmarks/budgets.json`](../benchmarks/budgets.json) holds exact expected
outputs (spans with `via`, censored text, `classify()` results, evasion, fuzzy
and combined policies, and the typed match-limit error) and a maximum minified
and gzipped size for the default import and for each optional entrypoint. The
check fails when an output differs or a size exceeds its budget, and it also runs
every benchmark workload's assertions. Speed is deliberately not a budget:
shared CI timings cannot support a hard speed gate. Raise a size budget only in
a PR that explains why the growth is worth it.

## Compare two builds

Absolute timings vary between machines and between runs on one machine. To
decide whether a change slowed something down, compare two builds on the same
machine, in the same process, with alternating batches:

```bash
npm run build
npm run benchmark:paired -- --base npm            # latest published vs working tree
npm run benchmark:paired -- --base npm:2.5.3
npm run benchmark:paired -- --base git:v2.6.0 --head git:HEAD
npm run benchmark:paired -- --base npm:2.6.0 --cases=leetspeak-paragraph-find --rounds 51
```

A spec is `npm[:version]` (installed in a temporary directory with lifecycle
scripts disabled), `git:<ref>` (built from an archive of that ref in a
temporary directory) or `dir:<path>` (an already built checkout). The head
defaults to the working tree. For each workload the tool alternates A and B
batches, flipping the order every round so drift and frequency scaling hit both
builds equally. It reports the median per-call time of each plus the median of
the per-round B/A ratios with its interquartile range, and calls a change only
when the whole interquartile range clears 5 percent. Run it on a quiet machine,
repeat a surprising result, and report the ratios (not absolute times) in the
PR. Outputs are compared ignoring `via`; a difference is flagged because it can
explain a speed change. Add `--json file` to keep the result.

## Compare with other packages

The comparison with other Indonesian profanity filters lives on one page,
[benchmarks.md](benchmarks.md): pinned versions, equivalent options, verdict
disagreements, bundle sizes and the cases where this package is slower. Its
tables are generated and checked:

```bash
npm run benchmark:compare -- --write   # full run (installs the pinned packages in a temp dir)
npm run benchmark:compare -- --check   # verify the page against benchmarks/comparison.json
```

Both benchmark commands report their runtime, workloads, warmup, sampling, and
memory scope. Dictionary and policy differences matter: a faster result with a
different verdict is not equivalent work, and timings do not rank detection
accuracy. The 80 hand-authored language regressions check expected behavior;
they do not establish real-world precision or recall.
