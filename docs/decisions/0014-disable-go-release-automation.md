# 0014 — Disable Go Release Automation on rewrite/v1

## Status

Accepted

## Context

`.github/workflows/release.yml` runs GoReleaser on every tag. `.github/workflows/publish.yml` publishes npm from `package.json` after rewriting `%%VERSION%%` into `scripts/install.js`. If those workflows remain on `rewrite/v1` after the Go tree is deleted, an accidental tag can fail CI loudly or, worse, publish a broken package.

## Decision

On `rewrite/v1`, remove or disable the Go GoReleaser and npm publish workflows. Do not replace them with Release Please yet (E13).

A minimal `ci.yml` that runs `bun install`, typecheck, and `bun test` is in scope for VS-0 if it is cheap. Full OS integration matrix is not.

## Alternatives Considered

- Leave workflows untouched until E13 — rejected; unsafe on a branch that deletes `go.mod`
- Implement full v1 release pipeline in VS-0 — rejected; packaging spike is incomplete

## Consequences

Tags on `rewrite/v1` must not publish. `main` keeps the Go workflows until the rewrite replaces it.

## Related Files

- `.github/workflows/release.yml`
- `.github/workflows/publish.yml`
- `.github/workflows/ci.yml`

## Related Plan

- `.project-planning/plans/vs-0-vs-1-vertical-slice.md`

## Supersedes

None

## Superseded By

None

## Notes

Safety subset of ADR-0008, required in VS-0.
