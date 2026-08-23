# DR-0022: M5 Beta Local Gate

- Status: Accepted with remote execution gates
- Date: 2026-08-23
- Milestone: M5 — Beta Ready

## Context

Beta is feature completeness: full CLI and TUI surfaces, all local modes and
formats, disposable SQLite control-plane state, PR titles, exact legacy
migration, packaging, and cross-platform automation. E8-E13 now implement that
surface. This decision distinguishes locally proven behavior from CI workflows
that have been configured but not executed on GitHub in this local-only run.

## Decision

The local M5 gates pass:

- 279 tests pass across domain, application, SQLite, Git, hook, CLI, TUI,
  migration, packaging, and compiled real-Git E2E layers;
- the complete S1-S14 TUI screen map renders over the application facade;
- the hook matrix, worktree isolation, SQLite deletion resilience, and exact
  migration/refusal fixtures pass;
- npm, pnpm, and Bun Linux-x64 package flows pass install, forced reinstall,
  repository immutability, PTY TUI startup, real commit, Doctor, uninstall, and
  missing-executable behavior;
- all required and additional native targets cross-compile, package, archive,
  and checksum successfully;
- normal, real-Git cross-platform, and package-manager CI matrices are present;
- release version/tag/channel drift is a hard failure and publishing requires a
  protected manual workflow with OIDC.

M5 remains externally unconfirmed until the configured Linux x64, macOS arm64,
macOS x64, and Windows x64 jobs run successfully. No beta, RC, or stable release
may bypass those required checks.

## Feature freeze

E14 may harden, document, and fix defects but must not add unplanned v1 product
scope. Core hook, control-plane, migration, packaging, and release boundaries
remain frozen by DR-0020, ADR-0009, DR-0021, and this decision.
