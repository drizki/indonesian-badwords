// Baseline for the evaluation corpus (#23).
//   node scripts/evaluate-corpus.mjs            print the report
//   node scripts/evaluate-corpus.mjs --write    regenerate evaluation/baseline.json and the tables in docs/accuracy.md
//   node scripts/evaluate-corpus.mjs --check    fail if either file differs from what the current build computes
// Deterministic, offline and not timed. Run `npm run build` first (npm run evaluate:corpus does).
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Badwords, expandedDictionary } from '../dist/esm/index.js';
import { boundedEvasion, latinLookalikes } from '../dist/esm/evasion.js';
import { boundedFuzzy } from '../dist/esm/fuzzy.js';
import { reviewedDictionary, reviewedExpandedDictionary } from '../dist/esm/metadata.js';
import { loadCorpus, runCorpus, validateCorpus, QUALIFIED_FLOOR } from './corpus-eval.mjs';

export const baselineUrl = new URL('../evaluation/baseline.json', import.meta.url);
export const pageUrl = new URL('../docs/accuracy.md', import.meta.url);
const START = '<!-- accuracy:generated:start -->';
const END = '<!-- accuracy:generated:end -->';

/** Each recipe is copied from the documentation named in `source`. */
export const recipes = [
  { id: 'default', label: 'Default', source: 'docs/guides/dictionaries.md, "Default or expanded"', make: () => new Badwords() },
  { id: 'expanded', label: 'Expanded', source: 'docs/guides/dictionaries.md, "Default or expanded"', make: () => new Badwords({ dictionary: expandedDictionary }) },
  { id: 'reviewed', label: 'Reviewed core', source: 'docs/metadata.md, "Selection rules" (`reviewedDictionary`, the default selection)', make: () => new Badwords({ dictionary: reviewedDictionary }) },
  { id: 'reviewed-expanded', label: 'Reviewed + contextual', source: 'docs/metadata.md, "Selection rules" (`reviewedExpandedDictionary`)', make: () => new Badwords({ dictionary: reviewedExpandedDictionary }) },
  {
    id: 'evasion', label: 'Default + evasion', source: 'docs/guides/evasion.md, first recipe',
    make: () => new Badwords({ evasion: boundedEvasion({ separators: { characters: [' ', '.', '_', '-'], maxGap: 1, maxTotal: 8 }, repetitions: { maxExtraPerLetter: 2, maxTotal: 8 }, confusables: { mappings: latinLookalikes, maxTotal: 2 } }) }),
  },
  { id: 'fuzzy', label: 'Default + fuzzy', source: 'docs/guides/fuzzy-matching.md and docs/guides/evaluation.md (`boundedFuzzy({ model: \'osa\', maxEdits: 1 })`)', make: () => new Badwords({ fuzzy: boundedFuzzy({ model: 'osa', maxEdits: 1 }) }) },
  { id: 'substring', label: 'Expanded, substring mode', source: 'docs/api.md, "Substring mode"', make: () => new Badwords({ dictionary: expandedDictionary, mode: 'substring' }) },
];

export function buildBaseline(corpus = loadCorpus()) {
  const problems = validateCorpus(corpus);
  if (problems.length) throw new Error(`Invalid corpus:\n${problems.join('\n')}`);
  const count = (pick) => corpus.cases.filter(pick).length;
  return {
    schemaVersion: 1,
    qualifiedFloor: QUALIFIED_FLOOR,
    corpus: {
      schemaVersion: corpus.schemaVersion,
      cases: corpus.cases.length,
      byLabel: { flag: count(c => c.label === 'flag'), benign: count(c => c.label === 'benign'), uncertain: count(c => c.label === 'uncertain') },
      byLabelStatus: { proposed: count(c => c.labelStatus === 'proposed'), reviewed: count(c => c.labelStatus === 'reviewed') },
      bySplit: { dev: count(c => c.split === 'dev'), holdout: count(c => c.split === 'holdout') },
      strata: Object.fromEntries(['phenomenon', 'variety'].map(key => [key, [...new Set(corpus.cases.map(c => `${c[key]}\u0000${c.split}`))].sort().map(pair => {
        const [name, split] = pair.split('\u0000');
        const inStratum = corpus.cases.filter(c => c[key] === name && c.split === split);
        return { name, split, flag: inStratum.filter(c => c.label === 'flag').length, benign: inStratum.filter(c => c.label === 'benign').length, uncertain: inStratum.filter(c => c.label === 'uncertain').length };
      })])),
      review: corpus.review,
    },
    recipes: recipes.map(({ id, label, source, make }) => ({ id, label, source, ...runCorpus(make(), corpus) })),
  };
}

const pct = v => (v === null ? 'n/a' : `${Math.round(v * 100)}%`);
const cell = r => (r.n === 0 ? 'n/a' : `${pct(r.value)} (${pct(r.low)}–${pct(r.high)}) ${r.count}/${r.n}`);
const ids = list => (list.length ? list.map(id => `\`${id}\``).join(', ') : 'none');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n');

