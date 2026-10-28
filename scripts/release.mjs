import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
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

export function registryView(spec, field, execute = execFileSync) {
    try {
        const output = execute(npm, ['view', spec, field, '--json', '--registry', registry], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        });
        const value = JSON.parse(output);
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            throw new Error(`Invalid npm registry response for ${field}.`);
        }
        return value;
    } catch (error) {
        // A network failure, auth error, or malformed response must fail the job.
        if (registryNotFound(error)) return null;
        throw error;
    }
}

export function publicationPreflight(info, integrity, readRegistry = registryView) {
    const existing = readRegistry(`${info.name}@${info.version}`, 'dist');
    if (existing !== null) {
        if (!existing || typeof existing !== 'object' || Array.isArray(existing)
            || typeof existing.integrity !== 'string') {
            throw new Error('Invalid npm registry dist metadata.');
        }
        assertSameIntegrity(existing.integrity, integrity);
        return false;
    }

    const tags = readRegistry(info.name, 'dist-tags');
    if (tags !== null && (!tags || typeof tags !== 'object' || Array.isArray(tags)
        || Object.values(tags).some(version => typeof version !== 'string' || semver.valid(version) !== version))) {
        throw new Error('Invalid npm registry dist-tags metadata.');
    }
    const current = tags !== null && Object.hasOwn(tags, info.channel) ? tags[info.channel] : undefined;
    assertChannelAdvance(info.version, current, info.channel);
    return true;
}

/** Only npm's specific equivalent-entry provenance conflict is retryable. */
export function transparencyLogConflict(error) {
    if (!Number.isInteger(error?.status) || error.status === 0) return false;
    const stderr = String(error.stderr ?? '');
    const codes = Array.from(stderr.matchAll(/^npm error code (\S+)\r?$/gm), match => match[1]);
    let details;
    try { details = JSON.parse(String(error.stdout)).error; } catch { /* npm normally reports this on stderr. */ }
    const structuredCode = details !== null && typeof details === 'object' && Object.hasOwn(details, 'code');
    const code = structuredCode ? details.code : codes.length === 1 ? codes[0] : undefined;
    if (code !== 'TLOG_CREATE_ENTRY_ERROR' || codes.some(value => value !== code)) return false;
    const messages = [stderr, typeof details?.summary === 'string' ? details.summary : '',
        typeof details?.detail === 'string' ? details.detail : ''].join('\n');
    return /^(?:npm error )?(?:error creating tlog entry - |cause )\(409\) an equivalent entry already exists in the transparency log(?: with UUID [^\r\n]+)?\r?$/m.test(messages);
}

export function npmPublish(info, archive, execute = spawnSync) {
    const result = execute(npm, ['publish', archive, '--ignore-scripts', '--tag', info.channel,
        '--provenance', '--access', 'public', '--registry', registry], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw Object.assign(new Error('npm publish failed.'), {
            status: result.status, stdout: result.stdout, stderr: result.stderr
        });
    }
}

function artifactIntegrity(archive) {
    return `sha512-${createHash('sha512').update(readFileSync(archive)).digest('base64')}`;
}

export function publishVerifiedArtifact(info, archive, {
    readRegistry = registryView, publish = npmPublish,
    onRetry = () => console.warn('Equivalent provenance log entry reported; rechecking the registry before one fresh publish attempt.')
} = {}) {
    const integrity = artifactIntegrity(archive);
    for (let attempt = 0; attempt < 2; attempt++) {
        if (artifactIntegrity(archive) !== integrity) throw new Error('Verified tarball changed during publication.');
        if (!publicationPreflight(info, integrity, readRegistry)) return { published: false, attempts: attempt };
        try {
            publish(info, archive);
            return { published: true, attempts: attempt + 1 };
        } catch (error) {
            if (attempt !== 0 || !transparencyLogConflict(error)) throw error;
            onRetry();
        }
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
    if (!['preflight', 'publish'].includes(action) || !archive) {
        throw new Error('Usage: node scripts/release.mjs info | preflight <package.tgz> | publish <package.tgz>');
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

    const publish = action === 'publish'
        ? publishVerifiedArtifact(info, resolve(archive)).published
        : publicationPreflight(info, artifactIntegrity(archive));
    output({ ...info, publish: String(publish) });
    console.log(publish
        ? `${action === 'publish' ? 'Published' : 'Registry checks passed for'} ${info.name}@${info.version} (${info.channel}).`
        : 'Identical package bytes are already published; skipping publication.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main();
}
