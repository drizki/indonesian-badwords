# Evaluation protocol

[Documentation](README.md) · [Measured accuracy](accuracy.md) · [Evaluate and tune](guides/evaluation.md)

The engineering tests prove invariants such as offsets, limits and exceptions. They do not
say how often the package is right on real language. This protocol defines a small
evaluation corpus, how it is labelled and split, and the thresholds a proposed change to the
default lists or to a named policy must meet. The thresholds were written before the corpus
was first evaluated, so they cannot be fitted to its results.

The corpus is data for maintainers and contributors. It lives in
[`evaluation/corpus.json`](../evaluation/corpus.json), is validated and re-scored by `npm test`,
and is not part of the npm package. Results are on the [accuracy page](accuracy.md).

## Reviewers and what was and was not done

- **Drafted by an AI agent.** The agent that supervises this repository's maintenance wrote every
  text and proposed the first labels.
- **Labelled by the maintainer, as a single native-speaker reviewer, on 2026-10-30.** The
  maintainer answered the labelling policy below and will confirm or correct the remaining labels.
- **Not a panel.** One reviewer labelled the corpus. No second annotator exists, so
  **no inter-annotator agreement has been measured**, and none is claimed. Agreement needs a
  second annotator labelling independently; if one is added, record who they are and report
  agreement here.
- **No external validation.** No external source was used. The corpus has not been checked
  against real traffic and is not a population estimate.
- Each case carries `labelStatus`: `proposed` (the AI-drafted label, awaiting the maintainer) or
  `reviewed` (decided by the maintainer). The accuracy page shows how many of each exist. A
  `reviewed` label is one reviewer's judgement, not ground truth.

## Intended coverage

The corpus is meant to cover, for Indonesian chat and comment text:

- coarse or abusive words, general and regional (Javanese, Sundanese, Betawi, Balinese, Batak,
  Minang, Makassar, Papuan and other varieties);
- compounds and affixed forms, abbreviations and multiword phrases;
- deliberate obfuscation (separators, stretched letters, leetspeak, lookalike characters);
- literal homonyms, names and loanwords that look like profanity (`E. coli`, `Tai Chi`, `Baju Bodo`);
- benign near-neighbours that fuzzy or substring matching can confuse (`bangsa`, `kontrol`, `petai`);
- quoted, reported and mentioned profanity, friendly exclamations and social insults;
- ordinary text.

It does not claim to cover every variety, register or platform. A variety with one or two cases
is listed so it is visible, not so it is considered covered.

## Annotation rules

**Labels.** Every case has exactly one of three labels:

| Label | Meaning |
| --- | --- |
| `flag` | The text contains a coarse or profane use, or a directed-insult use, that a general chat filter should flag. |
| `benign` | The text contains no such use, even if it contains a string that looks like a listed word. |
| `uncertain` | The reviewer judges that a general chat filter has no single right answer. Kept apart from resolved labels. |

**Maintainer policy (native-speaker review, 2026-10-30), verbatim:**

- Mentions, quoted and reported speech (phenomenon `quoted-or-reported`): label `uncertain`.
  These are excluded from precision and recall and reported separately.
- Friendly or positive exclamations (phenomenon `friendly-exclamation`): label `flag`.
- Social insults (phenomenon `social-insult`): directed insults are `flag`. The self-deprecating
  "Maaf, saya bodoh soal teknologi." is `benign`.
- All other cases: the label the AI agent proposed, marked `labelStatus: "proposed"` until the
  maintainer confirms or corrects it.

**Spans.** A `flag` case lists the UTF-16 offsets `{ index, end }` (end exclusive) of the
offending token or phrase, in order and without overlap. A span covers the whole token as
written, including an obfuscated form (`g-o-b-l-o-k`) or affix (`tololnya`), and starts and ends
on a token boundary. A multiword phrase is one span; an exclamation made of two listed words
(`Bujug buset`) lists one span per word. `benign` and `uncertain` cases have no spans. Spans are
computed from the text, then verified by the validator.

**Scoring.** `flag` cases are scored by span, `benign` cases as "must not be flagged", through
[`evaluate()`](guides/evaluation.md). `uncertain` cases are never scored: they are reported only
as the share each setup flags.

