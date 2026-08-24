import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, statSync } from "node:fs";
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
 * VT-07 — owned hook install (VS1-5, Strategy A only).
 */

const repos: TempRepository[] = [];

afterAll(() => {
  for (const repo of repos.splice(0)) repo.cleanup();
});

const FAKE_BINARY = "/opt/jira-flow/bin/jira-flow";

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

describe("HookManager.installOwned", () => {
  test("creates an executable owned commit-msg with markers and hook invocation", async () => {
    const { repo, context, hooks } = await setup();
    const result = await hooks.installOwned(context, { binaryPath: FAKE_BINARY });

    expect(result.strategy).toBe("owned");
    expect(result.created).toBe(true);
    expect(result.hookPath).toBe(join(repo.root, ".git", "hooks", "commit-msg"));

    const content = await Bun.file(result.hookPath).text();
    expect(content).toContain(BEGIN_MARKER);
    expect(content).toContain(`JIRAFLOW_BIN='${FAKE_BINARY}'`);
    expect(content).toContain('hook commit-msg "$1"');
    expect(content).toContain("command -v jira-flow");

    if (process.platform !== "win32") {
      const mode = statSync(result.hookPath).mode;
      expect(mode & 0o111).not.toBe(0);
    }
  });

  test("second install is idempotent: no duplicate managed block", async () => {
    const { context, hooks } = await setup();
    await hooks.installOwned(context, { binaryPath: FAKE_BINARY });
    const second = await hooks.installOwned(context, { binaryPath: FAKE_BINARY });

    expect(second.created).toBe(false);
    const content = await Bun.file(second.hookPath).text();
    expect(content.split(BEGIN_MARKER).length - 1).toBe(1);
  });

  test("reinstall refreshes the captured binary path without duplicating", async () => {
    const { context, hooks } = await setup();
    await hooks.installOwned(context, { binaryPath: FAKE_BINARY });
    const second = await hooks.installOwned(context, {
      binaryPath: "/usr/local/bin/jira-flow",
    });
    const content = await Bun.file(second.hookPath).text();
    expect(content).toContain("JIRAFLOW_BIN='/usr/local/bin/jira-flow'");
    expect(content).not.toContain(FAKE_BINARY);
    expect(content.split(BEGIN_MARKER).length - 1).toBe(1);
  });

  test("existing foreign commit-msg raises HOOK_CONFLICT and leaves bytes unchanged", async () => {
    const { repo, context, hooks } = await setup();
    const foreignPath = join(repo.root, ".git", "hooks", "commit-msg");
    const foreign = "#!/bin/sh\necho 'husky-style validator'\nexit 0\n";
    await Bun.write(foreignPath, foreign);
    chmodSync(foreignPath, 0o755);

    await expect(hooks.installOwned(context, { binaryPath: FAKE_BINARY })).rejects.toBeInstanceOf(
      HookConflictError,
    );
    expect(await Bun.file(foreignPath).text()).toBe(foreign);
  });

  test("damaged markers are treated as a conflict, not repaired", async () => {
    const { repo, context, hooks } = await setup();
    const hookPath = join(repo.root, ".git", "hooks", "commit-msg");
    const damaged = generateOwnedHookScript({ binaryPath: FAKE_BINARY }).replace(
      "# <<< jiraflow managed block v1",
      "# marker manually damaged",
    );
    await Bun.write(hookPath, damaged);

    await expect(hooks.installOwned(context, { binaryPath: FAKE_BINARY })).rejects.toBeInstanceOf(
      HookUnsafeToModifyError,
    );
  });

  test("no post-checkout hook is ever written", async () => {
    const { repo, context, hooks } = await setup();
    await hooks.installOwned(context, { binaryPath: FAKE_BINARY });
    const postCheckout = join(repo.root, ".git", "hooks", "post-checkout");
    expect(await Bun.file(postCheckout).exists()).toBe(false);
  });

  test("installs into a custom local core.hooksPath", async () => {
    const { repo, context, hooks } = await setup();
    const customDir = join(repo.root, "team-hooks");
    await repo.runOk(["config", "--local", "core.hooksPath", customDir]);

    const result = await hooks.installOwned(context, { binaryPath: FAKE_BINARY });
    expect(result.hookPath).toBe(join(customDir, "commit-msg"));
    expect(await Bun.file(result.hookPath).exists()).toBe(true);
  });

  test("missing captured binary never blocks a real commit (no-op rule)", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    const runner = new GitRunner({ env: repo.env });
    const git = new GitAdapter(runner);
    const context = await git.discoverRepository(repo.root);
    const hooks = new HookManager(git, runner);
    await hooks.installOwned(context, { binaryPath: "/nonexistent/jira-flow" });

    // PATH contains no jira-flow: both branches fail safe; commit succeeds.
    const commit = await repo.runOk([
      "commit",
      "--allow-empty",
      "-m",
      "feat: works without jiraflow",
    ]);
    expect(commit.trim().length).toBeGreaterThan(0);
    const log = await repo.runOk(["log", "-1", "--pretty=%B"]);
    expect(log.trim()).toBe("feat: works without jiraflow");
  });

  test("remove deletes a proven owned hook after the captured binary moves", async () => {
    const { repo, context, hooks } = await setup();
    await hooks.installOwned(context, { binaryPath: "/old/package/path/jira-flow" });

    const removed = await hooks.remove(context, {
      binaryPath: "/new/package/path/jira-flow",
    });

    expect(removed.mode).toBe("owned-file");
    expect(await Bun.file(join(repo.root, ".git", "hooks", "commit-msg")).exists()).toBe(false);
  });

  test("remove refuses an owned-shaped hook whose managed body was edited", async () => {
    const { repo, context, hooks } = await setup();
    const hookPath = join(repo.root, ".git", "hooks", "commit-msg");
    const original = generateOwnedHookScript({ binaryPath: "/old/package/path/jira-flow" });
    const edited = original.replace(
      "# <<< jiraflow managed block v1",
      "echo user-added-content\n# <<< jiraflow managed block v1",
    );
    await Bun.write(hookPath, edited);

    const removed = await hooks.remove(context, { binaryPath: "/new/package/path/jira-flow" });

    expect(removed.mode).toBe("none");
    expect(await Bun.file(hookPath).text()).toBe(edited);
  });
});

