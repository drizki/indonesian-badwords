import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { evaluate } from '../dist/esm/evaluate.js';
import * as library from '../scripts/corpus-eval.mjs';
import { loadCorpus, validateCorpus, splitFor, splitReport, runCorpus, scoredCases, relabel, formatCorpus, writeFileAtomic, SALT, HOLDOUT_MINIMUM } from '../scripts/corpus-eval.mjs';
import { parseEdits } from '../scripts/corpus-relabel.mjs';
import { recipes, buildBaseline, baselineText, checkBaseline, statusSentence, parseArgs, baselineUrl, pageUrl, protocolUrl } from '../scripts/evaluate-corpus.mjs';

const corpus = loadCorpus();
const problemsAfter = change => { const copy = structuredClone(corpus); change(copy); return validateCorpus(copy); };
const byId = id => corpus.cases.find(c => c.id === id);
const scoredIn = (cases, label) => cases.filter(c => c.label === label).length;
const subsets = { dev: corpus.cases.filter(c => c.split === 'dev'), holdout: corpus.cases.filter(c => c.split === 'holdout'), all: corpus.cases };

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

  test('records the maintainer revisions of the two revised texts', () => {
    for (const id of ['compound-tololnya', 'social-muka-tembok']) assert.deepEqual(byId(id).revisions, [{ by: 'maintainer', on: '2026-10-30', what: 'text' }], id);
    assert.equal(corpus.cases.filter(c => 'revisions' in c).length, 2);
  });

  test('records the #56 evidence cases as constructed AI drafts, with spans on a word', () => {
    const ids = ['abuse-coli-kamar', 'lit-pepek-lengkap', 'quote-pelakor-berita', 'lit-nggateli-kaos', 'reg-nggateli-kowe', 'lit-cibrit-diare'];
    for (const id of ids) assert.deepEqual(byId(id).provenance, { kind: 'constructed', by: 'ai-draft' }, id);
    for (const c of corpus.cases.filter(x => x.labelStatus === 'proposed')) {
      assert.deepEqual(c.provenance, { kind: 'constructed', by: 'ai-draft' }, c.id);
      assert.equal(c.revisions, undefined, c.id);
    }
    for (const c of corpus.cases) for (const s of c.spans) assert.match(c.text.slice(s.index, s.end), /\p{L}/u, c.id);
  });
});

describe('split', () => {
  test('follows the documented rule with the pinned salt', () => {
    assert.equal(SALT, 429);
    assert.equal(corpus.split.salt, 429);
    for (const c of corpus.cases) assert.equal(c.split, splitFor(c.family), c.id);
  });

  test('rejects any other salt (T8)', () => {
    assert.match(problemsAfter(c => { c.split.salt = 430; }).join('\n'), /salt 429/);
    assert.match(problemsAfter(c => { c.split.salt = '429'; }).join('\n'), /salt 429/);
  });

  test('puts every spelling of a catalog sense in one family', () => {
    const family = id => byId(id).family;
    assert.equal(family('friendly-anjir-keren'), 'ibw-0001');
    assert.equal(new Set(['friendly-anjir-keren', 'friendly-anjay-mantap', 'friendly-bejir-seriusan', 'reg-anjing-sia', 'lit-anjing-tetangga', 'near-kanjeng-ratu', 'quote-anjing-panggil', 'obf-anjing-dots', 'friendly-araranjay-telat'].map(family)).size, 1);
    assert.equal(new Set(['lit-bodo-baju', 'lit-bodo-amat', 'social-saya-bodoh', 'social-kamu-bodoh', 'quote-bodoh-kbbi', 'abuse-bodo-dasar'].map(family)).size, 1);
    assert.equal(family('near-belum-tentu'), 'ibw-1011');
  });

  test('rejects a family that would leak a catalog sense across the split', () => {
    assert.match(problemsAfter(c => { byId; c.cases.find(x => x.id === 'friendly-anjir-keren').family = 'anjir'; }).join('\n'), /catalog term: use its senseId \(ibw-0001\)/);
    assert.match(problemsAfter(c => { c.cases.find(x => x.id === 'reg-anjing-sia').family = 'ibw-1005'; c.cases.find(x => x.id === 'reg-anjing-sia').split = splitFor('ibw-1005'); }).join('\n'), /flagged tokens are catalog surfaces of ibw-0001/);
    assert.match(problemsAfter(c => { const x = c.cases[0]; x.family = 'ibw-9999'; x.split = splitFor('ibw-9999'); }).join('\n'), /not a catalog senseId/);
  });

  test('meets the holdout minimums and reports phenomenon gaps it does not repair', () => {
    const report = splitReport(corpus);
    assert.deepEqual(report.problems, []);
    assert.ok(report.holdout.flag >= HOLDOUT_MINIMUM && report.holdout.benign >= HOLDOUT_MINIMUM);
    const rows = Object.values(report.byPhenomenon);
    assert.equal(rows.reduce((n, r) => n + r.dev.flag + r.dev.benign + r.dev.uncertain + r.holdout.flag + r.holdout.benign + r.holdout.uncertain, 0), corpus.cases.length);
    assert.deepEqual(report.gaps.map(g => g.phenomenon).sort(), Object.entries(report.byPhenomenon).filter(([, r]) => r.families >= 2 && ([r.dev, r.holdout].some(s => s.flag + s.benign + s.uncertain === 0))).map(([name]) => name).sort());
  });

  test('flags a holdout that is too small', () => {
    const small = structuredClone(corpus);
    for (const c of small.cases) if (c.split === 'holdout' && c.label === 'benign') c.split = 'dev';
    assert.match(splitReport(small).problems.join('\n'), /holdout has 0 benign/);
  });
});

