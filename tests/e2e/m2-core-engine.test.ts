import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
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

    await repo.commit("feat: retain different key\n\nJira: OTHER-9");
    const differentKeyMessage = await repo.runOk(["log", "-1", "--pretty=%B"]);
    expect(differentKeyMessage).toContain("Jira: OTHER-9");
    expect(differentKeyMessage).toContain("Jira: ABC-123");

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

    await repo.commit("feat(auth): preserve semantic scope");
    expect((await repo.runOk(["log", "-1", "--pretty=%s"])).trim()).toBe(
      "feat(auth): preserve semantic scope",
    );

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

  test("init --mode and config list/get/set/unset work through the compiled binary", async () => {
    const repo = await makeRepo();
    const env = { ...repo.env, JIRAFLOW_DATA_DIR: makeDataDir() };

    const init = await runCompiledJiraFlow(["init", "--yes", "--mode", "manual"], {
      cwd: repo.root,
      env,
    });
    expect(init.exitCode).toBe(0);
    expect((await repo.runOk(["config", "--local", "--get", "jiraflow.mode"])).trim()).toBe(
      "manual",
    );

    const listed = await runCompiledJiraFlow(["config", "list"], { cwd: repo.root, env });
    expect(listed.exitCode).toBe(0);
    expect(listed.stdout).toContain("commitFormat=footer (repo)");

    const got = await runCompiledJiraFlow(["config", "get", "commitFormat"], {
      cwd: repo.root,
      env,
    });
    expect(got.exitCode).toBe(0);
    expect(got.stdout.trim()).toBe("footer");

    expect(
      (
        await runCompiledJiraFlow(["config", "set", "commitFormat", "suffix"], {
          cwd: repo.root,
          env,
        })
      ).exitCode,
    ).toBe(0);
    expect(
      (await runCompiledJiraFlow(["config", "get", "commitFormat"], { cwd: repo.root, env }))
        .stdout,
    ).toBe("suffix\n");

    expect(
      (
        await runCompiledJiraFlow(["config", "unset", "commitFormat"], {
          cwd: repo.root,
          env,
        })
      ).exitCode,
    ).toBe(0);
    expect(
      (await runCompiledJiraFlow(["config", "get", "commitFormat"], { cwd: repo.root, env }))
        .stdout,
    ).toBe("footer\n");
  });

  test("composed init rollback restores the exact foreign hook", async () => {
    const repo = await makeRepo();
    const env = { ...repo.env, JIRAFLOW_DATA_DIR: makeDataDir() };
    const hookPath = join(repo.root, ".git", "hooks", "commit-msg");
    const foreign = '#!/bin/sh\n# exact foreign hook\necho keep "$1"\nexit 0\n';
    await Bun.write(hookPath, foreign);

    const metadataPath = (
      await repo.runOk([
        "rev-parse",
        "--path-format=absolute",
        "--git-path",
        "jiraflow/integration.json",
      ])
    ).trim();
    mkdirSync(metadataPath, { recursive: true });

    const result = await runCompiledJiraFlow(["init", "--yes", "--compose-existing-hook"], {
      cwd: repo.root,
      env,
    });
    expect(result.exitCode).not.toBe(0);
    expect(await Bun.file(hookPath).text()).toBe(foreign);
    expect(
      (await repo.run(["config", "--local", "--get-regexp", "^jiraflow\\."])).exitCode,
    ).not.toBe(0);
    const statePath = (
      await repo.runOk(["rev-parse", "--path-format=absolute", "--git-path", "jiraflow/state.json"])
    ).trim();
    expect(existsSync(statePath)).toBe(false);
  });

  test("remove --yes strips a composed block and preserves foreign content", async () => {
    const repo = await makeRepo();
    const env = { ...repo.env, JIRAFLOW_DATA_DIR: makeDataDir() };
    const hookPath = join(repo.root, ".git", "hooks", "commit-msg");
    const foreign = "#!/bin/sh\necho foreign-before\nexit 0\n";
    await Bun.write(hookPath, foreign);
    expect(
      (
        await runCompiledJiraFlow(["init", "--yes", "--compose-existing-hook"], {
          cwd: repo.root,
          env,
        })
      ).exitCode,
    ).toBe(0);

    const removed = await runCompiledJiraFlow(["remove", "--yes"], { cwd: repo.root, env });
    expect(removed.exitCode).toBe(0);
    const after = await Bun.file(hookPath).text();
    expect(after).toContain("echo foreign-before");
    expect(after).toContain("exit 0");
    expect(after).not.toContain("jiraflow managed block");
  });

  test("shared-hook remove retains the hook and removes repository-local JiraFlow state", async () => {
    const repo = await makeRepo();
    const env = { ...repo.env, JIRAFLOW_DATA_DIR: makeDataDir() };
    const shared = mkdtempSync(join(tmpdir(), "jiraflow-compiled-shared-remove-"));
    dirs.push(shared);
    await repo.runOk(["config", "--local", "core.hooksPath", shared]);

    const initialized = await runCompiledJiraFlow(
      ["init", "--yes", "--compose-existing-hook", "--allow-shared-hooks"],
      { cwd: repo.root, env },
    );
    expect(initialized.exitCode).toBe(0);
    const hookPath = join(shared, "commit-msg");
    const sharedHook = await Bun.file(hookPath).text();
    const statePath = (
      await repo.runOk(["rev-parse", "--path-format=absolute", "--git-path", "jiraflow/state.json"])
    ).trim();
    const metadataPath = (
      await repo.runOk([
        "rev-parse",
        "--path-format=absolute",
        "--git-path",
        "jiraflow/integration.json",
      ])
    ).trim();

    const removed = await runCompiledJiraFlow(["remove", "--yes"], { cwd: repo.root, env });
    expect(removed.exitCode).toBe(0);
    expect(await Bun.file(hookPath).text()).toBe(sharedHook);
    expect(
      (await repo.run(["config", "--local", "--get-regexp", "^jiraflow\\."])).exitCode,
    ).not.toBe(0);
    expect(existsSync(statePath)).toBe(false);
    expect(existsSync(metadataPath)).toBe(false);
  });

  test("doctor --repair refuses foreign hooks and unconfigured repositories", async () => {
    const configured = await makeRepo();
    const configuredEnv = { ...configured.env, JIRAFLOW_DATA_DIR: makeDataDir() };
    expect(
      (await runCompiledJiraFlow(["init", "--yes"], { cwd: configured.root, env: configuredEnv }))
        .exitCode,
    ).toBe(0);
    const hookPath = join(configured.root, ".git", "hooks", "commit-msg");
    const foreign = "#!/bin/sh\necho repair-must-not-touch-me\nexit 0\n";
    await Bun.write(hookPath, foreign);

    const repair = await runCompiledJiraFlow(["doctor", "--repair"], {
      cwd: configured.root,
      env: configuredEnv,
    });
    expect(repair.exitCode).toBe(0);
    expect(await Bun.file(hookPath).text()).toBe(foreign);

    const unconfigured = await makeRepo();
    const unconfiguredEnv = { ...unconfigured.env, JIRAFLOW_DATA_DIR: makeDataDir() };
    const refused = await runCompiledJiraFlow(["doctor", "--repair"], {
      cwd: unconfigured.root,
      env: unconfiguredEnv,
    });
    expect(refused.exitCode).toBe(3);
    expect(refused.stderr).toContain("REPOSITORY_NOT_CONFIGURED");
    expect(existsSync(join(unconfigured.root, ".git", "hooks", "commit-msg"))).toBe(false);
    expect(
      (await unconfigured.run(["config", "--local", "--get-regexp", "^jiraflow\\."])).exitCode,
    ).not.toBe(0);
  });

  test("unsupported, binary, and malformed hooks refuse compiled initialization without mutation", async () => {
    const cases: Array<{ name: string; content: Uint8Array }> = [
      {
        name: "unsupported interpreter",
        content: Buffer.from("#!/usr/bin/env python3\nprint('foreign')\n"),
      },
      { name: "binary", content: Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x00, 0x01, 0x02]) },
      {
        name: "malformed JiraFlow markers",
        content: Buffer.from("#!/bin/sh\n# >>> jiraflow managed block v1\necho damaged\n"),
      },
    ];

    for (const fixture of cases) {
      const repo = await makeRepo();
      const env = { ...repo.env, JIRAFLOW_DATA_DIR: makeDataDir() };
      const hookPath = join(repo.root, ".git", "hooks", "commit-msg");
      await Bun.write(hookPath, fixture.content);

      const result = await runCompiledJiraFlow(["init", "--yes", "--compose-existing-hook"], {
        cwd: repo.root,
        env,
      });
      expect(result.exitCode, fixture.name).toBe(4);
      expect(readFileSync(hookPath).equals(Buffer.from(fixture.content)), fixture.name).toBe(true);
      expect(
        (await repo.run(["config", "--local", "--get-regexp", "^jiraflow\\."])).exitCode,
        fixture.name,
      ).not.toBe(0);
    }
  });

  test("shared hooksPath requires the complete compiled consent flag matrix", async () => {
    for (const state of ["missing", "composable"] as const) {
      const repo = await makeRepo();
      const env = { ...repo.env, JIRAFLOW_DATA_DIR: makeDataDir() };
      const shared = mkdtempSync(join(tmpdir(), `jiraflow-compiled-shared-${state}-`));
      dirs.push(shared);
      const hookPath = join(shared, "commit-msg");
      const foreign = "#!/bin/sh\necho shared-foreign\nexit 0\n";
      if (state === "composable") {
        await Bun.write(hookPath, foreign);
      }
      await repo.runOk(["config", "--local", "core.hooksPath", shared]);

      const refusedArgs = [
        ["init", "--yes"],
        ["init", "--yes", "--allow-shared-hooks"],
        ["init", "--yes", "--compose-existing-hook"],
      ];
      for (const args of refusedArgs) {
        const result = await runCompiledJiraFlow(args, { cwd: repo.root, env });
        expect(result.exitCode, `${state}: ${args.join(" ")}`).toBe(4);
        if (state === "missing") {
          expect(existsSync(hookPath)).toBe(false);
        } else {
          expect(await Bun.file(hookPath).text()).toBe(foreign);
        }
      }

      const allowed = await runCompiledJiraFlow(
        ["init", "--yes", "--compose-existing-hook", "--allow-shared-hooks"],
        { cwd: repo.root, env },
      );
      expect(allowed.exitCode, state).toBe(0);
      const installed = await Bun.file(hookPath).text();
      expect(installed).toContain("jiraflow managed block");
      if (state === "composable") expect(installed).toContain("echo shared-foreign");
    }
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
