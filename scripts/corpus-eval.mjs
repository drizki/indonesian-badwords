// Evaluation-corpus library: load, validate, split and score any `{ find }` checker.
// No side effects on import. Metrics come from evaluate() in the built package; nothing is re-implemented here.
import { createHash } from 'node:crypto';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { evaluate } from '../dist/esm/evaluate.js';

export const corpusUrl = new URL('../evaluation/corpus.json', import.meta.url);
export const catalogUrl = new URL('../data/catalog.json', import.meta.url);
/** The split salt is pinned (threshold T8): changing it would reshuffle the holdout. */
export const SALT = 831;
/** Strata with fewer cases than this (flag cases for recall, benign cases for the false-positive rate) are qualified. */
export const QUALIFIED_FLOOR = 10;
export const LABELS = ['flag', 'benign', 'uncertain'];
export const LABEL_STATUSES = ['proposed', 'reviewed'];
export const PHENOMENA = ['direct-abuse', 'regional-abuse', 'compound', 'abbreviation', 'multiword', 'obfuscation', 'literal-homonym', 'name-or-loanword', 'near-neighbour', 'quoted-or-reported', 'friendly-exclamation', 'social-insult', 'ordinary'];
export const VARIETIES = ['general', 'javanese', 'sundanese', 'betawi', 'balinese', 'batak', 'minang', 'makassar', 'bugis', 'papua', 'eastern-indonesia', 'malay-influenced', 'english'];
export const CASE_KEYS = ['id', 'text', 'label', 'labelStatus', 'spans', 'family', 'split', 'variety', 'phenomenon', 'ambiguity', 'provenance', 'notes'];
/** Present only where something was said about the case after drafting. */
export const OPTIONAL_CASE_KEYS = ['revisions'];
export const TOP_KEYS = ['schemaVersion', 'review', 'split', 'cases'];
/** Minimum scored cases the holdout must hold for each label (protocol, "Dev and holdout split"). */
export const HOLDOUT_MINIMUM = 10;

export function loadCorpus(url = corpusUrl) { return JSON.parse(readFileSync(url, 'utf8')); }

/** Writes through a temporary file and a rename, so an interrupted run never leaves a half-written file. */
export function writeFileAtomic(url, text) {
  const temp = new URL(`${url.href}.${process.pid}.tmp`);
  writeFileSync(temp, text);
  renameSync(temp, url);
}

/** Deterministic split: 30% of families (by salted SHA-256 of the family) are holdout. */
export function splitFor(family, salt = SALT) {
  const digest = createHash('sha256').update(`${salt}:${family}`).digest();
  return digest.readUInt32BE(0) % 10 < 3 ? 'holdout' : 'dev';
}

/** `Map` from each lowercase catalog surface to the set of `senseId`s it belongs to. A case family for a catalog term is its senseId. */
export function loadSenses(url = catalogUrl) {
  const surfaces = new Map();
  const senseIds = new Set();
  for (const entry of JSON.parse(readFileSync(url, 'utf8')).entries) {
    for (const variant of entry.variants) {
      senseIds.add(variant.senseId);
      const key = variant.surface.toLowerCase();
      surfaces.set(key, (surfaces.get(key) ?? new Set()).add(variant.senseId));
    }
  }
  return { surfaces, senseIds };
}

/** One case per line, so a label change is a one-line diff. */
export function formatCorpus(corpus) {
  const { cases, ...head } = corpus;
  const body = JSON.stringify({ ...head, cases: ['@@'] }, null, 2).replace('"@@"', cases.map(c => JSON.stringify(c)).join(',\n    '));
  return `${body}\n`;
}
export function saveCorpus(corpus, url = corpusUrl) { writeFileAtomic(url, formatCorpus(corpus)); }

