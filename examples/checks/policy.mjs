import assert from 'node:assert/strict';
import { createModerator, segments } from '../.policy/shared/moderation.js';

const first = createModerator(['customterm']);
const second = createModerator();
const left = first.check('customterm');
const right = second.check('customterm');
assert.equal(left.status, 'complete');
assert.equal(right.status, 'complete');
assert.equal(left.result.censored, '***');
assert.equal(right.result.censored, 'customterm');
const quote = first.check('goblok', 'goblok');
assert.equal(quote.status, 'complete');
assert.equal(quote.result.censored, 'goblok\n***');
assert.deepEqual(segments('abcdef!', [
  { word: 'a', index: 0, end: 3, match: 'abc' },
  { word: 'b', index: 0, end: 6, match: 'abcdef' },
]), [{ text: '', matched: false }, { text: 'abcdef', matched: true }, { text: '!', matched: false }]);
const crlf = first.check('goblok', 'quoted\r');
assert.equal(crlf.status, 'complete');
assert.equal(crlf.result.censored, 'quoted\r\n***');
assert.equal(first.check('a'.repeat(1001)).status, 'error');
assert.equal(first.check('terima kasih').status, 'complete');
console.log('Example policy isolation, quote ranges, overlap rendering, and error recovery passed.');
