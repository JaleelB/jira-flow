import {
  LinkUnavailableInBranchModeError,
  RepositoryNotConfiguredError,
} from "../../domain/errors";
import { parseJiraKey } from "../../domain/issue-key";
import type { GitPort } from "../ports/git.port";
import type { IssueMetadataPort } from "../ports/issue-metadata.port";
import type { ControlPlaneRegistryPort } from "../ports/registry.port";
import type { RepoConfigPort } from "../ports/repo-config.port";
import type { WorktreeStatePort } from "../ports/worktree-state.port";
import { computeEffectiveConfig } from "../services/effective-config";

export class LinkIssue {
  constructor(
    private readonly deps: {
      git: GitPort;
      config: RepoConfigPort;
      state: WorktreeStatePort;
      registry?: ControlPlaneRegistryPort;
      metadata?: IssueMetadataPort;
    },
  ) {}

  async execute(input: {
    path: string;
    issue: string;
    title?: string;
  }): Promise<{ key: string; mode: string; metadataWarning?: string }> {
    const repo = await this.deps.git.discoverRepository(input.path);
    const config = await this.deps.config.read(repo);
    if (config === null) {
      throw new RepositoryNotConfiguredError(repo.root);
    }
    const effective = computeEffectiveConfig(config);
    if (effective.mode === "branch") {
      throw new LinkUnavailableInBranchModeError();
    }
    const key = parseJiraKey(input.issue, effective.issuePattern);
    await this.deps.state.setLinkedIssue(repo, key);
    let metadataWarning: string | undefined;
    if (input.title?.trim() && this.deps.registry && this.deps.metadata) {
      try {
        const registered = await this.deps.registry.findByPath(repo.root);
        if (registered) await this.deps.metadata.save(registered.id, key, input.title.trim());
      } catch {
        metadataWarning = "story title could not be cached";
      }
    }
    return { key, mode: effective.mode, ...(metadataWarning ? { metadataWarning } : {}) };
  }
}
