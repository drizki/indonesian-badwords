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
    test('accepts an empty string', () => { assert.equal(flag(''), false); });

    test('rejects a non-string', () => {
        assert.throws(() => flag({}), /string expected/);
    });

    test('returns false for clean text', () => {
        assert.equal(flag('lorem ipsum'), false);
    });

    test('returns true for a bad word', () => {
        assert.equal(flag('lorem goblok!'), true);
    });

    test('detects leetspeak', () => {
        assert.equal(flag('dasar g0bl0k'), true);
    });

    test('requires an explicit substring mode for concatenated words', () => {
        assert.equal(flag('dasarbajingankontol'), false);
        const substring = new Badwords({ mode: 'substring' });
        assert.equal(substring.flag('dasarbajingankontol'), true);
    });
});

describe('badwords()', () => {
    test('accepts an empty string', () => { assert.deepEqual(findBadwords(''), []); });

    test('rejects a non-string', () => {
        assert.throws(() => findBadwords({}), /string expected/);
    });

    test('returns an empty array for clean text', () => {
        assert.deepEqual(findBadwords('lorem ipsum'), []);
    });

    test('returns found words', () => {
        assert.deepEqual(findBadwords('lorem goblok kontol'), ['goblok', 'kontol']);
    });

    test('returns words found in concatenated text', () => {
        assert.deepEqual(findBadwords('dasarbajingankontol'), []);
        const substring = new Badwords({ mode: 'substring' });
        assert.deepEqual(substring.badwords('dasarbajingankontol'), ['bajingan', 'kontol']);
    });
});

describe('censor()', () => {
    test('accepts an empty string', () => { assert.equal(censor(''), ''); });

    test('rejects a non-string', () => {
        assert.throws(() => censor({}), /string expected/);
    });

    test('leaves clean text untouched', () => {
        assert.equal(censor('lorem ipsum'), 'lorem ipsum');
    });

    test('replaces bad words with the default replacement', () => {
        assert.equal(censor('lorem jancuk'), 'lorem ***');
        assert.equal(censor('lorem goblok kontol!'), 'lorem *** ***!');
    });

    test('supports a custom replacement', () => {
        assert.equal(censor('dasar goblok', '[removed]'), 'dasar [removed]');
    });

    test('censored leetspeak', () => {
        assert.equal(censor('dasar g0bl0k'), 'dasar ***');
    });
});

describe('filter()', () => {
    test('removes bad words and cleans whitespace', () => {
        assert.equal(filter('lorem ipsum goblok'), 'lorem ipsum');
        assert.equal(filter('lorem ipsum kontol goblok'), 'lorem ipsum');
    });
});

describe('analyze()', () => {
    test('accepts an empty string', () => { assert.equal(analyze('').occurrenceCount, 0); });

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
            occurrenceCount: 0,
            locations: []
        });
    });

    test('returns locations and a censored string', () => {
        assert.deepEqual(analyze('lorem goblok kontol!'), {
            text: 'lorem goblok kontol!',
            words: 3,
            censored: 'lorem *** ***!',
            badwords: ['goblok', 'kontol'],
            count: 2,
            occurrenceCount: 2,
            locations: [
                { word: 'goblok', index: 6, end: 12, match: 'goblok', via: { kind: 'exact' } },
                { word: 'kontol', index: 13, end: 19, match: 'kontol', via: { kind: 'exact' } }
            ]
        });
    });
});

describe('dictionary customization', () => {
    test('a new instance starts from a custom dictionary', () => {
        const custom = new Badwords({ dictionary: ['kucel'] });

        assert.equal(custom.flag('muka kamu kucel'), true);
        assert.equal(custom.flag('dasar goblok'), false);
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
        assert.equal(instance.flag('dasar goblok'), true);
        assert.equal(instance.censor('dasar goblok'), 'dasar ***');
        assert.deepEqual(instance.dict, [...instance.dict]);
    });
});
