# JiraFlow v1 Product Specification

**Status:** Draft v1 product spec  
**Product:** JiraFlow  
**Target release:** `1.0.0`  
**Implementation direction:** TypeScript + Bun + OpenTUI  
**Primary package:** `jira-flow`  
**Legacy line:** `0.x` Go implementation  
**v1 line:** TypeScript rewrite

---

## 1. Purpose

JiraFlow v1 is a complete rewrite of the original Go package.

The core product remains simple:

> JiraFlow manages the local relationship between Git work and Jira issue references.

The v1 rewrite expands the original commit-hook utility into a small local workflow tool with two equal interfaces:

1. a **headless engine / CLI** that performs all real operations
2. an **OpenTUI management interface** for interactive repository and workflow management

The TUI is a control plane. It must never become the only way to perform meaningful JiraFlow operations.

JiraFlow v1 remains local-first. It does **not** require Jira API access, GitHub API access, GitHub CLI, OAuth, or remote service authentication.

---

## 2. Product Goals

JiraFlow v1 should:

- make Jira issue references in Git commits automatic and unobtrusive
- work correctly regardless of which branch the user is on during initialization
- support branch-derived issue keys, explicit manual linking, and temporary overrides
- never silently overwrite or delete another tool's Git hooks
- preserve repository configuration independently of the management database
- provide a clear health/repair workflow through `jira-flow doctor`
- support multiple JiraFlow-enabled repositories from one terminal management UI
- generate locally templated PR titles without becoming a PR-management client
- remain fully scriptable without launching the TUI
- ship as one executable
- support macOS, Windows, and Linux
- preserve the existing `jira-flow` npm/package identity for the v1 rewrite

---

## 3. Product Non-Goals

The following are explicitly outside the JiraFlow v1.0 product boundary:

- full Jira client functionality
- Jira API integration
- Jira OAuth or API-token management
- Jira issue search
- Jira issue status transitions
- GitHub API integration
- GitHub authentication
- automatic PR creation
- PR review management
- GitHub CLI as a required dependency
- GitLab/Bitbucket API integration
- filesystem-wide automatic Git repository crawling
- Docker as a primary runtime/install path
- arbitrary scripting inside formatting templates
- a general Git hook manager
- team policy enforcement that blocks commits
- central SQLite state becoming authoritative over repository state

Future versions may add optional integrations, but the v1 engine must not depend on them.

---

# 4. Core Product Model

JiraFlow has four primary concepts:

1. **Enabled state**
2. **Linking mode**
3. **Active issue**
4. **Repository health**

These concepts are intentionally separate.

## 4.1 Enabled state

A repository is either:

```text
enabled = true
```

or:

```text
enabled = false
```

Disabling JiraFlow does not destroy its configuration.

An enabled repository processes commits through JiraFlow.

A disabled repository remains configured and registered, but JiraFlow performs no commit-message mutation.

---

## 4.2 Linking modes

JiraFlow v1 has exactly three linking modes:

```text
Hybrid
Branch
Manual
```

There is no `Off` mode. Off behavior is represented by `enabled = false`.

### Hybrid — default

Hybrid uses an explicit linked issue when one exists.

Otherwise it derives an issue key from the current branch.

```text
explicit linked issue exists?
    yes -> use linked issue
    no  -> derive from current branch
```

Example:

```text
branch = feat/ABC-123-login
linked issue = none

active issue = ABC-123
```

Then:

```bash
jira-flow link OPS-992
```

becomes:

```text
branch issue = ABC-123
linked issue = OPS-992

active issue = OPS-992
```

Then:

```bash
jira-flow unlink
```

returns to:

```text
active issue = ABC-123
source = branch
```

### Branch

Branch mode always derives the active issue from the current branch.

Explicit linking is not available while in Branch mode.

```text
active issue = branch-derived issue
```

If no issue key exists in the branch, there is no active issue and JiraFlow leaves the commit untouched.

### Manual

Manual mode ignores the branch for issue selection.

```text
active issue = explicitly linked issue
```

If no issue is linked, there is no active issue and JiraFlow leaves the commit untouched.

---

## 4.3 Active issue resolution

The engine resolves the active issue using this order:

```text
if JiraFlow disabled:
    active issue = none

else if mode == Hybrid:
    if linked issue exists:
        active issue = linked issue
        source = override
    else:
        active issue = branch-derived issue
        source = branch

else if mode == Branch:
    active issue = branch-derived issue
    source = branch

else if mode == Manual:
    active issue = linked issue
    source = manual
```

No missing issue state blocks a commit in v1.0.

---

# 5. Distribution and Installation

## 5.1 Package identity

JiraFlow keeps the existing package identity:

```text
jira-flow
```

The version line becomes:

```text
0.5.0 and earlier -> legacy Go implementation
1.0.0 and later   -> TypeScript rewrite
```

Historical npm versions remain available.

The v1 rewrite does not require a new npm package name.

---

## 5.2 Primary v1 install channels

The primary documented installation flow is via npm-compatible global package managers:

```bash
npm install -g jira-flow
```

```bash
pnpm add -g jira-flow
```

```bash
bun add -g jira-flow
```

