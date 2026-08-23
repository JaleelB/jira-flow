import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readlinkSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fixtures from "../../fixtures/legacy-v0.5/hooks.json";
import { createTempGitRepository, type TempRepository } from "../../helpers/temp-repository";

const projectRoot = join(import.meta.dir, "..", "..", "..");
const mainTs = join(projectRoot, "src", "main.ts");
const repos: TempRepository[] = [];
const dataDirs: string[] = [];

afterAll(() => {
  for (const repo of repos.splice(0)) repo.cleanup();
  for (const dir of dataDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function makeRepo() {
  const repo = createTempGitRepository();
  repos.push(repo);
  await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);
  const dataDir = mkdtempSync(join(tmpdir(), "jiraflow-legacy-data-"));
  dataDirs.push(dataDir);
  return { repo, dataDir, hooksDir: join(repo.root, ".git", "hooks") };
}

async function runCli(args: string[], repo: TempRepository, dataDir: string) {
  const proc = Bun.spawn([process.execPath, mainTs, ...args], {
    cwd: repo.root,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...repo.env, JIRAFLOW_DATA_DIR: dataDir },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

async function writeLegacyWrapper(path: string, content: string) {
  await Bun.write(path, content);
  chmodSync(path, 0o755);
}

describe("JiraFlow v0.5 migration", () => {
  test("init and Doctor detect exact legacy wrappers without mutation", async () => {
    const { repo, dataDir, hooksDir } = await makeRepo();
    const commitPath = join(hooksDir, "commit-msg");
    const postPath = join(hooksDir, "post-checkout");
    await writeLegacyWrapper(commitPath, fixtures.commitMsg);
    await writeLegacyWrapper(postPath, fixtures.postCheckout);

    const init = await runCli(["init", "--yes"], repo, dataDir);
    expect(init.exitCode).toBe(4);
    expect(init.stderr).toContain("LEGACY_MIGRATION_REQUIRED");
    expect(await Bun.file(commitPath).text()).toBe(fixtures.commitMsg);
    expect(await Bun.file(postPath).text()).toBe(fixtures.postCheckout);

    const doctor = await runCli(["doctor"], repo, dataDir);
    expect(doctor.stdout).toContain("legacy.v0.5");
    expect(doctor.stdout).toContain("jira-flow migrate");
  });

  test("migrate replaces wrappers with v1 Hybrid and removes post-checkout", async () => {
    const { repo, dataDir, hooksDir } = await makeRepo();
    await writeLegacyWrapper(join(hooksDir, "commit-msg"), fixtures.commitMsg);
    await writeLegacyWrapper(join(hooksDir, "post-checkout"), fixtures.postCheckout);

    const migration = await runCli(["migrate", "--yes", "--json"], repo, dataDir);
    expect(migration.exitCode).toBe(0);
    const result = JSON.parse(migration.stdout);
    expect(result.schemaVersion).toBe(1);
    expect(result.mode).toBe("hybrid");
    expect(result.removedLegacyHooks).toEqual(["commit-msg", "post-checkout"]);
    expect((await repo.runOk(["config", "--local", "--get", "jiraflow.mode"])).trim()).toBe(
      "hybrid",
    );
    expect((await repo.runOk(["config", "--local", "--get", "jiraflow.enabled"])).trim()).toBe(
      "true",
    );
    expect(await Bun.file(join(hooksDir, "post-checkout")).exists()).toBe(false);
    expect(await Bun.file(join(hooksDir, "commit-msg")).text()).toContain(
      "# >>> jiraflow managed block v1",
    );
  });

  test("migrates exact helper symlinks and never restores post-checkout", async () => {
    const { repo, dataDir, hooksDir } = await makeRepo();
    symlinkSync("/opt/jiraflow/commitmsg", join(hooksDir, "commit-msg"));
    symlinkSync("/opt/jiraflow/postco", join(hooksDir, "post-checkout"));
    expect(readlinkSync(join(hooksDir, "commit-msg"))).toBe("/opt/jiraflow/commitmsg");

    const migration = await runCli(["migrate", "--yes"], repo, dataDir);
    expect(migration.exitCode).toBe(0);
    expect(await Bun.file(join(hooksDir, "post-checkout")).exists()).toBe(false);
    expect(await Bun.file(join(hooksDir, "commit-msg")).text()).toContain("hook commit-msg");
  });

  test("ambiguous mixed hooks refuse and preserve exact bytes", async () => {
    const { repo, dataDir, hooksDir } = await makeRepo();
    const commitPath = join(hooksDir, "commit-msg");
    const postPath = join(hooksDir, "post-checkout");
    const foreign = "#!/bin/sh\necho foreign\n";
    await writeLegacyWrapper(commitPath, fixtures.commitMsg);
    await Bun.write(postPath, foreign);

    const migration = await runCli(["migrate", "--yes"], repo, dataDir);
    expect(migration.exitCode).toBe(4);
    expect(migration.stderr).toContain("LEGACY_HOOK_AMBIGUOUS");
    expect(await Bun.file(commitPath).text()).toBe(fixtures.commitMsg);
    expect(await Bun.file(postPath).text()).toBe(foreign);
    const config = await repo.run(["config", "--local", "--get-regexp", "^jiraflow\\."]);
    expect(config.exitCode).not.toBe(0);
  });
});
