import { existsSync } from "node:fs";
import type {
  ControlPlaneRegistryPort,
  RegisteredRepository,
  RepositoryCacheEntry,
} from "../../application/ports/registry.port";
import { openSqliteDatabase } from "./database";
import { runMigrations } from "./migrations";

/**
 * SQLite repository registry (ADR-0006/O-01, architecture §20-25).
 *
 * Registry rows are dashboard metadata only — never repository truth.
 * Registration happens after a successful init; a registry failure must
 * never roll back a functional repository, and deleting the database must
 * never break commit behavior (both are handled by callers/tests).
 *
 * The database is opened per operation and closed afterwards; the commit
 * hook never touches this class.
 */

interface RepositoryRow {
  id: string;
  path: string;
  display_name: string;
  remote_url: string | null;
  created_at: number;
  updated_at: number;
  last_seen_at: number | null;
  last_opened_at: number | null;
}

interface CacheRow {
  repository_id: string;
  branch: string | null;
  branch_issue: string | null;
  linked_issue: string | null;
  active_issue: string | null;
  active_issue_source: string | null;
  mode: string | null;
  enabled: number | null;
  health: RepositoryCacheEntry["health"];
  last_sync_at: number;
}

export class SqliteRepositoryRegistry implements ControlPlaneRegistryPort {
  private readonly databasePath: string;

  constructor(options: { databasePath: string }) {
    this.databasePath = options.databasePath;
  }

  async register(input: {
    path: string;
    displayName: string;
    remoteUrl: string | null;
  }): Promise<RegisteredRepository> {
    const db = openSqliteDatabase({ path: this.databasePath, ensureDirectory: true });
    try {
      runMigrations(db);
      const now = Date.now();

      const existing = db
        .query<RepositoryRow, [string]>("SELECT * FROM repositories WHERE path = ?")
        .get(input.path);

      if (existing !== null) {
        db.run(
          "UPDATE repositories SET display_name = ?, remote_url = ?, updated_at = ?, last_seen_at = ? WHERE path = ?",
          [input.displayName, input.remoteUrl, now, now, input.path],
        );
        return {
          id: existing.id,
          path: input.path,
          displayName: input.displayName,
          remoteUrl: input.remoteUrl,
          createdAt: existing.created_at,
          updatedAt: now,
          lastSeenAt: now,
          lastOpenedAt: existing.last_opened_at,
        };
      }

      const id = crypto.randomUUID();
      db.run(
        "INSERT INTO repositories (id, path, display_name, remote_url, created_at, updated_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, input.path, input.displayName, input.remoteUrl, now, now, now],
      );

      return {
        id,
        path: input.path,
        displayName: input.displayName,
        remoteUrl: input.remoteUrl,
        createdAt: now,
        updatedAt: now,
        lastSeenAt: now,
        lastOpenedAt: null,
      };
    } finally {
      db.close();
    }
  }

  /** Looks up a registry row by path; used by later epics. */
  async findByPath(path: string): Promise<RegisteredRepository | null> {
    if (!existsSync(this.databasePath)) {
      return null;
    }
    const db = openSqliteDatabase({ path: this.databasePath });
    try {
      const row = db
        .query<RepositoryRow, [string]>("SELECT * FROM repositories WHERE path = ?")
        .get(path);
      return row === null ? null : toRegistered(row);
    } finally {
      db.close();
    }
  }

  async unregister(path: string): Promise<boolean> {
    const db = openSqliteDatabase({ path: this.databasePath });
    try {
      runMigrations(db);
      const result = db.run("DELETE FROM repositories WHERE path = ?", [path]);
      return result.changes > 0;
    } finally {
      db.close();
    }
  }

  async unregisterById(id: string): Promise<boolean> {
    return this.deleteWhere("id", id);
  }

  async findById(id: string): Promise<RegisteredRepository | null> {
    if (!existsSync(this.databasePath)) return null;
    const db = openSqliteDatabase({ path: this.databasePath });
    try {
      runMigrations(db);
      const row = db
        .query<RepositoryRow, [string]>("SELECT * FROM repositories WHERE id = ?")
        .get(id);
      return row === null ? null : toRegistered(row);
    } finally {
      db.close();
    }
  }

