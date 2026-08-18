# JiraFlow v1 Implementation Roadmap & Backlog

**Status:** Proposed execution roadmap  
**Target release:** `1.0.0`  
**Derived from:**
- `JiraFlow_v1_Product_Spec.md`
- `JiraFlow_v1_Technical_Implementation_Architecture.md`

**Implementation direction:** TypeScript + Bun + OpenTUI React  
**Release strategy:** vertical slice → alpha → beta → RC → stable v1  
**Primary principle:** implementation follows the product spec and architecture; roadmap tasks do not reopen already-locked decisions unless a technical spike exposes a contradiction.

---

# 1. Purpose

This roadmap converts the JiraFlow v1 product and technical architecture into an executable backlog.

It defines:

- the first vertical slice
- epics
- tasks
- task dependencies
- acceptance criteria
- test obligations
- architecture decision records
- spike work
- alpha gates
- beta gates
- release-candidate gates
- stable v1 gates

This document is meant to be handed directly to an implementation agent or used to create GitHub issues/projects.

---

# 2. Delivery Philosophy

JiraFlow v1 should not be built screen-first.

The implementation order is:

```text
domain correctness
      ↓
Git repository discovery
      ↓
repo/worktree state
      ↓
safe hook integration
      ↓
real commit behavior
      ↓
Doctor
      ↓
headless CLI
      ↓
SQLite control plane
      ↓
PR-title workflow
      ↓
OpenTUI management layer
      ↓
packaging
      ↓
release hardening
```

The most dangerous subsystem is Git-hook ownership/composition.

The highest-leverage validation is a real temporary Git repository executing a real `git commit`.

The TUI is intentionally delayed until the engine is proven.

---

# 3. Roadmap Overview

```text
VS-0  Architecture / Toolchain Spike
  ↓
VS-1  Vertical Slice
  ↓
E1    Domain Core
  ↓
E2    Git Repository Adapter
  ↓
E3    Repo Config + Worktree State
  ↓
E4    Hook Ownership / Composition
  ↓
E5    Commit Runtime
  ↓
E6    Doctor / Repair
  ↓
E7    Headless CLI Surface
  ↓
E8    SQLite Registry / Settings
  ↓
E9    PR Title Generation
  ↓
E10   OpenTUI Management UI
  ↓
E11   Legacy 0.5 Migration
  ↓
E12   Packaging / Native Distribution
  ↓
E13   CI / Release Automation
  ↓
E14   Docs / Hardening / Release
```

Some epics can overlap after the vertical slice, but dependency rules still apply.

---

# 4. Milestone Definitions

## M0 — Architecture Ready

Goal:

Prove the core toolchain and remove unknowns that could invalidate the implementation architecture.

Required:

- TypeScript + Bun project bootstraps
- OpenTUI renders
- `bun:sqlite` works
- standalone binary compiles
- real Git commands work through the process adapter
- package-manager launcher spike starts

## M1 — Vertical Slice Complete

Goal:

Prove the entire core spine in one narrow path.

Required user scenario:

```text
compile JiraFlow
    ↓
create temp Git repo
    ↓
jira-flow init
    ↓
safe owned commit-msg hook installed
    ↓
Hybrid mode configured
    ↓
create feat/ABC-123-login
    ↓
git commit
    ↓
commit receives Jira reference
    ↓
jira-flow status
    ↓
jira-flow doctor
    ↓
minimal OpenTUI repo status screen renders
```

No broad feature completeness required yet.

## M2 — Core Engine Complete

Goal:

All non-TUI core workflow behavior is correct.

Required:

- Hybrid / Branch / Manual
- link / unlink
- enable / disable
- all commit formats
- safe hook ownership
- worktree state
- custom hooks path
- Doctor
- CLI
- no destructive hook behavior

## M3 — Control Plane Complete

Goal:

SQLite + PR title + management TUI are fully functional.

## M4 — Alpha Ready

Goal:

Externally testable v1 prerelease with core behavior working across required OSes.

## M5 — Beta Ready

Goal:

Feature-complete v1 with stable UX and storage schemas.

## M6 — RC Ready

Goal:

Feature freeze, migration proven, packaging proven, docs complete.

## M7 — Stable v1

Goal:

Publish `1.0.0`, move npm `latest` to v1, preserve 0.x history.

---

# 5. Labels / Backlog Taxonomy

Recommended issue labels:

```text
type:epic
type:task
type:spike
type:bug
type:test
type:docs
type:release

area:domain
area:git
area:hooks
area:config
area:state
area:sqlite
area:cli
area:tui
area:pr-title
area:doctor
area:packaging
area:release
area:migration

priority:p0
priority:p1
priority:p2
priority:p3

milestone:vertical-slice
milestone:alpha
milestone:beta
milestone:rc
milestone:v1
```

---

# 6. Global Definition of Done

A task is not complete merely because the implementation exists.

Unless explicitly exempted, each implementation task must satisfy:

