# Doctor, Repair, and Removal

## Doctor

```bash
jira-flow doctor
jira-flow doctor --json
jira-flow doctor --repair
```

Inside a repository, Doctor checks repository discovery, configuration,
worktree state, registry synchronization, effective hooks path, legacy v0.5
signatures, hook ownership/foreign preservation, captured executable reachability,
issue regex, mode, and active-issue resolution.

Outside Git, Doctor checks the SQLite database/schema and registered paths.
Warnings do not make repository truth dependent on SQLite.

Repair can recreate missing JiraFlow worktree state, re-register a repository,
and restore/refresh a missing or JiraFlow-owned hook. It refuses foreign,
unsupported, malformed-marker, ambiguous legacy, and unconsented shared-hook
mutations. Doctor never treats an unconfigured repository as permission to run
initialization.

## Repository removal

```bash
jira-flow remove --yes
```

Removal clears JiraFlow local config, current worktree state, integration
metadata, and the disposable registry entry. It deletes a whole hook only when
the bytes match the generated owned structure (the captured executable may have
moved after upgrade). For a composed hook it strips only the managed block.
Edited, unknown, foreign, and shared/external hooks are preserved.

## Package uninstall

Package uninstall and repository removal are intentionally separate. Package
managers remove only package files and do not search for repositories. A stale
JiraFlow hook checks the captured executable, falls back to `jira-flow` on
`PATH`, and otherwise exits successfully without changing the commit.
