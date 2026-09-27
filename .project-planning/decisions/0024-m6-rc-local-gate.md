# DR-0024: M6 RC Local Gate

- Status: Accepted with remote execution gates
- Date: 2026-08-23
- Milestone: M6 — RC Ready

## Context

M6 requires feature-frozen code, complete operator documentation, an explicit
safety and performance review, deterministic release artifacts, and no known
release-blocking defect. This machine can prove the full Linux x64 product and
cross-build every artifact, but cannot execute native macOS, Windows, or ARM
binaries or exercise GitHub/npm authorization.

## Decision

The locally executable M6 gates pass:

- typecheck, lint, all 285 tests, compiled build, and release-version checks
  pass from a frozen lockfile;
- the documentation contract covers README links, every public CLI/config key,
  S1-S14, migration, installation, and ownership-sensitive removal guidance;
- focused safety and performance reviews find no open P0/P1 defect;
- exact legacy migration/refusal/rollback and post-checkout removal pass;
- npm, pnpm, and Bun-with-Node Linux x64 package smoke passes install, forced
  reinstall, real hook commit, Doctor, PTY TUI, uninstall, and missing-binary
  behavior in paths containing spaces;
- six native packages and archives rebuild as Mach-O, ELF, and PE targets with
  verified exact versions and SHA-256 checksums.

The E14 hardening audit fixed owned-hook removal after an upgrade moved the
captured binary. Whole-file deletion still requires exact generated structure;
edited content is preserved. DR-0023 records the reproduced Bun-only Node
launcher limitation and selects native archives as the runtime-free channel.

## Remote release blockers

RC publication remains blocked until the configured native macOS/Windows
integration and package matrices pass, additional ARM claims are validated on
native runners, and an authorized maintainer verifies the protected release
environment and npm trusted-publisher configuration.