- code implemented
- typecheck passes
- lint passes
- unit tests added where logic exists
- integration tests added where infrastructure behavior exists
- no test touches the developer's real Git configuration or hooks
- user-facing errors use typed JiraFlow errors
- behavior matches product spec
- no business logic added directly to OpenTUI or Commander adapters
- relevant docs/comments updated
- no known regression to existing completed milestone behavior

---

# 7. Required Architecture Decision Records

Create:

```text
docs/adr/
```

Required ADRs:

```text
ADR-001 TypeScript + Bun runtime
ADR-002 Headless engine + OpenTUI adapter
ADR-003 Git CLI as repository authority
ADR-004 Git-local config vs worktree-local state
ADR-005 Hook ownership and managed-block composition
ADR-006 SQLite as registry/cache, not repo truth
ADR-007 Single executable / internal hook command
ADR-008 Release Please + prerelease channel
ADR-009 Native npm launcher strategy
```

ADR-009 is written only after SPIKE-01 is complete.

---

# 8. VS-0 — Architecture / Toolchain Validation

**Priority:** P0  
**Milestone:** Architecture Ready  
**Blocks:** VS-1 and all implementation epics

## VS0-1 — Bootstrap Bun + TypeScript repository

### Tasks

- initialize `package.json`
- add Bun lockfile
- add TypeScript configuration
- establish `src/main.ts`
- establish lint configuration
- establish test configuration
- add basic `jira-flow --version`
- add `jira-flow --help`

### Acceptance

```bash
bun install
bun run typecheck
bun test
bun run src/main.ts --version
```

all succeed.

`--version` and `--help` work outside a Git repo.

### Tests

- CLI smoke
- no Git repo required

## VS0-2 — Prove standalone executable compilation

### Tasks

- compile `src/main.ts` using Bun standalone executable mode
- inject version placeholder
- run executable
- verify no separate Bun runtime is required

### Acceptance

Compiled executable can run:

```bash
jira-flow --version
jira-flow --help
```

on the development platform.

### Tests

- packaged-binary smoke test

## VS0-3 — Prove OpenTUI React bootstrap

### Tasks

- install OpenTUI packages
- create minimal React TUI
- render one screen
- respond to `Q`
- exit cleanly

### Acceptance

Running `jira-flow` in explicit development TUI mode renders and exits without crash.

### Tests

- renderer smoke
- keypress smoke

## VS0-4 — Prove `bun:sqlite`

### Tasks

- open temporary DB
- create table
- insert
- query
- close
- verify compiled executable can use SQLite

### Acceptance

Standalone compiled executable can create/read a SQLite database.

### Tests

- temporary DB integration test

## VS0-5 — Prove Git process adapter

### Tasks

- execute `git --version`
- create temporary Git repo helper
- run `git rev-parse`
- capture stdout/stderr/exit code

### Acceptance

Git runner returns structured success/failure results.

### Tests

- successful command
- invalid command
- non-repo command failure
- stderr preservation

## VS0-6 — Begin SPIKE-01 package-manager launcher

### Goal

Determine the viable native-binary packaging model.

### Investigate

- platform-specific optional packages
- install-time release asset resolver

### Required environments

- npm global
- pnpm global
- Bun global
- macOS
- Windows
- Linux

### Deliverable

Prototype findings only.

Final strategy does not have to be selected before vertical slice, but no alpha release can proceed without completion.

---

# 9. VS-1 — Vertical Slice

**Priority:** P0  
**Milestone:** Vertical Slice Complete  
**Depends on:** VS-0

The vertical slice intentionally implements only enough behavior to validate the architecture end to end.

## VS1-1 — Minimal domain model

Implement:

```text
LinkingMode
JiraKey
ActiveIssue
CommitFormat.footer
```

### Acceptance

Hybrid resolution works for:

```text
enabled + no override + branch issue
enabled + override + branch issue
disabled
```

### Tests

Pure unit truth table.

## VS1-2 — Minimal repository discovery

Implement:

- detect repo
- resolve root
- resolve Git dir
- resolve common Git dir
- current branch

### Acceptance

Works from:

- repo root
- nested directory
- non-repo returns typed error

### Tests

Real temp repos.

## VS1-3 — Minimal Git-local config

Implement:

```text
jiraflow.enabled
jiraflow.mode
jiraflow.commitFormat
```

### Acceptance

`jira-flow init` can write:

```text
enabled=true
mode=hybrid
commitFormat=footer
```

### Tests

Real Git config read/write.

## VS1-4 — Minimal worktree state store

Implement `linkedIssue` in Git-resolved JiraFlow state file.

### Acceptance

Read/write works atomically.

### Tests

- null issue
- linked issue
- invalid JSON handling

## VS1-5 — Minimal owned hook install

Only support:

```text
commit-msg absent
```

Create owned JiraFlow hook file.

Do not compose with existing hooks yet.

If existing hook exists:

```text
return typed conflict
```

