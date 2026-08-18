import type { JiraKey } from "../../domain/issue-key";
import type { GitRepositoryContext } from "./git.port";

/**
 * Worktree state port (architecture §7.3).
 *
 * `linkedIssue` is worktree-local state stored in a Git-resolved JSON file
 * (ADR-0004/O-02). It must never live in shared `.git/config`, SQLite, or
 * any repo-wide location.
 */

export interface WorktreeState {
  schemaVersion: 1;
  /** Explicit linked issue override; null when no override exists. */
  linkedIssue: JiraKey | null;
  /** ISO-8601 timestamp of the last write. */
  updatedAt: string;
}

export interface WorktreeStatePort {
  /**
   * Reads worktree-local state.
   *
   * Returns the default state (no linked issue) when the file does not
   * exist yet. Throws `WorktreeStateInvalidError` when the file exists but
   * cannot be parsed — a recoverable error, never a crash.
   */
  read(repo: GitRepositoryContext): Promise<WorktreeState>;

  /** True when a state file exists for this worktree. */
  exists(repo: GitRepositoryContext): Promise<boolean>;

  /** Sets (or clears with null) the linked issue for this worktree. */
  setLinkedIssue(repo: GitRepositoryContext, issue: JiraKey | null): Promise<void>;

  /** Resets worktree state to defaults. */
  clear(repo: GitRepositoryContext): Promise<void>;
}