The npm/pnpm channels require Node 18 or newer. The Bun global channel uses the
same Node-compatible universal launcher and is supported when a compatible
`node` command is also available. A Bun-only environment must use the native
release archive instead (DR-0023).

DR-0026 further amends the Windows channel: Bun global install/upgrade/run is
compatibility-tested, but Windows Bun global uninstall is not a supported v1
lifecycle because Bun 1.3.14 and 1.4.0 leave their generated, nonfunctional
`jira-flow.exe` shim. Windows users use npm, pnpm, or the native archive.

The installed command is:

```bash
jira-flow
```

The compiled JiraFlow application does not require Bun or Node. Package-manager
launchers may require their declared package-manager runtime; native release
archives are runtime-free (DR-0023).

---

## 5.3 Supported platforms for v1.0

Required:

- macOS arm64
- macOS x64
- Windows x64
- Linux x64

Strongly preferred if the build pipeline is straightforward:

- Windows arm64
- Linux arm64

Other package managers and install channels are deferred unless they are effectively free to support.

---

## 5.4 Installation side effects

Package installation must **not**:

- modify any Git repository
- install Git hooks into repositories
- scan the user's filesystem
- register repositories
- prompt for JiraFlow configuration

After installation, these must work anywhere:

```bash
jira-flow --help
jira-flow --version
```

---

# 6. Exact CLI Command Surface

All meaningful TUI actions must map to headless engine behavior.

## 6.1 Root command

```bash
jira-flow
```

Behavior is context-aware.

### Outside a Git repository

If known repositories exist:

- open the Global Dashboard

If no known repositories exist:

- open the Empty State screen

### Inside an unconfigured Git repository

Open the Unconfigured Repository screen.

### Inside a configured Git repository

Open that repository's Repository Overview.

---

## 6.2 Global informational flags

```bash
jira-flow --help
jira-flow --version
```

These must work outside Git repositories.

---

## 6.3 `init`

```bash
jira-flow init
```

Initialize the current Git repository.

Optional path form:

```bash
jira-flow init <path>
```

This allows a repository to be initialized without first changing directories.

### Options

```text
--mode <hybrid|branch|manual>
--yes
```

`--mode` overrides the global default during initialization.

`--yes` accepts safe defaults and avoids the interactive setup UI.

If the repository is already managed by JiraFlow:

- do not duplicate integration
- do not overwrite config
- show current state
- return success

`init` is idempotent.

---

## 6.4 `status`

```bash
jira-flow status
```

Human-readable output:

```text
JiraFlow: enabled
Repository: emblor
Mode: Hybrid
Branch: feat/ABC-123-login
Branch issue: ABC-123
Linked issue: none
Active issue: ABC-123
Active source: branch
Commit format: footer
Integration: healthy
```

### Option

```text
--json
```

`--json` produces stable machine-readable output.

---

## 6.5 `link`

```bash
jira-flow link <ISSUE-KEY>
```

Examples:

```bash
jira-flow link ABC-123
jira-flow link OPS-992
```

### Option

```text
--title <story-title>
```

Example:

```bash
jira-flow link ABC-123 --title "Fix authentication session timeout"
```

Behavior:

### Hybrid mode

Sets the linked issue as the current override.

### Manual mode

Sets the linked issue as the active manual issue.

### Branch mode

Return a user-facing error:

```text
Issue linking is unavailable in Branch mode.

Switch to Hybrid or Manual:

  jira-flow mode hybrid
  jira-flow mode manual
```

Do not silently change modes.

The issue key is validated before persistence.

---

## 6.6 `unlink`

```bash
jira-flow unlink
```

Behavior:

### Hybrid

Clear the override and fall back to branch-derived issue resolution.

### Manual

Clear the linked issue. Active issue becomes `None`.

### Branch

Return a no-op informational response because Branch mode has no linked issue.

---

## 6.7 `mode`

Read current mode:

```bash
jira-flow mode
```

Output:

```text
Hybrid
```

Set mode:

```bash
jira-flow mode hybrid
jira-flow mode branch
jira-flow mode manual
```

Changing mode does not reinstall hooks.

Changing to Branch mode preserves a previously linked issue in local state but does not use it while Branch mode is active.

If the user later returns to Hybrid or Manual, the prior linked issue may become active again.

The TUI must make this preservation visible.

---

## 6.8 `enable`

```bash
jira-flow enable
```

Sets:

```text
enabled = true
```

Ensures the JiraFlow-owned commit integration exists and is healthy.

Does not change linking mode.

---

## 6.9 `disable`

```bash
jira-flow disable
```

Sets:

```text
enabled = false
```

Configuration remains.

Registry entry remains.

The JiraFlow hook integration may remain installed and must behave as a cheap no-op while disabled.

---

## 6.10 `remove`

```bash
jira-flow remove
```

Interactive by default.

Removes:

- JiraFlow-owned Git integration
- JiraFlow repository-local configuration
- repository registration from the SQLite registry

Must **not** remove or damage foreign hook behavior.

### Option

```text
--yes
```

Skip confirmation.

If hook ownership cannot be proven safely, JiraFlow must refuse destructive removal and direct the user to `jira-flow doctor`.

---

