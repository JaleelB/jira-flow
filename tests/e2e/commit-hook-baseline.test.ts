import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureCompiledBinary, PROJECT_ROOT, runCompiledJiraFlow } from "../helpers/run-jiraflow";
import { createTempGitRepository, type TempRepository } from "../helpers/temp-repository";

const repos: TempRepository[] = [];
const dirs: string[] = [];
const BASELINE_PATH = join(PROJECT_ROOT, "tests", "e2e", "commit-hook-baseline.json");

beforeAll(async () => {
  await ensureCompiledBinary();
});

afterAll(() => {
  for (const repo of repos.splice(0)) repo.cleanup();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("commit-msg overhead baseline (E5-5 / T-15)", () => {
  test("records compiled hook elapsed time without a 250ms fail gate", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);
    const dataDir = mkdtempSync(join(tmpdir(), "jiraflow-e2e-data-"));
    dirs.push(dataDir);
    const env = { ...repo.env, JIRAFLOW_DATA_DIR: dataDir };

    expect((await runCompiledJiraFlow(["init", "--yes"], { cwd: repo.root, env })).exitCode).toBe(
      0,
    );
    await repo.runOk(["switch", "-c", "feat/ABC-123-login"]);

    const samples: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const started = performance.now();
      await repo.commit(`feat: baseline ${i}`);
      samples.push(performance.now() - started);
    }

    samples.sort((a, b) => a - b);
    const medianMs = samples[Math.floor(samples.length / 2)] ?? null;
    const record = {
      schemaVersion: 1,
      scenario: "compiled Hybrid footer git commit including hook overhead",
      samples: samples.length,
      elapsedMs: samples.map((value) => Math.round(value * 100) / 100),
      medianMs: medianMs === null ? null : Math.round(medianMs * 100) / 100,
      binary: "dist/jira-flow",
      recordedAt: new Date().toISOString(),
      note: "Observational baseline only (DR-0019). Not a CI fail gate.",
    };
    if (process.env.JIRAFLOW_RECORD_BASELINE === "1") {
      writeFileSync(BASELINE_PATH, `${JSON.stringify(record, null, 2)}\n`);
    }

    expect(samples.length).toBe(5);
    expect(await Bun.file(BASELINE_PATH).exists()).toBe(true);
    const last = await repo.runOk(["log", "-1", "--pretty=%B"]);
    expect(last).toContain("Jira: ABC-123");
  }, 90_000);
});
