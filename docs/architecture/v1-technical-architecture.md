# JiraFlow v1 Technical / Implementation Architecture

**Status:** Proposed implementation architecture  
**Derived from:** `JiraFlow_v1_Product_Spec.md`  
**Target release:** `1.0.0`  
**Implementation:** TypeScript + Bun + OpenTUI React  
**Repository:** existing `JaleelB/jira-flow` repository  
**Package:** existing `jira-flow` npm package  
**Architecture principle:** the headless engine owns behavior; CLI and OpenTUI are adapters over it.

---

## 1. Purpose of This Document

This document converts the JiraFlow v1 product specification into an implementation architecture.

It defines:

- TypeScript module boundaries
- dependency direction
- process/bootstrap behavior
- Git adapter design
- repository configuration storage
- worktree-local state storage
- Git hook ownership and composition
- SQLite architecture
- OpenTUI architecture
- CLI command routing
- error and exit-code model
- test architecture
- binary/package distribution
- CI and release architecture
- migration from Go `0.5.0` to TypeScript `1.0.0`

This document should be treated as the technical source of truth for implementation unless an explicit architecture decision changes it.

It does **not** redefine the v1 product.

---

# 2. Architecture Summary

JiraFlow v1 is one application with three external entry surfaces:

```text
                         jira-flow

              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
         Headless CLI     OpenTUI       Git commit-msg
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                    Application Use Cases
                             │
                  ┌──────────┴──────────┐
                  │                     │
                  ▼                     ▼
               Domain                 Ports
                                        │
                  ┌─────────────────────┼─────────────────────┐
                  ▼                     ▼                     ▼
              Git CLI              Git-local              SQLite
              adapter              state/config           registry
                  │
                  ▼
            Hook integration
```

The dependency rule is:

```text
UI / CLI / infrastructure
          ↓
     application
          ↓
        domain
```

The domain layer never imports:

- OpenTUI
- Commander
- `bun:sqlite`
- filesystem APIs
- process APIs
- Git execution code

The application layer depends on interfaces/ports, not concrete adapters.

---

# 3. Technology Decisions

## 3.1 Runtime and language

Use:

```text
TypeScript
Bun
```

Bun is the implementation/runtime toolchain because the product requires:

- TypeScript-first development
- OpenTUI native renderer compatibility
- `bun:sqlite`
- standalone executable compilation

The distributed JiraFlow binary should contain its runtime.

The source project is still tested as a normal TypeScript application during development.

---

## 3.2 TUI

Use:

```text
@opentui/core
@opentui/react
@opentui/keymap
```

The TUI uses React bindings.

Do **not** use a browser-style router.

JiraFlow has a finite terminal screen map, so navigation should be represented by a small typed state machine.

---

## 3.3 CLI parser

Use:

```text
commander
```

Commander is only a command-line adapter.

Command implementations must not live inside Commander callbacks.

Each callback:

1. validates/adapts CLI input
2. invokes an application use case
3. formats the result
4. maps known errors to process exit codes

---

## 3.4 SQLite

Use:

```text
bun:sqlite
```

Do not add:

- Prisma
- Drizzle
- TypeORM
- Sequelize
- another SQLite native module

The JiraFlow schema is small and explicit enough to manage directly.

SQL is owned by the SQLite adapter.

---

## 3.5 Testing

Use:

```text
bun test
```

Use actual temporary Git repositories for Git integration tests.

Do not mock Git behavior where the purpose of the test is to prove Git integration.

---

# 4. Repository Layout

JiraFlow v1 remains a single application repository, not a monorepo.

Recommended layout:

```text
jira-flow/
├── src/
│   ├── main.ts
│   ├── version.ts
│   │
│   ├── domain/
│   │   ├── issue-key.ts
│   │   ├── linking-mode.ts
│   │   ├── active-issue.ts
│   │   ├── commit-format.ts
│   │   ├── pr-title.ts
│   │   ├── repository.ts
│   │   ├── health.ts
│   │   ├── errors.ts
│   │   └── index.ts
│   │
│   ├── application/
│   │   ├── ports/
│   │   │   ├── git.port.ts
│   │   │   ├── repo-config.port.ts
│   │   │   ├── worktree-state.port.ts
│   │   │   ├── hooks.port.ts
│   │   │   ├── registry.port.ts
│   │   │   ├── settings.port.ts
│   │   │   ├── issue-metadata.port.ts
│   │   │   ├── clipboard.port.ts
│   │   │   ├── clock.port.ts
│   │   │   └── filesystem.port.ts
│   │   │
│   │   ├── use-cases/
│   │   │   ├── initialize-repository.ts
│   │   │   ├── get-repository-status.ts
│   │   │   ├── link-issue.ts
│   │   │   ├── unlink-issue.ts
│   │   │   ├── change-mode.ts
│   │   │   ├── set-enabled.ts
│   │   │   ├── remove-repository.ts
│   │   │   ├── run-doctor.ts
│   │   │   ├── repair-repository.ts
│   │   │   ├── process-commit-message.ts
│   │   │   ├── generate-pr-title.ts
│   │   │   ├── list-repositories.ts
│   │   │   ├── locate-repository.ts
│   │   │   ├── get-config.ts
│   │   │   ├── set-config.ts
│   │   │   └── get-startup-context.ts
│   │   │
│   │   ├── services/
│   │   │   ├── active-issue-resolver.ts
│   │   │   ├── effective-config.ts
│   │   │   ├── repository-reconciler.ts
│   │   │   └── doctor-service.ts
│   │   │
│   │   └── models/
│   │       ├── status-view.ts
│   │       ├── doctor-result.ts
│   │       ├── repository-summary.ts
│   │       └── startup-context.ts
│   │
│   ├── infrastructure/
│   │   ├── git/
│   │   │   ├── git-runner.ts
│   │   │   ├── git-adapter.ts
│   │   │   ├── git-config-store.ts
│   │   │   └── repository-discovery.ts
│   │   │
│   │   ├── hooks/
│   │   │   ├── hook-manager.ts
│   │   │   ├── hook-analyzer.ts
│   │   │   ├── hook-script.ts
│   │   │   ├── hook-markers.ts
│   │   │   └── integration-metadata.ts
│   │   │
│   │   ├── state/
│   │   │   ├── worktree-state-store.ts
│   │   │   └── atomic-json-file.ts
│   │   │
│   │   ├── sqlite/
│   │   │   ├── database.ts
│   │   │   ├── migrations.ts
│   │   │   ├── repository-registry.ts
│   │   │   ├── repository-cache.ts
│   │   │   ├── issue-metadata.ts
│   │   │   └── settings.ts
│   │   │
│   │   ├── clipboard/
│   │   │   └── system-clipboard.ts
│   │   │
│   │   ├── platform/
│   │   │   ├── app-paths.ts
│   │   │   └── executable-path.ts
│   │   │
│   │   └── filesystem/
│   │       └── system-filesystem.ts
│   │
│   ├── cli/
│   │   ├── build-program.ts
│   │   ├── command-context.ts
│   │   ├── output/
│   │   │   ├── human.ts
│   │   │   ├── json.ts
│   │   │   └── errors.ts
│   │   └── commands/
│   │       ├── init.ts
│   │       ├── status.ts
│   │       ├── link.ts
│   │       ├── unlink.ts
│   │       ├── mode.ts
│   │       ├── enable.ts
│   │       ├── disable.ts
│   │       ├── remove.ts
│   │       ├── doctor.ts
│   │       ├── pr-title.ts
│   │       ├── repositories.ts
│   │       ├── config.ts
│   │       └── hook.ts
│   │
│   ├── tui/
│   │   ├── run-tui.tsx
│   │   ├── app.tsx
│   │   ├── app-context.tsx
│   │   ├── navigation/
│   │   │   ├── route.ts
│   │   │   ├── reducer.ts
│   │   │   └── keymap.ts
│   │   ├── screens/
│   │   │   ├── empty-state.tsx
│   │   │   ├── unconfigured-repo.tsx
│   │   │   ├── global-dashboard.tsx
│   │   │   ├── repository-overview.tsx
│   │   │   ├── setup.tsx
│   │   │   ├── setup-customization.tsx
│   │   │   ├── link-issue.tsx
│   │   │   ├── mode-selection.tsx
│   │   │   ├── workflow-settings.tsx
│   │   │   ├── pr-title.tsx
│   │   │   ├── doctor.tsx
│   │   │   ├── global-settings.tsx
│   │   │   ├── missing-repository.tsx
│   │   │   └── remove-confirmation.tsx
│   │   ├── components/
│   │   │   ├── action-list.tsx
│   │   │   ├── status-row.tsx
│   │   │   ├── repository-table.tsx
│   │   │   ├── field.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── footer-keys.tsx
│   │   └── hooks/
│   │       ├── use-async-action.ts
│   │       ├── use-screen-data.ts
│   │       └── use-route-keys.ts
│   │
│   └── bootstrap/
│       ├── container.ts
│       ├── cli-container.ts
│       ├── tui-container.ts
│       └── hook-container.ts
│
├── tests/
│   ├── unit/
│   ├── integration/
│   │   ├── git/
│   │   ├── hooks/
│   │   ├── config/
│   │   ├── sqlite/
│   │   └── cli/
│   ├── e2e/
│   ├── fixtures/
│   └── helpers/
│       ├── temp-repository.ts
│       ├── git-environment.ts
│       └── run-jiraflow.ts
│
├── scripts/
│   ├── build.ts
│   ├── package-release.ts
│   └── verify-release.ts
│
├── migrations/
│   ├── 001-initial.sql
│   └── ...
│
├── package.json
├── bun.lock
├── tsconfig.json
├── CHANGELOG.md
├── README.md
└── LICENSE
```

