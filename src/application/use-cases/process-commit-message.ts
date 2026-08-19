import { resolveActiveIssue } from "../../domain/active-issue";
import { applyIssueReference } from "../../domain/commit-format";
import {
  InvalidIssuePatternError,
  NotAGitRepositoryError,
  WorktreeStateInvalidError,
} from "../../domain/errors";
import { extractIssueKeyFromBranch } from "../../domain/issue-key";
import type { FilesystemPort } from "../ports/filesystem.port";
import type { GitPort, GitRepositoryContext } from "../ports/git.port";
import type { RepoConfigPort } from "../ports/repo-config.port";
import type { WorktreeState, WorktreeStatePort } from "../ports/worktree-state.port";
import { computeEffectiveConfig, type EffectiveWorkflowConfig } from "../services/effective-config";

/**
 * `processCommitMessage` — the commit-message use case behind
 * `jira-flow hook commit-msg <file>` (architecture §14, product §9).
 *
 * Reliability boundary: this path uses repo-local Git config, worktree
 * state, and built-in defaults only. It must never open SQLite or
 * initialize OpenTUI (ADR-0004/O-03).
 *
 * The hook is silent on success and a no-op (exit 0, no mutation) when:
 * the repository is not configured, JiraFlow is disabled, there is no
 * active issue, the message already references the issue, or state is
 * unreadable. Non-mutation outcomes are normal, not errors (product §7).
 */

export interface ProcessCommitMessageDeps {
  git: GitPort;
  config: RepoConfigPort;
  state: WorktreeStatePort;
  filesystem: FilesystemPort;
}

export interface ProcessCommitMessageInput {
  cwd: string;
  commitMessagePath: string;
}

export type CommitProcessingOutcome =
  | "mutated"
  | "not-configured"
  | "disabled"
  | "no-active-issue"
  | "already-present"
  | "empty-message"
  | "unreadable-state"
  | "invalid-pattern"
  | "unsupported-format";

export interface ProcessCommitMessageResult {
  outcome: CommitProcessingOutcome;
}

export class ProcessCommitMessage {
  private readonly deps: ProcessCommitMessageDeps;

  constructor(deps: ProcessCommitMessageDeps) {
    this.deps = deps;
  }

  async execute(input: ProcessCommitMessageInput): Promise<ProcessCommitMessageResult> {
    let repo: GitRepositoryContext;
    try {
      repo = await this.deps.git.discoverRepository(input.cwd);
    } catch (error) {
      if (error instanceof NotAGitRepositoryError) {
        // A stray hook invocation outside a repository is a safe no-op.
        return { outcome: "not-configured" };
      }
      throw error;
    }

    const config = await this.deps.config.read(repo);
    if (config === null) {
      return { outcome: "not-configured" };
    }
    if (!config.enabled) {
      return { outcome: "disabled" };
    }

    let state: WorktreeState;
    try {
      state = await this.deps.state.read(repo);
    } catch (error) {
      if (error instanceof WorktreeStateInvalidError) {
        // Corrupt state must not risk an incorrect mutation; do not touch
        // the commit message and let the commit proceed.
        return { outcome: "unreadable-state" };
      }
      throw error;
    }

    let effective: EffectiveWorkflowConfig;
    try {
      effective = computeEffectiveConfig(config);
    } catch (error) {
      if (error instanceof InvalidIssuePatternError) {
        return { outcome: "invalid-pattern" };
      }
      throw error;
    }

    if (effective.commitFormat !== "footer") {
      // Only the footer format exists in VS-1 (DR-0013). Never guess a
      // different mutation.
      return { outcome: "unsupported-format" };
    }

    const branch = await this.deps.git.getCurrentBranch(repo);
    const branchIssue = extractIssueKeyFromBranch(branch, effective.issuePattern);
    const activeIssue = resolveActiveIssue({
      enabled: effective.enabled,
      mode: effective.mode,
      linkedIssue: state.linkedIssue,
      branchIssue,
    });

    if (activeIssue === null) {
      return { outcome: "no-active-issue" };
    }

    const message = await this.deps.filesystem.readFile(input.commitMessagePath);
    const mutation = applyIssueReference({
      message,
      issue: activeIssue.key,
      format: "footer",
    });

    if (!mutation.changed) {
      return {
        outcome: mutation.reason === "already-present" ? "already-present" : "empty-message",
      };
    }

    // Preserve trailing-newline semantics: the domain mutation carries no
    // trailing newline; the file decides (architecture §38).
    const endedWithNewline = message.endsWith("\n");
    const content = endedWithNewline ? `${mutation.message}\n` : mutation.message;
    await this.deps.filesystem.writeFileAtomic(input.commitMessagePath, content);

    return { outcome: "mutated" };
  }
}
