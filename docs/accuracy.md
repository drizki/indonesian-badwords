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

103 of 142 labels have been reviewed by the maintainer, a single native-speaker reviewer; 39 are still `proposed`: drafted by an AI agent and not yet reviewed. A result that depends on a proposed label is provisional and cannot support a release-note claim (threshold T6). The tables count proposed labels like any other. 2 case texts were revised by the maintainer during review (the `revisions` field). A reviewed label is one reviewer's judgement, not ground truth.

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
| Flag / benign / uncertain | 81 / 55 / 6 |
| Dev / holdout | 107 / 35 |
| Labels proposed / reviewed | 39 / 103 |

### Cases by phenomenon and split

Each cell: flag / benign / uncertain.

| Phenomenon | Dev | Holdout |
| --- | --- | --- |
| abbreviation | 2 / 0 / 0 | 0 / 0 / 0 |
| compound | 3 / 0 / 0 | 0 / 0 / 0 |
| direct-abuse | 18 / 0 / 0 | 7 / 0 / 0 |
| friendly-exclamation | 8 / 0 / 0 | 0 / 0 / 0 |
| literal-homonym | 0 / 14 / 0 | 0 / 13 / 0 |
| multiword | 1 / 0 / 0 | 1 / 0 / 0 |
| name-or-loanword | 0 / 4 / 0 | 0 / 3 / 0 |
| near-neighbour | 0 / 14 / 0 | 0 / 0 / 0 |
| obfuscation | 11 / 0 / 0 | 0 / 0 / 0 |
| ordinary | 0 / 5 / 0 | 0 / 1 / 0 |
| quoted-or-reported | 0 / 0 / 5 | 0 / 0 / 1 |
| regional-abuse | 20 / 0 / 0 | 5 / 0 / 0 |
| social-insult | 2 / 0 / 0 | 3 / 1 / 0 |

### Cases by variety and split

Each cell: flag / benign / uncertain.

| Variety | Dev | Holdout |
| --- | --- | --- |
| balinese | 1 / 0 / 0 | 0 / 0 / 0 |
| batak | 1 / 0 / 0 | 0 / 0 / 0 |
| betawi | 2 / 0 / 0 | 1 / 0 / 0 |
| bugis | 0 / 0 / 0 | 0 / 1 / 0 |
| english | 0 / 0 / 0 | 0 / 1 / 0 |
| general | 38 / 31 / 4 | 10 / 12 / 1 |
| javanese | 10 / 3 / 1 | 2 / 4 / 0 |
| makassar | 0 / 0 / 0 | 1 / 0 / 0 |
| malay-influenced | 3 / 0 / 0 | 0 / 0 / 0 |
| minang | 1 / 0 / 0 | 0 / 0 / 0 |
| papua | 1 / 0 / 0 | 0 / 0 / 0 |
| sundanese | 8 / 3 / 0 | 2 / 0 / 0 |

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

### Results: holdout (16 flag, 18 benign)

Each cell: rate (95% Wilson interval) count/n. † marks n below 10: too small to support a claim.

| Recipe | Precision | Recall | Span recall | Benign false-positive rate |
| --- | --- | --- | --- | --- |
| Default | 55% (34%–74%) 11/20 | 69% (44%–86%) 11/16 | 69% (44%–86%) 11/16 | 50% (29%–71%) 9/18 |
| Expanded | 45% (29%–62%) 14/31 | 88% (64%–97%) 14/16 | 88% (64%–97%) 14/16 | 94% (74%–99%) 17/18 |
| Reviewed core | 100% (21%–100%) 1/1 † | 6% (1%–28%) 1/16 | 6% (1%–28%) 1/16 | 0% (0%–18%) 0/18 |
| Reviewed + contextual | 46% (28%–65%) 11/24 | 69% (44%–86%) 11/16 | 69% (44%–86%) 11/16 | 72% (49%–88%) 13/18 |
| Default + evasion | 55% (34%–74%) 11/20 | 69% (44%–86%) 11/16 | 69% (44%–86%) 11/16 | 50% (29%–71%) 9/18 |
| Default + fuzzy | 50% (31%–69%) 11/22 | 69% (44%–86%) 11/16 | 69% (44%–86%) 11/16 | 61% (39%–80%) 11/18 |
| Default + evasion + fuzzy | 50% (31%–69%) 11/22 | 69% (44%–86%) 11/16 | 69% (44%–86%) 11/16 | 61% (39%–80%) 11/18 |
| Expanded, substring mode | 45% (29%–62%) 14/31 | 88% (64%–97%) 14/16 | 88% (64%–97%) 14/16 | 94% (74%–99%) 17/18 |

