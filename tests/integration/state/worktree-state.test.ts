import { afterAll, describe, expect, test } from "bun:test";
import { readdirSync, rmSync } from "node:fs";
import { WorktreeStateInvalidError } from "../../../src/domain/errors";
import type { JiraKey } from "../../../src/domain/issue-key";
import { GitAdapter } from "../../../src/infrastructure/git/git-adapter";
import { GitRunner } from "../../../src/infrastructure/git/git-runner";
import { WorktreeStateStore } from "../../../src/infrastructure/state/worktree-state-store";
import { createTempGitRepository, type TempRepository } from "../../helpers/temp-repository";

/**
 * VT-06 (part 2) — worktree-local state store (VS1-4).
 *
 * State lives in the Git-resolved `jiraflow/state.json`, writes are atomic,
 * absent files read as defaults, invalid JSON raises a recoverable typed
 * error, and linked worktrees resolve separate state paths.
 */

const repos: TempRepository[] = [];
const scratch: Array<() => void> = [];

afterAll(() => {
  for (const repo of repos.splice(0)) repo.cleanup();
  for (const fn of scratch.splice(0)) fn();
});

function key(value: string): JiraKey {
  return value as JiraKey;
}

async function setup() {
  const repo = createTempGitRepository();
  repos.push(repo);
  const runner = new GitRunner({ env: repo.env });
  const adapter = new GitAdapter(runner);
  const context = await adapter.discoverRepository(repo.root);
  const store = new WorktreeStateStore(runner);
  return { repo, runner, context, store };
}

async function statePath(repo: TempRepository): Promise<string> {
  const result = await repo.runOk([
    "rev-parse",
    "--path-format=absolute",
    "--git-path",
    "jiraflow/state.json",
  ]);
  return result.trim();
}

describe("WorktreeStateStore", () => {
  test("read on a fresh repo returns the default state", async () => {
    const { context, store } = await setup();
    expect(await store.exists(context)).toBe(false);
    const state = await store.read(context);
    expect(state.schemaVersion).toBe(1);
    expect(state.linkedIssue).toBeNull();
  });

  test("setLinkedIssue writes and reads back through the Git-resolved path", async () => {
    const { repo, context, store } = await setup();
    await store.setLinkedIssue(context, key("OPS-992"));

    const path = await statePath(repo);
    const raw = JSON.parse(await Bun.file(path).text());
    expect(raw.schemaVersion).toBe(1);
    expect(raw.linkedIssue).toBe("OPS-992");
    expect(typeof raw.updatedAt).toBe("string");

    expect((await store.read(context)).linkedIssue).toBe(key("OPS-992"));
  });

  test("setLinkedIssue(null) clears the override", async () => {
    const { context, store } = await setup();
    await store.setLinkedIssue(context, key("OPS-992"));
    await store.setLinkedIssue(context, null);
    expect((await store.read(context)).linkedIssue).toBeNull();
  });

  test("atomic writes leave no temp files behind", async () => {
    const { repo, context, store } = await setup();
    await store.setLinkedIssue(context, key("ABC-1"));
    await store.setLinkedIssue(context, key("ABC-2"));

    const path = await statePath(repo);
    const dir = path.slice(0, path.lastIndexOf("/"));
    const leftovers = readdirSync(dir).filter((name) => name.includes(".tmp-"));
    expect(leftovers).toEqual([]);
  });

  test("invalid JSON raises a recoverable typed error, not a crash", async () => {
    const { repo, context, store } = await setup();
    const path = await statePath(repo);
    await Bun.write(path, "{ this is not json");

    await expect(store.read(context)).rejects.toBeInstanceOf(WorktreeStateInvalidError);
  });

  test("unexpected schema is rejected", async () => {
    const { repo, context, store } = await setup();
    const path = await statePath(repo);
    await Bun.write(path, JSON.stringify({ schemaVersion: 99, linkedIssue: null }));

    await expect(store.read(context)).rejects.toBeInstanceOf(WorktreeStateInvalidError);
  });

  test("clear removes the state file and is idempotent", async () => {
    const { context, store } = await setup();
    await store.setLinkedIssue(context, key("ABC-1"));
    await store.clear(context);
    expect(await store.exists(context)).toBe(false);
    await store.clear(context);
  });

  test("linked worktrees resolve separate state paths", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);

    const worktreePath = `${repo.root}-wt`;
    scratch.push(() => {
      rmSync(worktreePath, { recursive: true, force: true });
    });
    await repo.runOk(["worktree", "add", "-b", "feat/OPS-992-fix", worktreePath]);

    const runner = new GitRunner({ env: repo.env });
    const adapter = new GitAdapter(runner);
    const mainContext = await adapter.discoverRepository(repo.root);
    const wtContext = await adapter.discoverRepository(worktreePath);
    const store = new WorktreeStateStore(runner);

    const mainPath = await statePath(repo);
    await store.setLinkedIssue(mainContext, key("MAN-100"));
    await store.setLinkedIssue(wtContext, key("HOT-200"));

    const wtPathResult = await new GitRunner({ env: repo.env }).run({
      cwd: worktreePath,
      args: ["rev-parse", "--path-format=absolute", "--git-path", "jiraflow/state.json"],
    });
    expect(wtPathResult.exitCode).toBe(0);

    expect((await store.read(mainContext)).linkedIssue).toBe(key("MAN-100"));
    expect((await store.read(wtContext)).linkedIssue).toBe(key("HOT-200"));
    expect(mainPath).not.toBe(wtPathResult.stdout.trim());
  });
});
