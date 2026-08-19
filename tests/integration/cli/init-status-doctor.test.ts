import { afterAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createTempGitRepository, type TempRepository } from "../../helpers/temp-repository";

/**
 * VT-10 / VT-11 (source-level) — init --yes, status, doctor (VS1-7..9).
 *
 * Runs the real CLI from source against isolated temp repositories. The
 * compiled-binary versions of these flows are the T-20 gate.
 */

const repos: TempRepository[] = [];
const projectRoot = join(import.meta.dir, "..", "..", "..");
const mainTs = join(projectRoot, "src", "main.ts");

afterAll(() => {
  for (const repo of repos.splice(0)) repo.cleanup();
});

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runCli(args: string[], cwd: string): Promise<RunResult> {
  const proc = Bun.spawn([process.execPath, mainTs, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, JIRAFLOW_DATA_DIR: "/nonexistent-jiraflow-data" },
  });

  return Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]).then(([stdout, stderr, exitCode]) => ({ exitCode, stdout, stderr }));
}

async function makeRepo(): Promise<TempRepository> {
  const repo = createTempGitRepository();
  repos.push(repo);
  await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);
  return repo;
}

describe("jira-flow init --yes", () => {
  test("initializes a clean repo on main with no ticket branch", async () => {
    const repo = await makeRepo();

    const result = await runCli(["init", "--yes"], repo.root);
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
    const repo = await makeRepo();
    await runCli(["init", "--yes"], repo.root);
    const second = await runCli(["init", "--yes"], repo.root);

    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain("already configured");
    const hook = await Bun.file(join(repo.root, ".git", "hooks", "commit-msg")).text();
    expect(hook.split("# >>> jiraflow managed block v1").length - 1).toBe(1);
  });

  test("init works from a nested subdirectory", async () => {
    const repo = await makeRepo();
    await Bun.write(join(repo.root, "packages", "app", "README.md"), "nested\n");

    const result = await runCli(["init", "--yes"], join(repo.root, "packages", "app"));
    expect(result.exitCode).toBe(0);
    expect(await Bun.file(join(repo.root, ".git", "hooks", "commit-msg")).exists()).toBe(true);
  });

  test("init refuses a repo with a foreign commit-msg and mutates nothing", async () => {
    const repo = await makeRepo();
    const foreign = "#!/bin/sh\nexit 0\n";
    await Bun.write(join(repo.root, ".git", "hooks", "commit-msg"), foreign);

    const result = await runCli(["init", "--yes"], repo.root);
    expect(result.exitCode).toBe(4);
    expect(result.stderr).toContain("HOOK_CONFLICT");
    expect(await Bun.file(join(repo.root, ".git", "hooks", "commit-msg")).text()).toBe(foreign);

    const config = await repo.run(["config", "--local", "--get-regexp", "^jiraflow\\."]);
    expect(config.exitCode).not.toBe(0);
  });

  test("init without --yes explains the flag is required", async () => {
    const repo = await makeRepo();
    const result = await runCli(["init"], repo.root);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  test("init outside a repository exits 3 with a concise error", async () => {
    const result = await runCli(["init", "--yes"], "/tmp");
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("NOT_A_GIT_REPOSITORY");
  });
});

describe("jira-flow status", () => {
  test("shows enabled/mode/branch/branch issue/active issue/integration", async () => {
    const repo = await makeRepo();
    await runCli(["init", "--yes"], repo.root);
    await repo.runOk(["switch", "-c", "feat/ABC-123-login"]);

    const result = await runCli(["status"], repo.root);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("JiraFlow: enabled");
    expect(result.stdout).toContain("Mode: Hybrid");
    expect(result.stdout).toContain("Branch: feat/ABC-123-login");
    expect(result.stdout).toContain("Branch issue: ABC-123");
    expect(result.stdout).toContain("Linked issue: none");
    expect(result.stdout).toContain("Active issue: ABC-123");
    expect(result.stdout).toContain("Active source: branch");
    expect(result.stdout).toContain("Commit format: footer");
    expect(result.stdout).toContain("Integration: healthy");
  });

  test("status outside a configured repo exits 3", async () => {
    const repo = await makeRepo();
    const result = await runCli(["status"], repo.root);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("REPOSITORY_NOT_CONFIGURED");
  });
});

describe("jira-flow doctor", () => {
  test("healthy slice repo reports healthy and mutates nothing", async () => {
    const repo = await makeRepo();
    await runCli(["init", "--yes"], repo.root);
    const before = await repo.runOk(["rev-parse", "HEAD"]);

    const result = await runCli(["doctor"], repo.root);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Doctor: healthy");
    expect(result.stdout).toContain("[ok] git.repository");
    expect(result.stdout).toContain("[ok] config.valid");
    expect(result.stdout).toContain("[ok] hooks.present");
    expect(result.stdout).toContain("[ok] hooks.ownership");
    expect(result.stdout).toContain("[ok] issue.pattern");
    expect(result.stdout).toContain("[ok] active-issue.resolve");

    const after = await repo.runOk(["rev-parse", "HEAD"]);
    expect(after).toBe(before);
  });

  test("doctor reports broken when the hook is missing", async () => {
    const repo = await makeRepo();
    await runCli(["init", "--yes"], repo.root);
    const { rmSync } = await import("node:fs");
    rmSync(join(repo.root, ".git", "hooks", "commit-msg"));

    const result = await runCli(["doctor"], repo.root);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Doctor: broken");
    expect(result.stdout).toContain("[fail] hooks.present");
  });

  test("doctor reports broken for an unconfigured repo", async () => {
    const repo = await makeRepo();
    const result = await runCli(["doctor"], repo.root);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Doctor: broken");
    expect(result.stdout).toContain("[fail] config.valid");
  });
});
