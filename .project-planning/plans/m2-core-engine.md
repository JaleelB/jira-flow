# Implementation Plan: M2 Core Engine Residual

## Feature Definition

Close the **M2 — Core Engine Complete** gate: all non-TUI core workflow behavior is correct. This is a residual plan. VS-0/VS-1 already proved the Hybrid + footer + owned-hook spine. M2 extends that spine; it does not rebuild it.

## Approved Execution Amendments (2026-08-19)

Recorded in DR-0019. These override earlier plan text where they conflict:

1. **No `link --title` in M2.** Omit the option. Do not accept-and-ignore it. Story titles are E9.
2. **Distinct Git errors.** Missing executable → `GitUnavailableError`. Timeout → `GitTimeoutError`.
3. **Scope format.** A non-empty existing Conventional Commit scope is unsafe; leave the message unchanged. Do not combine scopes unless a later product/architecture decision defines how.
4. **Idempotency is per active issue.** A different Jira key in the message must not block applying the active issue.
5. **E5-5 is a recorded baseline**, not a hard 250ms CI fail unless the environment is later proven stable.
6. **`init --yes` is the noninteractive init path.** Bare `jira-flow init` must not silently apply defaults that S5 will later replace. Bare init may explain that interactive setup is deferred and point at `--yes`.
7. **Deferred E1–E7 items stay Deferred** when M2 closes. Do not mark them Satisfied just because the M2 gate passed.

DR-0018 Strategy A: `init --yes` only (not bare `init`).

## Problem Statement

VS-1 is architecture-frozen and implemented. The analyzer still treats every non-owned `commit-msg` as `conflict`. Only `footer` mutates. CLI is `init --yes` / `status` / `doctor` / `hook`. Doctor is a subset of checks with no JSON/repair. M2 requires Branch/Manual, all formats, composition, custom/shared hooksPath, worktree proof, remaining CLI, and a compiled-binary engine gate — without expanding into M3 SQLite/TUI control plane.

No standalone E1–E14 gap-analysis artifact is in this repository. The classification below is reconstructed from the roadmap against `src/` + `tests/` on 2026-08-19.

## Goals

- Satisfy roadmap M2: Hybrid / Branch / Manual, link/unlink, enable/disable, all commit formats, safe hook ownership, worktree state, custom hooks path, Doctor, CLI, no destructive hook behavior
- Close remaining Partial obligations in E1–E7 that M2 actually needs
- Keep hook bootstrap free of SQLite/OpenTUI
- Preserve VS-1 compiled-binary Hybrid footer gate as a regression

## Non-Goals

- E1-4 PR-title renderer and E9
- Full E10 TUI / E7-1 S1–S14 startup map
- E11 legacy 0.5 migration
- E12 packaging beyond existing SPIKE-01 notes
- E13 release automation
- E14 docs/hardening
- E6-3 global Doctor
- E7-10 `jira-flow repositories`
- `config --global` / SQLite `settings`
- `link --title` (omit the flag; E9)
- Interactive TUI setup (S5); bare `init` is not a silent-default stand-in
- Re-implementing satisfied VS-1 work

## Current Architecture

Layered Bun/TypeScript app on `rewrite/v1`:

```text
src/cli + src/tui + src/bootstrap/hook-container
        ↓
src/application/use-cases
        ↓
src/domain  +  ports  +  git/hooks/config/state/sqlite adapters
```

**Already in tree (do not rebuild):**

| Area | Implementation |
|---|---|
| Domain keys + Hybrid/Branch/Manual resolver | `src/domain/issue-key.ts`, `active-issue.ts` |
| Footer format only | `src/domain/commit-format.ts`; `unsupported-format` if not footer |
| Git discovery, worktrees, detached HEAD, hooksPath local/relative | `git-adapter.ts`, `repository-discovery.ts` |
| GitRunner stdin/env/stderr; no timeout | `git-runner.ts` |
| Git-local enabled/mode/commitFormat | `git-config-store.ts`; **no** `setIssuePattern` / template / date / unset |
| Worktree `state.json` + atomic JSON | `worktree-state-store.ts`, `atomic-json-file.ts` |
| Analyzer: missing / owned / conflict | `hook-analyzer.ts` |
| Strategy A owned install/remove; refuse foreign | `hook-manager.ts` |
| Integration metadata strategy=`owned` only | `integration-metadata.ts` |
| Init transaction + compensating rollback | `initialize-repository.ts` (always Hybrid+footer) |
| Commit hook use case | `process-commit-message.ts` |
| Doctor 6 checks, human only | `run-doctor.ts` (`hooks.present` id ≠ architecture `hooks.integration`) |
| CLI | `init --yes`, `status`, `doctor`, `hook`; `main.ts` always returns `0` after parse |
| Registry | `register` only; no unregister |
| Tests | Hybrid footer compiled E2E; owned-hook; worktree isolation; hook import graph |

## Residual classification (reconstructed gap analysis)

Status: **Satisfied** (do not plan) · **Partial** · **Not Started** · **Later** (does not block M2)

