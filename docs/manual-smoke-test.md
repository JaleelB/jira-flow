# Cross-Platform Manual Smoke Test

Use this guide to validate the same JiraFlow build on Linux, macOS, and
Windows. Run it from a clean checkout of the release-candidate branch. Every
test repository, Git configuration file, and SQLite database is created under a
new temporary directory so the test does not touch your real repositories or
global Git configuration.

Record the tested commit before starting:

```text
OS:
Architecture:
JiraFlow commit:
JiraFlow version:
Git version:
Bun version:
Node version (package test):
npm / pnpm versions (package test):
Tester:
Date:
```

## Pass criteria

The platform passes when all of these are true:

- `--version` and `--help` run outside Git.
- Hybrid mode decorates a real commit from its branch issue.
- A worktree-linked issue overrides the branch issue.
- Branch and Manual modes select the correct issue without losing saved state.
- Disabled JiraFlow leaves a commit unchanged.
- A configured commit format is applied.
- PR-title cache, one-shot precedence, and JSON output work locally.
- Doctor detects and repairs a missing JiraFlow-owned hook.
- Deleting disposable SQLite data does not break a commit.
- Doctor explicitly re-registers the repository after SQLite deletion.
- The repository and global-dashboard TUI routes start and the global keys work.
- Removal deletes the owned hook and Git commits continue afterward.
- The optional package-manager smoke passes for the platform artifact.

Stop and record a failure if JiraFlow corrupts or removes unknown hook content,
blocks a commit after uninstall/removal, loses Git-local configuration merely
because SQLite is absent, crashes during TUI startup, or reports the wrong
binary/package version.

## Prepare the branch

On each machine, use a clean clone or a clean working tree:

```bash
git switch rewrite/v1
git pull --ff-only origin rewrite/v1
git rev-parse --short HEAD
```

PowerShell uses the same Git commands:

```powershell
git switch rewrite/v1
git pull --ff-only origin rewrite/v1
git rev-parse --short HEAD
```

The source-build test requires Git 2.39+ and Bun 1.3.14. The optional package
test also requires Node 18+, npm, and pnpm. Bun global installation uses the
Node-compatible universal launcher; a Bun-only machine must test the native
archive instead.

## Linux and macOS

Run this section in Bash or Zsh from the JiraFlow repository root.

### 1. Build and isolate the environment

```bash
bun install --frozen-lockfile
bun run build

export JF_SOURCE_ROOT="$PWD"
export JF_BIN="$JF_SOURCE_ROOT/dist/jira-flow"
export SMOKE_ROOT="$(mktemp -d)"
export SMOKE_REPO="$SMOKE_ROOT/repository with spaces"
export SMOKE_DATA="$SMOKE_ROOT/jiraflow data"
export SMOKE_GIT_CONFIG="$SMOKE_ROOT/isolated gitconfig"

mkdir -p "$SMOKE_REPO" "$SMOKE_DATA"
touch "$SMOKE_GIT_CONFIG"

export JIRAFLOW_DATA_DIR="$SMOKE_DATA"
export GIT_CONFIG_GLOBAL="$SMOKE_GIT_CONFIG"
export GIT_CONFIG_SYSTEM="$SMOKE_GIT_CONFIG"
export GIT_CONFIG_NOSYSTEM=1

printf 'JiraFlow binary: %s\nSmoke root: %s\n' "$JF_BIN" "$SMOKE_ROOT"
"$JF_BIN" --version
"$JF_BIN" --help

git init -b feat/ABC-123-smoke "$SMOKE_REPO"
cd "$SMOKE_REPO"
git config --local user.name "JiraFlow Smoke Test"
git config --local user.email "smoke@jiraflow.invalid"
```

Expected: the version matches `package.json`, help lists the public command
surface, and the temporary repository path contains spaces.

### 2. Initialize and test a branch-derived commit

```bash
"$JF_BIN" init --yes
"$JF_BIN" status
"$JF_BIN" status --json

printf 'first\n' > first.txt
git add first.txt
git commit -m "feat: first smoke commit"
git log -1 --pretty=%B
```

Expected commit message:

```text
feat: first smoke commit

Jira: ABC-123
```

Status JSON must contain `"schemaVersion": 1`. The effective hook directory
must contain `commit-msg` and must not contain a JiraFlow-created
`post-checkout`.

### 3. Test linked-issue precedence and modes

