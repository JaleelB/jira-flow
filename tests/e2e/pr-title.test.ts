import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

async function setup() {
  const repo = createTempGitRepository();
  repos.push(repo);
  await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);
  await repo.runOk(["switch", "-c", "feat/ABC-123-login"]);
  const dataDir = mkdtempSync(join(tmpdir(), "jiraflow-pr-title-"));
  dirs.push(dataDir);
  const env = { ...repo.env, JIRAFLOW_DATA_DIR: dataDir };
  expect((await runCompiledJiraFlow(["init", "--yes"], { cwd: repo.root, env })).exitCode).toBe(0);
  return { repo, env };
}

describe("compiled pr-title CLI", () => {
  test("renders all variables, stable JSON, and one-shot title precedence", async () => {
    const { repo, env } = await setup();
    const template = "{jiraKey}|{storyTitle}|{branch}|{repo}|{date}|{quarter}";
    expect(
      (
        await runCompiledJiraFlow(["config", "set", "prTitleTemplate", template], {
          cwd: repo.root,
          env,
        })
      ).exitCode,
    ).toBe(0);
    const result = await runCompiledJiraFlow(
      ["pr-title", "--title", "Fix login", "--no-copy", "--json"],
      { cwd: repo.root, env },
    );
    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.schemaVersion).toBe(1);
    expect(payload.value).toContain("ABC-123|Fix login|feat/ABC-123-login|");
    expect(payload.variables.quarter).toMatch(/^Q[1-4]$/);
    expect(payload.copied).toBe(false);
    expect(payload.storyTitleSource).toBe("option");
  });

  test("link --title populates cache and option still wins later", async () => {
    const { repo, env } = await setup();
    expect(
      (
        await runCompiledJiraFlow(["link", "OPS-9", "--title", "Cached title"], {
          cwd: repo.root,
          env,
        })
      ).exitCode,
    ).toBe(0);
    const cached = await runCompiledJiraFlow(["pr-title", "--no-copy", "--json"], {
      cwd: repo.root,
      env,
    });
    expect(JSON.parse(cached.stdout).storyTitleSource).toBe("cache");
    expect(JSON.parse(cached.stdout).value).toContain("Cached title");
    const option = await runCompiledJiraFlow(
      ["pr-title", "--title", "One shot", "--no-copy", "--json"],
      { cwd: repo.root, env },
    );
    expect(JSON.parse(option.stdout).value).toContain("One shot");
    expect(JSON.parse(option.stdout).storyTitleSource).toBe("option");
  });

  test("noninteractive missing title and no active issue return typed errors", async () => {
    const { repo, env } = await setup();
    const missingTitle = await runCompiledJiraFlow(["pr-title", "--no-copy"], {
      cwd: repo.root,
      env,
    });
    expect(missingTitle.exitCode).toBe(2);
    expect(missingTitle.stderr).toContain("STORY_TITLE_REQUIRED");

    await repo.runOk(["switch", "main"]);
    const noIssue = await runCompiledJiraFlow(["pr-title", "--title", "No issue", "--no-copy"], {
      cwd: repo.root,
      env,
    });
    expect(noIssue.exitCode).toBe(3);
    expect(noIssue.stderr).toContain("NO_ACTIVE_ISSUE");
  });

  test("global template default is materialized by init", async () => {
    const outside = mkdtempSync(join(tmpdir(), "jiraflow-pr-global-"));
    dirs.push(outside);
    const dataDir = mkdtempSync(join(tmpdir(), "jiraflow-pr-global-data-"));
    dirs.push(dataDir);
    const globalEnv = { JIRAFLOW_DATA_DIR: dataDir };
    expect(
      (
        await runCompiledJiraFlow(
          ["config", "set", "defaultPrTitleTemplate", "[{jiraKey}] {storyTitle}", "--global"],
          { cwd: outside, env: globalEnv },
        )
      ).exitCode,
    ).toBe(0);
    const repo = createTempGitRepository();
    repos.push(repo);
    await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);
    await repo.runOk(["switch", "-c", "feat/ABC-7-global"]);
    const env = { ...repo.env, ...globalEnv };
    expect((await runCompiledJiraFlow(["init", "--yes"], { cwd: repo.root, env })).exitCode).toBe(
      0,
    );
    const title = await runCompiledJiraFlow(["pr-title", "--title", "Global title", "--no-copy"], {
      cwd: repo.root,
      env,
    });
    expect(title.stdout.trim()).toBe("[ABC-7] Global title");
  });
});
