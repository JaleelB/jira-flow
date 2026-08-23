import { closeSync, existsSync, mkdirSync, openSync, rmSync, statSync, writeSync } from "node:fs";
import { join } from "node:path";

/**
 * Compiled `jira-flow` runner for E2E tests (VT-11 / T-20).
 *
 * Builds `dist/jira-flow` once per process (serialized across files via a
 * lockfile) and spawns the standalone binary with an explicit cwd and env
 * so isolated `GIT_CONFIG_*` / `JIRAFLOW_DATA_DIR` never leak to the
 * developer's real Git config or app data directory (DR-0015).
 */

export const PROJECT_ROOT = join(import.meta.dir, "..", "..");
export const COMPILED_BINARY = join(
  PROJECT_ROOT,
  "dist",
  process.platform === "win32" ? "jira-flow.exe" : "jira-flow",
);

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RunCompiledOptions {
  cwd: string;
  env?: Record<string, string | undefined>;
}

const LOCK_PATH = join(PROJECT_ROOT, "dist", ".compile.lock");
const LOCK_STALE_MS = 180_000;

let builtThisProcess: Promise<string> | undefined;

export function ensureCompiledBinary(): Promise<string> {
  builtThisProcess ??= buildCompiledBinary();
  return builtThisProcess;
}

async function buildCompiledBinary(): Promise<string> {
  const release = await acquireCompileLock();
  try {
    const proc = Bun.spawn([process.execPath, "run", "build"], {
      cwd: PROJECT_ROOT,
      stdout: "inherit",
      stderr: "inherit",
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`bun run build failed with exit code ${exitCode}`);
    }
    if (!existsSync(COMPILED_BINARY)) {
      throw new Error(`expected compiled binary at ${COMPILED_BINARY}`);
    }
    return COMPILED_BINARY;
  } finally {
    release();
  }
}

async function acquireCompileLock(): Promise<() => void> {
  mkdirSync(join(PROJECT_ROOT, "dist"), { recursive: true });
  const deadline = Date.now() + LOCK_STALE_MS;
  while (Date.now() < deadline) {
    try {
      const fd = openSync(LOCK_PATH, "wx");
      writeSync(fd, String(process.pid));
      return () => {
        closeSync(fd);
        rmSync(LOCK_PATH, { force: true });
      };
    } catch {
      try {
        if (Date.now() - statSync(LOCK_PATH).mtimeMs > LOCK_STALE_MS) {
          rmSync(LOCK_PATH, { force: true });
          continue;
        }
      } catch {
        // lock vanished between stat and retry
      }
      await Bun.sleep(250);
    }
  }
  throw new Error("timed out waiting for jira-flow compile lock");
}

export async function runCompiledJiraFlow(
  args: string[],
  options: RunCompiledOptions,
): Promise<RunResult> {
  const proc = Bun.spawn([COMPILED_BINARY, ...args], {
    cwd: options.cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: options.env ?? process.env,
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exitCode, stdout, stderr };
}
