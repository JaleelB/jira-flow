# Implementation Plan: JiraFlow v1 Residual Roadmap (E8-E14)

## Feature Definition

Complete the release-ready JiraFlow v1 product from the hardened M2 engine through the locally verifiable M3-M7 gates. This is a residual plan: proven VS-0/VS-1 and M2 behavior is preserved and only deferred or incomplete obligations are implemented.

## Problem Statement

The repository has the architecture-frozen core engine, safe hook management, complete commit runtime, repo-local headless commands, and compiled real-Git coverage. The remaining product surface is the SQLite control plane, global/headless behavior, PR-title generation, complete OpenTUI management UI, exact legacy migration, native packaging, CI/release automation, and release documentation/hardening.

## Goals

- Complete residual E8-E14 behavior and intentionally deferred E1-E7 obligations.
- Keep Git-local/worktree-local repository truth independent of SQLite.
- Keep every TUI mutation behind the same application use cases used by the CLI.
- Prove legacy removal only for exact v0.5 signatures.
- Distribute one compiled executable with no separate Bun runtime.
- Prevent source, binary, artifact, GitHub, and npm version drift.
- Leave a clean, tested, release-ready v1.0.0 tree without publishing, pushing, tagging, or creating a release.

## Non-Goals

- Jira, GitHub, GitLab, or Bitbucket APIs.
- Filesystem-wide repository discovery or automatic moved-repository matching.
- Fiscal-quarter logic, arbitrary template code, policy enforcement, or commit blocking.
- Publishing npm, creating GitHub Releases/tags, pushing, or merging to `main`.

## Current Architecture

```text
CLI / OpenTUI / commit-msg adapter
              ↓
      application use cases
              ↓
 domain + Git/config/state/hooks/SQLite/platform adapters
```

Frozen invariants: one binary; Git CLI authority; Git-local repo configuration; worktree-local linked issue; `commit-msg` only; owned/composed safe hooks; explicit shared-hook consent; hook runtime excludes SQLite/OpenTUI; SQLite is registry/cache/global preferences; Doctor/repair respects ownership.

## Residual Classification

| Area | Baseline | Residual obligation |
|---|---|---|
| E1-E6 | M2 complete | PR-title renderer; global Doctor only |
| E7 | repo-local CLI complete | root startup router, interactive init, repositories, global config, link title |
| E8 | registration subset | full schema/repositories/cache/metadata/settings/reconciliation/missing flows |
| E9 | not started | renderer, precedence, cache, clipboard, CLI |
| E10 | minimal S1/S2/S4 shell | typed router/facade and complete S1-S14 behavior/tests |
| E11 | not started | exact v0.5 detection/migration/fixtures |
| E12 | spike notes only | choose strategy, native packages/artifacts/smoke, ADR-0009 |
| E13 | minimal CI | CI matrices, Release Please, OIDC, prerelease/stable workflows |
| E14 | specs only | user docs, reviews, checklist, release gate |

## Decision Manifest

### Required

| ID | Requirement |
|---|---|
| ADR-0001 | TypeScript + Bun; standalone executable; `bun:sqlite` |
| ADR-0002 | Headless application layer; OpenTUI is an adapter; dynamic TUI import |
| ADR-0003 | Git CLI is repository/path authority |
| ADR-0004 | repo-wide Git config, worktree linked issue, no SQLite in hook |
| ADR-0005 | exact hook ownership, reversible composition, no guessed ownership |
| ADR-0006 | SQLite registry/cache/global preferences, never commit truth |
| ADR-0007 | one executable; internal `hook commit-msg`; no `post-checkout` in v1 |
| ADR-0008 | Release Please, npm `next`, trusted publishing, preserve 0.x |
| DR-0015 | all Git/database/home tests are isolated |
| DR-0016 | init/migration compensate only mutations made by the attempt |
| DR-0017 | identifies the deferred M3+ residual surface |
| DR-0018 | explicit hook composition/shared consent remains required |
| DR-0019 | M2 safety/format semantics remain frozen; deferred work now resumes |

### Related

- DR-0010-0014: rewrite layout, canonical docs, development version, and disabled Go automation are already implemented.

### Deferred

- None. Every v1 obligation in this plan is assigned. Remote-only validation is not implementation deferral and will be reported explicitly.

### Conflicts or Uncertainty

- Product logical `linkedIssue` remains physically worktree-local under ADR-0004.
- ADR-0009 is Proposed. E12 must test both approved strategies and then replace its undecided text with an Accepted choice.
- Stable publication gates requiring credentials/external runners are configured and audited locally but cannot be executed in this run.