### Satisfied — do not re-plan

| Item | Evidence |
|---|---|
| E1-1 Jira key VO | `issue-key.ts` + `tests/unit/issue-key.test.ts` |
| E1-2 resolver (domain) | `active-issue.ts` + unit truth table including Branch/Manual |
| E2-4 remote URL | `GitAdapter.getRemoteUrl` (proof test still thin — T-05 adds it) |
| E3-3 worktree schema | `worktree-state-store.ts` + linked-worktree integration test |
| E3-4 atomic JSON | `atomic-json-file.ts` |
| E4-2 markers (owned file) | `hook-markers.ts`, `hook-script.ts` |
| E4-3 owned create/remove | `HookManager.installOwned` / `removeOwned` |
| E4-4 re-init owned | idempotent owned refresh tests |
| E5-1 fast hook bootstrap | `hook-container.ts` + import-graph test |
| E5-3 whole-file I/O | `SystemFilesystem` + process-commit-message |
| E5-4 footer idempotency | unit + VS-1 E2E |
| VS-0 / VS-1 spine | compiled vertical-slice gate |

### Partial — M2 residual

| Item | Gap |
|---|---|
| E1-3 formats | suffix/prefix/scope + matrix |
| E1-5 health | pass/warn/fail + overall exist; check set incomplete; no `missing`/`unknown` overall if needed for unconfigured |
| E2-1 runner | timeout + executable-not-found proof |
| E2-2 discovery | path-with-spaces proof missing |
| E2-3 hooksPath | absolute + shared/external **classification** missing |
| E3-1 config adapter | `issuePattern`, `prTitleTemplate`, `dateFormat`, unset |
| E3-2 effective config | no one-shot overlay; **no global SQLite** (deferred) |
| E4-1 analyzer | full taxonomy |
| E4-5..E4-10 | composition, backup, composed remove, shared, unsupported matrix |
| E5-2 / E5-6 | Branch/Manual/detached/spaces/worktree real commits |
| E5-5 | no baseline |
| E6-1/2/5 | framework + remaining repo checks + richer human next-actions |
| E6-4/6 | repair + JSON |
| E7-2 | `--mode`; `--yes` currently required |
| E7-3 | no `--json` |
| E7-9 | no `--json`/`--repair` |
| E7-12 | `main.ts` returns 0; Commander/typed-error mapping incomplete |

### Not Started — M2 blocking

E4-5, E4-6 backup fields, E4-7, E4-8, E4-9 (as distinct from VS-1 blanket conflict), E4-10, E7-4, E7-5, E7-6, E7-7, E7-8, E7-11 repo-local config CLI.

### Deferred — does **not** block M2 (must remain Deferred after M2, not Satisfied)

| Item | Why deferred |
|---|---|
| E1-4 | E9 / M3 |
| E3-2 global SQLite settings layer | M3 `config --global` |
| E6-3 global Doctor | SQLite control plane |
| E7-1 full TUI router | M3; VS-1 no-args TUI overview stays |
| E7-2 interactive `init` (S5) | M3; M2 uses `init --yes` only |
| E7-10 `repositories` | M3 dashboard |
| E7-11 `--global` | SQLite settings |
| E8-1..E8-10 except unregister + `registry.sync` | M3 |
| E9–E14 | explicit non-goals |
| `link --title` | E9; flag omitted in M2 |
| ADR-0009 / SPIKE-01 complete | packaging, not engine |

`E2-4` code exists; a missing test is not a new epic — fold into T-05.

## Decision Manifest

### Required

| ID | Title | Why it governs this plan |
|---|---|---|
| ADR-0002 | Headless engine + OpenTUI adapter | CLI adapters call use cases; hook never loads TUI |
| ADR-0003 | Git CLI as repository authority | Discovery, hooksPath, no hard-coded `.git/hooks` |
| ADR-0004 | Git-local config vs worktree state | link/unlink/mode/config keys; hook without SQLite |
| ADR-0005 | Hook ownership / managed block | composition, `--yes` never authorizes shared/compose |
| ADR-0006 | SQLite not repo truth | remove/registry.sync; hook still DB-free |
| ADR-0007 | Single executable / internal hook | composed block still `jira-flow hook commit-msg` |
| DR-0015 | Test isolation | temp Git, isolated GIT_CONFIG_*, temp SQLite |
| DR-0016 | Init compensating rollback | init must roll back composed/owned mutations of **this** attempt |
| DR-0017 | M2 residual scope | what is in/out of this plan |
| DR-0018 | Headless composition consent | `--compose-existing-hook`, `--allow-shared-hooks`; Strategy A via `init --yes` |
| DR-0019 | M2 execution amendments | `--title` omitted; `GitTimeoutError`; scope safety; per-issue idempotency; baseline not CI gate; bare init; deferred stay deferred |

### Related

| ID | Title | Notes |
|---|---|---|
| ADR-0001 | TypeScript + Bun | toolchain already satisfied |
| DR-0013 | VS-1 narrow slice | historical cap; M2 lifts engine/CLI pieces it deferred |
| ADR-0008 | Release Please | E13 |