```bash
"$JF_BIN" link OPS-42 --title "Manual smoke test"
"$JF_BIN" status

printf 'second\n' > second.txt
git add second.txt
git commit -m "fix: linked issue"
git log -1 --pretty=%B

"$JF_BIN" mode branch
"$JF_BIN" status

"$JF_BIN" mode manual
"$JF_BIN" status

"$JF_BIN" disable
"$JF_BIN" status

printf 'disabled\n' > disabled.txt
git add disabled.txt
git commit -m "chore: disabled smoke"
git log -1 --pretty=%B

"$JF_BIN" enable
"$JF_BIN" mode hybrid
```

Expected:

- The linked commit uses `Jira: OPS-42`.
- Branch mode selects `ABC-123` but retains linked issue `OPS-42`.
- Manual mode selects `OPS-42`.
- The disabled commit remains exactly `chore: disabled smoke`.

### 4. Test format and PR-title behavior

```bash
"$JF_BIN" config set commitFormat suffix

printf 'suffix\n' > suffix.txt
git add suffix.txt
git commit -m "feat: suffix smoke"
git log -1 --pretty=%B

"$JF_BIN" config set commitFormat footer
"$JF_BIN" pr-title --no-copy
"$JF_BIN" pr-title --title "One-shot title" --no-copy
"$JF_BIN" pr-title --title "JSON title" --no-copy --json
```

Expected:

- The suffix subject is `feat: suffix smoke [OPS-42]`.
- The cached PR title contains `Manual smoke test`.
- The one-shot titles replace the cached title.
- JSON contains `schemaVersion: 1`, `jiraKey: OPS-42`, and
  `storyTitleSource: option`.

### 5. Test Doctor ownership and repair

```bash
"$JF_BIN" doctor
HOOK_PATH="$(git rev-parse --path-format=absolute --git-path hooks/commit-msg)"
mv "$HOOK_PATH" "$HOOK_PATH.smoke-backup"

"$JF_BIN" doctor
"$JF_BIN" doctor --repair
test -x "$HOOK_PATH" && echo "PASS: hook repaired"

rm "$HOOK_PATH.smoke-backup"
```

Expected: Doctor changes from healthy to broken when the hook is missing, then
returns to healthy after owned repair.

### 6. Test SQLite deletion and explicit reconciliation

```bash
mv "$SMOKE_DATA" "$SMOKE_DATA.deleted"

printf 'database deleted\n' > database-deleted.txt
git add database-deleted.txt
git commit -m "feat: database resilience"
git log -1 --pretty=%B

"$JF_BIN" repositories
"$JF_BIN" doctor
"$JF_BIN" doctor --repair
"$JF_BIN" repositories
"$JF_BIN" doctor
```

Expected:

- The commit still receives `Jira: OPS-42` while SQLite is absent.
- The first registry listing is empty and Doctor warns that the repository is
  not registered. This is expected: JiraFlow never scans for repositories.
- `doctor --repair` explicitly registers the current repository.
- The final listing contains `repository with spaces` and Doctor is healthy.

### 7. Test the TUI

Inside the configured repository:

```bash
"$JF_BIN"
```

Confirm S4 Repository Overview displays the current path, Hybrid mode,
`OPS-42`, healthy owned integration, and footer format. Then check:

1. `?` opens help and `Esc` closes it.
2. `P` opens PR Title Generator; `Esc` returns.
3. `D` opens Doctor; `Esc` returns.
4. `G` opens Global Dashboard; `Esc` returns.
5. `Q` exits normally.

Test startup outside Git:

```bash
cd "$SMOKE_ROOT"
"$JF_BIN"
```

Expected: S3 Global Dashboard displays the registered repository. Press `Q` to
exit, then return to the test repository:

```bash
cd "$SMOKE_REPO"
```

### 8. Test safe removal

```bash
"$JF_BIN" remove --yes
"$JF_BIN" status

HOOK_PATH="$(git rev-parse --path-format=absolute --git-path hooks/commit-msg)"
if test -e "$HOOK_PATH"; then
  echo "FAIL: commit-msg still exists"
else
  echo "PASS: owned commit-msg removed"
fi

printf 'removed\n' > removed.txt
git add removed.txt
git commit -m "chore: commit after removal"
git log -1 --pretty=%B
```

Expected: removal reports `owned-file`; status exits with
`REPOSITORY_NOT_CONFIGURED`; the hook is absent; the final commit remains
exactly `chore: commit after removal`.

## Windows

