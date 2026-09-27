# 0018 — Headless Hook Composition Consent

## Status

Accepted

## Context

Architecture §16.3 requires explicit consent before composing into an existing shell hook. `--yes` must not authorize composition or shared-hook mutation (ADR-0005). Interactive setup UI is TUI S5 and is deferred to M3 (DR-0017). M2 still must ship composition, backups, and shared/external refusal, or the M2 gate is false.

## Decision

Headless M2 consent is **flag-based**, never implied by `--yes`.

| Situation | Allowed command | Forbidden |
|---|---|---|
| Missing `commit-msg` in default or **repo-local** custom `core.hooksPath` | `init --yes` (Strategy A) | bare `init` (explains deferred interactive setup; DR-0019) |
| Existing composable shell hook, repo-local hooks dir | `init --compose-existing-hook` | `init --yes` alone |
| Shared/external hooksPath, missing or composable hook | refuse unless `--compose-existing-hook --allow-shared-hooks` | `--yes` alone; `--compose-existing-hook` alone |
| Shared/external already containing a valid JiraFlow block | reuse / verify; do not duplicate | mutating other files in the shared dir |
| Unsupported / binary / malformed / unreadable | refuse (`HOOK_UNSAFE_TO_MODIFY` or `HOOK_CONFLICT`) | any overwrite |

`--yes` is the explicit noninteractive init path for M2 (DR-0019). It never means “mutate a foreign or shared hook.”

`remove --yes` skips confirmation of JiraFlow-owned removal only. It never deletes a shared hook or a composed file wholesale.

## Alternatives Considered

- Keep VS-1 refuse-all-existing until TUI exists — rejected; blocks M2 hook gate
- Treat `--yes` as composition consent — rejected; contradicts architecture §16.3 / ADR-0005
- Prompt on TTY from the CLI adapter — deferred; M2 has no interactive setup UI

## Consequences

`InitializeRepository` grows an explicit install strategy + consent struct. Tests must prove `--yes` cannot compose. Shared-hook tests must prove both refusal and the dual-flag override.

## Related Files

- `src/infrastructure/hooks/hook-analyzer.ts`
- `src/infrastructure/hooks/hook-manager.ts`
- `src/application/use-cases/initialize-repository.ts`
- `src/cli/commands/init.ts`

## Related Plan

- `.project-planning/plans/m2-core-engine.md`

## Supersedes

None. Narrows ADR-0005’s “composition is E4” VS-1 note; ADR-0005 safety rules remain.

## Superseded By

None

## Notes

Architecture freeze holds. This is the M2 adapter for consent without S5.
