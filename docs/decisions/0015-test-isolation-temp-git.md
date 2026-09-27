# 0015 — Test Isolation: Never Touch Developer Git or Hooks

## Status

Accepted

## Context

Architecture requires real Git repositories for integration tests and forbids using the JiraFlow development repo's `.git` or the developer's global Git config/hooks.

## Decision

All Git/hook/config tests:

- create a temporary repository helper (`tests/helpers/temp-repository.ts`)
- set `user.name` / `user.email` locally in that repo
- set temporary `GIT_CONFIG_GLOBAL` / `GIT_CONFIG_SYSTEM` (empty or fixture) so tests cannot read or write the developer's real global config
- never use `core.hooksPath` pointing at the developer's hooks
- never run `git commit` in `/home/jaleelbdev/Repos/jira-flow` as a test
- isolate SQLite to a temp directory via injected app-paths, not the real XDG/Application Support location

The VS-1 compiled-binary E2E gate uses this helper.

## Alternatives Considered

- Mock Git in integration tests — rejected where the test is proving Git integration
- Use the jira-flow repo itself as the fixture — rejected; unsafe and coupled

## Consequences

Helpers are VS-0 deliverables. Later epics reuse them.

## Related Files

- `tests/helpers/temp-repository.ts`
- `tests/helpers/git-environment.ts`
- `tests/helpers/run-jiraflow.ts`

## Related Plan

- `.project-planning/plans/vs-0-vs-1-vertical-slice.md`

## Supersedes

None

## Superseded By

None

## Notes

Architecture §42.3 / §61.