### Acceptance

- hook installed executable
- marker present
- second init is idempotent

### Tests

Real Git repo.

## VS1-6 — Implement internal commit hook command

Command:

```bash
jira-flow hook commit-msg <path>
```

### Acceptance

In Hybrid mode, branch `feat/ABC-123-login` causes a real commit to receive the default footer reference.

### Tests

Real `git commit`.

## VS1-7 — Implement minimal `init`

Default behavior only.

### Acceptance

```bash
jira-flow init --yes
```

inside clean repo:

- config written
- hook installed
- state path prepared
- success output
- second call succeeds without duplicate hook

## VS1-8 — Implement minimal `status`

### Acceptance

Outputs:

```text
enabled
mode
branch
branch issue
active issue
integration state
```

### Tests

Human output semantics.

## VS1-9 — Implement minimal Doctor

Checks:

- Git repo
- config
- hook present
- ownership marker
- issue pattern
- active issue

### Acceptance

Healthy vertical-slice repo reports Healthy.

## VS1-10 — Minimal SQLite registry

Register repo after init.

### Acceptance

SQLite contains repository path/name.

Commit hook still works when DB is deleted.

### Tests

Delete DB after init, commit still succeeds.

## VS1-11 — Minimal OpenTUI repo overview

Only one screen required for vertical slice.

Display:

```text
repo
enabled
mode
branch
active issue
health
```

### Acceptance

TUI calls application use case/view model.

No direct Git/SQLite calls from component.

## VS1-12 — Vertical-slice E2E gate

Required automated scenario:

```text
build binary
create temp repo
init
create feat/ABC-123-login
commit
assert commit message
status
doctor
delete SQLite DB
commit again
assert still works
```

### Milestone gate

VS-1 is not complete until this passes using the compiled executable.

---

# 10. Epic E1 — Domain Core

**Priority:** P0  
**Depends on:** VS-1 foundation

## E1-1 — Complete Jira key value object

Support:

- default pattern
- strict linked key validation
- branch extraction
- configurable pattern
- invalid regex handling
- no panic behavior

### Acceptance

Strict link validation and branch substring extraction are separate APIs.

### Tests

- valid
- invalid
- substring-only invalid for manual
- branch extraction
- multiple matches
- invalid regex

## E1-2 — Complete active issue resolver

Truth table across:

```text
enabled
Hybrid
Branch
Manual
linked issue
branch issue
```

### Acceptance

Exactly matches product spec.

## E1-3 — Complete commit formatting

Implement:

```text
footer
suffix
prefix
scope
```

### Acceptance

- idempotent
- preserves Conventional Commit start in footer default
- scope transformation refuses unsafe input
- multiline messages safe

### Tests

Large format matrix.

## E1-4 — PR title renderer

Support variables:

```text
jiraKey
storyTitle
branch
repo
date
quarter
```

### Acceptance

Unknown variable fails validation.

No arbitrary expressions.

## E1-5 — Health model

Implement:

```text
pass
warning
fail
healthy
warning
broken
missing
unknown
```

### Acceptance

Doctor can aggregate check results deterministically.

---

# 11. Epic E2 — Git Repository Adapter

**Priority:** P0  
**Depends on:** VS-1 Git runner

## E2-1 — Harden Git runner

Add:

- timeout handling
- structured stderr
- executable-not-found error
- optional environment
- optional stdin
- safe argument passing

### Tests

No shell interpolation.

## E2-2 — Full repository discovery

Support:

- root
- nested path
- linked worktree
- detached HEAD
- Git path with spaces
- common Git dir

### Acceptance

No hard-coded `.git`.

## E2-3 — Resolve effective hooks path

Implement `core.hooksPath` rules.

### Acceptance

Support:

- default hook path
- local relative hooksPath
- absolute hooksPath
- shared/external hooksPath classification

### Tests

Real Git config.

## E2-4 — Remote URL metadata

Read preferred remote URL if present.

### Acceptance

No remote is valid.

Remote is informational only.

---

# 12. Epic E3 — Repository Config + Worktree State

**Priority:** P0  
**Depends on:** E2

## E3-1 — Complete Git-local repo config adapter

Logical settings:

```text
enabled
mode
issuePattern
commitFormat
prTitleTemplate
dateFormat
```

### Acceptance

Uses `git config --local`.

Does not manually edit `.git/config`.

## E3-2 — Effective config service

Precedence:

```text
one-shot
repo override
global setting
built-in
```

### Acceptance

Commit hook works without SQLite by falling back to repo/built-in values.

## E3-3 — Worktree state schema v1

Store:

```json
{
  "schemaVersion": 1,
  "linkedIssue": null,
  "updatedAt": "..."
}
```

### Acceptance

Different linked worktrees can maintain independent linked issues.

### Tests

Mandatory real worktree integration test.

## E3-4 — Atomic file primitive

Reusable safe write helper.

### Acceptance