### Not Applicable

| ID | Title | Why exclusion may be questioned |
|---|---|---|
| DR-0010 | Replace Go tree | already done |
| DR-0011 | Canonicalize docs | already done |
| DR-0012 | Unpublished version | already done |
| DR-0014 | Disable Go release automation | already done |

### Deferred

| ID | Title | Approval | Reason |
|---|---|---|---|
| ADR-0009 | Native npm launcher | DR-0017 / user 2026-08-19 | packaging, not M2 engine |

### Conflicts or Uncertainty

1. Product §12 lists `linkedIssue` in Git config. ADR-0004 / architecture §11 keep it in worktree `state.json`. **Follow ADR-0004.**
2. Architecture effective-config includes global SQLite. M2 hook/CLI uses one-shot → repo → built-in. Global layer waits for M3 (`config --global`).
3. Architecture Strategy C shows an interactive prompt. M2 uses flags (DR-0018). TUI prompt is M3.
4. VS-1 Doctor check id `hooks.present` vs architecture `hooks.integration`. **Align to architecture ids in T-17** (pre-alpha; acceptable break).
5. Doctor exit code on `broken`: treat as informational **exit 0** unless execution threw; overall lives in output/`--json`. Flag if CI later wants non-zero.

## Decision Coverage

| Obligation | Source | Tasks | Files | Verification | Status |
|---|---|---|---|---|---|
| CLI/TUI/hook are adapters over use cases | ADR-0002/O-01 | T-20–T-27 | `src/cli/**`, use cases | VT-CLI, VT-M2 | Planned |
| Hook bootstrap excludes SQLite/OpenTUI | ADR-0002/O-02, ADR-0004/O-03 | T-14, T-15 | `hook-container.ts` | VT-05-graph, VT-15 | Planned |
| All Git structure via Git CLI | ADR-0003/O-01 | T-04, T-05 | `git-runner.ts`, `git-adapter.ts` | VT-05 | Planned |
| `linkedIssue` is worktree-local | ADR-0004/O-02 | T-16, T-22 | `worktree-state-store.ts` | VT-16-wt | Planned |
| Never overwrite foreign/shared without consent | ADR-0005/O-01, DR-0018/O-01 | T-06–T-13, T-20, T-24 | `hook-*`, init, remove | VT-HOOK | Planned |
| Missing binary is no-op | ADR-0005/O-02 | T-13 | `hook-script.ts` | VT-HOOK-missing-bin | Planned |
| Registry failure does not destroy repo; remove may unregister | ADR-0006/O-01 | T-24, T-17 | registry, remove, doctor | VT-24 | Planned |
| One binary; `hook commit-msg` | ADR-0007/O-01 | T-08, T-14 | hook-script, process-commit | VT-16 | Planned |
| Temp Git isolation | DR-0015/O-01 | all tests | `tests/helpers/*` | all VT | Planned |
| Init compensating rollback including compose | DR-0016/O-01 | T-20 | `initialize-repository.ts` | VT-20-rollback | Planned |
| M2 excludes TUI/E8/E9–E14 extras | DR-0017/O-01 | all | plan non-goals | VT-M2 | Planned |
| Compose/shared require dedicated flags; Strategy A via `init --yes` | DR-0018/O-02, DR-0019/O-06 | T-12, T-20 | init CLI | VT-20-consent | Planned |
| Distinct Git timeout vs missing executable | DR-0019/O-02 | T-04 | `git-runner.ts` | VT-04 | Planned |
| Scope format does not destroy existing scopes | DR-0019/O-03 | T-01 | `commit-format.ts` | VT-01 | Planned |
| Idempotency is per active issue | DR-0019/O-04 | T-01, T-14 | `commit-format.ts` | VT-01, VT-16 | Planned |
| E5-5 baseline is observational | DR-0019/O-05 | T-15 | baseline test | VT-15 | Planned |
| Omit `link --title` | DR-0019/O-01 | T-22 | `link.ts` | VT-CLI | Planned |

All Required obligations are **Planned**.

## Implementation Strategy

Dependency order, **not** epic numbering:

```text
Phase 1  domain formats + Git/config proof
    ↓
Phase 2  hook engine (highest risk)
    ↓
Phase 3  commit runtime + real git commit matrix
    ↓
Phase 4  Doctor checks / repair / JSON
    ↓
Phase 5  headless CLI wiring + exit codes
    ↓
Phase 6  compiled M2 acceptance gate
```

Phase 2 must land before Phase 3 E2E that needs composition. Phase 5 CLI can start after Phase 1 for `config`/`mode`/`link` against Git state, but `remove` and `init --compose` wait for Phase 2. Recommended serial: 1 → 2 → 3 → 4 → 5 → 6. Parallelism: T-01 with T-04/T-05; T-22/T-23 after T-01+T-02 even before composition.

## Files to Modify

**Extend**

