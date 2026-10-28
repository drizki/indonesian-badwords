import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Badwords, dictionary, contextualDictionary, expandedDictionary } from '../dist/esm/index.js';

const core = new Badwords();
const expanded = new Badwords({ dictionary: expandedDictionary });

test('bundled spellings preserve source spans, case handling, and terminal punctuation', () => {
    for (const [preset, words] of [['core', dictionary], ['contextual', contextualDictionary]]) {
        for (const word of words) {
            const detector = preset === 'core' ? core : expanded;
            for (const spelling of [word, word.toUpperCase()]) {
                const text = `Pesan: ${spelling}!`;
                assert.equal(detector.flag(text), true, text);
                assert.deepEqual(detector.find(text), [{ word, index: 7, end: 7 + spelling.length, match: spelling }], text);
                assert.equal(detector.censor(text), 'Pesan: ***!', text);
                assert.deepEqual(detector.badwords(text), [word], text);
                if (preset === 'contextual') {
                    assert.equal(core.flag(text), false, text);
                    assert.equal(core.censor(text), text, text);
                }
            }
        }
    }
});

test('ordinary homonyms, acronyms, names, food and nearby words stay clean by default', () => {
    const texts = [
        'Bus BCT berangkat dari Balikpapan.',
        'Artikel ini terbit di JMBT.',
        'Kode mata uang kyat adalah MMK.',
        'TNI AL menggelar latihan ASW.',
        'Kami membeli mpek-mpek Palembang.',
        'Ikan itu berbau anyir.',
        'Pertunjukan musik koplo dimulai.',
        'Jaga kesehatan matamu.',
        'Dokter memeriksa tahi lalat.',
        'Mereka bermain cuki di rumah.',
        'Lidahnya pilat saat berbicara.',
        'Ancik berarti tumpuan dalam bahasa Jawa.',
        'Burung belekok hinggap di sana.',
        'Ontohod adalah sebutan beruang.',
        'Kami membeli buah klengkeng dan kelengkeng.',
        'Latihan taekwondo dilanjutkan dengan diskusi intelektual.',
        'Anjas dan Sihite membaca buku.',
        'Koneksi internet sedang lemot.',
        'Aing, sia, maneh, dan urang dibahas sebagai pronomina.',
        'Saya butuh nasi goreng.'
    ];
    for (const text of texts) {
        assert.equal(core.flag(text), false, text);
        assert.deepEqual(core.find(text), [], text);
        assert.equal(core.censor(text), text, text);
    }
});

test('explicit regional inflections, reversed forms and phrases do not enable general transformations', () => {
    for (const text of ['tailasonu', 'kabulammak', 'lotnok', 'kemem', 'cuki mai', 'esek-esek']) {
        assert.equal(core.flag(text), true, text);
        assert.equal(core.censor(text), '***', text);
    }
    for (const text of ['kolbog', 'tailasomu', 'cuki   mai', 'esek esek']) {
        assert.equal(core.flag(text), false, text);
    }
    const repeat = new Badwords({ ignoreRepeatedLetters: true });
    assert.equal(core.flag('gblkkkk'), false);
    assert.equal(repeat.flag('gblkkkk'), true);
    assert.equal(repeat.censor('gblkkkk!'), '***!');
});
