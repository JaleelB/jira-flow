import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitAdapter } from "../../../src/infrastructure/git/git-adapter";
import { GitConfigStore } from "../../../src/infrastructure/git/git-config-store";
import { GitRunner } from "../../../src/infrastructure/git/git-runner";
import { MIGRATION_001_INITIAL } from "../../../src/infrastructure/sqlite/migrations";
import { SqliteRepositoryRegistry } from "../../../src/infrastructure/sqlite/repository-registry";
import { createTempGitRepository, type TempRepository } from "../../helpers/temp-repository";

/**
 * VT-12 — SQLite registry + deletion resilience (VS1-10).
 *
 * The registry stores dashboard metadata only. Deleting the database must
 * never break commit behavior, and registration failure must never destroy
 * repository configuration (ADR-0006/O-01, ADR-0006/O-02).
 */

const repos: TempRepository[] = [];
const dirs: string[] = [];

afterAll(() => {
  for (const repo of repos.splice(0)) repo.cleanup();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function makeDataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "jiraflow-data-"));
  dirs.push(dir);
  return dir;
}

describe("SqliteRepositoryRegistry", () => {
  test("registers a repository row in an injected data dir", async () => {
    const dataDir = makeDataDir();
    const registry = new SqliteRepositoryRegistry({
      databasePath: join(dataDir, "jira-flow.db"),
    });

    const registered = await registry.register({
      path: "/tmp/some-repo",
      displayName: "some-repo",
      remoteUrl: null,
    });

    expect(registered.id).toHaveLength(36);
    expect(registered.path).toBe("/tmp/some-repo");
    expect(existsSync(join(dataDir, "jira-flow.db"))).toBe(true);
    expect((await registry.findByPath("/tmp/some-repo"))?.displayName).toBe("some-repo");
  });

  test("re-registration of the same path updates, never duplicates", async () => {
    const dataDir = makeDataDir();
    const registry = new SqliteRepositoryRegistry({
      databasePath: join(dataDir, "jira-flow.db"),
    });

    const first = await registry.register({
      path: "/tmp/some-repo",
      displayName: "some-repo",
      remoteUrl: null,
    });
    const second = await registry.register({
      path: "/tmp/some-repo",
      displayName: "renamed",
      remoteUrl: "https://example.com/repo.git",
    });

    expect(second.id).toBe(first.id);
    expect(second.displayName).toBe("renamed");
    expect((await registry.findByPath("/tmp/some-repo"))?.remoteUrl).toBe(
      "https://example.com/repo.git",
    );
  });

  test("deleting the DB is recoverable: next register recreates it", async () => {
    const dataDir = makeDataDir();
    const dbPath = join(dataDir, "jira-flow.db");
    const registry = new SqliteRepositoryRegistry({ databasePath: dbPath });

    await registry.register({ path: "/tmp/repo-a", displayName: "repo-a", remoteUrl: null });
    rmSync(dbPath, { force: true });
    // WAL/SHM sidecar files may remain; deletion of the main DB file is the
    // user scenario under test.
    expect(existsSync(dbPath)).toBe(false);

    const again = await registry.register({
      path: "/tmp/repo-a",
      displayName: "repo-a",
      remoteUrl: null,
    });
    expect(again.id).toHaveLength(36);
    expect(existsSync(dbPath)).toBe(true);
  });

  test("embedded migration SQL matches the checked-in migrations/001-initial.sql", async () => {
    const fileSql = await Bun.file(
      join(import.meta.dir, "..", "..", "..", "migrations", "001-initial.sql"),
    ).text();
    // Normalize the header comment: the file's prose header is documentation;
    // compare the executable part.
    const executablePart = fileSql.slice(fileSql.indexOf("CREATE TABLE"));
    expect(MIGRATION_001_INITIAL).toContain(executablePart.trim());
  });
});

describe("registry deletion does not break commit behavior (VT-12)", () => {
  test("init registers; delete DB; commit still applies the footer", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);

    const runner = new GitRunner({ env: repo.env });
    const adapter = new GitAdapter(runner);
    const context = await adapter.discoverRepository(repo.root);
    const config = new GitConfigStore(runner);

    // Configure like init does.
    await config.setEnabled(context, true);
    await config.setMode(context, "hybrid");
    await config.setCommitFormat(context, "footer");

    // Install a hook that runs the internal command from source.
    const projectRoot = join(import.meta.dir, "..", "..", "..");
    const { chmodSync } = await import("node:fs");
    const hookPath = join(repo.root, ".git", "hooks", "commit-msg");
    await Bun.write(
      hookPath,
      `#!/bin/sh\n'${process.execPath}' '${join(projectRoot, "src", "main.ts")}' hook commit-msg "$1" || exit $?\n`,
    );
    chmodSync(hookPath, 0o755);

    // Register in a temp DB like init would.
    const dataDir = makeDataDir();
    const registry = new SqliteRepositoryRegistry({
      databasePath: join(dataDir, "jira-flow.db"),
    });
    await registry.register({ path: repo.root, displayName: "slice", remoteUrl: null });
    expect(existsSync(join(dataDir, "jira-flow.db"))).toBe(true);

    // Commit works with the registry present.
    await repo.runOk(["switch", "-c", "feat/ABC-123-login"]);
    await repo.commit("feat(auth): first");
    expect(await repo.runOk(["log", "-1", "--pretty=%B"])).toContain("Jira: ABC-123");

    // Delete the database entirely.
    rmSync(join(dataDir, "jira-flow.db"), { force: true });

    // Commit still applies the footer.
    await repo.commit("feat(auth): second");
    const message = await repo.runOk(["log", "-1", "--pretty=%B"]);
    expect(message).toContain("feat(auth): second");
    expect(message).toContain("Jira: ABC-123");
  });
});
