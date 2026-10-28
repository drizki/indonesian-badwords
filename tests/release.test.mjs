import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { assertChannelAdvance, assertSameIntegrity, npmPublish, publicationPreflight,
    publishVerifiedArtifact, registryNotFound, registryView, releaseInfo,
    transparencyLogConflict } from '../scripts/release.mjs';

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

const info = releaseInfo(manifest('2.4.0'), 'v2.4.0');
const conflictText = 'npm error code TLOG_CREATE_ENTRY_ERROR\n'
    + 'npm error error creating tlog entry - (409) an equivalent entry already exists in the transparency log with UUID example-log-id\n'
    + 'npm error cause (409) an equivalent entry already exists in the transparency log with UUID example-log-id\n';
const conflict = (changes = {}) => Object.assign(new Error('Fixture publish conflict'), {
    status: 1, stdout: '', stderr: conflictText, ...changes
});
function archiveFixture(run) {
    const directory = mkdtempSync(join(tmpdir(), 'badwords-release-test-'));
    const archive = join(directory, 'verified.tgz');
    writeFileSync(archive, 'fixture bytes of an already-verified artifact');
    const integrity = `sha512-${createHash('sha512').update(readFileSync(archive)).digest('base64')}`;
    try { run({ archive, integrity }); }
    finally { rmSync(directory, { recursive: true, force: true }); }
}

test('only structured E404 proves registry absence; successful responses must be JSON objects', () => {
    const missing = Object.assign(new Error('Fixture missing'), { stdout: '{"error":{"code":"E404"}}' });
    assert.equal(registryView('example@1.0.0', 'dist', () => { throw missing; }), null);
    for (const output of ['', ' ', 'null', 'true', '1', '[]', '{']) {
        assert.throws(() => registryView('example@1.0.0', 'dist', () => output));
    }
    for (const code of ['E401', 'E403', 'E500', 'ENOTFOUND', 'ETIMEDOUT']) {
        const failure = Object.assign(new Error(code), { stdout: JSON.stringify({ error: { code } }) });
        assert.throws(() => registryView('example@1.0.0', 'dist', () => { throw failure; }), error => error === failure);
    }
    assert.deepEqual(registryView('example', 'dist-tags', (command, args, options) => {
        assert.ok(command === 'npm' || command === 'npm.cmd');
        assert.deepEqual(args, ['view', 'example', 'dist-tags', '--json', '--registry', 'https://registry.npmjs.org']);
        assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
        return '{"latest":"2.3.0"}';
    }), { latest: '2.3.0' });
});

test('preflight rejects malformed registry dist and tag metadata without assuming an empty channel', () => {
    for (const existing of [undefined, [], false, 'missing', {}, { integrity: [] }]) {
        assert.throws(() => publicationPreflight(info, 'sha512-fixture', () => existing), /Invalid npm registry dist/);
    }
    for (const tags of [undefined, [], false, 'missing', { latest: null }, { latest: 3 },
        { latest: 'broken' }, { latest: '2.3.0', next: {} }]) {
        assert.throws(() => publicationPreflight(info, 'sha512-fixture', (_spec, field) => field === 'dist' ? null : tags),
            /Invalid npm registry dist-tags/);
    }
    for (const tags of [null, {}, { next: '2.5.0-beta.1' }]) {
        assert.equal(publicationPreflight(info, 'sha512-fixture', (_spec, field) => field === 'dist' ? null : tags), true);
    }
});

test('conflict classification requires the exact npm code and equivalent-entry 409, without contradictory errors', () => {
    assert.equal(transparencyLogConflict(conflict()), true);
    assert.equal(transparencyLogConflict(conflict({ stderr: conflictText.replaceAll('\n', '\r\n') })), true);
    assert.equal(transparencyLogConflict(conflict({ stdout: JSON.stringify({ error: {
        code: 'TLOG_CREATE_ENTRY_ERROR', summary: 'error creating tlog entry - (409) an equivalent entry already exists in the transparency log'
    } }), stderr: '' })), true);
    for (const error of [new Error(conflictText), conflict({ status: 0 }), conflict({ status: null }),
        conflict({ stderr: conflictText.replaceAll('(409)', '(500)') }),
        conflict({ stderr: conflictText.replaceAll('an equivalent entry already exists', 'a different conflict occurred') }),
        conflict({ stderr: conflictText.replace('npm error code TLOG_CREATE_ENTRY_ERROR', 'npm error code E403') }),
        conflict({ stderr: 'npm error code E403\nnpm error Quoted message: TLOG_CREATE_ENTRY_ERROR (409) an equivalent entry already exists in the transparency log\n' }),
        conflict({ stdout: '{"error":{"code":"E403"}}' }),
        conflict({ stdout: '{"error":{"code":null}}' }),
        conflict({ stderr: conflictText + 'npm error code E403\n' }),
        conflict({ stderr: 'npm error code E409\nnpm error (409) package version exists\n' })]) {
        assert.equal(transparencyLogConflict(error), false);
    }
});

