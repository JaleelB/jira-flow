import { afterAll, describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitTimeoutError, GitUnavailableError } from "../../../src/domain/errors";
import { GitRunner } from "../../../src/infrastructure/git/git-runner";
import {
  createTempGitRepository,
  createTempNonGitDirectory,
  type TempRepository,
} from "../../helpers/temp-repository";

/**
 * VT-05 (part 1) — GitRunner.
 *
 * Success, invalid command with preserved stderr, structured non-repo
 * failure, and isolated GIT_CONFIG_GLOBAL.
 */

const repos: TempRepository[] = [];
const nonRepos: Array<{ cleanup: () => void }> = [];

afterAll(() => {
  for (const repo of repos.splice(0)) repo.cleanup();
  for (const dir of nonRepos.splice(0)) dir.cleanup();
});

describe("GitRunner", () => {
  test("git version succeeds and captures stdout", async () => {
    const runner = new GitRunner();
    const result = await runner.run({ cwd: tmpdir(), args: ["--version"] });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toContain("git version");
    expect(result.stderr).toBe("");
  });

  test("invalid command preserves stderr and exit code", async () => {
    const runner = new GitRunner();
    const result = await runner.run({
      cwd: tmpdir(),
      args: ["definitely-not-a-real-command"],
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  test("rev-parse in a non-repo fails with structured output", async () => {
    const nonRepo = createTempNonGitDirectory();
    nonRepos.push(nonRepo);
    const runner = new GitRunner();
    const result = await runner.run({
      cwd: nonRepo.path,
      args: ["rev-parse", "--is-inside-work-tree"],
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toLowerCase()).toContain("not a git repository");
  });

  test("temp repo rev-parse --is-inside-work-tree returns true", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    const runner = new GitRunner();
    const result = await runner.run({
      cwd: repo.root,
      args: ["rev-parse", "--is-inside-work-tree"],
      env: repo.env,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("true");
  });

  test("reads config only from the isolated environment", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);

    // Sanity: the isolated global config is empty, so a global-only key is unset.
    const probe = Bun.spawnSync(["git", "config", "--global", "--get", "init.templateDir"], {
      cwd: repo.root,
      stdout: "pipe",
      stderr: "pipe",
      env: repo.env,
    });
    expect(probe.exitCode).not.toBe(0);

    // And the repo's local identity is the test identity, not the developer's.
    const local = Bun.spawnSync(["git", "config", "--local", "--get", "user.name"], {
      cwd: repo.root,
      stdout: "pipe",
      stderr: "pipe",
      env: repo.env,
    });
    expect(local.stdout.toString().trim()).toBe("JiraFlow Test");
  });

  test("stdin is forwarded to the process", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    const runner = new GitRunner();
    const result = await runner.run({
      cwd: repo.root,
      args: ["hash-object", "--stdin"],
      stdin: "hello jiraflow\n",
      env: repo.env,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toHaveLength(40);
  });

  test("missing executable raises GitUnavailableError", async () => {
    const runner = new GitRunner({ executable: "/nonexistent/jiraflow-missing-git" });
    expect(runner.run({ cwd: tmpdir(), args: ["--version"] })).rejects.toBeInstanceOf(
      GitUnavailableError,
    );
  });

  test("timeout raises GitTimeoutError, not GitUnavailableError", async () => {
    const fixture = join(import.meta.dir, "..", "..", "fixtures", "slow-git.ts");
    const runner = new GitRunner({ executable: process.execPath, timeoutMs: 80 });
    let caught: unknown;
    try {
      await runner.run({ cwd: tmpdir(), args: [fixture, "status"] });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GitTimeoutError);
    expect(caught).not.toBeInstanceOf(GitUnavailableError);
  });
});
