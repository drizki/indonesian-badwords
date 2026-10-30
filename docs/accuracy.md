# Measured accuracy on the evaluation corpus

[Documentation](README.md) · [Evaluation protocol](evaluation-protocol.md) · [Evaluate and tune](guides/evaluation.md)

This page reports how each documented setup of the package behaves on a small, hand-built
evaluation corpus. Read the limits before the numbers.

## What these numbers are not

- **Not a population estimate.** The corpus is small and constructed, not sampled from real
  chat. Every text was written by an AI agent for this corpus; none is taken from an external
  source. It says how the package treats these cases, not how often it errs on real traffic.
- **One native reviewer.** The maintainer, as a single native-speaker reviewer, labelled on
  2026-10-30. That is not a panel, and no agreement between annotators was measured, because that
  needs a second annotator.
- **Labels are partly still proposed.** Cases marked `proposed` in the corpus carry the AI-drafted
  label and still await the maintainer's review, which may change some of them. Only the cases
  marked `reviewed` follow the maintainer's decisions. The counts are in the first table below.
- **Small strata.** Most strata hold only a handful of cases. A figure marked † has fewer than 10
  cases behind it (flag cases for recall, benign cases for the false-positive rate); it shows what
  happened to those cases and supports no claim. The sample size `n` is shown with every rate,
  with a 95% Wilson interval.
- **Mentions are reported apart.** Quoted, reported and mentioned profanity is labelled
  `uncertain` by the maintainer's policy. Those cases are never counted in precision or recall;
  the table below only shows how many each setup flags.
- **A false positive is a bug; a high recall here is not a goal by itself.** Several setups below
  flag many benign cases. They are opt-in on purpose.

How the corpus was built, labelled and split, and the thresholds proposed changes must meet, are
in the [evaluation protocol](evaluation-protocol.md). The data is
[`evaluation/corpus.json`](../evaluation/corpus.json) and the full computed results are
[`evaluation/baseline.json`](../evaluation/baseline.json). Neither file is in the npm package.

## Reading the tables

- **Precision** is the share of flagged cases that should have been flagged; **recall** is the
  share of should-flag cases that were flagged; the **benign false-positive rate** is the share of
  benign cases that were flagged. All are case level and come from
  [`evaluate()`](guides/evaluation.md). **Span recall** counts the exact offending spans.
- The **holdout** is 30% of the cases, chosen by term family so that no family appears in both
  splits. The **dev** split is what you tune against; look at holdout results once per proposal.
- Each setup is copied from the documentation named in the Recipes table.

## Results

<!-- accuracy:generated:start -->

### Corpus

|  | Cases |
| --- | --- |
| All | 103 |
| Flag / benign / uncertain | 54 / 44 / 5 |
| Dev / holdout | 72 / 31 |
| Labels still proposed / reviewed | 85 / 18 |

### Cases by phenomenon and split

Each cell: flag / benign / uncertain.

| Phenomenon | Dev | Holdout |
| --- | --- | --- |
| abbreviation | 1 / 0 / 0 | 1 / 0 / 0 |
| compound | 2 / 0 / 0 | 1 / 0 / 0 |
| direct-abuse | 5 / 0 / 0 | 2 / 0 / 0 |
| friendly-exclamation | 6 / 0 / 0 | 1 / 0 / 0 |
| literal-homonym | 0 / 14 / 0 | 0 / 4 / 0 |
| multiword | 1 / 0 / 0 | 1 / 0 / 0 |
| name-or-loanword | 0 / 5 / 0 | 0 / 1 / 0 |
| near-neighbour | 0 / 9 / 0 | 0 / 5 / 0 |
| obfuscation | 7 / 0 / 0 | 4 / 0 / 0 |
| ordinary | 0 / 4 / 0 | 0 / 1 / 0 |
| quoted-or-reported | 0 / 0 / 3 | 0 / 0 / 2 |
| regional-abuse | 11 / 0 / 0 | 6 / 0 / 0 |
| social-insult | 3 / 1 / 0 | 2 / 0 / 0 |

