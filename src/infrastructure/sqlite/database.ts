import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Thin `bun:sqlite` adapter (ADR-0001/O-02, architecture §22).
 *
 * The adapter owns connection setup: foreign keys, WAL journaling, and a busy
 * timeout are applied on every open. No ORM.
 *
 * The commit hook never opens this module (ADR-0004/O-03); only CLI/TUI
 * surfaces that need global data do.
 */

export interface OpenDatabaseOptions {
  /** Absolute path to the database file. */
  path: string;
  /** Create the parent directory when it does not exist. Default: false. */
  ensureDirectory?: boolean;
}

export function openSqliteDatabase(options: OpenDatabaseOptions): Database {
  if (options.ensureDirectory) {
    mkdirSync(dirname(options.path), { recursive: true });
  }

  const db = new Database(options.path, { create: true });

  db.run("PRAGMA foreign_keys = ON");
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA busy_timeout = 5000");

  return db;
}