No partially written JSON on normal process interruption scenarios that can be simulated.

---

# 13. Epic E4 — Hook Ownership / Composition

**Priority:** P0  
**Depends on:** E2 + E3  
**Blocks:** stable core engine

## E4-1 — Hook analyzer

Classify:

```text
missing
owned
managed-block
composable-shell
unsupported
malformed-jiraflow
shared-external
permission-denied
```

### Acceptance

Classification is deterministic and tested.

## E4-2 — Managed block generator

Generate versioned markers.

### Acceptance

- path escaped
- no duplicate block
- missing binary no-op behavior

## E4-3 — Owned hook strategy

### Acceptance

Create/remove owned hook safely.

Remove only when ownership is verified.

## E4-4 — Existing JiraFlow block strategy

### Acceptance

Re-init updates/verifies rather than duplicates.

## E4-5 — Shell-hook composition strategy

Supported interpreters:

```text
sh
bash
zsh
dash
```

### Acceptance

- explicit consent required
- `--yes` does not bypass consent
- backup before modification
- atomic write
- block inserted after shebang
- original hook still executes

## E4-6 — Hook backup metadata

Persist:

```text
original hash
backup path
strategy
installed time
binary path
```

### Acceptance

Doctor can locate original backup.

## E4-7 — Safe removal from composed hook

### Acceptance

Remove exact JiraFlow block only.

Do not restore whole old backup over later user changes.

## E4-8 — Shared/external hooksPath behavior

### Acceptance

- never silently mutate
- explicit warning
- safe refusal if scope uncertain
- repo remove does not delete shared integration blindly

## E4-9 — Unsupported hook refusal

Cases:

```text
binary
unknown interpreter
malformed
read-only
unsafe
```

### Acceptance

No destructive fallback.

## E4-10 — Full hook matrix test gate

Must pass every required hook scenario from architecture doc.

This is release-blocking.

---

# 14. Epic E5 — Commit Runtime

**Priority:** P0  
**Depends on:** E1 + E3 + E4

## E5-1 — Fast hook bootstrap

Internal command must not initialize:

- OpenTUI
- SQLite
- clipboard
- global dashboard

### Acceptance

Import/dependency graph proves hook bootstrap is minimal.

## E5-2 — Full active issue runtime

Support:

- Hybrid
- Branch
- Manual
- detached HEAD
- no-key branch
- linked override
- disabled state

## E5-3 — Safe commit message I/O

Whole-file read/write.

### Acceptance

- no scanner truncation risk
- no write if unchanged
- multiline messages preserved

## E5-4 — Idempotent mutation

### Acceptance

Amend/re-run does not duplicate active Jira key.

## E5-5 — Performance baseline

Measure commit hook overhead.

### Acceptance

No network, no SQLite, no TUI.

Record baseline.

## E5-6 — Full commit E2E suite

Mandatory release-blocking cases:

- Hybrid branch
- Hybrid override
- Manual
- Branch
- no issue
- disabled
- amend/idempotent
- detached HEAD
- path with spaces
- worktree

---

# 15. Epic E6 — Doctor / Repair

**Priority:** P1  
**Depends on:** E2-E5

## E6-1 — Doctor check framework

Implement independent checks.

### Acceptance

Plain Doctor performs no mutation.

## E6-2 — Repo checks

Implement:

```text
git.repository
config.valid
worktree.state
registry.sync
hooks.path
hooks.integration
hooks.ownership
hooks.foreign-preserved
binary.reachable
issue.pattern
mode.valid
active-issue.resolve
```

## E6-3 — Global Doctor

Checks:

```text
database.available
database.schema
registry.paths
```

## E6-4 — Repair orchestration

`doctor --repair`

May repair only JiraFlow-owned state.

### Acceptance

Foreign hooks never overwritten automatically.

## E6-5 — Doctor human output

Clear statuses and suggested next actions.

## E6-6 — Doctor JSON schema

Stable machine-readable format.

---

# 16. Epic E7 — Complete Headless CLI

**Priority:** P1  
**Depends on:** E1-E6

## E7-1 — Root context router

`jira-flow` no args:

- configured repo → TUI repo overview
- unconfigured repo → TUI setup state
- outside repo with known repos → global TUI
- outside repo no repos → empty TUI

## E7-2 — `init`

Support:

```text
jira-flow init
jira-flow init <path>
--mode
--yes
```

### Acceptance

Idempotent.

## E7-3 — `status`

Support human + `--json`.

## E7-4 — `link`

Support:

```text
jira-flow link ABC-123
--title
```

### Acceptance

Branch mode rejects without silently changing mode.

## E7-5 — `unlink`

Correct behavior per mode.

## E7-6 — `mode`

Support read and set.

Preserve linked issue while Branch mode ignores it.

## E7-7 — `enable` / `disable`

No mode mutation.

## E7-8 — `remove`

Support confirmation + `--yes`.

Refuse unsafe destructive removal.

## E7-9 — `doctor`

