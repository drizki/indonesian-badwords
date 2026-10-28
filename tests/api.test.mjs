import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import instance, {
    Badwords,
    addWords,
    analyze,
    badwords as findBadwords,
    censor,
    filter,
    flag,
    removeWords
} from '../dist/esm/index.js';

describe('flag()', () => {
    test('rejects an empty string', () => {
        assert.throws(() => flag(''), /empty string passed/);
    });

    test('rejects a non-string', () => {
        assert.throws(() => flag({}), /string expected/);
    });

    test('returns false for clean text', () => {
        assert.equal(flag('lorem ipsum'), false);
    });

    test('returns true for a bad word', () => {
        assert.equal(flag('lorem anjing!'), true);
    });

    test('detects leetspeak', () => {
        assert.equal(flag('dasar 4nj1ng'), true);
    });

    test('detects concatenated words', () => {
        assert.equal(flag('dasarbajingankontol'), true);
    });
});

describe('badwords()', () => {
    test('rejects an empty string', () => {
        assert.throws(() => findBadwords(''), /empty string passed/);
    });

    test('rejects a non-string', () => {
        assert.throws(() => findBadwords({}), /string expected/);
    });

    test('returns an empty array for clean text', () => {
        assert.deepEqual(findBadwords('lorem ipsum'), []);
    });

    test('returns found words', () => {
        assert.deepEqual(findBadwords('lorem anjing babi'), ['anjing', 'babi']);
    });

    test('returns words found in concatenated text', () => {
        assert.deepEqual(findBadwords('dasarbajingankontol'), ['bajingan', 'kontol']);
    });
});

describe('censor()', () => {
    test('rejects an empty string', () => {
        assert.throws(() => censor(''), /empty string passed/);
    });

    test('rejects a non-string', () => {
        assert.throws(() => censor({}), /string expected/);
    });

    test('leaves clean text untouched', () => {
        assert.equal(censor('lorem ipsum'), 'lorem ipsum');
    });

    test('replaces bad words with the default replacement', () => {
        assert.equal(censor('lorem monyet'), 'lorem ***');
        assert.equal(censor('lorem anjing babi!'), 'lorem *** ***!');
    });

    test('supports a custom replacement', () => {
        assert.equal(censor('dasar anjing', '[removed]'), 'dasar [removed]');
    });

    test('censored leetspeak', () => {
        assert.equal(censor('dasar 4nj1ng'), 'dasar ***');
    });
});

describe('filter()', () => {
    test('removes bad words and cleans whitespace', () => {
        assert.equal(filter('lorem ipsum anjing'), 'lorem ipsum');
        assert.equal(filter('lorem ipsum babi anjing'), 'lorem ipsum');
    });
});

describe('analyze()', () => {
    test('rejects an empty string', () => {
        assert.throws(() => analyze(''), /empty string passed/);
    });

    test('rejects a non-string', () => {
        assert.throws(() => analyze({}), /string expected/);
    });

    test('returns a full result for clean text', () => {
        assert.deepEqual(analyze('lorem ipsum'), {
            text: 'lorem ipsum',
            words: 2,
            censored: 'lorem ipsum',
            badwords: [],
            count: 0,
            locations: []
        });
    });

    test('returns locations and a censored string', () => {
        assert.deepEqual(analyze('lorem anjing babi!'), {
            text: 'lorem anjing babi!',
            words: 3,
            censored: 'lorem *** ***!',
            badwords: ['anjing', 'babi'],
            count: 2,
            locations: [
                { word: 'anjing', index: 6 },
                { word: 'babi', index: 13 }
            ]
        });
    });
});

describe('dictionary customization', () => {
    test('a new instance starts from a custom dictionary', () => {
        const custom = new Badwords(['kucel']);

        assert.equal(custom.flag('muka kamu kucel'), true);
        assert.equal(custom.flag('dasar anjing'), false);
    });

    test('addWords() and removeWords() mutate the shared instance', () => {
        try {
            addWords('kucel');
            assert.equal(flag('muka kamu kucel'), true);

            removeWords('kucel');
            assert.equal(flag('muka kamu kucel'), false);
        } finally {
            removeWords('kucel');
        }
    });

    test('the default export exposes the same API', () => {
        assert.equal(instance.flag('dasar anjing'), true);
        assert.equal(instance.censor('dasar anjing'), 'dasar ***');
        assert.deepEqual(instance.dict, [...instance.dict]);
    });
});
