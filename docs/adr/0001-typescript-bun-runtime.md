# 0001 — TypeScript + Bun Runtime

**Type:** ADR

## Status

Accepted

## Context

JiraFlow v0.5 is a Go CLI with three binaries, an npm postinstall downloader, and GoReleaser. v1 needs TypeScript-first development, OpenTUI's native renderer, `bun:sqlite`, and standalone executable compilation in one toolchain.

## Decision

Implement JiraFlow v1 in TypeScript using Bun as the development, test, and compile toolchain.

- Source entry: `src/main.ts`
- Tests: `bun test`
- Compile: `bun build --compile`
- SQLite: `bun:sqlite` only (no Prisma/Drizzle/TypeORM)
- Distributed artifact is a standalone binary that contains its runtime

## Alternatives Considered

- Stay on Go — rejected; v1 is an intentional rewrite, not a port
- Node.js + separate SQLite native module — rejected; extra runtime/native-module surface
- Deno — rejected; OpenTUI and `bun:sqlite`/compile path are Bun-oriented

## Consequences

- `rewrite/v1` replaces the Go module (`go.mod`, `cmd/`, `hooks/`, `internal/`)
- `pnpm-lock.yaml` is replaced by `bun.lock`
- Bun must be installed on developer machines before VS-0 can run
- OpenTUI native bindings must be proven inside the compiled binary, not only under `bun run`

## Related Files

- `package.json`
- `tsconfig.json`
- `src/main.ts`
- `scripts/build.ts`

## Related Plan

- `.project-planning/plans/vs-0-vs-1-vertical-slice.md`

## Supersedes

None

## Superseded By

None

## Notes

Roadmap ADR-001. Locked by architecture §3.1 / §66.1–2.
