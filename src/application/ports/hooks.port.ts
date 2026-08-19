import type { GitRepositoryContext } from "./git.port";

/**
 * Hook manager port (architecture §7.4, VS-1 subset).
 *
 * VS-1 implements inspection and Strategy A (owned hook install). Repair,
 * removal, and composition strategies B-D arrive with E4.
 */

export type HookStatus = "missing" | "owned" | "conflict";

export interface HookInspection {
  status: HookStatus;
  /** Absolute path of the analyzed `commit-msg` hook. */
  hookPath: string;
  /** Human-readable explanation for conflicts. */
  reason?: string;
}

export interface HookInstallOptions {
  /** Absolute compiled binary path to capture; null uses PATH fallback only. */
  binaryPath: string | null;
}

export interface HookInstallResult {
  strategy: "owned";
  hookPath: string;
  /** True when the hook file was created in this call. */
  created: boolean;
}

export interface HookManagerPort {
  inspect(repo: GitRepositoryContext): Promise<HookInspection>;

  /**
   * Installs the owned `commit-msg` hook when absent, refreshes it when
   * already owned, and throws `HookConflictError` for foreign hooks
   * (ADR-0005/O-01).
   */
  installOwned(repo: GitRepositoryContext, options: HookInstallOptions): Promise<HookInstallResult>;

  /**
   * Removes the `commit-msg` hook only when it exactly matches JiraFlow's
   * current owned structure (verify-before-delete, architecture invariant
   * 17). Returns true when the file was removed. Used by the DR-0016 init
   * rollback path; the user-facing `remove` flow arrives with E4.
   */
  removeOwned(repo: GitRepositoryContext, options: HookInstallOptions): Promise<boolean>;
}