---

# 5. Domain Layer

The domain contains pure behavior.

No process execution.

No database.

No filesystem.

No TUI.

## 5.1 Core domain types

```ts
export type LinkingMode = "hybrid" | "branch" | "manual"

export type CommitFormat = "footer" | "suffix" | "prefix" | "scope"

export type ActiveIssueSource = "branch" | "override" | "manual"

export interface ActiveIssue {
  key: string
  source: ActiveIssueSource
}
```

Prefer branded/value-object style validation for Jira keys:

```ts
export type JiraKey = string & {
  readonly __brand: "JiraKey"
}
```

Creation happens only through:

```ts
parseJiraKey(input, pattern)
```

Callers should not construct validated Jira keys by casting arbitrary strings.

---

## 5.2 Active issue resolution

Pure function:

```ts
resolveActiveIssue({
  enabled,
  mode,
  linkedIssue,
  branchIssue
}): ActiveIssue | null
```

This function owns the exact product precedence rules.

It is heavily unit tested.

Neither the CLI nor TUI reimplements this logic.

---

## 5.3 Commit formatting

Pure API:

```ts
applyIssueReference({
  message,
  issue,
  format
}): CommitMutationResult
```

Result:

```ts
type CommitMutationResult =
  | {
      changed: false
      message: string
      reason: "already-present" | "no-change"
    }
  | {
      changed: true
      message: string
    }
```

Formatting logic is separate from file I/O.

---

## 5.4 PR title rendering

Pure API:

```ts
renderPrTitle({
  template,
  variables
}): string
```

The domain renderer only knows the six v1 variables:

```text
jiraKey
storyTitle
branch
repo
date
quarter
```

Unknown tokens produce a validation error.

There is no expression evaluator.

---

# 6. Application Layer

The application layer coordinates domain logic and infrastructure ports.

Each externally meaningful action is a use case.

Examples:

```ts
initializeRepository(input)
linkIssue(input)
unlinkIssue(input)
changeMode(input)
getRepositoryStatus(input)
processCommitMessage(input)
generatePrTitle(input)
runDoctor(input)
removeRepository(input)
```

The CLI and TUI call the same use cases.

---

# 7. Port Interfaces

Keep ports small.

Do not create one giant `PlatformService`.

## 7.1 Git port

Conceptual interface:

```ts
export interface GitPort {
  discoverRepository(path: string): Promise<GitRepositoryContext | null>
  getCurrentBranch(repo: GitRepositoryContext): Promise<string | null>
  getRemoteUrl(repo: GitRepositoryContext): Promise<string | null>
  resolveHooks(repo: GitRepositoryContext): Promise<HooksContext>
}
```

---

## 7.2 Repo configuration port

```ts
export interface RepoConfigPort {
  read(repo: GitRepositoryContext): Promise<RepoConfig>
  setEnabled(repo: GitRepositoryContext, value: boolean): Promise<void>
  setMode(repo: GitRepositoryContext, mode: LinkingMode): Promise<void>
  setIssuePattern(repo: GitRepositoryContext, pattern: string | null): Promise<void>
  setCommitFormat(repo: GitRepositoryContext, format: CommitFormat | null): Promise<void>
  setPrTitleTemplate(repo: GitRepositoryContext, value: string | null): Promise<void>
  setDateFormat(repo: GitRepositoryContext, value: string | null): Promise<void>
  removeAll(repo: GitRepositoryContext): Promise<void>
}
```

---

## 7.3 Worktree state port

```ts
export interface WorktreeStatePort {
  read(repo: GitRepositoryContext): Promise<WorktreeState>
  setLinkedIssue(repo: GitRepositoryContext, issue: JiraKey | null): Promise<void>
  clear(repo: GitRepositoryContext): Promise<void>
}
```

---

## 7.4 Hook manager port

```ts
export interface HookManagerPort {
  inspect(repo: GitRepositoryContext): Promise<HookInspection>
  install(repo: GitRepositoryContext, options: HookInstallOptions): Promise<HookInstallResult>
  repair(repo: GitRepositoryContext): Promise<HookRepairResult>
  remove(repo: GitRepositoryContext): Promise<HookRemoveResult>
}
```

---

## 7.5 Registry port

```ts
export interface RegistryPort {
  register(repo: RegisteredRepositoryInput): Promise<RegisteredRepository>
  updatePath(id: string, path: string): Promise<void>
  touchSeen(id: string): Promise<void>
  remove(id: string): Promise<void>
  list(): Promise<Array<RegisteredRepository>>
  findByPath(path: string): Promise<RegisteredRepository | null>
}
```

---

# 8. Git Adapter Architecture

Git is the authority for Git repository structure.

JiraFlow must not reconstruct Git internals from `.git` assumptions.

Use the installed `git` executable.

## 8.1 Process wrapper

All Git execution passes through:

```text
GitRunner
```

Conceptual API:

```ts
runGit({
  cwd,
  args,
  stdin?
}): Promise<GitCommandResult>
```

The adapter captures:

- stdout
- stderr
- exit code
- execution failure

Errors include Git output.

Never reproduce the Go v0.x behavior where useful Git error output is discarded.

---

## 8.2 Repository discovery

Starting from an arbitrary path:

