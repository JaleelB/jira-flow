import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  COMPILED_BINARY,
  ensureCompiledBinary,
  PROJECT_ROOT,
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

describe("compiled M2 Core Engine Acceptance Gate", () => {
  test("Hybrid, Branch, Manual, formats, CLI, doctor/repair, exit codes, custom hooksPath", async () => {
    const repo = await makeRepo();
    const dataDir = makeDataDir();
    const env = { ...repo.env, JIRAFLOW_DATA_DIR: dataDir };

    expect((await runCompiledJiraFlow(["--help"], { cwd: "/tmp" })).exitCode).toBe(0);
    expect((await runCompiledJiraFlow(["--version"], { cwd: "/tmp" })).exitCode).toBe(0);
    expect((await runCompiledJiraFlow(["not-a-command"], { cwd: "/tmp" })).exitCode).toBe(2);

    const init = await runCompiledJiraFlow(["init", "--yes"], { cwd: repo.root, env });
    expect(init.exitCode).toBe(0);

    await repo.runOk(["switch", "-c", "feat/ABC-123-login"]);
    await repo.commit("feat: hybrid");
    expect(await repo.runOk(["log", "-1", "--pretty=%B"])).toContain("Jira: ABC-123");

    expect((await runCompiledJiraFlow(["mode", "manual"], { cwd: repo.root, env })).exitCode).toBe(
      0,
    );
    expect((await runCompiledJiraFlow(["link", "MAN-2"], { cwd: repo.root, env })).exitCode).toBe(
      0,
    );
    await repo.commit("feat: manual");
    expect(await repo.runOk(["log", "-1", "--pretty=%B"])).toContain("Jira: MAN-2");

    expect((await runCompiledJiraFlow(["mode", "branch"], { cwd: repo.root, env })).exitCode).toBe(
      0,
    );
    expect((await runCompiledJiraFlow(["link", "NOPE-1"], { cwd: repo.root, env })).exitCode).toBe(
      2,
    );
    await repo.commit("feat: branch");
    expect(await repo.runOk(["log", "-1", "--pretty=%B"])).toContain("Jira: ABC-123");

    expect((await runCompiledJiraFlow(["mode", "hybrid"], { cwd: repo.root, env })).exitCode).toBe(
      0,
    );
    expect((await runCompiledJiraFlow(["unlink"], { cwd: repo.root, env })).exitCode).toBe(0);
    expect(
      (
        await runCompiledJiraFlow(["config", "set", "commitFormat", "suffix"], {
          cwd: repo.root,
          env,
        })
      ).exitCode,
    ).toBe(0);
    await repo.commit("feat: suffix");
    expect(await repo.runOk(["log", "-1", "--pretty=%s"])).toContain("[ABC-123]");

    expect(
      (
        await runCompiledJiraFlow(["config", "set", "commitFormat", "prefix"], {
          cwd: repo.root,
          env,
        })
      ).exitCode,
    ).toBe(0);
    await repo.commit("feat: prefix");
    expect((await repo.runOk(["log", "-1", "--pretty=%s"])).trim()).toMatch(/^ABC-123 /);

    expect(
      (
        await runCompiledJiraFlow(["config", "set", "commitFormat", "scope"], {
          cwd: repo.root,
          env,
        })
      ).exitCode,
    ).toBe(0);
    await repo.commit("feat: scope");
    expect((await repo.runOk(["log", "-1", "--pretty=%s"])).trim()).toBe("feat(ABC-123): scope");

    expect(
      (
        await runCompiledJiraFlow(["config", "set", "commitFormat", "footer"], {
          cwd: repo.root,
          env,
        })
      ).exitCode,
    ).toBe(0);

    const statusJson = await runCompiledJiraFlow(["status", "--json"], { cwd: repo.root, env });
    expect(statusJson.exitCode).toBe(0);
    expect(JSON.parse(statusJson.stdout).schemaVersion).toBe(1);

    const doctorJson = await runCompiledJiraFlow(["doctor", "--json"], { cwd: repo.root, env });
    expect(doctorJson.exitCode).toBe(0);
    const doctor = JSON.parse(doctorJson.stdout);
    expect(doctor.schemaVersion).toBe(1);
    expect(doctor.overall).toBe("healthy");

    rmSync(join(repo.root, ".git", "hooks", "commit-msg"));
    const repaired = await runCompiledJiraFlow(["doctor", "--repair", "--json"], {
      cwd: repo.root,
      env,
    });
    expect(repaired.exitCode).toBe(0);
    expect(JSON.parse(repaired.stdout).overall).toBe("healthy");
    expect(existsSync(join(repo.root, ".git", "hooks", "commit-msg"))).toBe(true);

    const hook = await Bun.file(join(repo.root, ".git", "hooks", "commit-msg")).text();
    expect(hook).toContain(COMPILED_BINARY.replaceAll("\\", "/"));
    expect(hook).not.toContain(".git/hooks");
  }, 90_000);

  test("custom local hooksPath and compose/shared consent", async () => {
    const repo = await makeRepo();
    const dataDir = makeDataDir();
    const env = { ...repo.env, JIRAFLOW_DATA_DIR: dataDir };
    await repo.runOk(["config", "core.hooksPath", ".githooks"]);
    await Bun.write(join(repo.root, ".githooks", ".keep"), "");

    const init = await runCompiledJiraFlow(["init", "--yes"], { cwd: repo.root, env });
    expect(init.exitCode).toBe(0);
    expect(existsSync(join(repo.root, ".githooks", "commit-msg"))).toBe(true);
    expect(existsSync(join(repo.root, ".git", "hooks", "commit-msg"))).toBe(false);

    const foreign = createTempGitRepository();
    repos.push(foreign);
    await foreign.runOk(["commit", "--allow-empty", "-m", "initial"]);
    await Bun.write(join(foreign.root, ".git", "hooks", "commit-msg"), "#!/bin/sh\nexit 0\n");
    const noCompose = await runCompiledJiraFlow(["init", "--yes"], {
      cwd: foreign.root,
      env: { ...foreign.env, JIRAFLOW_DATA_DIR: dataDir },
    });
    expect(noCompose.exitCode).toBe(4);

    const composed = await runCompiledJiraFlow(["init", "--yes", "--compose-existing-hook"], {
      cwd: foreign.root,
      env: { ...foreign.env, JIRAFLOW_DATA_DIR: dataDir },
    });
    expect(composed.exitCode).toBe(0);
    const composedHook = await Bun.file(join(foreign.root, ".git", "hooks", "commit-msg")).text();
    expect(composedHook).toContain("exit 0");
    expect(composedHook).toContain("jiraflow managed block");
  }, 60_000);

  test("hook-container import graph excludes OpenTUI and SQLite", () => {
    const srcRoot = join(PROJECT_ROOT, "src");
    const forbidden = [/@opentui/, /bun:sqlite/, /\/tui\//, /sqlite/];
    const visited = new Set<string>();
    const queue: string[] = [join(srcRoot, "bootstrap", "hook-container.ts")];
    const importPattern = /from\s+["']([^"']+)["']/g;

    while (queue.length > 0) {
      const current = queue.pop() as string;
      if (visited.has(current)) continue;
      visited.add(current);
      const source = readFileSync(current, "utf8");
      for (const match of source.matchAll(importPattern)) {
        const specifier = match[1];
        if (specifier === undefined) continue;
        for (const pattern of forbidden) {
          if (pattern.test(specifier)) {
            throw new Error(
              `hook bootstrap imports forbidden module "${specifier}" via ${current}`,
            );
          }
        }
        if (specifier.startsWith(".")) {
          const resolved = resolveRelative(current, specifier);
          if (resolved) queue.push(resolved);
        }
      }
    }
    expect(visited.size).toBeGreaterThan(0);
  });

  test("src does not hard-code .git/hooks", () => {
    const srcRoot = join(PROJECT_ROOT, "src");
    const files = listSourceFiles(srcRoot);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text.includes('".git/hooks"') || text.includes("'.git/hooks'")).toBe(false);
    }
  });
});

function listSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(path));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      out.push(path);
    }
  }
  return out;
}

function resolveRelative(fromFile: string, specifier: string): string | null {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}
