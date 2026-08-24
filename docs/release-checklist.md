# JiraFlow v1 Release Checklist

No step in this checklist is authorization to publish. The protected GitHub
environment and an explicit maintainer workflow dispatch are required.

## Repository gate

- [ ] Working tree contains only the intended Release Please PR changes.
- [ ] `bun ci`, `bun run typecheck`, `bun run lint`, and `bun test` pass.
- [ ] `bun run verify:release` passes.
- [ ] Product, CLI, TUI, migration, troubleshooting, architecture, safety, and
      performance docs describe current tested behavior.
- [ ] No known P0/P1 defect or unresolved destructive hook behavior.

## Remote CI gate

- [ ] Normal CI passes.
- [ ] Real-Git integration passes Linux x64, macOS arm64, macOS x64, Windows x64.
- [ ] npm and pnpm package smoke passes on all four target runners; Bun passes
      on Linux/macOS and its exact DR-0026 compatibility gate passes on Windows.
- [ ] Package smoke includes paths with spaces, repository non-mutation, exact
      version/help, init, real commit, Doctor, TUI startup, forced reinstall,
      uninstall, and missing-executable commit. Windows Bun must additionally
      prove package removal, a nonfunctional exact shim residue, and no broader
      cleanup regression.
- [ ] Additional ARM artifacts cross-build; native ARM claims are made only for
      runners actually executed.

## Version and channel

- [ ] Release Please updated `package.json`, `.release-please-manifest.json`,
      `src/version.ts`, and `CHANGELOG.md` together.
- [ ] Alpha/beta/RC config uses the intended `prerelease-type`; stable removes
      prerelease settings.
- [ ] Prerelease dispatch selects `next`; stable `1.0.0` selects `latest`.
- [ ] Requested version exactly matches package version and `v<version>` tag.

## npm/GitHub authorization

- [ ] The GitHub `release` environment has required reviewers/protection.
- [ ] `publish.yml` is configured as npm trusted publisher for `jira-flow` and
      all six native package names, with publish permission.
- [ ] Node/npm meet OIDC minimums and no long-lived npm write token is present.
- [ ] First-time package ownership/bootstrap, if required by npm, was completed
      explicitly by an authorized maintainer.
- [ ] `RELEASE_PLEASE_TOKEN` is configured only if release-PR CI triggering
      requires a GitHub App/PAT; otherwise the scoped GitHub token is used.

## Protected publish workflow

- [ ] Dispatch `.github/workflows/publish.yml` from `main` with exact version and
      channel.
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

- [ ] RC received external validation with no new destructive hook finding.
- [ ] npm `latest` still points to 0.5 until the successful 1.0.0 stable run.
- [ ] Historical 0.x versions remain available.
- [ ] No tag, GitHub Release, or npm publish is performed from a local shell.
