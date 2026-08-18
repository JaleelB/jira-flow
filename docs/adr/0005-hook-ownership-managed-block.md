# 0005 — Hook Ownership and Managed-Block Composition

**Type:** ADR

## Status

Accepted

## Context

v0.5 writes `commit-msg` and `post-checkout` with `os.WriteFile`, treats filename presence as ownership, and deletes those paths on remove. Init and toggle use different install models (shell wrapper vs symlink). This can destroy foreign hooks.

## Decision

JiraFlow may manage its own code. It may not claim ownership of arbitrary hook files.

- Only `commit-msg` in v1. No `post-checkout`.
- One application binary; hook invokes `jira-flow hook commit-msg "$1"`
- Generated content is a versioned managed block with ownership markers
- Missing JiraFlow executable is a no-op, not a blocked Git commit
- Existing hook presence never implies JiraFlow ownership
- Unsafe/unknown composition is refused
- `--yes` never authorizes shared-hook mutation or implicit composition consent

**VS-1 scope:** Strategy A only (create owned hook when `commit-msg` is absent). If a hook already exists, return typed `HOOK_CONFLICT`. Do not compose, backup, or overwrite. Composition (strategies B–D) is E4.

## Alternatives Considered

- Always overwrite `commit-msg` like v0.5 — rejected; destructive
- Husky-style core.hooksPath takeover — rejected; JiraFlow is not a general hook manager
- Separate `commitmsg` helper binary — rejected; one executable

## Consequences

VS-1 init is safe on a clean repo and fails closed on an existing hook. That is enough to prove the spine. It is not enough for alpha.

## Related Files

- `src/infrastructure/hooks/hook-manager.ts`
- `src/infrastructure/hooks/hook-script.ts`
- `src/infrastructure/hooks/hook-markers.ts`
- `src/infrastructure/hooks/integration-metadata.ts`

## Related Plan

- `.project-planning/plans/vs-0-vs-1-vertical-slice.md`

## Supersedes

None

## Superseded By

None

## Notes

Roadmap ADR-005. Locked by product §8 / architecture §13–18 / §63.12–17.
