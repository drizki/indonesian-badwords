// Evaluation-corpus library: load, validate, split and score any `{ find }` checker.
// No side effects on import. Metrics come from evaluate() in the built package; nothing is re-implemented here.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { evaluate } from '../dist/esm/evaluate.js';

export const corpusUrl = new URL('../evaluation/corpus.json', import.meta.url);
/** Strata with fewer cases than this (flag cases for recall, benign cases for the false-positive rate) are qualified. */
export const QUALIFIED_FLOOR = 10;
export const LABELS = ['flag', 'benign', 'uncertain'];
export const LABEL_STATUSES = ['proposed', 'reviewed'];
export const PHENOMENA = ['direct-abuse', 'regional-abuse', 'compound', 'abbreviation', 'multiword', 'obfuscation', 'literal-homonym', 'name-or-loanword', 'near-neighbour', 'quoted-or-reported', 'friendly-exclamation', 'social-insult', 'ordinary'];
export const VARIETIES = ['general', 'javanese', 'sundanese', 'betawi', 'balinese', 'batak', 'minang', 'makassar', 'bugis', 'papua', 'eastern-indonesia', 'malay-influenced', 'english'];
export const CASE_KEYS = ['id', 'text', 'label', 'labelStatus', 'spans', 'family', 'split', 'variety', 'phenomenon', 'ambiguity', 'provenance', 'notes'];
export const TOP_KEYS = ['schemaVersion', 'review', 'split', 'cases'];

export function loadCorpus(url = corpusUrl) { return JSON.parse(readFileSync(url, 'utf8')); }

/** Deterministic split: 30% of families (by salted SHA-256 of the family) are holdout. */
export function splitFor(family, salt) {
  const digest = createHash('sha256').update(`${salt}:${family}`).digest();
  return digest.readUInt32BE(0) % 10 < 3 ? 'holdout' : 'dev';
}

/** One case per line, so a label change is a one-line diff. */
export function formatCorpus(corpus) {
  const { cases, ...head } = corpus;
  const body = JSON.stringify({ ...head, cases: ['@@'] }, null, 2).replace('"@@"', cases.map(c => JSON.stringify(c)).join(',\n    '));
  return `${body}\n`;
}
export function saveCorpus(corpus, url = corpusUrl) { writeFileSync(url, formatCorpus(corpus)); }

/** Returns a list of human-readable problems; empty when the corpus is valid. */
export function validateCorpus(corpus) {
  const errors = [];
  const same = (actual, expected) => actual.length === expected.length && expected.every(key => actual.includes(key));
  if (!corpus || typeof corpus !== 'object') return ['corpus is not an object'];
  if (!same(Object.keys(corpus), TOP_KEYS)) errors.push(`top-level keys must be ${TOP_KEYS.join(', ')}`);
  if (corpus.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  const { review, split } = corpus;
  if (!review || typeof review.labelledBy !== 'string' || typeof review.draftedBy !== 'string' || review.panel !== false || review.interAnnotatorAgreement !== null) errors.push('review must record draftedBy, labelledBy, panel: false and interAnnotatorAgreement: null');
  if (!split || !Number.isInteger(split.salt) || split.holdoutPercent !== 30) errors.push('split must record an integer salt and holdoutPercent 30');
  if (!Array.isArray(corpus.cases) || !corpus.cases.length) return [...errors, 'cases must be a non-empty array'];
  const ids = new Set();
  const texts = new Set();
  const familySplit = new Map();
  for (const [position, c] of corpus.cases.entries()) {
    const at = c && typeof c.id === 'string' ? c.id : `#${position}`;
    const fail = message => errors.push(`${at}: ${message}`);
    if (!c || typeof c !== 'object' || !same(Object.keys(c), CASE_KEYS)) { fail(`keys must be ${CASE_KEYS.join(', ')}`); continue; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.id)) fail('id must be lowercase words joined by hyphens');
    if (ids.has(c.id)) fail('duplicate id');
    ids.add(c.id);
    if (typeof c.text !== 'string' || !c.text.trim()) fail('text must be a non-empty string');
    else { if (texts.has(c.text)) fail('duplicate text'); texts.add(c.text); }
    if (!LABELS.includes(c.label)) fail(`label must be one of ${LABELS.join(', ')}`);
    if (!LABEL_STATUSES.includes(c.labelStatus)) fail(`labelStatus must be one of ${LABEL_STATUSES.join(', ')}`);
    if (typeof c.family !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.family)) fail('family must be lowercase words joined by hyphens');
    else {
      if (c.split !== splitFor(c.family, split?.salt)) fail(`split must follow the documented rule (expected ${splitFor(c.family, split?.salt)})`);
      if (familySplit.has(c.family) && familySplit.get(c.family) !== c.split) fail('family appears in both splits');
      familySplit.set(c.family, c.split);
    }
    if (!['dev', 'holdout'].includes(c.split)) fail('split must be dev or holdout');
    if (!VARIETIES.includes(c.variety)) fail(`unknown variety ${c.variety}`);
    if (!PHENOMENA.includes(c.phenomenon)) fail(`unknown phenomenon ${c.phenomenon}`);
    if (typeof c.ambiguity !== 'string' || !c.ambiguity) fail('ambiguity must be a non-empty string (use "none")');
    if (typeof c.notes !== 'string') fail('notes must be a string');
    const p = c.provenance;
    if (!p || p.kind !== 'constructed' || typeof p.by !== 'string') {
      if (!p || p.kind !== 'external' || !['source', 'license', 'retrieved'].every(key => typeof p[key] === 'string' && p[key])) fail('provenance must be { kind: "constructed", by } or { kind: "external", source, license, retrieved }');
    }
    if (!Array.isArray(c.spans)) { fail('spans must be an array'); continue; }
    if (c.label === 'flag' && !c.spans.length) fail('flag cases need at least one span');
    if (c.label !== 'flag' && c.spans.length) fail('only flag cases carry spans');
    let previous = 0;
    for (const s of c.spans) {
      if (!s || !same(Object.keys(s), ['index', 'end']) || !Number.isInteger(s.index) || !Number.isInteger(s.end)) { fail('span must be { index, end } integers'); continue; }
      if (s.index < previous || s.end <= s.index || s.end > c.text.length) { fail(`span ${s.index}-${s.end} is out of range, empty, unsorted or overlapping`); continue; }
      previous = s.end;
      const token = c.text.slice(s.index, s.end);
      const low = code => code >= 0xdc00 && code <= 0xdfff;
      if (token !== token.trim()) fail(`span ${s.index}-${s.end} has stray whitespace`);
      if (low(c.text.charCodeAt(s.index)) || low(c.text.charCodeAt(s.end))) fail(`span ${s.index}-${s.end} splits a surrogate pair`);
      if (/[\p{L}\p{N}]/u.test(c.text.slice(s.index - 1, s.index) || ' ') || /[\p{L}\p{N}]/u.test(c.text.slice(s.end, s.end + 1) || ' ')) fail(`span "${token}" does not sit on token boundaries`);
    }
  }
  return errors;
}