/** Returns a list of human-readable problems; empty when the corpus is valid. */
export function validateCorpus(corpus, senses = loadSenses()) {
  const errors = [];
  const same = (actual, expected) => actual.length === expected.length && expected.every(key => actual.includes(key));
  if (!corpus || typeof corpus !== 'object') return ['corpus is not an object'];
  if (!same(Object.keys(corpus), TOP_KEYS)) errors.push(`top-level keys must be ${TOP_KEYS.join(', ')}`);
  if (corpus.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  const { review, split } = corpus;
  if (!review || typeof review.labelledBy !== 'string' || typeof review.draftedBy !== 'string' || review.panel !== false || review.interAnnotatorAgreement !== null) errors.push('review must record draftedBy, labelledBy, panel: false and interAnnotatorAgreement: null');
  if (!split || split.salt !== SALT || split.holdoutPercent !== 30) errors.push(`split must record salt ${SALT} (pinned by threshold T8) and holdoutPercent 30`);
  if (!Array.isArray(corpus.cases) || !corpus.cases.length) return [...errors, 'cases must be a non-empty array'];
  const ids = new Set();
  const texts = new Set();
  for (const [position, c] of corpus.cases.entries()) {
    const at = c && typeof c.id === 'string' ? c.id : `#${position}`;
    const fail = message => errors.push(`${at}: ${message}`);
    const keys = c && typeof c === 'object' ? Object.keys(c) : [];
    if (!c || typeof c !== 'object' || !CASE_KEYS.every(key => keys.includes(key)) || keys.some(key => !CASE_KEYS.includes(key) && !OPTIONAL_CASE_KEYS.includes(key))) { fail(`keys must be ${CASE_KEYS.join(', ')} (and optionally ${OPTIONAL_CASE_KEYS.join(', ')})`); continue; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.id)) fail('id must be lowercase words joined by hyphens');
    if (ids.has(c.id)) fail('duplicate id');
    ids.add(c.id);
    if (typeof c.text !== 'string' || !c.text.trim()) fail('text must be a non-empty string');
    else { if (texts.has(c.text)) fail('duplicate text'); texts.add(c.text); }
    if (!LABELS.includes(c.label)) fail(`label must be one of ${LABELS.join(', ')}`);
    if (!LABEL_STATUSES.includes(c.labelStatus)) fail(`labelStatus must be one of ${LABEL_STATUSES.join(', ')}`);
    if (typeof c.family !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.family)) fail('family must be lowercase words joined by hyphens');
    else {
      if (c.split !== splitFor(c.family, SALT)) fail(`split must follow the documented rule (expected ${splitFor(c.family, SALT)})`);
      if (/^ibw-\d+$/.test(c.family)) { if (!senses.senseIds.has(c.family)) fail(`family ${c.family} is not a catalog senseId`); }
      else if (senses.surfaces.has(c.family) || senses.surfaces.has(c.family.replaceAll('-', ' '))) fail(`family ${c.family} is a catalog term: use its senseId (${[...(senses.surfaces.get(c.family) ?? senses.surfaces.get(c.family.replaceAll('-', ' ')))].join(', ')})`);
    }
    if (!['dev', 'holdout'].includes(c.split)) fail('split must be dev or holdout');
    if (!VARIETIES.includes(c.variety)) fail(`unknown variety ${c.variety}`);
    if (!PHENOMENA.includes(c.phenomenon)) fail(`unknown phenomenon ${c.phenomenon}`);
    if (typeof c.ambiguity !== 'string' || !c.ambiguity) fail('ambiguity must be a non-empty string (use "none")');
    if (typeof c.notes !== 'string') fail('notes must be a string');
    if ('revisions' in c) {
      const ok = Array.isArray(c.revisions) && c.revisions.length > 0 && c.revisions.every(r => r && same(Object.keys(r), ['by', 'on', 'what']) && Object.values(r).every(v => typeof v === 'string' && v) && /^\d{4}-\d{2}-\d{2}$/.test(r.on));
      if (!ok) fail('revisions must be a non-empty array of { by, on (YYYY-MM-DD), what }');
    }
    const p = c.provenance;
    if (!p || p.kind !== 'constructed' || typeof p.by !== 'string') {
      if (!p || p.kind !== 'external' || !['source', 'license', 'retrieved'].every(key => typeof p[key] === 'string' && p[key])) fail('provenance must be { kind: "constructed", by } or { kind: "external", source, license, retrieved }');
    }
    if (!Array.isArray(c.spans)) { fail('spans must be an array'); continue; }
    if (c.label === 'flag' && !c.spans.length) fail('flag cases need at least one span');
    if (c.label !== 'flag' && c.spans.length) fail('only flag cases carry spans');
    let previous = 0;
    const tokenSenses = new Set();
    for (const s of c.spans) {
      if (!s || !same(Object.keys(s), ['index', 'end']) || !Number.isInteger(s.index) || !Number.isInteger(s.end)) { fail('span must be { index, end } integers'); continue; }
      if (s.index < previous || s.end <= s.index || s.end > c.text.length) { fail(`span ${s.index}-${s.end} is out of range, empty, unsorted or overlapping`); continue; }
      previous = s.end;
      const token = c.text.slice(s.index, s.end);
      const low = code => code >= 0xdc00 && code <= 0xdfff;
      if (token !== token.trim()) fail(`span ${s.index}-${s.end} has stray whitespace`);
      if (low(c.text.charCodeAt(s.index)) || low(c.text.charCodeAt(s.end))) fail(`span ${s.index}-${s.end} splits a surrogate pair`);
      if (/[\p{L}\p{N}]/u.test(c.text.slice(s.index - 1, s.index) || ' ') || /[\p{L}\p{N}]/u.test(c.text.slice(s.end, s.end + 1) || ' ')) fail(`span "${token}" does not sit on token boundaries`);
      for (const sense of senses.surfaces.get(token.toLowerCase()) ?? []) tokenSenses.add(sense);
    }
    // A flagged token that is itself a catalog surface fixes the family: otherwise variants of one sense could straddle the split.
    // A case flagging tokens of two senses (an exclamation of two listed words) takes one of them.
    if (tokenSenses.size && !tokenSenses.has(c.family)) fail(`its flagged tokens are catalog surfaces of ${[...tokenSenses].join(', ')}, so the family must be one of them (not ${c.family})`);
  }
  return errors;
}

