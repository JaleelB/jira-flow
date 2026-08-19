import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HookConflictError, HookUnsafeToModifyError } from "../../../src/domain/errors";
import { GitAdapter } from "../../../src/infrastructure/git/git-adapter";
import { GitRunner } from "../../../src/infrastructure/git/git-runner";
import { HookManager } from "../../../src/infrastructure/hooks/hook-manager";
import { BEGIN_MARKER } from "../../../src/infrastructure/hooks/hook-markers";
import { generateOwnedHookScript } from "../../../src/infrastructure/hooks/hook-script";
import { IntegrationMetadataStore } from "../../../src/infrastructure/hooks/integration-metadata";
import { createTempGitRepository, type TempRepository } from "../../helpers/temp-repository";

/**
 * E4-10 / architecture §42.4 hook matrix.
 */

const repos: TempRepository[] = [];
const scratch: Array<() => void> = [];

afterAll(() => {
  for (const repo of repos.splice(0)) repo.cleanup();
  for (const fn of scratch.splice(0)) fn();
});

const BINARY = "/opt/jira-flow/bin/jira-flow";

async function setup() {
  const repo = createTempGitRepository();
  repos.push(repo);
  const runner = new GitRunner({ env: repo.env });
  const git = new GitAdapter(runner);
  const context = await git.discoverRepository(repo.root);
  const hooks = new HookManager(git, runner);
  const metadata = new IntegrationMetadataStore(runner);
  return { repo, runner, git, context, hooks, metadata };
}

