import type { ActiveIssue } from "../../domain/active-issue";
import type { CommitFormat } from "../../domain/commit-format";
import type { JiraKey } from "../../domain/issue-key";
import type { LinkingMode } from "../../domain/linking-mode";
import type { HookStatus } from "../ports/hooks.port";

/**
 * View model for `jira-flow status` and the TUI repository overview
 * (product §6.4 / S4-reduced). The CLI and TUI format this; neither
 * recomputes it.
 */

export interface IntegrationStatus {
  status: HookStatus;
  reason?: string;
}

export interface RepositoryStatusView {
  /** Absolute repository root. */
  repoPath: string;
  /** Display name (directory base name). */
  repoName: string;
  enabled: boolean;
  mode: LinkingMode;
  branch: string | null;
  branchIssue: JiraKey | null;
  linkedIssue: JiraKey | null;
  activeIssue: ActiveIssue | null;
  commitFormat: CommitFormat;
  issuePattern: string;
  integration: IntegrationStatus;
}