## Decision Coverage

| Obligation | Source | Tasks | Primary files | Verification | Status |
|---|---|---|---|---|---|
| SQLite is disposable for commit behavior | ADR-0004, ADR-0006 | T-08 | `src/infrastructure/sqlite/**` | DB deletion + compiled commit | Verified |
| Full control-plane schema/global precedence | Product §§12-20, E8 | T-08 | migrations, ports, use cases | migration/repository/settings tests | Verified |
| Local-only PR titles and nonfatal clipboard | Product §15, E9 | T-09 | domain/use case/platform/CLI | unit + CLI + cache matrix | Verified |
| TUI is a typed presentation adapter | ADR-0002, E10 | T-10 | `src/tui/**`, TUI facade | reducer/view-model/smoke tests | Verified |
| Exact legacy signatures only | ADR-0005, E11 | T-11 | legacy analyzer/migrator | frozen fixtures + refusal matrix | Verified |
| One native binary and safe package install | ADR-0001, ADR-0007, E12 | T-12 | package scripts/packages/ADR-0009 | package/install/archive smoke | Planned |
| Version-safe OIDC release automation | ADR-0008, E13 | T-13 | `.github/**`, release config | workflow/static/version tests | Planned |
| Tested docs and safety/release evidence | E14 | T-14 | README/docs/reviews/checklist | doc audit + full gate | Planned |
| Tests never touch developer state | DR-0015 | T-08-T-14 | `tests/helpers/**` | isolated env assertions | Planned |
| Hook/migration rollback is ownership-safe | ADR-0005, DR-0016 | T-11, T-14 | hook/migration use cases | byte-preservation fixtures | Verified |

All Required obligations are mapped to implementation and verification.

## Implementation Strategy

```text
P1 E8 + deferred E7 control plane
  ↓
P2 E9 PR-title
  ↓
P3 E10 OpenTUI + M3 gate
  ↓
P4 E11 migration
  ↓
P5 E12 packaging + ADR-0009 + M4 gate
  ↓
P6 E13 release automation
  ↓
P7 E14 docs/hardening + M5/M6/M7 local gates
```

Each phase: inspect residuals, implement, run focused and regression gates, review architecture/safety, fix findings, update this ledger, and commit a coherent Conventional Commit boundary.

## Implementation Tasks

### T-08 — Control-plane data and deferred CLI

Decisions: ADR-0002/0003/0004/0006, DR-0015.

- Add backward-safe migration(s) for `repository_cache`, `issue_metadata`, and `settings`.
- Expand registry CRUD/list/touch/relocate/cache APIs and missing-path behavior.
- Add typed settings and issue-metadata ports/repositories with constrained schemas.
- Reconcile registered paths against actual Git/config/hook status; update disposable cache.
- Implement `repositories`, `config --global`, global Doctor, startup routing, and headless moved/missing operations.
- Apply global defaults only outside the commit hook; repository overrides win.
- Make bare `init` interactive via the TUI setup route while `--yes` remains noninteractive.

Verification: fresh/upgrade/recreated DB; cascades; settings validation; metadata cache; missing/moved/last-seen/last-opened; CLI JSON; no DB on help/version; delete DB then commit.

### T-09 — PR-title product contract

Decisions: ADR-0002/0004/0006.

- Add pure template/date/quarter renderer.
- Implement application orchestration, story-title precedence, caching, prompt-required result, and optional clipboard.
- Add macOS/Windows/Linux clipboard process adapter with warnings on failure.
- Implement `pr-title --title --no-copy --json` and `link --title` metadata persistence.

Verification: all variables; override/global templates; no active issue; one-shot/cache/prompt; clipboard success/failure; stable JSON; compiled CLI.

### T-10 — Complete OpenTUI control plane

Decisions: ADR-0002; product S0-S14.

- Add exact route union, navigation reducer/history, keymap, async-state helpers, and `TuiServices` facade.
- Implement screen/view-model behavior for S1-S14 with loading/error/retry and safe mutations.
- Route no-args and bare interactive init by startup context.
- Record a parity table mapping every action to an application use case/headless surface.

Verification: reducer/routes/keymap/forms/action availability/view models; every screen render; navigation/exit smoke; component import-boundary audit; compiled TUI startup.

### T-11 — Exact v0.5 migration

Decisions: ADR-0003/0005/0007, DR-0016.