## 6.11 `doctor`

```bash
jira-flow doctor
```

Runs health checks without mutating state.

### Option

```text
--json
```

Machine-readable diagnostics.

### Repair mode

```bash
jira-flow doctor --repair
```

Repair mode may:

- restore missing JiraFlow-owned integration
- reconcile stale JiraFlow-owned hook state
- rebuild registry cache from repository truth
- correct non-destructive JiraFlow metadata problems

Repair must never overwrite an unowned hook without explicit confirmation and a safe composition strategy.

---

## 6.12 `pr-title`

```bash
jira-flow pr-title
```

Resolve the configured PR-title template.

If all variables are known, generate immediately.

If required local metadata such as `{storyTitle}` is unknown, prompt for it in interactive terminals.

Default behavior:

- print generated title
- copy it to clipboard when clipboard support succeeds

### Options

```text
--title <story-title>
--no-copy
--json
```

Example:

```bash
jira-flow pr-title --title "Fix authentication session timeout"
```

Example output:

```text
ABC-123 | 2026-08-13 | Q3 | Fix authentication session timeout

Copied to clipboard.
```

No GitHub API, GitHub CLI, or Jira API is involved.

---

## 6.13 `repositories`

```bash
jira-flow repositories
```

Lists known repositories from the SQLite registry and reconciles status where practical.

Example:

```text
emblor           Hybrid   EMB-217   Healthy
komanga          Hybrid   KM-148    Healthy
portfolio        Manual   WEB-91    Healthy
old-project      Hybrid   —         Missing
```

### Option

```text
--json
```

This command does not scan the filesystem for repositories.

---

## 6.14 `config`

Read effective configuration:

```bash
jira-flow config list
```

Read a key:

```bash
jira-flow config get <key>
```

Set a repository override:

```bash
jira-flow config set <key> <value>
```

Unset a repository override:

```bash
jira-flow config unset <key>
```

Global defaults:

```bash
jira-flow config list --global
jira-flow config get <key> --global
jira-flow config set <key> <value> --global
jira-flow config unset <key> --global
```

The config command operates on a constrained key schema. It is not an arbitrary data store.

---

## 6.15 Internal hook command

Internal implementation command:

```bash
jira-flow hook commit-msg <commit-message-file>
```

This command is not a primary user-facing workflow.

It powers the managed Git `commit-msg` integration.

There is no `post-checkout` hook in v1.0.

---

# 7. Command Exit Behavior

The following rules are required:

- informational commands use exit code `0` on healthy completion
- user input/config errors use non-zero exit codes
- missing active Jira issue never causes the Git commit hook to fail
- JiraFlow commit mutation errors should fail the hook only when continuing could corrupt or incorrectly rewrite the commit message
- disabled JiraFlow always exits the hook successfully without mutation
- non-Jira branches in Hybrid/Branch mode are normal, not errors
- commands requiring a repo provide a concise error when run outside one
- `--help` and `--version` never require a repo

---

# 8. Git Integration Model

## 8.1 One managed hook

v1 uses only:

```text
commit-msg
```

No `post-checkout` integration.

At commit time JiraFlow determines the current branch itself.

---

## 8.2 Hook ownership requirements

JiraFlow must never equate:

```text
hook file exists
```

with:

```text
JiraFlow owns hook
```

The implementation must have an explicit ownership/composition mechanism.

Requirements:

- resolve the effective Git hooks path through Git
- respect `core.hooksPath`
- support worktrees
- detect existing `commit-msg` integrations
- never silently overwrite an unowned hook
- preserve foreign hook behavior
- remove only JiraFlow-owned integration
- make install/repair/remove idempotent

The exact implementation strategy may be decided during technical architecture work, but these behaviors are part of the product contract.

---

# 9. Commit Processing Contract

At commit time:

```text
1. load repository JiraFlow config
2. if disabled -> return success without mutation
3. resolve mode
4. get current branch if required
5. resolve active issue
6. if no active issue -> return success without mutation
7. read commit message safely
8. detect whether active issue is already represented
9. if already represented -> return success without mutation
10. apply configured commit format
11. write message safely
12. return success
```

Commit processing should normally produce no terminal output.

---

# 10. Commit Formatting

v1.0 supports four preset formats.

No custom commit-template language in v1.0.

## 10.1 `footer` — default

Input:

```text
feat(auth): add login
```

Output:

```text
feat(auth): add login

Jira: ABC-123
```

This is the default because it preserves the beginning of Conventional Commit subjects.

---

## 10.2 `suffix`

```text
feat(auth): add login [ABC-123]
```

---

## 10.3 `prefix`

```text
ABC-123 feat(auth): add login
```

---

## 10.4 `scope`

```text
feat(ABC-123): add login
```

Scope formatting is only applied when the existing commit subject can be safely interpreted for that transformation.

If the transformation is unsafe or ambiguous, JiraFlow must not destructively guess.

---

## 10.5 Idempotency

If the active Jira key is already present in the commit message in the configured/reference-recognized form, JiraFlow does not add it again.

---

# 11. Issue Key Handling

## 11.1 Default branch extraction pattern

Built-in default:

```regex
[A-Z][A-Z0-9]*-\d+
```

