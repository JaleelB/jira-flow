import type { GitPort, GitRepositoryContext } from "../../application/ports/git.port";
import type { GitRunner } from "../git/git-runner";
import { BLOCK_ID, MANAGED_BLOCK_VERSION } from "./hook-markers";

/**
 * Hook integration metadata (architecture §18).
 *
 * Stored at the Git-resolved `jiraflow/integration.json` path inside the
 * Git directory. Metadata is evidence only — it never authorizes deletion
 * by itself; removal always verifies the actual hook file.
 */

export interface HookIntegrationMetadata {
  schemaVersion: 1;
  hook: "commit-msg";
  strategy: "owned";
  hookPath: string;
  blockVersion: number;
  blockId: string;
  capturedBinaryPath: string | null;
  installedAt: string;
  lastVerifiedAt: string;
}

export interface IntegrationMetadataStoreOptions {
  now?: () => Date;
}

export class IntegrationMetadataStore {
  private readonly git: GitPort;
  private readonly runner: GitRunner;
  private readonly now: () => Date;

  constructor(git: GitPort, runner: GitRunner, options: IntegrationMetadataStoreOptions = {}) {
    this.git = git;
    this.runner = runner;
    this.now = options.now ?? (() => new Date());
  }

  async write(
    repo: GitRepositoryContext,
    input: { hookPath: string; capturedBinaryPath: string | null; installedAt?: Date },
  ): Promise<HookIntegrationMetadata> {
    const path = await this.resolveMetadataPath(repo);
    const timestamp = (input.installedAt ?? this.now()).toISOString();
    const metadata: HookIntegrationMetadata = {
      schemaVersion: 1,
      hook: "commit-msg",
      strategy: "owned",
      hookPath: input.hookPath,
      blockVersion: MANAGED_BLOCK_VERSION,
      blockId: BLOCK_ID,
      capturedBinaryPath: input.capturedBinaryPath,
      installedAt: timestamp,
      lastVerifiedAt: timestamp,
    };

    await Bun.write(path, `${JSON.stringify(metadata, null, 2)}\n`);
    return metadata;
  }

  async read(repo: GitRepositoryContext): Promise<HookIntegrationMetadata | null> {
    const path = await this.resolveMetadataPath(repo);
    const file = Bun.file(path);
    if (!(await file.exists())) {
      return null;
    }
    const parsed = JSON.parse(await file.text()) as HookIntegrationMetadata;
    return parsed;
  }

  async remove(repo: GitRepositoryContext): Promise<void> {
    const path = await this.resolveMetadataPath(repo);
    const { rmSync } = await import("node:fs");
    rmSync(path, { force: true });
  }

  private async resolveMetadataPath(repo: GitRepositoryContext): Promise<string> {
    const result = await this.runner.run({
      cwd: repo.root,
      args: ["rev-parse", "--path-format=absolute", "--git-path", "jiraflow/integration.json"],
    });
    if (result.exitCode !== 0) {
      throw new Error(
        `git rev-parse --git-path jiraflow/integration.json failed: ${result.stderr.trim()}`,
      );
    }
    return result.stdout.trim();
  }
}