```text
git -C <path> rev-parse --is-inside-work-tree
git -C <path> rev-parse --path-format=absolute --show-toplevel
git -C <path> rev-parse --path-format=absolute --git-dir
git -C <path> rev-parse --path-format=absolute --git-common-dir
```

The resulting model:

```ts
export interface GitRepositoryContext {
  root: string
  gitDir: string
  commonGitDir: string
  isLinkedWorktree: boolean
}
```

Bare repositories are out of scope for v1 and should be rejected as unsupported.

---

## 8.3 Branch detection

Use:

```text
git symbolic-ref --quiet --short HEAD
```

If it exits non-zero because HEAD is detached:

```text
branch = null
```

Detached HEAD is a valid no-active-branch state.

It is not a JiraFlow error.

---

## 8.4 Effective hooks directory

Do **not** assume:

```text
.git/hooks
```

Resolution algorithm:

```text
1. read core.hooksPath with Git
2. if core.hooksPath is absent:
       use git rev-parse --path-format=absolute --git-path hooks
3. if core.hooksPath is absolute:
       use that value
4. if core.hooksPath is relative:
       resolve it according to Git's hook execution context
       for supported non-bare repositories, this is the worktree root
5. canonicalize the resulting path
```

The adapter also records where `core.hooksPath` came from when possible:

```text
local
global
system
command
unknown
```

This matters for hook safety.

---

# 9. Repository State Architecture

There are **three different state categories**.

They must not be collapsed together.

```text
repo workflow configuration
worktree operational state
global management data
```

---

# 10. Repository-Wide Workflow Configuration

Repo-wide JiraFlow configuration uses:

```text
git config --local
```

These settings are shared across the repository.

Logical keys:

```text
jiraflow.enabled
jiraflow.mode
jiraflow.issuePattern
jiraflow.commitFormat
jiraflow.prTitleTemplate
jiraflow.dateFormat
```

Examples:

```bash
git config --local --type=bool jiraflow.enabled true
git config --local jiraflow.mode hybrid
git config --local jiraflow.commitFormat footer
```

Read booleans using Git's type conversion rather than custom string parsing.

---

# 11. Worktree-Local Linked Issue State

The product spec models `linkedIssue` as repository-local state.

The implementation should **not** store this specific value in shared `.git/config`.

Reason:

```text
repo
├── worktree A -> feat/ABC-123
└── worktree B -> fix/OPS-992
```

A Hybrid or Manual link in worktree A must not unexpectedly override worktree B.

Git's normal repository config is shared by linked worktrees unless the worktree-config extension is enabled.

JiraFlow should not turn on `extensions.worktreeConfig` merely for itself because that changes repository-level Git behavior and has compatibility implications.

Therefore:

> durable workflow configuration uses Git config; dynamic linked-issue state uses a JiraFlow file inside the effective worktree Git directory.

Resolve the path through Git:

```text
git rev-parse --path-format=absolute --git-path jiraflow/state.json
```

Never manually build `.git/worktrees/...`.

State schema:

```json
{
  "schemaVersion": 1,
  "linkedIssue": "ABC-123",
  "updatedAt": "2026-08-13T13:00:00.000Z"
}
```

If no issue is linked:

```json
{
  "schemaVersion": 1,
  "linkedIssue": null,
  "updatedAt": "2026-08-13T13:00:00.000Z"
}
```

This file is authoritative for linked issue state.

SQLite does not participate.

Writes are atomic:

```text
write temp file
fsync/close where practical
rename temp -> state.json
```

---

# 12. Effective Configuration

The application computes:

```text
one-shot command option
        ↓
repo-local Git config override
        ↓
global SQLite setting
        ↓
built-in default
```

Do not copy every global default into each repo.

Example effective config:

```ts
export interface EffectiveWorkflowConfig {
  enabled: boolean
  mode: LinkingMode
  issuePattern: string
  commitFormat: CommitFormat
  prTitleTemplate: string
  dateFormat: string
}
```

The commit hook only needs:

- repo-local config
- built-in fallback values
- worktree state

It must **not** require SQLite to commit.

That is an intentional reliability boundary.

---

# 13. Hook Architecture

This is the highest-risk subsystem.

The v1 rule is:

> JiraFlow may manage its own code, but it may not claim ownership of arbitrary user hook files.

---

# 14. Hook Runtime

JiraFlow uses exactly one Git hook:

```text
commit-msg
```

The hook eventually invokes:

```bash
jira-flow hook commit-msg "$1"
```

No `post-checkout`.

The internal command:

1. discovers the current repository
2. loads repo-local JiraFlow config
3. exits `0` immediately if JiraFlow is not configured or disabled
4. loads worktree linked-issue state
5. derives current branch if required
6. resolves active issue
7. no active issue -> exits `0`
8. reads commit message
9. applies idempotent mutation
10. atomically writes only when changed
11. exits `0`

The hook path does **not**:

- open SQLite
- initialize OpenTUI
- scan the global registry
- perform network I/O
- fetch Jira data
- fetch GitHub data

---

# 15. Hook Invocation Shim

Generated shell call should be resilient to package upgrades/uninstalls.

Concept:

```sh
# >>> jiraflow managed block v1
JIRAFLOW_BIN="/absolute/path/captured/at/init"

if [ -x "$JIRAFLOW_BIN" ]; then
  "$JIRAFLOW_BIN" hook commit-msg "$1" || exit $?
elif command -v jira-flow >/dev/null 2>&1; then
  jira-flow hook commit-msg "$1" || exit $?
fi
# <<< jiraflow managed block v1
```

Requirements:

- correctly shell-escape captured executable path
- use `/`-compatible paths when generating hooks for Git for Windows
- missing JiraFlow executable becomes a no-op, not a broken Git repository
- absolute path is preferred for GUI/IDE Git environments with incomplete PATH
- PATH fallback allows recovery after a moved/upgraded installation

The exact generated block gets a version and ownership marker.

---

# 16. Hook Composition Strategies

The hook manager has four explicit states.

## 16.1 Strategy A — owned hook file

Condition:

```text
commit-msg does not exist
```

JiraFlow creates the file.

The file contains only:

- shell shebang
- JiraFlow managed block

Integration metadata records:

```text
strategy = owned
```

Removal may delete the file **only if** it still matches JiraFlow's owned structure.

If the user later modifies it, removal must reclassify rather than delete blindly.

---

## 16.2 Strategy B — existing JiraFlow-managed block

Condition:

```text
commit-msg exists
and contains JiraFlow's valid managed markers
```

Do not add another block.

Update integration metadata.

Initialization remains idempotent.

---

## 16.3 Strategy C — composable existing shell hook

Condition:

- existing file is text
- has a supported shell shebang
- does not already contain JiraFlow
- JiraFlow can identify a safe insertion point

Supported v1 interpreters should be intentionally narrow:

```text
sh
bash
zsh
dash
```

JiraFlow does **not** silently mutate the file.

Interactive setup shows:

```text
An existing commit-msg hook was detected.

JiraFlow can add a managed block while preserving the
existing hook.

> Add JiraFlow integration
  View hook
  Cancel
```

`jira-flow init --yes` must **not** treat this as implicitly approved.

Before modification:

1. read original bytes
2. compute SHA-256
3. save backup under JiraFlow Git-dir metadata
4. create modified bytes in memory
5. write atomically
6. verify markers and executable state

The JiraFlow block is inserted immediately after the shebang / leading interpreter metadata, before the existing functional body.

This lets later validators inspect the JiraFlow-mutated commit message.