### Results: dev (65 flag, 37 benign)

Each cell: rate (95% Wilson interval) count/n. † marks n below 10: too small to support a claim.

| Recipe | Precision | Recall | Span recall | Benign false-positive rate |
| --- | --- | --- | --- | --- |
| Default | 88% (77%–95%) 45/51 | 69% (57%–79%) 45/65 | 70% (58%–79%) 46/66 | 16% (8%–31%) 6/37 |
| Expanded | 75% (64%–84%) 55/73 | 85% (74%–91%) 55/65 | 85% (74%–92%) 56/66 | 49% (33%–64%) 18/37 |
| Reviewed core | 89% (73%–96%) 25/28 | 38% (28%–51%) 25/65 | 38% (27%–50%) 25/66 | 8% (3%–21%) 3/37 |
| Reviewed + contextual | 81% (69%–89%) 43/53 | 66% (54%–76%) 43/65 | 67% (55%–77%) 44/66 | 27% (15%–43%) 10/37 |
| Default + evasion | 89% (79%–95%) 50/56 | 77% (65%–85%) 50/65 | 76% (64%–84%) 50/66 | 16% (8%–31%) 6/37 |
| Default + fuzzy | 73% (61%–82%) 48/66 | 74% (62%–83%) 48/65 | 74% (63%–83%) 49/66 | 49% (33%–64%) 18/37 |
| Default + evasion + fuzzy | 75% (63%–83%) 53/71 | 82% (70%–89%) 53/65 | 82% (71%–89%) 54/66 | 49% (33%–64%) 18/37 |
| Expanded, substring mode | 73% (63%–82%) 58/79 | 89% (79%–95%) 58/65 | 85% (74%–92%) 56/66 | 57% (41%–71%) 21/37 |

### Results: all (81 flag, 55 benign)

Each cell: rate (95% Wilson interval) count/n. † marks n below 10: too small to support a claim.

| Recipe | Precision | Recall | Span recall | Benign false-positive rate |
| --- | --- | --- | --- | --- |
| Default | 79% (68%–87%) 56/71 | 69% (58%–78%) 56/81 | 70% (59%–78%) 57/82 | 27% (17%–40%) 15/55 |
| Expanded | 66% (57%–75%) 69/104 | 85% (76%–91%) 69/81 | 85% (76%–91%) 70/82 | 64% (50%–75%) 35/55 |
| Reviewed core | 90% (74%–96%) 26/29 | 32% (23%–43%) 26/81 | 32% (23%–42%) 26/82 | 5% (2%–15%) 3/55 |
| Reviewed + contextual | 70% (59%–79%) 54/77 | 67% (56%–76%) 54/81 | 67% (56%–76%) 55/82 | 42% (30%–55%) 23/55 |
| Default + evasion | 80% (70%–88%) 61/76 | 75% (65%–83%) 61/81 | 74% (64%–83%) 61/82 | 27% (17%–40%) 15/55 |
| Default + fuzzy | 67% (57%–76%) 59/88 | 73% (62%–81%) 59/81 | 73% (63%–82%) 60/82 | 53% (40%–65%) 29/55 |
| Default + evasion + fuzzy | 69% (59%–77%) 64/93 | 79% (69%–86%) 64/81 | 79% (69%–87%) 65/82 | 53% (40%–65%) 29/55 |
| Expanded, substring mode | 65% (56%–74%) 72/110 | 89% (80%–94%) 72/81 | 85% (76%–91%) 70/82 | 69% (56%–80%) 38/55 |

