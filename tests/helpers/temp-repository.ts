import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitRunner } from "../../src/infrastructure/git/git-runner";
import { createIsolatedGitEnvironment, type GitEnvironment } from "./git-environment";

/**
 * Temporary real Git repository helper (DR-0015, architecture §42.3).
 *
 * Every test that touches Git must use this helper. It never touches the
 * JiraFlow development repository or the developer's global Git config.
 */

export interface TempRepository {
  /** Absolute path to the repository work tree root. */
  readonly root: string;
  /** Isolated Git environment used for all commands in this repository. */
  readonly env: Record<string, string | undefined>;
  /** The isolated Git environment (dispose only via `cleanup`). */
  readonly gitEnv: GitEnvironment;
  /** Runs Git in this repository with the isolated environment. */
  run(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  /** Runs Git and expects exit code 0, returning stdout. */
  runOk(args: string[]): Promise<string>;
  /** Creates a commit that modifies a tracked file, returning the commit message used. */
  commit(subject: string): Promise<string>;
  /** Removes the temporary repository. */
  cleanup(): void;
}

export interface CreateTempRepositoryOptions {
  /** Initial branch name. Default: `main`. */
  initialBranch?: string;
}

export function createTempGitRepository(options: CreateTempRepositoryOptions = {}): TempRepository {
  const branch = options.initialBranch ?? "main";
  const runner = new GitRunner();
  const gitEnv = createIsolatedGitEnvironment();
  const root = mkdtempSync(join(tmpdir(), `jiraflow-repo-${branch}-`));

  const spawnSync = (args: string[]) =>
    Bun.spawnSync(["git", ...args], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
      env: gitEnv.env,
    });

  const init = spawnSync(["init", "-b", branch]);
  if (init.exitCode !== 0) {
    gitEnv.dispose();
    rmSync(root, { recursive: true, force: true });
    throw new Error(`git init failed: ${init.stderr.toString()}`);
  }

  const identity = spawnSync(["config", "--local", "user.name", "JiraFlow Test"]);
  const identityEmail = spawnSync(["config", "--local", "user.email", "test@jiraflow.invalid"]);
  if (identity.exitCode !== 0 || identityEmail.exitCode !== 0) {
    gitEnv.dispose();
    rmSync(root, { recursive: true, force: true });
    throw new Error("failed to configure test identity");
  }

  let fileCounter = 0;

  const repo: TempRepository = {
    root,
    env: gitEnv.env,
    gitEnv,
    async run(args: string[]) {
      return runner.run({ cwd: root, args, env: gitEnv.env });
    },
    async runOk(args: string[]) {
      const result = await runner.run({ cwd: root, args, env: gitEnv.env });
      if (result.exitCode !== 0) {
        throw new Error(`git ${args.join(" ")} failed (${result.exitCode}): ${result.stderr}`);
      }
      return result.stdout;
    },
    async commit(subject: string) {
      fileCounter += 1;
      const fileName = `file-${fileCounter}.txt`;
      const content = `content ${fileCounter}\n`;
      await Bun.write(join(root, fileName), content);
      await repo.runOk(["add", fileName]);
      await repo.runOk(["commit", "-m", subject]);
      return subject;
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
      gitEnv.dispose();
    },
  };

  return repo;
}

/** Creates a temporary directory that is not a Git repository. */
export function createTempNonGitDirectory(): { path: string; cleanup: () => void } {
  const path = mkdtempSync(join(tmpdir(), "jiraflow-non-repo-"));
  return {
    path,
    cleanup(): void {
      rmSync(path, { recursive: true, force: true });
    },
  };
}
