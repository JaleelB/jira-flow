# 0019 — M2 Execution Amendments

## Status

Accepted

## Context

The M2 residual plan was approved for execution with seven amendments. These refine CLI contracts, error types, scope-format safety, idempotency, performance-test policy, init UX, and residual-classification rules. They do not reopen the architecture freeze.

## Decision

1. **`link --title` is omitted in M2.** Do not accept-and-ignore the flag. Story-title behavior is E9.

2. **Git timeout and missing executable are distinct typed errors.** Missing executable: `GitUnavailableError`. Timeout: `GitTimeoutError`.

3. **Scope format must not destroy an existing semantic Conventional Commit scope.** A non-empty existing scope is unsafe for M2; leave the message unchanged. Combining scopes requires a later explicit product/architecture decision.

4. **Commit-format idempotency is per active Jira issue.** A different Jira key already in the message must not prevent applying the active issue.

5. **E5-5 records a compiled-binary baseline; it is not a hard/flaky CI threshold** unless measurement later proves a stable environment.

6. **`init --yes` remains the explicit noninteractive init path.** Bare `jira-flow init` must not silently apply defaults that will later become interactive setup. It may explain that interactive setup is deferred and point at `--yes`.

7. **E1–E7 obligations intentionally outside the M2 gate stay Deferred**, not Satisfied, when M2 closes.

## Alternatives Considered

- Accept `--title` as a no-op — rejected; misleading contract
- Reuse `GitUnavailableError` for timeouts — rejected; operators cannot distinguish hung Git from missing Git
- Merge scopes like `auth,ABC-123` — rejected; no architecture decision exists
- Treat any existing Jira-like token as already-present — rejected; product idempotency is the active key's recognized form
- Bare `init` with silent Hybrid defaults — rejected; would change when S5 lands

## Consequences

T-01, T-04, T-15, T-20, T-22, and residual classification in the M2 plan follow this record.

## Related Files

- `.project-planning/plans/m2-core-engine.md`
- `src/domain/commit-format.ts`
- `src/domain/errors.ts`
- `src/infrastructure/git/git-runner.ts`
- `src/cli/commands/init.ts`
- `src/cli/commands/link.ts`

## Related Plan

- `.project-planning/plans/m2-core-engine.md`

## Supersedes

None. Refines DR-0017 (`--title` omitted, not ignored) and DR-0018 (Strategy A requires `init --yes`, not bare `init`).

## Superseded By

None

## Notes

Approved 2026-08-19 with the M2 execution instruction.