/**
 * Checks the split constraints the protocol states for the pinned salt. Returns the realised counts per phenomenon,
 * `problems` (a holdout with fewer than HOLDOUT_MINIMUM flag or benign cases) and `gaps` (a phenomenon that has two or
 * more families but is missing from one split). The salt is pinned, so a gap is reported, not repaired.
 */
export function splitReport(corpus) {
  const byPhenomenon = {};
  for (const c of corpus.cases) {
    const row = (byPhenomenon[c.phenomenon] ??= { families: new Set(), dev: { flag: 0, benign: 0, uncertain: 0 }, holdout: { flag: 0, benign: 0, uncertain: 0 } });
    row.families.add(c.family);
    row[c.split][c.label] += 1;
  }
  const holdout = { flag: 0, benign: 0 };
  for (const c of corpus.cases) if (c.split === 'holdout' && c.label !== 'uncertain') holdout[c.label] += 1;
  const problems = [];
  const gaps = [];
  if (holdout.flag < HOLDOUT_MINIMUM) problems.push(`holdout has ${holdout.flag} flag cases (minimum ${HOLDOUT_MINIMUM})`);
  if (holdout.benign < HOLDOUT_MINIMUM) problems.push(`holdout has ${holdout.benign} benign cases (minimum ${HOLDOUT_MINIMUM})`);
  for (const [name, row] of Object.entries(byPhenomenon)) {
    const total = split => split.flag + split.benign + split.uncertain;
    if (row.families.size >= 2 && (!total(row.dev) || !total(row.holdout))) gaps.push({ phenomenon: name, families: row.families.size, missingFrom: total(row.dev) ? 'holdout' : 'dev' });
  }
  return { holdout, byPhenomenon: Object.fromEntries(Object.entries(byPhenomenon).map(([name, { dev, holdout: h, families }]) => [name, { families: families.size, dev, holdout: h }])), problems, gaps };
}

/** The corpus as evaluate() cases: spans for flag, false for benign. Uncertain cases are not scored. */
export function scoredCases(cases) {
  return cases.filter(c => c.label !== 'uncertain').map(c => ({ id: c.id, text: c.text, expected: c.label === 'flag' ? c.spans.map(({ index, end }) => ({ index, end })) : false }));
}

