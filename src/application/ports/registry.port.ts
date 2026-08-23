/**
 * Registry port (architecture §7.5, VS-1 subset).
 *
 * The SQLite registry is a dashboard registry only — never repository
 * truth. VS-1 needs registration after init; listing/removal arrive with
 * E8.
 */

export interface RegisteredRepository {
  id: string;
  path: string;
  displayName: string;
  remoteUrl: string | null;
  /** Unix epoch milliseconds (SQLite schema stores INTEGER). */
  createdAt: number;
  updatedAt: number;
  lastSeenAt?: number | null;
  lastOpenedAt?: number | null;
}

export type RepositoryHealth = "healthy" | "warning" | "broken" | "missing" | "unknown";

export interface RepositoryCacheEntry {
  repositoryId: string;
  branch: string | null;
  branchIssue: string | null;
  linkedIssue: string | null;
  activeIssue: string | null;
  activeIssueSource: string | null;
  mode: string | null;
  enabled: boolean | null;
  health: RepositoryHealth;
  lastSyncAt: number;
}

export interface RegisterRepositoryInput {
  path: string;
  displayName: string;
  remoteUrl: string | null;
}

export interface RegistryPort {
  register(input: RegisterRepositoryInput): Promise<RegisteredRepository>;
  findByPath(path: string): Promise<RegisteredRepository | null>;
  unregister(path: string): Promise<boolean>;
}

export interface ControlPlaneRegistryPort extends RegistryPort {
  unregisterById(id: string): Promise<boolean>;
  findById(id: string): Promise<RegisteredRepository | null>;
  list(): Promise<RegisteredRepository[]>;
  relocate(id: string, path: string, displayName: string, remoteUrl: string | null): Promise<void>;
  touchSeen(id: string): Promise<void>;
  touchOpened(id: string): Promise<void>;
  upsertCache(entry: RepositoryCacheEntry): Promise<void>;
  getCache(repositoryId: string): Promise<RepositoryCacheEntry | null>;
}
