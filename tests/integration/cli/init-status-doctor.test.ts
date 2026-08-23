import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTempGitRepository, type TempRepository } from "../../helpers/temp-repository";

/**
 * VT-10 / VT-11 (source-level) — init --yes, status, doctor (VS1-7..9).
 *
 * Runs the real CLI from source against isolated temp repositories. The
 * compiled-binary versions of these flows are the T-20 gate.
 */

const repos: TempRepository[] = [];
const dataDirs: string[] = [];
const projectRoot = join(import.meta.dir, "..", "..", "..");
const mainTs = join(projectRoot, "src", "main.ts");

afterAll(() => {
  for (const repo of repos.splice(0)) repo.cleanup();
  for (const dir of dataDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function makeDataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "jiraflow-cli-data-"));
  dataDirs.push(dir);
  return dir;
}

function runCli(args: string[], repo: TempRepository, dataDir: string): Promise<RunResult> {
  const proc = Bun.spawn([process.execPath, mainTs, ...args], {
    cwd: repo.root,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...repo.env, JIRAFLOW_DATA_DIR: dataDir },
  });

  return Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]).then(([stdout, stderr, exitCode]) => ({ exitCode, stdout, stderr }));
}

function runCliAt(
  args: string[],
  cwd: string,
  env: Record<string, string | undefined>,
): Promise<RunResult> {
  const proc = Bun.spawn([process.execPath, mainTs, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env,
  });
  return Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]).then(([stdout, stderr, exitCode]) => ({ exitCode, stdout, stderr }));
}

async function makeRepo(): Promise<{ repo: TempRepository; dataDir: string }> {
  const repo = createTempGitRepository();
  repos.push(repo);
  await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);
  return { repo, dataDir: makeDataDir() };
}

