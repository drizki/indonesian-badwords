# Security Policy

## Supported versions

Only the latest 2.x minor release receives security fixes. Upgrade to it before
reporting a problem that may already be fixed.

## Reporting a vulnerability

Report vulnerabilities privately through GitHub's
[Report a vulnerability](https://github.com/drizki/indonesian-badwords/security/advisories/new)
form (private security advisories) on this repository. Do not open a public issue,
pull request, or discussion for a suspected vulnerability.

Include the package version, a minimal reproduction, and the expected and actual
impact. You should receive an acknowledgement through the advisory thread.

## Scope

Denial of service caused by inputs that exceed the documented budgets, such as
the limits described in the [API reference](docs/api.md) and the
[evasion](docs/guides/evasion.md) and [fuzzy matching](docs/guides/fuzzy-matching.md)
guides, counts as a security issue. Report it privately like any other
vulnerability.
