import { afterAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { computeEffectiveConfig } from "../../../src/application/services/effective-config";
import { ConfigInvalidError } from "../../../src/domain/errors";
import { GitAdapter } from "../../../src/infrastructure/git/git-adapter";
import { GitConfigStore } from "../../../src/infrastructure/git/git-config-store";
import { GitRunner } from "../../../src/infrastructure/git/git-runner";
import { createTempGitRepository, type TempRepository } from "../../helpers/temp-repository";

/**
 * VT-06 (part 1) — Git-local config store (VS1-3).
 *
 * Writes and reads JiraFlow workflow config through `git config --local`,
 * never by editing `.git/config` as text. Uses isolated temporary repos.
 */

const repos: TempRepository[] = [];

afterAll(() => {
  for (const repo of repos.splice(0)) repo.cleanup();
});

async function setup() {
  const repo = createTempGitRepository();
  repos.push(repo);
  const runner = new GitRunner({ env: repo.env });
  const adapter = new GitAdapter(runner);
  const context = await adapter.discoverRepository(repo.root);
  const store = new GitConfigStore(runner);
  return { repo, runner, context, store };
}

describe("GitConfigStore", () => {
  test("read on a clean repo returns null (not configured)", async () => {
    const { context, store } = await setup();
    expect(await store.read(context)).toBeNull();
  });

  test("setEnabled/setMode/setCommitFormat write through git config --local", async () => {
    const { repo, context, store } = await setup();

    await store.setEnabled(context, true);
    await store.setMode(context, "hybrid");
    await store.setCommitFormat(context, "footer");

    const mode = await repo.runOk(["config", "--local", "--get", "jiraflow.mode"]);
    expect(mode.trim()).toBe("hybrid");
    const enabled = await repo.runOk([
      "config",
      "--local",
      "--type=bool",
      "--get",
      "jiraflow.enabled",
    ]);
    expect(enabled.trim()).toBe("true");
    const format = await repo.runOk(["config", "--local", "--get", "jiraflow.commitFormat"]);
    expect(format.trim()).toBe("footer");
    expect(await store.read(context)).toEqual({
      enabled: true,
      mode: "hybrid",
      issuePattern: null,
      commitFormat: "footer",
    });
  });

  test("setEnabled(false) persists and reads back", async () => {
    const { context, store } = await setup();
    await store.setEnabled(context, true);
    await store.setEnabled(context, false);
    expect((await store.read(context))?.enabled).toBe(false);
  });

  test("missing optional keys fall back in read", async () => {
    const { context, store } = await setup();
    await store.setEnabled(context, true);
    const config = await store.read(context);
    expect(config?.mode).toBe("hybrid");
    expect(config?.commitFormat).toBeNull();
    expect(config?.issuePattern).toBeNull();
  });

  test("removeAll removes the jiraflow section and is idempotent", async () => {
    const { repo, context, store } = await setup();
    await store.setEnabled(context, true);
    await store.setMode(context, "hybrid");
    await store.setCommitFormat(context, "footer");

    await store.removeAll(context);
    const batch = await repo.run(["config", "--local", "--get-regexp", "^jiraflow\\."]);
    expect(batch.exitCode).not.toBe(0);
    expect(await store.read(context)).toBeNull();

    // Second removal must not fail.
    await store.removeAll(context);
  });

  test("invalid mode value raises typed CONFIG_INVALID", async () => {
    const { repo, context, store } = await setup();
    await repo.runOk(["config", "--local", "jiraflow.enabled", "true"]);
    await repo.runOk(["config", "--local", "jiraflow.mode", "banana"]);
    await expect(store.read(context)).rejects.toBeInstanceOf(ConfigInvalidError);
  });

  test("invalid commitFormat value raises typed CONFIG_INVALID", async () => {
    const { repo, context, store } = await setup();
    await repo.runOk(["config", "--local", "jiraflow.enabled", "true"]);
    await repo.runOk(["config", "--local", "jiraflow.commitFormat", "sparkly"]);
    await expect(store.read(context)).rejects.toBeInstanceOf(ConfigInvalidError);
  });
});

describe("computeEffectiveConfig", () => {
  test("null repo config yields built-in defaults with enabled default", async () => {
    const { store, context } = await setup();
    const repoConfig = await store.read(context);
    const effective = computeEffectiveConfig(repoConfig);
    expect(effective.enabled).toBe(true);
    expect(effective.mode).toBe("hybrid");
    expect(effective.issuePattern).toBe("[A-Z][A-Z0-9]*-\\d+");
    expect(effective.commitFormat).toBe("footer");
  });

  test("repo overrides win over defaults", async () => {
    const { context, store } = await setup();
    await store.setEnabled(context, false);
    await store.setMode(context, "hybrid");
    const effective = computeEffectiveConfig(await store.read(context));
    expect(effective.enabled).toBe(false);
    expect(effective.commitFormat).toBe("footer");
  });

  test("config values live in the repo's .git/config file", async () => {
    const { repo, context, store } = await setup();
    await store.setEnabled(context, true);
    const raw = await Bun.file(join(repo.root, ".git", "config")).text();
    expect(raw).toContain("[jiraflow]");
  });
});