### Cases by variety and split

Each cell: flag / benign / uncertain.

| Variety | Dev | Holdout |
| --- | --- | --- |
| balinese | 1 / 0 / 0 | 0 / 0 / 0 |
| batak | 1 / 0 / 0 | 0 / 0 / 0 |
| betawi | 1 / 0 / 0 | 0 / 0 / 0 |
| bugis | 0 / 1 / 0 | 0 / 0 / 0 |
| eastern-indonesia | 0 / 0 / 0 | 1 / 0 / 0 |
| english | 0 / 0 / 0 | 0 / 1 / 0 |
| general | 22 / 26 / 2 | 12 / 9 / 2 |
| javanese | 7 / 4 / 1 | 2 / 1 / 0 |
| makassar | 0 / 0 / 0 | 1 / 0 / 0 |
| minang | 1 / 0 / 0 | 0 / 0 / 0 |
| papua | 0 / 0 / 0 | 1 / 0 / 0 |
| sundanese | 3 / 2 / 0 | 1 / 0 / 0 |

### Recipes

| Recipe | Id | Taken from |
| --- | --- | --- |
| Default | `default` | docs/guides/dictionaries.md, "Default or expanded" |
| Expanded | `expanded` | docs/guides/dictionaries.md, "Default or expanded" |
| Reviewed core | `reviewed` | docs/metadata.md, "Selection rules" (`reviewedDictionary`, the default selection) |
| Reviewed + contextual | `reviewed-expanded` | docs/metadata.md, "Selection rules" (`reviewedExpandedDictionary`) |
| Default + evasion | `evasion` | docs/guides/evasion.md, first recipe |
| Default + fuzzy | `fuzzy` | docs/guides/fuzzy-matching.md and docs/guides/evaluation.md (`boundedFuzzy({ model: 'osa', maxEdits: 1 })`) |
| Expanded, substring mode | `substring` | docs/api.md, "Substring mode" |

### Results: holdout (18 flag, 11 benign)

| Recipe | Precision | Recall | Span recall | Benign false-positive rate |
| --- | --- | --- | --- | --- |
| Default | 69% (42%–87%) 9/13 | 50% (29%–71%) 9/18 | 50% (29%–71%) 9/18 | 36% (15%–65%) 4/11 |
| Expanded | 72% (49%–88%) 13/18 | 72% (49%–88%) 13/18 | 72% (49%–88%) 13/18 | 45% (21%–72%) 5/11 |
| Reviewed core | 88% (53%–98%) 7/8 | 39% (20%–61%) 7/18 | 39% (20%–61%) 7/18 | 9% (2%–38%) 1/11 |
| Reviewed + contextual | 72% (49%–88%) 13/18 | 72% (49%–88%) 13/18 | 72% (49%–88%) 13/18 | 45% (21%–72%) 5/11 |
| Default + evasion | 71% (45%–88%) 10/14 | 56% (34%–75%) 10/18 | 50% (29%–71%) 9/18 | 36% (15%–65%) 4/11 |
| Default + fuzzy | 52% (32%–72%) 11/21 | 61% (39%–80%) 11/18 | 61% (39%–80%) 11/18 | 91% (62%–98%) 10/11 |
| Expanded, substring mode | 71% (50%–86%) 15/21 | 83% (61%–94%) 15/18 | 72% (49%–88%) 13/18 | 55% (28%–79%) 6/11 |

### Results: dev (36 flag, 33 benign)

