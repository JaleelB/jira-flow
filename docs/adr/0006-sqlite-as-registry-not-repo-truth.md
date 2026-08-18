# 0006 — SQLite as Registry/Cache, Not Repository Truth

**Type:** ADR

## Status

Accepted

## Context

The TUI needs a multi-repo dashboard. Repository commit behavior must survive deletion of the management database. v0.5 had no durable state at all.

## Decision

SQLite (`bun:sqlite`) stores:

- repository registry
- disposable repository cache
- issue metadata (story titles)
- global defaults and TUI preferences

It is **not** authoritative for enabled/mode/linked issue/commit format/hook runtime.

Platform paths:

- macOS: `~/Library/Application Support/JiraFlow/jira-flow.db`
- Windows: `%LOCALAPPDATA%\JiraFlow\jira-flow.db`
- Linux: `$XDG_DATA_HOME/jira-flow/jira-flow.db` or `~/.local/share/jira-flow/jira-flow.db`

Do not create the database for `--version` / `--help`.

The commit-hook composition root excludes SQLite.

VS-1 registers the repo after init. Registry failure must not roll back a correctly configured repository. Deleting the DB after init must not break commits.

## Alternatives Considered

- SQLite as the source of truth for repo config — rejected; breaks commit if DB is missing
- JSON file in `$XDG_CONFIG_HOME` instead of SQLite — rejected; architecture locks SQLite
- ORM — rejected; schema is small and explicit

## Consequences

VS-1 hook container must not import `bun:sqlite`. Tests must delete the DB and still commit.

## Related Files

- `src/infrastructure/sqlite/`
- `src/infrastructure/platform/app-paths.ts`
- `src/bootstrap/hook-container.ts`

## Related Plan

- `.project-planning/plans/vs-0-vs-1-vertical-slice.md`

## Supersedes

None

## Superseded By

None

## Notes

Roadmap ADR-006. Locked by product §16 / architecture §20–24 / §63.9–10.
