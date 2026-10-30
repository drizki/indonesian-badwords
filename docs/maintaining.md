# Development and releases

[Documentation](README.md)

- [Development](#development)
- [Validate a package](#validate-a-package)
- [Dictionary maintenance](#dictionary-maintenance)
- [Configure npm once](#configure-npm-once)
- [Prepare a release PR](#prepare-a-release-pr)
- [Publish the merged version](#publish-the-merged-version)

## Development

Use Node.js 22 or newer:

```bash
npm ci
npm test          # builds, then runs all regression tests
```

The project relies on strict TypeScript, executable docs, and regression tests
instead of a separate linter or formatter. Revisit this decision if outside
contributions grow. Run `npm run test:coverage` for a coverage report; it has no
threshold and is reported in CI on Node 24.

The build generates TypeScript declarations and a bundled CommonJS runtime for
each of the six public entrypoints, then creates their ESM facades. Within each
entrypoint, both formats share the same exported identities; root imports share
the same class and default instance. Optional scanners and data remain separate.
Browser bundlers can convert the CommonJS code; raw browser imports need a CDN
that performs that conversion. Browser apps need ES2022 and `Intl.Segmenter`.

See [performance and benchmarks](performance.md) for workload descriptions,
measurements, and commands.

`npm test` also runs `npm run test:budgets`: exact expected outputs and the
minified and gzipped size budgets in `benchmarks/budgets.json`, plus every
benchmark workload's expected output (no timing). Speed is never a CI gate. To
decide whether a change slowed something down, run
`npm run benchmark:paired -- --base npm` (or `--base` with a ref spec, see
[compare two builds](performance.md#compare-two-builds)) on a quiet machine
before and after the change, and put the per-workload ratios in the PR.
Validation CI uploads a quick `benchmark-summary` JSON artifact on Node.js 24
for reference. The public comparison page [benchmarks.md](benchmarks.md) is
generated: for each minor release, check the pinned package versions with
`npm view <package> version` (update the pins and `PINS_CHECKED_ON` in
`scripts/benchmark-compare.mjs` first), rerun
`npm run benchmark:compare -- --write`, and commit the updated
`benchmarks/comparison.json` and page together;
`npm run benchmark:compare -- --check` verifies they agree. Update both README languages together when changing
features, examples, requirements, or performance facts.

## Validate a package

`npm pack` runs a clean build and returns a versioned tarball filename. Pass that
filename to the package checks:

```bash
package_file=$(npm pack --json | node -p "JSON.parse(require('node:fs').readFileSync(0, 'utf8'))[0].filename")
npm run test:package -- "$package_file"
```

CI checks Node 22, 24, and 26. It tests the same tarball with ESM/CommonJS consumers,
TypeScript 5.9.3, 6.0.3, and the build compiler (7.0.2), using strict NodeNext,
Node16, and Bundler resolution. Package checks also cover browser bundling.

The release-artifact job also installs the separate examples tooling and runs
`npm run test:docs -- "$package_file"`. That command checks local Markdown links
and anchors, README code parity, strict TypeScript, executable expected outputs,
and capability-table results against the packed API. It then installs that same
tarball over the locked `indonesian-badwords` entry in `examples/node_modules`
without re-resolving other dependencies, then runs strict framework checks, policy-isolation checks,
production builds, and Chromium interaction tests for all four apps. See the
[examples validation commands](../examples/README.md#validate-changes) to run these
locally. Playwright's first installation may need `--with-deps` on Linux.

The package includes both READMEs; detailed guides live in the repository. README
links use public GitHub URLs so they work from the npm package page too.

## Dictionary maintenance

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
manifests with a Conventional Commit. Release PRs also update the
[changelog](../CHANGELOG.md) with an entry for the new version. Record the relevant tests, package checks,
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
