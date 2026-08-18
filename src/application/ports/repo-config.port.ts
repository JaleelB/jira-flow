import type { CommitFormat } from "../../domain/commit-format";
import type { LinkingMode } from "../../domain/linking-mode";
import type { GitRepositoryContext } from "./git.port";

/**
 * Repository workflow configuration port (architecture §7.2, VS-1 subset).
 *
 * Repo-wide JiraFlow workflow configuration lives in `git config --local`
 * (ADR-0004/O-01). VS-1 implements the keys the slice needs; pattern,
 * PR-title template, and date-format setters arrive with E3.
 */

export interface RepoWorkflowConfig {
  enabled: boolean;
  mode: LinkingMode;
  /** Repo-level pattern override; null means "use the default". */
  issuePattern: string | null;
  /** Repo-level format override; null means "use the default". */
  commitFormat: CommitFormat | null;
}

export interface RepoConfigPort {
  /**
   * Reads the repository's JiraFlow config.
   *
   * Returns null when no `jiraflow.*` keys exist at all (not configured).
   * Throws `ConfigInvalidError` when a present value is invalid.
   */
  read(repo: GitRepositoryContext): Promise<RepoWorkflowConfig | null>;

  setEnabled(repo: GitRepositoryContext, value: boolean): Promise<void>;

  setMode(repo: GitRepositoryContext, mode: LinkingMode): Promise<void>;

  setCommitFormat(repo: GitRepositoryContext, format: CommitFormat): Promise<void>;

  /** Removes every JiraFlow key from the repository's local config. */
  removeAll(repo: GitRepositoryContext): Promise<void>;
}
