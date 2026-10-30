// Baseline for the evaluation corpus (#23).
//   node scripts/evaluate-corpus.mjs            print the report
//   node scripts/evaluate-corpus.mjs --write    regenerate evaluation/baseline.json and the generated blocks in docs/accuracy.md and docs/evaluation-protocol.md
//   node scripts/evaluate-corpus.mjs --check    fail if any of them differs from what the current build computes
// Deterministic, offline and not timed. Run `npm run build` first (npm run evaluate:corpus does).
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Badwords, expandedDictionary } from '../dist/esm/index.js';
import { boundedEvasion, latinLookalikes } from '../dist/esm/evasion.js';
import { boundedFuzzy } from '../dist/esm/fuzzy.js';
import { evaluate } from '../dist/esm/evaluate.js';
import { reviewedDictionary, reviewedExpandedDictionary } from '../dist/esm/metadata.js';
import { loadCorpus, runCorpus, splitReport, validateCorpus, writeFileAtomic, QUALIFIED_FLOOR, SALT } from './corpus-eval.mjs';

export const baselineUrl = new URL('../evaluation/baseline.json', import.meta.url);
export const pageUrl = new URL('../docs/accuracy.md', import.meta.url);
export const protocolUrl = new URL('../docs/evaluation-protocol.md', import.meta.url);

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
  { id: 'fuzzy', label: 'Default + fuzzy', source: 'README.md, "Catch disguised spellings and typos" (its `fuzzy` option on the default dictionary)', make: () => new Badwords({ fuzzy: boundedFuzzy({ model: 'osa', maxEdits: 1 }) }) },
  {
    id: 'tolerant', label: 'Default + evasion + fuzzy', source: 'README.md, "Catch disguised spellings and typos" (`tolerant`, copied unchanged)',
    make: () => new Badwords({
      fuzzy: boundedFuzzy({ model: 'osa', maxEdits: 1 }),
      evasion: boundedEvasion({
        separators: { characters: [' ', '.', '_', '-'], maxGap: 1, maxTotal: 8 },
        repetitions: { maxExtraPerLetter: 2, maxTotal: 8 },
        confusables: { mappings: latinLookalikes, maxTotal: 2 },
      }),
    }),
  },
  { id: 'substring', label: 'Expanded, substring mode', source: 'docs/api.md, "Substring mode"', make: () => new Badwords({ dictionary: expandedDictionary, mode: 'substring' }) },
];

/** The terms in #56's keep / guard / remove lists (read from the issue on 2026-10-30), to show which have evidence cases. */
export const ISSUE_56_TERMS = [
  ['GUARD', ['cibay', 'coli', 'ewe', 'pecun', 'pelakor', 'sontoloyo', 'bodoh', 'idiot', 'koplok', 'pepek', 'heunceut', 'balegug', 'bedegong', 'tai']],
  ['REMOVE (default list)', ['bodo', 'kemplu', 'gebleh', 'tolir', 'tiembokne']],
  ['REMOVE (expanded list)', ['cibrit', 'mukil', 'bengek', 'benges', 'buntal', 'cepu', 'cilaka', 'jambret', 'mewek', 'nggateli']],
  ['KEEP', ['gebleg', 'cibai', 'ewean', 'bispak', 'sinting', 'nyepong', 'sepong', 'bujug', 'buset', 'ngehe', 'araranjay', 'goblik', 'ngentu', 'ngentd', 'kontil', 'cukimak', 'wancok', 'dyancok', 'colai', 'colay']],
];

