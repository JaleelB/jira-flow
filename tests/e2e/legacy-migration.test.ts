import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fixtures from "../fixtures/legacy-v0.5/hooks.json";
import { ensureCompiledBinary, runCompiledJiraFlow } from "../helpers/run-jiraflow";
import { createTempGitRepository, type TempRepository } from "../helpers/temp-repository";

const repos: TempRepository[] = [];
const dataDirs: string[] = [];

beforeAll(async () => ensureCompiledBinary());
afterAll(() => {
  for (const repo of repos.splice(0)) repo.cleanup();
  for (const dir of dataDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function makeRepo() {
  const repo = createTempGitRepository();
  repos.push(repo);
  await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);
  const dataDir = mkdtempSync(join(tmpdir(), "jiraflow-legacy-e2e-"));
  dataDirs.push(dataDir);
  return { repo, dataDir, hooksDir: join(repo.root, ".git", "hooks") };
}

async function writeLegacyWrapper(path: string, content: string) {
  await Bun.write(path, content);
  chmodSync(path, 0o755);
}

describe("compiled v0.5 migration", () => {
  test("migrated v1 hook runs in a real Git commit", async () => {
    const { repo, dataDir, hooksDir } = await makeRepo();
    await writeLegacyWrapper(join(hooksDir, "commit-msg"), fixtures.commitMsg);
    await writeLegacyWrapper(join(hooksDir, "post-checkout"), fixtures.postCheckout);
    const env = { ...repo.env, JIRAFLOW_DATA_DIR: dataDir };

    const result = await runCompiledJiraFlow(["migrate", "--yes"], { cwd: repo.root, env });
    expect(result.exitCode).toBe(0);
    await repo.runOk(["switch", "-c", "feat/MIG-505-upgrade"]);
    await repo.commit("feat: migrated runtime");
    expect(await repo.runOk(["log", "-1", "--pretty=%B"])).toContain("Jira: MIG-505");
    expect(await Bun.file(join(hooksDir, "post-checkout")).exists()).toBe(false);
  });

  test("compiled migrator preserves an ambiguous hook matrix byte-for-byte", async () => {
    const { repo, dataDir, hooksDir } = await makeRepo();
    const commitPath = join(hooksDir, "commit-msg");
    const postPath = join(hooksDir, "post-checkout");
    const foreign = "#!/usr/bin/env python3\nprint('foreign')\n";
    await writeLegacyWrapper(commitPath, fixtures.commitMsg);
    await Bun.write(postPath, foreign);

    const result = await runCompiledJiraFlow(["migrate", "--yes"], {
      cwd: repo.root,
      env: { ...repo.env, JIRAFLOW_DATA_DIR: dataDir },
    });
    expect(result.exitCode).toBe(4);
    expect(await Bun.file(commitPath).text()).toBe(fixtures.commitMsg);
    expect(await Bun.file(postPath).text()).toBe(foreign);
  });
});
