import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { JiraKey } from "../../../src/domain/issue-key";
import { GitAdapter } from "../../../src/infrastructure/git/git-adapter";
import { GitConfigStore } from "../../../src/infrastructure/git/git-config-store";
import { GitRunner } from "../../../src/infrastructure/git/git-runner";
import { WorktreeStateStore } from "../../../src/infrastructure/state/worktree-state-store";
import { createTempGitRepository, type TempRepository } from "../../helpers/temp-repository";

/**
 * VT-08 — internal hook command (VS1-6).
 *
 * Real `git commit` flows through a `commit-msg` hook that invokes
 * `jira-flow hook commit-msg` (run from source here; the compiled-binary
 * variant is the T-20 gate).
 */

const repos: TempRepository[] = [];

afterAll(() => {
  for (const repo of repos.splice(0)) repo.cleanup();
});

const projectRoot = join(import.meta.dir, "..", "..", "..");
const mainTs = join(projectRoot, "src", "main.ts");

function key(value: string): JiraKey {
  return value as JiraKey;
}

/** Installs a hook that invokes the internal command from source. */
async function installSourceHook(repo: TempRepository): Promise<void> {
  const hookPath = join(repo.root, ".git", "hooks", "commit-msg");
  const script = [
    "#!/bin/sh",
    `'${process.execPath}' '${mainTs}' hook commit-msg "$1" || exit $?`,
    "",
  ].join("\n");
  // chmod imported at top
  await Bun.write(hookPath, script);
  chmodSync(hookPath, 0o755);
}

async function setupConfiguredRepo(): Promise<TempRepository> {
  const repo = createTempGitRepository();
  repos.push(repo);
  const runner = new GitRunner({ env: repo.env });
  const adapter = new GitAdapter(runner);
  const context = await adapter.discoverRepository(repo.root);
  const config = new GitConfigStore(runner);
  await config.setEnabled(context, true);
  await config.setMode(context, "hybrid");
  await config.setCommitFormat(context, "footer");
  await installSourceHook(repo);
  return repo;
}

describe("jira-flow hook commit-msg through a real git commit", () => {
  test("Hybrid: feat/ABC-123-login yields the Jira footer", async () => {
    const repo = await setupConfiguredRepo();
    await repo.runOk(["switch", "-c", "feat/ABC-123-login"]);
    await repo.commit("feat(auth): add login");

    const message = await repo.runOk(["log", "-1", "--pretty=%B"]);
    expect(message).toContain("feat(auth): add login");
    expect(message).toContain("Jira: ABC-123");
  });

  test("footer preserves a multiline body", async () => {
    const repo = await setupConfiguredRepo();
    await repo.runOk(["switch", "-c", "feat/OPS2-991-crash"]);
    await repo.commit("fix: crash on start\n\nLonger body\nwith two lines.");

    const message = await repo.runOk(["log", "-1", "--pretty=%B"]);
    expect(message).toContain("Jira: OPS2-991");
    expect(message).toContain("Longer body");
  });

  test("worktree override wins over the branch issue", async () => {
    const repo = await setupConfiguredRepo();
    const runner = new GitRunner({ env: repo.env });
    const adapter = new GitAdapter(runner);
    const context = await adapter.discoverRepository(repo.root);
    const state = new WorktreeStateStore(runner);
    await state.setLinkedIssue(context, key("OPS-992"));
    await repo.runOk(["switch", "-c", "feat/ABC-123-login"]);
    await repo.commit("feat(auth): add login");

    const message = await repo.runOk(["log", "-1", "--pretty=%B"]);
    expect(message).toContain("Jira: OPS-992");
    expect(message).not.toContain("Jira: ABC-123");
  });

  test("no active issue: commit is untouched and succeeds", async () => {
    const repo = await setupConfiguredRepo();
    await repo.runOk(["switch", "-c", "chore/update-deps"]);
    await repo.commit("chore: update dependencies");

    const message = await repo.runOk(["log", "-1", "--pretty=%B"]);
    expect(message.trim()).toBe("chore: update dependencies");
  });

  test("disabled: no mutation", async () => {
    const repo = await setupConfiguredRepo();
    const runner = new GitRunner({ env: repo.env });
    const adapter = new GitAdapter(runner);
    const context = await adapter.discoverRepository(repo.root);
    const config = new GitConfigStore(runner);
    await config.setEnabled(context, false);

    await repo.runOk(["switch", "-c", "feat/ABC-123-login"]);
    await repo.commit("feat(auth): add login");

    const message = await repo.runOk(["log", "-1", "--pretty=%B"]);
    expect(message.trim()).toBe("feat(auth): add login");
  });

  test("unconfigured repo: hook is a silent no-op", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    await installSourceHook(repo);
    await repo.runOk(["switch", "-c", "feat/ABC-123-login"]);
    await repo.commit("feat(auth): add login");

    const message = await repo.runOk(["log", "-1", "--pretty=%B"]);
    expect(message.trim()).toBe("feat(auth): add login");
  });

  test("amend does not duplicate the footer (idempotency)", async () => {
    const repo = await setupConfiguredRepo();
    await repo.runOk(["switch", "-c", "feat/ABC-123-login"]);
    await repo.commit("feat(auth): add login");
    await repo.runOk(["commit", "--amend", "--no-edit"]);

    const message = await repo.runOk(["log", "-1", "--pretty=%B"]);
    expect(message.split("Jira: ABC-123").length - 1).toBe(1);
  });

  test("suffix, prefix, and scope formats mutate through git commit", async () => {
    const repo = await setupConfiguredRepo();
    const runner = new GitRunner({ env: repo.env });
    const adapter = new GitAdapter(runner);
    const context = await adapter.discoverRepository(repo.root);
    const config = new GitConfigStore(runner);

    await config.setCommitFormat(context, "suffix");
    await repo.runOk(["switch", "-c", "feat/ABC-123-login"]);
    await repo.commit("feat: suffix case");
    expect(await repo.runOk(["log", "-1", "--pretty=%s"])).toContain("[ABC-123]");

    await config.setCommitFormat(context, "prefix");
    await repo.commit("feat: prefix case");
    expect((await repo.runOk(["log", "-1", "--pretty=%s"])).trim()).toMatch(/^ABC-123 /);

    await config.setCommitFormat(context, "scope");
    await repo.commit("feat: scope case");
    expect((await repo.runOk(["log", "-1", "--pretty=%s"])).trim()).toBe(
      "feat(ABC-123): scope case",
    );
  });

  test("scope format leaves a non-empty existing scope unchanged", async () => {
    const repo = await setupConfiguredRepo();
    const runner = new GitRunner({ env: repo.env });
    const adapter = new GitAdapter(runner);
    const context = await adapter.discoverRepository(repo.root);
    await new GitConfigStore(runner).setCommitFormat(context, "scope");
    await repo.runOk(["switch", "-c", "feat/ABC-123-login"]);
    await repo.commit("feat(auth): keep scope");
    expect((await repo.runOk(["log", "-1", "--pretty=%s"])).trim()).toBe("feat(auth): keep scope");
  });
});

