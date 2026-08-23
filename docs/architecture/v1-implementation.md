# JiraFlow v1 Implemented Architecture

This document describes the release-ready implementation. The product spec,
technical architecture, ADRs, and DRs remain authoritative.

## Runtime boundaries

One compiled `jira-flow` executable provides the headless CLI, OpenTUI, and
internal `hook commit-msg` command. The main entry point dynamically selects a
composition root. The hook root imports Git/config/state and commit mutation but
not OpenTUI or SQLite; import-boundary tests enforce this.

```text
Git commit -> commit-msg shim -> compiled hook command
                              -> Git-local config
                              -> worktree-local state

CLI/OpenTUI -> application use cases -> Git adapters + disposable SQLite
```

Git CLI is authority for repository root, common/worktree Git directories,
branch, remote, and effective hooks path. No code hard-codes `.git/hooks`.

## Durable state

- Git local config: enabled, mode, issue pattern, commit format, PR-title
  template, and date-format repository overrides.
- Worktree Git-resolved JSON: schema-versioned linked issue.
- Git-resolved integration metadata/backups: hook ownership and reversible
  composition evidence.
- SQLite: registry, repository cache, issue title metadata, global defaults,
  and UI preferences only.

SQLite deletion cannot change commit behavior. Opening the control plane
recreates the database and applies ordered embedded migrations.

## SQLite schema

`schema_migrations(version, applied_at)` tracks two migrations:

1. `repositories`: stable ID/path/display/remote plus created, updated,
   last-seen, and last-opened timestamps.
2. `repository_cache`: disposable branch/issue/mode/enabled/health snapshot;
   `issue_metadata`: repository+Jira-key story titles and usage timestamps;
   `settings`: JSON global values and update time.

Foreign keys cascade cache/metadata when a registry row is forgotten. Each
connection enables foreign keys, WAL, and a 5-second busy timeout. A database
with a future migration version is refused rather than silently downgraded.

## Hook ownership

JiraFlow v1 uses only `commit-msg`. A generated owned file contains the shell
shebang and one versioned managed block. Composition inserts that block after a
supported shell shebang and stores the original hash/backup. Writes are
temporary-file, fsync, chmod, and rename operations.

Removal deletes a complete file only when its generated structure is exact; a
captured executable path may differ after upgrade. Composed removal strips only
the managed block. Shared paths are never modified by removal. Unknown,
unsupported, malformed, or changed content is preserved.

## Control plane

Headless commands and S1-S14 call the same application use cases. React owns
rendering/input only; a typed reducer owns route/history/help state. Registry
reconciliation checks known paths without filesystem crawling. Missing paths
can be located after identity verification or forgotten from SQLite.

## Distribution and release

ADR-0009 selects a script-free universal npm launcher with six optional native
packages. DR-0023 records the Node prerequisite for package-manager launchers
and the runtime-free archive alternative. Cross-builds inject package version,
Git commit, and build date; release packaging emits native npm tarballs,
standalone archives, and SHA-256 checksums.

Release Please only opens a version/changelog PR. Publishing is a manual,
protected `main` workflow after a four-platform, three-manager package matrix.
It uses npm OIDC, creates a recoverable draft, publishes native packages first,
publishes the universal package last, and exposes the GitHub Release only after
npm succeeds.