Support:

```text
--json
--repair
```

## E7-10 — `repositories`

Human + JSON.

No filesystem scan.

## E7-11 — `config`

Support:

```text
list
get
set
unset
--global
```

Constrained keys only.

## E7-12 — Error/exit code contract

Implement stable exit mapping.

---

# 17. Epic E8 — SQLite Registry / Settings

**Priority:** P1  
**Depends on:** VS0 SQLite spike

## E8-1 — Platform app paths

Implement:

- macOS
- Windows
- Linux XDG/fallback

## E8-2 — Database bootstrap

Set:

```sql
foreign_keys
WAL
busy_timeout
```

## E8-3 — Migration runner

Add `schema_migrations`.

### Acceptance

Fresh DB and upgrades both work.

## E8-4 — `repositories` table

Implement registry repository.

## E8-5 — `repository_cache`

Disposable derived state.

## E8-6 — `issue_metadata`

Story-title cache.

## E8-7 — `settings`

Global defaults + TUI preferences.

## E8-8 — Repository reconciliation

Flow:

```text
registry
path check
Git discovery
repo config
hook inspect
cache update
```

Actual repo wins.

## E8-9 — Missing repo state

Mark `missing`.

Do not auto-delete.

## E8-10 — SQLite deletion resilience gate

Test:

```text
configured repo
delete DB
git commit
```

Commit still works.

Mandatory.

---

# 18. Epic E9 — PR Title Generation

**Priority:** P1  
**Depends on:** E1 + E3 + E8

## E9-1 — Variable resolver

Support:

```text
jiraKey
storyTitle
branch
repo
date
quarter
```

## E9-2 — Story title precedence

```text
CLI option
SQLite cache
interactive prompt
```

## E9-3 — Calendar quarter

Implement Q1-Q4 only.

No fiscal-quarter logic.

## E9-4 — Clipboard adapter

Support:

- macOS `pbcopy`
- Windows `clip.exe`
- Linux `wl-copy` / `xclip`

Failure is warning, not command failure.

## E9-5 — `pr-title` CLI

Support:

```text
--title
--no-copy
--json
```

## E9-6 — Metadata caching

Persist entered story title by repo + Jira key.

## E9-7 — PR title test matrix

- all variables
- no active issue
- cached title
- one-shot title
- clipboard unavailable
- template override
- global default

---

# 19. Epic E10 — OpenTUI Management UI

**Priority:** P1  
**Depends on:** E7 + E8 + E9

Do not start full TUI implementation before headless behavior is available.

## E10-1 — TUI service facade

Expose only application use cases/view models.

No adapter leakage.

## E10-2 — Navigation reducer

Implement exact route union.

## E10-3 — Global keymap

Support:

```text
Esc
Q
?
```

## E10-4 — S1 Empty State

Acceptance matches product spec.

## E10-5 — S2 Unconfigured Repository

Actions:

- setup
- dashboard
- exit

## E10-6 — S3 Global Dashboard

Columns:

```text
Repository
Mode
Issue
Health
```

Actions:

```text
Enter
A
D
S
R
Q
```

## E10-7 — S4 Repository Overview

Display full required state.

Actions:

```text
Link
Unlink
Mode
PR title
Workflow
Doctor
Enable/disable
Remove
Global dashboard
```

## E10-8 — S5 Setup

Near-one-click default init.

## E10-9 — S6 Setup Customization

Fields:

- mode
- issue pattern
- commit format
- PR title template source

## E10-10 — S7 Link Issue

Issue key + optional story title.

## E10-11 — S8 Mode Selection

Show consequence of switching modes.

## E10-12 — S9 Workflow Settings

Repo overrides vs global inheritance.

## E10-13 — S10 PR Title Generator

Preview + copy + edit story title.

## E10-14 — S11 Doctor

Global and repo variants.

## E10-15 — S12 Global Settings

All v1 global settings.

## E10-16 — S13 Missing Repository

Actions:

- Locate
- Remove from registry
- Ignore

## E10-17 — S14 Remove Confirmation

Must show safety semantics.

## E10-18 — Async/error UX

Every mutating action handles:

```text
loading
success
typed error
retry where applicable
```

## E10-19 — TUI parity audit

Create checklist matching every TUI action to a headless use case.

Release blocker.

## E10-20 — TUI smoke tests

Per required OS:

- launch
- render dashboard
- navigate
- exit

---

# 20. Epic E11 — Legacy Go 0.5 Migration

**Priority:** P1  
**Milestone:** Beta/RC  
**Depends on:** E4 + E7

## E11-1 — Catalog exact legacy signatures

Document known v0.5 hook patterns.

## E11-2 — Legacy detection

Recognize only provable JiraFlow-generated content.

Never:

```text
commit-msg exists -> assume JiraFlow
```

## E11-3 — Legacy migration plan

Default:

```text
enabled = true
mode = hybrid
```

unless recoverable state proves otherwise.

