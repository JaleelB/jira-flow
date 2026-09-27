import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createIsolatedGitEnvironment } from "../helpers/git-environment";
import { ensureCompiledBinary, runCompiledJiraFlow } from "../helpers/run-jiraflow";
import { createTempGitRepository, type TempRepository } from "../helpers/temp-repository";

const repos: TempRepository[] = [];
const dirs: string[] = [];

beforeAll(async () => {
  await ensureCompiledBinary();
});

afterAll(() => {
  for (const repo of repos.splice(0)) repo.cleanup();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function makeDataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "jiraflow-e2e-data-"));
  dirs.push(dir);
  return dir;
}

function envFor(repo: TempRepository, dataDir: string): Record<string, string | undefined> {
  return {
    ...repo.env,
    JIRAFLOW_DATA_DIR: dataDir,
  };
}

async function makeRepo(): Promise<TempRepository> {
  const repo = createTempGitRepository();
  repos.push(repo);
  await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);
  return repo;
}

describe("compiled real-commit runtime (T-16)", () => {
  test("Hybrid branch, override, unlink, Manual, Branch, disabled, no issue, amend, detached", async () => {
    const repo = await makeRepo();
    const dataDir = makeDataDir();
    const env = envFor(repo, dataDir);

    expect((await runCompiledJiraFlow(["init", "--yes"], { cwd: repo.root, env })).exitCode).toBe(
      0,
    );

    await repo.runOk(["switch", "-c", "feat/ABC-123-login"]);
    await repo.commit("feat: hybrid branch");
    expect(await repo.runOk(["log", "-1", "--pretty=%B"])).toContain("Jira: ABC-123");

    expect((await runCompiledJiraFlow(["link", "OPS-9"], { cwd: repo.root, env })).exitCode).toBe(
      0,
    );
    await repo.commit("feat: hybrid override");
    const override = await repo.runOk(["log", "-1", "--pretty=%B"]);
    expect(override).toContain("Jira: OPS-9");
    expect(override).not.toContain("Jira: ABC-123");

    expect((await runCompiledJiraFlow(["unlink"], { cwd: repo.root, env })).exitCode).toBe(0);
    await repo.commit("feat: after unlink");
    expect(await repo.runOk(["log", "-1", "--pretty=%B"])).toContain("Jira: ABC-123");

    expect((await runCompiledJiraFlow(["mode", "manual"], { cwd: repo.root, env })).exitCode).toBe(
      0,
    );
    await repo.commit("feat: manual without link");
    expect(await repo.runOk(["log", "-1", "--pretty=%s"])).toContain("manual without link");
    expect(await repo.runOk(["log", "-1", "--pretty=%B"])).not.toContain("Jira:");

    expect((await runCompiledJiraFlow(["link", "MAN-1"], { cwd: repo.root, env })).exitCode).toBe(
      0,
    );
    await repo.commit("feat: manual linked");
    expect(await repo.runOk(["log", "-1", "--pretty=%B"])).toContain("Jira: MAN-1");

    expect((await runCompiledJiraFlow(["mode", "branch"], { cwd: repo.root, env })).exitCode).toBe(
      0,
    );
    const linkRefused = await runCompiledJiraFlow(["link", "ZZZ-1"], { cwd: repo.root, env });
    expect(linkRefused.exitCode).toBe(2);
    await repo.commit("feat: branch mode");
    expect(await repo.runOk(["log", "-1", "--pretty=%B"])).toContain("Jira: ABC-123");

    expect((await runCompiledJiraFlow(["mode", "hybrid"], { cwd: repo.root, env })).exitCode).toBe(
      0,
    );
    expect((await runCompiledJiraFlow(["unlink"], { cwd: repo.root, env })).exitCode).toBe(0);
    expect((await runCompiledJiraFlow(["disable"], { cwd: repo.root, env })).exitCode).toBe(0);
    await repo.commit("feat: disabled");
    expect(await repo.runOk(["log", "-1", "--pretty=%B"])).not.toContain("Jira:");
    expect((await runCompiledJiraFlow(["enable"], { cwd: repo.root, env })).exitCode).toBe(0);

    await repo.runOk(["switch", "main"]);
    await repo.commit("feat: no issue");
    expect(await repo.runOk(["log", "-1", "--pretty=%B"])).not.toContain("Jira:");

    await repo.runOk(["switch", "feat/ABC-123-login"]);
    await repo.commit("feat: amend me");
    await repo.runOk(["commit", "--amend", "--no-edit"]);
    expect((await repo.runOk(["log", "-1", "--pretty=%B"])).split("Jira: ABC-123").length - 1).toBe(
      1,
    );

    await repo.runOk(["switch", "--detach", "HEAD"]);
    await repo.commit("feat: detached");
    expect(await repo.runOk(["log", "-1", "--pretty=%B"])).not.toContain("Jira:");
  }, 90_000);

  test("path with spaces and two independent worktrees sharing commitFormat", async () => {
    const parent = mkdtempSync(join(tmpdir(), "jiraflow-space-parent-"));
    dirs.push(parent);
    const spacedRoot = join(parent, "my repo");
    mkdirSync(spacedRoot);

    const gitEnv = createIsolatedGitEnvironment();
    dirs.push(gitEnv.dir);
    const init = Bun.spawnSync(["git", "init", "-b", "main"], {
      cwd: spacedRoot,
      env: gitEnv.env,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(init.exitCode).toBe(0);
    Bun.spawnSync(["git", "config", "--local", "user.name", "JiraFlow Test"], {
      cwd: spacedRoot,
      env: gitEnv.env,
    });
    Bun.spawnSync(["git", "config", "--local", "user.email", "test@jiraflow.invalid"], {
      cwd: spacedRoot,
      env: gitEnv.env,
    });
    Bun.spawnSync(["git", "commit", "--allow-empty", "-m", "initial"], {
      cwd: spacedRoot,
      env: gitEnv.env,
    });

    const dataDir = makeDataDir();
    const env = { ...gitEnv.env, JIRAFLOW_DATA_DIR: dataDir };
    expect((await runCompiledJiraFlow(["init", "--yes"], { cwd: spacedRoot, env })).exitCode).toBe(
      0,
    );
    expect(
      (
        await runCompiledJiraFlow(["config", "set", "commitFormat", "suffix"], {
          cwd: spacedRoot,
          env,
        })
      ).exitCode,
    ).toBe(0);

    Bun.spawnSync(["git", "switch", "-c", "feat/AAA-1-one"], {
      cwd: spacedRoot,
      env: gitEnv.env,
    });
    await Bun.write(join(spacedRoot, "a.txt"), "a\n");
    Bun.spawnSync(["git", "add", "a.txt"], { cwd: spacedRoot, env: gitEnv.env });
    const commitA = Bun.spawnSync(["git", "commit", "-m", "feat: spaced"], {
      cwd: spacedRoot,
      env: gitEnv.env,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(commitA.exitCode).toBe(0);
    const messageA = Bun.spawnSync(["git", "log", "-1", "--pretty=%s"], {
      cwd: spacedRoot,
      env: gitEnv.env,
    });
    expect(messageA.stdout.toString()).toContain("[AAA-1]");

    const worktreePath = join(parent, "second-tree");
    const added = Bun.spawnSync(["git", "worktree", "add", "-b", "feat/BBB-2-two", worktreePath], {
      cwd: spacedRoot,
      env: gitEnv.env,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(added.exitCode).toBe(0);

    expect(
      (await runCompiledJiraFlow(["link", "BBB-2"], { cwd: worktreePath, env })).exitCode,
    ).toBe(0);
    await Bun.write(join(worktreePath, "b.txt"), "b\n");
    Bun.spawnSync(["git", "add", "b.txt"], { cwd: worktreePath, env: gitEnv.env });
    const commitB = Bun.spawnSync(["git", "commit", "-m", "feat: second"], {
      cwd: worktreePath,
      env: gitEnv.env,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(commitB.exitCode).toBe(0);
    const messageB = Bun.spawnSync(["git", "log", "-1", "--pretty=%s"], {
      cwd: worktreePath,
      env: gitEnv.env,
    });
    expect(messageB.stdout.toString()).toContain("[BBB-2]");
    expect(messageB.stdout.toString()).not.toContain("[AAA-1]");

    const stillA = Bun.spawnSync(["git", "log", "-1", "--pretty=%s"], {
      cwd: spacedRoot,
      env: gitEnv.env,
    });
    expect(stillA.stdout.toString()).toContain("[AAA-1]");
  }, 90_000);
});
