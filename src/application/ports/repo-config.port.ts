import type { CommitFormat } from "../../domain/commit-format";
import type { LinkingMode } from "../../domain/linking-mode";
import type { GitRepositoryContext } from "./git.port";

/**
 * Repository workflow configuration port (architecture §7.2).
 *
 * Repo-wide JiraFlow workflow configuration lives in `git config --local`
 * (ADR-0004/O-01). Global SQLite defaults are M3 (`config --global`).
 */

export interface RepoWorkflowConfig {
  enabled: boolean;
  mode: LinkingMode;
  issuePattern: string | null;
  commitFormat: CommitFormat | null;
  prTitleTemplate: string | null;
  dateFormat: string | null;
}

export interface RepoConfigPort {
  read(repo: GitRepositoryContext): Promise<RepoWorkflowConfig | null>;

  setEnabled(repo: GitRepositoryContext, value: boolean): Promise<void>;

  setMode(repo: GitRepositoryContext, mode: LinkingMode): Promise<void>;

  setCommitFormat(repo: GitRepositoryContext, format: CommitFormat | null): Promise<void>;

  setIssuePattern(repo: GitRepositoryContext, pattern: string | null): Promise<void>;

  setPrTitleTemplate(repo: GitRepositoryContext, value: string | null): Promise<void>;

  setDateFormat(repo: GitRepositoryContext, value: string | null): Promise<void>;

  unset(repo: GitRepositoryContext, key: string): Promise<void>;

  /** Removes every JiraFlow key from the repository's local config. */
  removeAll(repo: GitRepositoryContext): Promise<void>;
}
