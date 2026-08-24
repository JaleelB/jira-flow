# Troubleshooting

## Hook conflict or unsupported hook

Run `jira-flow doctor`. JiraFlow composes only supported `sh`, `bash`, `zsh`, or
`dash` hooks, and only when `--compose-existing-hook` is explicit. Python,
Node, binary, missing-shebang, and damaged-marker hooks are preserved and
refused. Do not delete a hook merely to make setup pass; decide how its existing
behavior should coexist first.

## Shared `core.hooksPath`

Doctor reports the resolved path and origin. A path outside the repository is
treated as shared/external. Initialization requires both:

```bash
jira-flow init --yes --compose-existing-hook --allow-shared-hooks
```

Removal never edits a shared hook because it may serve other repositories.

## Commits after uninstall

The JiraFlow shim is designed to no-op when neither its captured executable nor
`jira-flow` on `PATH` exists. If a commit is blocked, inspect the actual path
from `git rev-parse --git-path hooks/commit-msg`; an unrecognized third-party or
manually edited hook is outside JiraFlow ownership.

## Worktree issue appears wrong

Run `jira-flow status` in the affected worktree. Linked issues are stored under
that worktree's Git-resolved state path, while mode/config are repository-wide.
In Branch mode the saved linked issue is intentionally inactive; in Hybrid it
wins over the branch key.

## Invalid issue regex

`jira-flow config set issuePattern <regex>` validates the expression. If local
Git config was edited by hand and Doctor reports failure, unset the override:

```bash
jira-flow config unset issuePattern
```

Then set a valid value. The built-in pattern is `[A-Z][A-Z0-9]*-\d+`.

## Missing or moved repository

`jira-flow repositories` marks registered paths missing without scanning for a
replacement. Use the ID shown by JSON/human output:

```bash
jira-flow repositories locate <id> /new/path
jira-flow repositories forget <id>
```

Locate verifies repository identity. Forget changes only SQLite and cannot
remove hooks or Git-local configuration from the missing path.

## SQLite problems

Run `jira-flow doctor` outside a repository for global checks. The database is
a disposable registry/cache: deleting it loses dashboard rows, cached story
titles, and global preferences, but configured repositories and commit behavior
continue to work. The next control-plane command recreates the schema.

## PR title is not copied

Clipboard adapters are optional. Install/use the platform clipboard command or
copy the printed value manually. `--no-copy` suppresses the attempt. A clipboard
warning never means title generation failed.

## Bun global command says `node` is missing

The universal package launcher requires Node 18+ (DR-0023). Install Node, use
npm/pnpm, or install the native release archive for a runtime-free command.

## Windows still finds `jira-flow.exe` after `bun remove -g`

Bun 1.3.14 and 1.4.0 can remove JiraFlow's global packages while leaving Bun's
generated, nonfunctional `jira-flow.exe` shim on `PATH` (DR-0026). JiraFlow does
not delete package-manager-owned files through an uninstall script. Use npm,
pnpm, or the native archive for the supported Windows v1 lifecycle. If you
already used Bun, remove the stale file from the Bun global bin directory after
confirming `bun pm ls -g` no longer lists a JiraFlow package.

## v0.5 migration is refused

The migrator accepts only exact historical signatures. Refusal is the safe
outcome for unknown or mixed hooks. See the [migration guide](migration/v0.5-to-v1.md).