| Recipe | Precision | Recall | Span recall | Benign false-positive rate |
| --- | --- | --- | --- | --- |
| Default | 72% (55%–84%) 23/32 | 64% (48%–78%) 23/36 | 65% (49%–78%) 24/37 | 27% (15%–44%) 9/33 |
| Expanded | 59% (45%–72%) 29/49 | 81% (65%–90%) 29/36 | 81% (66%–91%) 30/37 | 61% (44%–75%) 20/33 |
| Reviewed core | 90% (71%–97%) 19/21 | 53% (37%–68%) 19/36 | 51% (36%–67%) 19/37 | 6% (2%–20%) 2/33 |
| Reviewed + contextual | 65% (50%–78%) 28/43 | 78% (62%–88%) 28/36 | 78% (63%–89%) 29/37 | 45% (30%–62%) 15/33 |
| Default + evasion | 75% (59%–86%) 27/36 | 75% (59%–86%) 27/36 | 76% (60%–87%) 28/37 | 27% (15%–44%) 9/33 |
| Default + fuzzy | 62% (46%–75%) 24/39 | 67% (50%–80%) 24/36 | 68% (51%–80%) 25/37 | 45% (30%–62%) 15/33 |
| Expanded, substring mode | 59% (45%–71%) 30/51 | 83% (68%–92%) 30/36 | 81% (66%–91%) 30/37 | 64% (47%–78%) 21/33 |

### Results: all (54 flag, 44 benign)

| Recipe | Precision | Recall | Span recall | Benign false-positive rate |
| --- | --- | --- | --- | --- |
| Default | 71% (57%–82%) 32/45 | 59% (46%–71%) 32/54 | 60% (47%–72%) 33/55 | 30% (18%–44%) 13/44 |
| Expanded | 63% (51%–73%) 42/67 | 78% (65%–87%) 42/54 | 78% (66%–87%) 43/55 | 57% (42%–70%) 25/44 |
| Reviewed core | 90% (74%–96%) 26/29 | 48% (35%–61%) 26/54 | 47% (35%–60%) 26/55 | 7% (2%–18%) 3/44 |
| Reviewed + contextual | 67% (55%–78%) 41/61 | 76% (63%–85%) 41/54 | 76% (64%–86%) 42/55 | 45% (32%–60%) 20/44 |
| Default + evasion | 74% (60%–84%) 37/50 | 69% (55%–79%) 37/54 | 67% (54%–78%) 37/55 | 30% (18%–44%) 13/44 |
| Default + fuzzy | 58% (46%–70%) 35/60 | 65% (51%–76%) 35/54 | 65% (52%–77%) 36/55 | 57% (42%–70%) 25/44 |
| Expanded, substring mode | 63% (51%–73%) 45/72 | 83% (71%–91%) 45/54 | 78% (66%–87%) 43/55 | 61% (47%–74%) 27/44 |

### Wrong cases (all splits)