- `src/domain/commit-format.ts`
- `src/domain/errors.ts` (link-in-branch-mode, composition consent, config key)
- `src/application/ports/repo-config.port.ts`
- `src/application/ports/hooks.port.ts`
- `src/application/ports/git.port.ts` (optional `classifyHooksPath`)
- `src/application/ports/registry.port.ts` (`unregister`, `findByPath`)
- `src/application/services/effective-config.ts`
- `src/application/use-cases/initialize-repository.ts`
- `src/application/use-cases/process-commit-message.ts`
- `src/application/use-cases/run-doctor.ts`
- `src/application/use-cases/get-repository-status.ts`
- `src/application/models/doctor-result.ts`
- `src/infrastructure/git/git-runner.ts`
- `src/infrastructure/git/git-adapter.ts`
- `src/infrastructure/git/git-config-store.ts`
- `src/infrastructure/hooks/hook-analyzer.ts`
- `src/infrastructure/hooks/hook-manager.ts`
- `src/infrastructure/hooks/hook-script.ts` (export managed **block** as well as owned file)
- `src/infrastructure/hooks/hook-markers.ts`
- `src/infrastructure/hooks/integration-metadata.ts`
- `src/infrastructure/sqlite/repository-registry.ts`
- `src/cli/build-program.ts` / `src/main.ts`
- `src/cli/commands/init.ts` / `status.ts` / `doctor.ts`
- `src/cli/output/human.ts`
- `src/bootstrap/cli-container.ts`

**Add**

- `src/infrastructure/hooks/hook-path-classification.ts`
- `src/infrastructure/hooks/compose-shell-hook.ts`
- `src/application/use-cases/link-issue.ts`
- `src/application/use-cases/unlink-issue.ts`
- `src/application/use-cases/set-mode.ts`
- `src/application/use-cases/set-enabled.ts`
- `src/application/use-cases/remove-repository.ts`
- `src/application/use-cases/manage-config.ts`
- `src/application/use-cases/repair-repository.ts`
- `src/application/doctor/checks/*.ts` (one check per file)
- `src/cli/commands/link.ts` `unlink.ts` `mode.ts` `enable.ts` `disable.ts` `remove.ts` `config.ts`
- `src/cli/output/json.ts`
- tests under `tests/unit/`, `tests/integration/hooks/`, `tests/e2e/`

**Do not touch for M2:** TUI screens beyond incidental status-view field additions, `migrations` new tables, packaging, release workflows.

## Implementation Tasks

### Phase 1 — Formats, Git proof, repo config

### T-01 — Remaining commit formats + matrix

Roadmap: **E1-3**

Current: `applyIssueReference` footer-only.

Files: `src/domain/commit-format.ts`; `tests/unit/commit-format-*.test.ts`

Dependencies: none

Acceptance:

- `footer` unchanged (append `Jira: KEY` footer)
- `suffix`: ` [KEY]` on the first line; idempotent **for that key**
- `prefix`: `KEY ` before the subject
- `scope`: only when the subject is a Conventional Commit `type:` with **no existing scope** (or empty `()`). Insert `type(KEY):`. A **non-empty existing scope is unsafe** — leave the message unchanged (DR-0019). Freeform subjects: no mutation
- multiline bodies preserved; empty message no-op
- already-present recognized form is no-op **only for the active issue**. A different Jira key must not prevent applying the active issue

Tests: unit matrix (subject-only, body, already-present same key, different key already present, empty, CC without scope, CC with existing scope left unchanged)

Validation: `bun test tests/unit/commit-format`

Commit: `feat(domain): add suffix, prefix, and scope commit formats`

### T-02 — Complete Git-local config adapter

Roadmap: **E3-1** (M2 keys); pr-title **storage** only, not renderer

Current: enabled/mode/commitFormat read/write; issuePattern read-only from regexp dump

Files: `repo-config.port.ts`, `git-config-store.ts`, `tests/integration/config/git-config-store.test.ts`

Dependencies: none

Acceptance: `git config --local` for `jiraflow.issuePattern`, `jiraflow.prTitleTemplate`, `jiraflow.dateFormat`; `unset` via `git config --unset`; never edit `.git/config` as text; invalid values → `ConfigInvalidError`

Tests: round-trip, unset, invalid pattern stored still typed on read

Validation: `bun test tests/integration/config`

Commit: `feat(config): persist remaining jiraflow Git-local keys`

### T-03 — Effective config one-shot overlay

Roadmap: **E3-2** minus global SQLite

Files: `effective-config.ts`; unit tests

Dependencies: T-02

Acceptance: precedence `one-shot > repo > built-in`. Commit hook still repo+built-in only. Include `prTitleTemplate`/`dateFormat` in the struct with built-ins so `config list` can show effective values; hook ignores them.

Tests: overlay wins; null repo → defaults

Validation: `bun test tests/unit` (or colocated integration)

Commit: `feat(config): compute effective workflow config with one-shot overlay`

### T-04 — GitRunner timeout + missing executable

Roadmap: **E2-1** residual

Files: `git-runner.ts`, `tests/integration/git/git-runner.test.ts`

Dependencies: none