Run this section in PowerShell 7 from the JiraFlow repository root. Use Git for
Windows so generated POSIX Git hooks have a compatible shell.

### 1. Build and isolate the environment

```powershell
bun install --frozen-lockfile
bun run build

$JfSourceRoot = (Get-Location).Path
$JfBin = Join-Path $JfSourceRoot "dist\jira-flow.exe"
$SmokeRoot = Join-Path ([IO.Path]::GetTempPath()) ("jiraflow-smoke-" + [guid]::NewGuid())
$SmokeRepo = Join-Path $SmokeRoot "repository with spaces"
$SmokeData = Join-Path $SmokeRoot "jiraflow data"
$SmokeGitConfig = Join-Path $SmokeRoot "isolated gitconfig"

New-Item -ItemType Directory -Force -Path $SmokeRepo, $SmokeData | Out-Null
New-Item -ItemType File -Force -Path $SmokeGitConfig | Out-Null

$env:JIRAFLOW_DATA_DIR = $SmokeData
$env:GIT_CONFIG_GLOBAL = $SmokeGitConfig
$env:GIT_CONFIG_SYSTEM = $SmokeGitConfig
$env:GIT_CONFIG_NOSYSTEM = "1"

Write-Host "JiraFlow binary: $JfBin"
Write-Host "Smoke root: $SmokeRoot"
& $JfBin --version
& $JfBin --help

git init -b feat/ABC-123-smoke "$SmokeRepo"
Set-Location $SmokeRepo
git config --local user.name "JiraFlow Smoke Test"
git config --local user.email "smoke@jiraflow.invalid"
```

Expected: the version matches `package.json`, help lists the public command
surface, and the temporary repository path contains spaces.

### 2. Initialize and test a branch-derived commit

```powershell
& $JfBin init --yes
& $JfBin status
& $JfBin status --json

Set-Content -Path first.txt -Value "first"
git add first.txt
git commit -m "feat: first smoke commit"
git log -1 --pretty=%B
```

Expected commit message:

```text
feat: first smoke commit

Jira: ABC-123
```

Status JSON must contain `"schemaVersion": 1`. JiraFlow must create only its
`commit-msg` integration and no `post-checkout` integration.

### 3. Test linked-issue precedence and modes

```powershell
& $JfBin link OPS-42 --title "Manual smoke test"
& $JfBin status

Set-Content -Path second.txt -Value "second"
git add second.txt
git commit -m "fix: linked issue"
git log -1 --pretty=%B

& $JfBin mode branch
& $JfBin status

& $JfBin mode manual
& $JfBin status

& $JfBin disable
& $JfBin status

Set-Content -Path disabled.txt -Value "disabled"
git add disabled.txt
git commit -m "chore: disabled smoke"
git log -1 --pretty=%B

& $JfBin enable
& $JfBin mode hybrid
```

Expected:

- The linked commit uses `Jira: OPS-42`.
- Branch mode selects `ABC-123` but retains linked issue `OPS-42`.
- Manual mode selects `OPS-42`.
- The disabled commit remains exactly `chore: disabled smoke`.

### 4. Test format and PR-title behavior

```powershell
& $JfBin config set commitFormat suffix

Set-Content -Path suffix.txt -Value "suffix"
git add suffix.txt
git commit -m "feat: suffix smoke"
git log -1 --pretty=%B

& $JfBin config set commitFormat footer
& $JfBin pr-title --no-copy
& $JfBin pr-title --title "One-shot title" --no-copy
& $JfBin pr-title --title "JSON title" --no-copy --json
```

Expected: the suffix subject is `feat: suffix smoke [OPS-42]`; PR-title cache,
one-shot precedence, and schema-versioned JSON match the Linux/macOS results.

### 5. Test Doctor ownership and repair

```powershell
& $JfBin doctor
$HookPath = (git rev-parse --path-format=absolute --git-path hooks/commit-msg).Trim()
Move-Item -LiteralPath $HookPath -Destination "$HookPath.smoke-backup"

& $JfBin doctor
& $JfBin doctor --repair
if (Test-Path -LiteralPath $HookPath) { Write-Host "PASS: hook repaired" }

Remove-Item -LiteralPath "$HookPath.smoke-backup"
```

Expected: Doctor detects the missing hook and restores only JiraFlow-owned
integration.

### 6. Test SQLite deletion and explicit reconciliation

