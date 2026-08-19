import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BareRepositoryUnsupportedError, NotAGitRepositoryError } from "../../../src/domain/errors";
import { GitAdapter } from "../../../src/infrastructure/git/git-adapter";
import { GitRunner } from "../../../src/infrastructure/git/git-runner";
import { classifyHooksPath } from "../../../src/infrastructure/hooks/hook-path-classification";
import {
  createTempGitRepository,
  createTempNonGitDirectory,
  type TempRepository,
} from "../../helpers/temp-repository";

/**
 * VT-05 (part 2) — repository discovery (VS1-2).
 *
 * Real temporary Git repositories: root, git dir, common git dir, linked
 * worktree detection, nested subdirectory, non-repo typed error, bare repo
 * rejection, branch detection incl. detached HEAD.
 */

const repos: TempRepository[] = [];
const scratch: Array<() => void> = [];

afterAll(() => {
  for (const repo of repos.splice(0)) repo.cleanup();
  for (const fn of scratch.splice(0)) fn();
});

function adapterFor(repo: TempRepository): GitAdapter {
  return new GitAdapter(new GitRunner({ env: repo.env }));
}

describe("repository discovery", () => {
  test("from repo root: resolves root, gitDir, commonGitDir", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    const adapter = adapterFor(repo);

    const context = await adapter.discoverRepository(repo.root);
    expect(context.root).toBe(repo.root);
    expect(context.gitDir).toBe(join(repo.root, ".git"));
    expect(context.commonGitDir).toBe(join(repo.root, ".git"));
    expect(context.isLinkedWorktree).toBe(false);
  });

  test("from a nested subdirectory: resolves the same root", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    const nested = join(repo.root, "apps", "web");
    await Bun.write(join(nested, "README.md"), "nested\n");
    const adapter = adapterFor(repo);

    const context = await adapter.discoverRepository(nested);
    expect(context.root).toBe(repo.root);
  });

  test("path with spaces: discovers root and default hooks dir", async () => {
    const parent = mkdtempSync(join(tmpdir(), "jiraflow space parent-"));
    scratch.push(() => rmSync(parent, { recursive: true, force: true }));
    const spacedRoot = join(parent, "my repo");
    mkdirSync(spacedRoot);

    const init = Bun.spawnSync(["git", "init", "-b", "main", spacedRoot], {
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(init.exitCode).toBe(0);

    const adapter = new GitAdapter(new GitRunner());
    const context = await adapter.discoverRepository(spacedRoot);
    expect(context.root).toBe(spacedRoot);
    const hooks = await adapter.resolveHooks(context);
    expect(hooks.commitMsgPath).toBe(join(spacedRoot, ".git", "hooks", "commit-msg"));
  });

  test("non-repo path raises typed NOT_A_GIT_REPOSITORY", async () => {
    const nonRepo = createTempNonGitDirectory();
    scratch.push(nonRepo.cleanup);
    const adapter = new GitAdapter(new GitRunner());

    expect(adapter.discoverRepository(nonRepo.path)).rejects.toBeInstanceOf(NotAGitRepositoryError);
  });

  test("bare repository is rejected as unsupported", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jiraflow-bare-"));
    scratch.push(() => rmSync(dir, { recursive: true, force: true }));
    const init = Bun.spawnSync(["git", "init", "--bare", dir], {
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(init.exitCode).toBe(0);

    const adapter = new GitAdapter(new GitRunner());
    expect(adapter.discoverRepository(dir)).rejects.toBeInstanceOf(BareRepositoryUnsupportedError);
  });

  test("linked worktree: gitDir differs from commonGitDir", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);
    const worktreePath = join(tmpdir(), `jiraflow-wt-${Date.now()}`);
    scratch.push(() => rmSync(worktreePath, { recursive: true, force: true }));
    await repo.runOk(["worktree", "add", "-b", "feature-x", worktreePath]);

    const adapter = adapterFor(repo);
    const context = await adapter.discoverRepository(worktreePath);
    expect(context.root).toBe(worktreePath);
    expect(context.isLinkedWorktree).toBe(true);
    expect(context.gitDir).not.toBe(context.commonGitDir);
    expect(context.commonGitDir).toBe(join(repo.root, ".git"));
  });
});