Acceptance: optional timeout (default **15s**); kill + typed `GitTimeoutError`; bogus executable path → `GitUnavailableError`; still no shell interpolation; stdin/env remain

Tests: fake executable, timeout via `GIT_TRACE` not required — use a `sleep` wrapper only if we can without touching developer Git; otherwise spawn `git` with a timeout of 1ms against a long `cat-file --batch` **or** inject a test executable script. Prefer a tiny `tests/fixtures/slow-git.sh` that ignores argv and sleeps.

Validation: `bun test tests/integration/git/git-runner.test.ts`

Commit: `feat(git): time out Git invocations and surface missing executables`

### T-05 — Discovery / hooksPath proof for M2

Roadmap: **E2-2**, **E2-3**, **E2-4** proof

Files: `git-adapter.ts`; **add** `hook-path-classification.ts`; `tests/integration/git/repository-discovery.test.ts`

Dependencies: none (classification used by Phase 2)

Acceptance:

- path with spaces: discover + `resolveHooks`
- absolute local `core.hooksPath`
- classify: `repo-default` | `repo-local-custom` | `shared-external` using origin + whether canonical hooksDir is inside `root` or `commonGitDir`
- `getRemoteUrl` none vs origin

Tests: real temp repos (DR-0015)

Validation: `bun test tests/integration/git`

Commit: `test(git): prove spaces, absolute hooksPath, and shared classification`

---

### Phase 2 — Hook engine

### T-06 — Hook analyzer taxonomy

Roadmap: **E4-1**, **E4-9** (classification)

Current: missing / owned / conflict

Files: `hook-analyzer.ts`, new unit tests `tests/unit/hook-analyzer.test.ts`

Dependencies: T-05 classification input

Acceptance: deterministic statuses:

`missing` | `owned` | `managed-block` (valid markers inside a larger file) | `composable-shell` | `unsupported` | `malformed-jiraflow` | `shared-external` | `permission-denied`

`owned` = file is **only** shebang + managed block (Strategy A). `managed-block` = Strategy B (already composed or owned-equivalent with extra body — if extra body exists it is composed, not owned).

Tests: fixtures for each class including damaged markers, `#!/usr/bin/env python`, ELF-ish binary bytes, `#!/bin/bash` + `set -e`

Validation: `bun test tests/unit/hook-analyzer.test.ts`

Commit: `feat(hooks): classify commit-msg ownership and composability`

### T-07 — Shared/external behavior

Roadmap: **E4-8**

Files: classification + `hook-manager.ts` inspect/install gates

Dependencies: T-05, T-06

Acceptance: never silent mutate; `--yes` insufficient; dual flags required (DR-0018); `remove` does not delete shared integration; Doctor explains retained shared block

Tests: temp dir outside repo as `core.hooksPath`

Commit: `feat(hooks): refuse silent mutation of shared hooksPath`

### T-08 — Shell composition + managed block generator

Roadmap: **E4-5**, **E4-2** residual (block insert vs whole file)

Files: `compose-shell-hook.ts`, `hook-script.ts` (export `generateManagedBlock`), `hook-manager.ts`

Dependencies: T-06

Acceptance: interpreters `sh|bash|zsh|dash` (env form `#!/usr/bin/env bash` included); insert block immediately after shebang; original body still runs after JiraFlow; atomic write + executable bit; `--yes` does not compose; backup before write (T-09 can land same PR if small, else T-09 next)

Tests: `set -e` hook still runs body; early `exit 0` in **body after block** still after JiraFlow (JiraFlow runs first)

Commit: `feat(hooks): compose JiraFlow block into existing shell hooks`

### T-09 — Hook backup metadata

Roadmap: **E4-6**

Files: `integration-metadata.ts`; backup file under Git-resolved `jiraflow/backups/`

Dependencies: T-08

Acceptance: persist original SHA-256, backup path, strategy, installed time, binary path; Doctor can locate backup; metadata never authorizes delete

Tests: backup bytes equal original; metadata JSON schemaVersion 1

Commit: `feat(hooks): record composed-hook backup metadata`

### T-10 — Safe composed-hook removal

Roadmap: **E4-7**, **E4-3** verify-before-delete for owned

Files: `hook-manager.ts` `remove` unified

Dependencies: T-08, T-09

Acceptance: strip **exact** managed block only; do not restore whole backup over later user edits; owned file still deleted only if it matches generated owned structure; shared: skip file mutation, still allow repo config/state removal (T-24)

Tests: user edited body after compose; remove leaves user bytes; backup unused for uninstall

Commit: `feat(hooks): remove only the JiraFlow managed block`

### T-11 — Unsupported refusal

Roadmap: **E4-9**

Files: analyzer + manager; `HookUnsafeToModifyError`

Dependencies: T-06

Acceptance: binary, unknown interpreter, malformed, read-only, unsafe → no write; no destructive fallback

Tests: chmod 0444 dir or file; binary fixture

Commit: `feat(hooks): refuse unsupported commit-msg integration`

### T-12 — Init/install strategy routing

