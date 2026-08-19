import type { RegisteredRepository, RegistryPort } from "../../application/ports/registry.port";
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

export class SqliteRepositoryRegistry implements RegistryPort {
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
          "UPDATE repositories SET display_name = ?, remote_url = ?, updated_at = ? WHERE path = ?",
          [input.displayName, input.remoteUrl, now, input.path],
        );
        return {
          id: existing.id,
          path: input.path,
          displayName: input.displayName,
          remoteUrl: input.remoteUrl,
          createdAt: existing.created_at,
          updatedAt: now,
        };
      }

      const id = crypto.randomUUID();
      db.run(
        "INSERT INTO repositories (id, path, display_name, remote_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        [id, input.path, input.displayName, input.remoteUrl, now, now],
      );

      return {
        id,
        path: input.path,
        displayName: input.displayName,
        remoteUrl: input.remoteUrl,
        createdAt: now,
        updatedAt: now,
      };
    } finally {
      db.close();
    }
  }

  /** Looks up a registry row by path; used by later epics. */
  async findByPath(path: string): Promise<RegisteredRepository | null> {
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
}

function toRegistered(row: RepositoryRow): RegisteredRepository {
  return {
    id: row.id,
    path: row.path,
    displayName: row.display_name,
    remoteUrl: row.remote_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
