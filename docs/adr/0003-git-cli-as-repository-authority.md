# 0003 — Git CLI as Repository Authority

**Type:** ADR

## Status

Accepted

## Context

v0.5 hard-codes `.git/hooks/`, installs from the current working directory, and reconstructs Git internals. That breaks subdirectories, worktrees, and `core.hooksPath`.

## Decision

Ask the installed `git` executable for repository structure. Never reconstruct `.git` paths by string concatenation.

Discovery uses:

```text
git -C <path> rev-parse --is-inside-work-tree
git -C <path> rev-parse --path-format=absolute --show-toplevel
git -C <path> rev-parse --path-format=absolute --git-dir
git -C <path> rev-parse --path-format=absolute --git-common-dir
```

Hook directory resolution uses Git (`core.hooksPath` or `git rev-parse --git-path hooks`), never a hard-coded `.git/hooks`.

Branch detection uses `git symbolic-ref --quiet --short HEAD`. Detached HEAD is `branch = null`, not an error.

All Git execution goes through `GitRunner`, capturing stdout, stderr, and exit code.

Bare repositories are rejected as unsupported.

## Alternatives Considered

- isomorphic-git / simple-git abstractions as the authority — rejected; Git CLI is the authority
- Keep relative `.git/hooks` with a chdir — rejected; that is the v0.5 bug

## Consequences

- VS-1 gate: "JiraFlow does not use `.git/hooks` hard-coded path"
- Tests must use real temporary Git repositories and isolated `GIT_CONFIG_GLOBAL`
- Git missing is a typed error, not a swallowed failure

## Related Files

- `src/infrastructure/git/git-runner.ts`
- `src/infrastructure/git/git-adapter.ts`
- `src/infrastructure/git/repository-discovery.ts`
- `tests/helpers/temp-repository.ts`

## Related Plan

- `.project-planning/plans/vs-0-vs-1-vertical-slice.md`

## Supersedes

None

## Superseded By

None

## Notes

Roadmap ADR-003. Locked by architecture §8 / §63.5–6.
