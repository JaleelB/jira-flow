import type { Subprocess } from "bun";
import { GitTimeoutError, GitUnavailableError } from "../../domain/errors";

/**
 * Git process adapter (ADR-0003, architecture §8.1, DR-0019).
 *
 * All Git execution passes through `runGit`. The adapter captures stdout,
 * stderr, and exit code, and never discards useful Git error output.
 * No shell is involved; arguments are passed directly to the `git` binary.
 *
 * Missing executable → `GitUnavailableError`.
 * Exceeded timeout → `GitTimeoutError`.
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
  /** Kill the process after this many milliseconds. Default: 15_000. */
  timeoutMs?: number;
}

export const DEFAULT_GIT_TIMEOUT_MS = 15_000;

export class GitRunner {
  private readonly gitExecutable: string;
  private readonly defaultEnv: Record<string, string | undefined> | undefined;
  private readonly defaultTimeoutMs: number;

  constructor(
    options: {
      executable?: string;
      /** Default environment for all commands (tests inject isolated configs). */
      env?: Record<string, string | undefined>;
      timeoutMs?: number;
    } = {},
  ) {
    this.gitExecutable = options.executable ?? "git";
    this.defaultEnv = options.env;
    this.defaultTimeoutMs = options.timeoutMs ?? DEFAULT_GIT_TIMEOUT_MS;
  }

  async run(request: RunGitRequest): Promise<GitCommandResult> {
    const env = request.env ?? this.defaultEnv ?? process.env;
    const timeoutMs = request.timeoutMs ?? this.defaultTimeoutMs;
    const argv = [this.gitExecutable, ...request.args];

    let proc: Subprocess<"ignore" | "pipe", "pipe", "pipe">;
    try {
      proc = Bun.spawn(argv, {
        cwd: request.cwd,
        stdin: request.stdin === undefined ? "ignore" : "pipe",
        stdout: "pipe",
        stderr: "pipe",
        env,
      });
    } catch (error) {
      throw new GitUnavailableError(error instanceof Error ? error.message : String(error));
    }

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, timeoutMs);

    try {
      if (request.stdin !== undefined && proc.stdin) {
        proc.stdin.write(request.stdin);
        await proc.stdin.end();
      }

      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      if (timedOut) {
        throw new GitTimeoutError(`git ${request.args.join(" ")} exceeded ${timeoutMs}ms`);
      }

      return { stdout, stderr, exitCode };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Runs Git and returns stdout, throwing when the command fails.
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
