import type { GitRepositoryContext } from "../../application/ports/git.port";
import {
  BareRepositoryUnsupportedError,
  GitUnavailableError,
  NotAGitRepositoryError,
} from "../../domain/errors";
import type { GitRunner } from "./git-runner";

/**
 * Repository discovery through the Git CLI (architecture §8.2).
 *
 * Never reconstructs `.git` paths by string concatenation; every path comes
 * from `git rev-parse --path-format=absolute`.
 */

export async function discoverRepository(
  runner: GitRunner,
  path: string,
): Promise<GitRepositoryContext> {
  const insideWorkTree = await runner.run({
    cwd: path,
    args: ["rev-parse", "--is-inside-work-tree"],
  });
  if (insideWorkTree.exitCode !== 0 || insideWorkTree.stdout.trim() !== "true") {
    // Distinguish "not a repo" from "bare repo" for a precise typed error.
    const bare = await runner.run({
      cwd: path,
      args: ["rev-parse", "--is-bare-repository"],
    });
    if (bare.exitCode === 0 && bare.stdout.trim() === "true") {
      throw new BareRepositoryUnsupportedError(path);
    }
    throw new NotAGitRepositoryError(path);
  }

  const [toplevel, gitDir, commonGitDir] = await Promise.all([
    runner.run({
      cwd: path,
      args: ["rev-parse", "--path-format=absolute", "--show-toplevel"],
    }),
    runner.run({
      cwd: path,
      args: ["rev-parse", "--path-format=absolute", "--git-dir"],
    }),
    runner.run({
      cwd: path,
      args: ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    }),
  ]);

  if (toplevel.exitCode !== 0 || gitDir.exitCode !== 0 || commonGitDir.exitCode !== 0) {
    throw new GitUnavailableError("git rev-parse failed during repository discovery");
  }

  const root = toplevel.stdout.trim();
  const resolvedGitDir = gitDir.stdout.trim();
  const resolvedCommonGitDir = commonGitDir.stdout.trim();

  return {
    root,
    gitDir: resolvedGitDir,
    commonGitDir: resolvedCommonGitDir,
    isLinkedWorktree: resolvedGitDir !== resolvedCommonGitDir,
  };
}

/**
 * Current branch short name via `git symbolic-ref --quiet --short HEAD`
 * (architecture §8.3). Detached HEAD returns null; it is a valid
 * no-active-branch state, not an error.
 */
export async function getCurrentBranch(
  runner: GitRunner,
  repo: GitRepositoryContext,
): Promise<string | null> {
  const result = await runner.run({
    cwd: repo.root,
    args: ["symbolic-ref", "--quiet", "--short", "HEAD"],
  });
  if (result.exitCode === 0) {
    return result.stdout.trim();
  }
  return null;
}
