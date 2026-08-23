import { describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * VS-0 CLI smoke (VT-01).
 *
 * `--help` and `--version` must work with the current working directory
 * OUTSIDE any Git repository (ADR-0007/O-02).
 */

const projectRoot = join(import.meta.dir, "..", "..", "..");

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runJiraFlowFromSource(args: string[], cwd: string): Promise<RunResult> {
  const entry = join(projectRoot, "src", "main.ts");
  const proc = Bun.spawn([process.execPath, entry, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
  });

  return Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]).then(([stdout, stderr, exitCode]) => ({
    exitCode,
    stdout,
    stderr,
  }));
}

describe("jira-flow --help / --version outside a Git repository", () => {
  test("--version prints the version and exits 0", async () => {
    const result = await runJiraFlowFromSource(["--version"], tmpdir());
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("1.0.0-alpha.0");
  });

  test("--help prints usage and exits 0", async () => {
    const result = await runJiraFlowFromSource(["--help"], tmpdir());
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage:");
    expect(result.stdout).toContain("jira-flow");
    expect(result.stdout).toContain("--version");
  });

  test("help works when invoked through the error path too", async () => {
    const result = await runJiraFlowFromSource(["--help"], projectRoot);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage:");
  });
});