function issue56Coverage(corpus) {
  return ISSUE_56_TERMS.flatMap(([decision, terms]) => terms.map(term => {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${term}`, 'iu');
    const has = corpus.cases.filter(c => pattern.test(c.text));
    return { term, decision, flag: has.filter(c => c.label === 'flag').length, benign: has.filter(c => c.label === 'benign').length, uncertain: has.filter(c => c.label === 'uncertain').length };
  }));
}

/** Upper end of the 95% interval for 0 false positives in `n` benign cases, from evaluate() itself. */
function zeroOfNUpper(n) {
  const cases = Array.from({ length: n }, (_, i) => ({ text: `x${i}`, expected: false }));
  return Math.round(evaluate({ find: () => [] }, cases).falsePositiveRate.high * 1000) / 1000;
}

const dropDevDetail = result => {
  const { splits, uncertain } = result;
  const compact = {};
  for (const [name, s] of Object.entries(splits)) {
    const { failures, varieties, phenomena, ...overall } = s;
    compact[name] = name === 'dev' ? overall : name === 'holdout' ? { ...overall, varieties, phenomena } : { ...overall, failures, varieties, phenomena };
  }
  return { splits: compact, uncertain };
};

export function buildBaseline(corpus = loadCorpus(), recipeList = recipes) {
  const problems = validateCorpus(corpus);
  if (problems.length) throw new Error(`Invalid corpus:\n${problems.join('\n')}`);
  const count = pick => corpus.cases.filter(pick).length;
  const inSplit = split => ({ flag: count(c => c.split === split && c.label === 'flag'), benign: count(c => c.split === split && c.label === 'benign'), uncertain: count(c => c.split === split && c.label === 'uncertain') });
  const report = splitReport(corpus);
  return {
    schemaVersion: 2,
    qualifiedFloor: QUALIFIED_FLOOR,
    corpus: {
      schemaVersion: corpus.schemaVersion,
      salt: SALT,
      cases: corpus.cases.length,
      byLabel: { flag: count(c => c.label === 'flag'), benign: count(c => c.label === 'benign'), uncertain: count(c => c.label === 'uncertain') },
      byLabelStatus: { proposed: count(c => c.labelStatus === 'proposed'), reviewed: count(c => c.labelStatus === 'reviewed') },
      revised: count(c => Array.isArray(c.revisions)),
      bySplit: { dev: count(c => c.split === 'dev'), holdout: count(c => c.split === 'holdout') },
      scoredBySplit: { dev: inSplit('dev'), holdout: inSplit('holdout') },
      splitGaps: report.gaps,
      zeroOfFloorUpper: zeroOfNUpper(QUALIFIED_FLOOR),
      issue56: issue56Coverage(corpus),
      strata: Object.fromEntries(['phenomenon', 'variety'].map(key => [key, [...new Set(corpus.cases.map(c => `${c[key]}\u0000${c.split}`))].sort().map(pairKey => {
        const [name, split] = pairKey.split('\u0000');
        const inStratum = corpus.cases.filter(c => c[key] === name && c.split === split);
        return { name, split, flag: inStratum.filter(c => c.label === 'flag').length, benign: inStratum.filter(c => c.label === 'benign').length, uncertain: inStratum.filter(c => c.label === 'uncertain').length };
      })])),
      review: corpus.review,
    },
    recipes: recipeList.map(({ id, label, source, make }) => ({ id, label, source, ...dropDevDetail(runCorpus(make(), corpus)) })),
  };
}

/** JSON with objects and arrays kept on one line when they fit, so the file stays small and a change is a short diff. */
export function formatBaseline(value, depth = 0, width = 150) {
  const inline = JSON.stringify(value);
  if (inline === undefined || typeof value !== 'object' || value === null || inline.length <= width) return inline;
  const pad = '  '.repeat(depth + 1);
  const close = '  '.repeat(depth);
  if (Array.isArray(value)) return `[\n${value.map(item => pad + formatBaseline(item, depth + 1, width)).join(',\n')}\n${close}]`;
  return `{\n${Object.entries(value).map(([key, item]) => `${pad}${JSON.stringify(key)}: ${formatBaseline(item, depth + 1, width)}`).join(',\n')}\n${close}}`;
}
export const baselineText = baseline => `${formatBaseline(baseline)}\n`;

const pct = v => (v === null ? 'n/a' : `${Math.round(v * 100)}%`);
const flagBelow = n => (n < QUALIFIED_FLOOR ? ' †' : '');
const cell = r => (r.n === 0 ? 'n/a' : `${pct(r.value)} (${pct(r.low)}–${pct(r.high)}) ${r.count}/${r.n}${flagBelow(r.n)}`);
const stratumCell = (label, r) => (r.n === 0 ? `${label} n/a` : `${label} ${r.count}/${r.n}${flagBelow(r.n)}`);
const ids = list => (list.length ? list.map(id => `\`${id}\``).join(', ') : 'none');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n');
const points = (denominator) => (denominator ? `${(100 / denominator).toFixed(1)} points` : 'not defined (no cases)');

/** The label-status wording is derived from the counts, so it changes by itself as labels are reviewed. */
export function statusSentence(corpus) {
  const { cases, byLabelStatus: { proposed, reviewed }, revised } = corpus;
  const who = 'the maintainer, a single native-speaker reviewer';
  const lead = proposed === 0
    ? `All ${cases} labels have been reviewed by ${who}.`
    : `${reviewed} of ${cases} labels have been reviewed by ${who}; ${proposed} are still \`proposed\`: drafted by an AI agent and not yet reviewed. A result that depends on a proposed label is provisional and cannot support a release-note claim (threshold T6). The tables count proposed labels like any other.`;
  const revisions = revised ? ` ${revised} case text${revised === 1 ? ' was' : 's were'} revised by the maintainer during review (the \`revisions\` field).` : '';
  return `${lead}${revisions} A reviewed label is one reviewer's judgement, not ground truth.`;
}

function renderStatus(baseline) { return statusSentence(baseline.corpus); }

function renderSizes(baseline) {
  const { corpus } = baseline;
  const { dev, holdout } = corpus.scoredBySplit;
  const gaps = corpus.splitGaps.length
    ? `Phenomena with two or more families that are missing from one split at salt ${corpus.salt}: ${corpus.splitGaps.map(g => `\`${g.phenomenon}\` (${g.families} families, none in ${g.missingFrom})`).join(', ')}. The salt is pinned, so these are reported here, not repaired; results for them rest on one split only.`
    : `Every phenomenon with two or more families appears in both splits at salt ${corpus.salt}.`;
  return [
    `Generated from the corpus (salt ${corpus.salt}):`,
    '',
    table(['', 'Flag', 'Benign', 'Uncertain'], [['Dev', dev.flag, dev.benign, dev.uncertain], ['Holdout', holdout.flag, holdout.benign, holdout.uncertain]]),
    '',
    `- Let F = ${holdout.flag} (scored holdout flag cases) and B = ${holdout.benign} (scored holdout benign cases). One extra holdout false positive moves the holdout false-positive rate by 100/B = ${points(holdout.benign)}. One holdout flag case that stops being flagged moves holdout recall by 100/F = ${points(holdout.flag)}.`,
    `- The qualification floor is ${baseline.qualifiedFloor}. At n = ${baseline.qualifiedFloor} the 95% Wilson interval for 0 of ${baseline.qualifiedFloor} still runs up to ${Math.round(corpus.zeroOfFloorUpper * 100)}%.`,
    `- ${gaps}`,
  ].join('\n');
}

function renderCoverage(baseline) {
  const rows = baseline.corpus.issue56;
  const groups = [...new Set(rows.map(r => r.decision))];
  const none = rows.filter(r => !r.flag && !r.benign && !r.uncertain).map(r => `\`${r.term}\``);
  const guardNoBenign = rows.filter(r => r.decision === 'GUARD' && !r.benign).map(r => `\`${r.term}\``);
  const keepNoFlag = rows.filter(r => r.decision === 'KEEP' && !r.flag).map(r => `\`${r.term}\``);
  const present = rows.filter(r => r.flag || r.benign || r.uncertain).length;
  return [
    `Cases whose text contains the term at a word start, from the corpus (${present} of ${rows.length} terms have at least one case). Cell: flag / benign / uncertain.`,
    '',
    table(['#56 decision', 'Terms (flag / benign / uncertain)'], groups.map(group => [group, rows.filter(r => r.decision === group).map(r => `\`${r.term}\` ${r.flag}/${r.benign}/${r.uncertain}`).join(', ')])),
    '',
    `- No case at all: ${none.length ? none.join(', ') : 'none'}.`,
    `- GUARD terms with no benign case (the harmless use the guard is for is not yet evidenced): ${guardNoBenign.length ? guardNoBenign.join(', ') : 'none'}.`,
    `- KEEP terms with no flag case: ${keepNoFlag.length ? keepNoFlag.join(', ') : 'none'}.`,
  ].join('\n');
}