describe('validation', () => {
  test('rejects a corpus that breaks a rule', () => {
    assert.match(problemsAfter(c => { c.cases[1].id = c.cases[0].id; }).join('\n'), /duplicate id/);
    assert.match(problemsAfter(c => { c.cases[0].label = 'maybe'; }).join('\n'), /label must be/);
    assert.match(problemsAfter(c => { c.cases[0].spans = []; }).join('\n'), /at least one span/);
    assert.match(problemsAfter(c => { c.cases[0].spans = [{ index: 0, end: 999 }]; }).join('\n'), /out of range/);
    assert.match(problemsAfter(c => { c.cases[0].spans = [{ index: 1, end: 4 }]; }).join('\n'), /token boundaries/);
    assert.match(problemsAfter(c => { const benign = c.cases.find(x => x.label === 'benign'); benign.spans = [{ index: 0, end: 1 }]; }).join('\n'), /only flag cases carry spans/);
    assert.match(problemsAfter(c => { c.cases[0].split = c.cases[0].split === 'dev' ? 'holdout' : 'dev'; }).join('\n'), /split must follow/);
    assert.match(problemsAfter(c => { delete c.cases[0].notes; }).join('\n'), /keys must be/);
    assert.match(problemsAfter(c => { c.cases[0].extra = 1; }).join('\n'), /keys must be/);
    assert.match(problemsAfter(c => { c.cases[0].provenance = { kind: 'external' }; }).join('\n'), /provenance/);
    assert.match(problemsAfter(c => { c.cases[0].revisions = [{ by: 'maintainer' }]; }).join('\n'), /revisions must be/);
  });
});

