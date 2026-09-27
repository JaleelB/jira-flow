# 0013 — VS-1 Implements a Narrow Vertical Slice, Not Full v1

## Status

Accepted

## Context

The roadmap defines VS-1 as architecture validation, not feature completeness. An implementation agent could over-build CLI/TUI/hook composition and hide incomplete engine behavior.

## Decision

VS-1 implements only:

- Hybrid mode (Branch/Manual commands out of scope)
- footer commit format only
- `jira-flow init --yes` (no interactive setup TUI, no `--mode`)
- owned `commit-msg` when absent; conflict if present
- `status` human output (no `--json`)
- Doctor checks without `--repair` / `--json`
- SQLite registry insert after init
- one OpenTUI repository-status view
- internal `hook commit-msg`

Out of scope: link/unlink/mode/enable/disable/remove/pr-title/repositories/config, hook composition, all commit formats, JSON output, legacy 0.5 migration, packaging launcher, full TUI map.

`init` must succeed on `main` / non-ticket branches (product decision 29). Do not port `ConfigureAutomatic()`'s branch-key requirement.

## Alternatives Considered

- Build the full CLI surface inside the first slice — rejected by roadmap
- Skip OpenTUI and SQLite until later epics — rejected; the VS-1 gate explicitly requires both, minimally

## Consequences

Use cases may exist as narrow functions. Do not stub a fake TUI that bypasses the engine.

## Related Files

- `src/application/use-cases/initialize-repository.ts`
- `src/application/use-cases/process-commit-message.ts`
- `src/cli/commands/init.ts`
- `src/tui/screens/repository-overview.tsx`

## Related Plan

- `.project-planning/plans/vs-0-vs-1-vertical-slice.md`

## Supersedes

None

## Superseded By

None

## Notes

Roadmap §9 and §26.
