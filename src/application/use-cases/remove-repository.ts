import { ConfirmationRequiredError, RepositoryNotConfiguredError } from "../../domain/errors";
import type { GitPort } from "../ports/git.port";
import type { HookManagerPort } from "../ports/hooks.port";
import type { RegistryPort } from "../ports/registry.port";
import type { RepoConfigPort } from "../ports/repo-config.port";
import type { WorktreeStatePort } from "../ports/worktree-state.port";

export interface RemoveRepositoryDeps {
  git: GitPort;
  config: RepoConfigPort;
  state: WorktreeStatePort;
  hooks: HookManagerPort;
  metadata: { remove(repo: Parameters<RepoConfigPort["read"]>[0]): Promise<void> };
  registry: RegistryPort | null;
  captureBinaryPath: () => string | null;
}

export class RemoveRepository {
  constructor(private readonly deps: RemoveRepositoryDeps) {}

  async execute(input: {
    path: string;
    yes: boolean;
  }): Promise<{ repoPath: string; hookMode: string }> {
    if (!input.yes) {
      throw new ConfirmationRequiredError("jira-flow remove");
    }
    const repo = await this.deps.git.discoverRepository(input.path);
    const config = await this.deps.config.read(repo);
    if (config === null) {
      throw new RepositoryNotConfiguredError(repo.root);
    }

    const hook = await this.deps.hooks.remove(repo, {
      binaryPath: this.deps.captureBinaryPath(),
    });
    await this.deps.state.clear(repo);
    await this.deps.config.removeAll(repo);
    await this.deps.metadata.remove(repo);
    if (this.deps.registry !== null) {
      try {
        await this.deps.registry.unregister(repo.root);
      } catch {
        // Registry is not repo truth.
      }
    }
    return { repoPath: repo.root, hookMode: hook.mode };
  }
}