## E11-4 — Remove legacy `post-checkout`

Only if ownership/signature is proven.

## E11-5 — Replace legacy commit-msg behavior

Preserve foreign hook content if mixed.

## E11-6 — Migration TUI/CLI prompt

Show exactly what will change.

## E11-7 — Migration fixture tests

Create frozen legacy hook fixtures from 0.5 behavior.

Mandatory before RC.

---

# 21. Epic E12 — Packaging / Native Distribution

**Priority:** P0 before alpha  
**Depends on:** VS0 + E7  
**Blocks:** Alpha

## E12-1 — Complete SPIKE-01

Test both packaging strategies.

### Acceptance matrix

```text
npm global
pnpm global
bun global

macOS
Windows
Linux
```

## E12-2 — Select packaging strategy

Write `ADR-009`.

## E12-3 — Build native release matrix

Required:

```text
darwin-arm64
darwin-x64
linux-x64
windows-x64
```

Optional once proven:

```text
linux-arm64
windows-arm64
```

## E12-4 — Version injection

Embed:

```text
version
commit
build date
```

## E12-5 — Release archive creation

Names:

```text
jira-flow-vX.Y.Z-darwin-arm64.tar.gz
...
```

## E12-6 — SHA256 sums

Generate and publish.

## E12-7 — Package install smoke tests

For each supported package manager/platform:

```text
install
where/command -v
--version
--help
temp repo init
commit
doctor
uninstall
```

## E12-8 — Missing executable hook resilience

After uninstall/removing binary:

```text
git commit
```

must not be blocked by JiraFlow shim.

Mandatory.

---

# 22. Epic E13 — CI / Release Automation

**Priority:** P1  
**Depends on:** E12

## E13-1 — `ci.yml`

Run:

- install
- typecheck
- lint
- unit
- application
- SQLite

## E13-2 — `integration.yml`

Matrix:

- Ubuntu
- macOS
- Windows

Run real Git integration.

## E13-3 — `package-smoke.yml`

Build actual binary and run real smoke flow.

## E13-4 — Release Please

Configure release PR.

Remove:

- Changesets
- old manual version bump
- GPG release dependency

## E13-5 — npm trusted publishing

Set up OIDC.

## E13-6 — `next` prerelease workflow

Support alpha/beta/RC.

## E13-7 — Stable release workflow

Publish npm only after artifact smoke tests pass.

---

# 23. Epic E14 — Documentation / Hardening / Release

**Priority:** P1  
**Depends on:** all v1 features

## E14-1 — Rewrite README

Must include:

- v1 overview
- install
- init
- modes
- link/unlink
- commit formats
- PR title
- TUI
- Doctor
- remove
- migration

## E14-2 — Migration guide

Document `0.5 -> 1.0`.

## E14-3 — Troubleshooting

Focus on:

- hook conflicts
- shared hooksPath
- missing executable
- worktrees
- invalid regex
- stale repo
- SQLite issues

## E14-4 — CLI reference

Exact command/flag surface.

## E14-5 — Architecture docs

Commit:

- product spec
- technical architecture
- roadmap
- ADRs

## E14-6 — Security/safety review

Audit:

- shell escaping
- path handling
- hook backup/removal
- shared hooks
- atomic writes
- no code eval
- no hidden network behavior

## E14-7 — Performance review

Commit hook fast-path audit.

## E14-8 — Release checklist

Create repeatable stable-release checklist.

---

# 24. Dependency Matrix

| Epic | Depends on | Blocks |
|---|---|---|
| VS-0 | None | VS-1 |
| VS-1 | VS-0 | Core implementation |
| E1 Domain | VS-1 | E5, E9 |
| E2 Git | VS-1 | E3, E4, E5 |
| E3 Config/State | E2 | E4, E5, E8 |
| E4 Hooks | E2, E3 | E5, E6, E11 |
| E5 Commit Runtime | E1, E3, E4 | E6, E7 |
| E6 Doctor | E2-E5 | E7, Beta |
| E7 CLI | E1-E6 | E10, E12 |
| E8 SQLite | E3 | E9, E10 |
| E9 PR Title | E1, E3, E8 | E10 |
| E10 TUI | E7-E9 | Beta |
| E11 Migration | E4, E7 | RC |
| E12 Packaging | E7 + SPIKE-01 | Alpha |
| E13 CI/Release | E12 | RC/Stable |
| E14 Docs/Hardening | All | Stable |

---

# 25. Parallelization Guidance

After VS-1, safe parallel tracks are:

## Track A — Core engine

```text
E1
E2
E3
E4
E5
E6
E7
```

This is the critical path.

## Track B — Control plane

Can begin after stable interfaces:

```text
E8
E9
```

## Track C — Packaging

Can progress in parallel after executable/CLI exists:

```text
SPIKE-01
E12
```

## Track D — TUI

Do not begin full implementation until:

```text
E7
E8
E9
```

have stable application APIs.

