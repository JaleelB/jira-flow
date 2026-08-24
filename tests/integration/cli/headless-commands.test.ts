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

async function makeRepo(): Promise<{ repo: TempRepository; dataDir: string }> {
  const repo = createTempGitRepository();
  repos.push(repo);
  await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);
  return { repo, dataDir: makeDataDir() };
}

describe("link / unlink / mode / enable / disable / config / remove", () => {
  test("link and unlink in Hybrid; Branch refuses link", async () => {
    const { repo, dataDir } = await makeRepo();
    await runCli(["init", "--yes"], repo, dataDir);

    const linked = await runCli(["link", "ABC-123"], repo, dataDir);
    expect(linked.exitCode).toBe(0);
    expect(linked.stdout).toContain("ABC-123");

    const unlinked = await runCli(["unlink"], repo, dataDir);
    expect(unlinked.exitCode).toBe(0);

    await runCli(["mode", "branch"], repo, dataDir);
    const refused = await runCli(["link", "ABC-123"], repo, dataDir);
    expect(refused.exitCode).toBe(2);
    expect(refused.stderr).toContain("LINK_UNAVAILABLE_IN_BRANCH_MODE");

    const noop = await runCli(["unlink"], repo, dataDir);
    expect(noop.exitCode).toBe(0);
    expect(noop.stdout).toContain("no-op");
  });

  test("mode preserves linked issue when switching to Branch", async () => {
    const { repo, dataDir } = await makeRepo();
    await runCli(["init", "--yes"], repo, dataDir);
    await runCli(["link", "OPS-9"], repo, dataDir);
    await runCli(["mode", "branch"], repo, dataDir);
    const status = await runCli(["status", "--json"], repo, dataDir);
    const payload = JSON.parse(status.stdout);
    expect(payload.mode).toBe("branch");
    expect(payload.linkedIssue).toBe("OPS-9");
  });

  test("enable/disable do not change mode", async () => {
    const { repo, dataDir } = await makeRepo();
    await runCli(["init", "--yes", "--mode", "manual"], repo, dataDir);
    await runCli(["disable"], repo, dataDir);
    const status = await runCli(["status", "--json"], repo, dataDir);
    const payload = JSON.parse(status.stdout);
    expect(payload.enabled).toBe(false);
    expect(payload.mode).toBe("manual");
    await runCli(["enable"], repo, dataDir);
    const again = JSON.parse((await runCli(["status", "--json"], repo, dataDir)).stdout);
    expect(again.enabled).toBe(true);
    expect(again.mode).toBe("manual");
  });

  test("config list/get/set/unset, unknown key, and global defaults", async () => {
    const { repo, dataDir } = await makeRepo();
    await runCli(["init", "--yes"], repo, dataDir);

    const listed = await runCli(["config", "list"], repo, dataDir);
    expect(listed.exitCode).toBe(0);
    expect(listed.stdout).toContain("commitFormat=footer (repo)");
    expect(listed.stdout).toContain("issuePattern=");
    expect(listed.stdout).toContain("issuePattern=");

    const got = await runCli(["config", "get", "commitFormat"], repo, dataDir);
    expect(got.stdout.trim()).toBe("footer");

    const set = await runCli(["config", "set", "commitFormat", "suffix"], repo, dataDir);
    expect(set.exitCode).toBe(0);
    expect((await runCli(["config", "get", "commitFormat"], repo, dataDir)).stdout.trim()).toBe(
      "suffix",
    );

    const unset = await runCli(["config", "unset", "commitFormat"], repo, dataDir);
    expect(unset.exitCode).toBe(0);
    expect((await runCli(["config", "get", "commitFormat"], repo, dataDir)).stdout.trim()).toBe(
      "footer",
    );

    const unknown = await runCli(["config", "get", "notAKey"], repo, dataDir);
    expect(unknown.exitCode).toBe(2);
    expect(unknown.stderr).toContain("UNKNOWN_CONFIG_KEY");

    const global = await runCli(["config", "list", "--global"], repo, dataDir);
    expect(global.exitCode).toBe(0);
    expect(global.stdout).toContain("defaultMode=hybrid");
  }, 15_000);

  test("link accepts --title for the local issue metadata cache", async () => {
    const { repo, dataDir } = await makeRepo();
    await runCli(["init", "--yes"], repo, dataDir);
    const result = await runCli(["link", "--title", "Cached title", "ABC-123"], repo, dataDir);
    expect(result.exitCode).toBe(0);
  });

  test("remove --yes deletes owned integration; without --yes exits 2", async () => {
    const { repo, dataDir } = await makeRepo();
    await runCli(["init", "--yes"], repo, dataDir);

    const refused = await runCli(["remove"], repo, dataDir);
    expect(refused.exitCode).toBe(2);
    expect(refused.stderr).toContain("CONFIRMATION_REQUIRED");

    const removed = await runCli(["remove", "--yes"], repo, dataDir);
    expect(removed.exitCode).toBe(0);
    expect(await Bun.file(join(repo.root, ".git", "hooks", "commit-msg")).exists()).toBe(false);
    const config = await repo.run(["config", "--local", "--get-regexp", "^jiraflow\\."]);
    expect(config.exitCode).not.toBe(0);
  });
});
