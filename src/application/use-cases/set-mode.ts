import { ConfigInvalidError, RepositoryNotConfiguredError } from "../../domain/errors";
import { isLinkingMode, type LinkingMode } from "../../domain/linking-mode";
import type { GitPort } from "../ports/git.port";
import type { RepoConfigPort } from "../ports/repo-config.port";
import { computeEffectiveConfig } from "../services/effective-config";

export class SetMode {
  constructor(private readonly deps: { git: GitPort; config: RepoConfigPort }) {}

  async execute(input: { path: string; mode?: string }): Promise<{ mode: LinkingMode }> {
    const repo = await this.deps.git.discoverRepository(input.path);
    const config = await this.deps.config.read(repo);
    if (config === null) {
      throw new RepositoryNotConfiguredError(repo.root);
    }
    if (input.mode === undefined) {
      return { mode: computeEffectiveConfig(config).mode };
    }
    if (!isLinkingMode(input.mode)) {
      throw new ConfigInvalidError("jiraflow.mode", input.mode);
    }
    await this.deps.config.setMode(repo, input.mode);
    return { mode: input.mode };
  }
}
