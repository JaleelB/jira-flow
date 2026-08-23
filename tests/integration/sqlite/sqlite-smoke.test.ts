import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openSqliteDatabase } from "../../../src/infrastructure/sqlite/database";

/**
 * VT-04 — bun:sqlite smoke.
 *
 *  1. in-process: the production adapter opens a temp DB with the required
 *     pragmas and can create/insert/query/close
 *  2. compiled: a standalone probe executable built with `bun build
 *     --compile` (using the same production adapter) can use `bun:sqlite`
 *  3. `--version` does not create the app database
 */

const tempDirs: string[] = [];
const projectRoot = join(import.meta.dir, "..", "..", "..");
const probeSource = join(projectRoot, "tests", "fixtures", "sqlite-probe.ts");
const executableSuffix = process.platform === "win32" ? ".exe" : "";
const probeBinary = join(projectRoot, "dist", `sqlite-probe${executableSuffix}`);
const mainBinary = join(projectRoot, "dist", `jira-flow${executableSuffix}`);

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "jiraflow-sqlite-"));
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

beforeAll(async () => {
  const proc = Bun.spawn(
    [process.execPath, "build", "--compile", probeSource, "--outfile", probeBinary],
    { cwd: projectRoot, stdout: "inherit", stderr: "inherit" },
  );
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`failed to compile sqlite probe (exit ${code})`);
  }
});

describe("bun:sqlite in process", () => {
  test("opens a temp DB with required pragmas and runs CRUD", () => {
    const dir = makeTempDir();
    const dbPath = join(dir, "smoke.db");

    const db = openSqliteDatabase({ path: dbPath });
    expect(existsSync(dbPath)).toBe(true);

    db.run("CREATE TABLE smoke (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
    db.run("INSERT INTO smoke (name) VALUES (?)", ["jiraflow"]);

    const row = db.query<{ name: string }, [string]>("SELECT name FROM smoke").get("jiraflow");
    expect(row?.name).toBe("jiraflow");

    expect(db.query<{ foreign_keys: number }, []>("PRAGMA foreign_keys").get()?.foreign_keys).toBe(
      1,
    );
    expect(db.query<{ journal_mode: string }, []>("PRAGMA journal_mode").get()?.journal_mode).toBe(
      "wal",
    );
    expect(db.query<{ timeout: number }, []>("PRAGMA busy_timeout").get()?.timeout).toBe(5000);

    db.close();
    expect(() => db.query("SELECT 1").get()).toThrow();
  });

  test("ensureDirectory creates parent directories", () => {
    const dir = makeTempDir();
    const dbPath = join(dir, "nested", "deeper", "smoke.db");

    const db = openSqliteDatabase({ path: dbPath, ensureDirectory: true });
    expect(existsSync(dbPath)).toBe(true);
    db.close();
  });

  test("plain Database still works for raw access", () => {
    const dir = makeTempDir();
    const db = new Database(join(dir, "raw.db"), { create: true });
    db.run("SELECT 1");
    db.close();
  });
});

describe("bun:sqlite inside a compiled executable", () => {
  test("compiled probe creates/inserts/queries a temp DB", async () => {
    const dir = makeTempDir();
    const dbPath = join(dir, "probe.db");

    const proc = Bun.spawn([probeBinary, dbPath, "ABC-123"], {
      cwd: tmpdir(),
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env },
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("ok value=ABC-123");
    expect(stdout).toContain("foreign_keys=1");
    expect(stdout).toContain("journal_mode=wal");
  });
});

describe("--version does not create the app database", () => {
  test("binary --version leaves the data dir empty", async () => {
    const dir = makeTempDir();

    const proc = Bun.spawn([mainBinary, "--version"], {
      cwd: tmpdir(),
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, JIRAFLOW_DATA_DIR: dir },
    });
    const [, , exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    expect(exitCode).toBe(0);
    expect(existsSync(join(dir, "jira-flow.db"))).toBe(false);
  });
});
