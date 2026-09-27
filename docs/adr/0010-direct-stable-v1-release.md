# 0010 — Direct Stable JiraFlow v1.0.0 Release

**Type:** ADR
**Status:** Accepted
**Date:** 2026-09-27

## Context

ADR-0008 established an alpha/beta/RC npm `next` channel before stable v1. The
maintainer has decided to skip public prerelease versions and make the first
public TypeScript release JiraFlow v1.0.0 stable. This changes the publication
sequence, not the product's release-readiness bar. The repository already has
an accepted six-platform native-package strategy, but its current remote test
matrix executes only four native OS/architecture combinations.

## Decision

- The first public v1 release is exactly `1.0.0`, published to npm's `latest`
  dist-tag and represented by GitHub tag/release `v1.0.0`.
- Do not publish alpha, beta, or RC versions to npm; do not create public
  GitHub prereleases. Keep npm `latest` on the existing v0.5.0 until the
  explicitly authorized stable publish succeeds.
- Release Please remains the authority for the release PR, version, and
  changelog. Its configuration and manifest must produce exact `1.0.0` across
  `package.json`, `.release-please-manifest.json`, `src/version.ts`, compiled
  executables, all npm packages, archives, and the release tag.
- The M4/M5/M6 acceptance gates remain required as private prepublication
  validation. Build and smoke candidate artifacts without publishing a
  prerelease or creating a tag/release. The exact candidate must pass local,
  compiled-binary, package-manager, and six-target native CI checks before a
  maintainer authorizes publication.
- Keep all six accepted native targets in ADR-0009: macOS arm64/x64, Linux
  arm64/x64, and Windows arm64/x64. Add native Linux arm64 and Windows arm64
  execution to the integration and package-smoke matrices; cross-compilation
  alone is insufficient evidence for stable support.
- The universal `jira-flow` npm package remains the user-facing install. Its
  six native optional packages are published first at the exact same version.
  The six standalone archives and `SHA256SUMS` are attached to the GitHub
  release.
- The v1.0.0 GitHub release uses curated notes identifying v1 as the complete
  TypeScript/Bun rewrite and v0.5.0 as the final legacy Go release. Historical
  0.x releases remain unchanged and visible.
- npm publishing remains OIDC-based through the protected GitHub `release`
  environment. The workflow must not contain a long-lived npm write token.
  External package ownership/bootstrap and registry trust configuration are
  maintainer-controlled prerequisites.
- The release workflow is manually dispatched from `main`; merging the product
  PR or Release Please PR does not itself publish or create a stable release.

## Alternatives Considered

- Publish alpha/beta/RC versions through `next` before stable — rejected by the
  maintainer's direct-to-stable release decision.
- Ship only four targets — rejected because ADR-0009 already defines six and
  GitHub-hosted Linux/Windows arm64 runners make native validation practical.
- Advertise six targets with cross-compilation alone — rejected because it
  does not exercise the binaries on the target architecture.
- Publish automatically when the Release Please PR merges — rejected; the
  stable release must remain an explicit protected action.

## Consequences

- ADR-0008's prerelease publication sequence is superseded; its Release Please
  and v0.5 `latest` protections remain in effect.
- `release-please-config.json`, `.release-please-manifest.json`,
  `.github/workflows/publish.yml`, CI matrices, release notes, and the release
  checklist must agree on stable-only `1.0.0` and all six native targets.
- The npm CLI guard must require npm 11.5.1 or newer; the release workflow uses
  Node 24.
- Six new native npm package names require account-side availability,
  ownership/bootstrap, and trusted-publisher configuration before publication.
- npm trusted-publisher configuration requires each package to already exist.
  The six new native package names therefore have a separate first-publish
  bootstrap prerequisite; do not silently use a stored token or publish a
  partial release to solve this. The maintainer must explicitly select and
  complete a compliant bootstrap path before the stable workflow can publish.
- The release remains blocked until the protected environment, npm OIDC trust,
  exact-version artifact validation, and maintainer manual smoke checks pass.

## Related Files

- `docs/adr/0008-release-please-prerelease-channel.md`
- `docs/adr/0009-native-npm-launcher-strategy.md`
- `docs/product/v1-product-spec.md` (supported-platform promise)
- `docs/architecture/v1-technical-architecture.md` (release-channel policy)
- `.github/workflows/integration.yml`
- `.github/workflows/package-smoke.yml`
- `.github/workflows/publish.yml`
- `release-please-config.json`
- `.release-please-manifest.json`
- `npm/platforms.json`
- `docs/release-checklist.md`

## Supersedes

The prerelease channel and public prerelease sequence in ADR-0008.

## Superseded By

None
