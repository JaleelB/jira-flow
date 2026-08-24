# DR-0026: Exclude Windows Bun Global Uninstall from the v1 Support Contract

## Status

Accepted amendment

## Context

The native package matrix proved install, command resolution, upgrade, hook,
Doctor, and TUI behavior for the Windows x64 Bun global channel. Uninstall then
exposed a package-manager defect: after `bun remove -g jira-flow` removes both
JiraFlow packages, Bun leaves its generated `jira-flow.exe` JavaScript command
shim in the global bin directory. The file no longer launches JiraFlow, but it
continues to resolve on `PATH`.

The behavior reproduced on clean GitHub Windows runners with Bun 1.3.14 and
1.4.0, after process-tree termination and a bounded filesystem-release wait.
npm and pnpm remove their Windows shims, and Bun removes its shims on Linux and
macOS. JiraFlow cannot remove a package-manager-owned file without an uninstall
lifecycle script; adding one would contradict ADR-0009's script-free safety
boundary and still depend on Bun running an untrusted lifecycle script.

## Decision

Windows Bun global installation is compatibility-tested but is not a supported
v1 package lifecycle channel. Windows users use npm, pnpm, or a runtime-free
native archive for supported install, upgrade, and uninstall behavior.

The Windows Bun CI case remains mandatory and may pass only when it proves all
of the following:

- install, command resolution, exact version, help, hook, Doctor, TUI, and
  upgrade behavior work;
- Bun's global manifest contains no JiraFlow package after removal;
- the captured missing executable does not block a real Git commit;
- the only residue is Bun's generated `jira-flow.exe` and it cannot launch
  JiraFlow.

Any installed JiraFlow package, functional residual command, additional file,
or behavior change is a release-blocking failure. Linux and macOS Bun-with-Node
remain supported package channels.

## Alternatives Considered

- Delete the shim from JiraFlow's smoke or an uninstall script — rejected;
  package-manager state is not JiraFlow-owned, and lifecycle mutation violates
  ADR-0009.
- Ignore all Windows Bun uninstall residue — rejected; the gate recognizes only
  the exact proven failure and verifies that JiraFlow itself is removed.
- Drop Bun testing on Windows — rejected; compatibility regressions in install,
  upgrade, native execution, hooks, Doctor, or TUI must remain visible.
- Replace the optional-package launcher with a downloader — rejected by
  ADR-0009 and Bun's lifecycle trust model.

## Consequences

- Installation, troubleshooting, smoke, and release documentation must state
  the Windows exception without implying a fully supported Bun lifecycle.
- The all-platform release gate requires npm and pnpm; Bun is release-blocking
  on Linux/macOS and compatibility-gated on Windows.
- A future Bun version may restore support after registry-based RC validation
  proves clean Windows install, upgrade, and uninstall behavior.

## Related Files

- `.github/workflows/package-smoke.yml`
- `scripts/smoke-package.ts`
- `docs/adr/0009-native-npm-launcher-strategy.md`
- `docs/installation.md`
- `docs/release-checklist.md`

## Related Plan

E12 native packaging and E13 package smoke/release automation.

## Supersedes

The Windows Bun uninstall portion of DR-0021 and DR-0024.

## Superseded By

None.

## Notes

This decision implements Architecture §52's instruction to amend the install
promise rather than ship a fragile workaround when Bun global behavior cannot
be made robust.
