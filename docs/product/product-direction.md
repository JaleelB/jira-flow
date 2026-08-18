# JiraFlow v1 - Rewrite Product Direction & Brainstorm

TypeScript + OpenTUI rewrite direction, repository/npm migration,  
headless engine + management TUI, local state model, and bounded workflow extensions

**Repository:** [github.com/JaleelB/jira-flow](https://github.com/JaleelB/jira-flow)

> This is not the detailed v1 implementation plan and not yet the end-to-end user workflow specification. It captures the product direction and design decisions agreed during brainstorming so the next exercise can focus on the actual user journey.

## Document Map

1. Current Direction

2. What 'Replace Main' Actually Means

3. npm Migration: Go 0.x to TypeScript 1.0

4. Rewrite Technology Direction

5. Installation and Initialization Model

6. JiraFlow as Two Layers

7. State Model: Git Config + SQLite Registry

8. Repository Registration and Management

9. Linking Modes

10. Doctor / Health System

11. Commit Formatting

12. PR Title Generation

13. Explicit Non-Goals

14. Open Product Questions

15. Next Design Exercise

## 1. Current Direction

The proposed rewrite is not a port of the current Go implementation. The intention is to preserve JiraFlow's useful product idea while redesigning the implementation and user experience from first principles.

**Direction:** Rewrite JiraFlow in TypeScript, use OpenTUI for the interactive terminal UI, and keep a headless engine underneath it.

**Runtime direction:** Prefer a Bun-first implementation so TypeScript, OpenTUI, SQLite, and standalone executable distribution can live in one toolchain.

**Product direction:** Evolve JiraFlow from a small commit-prefix utility into a local management tool for the relationship between Git work and Jira references.

**Scope boundary:** Remain local-first. Jira API integration is not required for the core product.

This direction is a better fit for the maintainer's existing TypeScript/React experience and for the more interactive product JiraFlow is becoming. The goal is not to prove that TypeScript is superior to Go for CLIs; it is to choose the language and ecosystem that make this specific project easiest to design, maintain, and extend correctly.

## 2. What 'Replace Main' Actually Means

Keeping the existing GitHub repository does not erase the Go implementation. Git history, tags, and GitHub releases preserve every previous state of the project.

The existing `v0.5.0` tag already identifies the Go release. A TypeScript rewrite can be developed on a dedicated branch and eventually merged into `main`. After that merge, `main` simply represents the current v1-era codebase, while `v0.5.0` and earlier tags continue to point to the historical Go source.

```text
main today
  -> Go implementation
  -> tag v0.5.0

rewrite/v1 branch
  -> new TypeScript/OpenTUI implementation

when ready:
  rewrite/v1 -> main
  tag v1.0.0

Result:
  v0.5.0 = frozen Go source
  v1.0.0 = TypeScript rewrite
  main   = current TypeScript source
```

A permanent `legacy/go-v0.5` branch can be created if convenient for browsing, but it is not technically required because the existing tag and full Git history already preserve the old implementation.

### Recommendation: do not archive the current repository

Archiving `JaleelB/jira-flow` and creating a new repository would throw away continuity without solving a technical problem. Keeping the repository preserves stars, forks, URLs, release history, npm repository metadata, and anyone already following the project.

A new repository is justified only if the project is intentionally rebranded into a materially different product with a different package name. Based on the current direction, JiraFlow v1 still looks like the same product with a rebuilt implementation.

## 3. npm Migration: Go 0.x to TypeScript 1.0

The npm package does not need to be deleted, and the old versions do not need to disappear. The implementation language is not part of npm's version identity. The package can legitimately move from `jira-flow@0.5.0` containing a Go-binary distribution wrapper to `jira-flow@1.0.0` containing the new TypeScript/Bun-based distribution.

```text
jira-flow@0.2.x  -> legacy Go implementation
jira-flow@0.3.x  -> legacy Go implementation
jira-flow@0.4.x  -> legacy Go implementation
jira-flow@0.5.0  -> final legacy Go release
jira-flow@1.0.0  -> TypeScript/OpenTUI rewrite
```

npm intentionally treats previously published package versions as immutable. Even when a version can be unpublished, the same package-name/version combination cannot later be reused. For an established package, keeping historical versions available is normally safer than trying to erase them.

### Recommended npm transition

- Keep 0.5.0 and older versions available as historical releases.
- Develop the rewrite without moving the npm `latest` tag until it is ready.
- Publish prereleases such as `1.0.0-beta.1` or `1.0.0-rc.1` under a non-latest tag such as `next`.
- During that period, `npm install -g jira-flow` continues to install the stable legacy release, while testers can explicitly install `jira-flow@next`.
- When v1 is ready, publish `1.0.0` normally. npm will assign the default `latest` dist-tag unless a different tag is specified.
- Optionally deprecate the legacy version range after v1 is stable, with a message directing users to upgrade. Do not deprecate the entire package, because the package itself continues to be maintained.

```text
# Example release progression
npm publish --tag next       # 1.0.0-beta.x / rc.x
npm install -g jira-flow@next

# Stable cut
npm publish                  # 1.0.0 -> latest

# Optional legacy warning after v1 is proven
npm deprecate 'jira-flow@<1.0.0' "Legacy Go implementation. Upgrade to JiraFlow v1."
```

This is a very clean use of semantic versioning: v1 marks both a stable public contract and a complete implementation rewrite. Users who explicitly require the old version can still install `jira-flow@0.5.0`.

## 4. Rewrite Technology Direction

The current preferred stack for the rewrite is TypeScript + Bun + OpenTUI, with OpenTUI providing the rich terminal management interface and a headless TypeScript engine providing all actual JiraFlow operations.

| **Layer** | **Preferred role** |
| --- | --- |
| TypeScript | Primary implementation language for engine, commands, state, formatting, and orchestration. |
| Bun | Development/runtime toolchain, built-in SQLite option, and potential standalone executable compilation. |
| OpenTUI | Interactive terminal management UI. |
| Git CLI | Authoritative interface for repository discovery, Git config, effective hook path, current branch, and worktree-aware state. |
| SQLite | Global registry/index for the management dashboard; not authoritative repository config. |

### Important architectural rule

> The TUI is a control plane over JiraFlow. It must not contain the core Git/JiraFlow behavior. Every meaningful TUI action should call the same engine/API used by headless commands.

## 5. Installation and Initialization Model

The user-facing installation model should remain simple: install JiraFlow using a package manager, then run JiraFlow inside a repository.

```text
npm install -g jira-flow
# or equivalent supported package-manager installation

cd my-repository
jira-flow init
```

`jira-flow init` should be repository-scoped. It should ask Git whether the current working directory belongs to a repository. If not, it exits cleanly with a concise error. If it is a repository, JiraFlow resolves the real repository/Git paths through Git, loads existing JiraFlow state, and determines whether initialization is required.

### Conceptual init flow

```text
jira-flow init
    |
    +--> Am I inside a Git repository?
    |       no  -> explain + exit
    |       yes -> continue
    |
    +--> Resolve repository root / git dir / effective hooks path
    |
    +--> Is this repo already managed by JiraFlow?
            yes -> show current state / configure
            no  -> initialize safely
                    -> persist local config
                    -> register repo globally
                    -> install/compose managed commit-msg integration
                    -> verify health
```

The exact prompts and screens are intentionally deferred to the next user-workflow exercise. The important design point is that init must be idempotent: running it twice must not duplicate hooks or corrupt configuration.

## 6. JiraFlow as Two Layers

### Headless engine

- Repository discovery and validation.
- Read/write JiraFlow local configuration.
- Issue-key validation and branch extraction.
- Link/unlink/override state.
- Commit-message transformation.
- Hook installation, ownership, coexistence, repair, enable/disable/remove.
- Health diagnostics.
- PR-title template resolution.

### Management TUI

- Dashboard of known repositories.
- Repository detail/configuration screens.
- Current issue/branch/mode/health visibility.
- Global defaults and preferences.
- Linking and override actions.
- Doctor/repair flows.
- PR-title generation/copy experience.

### Headless commands remain first-class

```text
jira-flow init
jira-flow status
jira-flow link ABC-123
jira-flow unlink
jira-flow enable
jira-flow disable
jira-flow doctor
jira-flow pr-title
jira-flow hook commit-msg <message-file>
```

Running `jira-flow` with no subcommand can launch the TUI in an interactive terminal. Scripts, Git hooks, and automation should never need OpenTUI.

## 7. State Model: Git Config + SQLite Registry

The agreed state split is one of the strongest parts of the proposed redesign.

### Repository source of truth: Git-local configuration

Each repository should carry its actual JiraFlow configuration in local Git state, most likely `.git/config` through `git config --local`. This makes the repository authoritative even if the global dashboard database is deleted or stale.

```text
[jiraflow]
    enabled = true
    mode = hybrid
    issuePattern = ...
    commitFormat = ...
    issueKey = ABC-123     # only when a local link/override exists
```

The final exact keys/schema are still open. The important decision is that runtime commit behavior can always determine repository state from the repository itself.

### Global source of discovery: SQLite registry/index

SQLite powers the management suite by remembering which repositories JiraFlow has seen or initialized. It is an index, cache, and TUI data store, not the final authority for whether a repository is actually configured.

- Known repository path.
- Repository display name.
- Last seen / last opened time.
- Cached branch and active issue for fast dashboard rendering.
- Cached health summary.
- Optional repository identity hints such as remote URL.
- Global TUI preferences and JiraFlow defaults.

When the dashboard loads a repository, it should reconcile cached registry data with Git-local truth. If a repository moved or disappeared, the UI can mark the registry entry stale rather than pretending the old path is authoritative.

## 8. Repository Registration and Management

Repository registration should happen naturally rather than through whole-disk scanning.

- `jira-flow init` registers the current repository in the global registry.
- Launching JiraFlow from an unregistered Git repository can offer to configure/register that repository.
- The management TUI can provide an explicit Add Repository action when needed.
- JiraFlow should not continuously crawl the user's filesystem looking for Git repositories.

### Management dashboard concept

```text
JiraFlow

Repositories                            Current / selected repo
-----------------------------------     -----------------------------
● komanga          Hybrid     Healthy   Branch: feat/APP-218-reader
● emblor           Branch     Healthy   Issue:  APP-218
● skills-manager   Manual     Healthy   Mode:   Hybrid
○ portfolio        Off                 Hook:   Healthy
⚠ old-project      Missing

[Enter] Manage   [A] Add   [D] Doctor   [,] Settings
```

This is conceptual, not a locked layout. The product value is that JiraFlow becomes the place to see and manage its local state across repositories without making a central database authoritative over those repositories.

## 9. Linking Modes

| **Mode** | **Behavior** |
| --- | --- |
| Branch | Derive the active Jira issue from the current branch at commit time. |
| Manual | Use a deliberately linked issue regardless of branch until changed or unlinked. |
| Off | Keep JiraFlow configured/known but do not modify commits. |
| Hybrid | Use an explicit manual override when present; otherwise fall back to branch detection. |

### Hybrid is especially promising

```text
branch = feat/ABC-123-login
no manual override
-> ABC-123

jira-flow link OPS-992
-> OPS-992 overrides branch-derived ABC-123

jira-flow unlink
-> falls back to ABC-123 again
```

This provides a strong default workflow without forcing developers to rename branches when they temporarily need a different Jira association.

## 10. Doctor / Health System

Clarification from the discussion: the recommended feature is `jira-flow doctor`, not Docker. Docker is not currently recommended as a core distribution/runtime path because JiraFlow must integrate with Git hooks on the host machine.

Doctor should be a first-class command and TUI screen because JiraFlow modifies Git integration. It gives users a trustworthy way to understand whether the local installation is healthy.

```text
jira-flow doctor

✓ Git repository detected
✓ JiraFlow local config valid
✓ commit-msg integration present
✓ JiraFlow owns/manages its integration safely
✓ JiraFlow executable reachable
✓ Current mode: Hybrid
✓ Current issue: ABC-123
✓ Existing hooks preserved

No problems found.
```

Doctor should also detect stale registry entries, external modification of managed hooks, invalid patterns, missing executables, permission problems, and other states that the old implementation could not distinguish.

## 11. Commit Formatting

Commit formatting should be configurable rather than hard-coded to prefix the Jira key before the existing commit subject.

- Prefix: `ABC-123 feat: add login`
- Suffix: `feat: add login [ABC-123]`
- Scope-style: `feat(ABC-123): add login`
- Footer/reference line: existing commit subject followed by a Jira reference line
- Future custom template support, if it remains simple and safe.

The default should be selected only after verifying that it works with Jira's development linking expectations while preserving common commit conventions. JiraFlow should also detect an existing Jira key/reference so processing is idempotent.

## 12. PR Title Generation

Generating a company-specific PR title can fit JiraFlow without becoming a GitHub client. The clean boundary is to generate local workflow metadata, not create or manage the PR itself.

### Why it fits

JiraFlow already knows the repository, current branch, linked/derived Jira key, local date, and user-configured workflow conventions. A configurable PR-title template is therefore a natural extension of the same local Git/Jira relationship.

### Core command

```text
jira-flow pr-title

# Example configured template
{jiraKey} | {date} | {quarter} | {storyTitle}

# Result
ABC-123 | 2026-08-12 | Q3 | Add authentication timeout handling
```

The command can print the result and optionally copy it to the clipboard. The TUI can expose the same action from the selected repository.

### Template fields that are locally resolvable

- `{jiraKey}` - linked override or branch-derived issue key.
- `{date}` - local date using a configurable format.
- `{quarter}` - calendar quarter by default only if that matches the user's workflow; company fiscal-quarter rules should be configurable rather than assumed.
- `{branch}` - current branch.
- `{repo}` - repository display name.

### Fields JiraFlow cannot know without Jira API

`{storyTitle}` is the important example. Because Jira API integration is explicitly out of scope, JiraFlow cannot automatically fetch the official Jira story title.

There are still clean local options:

- `jira-flow pr-title` prompts for missing template values such as story title.
- `jira-flow link ABC-123 --title "..."` can optionally associate a local human-readable title with the current linked work item.
- The TUI can provide an editable temporary/value field before copying the generated title.

### No GitHub CLI required

The v1 feature should stop at generation/copying. It does not need `gh`, GitHub authentication, or GitHub API access. A future optional adapter could offer `jira-flow pr create` when `gh` is installed, but that should not be part of the initial product contract.

### Scope guard

> PR-title generation is not scope creep if it remains a local templating feature backed by JiraFlow's existing repository/work-item state. It becomes scope creep when JiraFlow starts owning remote PR creation, review state, GitHub authentication, or Jira network data.

## 13. Explicit Non-Goals

- Do not become a full Jira client.
- No Jira API/OAuth/token requirement for the core product.
- Do not become a GitHub/GitLab PR-management suite.
- Do not require GitHub CLI for core functionality.
- Do not use SQLite as authoritative repository configuration.
- Do not silently overwrite or delete foreign Git hooks.
- Do not require a specific branch at initialization time.
- Do not recreate the old three-binary architecture.
- Do not add Docker merely because it is another distribution target; support it only if a concrete host-integration use case emerges.

## 14. Open Product Questions

The following points are intentionally not locked yet and should be resolved while designing the real user workflow.

- Does `jira-flow init` launch a focused OpenTUI setup wizard by default, or remain a conventional prompt/command with optional flags?
- What should `jira-flow` with no arguments do when launched inside a repo vs outside a repo?
- Which linking mode is the default: Branch or Hybrid?
- Should an explicit linked issue be stored in Git local config, a JiraFlow-private Git-dir state file, or split between durable config and transient state?
- What is the safest hook-coexistence mechanism across Husky, lefthook, custom hooks, worktrees, and core.hooksPath?
- What commit-reference format should ship as the default?
- Should PR-title templates be global defaults with per-repo overrides?
- Should optional story-title metadata persist between commands or be prompted only when generating a title?
- Which install channels ship in v1.0: npm-compatible package managers only, GitHub release binaries, Homebrew later, or some combination?
- Should JiraFlow automatically clean stale repository registry entries, or only mark/offer cleanup?

## 15. Next Design Exercise

The next exercise should not jump into code architecture. It should define the complete user experience first.

Specifically, work through what JiraFlow should feel like across:

- Installation.
- First launch.
- Initializing the first repository.
- Choosing/defaulting a linking mode.
- Daily commits.
- Branch switching.
- Manual linking and hybrid overrides.
- Generating/copying a PR title.
- Disabling/re-enabling JiraFlow.
- Opening the management dashboard.
- Managing several repositories.
- Diagnosing and repairing a broken integration.
- Uninstalling/removing JiraFlow safely.

> Once that user journey is locked, derive the final v1 command surface, TUI screens, persistent state schema, engine boundaries, and implementation roadmap from it. The architecture should serve the workflow rather than determine it.

## Sources for npm registry behavior

[npm Unpublish Policy](https://docs.npmjs.com/policies/unpublish/)

[npm: Deprecating packages or package versions](https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions/)

[npm dist-tag documentation](https://docs.npmjs.com/cli/dist-tag/)

[npm semantic versioning guidance](https://docs.npmjs.com/about-semantic-versioning/)
