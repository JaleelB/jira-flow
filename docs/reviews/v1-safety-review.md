# JiraFlow v1 Safety Review

**Date:** 2026-08-23
**Result:** Pass locally; remote native execution remains release-blocking.

## Shell and process execution

- Production subprocesses use argument arrays, never `shell: true`.
- Hook paths are POSIX-normalized and single-quote escaped, including embedded
  apostrophes.
- PR-title templates use a fixed placeholder regex; no `eval` or dynamic code.
- Clipboard commands are fixed platform adapters and failure is nonfatal.
- The npm launcher selects from a fixed OS/architecture map and directly spawns
  the exact-version native executable.

## Hook writes and removal

- Git resolves the effective hook path; source contains no `.git/hooks` path.
- Unsupported/binary/malformed hooks are refused before mutation.
- Foreign shell composition requires explicit consent; shared/external paths
  require separate shared consent.
- Composition records exact original SHA-256 and a backup, and restores original
  bytes if metadata write fails.
- Writes use a same-directory temporary file, fsync, executable mode, and atomic
  rename.
- Whole-file removal requires exact generated structure while allowing a moved
  captured executable. The E14 audit added tests for both the upgrade case and
  refusal after managed-body edits.
- Shared hooks are preserved on removal. Composed hooks lose only the managed
  block. Missing executables are non-blocking.

## Migration

- Signatures come from v0.5.0 source and are anchored to the correct helper.
- Snapshot equality is rechecked immediately before any removal.
- Unknown/mixed hooks block every migration mutation.
- Failure restores exact file bytes/mode or symlink target; restoration failure
  is surfaced explicitly.
- Recognized `post-checkout` is removed and never recreated. No Manual state is
  invented.

## State and data

- Tests isolate global/system Git config, home/data directories, SQLite, hooks,
  and repositories.
- Git-local/worktree-local state remains authoritative when SQLite is missing.
- SQLite migrations are transactional and future versions are refused.
- Registry locate verifies identity; forget cannot touch the repository.
- Package install/uninstall has no lifecycle scripts and cannot scan or mutate
  repositories.

## Release supply chain

- Source, Release Please manifest, binary, npm packages, archive names, tag, and
  channel are checked for exact agreement.
- Prereleases cannot use `latest`; stable versions cannot use `next`.
- Publishing is manual on `main`, protected by an environment, OIDC-only, and
  native-package-first. Artifacts receive SHA-256 sums and GitHub attestations.
- A Bun-only launcher failure was reproduced and documented in DR-0023 instead
  of adding an install script or hidden prerequisite.

## Findings

- P1 fixed: owned-hook removal after a moved package binary could leave a stale
  integration. Removal now validates the exact generated shape independent of
  captured path.
- P0/P1 open: none known locally.
- Remote gate: macOS/Windows execution and package shims must pass CI before a
  release is authorized.