Roadmap: **E4-3..E4-5** wiring, **E7-2** consent flags (CLI in T-20)

Files: `hooks.port.ts` (`install` not only `installOwned`), `initialize-repository.ts`

Dependencies: T-07–T-11

Acceptance: inspect → strategy; consent struct; DR-0016 rollback includes composed backup restore **only for this attempt's insert** (restore pre-image of this attempt, not historical whole-file backup over unrelated later edits — for failed init, restoring the attempt's pre-image is correct)

Tests: compose then fail metadata write → original hook restored

Commit: `feat(hooks): route owned, managed-block, and compose strategies`

### T-13 — Full hook matrix gate

Roadmap: **E4-10**

Files: `tests/integration/hooks/hook-matrix.test.ts`

Dependencies: T-12

Acceptance: architecture §42.4 cases all pass

Validation: `bun test tests/integration/hooks`

Commit: `test(hooks): add architecture hook matrix gate`

---

### Phase 3 — Commit runtime

### T-14 — Process commit message for all formats/modes

Roadmap: **E5-2**, **E5-4** residual

Files: `process-commit-message.ts`

Dependencies: T-01, T-03

Acceptance: drop `unsupported-format` for the four presets; Hybrid/Branch/Manual/disabled/detached/no-key already in domain — hook must honor `commitFormat` from repo config

Tests: integration via temp repo + `hook commit-msg` file (can be bun `src` before compiled E2E)

Commit: `feat(hook): apply configured commit format during commit-msg`

### T-15 — Performance baseline

Roadmap: **E5-5**

Files: `tests/e2e/commit-hook-baseline.test.ts` (record elapsed; assert no sqlite/tui imports already exist)

Dependencies: T-14

Acceptance: measure compiled `hook commit-msg` overhead on Hybrid footer path; **record** elapsed (and optional p95) in `tests/e2e/commit-hook-baseline.json` and test output. No network/SQLite/TUI. **Do not fail CI on a 250ms ceiling** (DR-0019). Assert only that the hook ran and the baseline file was written.

Commit: `test(hook): record commit-msg overhead baseline`

### T-16 — Full real-commit E2E suite

Roadmap: **E5-6**, worktree architecture §43

Files: `tests/e2e/commit-runtime.test.ts` (compiled binary)

Dependencies: T-14, Phase 2 owned path (composition cases can live in hook matrix; this suite is `git commit`)

Acceptance (actual `git commit`):

- Hybrid branch (VS-1 regression)
- Hybrid override + unlink
- Manual
- Branch (link refused — CLI may land T-22; until then set mode via `git config` in test)
- no issue
- disabled
- amend/idempotent
- detached HEAD
- path with spaces
- two worktrees independent linked issues, shared `commitFormat`

Validation: `bun test tests/e2e/commit-runtime.test.ts`

Commit: `test(e2e): cover remaining real git commit runtime cases`

---

### Phase 4 — Doctor

### T-17 — Check framework + remaining repo checks

Roadmap: **E6-1**, **E6-2**, **E1-5**

Files: `src/application/doctor/checks/*`, `run-doctor.ts`, `doctor-result.ts`

Dependencies: T-06, T-07, registry `findByPath` (minimal, can add here)

Acceptance: independent checks; plain doctor **no mutation**; ids:

`git.repository` `config.valid` `worktree.state` `registry.sync` `hooks.path` `hooks.integration` `hooks.ownership` `hooks.foreign-preserved` `binary.reachable` `issue.pattern` `mode.valid` `active-issue.resolve`

`registry.sync`: warning if DB missing or path unregistered — **not** fail (ADR-0006). Global DB checks **out**.

Human output: status + suggested next action per fail (E6-5)

Tests: each check isolated with temp repo fixtures

Commit: `feat(doctor): add remaining repository health checks`

### T-18 — Repair orchestration

Roadmap: **E6-4**

Files: `repair-repository.ts`; doctor `--repair` later T-25

Dependencies: T-12, T-17

Acceptance: repair **only** JiraFlow-owned state (rewrite owned hook, recreate state.json defaults, refresh metadata, re-register). Foreign/shared never overwritten. Composed: refresh **block** only if markers valid.

Tests: owned missing → restored; foreign present → refuse

Commit: `feat(doctor): repair only JiraFlow-owned state`

### T-19 — Doctor JSON schema

Roadmap: **E6-6**

Files: `src/cli/output/json.ts`, doctor-result

Dependencies: T-17

Acceptance: stable machine-readable:

```json
{
  "schemaVersion": 1,
  "repoPath": "...",
  "overall": "healthy|warning|broken",
  "checks": [{ "id": "...", "status": "pass|warning|fail", "detail": "...", "repairHint": "..." }]
}
```

Tests: snapshot-ish equality on a healthy repo (ignore timestamps)

Commit: `feat(doctor): emit stable JSON doctor reports`

---

### Phase 5 — Headless CLI

### T-20 — `init --mode` + remaining init behavior

Roadmap: **E7-2**, composition consent **DR-0018**

