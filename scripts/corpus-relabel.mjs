// Apply maintainer corrections to evaluation/corpus.json, then regenerate the baseline.
//   node scripts/corpus-relabel.mjs --review-all                    mark every label as reviewed
//   node scripts/corpus-relabel.mjs id=benign id2=flag:token id3=uncertain
// A relabelled case becomes `reviewed`. Afterwards run `npm run evaluate:corpus -- --write`.
import { loadCorpus, saveCorpus, relabel, reviewAll, validateCorpus } from './corpus-eval.mjs';

const args = process.argv.slice(2);
const edits = args.filter(a => a.includes('=')).map(a => {
  const [id, rest] = [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)];
  const [label, ...token] = rest.split(':');
  return { id, label, tokens: token.length ? token.join(':').split('|') : [] };
});
let corpus = relabel(loadCorpus(), edits);
if (args.includes('--review-all')) corpus = reviewAll(corpus);
const problems = validateCorpus(corpus);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
saveCorpus(corpus);
console.log(`Updated ${edits.length} label(s)${args.includes('--review-all') ? ' and marked all reviewed' : ''}.`);