Removal deletes only the exact marked JiraFlow block.

It does not restore a historical entire-file backup over newer user changes.

The backup exists for recovery/Doctor, not as the normal uninstall operation.

---

## 16.4 Strategy D — unsupported or unsafe existing hook

Examples:

- binary executable
- unknown interpreter
- malformed script
- JiraFlow markers have been manually damaged
- path permissions prevent safe atomic modification
- shared hook environment where scope cannot be established safely

Behavior:

```text
refuse automatic integration
```

Do not guess.

Do not overwrite.

Doctor reports the reason and provides a manual integration command when appropriate.

---

# 17. Shared / External `core.hooksPath`

A `core.hooksPath` outside the repository may be shared by many repositories.

Examples include:

- user-global Git hook directories
- company-managed hooks
- hook-manager-controlled directories

JiraFlow must treat this as higher risk.

Classification uses:

- resolved hook directory
- repository root/common Git dir
- Git config origin when available

Rules:

1. never silently modify a shared/external hooks directory
2. `--yes` never authorizes shared-hook mutation
3. interactive setup must explicitly explain the scope
4. if JiraFlow is already present in the shared hook, reuse it
5. if a supported text hook can be composed, require explicit confirmation
6. if safe composition cannot be proven, refuse
7. JiraFlow's runtime command must no-op in repositories without JiraFlow config, so a shared generic JiraFlow block is harmless outside configured repos

A shared JiraFlow block may intentionally remain after removing JiraFlow from one repository because deleting shared infrastructure could affect other repositories.

Repository removal still removes that repository's configuration/state.

Doctor should explain:

```text
Shared JiraFlow hook integration retained.

The hook directory is shared by multiple Git repositories.
The block is a no-op in repositories that are not configured
for JiraFlow.
```

This is safer than pretending a repo-local remove operation owns a global hook.

---

# 18. Hook Integration Metadata

Store JiraFlow hook metadata under the Git-resolved JiraFlow directory.

Conceptual path:

```text
git rev-parse --git-path jiraflow/integration.json
```

Schema:

```json
{
  "schemaVersion": 1,
  "hook": "commit-msg",
  "strategy": "owned",
  "hookPath": "/path/to/hooks/commit-msg",
  "blockVersion": 1,
  "blockId": "jiraflow-v1",
  "capturedBinaryPath": "/path/to/jira-flow",
  "installedAt": "2026-08-13T13:00:00.000Z",
  "lastVerifiedAt": "2026-08-13T13:00:00.000Z"
}
```

For composed hooks, also store:

```json
{
  "originalSha256": "...",
  "backupPath": "..."
}
```

Metadata is evidence.

It is not enough by itself to authorize deletion.

Removal always verifies the actual hook file.

---

# 19. Initialization Transaction

`initializeRepository` should be implemented as an explicit multi-step transaction with compensating rollback.

Conceptual flow:

```text
discover repository
    ↓
read existing config
    ↓
inspect hook
    ↓
determine install strategy
    ↓
prepare hook change
    ↓
write repo config
    ↓
write worktree JiraFlow state
    ↓
apply hook change
    ↓
register SQLite entry
    ↓
run verification
```

If a failure occurs after mutation:

- rollback only JiraFlow changes that were made by this operation
- never replace a foreign hook wholesale
- leave backups intact
- return a clear partial-failure report if full rollback is impossible

SQLite registration is last because it is not required for core commit behavior.

A registry failure should not destroy a correctly configured repository.

Instead:

```text
Repository initialized.
Warning: global dashboard registration failed.
Run `jira-flow doctor` to repair the registry.
```

---

# 20. SQLite Architecture

SQLite is opened only by commands/TUI that need global data.

The commit hook fast path does not open it.

---

# 21. Application Data Location

Use platform conventions.

## macOS

```text
~/Library/Application Support/JiraFlow/jira-flow.db
```

## Windows

```text
%LOCALAPPDATA%\JiraFlow\jira-flow.db
```

## Linux

```text
$XDG_DATA_HOME/jira-flow/jira-flow.db
```

Fallback:

```text
~/.local/share/jira-flow/jira-flow.db
```

Create directories lazily.

Do not create the database merely for `jira-flow --version`.

---

# 22. SQLite Connection Configuration

On open:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
```

The adapter owns connection setup.

Use explicit transactions for migrations and multi-table mutations.

---

# 23. SQLite Schema

Use the logical schema from the product spec.

Tables:

```text
repositories
repository_cache
issue_metadata
settings
schema_migrations
```

Recommended additional migration table:

```sql
CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
);
```

Migrations are numbered and checked into:

```text
/migrations
```

Example:

```text
001-initial.sql
002-add-repository-identity.sql
```

---

# 24. SQLite Repository Rules

## `repositories`

Authoritative only for:

- dashboard registration
- last known path
- display metadata

Not authoritative for JiraFlow runtime config.

## `repository_cache`

Disposable.

It may always be rebuilt.

## `issue_metadata`

Convenience only.

PR-title generation uses it for local story titles.

## `settings`

Authoritative for JiraFlow **global defaults/preferences**, not repository overrides.

---

# 25. Repository Identity

Generate JiraFlow registry ID as a UUID at registration.

Do not use path as the primary key.

Path changes.

Initial identity model:

```text
id = JiraFlow-generated UUID
path = current local path
remote_url = optional identity hint
```

Automatic moved-repo matching by remote remains deferred.

---

# 26. OpenTUI Architecture

OpenTUI is a presentation adapter.

It never reaches directly into Git config, SQLite, or hook files.

---

# 27. TUI Composition

Root:

```tsx
<App services={services} initialContext={startupContext} />
```

The TUI receives a constrained application-facing service facade.

Example:

```ts
export interface TuiServices {
  getStartupContext(): Promise<StartupContext>
  getRepositoryStatus(path: string): Promise<RepositoryStatusView>
  listRepositories(): Promise<Array<RepositorySummary>>
  initializeRepository(input: InitializeRepositoryInput): Promise<...>
  linkIssue(input: LinkIssueInput): Promise<...>
  unlinkIssue(input: UnlinkIssueInput): Promise<...>
  changeMode(input: ChangeModeInput): Promise<...>
  generatePrTitle(input: GeneratePrTitleInput): Promise<...>
  runDoctor(input: DoctorInput): Promise<...>
  ...
}
```

It may be a thin facade over use-case functions.

---

# 28. TUI Navigation

Represent routes as a discriminated union.

Example:

```ts
export type TuiRoute =
  | { name: "empty-state" }
  | { name: "unconfigured-repo"; repoPath: string }
  | { name: "global-dashboard" }
  | { name: "repository-overview"; repoId: string }
  | { name: "setup"; repoPath: string }
  | { name: "setup-customization"; repoPath: string }
  | { name: "link-issue"; repoId: string }
  | { name: "mode-selection"; repoId: string }
  | { name: "workflow-settings"; repoId: string }
  | { name: "pr-title"; repoId: string }
  | { name: "doctor"; repoId?: string }
  | { name: "global-settings" }
  | { name: "missing-repository"; repoId: string }
  | { name: "remove-confirmation"; repoId: string }
```

Navigation state:

```ts
interface NavigationState {
  current: TuiRoute
  history: Array<TuiRoute>
}
```

Use a reducer.

Do not introduce React Router or a web-routing abstraction.

---

# 29. TUI Data Loading

Each screen loads a view model from the application layer.

Do not keep a second authoritative copy of repository state in React.

Mutation flow:

```text
user action
   ↓
