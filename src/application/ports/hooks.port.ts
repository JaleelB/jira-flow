import type { GitRepositoryContext } from "./git.port";

/**
 * Hook manager port (architecture §7.4).
 */

export type HookStatus =
  | "missing"
  | "owned"
  | "managed-block"
  | "composable-shell"
  | "unsupported"
  | "malformed-jiraflow"
  | "shared-external"
  | "permission-denied"
  | "conflict";

export type HooksPathClass = "repo-default" | "repo-local-custom" | "shared-external";

export interface HookInspection {
  status: HookStatus;
  hookPath: string;
  reason?: string;
  interpreter?: string;
  hooksPathClass?: HooksPathClass;
  contentClass?: Exclude<HookStatus, "shared-external" | "permission-denied" | "conflict">;
}

export interface HookInstallOptions {
  binaryPath: string | null;
  composeExistingHook?: boolean;
  allowSharedHooks?: boolean;
}

export interface HookInstallResult {
  strategy: "owned" | "composed";
  hookPath: string;
  created: boolean;
  backupPath?: string;
  originalSha256?: string;
}

export interface HookRemoveResult {
  removed: boolean;
  mode: "owned-file" | "stripped-block" | "skipped-shared" | "none";
  hookPath: string;
}

export interface HookManagerPort {
  inspect(repo: GitRepositoryContext): Promise<HookInspection>;

  install(repo: GitRepositoryContext, options: HookInstallOptions): Promise<HookInstallResult>;

  /**
   * Strategy A only. Refuses anything that is not missing or already owned.
   * Kept for VS-1 callers and compensating rollback of owned files.
   */
  installOwned(repo: GitRepositoryContext, options: HookInstallOptions): Promise<HookInstallResult>;

  remove(repo: GitRepositoryContext, options: HookInstallOptions): Promise<HookRemoveResult>;

  removeOwned(repo: GitRepositoryContext, options: HookInstallOptions): Promise<boolean>;

  /** Restore the exact pre-install hook when an initialization transaction fails. */
  rollbackInstall(result: HookInstallResult, options: HookInstallOptions): Promise<void>;
}
