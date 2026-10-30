# Measured accuracy on the evaluation corpus

[Documentation](README.md) · [Evaluation protocol](evaluation-protocol.md) · [Evaluate and tune](guides/evaluation.md)

This page reports how each documented setup of the package behaves on a small, hand-built
evaluation corpus. Read the limits before the numbers.

## What these numbers are not

- **Not a population estimate.** The corpus is small and constructed, not sampled from real
  chat. An AI agent drafted every text and the maintainer revised some in review (the counts are
  below); none is taken from an external source. It says how the package treats these cases, not
  how often it errs on real traffic.
- **One native reviewer.** The maintainer, as a single native-speaker reviewer, labelled the first
  103 cases on 2026-10-30. That is not a panel, and no agreement between annotators was measured,
  because that needs a second annotator.
- **Label status.** Counted from the corpus each time this page is generated:

<!-- generated:status:start -->

All 142 labels have been reviewed by the maintainer, a single native-speaker reviewer. 2 case texts were revised by the maintainer during review (the `revisions` field). A reviewed label is one reviewer's judgement, not ground truth.

<!-- generated:status:end -->

- **Small strata.** Most strata hold only a handful of cases. A figure marked † has fewer than 10
  cases behind it (flag cases for recall, benign cases for the false-positive rate); it shows what
  happened to those cases and supports no claim. The sample size `n` is shown with every rate,
  with a 95% Wilson interval. A stratum with no such cases shows n/a.
- **Mentions are reported apart.** Quoted, reported and mentioned profanity is labelled
  `uncertain` by the maintainer's policy. Those cases are never counted in precision or recall;
  the table below only shows how many each setup flags.
- **A false positive is a bug; a high recall here is not a goal by itself.** Every setup below
  flags some benign cases, including the default; compare the false-positive column, not only
  recall, before choosing one. The fuzzy and substring setups flag the most.

How the corpus was built, labelled and split, and the thresholds proposed changes must meet, are
in the [evaluation protocol](evaluation-protocol.md). The data is
[`evaluation/corpus.json`](../evaluation/corpus.json) and the compact computed results (every
split and stratum the tables need, no per-case dump) are [`evaluation/baseline.json`](../evaluation/baseline.json). Neither file is in the npm package.

## Reading the tables

- **Precision** is the share of flagged cases that should have been flagged; **recall** is the
  share of should-flag cases that were flagged; the **benign false-positive rate** is the share of
  benign cases that were flagged. All are case level and come from
  [`evaluate()`](guides/evaluation.md). **Span recall** counts the exact offending spans.
- The **holdout** is about 30% of the term families, chosen so that no family appears in both
  splits (a family is a catalog sense, so spelling variants of one term stay together); the share of
  cases varies, and the Corpus table gives the sizes. The **dev** split is what you tune against; look at holdout results once per proposal.
- Each setup is copied from the documentation named in the Recipes table.

## Results

<!-- generated:tables:start -->

### Corpus

|  | Cases |
| --- | --- |
| All | 142 |
| Flag / benign / uncertain | 81 / 56 / 5 |
| Dev / holdout | 99 / 43 |
| Labels proposed / reviewed | 0 / 142 |

### Cases by phenomenon and split

Each cell: flag / benign / uncertain.

| Phenomenon | Dev | Holdout |
| --- | --- | --- |
| abbreviation | 1 / 0 / 0 | 1 / 0 / 0 |
| compound | 1 / 0 / 0 | 2 / 0 / 0 |
| direct-abuse | 18 / 0 / 0 | 7 / 0 / 0 |
| friendly-exclamation | 5 / 0 / 0 | 3 / 0 / 0 |
| literal-homonym | 0 / 22 / 0 | 0 / 5 / 0 |
| multiword | 1 / 0 / 0 | 1 / 0 / 0 |
| name-or-loanword | 0 / 5 / 0 | 0 / 2 / 0 |
| near-neighbour | 0 / 9 / 0 | 0 / 5 / 0 |
| obfuscation | 8 / 0 / 0 | 3 / 0 / 0 |
| ordinary | 0 / 3 / 0 | 0 / 3 / 0 |
| quoted-or-reported | 0 / 1 / 3 | 0 / 0 / 2 |
| regional-abuse | 19 / 0 / 0 | 6 / 0 / 0 |
| social-insult | 2 / 1 / 0 | 3 / 0 / 0 |

### Cases by variety and split

Each cell: flag / benign / uncertain.