Branch extraction searches for this pattern within a larger branch name.

Examples:

```text
feat/ABC-123-login        -> ABC-123
fix/team/OPS2-991-crash   -> OPS2-991
chore/update-deps         -> none
```

---

## 11.2 Strict linked-issue validation

Explicit `link` input validates the whole token, not a substring.

Conceptually:

```regex
^[A-Z][A-Z0-9]*-\d+$
```

Repository-level pattern overrides may be supported, but invalid patterns must produce recoverable configuration errors, never runtime panics.

---

# 12. Configuration Ownership and Precedence

JiraFlow has two configuration layers:

1. repository-local configuration
2. global defaults/preferences

## 12.1 Repository-local configuration is authoritative

Repository state is stored through Git-local configuration.

Conceptual representation:

```ini
[jiraflow]
    enabled = true
    mode = hybrid
    issuePattern = [A-Z][A-Z0-9]*-\d+
    commitFormat = footer
    linkedIssue = ABC-123
    prTitleTemplate = [{jiraKey}] {storyTitle}
```

Not every key must be physically written when it equals the global default.

The implementation may store only repo-specific overrides plus required repo state.

---

## 12.2 Global defaults live in JiraFlow's application database

Global preferences/defaults are stored in SQLite.

They are not copied into every repository unless overridden.

Built-in defaults exist beneath global defaults.

---

## 12.3 Precedence

For settings that support overrides:

```text
one-shot CLI option
    ↓
repository-local override
    ↓
global default
    ↓
built-in default
```

The SQLite repository cache never participates as authoritative configuration.

---

# 13. Exact Repository Configuration Schema

The following logical keys are part of v1.0.

## 13.1 Required local state

### `enabled`

Type:

```text
boolean
```

Default:

```text
true
```

---

### `mode`

Type:

```text
hybrid | branch | manual
```

Default:

```text
hybrid
```

---

### `linkedIssue`

Type:

```text
string | absent
```

Meaning:

- Hybrid: override when present
- Manual: active issue when present
- Branch: preserved but ignored

---

## 13.2 Optional repository overrides

### `issuePattern`

Type:

```text
regex string
```

Default comes from global/built-in configuration.

---

### `commitFormat`

Type:

```text
footer | suffix | prefix | scope
```

Default:

```text
footer
```

---

### `prTitleTemplate`

Type:

```text
string
```

If absent, use global default.

---

### `dateFormat`

Type:

```text
string
```

If absent, use global default.

---

# 14. Exact Global Configuration Schema

Global settings are stored in SQLite.

## 14.1 Workflow defaults

### `defaultMode`

```text
hybrid | branch | manual
```

Default:

```text
hybrid
```

### `defaultIssuePattern`

Default:

```text
[A-Z][A-Z0-9]*-\d+
```

### `defaultCommitFormat`

Default:

```text
footer
```

### `defaultPrTitleTemplate`

Default:

```text
{jiraKey} | {date} | {quarter} | {storyTitle}
```

### `defaultDateFormat`

Default:

```text
YYYY-MM-DD
```

### `copyPrTitleToClipboard`

Type:

```text
boolean
```

Default:

```text
true
```

---

## 14.2 TUI preferences

### `theme`

```text
system | dark | light
```

Default:

```text
system
```

### `lastSelectedRepositoryId`

Type:

```text
string | null
```

Convenience only.

---

# 15. PR Title Templates

PR-title templating is intentionally small.

v1.0 supported variables:

```text
{jiraKey}
{storyTitle}
{branch}
{repo}
{date}
{quarter}
```

No expressions.

No conditionals.

No loops.

No embedded JavaScript.

---

## 15.1 Variable resolution

### `{jiraKey}`

Resolved from the active issue.

If no active issue exists, prompt in interactive mode or return an error in non-interactive mode unless explicitly provided later through an option.

### `{storyTitle}`

Resolved from:

1. `--title`
2. cached SQLite issue metadata
3. interactive prompt

JiraFlow does not fetch it from Jira.

### `{branch}`

Current Git branch.

### `{repo}`

Repository display name.

### `{date}`

Current local date using configured date format.

### `{quarter}`

Calendar quarter:

```text
Q1
Q2
Q3
Q4
```

Custom fiscal-quarter logic is deferred beyond v1.0.

---

# 16. SQLite Database Role

SQLite is a **registry, cache, metadata store, and global preference store**.

It is not authoritative repository configuration.

Deleting the SQLite database must not break commit behavior for already-configured repositories.

After deletion, users may lose:

- dashboard registration history
- cached story titles
- TUI preferences
- cached repository health/status
- last-opened metadata

They must not lose:

- whether a repository is enabled
- repository linking mode
- linked issue
- commit formatting override
- repository PR title template override
- commit hook runtime behavior

---

# 17. Exact SQLite Entities

The v1 database contains four primary tables.

---

## 17.1 `repositories`

Purpose:

Track repositories known to the management layer.

```sql
CREATE TABLE repositories (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    remote_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_seen_at INTEGER,
    last_opened_at INTEGER
);
```

### Notes

- `path` is the currently registered local path.
- `remote_url` is informational identity metadata, not authoritative.
- a missing path does not automatically delete the row.
- repository configuration is not stored here.

