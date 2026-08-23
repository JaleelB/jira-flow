# 0009 — Platform Packages with a Script-Free Native Launcher

**Type:** ADR

## Status

Accepted

## Context

JiraFlow v1 promises that `npm install -g jira-flow`, `pnpm add -g jira-flow`,
and `bun add -g jira-flow` expose one compiled application without requiring a
separate Bun runtime. SPIKE-01 compared the two architecture-approved choices:
platform-specific optional packages and an install-time downloader.

An install-time downloader depends on a package lifecycle script, release-asset
network availability, a second checksum/version protocol, and package-manager
trust policy. Bun does not run dependency lifecycle scripts unless the package
is trusted. That makes a normal `bun add -g jira-flow` incapable of reliably
installing the executable with this design. JiraFlow v0.5 also demonstrated the
failure mode: its downloader and release artifact names drifted apart.

The optional-package prototype was exercised from paths containing spaces with
npm, pnpm, and Bun. In all three layouts, a script-free universal launcher
resolved the host package and executed its compiled binary. The smoke sequence
covered install, command lookup, exact version, help, repository initialization,
a real hook-processed commit, Doctor, forced reinstall/upgrade, uninstall, and a
commit after the captured executable disappeared. Installation itself left the
test repository's status, local config, and hooks unchanged. A packaged TUI was
also started in a pseudo-terminal without invoking a Bun runtime.

## Decision

Publish a universal `jira-flow` package plus one optional native package per
supported OS/architecture:

- `jira-flow-darwin-arm64`
- `jira-flow-darwin-x64`
- `jira-flow-linux-arm64`
- `jira-flow-linux-x64`
- `jira-flow-win32-arm64`
- `jira-flow-win32-x64`

The universal package contains a small Node-compatible CommonJS launcher and
declares all native packages as exact-version `optionalDependencies`. The
launcher selects only `process.platform`/`process.arch`, resolves the installed
package through the package manager's module layout, requires an exact version
match, and starts the native executable directly without a shell. It never
downloads, edits a repository, or runs an install lifecycle script.

The publish manifest is generated from the root version and platform map. The
registry-only optional dependencies deliberately do not appear in the source
development manifest before those packages exist; the generated tarball is the
artifact passed to `npm publish`. CI must inspect that tarball before trusted
publishing.

The compiled application remains the executable captured by the Git hook.
The universal launcher is only package-manager command resolution. Existing
hook fallback behavior handles a moved or removed captured executable without
blocking commits.

## Alternatives Considered

- Download and checksum a GitHub release asset in `postinstall` — rejected
  because ordinary Bun dependency installs do not reliably execute it, and it
  creates a second artifact-integrity/version system.
- Ship the compiled application inside one universal npm package — rejected
  because every installation would carry all platform binaries.
- Require Bun at runtime — rejected by the product installation contract and
  ADR-0001.

## Consequences

- A release publishes six native packages before the universal package, all at
  the exact same version.
- npm remains a transport for native artifacts; it is not the application
  runtime.
- x64 builds use Bun's baseline targets for wider CPU compatibility.
- Cross-compilation can validate file formats on Linux, but native execution on
  macOS and Windows remains a required CI gate.
- The release also emits standalone archives and `SHA256SUMS` for all six
  targets.

## Related Files

- `npm/launcher.cjs`
- `npm/platforms.json`
- `scripts/build-native.ts`
- `scripts/package-native.ts`
- `scripts/package-release.ts`
- `scripts/smoke-package.ts`
- `docs/spikes/spike-01-native-binary-launcher.md`

## Supersedes

The deferred packaging choice in DR-0012.

## Superseded By

None