```powershell
Move-Item -LiteralPath $SmokeData -Destination "$SmokeData.deleted"

Set-Content -Path database-deleted.txt -Value "database deleted"
git add database-deleted.txt
git commit -m "feat: database resilience"
git log -1 --pretty=%B

& $JfBin repositories
& $JfBin doctor
& $JfBin doctor --repair
& $JfBin repositories
& $JfBin doctor
```

Expected: the commit still contains `Jira: OPS-42`; the recreated registry is
initially empty; Doctor warns before repair and explicitly re-registers the
repository; the final Doctor report is healthy.

### 7. Test the TUI

```powershell
& $JfBin
```

Confirm S4 Repository Overview and test `?`, `Esc`, `P`, `D`, `G`, and `Q` as
described in the Linux/macOS section.

Test startup outside Git:

```powershell
Set-Location $SmokeRoot
& $JfBin
```

Expected: S3 Global Dashboard displays the registered repository. Press `Q`,
then return:

```powershell
Set-Location $SmokeRepo
```

### 8. Test safe removal

```powershell
& $JfBin remove --yes
& $JfBin status

$HookPath = (git rev-parse --path-format=absolute --git-path hooks/commit-msg).Trim()
if (Test-Path -LiteralPath $HookPath) {
  Write-Host "FAIL: commit-msg still exists"
} else {
  Write-Host "PASS: owned commit-msg removed"
}

Set-Content -Path removed.txt -Value "removed"
git add removed.txt
git commit -m "chore: commit after removal"
git log -1 --pretty=%B
```

Expected: removal reports `owned-file`; status exits with
`REPOSITORY_NOT_CONFIGURED`; the hook is absent; the final commit remains
exactly `chore: commit after removal`.

## Optional package-manager smoke

Run this from the JiraFlow source root after completing the manual product
test. This builds a local universal package that references only the current
platform's native package, then runs the repository's isolated install,
upgrade, hook, Doctor, TUI, uninstall, and post-uninstall checks.

Choose the target matching the machine:

| Machine | Target |
|---|---|
| Linux Intel/AMD 64-bit | `linux-x64` |
| Linux ARM64 | `linux-arm64` |
| Apple Silicon Mac | `darwin-arm64` |
| Intel Mac | `darwin-x64` |
| Windows Intel/AMD 64-bit | `win32-x64` |
| Windows ARM64 | `win32-arm64` |

Linux/macOS:

```bash
cd "$JF_SOURCE_ROOT"
TARGET="linux-x64" # change using the table above
VERSION="$(bun -e 'console.log((await Bun.file("package.json").json()).version)')"

bun run build:native -- --target "$TARGET"
bun run package:native -- --target "$TARGET" --local

PACKAGE_TARBALL="$JF_SOURCE_ROOT/dist/packages/jira-flow-$VERSION.tgz"
bun run smoke:package -- --manager npm --package "$PACKAGE_TARBALL"
bun run smoke:package -- --manager pnpm --package "$PACKAGE_TARBALL"
bun run smoke:package -- --manager bun --package "$PACKAGE_TARBALL"
```

Windows PowerShell:

```powershell
Set-Location $JfSourceRoot
$Target = "win32-x64" # change using the table above
$Version = (Get-Content package.json | ConvertFrom-Json).version

bun run build:native -- --target $Target
bun run package:native -- --target $Target --local

$PackageTarball = Join-Path $JfSourceRoot "dist\packages\jira-flow-$Version.tgz"
bun run smoke:package -- --manager npm --package $PackageTarball
bun run smoke:package -- --manager pnpm --package $PackageTarball
bun run smoke:package -- --manager bun --package $PackageTarball
```

All three commands must end with `<manager> package smoke passed`. The Bun
package smoke requires Node 18+ to remain on `PATH`.

## Published RC check

After an authorized prerelease is published, repeat the manual product test
against the registry command instead of `dist/jira-flow`:

```bash
npm install -g jira-flow@next
jira-flow --version
jira-flow --help
```

On PowerShell, the commands are the same. Repeat separately with pnpm and Bun
plus Node. Confirm the installed version is the exact RC version being
evaluated, then perform upgrade and uninstall with the same package manager.

Do not publish, tag, or promote `latest` merely because this checklist passes.
Record the result and complete the protected release checklist first.

## Result record

| Platform | Architecture | Commit/version | Source smoke | npm | pnpm | Bun + Node | TUI | Result/notes |
|---|---|---|---|---|---|---|---|---|
| Linux | | | | | | | | |
| macOS | | | | | | | | |
| Windows | | | | | | | | |