describe("branch detection", () => {
  test("returns the current branch", async () => {
    const repo = createTempGitRepository({ initialBranch: "main" });
    repos.push(repo);
    const adapter = adapterFor(repo);

    const context = await adapter.discoverRepository(repo.root);
    expect(await adapter.getCurrentBranch(context)).toBe("main");
  });

  test("detached HEAD returns null, not an error", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);
    await repo.runOk(["checkout", "--detach", "HEAD"]);
    const adapter = adapterFor(repo);

    const context = await adapter.discoverRepository(repo.root);
    expect(await adapter.getCurrentBranch(context)).toBeNull();
  });
});

describe("hooks resolution", () => {
  test("default hooks dir is resolved through git rev-parse --git-path", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    const adapter = adapterFor(repo);

    const context = await adapter.discoverRepository(repo.root);
    const hooks = await adapter.resolveHooks(context);
    expect(hooks.hooksDir).toBe(join(repo.root, ".git", "hooks"));
    expect(hooks.commitMsgPath).toBe(join(repo.root, ".git", "hooks", "commit-msg"));
    expect(hooks.hooksPathOrigin).toBe("unknown");
  });

  test("local core.hooksPath is honored with origin=local", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    const customHooks = join(repo.root, "my-hooks");
    await repo.runOk(["config", "--local", "core.hooksPath", customHooks]);
    const adapter = adapterFor(repo);

    const context = await adapter.discoverRepository(repo.root);
    const hooks = await adapter.resolveHooks(context);
    expect(hooks.hooksDir).toBe(customHooks);
    expect(hooks.hooksPathOrigin).toBe("local");
  });

  test("relative core.hooksPath resolves against the worktree root", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    await repo.runOk(["config", "--local", "core.hooksPath", "team-hooks"]);
    const adapter = adapterFor(repo);

    const context = await adapter.discoverRepository(repo.root);
    const hooks = await adapter.resolveHooks(context);
    expect(hooks.hooksDir).toBe(join(repo.root, "team-hooks"));
  });

  test("absolute local core.hooksPath is honored", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    const customHooks = join(repo.root, "abs-hooks");
    await repo.runOk(["config", "--local", "core.hooksPath", customHooks]);
    const adapter = adapterFor(repo);
    const context = await adapter.discoverRepository(repo.root);
    const hooks = await adapter.resolveHooks(context);
    expect(hooks.hooksDir).toBe(customHooks);
    expect(hooks.hooksPathOrigin).toBe("local");
  });
});

describe("remote URL", () => {
  test("no remote is valid and returns null", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    const adapter = adapterFor(repo);
    const context = await adapter.discoverRepository(repo.root);
    expect(await adapter.getRemoteUrl(context)).toBeNull();
  });

  test("origin URL is returned when present", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    await repo.runOk(["remote", "add", "origin", "https://example.test/repo.git"]);
    const adapter = adapterFor(repo);
    const context = await adapter.discoverRepository(repo.root);
    expect(await adapter.getRemoteUrl(context)).toBe("https://example.test/repo.git");
  });
});

describe("hooksPath classification", () => {
  test("default hooks dir is repo-default", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    const adapter = adapterFor(repo);
    const context = await adapter.discoverRepository(repo.root);
    const hooks = await adapter.resolveHooks(context);
    expect(classifyHooksPath(context, hooks)).toBe("repo-default");
  });

  test("relative local core.hooksPath inside the repo is repo-local-custom", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    await repo.runOk(["config", "--local", "core.hooksPath", "team-hooks"]);
    const adapter = adapterFor(repo);
    const context = await adapter.discoverRepository(repo.root);
    const hooks = await adapter.resolveHooks(context);
    expect(classifyHooksPath(context, hooks)).toBe("repo-local-custom");
  });

  test("absolute core.hooksPath outside the repo is shared-external", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    const shared = mkdtempSync(join(tmpdir(), "jiraflow-shared-hooks-"));
    scratch.push(() => rmSync(shared, { recursive: true, force: true }));
    await repo.runOk(["config", "--local", "core.hooksPath", shared]);
    const adapter = adapterFor(repo);
    const context = await adapter.discoverRepository(repo.root);
    const hooks = await adapter.resolveHooks(context);
    expect(classifyHooksPath(context, hooks)).toBe("shared-external");
  });
});
