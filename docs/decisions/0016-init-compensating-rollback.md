# 0016 — Init Uses Compensating Rollback for JiraFlow-Owned Mutations

**Type:** DR

## Status

Accepted

## Context

Architecture §19 specifies `initializeRepository` as an explicit multi-step transaction with compensing rollback: "rollback only JiraFlow changes that were made by this operation". The VS-0/VS-1 plan's reduced init flow did not spell out rollback semantics, and ADR-0006/O-01 only guaranteed that a *SQLite registration* failure does not destroy repository configuration.

Without compensating rollback, a failed owned-hook installation after config/state writes would leave a repository half-configured: JiraFlow enabled in Git config with no working hook integration.

Approved amendment (2026-08-18) before implementation of T-15.

## Decision

`initializeRepository` performs JiraFlow-owned repository mutations as a compensating transaction:

1. discover repository
2. inspect `commit-msg` (absent → owned strategy; existing → typed `HOOK_CONFLICT`, nothing mutated)
3. write Git-local config (`jiraflow.enabled`, `jiraflow.mode`, `jiraflow.commitFormat`)
4. write worktree `jiraflow/state.json`
5. install owned hook
6. write integration metadata
7. register in SQLite — **last**
8. verify

Rules:

- If any step after the first JiraFlow-owned mutation fails (steps 3–6), roll back **only the JiraFlow changes made by this initialization attempt**: remove the `jiraflow.*` Git-local keys it wrote, remove the `jiraflow/state.json` it wrote, and remove the owned hook/metadata files it created. Never touch foreign files.
- Idempotent re-init on an already-configured repository does not re-mutate; a failure there must not roll back pre-existing JiraFlow state it did not create in that attempt.
- SQLite registration remains last. A SQLite registration failure **must not** roll back an otherwise functional JiraFlow repository; it reports a warning instead (ADR-0006/O-01).
- If full rollback is impossible, return a clear partial-failure report (architecture §19).

## Alternatives Considered

- Best-effort init without rollback (previous plan text) — rejected; leaves half-configured repositories
- Roll back on SQLite failure too — rejected; contradicts ADR-0006 (registry is not repo truth)
- Defer transactionality to a later epic — rejected; architecture §19 and §42.2 (application test "initialize rollback") are already locked

## Consequences

- T-15 implements the rollback path; application tests with fake ports prove rollback and registry-failure tolerance (architecture §42.2)
- Rollback must only remove what this attempt wrote, so init records which keys/files it created
- VT-15 added to the VS-1 verification gate

## Related Files

- `src/application/use-cases/initialize-repository.ts`
- `tests/application/initialize-repository.test.ts`

## Related Plan

- `.project-planning/plans/vs-0-vs-1-vertical-slice.md`

## Supersedes

None

## Superseded By

None

## Notes

Refines ADR-0006/O-01 and architecture §19 for the VS-1 slice. Accepted as amendment to the approved VS-0/VS-1 plan before implementation began.
