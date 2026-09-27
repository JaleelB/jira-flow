import type { RepositoryListView, RepositorySummary } from "../models/repository-summary";
import type { FilesystemPort } from "../ports/filesystem.port";
import type { ControlPlaneRegistryPort, RepositoryCacheEntry } from "../ports/registry.port";
import type { GetRepositoryStatus } from "./get-repository-status";

export class ListRepositories {
  constructor(
    private readonly deps: {
      registry: ControlPlaneRegistryPort;
      filesystem: FilesystemPort;
      getRepositoryStatus: GetRepositoryStatus;
    },
  ) {}

  async execute(input: { refresh?: boolean } = {}): Promise<RepositoryListView> {
    const rows = await this.deps.registry.list();
    const repositories: RepositorySummary[] = [];
    for (const row of rows) {
      const summary =
        input.refresh === false ? await this.cached(row.id) : await this.reconcile(row);
      repositories.push({
        id: row.id,
        path: row.path,
        displayName: row.displayName,
        remoteUrl: row.remoteUrl,
        mode: summary?.mode ?? null,
        activeIssue: summary?.activeIssue ?? null,
        health: summary?.health ?? "unknown",
        branch: summary?.branch ?? null,
        enabled: summary?.enabled ?? null,
        lastSeenAt: row.lastSeenAt ?? null,
        lastOpenedAt: row.lastOpenedAt ?? null,
        lastSyncAt: summary?.lastSyncAt ?? null,
      });
    }
    return { schemaVersion: 1, repositories };
  }

  private async cached(id: string): Promise<RepositoryCacheEntry | null> {
    return this.deps.registry.getCache(id);
  }

  private async reconcile(row: Awaited<ReturnType<ControlPlaneRegistryPort["list"]>>[number]) {
    const now = Date.now();
    if (!(await this.deps.filesystem.exists(row.path))) {
      const old = await this.deps.registry.getCache(row.id);
      const missing: RepositoryCacheEntry = {
        repositoryId: row.id,
        branch: old?.branch ?? null,
        branchIssue: old?.branchIssue ?? null,
        linkedIssue: old?.linkedIssue ?? null,
        activeIssue: old?.activeIssue ?? null,
        activeIssueSource: old?.activeIssueSource ?? null,
        mode: old?.mode ?? null,
        enabled: old?.enabled ?? null,
        health: "missing",
        lastSyncAt: now,
      };
      await this.deps.registry.upsertCache(missing);
      return missing;
    }
    try {
      const status = await this.deps.getRepositoryStatus.execute({ path: row.path });
      const health =
        status.integration.status === "owned" || status.integration.status === "managed-block"
          ? "healthy"
          : status.integration.status === "missing"
            ? "broken"
            : "warning";
      const entry: RepositoryCacheEntry = {
        repositoryId: row.id,
        branch: status.branch,
        branchIssue: status.branchIssue,
        linkedIssue: status.linkedIssue,
        activeIssue: status.activeIssue?.key ?? null,
        activeIssueSource: status.activeIssue?.source ?? null,
        mode: status.mode,
        enabled: status.enabled,
        health,
        lastSyncAt: now,
      };
      await this.deps.registry.upsertCache(entry);
      await this.deps.registry.touchSeen(row.id);
      return entry;
    } catch {
      const entry: RepositoryCacheEntry = {
        repositoryId: row.id,
        branch: null,
        branchIssue: null,
        linkedIssue: null,
        activeIssue: null,
        activeIssueSource: null,
        mode: null,
        enabled: null,
        health: "broken",
        lastSyncAt: now,
      };
      await this.deps.registry.upsertCache(entry);
      return entry;
    }
  }
}