| Variety | Dev | Holdout |
| --- | --- | --- |
| balinese | 0 / 0 / 0 | 1 / 0 / 0 |
| batak | 1 / 0 / 0 | 0 / 0 / 0 |
| betawi | 1 / 0 / 0 | 2 / 0 / 0 |
| bugis | 0 / 1 / 0 | 0 / 0 / 0 |
| english | 0 / 1 / 0 | 0 / 0 / 0 |
| general | 33 / 30 / 3 | 15 / 14 / 1 |
| javanese | 7 / 6 / 0 | 5 / 1 / 1 |
| makassar | 1 / 0 / 0 | 0 / 0 / 0 |
| malay-influenced | 2 / 0 / 0 | 1 / 0 / 0 |
| minang | 0 / 0 / 0 | 1 / 0 / 0 |
| papua | 0 / 0 / 0 | 1 / 0 / 0 |
| sundanese | 10 / 3 / 0 | 0 / 0 / 0 |

### Recipes

| Recipe | Id | Taken from |
| --- | --- | --- |
| Default | `default` | docs/guides/dictionaries.md, "Default or expanded" |
| Expanded | `expanded` | docs/guides/dictionaries.md, "Default or expanded" |
| Reviewed core | `reviewed` | docs/metadata.md, "Selection rules" (`reviewedDictionary`, the default selection) |
| Reviewed + contextual | `reviewed-expanded` | docs/metadata.md, "Selection rules" (`reviewedExpandedDictionary`) |
| Default + evasion | `evasion` | docs/guides/evasion.md, first recipe |
| Default + fuzzy | `fuzzy` | README.md, "Catch disguised spellings and typos" (its `fuzzy` option on the default dictionary) |
| Default + evasion + fuzzy | `tolerant` | README.md, "Catch disguised spellings and typos" (`tolerant`, copied unchanged) |
| Expanded, substring mode | `substring` | docs/api.md, "Substring mode" |

### Results: holdout (26 flag, 15 benign)

Each cell: rate (95% Wilson interval) count/n. † marks n below 10: too small to support a claim.

| Recipe | Precision | Recall | Span recall | Benign false-positive rate |
| --- | --- | --- | --- | --- |
| Default | 86% (67%–95%) 19/22 | 73% (54%–86%) 19/26 | 74% (55%–87%) 20/27 | 20% (7%–45%) 3/15 |
| Expanded | 76% (58%–88%) 22/29 | 85% (66%–94%) 22/26 | 85% (68%–94%) 23/27 | 47% (25%–70%) 7/15 |
| Reviewed core | 92% (67%–99%) 12/13 | 46% (29%–65%) 12/26 | 44% (28%–63%) 12/27 | 7% (1%–30%) 1/15 |
| Reviewed + contextual | 84% (65%–94%) 21/25 | 81% (62%–91%) 21/26 | 81% (63%–92%) 22/27 | 27% (11%–52%) 4/15 |
| Default + evasion | 86% (67%–95%) 19/22 | 73% (54%–86%) 19/26 | 74% (55%–87%) 20/27 | 20% (7%–45%) 3/15 |
| Default + fuzzy | 73% (54%–86%) 19/26 | 73% (54%–86%) 19/26 | 74% (55%–87%) 20/27 | 47% (25%–70%) 7/15 |
| Default + evasion + fuzzy | 73% (54%–86%) 19/26 | 73% (54%–86%) 19/26 | 74% (55%–87%) 20/27 | 47% (25%–70%) 7/15 |
| Expanded, substring mode | 77% (59%–88%) 23/30 | 88% (71%–96%) 23/26 | 85% (68%–94%) 23/27 | 47% (25%–70%) 7/15 |

### Results: dev (55 flag, 41 benign)

Each cell: rate (95% Wilson interval) count/n. † marks n below 10: too small to support a claim.

| Recipe | Precision | Recall | Span recall | Benign false-positive rate |
| --- | --- | --- | --- | --- |
| Default | 74% (60%–84%) 37/50 | 67% (54%–78%) 37/55 | 67% (54%–78%) 37/55 | 32% (20%–47%) 13/41 |
| Expanded | 62% (51%–72%) 47/76 | 85% (74%–92%) 47/55 | 85% (74%–92%) 47/55 | 71% (56%–82%) 29/41 |
| Reviewed core | 88% (64%–97%) 14/16 | 25% (16%–38%) 14/55 | 25% (16%–38%) 14/55 | 5% (1%–16%) 2/41 |
| Reviewed + contextual | 62% (49%–74%) 33/53 | 60% (47%–72%) 33/55 | 60% (47%–72%) 33/55 | 49% (34%–64%) 20/41 |
| Default + evasion | 76% (64%–86%) 42/55 | 76% (64%–86%) 42/55 | 75% (62%–84%) 41/55 | 32% (20%–47%) 13/41 |
| Default + fuzzy | 63% (51%–74%) 40/63 | 73% (60%–83%) 40/55 | 73% (60%–83%) 40/55 | 56% (41%–70%) 23/41 |
| Default + evasion + fuzzy | 66% (54%–76%) 45/68 | 82% (70%–90%) 45/55 | 82% (70%–90%) 45/55 | 56% (41%–70%) 23/41 |
| Expanded, substring mode | 60% (50%–70%) 49/81 | 89% (78%–95%) 49/55 | 85% (74%–92%) 47/55 | 78% (63%–88%) 32/41 |