### Wrong cases (all splits)

| Recipe | Benign flagged | Flag missed | Flagged with different spans |
| --- | --- | --- | --- |
| Default | `lit-coli-ecoli`, `lit-tai-chi`, `lit-tai-lalat`, `lit-bodo-baju`, `lit-bodo-amat`, `lit-ewe-domba`, `lit-ewe-english`, `lit-cibay-jajanan`, `lit-koplok-telinga`, `lit-gebleg-jual`, `lit-bangsat-kutu`, `lit-idiot-savant`, `social-saya-bodoh`, `lit-pepek-lengkap`, `lit-sontoloyo-penggembala` | `reg-asu-tenan`, `reg-ndasmu-mikir`, `reg-matamu-ngawur`, `reg-anjing-sia`, `reg-bodat-kau`, `reg-pantek-minang`, `abuse-kampret-lu`, `phrase-anak-setan`, `phrase-anak-haram`, `compound-bangsatlah`, `obf-goblokkk-stretched`, `obf-goblok-hyphen`, `obf-kontol-spaced`, `obf-anjing-dots`, `obf-anjing-stretched`, `obf-anjing-leet`, `obf-kontol-cyrillic`, `obf-ngentot-stretched`, `friendly-cuk-mangan`, `friendly-edan-apik`, `social-otak-udang`, `social-muka-tembok`, `abuse-bengek-dasar`, `abuse-cepu-ngadu`, `reg-nggateli-kowe` | none |
| Expanded | `lit-coli-ecoli`, `lit-tai-chi`, `lit-tai-lalat`, `lit-tahi-lalat`, `lit-bodo-baju`, `lit-bodo-amat`, `lit-ewe-domba`, `lit-ewe-english`, `lit-cibay-jajanan`, `lit-koplok-telinga`, `lit-koplo-dangdut`, `lit-gebleg-jual`, `lit-bct-bus`, `lit-asw-kapal`, `lit-bangsat-kutu`, `lit-jangkrik-semalaman`, `lit-kirik-menyusu`, `lit-matamu-merah`, `lit-anjing-tetangga`, `lit-monyet-uluwatu`, `lit-celeng-kebun`, `lit-sampah-plastik`, `lit-jurig-sunda`, `lit-idiot-savant`, `social-saya-bodoh`, `lit-pepek-lengkap`, `lit-sontoloyo-penggembala`, `lit-benges-lipstik`, `lit-buntal-ikan`, `lit-cepu-stasiun`, `ord-cilaka-dompet`, `lit-jambret-warga`, `lit-mewek-adik`, `lit-nggateli-kaos`, `lit-cibrit-diare` | `phrase-anak-setan`, `phrase-anak-haram`, `compound-bangsatlah`, `obf-goblokkk-stretched`, `obf-goblok-hyphen`, `obf-kontol-spaced`, `obf-anjing-dots`, `obf-anjing-stretched`, `obf-kontol-cyrillic`, `obf-ngentot-stretched`, `social-otak-udang`, `social-muka-tembok` | none |
| Reviewed core | `lit-tai-chi`, `lit-tai-lalat`, `lit-bangsat-kutu` | `reg-asu-tenan`, `reg-ndasmu-mikir`, `reg-matamu-ngawur`, `reg-anjing-sia`, `reg-naskeleng-cai`, `reg-bodat-kau`, `reg-pantek-minang`, `abuse-sontoloyo`, `abuse-kampret-lu`, `phrase-anak-setan`, `phrase-anak-haram`, `compound-bangsatlah`, `obf-goblokkk-stretched`, `obf-goblok-hyphen`, `obf-kontol-spaced`, `obf-anjing-dots`, `obf-anjing-stretched`, `obf-anjing-leet`, `obf-kontol-cyrillic`, `obf-ngentot-stretched`, `friendly-cuk-mangan`, `friendly-bujug-buset`, `friendly-edan-apik`, `social-pelakor-tahu-diri`, `social-kamu-bodoh`, `social-otak-udang`, `social-muka-tembok`, `social-dasar-idiot`, `abuse-coli-kamar`, `abuse-ewe-ajak`, `abuse-cibay-nipu`, `reg-koplok-siah`, `abuse-pecun-dasar`, `abuse-pepek-lu`, `reg-heunceut-siah`, `reg-balegug-maneh`, `reg-bedegong-siah`, `abuse-bodo-dasar`, `abuse-kemplu-dasar`, `reg-gebleh-kowe`, `abuse-tolir-dasar`, `reg-tiembokne-ngapusi`, `abuse-gebleg-kabur`, `abuse-cibai-motor`, `abuse-ewean-chat`, `abuse-bispak-cewek`, `abuse-sinting-dasar`, `abuse-nyepong-om`, `abuse-sepong-sana`, `abuse-ngehe-telat`, `friendly-araranjay-telat`, `reg-goblik-siah`, `abuse-bengek-dasar`, `abuse-cepu-ngadu`, `reg-nggateli-kowe` | none |
| Reviewed + contextual | `lit-coli-ecoli`, `lit-tai-chi`, `lit-tai-lalat`, `lit-tahi-lalat`, `lit-ewe-domba`, `lit-ewe-english`, `lit-koplok-telinga`, `lit-koplo-dangdut`, `lit-bct-bus`, `lit-bangsat-kutu`, `lit-jangkrik-semalaman`, `lit-kirik-menyusu`, `lit-matamu-merah`, `lit-anjing-tetangga`, `lit-monyet-uluwatu`, `lit-celeng-kebun`, `lit-sampah-plastik`, `lit-jurig-sunda`, `lit-idiot-savant`, `social-saya-bodoh`, `lit-pepek-lengkap`, `lit-sontoloyo-penggembala`, `lit-nggateli-kaos` | `reg-naskeleng-cai`, `phrase-anak-setan`, `phrase-anak-haram`, `compound-bangsatlah`, `obf-goblokkk-stretched`, `obf-goblok-hyphen`, `obf-kontol-spaced`, `obf-anjing-dots`, `obf-anjing-stretched`, `obf-kontol-cyrillic`, `obf-ngentot-stretched`, `social-otak-udang`, `social-muka-tembok`, `abuse-cibay-nipu`, `reg-heunceut-siah`, `reg-balegug-maneh`, `reg-bedegong-siah`, `abuse-bodo-dasar`, `abuse-kemplu-dasar`, `reg-gebleh-kowe`, `abuse-tolir-dasar`, `reg-tiembokne-ngapusi`, `abuse-gebleg-kabur`, `abuse-cibai-motor`, `reg-goblik-siah`, `abuse-bengek-dasar`, `abuse-cepu-ngadu` | none |
| Default + evasion | `lit-coli-ecoli`, `lit-tai-chi`, `lit-tai-lalat`, `lit-bodo-baju`, `lit-bodo-amat`, `lit-ewe-domba`, `lit-ewe-english`, `lit-cibay-jajanan`, `lit-koplok-telinga`, `lit-gebleg-jual`, `lit-bangsat-kutu`, `lit-idiot-savant`, `social-saya-bodoh`, `lit-pepek-lengkap`, `lit-sontoloyo-penggembala` | `reg-asu-tenan`, `reg-ndasmu-mikir`, `reg-matamu-ngawur`, `reg-anjing-sia`, `reg-bodat-kau`, `reg-pantek-minang`, `abuse-kampret-lu`, `phrase-anak-setan`, `phrase-anak-haram`, `compound-bangsatlah`, `obf-anjing-stretched`, `obf-anjing-leet`, `obf-kontol-cyrillic`, `friendly-cuk-mangan`, `friendly-edan-apik`, `social-otak-udang`, `social-muka-tembok`, `abuse-bengek-dasar`, `abuse-cepu-ngadu`, `reg-nggateli-kowe` | `obf-anjing-dots` |
| Default + fuzzy | `lit-coli-ecoli`, `lit-tai-chi`, `lit-tai-lalat`, `lit-bodo-baju`, `lit-bodo-amat`, `lit-ewe-domba`, `lit-ewe-english`, `lit-cibay-jajanan`, `lit-koplok-telinga`, `lit-koplo-dangdut`, `lit-gebleg-jual`, `lit-bangsat-kutu`, `lit-anjing-tetangga`, `lit-jurig-sunda`, `lit-idiot-savant`, `near-kontrol-tv`, `near-bangsa-merdeka`, `near-kampung-garut`, `near-kanjeng-ratu`, `near-belum-tentu`, `near-meme-kocak`, `near-bangku-taman`, `near-goblin-cerita`, `ord-harga-cabai`, `social-saya-bodoh`, `lit-pepek-lengkap`, `lit-sontoloyo-penggembala`, `lit-jambret-warga`, `lit-mewek-adik` | `reg-asu-tenan`, `reg-ndasmu-mikir`, `reg-matamu-ngawur`, `reg-bodat-kau`, `reg-pantek-minang`, `abuse-kampret-lu`, `phrase-anak-setan`, `phrase-anak-haram`, `compound-bangsatlah`, `obf-goblokkk-stretched`, `obf-goblok-hyphen`, `obf-kontol-spaced`, `obf-anjing-dots`, `obf-anjing-stretched`, `obf-ngentot-stretched`, `friendly-cuk-mangan`, `friendly-edan-apik`, `social-otak-udang`, `social-muka-tembok`, `abuse-bengek-dasar`, `abuse-cepu-ngadu`, `reg-nggateli-kowe` | none |
| Default + evasion + fuzzy | `lit-coli-ecoli`, `lit-tai-chi`, `lit-tai-lalat`, `lit-bodo-baju`, `lit-bodo-amat`, `lit-ewe-domba`, `lit-ewe-english`, `lit-cibay-jajanan`, `lit-koplok-telinga`, `lit-koplo-dangdut`, `lit-gebleg-jual`, `lit-bangsat-kutu`, `lit-anjing-tetangga`, `lit-jurig-sunda`, `lit-idiot-savant`, `near-kontrol-tv`, `near-bangsa-merdeka`, `near-kampung-garut`, `near-kanjeng-ratu`, `near-belum-tentu`, `near-meme-kocak`, `near-bangku-taman`, `near-goblin-cerita`, `ord-harga-cabai`, `social-saya-bodoh`, `lit-pepek-lengkap`, `lit-sontoloyo-penggembala`, `lit-jambret-warga`, `lit-mewek-adik` | `reg-asu-tenan`, `reg-ndasmu-mikir`, `reg-matamu-ngawur`, `reg-bodat-kau`, `reg-pantek-minang`, `abuse-kampret-lu`, `phrase-anak-setan`, `phrase-anak-haram`, `compound-bangsatlah`, `obf-anjing-stretched`, `friendly-cuk-mangan`, `friendly-edan-apik`, `social-otak-udang`, `social-muka-tembok`, `abuse-bengek-dasar`, `abuse-cepu-ngadu`, `reg-nggateli-kowe` | none |
| Expanded, substring mode | `lit-coli-ecoli`, `lit-tai-chi`, `lit-tai-lalat`, `lit-tahi-lalat`, `lit-bodo-baju`, `lit-bodo-amat`, `lit-ewe-domba`, `lit-ewe-english`, `lit-cibay-jajanan`, `lit-koplok-telinga`, `lit-koplo-dangdut`, `lit-gebleg-jual`, `lit-bct-bus`, `lit-asw-kapal`, `lit-bangsat-kutu`, `lit-jangkrik-semalaman`, `lit-kirik-menyusu`, `lit-matamu-merah`, `lit-anjing-tetangga`, `lit-monyet-uluwatu`, `lit-celeng-kebun`, `lit-sampah-plastik`, `lit-jurig-sunda`, `lit-idiot-savant`, `near-petai-pantai`, `near-kanjeng-ratu`, `social-saya-bodoh`, `lit-pepek-lengkap`, `lit-sontoloyo-penggembala`, `lit-bengek-asma`, `lit-benges-lipstik`, `lit-buntal-ikan`, `lit-cepu-stasiun`, `ord-cilaka-dompet`, `lit-jambret-warga`, `lit-mewek-adik`, `lit-nggateli-kaos`, `lit-cibrit-diare` | `phrase-anak-setan`, `phrase-anak-haram`, `obf-goblok-hyphen`, `obf-kontol-spaced`, `obf-anjing-dots`, `obf-kontol-cyrillic`, `obf-ngentot-stretched`, `social-otak-udang`, `social-muka-tembok` | `compound-bangsatlah`, `obf-goblokkk-stretched`, `obf-anjing-stretched`, `abuse-cibai-motor`, `abuse-bispak-cewek` |