- Derive and document exact signatures from historical v0.5 source/tag.
- Detect legacy commit wrapper/helper and post-checkout/helper only from provable signatures.
- Add preview + CLI/TUI migration flow; default to enabled Hybrid when no state is provable.
- Preserve mixed foreign content and refuse ambiguous/unknown hooks.

Verification: frozen fixtures, byte preservation, exact owned removal, ambiguous refusal, rollback, no invented Manual state.

### T-12 — Native packaging and SPIKE-01

Decisions: ADR-0001/0007 and Proposed ADR-0009.

- Prototype optional platform packages and install-time resolver against npm/pnpm/Bun global layouts.
- Select the safer strategy, mark ADR-0009 Accepted, and remove rejected prototype code.
- Build required native targets, archives, package contents, checksums, exact version metadata, and native command launcher.
- Ensure install/uninstall never touches repositories and missing captured executables leave commits usable.

Verification: local native Linux install/upgrade/uninstall, npm/pnpm/Bun globals, spaces, command resolution, package contents, no repo mutation, TUI startup; cross-target compilation and remote native-run matrix.

### T-13 — CI and release automation

Decisions: ADR-0008 and accepted ADR-0009.

- Split normal, cross-platform integration, and package-smoke CI.
- Configure Release Please manifest/config and changelog ownership.
- Add native artifact/checksum jobs and npm trusted-publishing/OIDC after smoke success.
- Encode `next` prerelease and stable flows without automatic local publication.
- Add version consistency checks across package/tag/build/artifact/npm inputs.

Verification: YAML/static checks, local workflow command parity, exact-version test, no obsolete Go/Changesets/GoReleaser paths.

### T-14 — Documentation, hardening, and release readiness

Decisions: all Required.

- Rewrite README and add installation, CLI, modes/formats, PR-title, TUI, Doctor/repair, removal/uninstall, migration, troubleshooting, architecture, and release checklist docs.
- Run safety review (escaping/paths/hook ownership/atomic writes/no eval/network), performance review, and full architecture parity review.
- Run all M3-M7 locally possible gates; triage/fix defects; record remote-only validations.

Verification: typecheck, lint, all tests, build, compiled E2E, package smoke, migration suite, doc behavior audit, clean Git status.

## Data / State Changes

- SQLite schema advances through numbered migrations; repository truth does not move into SQLite.
- Global settings use constrained JSON values; old/missing DBs receive built-in defaults.
- Legacy migration writes v1 Git-local config/worktree state/integration metadata only after a verified preview.

## API / Contract Changes

- New application ports/use cases for settings, issue metadata, reconciliation, repository management, PR titles, global Doctor, migration, and TUI facade.
- New public CLI commands/options previously deferred by M2.
- Stable JSON envelopes remain versioned.

## UI / UX Changes

- Root no-args and bare `init` become context-aware OpenTUI routes.
- S1-S14 become reachable and keyboard-usable; destructive confirmation disables global quit shortcuts where required.

## Migration Steps

- SQLite migrations are automatic and transactional.
- v0.5 repository migration is explicit, previewed, signature-gated, and compensating.
- Release consumers upgrade through versioned packages/artifacts; package installation never migrates repositories.

## Rollback Plan

- Each phase is a separate commit boundary.
- Database migrations are additive/backward-readable; deleting the DB recreates disposable control-plane state.
- Repository/migration mutations compensate only JiraFlow-owned changes from the current attempt.
- No external publish/tag/push occurs, so release automation remains reversible repository configuration.

## Dependencies

- Bun toolchain at `/home/jaleelbdev/.bun/bin` on this machine.
- Git and local npm/pnpm/Bun for package smoke.
- macOS/Windows target-native checks require remote CI runners.
- npm trusted publishing and release creation require repository/npm credentials and explicit release authorization.

## Open Questions

None blocking. Packaging strategy is deliberately resolved by T-12 evidence, not assumed in advance.

## To-Dos

- [x] T-08 E8/control-plane — 243-test full gate, typecheck, lint, compiled build
- [x] T-09 E9/PR-title — 253-test full gate, typecheck, lint, compiled build
- [x] T-10 E10/OpenTUI and M3 gate — S1-S14 render/reducer/facade coverage; full 258-test gate, typecheck, lint, compiled build
- [x] T-11 E11/migration — exact v0.5 wrappers/symlinks only; 272-test full gate and compiled real-commit migration
- [ ] T-12 E12/packaging and M4 gate
- [ ] T-13 E13/CI-release
- [ ] T-14 E14/hardening and M5-M7 local gates