test('fresh publication runs preflight and starts one provenance-enabled npm process', () => archiveFixture(({ archive }) => {
    const calls = [];
    assert.deepEqual(publishVerifiedArtifact(info, archive, {
        readRegistry(spec, field) {
            calls.push(field);
            assert.equal(spec, field === 'dist' ? 'indonesian-badwords@2.4.0' : 'indonesian-badwords');
            return field === 'dist' ? null : { latest: '2.3.0' };
        },
        publish(release, path) { assert.equal(release, info); assert.equal(path, archive); calls.push('publish'); },
        onRetry() { assert.fail('Successful publication must not retry'); }
    }), { published: true, attempts: 1 });
    assert.deepEqual(calls, ['dist', 'dist-tags', 'publish']);
    npmPublish(info, archive, (command, args, options) => {
        assert.ok(command === 'npm' || command === 'npm.cmd');
        assert.deepEqual(args, ['publish', archive, '--ignore-scripts', '--tag', 'latest',
            '--provenance', '--access', 'public', '--registry', 'https://registry.npmjs.org']);
        assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
        return { status: 0, stdout: '', stderr: '' };
    });
}));

test('an identical registered version skips publishing, while a different integrity fails', () => archiveFixture(({ archive, integrity }) => {
    for (const existing of [integrity, 'sha512-other']) {
        const run = () => publishVerifiedArtifact(info, archive, {
            readRegistry(_spec, field) { assert.equal(field, 'dist'); return { integrity: existing }; },
            publish() { assert.fail('A registered version must not publish again'); },
            onRetry() { assert.fail('Preflight must not retry'); }
        });
        if (existing === integrity) assert.deepEqual(run(), { published: false, attempts: 0 });
        else assert.throws(run, /different package bytes/);
    }
}));

test('an exact conflict gets one fresh publish after repeating full registry preflight', () => archiveFixture(({ archive }) => {
    const calls = [];
    let attempts = 0;
    assert.deepEqual(publishVerifiedArtifact(info, archive, {
        readRegistry(_spec, field) { calls.push(field); return field === 'dist' ? null : { latest: '2.3.0' }; },
        publish() { calls.push('publish'); if (attempts++ === 0) throw conflict(); },
        onRetry() { calls.push('retry'); }
    }), { published: true, attempts: 2 });
    assert.deepEqual(calls, ['dist', 'dist-tags', 'publish', 'retry', 'dist', 'dist-tags', 'publish']);
}));

test('a registered identical artifact after a conflict skips the second publish', () => archiveFixture(({ archive, integrity }) => {
    let reads = 0;
    let attempts = 0;
    assert.deepEqual(publishVerifiedArtifact(info, archive, {
        readRegistry(_spec, field) {
            if (field === 'dist-tags') return { latest: '2.3.0' };
            return reads++ === 0 ? null : { integrity };
        },
        publish() { attempts++; throw conflict(); }, onRetry() {}
    }), { published: false, attempts: 1 });
    assert.equal(attempts, 1);
}));

test('normal errors and repeated conflicts fail without an unbounded retry', () => archiveFixture(({ archive }) => {
    for (const failure of [new Error('Normal publish failure'), conflict()]) {
        let attempts = 0;
        let retries = 0;
        assert.throws(() => publishVerifiedArtifact(info, archive, {
            readRegistry(_spec, field) { return field === 'dist' ? null : { latest: '2.3.0' }; },
            publish() { attempts++; throw failure; }, onRetry() { retries++; }
        }), error => error === failure);
        assert.equal(attempts, failure.stderr ? 2 : 1);
        assert.equal(retries, failure.stderr ? 1 : 0);
    }
}));

test('retry preflight rejects registry uncertainty, integrity mismatch, advanced channels, or changed tar bytes', () => archiveFixture(({ archive }) => {
    for (const scenario of ['network', 'malformed', 'different-integrity', 'advanced-channel', 'changed-tar']) {
        writeFileSync(archive, 'fixture bytes of an already-verified artifact');
        let attempts = 0;
        assert.throws(() => publishVerifiedArtifact(info, archive, {
            readRegistry(_spec, field) {
                if (attempts && scenario === 'network') throw new Error('Registry unavailable');
                if (field === 'dist') return attempts && scenario === 'different-integrity' ? { integrity: 'sha512-other' } : null;
                if (attempts && scenario === 'malformed') return [];
                return { latest: attempts && scenario === 'advanced-channel' ? '2.5.0' : '2.3.0' };
            },
            publish() {
                attempts++;
                if (scenario === 'changed-tar') writeFileSync(archive, 'changed artifact bytes');
                throw conflict();
            }, onRetry() {}
        }));
        assert.equal(attempts, 1, scenario);
    }
}));

test('registry uncertainty before the first attempt cannot trigger publishing or a retry', () => archiveFixture(({ archive }) => {
    const failure = new Error('Registry query failed');
    assert.throws(() => publishVerifiedArtifact(info, archive, {
        readRegistry() { throw failure; },
        publish() { assert.fail('Uncertain registry state cannot publish'); },
        onRetry() { assert.fail('Registry queries must not retry'); }
    }), error => error === failure);
}));