### Results: all (81 flag, 56 benign)

Each cell: rate (95% Wilson interval) count/n. † marks n below 10: too small to support a claim.

| Recipe | Precision | Recall | Span recall | Benign false-positive rate |
| --- | --- | --- | --- | --- |
| Default | 78% (67%–86%) 56/72 | 69% (58%–78%) 56/81 | 70% (59%–78%) 57/82 | 29% (18%–41%) 16/56 |
| Expanded | 66% (56%–74%) 69/105 | 85% (76%–91%) 69/81 | 85% (76%–91%) 70/82 | 64% (51%–76%) 36/56 |
| Reviewed core | 90% (74%–96%) 26/29 | 32% (23%–43%) 26/81 | 32% (23%–42%) 26/82 | 5% (2%–15%) 3/56 |
| Reviewed + contextual | 69% (58%–78%) 54/78 | 67% (56%–76%) 54/81 | 67% (56%–76%) 55/82 | 43% (31%–56%) 24/56 |
| Default + evasion | 79% (69%–87%) 61/77 | 75% (65%–83%) 61/81 | 74% (64%–83%) 61/82 | 29% (18%–41%) 16/56 |
| Default + fuzzy | 66% (56%–75%) 59/89 | 73% (62%–81%) 59/81 | 73% (63%–82%) 60/82 | 54% (41%–66%) 30/56 |
| Default + evasion + fuzzy | 68% (58%–77%) 64/94 | 79% (69%–86%) 64/81 | 79% (69%–87%) 65/82 | 54% (41%–66%) 30/56 |
| Expanded, substring mode | 65% (56%–73%) 72/111 | 89% (80%–94%) 72/81 | 85% (76%–91%) 70/82 | 70% (57%–80%) 39/56 |

### Wrong cases (all splits)