Files: `init.ts`, `initialize-repository.ts`, `main.ts`

Dependencies: T-12, T-03

Acceptance:

- `jira-flow init` **without** `--yes` does **not** initialize. Print that interactive setup is deferred and direct the user to `init --yes` (DR-0019). Exit 2.
- `init --yes` and `init --yes <path>` are the noninteractive Strategy A path
- `--mode hybrid|branch|manual` (with `--yes`)
- `--yes` **does not** compose
- `--compose-existing-hook` / `--allow-shared-hooks` as DR-0018 (still require `--yes` for the noninteractive command shape)
- idempotent already-configured
- DR-0016 rollback still holds
- init on `main` remains allowed

Tests: integration CLI + composition consent negatives

Commit: `feat(cli): support init --mode and explicit hook composition consent`

### T-21 — `status --json`

Roadmap: **E7-3**

Files: `status.ts`, `json.ts`

Dependencies: none beyond existing status view (add fields if needed)

Acceptance: human default; `--json` prints `RepositoryStatusView` with `schemaVersion: 1`; no color in JSON

Commit: `feat(cli): add status --json`

### T-22 — `link` / `unlink`

Roadmap: **E7-4**, **E7-5**

Files: new use cases + commands; `InvalidJiraKeyError`; new `LinkUnavailableInBranchModeError` exit 2

Dependencies: T-02 optional; worktree store exists

Acceptance: strict whole-token validate; Hybrid override; Manual set; Branch **error, no mode change**; unlink Hybrid/Manual clears; Branch unlink informational no-op; **no `--title` option** (DR-0019 / E9)

Tests: unit + integration temp repo

Commit: `feat(cli): add link and unlink`

### T-23 — `mode` / `enable` / `disable`

Roadmap: **E7-6**, **E7-7**

Files: new use cases + commands

Dependencies: T-02

Acceptance: `mode` read/set; linked issue **preserved** when switching to Branch (ignored, not deleted); enable/disable **do not** change mode; disable hook remains cheap no-op (already true)

Commit: `feat(cli): add mode, enable, and disable`

### T-24 — `remove`

Roadmap: **E7-8** + supporting registry unregister

Files: `remove-repository.ts`, `registry.port.ts` `unregister(path)`, `remove.ts`

Dependencies: T-10, T-12

Acceptance: confirmation required unless `--yes`; non-TTY without `--yes` → exit 2; remove owned integration / Git-local `jiraflow` section / worktree state / metadata / registry row; refuse unsafe; shared: keep hook, still remove repo config/state/registry; never crawl other repos

Tests: owned remove; composed strip; shared retain; foreign refuse

Commit: `feat(cli): add remove with verify-before-delete`

### T-25 — `doctor --json` / `--repair`

Roadmap: **E7-9**

Files: `doctor.ts`

Dependencies: T-18, T-19

Acceptance: flags wired; `--json --repair` allowed (JSON of post-repair checks); plain doctor still read-only

Commit: `feat(cli): add doctor --json and --repair`

### T-26 — `config` repo-local

Roadmap: **E7-11** minus `--global`

Files: `manage-config.ts`, `config.ts`

Dependencies: T-02, T-03

Acceptance: `list|get|set|unset` constrained keys: `enabled`, `mode`, `issuePattern`, `commitFormat`, `prTitleTemplate`, `dateFormat`. Unknown key → exit 2. `--global` → clear error “global defaults are not available yet” exit 2 (do not silently write Git `--global`). `list` shows effective values + source (`repo`/`built-in`)

Commit: `feat(cli): add repo-local config list/get/set/unset`

### T-27 — Exit-code contract

Roadmap: **E7-12**

Files: `main.ts`, Commander error handling, command registration set

Dependencies: all CLI commands

Acceptance: architecture §37: 0/1/2/3/4/5; hook still 0 on no-issue/disabled/unconfigured; usage 2; repo 3; hook safety 4; DB 5; unknown command 2; `--help`/`--version` 0 outside repo. **Stop returning 0 unconditionally after parse.**

Tests: `tests/integration/cli/exit-codes.test.ts`

Commit: `fix(cli): map typed errors to stable process exit codes`

---

### Phase 6 — M2 gate

### T-28 — Compiled M2 Core Engine Acceptance Gate

Roadmap: **M2** definition + E5-6 + E4-10 + E7 surface

Files: `tests/e2e/m2-core-engine.test.ts`

Dependencies: T-13, T-16, T-20–T-27

Acceptance: see **M2 Core Engine Acceptance Gate** below. Uses compiled binary. VS-1 scenario remains a subset.

Validation:

```bash
bun test
bun run typecheck
bun run lint
bun run build
bun test tests/e2e/m2-core-engine.test.ts tests/e2e/vertical-slice.test.ts tests/e2e/commit-runtime.test.ts
```

Commit: `test: add compiled-binary M2 core engine gate`

### T-29 — Planning index only

Files: `.project-planning/README.md` (already updated when this plan was written)

No product README rewrite (E14).

Commit: none required if README already lists the plan.

