# JiraFlow v1 Performance Review

**Date:** 2026-08-23

The commit path is deliberately small: the executable selects the hook
composition root before loading the CLI/TUI container; it reads Git-local config
and worktree state, resolves the branch issue, reads one commit-message file,
and writes only when mutation changes bytes.

Hard architectural results:

- no network client or API call;
- no SQLite import/open;
- no OpenTUI/React import;
- no clipboard or registry work;
- Git queries use the Git CLI and configuration reads are grouped;
- missing/disabled/no-issue paths remain successful no-ops;
- compiled import-boundary tests fail if SQLite or OpenTUI enters the hook graph.

The recorded observational baseline in
`tests/e2e/commit-hook-baseline.json` measures five complete real Git commits
through the compiled Hybrid/footer hook. On this machine the 2026-08-23 sample
was 237.59–361.86 ms with a 299.54 ms median. This includes Git commit process
overhead and is not a flaky CI threshold (DR-0019). The test always verifies
behavior; baseline-file updates require `JIRAFLOW_RECORD_BASELINE=1`.

No performance regression warrants changing the frozen architecture. Future
optimization should profile Git process startup/config reads first and must not
weaken hook ownership, state isolation, or real-Git coverage.