---

## 17.2 `repository_cache`

Purpose:

Cache derived repository state for fast dashboard rendering.

```sql
CREATE TABLE repository_cache (
    repository_id TEXT PRIMARY KEY,
    branch TEXT,
    branch_issue TEXT,
    linked_issue TEXT,
    active_issue TEXT,
    active_issue_source TEXT,
    mode TEXT,
    enabled INTEGER,
    health TEXT,
    last_sync_at INTEGER NOT NULL,
    FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);
```

Allowed `health` values:

```text
healthy
warning
broken
missing
unknown
```

This table is always disposable/cacheable.

Actual repo state wins during reconciliation.

---

## 17.3 `issue_metadata`

Purpose:

Store convenience metadata that JiraFlow cannot obtain locally from Jira.

```sql
CREATE TABLE issue_metadata (
    repository_id TEXT NOT NULL,
    jira_key TEXT NOT NULL,
    story_title TEXT,
    last_used_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (repository_id, jira_key),
    FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);
```

Primary v1 use:

```text
jira key -> locally remembered story title
```

This powers faster PR-title generation.

---

## 17.4 `settings`

Purpose:

Store global defaults and TUI preferences.

```sql
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
```

The application owns the allowed key schema.

---

## 17.5 Schema versioning

The database must maintain an internal schema version and migration system.

Implementation may use an additional migration metadata table.

Database migrations must be automatic and backward-safe.

---

# 18. Repository Registration

Repositories enter the registry through explicit JiraFlow interaction.

v1.0 does not crawl the filesystem.

A repository is registered when:

- `jira-flow init` succeeds
- the user initializes it through the TUI
- the user explicitly initializes a path with `jira-flow init <path>`

Opening a configured but unregistered repository with `jira-flow` may automatically re-register it after the repository-local config is verified.

---

# 19. Repository Reconciliation

When the TUI opens a known repository:

```text
SQLite registry/cache
        ↓
verify path exists
        ↓
ask Git for repo identity/state
        ↓
load Git-local JiraFlow config
        ↓
inspect actual hook integration
        ↓
update cache
```

The actual repository always wins.

The dashboard must never mutate a repository based only on cached SQLite state.

---

# 20. Moved and Missing Repositories

If a registered path no longer exists:

```text
health = missing
```

The Global Dashboard shows the repository as missing.

v1.0 actions:

```text
Locate repository
Remove from registry
Ignore
```

`Locate repository` allows the user to provide the new path and then verifies that it is a valid Git repository before updating the registry.

Automatic remote-identity matching is deferred.

---

# 21. Exact TUI Screen Map

The TUI has a defined startup router and a finite screen map.

All screens must be keyboard-usable.

Mouse support is optional.

---

## S0. Startup Router

Not a visible screen.

Determines context:

```text
inside Git repo?
    yes:
        JiraFlow configured?
            yes -> S4 Repository Overview
            no  -> S2 Unconfigured Repository

    no:
        known repositories?
            yes -> S3 Global Dashboard
            no  -> S1 Empty State
```

---

## S1. Empty State

Shown outside a repo when no repositories are registered.

```text
JiraFlow

No repositories are configured yet.

To get started:

  cd <your-project>
  jira-flow init

[Q] Quit
```

No filesystem browser in v1.0.

---

## S2. Unconfigured Repository

Shown when launched inside a Git repository that JiraFlow does not manage.

```text
JiraFlow

Git repository detected: emblor
JiraFlow is not configured.

> Set up JiraFlow
  Open global dashboard
  Exit
```

Actions:

- `Enter` on Set up -> S5 Setup
- global dashboard -> S3
- exit

---

## S3. Global Dashboard

Primary multi-repository screen.

Columns:

```text
Repository
Mode
Issue
Health
```

Concept:

```text
JiraFlow

Repositories

┌──────────────────┬──────────┬───────────┬────────────┐
│ Repository       │ Mode     │ Issue     │ Health     │
├──────────────────┼──────────┼───────────┼────────────┤
│ emblor           │ Hybrid   │ EMB-217   │ ✓ Healthy │
│ komanga          │ Hybrid   │ KM-148    │ ✓ Healthy │
│ jira-flow        │ Branch   │ —         │ ✓ Healthy │
│ portfolio        │ Manual   │ WEB-91    │ ✓ Healthy │
│ old-project      │ Hybrid   │ —         │ ⚠ Missing │
└──────────────────┴──────────┴───────────┴────────────┘
```

Actions:

```text
Enter   Open selected repository
A       Add / initialize repository
D       Doctor
S       Global settings
R       Refresh
Q       Quit
```

Selecting a missing repository -> S13 Missing Repository.

---

## S4. Repository Overview

Primary per-repository screen.

```text
Emblor

~/Developer/emblor

Status
─────────────────────────
JiraFlow            Enabled
Mode                Hybrid
Active issue        EMB-217
Active source       Branch
Current branch      feat/EMB-217-headless
Integration         Healthy

Workflow
─────────────────────────
Commit format       Footer
PR title template   Global default
Issue pattern       Global default

Actions
─────────────────────────
> Link issue
  Clear linked issue
  Change mode
  Generate PR title
  Configure workflow
  Doctor
  Disable JiraFlow
  Remove JiraFlow
```

