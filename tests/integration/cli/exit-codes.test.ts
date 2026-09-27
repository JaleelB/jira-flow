import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTempGitRepository, type TempRepository } from "../../helpers/temp-repository";

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

function runAt(
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

describe("CLI exit-code contract (architecture §37)", () => {
  test("--help and --version exit 0 outside a repository", async () => {
    expect((await runAt(["--help"], tmpdir(), process.env)).exitCode).toBe(0);
    expect((await runAt(["--version"], tmpdir(), process.env)).exitCode).toBe(0);
  });

  test("unknown command exits 2", async () => {
    const result = await runAt(["not-a-command"], tmpdir(), process.env);
    expect(result.exitCode).toBe(2);
  });

  test("usage errors exit 2", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "jiraflow-cli-data-"));
    dataDirs.push(dataDir);
    const repo = createTempGitRepository();
    repos.push(repo);
    await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);
    const env = { ...repo.env, JIRAFLOW_DATA_DIR: dataDir };
    expect((await runAt(["init"], repo.root, env)).exitCode).toBe(2);
    expect((await runAt(["link"], repo.root, env)).exitCode).toBe(2);
  });

  test("unconfigured repository commands exit 3", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "jiraflow-cli-data-"));
    dataDirs.push(dataDir);
    const repo = createTempGitRepository();
    repos.push(repo);
    const env = { ...repo.env, JIRAFLOW_DATA_DIR: dataDir };
    expect((await runAt(["status"], repo.root, env)).exitCode).toBe(3);
  });

  test("hook safety refusals exit 4", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "jiraflow-cli-data-"));
    dataDirs.push(dataDir);
    const repo = createTempGitRepository();
    repos.push(repo);
    await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);
    await Bun.write(join(repo.root, ".git", "hooks", "commit-msg"), "#!/bin/sh\nexit 0\n");
    const env = { ...repo.env, JIRAFLOW_DATA_DIR: dataDir };
    expect((await runAt(["init", "--yes"], repo.root, env)).exitCode).toBe(4);
  });

  test("hook commit-msg is silent and exits 0 with no active issue", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "jiraflow-cli-data-"));
    dataDirs.push(dataDir);
    const repo = createTempGitRepository();
    repos.push(repo);
    await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);
    const env = { ...repo.env, JIRAFLOW_DATA_DIR: dataDir };
    await runAt(["init", "--yes"], repo.root, env);
    const file = join(repo.root, "COMMIT_EDITMSG");
    await Bun.write(file, "chore: no ticket\n");
    const result = await runAt(["hook", "commit-msg", file], repo.root, env);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(await Bun.file(file).text()).toBe("chore: no ticket\n");
  });
});
