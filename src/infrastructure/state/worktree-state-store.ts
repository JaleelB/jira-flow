import type { GitRepositoryContext } from "../../application/ports/git.port";
import type { WorktreeState, WorktreeStatePort } from "../../application/ports/worktree-state.port";
import { WorktreeStateInvalidError } from "../../domain/errors";
import { isJiraKey, type JiraKey } from "../../domain/issue-key";
import type { GitRunner } from "../git/git-runner";
import { readJsonFile, removeFileIfExists, writeJsonAtomic } from "./atomic-json-file";

/**
 * Worktree-local linked-issue state (ADR-0004/O-02, architecture §11).
 *
 * The state file path is resolved through Git:
 *
 *   git rev-parse --path-format=absolute --git-path jiraflow/state.json
 *
 * In a linked worktree this resolves inside that worktree's own Git
 * directory, so overrides never leak across worktrees. JiraFlow never
 * manually builds `.git/worktrees/...` paths.
 */

export interface WorktreeStateStoreOptions {
  /** Injectable clock for tests. Default: real system time. */
  now?: () => Date;
}

export class WorktreeStateStore implements WorktreeStatePort {
  private readonly runner: GitRunner;
  private readonly now: () => Date;

  constructor(runner: GitRunner, options: WorktreeStateStoreOptions = {}) {
    this.runner = runner;
    this.now = options.now ?? (() => new Date());
  }

  async read(repo: GitRepositoryContext): Promise<WorktreeState> {
    const path = await this.resolveStatePath(repo);
    let parsed: unknown;
    try {
      parsed = await readJsonFile(path);
    } catch (error) {
      throw new WorktreeStateInvalidError(
        path,
        error instanceof Error ? error.message : String(error),
      );
    }

    if (parsed === null) {
      return defaultState(this.now);
    }

    if (!isWorktreeStateShape(parsed)) {
      throw new WorktreeStateInvalidError(path, "unexpected schema");
    }

    if (parsed.linkedIssue !== null && !isJiraKey(parsed.linkedIssue)) {
      throw new WorktreeStateInvalidError(path, "invalid linked issue key");
    }

    return {
      schemaVersion: 1,
      linkedIssue: parsed.linkedIssue as JiraKey | null,
      updatedAt: parsed.updatedAt,
    };
  }

  async exists(repo: GitRepositoryContext): Promise<boolean> {
    const path = await this.resolveStatePath(repo);
    return await Bun.file(path).exists();
  }

  async setLinkedIssue(repo: GitRepositoryContext, issue: JiraKey | null): Promise<void> {
    const path = await this.resolveStatePath(repo);
    const state: WorktreeState = {
      schemaVersion: 1,
      linkedIssue: issue,
      updatedAt: this.now().toISOString(),
    };
    writeJsonAtomic(path, state);
  }

  async clear(repo: GitRepositoryContext): Promise<void> {
    const path = await this.resolveStatePath(repo);
    removeFileIfExists(path);
  }

  private async resolveStatePath(repo: GitRepositoryContext): Promise<string> {
    const result = await this.runner.run({
      cwd: repo.root,
      args: ["rev-parse", "--path-format=absolute", "--git-path", "jiraflow/state.json"],
    });
    if (result.exitCode !== 0) {
      throw new Error(
        `git rev-parse --git-path jiraflow/state.json failed: ${result.stderr.trim()}`,
      );
    }
    return result.stdout.trim();
  }
}

function defaultState(now: () => Date): WorktreeState {
  return {
    schemaVersion: 1,
    linkedIssue: null,
    updatedAt: now().toISOString(),
  };
}

function isWorktreeStateShape(value: unknown): value is {
  schemaVersion: number;
  linkedIssue: string | null;
  updatedAt: string;
} {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.schemaVersion === 1 &&
    (record.linkedIssue === null || typeof record.linkedIssue === "string") &&
    typeof record.updatedAt === "string"
  );
}
