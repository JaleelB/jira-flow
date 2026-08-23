import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openSqliteDatabase } from "../../../src/infrastructure/sqlite/database";
import { SqliteIssueMetadataRepository } from "../../../src/infrastructure/sqlite/issue-metadata-repository";
import {
  MIGRATION_002_CONTROL_PLANE,
  runMigrations,
} from "../../../src/infrastructure/sqlite/migrations";
import { SqliteRepositoryRegistry } from "../../../src/infrastructure/sqlite/repository-registry";
import { SqliteSettingsRepository } from "../../../src/infrastructure/sqlite/settings-repository";

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function databasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "jiraflow-control-plane-"));
  dirs.push(dir);
  return join(dir, "jira-flow.db");
}

describe("E8 SQLite control plane", () => {
  test("fresh database applies ordered migrations and required pragmas", () => {
    const path = databasePath();
    const db = openSqliteDatabase({ path, ensureDirectory: true });
    expect(runMigrations(db)).toEqual([1, 2]);
    expect(runMigrations(db)).toEqual([]);
    expect(db.query<{ foreign_keys: number }, []>("PRAGMA foreign_keys").get()?.foreign_keys).toBe(
      1,
    );
    const timeout = db.query<Record<string, number>, []>("PRAGMA busy_timeout").get();
    expect(timeout ? Object.values(timeout)[0] : undefined).toBe(5000);
    const tables = db
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name);
    expect(tables).toContain("repository_cache");
    expect(tables).toContain("issue_metadata");
    expect(tables).toContain("settings");
    db.close();
  });

  test("checked-in migration 002 matches the embedded executable SQL", async () => {
    const sql = await Bun.file(
      join(import.meta.dir, "..", "..", "..", "migrations", "002-control-plane.sql"),
    ).text();
    expect(MIGRATION_002_CONTROL_PLANE.replaceAll(/\s+/g, " ")).toContain(
      sql.trim().replaceAll(/\s+/g, " "),
    );
  });

  test("registry cache, timestamps, relocation, and cascade are durable", async () => {
    const path = databasePath();
    const registry = new SqliteRepositoryRegistry({ databasePath: path });
    const repo = await registry.register({ path: "/tmp/old", displayName: "old", remoteUrl: null });
    await registry.touchSeen(repo.id);
    await registry.touchOpened(repo.id);
    await registry.upsertCache({
      repositoryId: repo.id,
      branch: "feat/ABC-1",
      branchIssue: "ABC-1",
      linkedIssue: null,
      activeIssue: "ABC-1",
      activeIssueSource: "branch",
      mode: "hybrid",
      enabled: true,
      health: "healthy",
      lastSyncAt: 123,
    });
    expect((await registry.findById(repo.id))?.lastSeenAt).toBeNumber();
    expect((await registry.findById(repo.id))?.lastOpenedAt).toBeNumber();
    expect((await registry.getCache(repo.id))?.activeIssue).toBe("ABC-1");
    await registry.relocate(repo.id, "/tmp/new", "new", "https://example.test/new.git");
    expect((await registry.findById(repo.id))?.path).toBe("/tmp/new");
    expect(await registry.unregisterById(repo.id)).toBe(true);
    expect(await registry.getCache(repo.id)).toBeNull();
  });

  test("settings use constrained defaults and unset restores the built-in", async () => {
    const path = databasePath();
    const settings = new SqliteSettingsRepository(path);
    expect((await settings.read()).defaultMode).toBe("hybrid");
    await settings.set("defaultMode", "manual");
    await settings.set("copyPrTitleToClipboard", false);
    expect((await settings.read()).defaultMode).toBe("manual");
    expect(await settings.get("copyPrTitleToClipboard")).toBe(false);
    await settings.unset("defaultMode");
    expect(await settings.get("defaultMode")).toBe("hybrid");
  });

  test("issue metadata upserts by repository and Jira key and cascades", async () => {
    const path = databasePath();
    const registry = new SqliteRepositoryRegistry({ databasePath: path });
    const metadata = new SqliteIssueMetadataRepository(path);
    const repo = await registry.register({
      path: "/tmp/repo",
      displayName: "repo",
      remoteUrl: null,
    });
    await metadata.save(repo.id, "ABC-1", "First title");
    const second = await metadata.save(repo.id, "ABC-1", "Updated title");
    expect(second.storyTitle).toBe("Updated title");
    expect(second.lastUsedAt).toBeNumber();
    await registry.unregisterById(repo.id);
    expect(await metadata.find(repo.id, "ABC-1")).toBeNull();
  });

  test("deleting the database recreates settings without affecting callers", async () => {
    const path = databasePath();
    const settings = new SqliteSettingsRepository(path);
    await settings.set("theme", "dark");
    rmSync(path, { force: true });
    expect(existsSync(path)).toBe(false);
    expect((await settings.read()).theme).toBe("system");
  });
});