## Fields

Each case in `evaluation/corpus.json` has these keys, and no others:

| Key | Meaning |
| --- | --- |
| `id` | Stable, readable, unique (`reg-jancuk-surabaya`). Never reuse an id for different text. |
| `text` | The text. |
| `label`, `labelStatus` | As above. |
| `spans` | `{ index, end }` for `flag` cases, empty otherwise. |
| `family` | The base term the case is about. All variants and obfuscations of one term, and the benign cases built to resemble it, share a family. |
| `split` | `dev` or `holdout`, derived from `family`. |
| `variety` | Region or variety of the usage, for example `javanese`, `sundanese`, `betawi`, `balinese`, `batak`, `minang`, `makassar`, `bugis`, `papua`, `eastern-indonesia`, `malay-influenced`, `english`, `general`. |
| `phenomenon` | `direct-abuse`, `regional-abuse`, `compound`, `abbreviation`, `multiword`, `obfuscation`, `literal-homonym`, `name-or-loanword`, `near-neighbour`, `quoted-or-reported`, `friendly-exclamation`, `social-insult` or `ordinary`. |
| `ambiguity` | `none`, or a short tag for why a reader might disagree (`literal-sense-possible`, `mild-exclamation`, `self-deprecating`, `reported-speech`, ...). |
| `provenance` | `{ "kind": "constructed", "by": "ai-draft" }`, or for external text `{ "kind": "external", "source", "license", "retrieved" }`. |
| `notes` | Free text for the reviewer. |

The top-level `review` record states the reviewer roles above, and `split` records the rule and salt.
Variety labels record the usage the case illustrates, not the author's identity, and some
(`eastern-indonesia`) are coarse on purpose.

## Sources and licensing

Every text so far is **constructed**: written by the AI agent for this corpus, with no external text.
External text may be added only if its licence permits redistribution in a public repository (for
example CC BY or CC0, or a permissive licence the source states), and the case records `source`,
`license` and the retrieval date in its `provenance`. Do not add private conversations, scraped
user content, or text from a project whose licence forbids copying. Raw private submissions and
one-off audit notes stay outside the repository.

## Dev and holdout split

- The split is by **family**, never by case, so a term cannot appear in both splits through its
  spelling variants, obfuscations or benign look-alikes.
- A family is in the holdout when the first 32 bits of `SHA-256("<salt>:<family>")`, read big-endian,
  modulo 10 is below 3. About 30% of families land in the holdout. The salt is recorded in the corpus
  (`split.salt`). The validator recomputes every `split`, so it cannot be edited by hand.
- The salt was picked once, before any evaluation, from the integers 0 to 4999: the value with the
  lowest penalty for a holdout far from 30% of cases, fewer than ten holdout flag or benign cases,
  or a phenomenon missing from one split. It must not be changed afterwards: a new salt would
  reshuffle the holdout.
- Use **dev** to design and tune a change. Treat **holdout** as a test set: score it once per
  proposal, after the change is fixed. A change redesigned after looking at holdout failures has used
  up the holdout for that decision; add new families to restore an unseen test set.
- The realized counts per phenomenon and variety are generated on the [accuracy page](accuracy.md).
  Several varieties have a single family, so some are only in dev; the page shows which.

## Adding cases

1. Write the text. Keep it natural, short and unlike an existing case.
2. Choose a stable `id`, a `family` (reuse an existing one if the case is a variant or look-alike of
   it), a `variety`, a `phenomenon` and an `ambiguity`.
3. Set the label. A case you label yourself is `proposed` until the native-speaker reviewer confirms
   it. Add spans for `flag` cases (offsets of the offending token).
4. Set `split` to the value the rule gives. `splitFor(family, salt)` in
   [`scripts/corpus-eval.mjs`](../scripts/corpus-eval.mjs) computes it, and the validator fails if
   it differs.
5. Run `npm run evaluate:corpus -- --write` and commit the corpus, `evaluation/baseline.json` and
   `docs/accuracy.md` together. `npm test` fails if they disagree.

