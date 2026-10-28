import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { Badwords } from '../dist/esm/index.js';
import {
    dictionary,
    contextualDictionary,
    expandedDictionary
} from '../dist/esm/index.js';

const bundled = new Badwords();

const representativeVariants = [
    'anjer', 'anjeng', 'anjim', 'anjis', 'anzeng',
    'bahlul', 'bajindul', 'bangsad', 'berengsek', 'brengsek',
    'cukimak', 'dancuk', 'diancuk', 'diamput', 'dyancok',
    'encuk', 'entod', 'gebleh', 'goblik', 'hancik', 'hancok',
    'jamput', 'jancik', 'jiancuk', 'kentod', 'konthol', 'naskleng',
    'ngencuk', 'ngenthu', 'ngentod', 'ngentu', 'ngloco', 'pukimai',
    'sundel', 'telaso', 'tolil', 'wancok'
];

const cleanPhrases = [
    'latihan taekwondo pagi',
    'diskusi intelektual',
    'kami minum bajigur hangat',
    'pertunjukan musik koplo',
    'ikan berbau anyir',
    'anjungan informasi',
    'pencuci tangan',
    'berengsel logam',
    'pukulan terarah',
    'budaya Bali dan Makassar'
];

const literalPhrases = [
    'Suhu udara 28 derajat.',
    'Buang sampah pada tempatnya.',
    'Tambahkan item ke keranjang.',
    'Bocah itu membaca buku.',
    'Saya bertemu Riyad.',
    'Beliau sudah sepuh.',
    'Humornya kocak.',
    'Anjing peliharaan saya sehat.',
    'Babi hutan mencari makan.',
    'Monyet itu makan pisang.',
    'Asu iku kewan.',
    'Burung kuntul terbang.',
    'Ikan buntal berenang.',
    'Kampret adalah jenis kelelawar.',
    'Produk cacat bisa dikembalikan.',
    'Titik buta kamera perlu diperiksa.',
    'Homo sapiens mempelajari evolusi.',
    'Perawatan kurap dan koreng tersedia.',
    'Jangan ngocok telur terlalu lama.',
    'Harga Patek Philippe naik.',
    'Susu diberikan melalui feeder otomatis.',
    'Dia bermain epep dengan temannya.',
    'Saya menonton acara bersama bokin.',
    'Bunyi jidor terdengar dari panggung.',
    'Sial, keretanya sudah berangkat.',
    'Susu diberikan kepada anak melalui tetek induknya.'
];

const removedNeutralTerms = [
    'bocah', 'bokin', 'epep', 'feeder', 'item', 'jidor', 'kocak',
    'panlok', 'riyad', 'sepuh', 'suhu', 'tbl'
];

function assertClean(checker, text) {
    assert.equal(checker.flag(text), false, text);
    assert.deepEqual(checker.badwords(text), [], text);
    assert.equal(checker.censor(text), text, text);
    const analysis = checker.analyze(text);
    assert.equal(analysis.censored, text, text);
    assert.equal(analysis.count, 0, text);
    assert.deepEqual(analysis.locations, [], text);
}