| Recipe | Benign flagged | Flag missed | Flagged with different spans |
| --- | --- | --- | --- |
| Default | `lit-coli-ecoli`, `lit-tai-chi`, `lit-tai-lalat`, `lit-bodo-baju`, `lit-bodo-amat`, `lit-ewe-domba`, `lit-ewe-english`, `lit-cibay-jajanan`, `lit-koplok-telinga`, `lit-gebleg-jual`, `lit-bangsat-kutu`, `lit-idiot-savant`, `social-saya-bodoh`, `lit-pepek-lengkap`, `lit-sontoloyo-penggembala`, `quote-pelakor-berita` | `reg-asu-tenan`, `reg-ndasmu-mikir`, `reg-matamu-ngawur`, `reg-anjing-sia`, `reg-bodat-kau`, `reg-pantek-minang`, `abuse-kampret-lu`, `phrase-anak-setan`, `phrase-anak-haram`, `compound-bangsatlah`, `obf-goblokkk-stretched`, `obf-goblok-hyphen`, `obf-kontol-spaced`, `obf-anjing-dots`, `obf-anjing-stretched`, `obf-anjing-leet`, `obf-kontol-cyrillic`, `obf-ngentot-stretched`, `friendly-cuk-mangan`, `friendly-edan-apik`, `social-otak-udang`, `social-muka-tembok`, `abuse-bengek-dasar`, `abuse-cepu-ngadu`, `reg-nggateli-kowe` | none |
| Expanded | `lit-coli-ecoli`, `lit-tai-chi`, `lit-tai-lalat`, `lit-tahi-lalat`, `lit-bodo-baju`, `lit-bodo-amat`, `lit-ewe-domba`, `lit-ewe-english`, `lit-cibay-jajanan`, `lit-koplok-telinga`, `lit-koplo-dangdut`, `lit-gebleg-jual`, `lit-bct-bus`, `lit-asw-kapal`, `lit-bangsat-kutu`, `lit-jangkrik-semalaman`, `lit-kirik-menyusu`, `lit-matamu-merah`, `lit-anjing-tetangga`, `lit-monyet-uluwatu`, `lit-celeng-kebun`, `lit-sampah-plastik`, `lit-jurig-sunda`, `lit-idiot-savant`, `social-saya-bodoh`, `lit-pepek-lengkap`, `lit-sontoloyo-penggembala`, `quote-pelakor-berita`, `lit-benges-lipstik`, `lit-buntal-ikan`, `lit-cepu-stasiun`, `ord-cilaka-dompet`, `lit-jambret-warga`, `lit-mewek-adik`, `lit-nggateli-kaos`, `lit-cibrit-diare` | `phrase-anak-setan`, `phrase-anak-haram`, `compound-bangsatlah`, `obf-goblokkk-stretched`, `obf-goblok-hyphen`, `obf-kontol-spaced`, `obf-anjing-dots`, `obf-anjing-stretched`, `obf-kontol-cyrillic`, `obf-ngentot-stretched`, `social-otak-udang`, `social-muka-tembok` | none |
| Reviewed core | `lit-tai-chi`, `lit-tai-lalat`, `lit-bangsat-kutu` | `reg-asu-tenan`, `reg-ndasmu-mikir`, `reg-matamu-ngawur`, `reg-anjing-sia`, `reg-naskeleng-cai`, `reg-bodat-kau`, `reg-pantek-minang`, `abuse-sontoloyo`, `abuse-kampret-lu`, `phrase-anak-setan`, `phrase-anak-haram`, `compound-bangsatlah`, `obf-goblokkk-stretched`, `obf-goblok-hyphen`, `obf-kontol-spaced`, `obf-anjing-dots`, `obf-anjing-stretched`, `obf-anjing-leet`, `obf-kontol-cyrillic`, `obf-ngentot-stretched`, `friendly-cuk-mangan`, `friendly-bujug-buset`, `friendly-edan-apik`, `social-pelakor-tahu-diri`, `social-kamu-bodoh`, `social-otak-udang`, `social-muka-tembok`, `social-dasar-idiot`, `abuse-coli-kamar`, `abuse-ewe-ajak`, `abuse-cibay-nipu`, `reg-koplok-siah`, `abuse-pecun-dasar`, `abuse-pepek-lu`, `reg-heunceut-siah`, `reg-balegug-maneh`, `reg-bedegong-siah`, `abuse-bodo-dasar`, `abuse-kemplu-dasar`, `reg-gebleh-kowe`, `abuse-tolir-dasar`, `reg-tiembokne-ngapusi`, `abuse-gebleg-kabur`, `abuse-cibai-motor`, `abuse-ewean-chat`, `abuse-bispak-cewek`, `abuse-sinting-dasar`, `abuse-nyepong-om`, `abuse-sepong-sana`, `abuse-ngehe-telat`, `friendly-araranjay-telat`, `reg-goblik-siah`, `abuse-bengek-dasar`, `abuse-cepu-ngadu`, `reg-nggateli-kowe` | none |
| Reviewed + contextual | `lit-coli-ecoli`, `lit-tai-chi`, `lit-tai-lalat`, `lit-tahi-lalat`, `lit-ewe-domba`, `lit-ewe-english`, `lit-koplok-telinga`, `lit-koplo-dangdut`, `lit-bct-bus`, `lit-bangsat-kutu`, `lit-jangkrik-semalaman`, `lit-kirik-menyusu`, `lit-matamu-merah`, `lit-anjing-tetangga`, `lit-monyet-uluwatu`, `lit-celeng-kebun`, `lit-sampah-plastik`, `lit-jurig-sunda`, `lit-idiot-savant`, `social-saya-bodoh`, `lit-pepek-lengkap`, `lit-sontoloyo-penggembala`, `quote-pelakor-berita`, `lit-nggateli-kaos` | `reg-naskeleng-cai`, `phrase-anak-setan`, `phrase-anak-haram`, `compound-bangsatlah`, `obf-goblokkk-stretched`, `obf-goblok-hyphen`, `obf-kontol-spaced`, `obf-anjing-dots`, `obf-anjing-stretched`, `obf-kontol-cyrillic`, `obf-ngentot-stretched`, `social-otak-udang`, `social-muka-tembok`, `abuse-cibay-nipu`, `reg-heunceut-siah`, `reg-balegug-maneh`, `reg-bedegong-siah`, `abuse-bodo-dasar`, `abuse-kemplu-dasar`, `reg-gebleh-kowe`, `abuse-tolir-dasar`, `reg-tiembokne-ngapusi`, `abuse-gebleg-kabur`, `abuse-cibai-motor`, `reg-goblik-siah`, `abuse-bengek-dasar`, `abuse-cepu-ngadu` | none |
| Default + evasion | `lit-coli-ecoli`, `lit-tai-chi`, `lit-tai-lalat`, `lit-bodo-baju`, `lit-bodo-amat`, `lit-ewe-domba`, `lit-ewe-english`, `lit-cibay-jajanan`, `lit-koplok-telinga`, `lit-gebleg-jual`, `lit-bangsat-kutu`, `lit-idiot-savant`, `social-saya-bodoh`, `lit-pepek-lengkap`, `lit-sontoloyo-penggembala`, `quote-pelakor-berita` | `reg-asu-tenan`, `reg-ndasmu-mikir`, `reg-matamu-ngawur`, `reg-anjing-sia`, `reg-bodat-kau`, `reg-pantek-minang`, `abuse-kampret-lu`, `phrase-anak-setan`, `phrase-anak-haram`, `compound-bangsatlah`, `obf-anjing-stretched`, `obf-anjing-leet`, `obf-kontol-cyrillic`, `friendly-cuk-mangan`, `friendly-edan-apik`, `social-otak-udang`, `social-muka-tembok`, `abuse-bengek-dasar`, `abuse-cepu-ngadu`, `reg-nggateli-kowe` | `obf-anjing-dots` |
| Default + fuzzy | `lit-coli-ecoli`, `lit-tai-chi`, `lit-tai-lalat`, `lit-bodo-baju`, `lit-bodo-amat`, `lit-ewe-domba`, `lit-ewe-english`, `lit-cibay-jajanan`, `lit-koplok-telinga`, `lit-koplo-dangdut`, `lit-gebleg-jual`, `lit-bangsat-kutu`, `lit-anjing-tetangga`, `lit-jurig-sunda`, `lit-idiot-savant`, `near-kontrol-tv`, `near-bangsa-merdeka`, `near-kampung-garut`, `near-kanjeng-ratu`, `near-belum-tentu`, `near-meme-kocak`, `near-bangku-taman`, `near-goblin-cerita`, `ord-harga-cabai`, `social-saya-bodoh`, `lit-pepek-lengkap`, `lit-sontoloyo-penggembala`, `quote-pelakor-berita`, `lit-jambret-warga`, `lit-mewek-adik` | `reg-asu-tenan`, `reg-ndasmu-mikir`, `reg-matamu-ngawur`, `reg-bodat-kau`, `reg-pantek-minang`, `abuse-kampret-lu`, `phrase-anak-setan`, `phrase-anak-haram`, `compound-bangsatlah`, `obf-goblokkk-stretched`, `obf-goblok-hyphen`, `obf-kontol-spaced`, `obf-anjing-dots`, `obf-anjing-stretched`, `obf-ngentot-stretched`, `friendly-cuk-mangan`, `friendly-edan-apik`, `social-otak-udang`, `social-muka-tembok`, `abuse-bengek-dasar`, `abuse-cepu-ngadu`, `reg-nggateli-kowe` | none |
| Default + evasion + fuzzy | `lit-coli-ecoli`, `lit-tai-chi`, `lit-tai-lalat`, `lit-bodo-baju`, `lit-bodo-amat`, `lit-ewe-domba`, `lit-ewe-english`, `lit-cibay-jajanan`, `lit-koplok-telinga`, `lit-koplo-dangdut`, `lit-gebleg-jual`, `lit-bangsat-kutu`, `lit-anjing-tetangga`, `lit-jurig-sunda`, `lit-idiot-savant`, `near-kontrol-tv`, `near-bangsa-merdeka`, `near-kampung-garut`, `near-kanjeng-ratu`, `near-belum-tentu`, `near-meme-kocak`, `near-bangku-taman`, `near-goblin-cerita`, `ord-harga-cabai`, `social-saya-bodoh`, `lit-pepek-lengkap`, `lit-sontoloyo-penggembala`, `quote-pelakor-berita`, `lit-jambret-warga`, `lit-mewek-adik` | `reg-asu-tenan`, `reg-ndasmu-mikir`, `reg-matamu-ngawur`, `reg-bodat-kau`, `reg-pantek-minang`, `abuse-kampret-lu`, `phrase-anak-setan`, `phrase-anak-haram`, `compound-bangsatlah`, `obf-anjing-stretched`, `friendly-cuk-mangan`, `friendly-edan-apik`, `social-otak-udang`, `social-muka-tembok`, `abuse-bengek-dasar`, `abuse-cepu-ngadu`, `reg-nggateli-kowe` | none |
| Expanded, substring mode | `lit-coli-ecoli`, `lit-tai-chi`, `lit-tai-lalat`, `lit-tahi-lalat`, `lit-bodo-baju`, `lit-bodo-amat`, `lit-ewe-domba`, `lit-ewe-english`, `lit-cibay-jajanan`, `lit-koplok-telinga`, `lit-koplo-dangdut`, `lit-gebleg-jual`, `lit-bct-bus`, `lit-asw-kapal`, `lit-bangsat-kutu`, `lit-jangkrik-semalaman`, `lit-kirik-menyusu`, `lit-matamu-merah`, `lit-anjing-tetangga`, `lit-monyet-uluwatu`, `lit-celeng-kebun`, `lit-sampah-plastik`, `lit-jurig-sunda`, `lit-idiot-savant`, `near-petai-pantai`, `near-kanjeng-ratu`, `social-saya-bodoh`, `lit-pepek-lengkap`, `lit-sontoloyo-penggembala`, `quote-pelakor-berita`, `lit-bengek-asma`, `lit-benges-lipstik`, `lit-buntal-ikan`, `lit-cepu-stasiun`, `ord-cilaka-dompet`, `lit-jambret-warga`, `lit-mewek-adik`, `lit-nggateli-kaos`, `lit-cibrit-diare` | `phrase-anak-setan`, `phrase-anak-haram`, `obf-goblok-hyphen`, `obf-kontol-spaced`, `obf-anjing-dots`, `obf-kontol-cyrillic`, `obf-ngentot-stretched`, `social-otak-udang`, `social-muka-tembok` | `compound-bangsatlah`, `obf-goblokkk-stretched`, `obf-anjing-stretched`, `abuse-cibai-motor`, `abuse-bispak-cewek` |

