# DR-0023: Bun Global Install Requires Node or the Native Archive

- Status: Accepted amendment
- Date: 2026-08-23
- Amends: Product §5.2, Architecture §52/§67, ADR-0009

## Context

ADR-0009 selected a script-free universal npm package whose CommonJS launcher
resolves an exact-version platform package and immediately executes the compiled
JiraFlow application. npm and pnpm already require Node, so this is robust for
their global installs. A dedicated Bun-only test removed `node` from `PATH` after
`bun add -g`; the installed shim failed with exit 127 at its
`#!/usr/bin/env node` shebang before it could resolve the native binary.

The architecture-approved downloader alternative does not solve this: Bun does
not run untrusted dependency lifecycle scripts by default. A single universal
npm `bin` file also cannot simultaneously be an ELF, Mach-O, PE executable, a
Node script, and a Bun script. Selecting the native dependency's `bin` requires
non-default Bun configuration and would make the documented command fragile.

## Decision

Amend the v1 installation contract explicitly:

- `npm install -g jira-flow` and `pnpm add -g jira-flow` are primary package
  channels and require Node 18 or newer, as declared by the package.
- `bun add -g jira-flow` is supported only when a compatible `node` command is
  also available. CI must state and test that prerequisite rather than imply a
  Bun-only environment works.
- Bun is never required to run the compiled JiraFlow application.
- Users wanting a runtime-free installation use the native GitHub Release
  archive for their platform.

This is a packaging-launcher prerequisite, not an application runtime
dependency. The resolved command still becomes the compiled JiraFlow process;
hooks capture that native executable, not Node or the universal launcher.

## Consequences

- Documentation must not claim Bun-only global installation.
- The package-smoke matrix sets up Node before testing all three managers.
- Native archives remain release-blocking and are the no-runtime install path.
- A future registry/package-manager capability may remove this constraint, but
  v1 ships no downloader, trust prompt, shell polyglot, or undocumented Bun
  environment switch.