TUI shell/navigation scaffolding may begin earlier, but screen business behavior should not.

---

# 26. Vertical Slice Acceptance Gate

Do not move into broad implementation until all are true:

- standalone executable runs
- temp repo init works
- owned commit-msg hook installed
- JiraFlow does not use `.git/hooks` hard-coded path
- Git-local config written
- worktree state readable
- Hybrid branch issue detected
- real `git commit` mutated
- commit message has footer reference
- second init does not duplicate hook
- status works
- Doctor works
- SQLite registry can be deleted without breaking commit
- minimal OpenTUI screen reads status through application layer
- no test touches real user hooks/config

If any fail because of architecture, update architecture before scaling feature work.

---

# 27. Alpha Scope

Suggested first external release:

```text
1.0.0-alpha.1
```

published to:

```text
next
```

## Alpha required features

- one compiled executable
- installable on macOS/Windows/Linux
- `--help`
- `--version`
- `init`
- `status`
- Hybrid mode
- Branch mode
- Manual mode
- link/unlink
- enable/disable
- footer commit format
- safe owned hook install
- safe supported shell composition
- safe remove
- worktree-local linked issue
- Doctor
- SQLite repo registration
- minimal but usable TUI dashboard/repo overview
- real commit E2E
- package-manager smoke tests

## Alpha may omit

- every final TUI polish detail
- all commit format presets
- complete PR-title TUI
- legacy 0.5 migration UX
- moved repo locate flow
- full docs polish

## Alpha release blockers

Any of:

- hook overwrite risk
- hook remove deletes foreign content
- init from nested dir broken
- worktree issue leakage
- commit hook depends on SQLite
- missing JiraFlow executable blocks commits
- Windows/macOS/Linux installation fails
- package version/runtime version mismatch
- no real integration test coverage

---

# 28. Beta Scope

Suggested:

```text
1.0.0-beta.1
```

Beta means feature complete.

## Beta required

Everything in product-spec v1.0 scope:

- full CLI surface
- full TUI screen map
- all three modes
- enabled separate from mode
- all commit formats
- SQLite registry/cache/settings
- PR-title generation
- story-title cache
- clipboard behavior
- Doctor + repair
- missing repo screen
- repo overrides
- global settings
- JSON output
- legacy detection/migration
- cross-platform integration suite
- DB migrations
- packaging chosen/frozen

## Beta gate

- no known P0
- no known destructive P1
- full hook matrix passes
- full commit E2E passes
- full worktree suite passes
- SQLite deletion resilience passes
- all required TUI screens render
- package-manager install matrix passes
- migration fixtures pass

---

# 29. Release Candidate Scope

Suggested:

```text
1.0.0-rc.1
```

RC means no new v1 features.

Only:

- bug fixes
- compatibility fixes
- docs
- release hardening

## RC required gates

### Product

- exact product-spec command surface
- exact required TUI screens
- no feature gaps

### Safety

- foreign hooks preserved
- safe shared hooks behavior
- remove verified
- missing binary no-op
- no destructive migration paths

### Cross-platform

- macOS arm64
- macOS x64
- Windows x64
- Linux x64

all pass packaged smoke tests.

### State

- DB migrations tested
- worktree state versioned
- hook metadata versioned
- prerelease upgrade path tested

### Migration

- 0.5 legacy fixtures
- migration success
- migration refusal on unknown hook
- post-checkout removal only when ownership proven

### Docs

- README
- migration guide
- CLI reference
- troubleshooting
- release notes

### Defects

- zero P0
- zero known P1
- P2s individually triaged for acceptability

---

# 30. Stable v1 Gate

Tag:

```text
v1.0.0
```

Move npm:

```text
latest -> 1.0.0
```

Stable only if:

- RC has had external validation
- no new destructive hook issues
- release artifacts reproducibly build
- npm publish uses trusted publishing
- binary reports exact `1.0.0`
- GitHub release and npm package match
- smoke tests pass after publishing
- `jira-flow@0.5.0` remains installable
- no old versions are unpublished
- migration docs are live

---

# 31. Post-v1 Backlog

Explicitly not part of v1:

```text
automatic moved-repo matching by remote
fiscal quarter support
Jira API
GitHub API
automatic PR creation
GitLab integration
Bitbucket integration
strict commit blocking
team policy bundles
arbitrary templates
filesystem-wide repo scanning
Homebrew as required channel
Chocolatey/Scoop/Winget
Docker
```

These must not delay `1.0.0`.

---

# 32. Recommended First Implementation Sequence

If one implementation agent is executing serially, use:

```text
1. VS0-1 through VS0-5
2. VS1-1 through VS1-12
3. E1 complete
4. E2 complete
5. E3 complete
6. E4 complete
7. E5 complete
8. E6 complete
9. E7 complete
10. E8 complete
11. E9 complete
12. E10 complete
13. E11 complete
14. E12 complete
15. E13 complete
16. E14 complete
17. alpha/beta/RC stabilization as gates require
```

