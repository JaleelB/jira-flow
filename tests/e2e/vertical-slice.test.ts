import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  COMPILED_BINARY,
  ensureCompiledBinary,
  PROJECT_ROOT,
  runCompiledJiraFlow,
} from "../helpers/run-jiraflow";
import { createTempGitRepository, type TempRepository } from "../helpers/temp-repository";

/**
 * T-20 / VS1-12 — compiled-binary vertical-slice gate.
 *
 * Covers VT-11 (init → Hybrid commit footer → status → doctor → idempotent
 * init, including nested-directory init), VT-12 (delete SQLite, commit still
 * footers), and VT-13 (production-source invariant scan). TUI Q-to-quit is
 * VT-14 (`tests/e2e/tui-overview.test.tsx`); OpenTUI needs a capability
 * handshake that a raw PTY does not provide.
 */

const repos: TempRepository[] = [];
const dirs: string[] = [];

beforeAll(async () => {
  await ensureCompiledBinary();
});

afterAll(() => {
  for (const repo of repos.splice(0)) repo.cleanup();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function makeDataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "jiraflow-e2e-data-"));
  dirs.push(dir);
  return dir;
}

function envFor(repo: TempRepository, dataDir: string): Record<string, string | undefined> {
  return {
    ...repo.env,
    JIRAFLOW_DATA_DIR: dataDir,
  };
}

async function makeRepo(): Promise<TempRepository> {
  const repo = createTempGitRepository();
  repos.push(repo);
  await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);
  return repo;
}

describe("compiled vertical slice (VT-11, VT-12)", () => {
  test("init, Hybrid footer commit, status, doctor, idempotent init, nested path, SQLite deletion", async () => {
    const repo = await makeRepo();
    const dataDir = makeDataDir();
    const env = envFor(repo, dataDir);

    await Bun.write(join(repo.root, "packages", "app", "README.md"), "nested\n");
    const nested = join(repo.root, "packages", "app");

    const init = await runCompiledJiraFlow(["init", "--yes"], { cwd: nested, env });
    expect(init.exitCode).toBe(0);
    expect(init.stdout).toContain("Initialized JiraFlow");

    const dbPath = join(dataDir, "jira-flow.db");
    expect(existsSync(dbPath)).toBe(true);

    const hook = await Bun.file(join(repo.root, ".git", "hooks", "commit-msg")).text();
    expect(hook).toContain(COMPILED_BINARY.replaceAll("\\", "/"));
    expect(hook).toContain("hook commit-msg");

    await repo.runOk(["switch", "-c", "feat/ABC-123-login"]);
    await repo.commit("feat(auth): add login");
    const firstMessage = await repo.runOk(["log", "-1", "--pretty=%B"]);
    expect(firstMessage).toContain("feat(auth): add login");
    expect(firstMessage).toContain("Jira: ABC-123");

    const status = await runCompiledJiraFlow(["status"], { cwd: repo.root, env });
    expect(status.exitCode).toBe(0);
    expect(status.stdout).toContain("enabled");
    expect(status.stdout).toContain("Hybrid");
    expect(status.stdout).toContain("feat/ABC-123-login");
    expect(status.stdout).toContain("ABC-123");
    expect(status.stdout).toContain("branch");
    expect(status.stdout).toContain("footer");
    expect(status.stdout).toContain("healthy");

    const doctor = await runCompiledJiraFlow(["doctor"], { cwd: repo.root, env });
    expect(doctor.exitCode).toBe(0);
    expect(doctor.stdout).toContain("Doctor: healthy");
    expect(doctor.stdout).toContain("[ok] git.repository");
    expect(doctor.stdout).toContain("[ok] config.valid");
    expect(doctor.stdout).toContain("[ok] hooks.integration");
    expect(doctor.stdout).toContain("[ok] hooks.ownership");
    expect(doctor.stdout).toContain("[ok] issue.pattern");
    expect(doctor.stdout).toContain("[ok] active-issue.resolve");

    const again = await runCompiledJiraFlow(["init", "--yes"], { cwd: repo.root, env });
    expect(again.exitCode).toBe(0);
    expect(again.stdout).toContain("already configured");

    rmSync(dbPath, { force: true });
    expect(existsSync(dbPath)).toBe(false);

    await repo.commit("feat(auth): second");
    const secondMessage = await repo.runOk(["log", "-1", "--pretty=%B"]);
    expect(secondMessage).toContain("feat(auth): second");
    expect(secondMessage).toContain("Jira: ABC-123");
  }, 60_000);
});

describe("production source invariants (VT-13)", () => {
  test("src does not hard-code hook paths or legacy helpers outside the exact migrator", () => {
    const srcRoot = join(PROJECT_ROOT, "src");
    const files = listSourceFiles(srcRoot);
    expect(files.length).toBeGreaterThan(0);

    const hits: string[] = [];
    for (const file of files) {
      const stripped = stripCommentsAndStringsKeepCode(readFileSync(file, "utf8"));
      const relative = file.slice(PROJECT_ROOT.length + 1);
      const isLegacyMigrationBoundary = relative.includes("legacy");

      if (stripped.includes(".git/hooks")) {
        hits.push(`${relative}: hard-coded .git/hooks path`);
      }
      if (!isLegacyMigrationBoundary && /\bpost-checkout\b/.test(stripped)) {
        hits.push(`${relative}: post-checkout reference`);
      }
      if (!isLegacyMigrationBoundary && /\bcommitmsg\b/.test(stripped)) {
        hits.push(`${relative}: commitmsg helper binary`);
      }
      if (!isLegacyMigrationBoundary && /\bpostco\b/.test(stripped)) {
        hits.push(`${relative}: postco helper binary`);
      }
    }

    expect(hits).toEqual([]);
  });
});

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(path));
      continue;
    }
    if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      out.push(path);
    }
  }
  return out;
}

/**
 * Drop comments so documentation of the *forbidden* patterns (e.g. "never
 * hard-code `.git/hooks`") does not fail the gate. String literals stay —
 * those are the runtime values we actually want to forbid.
 */
function stripCommentsAndStringsKeepCode(source: string): string {
  let result = "";
  let i = 0;
  while (i < source.length) {
    const here = source.slice(i, i + 2);
    if (here === "//") {
      const newline = source.indexOf("\n", i);
      i = newline === -1 ? source.length : newline;
      continue;
    }
    if (here === "/*") {
      const end = source.indexOf("*/", i + 2);
      i = end === -1 ? source.length : end + 2;
      continue;
    }
    const quote = source[i];
    if (quote === "'" || quote === '"' || quote === "`") {
      result += quote;
      i += 1;
      while (i < source.length) {
        if (source[i] === "\\") {
          result += source.slice(i, i + 2);
          i += 2;
          continue;
        }
        result += source[i];
        if (source[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    result += source[i];
    i += 1;
  }
  return result;
}
