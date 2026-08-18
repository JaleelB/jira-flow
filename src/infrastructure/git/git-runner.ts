import { GitUnavailableError } from "../../domain/errors";

/**
 * Git process adapter (ADR-0003, architecture §8.1).
 *
 * All Git execution passes through `runGit`. The adapter captures stdout,
 * stderr, and exit code, and never discards useful Git error output.
 * No shell is involved; arguments are passed directly to the `git` binary.
 */

export interface GitCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface RunGitRequest {
  /** Working directory for the Git invocation. */
  cwd: string;
  /** Arguments passed to `git`. */
  args: string[];
  /** Optional stdin content written to the process. */
  stdin?: string;
  /**
   * Optional environment override (used by tests to isolate
   * GIT_CONFIG_GLOBAL / GIT_CONFIG_SYSTEM). Defaults to the current
   * process environment.
   */
  env?: Record<string, string | undefined>;
}

export class GitRunner {
  private readonly gitExecutable: string;

  constructor(gitExecutable = "git") {
    this.gitExecutable = gitExecutable;
  }

  async run(request: RunGitRequest): Promise<GitCommandResult> {
    let proc;
    try {
      proc = Bun.spawn([this.gitExecutable, ...request.args], {
        cwd: request.cwd,
        stdin: request.stdin === undefined ? "ignore" : "pipe",
        stdout: "pipe",
        stderr: "pipe",
        env: request.env ?? process.env,
      });
    } catch (error) {
      throw new GitUnavailableError(error instanceof Error ? error.message : String(error));
    }

    if (request.stdin !== undefined && proc.stdin) {
      proc.stdin.write(request.stdin);
      await proc.stdin.end();
    }

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    return { stdout, stderr, exitCode };
  }

  /**
   * Runs Git and returns stdout, throwing a `GitUnavailableError`-carrying
   * Error with stderr context when the command fails.
   */
  async runOrThrow(request: RunGitRequest): Promise<string> {
    const result = await this.run(request);
    if (result.exitCode !== 0) {
      throw new Error(
        `git ${request.args.join(" ")} failed with exit code ${result.exitCode}: ${result.stderr.trim()}`,
      );
    }
    return result.stdout;
  }
}
