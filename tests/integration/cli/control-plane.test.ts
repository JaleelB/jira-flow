import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureCompiledBinary, runCompiledJiraFlow } from "../../helpers/run-jiraflow";
import { createTempGitRepository, type TempRepository } from "../../helpers/temp-repository";

const repos: TempRepository[] = [];
const dirs: string[] = [];
beforeAll(async () => {
  await ensureCompiledBinary();
});
afterAll(() => {
  for (const repo of repos.splice(0)) repo.cleanup();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function dataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "jiraflow-cli-control-"));
  dirs.push(dir);
  return dir;
}

describe("E7/E8 control-plane CLI", () => {
  test("global config works outside a repository and affects initialization defaults", async () => {
    const outside = mkdtempSync(join(tmpdir(), "jiraflow-outside-"));
    dirs.push(outside);
    const data = dataDir();
    const env = { JIRAFLOW_DATA_DIR: data };
    expect(
      (
        await runCompiledJiraFlow(["config", "set", "defaultMode", "manual", "--global"], {
          cwd: outside,
          env,
        })
      ).exitCode,
    ).toBe(0);
    const listed = await runCompiledJiraFlow(["config", "list", "--global"], { cwd: outside, env });
    expect(listed.stdout).toContain("defaultMode=manual");

    const repo = createTempGitRepository();
    repos.push(repo);
    await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);
    const initialized = await runCompiledJiraFlow(["init", "--yes"], {
      cwd: repo.root,
      env: { ...repo.env, ...env },
    });
    expect(initialized.exitCode).toBe(0);
    expect((await repo.runOk(["config", "--local", "--get", "jiraflow.mode"])).trim()).toBe(
      "manual",
    );
  });

  test("repositories reconciles healthy and missing rows without scanning", async () => {
    const data = dataDir();
    const repo = createTempGitRepository();
    repos.push(repo);
    await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);
    const env = { ...repo.env, JIRAFLOW_DATA_DIR: data };
    expect((await runCompiledJiraFlow(["init", "--yes"], { cwd: repo.root, env })).exitCode).toBe(
      0,
    );
    const healthy = await runCompiledJiraFlow(["repositories", "--json"], { cwd: repo.root, env });
    expect(healthy.exitCode).toBe(0);
    expect(JSON.parse(healthy.stdout).repositories[0].health).toBe("healthy");
    const path = repo.root;
    repo.cleanup();
    repos.splice(repos.indexOf(repo), 1);
    const missing = await runCompiledJiraFlow(["repositories", "--json"], {
      cwd: dirnameFor(path),
      env: { JIRAFLOW_DATA_DIR: data },
    });
    expect(JSON.parse(missing.stdout).repositories[0].health).toBe("missing");
  });

  test("Doctor outside Git reports global database and registry checks", async () => {
    const outside = mkdtempSync(join(tmpdir(), "jiraflow-doctor-global-"));
    dirs.push(outside);
    const result = await runCompiledJiraFlow(["doctor", "--json"], {
      cwd: outside,
      env: { JIRAFLOW_DATA_DIR: dataDir() },
    });
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.checks.some((check: { id: string }) => check.id === "database.available")).toBe(
      true,
    );
    expect(parsed.checks.some((check: { id: string }) => check.id === "registry.paths")).toBe(true);
  });
});

function dirnameFor(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  return normalized.slice(0, normalized.lastIndexOf("/")) || "/";
}
