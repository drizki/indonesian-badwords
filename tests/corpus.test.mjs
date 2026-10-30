import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { loadCorpus, validateCorpus, splitFor, runCorpus, relabel, reviewAll, formatCorpus } from '../scripts/corpus-eval.mjs';
import { checkBaseline } from '../scripts/evaluate-corpus.mjs';

const corpus = loadCorpus();
const problemsAfter = (change) => { const copy = structuredClone(corpus); change(copy); return validateCorpus(copy); };

describe('evaluation corpus', () => {
  test('is valid', () => {
    assert.deepEqual(validateCorpus(corpus), []);
  });

  test('is stored in the canonical one-case-per-line format', () => {
    assert.equal(readFileSync(new URL('../evaluation/corpus.json', import.meta.url), 'utf8'), formatCorpus(corpus));
  });

  test('records the reviewer roles without claiming a panel or agreement', () => {
    assert.equal(corpus.review.panel, false);
    assert.equal(corpus.review.interAnnotatorAgreement, null);
    assert.equal(corpus.review.labelledOn, '2026-10-30');
  });

  test('keeps every family in one split and follows the documented rule', () => {
    for (const c of corpus.cases) assert.equal(c.split, splitFor(c.family, corpus.split.salt), c.id);
    const holdout = corpus.cases.filter(c => c.split === 'holdout').length;
    assert.ok(holdout / corpus.cases.length > 0.2 && holdout / corpus.cases.length < 0.4);
  });

  test('is rejected when it breaks a rule', () => {
    assert.match(problemsAfter(c => { c.cases[1].id = c.cases[0].id; }).join('\n'), /duplicate id/);
    assert.match(problemsAfter(c => { c.cases[0].label = 'maybe'; }).join('\n'), /label must be/);
    assert.match(problemsAfter(c => { c.cases[0].spans = []; }).join('\n'), /at least one span/);
    assert.match(problemsAfter(c => { c.cases[0].spans = [{ index: 0, end: 999 }]; }).join('\n'), /out of range/);
    assert.match(problemsAfter(c => { c.cases[0].spans = [{ index: 1, end: 4 }]; }).join('\n'), /token boundaries/);
    assert.match(problemsAfter(c => { const benign = c.cases.find(x => x.label === 'benign'); benign.spans = [{ index: 0, end: 1 }]; }).join('\n'), /only flag cases carry spans/);
    assert.match(problemsAfter(c => { c.cases[0].split = c.cases[0].split === 'dev' ? 'holdout' : 'dev'; }).join('\n'), /split must follow/);
    assert.match(problemsAfter(c => { delete c.cases[0].notes; }).join('\n'), /keys must be/);
    assert.match(problemsAfter(c => { c.cases[0].provenance = { kind: 'external' }; }).join('\n'), /provenance/);
  });

  test('keeps uncertain cases out of precision and recall', () => {
    const result = runCorpus({ find: () => [{ word: 'x', index: 0, end: 1 }] }, corpus);
    const uncertain = corpus.cases.filter(c => c.label === 'uncertain').length;
    assert.equal(result.uncertain.n, uncertain);
    assert.equal(result.uncertain.flagged, uncertain);
    const scored = corpus.cases.length - uncertain;
    assert.equal(result.splits.all.cases, scored);
    assert.equal(result.splits.all.flag + result.splits.all.benign, scored);
  });

  test('relabels by id and requires spans for a new flag', () => {
    const benign = { ...corpus.cases.find(c => c.label === 'flag'), labelStatus: 'proposed' };
    const draft = { ...corpus, cases: corpus.cases.map(c => (c.id === benign.id ? benign : c)) };
    const changed = relabel(draft, [{ id: benign.id, label: 'benign' }]);
    assert.deepEqual(validateCorpus(changed), []);
    assert.equal(changed.cases.find(c => c.id === benign.id).labelStatus, 'reviewed');
    assert.throws(() => relabel(changed, [{ id: benign.id, label: 'flag' }]), /needs the offending token/);
    const token = benign.text.slice(benign.spans[0].index, benign.spans[0].end);
    assert.deepEqual(relabel(changed, [{ id: benign.id, label: 'flag', tokens: [token] }]).cases.find(c => c.id === benign.id).spans, benign.spans);
    assert.ok(reviewAll(draft).cases.every(c => c.labelStatus === 'reviewed'));
  });

  test('baseline.json and docs/accuracy.md match what this build computes', () => {
    assert.deepEqual(checkBaseline(), []);
  });
});