Actions:

```text
L       Link issue
U       Unlink / clear issue
M       Change mode
P       Generate PR title
W       Workflow settings
D       Doctor
E       Enable/disable
Delete  Remove JiraFlow
G       Global dashboard
Esc     Back
```

Unavailable actions are disabled contextually.

Example: Link Issue is disabled in Branch mode.

---

## S5. Setup

Opened from `jira-flow init` or S2.

Default review:

```text
Set up JiraFlow for emblor

Repository
  ~/Developer/emblor

Default behavior
  Hybrid

Issue detection
  ABC-123 style Jira keys

Commit integration
  commit-msg

Commit reference style
  Footer

──────────────────────────

> Initialize JiraFlow
  Customize first
  Cancel
```

### Initialize

Runs initialization with effective defaults.

### Customize first

Opens S6 Setup Customization.

---

## S6. Setup Customization

Fields:

```text
Mode
Issue pattern
Commit format
PR title template source
```

Defaults come from global settings.

Actions:

```text
Save and initialize
Reset to defaults
Cancel
```

No linked issue is required during setup.

---

## S7. Link Issue

Dialog/screen:

```text
Link Jira issue

Issue key
> ABC-123

Story title (optional)
> Fix authentication session timeout

[Link] [Cancel]
```

Valid only in Hybrid or Manual mode.

If cached story metadata already exists, prefill it.

---

## S8. Mode Selection

```text
Change linking mode

> Hybrid
  Branch
  Manual

Hybrid
Uses a linked issue when present.
Otherwise derives from the branch.
```

Changing mode does not clear the saved linked issue.

The confirmation summary must show whether a saved issue will become active/inactive after the change.

---

## S9. Workflow Settings

Repository-level overrides.

```text
Workflow Settings

Issue pattern
  Global default

Commit format
  Footer

PR title template
  Global default

Date format
  Global default

> Commit format
  PR title template
  Issue pattern
  Date format
  Reset all repo overrides
```

Each value can either:

- inherit global
- override locally

---

## S10. PR Title Generator

```text
Generate PR title

Jira key
  ABC-123

Story title
> Fix authentication session timeout

Date
  2026-08-13

Quarter
  Q3

Template
  {jiraKey} | {date} | {quarter} | {storyTitle}

Preview
──────────────────────────────────────────
ABC-123 | 2026-08-13 | Q3 | Fix authentication session timeout
──────────────────────────────────────────

> Copy title
  Edit story title
  Edit this run
  Cancel
```

Editing "this run" does not necessarily change the saved global/repo template.

---

## S11. Doctor

Available globally and per-repo.

Per-repo checks:

```text
✓ Git repository detected
✓ JiraFlow configuration valid
✓ Registry synchronized
✓ commit-msg integration installed
✓ JiraFlow ownership verified
✓ Existing hook behavior preserved
✓ JiraFlow executable reachable
✓ Issue pattern valid
✓ Mode valid
✓ Active issue resolution healthy
```

Problem example:

```text
✗ commit-msg integration missing

JiraFlow is configured, but its Git integration
is no longer installed.

> Repair
  View details
  Disable JiraFlow
  Back
```

Global Doctor additionally checks:

- database access
- schema version
- registered repository paths
- stale/missing repositories

---

## S12. Global Settings

Fields:

```text
Default mode
Default issue pattern
Default commit format
Default PR title template
Default date format
Copy PR title to clipboard
Theme
```

Changes affect defaults, not explicit repo overrides.

---

## S13. Missing Repository

```text
old-project

Repository path unavailable:
~/Developer/old-project

> Locate repository
  Remove from registry
  Ignore
```

Locate validates the new path before updating the registry.

Automatic remote matching is not v1.0 behavior.

---

## S14. Remove JiraFlow Confirmation

```text
Remove JiraFlow from emblor?

This will:
  • remove JiraFlow's managed Git integration
  • remove JiraFlow repository configuration
  • remove this repository from the JiraFlow registry

Other Git hooks will be preserved.

> Remove JiraFlow
  Cancel
```

If JiraFlow cannot guarantee safe removal:

```text
Removal cannot continue safely.

Run Doctor to inspect the Git hook integration.
```

---

# 22. TUI Navigation Rules

Global rules:

```text
Esc     Back / close modal
Q       Quit when not in destructive confirmation
?       Help / key reference
```

Each screen displays its important shortcuts.

The TUI must not require memorization of hidden shortcuts; every operation also appears as a selectable action.

---

# 23. First-Run User Journey

Required happy path:

```text
npm install -g jira-flow
        ↓
cd project
        ↓
jira-flow init
        ↓
Hybrid configured
        ↓
create feat/ABC-123-whatever
        ↓
git commit normally
        ↓
JiraFlow references ABC-123 silently
        ↓
need temporary OPS-992 association?
        ↓
jira-flow link OPS-992
        ↓
commit normally
        ↓
jira-flow unlink
        ↓
back to ABC-123 from branch
        ↓
ready for PR?
        ↓
jira-flow pr-title
        ↓
paste generated company-format title
        ↓
jira-flow
        ↓
manage this repo or all JiraFlow repos
```

