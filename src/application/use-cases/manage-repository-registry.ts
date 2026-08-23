import { RepositoryNotConfiguredError } from "../../domain/errors";
import type { GitPort } from "../ports/git.port";
import type { ControlPlaneRegistryPort } from "../ports/registry.port";
import type { RepoConfigPort } from "../ports/repo-config.port";
import { repoDisplayName } from "./initialize-repository";

export class ManageRepositoryRegistry {
  constructor(
    private readonly deps: {
      registry: ControlPlaneRegistryPort;
      git: GitPort;
      config: RepoConfigPort;
    },
  ) {}

  async remove(input: { id: string }): Promise<boolean> {
    return this.deps.registry.unregisterById(input.id);
  }

  async locate(input: { id: string; path: string }): Promise<void> {
    const repo = await this.deps.git.discoverRepository(input.path);
    if ((await this.deps.config.read(repo)) === null) {
      throw new RepositoryNotConfiguredError(repo.root);
    }
    await this.deps.registry.relocate(
      input.id,
      repo.root,
      repoDisplayName(repo.root),
      await this.deps.git.getRemoteUrl(repo),
    );
  }
}