describe('bundled dictionary coverage', () => {
    test('keeps unique, nonempty lowercase entries in both policies', () => {
        for (const words of [dictionary, contextualDictionary, expandedDictionary]) {
            assert.equal(new Set(words).size, words.length);
            for (const word of words) {
                assert.ok(word.length > 0, 'entries must not be empty');
                assert.equal(word, word.trim(), `unexpected whitespace in ${word}`);
                assert.equal(word, word.toLowerCase(), `unexpected casing in ${word}`);
            }
        }

        assert.deepEqual(expandedDictionary, [...dictionary, ...contextualDictionary]);
        assert.ok(contextualDictionary.every((word) => !dictionary.includes(word)));
    });

    test('protects exported lists from mutations that could change future instances', () => {
        for (const words of [dictionary, contextualDictionary, expandedDictionary]) {
            assert.equal(Object.isFrozen(words), true);
            assert.throws(() => words.push('injected'), TypeError);
            assert.throws(() => { words[0] = 'injected'; }, TypeError);
        }
        assertClean(new Badwords(), 'injected');
    });

    test('detects and censors the representative coarse words and spelling variants', () => {
        for (const word of representativeVariants) {
            assert.ok(bundled.dict.includes(word), `missing dictionary entry: ${word}`);
            for (const spelling of [word, word.toUpperCase()]) {
                const text = `hei ${spelling}!`;

                assert.equal(bundled.flag(text), true, text);
                assert.ok(bundled.badwords(text).includes(word), text);
                assert.equal(bundled.censor(text), 'hei ***!', text);
                assert.equal(bundled.filter(`hei ${spelling}`), 'hei', text);
            }
        }
    });

    test('detects and censors numeric obfuscations of representative variants', () => {
        const cases = [
            ['b4hlul', 'bahlul'],
            ['br3ngs3k', 'brengsek'],
            ['k0nth0l', 'konthol'],
            ['ng3nt0d', 'ngentod'],
            ['n45kl3ng', 'naskleng'],
            ['puk1m41', 'pukimai'],
            ['t3l450', 'telaso']
        ];

        for (const [spelling, word] of cases) {
            assert.equal(bundled.flag(spelling), true, spelling);
            assert.ok(bundled.badwords(spelling).includes(word), spelling);
            assert.equal(bundled.censor(spelling), '***', spelling);
        }
    });

    test('keeps nearby benign vocabulary and regional references clean', () => {
        for (const text of cleanPhrases) {
            assertClean(bundled, text);
        }
    });

    test('keeps literal animal, identity, medical and ordinary language clean by default', () => {
        for (const text of literalPhrases) assertClean(bundled, text);
    });

    test('makes broader contextual vocabulary an explicit opt-in', () => {
        const expanded = new Badwords({ dictionary: expandedDictionary });
        const cases = [
            ['Anjing peliharaan saya sehat.', 'anjing'],
            ['Monyet itu makan pisang.', 'monyet'],
            ['Buang sampah pada tempatnya.', 'sampah'],
            ['Produk cacat bisa dikembalikan.', 'cacat'],
            ['Homo sapiens mempelajari evolusi.', 'homo'],
            ['Jangan ngocok telur terlalu lama.', 'ngocok']
        ];

        for (const [text, word] of cases) {
            assertClean(bundled, text);
            assert.equal(expanded.flag(text), true, text);
            assert.deepEqual(expanded.badwords(text), [word], text);
        }
        assert.equal(expanded.flag('goblok'), true, 'expanded also includes the core');

                assert.equal(expanded.censor('Anjing peliharaan saya sehat.'), '*** peliharaan saya sehat.');
    });

    test('does not restore unrelated slang and names under the expanded policy', () => {
        const expanded = new Badwords({ dictionary: expandedDictionary });
        for (const word of removedNeutralTerms) {
            assert.ok(!expandedDictionary.includes(word), word);
            assertClean(bundled, word);
            assertClean(expanded, word);
        }
    });

    test('covers selected strong inflections without unrestricted stemming', () => {
        for (const word of ['kontolmu', 'memeknya', 'ngentotin', 'gobloknya', 'tololnya', 'bajingannya']) {
            const text = `hei ${word}!`;
            assert.equal(bundled.flag(text), true, text);
            assert.deepEqual(bundled.badwords(text), [word], text);
            assert.equal(bundled.censor(text), 'hei ***!', text);
        }
        for (const text of ['pohon sialang tumbuh tinggi', 'jalan menuju pantai', 'pelanggaran asusila']) {
            assertClean(bundled, text);
        }
    });

    test('spelling variants do not introduce matches for selected benign phrases', () => {
        const addedWords = new Badwords({ dictionary: representativeVariants, mode: 'substring' });

        // The existing entry "ajig" already matches "bajigur" in substring mode.
        // Check these variants separately to avoid hiding that inherited behavior.
        for (const text of cleanPhrases) {
            assert.equal(addedWords.flag(text), false, text);
            assert.equal(addedWords.censor(text), text, text);
        }
    });
});