---

# 24. Everyday Commit UX

Normal commit workflow must feel like Git, not like an interactive JiraFlow session.

Example:

```bash
git switch -c feat/ABC-123-login
git commit -m "feat(auth): add login"
```

JiraFlow performs its work silently.

If no active Jira issue exists:

```bash
git commit -m "chore: update dependencies"
```

the commit succeeds unchanged.

v1.0 does not display:

```text
ERROR: YOU DON'T HAVE A JIRA KEY
```

and does not block the commit.

---

# 25. Manual Override UX

Hybrid override:

```bash
jira-flow link OPS-992
```

Output:

```text
Linked OPS-992

Mode: Hybrid
Branch issue: ABC-123
Linked issue: OPS-992
Active issue: OPS-992
Source: override
```

Clear:

```bash
jira-flow unlink
```

Output:

```text
Linked issue cleared.

Active issue: ABC-123
Source: branch
```

---

# 26. Manual Mode UX

```bash
jira-flow mode manual
jira-flow link ABC-123
```

Commits use `ABC-123` regardless of branch.

Switch issue:

```bash
jira-flow link ABC-456
```

No unlink required first.

Clear:

```bash
jira-flow unlink
```

Result:

```text
Mode: Manual
Active issue: None
```

Commits continue normally without Jira references.

---

# 27. Branch Switching UX

No action occurs at branch checkout time.

There is no JiraFlow `post-checkout` hook.

Example:

```text
feat/ABC-123-login
        ↓
git switch fix/ABC-456-session
        ↓
next git commit
        ↓
JiraFlow reads current branch
        ↓
ABC-456
```

---

# 28. Disable vs Remove Contract

## Disable

```bash
jira-flow disable
```

Means:

```text
keep configuration
keep repository registered
keep linking mode
keep linked issue
stop modifying commits
```

Re-enable:

```bash
jira-flow enable
```

---

## Remove

```bash
jira-flow remove
```

Means:

```text
remove JiraFlow-owned Git integration
remove JiraFlow repository-local config
remove registry entry
preserve all foreign hooks
```

These are intentionally different operations.

---

# 29. Package Uninstall Contract

Package-manager uninstall:

```bash
npm uninstall -g jira-flow
```

must not crawl registered repositories and remove hooks.

JiraFlow should design its managed hook integration so that a missing JiraFlow executable does not permanently block normal Git work.

Users can explicitly clean repositories before uninstall through:

```bash
jira-flow repositories
```

and per-repo:

```bash
jira-flow remove
```

Package uninstall is not repository cleanup.

---

# 30. Headless/TUI Parity Requirement

Every meaningful TUI action must map to an engine operation.

| TUI action | Headless equivalent |
|---|---|
| Initialize | `jira-flow init` |
| Status | `jira-flow status` |
| Link issue | `jira-flow link ABC-123` |
| Clear linked issue | `jira-flow unlink` |
| Change mode | `jira-flow mode hybrid` |
| Enable | `jira-flow enable` |
| Disable | `jira-flow disable` |
| Doctor | `jira-flow doctor` |
| Generate PR title | `jira-flow pr-title` |
| Configure workflow | `jira-flow config ...` |
| Remove | `jira-flow remove` |
| View repositories | `jira-flow repositories` |

Architecture rule:

> If an operation only exists in OpenTUI, the business logic is probably in the wrong layer.

---

# 31. v1.0 Feature Scope

The following features are required for `1.0.0`.

## Core rewrite

- TypeScript implementation
- Bun-based toolchain/runtime strategy
- OpenTUI management UI
- one JiraFlow executable
- macOS/Windows/Linux support
- preserved `jira-flow` package identity

## Git engine

- repository detection
- repository-root resolution
- real Git-dir resolution
- effective hook-path resolution
- worktree-compatible path handling
- `core.hooksPath` awareness
- safe `commit-msg` integration
- explicit JiraFlow hook ownership
- foreign hook preservation
- idempotent installation
- idempotent removal
- no `post-checkout` hook

## State

- Git-local repository config
- SQLite global registry/cache
- global default settings
- repository override settings
- SQLite schema migrations

## Modes

- Hybrid
- Branch
- Manual
- Enabled/Disabled independent from mode
- linked issue persistence
- Hybrid overrides
- Manual issue linking

## Commit behavior

- silent normal operation
- no issue -> no-op
- non-blocking ordinary commits
- idempotent Jira-reference insertion
- footer format
- suffix format
- prefix format
- scope format

## CLI

- `jira-flow`
- `--help`
- `--version`
- `init`
- `status`
- `link`
- `unlink`
- `mode`
- `enable`
- `disable`
- `remove`
- `doctor`
- `pr-title`
- `repositories`
- `config`
- internal `hook commit-msg`
- JSON output for key read-only commands

## TUI

- context-aware startup
- empty state
- unconfigured-repo flow
- setup
- setup customization
- global dashboard
- repository overview
- issue linking
- mode selection
- workflow settings
- PR-title generator
- Doctor
- global settings
- missing-repository flow
- safe removal confirmation