To apply the reviewer's corrections, run `node scripts/corpus-relabel.mjs id=benign id2=flag:token`
(a relabelled case becomes `reviewed` and, for `flag`, gets its spans from the token), or
`--review-all` to mark every label reviewed. Never change an existing case's text or id to alter a
result; add a new case instead.

The 80-case engineering fixture `tests/fixtures/accuracy-corpus.json` is a separate regression
fixture. It checks exact matches and censored output, was not written to be a sample, and is not part
of this corpus. It is kept unchanged.

## Acceptance thresholds for proposed changes

These apply to changes that alter what the default lists or a named policy match: the default
dictionary cleanup (#56) and named presets (#26). They were fixed on 2026-10-30 before any
proposed change was evaluated. The comparison is always `compare(before, after)` from
[`evaluate()`](guides/evaluation.md) on the same corpus, with the labels as they stand at the time.

**Why case-level rules.** With about 100 cases, the holdout has about 30 scored cases. About a dozen
benign holdout cases make one extra false positive a swing of about 9 percentage points, and the 95%
interval around any rate is far wider than the effect a cleanup has. A rule such as "the rate must
not rise significantly" can never fail at this size. So the thresholds look at individual cases,
which the corpus can resolve, and use the intervals only to qualify what may be claimed.

| # | Rule |
| --- | --- |
| T1 | **No newly flagged benign case.** `compare().broken` contains no `benign` case in the holdout, and none in any variety or phenomenon stratum, whatever its size. A newly flagged benign case in dev is allowed only if listed in the proposal with a reason. A false positive is a correctness bug. |
| T2 | **Recall drops are listed.** Every `flag` case that stops being flagged, in either split, is listed in the proposal with its reason (for example "the maintainer's review says this term is not coarse"). An unlisted drop fails. Listed drops in the holdout also need the maintainer's recorded approval. Aggregate holdout recall may not fall by more than 10 percentage points even with every drop listed (one holdout flag case is 5.6 points at today's size, so at most one drop passes without a redesign). |
| T3 | **Strata are never pooled to hide a regression.** A stratum is *qualified* when it has fewer than **10** flag cases (for recall) or fewer than **10** benign cases (for the false-positive rate). Qualified strata are reported with their case ids and counts and carry a † on the accuracy page. Passing in a qualified stratum is not evidence of improvement; failing T1 or T2 in one still fails. Unqualified strata must not get worse in point estimate, and every stratum change is reported with `n` and its Wilson interval. |
| T4 | **Improvements are claimed by case, not by rate.** A claim that a change reduces false positives cites the fixed case ids from `compare().fixed`. Rate differences smaller than the width of their intervals are not claimed as improvements. |
| T5 | **Uncertain cases are not a gate.** They are excluded from T1 to T3. The proposal reports how many `uncertain` cases each setup flags before and after, as information. |
| T6 | **Evidence quality.** Only `reviewed` labels can support a claim in a release note. A result that rests on `proposed` labels is described as provisional. |
| T7 | **Named policies.** A policy named `conservative` or `reviewed` must flag no benign holdout case that the default list does not already flag, and its documentation leads with its own false-positive rate, `n` and interval on this corpus. Policies that trade precision for recall (`expanded`, `strict`) are not held to T1 against the default, but must state their false-positive rate and recall the same way and must not describe themselves as more correct. |
| T8 | **No tuning on the holdout.** See the split rules. |

**Why 10 and 10 points.** At n = 10 the 95% interval for 0 of 10 still runs to about 28%, so 10 is the
smallest denominator at which a rate is worth printing without a warning, not a size at which it
is precise. The 10-point cap on recall allows one holdout flag case at today's size and keeps every
such drop a visible decision. Neither number is a statistical test, and they should be revisited only
when the holdout has at least 30 flag and 30 benign cases, and only before a proposal is evaluated.

## Limits

- The corpus is small, constructed and labelled by one reviewer. It can show that a change breaks or
  fixes a case; it cannot show how often the package is right on real text.
- Results depend on the exact setups in the accuracy page. A different configuration needs its own run.
- Coverage of regional varieties is thin: most varieties have a single family.
