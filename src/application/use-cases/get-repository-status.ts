import { resolveActiveIssue } from "../../domain/active-issue";
import { RepositoryNotConfiguredError } from "../../domain/errors";
import { extractIssueKeyFromBranch } from "../../domain/issue-key";
import type { RepositoryStatusView } from "../models/status-view";
import type { GitPort } from "../ports/git.port";
import type { HookManagerPort } from "../ports/hooks.port";
import type { RepoConfigPort } from "../ports/repo-config.port";
import type { WorktreeStatePort } from "../ports/worktree-state.port";
import { computeEffectiveConfig } from "../services/effective-config";
import { repoDisplayName } from "./initialize-repository";

/**
 * `getRepositoryStatus` — assembles the repository status view from the
 * same sources the commit hook trusts: Git, repo-local config, worktree
 * state, and hook inspection (SQLite never participates, ADR-0006).
 *
 * Integration health is marker-based; "a file named commit-msg exists" is
 * never treated as healthy (plan T-16).
 */

export interface GetRepositoryStatusDeps {
  git: GitPort;
  config: RepoConfigPort;
  state: WorktreeStatePort;
  hooks: HookManagerPort;
}

export interface GetRepositoryStatusInput {
  path: string;
}

export class GetRepositoryStatus {
  private readonly deps: GetRepositoryStatusDeps;

  constructor(deps: GetRepositoryStatusDeps) {
    this.deps = deps;
  }

  async execute(input: GetRepositoryStatusInput): Promise<RepositoryStatusView> {
    const repo = await this.deps.git.discoverRepository(input.path);
    const config = await this.deps.config.read(repo);
    if (config === null) {
      throw new RepositoryNotConfiguredError(repo.root);
    }

    const state = await this.deps.state.read(repo);
    const effective = computeEffectiveConfig(config);
    const branch = await this.deps.git.getCurrentBranch(repo);
    const branchIssue = extractIssueKeyFromBranch(branch, effective.issuePattern);
    const activeIssue = resolveActiveIssue({
      enabled: effective.enabled,
      mode: effective.mode,
      linkedIssue: state.linkedIssue,
      branchIssue,
    });

    const inspection = await this.deps.hooks.inspect(repo);

    return {
      repoPath: repo.root,
      repoName: repoDisplayName(repo.root),
      enabled: effective.enabled,
      mode: effective.mode,
      branch,
      branchIssue,
      linkedIssue: state.linkedIssue,
      activeIssue,
      commitFormat: effective.commitFormat,
      issuePattern: effective.issuePattern,
      integration: {
        status: inspection.status,
        ...(inspection.reason !== undefined ? { reason: inspection.reason } : {}),
      },
    };
  }
}