### Uncertain cases (reported apart, never in precision or recall)

| Recipe | Flagged | Cases flagged |
| --- | --- | --- |
| Default | 5/6 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi`, `quote-bodoh-kbbi`, `quote-pelakor-berita` |
| Expanded | 6/6 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi`, `quote-anjing-panggil`, `quote-bodoh-kbbi`, `quote-pelakor-berita` |
| Reviewed core | 3/6 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi` |
| Reviewed + contextual | 6/6 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi`, `quote-anjing-panggil`, `quote-bodoh-kbbi`, `quote-pelakor-berita` |
| Default + evasion | 5/6 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi`, `quote-bodoh-kbbi`, `quote-pelakor-berita` |
| Default + fuzzy | 6/6 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi`, `quote-anjing-panggil`, `quote-bodoh-kbbi`, `quote-pelakor-berita` |
| Default + evasion + fuzzy | 6/6 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi`, `quote-anjing-panggil`, `quote-bodoh-kbbi`, `quote-pelakor-berita` |
| Expanded, substring mode | 6/6 | `quote-goblok-guru`, `quote-jancuk-kata`, `quote-bangsat-polisi`, `quote-anjing-panggil`, `quote-bodoh-kbbi`, `quote-pelakor-berita` |

### By variety: holdout

Each cell: recall (flag cases caught) and benign false positives. † marks a qualified figure: its denominator (flag cases for R, benign cases for FP) is below 10, so it is too small to support a claim. n/a: the stratum has no such cases.

| Stratum | Flag / benign | Default | Expanded | Reviewed core | Reviewed + contextual | Default + evasion | Default + fuzzy | Default + evasion + fuzzy | Expanded, substring mode |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| betawi | 1 / 0 | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 0/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a |
| bugis | 0 / 1 | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 0/1 † | R n/a · FP 0/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † |
| english | 0 / 1 | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 0/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † |
| general | 10 / 12 | R 7/10 · FP 7/12 | R 8/10 · FP 11/12 | R 0/10 · FP 0/12 | R 6/10 · FP 9/12 | R 7/10 · FP 7/12 | R 7/10 · FP 8/12 | R 7/10 · FP 8/12 | R 8/10 · FP 11/12 |
| javanese | 2 / 4 | R 0/2 † · FP 0/4 † | R 2/2 † · FP 4/4 † | R 0/2 † · FP 0/4 † | R 2/2 † · FP 3/4 † | R 0/2 † · FP 0/4 † | R 0/2 † · FP 1/4 † | R 0/2 † · FP 1/4 † | R 2/2 † · FP 4/4 † |
| makassar | 1 / 0 | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a |
| sundanese | 2 / 0 | R 2/2 † · FP n/a | R 2/2 † · FP n/a | R 0/2 † · FP n/a | R 1/2 † · FP n/a | R 2/2 † · FP n/a | R 2/2 † · FP n/a | R 2/2 † · FP n/a | R 2/2 † · FP n/a |

### By phenomenon: holdout

Each cell: recall (flag cases caught) and benign false positives. † marks a qualified figure: its denominator (flag cases for R, benign cases for FP) is below 10, so it is too small to support a claim. n/a: the stratum has no such cases.

| Stratum | Flag / benign | Default | Expanded | Reviewed core | Reviewed + contextual | Default + evasion | Default + fuzzy | Default + evasion + fuzzy | Expanded, substring mode |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| direct-abuse | 7 / 0 | R 6/7 † · FP n/a | R 7/7 † · FP n/a | R 0/7 † · FP n/a | R 5/7 † · FP n/a | R 6/7 † · FP n/a | R 6/7 † · FP n/a | R 6/7 † · FP n/a | R 7/7 † · FP n/a |
| literal-homonym | 0 / 13 | R n/a · FP 6/13 | R n/a · FP 13/13 | R n/a · FP 0/13 | R n/a · FP 10/13 | R n/a · FP 6/13 | R n/a · FP 7/13 | R n/a · FP 7/13 | R n/a · FP 13/13 |
| multiword | 1 / 0 | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a |
| name-or-loanword | 0 / 3 | R n/a · FP 2/3 † | R n/a · FP 3/3 † | R n/a · FP 0/3 † | R n/a · FP 2/3 † | R n/a · FP 2/3 † | R n/a · FP 3/3 † | R n/a · FP 3/3 † | R n/a · FP 3/3 † |
| ordinary | 0 / 1 | R n/a · FP 0/1 † | R n/a · FP 0/1 † | R n/a · FP 0/1 † | R n/a · FP 0/1 † | R n/a · FP 0/1 † | R n/a · FP 0/1 † | R n/a · FP 0/1 † | R n/a · FP 0/1 † |
| regional-abuse | 5 / 0 | R 3/5 † · FP n/a | R 5/5 † · FP n/a | R 1/5 † · FP n/a | R 4/5 † · FP n/a | R 3/5 † · FP n/a | R 3/5 † · FP n/a | R 3/5 † · FP n/a | R 5/5 † · FP n/a |
| social-insult | 3 / 1 | R 2/3 † · FP 1/1 † | R 2/3 † · FP 1/1 † | R 0/3 † · FP 0/1 † | R 2/3 † · FP 1/1 † | R 2/3 † · FP 1/1 † | R 2/3 † · FP 1/1 † | R 2/3 † · FP 1/1 † | R 2/3 † · FP 1/1 † |

### By variety: all

Each cell: recall (flag cases caught) and benign false positives. † marks a qualified figure: its denominator (flag cases for R, benign cases for FP) is below 10, so it is too small to support a claim. n/a: the stratum has no such cases.

| Stratum | Flag / benign | Default | Expanded | Reviewed core | Reviewed + contextual | Default + evasion | Default + fuzzy | Default + evasion + fuzzy | Expanded, substring mode |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| balinese | 1 / 0 | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a | R 1/1 † · FP n/a |
| batak | 1 / 0 | R 0/1 † · FP n/a | R 1/1 † · FP n/a | R 0/1 † · FP n/a | R 1/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 0/1 † · FP n/a | R 1/1 † · FP n/a |
| betawi | 3 / 0 | R 3/3 † · FP n/a | R 3/3 † · FP n/a | R 0/3 † · FP n/a | R 3/3 † · FP n/a | R 3/3 † · FP n/a | R 3/3 † · FP n/a | R 3/3 † · FP n/a | R 3/3 † · FP n/a |
| bugis | 0 / 1 | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 0/1 † | R n/a · FP 0/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † |
| english | 0 / 1 | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 0/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † | R n/a · FP 1/1 † |
| general | 48 / 43 | R 32/48 · FP 10/43 | R 36/48 · FP 24/43 | R 14/48 · FP 3/43 | R 28/48 · FP 16/43 | R 37/48 · FP 10/43 | R 34/48 · FP 21/43 | R 39/48 · FP 21/43 | R 39/48 · FP 26/43 |
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
