import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';

const registry = 'https://registry.npmjs.org';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export function releaseInfo(manifest, tag) {
    if (manifest.private === true) throw new Error('Cannot publish a private package.');
    if (typeof manifest.name !== 'string'
        || !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(manifest.name)) {
        throw new Error('Invalid package name.');
    }
    if (semver.valid(manifest.version) !== manifest.version) {
        throw new Error('Package version must be a canonical SemVer version without build metadata.');
    }
    if (tag !== `v${manifest.version}`) {
        throw new Error(`Release tag must be v${manifest.version}.`);
    }
    return {
        name: manifest.name,
        version: manifest.version,
        channel: semver.prerelease(manifest.version) ? 'next' : 'latest'
    };
}

export function assertChannelAdvance(version, current, channel) {
    if (current === null || current === undefined) return;
    if (!semver.valid(current)) throw new Error(`Invalid version on npm's ${channel} channel.`);
    if (!semver.gt(version, current)) {
        throw new Error(`Refusing to move ${channel} from ${current} to ${version}.`);
    }
}

export function registryNotFound(error) {
    try {
        return JSON.parse(String(error.stdout)).error?.code === 'E404';
    } catch {
        return false;
    }
}

export function assertSameIntegrity(expected, actual) {
    if (typeof expected !== 'string' || !expected.split(/\s+/).includes(actual)) {
        throw new Error('This version already exists on npm with different package bytes.');
    }
}

function view(spec, field) {
    try {
        const output = execFileSync(npm, ['view', spec, field, '--json', '--registry', registry], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        });
        return JSON.parse(output.trim() || 'null');
    } catch (error) {
        // A network failure, auth error, or malformed response must fail the job.
        if (registryNotFound(error)) return null;
        throw error;
    }
}

function output(values) {
    if (process.env.GITHUB_OUTPUT) {
        for (const [key, value] of Object.entries(values)) {
            appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
        }
    }
}

async function main() {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
    const info = releaseInfo(manifest, process.env.RELEASE_TAG ?? process.env.GITHUB_REF_NAME);
    if (lock.version !== info.version || lock.packages[''].version !== info.version) {
        throw new Error('package-lock.json version does not match package.json.');
    }

    const [action, archive] = process.argv.slice(2);
    if (action === 'info') {
        output(info);
        console.log(`${info.name}@${info.version} will publish to ${info.channel}.`);
        return;
    }
    if (action !== 'preflight' || !archive) {
        throw new Error('Usage: node scripts/release.mjs info | preflight <package.tgz>');
    }

    const packed = JSON.parse(execFileSync('tar', ['-xOf', resolve(archive), 'package/package.json'], {
        encoding: 'utf8'
    }));
    if (packed.name !== info.name || packed.version !== info.version) {
        throw new Error('The verified tarball does not match the release name and version.');
    }
    const npmVersion = execFileSync(npm, ['--version'], { encoding: 'utf8' }).trim();
    if (!semver.gte(npmVersion, '11.5.1')) {
        throw new Error('Trusted publishing requires npm >=11.5.1.');
    }

    const integrity = `sha512-${createHash('sha512').update(readFileSync(archive)).digest('base64')}`;
    const existing = view(`${info.name}@${info.version}`, 'dist');
    if (existing !== null) {
        assertSameIntegrity(existing.integrity, integrity);
        output({ ...info, publish: 'false' });
        console.log('Identical package bytes are already published; skipping publication.');
        return;
    }

    const tags = view(info.name, 'dist-tags');
    assertChannelAdvance(info.version, tags?.[info.channel], info.channel);
    output({ ...info, publish: 'true' });
    console.log(`Registry checks passed for ${info.name}@${info.version} (${info.channel}).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main();
}
