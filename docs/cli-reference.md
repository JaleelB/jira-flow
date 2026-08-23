# CLI Reference

`jira-flow --help` and `jira-flow --version` work outside a repository. Commands
return `0` for success, `2` for usage/confirmation errors, `3` for repository or
configuration errors, `4` for hook-safety refusal, and `1` for unexpected failure.

## Setup and status

```text
jira-flow init [path]
  --yes
  --mode <hybrid|branch|manual>
  --compose-existing-hook
  --allow-shared-hooks

jira-flow status [path] [--json]
```

Bare `init` opens interactive S5 setup only in a TTY. Use `--yes` for
noninteractive defaults. Composition into a shared/external hooks path requires
both consent flags.

## Issue and workflow state

```text
jira-flow link <ISSUE> [--title <story-title>]
jira-flow unlink
jira-flow mode [hybrid|branch|manual]
jira-flow enable
jira-flow disable
```

`link` is unavailable in Branch mode. Linked issues are worktree-local. Mode
changes and enable/disable preserve the saved issue.

## Configuration

```text
jira-flow config list [--global]
jira-flow config get <key> [--global]
jira-flow config set <key> <value> [--global]
jira-flow config unset <key> [--global]
```

Repository keys are `enabled`, `mode`, `issuePattern`, `commitFormat`,
`prTitleTemplate`, and `dateFormat`. Global keys are `defaultMode`,
`defaultIssuePattern`, `defaultCommitFormat`, `defaultPrTitleTemplate`,
`defaultDateFormat`, `copyPrTitleToClipboard`, `theme`, and
`lastSelectedRepositoryId`.

Repository overrides live in local Git config. Global defaults/UI preferences
live in disposable SQLite settings. Effective precedence is one-shot input,
repository override, global default, then built-in default.

## Repository registry

```text
jira-flow repositories [--json] [--no-refresh]
jira-flow repositories locate <repository-id> <path>
jira-flow repositories forget <repository-id>
```

Listing reconciles only registered paths; it never scans the filesystem.
`locate` verifies identity before changing a missing path. `forget` removes only
the SQLite registry row, not repository configuration or hooks.

## PR titles

```text
jira-flow pr-title [--title <story-title>] [--no-copy] [--json]
```

Story title precedence is command option, local metadata cache, then interactive
prompt. A noninteractive missing title is a typed error. Clipboard failure is a
warning and does not discard the generated title.

## Doctor, migration, and removal

```text
jira-flow doctor [path] [--json] [--repair]
jira-flow migrate [path] [--yes] [--json]
jira-flow remove [--yes]
```

Doctor outside a repository runs global database/registry checks. Repair is
limited to JiraFlow-owned state. Migration previews exact v0.5 changes and
requires confirmation. Removal requires confirmation and preserves foreign or
shared hooks.

## Machine-readable output

`status --json`, `doctor --json`, `repositories --json`, `pr-title --json`, and
`migrate --json` emit stable objects with `schemaVersion: 1`. Human output may
evolve; automation should use JSON.

`jira-flow hook commit-msg <file>` is an internal command used by the installed
hook. It is deliberately omitted from normal help and must not be used as a
general scripting API.