### Uncertain cases (reported apart, never in precision or recall)

| Recipe | Flagged | Cases flagged |
| --- | --- | --- |
| Default | 4/5 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi`, `quote-bodoh-kbbi` |
| Expanded | 5/5 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi`, `quote-anjing-panggil`, `quote-bodoh-kbbi` |
| Reviewed core | 3/5 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi` |
| Reviewed + contextual | 5/5 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi`, `quote-anjing-panggil`, `quote-bodoh-kbbi` |
| Default + evasion | 4/5 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi`, `quote-bodoh-kbbi` |
| Default + fuzzy | 5/5 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi`, `quote-anjing-panggil`, `quote-bodoh-kbbi` |
| Default + evasion + fuzzy | 5/5 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi`, `quote-anjing-panggil`, `quote-bodoh-kbbi` |
| Expanded, substring mode | 5/5 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi`, `quote-anjing-panggil`, `quote-bodoh-kbbi` |

### By variety: holdout

Each cell: recall (flag cases caught) and benign false positives. † marks a qualified figure: its denominator (flag cases for R, benign cases for FP) is below 10, so it is too small to support a claim. n/a: the stratum has no such cases.

| Stratum | Flag / benign | Default | Expanded | Reviewed core | Reviewed + contextual | Default + evasion | Default + fuzzy | Default + evasion + fuzzy | Expanded, substring mode |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| balinese | 1 / 0 | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a |
| betawi | 2 / 0 | R 2/2 † · FP n/a | R 2/2 † · FP n/a | R 0/2 † · FP n/a | R 2/2 † · FP n/a | R 2/2 † · FP n/a | R 2/2 † · FP n/a | R 2/2 † · FP n/a | R 2/2 † · FP n/a |
| general | 15 / 14 | R 10/15 · FP 3/14 | R 11/15 · FP 6/14 | R 6/15 · FP 1/14 | R 11/15 · FP 4/14 | R 10/15 · FP 3/14 | R 10/15 · FP 7/14 | R 10/15 · FP 7/14 | R 12/15 · FP 6/14 |
| javanese | 5 / 1 | R 4/5 † · FP 0/1 † | R 5/5 † · FP 1/1 † | R 4/5 † · FP 0/1 † | R 5/5 † · FP 0/1 † | R 4/5 † · FP 0/1 † | R 4/5 † · FP 0/1 † | R 4/5 † · FP 0/1 † | R 5/5 † · FP 1/1 † |
| malay-influenced | 1 / 0 | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a |
| minang | 1 / 0 | R 0/1 † · FP n/a | R 1/1 † · FP n/a | R 0/1 † · FP n/a | R 1/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 1/1 † · FP n/a |
| papua | 1 / 0 | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a |

