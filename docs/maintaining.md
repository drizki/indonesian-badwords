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
npm run benchmark:compare # compare with pinned Indonesian libraries (downloads references)
```

The build generates TypeScript declarations and one bundled CommonJS runtime,
then creates an ESM facade. Both module formats use the same class and singleton. Browser bundlers can
convert the CommonJS code; raw browser imports need a CDN that performs that conversion. Browser apps need ES2022 support and
`Intl.Segmenter`.

CI checks Node 22, 24, and 26. It tests the same tarball with ESM/CommonJS consumers,
TypeScript 5.9.3, 6.0.3, and the build compiler (7.0.2), using strict NodeNext,
Node16, and Bundler resolution. Package checks also cover browser bundling.

Reviewed catalog data lives in `data/catalog.json`, with stable selector IDs in
`data/selector-registry.json`. Edit the source claims and matching variants
together; exact lexical attestation does not establish coarse register or regional
abusive use. Keep literal senses separate. Run `npm run catalog:generate` after
editing registries. Every build validates claim references, selector IDs, profile
eligibility, and the generated registry types before creating separate thin
metadata and rich catalog bundles. The default engine never imports either.

The corpus has 80 hand-authored examples with balanced clean and flagged default
cases. These check expected behavior; they do not measure real-world precision
or recall. Engine tests also cover Unicode spans, boundaries, overlaps, and limits.

Benchmark output is newline-delimited JSON. The comparison installs pinned reference
packages in a temporary directory with lifecycle scripts disabled, then removes them.
It checks expected booleans before timing, rotates 257 input variants, and reports
different outputs separately. Run `npm run benchmark:compare -- --quick` for a smoke
check; use the full run for measurements. Dictionaries and policies differ, so these
synthetic timings do not rank detection accuracy. Both commands report their runtime,
workloads, warmup, sampling, and memory scope.

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

## Prepare a release PR

Track each releasable change in an issue and link it from a focused PR. Include
the version bump in that PR, without creating a tag:

```bash
npm version minor --no-git-tag-version
```

Use `patch` for compatible fixes and optimizations, `minor` for compatible
features, and `major` for incompatible API or behavior changes. Commit both
manifests with a Conventional Commit. Record the relevant tests, package checks,
performance measurements, and independent review in the PR.

`main` requires an up-to-date PR and all six CI checks: release artifact,
Node 22/24/26, and TypeScript 5.9.3/6.0.3. Resolve review findings before enabling
squash auto-merge. Administrator pushes are subject to the same protection.

## Publish the merged version

After the PR merges, verify that CI passed for the exact merged commit. From a
clean, current `main` checkout, tag its manifest version:

```bash
git switch main
git pull --ff-only origin main
version=$(node -p "require('./package.json').version")
git tag -a "v$version" -m "Release v$version"
git push origin "v$version"
```

Stable versions publish to `latest`. Release candidates are optional: use
`npm version preminor --preid rc --no-git-tag-version` in the release PR, or
`npm version prerelease --preid rc --no-git-tag-version` for another candidate.
Their tags publish to `next`; testers install with
`npm install indonesian-badwords@next`. To promote a candidate, set its intended
stable version explicitly in a new PR.

Call out dictionary and default-policy changes in release notes. New default
vocabulary belongs in a minor release; changing a documented matching contract
or result shape requires a major release. Every increment must pass the release
checks independently.

The pushed tag must match both manifests, and its commit must be on `main`.
The workflow builds one tarball, waits for runtime and TypeScript checks, and
publishes those same bytes with provenance. Publishing jobs queue per package.

Registry errors fail the job. A rerun skips an existing version only if its
integrity matches the tested tarball. Different bytes under the same version
fail, and older releases cannot move a channel backwards. Empty or malformed
registry responses also fail; only npm's structured `E404` proves absence.

The publish helper retries once when npm reports `TLOG_CREATE_ENTRY_ERROR` with
the specific `409` equivalent-entry transparency-log conflict tracked in
[npm/cli#10078](https://github.com/npm/cli/issues/10078). The retry starts a fresh
npm process, keeps provenance enabled, and repeats the registry, artifact-integrity,
and channel-ordering checks. Changed tarball bytes abort the retry. A repeated
conflict or any other error fails the job. Rerun the failed workflow after resolving
the cause; published versions are immutable.
