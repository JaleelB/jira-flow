/**
 * Git port (architecture §7.1).
 *
 * Git is the authority for repository structure. The port surfaces discovery,
 * branch detection, remote metadata, and effective hook-path resolution.
 */

export interface GitRepositoryContext {
  /** Absolute work-tree root. */
  root: string;
  /** Absolute Git directory for this worktree (`.git` or `.git/worktrees/*`). */
  gitDir: string;
  /** Absolute common Git directory (shared across linked worktrees). */
  commonGitDir: string;
  /** True when this worktree is a linked worktree. */
  isLinkedWorktree: boolean;
}

/** Where the effective `core.hooksPath` came from, when it is configured. */
export type HooksPathOrigin = "local" | "global" | "system" | "command" | "unknown";

export interface HooksContext {
  /** Absolute, canonicalized effective hooks directory. */
  hooksDir: string;
  /** Origin of `core.hooksPath` when configured; "unknown" for the default. */
  hooksPathOrigin: HooksPathOrigin;
  /** Absolute path of the `commit-msg` hook inside the hooks directory. */
  commitMsgPath: string;
}

export interface GitPort {
  /**
   * Discovers the repository context for `path`.
   *
   * Throws `NotAGitRepositoryError` outside a work tree and
   * `BareRepositoryUnsupportedError` for bare repositories.
   */
  discoverRepository(path: string): Promise<GitRepositoryContext>;

  /** Current branch short name; null for detached HEAD (not an error). */
  getCurrentBranch(repo: GitRepositoryContext): Promise<string | null>;

  /** Remote URL for `origin` when present. */
  getRemoteUrl(repo: GitRepositoryContext): Promise<string | null>;

  /** Resolves the effective hooks directory through Git (ADR-0003). */
  resolveHooks(repo: GitRepositoryContext): Promise<HooksContext>;
}