describe("hook command silence", () => {
  test("successful commit produces no hook stdout in the git output", async () => {
    const repo = await setupConfiguredRepo();
    await repo.runOk(["switch", "-c", "feat/ABC-123-login"]);
    // --quiet keeps git's own output minimal; any hook stdout would surface
    // in the commit command output we capture here.
    const output = await repo.runOk(["commit", "--allow-empty", "-q", "-m", "feat: quiet"]);
    expect(output).not.toContain("jira-flow");
    expect(output).not.toContain("Jira:");
  });
});

describe("hook bootstrap import boundary", () => {
  test("hook-container module graph excludes OpenTUI and SQLite", async () => {
    const srcRoot = join(projectRoot, "src");

    const forbidden = [/@opentui/, /bun:sqlite/, /\/tui\//, /sqlite/];
    const visited = new Set<string>();
    const queue: string[] = [join(srcRoot, "bootstrap", "hook-container.ts")];
    const importPattern = /from\s+["']([^"']+)["']/g;

    while (queue.length > 0) {
      const current = queue.pop() as string;
      if (visited.has(current)) continue;
      visited.add(current);

      const source = readFileSync(current, "utf8");
      for (const match of source.matchAll(importPattern)) {
        const specifier = match[1];
        if (specifier === undefined) continue;
        for (const pattern of forbidden) {
          if (pattern.test(specifier)) {
            throw new Error(
              `hook bootstrap imports forbidden module "${specifier}" via ${current}`,
            );
          }
        }
        if (specifier.startsWith(".")) {
          const resolved = resolveRelative(current, specifier);
          if (resolved) queue.push(resolved);
        }
      }
    }

    expect(visited.size).toBeGreaterThan(0);
    // Sanity: the boundary walker reached the use case layer.
    let sawUseCase = false;
    for (const file of visited) {
      if (file.includes("use-cases")) sawUseCase = true;
    }
    expect(sawUseCase).toBe(true);
  });
});

function resolveRelative(fromFile: string, specifier: string): string | null {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  for (const candidate of candidates) {
    if (!candidate.endsWith(".ts") && !candidate.endsWith(".tsx")) continue;
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}
