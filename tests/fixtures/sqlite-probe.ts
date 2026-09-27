/**
 * Test-only probe entry compiled by the SQLite smoke test (VT-04).
 *
 * Proves that `bun:sqlite` works inside a `bun build --compile` standalone
 * executable by exercising the production database adapter:
 *
 *   sqlite-probe <db-path> <value>
 *
 * Creates a table, inserts the value, queries it back, and prints the query
 * result. Exit 0 on success; any failure exits non-zero with a message on
 * stderr.
 */

import { openSqliteDatabase } from "../../src/infrastructure/sqlite/database";

async function main(): Promise<number> {
  const dbPath = process.argv[2];
  const value = process.argv[3] ?? "probe";

  if (!dbPath) {
    process.stderr.write("usage: sqlite-probe <db-path> [value]\n");
    return 2;
  }

  const db = openSqliteDatabase({ path: dbPath, ensureDirectory: true });
  try {
    db.run("CREATE TABLE IF NOT EXISTS probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)");
    db.run("INSERT INTO probe (value) VALUES (?)", [value]);

    const row = db
      .query<{ value: string }, [string]>("SELECT value FROM probe ORDER BY id DESC LIMIT 1")
      .get(value);

    if (!row || row.value !== value) {
      process.stderr.write(`probe mismatch: expected ${value}, got ${row?.value ?? "nothing"}\n`);
      return 1;
    }

    const foreignKeys = db.query<{ foreign_keys: number }, []>("PRAGMA foreign_keys").get();
    const journalMode = db.query<{ journal_mode: string }, []>("PRAGMA journal_mode").get();

    process.stdout.write(
      `ok value=${row.value} foreign_keys=${foreignKeys?.foreign_keys} journal_mode=${journalMode?.journal_mode}\n`,
    );
    return 0;
  } finally {
    db.close();
  }
}

process.exitCode = await main();