const rate = r => ({ count: r.count, n: r.n, value: round(r.value), low: round(r.low), high: round(r.high) });
const round = v => (v === null ? null : Math.round(v * 10000) / 10000);
const pair = r => ({ count: r.count, n: r.n });
const countLabels = cases => {
  const scored = cases.filter(c => c.label !== 'uncertain');
  const flag = scored.filter(c => c.label === 'flag').length;
  return { cases: scored.length, flag, benign: scored.length - flag };
};

function score(checker, cases, run) {
  const result = run(checker, scoredCases(cases));
  return {
    ...countLabels(cases),
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

/** Compact stratum score: only what the reports and the thresholds read. */
function scoreStratum(checker, cases, run) {
  const result = run(checker, scoredCases(cases));
  return { ...countLabels(cases), recall: pair(result.recall), falsePositiveRate: pair(result.falsePositiveRate) };
}

const groupBy = (cases, key) => Object.fromEntries([...new Set(cases.map(c => c[key]))].sort().map(value => [value, cases.filter(c => c[key] === value)]));

/**
 * Run the whole corpus through any `{ find(text) }` adapter returning `{ word, index, end }` locations.
 * Result: per split (dev, holdout, all) the overall score and per-variety / per-phenomenon strata, plus the
 * uncertain cases reported apart: they go through evaluate() with `expected: false`, so what is reported is how many
 * the setup flags, never a score. Uncertain cases never enter precision or recall.
 * `options.evaluate` replaces evaluate() (tests use it to inspect what is scored).
 */
export function runCorpus(checker, corpus, { evaluate: run = evaluate } = {}) {
  const out = { splits: {}, uncertain: null };
  const subsets = { dev: corpus.cases.filter(c => c.split === 'dev'), holdout: corpus.cases.filter(c => c.split === 'holdout'), all: corpus.cases };
  for (const [name, cases] of Object.entries(subsets)) {
    const strata = key => Object.fromEntries(Object.entries(groupBy(cases, key)).filter(([, members]) => members.some(c => c.label !== 'uncertain')).map(([value, members]) => [value, scoreStratum(checker, members, run)]));
    out.splits[name] = { ...score(checker, cases, run), varieties: strata('variety'), phenomena: strata('phenomenon') };
  }
  const uncertain = corpus.cases.filter(c => c.label === 'uncertain');
  const result = run(checker, uncertain.map(c => ({ id: c.id, text: c.text, expected: false })));
  const ids = result.cases.filter(c => c.outcome === 'fp').map(c => c.id);
  out.uncertain = { n: uncertain.length, flagged: result.counts.fp, ids };
  return out;
}

/**
 * Apply maintainer answers. `edits` is `[{ id, label, tokens? }]`.
 * - A label that differs from the current one, or any `flag` with `tokens`, replaces the label (spans are found left to
 *   right from the tokens; a new `flag` needs them).
 * - An answer equal to the current label, without tokens, confirms it and keeps the spans.
 * Every edited case becomes `reviewed`. Returns a new corpus.
 */
export function relabel(corpus, edits) {
  const next = structuredClone(corpus);
  for (const { id, label, tokens = [] } of edits) {
    const c = next.cases.find(item => item.id === id);
    if (!c) throw new Error(`unknown case id ${id}`);
    if (!LABELS.includes(label)) throw new Error(`${id}: unknown label ${label}`);
    const confirm = label === c.label && !tokens.length;
    if (!confirm) {
      c.label = label;
      c.spans = [];
      if (label === 'flag') {
        if (!tokens.length) throw new Error(`${id}: relabelling to flag needs the offending token, as ${id}=flag:token`);
        let from = 0;
        for (const token of tokens) {
          const index = c.text.indexOf(token, from);
          if (index < 0) throw new Error(`${id}: "${token}" is not in the text`);
          c.spans.push({ index, end: index + token.length });
          from = index + token.length;
        }
      }
    }
    c.labelStatus = 'reviewed';
  }
  return next;
}
