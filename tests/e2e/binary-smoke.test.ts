import { beforeAll, describe, expect, test } from "bun:test";
import { ensureCompiledBinary, runCompiledJiraFlow } from "../helpers/run-jiraflow";

/**
 * VT-02 — compiled binary smoke.
 *
 * The standalone executable must print the injected version (never read
 * `package.json` at runtime) and must not require a separate Bun runtime.
 * Runs the binary with cwd outside any Git repository.
 */

beforeAll(async () => {
  await ensureCompiledBinary();
});

describe("compiled jira-flow binary", () => {
  test("--version prints the injected version and exits 0", async () => {
    const result = await runCompiledJiraFlow(["--version"], { cwd: "/tmp" });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("1.0.0-alpha.0");
  });

  test("--help prints usage and exits 0", async () => {
    const result = await runCompiledJiraFlow(["--help"], { cwd: "/tmp" });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage:");
    expect(result.stdout).toContain("jira-flow");
  });
});