### By phenomenon: holdout

Each cell: recall (flag cases caught) and benign false positives. † marks a qualified figure: its denominator (flag cases for R, benign cases for FP) is below 10, so it is too small to support a claim. n/a: the stratum has no such cases.

| Stratum | Flag / benign | Default | Expanded | Reviewed core | Reviewed + contextual | Default + evasion | Default + fuzzy | Default + evasion + fuzzy | Expanded, substring mode |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abbreviation | 1 / 0 | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a |
| compound | 2 / 0 | R 1/2 † · FP n/a | R 1/2 † · FP n/a | R 1/2 † · FP n/a | R 1/2 † · FP n/a | R 1/2 † · FP n/a | R 1/2 † · FP n/a | R 1/2 † · FP n/a | R 2/2 † · FP n/a |
| direct-abuse | 7 / 0 | R 6/7 † · FP n/a | R 7/7 † · FP n/a | R 2/7 † · FP n/a | R 7/7 † · FP n/a | R 6/7 † · FP n/a | R 6/7 † · FP n/a | R 6/7 † · FP n/a | R 7/7 † · FP n/a |
| friendly-exclamation | 3 / 0 | R 2/3 † · FP n/a | R 3/3 † · FP n/a | R 1/3 † · FP n/a | R 3/3 † · FP n/a | R 2/3 † · FP n/a | R 2/3 † · FP n/a | R 2/3 † · FP n/a | R 3/3 † · FP n/a |
| literal-homonym | 0 / 5 | R n/a · FP 2/5 † | R n/a · FP 5/5 † | R n/a · FP 1/5 † | R n/a · FP 2/5 † | R n/a · FP 2/5 † | R n/a · FP 3/5 † | R n/a · FP 3/5 † | R n/a · FP 5/5 † |
| multiword | 1 / 0 | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a |
| name-or-loanword | 0 / 2 | R n/a · FP 1/2 † | R n/a · FP 2/2 † | R n/a · FP 0/2 † | R n/a · FP 2/2 † | R n/a · FP 1/2 † | R n/a · FP 1/2 † | R n/a · FP 1/2 † | R n/a · FP 2/2 † |
| near-neighbour | 0 / 5 | R n/a · FP 0/5 † | R n/a · FP 0/5 † | R n/a · FP 0/5 † | R n/a · FP 0/5 † | R n/a · FP 0/5 † | R n/a · FP 3/5 † | R n/a · FP 3/5 † | R n/a · FP 0/5 † |
| obfuscation | 3 / 0 | R 3/3 † · FP n/a | R 3/3 † · FP n/a | R 3/3 † · FP n/a | R 3/3 † · FP n/a | R 3/3 † · FP n/a | R 3/3 † · FP n/a | R 3/3 † · FP n/a | R 3/3 † · FP n/a |
| ordinary | 0 / 3 | R n/a · FP 0/3 † | R n/a · FP 0/3 † | R n/a · FP 0/3 † | R n/a · FP 0/3 † | R n/a · FP 0/3 † | R n/a · FP 0/3 † | R n/a · FP 0/3 † | R n/a · FP 0/3 † |
| regional-abuse | 6 / 0 | R 5/6 † · FP n/a | R 6/6 † · FP n/a | R 4/6 † · FP n/a | R 5/6 † · FP n/a | R 5/6 † · FP n/a | R 5/6 † · FP n/a | R 5/6 † · FP n/a | R 6/6 † · FP n/a |
| social-insult | 3 / 0 | R 1/3 † · FP n/a | R 1/3 † · FP n/a | R 0/3 † · FP n/a | R 1/3 † · FP n/a | R 1/3 † · FP n/a | R 1/3 † · FP n/a | R 1/3 † · FP n/a | R 1/3 † · FP n/a |