describe("hook matrix (architecture §42.4)", () => {
  test("no existing commit-msg → owned install", async () => {
    const { context, hooks } = await setup();
    const result = await hooks.install(context, { binaryPath: BINARY });
    expect(result.strategy).toBe("owned");
    expect(result.created).toBe(true);
    expect((await hooks.inspect(context)).status).toBe("owned");
  });

  test("existing JiraFlow-owned hook refreshes without duplicating", async () => {
    const { context, hooks } = await setup();
    await hooks.installOwned(context, { binaryPath: BINARY });
    const second = await hooks.installOwned(context, { binaryPath: "/usr/bin/jira-flow" });
    expect(second.created).toBe(false);
    const content = await Bun.file(second.hookPath).text();
    expect(content.split(BEGIN_MARKER).length - 1).toBe(1);
    expect(content).toContain("/usr/bin/jira-flow");
  });

  test("existing JiraFlow-composed shell hook refreshes the block only", async () => {
    const { repo, context, hooks } = await setup();
    const hookPath = join(repo.root, ".git", "hooks", "commit-msg");
    await Bun.write(hookPath, "#!/bin/sh\necho original\nexit 0\n");
    chmodSync(hookPath, 0o755);
    await hooks.install(context, { binaryPath: BINARY, composeExistingHook: true });
    const first = await Bun.file(hookPath).text();
    await hooks.install(context, { binaryPath: "/opt/new/jira-flow", composeExistingHook: true });
    const second = await Bun.file(hookPath).text();
    expect(second.split(BEGIN_MARKER).length - 1).toBe(1);
    expect(second).toContain("echo original");
    expect(second).toContain("/opt/new/jira-flow");
    expect(first).toContain("echo original");
  });

  test("existing shell hook with set -e still executes original body after compose", async () => {
    const { repo, context, hooks } = await setup();
    const hookPath = join(repo.root, ".git", "hooks", "commit-msg");
    await Bun.write(hookPath, '#!/bin/sh\nset -e\ntouch "$1.seen"\nexit 0\n');
    chmodSync(hookPath, 0o755);
    await hooks.install(context, { binaryPath: BINARY, composeExistingHook: true });

    const msg = join(repo.root, "COMMITMSG");
    await Bun.write(msg, "feat: probe\n");
    const run = Bun.spawnSync(["sh", hookPath, msg], {
      cwd: repo.root,
      stdout: "pipe",
      stderr: "pipe",
      env: repo.env,
    });
    expect(run.exitCode).toBe(0);
    expect(await Bun.file(`${msg}.seen`).exists()).toBe(true);
  });

  test("existing hook that exits early still runs JiraFlow first", async () => {
    const { repo, context, hooks } = await setup();
    const hookPath = join(repo.root, ".git", "hooks", "commit-msg");
    await Bun.write(hookPath, "#!/bin/sh\nexit 0\necho unreachable\n");
    chmodSync(hookPath, 0o755);
    await hooks.install(context, { binaryPath: BINARY, composeExistingHook: true });
    const content = await Bun.file(hookPath).text();
    const blockAt = content.indexOf(BEGIN_MARKER);
    const exitAt = content.indexOf("exit 0");
    expect(blockAt).toBeGreaterThan(0);
    expect(blockAt).toBeLessThan(exitAt);
  });

  test("--yes / default install does not compose a foreign shell hook", async () => {
    const { repo, context, hooks } = await setup();
    const hookPath = join(repo.root, ".git", "hooks", "commit-msg");
    const foreign = "#!/bin/sh\necho keep-me\n";
    await Bun.write(hookPath, foreign);
    chmodSync(hookPath, 0o755);
    await expect(hooks.installOwned(context, { binaryPath: BINARY })).rejects.toBeInstanceOf(
      HookConflictError,
    );
    expect(await Bun.file(hookPath).text()).toBe(foreign);
  });

  test("unsupported interpreter is refused", async () => {
    const { repo, context, hooks } = await setup();
    const hookPath = join(repo.root, ".git", "hooks", "commit-msg");
    await Bun.write(hookPath, "#!/usr/bin/env python3\nprint(1)\n");
    await expect(
      hooks.install(context, { binaryPath: BINARY, composeExistingHook: true }),
    ).rejects.toBeInstanceOf(HookUnsafeToModifyError);
  });

  test("binary hook is refused", async () => {
    const { repo, context, hooks } = await setup();
    const hookPath = join(repo.root, ".git", "hooks", "commit-msg");
    await Bun.write(hookPath, `\x7fELF${"\0".repeat(24)}`);
    await expect(
      hooks.install(context, { binaryPath: BINARY, composeExistingHook: true }),
    ).rejects.toBeInstanceOf(HookUnsafeToModifyError);
  });

  test("malformed markers are refused", async () => {
    const { repo, context, hooks } = await setup();
    const hookPath = join(repo.root, ".git", "hooks", "commit-msg");
    const damaged = generateOwnedHookScript({ binaryPath: BINARY }).replace(
      "# <<< jiraflow managed block v1",
      "# damaged",
    );
    await Bun.write(hookPath, damaged);
    await expect(hooks.installOwned(context, { binaryPath: BINARY })).rejects.toBeInstanceOf(
      HookUnsafeToModifyError,
    );
  });

  test("shared hooksPath is refused without --allow-shared-hooks", async () => {
    const { repo, context, hooks } = await setup();
    const shared = mkdtempSync(join(tmpdir(), "jiraflow-shared-hooks-"));
    scratch.push(() => rmSync(shared, { recursive: true, force: true }));
    mkdirSync(shared, { recursive: true });
    await repo.runOk(["config", "--local", "core.hooksPath", shared]);
    await expect(hooks.installOwned(context, { binaryPath: BINARY })).rejects.toBeInstanceOf(
      HookUnsafeToModifyError,
    );
    expect(await Bun.file(join(shared, "commit-msg")).exists()).toBe(false);
  });

  test("shared hooksPath compose requires both consent flags", async () => {
    const { repo, git, hooks } = await setup();
    const shared = mkdtempSync(join(tmpdir(), "jiraflow-shared-compose-"));
    scratch.push(() => rmSync(shared, { recursive: true, force: true }));
    mkdirSync(shared, { recursive: true });
    const hookPath = join(shared, "commit-msg");
    await Bun.write(hookPath, "#!/bin/sh\necho shared\n");
    chmodSync(hookPath, 0o755);
    await repo.runOk(["config", "--local", "core.hooksPath", shared]);
    const context = await git.discoverRepository(repo.root);

    await expect(
      hooks.install(context, { binaryPath: BINARY, composeExistingHook: true }),
    ).rejects.toBeInstanceOf(HookUnsafeToModifyError);

    const result = await hooks.install(context, {
      binaryPath: BINARY,
      composeExistingHook: true,
      allowSharedHooks: true,
    });
    expect(result.strategy).toBe("composed");
    expect(await Bun.file(hookPath).text()).toContain("echo shared");
    expect(await Bun.file(hookPath).text()).toContain(BEGIN_MARKER);
  });

  test("remove strips only the JiraFlow block from a composed hook", async () => {
    const { repo, context, hooks } = await setup();
    const hookPath = join(repo.root, ".git", "hooks", "commit-msg");
    await Bun.write(hookPath, "#!/bin/sh\necho user-logic\nexit 0\n");
    chmodSync(hookPath, 0o755);
    await hooks.install(context, { binaryPath: BINARY, composeExistingHook: true });
    await Bun.write(hookPath, `${await Bun.file(hookPath).text()}\n# user later change\n`);
    const removed = await hooks.remove(context, { binaryPath: BINARY });
    expect(removed.mode).toBe("stripped-block");
    const after = await Bun.file(hookPath).text();
    expect(after).not.toContain(BEGIN_MARKER);
    expect(after).toContain("echo user-logic");
    expect(after).toContain("user later change");
  });

  test("remove skips mutating a shared hooksPath", async () => {
    const { repo, git, hooks } = await setup();
    const shared = mkdtempSync(join(tmpdir(), "jiraflow-shared-remove-"));
    scratch.push(() => rmSync(shared, { recursive: true, force: true }));
    mkdirSync(shared, { recursive: true });
    const hookPath = join(shared, "commit-msg");
    await Bun.write(hookPath, generateOwnedHookScript({ binaryPath: BINARY }));
    chmodSync(hookPath, 0o755);
    await repo.runOk(["config", "--local", "core.hooksPath", shared]);
    const context = await git.discoverRepository(repo.root);
    const result = await hooks.remove(context, { binaryPath: BINARY });
    expect(result.mode).toBe("skipped-shared");
    expect(await Bun.file(hookPath).text()).toContain(BEGIN_MARKER);
  });

  test("compose writes backup metadata with original hash", async () => {
    const { repo, context, hooks, metadata } = await setup();
    const hookPath = join(repo.root, ".git", "hooks", "commit-msg");
    const original = "#!/bin/sh\necho keep\n";
    await Bun.write(hookPath, original);
    chmodSync(hookPath, 0o755);
    const result = await hooks.install(context, { binaryPath: BINARY, composeExistingHook: true });
    expect(result.backupPath).toBeDefined();
    expect(await Bun.file(result.backupPath ?? "").text()).toBe(original);
    const meta = await metadata.read(context);
    expect(meta?.strategy).toBe("composed");
    expect(meta?.originalSha256).toHaveLength(64);
    expect(meta?.backupPath).toBe(result.backupPath);
  });

  test("missing JiraFlow binary after owned install does not block commit", async () => {
    const { repo, context, hooks } = await setup();
    await hooks.installOwned(context, { binaryPath: "/nonexistent/jira-flow" });
    await repo.runOk(["commit", "--allow-empty", "-m", "feat: still works"]);
    const log = await repo.runOk(["log", "-1", "--pretty=%s"]);
    expect(log.trim()).toBe("feat: still works");
  });
});
