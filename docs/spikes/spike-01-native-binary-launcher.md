# SPIKE-01 — Native Binary Package-Manager Launcher

**Status:** Complete (E12, 2026-08-23)

## Outcome

SPIKE-01 selected platform-specific optional npm packages with a script-free
universal launcher. ADR-0009 records the accepted strategy and its constraints.

## Strategies evaluated

### Platform-specific optional packages — selected

The prototype generated one universal package and six native packages. Local
Linux-x64 packages were installed globally with npm, pnpm, and Bun from paths
containing spaces. Every manager exposed `jira-flow`, and the launcher resolved
the compiled executable through that manager's package layout.

The automated smoke performs:

```text
install -> --version -> --help -> init -> real commit -> doctor
        -> forced reinstall/upgrade -> uninstall -> real commit
```

It uses an isolated home, Git configuration, data directory, package-manager
prefix, and real temporary Git repository. It fingerprints repository status,
local configuration, and hooks before and after package installation. After
uninstall, the missing captured executable remains non-blocking. A package from
an npm global prefix containing spaces also rendered the OpenTUI dashboard in a
pseudo-terminal and exited through the normal `q` key path.

### Install-time downloader — rejected

The downloader requires `postinstall` to run for an untrusted dependency. Bun's
documented lifecycle security model does not do that by default, so the normal
promised `bun add -g jira-flow` path could finish without installing JiraFlow's
binary. The approach also recreates v0.5's two-source artifact naming and
integrity problem. Adding a trust prerequisite or a fragile fallback would
amend the simple installation promise, while optional packages satisfy it.

No downloader implementation remains in the repository.

## Build and artifact findings

- Bun 1.3.14 cross-compiled the application and OpenTUI renderer for
  darwin-arm64, darwin-x64 baseline, linux-arm64, linux-x64 baseline,
  win32-arm64, and win32-x64 baseline.
- Cross-builds require all locked OpenTUI optional native packages. The build
  script installs them with Bun's `--os=* --cpu=*` support when absent.
- Linux identified the resulting files as the expected Mach-O, ELF, and PE32+
  architectures.
- Release packaging produced four `.tar.gz` archives, two `.zip` archives, and
  a verified SHA-256 checksum file.
- Each npm native package contains only its binary, README, LICENSE, and
  manifest. The universal package contains only its launcher/platform map,
  README, LICENSE, and manifest.
- The generated universal manifest has six exact-version optional dependencies
  and no lifecycle scripts.

## Validation boundary

Linux-x64 execution and all three package-manager flows were validated locally.
macOS and Windows artifacts were cross-compiled and structurally checked here;
their native execution, platform shims, TUI startup, and package-manager matrix
must run in remote CI before release. Linux ARM64 and Windows ARM64 are included
because the current Bun/OpenTUI toolchain builds them successfully, but native
execution is likewise a remote-run gate.

## References

- Bun lifecycle scripts and trusted dependencies:
  https://bun.sh/docs/install/lifecycle
- Bun standalone executable targets:
  https://bun.sh/docs/bundler/executables
- npm package `os`, `cpu`, `bin`, and optional dependency fields:
  https://docs.npmjs.com/cli/v11/configuring-npm/package-json
