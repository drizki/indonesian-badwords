import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Badwords } from '../dist/esm/index.js';

test('dictionary snapshots and source spans remain stable across normalization combinations', () => {
    // Fixed seed and deliberately troublesome Unicode/leet atoms. These check
    // public round-trip invariants, independently of normalization internals.
    const atoms = ['a', 'B', 'i', '1', '0', '@', '!', '|', ' ', '\t', '\u200b',
        '\u0301', '\u0307', 'İ', '¨', '¯', 'ﬃ', 'ㄱ', 'ㅏ', 'Σ', '😀'];
    let seed = 0x98765432;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
    for (let sample = 0; sample < 300; sample++) {
        const text = Array.from({ length: 1 + random() % 10 }, () => atoms[random() % atoms.length]).join('');
        for (const normalization of ['standard', 'none']) {
            for (const ignoreRepeatedLetters of [false, true]) {
                const options = { dictionary: [text], normalization, ignoreRepeatedLetters };
                const detector = new Badwords(options);
                const snapshot = detector.dict;
                const clone = new Badwords({ ...options, dictionary: snapshot });
                assert.deepEqual(clone.dict, snapshot, JSON.stringify(options));
                detector.addWords(snapshot);
                assert.deepEqual(detector.dict, snapshot);
                for (const word of snapshot) assert.equal(detector.flag(word), true, JSON.stringify(options));
                const analysis = detector.analyze(text);
                assert.equal(analysis.censored, detector.censor(text));
                assert.deepEqual(analysis.locations, detector.find(text));
                for (const match of analysis.locations) {
                    assert.ok(match.index >= 0 && match.end > match.index && match.end <= text.length);
                    assert.equal(text.slice(match.index, match.end), match.match);
                }
                detector.removeWords(snapshot);
                assert.deepEqual(detector.dict, []);
            }
        }
    }
});
