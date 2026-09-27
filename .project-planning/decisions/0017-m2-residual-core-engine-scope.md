# 0017 — M2 Residual Core Engine Scope

## Status

Accepted

## Context

VS-0/VS-1 is architecture-frozen and implemented. The M2 gate is “all non-TUI core workflow behavior is correct.” The full E1–E14 backlog still contains control-plane, TUI, packaging, and release work that would re-plan v1 if treated as M2. The 2026-08-19 instruction is to plan only residual M2 work and not recreate satisfied VS-1 obligations.

## Decision

M2 implements remaining **headless core-engine** behavior from E1–E7 (plus the smallest E8 registry helpers `remove` / Doctor `registry.sync` need).

M2 **does** include:

- remaining commit formats and the format matrix
- remaining Git discovery / hooksPath proof required by hook safety
- remaining Git-local repo-config keys used by the M2 CLI
- full hook analysis, composition, backup metadata, composed removal, shared/external refusal, unsupported refusal, hook matrix
- remaining real-commit E2E (Branch, Manual, detached HEAD, paths with spaces, worktrees, performance baseline)
- remaining repo Doctor checks, repair, JSON
- `init --mode`, status/doctor JSON, link/unlink, mode, enable/disable, remove, repo-local `config`, exit-code contract

M2 **does not** include:

- E1-4 PR-title rendering
- E6-3 global Doctor
- E7-1 full TUI startup router / S1–S14
- E7-10 `repositories` command
- `config --global` / SQLite settings table
- `link --title` (omit the flag in M2; story-title behavior is E9 — DR-0019)
- E8 schema beyond the existing `repositories` table plus `unregister`
- E9–E14 except a change strictly required to keep M2 correct
- re-planning or re-implementing satisfied VS-1 spine work

SQLite remains a dashboard registry, not commit-time truth (ADR-0006).

## Alternatives Considered

- Treat M2 as “finish E1–E7 verbatim including TUI router and global config” — rejected; that is M3 control plane
- Skip hook composition until alpha — rejected; M2 explicitly requires safe hook ownership and custom hooks path

## Consequences

Implementation plans must classify remaining E1–E7 items as M2-blocking vs later. `repositories` listing, global defaults, and TUI screens wait for M3.

## Related Files

- `docs/planning/v1-implementation-roadmap.md` (M2)
- `.project-planning/plans/vs-0-vs-1-vertical-slice.md`
- `.project-planning/plans/m2-core-engine.md`

## Related Plan

- `.project-planning/plans/m2-core-engine.md`

## Supersedes

None

## Superseded By

None

## Notes

Accepted from the 2026-08-19 M2 residual-planning instruction. Does not reopen DR-0013; it ends the VS-1 scope cap for engine/CLI work that DR-0013 deferred.
