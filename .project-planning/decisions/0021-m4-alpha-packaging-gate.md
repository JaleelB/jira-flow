# DR-0021: M4 Alpha Packaging Gate

- Status: Accepted with remote execution gates
- Date: 2026-08-23
- Milestone: M4 — Alpha Ready

## Context

M4 requires the frozen M3 control plane, exact v0.5 migration, and a safe native
distribution path. E12 completed SPIKE-01 and accepted ADR-0009. This machine is
Linux x64, so it can execute the complete Linux package-manager matrix and
cross-compile every release target, but it cannot truthfully claim native macOS,
Windows, or ARM execution.

## Decision

The locally executable M4 gates pass:

- one compiled application provides CLI, TUI, and `hook commit-msg`;
- 275 tests cover the control plane, migration, real Git behavior, hook safety,
  and compiled application;
- npm, pnpm, and Bun global packages install from paths containing spaces;
- package installation does not mutate an existing Git repository;
- global command, exact version, help, init, real commit, Doctor, forced
  reinstall, uninstall, and missing-executable commit behavior pass;
- the packaged OpenTUI starts in a pseudo-terminal and exits through `q`;
- all six Bun/OpenTUI targets cross-compile and identify as the expected Mach-O,
  ELF, or PE32+ architecture;
- standalone archives and SHA-256 checksums verify;
- no package lifecycle script or runtime downloader is present.

M4 is not represented as remotely validated until CI runs the native
package-manager smoke on macOS and Windows. E13 must encode those mandatory
gates before any alpha publication. This is a validation boundary, not a reason
to stop roadmap execution.

## Frozen packaging boundary

- The universal npm package is a script-free resolver, not an application
  runtime.
- Platform packages carry the one compiled executable at the exact same version.
- Install and uninstall never inspect or clean repositories.
- A missing captured executable never blocks Git.
- Native packages publish before the universal package.
- No release proceeds if source, package, binary, artifact, tag, or npm versions
  can drift.

## Consequences

E13 can add CI and release automation around this boundary but cannot introduce
an install-time downloader or repository-mutating lifecycle script. Remote
platform failures must be fixed before alpha; they are release blockers, not
allowed failures.
