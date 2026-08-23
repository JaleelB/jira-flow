import type { RepositoryHealth } from "../ports/registry.port";

export interface RepositorySummary {
  id: string;
  path: string;
  displayName: string;
  remoteUrl: string | null;
  mode: string | null;
  activeIssue: string | null;
  health: RepositoryHealth;
  branch: string | null;
  enabled: boolean | null;
  lastSeenAt: number | null;
  lastOpenedAt: number | null;
  lastSyncAt: number | null;
}

export interface RepositoryListView {
  schemaVersion: 1;
  repositories: RepositorySummary[];
}