Packaging SPIKE-01 should run in parallel as early as practical.

---

# 33. Agent Handoff Rule

An implementation agent should receive, in order:

```text
1. JiraFlow v1 Product Spec
2. JiraFlow v1 Technical / Implementation Architecture
3. JiraFlow v1 Implementation Roadmap & Backlog
```

The agent should treat:

- Product Spec = what must exist
- Technical Architecture = how the system is structured
- Roadmap = implementation order and proof obligations

If implementation uncovers a contradiction:

1. stop that task
2. document the contradiction
3. identify whether Product Spec or Architecture must change
4. make an explicit ADR/change
5. resume implementation

Do not silently invent a fourth architecture inside implementation code.

---

# 34. Suggested GitHub Milestones

Recommended:

```text
JiraFlow v1 — Vertical Slice
JiraFlow v1 — Core Engine
JiraFlow v1 — Alpha
JiraFlow v1 — Beta
JiraFlow v1 — RC
JiraFlow v1.0.0
```

---

# 35. Suggested Epics

Create one issue per epic:

```text
EPIC: v1 Architecture & Vertical Slice
EPIC: Domain Core
EPIC: Git Repository Adapter
EPIC: Repository Config & Worktree State
EPIC: Safe Git Hook Integration
EPIC: Commit Runtime
EPIC: Doctor & Repair
EPIC: Headless CLI
EPIC: SQLite Registry & Settings
EPIC: PR Title Generation
EPIC: OpenTUI Management UI
EPIC: Legacy v0.5 Migration
EPIC: Native Packaging
EPIC: CI & Release Automation
EPIC: v1 Docs & Hardening
```

Each task in this document can become a child issue or checklist item.

---

# 36. Highest-Risk Tasks

These should receive the strongest review/testing attention.

## P0-R1 — Hook composition

Risk:

Data loss / broken developer workflow.

Must be reviewed before merge.

## P0-R2 — Hook removal

Risk:

Deleting foreign user/company hook content.

Must prove exact ownership.

## P0-R3 — Worktree state isolation

Risk:

Wrong Jira issue applied to commits in another worktree.

## P0-R4 — Package launcher

Risk:

Package installs but runtime binary cannot be located reliably.

## P0-R5 — Legacy migration

Risk:

Misidentifying user hook as JiraFlow legacy hook.

## P0-R6 — Commit file rewrite

Risk:

Commit-message corruption/truncation.

---

# 37. Test Obligations by Risk Area

| Risk | Required proof |
|---|---|
| Hook overwrite | foreign hook fixture + byte-level preservation |
| Hook remove | managed block removed, foreign body unchanged |
| Worktree leak | two worktrees, two linked issues |
| Config drift | delete SQLite, commit still correct |
| Commit corruption | multiline/long message tests |
| Duplicate Jira key | amend/re-run test |
| Package failure | install/run/uninstall matrix |
| Legacy mis-detection | unknown hook refusal fixtures |
| `core.hooksPath` | relative, absolute, external tests |
| Nested repo path | init from subdirectory |
| Missing binary | git commit still succeeds |

---

# 38. Review Requirements

Require explicit reviewer attention for:

```text
area:hooks
area:migration
area:packaging
area:state
```

Suggested policy:

- ordinary feature: one reviewer
- hook/migration/package-state changes: one focused architecture/safety review
- release workflow: package/release smoke evidence attached

---

# 39. No-Scope-Creep Guardrails

During implementation, do not add:

- Jira login
- Jira issue fetch
- GitHub PR creation
- filesystem scanning
- generalized hook-manager abstractions beyond JiraFlow's need
- arbitrary template language
- plugin system
- daemon/background service
- telemetry requirement
- network-dependent commit behavior

Any such proposal goes into post-v1 backlog.

---

# 40. Final Roadmap Contract

JiraFlow v1 is considered successfully delivered when:

```text
install
   ↓
init safely
   ↓
commit silently
   ↓
derive/override Jira issue correctly
   ↓
preserve existing Git hooks
   ↓
manage repo state headlessly
   ↓
manage multiple repos in OpenTUI
   ↓
generate local PR title
   ↓
diagnose/repair with Doctor
   ↓
remove without damaging foreign hooks
   ↓
upgrade from legacy v0.5 safely
   ↓
ship as one reliable cross-platform executable
```

The implementation order exists to prove the dangerous parts first.

The roadmap should not optimize for visible UI progress.

It should optimize for:

```text
correctness
safety
recoverability
testability
cross-platform behavior
then polish
```

---

# 41. Immediate Next Action

Begin with:

```text
VS-0
```

Then complete the vertical slice before opening the full feature backlog.

The first implementation pull request should ideally establish:

```text
Bun + TypeScript
domain skeleton
GitRunner
temp Git repo test helper
CLI bootstrap
standalone binary smoke
```

The second should build toward the complete vertical slice rather than starting TUI feature work.