| Recipe | Benign flagged | Flag missed | Flagged with different spans |
| --- | --- | --- | --- |
| Default | `lit-coli-ecoli`, `lit-tai-chi`, `lit-tai-lalat`, `lit-bodo-baju`, `lit-bodo-amat`, `lit-ewe-domba`, `lit-ewe-english`, `lit-cibay-jajanan`, `lit-koplok-telinga`, `lit-gebleg-jual`, `lit-bangsat-kutu`, `lit-idiot-savant`, `social-saya-bodoh` | `reg-asu-tenan`, `reg-ndasmu-mikir`, `reg-matamu-ngawur`, `reg-anjing-sia`, `reg-bodat-kau`, `reg-pantek-minang`, `abuse-kampret-lu`, `phrase-anak-setan`, `phrase-anak-haram`, `compound-bangsatlah`, `compound-goblokkk`, `obf-goblok-hyphen`, `obf-kontol-spaced`, `obf-anjing-dots`, `obf-anjing-stretched`, `obf-anjing-leet`, `obf-kontol-cyrillic`, `obf-ngentot-stretched`, `friendly-cuk-mangan`, `friendly-edan-apik`, `social-otak-udang`, `social-muka-tembok` | none |
| Expanded | `lit-coli-ecoli`, `lit-tai-chi`, `lit-tai-lalat`, `lit-tahi-lalat`, `lit-bodo-baju`, `lit-bodo-amat`, `lit-ewe-domba`, `lit-ewe-english`, `lit-cibay-jajanan`, `lit-koplok-telinga`, `lit-koplo-dangdut`, `lit-gebleg-jual`, `lit-bct-bus`, `lit-asw-kapal`, `lit-bangsat-kutu`, `lit-jangkrik-semalaman`, `lit-kirik-menyusu`, `lit-matamu-merah`, `lit-anjing-tetangga`, `lit-monyet-uluwatu`, `lit-celeng-kebun`, `lit-sampah-plastik`, `lit-jurig-sunda`, `lit-idiot-savant`, `social-saya-bodoh` | `phrase-anak-setan`, `phrase-anak-haram`, `compound-bangsatlah`, `compound-goblokkk`, `obf-goblok-hyphen`, `obf-kontol-spaced`, `obf-anjing-dots`, `obf-anjing-stretched`, `obf-kontol-cyrillic`, `obf-ngentot-stretched`, `social-otak-udang`, `social-muka-tembok` | none |
| Reviewed core | `lit-tai-chi`, `lit-tai-lalat`, `lit-bangsat-kutu` | `reg-asu-tenan`, `reg-ndasmu-mikir`, `reg-matamu-ngawur`, `reg-anjing-sia`, `reg-naskeleng-cai`, `reg-bodat-kau`, `reg-pantek-minang`, `abuse-sontoloyo`, `abuse-kampret-lu`, `phrase-anak-setan`, `phrase-anak-haram`, `compound-bangsatlah`, `compound-goblokkk`, `obf-goblok-hyphen`, `obf-kontol-spaced`, `obf-anjing-dots`, `obf-anjing-stretched`, `obf-anjing-leet`, `obf-kontol-cyrillic`, `obf-ngentot-stretched`, `friendly-cuk-mangan`, `friendly-bujug-buset`, `friendly-edan-apik`, `social-pelakor-tahu-diri`, `social-kamu-bodoh`, `social-otak-udang`, `social-muka-tembok`, `social-dasar-idiot` | none |
| Reviewed + contextual | `lit-coli-ecoli`, `lit-tai-chi`, `lit-tai-lalat`, `lit-tahi-lalat`, `lit-ewe-domba`, `lit-ewe-english`, `lit-koplok-telinga`, `lit-koplo-dangdut`, `lit-bct-bus`, `lit-bangsat-kutu`, `lit-jangkrik-semalaman`, `lit-kirik-menyusu`, `lit-matamu-merah`, `lit-anjing-tetangga`, `lit-monyet-uluwatu`, `lit-celeng-kebun`, `lit-sampah-plastik`, `lit-jurig-sunda`, `lit-idiot-savant`, `social-saya-bodoh` | `reg-naskeleng-cai`, `phrase-anak-setan`, `phrase-anak-haram`, `compound-bangsatlah`, `compound-goblokkk`, `obf-goblok-hyphen`, `obf-kontol-spaced`, `obf-anjing-dots`, `obf-anjing-stretched`, `obf-kontol-cyrillic`, `obf-ngentot-stretched`, `social-otak-udang`, `social-muka-tembok` | none |
| Default + evasion | `lit-coli-ecoli`, `lit-tai-chi`, `lit-tai-lalat`, `lit-bodo-baju`, `lit-bodo-amat`, `lit-ewe-domba`, `lit-ewe-english`, `lit-cibay-jajanan`, `lit-koplok-telinga`, `lit-gebleg-jual`, `lit-bangsat-kutu`, `lit-idiot-savant`, `social-saya-bodoh` | `reg-asu-tenan`, `reg-ndasmu-mikir`, `reg-matamu-ngawur`, `reg-anjing-sia`, `reg-bodat-kau`, `reg-pantek-minang`, `abuse-kampret-lu`, `phrase-anak-setan`, `phrase-anak-haram`, `compound-bangsatlah`, `obf-anjing-stretched`, `obf-anjing-leet`, `obf-kontol-cyrillic`, `friendly-cuk-mangan`, `friendly-edan-apik`, `social-otak-udang`, `social-muka-tembok` | `obf-anjing-dots` |
| Default + fuzzy | `lit-coli-ecoli`, `lit-tai-chi`, `lit-tai-lalat`, `lit-bodo-baju`, `lit-bodo-amat`, `lit-ewe-domba`, `lit-ewe-english`, `lit-cibay-jajanan`, `lit-koplok-telinga`, `lit-koplo-dangdut`, `lit-gebleg-jual`, `lit-bangsat-kutu`, `lit-anjing-tetangga`, `lit-jurig-sunda`, `lit-idiot-savant`, `near-kontrol-tv`, `near-bangsa-merdeka`, `near-kampung-garut`, `near-kanjeng-ratu`, `near-belum-tentu`, `near-meme-kocak`, `near-bangku-taman`, `near-goblin-cerita`, `ord-harga-cabai`, `social-saya-bodoh` | `reg-asu-tenan`, `reg-ndasmu-mikir`, `reg-matamu-ngawur`, `reg-bodat-kau`, `reg-pantek-minang`, `abuse-kampret-lu`, `phrase-anak-setan`, `phrase-anak-haram`, `compound-bangsatlah`, `compound-goblokkk`, `obf-goblok-hyphen`, `obf-kontol-spaced`, `obf-anjing-dots`, `obf-anjing-stretched`, `obf-ngentot-stretched`, `friendly-cuk-mangan`, `friendly-edan-apik`, `social-otak-udang`, `social-muka-tembok` | none |
| Expanded, substring mode | `lit-coli-ecoli`, `lit-tai-chi`, `lit-tai-lalat`, `lit-tahi-lalat`, `lit-bodo-baju`, `lit-bodo-amat`, `lit-ewe-domba`, `lit-ewe-english`, `lit-cibay-jajanan`, `lit-koplok-telinga`, `lit-koplo-dangdut`, `lit-gebleg-jual`, `lit-bct-bus`, `lit-asw-kapal`, `lit-bangsat-kutu`, `lit-jangkrik-semalaman`, `lit-kirik-menyusu`, `lit-matamu-merah`, `lit-anjing-tetangga`, `lit-monyet-uluwatu`, `lit-celeng-kebun`, `lit-sampah-plastik`, `lit-jurig-sunda`, `lit-idiot-savant`, `near-petai-pantai`, `near-kanjeng-ratu`, `social-saya-bodoh` | `phrase-anak-setan`, `phrase-anak-haram`, `obf-goblok-hyphen`, `obf-kontol-spaced`, `obf-anjing-dots`, `obf-kontol-cyrillic`, `obf-ngentot-stretched`, `social-otak-udang`, `social-muka-tembok` | `compound-bangsatlah`, `compound-goblokkk`, `obf-anjing-stretched` |

