# Evaluation protocol

[Documentation](README.md) · [Measured accuracy](accuracy.md) · [Evaluate and tune](guides/evaluation.md)

The engineering tests prove invariants such as offsets, limits and exceptions. They do not
say how often the package is right on real language. This protocol defines a small
evaluation corpus, how it is labelled and split, and the thresholds a proposed change to the
default lists or to a named policy must meet. The thresholds were drafted before any proposed
change to the default lists or to a policy was evaluated against them, so they are not fitted to
such a change; the [revision history](#revision-history) and the repository history show the order.

The corpus is data for maintainers and contributors. It lives in
[`evaluation/corpus.json`](../evaluation/corpus.json), is validated and re-scored by `npm test`,
and is not part of the npm package. Results are on the [accuracy page](accuracy.md).

## Reviewers and what was and was not done

- **Drafted by an AI agent.** The agent that supervises this repository's maintenance drafted the
  initial text of every case and proposed the first labels.
- **Labelled by the maintainer, as a single native-speaker reviewer.** The maintainer reviewed the
  first 103 cases on 2026-10-30, answered the labelling policy below, and revised the text of some
  cases in that review; each revision is recorded in the case's `revisions` field. Cases added
  later start as `proposed` and become `reviewed` one id at a time, when the maintainer answers
  (see [Adding cases](#adding-cases)). The current counts are written by the generator, so this
  wording changes by itself as labels are reviewed:

<!-- generated:status:start -->

All 142 labels have been reviewed by the maintainer, a single native-speaker reviewer. 2 case texts were revised by the maintainer during review (the `revisions` field). A reviewed label is one reviewer's judgement, not ground truth.

<!-- generated:status:end -->

- **Not a panel.** One reviewer labelled the corpus. No second annotator exists, so
  **no inter-annotator agreement has been measured**, and none is claimed. Agreement needs a
  second annotator labelling independently; if one is added, record who they are and report
  agreement here.
- **No external validation.** No external source was used. The corpus has not been checked
  against real traffic and is not a population estimate.
- Each case carries `labelStatus`: `proposed` (the AI-drafted label, awaiting the maintainer) or
  `reviewed` (decided by the maintainer). The [accuracy page](accuracy.md) shows how many of each
  exist. A `reviewed` label is one reviewer's judgement, not ground truth.

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

**Maintainer policy (native-speaker review, 2026-10-30), paraphrased from the maintainer's answers:**

- Mentions, quoted and reported speech (phenomenon `quoted-or-reported`): label `uncertain`.
  These are excluded from precision and recall and reported separately. Exception: news or
  reported use of a social-category noun that attacks no one ("Berita soal pelakor ramai di media
  sosial.") is `benign`, so guards for such words can be tested.
- Directed insults that use words the 2.6.0 review marked for removal (for example "Dasar kemplu!"):
  label `flag`. Removing such a word shows up as a listed recall loss, not as a free change.
- Friendly or positive exclamations (phenomenon `friendly-exclamation`): label `flag`.
- Social insults (phenomenon `social-insult`): directed insults are `flag`. The self-deprecating
  "Maaf, saya bodoh soal teknologi." is `benign`.
- All other cases: the label the AI agent proposed, which the maintainer confirms or corrects case by case. Definitions of a
  word's literal sense ("Bangsat adalah nama lain kutu busuk.") are `benign`, not mentions.

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

Each case in `evaluation/corpus.json` has these keys (`revisions` only where it applies), and no others:

| Key | Meaning |
| --- | --- |
| `id` | Stable, readable, unique (`reg-jancuk-surabaya`). Never reuse an id for different text. |
| `text` | The text. |
| `label`, `labelStatus` | As above. |
| `spans` | `{ index, end }` for `flag` cases, empty otherwise. |
| `family` | The unit of the split; see [Families](#families). For a catalog term it is the term's `senseId` (`ibw-0001`). |
| `split` | `dev` or `holdout`, derived from `family`. |
| `variety` | Region or variety of the usage, for example `javanese`, `sundanese`, `betawi`, `balinese`, `batak`, `minang`, `makassar`, `bugis`, `papua`, `eastern-indonesia`, `malay-influenced`, `english`, `general`. |
| `phenomenon` | `direct-abuse`, `regional-abuse`, `compound`, `abbreviation`, `multiword`, `obfuscation`, `literal-homonym`, `name-or-loanword`, `near-neighbour`, `quoted-or-reported`, `friendly-exclamation`, `social-insult` or `ordinary`. |
| `ambiguity` | `none`, or a short tag for why a reader might disagree (`literal-sense-possible`, `mild-exclamation`, `self-deprecating`, `reported-speech`, ...). |
| `provenance` | `{ "kind": "constructed", "by": "ai-draft" }`, or for external text `{ "kind": "external", "source", "license", "retrieved" }`. |
| `notes` | Free text for the reviewer. |
| `revisions` | Optional. `[{ "by", "on", "what" }]` for each change made after drafting, for example `{ "by": "maintainer", "on": "2026-10-30", "what": "text" }`. |

The top-level `review` record states the reviewer roles above, and `split` records the rule and salt.
Variety labels record the usage the case illustrates, not the author's identity, and some
(`eastern-indonesia`) are coarse on purpose.

## Sources and licensing

Every text so far is **constructed**: drafted by the AI agent for this corpus (some revised by the maintainer), with no external text.
External text may be added only if its licence permits redistribution in a public repository (for
example CC BY or CC0, or a permissive licence the source states), and the case records `source`,
`license` and the retrieval date in its `provenance`. Do not add private conversations, scraped
user content, or text from a project whose licence forbids copying. Raw private submissions and
one-off audit notes stay outside the repository.

## Families

The family is the unit of the split, so every spelling of a term and every look-alike built around it
must share one.

- **A term in the catalog** (`data/catalog.json`, entries and variants) takes the `senseId` of its
  variant. `anjing`, `anjir`, `anjay`, `bejir`, `anjeng` and `araranjay` are all `ibw-0001`; `bodo` and
  `bodoh` are `ibw-0007`; `cibai` and `cibay` are `ibw-0011`; `ewe` and `ewean` are `ibw-1502`.
  Distinct senses stay distinct (`anjing` is not `asu`). A case that flags tokens of two senses
  (`Bujug buset`) takes one of them.
- **Literal homonyms and names** take the family of the catalog term they collide with (`Tai Chi` and
  `tahi lalat` are `tai`, `ibw-0036`).
- **Near-neighbours** take the family of the term that a setup actually confuses them with, checked
  against the default, expanded, fuzzy and substring recipes on the current build: `Belum tentu` is
  `kentu` (`ibw-1011`) under fuzzy matching, `Goblin` is `goblik` (`ibw-0905`), `Kanjeng` is `anjeng`
  (`ibw-0001`), `harga cabai` is `cibai` (`ibw-0011`). Where no setup confuses them, the term they were
  written to resemble (`kantor`, `kontak`, `kontrol` for `kontol`, `ibw-0027`).
- **Phrases and ordinary text that are not in the catalog** keep a short descriptive family
  (`anak-setan`, `muka-tembok`, `ordinary-rapat`).

The validator enforces what can be checked: an `ibw-` family must be a catalog `senseId`; a family may
not be a catalog surface spelled out (it must be the `senseId`); and when a flagged token is itself a
catalog surface, the family must be one of that token's senses. Which sense a near-neighbour resembles
is a judgement the validator cannot check.

## Dev and holdout split

- The split is by **family** (above), never by case, so a term cannot appear in both splits through its
  spelling variants, obfuscations or benign look-alikes. The split is a pure function of the family, so
  a family cannot be in both splits.
- A family is in the holdout when the first 32 bits of `SHA-256("<salt>:<family>")`, read big-endian,
  modulo 10 is below 3. About 30% of families land in the holdout; the share of cases varies. The salt
  is recorded in the corpus (`split.salt`). The validator recomputes every `split`, so it cannot be
  edited by hand.
- **The salt is pinned to 831** (threshold T8) and the validator fails for any other value.
  [`scripts/corpus-salt.mjs`](../scripts/corpus-salt.mjs) states the selection rule: a salt is
  *eligible* when its holdout holds at least 10 scored flag and at least 10 scored benign cases and
  every phenomenon with two or more families appears in both splits; eligible salts rank by how far
  the holdout size is from 30% of all cases, ties to the smaller salt. Salt 831 is the first under
  that rule for the corpus as first merged.
- **Salt history.** The first draft used salt 429, chosen by an earlier search whose script was not
  kept. Before the first merge, deriving families from catalog senses and adding the #56 evidence
  cases left five phenomena with no holdout case at 429, so the salt was re-picked once, on
  2026-10-30, by the rule above alone. Baseline scores at salt 429 had been seen by then; the pick
  used only the rule's split-shape criteria, never scores. From the first merged baseline the salt
  does not change, even if the corpus grows.
- Use **dev** to design and tune a change. Treat **holdout** as a test set: score it once per
  proposal, after the change is fixed. A change redesigned after looking at holdout failures has used
  up the holdout for that decision; add new families to restore an unseen test set.
- The realised counts per phenomenon and variety are generated on the [accuracy page](accuracy.md).
  Constraints that the pinned salt does not meet (a phenomenon with two or more families that is missing
  from a split) are listed under [Sizes](#sizes-generated) rather than repaired. Several varieties have
  a single family, so some are only in dev; the page shows which.

## Adding cases

1. Write the text. Keep it natural, short and unlike an existing case.
2. Choose a stable `id`, a `family` (see [Families](#families)), a `variety`, a `phenomenon` and an
   `ambiguity`.
3. Set the label. A case you label yourself is `proposed` until the native-speaker reviewer confirms
   it. Add spans for `flag` cases (offsets of the offending token).
4. Set `split` to the value the rule gives. `splitFor(family)` in
   [`scripts/corpus-eval.mjs`](../scripts/corpus-eval.mjs) computes it, and the validator fails if
   it differs.
5. Run `npm run evaluate:corpus -- --write` and commit the corpus, `evaluation/baseline.json`,
   `docs/accuracy.md` and this protocol's generated blocks together. `npm test` fails if they disagree.

To record the maintainer's answers, name each case: `node scripts/corpus-relabel.mjs id=benign id2=flag:token id3=flag id4=uncertain`.
`id=<label>` sets the label; when it equals the current label it confirms a proposed label and keeps its
spans; `id=flag:token` sets the span from the token (several tokens: `flag:one|two`). Every named case
becomes `reviewed`. There is no bulk "mark everything reviewed": review is per id, so the counts mean
something. Unknown arguments are rejected.

**Stability.** From the first merged baseline on, never change an existing case's `id` or `text` to alter
a result; add a new case instead. Until that first merge (the branch that introduces the corpus) a text or
id may still be corrected. A text change made in review is recorded in the case's `revisions`.

The 80-case engineering fixture `tests/fixtures/accuracy-corpus.json` is a separate regression
fixture. It checks exact matches and censored output, was not written to be a sample, and is not part
of this corpus. It is kept unchanged.

## Evidence for #56

[#56](https://github.com/drizki/indonesian-badwords/issues/56) applies the maintainer's keep / guard /
remove decisions to the default lists. The corpus can support a decision only for a term that has a case,
and a guard needs both a flag case and the harmless use it guards. The table is generated from the corpus
and the term lists in `scripts/evaluate-corpus.mjs` (read from #56 on 2026-10-30), so it shows which terms
still lack cases. `mukil`, an expanded-list REMOVE term, was left out of the first batch of cases on
purpose; its decision has no corpus evidence until a case is added.

<!-- generated:coverage-56:start -->

Cases whose text contains the term at a word start, from the corpus (40 of 49 terms have at least one case). Cell: flag / benign / uncertain.

| #56 decision | Terms (flag / benign / uncertain) |
| --- | --- |
| GUARD | `cibay` 1/1/0, `coli` 1/1/0, `ewe` 2/2/0, `pecun` 1/0/0, `pelakor` 1/1/0, `sontoloyo` 1/1/0, `bodoh` 1/1/1, `idiot` 1/1/0, `koplok` 1/1/0, `pepek` 1/1/0, `heunceut` 1/0/0, `balegug` 1/0/0, `bedegong` 1/0/0, `tai` 1/2/0 |
| REMOVE (default list) | `bodo` 2/3/1, `kemplu` 1/0/0, `gebleh` 1/0/0, `tolir` 1/0/0, `tiembokne` 1/0/0 |
| REMOVE (expanded list) | `cibrit` 0/1/0, `mukil` 0/0/0, `bengek` 1/1/0, `benges` 0/1/0, `buntal` 0/1/0, `cepu` 1/1/0, `cilaka` 0/1/0, `jambret` 0/1/0, `mewek` 0/1/0, `nggateli` 1/1/0 |
| KEEP | `gebleg` 1/1/0, `cibai` 1/0/0, `ewean` 1/0/0, `bispak` 1/0/0, `sinting` 1/0/0, `nyepong` 1/0/0, `sepong` 1/0/0, `bujug` 1/0/0, `buset` 1/0/0, `ngehe` 1/0/0, `araranjay` 1/0/0, `goblik` 1/0/0, `ngentu` 0/0/0, `ngentd` 0/0/0, `kontil` 0/0/0, `cukimak` 0/0/0, `wancok` 0/0/0, `dyancok` 0/0/0, `colai` 0/0/0, `colay` 0/0/0 |

- No case at all: `mukil`, `ngentu`, `ngentd`, `kontil`, `cukimak`, `wancok`, `dyancok`, `colai`, `colay`.
- GUARD terms with no benign case (the harmless use the guard is for is not yet evidenced): `pecun`, `heunceut`, `balegug`, `bedegong`.
- KEEP terms with no flag case: `ngentu`, `ngentd`, `kontil`, `cukimak`, `wancok`, `dyancok`, `colai`, `colay`.

<!-- generated:coverage-56:end -->

## Acceptance thresholds for proposed changes

These apply to changes that alter what the default lists or a named policy match: the default
dictionary cleanup (#56) and named presets (#26). The comparison is always `compare(before, after)` from
[`evaluate()`](guides/evaluation.md) on the same corpus, with the labels as they stand at the time.

**What "before" and "the default list" mean.** For a change to an existing setup, *before* is that setup
as it was at the merge base and *after* is the proposal. For a new setup such as a preset there is no
*before*; its baseline is **the default list as shipped when the proposal is evaluated**. For #56 that is
the list before #56; for a preset evaluated after #56 has merged, it is the list with #56 applied. A
proposal names the commit it used, and a preset evaluated before #56 merges is re-run after it.

### Sizes (generated)

The thresholds are written as formulas over these counts, which the generator recomputes from the corpus.

<!-- generated:sizes:start -->

Generated from the corpus (salt 831):

|  | Flag | Benign | Uncertain |
| --- | --- | --- | --- |
| Dev | 55 | 41 | 3 |
| Holdout | 26 | 15 | 2 |

- Let F = 26 (scored holdout flag cases) and B = 15 (scored holdout benign cases). One extra holdout false positive moves the holdout false-positive rate by 100/B = 6.7 points. One holdout flag case that stops being flagged moves holdout recall by 100/F = 3.8 points.
- The qualification floor is 10. At n = 10 the 95% Wilson interval for 0 of 10 still runs up to 28%.
- Every phenomenon with two or more families appears in both splits at salt 831.

<!-- generated:sizes:end -->

**Why case-level rules.** At these sizes one benign holdout case moves the holdout false-positive
rate by 100/B points and the 95% interval around any rate is far wider than the effect a cleanup has.
A rule such as "the rate must not rise significantly" can never fail at this size. So the thresholds
look at individual cases, which the corpus can resolve, and use the intervals only to qualify what may be
claimed.

| # | Rule |
| --- | --- |
| T1 | **No newly flagged benign case in the holdout.** `compare().broken` contains no `benign` holdout case, and none in any holdout variety or phenomenon stratum, whatever its size. A newly flagged benign case in *dev* is allowed only if the proposal lists it with a reason. A false positive is a correctness bug. |
| T2 | **Recall drops are listed and approved.** Every `flag` case that stops being flagged, in either split, is listed in the proposal with its reason (for example "the maintainer's review says this term is not coarse"). An unlisted drop fails. A listed drop in the holdout also needs the maintainer's recorded approval. The proposal states the resulting holdout recall as (caught − listed drops) / F. There is no numeric cap beyond list-and-approve: the approval is the visible decision. |
| T3 | **Strata are never pooled to hide a regression.** A stratum is *qualified* when it has fewer than the floor (10) flag cases (for recall) or benign cases (for the false-positive rate). Qualified strata are reported with their case ids and counts and carry a † on the accuracy page; passing in one is not evidence of improvement. Every stratum change is reported with `n` and its Wilson interval. A stratum whose point estimate gets worse passes only if every case behind the change is a T1 dev exception or a T2 listed (and, in the holdout, approved) drop; a listed, approved drop therefore never fails T3 by itself. |
| T4 | **Improvements are claimed by case, not by rate.** A claim that a change reduces false positives cites the fixed case ids from `compare().fixed`. Rate differences smaller than the width of their intervals are not claimed as improvements. |
| T5 | **Uncertain cases are not a gate.** They are excluded from T1 to T3. The proposal reports how many `uncertain` cases each setup flags before and after, as information. |
| T6 | **Evidence quality.** Only `reviewed` labels can support a claim in a release note. A result that rests on `proposed` labels is described as provisional. |
| T7 | **New named policies.** T1 to T3 do not apply to a new preset, which has no *before*; its baseline is the default list as defined above. A policy named `conservative` or `reviewed` must flag no benign holdout case that the default list does not already flag (its set of holdout false-positive ids is a subset of the default's), and its documentation leads with its own false-positive rate, `n` and interval on this corpus. Its recall is reported against the default, with the flag cases it loses listed, but is not gated. Policies that trade precision for recall (`expanded`, `strict`) are not held to the subset rule, but must state their false-positive rate and recall the same way and must not describe themselves as more correct. A change to an existing named policy is held to T1 to T3 against its previous version. |
| T8 | **No tuning on the holdout.** See the split rules. The pinned salt is enforced by the validator. |

**Why a floor of 10.** At n = 10 the 95% interval for 0 of 10 still runs to the value in the sizes table,
so 10 is the smallest denominator at which a rate is worth printing without a warning, not a size at
which it is precise. The floor is not a statistical test. Revisit it only when the holdout has at least
three times the floor in both flag and benign cases, and only before a proposal is evaluated.

### Revision history

- **2026-10-30, first draft.** T1 to T8, with an aggregate holdout-recall cap and hand-typed sizes.
- **2026-10-30, revised after a pre-merge audit and before any proposed change had been evaluated
  against the thresholds.** T1 now applies to holdout strata only, because dev false positives may be
  listed. T2 and T3 are reconciled: a listed, approved drop no longer fails T3 and the aggregate cap is
  removed, since it counted drops that were already listed and approved. T7 defines the baseline for a
  new preset, and "the default list" is defined as the list when the proposal is evaluated. Hand-typed
  sizes and rates were replaced by formulas over the generated counts. The salt pin (T8) is now enforced
  by the validator.

## Limits

- The corpus is small, constructed and labelled by one reviewer. It can show that a change breaks or
  fixes a case; it cannot show how often the package is right on real text.
- Results depend on the exact setups in the accuracy page. A different configuration needs its own run.
- Coverage of regional varieties is thin: most varieties have a single family.