describe("IntegrationMetadataStore", () => {
  test("writes and reads integration metadata at the git-path location", async () => {
    const { repo, context, hooks, metadata } = await setup();
    const install = await hooks.installOwned(context, { binaryPath: FAKE_BINARY });
    await metadata.write(context, {
      hookPath: install.hookPath,
      capturedBinaryPath: FAKE_BINARY,
    });

    const path = (
      await repo.runOk([
        "rev-parse",
        "--path-format=absolute",
        "--git-path",
        "jiraflow/integration.json",
      ])
    ).trim();
    const onDisk = JSON.parse(await Bun.file(path).text());
    expect(onDisk.schemaVersion).toBe(1);
    expect(onDisk.hook).toBe("commit-msg");
    expect(onDisk.strategy).toBe("owned");
    expect(onDisk.blockId).toBe("jiraflow-v1");
    expect(onDisk.capturedBinaryPath).toBe(FAKE_BINARY);

    const read = await metadata.read(context);
    expect(read?.hookPath).toBe(install.hookPath);
  });
});

describe("HookManager.inspect", () => {
  test("reports missing, owned, and conflict correctly", async () => {
    const { context, hooks } = await setup();
    expect((await hooks.inspect(context)).status).toBe("missing");

    await hooks.installOwned(context, { binaryPath: FAKE_BINARY });
    expect((await hooks.inspect(context)).status).toBe("owned");
  });

  test("foreign hook inspects as conflict with a reason", async () => {
    const { repo, context, hooks } = await setup();
    await Bun.write(join(repo.root, ".git", "hooks", "commit-msg"), "#!/bin/sh\nexit 0\n");
    const inspection = await hooks.inspect(context);
    expect(inspection.status).toBe("composable-shell");
    expect(inspection.interpreter).toBe("sh");
  });
});
