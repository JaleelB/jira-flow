import type { GitRepositoryContext } from "../../application/ports/git.port";
import type { GitRunner } from "../git/git-runner";
import { writeJsonAtomic } from "../state/atomic-json-file";
import { BLOCK_ID, MANAGED_BLOCK_VERSION } from "./hook-markers";

/**
 * Hook integration metadata (architecture §18).
 *
 * Stored at the Git-resolved `jiraflow/integration.json` path. Metadata is
 * evidence only — it never authorizes deletion by itself.
 */

export type HookStrategy = "owned" | "composed";

export interface HookIntegrationMetadata {
  schemaVersion: 1;
  hook: "commit-msg";
  strategy: HookStrategy;
  hookPath: string;
  blockVersion: number;
  blockId: string;
  capturedBinaryPath: string | null;
  installedAt: string;
  lastVerifiedAt: string;
  originalSha256?: string;
  backupPath?: string;
}

export interface IntegrationMetadataStoreOptions {
  now?: () => Date;
}

export class IntegrationMetadataStore {
  private readonly runner: GitRunner;
  private readonly now: () => Date;

  constructor(runner: GitRunner, options: IntegrationMetadataStoreOptions = {}) {
    this.runner = runner;
    this.now = options.now ?? (() => new Date());
  }

  async write(
    repo: GitRepositoryContext,
    input: {
      hookPath: string;
      capturedBinaryPath: string | null;
      strategy?: HookStrategy;
      originalSha256?: string;
      backupPath?: string;
      installedAt?: Date;
    },
  ): Promise<HookIntegrationMetadata> {
    const path = await this.resolveMetadataPath(repo);
    const existing = await this.read(repo);
    const timestamp = (input.installedAt ?? this.now()).toISOString();
    const strategy = input.strategy ?? "owned";
    const originalSha256 =
      input.originalSha256 ?? (strategy === "composed" ? existing?.originalSha256 : undefined);
    const backupPath =
      input.backupPath ?? (strategy === "composed" ? existing?.backupPath : undefined);
    const metadata: HookIntegrationMetadata = {
      schemaVersion: 1,
      hook: "commit-msg",
      strategy,
      hookPath: input.hookPath,
      blockVersion: MANAGED_BLOCK_VERSION,
      blockId: BLOCK_ID,
      capturedBinaryPath: input.capturedBinaryPath,
      installedAt: timestamp,
      lastVerifiedAt: timestamp,
      ...(originalSha256 !== undefined ? { originalSha256 } : {}),
      ...(backupPath !== undefined ? { backupPath } : {}),
    };

    writeJsonAtomic(path, metadata);
    return metadata;
  }

  async read(repo: GitRepositoryContext): Promise<HookIntegrationMetadata | null> {
    const path = await this.resolveMetadataPath(repo);
    const file = Bun.file(path);
    if (!(await file.exists())) {
      return null;
    }
    return JSON.parse(await file.text()) as HookIntegrationMetadata;
  }

  async remove(repo: GitRepositoryContext): Promise<void> {
    const path = await this.resolveMetadataPath(repo);
    const { rmSync } = await import("node:fs");
    rmSync(path, { force: true });
  }

  async resolveBackupDir(repo: GitRepositoryContext): Promise<string> {
    const result = await this.runner.run({
      cwd: repo.root,
      args: ["rev-parse", "--path-format=absolute", "--git-path", "jiraflow/backups"],
    });
    if (result.exitCode !== 0) {
      throw new Error(`git rev-parse --git-path jiraflow/backups failed: ${result.stderr.trim()}`);
    }
    return result.stdout.trim();
  }

  async resolveMetadataPath(repo: GitRepositoryContext): Promise<string> {
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