application use case
   ↓
adapter mutation
   ↓
use case returns result
   ↓
screen reloads/reconciles its view model
```

SQLite cache and Git-local config remain outside React state ownership.

---

# 30. TUI State Management

Do not add Redux/Zustand in v1.

Use:

- React context for service injection
- navigation reducer
- local component state for forms/selections
- small reusable hooks for async use-case state

Examples:

```text
useAsyncAction
useScreenData
useRouteKeys
```

If later complexity proves this insufficient, state management can be revisited.

Do not preemptively build a client-side application architecture for a small terminal tool.

---

# 31. OpenTUI Key Handling

Use OpenTUI's keymap model.

Bindings exist at two levels:

## Global

```text
Esc
Q
?
```

## Screen-specific

Examples:

```text
L -> Link
P -> PR title
D -> Doctor
G -> Global Dashboard
```

Selectable visible actions remain primary.

Shortcuts are accelerators, not hidden functionality.

---

# 32. TUI Startup

The root `jira-flow` command dynamically imports OpenTUI only when the TUI is actually needed.

Conceptual:

```ts
if (argvHasHeadlessCommand(process.argv)) {
  return runCli()
}

const { runTui } = await import("./tui/run-tui")
return runTui()
```

The internal hook command must never initialize OpenTUI modules.

---

# 33. Bootstrap / Dependency Injection

Use manual dependency injection.

No DI container library.

Composition root:

```text
bootstrap/container.ts
```

Constructs:

```text
GitRunner
GitAdapter
GitConfigStore
WorktreeStateStore
HookManager
SQLiteDatabase
RegistryRepository
SettingsRepository
IssueMetadataRepository
ClipboardAdapter
Clock
application use cases
```

Separate bootstrap paths:

```text
cli-container
tui-container
hook-container
```

The hook container intentionally excludes:

```text
SQLite
OpenTUI
clipboard
global registry
```

---

# 34. CLI Architecture

`src/main.ts` is minimal.

Responsibilities:

1. handle process-level crash boundary
2. build command router or TUI
3. map final exit code

Commander command files only adapt arguments.

Example:

```ts
command
  .name("link")
  .argument("<issue-key>")
  .option("--title <story-title>")
  .action(async (issueKey, options) => {
    const result = await services.linkIssue({
      cwd: process.cwd(),
      issueKey,
      storyTitle: options.title
    })

    printHuman(result)
  })
```

The callback does not:

- run `git`
- edit config
- write files
- resolve linking modes
- touch SQLite directly

---

# 35. Human and JSON Output

Command result models are separate from formatters.

Example:

```ts
RepositoryStatusView
DoctorResult
RepositoryListView
```

Then:

```text
human formatter
json formatter
```

`--json` output should be stable enough for scripts.

Do not print colored decoration in JSON mode.

Errors in JSON mode use structured JSON on stderr or a documented error envelope.

---

# 36. Error Model

Use typed application errors.

Base:

```ts
abstract class JiraFlowError extends Error {
  abstract code: string
  abstract exitCode: number
}
```

Examples:

```text
NOT_A_GIT_REPOSITORY
REPOSITORY_NOT_CONFIGURED
INVALID_JIRA_KEY
INVALID_ISSUE_PATTERN
LINK_UNAVAILABLE_IN_BRANCH_MODE
HOOK_CONFLICT
HOOK_UNSAFE_TO_MODIFY
HOOK_PERMISSION_DENIED
DATABASE_UNAVAILABLE
CONFIG_INVALID
UNSUPPORTED_PLATFORM
```

Do not use string matching to determine error behavior.

---

# 37. Process Exit Codes

Recommended stable mapping:

```text
0   success
1   unexpected/general error
2   usage / invalid command input
3   repository context/config error
4   hook integration conflict/safety refusal
5   storage/database error
```

The internal `commit-msg` hook is special:

```text
no active issue             -> 0
unconfigured repo           -> 0
disabled JiraFlow           -> 0
already-referenced message  -> 0
```

Hook should return non-zero only when JiraFlow has entered a state where silently continuing would risk an incorrect/destructive commit mutation.

---

# 38. Commit File I/O

Do not use a scanner.

Use whole-file reads for commit messages.

Algorithm:

```text
read complete file
    ↓
compute new message in memory
    ↓
if unchanged -> return
    ↓
write temporary file in same directory
    ↓
replace original atomically where supported
```

Preserve:

- line endings where practical
- trailing newline semantics
- Git comment/template content

The formatter modifies only the intended message representation.

---

# 39. PR Title Architecture

`generatePrTitle` coordinates:

```text
repo config
active issue
current branch
repo name
clock
SQLite issue metadata
global/repo template
clipboard
```

Resolution:

```text
jiraKey     -> active issue
storyTitle  -> one-shot option -> SQLite cache -> prompt required
branch      -> Git
repo        -> repository display name
date        -> Clock + configured format
quarter     -> calendar quarter
```

The use case returns:

```ts
interface GeneratedPrTitle {
  value: string
  variables: Record<string, string>
  copied: boolean
}
```

Clipboard failure does not fail title generation.

Output:

```text
title generated successfully
warning: clipboard unavailable
```

---

# 40. Clipboard Adapter

Platform behavior:

## macOS

Prefer:

```text
pbcopy
```

## Windows

Prefer:

```text
clip.exe
```

## Linux

Try supported available commands such as:

```text
wl-copy
xclip
```

Clipboard is optional.

If none is available:

- print title
- return a warning
- do not fail `pr-title`

---

# 41. Doctor Architecture

Doctor is implemented as independent checks.

Conceptual interface:

```ts
interface DoctorCheck {
  id: string
  run(context): Promise<DoctorCheckResult>
}
```

Result states:

```text
pass
warning
fail
```

Checks:

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
database.available       # global doctor
database.schema          # global doctor
registry.paths           # global doctor
```

Repair actions are separate from checks.

Doctor must not mutate during plain:

```bash
jira-flow doctor
```

Only:

```bash
jira-flow doctor --repair
```

may execute repair use cases.

---

# 42. Test Architecture

Tests are divided by what they prove.

---

## 42.1 Domain unit tests

Fast, pure, exhaustive.

Required suites:

### Jira key

- strict validation
- branch extraction
- custom regex validation
- invalid regex
- multiple key matches
- no match

### Active issue

Complete truth table:

```text
enabled/disabled
hybrid/branch/manual
linked/no-linked
branch/no-branch
```

### Commit formatting

All formats:

```text
footer
suffix
prefix
scope
```

Cases:

- already present
- conventional commit
- multiline message
- empty body
- comments/template text
- unusual line endings
- unsafe scope conversion

### PR title

- all variables
- unknown variable
- missing variable
- literal text
- repeated variable

---

## 42.2 Application tests

Use fake ports.

Prove orchestration:

- initialize rollback
- registry failure after successful repo config
- Hybrid linking semantics
- Manual linking semantics
- Branch-mode link rejection
- disable/enable preserves mode/state
- remove authorization behavior
- Doctor repair routing
- PR-title metadata precedence

These tests do not attempt to prove Git itself.

---

## 42.3 Git integration tests

Use real temporary Git repositories.

Helper:

```ts
const repo = await createTempGitRepository()
```

It configures:

```text
user.name
user.email
```

and never uses the JiraFlow development repo's own `.git`.

Required:

