# JiraFlow v1 Release Checklist

No step in this checklist is authorization to publish. The protected GitHub
environment and an explicit maintainer workflow dispatch are required.

## Repository gate

- [ ] Working tree contains only the intended Release Please PR changes.
- [ ] `bun ci`, `bun run typecheck`, `bun run lint`, and `bun test` pass.
- [ ] `bun run verify:release` passes.
- [ ] Product, CLI, TUI, migration, troubleshooting, architecture, safety, and
      performance docs describe current tested behavior.
- [ ] The product spec and architecture describe six validated targets and the
      direct stable v1.0.0 release policy.
- [ ] No known P0/P1 defect or unresolved destructive hook behavior.

## Remote CI gate

- [ ] Normal CI passes.
- [ ] Real-Git integration passes Linux arm64/x64, macOS arm64/x64, and Windows
      arm64/x64.
- [ ] npm and pnpm package smoke passes on all six target runners; Bun passes
      on Linux/macOS and its exact DR-0026 compatibility gate passes on Windows.
- [ ] Package smoke includes paths with spaces, repository non-mutation, exact
      version/help, init, real commit, Doctor, TUI startup, forced reinstall,
      uninstall, and missing-executable commit. Windows Bun must additionally
      prove package removal, a nonfunctional exact shim residue, and no broader
      cleanup regression.
- [ ] All six native artifacts are compiled and exercised on matching native
      architecture runners.

## Version and channel

- [ ] Release Please updated `package.json`, `.release-please-manifest.json`,
      `src/version.ts`, and `CHANGELOG.md` together.
- [ ] Release Please produces exact stable `1.0.0` with no prerelease config.
- [ ] No public alpha, beta, or RC package/tag/release exists; the first v1
      package is stable `1.0.0` on npm `latest`.
- [ ] Requested version exactly matches package version and `v<version>` tag.

## npm/GitHub authorization

- [ ] The GitHub `release` environment has required reviewers/protection.
- [ ] `publish.yml` is configured as npm trusted publisher for `jira-flow` and
      all six native package names, with publish permission.
- [ ] Node/npm meet OIDC minimums and `publish.yml` does not consume a
      long-lived npm write token. Audit repository secrets separately; revoke a
      stale token only after confirming no other workflow depends on it.
- [ ] Each package exists and its trusted publisher is configured for
      `JaleelB/jira-flow`, `publish.yml`, and the `release` environment.
- [ ] Bootstrap is resolved for the six new native package names: npm requires
      a package to exist before its trusted publisher can be configured, so no
      package is published until the maintainer-approved bootstrap path is
      ready and all seven publisher connections can be verified.
- [ ] `RELEASE_PLEASE_TOKEN` is configured only if release-PR CI triggering
      requires a GitHub App/PAT; otherwise the scoped GitHub token is used.

## Protected publish workflow

- [ ] Generate an unpublished candidate with `candidate.yml` from `main`; record
      its run ID and manually smoke-test those exact artifacts.
- [ ] Dispatch `.github/workflows/publish.yml` from `main` with version `1.0.0`
      and the successful candidate run ID.
- [ ] Reusable native package smoke succeeds before the publish job starts.
- [ ] Six native npm packages are published/verified before universal package.
- [ ] Six standalone archives and `SHA256SUMS` verify and are attested.
- [ ] Universal package manifest contains six exact optional dependencies and no
      lifecycle scripts.
- [ ] GitHub Release remains draft on failure and becomes published only after
      npm succeeds.
- [ ] Install the registry version in fresh environments and repeat `--version`,
      `--help`, TUI, real commit, Doctor, upgrade, and uninstall smoke.

## Stable-only gate

- [ ] Private M4/M5/M6 acceptance gates pass; no public prerelease is required.
- [ ] npm `latest` still points to 0.5 until the successful 1.0.0 stable run.
- [ ] Historical 0.x versions remain available.
- [ ] No tag, GitHub Release, or npm publish is performed from a local shell.