## Verification Tasks

| ID | Proves | Maps |
|---|---|---|
| VT-01 | format matrix | T-01 |
| VT-02 | Git-local extra keys | T-02 |
| VT-03 | effective overlay | T-03 |
| VT-04 | Git timeout / missing bin | T-04 |
| VT-05 | spaces, absolute/shared hooksPath, remote URL | T-05 |
| VT-HOOK | analyzer + compose + backup + strip + shared + unsupported + §42.4 | T-06–T-13 |
| VT-14 | hook applies all formats | T-14 |
| VT-15 | baseline + import graph still clean | T-15 |
| VT-16 | real commit matrix + worktrees | T-16 |
| VT-17 | doctor checks read-only | T-17 |
| VT-18 | repair owned only | T-18 |
| VT-19 | doctor JSON schema | T-19 |
| VT-20 | init mode + consent + rollback | T-20 |
| VT-CLI | status json, link/unlink/mode/enable/disable/remove/config/doctor flags/exit codes | T-21–T-27 |
| VT-M2 | compiled gate | T-28 |
| VT-VS1 | existing vertical-slice still green | regression |

## Data / State Changes

- `jiraflow.issuePattern` / `prTitleTemplate` / `dateFormat` in Git-local config
- `integration.json` gains `originalSha256`, `backupPath`, `strategy: owned|composed`
- backup blobs under Git-resolved `jiraflow/backups/`
- registry: `DELETE FROM repositories WHERE path = ?` (no new tables)
- worktree state unchanged schema v1

## API / Contract Changes

New CLI: `link`, `unlink`, `mode`, `enable`, `disable`, `remove`, `config`, `init --mode`, composition flags, `--json`, `doctor --repair`.

Doctor check ids: `hooks.present` → `hooks.integration` (pre-alpha break).

Exit codes become real.

`--global` and `repositories` remain unimplemented (explicit error or absent command).

## UI / UX Changes

Human formatters for new commands. TUI overview may show Branch/Manual/disabled if it already binds the status view — no new screens.

## Migration Steps

None for users: unpublished `1.0.0-alpha.0`. VS-1 repos: re-init is idempotent; composed hooks appear only after explicit consent.

## Rollback Plan

Revert the M2 commits; VS-1 owned Hybrid footer path is independent if Phase 2 is isolated. Hook composition bugs are the rollback trigger — if composition is unsafe, revert Phase 2+ and keep Phase 1/5 link/mode behind owned-only init.

## Dependencies

- Bun, real `git`, isolated temp repos (DR-0015)
- VS-1 compiled binary pipeline (`scripts/build.ts`, `tests/helpers/run-jiraflow.ts`)
- Phase order above

## Open Questions

1. Doctor `broken` exit code — planned **0** (informational). Change only if you want CI to fail on health.
2. `config --global` error vs omit subflag — planned explicit error.

No blockers. Assumptions are recorded.

## To-Dos

- [x] Phase 1 T-01–T-05
- [x] Phase 2 T-06–T-13 (review before merge)
- [x] Phase 3 T-14–T-16
- [x] Phase 4 T-17–T-19
- [x] Phase 5 T-20–T-27
- [x] Phase 6 T-28 M2 gate
- [x] Confirm VT-VS1 still passes

---

## M2 Core Engine Acceptance Gate

M2 is complete only when **all** of the following pass on the **compiled** `jira-flow` binary, using temporary Git repos (DR-0015), without opening the TUI:

1. **VS-1 regression:** init → Hybrid ticket branch → `git commit` footer → status → doctor → delete SQLite → commit still footers
2. **Modes:** Branch ignores linked issue; Manual uses only linked; Hybrid override wins then unlink falls back; disable leaves message unchanged; enable restores without changing mode
3. **Formats:** footer / suffix / prefix / scope each proven with a real commit; scope unsafe subject is unchanged
4. **CLI:** `init --mode`; `link`/`unlink` (Branch link errors); `mode`; `enable`/`disable`; `remove --yes`; `status --json`; `doctor --json`; `doctor --repair` (owned only); `config list|get|set|unset` repo-local
5. **Hooks:** owned install; compose with `--compose-existing-hook` preserves foreign body; `--yes` cannot compose; shared hooksPath refused without `--allow-shared-hooks`; binary/unsupported refused; remove strips block or owned file only; missing binary does not block commit
6. **Git shape:** detached HEAD no-op commit; path with spaces; two worktrees independent links; custom **repo-local** `core.hooksPath` owned install
7. **Doctor:** remaining repo checks present; plain doctor does not mutate; repair does not touch foreign hooks
8. **Exit codes:** §37 mapping; hook exit 0 on no active issue
9. **Invariants:** no `.git/hooks` hard-code in `src`; no `post-checkout`; hook-container import graph excludes OpenTUI/`bun:sqlite`
10. **Performance:** baseline recorded; hook path does no network/SQLite/TUI

Not required to close M2: PR titles, TUI map, `repositories`, global config, global doctor, packaging, CI matrices, README rewrite, legacy migration.
