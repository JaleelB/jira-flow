import type { GitPort } from "../ports/git.port";
import type { HookManagerPort } from "../ports/hooks.port";
import type { RegistryPort } from "../ports/registry.port";
import type { RepoConfigPort } from "../ports/repo-config.port";
import type { WorktreeStatePort } from "../ports/worktree-state.port";
import { type IntegrationMetadataWriter, repoDisplayName } from "./initialize-repository";

/**
 * Repair only JiraFlow-owned state (E6-4). Foreign/shared hooks are never
 * overwritten.
 */

export class RepairRepository {
  constructor(
    private readonly deps: {
      git: GitPort;
      config: RepoConfigPort;
      state: WorktreeStatePort;
      hooks: HookManagerPort;
      metadata: IntegrationMetadataWriter;
      registry: RegistryPort | null;
      captureBinaryPath: () => string | null;
    },
  ) {}

  async execute(input: { path: string }): Promise<{ repaired: string[]; refused: string[] }> {
    const repaired: string[] = [];
    const refused: string[] = [];
    const repo = await this.deps.git.discoverRepository(input.path);
    const inspection = await this.deps.hooks.inspect(repo);

    if (inspection.status === "missing" || inspection.status === "owned") {
      const hook = await this.deps.hooks.installOwned(repo, {
        binaryPath: this.deps.captureBinaryPath(),
      });
      await this.deps.metadata.write(repo, {
        hookPath: hook.hookPath,
        capturedBinaryPath: this.deps.captureBinaryPath(),
        strategy: hook.strategy,
        backupPath: hook.backupPath,
      });
      repaired.push("hooks.integration");
    } else if (inspection.status === "managed-block") {
      const hook = await this.deps.hooks.install(repo, {
        binaryPath: this.deps.captureBinaryPath(),
      });
      await this.deps.metadata.write(repo, {
        hookPath: hook.hookPath,
        capturedBinaryPath: this.deps.captureBinaryPath(),
        strategy: hook.strategy,
        backupPath: hook.backupPath,
      });
      repaired.push("hooks.integration");
    } else {
      refused.push(`hooks.integration (${inspection.status})`);
    }

    const stateExists = await this.deps.state.exists(repo);
    if (!stateExists) {
      await this.deps.state.setLinkedIssue(repo, null);
      repaired.push("worktree.state");
    }

    if (this.deps.registry !== null) {
      try {
        const remoteUrl = await this.deps.git.getRemoteUrl(repo);
        await this.deps.registry.register({
          path: repo.root,
          displayName: repoDisplayName(repo.root),
          remoteUrl,
        });
        repaired.push("registry.sync");
      } catch {
        refused.push("registry.sync");
      }
    }

    return { repaired, refused };
  }
}
