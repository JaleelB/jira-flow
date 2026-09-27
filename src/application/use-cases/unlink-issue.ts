import { RepositoryNotConfiguredError } from "../../domain/errors";
import type { GitPort } from "../ports/git.port";
import type { RepoConfigPort } from "../ports/repo-config.port";
import type { WorktreeStatePort } from "../ports/worktree-state.port";
import { computeEffectiveConfig } from "../services/effective-config";

export class UnlinkIssue {
  constructor(
    private readonly deps: {
      git: GitPort;
      config: RepoConfigPort;
      state: WorktreeStatePort;
    },
  ) {}

  async execute(input: { path: string }): Promise<{ mode: string; noop: boolean }> {
    const repo = await this.deps.git.discoverRepository(input.path);
    const config = await this.deps.config.read(repo);
    if (config === null) {
      throw new RepositoryNotConfiguredError(repo.root);
    }
    const effective = computeEffectiveConfig(config);
    if (effective.mode === "branch") {
      return { mode: effective.mode, noop: true };
    }
    await this.deps.state.setLinkedIssue(repo, null);
    return { mode: effective.mode, noop: false };
  }
}
