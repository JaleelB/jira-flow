import type { Database } from "bun:sqlite";

/**
 * SQLite migrations (architecture §23, VS-1 subset).
 *
 * The executable SQL is embedded here so compiled standalone binaries carry
 * their migrations (Bun compilation does not ship the `migrations/`
 * directory). The embedded copy is verified against the checked-in
 * `migrations/001-initial.sql` by an integration test to prevent drift.
 */

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATION_001_INITIAL = `-- jiraflow 001-initial
CREATE TABLE IF NOT EXISTS repositories (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    remote_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_seen_at INTEGER,
    last_opened_at INTEGER
);
`;

export const MIGRATION_002_CONTROL_PLANE = `-- jiraflow 002-control-plane
CREATE TABLE IF NOT EXISTS repository_cache (
    repository_id TEXT PRIMARY KEY,
    branch TEXT,
    branch_issue TEXT,
    linked_issue TEXT,
    active_issue TEXT,
    active_issue_source TEXT,
    mode TEXT,
    enabled INTEGER,
    health TEXT,
    last_sync_at INTEGER NOT NULL,
    FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS issue_metadata (
    repository_id TEXT NOT NULL,
    jira_key TEXT NOT NULL,
    story_title TEXT,
    last_used_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (repository_id, jira_key),
    FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
`;

export const EMBEDDED_MIGRATIONS: Migration[] = [
  { version: 1, name: "001-initial", sql: MIGRATION_001_INITIAL },
  { version: 2, name: "002-control-plane", sql: MIGRATION_002_CONTROL_PLANE },
];

/** Applies pending migrations inside a transaction; returns the applied versions. */
export function runMigrations(db: Database): number[] {
  db.run(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)",
  );

  const appliedRows = db
    .query<{ version: number }, []>("SELECT version FROM schema_migrations")
    .all();
  const applied = new Set(appliedRows.map((row) => row.version));

  const newlyApplied: number[] = [];
  const pending = [...EMBEDDED_MIGRATIONS].sort((a, b) => a.version - b.version);
  const latest = pending.at(-1)?.version ?? 0;
  const future = [...applied].find((version) => version > latest);
  if (future !== undefined) {
    throw new Error(`database schema version ${future} is newer than supported version ${latest}`);
  }

  for (const migration of pending) {
    if (applied.has(migration.version)) continue;
    applyMigration(db, migration);
    newlyApplied.push(migration.version);
  }

  return newlyApplied;
}

function applyMigration(db: Database, migration: Migration): void {
  const run = db.transaction(() => {
    db.exec(migration.sql);
    db.run("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", [
      migration.version,
      Date.now(),
    ]);
  });
  run();
}
