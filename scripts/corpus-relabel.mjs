// Record the maintainer's answers in evaluation/corpus.json, then regenerate the baseline.
//   node scripts/corpus-relabel.mjs id=benign id2=flag:token id3=uncertain id4=flag
// `id=<label>` sets the label; when it equals the current label it confirms a proposed one (spans are kept).
// `id=flag:token` sets spans from the token (several tokens: `id=flag:one|two`).
// Every named case becomes `reviewed`; nothing is marked reviewed in bulk. Afterwards run `npm run evaluate:corpus -- --write`.
import { loadCorpus, saveCorpus, relabel, validateCorpus } from './corpus-eval.mjs';

export function parseEdits(args) {
  if (!args.length) throw new Error('give at least one id=label argument');
  return args.map(a => {
    const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)=(flag|benign|uncertain)(?::(.+))?$/.exec(a);
    if (!match) throw new Error(`unknown argument "${a}"; expected id=flag, id=benign, id=uncertain or id=flag:token`);
    const [, id, label, tokens] = match;
    if (tokens && label !== 'flag') throw new Error(`${id}: only flag takes a token`);
    return { id, label, tokens: tokens ? tokens.split('|') : [] };
  });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const edits = parseEdits(process.argv.slice(2));
    const corpus = relabel(loadCorpus(), edits);
    const problems = validateCorpus(corpus);
    if (problems.length) throw new Error(problems.join('\n'));
    saveCorpus(corpus);
    console.log(`Updated ${edits.length} label(s). Run: npm run evaluate:corpus -- --write`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
