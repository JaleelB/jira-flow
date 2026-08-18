import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * VT-02 — compiled binary smoke.
 *
 * The standalone executable must print the injected version (never read
 * `package.json` at runtime) and must not require a separate Bun runtime.
 * Runs the binary with cwd outside any Git repository.
 */

const projectRoot = join(import.meta.dir, "..", "..");
const binaryPath = join(projectRoot, "dist", "jira-flow");

beforeAll(async () => {
  const proc = Bun.spawn([process.execPath, "run", "build"], {
    cwd: projectRoot,
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`bun run build failed with exit code ${exitCode}`);
  }
  if (!existsSync(binaryPath)) {
    throw new Error(`expected compiled binary at ${binaryPath}`);
  }
});

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runBinary(args: string[], cwd: string): Promise<RunResult> {
  const proc = Bun.spawn([binaryPath, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
  });

  return Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]).then(([stdout, stderr, exitCode]) => ({ exitCode, stdout, stderr }));
}

describe("compiled jira-flow binary", () => {
  test("--version prints the injected version and exits 0", async () => {
    const result = await runBinary(["--version"], "/tmp");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("1.0.0-alpha.0");
  });

  test("--help prints usage and exits 0", async () => {
    const result = await runBinary(["--help"], "/tmp");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage:");
    expect(result.stdout).toContain("jira-flow");
  });
});
