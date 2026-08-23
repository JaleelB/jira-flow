# JiraFlow

JiraFlow links local Git work to Jira issue keys. It updates commit messages,
generates pull-request titles, and provides both a headless CLI and an OpenTUI
control plane—without Jira, GitHub, or `gh` API access.

JiraFlow v1 is one compiled application. Git remains repository authority;
repository settings live in local Git config, the linked issue is worktree-local,
and SQLite is only a disposable dashboard/cache database.

## Install

After v1 packages are published:

```bash
npm install -g jira-flow
# or
pnpm add -g jira-flow
# or, with Node 18+ also available
bun add -g jira-flow
```

npm and pnpm already run on Node; the universal package launcher requires Node
18+. Bun-only environments should install the runtime-free native archive from
GitHub Releases. The JiraFlow application itself is a standalone binary and
does not require Bun or Node. See [Installation](docs/installation.md).

## Quick start

From a Git repository:

```bash
jira-flow init          # interactive OpenTUI setup
jira-flow init --yes    # safe Hybrid/footer defaults, headless
jira-flow status
```

On a branch such as `feat/ABC-123-login`, the default Hybrid/footer setup turns:

```text
feat: add login
```

into:

```text
feat: add login

Jira: ABC-123
```

Override the branch issue for the current worktree:

```bash
jira-flow link OPS-42 --title "Improve login error handling"
jira-flow unlink
```

Generate a local PR title and copy it when a clipboard adapter is available:

```bash
jira-flow pr-title
jira-flow pr-title --title "Improve login error handling" --no-copy
```

Run `jira-flow` with no arguments for the OpenTUI dashboard. `?` opens help,
`Esc` goes back, and `Q` quits except on destructive confirmation screens.

## Linking modes

- **Hybrid**: worktree-linked issue first, then branch issue.
- **Branch**: branch issue only; a saved linked issue is retained but inactive.
- **Manual**: worktree-linked issue only.

Enabled/disabled is independent from mode. A missing issue is always a safe
no-op and never blocks a commit. See [Linking modes](docs/linking-modes.md).

## Commit formats

JiraFlow supports `footer` (default), `suffix`, `prefix`, and Conventional
Commit `scope`. Scope mode refuses to replace an existing non-empty scope.
See [Commit formats](docs/commit-formats.md).

## Safety model

- JiraFlow installs only `commit-msg`; v1 never installs `post-checkout`.
- Existing supported shell hooks are composed only with explicit consent.
- Shared/external `core.hooksPath` needs both composition and shared-hook consent.
- Binary, unsupported, ambiguous, and damaged hooks are refused without mutation.
- Removal deletes only an exactly generated owned hook or JiraFlow's marked block.
- A missing JiraFlow executable makes its hook a no-op, so uninstall cannot block Git.
- The commit-time path has no network, SQLite, Jira API, GitHub API, or OpenTUI dependency.

Run `jira-flow doctor` to inspect these boundaries and
`jira-flow doctor --repair` for JiraFlow-owned repairs. See
[Doctor and removal](docs/doctor-and-removal.md) and the
[safety review](docs/reviews/v1-safety-review.md).

## v0.5 migration

```bash
jira-flow migrate          # preview/prompt in a terminal
jira-flow migrate --yes    # confirmed headless migration
```

Migration recognizes only exact v0.5 wrapper/helper signatures. It removes a
legacy `post-checkout` only when ownership is proven, initializes v1 in Hybrid
mode, and never invents Manual state that v0.5 did not persist. See the
[migration guide](docs/migration/v0.5-to-v1.md).

## Documentation

- [Installation](docs/installation.md)
- [CLI reference](docs/cli-reference.md)
- [Linking modes](docs/linking-modes.md)
- [Commit formats](docs/commit-formats.md)
- [PR-title workflow](docs/pr-titles.md)
- [OpenTUI screens and keys](docs/tui.md)
- [Doctor and removal](docs/doctor-and-removal.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Implemented architecture](docs/architecture/v1-implementation.md)
- [Release checklist](docs/release-checklist.md)

Authoritative design sources remain the
[v1 product specification](docs/product/v1-product-spec.md),
[technical architecture](docs/architecture/v1-technical-architecture.md), and
[implementation roadmap](docs/planning/v1-implementation-roadmap.md).

## Development

Requirements: Bun 1.3.14 and Git 2.39+.

```bash
bun ci
bun run typecheck
bun run lint
bun test
bun run build
./dist/jira-flow --version
```

Native/release validation:

```bash
bun run build:native -- --all
bun run package:native -- --all
bun run package:release -- --all
bun run verify:release -- --artifacts
```

The legacy Go 0.5.0 implementation remains in Git history, tag `v0.5.0`, and
branch `legacy/go-v0.5`; it is not part of the v1 source tree.
