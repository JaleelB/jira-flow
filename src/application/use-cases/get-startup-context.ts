import { NotAGitRepositoryError, RepositoryNotConfiguredError } from "../../domain/errors";
import type { RepositoryStatusView } from "../models/status-view";
import type { GitPort } from "../ports/git.port";
import type { ControlPlaneRegistryPort } from "../ports/registry.port";

/**
 * `getStartupContext` — decides what the root `jira-flow` command shows
 * (product §6.1, VS-1 reduced).
 *
 *   configured repository     → repository overview
 *   unconfigured repository   → short next-step stub (S2 arrives with E10)
 *   outside a repository      → empty-state stub (S1/S3 arrive with E10)
 */

export type StartupContext =
  | { kind: "repository-overview"; status: RepositoryStatusView }
  | { kind: "unconfigured-repo"; repoPath: string }
  | { kind: "global-dashboard" }
  | { kind: "empty-state" };

export interface GetStartupContextDeps {
  git: GitPort;
  getRepositoryStatus: {
    execute(input: { path: string }): Promise<RepositoryStatusView>;
  };
  registry?: ControlPlaneRegistryPort;
}

export class GetStartupContext {
  private readonly deps: GetStartupContextDeps;

  constructor(deps: GetStartupContextDeps) {
    this.deps = deps;
  }

  async execute(input: { path: string }): Promise<StartupContext> {
    let repoPath: string;
    try {
      const repo = await this.deps.git.discoverRepository(input.path);
      repoPath = repo.root;
    } catch (error) {
      if (error instanceof NotAGitRepositoryError) {
        const known = (await this.deps.registry?.list()) ?? [];
        return known.length > 0 ? { kind: "global-dashboard" } : { kind: "empty-state" };
      }
      throw error;
    }

    try {
      const status = await this.deps.getRepositoryStatus.execute({ path: input.path });
      const registered = await this.deps.registry?.findByPath(status.repoPath);
      const registry = this.deps.registry;
      if (registered === null && registry) {
        await registry.register({
          path: status.repoPath,
          displayName: status.repoName,
          remoteUrl: null,
        });
      } else if (registered) {
        await registry?.touchOpened(registered.id);
      }
      return { kind: "repository-overview", status };
    } catch (error) {
      if (error instanceof RepositoryNotConfiguredError) {
        return { kind: "unconfigured-repo", repoPath };
      }
      throw error;
    }
  }
}