export function renderTables(baseline) {
  const { corpus, recipes: results } = baseline;
  const out = [];
  out.push(`### Corpus\n\n${table(['', 'Cases'], [
    ['All', corpus.cases], ['Flag / benign / uncertain', `${corpus.byLabel.flag} / ${corpus.byLabel.benign} / ${corpus.byLabel.uncertain}`],
    ['Dev / holdout', `${corpus.bySplit.dev} / ${corpus.bySplit.holdout}`], ['Labels proposed / reviewed', `${corpus.byLabelStatus.proposed} / ${corpus.byLabelStatus.reviewed}`],
  ])}`);
  for (const [title, key] of [['phenomenon', 'phenomenon'], ['variety', 'variety']]) {
    const names = [...new Set(corpus.strata[key].map(s => s.name))].sort();
    const at = (name, split) => corpus.strata[key].find(s => s.name === name && s.split === split) ?? { flag: 0, benign: 0, uncertain: 0 };
    out.push(`### Cases by ${title} and split\n\nEach cell: flag / benign / uncertain.\n\n${table([title[0].toUpperCase() + title.slice(1), 'Dev', 'Holdout'], names.map(name => [name, ...['dev', 'holdout'].map(split => { const s = at(name, split); return `${s.flag} / ${s.benign} / ${s.uncertain}`; })]))}`);
  }
  out.push(`### Recipes\n\n${table(['Recipe', 'Id', 'Taken from'], results.map(r => [r.label, `\`${r.id}\``, r.source]))}`);
  for (const split of ['holdout', 'dev', 'all']) {
    const first = results[0].splits[split];
    out.push(`### Results: ${split} (${first.flag} flag, ${first.benign} benign)\n\nEach cell: rate (95% Wilson interval) count/n. † marks n below ${QUALIFIED_FLOOR}: too small to support a claim.\n\n${table(['Recipe', 'Precision', 'Recall', 'Span recall', 'Benign false-positive rate'], results.map(r => {
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
      out.push(`### By ${title}: ${split}\n\nEach cell: recall (flag cases caught) and benign false positives. † marks a qualified figure: its denominator (flag cases for R, benign cases for FP) is below ${QUALIFIED_FLOOR}, so it is too small to support a claim. n/a: the stratum has no such cases.\n\n${table(['Stratum', 'Flag / benign', ...results.map(r => r.label)], names.map(name => {
        const base = results[0].splits[split][key][name];
        return [name, `${base.flag} / ${base.benign}`, ...results.map(r => { const s = r.splits[split][key][name]; return `${stratumCell('R', s.recall)} · ${stratumCell('FP', s.falsePositiveRate)}`; })];
      }))}`);
    }
  }
  return out.join('\n\n');
}

