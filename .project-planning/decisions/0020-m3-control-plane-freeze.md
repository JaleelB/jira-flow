# DR-0020: M3 Control Plane Freeze

- Status: Accepted
- Date: 2026-08-23
- Milestone: M3 — Control Plane Complete

## Context

M2 froze the commit-time architecture while E8-E10 completed the disposable SQLite control plane, local PR-title workflow, deferred headless management surface, and OpenTUI adapter. M3 needs a durable boundary before legacy migration and native distribution work begin.

## Decision

Freeze the M3 control-plane boundary with these properties:

- Git-local repository configuration and worktree-local linked-issue state remain repository truth.
- SQLite remains a recreatable registry, cache, metadata, global-default, and UI-preference store; commit behavior never reads it.
- PR-title generation is local-only, with one-shot/cache/prompt title precedence and nonfatal clipboard behavior.
- OpenTUI is a presentation adapter over `TuiServices` and application use cases; its typed router covers S1-S14.
- Bare `jira-flow init` opens S5 in a TTY, while `init --yes` remains deterministic and headless.
- Every meaningful TUI mutation has a headless/application-layer equivalent.
- Hook ownership, composition, shared-hook consent, and no-`post-checkout` v1 boundaries remain unchanged.

Later work may extend the application facade for migration or packaging status, but may not move business logic into React/OpenTUI or make SQLite part of commit-time truth.

## Validation

- Ordered SQLite migrations, deletion/recreation resilience, reconciliation, and global setting tests.
- Compiled PR-title CLI/cache/clipboard tests.
- Typed navigation reducer and complete S1-S14 render smoke tests.
- TUI source-boundary audit excludes Git/SQLite infrastructure imports.
- Full lint, typecheck, test, and compiled build acceptance gate.

## Consequences

E11 migration must converge legacy repositories onto this frozen boundary. E12 packaging must ship the same compiled application and must not introduce an alternate runtime-dependent control plane.
