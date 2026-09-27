# 0002 — Headless Engine + OpenTUI Adapter

**Type:** ADR

## Status

Accepted

## Context

v0.5 buried behavior in Cobra callbacks and promptui menus. v1 has two equal interfaces: a headless engine/CLI and an OpenTUI control plane. The TUI must never be the only way to perform meaningful operations.

## Decision

Use a layered architecture:

```text
CLI / OpenTUI / Git hook
        ↓
application use cases
        ↓
domain
```

- Commander is a CLI adapter only
- OpenTUI React (`@opentui/core`, `@opentui/react`, `@opentui/keymap`) is a presentation adapter
- Domain never imports OpenTUI, Commander, `bun:sqlite`, filesystem, process, or Git execution
- Root `jira-flow` dynamically imports OpenTUI only when the TUI is needed
- Internal `hook commit-msg` never initializes OpenTUI

VS-1 ships one minimal repository-status screen that reads an application view model. Full screen map is out of scope.

## Alternatives Considered

- TUI-first with CLI as a thin wrapper around screens — rejected; violates headless/TUI parity
- Ink / blessed / bubbletea — rejected; product/architecture lock OpenTUI React
- Redux/Zustand for TUI — rejected for v1; React context + reducer + local state

## Consequences

- Every VS-1 TUI field must come from `getRepositoryStatus` (or equivalent use case)
- Hook bootstrap must be a separate composition root that excludes OpenTUI and SQLite
- Dynamic import of `./tui/run-tui` is a VS-1 invariant, not a later optimization

## Related Files

- `src/application/use-cases/`
- `src/cli/`
- `src/tui/`
- `src/bootstrap/`

## Related Plan

- `.project-planning/plans/vs-0-vs-1-vertical-slice.md`

## Supersedes

None

## Superseded By

None

## Notes

Roadmap ADR-002. Locked by product §34 / architecture §2, §26–33, §63.1–4.