const markers = name => [`<!-- generated:${name}:start -->`, `<!-- generated:${name}:end -->`];
/** Replaces the text between a pair of `generated:<name>` markers. */
export function replaceBlock(text, name, content) {
  const [start, end] = markers(name);
  const a = text.indexOf(start);
  const b = text.indexOf(end);
  if (a < 0 || b < a) throw new Error(`missing ${start} / ${end} markers`);
  return `${text.slice(0, a + start.length)}\n\n${content}\n\n${text.slice(b)}`;
}

export function renderPage(baseline, page = readFileSync(pageUrl, 'utf8')) {
  return replaceBlock(replaceBlock(page, 'status', renderStatus(baseline)), 'tables', renderTables(baseline));
}
export function renderProtocol(baseline, protocol = readFileSync(protocolUrl, 'utf8')) {
  return replaceBlock(replaceBlock(replaceBlock(protocol, 'status', renderStatus(baseline)), 'sizes', renderSizes(baseline)), 'coverage-56', renderCoverage(baseline));
}

/**
 * Problems found when the committed baseline, page or protocol differ from what this build computes.
 * Inputs are injectable so tests can show it notices a change: `corpus`, `recipes`, and the committed `baseline`,
 * `page` and `protocol` texts (default: the files in the repository).
 */
export function checkBaseline({ corpus = loadCorpus(), recipes: recipeList = recipes, baseline: committedBaseline = readFileSync(baselineUrl, 'utf8'), page = readFileSync(pageUrl, 'utf8'), protocol = readFileSync(protocolUrl, 'utf8') } = {}) {
  const baseline = buildBaseline(corpus, recipeList);
  const problems = [];
  if (committedBaseline !== baselineText(baseline)) problems.push('evaluation/baseline.json is out of date');
  if (page !== renderPage(baseline, page)) problems.push('docs/accuracy.md generated blocks are out of date');
  if (protocol !== renderProtocol(baseline, protocol)) problems.push('docs/evaluation-protocol.md generated blocks are out of date');
  return problems;
}

export function parseArgs(args) {
  if (args.length > 1 || (args.length === 1 && !['--write', '--check'].includes(args[0]))) throw new Error(`unknown argument "${args.join(' ')}"; expected --write, --check or nothing`);
  return args[0] ?? null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const mode = parseArgs(process.argv.slice(2));
    if (mode === '--check') {
      const problems = checkBaseline();
      if (problems.length) { console.error(`${problems.join('\n')}\nRun: npm run evaluate:corpus -- --write`); process.exit(1); }
      console.log('Corpus baseline is current.');
    } else {
      const baseline = buildBaseline();
      if (mode === '--write') {
        // Render everything before writing anything, so a failure leaves all three files untouched.
        const files = [[baselineUrl, baselineText(baseline)], [pageUrl, renderPage(baseline)], [protocolUrl, renderProtocol(baseline)]];
        for (const [url, text] of files) writeFileAtomic(url, text);
        console.log('Wrote evaluation/baseline.json, docs/accuracy.md and docs/evaluation-protocol.md.');
      } else console.log(renderTables(baseline));
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
