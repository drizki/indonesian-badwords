const { test } = require('node:test');
const assert = require('node:assert/strict');

const badwords = require('../dist/cjs/index.js');

test('CommonJS require keeps the familiar method API', () => {
    assert.equal(typeof badwords.flag, 'function');
    assert.equal(badwords.flag('dasar anjing'), true);
    assert.equal(badwords.censor('dasar anjing'), 'dasar ***');
    assert.deepEqual(badwords.badwords('lorem anjing babi'), ['anjing', 'babi']);
});

test('CommonJS build also exposes the default export and class', () => {
    assert.equal(typeof badwords.default.flag, 'function');
    assert.equal(badwords.default.flag('dasar anjing'), true);
    assert.equal(typeof badwords.Badwords, 'function');
    assert.equal(new badwords.Badwords(['kucel']).flag('kucel'), true);
});
