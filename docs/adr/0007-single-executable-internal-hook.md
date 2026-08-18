# 0007 — Single Executable / Internal Hook Command

**Type:** ADR

## Status

Accepted

## Context

v0.5 ships three GoReleaser artifacts (`jiraflow`, `commitmsg`, `postco`) plus an npm wrapper that looks up `jiraflow*` in npm's global bin. Hooks resolve helper binaries through npm even for non-npm installs.

## Decision

Ship **one** JiraFlow application binary named `jira-flow` (Windows: `jira-flow.exe`).

Internal command:

```text
jira-flow hook commit-msg <commit-message-file>
```

This is not a primary user-facing workflow. It powers the managed Git integration.

There is no `postco` binary and no `post-checkout` hook.

`--help` and `--version` must work outside a Git repository. Version is injected at compile time, not read from `package.json` at runtime.

## Alternatives Considered

- Keep helper binaries for hook latency — rejected; one binary is a v1 invariant
- npm wrapper that requires a Git repo before launching — rejected; that is the current `scripts/jira-flow.js` bug

## Consequences

- Delete `cmd/`, `hooks/commitmsg/`, `hooks/post_checkout/`, GoReleaser multi-build config
- Hook shim captures an absolute path to this binary, with PATH fallback
- VS-1 E2E gate must use the compiled binary so the captured path is a real executable

## Related Files

- `src/main.ts`
- `src/cli/commands/hook.ts`
- `src/infrastructure/platform/executable-path.ts`
- `scripts/build.ts`

## Related Plan

- `.project-planning/plans/vs-0-vs-1-vertical-slice.md`

## Supersedes

None

## Superseded By

None

## Notes

Roadmap ADR-007. Locked by product §6.15 / architecture §14–15 / §50 / §63.11–14.
