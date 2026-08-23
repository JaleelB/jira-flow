# 0008 — Release Please + Prerelease Channel

**Type:** ADR

## Status

Accepted

## Context

v0.5 versions drift across `package.json`, Changesets, GoReleaser tags, Homebrew, installer `%%VERSION%%` placeholders, and GPG-signed checksums. Architecture replaces this with Release Please, npm `next` for prereleases, and `latest` remaining on 0.5.0 until stable 1.0.0.

## Decision

When packaging/release work begins (E12/E13):

- Release Please owns version/changelog/release PRs
- Prereleases publish to npm dist-tag `next`
- `jira-flow@latest` stays `0.5.0` until stable `1.0.0`
- No Changesets, no interactive version-bump script, no GPG release requirement
- Historical 0.x versions remain installable

## Alternatives Considered

- Keep Changesets + GoReleaser — rejected for the TypeScript line
- Publish rewrite/v1 as 0.5.1 latest — rejected; would ship an unfinished rewrite onto the stable tag

## Consequences

Implemented in E13. Release Please opens and maintains the version/changelog PR
but uses `skip-github-release`, so merging that PR cannot publish anything. A
separate manual workflow on `main`, protected by the `release` environment,
runs native package smoke before it can create a draft GitHub release or obtain
an npm OIDC token.

The publish workflow verifies the exact tag/version/channel relationship,
publishes all native packages before the universal package, and changes the
GitHub release from draft to published only after npm succeeds. Prereleases are
restricted to `next`; stable versions are restricted to `latest`. Partial native
publishes are safely resumable because immutable versions already present in npm
are detected before retry.

No Changesets, GoReleaser, GPG signing dependency, automatic tag workflow, or
long-lived npm token remains.

## Related Files

- `.github/workflows/release-please.yml`
- `.github/workflows/publish.yml`
- `.github/workflows/package-smoke.yml`
- `release-please-config.json`
- `.release-please-manifest.json`
- `scripts/verify-release.ts`

## Related Plan

- `.project-planning/plans/vs-0-vs-1-vertical-slice.md`

## Supersedes

None

## Superseded By

None

## Notes

Roadmap ADR-008. The npm account must separately authorize `publish.yml` as the
trusted publisher for every JiraFlow package; that registry-side permission
cannot be established from this repository.