export function renderTables(baseline) {
  const { corpus, recipes: results } = baseline;
  const out = [];
  out.push(`### Corpus\n\n${table(['', 'Cases'], [
    ['All', corpus.cases], ['Flag / benign / uncertain', `${corpus.byLabel.flag} / ${corpus.byLabel.benign} / ${corpus.byLabel.uncertain}`],
    ['Dev / holdout', `${corpus.bySplit.dev} / ${corpus.bySplit.holdout}`], ['Labels still proposed / reviewed', `${corpus.byLabelStatus.proposed} / ${corpus.byLabelStatus.reviewed}`],
  ])}`);
  for (const [title, key] of [['phenomenon', 'phenomenon'], ['variety', 'variety']]) {
    const names = [...new Set(corpus.strata[key].map(s => s.name))].sort();
    const at = (name, split) => corpus.strata[key].find(s => s.name === name && s.split === split) ?? { flag: 0, benign: 0, uncertain: 0 };
    out.push(`### Cases by ${title} and split\n\nEach cell: flag / benign / uncertain.\n\n${table([title[0].toUpperCase() + title.slice(1), 'Dev', 'Holdout'], names.map(name => [name, ...['dev', 'holdout'].map(split => { const s = at(name, split); return `${s.flag} / ${s.benign} / ${s.uncertain}`; })]))}`);
  }
  out.push(`### Recipes\n\n${table(['Recipe', 'Id', 'Taken from'], results.map(r => [r.label, `\`${r.id}\``, r.source]))}`);
  for (const split of ['holdout', 'dev', 'all']) {
    const first = results[0].splits[split];
    out.push(`### Results: ${split} (${first.flag} flag, ${first.benign} benign)\n\n${table(['Recipe', 'Precision', 'Recall', 'Span recall', 'Benign false-positive rate'], results.map(r => {
      const s = r.splits[split];
      return [r.label, cell(s.precision), cell(s.recall), cell(s.spanRecall), cell(s.falsePositiveRate)];
    }))}`);
  }
  out.push(`### Wrong cases (all splits)\n\n${table(['Recipe', 'Benign flagged', 'Flag missed', 'Flagged with different spans'], results.map(r => {
    const f = r.splits.all.failures;
    return [r.label, ids(f.falsePositives), ids(f.falseNegatives), ids(f.spanMismatches)];
  }))}`);
  out.push(`### Uncertain cases (reported apart, never in precision or recall)\n\n${table(['Recipe', 'Flagged', 'Cases flagged'], results.map(r => [r.label, `${r.uncertain.flagged}/${r.uncertain.n}`, ids(r.uncertain.ids)]))}`);
  for (const split of ['holdout', 'all']) {
    for (const [title, key] of [['variety', 'varieties'], ['phenomenon', 'phenomena']]) {
      const names = [...new Set(results.flatMap(r => Object.keys(r.splits[split][key])))].sort();
      out.push(`### By ${title}: ${split}\n\nEach cell: recall (flag cases caught) and benign false positives. † marks a qualified figure: its denominator (flag cases for R, benign cases for FP) is below ${QUALIFIED_FLOOR}, so it is too small to support a claim.\n\n${table(['Stratum', 'Flag / benign', ...results.map(r => r.label)], names.map(name => {
        const base = results[0].splits[split][key][name];
        return [name, `${base.flag} / ${base.benign}`, ...results.map(r => { const s = r.splits[split][key][name]; return `R ${s.recall.count}/${s.recall.n}${s.recallQualified ? ' †' : ''} · FP ${s.falsePositiveRate.count}/${s.falsePositiveRate.n}${s.fprQualified ? ' †' : ''}`; })];
      }))}`);
    }
  }
  return out.join('\n\n');
}

export function renderPage(baseline, page = readFileSync(pageUrl, 'utf8')) {
  const a = page.indexOf(START);
  const b = page.indexOf(END);
  if (a < 0 || b < a) throw new Error(`docs/accuracy.md needs ${START} and ${END} markers`);
  return `${page.slice(0, a + START.length)}\n\n${renderTables(baseline)}\n\n${page.slice(b)}`;
}

/** Problems found when the committed baseline or page differ from what this build computes. */
export function checkBaseline() {
  const baseline = buildBaseline();
  const problems = [];
  if (readFileSync(baselineUrl, 'utf8') !== `${JSON.stringify(baseline, null, 2)}\n`) problems.push('evaluation/baseline.json is out of date');
  if (readFileSync(pageUrl, 'utf8') !== renderPage(baseline)) problems.push('docs/accuracy.md tables are out of date');
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [flag] = process.argv.slice(2);
  if (flag === '--check') {
    const problems = checkBaseline();
    if (problems.length) { console.error(`${problems.join('\n')}\nRun: npm run evaluate:corpus -- --write`); process.exit(1); }
    console.log('Corpus baseline is current.');
  } else {
    const baseline = buildBaseline();
    if (flag === '--write') {
      writeFileSync(baselineUrl, `${JSON.stringify(baseline, null, 2)}\n`);
      writeFileSync(pageUrl, renderPage(baseline));
      console.log('Wrote evaluation/baseline.json and docs/accuracy.md.');
    } else console.log(renderTables(baseline));
  }
}
