import { RepositoryNotConfiguredError } from "../../domain/errors";
import type { GitPort } from "../ports/git.port";
import type { RepoConfigPort } from "../ports/repo-config.port";

export class SetEnabled {
  constructor(private readonly deps: { git: GitPort; config: RepoConfigPort }) {}

  async execute(input: { path: string; enabled: boolean }): Promise<{ enabled: boolean }> {
    const repo = await this.deps.git.discoverRepository(input.path);
    const config = await this.deps.config.read(repo);
    if (config === null) {
      throw new RepositoryNotConfiguredError(repo.root);
    }
    await this.deps.config.setEnabled(repo, input.enabled);
    return { enabled: input.enabled };
  }
}