describe('what is scored', () => {
  test('passes evaluate() spans for flag cases and false for benign, and leaves uncertain cases out', () => {
    const scored = scoredCases(corpus.cases);
    assert.equal(scored.length, corpus.cases.filter(c => c.label !== 'uncertain').length);
    for (const item of scored) {
      const c = byId(item.id);
      assert.notEqual(c.label, 'uncertain', item.id);
      assert.equal(item.text, c.text);
      if (c.label === 'flag') {
        assert.ok(Array.isArray(item.expected) && item.expected.length > 0, item.id);
        assert.deepEqual(item.expected, c.spans);
      } else assert.strictEqual(item.expected, false, item.id);
    }
  });

  test('sends exactly those shapes to evaluate(), with uncertain cases only as expected: false', () => {
    const calls = [];
    const spy = (checker, cases, options) => { calls.push(cases); return evaluate(checker, cases, options); };
    runCorpus(recipes[0].make(), corpus, { evaluate: spy });
    assert.ok(calls.length > 0);
    const uncertainIds = new Set(corpus.cases.filter(c => c.label === 'uncertain').map(c => c.id));
    for (const cases of calls) {
      const sentUncertain = cases.filter(c => uncertainIds.has(c.id));
      if (sentUncertain.length) { assert.equal(sentUncertain.length, cases.length, 'uncertain cases are never mixed with scored ones'); assert.ok(cases.every(c => c.expected === false)); continue; }
      for (const item of cases) {
        const c = byId(item.id);
        if (c.label === 'flag') assert.deepEqual(item.expected, c.spans, item.id); else assert.strictEqual(item.expected, false, item.id);
      }
    }
  });

  test('counts the denominators from the labels, per recipe and split', () => {
    for (const recipe of recipes) {
      const result = runCorpus(recipe.make(), corpus);
      for (const [name, cases] of Object.entries(subsets)) {
        const split = result.splits[name];
        const flag = scoredIn(cases, 'flag');
        const benign = scoredIn(cases, 'benign');
        const where = `${recipe.id} ${name}`;
        assert.equal(split.recall.n, flag, `${where} recall.n`);
        assert.equal(split.falsePositiveRate.n, benign, `${where} falsePositiveRate.n`);
        assert.equal(split.cases, flag + benign, where);
        const direct = evaluate(recipe.make(), scoredCases(cases));
        assert.equal(split.recall.count, direct.recall.count, where);
        assert.equal(split.falsePositiveRate.count, direct.falsePositiveRate.count, where);
        assert.equal(split.precision.count, direct.precision.count, where);
        assert.equal(split.precision.n, direct.precision.n, where);
        for (const key of ['varieties', 'phenomena']) {
          const field = key === 'varieties' ? 'variety' : 'phenomenon';
          for (const [value, stratum] of Object.entries(split[key])) {
            const members = cases.filter(c => c[field] === value);
            assert.equal(stratum.recall.n, scoredIn(members, 'flag'), `${where} ${value}`);
            assert.equal(stratum.falsePositiveRate.n, scoredIn(members, 'benign'), `${where} ${value}`);
          }
        }
      }
    }
  });

  test('reports uncertain cases apart, counted through evaluate()', () => {
    const uncertain = corpus.cases.filter(c => c.label === 'uncertain');
    for (const recipe of recipes) {
      const checker = recipe.make();
      const result = runCorpus(checker, corpus);
      assert.equal(result.uncertain.n, uncertain.length);
      assert.deepEqual(result.uncertain.ids, uncertain.filter(c => checker.find(c.text).length > 0).map(c => c.id), recipe.id);
      assert.equal(result.uncertain.flagged, result.uncertain.ids.length);
      assert.equal(result.splits.all.cases, corpus.cases.length - uncertain.length);
    }
    const everything = runCorpus({ find: () => [{ word: 'x', index: 0, end: 1 }] }, corpus);
    assert.equal(everything.uncertain.flagged, uncertain.length);
  });
});

describe('recipes', () => {
  test('include the README tolerant recipe, which combines evasion and fuzzy', () => {
    const tolerant = recipes.find(r => r.id === 'tolerant');
    assert.match(tolerant.source, /README\.md/);
    assert.equal(tolerant.make().censor('dasar g-o-b-l-o-x!'), 'dasar ***!');
    assert.match(readFileSync(new URL('../README.md', import.meta.url), 'utf8'), /const tolerant = new Badwords\(\{\n  fuzzy: boundedFuzzy\(\{ model: 'osa', maxEdits: 1 \}\),\n  evasion: boundedEvasion\(\{\n    separators: \{ characters: \[' ', '\.', '_', '-'\], maxGap: 1, maxTotal: 8 \},\n    repetitions: \{ maxExtraPerLetter: 2, maxTotal: 8 \},\n    confusables: \{ mappings: latinLookalikes, maxTotal: 2 \},\n  \}\),\n\}\);/);
  });

  test('cite the document each one is copied from', () => {
    assert.match(recipes.find(r => r.id === 'fuzzy').source, /README\.md.*disguised spellings/);
    for (const r of recipes) assert.match(r.source, /^(README\.md|docs\/)/, r.id);
  });
});

