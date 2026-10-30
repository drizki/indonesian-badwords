// Salt search for the dev/holdout split (protocol, "Dev and holdout split"). Prints how salts 0 to 4999 rank for the
// current corpus under one explicit rule, and where the pinned salt stands. It never changes anything: the salt is
// pinned by threshold T8, and this script exists so the selection rule can be read and re-run, not to re-pick.
//   node scripts/corpus-salt.mjs
// Rule: a salt is *eligible* when its holdout holds at least HOLDOUT_MINIMUM scored flag and benign cases and every
// phenomenon with two or more families appears in both splits. Eligible salts rank by how far the holdout size is from
// 30% of all cases (smaller is better); ties go to the smaller salt.
import { pathToFileURL } from 'node:url';
import { SALT, HOLDOUT_MINIMUM, loadCorpus, splitFor, splitReport } from './corpus-eval.mjs';

export function rankSalts(corpus, from = 0, to = 4999) {
  const rows = [];
  for (let salt = from; salt <= to; salt += 1) {
    const cases = corpus.cases.map(c => ({ ...c, split: splitFor(c.family, salt) }));
    const report = splitReport({ ...corpus, cases });
    const size = cases.filter(c => c.split === 'holdout').length;
    rows.push({ salt, holdout: size, flag: report.holdout.flag, benign: report.holdout.benign, gaps: report.gaps.length, eligible: !report.problems.length && !report.gaps.length, distance: Math.abs(size - 0.3 * cases.length) });
  }
  return rows;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length > 2) { console.error('this script takes no arguments'); process.exit(1); }
  const rows = rankSalts(loadCorpus());
  const ranked = rows.filter(r => r.eligible).sort((a, b) => a.distance - b.distance || a.salt - b.salt);
  const pinned = rows[SALT];
  console.log(`Pinned salt ${SALT}: holdout ${pinned.holdout} cases (${pinned.flag} flag, ${pinned.benign} benign), ${pinned.gaps} phenomenon gap(s); eligible under the rule: ${pinned.eligible ? `yes, rank ${ranked.findIndex(r => r.salt === SALT) + 1} of ${ranked.length}` : 'no'}.`);
  console.log(`${ranked.length} of ${rows.length} salts are eligible (holdout >= ${HOLDOUT_MINIMUM} flag and benign, no phenomenon gap). Best five:`);
  for (const r of ranked.slice(0, 5)) console.log(`  salt ${r.salt}: holdout ${r.holdout} (${r.flag} flag, ${r.benign} benign)`);
}
