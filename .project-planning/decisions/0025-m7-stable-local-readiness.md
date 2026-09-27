# DR-0025: M7 Stable Local Readiness

- Status: Accepted locally; publication not authorized
- Date: 2026-08-23
- Milestone: M7 — Stable v1

## Context

The v1 codebase has completed E8-E14 and the locally executable Alpha, Beta,
RC, and Stable gates. Stable release also requires evidence that cannot be
created truthfully from a Linux workstation: protected remote CI, native
platform execution, external RC feedback, npm OIDC identity, and an explicitly
authorized publish.

## Decision

The repository is locally release-ready for the v1.0.0 release process:

- the complete headless and S1-S14 management products are feature-frozen;
- Git-local/worktree-local truth, disposable SQLite, and the independent hook
  runtime remain intact;
- migration, package, CI/release, documentation, safety, and performance
  obligations have implementation and validation evidence;
- source/package/binary/artifact/tag/channel drift is a hard failure;
- no known P0/P1 or unresolved destructive hook behavior remains;
- release automation is manual, main-only, protected, OIDC-only, native-first,
  universal-last, and keeps GitHub Releases draft until npm succeeds.

The source remains on `1.0.0-alpha.0` until a Release Please PR advances the
version/changelog. Stable preparation removes prerelease configuration and the
protected publish workflow requires exact `1.0.0` with the `latest` channel.
No local tag, npm publish, GitHub Release, push, or merge is authorized by this
decision.

## Required external evidence

Before M7 can be declared published Stable, every remote checklist item in
`docs/release-checklist.md` must pass, the RC must receive external validation,
and an authorized maintainer must dispatch the protected stable workflow.