- init from repo root
- init from nested subdirectory
- main branch
- develop branch
- ticket branch
- non-ticket branch
- detached HEAD
- linked worktree
- custom local `core.hooksPath`
- external/shared `core.hooksPath`
- paths containing spaces
- non-existent Git
- invalid repo path

Use temporary `GIT_CONFIG_GLOBAL` in tests so no test touches the developer's real global Git config.

---

## 42.4 Hook integration matrix

Mandatory cases:

```text
no existing commit-msg
existing JiraFlow-owned hook
existing JiraFlow-composed shell hook
existing shell hook with set -e
existing hook that exits early
existing unsupported interpreter
existing binary hook
existing malformed markers
non-executable hook
read-only hook path
shared hooks path
missing JiraFlow binary after installation
```

Verify:

- init idempotency
- no duplicate managed block
- original hook logic still executes
- JiraFlow runs before existing validator body
- remove strips only JiraFlow block
- foreign hook remains byte-equivalent except removed JiraFlow block
- package uninstall/missing executable does not block commit

---

## 42.5 Commit end-to-end tests

Use actual:

```bash
git commit
```

not direct calls to the formatter.

Required flows:

### Hybrid branch

```text
feat/ABC-123-login
-> commit
-> ABC-123 reference
```

### Hybrid override

```text
branch ABC-123
link OPS-992
-> commit contains OPS-992
unlink
-> next commit contains ABC-123
```

### Manual

```text
manual
link ABC-123
-> commit uses ABC-123
```

### No issue

```text
chore/update-deps
-> commit unchanged
-> succeeds
```

### Disable

```text
disabled
-> commit unchanged
```

### Idempotency

Amend/re-run hook does not duplicate key.

---

# 43. Worktree Tests

Worktree behavior is a release requirement.

Scenario:

```text
repo/main        -> feat/ABC-123
repo/hotfix      -> fix/OPS-992
```

Hybrid manual overrides:

```text
main worktree linked -> MAN-100
hotfix linked         -> HOT-200
```

Verify each worktree resolves its own linked issue.

Repo-wide settings such as commit format remain shared.

This proves the config/state split is correct.

---

# 44. SQLite Tests

Run against temporary databases.

Required:

- clean database bootstrap
- each migration
- migrate from every previous schema fixture
- foreign keys
- repository delete cascade
- settings read/write
- issue title cache
- stale repository records
- concurrent/read contention behavior
- database deletion does not break commit hook tests

---

# 45. CLI Tests

Run the real command layer.

Validate:

```text
--help outside repo
--version outside repo
status human
status --json
link
unlink
mode
enable
disable
doctor
doctor --json
pr-title --no-copy
repositories
config
invalid options
missing repo
```

JSON tests assert schema.

Human-output tests should focus on meaningful content rather than brittle full snapshots.

---

# 46. TUI Tests

Do not attempt to prove business logic through rendered terminal snapshots.

Test:

- startup route reducer
- navigation reducer
- screen action availability
- form validation
- screen view-model transformations
- keyboard mapping
- async error states

Then add a smaller renderer smoke suite:

- app starts
- each major screen can render
- basic keyboard navigation does not crash

At least one packaged-binary TUI smoke test should run on each supported OS before release.

---

# 47. CI Architecture

Recommended workflows:

```text
.github/workflows/
├── ci.yml
├── integration.yml
├── package-smoke.yml
├── release-please.yml
└── release.yml
```

---

## 47.1 `ci.yml`

On pull request and main push:

```text
bun install --frozen-lockfile
typecheck
lint
unit tests
application tests
SQLite tests
```

No release side effects.

---

## 47.2 `integration.yml`

Matrix:

```text
ubuntu
macOS
Windows
```

Runs:

- real Git integration
- hook matrix
- CLI integration
- worktree tests where supported
- path-with-spaces tests

---

## 47.3 `package-smoke.yml`

Build actual standalone executable(s).

Run:

```text
jira-flow --version
jira-flow --help
temp repo init
real commit
doctor
```

The release is not considered valid merely because source tests pass.

---

# 48. Build Architecture

Canonical source entry:

```text
src/main.ts
```

Build with Bun standalone executable compilation.

Build injects:

```text
version
Git commit SHA
build date
```

Example conceptual constants:

```ts
declare const __JIRAFLOW_VERSION__: string
declare const __JIRAFLOW_COMMIT__: string
declare const __JIRAFLOW_BUILD_DATE__: string
```

`jira-flow --version` reads these values.

It does not read `package.json` at runtime.

---

# 49. Native Build Targets

v1 required artifacts:

```text
darwin-arm64
darwin-x64
linux-x64
windows-x64
```

Desired if validated:

```text
linux-arm64
windows-arm64
```

Because OpenTUI includes native renderer components, the release pipeline must validate packaged executables on their target OS.

Do not assume cross-compilation success is equivalent to runtime validation.

Prefer target-native CI runners for release smoke tests even if Bun performs cross-compilation.

---

# 50. Release Artifact Contract

Use one application binary.

Suggested GitHub release names:

```text
jira-flow-v1.0.0-darwin-arm64.tar.gz
jira-flow-v1.0.0-darwin-x64.tar.gz
jira-flow-v1.0.0-linux-x64.tar.gz
jira-flow-v1.0.0-windows-x64.zip
SHA256SUMS
```

Archive contents:

```text
jira-flow
LICENSE
README.md
```

Windows:

```text
jira-flow.exe
LICENSE
README.md
```

Do not publish separate `commitmsg` or `postco` executables.

---

# 51. Package-Manager Distribution Architecture

The **canonical artifact** is the standalone JiraFlow executable produced by the release build.

The npm package is a distribution surface for that binary, not a second implementation.

Package requirements:

1. package version exactly matches the Git tag
2. platform/architecture resolves to the matching JiraFlow binary
3. installation does not compile JiraFlow on the user's machine
4. installation does not modify Git repos
5. the installed `jira-flow` command launches the native binary
6. package-manager uninstall removes only package files
7. package install verifies integrity through npm package integrity and/or JiraFlow release checksums
8. no runtime download occurs every time JiraFlow runs

---

# 52. Packaging Spike — Required Before Alpha

There is one implementation detail that should be proven before the packaging architecture is declared final:

> the cleanest cross-platform npm/pnpm/Bun global launcher for a standalone binary.

This is a **technical packaging spike**, not a product-design question.

Evaluate two implementation patterns:

## Option A — platform-specific optional npm packages

Concept:

```text
jira-flow
    ↓
platform resolver
    ↓
platform-specific native package
```

Advantages:

- package registry handles artifact transport/integrity
- no GitHub download during install
- common pattern for native JS ecosystem tools

Tradeoff:

- multiple published package artifacts
- universal launcher behavior must be proven for npm, pnpm, and Bun global installs

## Option B — install-time binary resolver

Concept:

```text
jira-flow package
    ↓ postinstall
resolve platform
    ↓
download release asset + verify checksum
    ↓
install package-local native binary
```

Advantages:

- preserves one public npm package
- GitHub release remains canonical

Tradeoff:

- network install script
- checksum/version contract must be exact
- package-manager global shim behavior must be proven cross-platform

### Acceptance criterion

Do not select based on elegance alone.

Build small prototypes and test:

```text
npm global install
pnpm global install
bun global install

macOS
Windows
Linux
```

The chosen design must result in:

```text
command -v / where jira-flow
jira-flow --version
jira-flow doctor
```

running the standalone native binary reliably.

If Bun-global installation cannot be made robust without adding a second runtime dependency, amend the install-channel product promise before v1 rather than shipping a fragile shim.

---

