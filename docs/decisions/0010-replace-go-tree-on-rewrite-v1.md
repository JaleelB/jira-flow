# 0010 — Replace the Go Tree on rewrite/v1

## Status

Accepted

## Context

`rewrite/v1`, `main`, and `legacy/go-v0.5` currently point at the same commit (`a8bd523`). Architecture M1 says start the TypeScript project on `rewrite/v1` and not retain the Go directory structure. Git history, tag `v0.5.0`, and `legacy/go-v0.5` preserve Go source.

## Decision

On `rewrite/v1`, replace the Go implementation in place. Do not keep a dual Go+TS tree.

Delete (once the TypeScript skeleton compiles and `--help`/`--version` work, or in the same bootstrap commit if the skeleton is added first):

- `cmd/`, `hooks/`, `internal/`, `tests/*.go`, `go.mod`, `go.sum`
- `.goreleaser.yml`
- `.changeset/`
- `scripts/install.js`, `scripts/uninstall.js`, `scripts/jira-flow.js`, `scripts/prepublish.sh`, `scripts/utils.js`
- `installScripts/` (Homebrew/curl/Docker/Windows installers are deferred beyond v1.0)
- `pnpm-lock.yaml`

Keep: `LICENSE`, repository identity, `.github/` (rewritten), `README.md` (rewrite banner until E14).

Do not rewrite Git history. Do not delete Go tags.

## Alternatives Considered

- Keep Go sources in `legacy/` inside rewrite/v1 — rejected; history already preserves them
- Incremental file-by-file port — rejected; v1 is not a line-by-line port

## Consequences

`rewrite/v1` will not build as a Go module. That is intended. Do not merge to `main` until v1 is ready.

## Related Files

- entire current Go tree

## Related Plan

- `.project-planning/plans/vs-0-vs-1-vertical-slice.md`

## Supersedes

None

## Superseded By

None

## Notes

Derived from architecture §56 M0–M1.