### By variety: all

Each cell: recall (flag cases caught) and benign false positives. † marks a qualified figure: its denominator (flag cases for R, benign cases for FP) is below 10, so it is too small to support a claim. n/a: the stratum has no such cases.

| Stratum | Flag / benign | Default | Expanded | Reviewed core | Reviewed + contextual | Default + evasion | Default + fuzzy | Default + evasion + fuzzy | Expanded, substring mode |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| balinese | 1 / 0 | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a |
| batak | 1 / 0 | R 0/1 † · FP n/a | R 1/1 † · FP n/a | R 0/1 † · FP n/a | R 1/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 1/1 † · FP n/a |
| betawi | 3 / 0 | R 3/3 † · FP n/a | R 3/3 † · FP n/a | R 0/3 † · FP n/a | R 3/3 † · FP n/a | R 3/3 † · FP n/a | R 3/3 † · FP n/a | R 3/3 † · FP n/a | R 3/3 † · FP n/a |
| bugis | 0 / 1 | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 0/1 † | R n/a · FP 0/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † |
| english | 0 / 1 | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 0/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † |
| general | 48 / 44 | R 32/48 · FP 11/44 | R 36/48 · FP 25/44 | R 14/48 · FP 3/44 | R 28/48 · FP 17/44 | R 37/48 · FP 11/44 | R 34/48 · FP 22/44 | R 39/48 · FP 22/44 | R 39/48 · FP 27/44 |
| javanese | 12 / 7 | R 6/12 · FP 1/7 † | R 12/12 · FP 6/7 † | R 4/12 · FP 0/7 † | R 10/12 · FP 4/7 † | R 6/12 · FP 1/7 † | R 6/12 · FP 3/7 † | R 6/12 · FP 3/7 † | R 12/12 · FP 7/7 † |
| makassar | 1 / 0 | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a |
| malay-influenced | 3 / 0 | R 3/3 † · FP n/a | R 3/3 † · FP n/a | R 3/3 † · FP n/a | R 3/3 † · FP n/a | R 3/3 † · FP n/a | R 3/3 † · FP n/a | R 3/3 † · FP n/a | R 3/3 † · FP n/a |
| minang | 1 / 0 | R 0/1 † · FP n/a | R 1/1 † · FP n/a | R 0/1 † · FP n/a | R 1/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 1/1 † · FP n/a |
| papua | 1 / 0 | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a |
| sundanese | 10 / 3 | R 9/10 · FP 2/3 † | R 10/10 · FP 3/3 † | R 3/10 · FP 0/3 † | R 6/10 · FP 2/3 † | R 9/10 · FP 2/3 † | R 10/10 · FP 3/3 † | R 10/10 · FP 3/3 † | R 10/10 · FP 3/3 † |