describe("jira-flow init --yes", () => {
  test("initializes a clean repo on main with no ticket branch", async () => {
    const { repo, dataDir } = await makeRepo();

    const result = await runCli(["init", "--yes"], repo, dataDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Initialized JiraFlow");

    const mode = await repo.runOk(["config", "--local", "--get", "jiraflow.mode"]);
    expect(mode.trim()).toBe("hybrid");
    const enabled = await repo.runOk([
      "config",
      "--local",
      "--type=bool",
      "--get",
      "jiraflow.enabled",
    ]);
    expect(enabled.trim()).toBe("true");
    const format = await repo.runOk(["config", "--local", "--get", "jiraflow.commitFormat"]);
    expect(format.trim()).toBe("footer");

    const statePath = (
      await repo.runOk(["rev-parse", "--path-format=absolute", "--git-path", "jiraflow/state.json"])
    ).trim();
    const state = JSON.parse(await Bun.file(statePath).text());
    expect(state.schemaVersion).toBe(1);
    expect(state.linkedIssue).toBeNull();

    const hook = await Bun.file(join(repo.root, ".git", "hooks", "commit-msg")).text();
    expect(hook).toContain("# >>> jiraflow managed block v1");
    expect(hook).toContain("hook commit-msg");
  });

  test("init is idempotent: second call succeeds without duplicates", async () => {
    const { repo, dataDir } = await makeRepo();
    await runCli(["init", "--yes"], repo, dataDir);
    const second = await runCli(["init", "--yes"], repo, dataDir);

    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain("already configured");
    const hook = await Bun.file(join(repo.root, ".git", "hooks", "commit-msg")).text();
    expect(hook.split("# >>> jiraflow managed block v1").length - 1).toBe(1);
  });

  test("init works from a nested subdirectory", async () => {
    const { repo, dataDir } = await makeRepo();
    await Bun.write(join(repo.root, "packages", "app", "README.md"), "nested\n");

    const result = await runCliAt(["init", "--yes"], join(repo.root, "packages", "app"), {
      ...repo.env,
      JIRAFLOW_DATA_DIR: dataDir,
    });
    expect(result.exitCode).toBe(0);
    expect(await Bun.file(join(repo.root, ".git", "hooks", "commit-msg")).exists()).toBe(true);
  });

  test("init --mode branch writes branch mode", async () => {
    const { repo, dataDir } = await makeRepo();
    const result = await runCli(["init", "--yes", "--mode", "branch"], repo, dataDir);
    expect(result.exitCode).toBe(0);
    const mode = await repo.runOk(["config", "--local", "--get", "jiraflow.mode"]);
    expect(mode.trim()).toBe("branch");
  });

  test("init --yes does not compose a foreign shell hook", async () => {
    const { repo, dataDir } = await makeRepo();
    const foreign = "#!/bin/sh\necho foreign\nexit 0\n";
    await Bun.write(join(repo.root, ".git", "hooks", "commit-msg"), foreign);

    const result = await runCli(["init", "--yes"], repo, dataDir);
    expect(result.exitCode).toBe(4);
    expect(result.stderr).toContain("HOOK_CONFLICT");
    expect(await Bun.file(join(repo.root, ".git", "hooks", "commit-msg")).text()).toBe(foreign);
  });

  test("init --yes --compose-existing-hook composes a shell hook", async () => {
    const { repo, dataDir } = await makeRepo();
    const foreign = "#!/bin/sh\necho foreign\nexit 0\n";
    await Bun.write(join(repo.root, ".git", "hooks", "commit-msg"), foreign);

    const result = await runCli(["init", "--yes", "--compose-existing-hook"], repo, dataDir);
    expect(result.exitCode).toBe(0);
    const hook = await Bun.file(join(repo.root, ".git", "hooks", "commit-msg")).text();
    expect(hook).toContain("echo foreign");
    expect(hook).toContain("# >>> jiraflow managed block v1");
    const metaPath = (
      await repo.runOk([
        "rev-parse",
        "--path-format=absolute",
        "--git-path",
        "jiraflow/integration.json",
      ])
    ).trim();
    const meta = JSON.parse(await Bun.file(metaPath).text()) as {
      originalSha256?: string;
      backupPath?: string;
      strategy?: string;
    };
    expect(meta.strategy).toBe("composed");
    expect(meta.originalSha256).toHaveLength(64);
    expect(meta.backupPath).toBeDefined();
    expect(await Bun.file(meta.backupPath as string).text()).toBe(foreign);
  });

  test("init refuses a repo with a foreign commit-msg and mutates nothing", async () => {
    const { repo, dataDir } = await makeRepo();
    const foreign = "#!/bin/sh\nexit 0\n";
    await Bun.write(join(repo.root, ".git", "hooks", "commit-msg"), foreign);

    const result = await runCli(["init", "--yes"], repo, dataDir);
    expect(result.exitCode).toBe(4);
    expect(result.stderr).toContain("HOOK_CONFLICT");
    expect(await Bun.file(join(repo.root, ".git", "hooks", "commit-msg")).text()).toBe(foreign);

    const config = await repo.run(["config", "--local", "--get-regexp", "^jiraflow\\."]);
    expect(config.exitCode).not.toBe(0);
  });

  test("init without --yes explains interactive setup is deferred", async () => {
    const { repo, dataDir } = await makeRepo();
    const result = await runCli(["init"], repo, dataDir);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("INTERACTIVE_SETUP_DEFERRED");
    expect(result.stderr).toContain("init --yes");
  });

  test("init outside a repository exits 3 with a concise error", async () => {
    const result = await runCliAt(["init", "--yes"], "/tmp", {
      ...process.env,
      JIRAFLOW_DATA_DIR: makeDataDir(),
    });
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("NOT_A_GIT_REPOSITORY");
  });
});

describe("jira-flow status", () => {
  test("shows enabled/mode/branch/branch issue/active issue/integration", async () => {
    const { repo, dataDir } = await makeRepo();
    await runCli(["init", "--yes"], repo, dataDir);
    await repo.runOk(["switch", "-c", "feat/ABC-123-login"]);

    const result = await runCli(["status"], repo, dataDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("enabled");
    expect(result.stdout).toContain("Hybrid");
    expect(result.stdout).toContain("feat/ABC-123-login");
    expect(result.stdout).toContain("ABC-123");
    expect(result.stdout).toContain("none");
    expect(result.stdout).toContain("branch");
    expect(result.stdout).toContain("footer");
    expect(result.stdout).toContain("healthy");
  });

  test("status --json includes schemaVersion", async () => {
    const { repo, dataDir } = await makeRepo();
    await runCli(["init", "--yes"], repo, dataDir);
    const result = await runCli(["status", "--json"], repo, dataDir);
    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.schemaVersion).toBe(1);
    expect(payload.mode).toBe("hybrid");
    expect(payload.enabled).toBe(true);
  });

  test("status outside a configured repo exits 3", async () => {
    const { repo, dataDir } = await makeRepo();
    const result = await runCli(["status"], repo, dataDir);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("REPOSITORY_NOT_CONFIGURED");
  });
});

describe("jira-flow doctor", () => {
  test("healthy slice repo reports healthy and mutates nothing", async () => {
    const { repo, dataDir } = await makeRepo();
    await runCli(["init", "--yes"], repo, dataDir);
    const before = await repo.runOk(["rev-parse", "HEAD"]);

    const result = await runCli(["doctor"], repo, dataDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Doctor: healthy");
    expect(result.stdout).toContain("[ok] git.repository");
    expect(result.stdout).toContain("[ok] config.valid");
    expect(result.stdout).toContain("[ok] hooks.integration");
    expect(result.stdout).toContain("[ok] hooks.ownership");
    expect(result.stdout).toContain("[ok] issue.pattern");
    expect(result.stdout).toContain("[ok] active-issue.resolve");

    const after = await repo.runOk(["rev-parse", "HEAD"]);
    expect(after).toBe(before);
  });

  test("doctor --json is schemaVersion 1", async () => {
    const { repo, dataDir } = await makeRepo();
    await runCli(["init", "--yes"], repo, dataDir);
    const result = await runCli(["doctor", "--json"], repo, dataDir);
    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.schemaVersion).toBe(1);
    expect(payload.overall).toBe("healthy");
    expect(Array.isArray(payload.checks)).toBe(true);
  });

  test("doctor reports broken when the hook is missing", async () => {
    const { repo, dataDir } = await makeRepo();
    await runCli(["init", "--yes"], repo, dataDir);
    const { rmSync: rm } = await import("node:fs");
    rm(join(repo.root, ".git", "hooks", "commit-msg"));

    const result = await runCli(["doctor"], repo, dataDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Doctor: broken");
    expect(result.stdout).toContain("[fail] hooks.integration");
  });

  test("doctor --repair restores a missing owned hook", async () => {
    const { repo, dataDir } = await makeRepo();
    await runCli(["init", "--yes"], repo, dataDir);
    const { rmSync: rm } = await import("node:fs");
    rm(join(repo.root, ".git", "hooks", "commit-msg"));

    const result = await runCli(["doctor", "--repair"], repo, dataDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("[ok] hooks.integration");
    expect(await Bun.file(join(repo.root, ".git", "hooks", "commit-msg")).exists()).toBe(true);
  });

  test("doctor --repair refuses a foreign hook", async () => {
    const { repo, dataDir } = await makeRepo();
    await runCli(["init", "--yes"], repo, dataDir);
    const foreign = "#!/bin/sh\necho keep-me\nexit 0\n";
    await Bun.write(join(repo.root, ".git", "hooks", "commit-msg"), foreign);

    const result = await runCli(["doctor", "--repair"], repo, dataDir);
    expect(result.exitCode).toBe(0);
    expect(await Bun.file(join(repo.root, ".git", "hooks", "commit-msg")).text()).toBe(foreign);
    expect(result.stdout).toContain("[fail] hooks.ownership");
  });

  test("doctor reports broken for an unconfigured repo", async () => {
    const { repo, dataDir } = await makeRepo();
    const result = await runCli(["doctor"], repo, dataDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Doctor: broken");
    expect(result.stdout).toContain("[fail] config.valid");
  });

  test("doctor --repair on an unconfigured repo does not initialize", async () => {
    const { repo, dataDir } = await makeRepo();
    const result = await runCli(["doctor", "--repair"], repo, dataDir);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("REPOSITORY_NOT_CONFIGURED");
    expect(await Bun.file(join(repo.root, ".git", "hooks", "commit-msg")).exists()).toBe(false);
    const config = await repo.run(["config", "--local", "--get-regexp", "^jiraflow\\."]);
    expect(config.exitCode).not.toBe(0);
  });
});
