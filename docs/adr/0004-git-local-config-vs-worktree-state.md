# 0004 — Git-Local Config vs Worktree-Local State

**Type:** ADR

## Status

Accepted

## Context

The product spec models `linkedIssue` as repository-local configuration alongside `enabled` and `mode`. Linked Git worktrees share `.git/config` unless `extensions.worktreeConfig` is enabled. Enabling that extension would change repository-level Git behavior.

v0.5 stored config only in process memory, so neither layer existed.

## Decision

Split state into three categories:

1. **Repo-wide workflow config** via `git config --local` (`jiraflow.enabled`, `jiraflow.mode`, `jiraflow.commitFormat`, later pattern/template/date)
2. **Worktree-local linked issue** via a Git-resolved JSON file: `git rev-parse --path-format=absolute --git-path jiraflow/state.json`
3. **Global management data** via SQLite (not required for commit)

Do not enable `extensions.worktreeConfig` for JiraFlow.

Writes to `state.json` are atomic (temp file + rename).

The commit hook loads repo-local Git config + worktree state + built-in defaults. It must not open SQLite.

## Alternatives Considered

- Store `linkedIssue` in `git config --local` as the product spec's conceptual schema suggests — rejected; leaks across worktrees
- Enable `extensions.worktreeConfig` — rejected; changes Git repo behavior globally
- Store linked issue in SQLite — rejected; commit hook must not depend on SQLite

## Consequences

This is a **documented refinement of the product spec**, not a silent product change. The spec's logical key `linkedIssue` remains; its physical store is worktree-local.

VS-1 must write `jiraflow.enabled`, `jiraflow.mode`, `jiraflow.commitFormat` through Git, and prepare `jiraflow/state.json`. Full two-worktree isolation tests are E3, not VS-1, but the storage split must exist in VS-1.

## Related Files

- `src/infrastructure/git/git-config-store.ts`
- `src/infrastructure/state/worktree-state-store.ts`
- `src/infrastructure/state/atomic-json-file.ts`

## Related Plan

- `.project-planning/plans/vs-0-vs-1-vertical-slice.md`

## Supersedes

None

## Superseded By

None

## Notes

Roadmap ADR-004. Locked by architecture §9–12 / §63.7–10. Product spec §12–13 remains the logical schema.
