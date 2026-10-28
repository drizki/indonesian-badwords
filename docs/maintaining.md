# Development and releases

[Back to the README](../README.md)

## Development

Use Node.js 22 or newer:

```bash
npm ci
npm test          # builds, then runs all regression tests
npm pack          # prepack builds a clean installable tarball
npm run test:package -- package.tgz
npm run benchmark # informational synthetic runtime/memory measurements
```

The build generates TypeScript declarations and one bundled CommonJS runtime,
then creates an ESM facade. Both module formats use the same class and singleton. Browser bundlers can
convert the CommonJS code; raw browser imports need a CDN that performs that conversion. Browser apps need ES2022 support and
`Intl.Segmenter`.

CI checks Node 22, 24, and 26. It tests the same tarball with ESM/CommonJS consumers,
TypeScript 5.9.3, 6.0.3, and the build compiler (7.0.2), using strict NodeNext,
Node16, and Bundler resolution. Package checks also cover browser bundling.

The corpus has 80 hand-authored examples with balanced clean and flagged default
cases. These check expected behavior; they do not measure real-world precision
or recall. Engine tests also cover Unicode spans, boundaries, overlaps, and limits.

## Configure npm once

In [npm settings](https://www.npmjs.com/package/indonesian-badwords/access),
add a GitHub Actions trusted publisher:

| Setting | Value |
| --- | --- |
| Organization or user | `drizki` |
| Repository | `indonesian-badwords` |
| Workflow filename | `publish.yml` |
| Environment | Leave blank |
| Allowed actions | Enable direct `npm publish` |

The workflow uses OIDC and needs no npm token in GitHub secrets.
See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
If npm shows Pending validation, publish within the displayed deadline to validate
that connection.

## Publish a release candidate

Commit the release-ready changes, then run from a clean `main` checkout:

```bash
# First v2 release candidate: bumps both manifests and creates a commit and tag
npm version 2.0.0-rc.1 --message "chore(release): %s"
git push origin main --follow-tags
```

Prereleases publish to `next`. Testers install them with
`npm install indonesian-badwords@next`. For another candidate, run
`npm version prerelease --preid rc --message "chore(release): %s"`, then push.

## Publish a stable release

```bash
npm version 2.0.0 --message "chore(release): %s"
git push origin main --follow-tags
```

Stable versions publish to `latest`. For later compatible releases, use
`npm version patch` or `npm version minor` with the same commit message format.

The pushed tag must match both manifests, and its commit must be on `main`.
The workflow builds one tarball, waits for runtime and TypeScript checks, and
publishes those same bytes with provenance. Publishing jobs queue per package.

Registry errors fail the job. A rerun skips an existing version only if its
integrity matches the tested tarball. Different bytes under the same version
fail, and older releases cannot move a channel backwards. Rerun the failed
workflow after a transient error; published versions are immutable.
