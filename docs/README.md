# Documentation

Configure Indonesian Badwords, integrate it into your app, and look up the exact
matching and result contracts.

## Start here

1. [Get started](getting-started.md): install the package and run your first check.
2. [Moderate chat and comments](guides/chat-moderation.md): choose a dictionary,
   apply exceptions, and use the result in your application.
3. [Integrate with a browser or framework](guides/browser-and-frameworks.md):
   use the runnable browser, React, Vue, and Svelte examples.

## Configure your policy

| I want to… | Guide |
| --- | --- |
| Choose words, categories, regional usage, or editorial severity | [Dictionaries](guides/dictionaries.md) |
| Replace, partially mask, or customize matched text | [Censoring](guides/censoring.md) |
| Allow a phrase or ignore an app-identified part of a message | [Exceptions](guides/exceptions.md) |
| Catch inserted separators, repeated letters, or selected lookalikes | [Evasion](guides/evasion.md) |
| Catch typos or letter swaps, including alongside evasion | [Fuzzy matching](guides/fuzzy-matching.md) |
| Measure precision, recall and false positives on your own examples, and compare two configurations | [Evaluate and tune](guides/evaluation.md) |

## Look up behavior

- [API reference](api.md): constructor options, methods, result types, core
  errors, and occurrence limits.
- [Metadata and source reference](metadata.md): selectors, profiles, lookup
  functions, catalog records, and review limits.
- [Performance](performance.md): measured workloads, bundle scope, and commands
  for reproducing benchmarks.
- [Migration](migrating-v2.md): changes to account for when moving from v1.

## Investigate or contribute

- [Troubleshoot a result](guides/troubleshooting.md): missed words, false
  positives, censorship, highlighting, and incomplete checks.
- [Report or improve dictionary coverage](contributing.md): useful examples,
  source evidence, and the report form.
- [Develop and release the package](maintaining.md): build, test, curate data,
  validate a tarball, and publish through the release pipeline.

[Changelog](../CHANGELOG.md): release history; release PRs update it.

[English README](../README.md) · [Bahasa Indonesia README](../README.id.md)
