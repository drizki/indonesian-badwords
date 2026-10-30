import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadCorpus, corpusUrl, runCorpus } from '../corpus-eval.mjs';

// Accuracy section of the public comparison (docs/benchmarks.md). Every compared configuration is scored on the
// evaluation corpus through evaluate(), by way of a `{ find }` adapter. No timing happens here.

/** Configurations scored only for accuracy (the speed columns do not include them). */
export const accuracyOnlyConfigs = [
    { id: 'ours-tolerant', package: 'indonesian-badwords', title: 'indonesian-badwords + README `tolerant`',
        options: 'README "Catch disguised spellings and typos" (`tolerant`): `boundedEvasion` (separators space `.` `_` `-`, up to 2 repeated letters, Latin lookalikes) plus `boundedFuzzy` (`osa`, one edit)',
        policy: { recipe: 'tolerant' } }
];

/** What decides the meaning of a stored accuracy number: the corpus bytes and how each package is turned into `find`. */
export function accuracyDefinition() {
    const corpus = loadCorpus();
    return {
        corpus: { file: 'evaluation/corpus.json', sha256: createHash('sha256').update(readFileSync(corpusUrl)).digest('hex'), cases: corpus.cases.length,
            scored: corpus.cases.filter((item) => item.label !== 'uncertain').length, uncertain: corpus.cases.filter((item) => item.label === 'uncertain').length,
            labelledBy: corpus.review.labelledBy },
        adapters: {
            'indonesian-badwords': 'find(): every occurrence with its offsets',
            '@fldx/sopan': 'findProfanity(): offsets from `index` and the length of `raw`',
            'censorship-id': 'detect(): offsets from `index` and `length`',
            '@sideid/id-profanity-filter': 'no locate operation: isProfane() decides, and a profane text yields one whole-text location (span metrics n/a)'
        },
        scored: ['holdout', 'all']
    };
}

/** The `{ find }` object evaluate() scores for one package. `locates` is false when spans are not the package's own. */
export function accuracyFinder(config, adapter) {
    const whole = (text) => [{ word: text, index: 0, end: text.length }];
    if (config.package === '@sideid/id-profanity-filter') return { locates: false, find: (text) => (adapter.flag(text) ? whole(text) : []) };
    const spans = {
        'indonesian-badwords': (item) => ({ word: item.word, index: item.index, end: item.end }),
        '@fldx/sopan': (item) => ({ word: item.word, index: item.index, end: item.index + (item.raw ?? item.word).length }),
        'censorship-id': (item) => ({ word: item.word, index: item.index, end: item.index + item.length })
    }[config.package];
    return { locates: true, find: (text) => adapter.locate(text).map(spans) };
}

const keep = (split, locates) => ({ cases: split.cases, flag: split.flag, benign: split.benign, precision: split.precision, recall: split.recall,
    falsePositiveRate: split.falsePositiveRate, ...(locates ? { spanRecall: split.spanRecall } : {}), falsePositives: split.failures.falsePositives, falseNegatives: split.failures.falseNegatives });

/** Scores one configuration; the result is what `comparison.json` stores. */
export function scoreConfiguration(config, adapter) {
    const finder = accuracyFinder(config, adapter);
    const result = runCorpus(finder, loadCorpus());
    return { locates: finder.locates, holdout: keep(result.splits.holdout, finder.locates), all: keep(result.splits.all, finder.locates), uncertain: result.uncertain };
}

const pct = (value) => `${Math.round(value * 100)}%`;
const cell = (rate) => (rate.n === 0 ? 'n/a' : `${pct(rate.value)} (${pct(rate.low)}–${pct(rate.high)}) ${rate.count}/${rate.n}${rate.n < 10 ? ' †' : ''}`);

/** Generated blocks for docs/benchmarks.md. `titles` maps configuration id to its column title, `order` lists the ids. */
export function renderAccuracy(data, titles, order) {
    const sections = {};
    const info = data.accuracy.definition.corpus;
    sections.accuracyCorpus = `Corpus: \`${info.file}\`, SHA-256 \`${info.sha256}\`: ${info.cases} cases, of which ${info.scored} are scored (flag or benign) and ${info.uncertain} are \`uncertain\` and never scored. Labels: ${info.labelledBy}.`;
    const table = (name) => {
        const first = data.accuracy.results[order[0]][name];
        return [`Scored cases: ${first.flag} flag, ${first.benign} benign.\n`,
            `| Configuration | Precision | Recall | Benign false-positive rate | Span recall |${name === 'all' ? ' Uncertain cases flagged |' : ''}`,
            `| --- | --- | --- | --- | --- |${name === 'all' ? ' --- |' : ''}`,
            ...order.map((id) => {
                const row = data.accuracy.results[id], split = row[name];
                return `| ${titles[id]} | ${cell(split.precision)} | ${cell(split.recall)} | ${cell(split.falsePositiveRate)} | ${row.locates ? cell(split.spanRecall) : 'n/a'} |${name === 'all' ? ` ${row.uncertain.flagged} of ${row.uncertain.n} |` : ''}`;
            })].join('\n');
    };
    sections.accuracyHoldout = table('holdout');
    sections.accuracyAll = table('all');
    // Where another configuration scores better than this package's default, on holdout and on all cases.
    const reference = data.accuracy.results.ours;
    const lines = [];
    for (const name of ['holdout', 'all']) for (const id of order.filter((item) => item !== 'ours')) {
        const split = data.accuracy.results[id][name], base = reference[name];
        const better = [];
        if (split.recall.value > base.recall.value) better.push(`higher recall (${pct(split.recall.value)} against ${pct(base.recall.value)})`);
        if (split.precision.value > base.precision.value) better.push(`higher precision (${pct(split.precision.value)} against ${pct(base.precision.value)})`);
        if (split.falsePositiveRate.value < base.falsePositiveRate.value) better.push(`lower benign false-positive rate (${pct(split.falsePositiveRate.value)} against ${pct(base.falsePositiveRate.value)})`);
        if (better.length) lines.push(`| ${name === 'all' ? 'all cases' : 'holdout'} | ${titles[id]} | ${better.join('; ')} |`);
    }
    sections.accuracyBetter = lines.length ? [`| Split | Configuration | Better than this package's default on |`, `| --- | --- | --- |`, ...lines].join('\n')
        : 'No other configuration scored higher than this package\'s default on any of these measures in this run.';
    return sections;
}
