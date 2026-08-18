import { isAbsolute, resolve } from "node:path";
import type { GitPort, GitRepositoryContext, HooksContext } from "../../application/ports/git.port";
import type { GitRunner } from "./git-runner";
import { discoverRepository, getCurrentBranch } from "./repository-discovery";

/**
 * Git adapter implementing the Git port (architecture §8).
 *
 * All structure questions are answered by the installed `git` executable.
 */

export class GitAdapter implements GitPort {
  private readonly runner: GitRunner;

  constructor(runner: GitRunner) {
    this.runner = runner;
  }

  discoverRepository(path: string): Promise<GitRepositoryContext> {
    return discoverRepository(this.runner, path);
  }

  getCurrentBranch(repo: GitRepositoryContext): Promise<string | null> {
    return getCurrentBranch(this.runner, repo);
  }

  async getRemoteUrl(repo: GitRepositoryContext): Promise<string | null> {
    const result = await this.runner.run({
      cwd: repo.root,
      args: ["config", "--get", "remote.origin.url"],
    });
    if (result.exitCode !== 0) {
      return null;
    }
    const url = result.stdout.trim();
    return url.length > 0 ? url : null;
  }

  async resolveHooks(repo: GitRepositoryContext): Promise<HooksContext> {
    // 1. Read core.hooksPath with Git, recording where it came from
    //    (lookup order local > global > system mirrors Git's own precedence).
    for (const origin of ["local", "global", "system"] as const) {
      const result = await this.runner.run({
        cwd: repo.root,
        args: ["config", `--${origin}`, "--get", "core.hooksPath"],
      });
      if (result.exitCode === 0) {
        const value = result.stdout.trim();
        if (value.length === 0) {
          continue;
        }
        // 3./4. absolute → use as-is; relative → resolve against the
        // worktree root, which is Git's hook execution context for
        // supported non-bare repositories.
        const hooksDir = isAbsolute(value) ? value : resolve(repo.root, value);
        return this.hooksContext(hooksDir, origin);
      }
    }

    // 2. core.hooksPath absent: let Git resolve the default hooks directory.
    const gitPath = await this.runner.run({
      cwd: repo.root,
      args: ["rev-parse", "--path-format=absolute", "--git-path", "hooks"],
    });
    if (gitPath.exitCode !== 0) {
      throw new Error(`git rev-parse --git-path hooks failed: ${gitPath.stderr.trim()}`);
    }
    return this.hooksContext(gitPath.stdout.trim(), "unknown");
  }

  private hooksContext(hooksDir: string, origin: HooksContext["hooksPathOrigin"]): HooksContext {
    const canonical = resolve(hooksDir);
    return {
      hooksDir: canonical,
      hooksPathOrigin: origin,
      commitMsgPath: resolve(canonical, "commit-msg"),
    };
  }
}