/** The corpus as evaluate() cases: spans for flag, false for benign. Uncertain cases are not scored. */
export function scoredCases(cases) {
  return cases.filter(c => c.label !== 'uncertain').map(c => ({ id: c.id, text: c.text, expected: c.label === 'flag' ? c.spans.map(({ index, end }) => ({ index, end })) : false }));
}

const rate = r => ({ count: r.count, n: r.n, value: r.value, low: r.low, high: r.high });
function summarize(cases) {
  const scored = cases.filter(c => c.label !== 'uncertain');
  const flag = scored.filter(c => c.label === 'flag').length;
  return { cases: scored.length, flag, benign: scored.length - flag, recallQualified: flag < QUALIFIED_FLOOR, fprQualified: scored.length - flag < QUALIFIED_FLOOR };
}

function score(checker, cases) {
  const result = evaluate(checker, scoredCases(cases));
  return {
    ...summarize(cases),
    precision: rate(result.precision),
    recall: rate(result.recall),
    falsePositiveRate: rate(result.falsePositiveRate),
    spanRecall: rate(result.spans.recall),
    failures: {
      falsePositives: result.cases.filter(c => c.outcome === 'fp').map(c => c.id),
      falseNegatives: result.cases.filter(c => c.outcome === 'fn').map(c => c.id),
      spanMismatches: result.cases.filter(c => c.outcome === 'tp' && !c.correct).map(c => c.id),
    },
  };
}

const groupBy = (cases, key) => Object.fromEntries([...new Set(cases.map(c => c[key]))].sort().map(value => [value, cases.filter(c => c[key] === value)]));

/**
 * Run the whole corpus through any `{ find(text) }` adapter returning `{ word, index, end }` locations.
 * Result: per split (dev, holdout, all) the overall score and per-variety / per-phenomenon strata, plus the
 * uncertain cases reported apart as a flag rate. Uncertain cases never enter precision or recall.
 */
export function runCorpus(checker, corpus) {
  const out = { splits: {}, uncertain: null };
  const subsets = { dev: corpus.cases.filter(c => c.split === 'dev'), holdout: corpus.cases.filter(c => c.split === 'holdout'), all: corpus.cases };
  for (const [name, cases] of Object.entries(subsets)) {
    const strata = key => Object.fromEntries(Object.entries(groupBy(cases, key)).filter(([, members]) => members.some(c => c.label !== 'uncertain')).map(([value, members]) => [value, score(checker, members)]));
    out.splits[name] = { ...score(checker, cases), varieties: strata('variety'), phenomena: strata('phenomenon') };
  }
  const uncertain = corpus.cases.filter(c => c.label === 'uncertain');
  const flagged = uncertain.filter(c => checker.find(c.text).length > 0).map(c => c.id);
  out.uncertain = { n: uncertain.length, flagged: flagged.length, ids: flagged };
  return out;
}

/**
 * Apply maintainer corrections. `edits` is `[{ id, label, tokens? }]`; a case relabelled to `flag` needs the
 * offending `tokens` (found left to right in the text). Relabelled cases become `reviewed`. Returns a new corpus.
 */
export function relabel(corpus, edits) {
  const next = structuredClone(corpus);
  for (const { id, label, tokens = [] } of edits) {
    const c = next.cases.find(item => item.id === id);
    if (!c) throw new Error(`unknown case id ${id}`);
    if (!LABELS.includes(label)) throw new Error(`${id}: unknown label ${label}`);
    c.label = label;
    c.labelStatus = 'reviewed';
    c.spans = [];
    if (label !== 'flag') continue;
    if (!tokens.length) throw new Error(`${id}: relabelling to flag needs the offending token, as ${id}=flag:token`);
    let from = 0;
    for (const token of tokens) {
      const index = c.text.indexOf(token, from);
      if (index < 0) throw new Error(`${id}: "${token}" is not in the text`);
      c.spans.push({ index, end: index + token.length });
      from = index + token.length;
    }
  }
  return next;
}

export function reviewAll(corpus) {
  const next = structuredClone(corpus);
  for (const c of next.cases) c.labelStatus = 'reviewed';
  return next;
}