# 53. Release Automation

Use:

```text
Release Please
```

for release PR/version/changelog automation.

The repository has one product version.

Use a simple/Node-style Release Please configuration that updates:

```text
package.json
CHANGELOG.md
release manifest
```

Version remains canonicalized by the release tag at build time.

No Changesets.

No interactive local version-bump shell script.

No local GPG release requirement.

---

# 54. Release Workflow

Conceptual stable release:

```text
Conventional commits on main
        ↓
Release Please maintains release PR
        ↓
merge release PR
        ↓
vX.Y.Z tag + GitHub release
        ↓
release build matrix
        ↓
standalone binaries
        ↓
target smoke tests
        ↓
checksums
        ↓
upload GitHub release assets
        ↓
build/verify npm package
        ↓
publish npm
```

npm publishing happens only after binary artifacts pass validation.

Use npm trusted publishing/OIDC from GitHub Actions rather than a long-lived publish token when configured.

---

# 55. Prerelease Channel

During v1 development:

```text
jira-flow@latest -> 0.5.0
jira-flow@next   -> 1.0.0-alpha/beta/rc
```

Suggested progression:

```text
1.0.0-alpha.1
1.0.0-alpha.2
1.0.0-beta.1
1.0.0-rc.1
1.0.0
```

`latest` does not move to v1 until stable `1.0.0`.

---

# 56. Go 0.5.0 -> TypeScript 1.0.0 Repository Migration

Do not archive the repository.

Do not rewrite Git history.

Do not delete Go tags.

---

## Phase M0 — freeze legacy

Current Go line:

```text
v0.5.0
```

Ensure that tag remains immutable.

Create convenience branch:

```text
legacy/go-v0.5
```

pointing at the final Go source.

Add a short legacy note if useful.

No new product work occurs on the Go architecture.

---

## Phase M1 — create rewrite branch

Create:

```text
rewrite/v1
```

Start the TypeScript project there.

The rewrite is not required to retain the Go directory structure.

The old Go implementation remains visible through:

```text
v0.5.0
legacy/go-v0.5
Git history
```

---

## Phase M2 — establish v1 vertical slice

Before broad TUI work, prove:

```text
TypeScript executable
        ↓
temp Git repo
        ↓
jira-flow init
        ↓
safe commit-msg integration
        ↓
Git-local config
        ↓
Hybrid branch resolution
        ↓
real git commit
        ↓
correct Jira reference
        ↓
jira-flow doctor
```

Also prove:

```text
bun:sqlite registry
OpenTUI renders repository status
```

This is the architecture validation milestone.

---

## Phase M3 — build full v1 product surface

Implement in this order:

1. domain
2. Git discovery/config
3. worktree state
4. hook ownership/composition
5. commit processing
6. Doctor
7. headless CLI
8. SQLite registry/settings
9. PR-title generation
10. TUI shell/navigation
11. TUI screens
12. packaging
13. release automation

The TUI should not be used to hide incomplete engine behavior.

---

## Phase M4 — alpha releases

Publish:

```text
1.0.0-alpha.N
```

to:

```text
next
```

Alpha criteria:

- core engine works
- actual Git commits work
- hook composition tests pass
- major CLI commands exist
- TUI may still be incomplete
- package installation has been validated on required platforms

---

## Phase M5 — beta

Beta criteria:

- complete v1 command surface
- complete required TUI screens
- SQLite migrations stable enough for forward upgrades
- Doctor and repair behavior implemented
- Windows/macOS/Linux integration suite passes
- no known destructive hook-management defects

At this point the rewrite can replace `main` if it has not already.

The repository README should clearly say:

```text
v1 beta / next channel
stable npm latest remains 0.5.0 until v1.0
```

---

## Phase M6 — release candidate

RC criteria:

- product feature freeze
- documentation complete
- package manager install/uninstall matrix passes
- binary smoke tests pass
- upgrade from prior v1 prerelease DB schemas works
- removal leaves foreign Git hooks intact
- missing JiraFlow binary never blocks Git
- no P0/P1 known defects

---

## Phase M7 — stable v1

Tag:

```text
v1.0.0
```

Publish:

```text
jira-flow@1.0.0
```

as:

```text
latest
```

Keep:

```text
jira-flow@0.5.0
```

installable.

After v1 is proven stable, optionally deprecate:

```text
jira-flow@<1.0.0
```

with a message identifying it as the legacy Go implementation and directing users to v1.

Do not unpublish historical versions.

---

# 57. Migration of Existing 0.5.0 Repositories

A user may already have Go JiraFlow hooks.

v1 init/Doctor must detect known legacy patterns.

Legacy detection should recognize:

- old generated commit-msg wrapper
- old `commitmsg` helper references
- old `post-checkout` JiraFlow hook
- old `postco` helper references

Migration behavior:

```text
Legacy JiraFlow integration detected.

v1 can migrate this repository.

This will:
  • remove only recognized legacy JiraFlow hook content
  • install the v1 commit-msg integration
  • remove the legacy JiraFlow post-checkout hook only when ownership is proven
  • write v1 repository configuration
  • register the repo in the v1 dashboard

> Migrate
  View details
  Cancel
```

Do not assume every `commit-msg` or `post-checkout` belongs to legacy JiraFlow.

Migration uses exact known legacy signatures.

---

# 58. Legacy Configuration Limitation

The Go version did not persist manual configuration correctly.

Therefore the v1 migrator should **not pretend it can recover nonexistent state**.

Migration may infer only facts it can prove.

Default migration result:

```text
enabled = true
mode = hybrid
```

unless a recognized legacy state proves otherwise.

User reviews settings during migration.

---

# 59. Version Compatibility

v1 state formats have explicit versions.

Examples:

```text
worktree state schemaVersion
hook blockVersion
integration metadata schemaVersion
SQLite migration version
```

Do not bind every data format directly to the JiraFlow package version.

A patch/minor JiraFlow update should be able to read older v1 state and migrate it.

---

# 60. Performance Requirements

The `commit-msg` path is latency-sensitive.

Design target:

- no TUI import
- no SQLite
- no network
- minimal Git commands
- minimal filesystem access
- one commit-message read
- no write if no mutation

Likely Git calls for Hybrid:

```text
discover repo / config context
current branch
read Git config
```

Where practical, combine config reads using:

```text
git config --local --get-regexp
```

rather than spawning Git once per JiraFlow key.

Optimization comes after correctness, but avoid obviously unnecessary process spawning.

---

# 61. Security / Safety Requirements

JiraFlow modifies developer workflow files.

Required safety rules:

- never evaluate configuration as code
- regex patterns are data, not executable expressions
- no remote code execution
- no network in hooks
- atomic hook/config state writes
- backups before composing into foreign hooks
- exact managed markers
- verify before remove
- path shell-escaping
- no blind `rm commit-msg`
- no blind overwrite
- no automatic shared-hook mutation with `--yes`
- no real user Git config modification in tests
- no package uninstall filesystem crawling

---

# 62. Logging

Normal users should not see debug logs from hooks.

Introduce internal diagnostic logging only behind:

```text
JIRAFLOW_DEBUG=1
```

or a future explicit debug flag.

Debug output must go to stderr.

Do not store verbose logs permanently by default.

Doctor should report useful diagnostics directly rather than telling users to inspect hidden logs first.

---

# 63. Architecture Invariants

These are implementation rules, not suggestions.