## PR title

- local-only PR title generation
- global template
- repo template override
- variables:
  - `{jiraKey}`
  - `{storyTitle}`
  - `{branch}`
  - `{repo}`
  - `{date}`
  - `{quarter}`
- clipboard copy
- story-title prompt
- story-title cache in SQLite

## Health

- repo Doctor
- global Doctor
- detect missing integration
- detect invalid local config
- detect invalid issue regex
- detect stale/missing repo paths
- repair JiraFlow-owned integration
- registry/cache reconciliation

---

# 32. Deferred Beyond v1.0

The following are explicitly deferred.

## Jira integrations

- Jira API
- Jira Cloud authentication
- Jira issue lookup
- automatic official story-title retrieval
- issue status
- assignee
- Jira transitions

## Remote Git provider integrations

- GitHub API
- GitHub CLI requirement
- automatic PR creation
- GitLab API
- Bitbucket API
- PR review automation

## Policy enforcement

- strict mode that blocks commits without Jira keys
- organization/team-enforced templates
- signed policy bundles
- centrally managed company rules

## Advanced formatting

- arbitrary commit templates
- conditional template expressions
- custom scripting
- custom template functions

## Repository discovery

- background filesystem scanning
- automatic discovery of all Git repositories
- automatic moved-repo matching by remote identity

## PR-title extensions

- fiscal-quarter configuration
- remote PR creation
- automatic Jira story-title fetching
- provider-specific templates

## Distribution extras

- Homebrew as a required v1 channel
- Chocolatey
- Scoop
- Winget
- curl installer
- Docker image

These can be added later only when the core v1 workflow is stable.

---

# 33. Possible v1.x Follow-Ups

Good candidates after `1.0.0`:

### v1.1

- automatic moved-repository recognition by Git remote identity
- additional package-manager distribution
- richer Doctor explanations
- improved dashboard filtering/search

### v1.2

- fiscal-quarter rules for PR templates
- more PR-title convenience metadata
- optional team-shared config export/import

### Later optional integrations

- opt-in Jira metadata adapter
- opt-in GitHub CLI adapter for PR creation
- provider adapters that consume the same headless engine

These must remain optional and layered above the local JiraFlow core.

---

# 34. Product Architecture Boundary

Conceptual architecture:

```text
                 JiraFlow

        ┌──────────────────────┐
        │      OpenTUI         │
        │  Management Layer    │
        └──────────┬───────────┘
                   │
        ┌──────────▼───────────┐
        │   Headless Engine    │
        └──────────┬───────────┘
                   │
       ┌───────────┴────────────┐
       │                        │
 Git-local config         SQLite registry
 source of truth          discovery/cache
       │
 commit-msg integration
```

The OpenTUI layer may read view models from the engine and invoke engine commands/services.

It must not:

- manipulate Git hooks directly
- write Git config directly
- query SQLite directly for authoritative repo decisions
- implement commit-message mutation
- implement mode resolution independently

---

# 35. Final v1 Product Decisions

The following decisions are considered locked for the v1 product direction unless a later design review explicitly changes them:

1. JiraFlow remains the product/package name.
2. `0.x` remains historical Go; `1.0.0` is the TypeScript rewrite.
3. TypeScript + Bun + OpenTUI is the rewrite direction.
4. JiraFlow has a headless engine and a TUI control plane.
5. The TUI is optional.
6. Every meaningful TUI action has a headless equivalent.
7. Hybrid is the default linking mode.
8. Modes are Hybrid, Branch, and Manual.
9. Enabled/Disabled is independent from linking mode.
10. Git-local configuration is authoritative repository state.
11. SQLite is registry/cache/convenience metadata/global preferences.
12. SQLite deletion must not break commit-time behavior.
13. JiraFlow uses one `commit-msg` integration.
14. There is no `post-checkout` hook.
15. JiraFlow never silently overwrites foreign hooks.
16. No active Jira issue is a normal no-op state.
17. v1.0 does not block commits because a Jira key is absent.
18. Commit processing is silent during normal operation.
19. Commit formatting is configurable through presets.
20. Footer is the default commit format.
21. PR-title generation is part of v1.0.
22. PR-title generation is local-only.
23. Story titles are prompted/cached locally, not fetched from Jira.
24. Jira API integration is not part of v1.0.
25. GitHub API / GitHub CLI is not required.
26. `jira-flow doctor` is a first-class feature.
27. Package uninstall does not crawl or mutate repositories.
28. Repository initialization is idempotent.
29. Running init from `main`, `develop`, or any non-ticket branch is valid.
30. v1.0 is a rewrite of the product, not a line-by-line port of the Go implementation.

---

# 36. Next Artifact

This product specification should feed the next planning stage.

The next artifact should be an **implementation architecture / technical design**, covering:

- package/module boundaries
- TypeScript project layout
- engine interfaces
- Git adapter
- hook ownership/composition design
- config adapter
- SQLite repository layer
- TUI view-model architecture
- command router
- error model
- process/exit-code model
- compiled binary packaging
- test architecture
- migration/release plan from `0.5.0` to `1.0.0`

The technical architecture should implement this product specification rather than redefine the product.
