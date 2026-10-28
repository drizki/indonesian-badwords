import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertChannelAdvance, assertSameIntegrity, registryNotFound, releaseInfo } from '../scripts/release.mjs';

const manifest = (version) => ({ name: 'indonesian-badwords', version });

test('stable and prerelease versions select separate npm channels', () => {
    assert.equal(releaseInfo(manifest('2.0.0'), 'v2.0.0').channel, 'latest');
    for (const version of ['2.0.0-rc.1', '2.0.0-beta.2', '2.1.0-alpha.0']) {
        assert.equal(releaseInfo(manifest(version), `v${version}`).channel, 'next');
    }
});

test('release tags must exactly match a valid package version', () => {
    for (const tag of ['2.0.0', 'v2.0.1', 'v2.0.0-rc.1', 'v2.0.0\n']) {
        assert.throws(() => releaseInfo(manifest('2.0.0'), tag), /Release tag/);
    }
    for (const version of ['v2.0.0', '02.0.0', '2.0', '2.0.0-rc.01', '2.0.0+build']) {
        assert.throws(() => releaseInfo(manifest(version), `v${version}`), /canonical SemVer/);
    }
    assert.throws(() => releaseInfo({ ...manifest('2.0.0'), private: true }, 'v2.0.0'), /private/);
});

test('stable and prerelease channels cannot be moved backwards', () => {
    assert.doesNotThrow(() => assertChannelAdvance('2.0.0', '1.9.9', 'latest'));
    assert.doesNotThrow(() => assertChannelAdvance('2.0.0-rc.10', '2.0.0-rc.9', 'next'));
    assert.doesNotThrow(() => assertChannelAdvance('2.0.0-rc.1', null, 'next'));
    for (const [version, current] of [['2.0.0', '2.0.1'], ['2.0.0', '2.0.0'], ['2.0.0-rc.1', '2.0.0']]) {
        assert.throws(() => assertChannelAdvance(version, current, 'latest'), /Refusing/);
    }
    assert.throws(() => assertChannelAdvance('2.0.0', 'broken', 'latest'), /Invalid version/);
});

test('only a structured npm E404 means the package is unpublished', () => {
    assert.equal(registryNotFound({ stdout: '{"error":{"code":"E404"}}' }), true);
    for (const code of ['E401', 'E403', 'E500', 'ETIMEDOUT', 'ENOTFOUND']) {
        assert.equal(registryNotFound({ stdout: JSON.stringify({ error: { code } }) }), false);
    }
    assert.equal(registryNotFound({ stdout: 'not JSON' }), false);
});

test('reruns only skip an already-published version with identical bytes', () => {
    assert.doesNotThrow(() => assertSameIntegrity('sha512-abc', 'sha512-abc'));
    assert.doesNotThrow(() => assertSameIntegrity('sha256-def sha512-abc', 'sha512-abc'));
    assert.throws(() => assertSameIntegrity('sha512-other', 'sha512-abc'), /different package bytes/);
    assert.throws(() => assertSameIntegrity(null, 'sha512-abc'), /different package bytes/);
});