describe('relabel', () => {
  const draft = () => {
    const flag = { ...byId('abuse-tai-kerjaan'), labelStatus: 'proposed' };
    return { flag, corpus: { ...corpus, cases: corpus.cases.map(c => (c.id === flag.id ? flag : c)) } };
  };

  test('changes a label by id and requires spans for a new flag', () => {
    const { flag, corpus: base } = draft();
    const changed = relabel(base, [{ id: flag.id, label: 'benign' }]);
    assert.deepEqual(validateCorpus(changed), []);
    assert.equal(changed.cases.find(c => c.id === flag.id).labelStatus, 'reviewed');
    assert.throws(() => relabel(changed, [{ id: flag.id, label: 'flag' }]), /needs the offending token/);
    const token = flag.text.slice(flag.spans[0].index, flag.spans[0].end);
    assert.deepEqual(relabel(changed, [{ id: flag.id, label: 'flag', tokens: [token] }]).cases.find(c => c.id === flag.id).spans, flag.spans);
    assert.throws(() => relabel(base, [{ id: 'nope', label: 'flag' }]), /unknown case id/);
  });

  test('confirms a proposed label when the answer equals it, keeping the spans', () => {
    const { flag, corpus: base } = draft();
    const confirmed = relabel(base, [{ id: flag.id, label: 'flag' }]);
    const after = confirmed.cases.find(c => c.id === flag.id);
    assert.equal(after.labelStatus, 'reviewed');
    assert.equal(after.label, 'flag');
    assert.deepEqual(after.spans, flag.spans);
    assert.deepEqual(validateCorpus(confirmed), []);
    const untouched = confirmed.cases.filter(c => c.id !== flag.id);
    assert.deepEqual(untouched, base.cases.filter(c => c.id !== flag.id));
  });

  test('has no bulk review and rejects unknown arguments', () => {
    assert.equal('reviewAll' in library, false);
    assert.throws(() => parseEdits(['--review-all']), /unknown argument/);
    assert.throws(() => parseEdits(['abuse-tai-kerjaan=maybe']), /unknown argument/);
    assert.throws(() => parseEdits([]), /at least one/);
    assert.throws(() => parseEdits(['a-b=benign:tok']), /only flag takes a token/);
    assert.deepEqual(parseEdits(['a-b=flag:x|y', 'c=benign']), [{ id: 'a-b', label: 'flag', tokens: ['x', 'y'] }, { id: 'c', label: 'benign', tokens: [] }]);
  });
});