### By phenomenon: all

Each cell: recall (flag cases caught) and benign false positives. † marks a qualified figure: its denominator (flag cases for R, benign cases for FP) is below 10, so it is too small to support a claim. n/a: the stratum has no such cases.

| Stratum | Flag / benign | Default | Expanded | Reviewed core | Reviewed + contextual | Default + evasion | Default + fuzzy | Default + evasion + fuzzy | Expanded, substring mode |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abbreviation | 2 / 0 | R 2/2 † · FP n/a | R 2/2 † · FP n/a | R 2/2 † · FP n/a | R 2/2 † · FP n/a | R 2/2 † · FP n/a | R 2/2 † · FP n/a | R 2/2 † · FP n/a | R 2/2 † · FP n/a |
| compound | 3 / 0 | R 2/3 † · FP n/a | R 2/3 † · FP n/a | R 2/3 † · FP n/a | R 2/3 † · FP n/a | R 2/3 † · FP n/a | R 2/3 † · FP n/a | R 2/3 † · FP n/a | R 3/3 † · FP n/a |
| direct-abuse | 25 / 0 | R 22/25 · FP n/a | R 25/25 · FP n/a | R 5/25 · FP n/a | R 17/25 · FP n/a | R 22/25 · FP n/a | R 22/25 · FP n/a | R 22/25 · FP n/a | R 25/25 · FP n/a |
| friendly-exclamation | 8 / 0 | R 6/8 † · FP n/a | R 8/8 † · FP n/a | R 4/8 † · FP n/a | R 8/8 † · FP n/a | R 6/8 † · FP n/a | R 6/8 † · FP n/a | R 6/8 † · FP n/a | R 8/8 † · FP n/a |
| literal-homonym | 0 / 27 | R n/a · FP 11/27 | R n/a · FP 26/27 | R n/a · FP 2/27 | R n/a · FP 18/27 | R n/a · FP 11/27 | R n/a · FP 15/27 | R n/a · FP 15/27 | R n/a · FP 27/27 |
| multiword | 2 / 0 | R 0/2 † · FP n/a | R 0/2 † · FP n/a | R 0/2 † · FP n/a | R 0/2 † · FP n/a | R 0/2 † · FP n/a | R 0/2 † · FP n/a | R 0/2 † · FP n/a | R 0/2 † · FP n/a |
| name-or-loanword | 0 / 7 | R n/a · FP 3/7 † | R n/a · FP 7/7 † | R n/a · FP 1/7 † | R n/a · FP 4/7 † | R n/a · FP 3/7 † | R n/a · FP 4/7 † | R n/a · FP 4/7 † | R n/a · FP 7/7 † |
| near-neighbour | 0 / 14 | R n/a · FP 0/14 | R n/a · FP 0/14 | R n/a · FP 0/14 | R n/a · FP 0/14 | R n/a · FP 0/14 | R n/a · FP 8/14 | R n/a · FP 8/14 | R n/a · FP 2/14 |
| obfuscation | 11 / 0 | R 3/11 · FP n/a | R 4/11 · FP n/a | R 3/11 · FP n/a | R 4/11 · FP n/a | R 8/11 · FP n/a | R 5/11 · FP n/a | R 10/11 · FP n/a | R 6/11 · FP n/a |
| ordinary | 0 / 6 | R n/a · FP 0/6 † | R n/a · FP 1/6 † | R n/a · FP 0/6 † | R n/a · FP 0/6 † | R n/a · FP 0/6 † | R n/a · FP 1/6 † | R n/a · FP 1/6 † | R n/a · FP 1/6 † |
| quoted-or-reported | 0 / 1 | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 0/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † |
| regional-abuse | 25 / 0 | R 18/25 · FP n/a | R 25/25 · FP n/a | R 10/25 · FP n/a | R 18/25 · FP n/a | R 18/25 · FP n/a | R 19/25 · FP n/a | R 19/25 · FP n/a | R 25/25 · FP n/a |
| social-insult | 5 / 1 | R 3/5 † · FP 1/1 † | R 3/5 † · FP 1/1 † | R 0/5 † · FP 0/1 † | R 3/5 † · FP 1/1 † | R 3/5 † · FP 1/1 † | R 3/5 † · FP 1/1 † | R 3/5 † · FP 1/1 † | R 3/5 † · FP 1/1 † |

<!-- generated:tables:end -->

## Reproduce

```sh
npm run build
npm run evaluate:corpus            # print the tables
npm run evaluate:corpus -- --write # regenerate the generated blocks here and in the protocol, and evaluation/baseline.json
npm run evaluate:corpus -- --check # fail if any of them differs from the current build (runs in npm test)
```

The run is deterministic, offline and not timed. The blocks between `generated` markers are
written by the script; edit the text around them, not the blocks.