  async list(): Promise<RegisteredRepository[]> {
    if (!existsSync(this.databasePath)) return [];
    const db = openSqliteDatabase({ path: this.databasePath });
    try {
      runMigrations(db);
      return db
        .query<RepositoryRow, []>(
          "SELECT * FROM repositories ORDER BY COALESCE(last_opened_at, last_seen_at, updated_at) DESC, display_name ASC",
        )
        .all()
        .map(toRegistered);
    } finally {
      db.close();
    }
  }

  async relocate(
    id: string,
    path: string,
    displayName: string,
    remoteUrl: string | null,
  ): Promise<void> {
    const db = this.open();
    try {
      const now = Date.now();
      const result = db.run(
        "UPDATE repositories SET path = ?, display_name = ?, remote_url = ?, updated_at = ?, last_seen_at = ? WHERE id = ?",
        [path, displayName, remoteUrl, now, now, id],
      );
      if (result.changes === 0) throw new Error(`unknown repository id: ${id}`);
    } finally {
      db.close();
    }
  }

  async touchSeen(id: string): Promise<void> {
    await this.touch(id, "last_seen_at");
  }

  async touchOpened(id: string): Promise<void> {
    await this.touch(id, "last_opened_at");
  }

  async upsertCache(entry: RepositoryCacheEntry): Promise<void> {
    const db = this.open();
    try {
      db.run(
        `INSERT INTO repository_cache (
          repository_id, branch, branch_issue, linked_issue, active_issue,
          active_issue_source, mode, enabled, health, last_sync_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(repository_id) DO UPDATE SET
          branch = excluded.branch,
          branch_issue = excluded.branch_issue,
          linked_issue = excluded.linked_issue,
          active_issue = excluded.active_issue,
          active_issue_source = excluded.active_issue_source,
          mode = excluded.mode,
          enabled = excluded.enabled,
          health = excluded.health,
          last_sync_at = excluded.last_sync_at`,
        [
          entry.repositoryId,
          entry.branch,
          entry.branchIssue,
          entry.linkedIssue,
          entry.activeIssue,
          entry.activeIssueSource,
          entry.mode,
          entry.enabled === null ? null : entry.enabled ? 1 : 0,
          entry.health,
          entry.lastSyncAt,
        ],
      );
    } finally {
      db.close();
    }
  }

  async getCache(repositoryId: string): Promise<RepositoryCacheEntry | null> {
    if (!existsSync(this.databasePath)) return null;
    const db = openSqliteDatabase({ path: this.databasePath });
    try {
      runMigrations(db);
      const row = db
        .query<CacheRow, [string]>("SELECT * FROM repository_cache WHERE repository_id = ?")
        .get(repositoryId);
      return row === null ? null : toCache(row);
    } finally {
      db.close();
    }
  }

  private open() {
    const db = openSqliteDatabase({ path: this.databasePath, ensureDirectory: true });
    runMigrations(db);
    return db;
  }

  private async deleteWhere(column: "id" | "path", value: string): Promise<boolean> {
    if (!existsSync(this.databasePath)) return false;
    const db = this.open();
    try {
      return db.run(`DELETE FROM repositories WHERE ${column} = ?`, [value]).changes > 0;
    } finally {
      db.close();
    }
  }

  private async touch(id: string, column: "last_seen_at" | "last_opened_at"): Promise<void> {
    const db = this.open();
    try {
      const now = Date.now();
      db.run(`UPDATE repositories SET ${column} = ?, updated_at = ? WHERE id = ?`, [now, now, id]);
    } finally {
      db.close();
    }
  }
}

function toRegistered(row: RepositoryRow): RegisteredRepository {
  return {
    id: row.id,
    path: row.path,
    displayName: row.display_name,
    remoteUrl: row.remote_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
    lastOpenedAt: row.last_opened_at,
  };
}

function toCache(row: CacheRow): RepositoryCacheEntry {
  return {
    repositoryId: row.repository_id,
    branch: row.branch,
    branchIssue: row.branch_issue,
    linkedIssue: row.linked_issue,
    activeIssue: row.active_issue,
    activeIssueSource: row.active_issue_source,
    mode: row.mode,
    enabled: row.enabled === null ? null : row.enabled === 1,
    health: row.health,
    lastSyncAt: row.last_sync_at,
  };
}