### Uncertain cases (reported apart, never in precision or recall)

| Recipe | Flagged | Cases flagged |
| --- | --- | --- |
| Default | 4/5 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi`, `quote-bodoh-kbbi` |
| Expanded | 5/5 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi`, `quote-anjing-panggil`, `quote-bodoh-kbbi` |
| Reviewed core | 3/5 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi` |
| Reviewed + contextual | 5/5 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi`, `quote-anjing-panggil`, `quote-bodoh-kbbi` |
| Default + evasion | 4/5 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi`, `quote-bodoh-kbbi` |
| Default + fuzzy | 5/5 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi`, `quote-anjing-panggil`, `quote-bodoh-kbbi` |
| Expanded, substring mode | 5/5 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi`, `quote-anjing-panggil`, `quote-bodoh-kbbi` |

### By variety: holdout

Each cell: recall (flag cases caught) and benign false positives. † marks a qualified figure: its denominator (flag cases for R, benign cases for FP) is below 10, so it is too small to support a claim.

| Stratum | Flag / benign | Default | Expanded | Reviewed core | Reviewed + contextual | Default + evasion | Default + fuzzy | Expanded, substring mode |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| eastern-indonesia | 1 / 0 | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † |
| english | 0 / 1 | R 0/0 † · FP 1/1 † | R 0/0 † · FP 1/1 † | R 0/0 † · FP 0/1 † | R 0/0 † · FP 1/1 † | R 0/0 † · FP 1/1 † | R 0/0 † · FP 1/1 † | R 0/0 † · FP 1/1 † |
| general | 12 / 9 | R 6/12 · FP 3/9 † | R 7/12 · FP 4/9 † | R 4/12 · FP 1/9 † | R 7/12 · FP 4/9 † | R 7/12 · FP 3/9 † | R 7/12 · FP 8/9 † | R 9/12 · FP 4/9 † |
| javanese | 2 / 1 | R 0/2 † · FP 0/1 † | R 2/2 † · FP 0/1 † | R 0/2 † · FP 0/1 † | R 2/2 † · FP 0/1 † | R 0/2 † · FP 0/1 † | R 0/2 † · FP 1/1 † | R 2/2 † · FP 1/1 † |
| makassar | 1 / 0 | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † |
| papua | 1 / 0 | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † |
| sundanese | 1 / 0 | R 0/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † |

### By phenomenon: holdout

Each cell: recall (flag cases caught) and benign false positives. † marks a qualified figure: its denominator (flag cases for R, benign cases for FP) is below 10, so it is too small to support a claim.

| Stratum | Flag / benign | Default | Expanded | Reviewed core | Reviewed + contextual | Default + evasion | Default + fuzzy | Expanded, substring mode |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abbreviation | 1 / 0 | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † |
| compound | 1 / 0 | R 0/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † |
| direct-abuse | 2 / 0 | R 2/2 † · FP 0/0 † | R 2/2 † · FP 0/0 † | R 1/2 † · FP 0/0 † | R 2/2 † · FP 0/0 † | R 2/2 † · FP 0/0 † | R 2/2 † · FP 0/0 † | R 2/2 † · FP 0/0 † |
| friendly-exclamation | 1 / 0 | R 0/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † |
| literal-homonym | 0 / 4 | R 0/0 † · FP 3/4 † | R 0/0 † · FP 4/4 † | R 0/0 † · FP 1/4 † | R 0/0 † · FP 4/4 † | R 0/0 † · FP 3/4 † | R 0/0 † · FP 4/4 † | R 0/0 † · FP 4/4 † |
| multiword | 1 / 0 | R 0/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † |
| name-or-loanword | 0 / 1 | R 0/0 † · FP 1/1 † | R 0/0 † · FP 1/1 † | R 0/0 † · FP 0/1 † | R 0/0 † · FP 1/1 † | R 0/0 † · FP 1/1 † | R 0/0 † · FP 1/1 † | R 0/0 † · FP 1/1 † |
| near-neighbour | 0 / 5 | R 0/0 † · FP 0/5 † | R 0/0 † · FP 0/5 † | R 0/0 † · FP 0/5 † | R 0/0 † · FP 0/5 † | R 0/0 † · FP 0/5 † | R 0/0 † · FP 5/5 † | R 0/0 † · FP 1/5 † |
| obfuscation | 4 / 0 | R 1/4 † · FP 0/0 † | R 2/4 † · FP 0/0 † | R 1/4 † · FP 0/0 † | R 2/4 † · FP 0/0 † | R 2/4 † · FP 0/0 † | R 2/4 † · FP 0/0 † | R 3/4 † · FP 0/0 † |
| ordinary | 0 / 1 | R 0/0 † · FP 0/1 † | R 0/0 † · FP 0/1 † | R 0/0 † · FP 0/1 † | R 0/0 † · FP 0/1 † | R 0/0 † · FP 0/1 † | R 0/0 † · FP 0/1 † | R 0/0 † · FP 0/1 † |
| regional-abuse | 6 / 0 | R 4/6 † · FP 0/0 † | R 6/6 † · FP 0/0 † | R 4/6 † · FP 0/0 † | R 6/6 † · FP 0/0 † | R 4/6 † · FP 0/0 † | R 5/6 † · FP 0/0 † | R 6/6 † · FP 0/0 † |
| social-insult | 2 / 0 | R 1/2 † · FP 0/0 † | R 1/2 † · FP 0/0 † | R 0/2 † · FP 0/0 † | R 1/2 † · FP 0/0 † | R 1/2 † · FP 0/0 † | R 1/2 † · FP 0/0 † | R 1/2 † · FP 0/0 † |

### By variety: all

Each cell: recall (flag cases caught) and benign false positives. † marks a qualified figure: its denominator (flag cases for R, benign cases for FP) is below 10, so it is too small to support a claim.

| Stratum | Flag / benign | Default | Expanded | Reviewed core | Reviewed + contextual | Default + evasion | Default + fuzzy | Expanded, substring mode |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| balinese | 1 / 0 | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † |
| batak | 1 / 0 | R 0/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † |
| betawi | 1 / 0 | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † |
| bugis | 0 / 1 | R 0/0 † · FP 1/1 † | R 0/0 † · FP 1/1 † | R 0/0 † · FP 0/1 † | R 0/0 † · FP 0/1 † | R 0/0 † · FP 1/1 † | R 0/0 † · FP 1/1 † | R 0/0 † · FP 1/1 † |
| eastern-indonesia | 1 / 0 | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † |
| english | 0 / 1 | R 0/0 † · FP 1/1 † | R 0/0 † · FP 1/1 † | R 0/0 † · FP 0/1 † | R 0/0 † · FP 1/1 † | R 0/0 † · FP 1/1 † | R 0/0 † · FP 1/1 † | R 0/0 † · FP 1/1 † |
| general | 34 / 35 | R 20/34 · FP 9/35 | R 22/34 · FP 17/35 | R 16/34 · FP 3/35 | R 22/34 · FP 15/35 | R 25/34 · FP 9/35 | R 22/34 · FP 18/35 | R 25/34 · FP 18/35 |
| javanese | 9 / 5 | R 4/9 † · FP 1/5 † | R 9/9 † · FP 4/5 † | R 4/9 † · FP 0/5 † | R 9/9 † · FP 3/5 † | R 4/9 † · FP 1/5 † | R 4/9 † · FP 3/5 † | R 9/9 † · FP 5/5 † |
| makassar | 1 / 0 | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † |
| minang | 1 / 0 | R 0/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 0/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † |
| papua | 1 / 0 | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † | R 1/1 † · FP 0/0 † |
| sundanese | 4 / 2 | R 3/4 † · FP 1/2 † | R 4/4 † · FP 2/2 † | R 3/4 † · FP 0/2 † | R 4/4 † · FP 1/2 † | R 3/4 † · FP 1/2 † | R 4/4 † · FP 2/2 † | R 4/4 † · FP 2/2 † |

### By phenomenon: all

Each cell: recall (flag cases caught) and benign false positives. † marks a qualified figure: its denominator (flag cases for R, benign cases for FP) is below 10, so it is too small to support a claim.

| Stratum | Flag / benign | Default | Expanded | Reviewed core | Reviewed + contextual | Default + evasion | Default + fuzzy | Expanded, substring mode |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abbreviation | 2 / 0 | R 2/2 † · FP 0/0 † | R 2/2 † · FP 0/0 † | R 2/2 † · FP 0/0 † | R 2/2 † · FP 0/0 † | R 2/2 † · FP 0/0 † | R 2/2 † · FP 0/0 † | R 2/2 † · FP 0/0 † |
| compound | 3 / 0 | R 2/3 † · FP 0/0 † | R 2/3 † · FP 0/0 † | R 2/3 † · FP 0/0 † | R 2/3 † · FP 0/0 † | R 2/3 † · FP 0/0 † | R 2/3 † · FP 0/0 † | R 3/3 † · FP 0/0 † |
| direct-abuse | 7 / 0 | R 6/7 † · FP 0/0 † | R 7/7 † · FP 0/0 † | R 5/7 † · FP 0/0 † | R 7/7 † · FP 0/0 † | R 6/7 † · FP 0/0 † | R 6/7 † · FP 0/0 † | R 7/7 † · FP 0/0 † |
| friendly-exclamation | 7 / 0 | R 5/7 † · FP 0/0 † | R 7/7 † · FP 0/0 † | R 4/7 † · FP 0/0 † | R 7/7 † · FP 0/0 † | R 5/7 † · FP 0/0 † | R 5/7 † · FP 0/0 † | R 7/7 † · FP 0/0 † |
| literal-homonym | 0 / 18 | R 0/0 † · FP 9/18 | R 0/0 † · FP 18/18 | R 0/0 † · FP 2/18 | R 0/0 † · FP 15/18 | R 0/0 † · FP 9/18 | R 0/0 † · FP 11/18 | R 0/0 † · FP 18/18 |
| multiword | 2 / 0 | R 0/2 † · FP 0/0 † | R 0/2 † · FP 0/0 † | R 0/2 † · FP 0/0 † | R 0/2 † · FP 0/0 † | R 0/2 † · FP 0/0 † | R 0/2 † · FP 0/0 † | R 0/2 † · FP 0/0 † |
| name-or-loanword | 0 / 6 | R 0/0 † · FP 3/6 † | R 0/0 † · FP 6/6 † | R 0/0 † · FP 1/6 † | R 0/0 † · FP 4/6 † | R 0/0 † · FP 3/6 † | R 0/0 † · FP 4/6 † | R 0/0 † · FP 6/6 † |
| near-neighbour | 0 / 14 | R 0/0 † · FP 0/14 | R 0/0 † · FP 0/14 | R 0/0 † · FP 0/14 | R 0/0 † · FP 0/14 | R 0/0 † · FP 0/14 | R 0/0 † · FP 8/14 | R 0/0 † · FP 2/14 |
| obfuscation | 11 / 0 | R 3/11 · FP 0/0 † | R 4/11 · FP 0/0 † | R 3/11 · FP 0/0 † | R 4/11 · FP 0/0 † | R 8/11 · FP 0/0 † | R 5/11 · FP 0/0 † | R 6/11 · FP 0/0 † |
| ordinary | 0 / 5 | R 0/0 † · FP 0/5 † | R 0/0 † · FP 0/5 † | R 0/0 † · FP 0/5 † | R 0/0 † · FP 0/5 † | R 0/0 † · FP 0/5 † | R 0/0 † · FP 1/5 † | R 0/0 † · FP 0/5 † |
| regional-abuse | 17 / 0 | R 11/17 · FP 0/0 † | R 17/17 · FP 0/0 † | R 10/17 · FP 0/0 † | R 16/17 · FP 0/0 † | R 11/17 · FP 0/0 † | R 12/17 · FP 0/0 † | R 17/17 · FP 0/0 † |
| social-insult | 5 / 1 | R 3/5 † · FP 1/1 † | R 3/5 † · FP 1/1 † | R 0/5 † · FP 0/1 † | R 3/5 † · FP 1/1 † | R 3/5 † · FP 1/1 † | R 3/5 † · FP 1/1 † | R 3/5 † · FP 1/1 † |

<!-- accuracy:generated:end -->

## Reproduce

```sh
npm run build
npm run evaluate:corpus            # print the tables
npm run evaluate:corpus -- --write # regenerate this page's tables and evaluation/baseline.json
npm run evaluate:corpus -- --check # fail if either differs from the current build (runs in npm test)
```

The run is deterministic, offline and not timed. The tables between the markers above are
generated; edit the text around them, not the tables.
