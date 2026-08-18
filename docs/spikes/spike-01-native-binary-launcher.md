# SPIKE-01 — Native Binary Package-Manager Launcher (Findings in Progress)

**Status:** In progress (VS-0-6 / architecture §67). Findings only; no
installer implementation ships from this document. Strategy selection and the
final ADR-0009 happen only when this spike completes.

## Goal

Prove the exact mechanism that lets:

```text
npm install -g jira-flow
pnpm add -g jira-flow
bun add -g jira-flow
```

expose the same standalone native JiraFlow binary reliably on macOS, Windows,
and Linux (architecture §52, §67).

## Current v0.5 baseline facts (historical input, not the strategy)

Collected from the deleted `scripts/install.js` (preserved in Git history at
`a8bd523`), `.goreleaser.yml`, and the 0.5.0 review:

- v0.5's npm `postinstall` downloaded **three** GoReleaser tarballs
  (`jiraflow`, `commitmsg`, `postco`) from GitHub releases into the package.
- The unix/Windows quick installers requested asset filenames that did not
  match GoReleaser artifacts (0.5.0 review, P1), so documented install paths
  were broken.
- Hook resolution depended on npm's global bin path even for non-npm
  installs (0.5.0 review finding: `getBinaryPath()` queries npm).
- No checksum verification, no upgrade/uninstall contract, no cache.
- Versioning had multiple competing sources of truth (package.json, tags,
  Homebrew, installer `%%VERSION%%` placeholders, Changesets).

None of this is carried forward as the strategy. It is spike input only.

## VS-0 facts learned during the v1 rewrite (this branch)

- `bun build --compile` produces a working standalone `jira-flow` binary
  (~90 MB on linux-x64 with OpenTUI included) that runs without a Bun runtime
  and without Node installed.
- OpenTUI's native renderer works inside the compiled binary (VS-0-3
  evidence: smoke screen rendered through a piped stdio run of
  `dist/jira-flow`).
- `bun:sqlite` works inside the compiled binary (VS-0-4 evidence:
  compiled probe executable performs PRAGMA + CRUD on a temp DB).
- Version injection via `--define` at build time works; `--version` needs no
  `package.json` access at runtime.
- One binary serves CLI, TUI, and the internal `hook commit-msg` command
  (ADR-0007), so the launcher only has to expose one executable.

## Candidate options (architecture §52)

### Option A — platform-specific optional npm packages

```text
jira-flow (universal launcher)
    ↓ platform/arch resolver
jira-flow-linux-x64 / jira-flow-darwin-arm64 / ... (native packages)
```

Pros:

- package registry handles artifact transport and integrity
- no GitHub download during install

Cons:

- multiple published package artifacts per release
- launcher behavior must be proven for npm, pnpm, and Bun global installs

### Option B — install-time binary resolver

```text
jira-flow package
    ↓ postinstall
resolve platform → download GitHub release asset → verify checksum
    ↓ package-local native binary
```

Pros:

- one public npm package; GitHub release stays canonical

Cons:

- network install script; exact checksum/version contract required
- postinstall must never mutate Git repos (ADR-0009 consequence, already
  enforced on this branch: no postinstall in package.json)

## Open questions to answer before selecting

1. Does `bun add -g` reliably expose a `bin`-declared launcher that execs a
   native binary on all three OSes?
2. Do npm optionalDependencies install exactly one platform package per
   consumer platform (including with pnpm)?
3. Can the launcher resolve the binary path when the package manager
   relocates/symlinks global installs (macOS Homebrew-style layouts,
   pnpm global store)?
4. Does the hook shim's captured absolute binary path survive
   `npm upgrade jira-flow` (replace-in-place vs new directory)?
5. What are the Windows `.cmd`/`.ps1` shim implications for a native exe
   launcher?
6. Can upgrade + uninstall be verified in CI (architecture §52 acceptance
   criteria: global command works, hook-captured executable resolution works,
   path-with-spaces works, no repo mutation during install, TUI runs without
   Bun installed)?

## Acceptance criteria (from architecture §52/§67)

The spike is complete only when upgrade, uninstall, global command, and
hook-captured executable resolution work on macOS/Windows/Linux, with
path-with-spaces, without mutating any Git repo during install, with the TUI
running without a separately installed Bun runtime, and reproducible in CI.

Until then, `rewrite/v1` stays `private` with no `bin` and no `postinstall`
(DR-0012), and ADR-0009 remains deferred.
