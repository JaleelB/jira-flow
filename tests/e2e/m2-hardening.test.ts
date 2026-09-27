import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BEGIN_MARKER } from "../../src/infrastructure/hooks/hook-markers";
import {
  COMPILED_BINARY,
  ensureCompiledBinary,
  runCompiledJiraFlow,
} from "../helpers/run-jiraflow";
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

async function makeRepo(): Promise<TempRepository> {
  const repo = createTempGitRepository();
  repos.push(repo);
  await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);
  return repo;
}

function envFor(repo: TempRepository, dataDir: string): Record<string, string | undefined> {
  return { ...repo.env, JIRAFLOW_DATA_DIR: dataDir };
}

async function metadata(repo: TempRepository): Promise<{
  originalSha256?: string;
  backupPath?: string;
  strategy?: string;
}> {
  const path = (
    await repo.runOk([
      "rev-parse",
      "--path-format=absolute",
      "--git-path",
      "jiraflow/integration.json",
    ])
  ).trim();
  return JSON.parse(await Bun.file(path).text()) as {
    originalSha256?: string;
    backupPath?: string;
    strategy?: string;
  };
}

describe("compiled M2 hardening", () => {
  test("composed init persists originalSha256 and backupPath", async () => {
    const repo = await makeRepo();
    const env = envFor(repo, makeDataDir());
    const original = "#!/bin/sh\necho keep\nexit 0\n";
    await Bun.write(join(repo.root, ".git", "hooks", "commit-msg"), original);
    const result = await runCompiledJiraFlow(["init", "--yes", "--compose-existing-hook"], {
      cwd: repo.root,
      env,
    });
    expect(result.exitCode).toBe(0);
    const meta = await metadata(repo);
    expect(meta.strategy).toBe("composed");
    expect(meta.originalSha256).toHaveLength(64);
    expect(meta.backupPath).toBeDefined();
    expect(await Bun.file(meta.backupPath as string).text()).toBe(original);
  }, 60_000);

  test("remove --yes strips a composed block and keeps foreign content", async () => {
    const repo = await makeRepo();
    const env = envFor(repo, makeDataDir());
    await Bun.write(join(repo.root, ".git", "hooks", "commit-msg"), "#!/bin/sh\necho user-logic\n");
    expect(
      (
        await runCompiledJiraFlow(["init", "--yes", "--compose-existing-hook"], {
          cwd: repo.root,
          env,
        })
      ).exitCode,
    ).toBe(0);
    expect((await runCompiledJiraFlow(["remove", "--yes"], { cwd: repo.root, env })).exitCode).toBe(
      0,
    );
    const after = await Bun.file(join(repo.root, ".git", "hooks", "commit-msg")).text();
    expect(after).toContain("echo user-logic");
    expect(after).not.toContain(BEGIN_MARKER);
  }, 60_000);

  test("shared-hook remove keeps the shared hook and clears repo-local state", async () => {
    const repo = await makeRepo();
    const env = envFor(repo, makeDataDir());
    const shared = mkdtempSync(join(tmpdir(), "jiraflow-shared-e2e-"));
    dirs.push(shared);
    mkdirSync(shared, { recursive: true });
    const hookPath = join(shared, "commit-msg");
    await Bun.write(hookPath, "#!/bin/sh\necho shared-keep\n");
    chmodSync(hookPath, 0o755);
    await repo.runOk(["config", "--local", "core.hooksPath", shared]);
    expect(
      (
        await runCompiledJiraFlow(
          ["init", "--yes", "--compose-existing-hook", "--allow-shared-hooks"],
          { cwd: repo.root, env },
        )
      ).exitCode,
    ).toBe(0);
    expect(await Bun.file(hookPath).text()).toContain(BEGIN_MARKER);
    expect((await runCompiledJiraFlow(["remove", "--yes"], { cwd: repo.root, env })).exitCode).toBe(
      0,
    );
    expect(await Bun.file(hookPath).text()).toContain("echo shared-keep");
    expect(await Bun.file(hookPath).text()).toContain(BEGIN_MARKER);
    const cfg = await repo.run(["config", "--local", "--get-regexp", "^jiraflow\\."]);
    expect(cfg.exitCode).not.toBe(0);
  }, 60_000);

  test("doctor --repair refuses mutating a foreign hook", async () => {
    const repo = await makeRepo();
    const env = envFor(repo, makeDataDir());
    expect((await runCompiledJiraFlow(["init", "--yes"], { cwd: repo.root, env })).exitCode).toBe(
      0,
    );
    const foreign = "#!/bin/sh\necho keep-me\nexit 0\n";
    await Bun.write(join(repo.root, ".git", "hooks", "commit-msg"), foreign);
    const repaired = await runCompiledJiraFlow(["doctor", "--repair"], { cwd: repo.root, env });
    expect(repaired.exitCode).toBe(0);
    expect(await Bun.file(join(repo.root, ".git", "hooks", "commit-msg")).text()).toBe(foreign);
  }, 60_000);

  test("unsupported, binary, and malformed hooks refuse init mutation", async () => {
    const dataDir = makeDataDir();
    const cases: Array<{ name: string; content: string }> = [
      { name: "python", content: "#!/usr/bin/env python3\nprint(1)\n" },
      { name: "binary", content: `\x7fELF${"\0".repeat(24)}` },
      {
        name: "malformed",
        content: `${BEGIN_MARKER}\necho broken\n`,
      },
    ];
    for (const fixture of cases) {
      const repo = await makeRepo();
      const env = envFor(repo, dataDir);
      const hookPath = join(repo.root, ".git", "hooks", "commit-msg");
      await Bun.write(hookPath, fixture.content);
      const before = await Bun.file(hookPath).arrayBuffer();
      const result = await runCompiledJiraFlow(["init", "--yes", "--compose-existing-hook"], {
        cwd: repo.root,
        env,
      });
      expect(result.exitCode).toBe(4);
      const after = await Bun.file(hookPath).arrayBuffer();
      expect(Buffer.from(after).equals(Buffer.from(before))).toBe(true);
    }
  }, 90_000);

  test("shared hooksPath compiled consent flag matrix", async () => {
    async function sharedRepo(existing: boolean) {
      const repo = await makeRepo();
      const shared = mkdtempSync(join(tmpdir(), "jiraflow-shared-matrix-"));
      dirs.push(shared);
      mkdirSync(shared, { recursive: true });
      if (existing) {
        await Bun.write(join(shared, "commit-msg"), "#!/bin/sh\necho shared\n");
        chmodSync(join(shared, "commit-msg"), 0o755);
      }
      await repo.runOk(["config", "--local", "core.hooksPath", shared]);
      return { repo, shared, env: envFor(repo, makeDataDir()) };
    }

    for (const existing of [false, true]) {
      const yesOnly = await sharedRepo(existing);
      expect(
        (await runCompiledJiraFlow(["init", "--yes"], { cwd: yesOnly.repo.root, env: yesOnly.env }))
          .exitCode,
      ).toBe(4);
      const allowOnly = await sharedRepo(existing);
      expect(
        (
          await runCompiledJiraFlow(["init", "--yes", "--allow-shared-hooks"], {
            cwd: allowOnly.repo.root,
            env: allowOnly.env,
          })
        ).exitCode,
      ).toBe(4);
      const composeOnly = await sharedRepo(existing);
      expect(
        (
          await runCompiledJiraFlow(["init", "--yes", "--compose-existing-hook"], {
            cwd: composeOnly.repo.root,
            env: composeOnly.env,
          })
        ).exitCode,
      ).toBe(4);
      const both = await sharedRepo(existing);
      expect(
        (
          await runCompiledJiraFlow(
            ["init", "--yes", "--compose-existing-hook", "--allow-shared-hooks"],
            { cwd: both.repo.root, env: both.env },
          )
        ).exitCode,
      ).toBe(0);
      expect(await Bun.file(join(both.shared, "commit-msg")).exists()).toBe(true);
    }
  }, 120_000);

  test("unsafe scope commit is unchanged", async () => {
    const repo = await makeRepo();
    const env = envFor(repo, makeDataDir());
    expect((await runCompiledJiraFlow(["init", "--yes"], { cwd: repo.root, env })).exitCode).toBe(
      0,
    );
    expect(
      (
        await runCompiledJiraFlow(["config", "set", "commitFormat", "scope"], {
          cwd: repo.root,
          env,
        })
      ).exitCode,
    ).toBe(0);
    await repo.runOk(["switch", "-c", "feat/ABC-123-login"]);
    await repo.commit("feat(auth): keep");
    expect((await repo.runOk(["log", "-1", "--pretty=%s"])).trim()).toBe("feat(auth): keep");
  }, 60_000);

  test("active Jira issue is still applied when a different key already exists", async () => {
    const repo = await makeRepo();
    const env = envFor(repo, makeDataDir());
    expect((await runCompiledJiraFlow(["init", "--yes"], { cwd: repo.root, env })).exitCode).toBe(
      0,
    );
    await repo.runOk(["switch", "-c", "feat/ABC-123-login"]);
    await repo.commit("feat: x\n\nJira: OPS-9");
    const body = await repo.runOk(["log", "-1", "--pretty=%B"]);
    expect(body).toContain("Jira: OPS-9");
    expect(body).toContain("Jira: ABC-123");
  }, 60_000);

  test("init --mode and config list/get/set/unset", async () => {
    const repo = await makeRepo();
    const env = envFor(repo, makeDataDir());
    expect(
      (await runCompiledJiraFlow(["init", "--yes", "--mode", "branch"], { cwd: repo.root, env }))
        .exitCode,
    ).toBe(0);
    expect((await repo.runOk(["config", "--local", "--get", "jiraflow.mode"])).trim()).toBe(
      "branch",
    );

    const listed = await runCompiledJiraFlow(["config", "list"], { cwd: repo.root, env });
    expect(listed.exitCode).toBe(0);
    expect(listed.stdout).toContain("commitFormat=");
    expect(
      (await runCompiledJiraFlow(["config", "get", "mode"], { cwd: repo.root, env })).stdout.trim(),
    ).toBe("branch");
    expect(
      (
        await runCompiledJiraFlow(["config", "set", "commitFormat", "suffix"], {
          cwd: repo.root,
          env,
        })
      ).exitCode,
    ).toBe(0);
    expect(
      (
        await runCompiledJiraFlow(["config", "get", "commitFormat"], { cwd: repo.root, env })
      ).stdout.trim(),
    ).toBe("suffix");
    expect(
      (await runCompiledJiraFlow(["config", "unset", "commitFormat"], { cwd: repo.root, env }))
        .exitCode,
    ).toBe(0);
    expect(
      (
        await runCompiledJiraFlow(["config", "get", "commitFormat"], { cwd: repo.root, env })
      ).stdout.trim(),
    ).toBe("footer");
  }, 60_000);

  test("doctor --repair on an unconfigured repo does not install", async () => {
    const repo = await makeRepo();
    const env = envFor(repo, makeDataDir());
    const result = await runCompiledJiraFlow(["doctor", "--repair"], { cwd: repo.root, env });
    expect(result.exitCode).toBe(3);
    expect(await Bun.file(join(repo.root, ".git", "hooks", "commit-msg")).exists()).toBe(false);
    expect(COMPILED_BINARY.length).toBeGreaterThan(0);
  }, 60_000);
});