1. OpenTUI never owns business logic.
2. CLI never owns business logic.
3. Commit hook never touches SQLite.
4. Commit hook never initializes OpenTUI.
5. Git paths are resolved through Git.
6. `.git/hooks` is never hard-coded as the effective hook directory.
7. `linkedIssue` is worktree-local state.
8. repo workflow configuration is Git-local.
9. global registry/cache is SQLite.
10. SQLite deletion cannot break configured commit behavior.
11. one binary performs CLI, TUI, and hook work.
12. there is no separate `commitmsg` binary.
13. there is no separate `postco` binary.
14. there is no `post-checkout` hook.
15. existing hook presence never implies JiraFlow ownership.
16. unsafe hook mutation is refused.
17. removal verifies before deletion.
18. normal commit processing is silent.
19. missing Jira key is a no-op.
20. package uninstall does not mutate repositories.

---

# 64. Recommended Implementation Milestones

## Milestone 1 — foundation

- Bun/TypeScript project
- domain types
- error model
- Git runner
- repository discovery
- effective config model
- unit-test foundation

## Milestone 2 — vertical slice

- Git-local config
- worktree state
- owned hook install
- Hybrid resolution
- footer mutation
- real commit E2E
- Doctor basic
- compiled binary smoke

## Milestone 3 — hook safety

- hook analyzer
- embedded managed block
- backups
- remove
- repair
- `core.hooksPath`
- worktrees
- conflict matrix

## Milestone 4 — complete headless engine

- Branch/Manual
- link/unlink
- enable/disable
- status
- config
- all commit formats
- JSON output
- repository migration from 0.5

## Milestone 5 — SQLite/control plane

- DB bootstrap/migrations
- registry
- repository cache
- settings
- issue metadata
- repositories command
- reconciliation

## Milestone 6 — PR-title

- templates
- metadata cache
- clipboard
- CLI

## Milestone 7 — OpenTUI

- startup router
- dashboard
- repo overview
- setup
- workflow settings
- linking
- Doctor
- PR-title screen
- missing repo
- removal

## Milestone 8 — packaging/release

- packaging spike
- native target builds
- package-manager smoke tests
- Release Please
- npm trusted publishing
- `next` prereleases

## Milestone 9 — v1 hardening

- full OS matrix
- migration tests
- uninstall tests
- docs
- release candidate
- stable v1

---

# 65. Architecture Review Gates

Before declaring the architecture frozen, answer yes to all of these:

### Engine

- Can all TUI behavior be executed headlessly?
- Does a configured repo still commit correctly if the SQLite DB is deleted?
- Does a Hybrid linked issue remain isolated between worktrees?
- Does detached HEAD remain non-fatal?

### Hooks

- Can JiraFlow coexist with an existing shell hook without deleting it?
- Does remove leave the foreign hook functional?
- Does JiraFlow refuse unsupported hooks instead of guessing?
- Does a missing JiraFlow executable leave Git usable?
- Is shared `core.hooksPath` handled without silent mutation?

### TUI

- Can every required product-spec screen be reached?
- Is the TUI only consuming application view models/use cases?
- Can TUI rendering fail without corrupting repository state?

### Distribution

- Is there exactly one JiraFlow application binary?
- Does `--version` report build-time version data?
- Are release artifact names generated from one version?
- Do actual packaged binaries pass smoke tests?
- Do documented package-manager installs run the native binary?

### Migration

- Can a legacy 0.5 hook be recognized without treating arbitrary hooks as JiraFlow?
- Can v1 coexist with historical npm releases?
- Is `latest` kept on 0.5 until stable v1?

---

# 66. Technical Decisions Considered Locked

Unless an implementation spike proves one impossible or unsafe:

1. TypeScript is the v1 language.
2. Bun is the primary build/runtime toolchain.
3. OpenTUI React is the TUI layer.
4. Commander is the CLI parser.
5. `bun:sqlite` is the SQLite driver.
6. JiraFlow remains one application repository.
7. Architecture is domain/application/adapters rather than UI-driven.
8. Git CLI is the authority for repository structure.
9. Git-local config stores repo-wide JiraFlow workflow configuration.
10. linked issue is stored as worktree-local JiraFlow state under a Git-resolved path.
11. commit hook execution never depends on SQLite.
12. only `commit-msg` is used.
13. the hook manager uses owned files or reversible marker blocks.
14. unsafe/unknown hook composition is refused.
15. shared external hooks are never silently modified.
16. TUI uses a typed state-machine router.
17. no Redux/Zustand in v1.
18. SQLite is accessed directly through a thin adapter, with migrations.
19. standalone executables are canonical release artifacts.
20. Release Please replaces the old interactive versioning flow.
21. prereleases use the npm `next` channel.
22. stable v1 moves npm `latest` from 0.5 to 1.0.
23. historical 0.x releases remain available.
24. the existing GitHub repository remains canonical.
25. the Go implementation is preserved by tag/history and a convenience legacy branch.
26. v1 migration recognizes only provable JiraFlow legacy hook signatures.
27. package uninstall never cleans repositories automatically.
28. packaging launcher mechanics must pass the pre-alpha packaging spike before being frozen.

---

# 67. Required Technical Spike

Only one architecture area remains deliberately conditional:

## SPIKE-01 — Native binary package-manager launcher

Prove the exact mechanism that allows:

```text
npm install -g jira-flow
pnpm add -g jira-flow
bun add -g jira-flow
```

to expose the same standalone native JiraFlow binary reliably on:

```text
macOS
Windows
Linux
```

Test platform-specific optional packages versus install-time binary resolution.

The spike is complete only when:

- upgrade works
- uninstall works
- global command works
- hook-captured executable resolution works
- path-with-spaces works
- no Git repo is mutated during package install
- the TUI runs without a separately installed Bun runtime
- CI can reproduce the behavior

Once this spike is complete, record the chosen packaging strategy as an ADR and remove the rejected branch.

---

# 68. Source / Platform Notes

This architecture was cross-checked against current official documentation available on August 13, 2026:

- OpenTUI documents its native terminal renderer and React/keymap bindings, with Bun used in renderer setup examples.
- Bun documents standalone TypeScript/JavaScript executable compilation and support for `bun:sqlite` in compiled executables.
- Git documents hooks as `$GIT_DIR/hooks` or `core.hooksPath`, and documents worktree/common Git-directory distinctions and `git rev-parse --git-path`.
- npm documents dist-tags for prerelease channels, version deprecation instead of destructive unpublishing, and OIDC trusted publishing from GitHub Actions.
- Release Please documents release PR automation, prerelease configuration, GitHub release creation, and artifact upload workflows.

Official references:

- https://opentui.com/docs/getting-started/
- https://opentui.com/docs/keymap/react/
- https://bun.sh/docs/bundler/executables
- https://bun.sh/docs/runtime/sqlite
- https://git-scm.com/docs/githooks
- https://git-scm.com/docs/git-config
- https://git-scm.com/docs/git-rev-parse
- https://git-scm.com/docs/git-worktree
- https://docs.npmjs.com/cli/dist-tag/
- https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions/
- https://docs.npmjs.com/trusted-publishers/
- https://github.com/googleapis/release-please-action

---

# 69. Next Planning Artifact

After this architecture is accepted, the next useful artifact should be the **v1 implementation roadmap/backlog**.

That roadmap should convert these milestones into:

- vertical slice
- epics
- implementation tasks
- dependencies
- acceptance criteria
- test obligations
- architecture decision records
- alpha/beta/RC release gates

The implementation roadmap should not re-litigate the product spec or this architecture unless a spike exposes a genuine technical contradiction.
