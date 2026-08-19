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

export const EMBEDDED_MIGRATIONS: Migration[] = [
  { version: 1, name: "001-initial", sql: MIGRATION_001_INITIAL },
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
