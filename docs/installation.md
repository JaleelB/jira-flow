# Installation

## Package managers

The v1 release publishes a universal `jira-flow` package plus an exact-version
native package for the current platform.

```bash
npm install -g jira-flow
pnpm add -g jira-flow
bun add -g jira-flow
```

The package-manager launcher requires Node 18 or newer. npm and pnpm already
have Node. The Bun command is supported when `node` 18+ is also on `PATH`; a
Bun-only machine should use a native archive (DR-0023).

The launcher selects only the current OS/architecture, verifies that the
universal and native packages have the same version, and directly starts the
compiled application without a shell. There are no install lifecycle scripts,
downloads, repository scans, hook writes, or configuration prompts.

Verify an installation anywhere:

```bash
jira-flow --version
jira-flow --help
```

Supported release targets are macOS arm64/x64, Linux arm64/x64, and Windows
arm64/x64. The release-blocking native smoke matrix covers macOS arm64/x64,
Linux x64, and Windows x64; additional ARM artifacts remain subject to their
remote native-run gate.

## Runtime-free native archives

Release packaging produces these GitHub Release assets:

```text
jira-flow-vX.Y.Z-darwin-arm64.tar.gz
jira-flow-vX.Y.Z-darwin-x64.tar.gz
jira-flow-vX.Y.Z-linux-arm64.tar.gz
jira-flow-vX.Y.Z-linux-x64.tar.gz
jira-flow-vX.Y.Z-win32-arm64.zip
jira-flow-vX.Y.Z-win32-x64.zip
SHA256SUMS
```

Verify the checksum, extract the archive, and place `jira-flow` (or
`jira-flow.exe`) in a directory on `PATH`. The binary needs Git, but neither Bun
nor Node. JiraFlow intentionally has no curl-pipe installer in v1.

## Upgrade

Use the same package manager that installed JiraFlow:

```bash
npm install -g jira-flow@latest
pnpm add -g jira-flow@latest
bun add -g jira-flow@latest
```

Prereleases use `@next`. Hooks prefer their captured native executable and fall
back to `jira-flow` on `PATH`, so a moved upgrade remains recoverable. Running
`jira-flow doctor --repair` refreshes JiraFlow-owned integration if needed.

## Uninstall

Package-manager uninstall removes package files only:

```bash
npm uninstall -g jira-flow
pnpm remove -g jira-flow
bun remove -g jira-flow
```

It never crawls or cleans repositories. Existing JiraFlow hook shims become
non-blocking no-ops when the executable is absent. For explicit repository
cleanup, run `jira-flow remove --yes` in each repository before uninstalling.
