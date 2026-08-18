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

**Deferred for VS-0/VS-1 implementation.** This plan must not introduce Release Please or publish npm. It must also not leave rewrite/v1 in a state where tagging `*` still runs GoReleaser / npm publish of Go binaries.

VS-0 disables or replaces the Go release workflows on `rewrite/v1` as a safety gate, without implementing the v1 release pipeline.

## Related Files

- `.github/workflows/release.yml` (Go; disable on rewrite/v1)
- `.github/workflows/publish.yml` (Go npm; disable on rewrite/v1)
- `.changeset/` (remove on rewrite/v1)

## Related Plan

- `.project-planning/plans/vs-0-vs-1-vertical-slice.md`

## Supersedes

None

## Superseded By

None

## Notes

Roadmap ADR-008. Implementation deferred to E13 with explicit roadmap approval. Safety disable of Go automation is in VS-0.
