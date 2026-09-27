# 0012 — Unpublished Development Version on rewrite/v1

## Status

Accepted for VS-0/VS-1; version placeholder superseded by ADR-0010 for stable v1.

## Context

Current `package.json` is `"version": "0.5.0"` with `postinstall` binary download and `bin` pointing at `scripts/jira-flow.js`. Publishing or even leaving a live postinstall on `rewrite/v1` can confuse local installs and, if workflows remain enabled, could theoretically publish the rewrite as if it were 0.5.0 tooling.

## Decision

On `rewrite/v1` during VS-0/VS-1:

- `package.json` version: `1.0.0-alpha.0`
- `"private": true`
- no `postinstall` / `preuninstall` / `prepublish` that download binaries or mutate Git repos
- no npm `bin` contract until SPIKE-01 / E12
- `--version` reports compile-time injected version (placeholder `1.0.0-alpha.0` is fine)

Do not publish during development. Do not move npm `latest` until the
explicitly authorized stable v1.0.0 publication.

## Alternatives Considered

- Keep `0.5.0` until the first alpha — rejected; mix of Go identity and TS tree
- `0.0.0-dev` — acceptable but less aligned with the 1.0.0-alpha.N progression

## Consequences

Local `npm install -g` from this branch is not a supported VS-0/VS-1 path. Use `bun run` and the compiled `dist/jira-flow` binary.

## Related Files

- `package.json`
- `src/version.ts`
- `scripts/build.ts`

## Related Plan

- `.project-planning/plans/vs-0-vs-1-vertical-slice.md`

## Supersedes

None

## Superseded By

ADR-0010 supersedes the alpha placeholder for the direct stable v1 release.

## Notes

This decision describes the early development safeguard. ADR-0010 later
chooses stable `1.0.0` as the first public v1 version and prohibits public
prereleases.