describe('baseline', () => {
  const baselineFile = readFileSync(baselineUrl, 'utf8');
  const pageFile = readFileSync(pageUrl, 'utf8');
  const protocolFile = readFileSync(protocolUrl, 'utf8');

  test('baseline.json, docs/accuracy.md and the protocol match what this build computes', () => {
    assert.deepEqual(checkBaseline(), []);
  });

  test('checkBaseline notices a changed baseline, page, protocol or corpus', () => {
    assert.deepEqual(checkBaseline({ baseline: baselineFile, page: pageFile, protocol: protocolFile }), []);
    assert.deepEqual(checkBaseline({ baseline: baselineFile.replace('"qualifiedFloor": 10', '"qualifiedFloor": 11') }), ['evaluation/baseline.json is out of date']);
    assert.deepEqual(checkBaseline({ baseline: '' }), ['evaluation/baseline.json is out of date']);
    assert.deepEqual(checkBaseline({ baseline: '{}\n' }), ['evaluation/baseline.json is out of date']);
    assert.deepEqual(checkBaseline({ page: pageFile.replace('Results: holdout', 'Results: holdout!') }), ['docs/accuracy.md generated blocks are out of date']);
    assert.deepEqual(checkBaseline({ protocol: protocolFile.replace('100/B =', '100/B ~') }), ['docs/evaluation-protocol.md generated blocks are out of date']);
    const relabelled = structuredClone(corpus);
    relabelled.cases.find(c => c.id === 'lit-tai-chi').label = 'uncertain';
    assert.equal(checkBaseline({ corpus: relabelled }).length, 3);
    const alwaysFlag = [{ ...recipes[0], make: () => ({ find: () => [{ word: 'x', index: 0, end: 1 }] }) }];
    assert.ok(checkBaseline({ recipes: alwaysFlag }).length > 0);
  });

  test('is compact and carries the scored counts for every recipe and split', () => {
    assert.ok(statSize(baselineUrl) < 150_000, 'baseline.json should stay small');
    const baseline = JSON.parse(baselineFile);
    assert.equal(baselineFile, baselineText(baseline));
    assert.equal(baseline.recipes.length, recipes.length);
    for (const recipe of baseline.recipes) {
      for (const [name, cases] of Object.entries(subsets)) {
        assert.equal(recipe.splits[name].recall.n, scoredIn(cases, 'flag'), `${recipe.id} ${name}`);
        assert.equal(recipe.splits[name].falsePositiveRate.n, scoredIn(cases, 'benign'), `${recipe.id} ${name}`);
      }
      assert.ok(recipe.splits.holdout.phenomena && recipe.splits.all.varieties);
      assert.equal(recipe.splits.dev.phenomena, undefined);
      assert.equal(recipe.uncertain.n, scoredIn(corpus.cases, 'uncertain'));
    }
  });

  test('derives the label-status wording from the counts', () => {
    const base = buildBaseline(corpus, []).corpus;
    const proposed = corpus.cases.filter(c => c.labelStatus === 'proposed').length;
    assert.equal(base.byLabelStatus.proposed, proposed);
    assert.equal(base.byLabelStatus.reviewed, corpus.cases.length - proposed);
    const total = corpus.cases.length;
    assert.match(statusSentence({ ...base, byLabelStatus: { proposed: 3, reviewed: total - 3 } }), new RegExp(`${total - 3} of ${total} labels have been reviewed.*3 are still \`proposed\`.*provisional`, 's'));
    assert.match(statusSentence({ ...base, byLabelStatus: { proposed: 0, reviewed: total } }), new RegExp(`^All ${total} labels have been reviewed`));
    assert.doesNotMatch(statusSentence({ ...base, byLabelStatus: { proposed: 0, reviewed: total } }), /proposed/);
    assert.match(statusSentence({ ...base, revised: 1 }), /1 case text was revised/);
    assert.match(statusSentence({ ...base, revised: 2 }), /2 case texts were revised/);
    // The committed wording follows the committed counts: it names proposed labels only while some exist.
    for (const file of [protocolFile, pageFile]) assert.equal(/are still `proposed`/.test(file), proposed > 0);
  });

  test('lists the #56 terms that still lack cases', () => {
    const rows = buildBaseline(corpus, []).corpus.issue56;
    const hasCase = term => corpus.cases.some(c => new RegExp(`(?<![\\p{L}\\p{N}])${term}`, 'iu').test(c.text));
    assert.deepEqual(rows.filter(r => !r.flag && !r.benign && !r.uncertain).map(r => r.term), rows.map(r => r.term).filter(term => !hasCase(term)));
    assert.ok(rows.some(r => r.term === 'mukil'));
    assert.ok(rows.length >= 40);
    if (!hasCase('mukil')) assert.match(protocolFile, /No case at all: .*`mukil`/);
  });

  test('rejects unknown command-line arguments', () => {
    assert.equal(parseArgs([]), null);
    assert.equal(parseArgs(['--write']), '--write');
    assert.throws(() => parseArgs(['--wrte']), /unknown argument/);
    assert.throws(() => parseArgs(['--write', '--check']), /unknown argument/);
  });
});

describe('writes', () => {
  test('go through a temporary file and leave nothing behind', () => {
    const dir = mkdtempSync(join(tmpdir(), 'corpus-'));
    try {
      const url = pathToFileURL(join(dir, 'out.json'));
      writeFileAtomic(url, 'one');
      writeFileAtomic(url, 'two');
      assert.equal(readFileSync(url, 'utf8'), 'two');
      assert.deepEqual(readdirSync(dir), ['out.json']);
      assert.ok(existsSync(url));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

function statSize(url) { return statSync(url).size; }
