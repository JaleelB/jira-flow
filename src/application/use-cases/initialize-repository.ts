import {
  HookConflictError,
  HookUnsafeToModifyError,
  LegacyMigrationRequiredError,
} from "../../domain/errors";
import type { LinkingMode } from "../../domain/linking-mode";
import type { GitPort, GitRepositoryContext } from "../ports/git.port";
import type { HookInstallResult, HookManagerPort } from "../ports/hooks.port";
import type { RegistryPort } from "../ports/registry.port";
import type { RepoConfigPort } from "../ports/repo-config.port";
import type { SettingsPort } from "../ports/settings.port";
import type { WorktreeStatePort } from "../ports/worktree-state.port";
import type { InspectLegacyRepository } from "./inspect-legacy-repository";

/**
 * `initializeRepository` — architecture §19 initialization transaction with
 * DR-0016 compensating rollback.
 *
 * Order:
 *
 *   discover repository
 *       ↓
 *   inspect hook (conflict → fail before any mutation)
 *       ↓
 *   write repo config          } JiraFlow-owned mutations, tracked so a
 *   write worktree state       } later failure can roll back exactly what
 *   apply owned hook           } this attempt created
 *   write integration metadata }
 *       ↓
 *   register SQLite entry (LAST; failure → warning, never rollback)
 *       ↓
 *   verify
 *
 * Rollback rules (DR-0016/O-01):
 *  - only JiraFlow changes made by THIS attempt are reverted
 *  - a failed re-init never destroys pre-existing JiraFlow state
 *  - foreign files are never touched
 *
 * Registry rules (DR-0016/O-02, ADR-0006/O-01):
 *  - registration is last and failure does not roll back a functional
 *    repository; the result carries a warning instead
 */

export interface IntegrationMetadataWriter {
  write(
    repo: GitRepositoryContext,
    input: {
      hookPath: string;
      capturedBinaryPath: string | null;
      strategy?: "owned" | "composed";
      backupPath?: string;
      originalSha256?: string;
    },
  ): Promise<unknown>;
  remove(repo: GitRepositoryContext): Promise<void>;
}

export interface InitializeRepositoryDeps {
  git: GitPort;
  config: RepoConfigPort;
  state: WorktreeStatePort;
  hooks: HookManagerPort;
  metadata: IntegrationMetadataWriter;
  /** Null when no registry backend is wired yet; treated as a warning. */
  registry: RegistryPort | null;
  /** Supplies the compiled binary path captured into the hook shim. */
  captureBinaryPath: () => string | null;
  settings?: SettingsPort;
  legacy?: InspectLegacyRepository;
}

export interface InitializeRepositoryInput {
  path: string;
  mode?: LinkingMode;
  composeExistingHook?: boolean;
  allowSharedHooks?: boolean;
}

export interface InitializeRepositoryResult {
  outcome: "initialized" | "already-configured";
  repoPath: string;
  hook: HookInstallResult;
  /** Set when registration failed or was unavailable. */
  registryWarning?: string;
}

export class InitializeRepository {
  private readonly deps: InitializeRepositoryDeps;

  constructor(deps: InitializeRepositoryDeps) {
    this.deps = deps;
  }

  async execute(input: InitializeRepositoryInput): Promise<InitializeRepositoryResult> {
    const repo = await this.deps.git.discoverRepository(input.path);

    const legacy = await this.deps.legacy?.execute({ repo });
    if (legacy?.detected) throw new LegacyMigrationRequiredError();

    // 1. Inspect the hook BEFORE any mutation: a conflict must leave the
    //    repository completely untouched.
    const inspection = await this.deps.hooks.inspect(repo);
    if (
      inspection.status === "conflict" ||
      inspection.status === "unsupported" ||
      inspection.status === "malformed-jiraflow" ||
      inspection.status === "permission-denied"
    ) {
      throw inspection.status === "conflict"
        ? new HookConflictError(inspection.hookPath)
        : new HookUnsafeToModifyError(inspection.hookPath, inspection.reason ?? inspection.status);
    }
    if (inspection.status === "composable-shell" && input.composeExistingHook !== true) {
      throw new HookConflictError(inspection.hookPath);
    }
    if (inspection.status === "shared-external") {
      if (input.composeExistingHook !== true || input.allowSharedHooks !== true) {
        throw new HookUnsafeToModifyError(
          inspection.hookPath,
          inspection.reason ??
            "shared/external hooksPath requires --compose-existing-hook and --allow-shared-hooks",
        );
      }
    }

    const existingConfig = await this.deps.config.read(repo);
    const alreadyConfigured = existingConfig !== null;
    const stateExisted = await this.deps.state.exists(repo);

    // Mutations performed by this attempt (rollback ledger).
    let configWritten = false;
    let stateWritten = false;
    let hookCreated = false;
    let metadataWritten = false;

    let hookComposed = false;
    let hookInstall: HookInstallResult | null = null;

    try {
      if (!alreadyConfigured) {
        const global = await this.deps.settings?.read();
        await this.deps.config.setEnabled(repo, true);
        await this.deps.config.setMode(repo, input.mode ?? global?.defaultMode ?? "hybrid");
        await this.deps.config.setCommitFormat(repo, global?.defaultCommitFormat ?? "footer");
        if (global) {
          await this.deps.config.setIssuePattern(repo, global.defaultIssuePattern);
          await this.deps.config.setPrTitleTemplate(repo, global.defaultPrTitleTemplate);
          await this.deps.config.setDateFormat(repo, global.defaultDateFormat);
        }
        configWritten = true;
      }

      if (!stateExisted) {
        await this.deps.state.setLinkedIssue(repo, null);
        stateWritten = true;
      }

      const hook = await this.deps.hooks.install(repo, {
        binaryPath: this.deps.captureBinaryPath(),
        composeExistingHook: input.composeExistingHook === true,
        allowSharedHooks: input.allowSharedHooks === true,
      });
      hookInstall = hook;
      hookCreated = hook.created;
      hookComposed = hook.strategy === "composed" && hook.backupPath !== undefined;

      await this.deps.metadata.write(repo, {
        hookPath: hook.hookPath,
        capturedBinaryPath: this.deps.captureBinaryPath(),
        strategy: hook.strategy,
        backupPath: hook.backupPath,
        originalSha256: hook.originalSha256,
      });
      metadataWritten = true;

      // Verification: what we wrote must be readable. A failure here is an
      // init failure and triggers rollback.
      if (!alreadyConfigured) {
        const readBack = await this.deps.config.read(repo);
        if (readBack === null) {
          throw new Error("verification failed: jiraflow config is not readable after init");
        }
      }

      // SQLite registration is LAST and must never destroy a functional
      // repository (DR-0016/O-02).
      let registryWarning: string | undefined;
      if (this.deps.registry === null) {
        registryWarning =
          "global dashboard registration unavailable; run `jira-flow doctor` after installing JiraFlow";
      } else {
        try {
          const remoteUrl = await this.deps.git.getRemoteUrl(repo);
          await this.deps.registry.register({
            path: repo.root,
            displayName: repoDisplayName(repo.root),
            remoteUrl,
          });
        } catch {
          registryWarning =
            "global dashboard registration failed; run `jira-flow doctor` to repair the registry";
        }
      }

      return {
        outcome: alreadyConfigured ? "already-configured" : "initialized",
        repoPath: repo.root,
        hook,
        ...(registryWarning !== undefined ? { registryWarning } : {}),
      };
    } catch (error) {
      await this.rollback(repo, {
        configWritten,
        stateWritten,
        hookCreated,
        hookComposed,
        hookInstall,
        metadataWritten,
      });
      throw error;
    }
  }

  /**
   * Reverts only the JiraFlow-owned mutations this attempt performed.
   * Pre-existing state (an earlier init, a linked issue, an owned hook
   * installed before this attempt) is never destroyed.
   */
  private async rollback(
    repo: GitRepositoryContext,
    ledger: {
      configWritten: boolean;
      stateWritten: boolean;
      hookCreated: boolean;
      hookComposed: boolean;
      hookInstall: HookInstallResult | null;
      metadataWritten: boolean;
    },
  ): Promise<void> {
    const failures: string[] = [];

    if (ledger.configWritten) {
      try {
        await this.deps.config.removeAll(repo);
      } catch {
        failures.push("repository config could not be rolled back");
      }
    }

    if (ledger.stateWritten) {
      try {
        await this.deps.state.clear(repo);
      } catch {
        failures.push("worktree state could not be rolled back");
      }
    }

    if (ledger.metadataWritten || ledger.hookComposed) {
      try {
        await this.deps.metadata.remove(repo);
      } catch {
        failures.push("integration metadata could not be rolled back");
      }
    }

    if (ledger.hookCreated) {
      try {
        await this.deps.hooks.removeOwned(repo, {
          binaryPath: this.deps.captureBinaryPath(),
        });
      } catch {
        failures.push("owned hook could not be rolled back");
      }
    } else if (ledger.hookComposed) {
      try {
        if (ledger.hookInstall === null) {
          throw new Error("missing composed hook installation evidence");
        }
        await this.deps.hooks.rollbackInstall(ledger.hookInstall, {
          binaryPath: this.deps.captureBinaryPath(),
        });
      } catch {
        failures.push("composed hook could not be rolled back");
      }
    }

    if (failures.length > 0) {
      // Partial rollback: surface it rather than pretending success.
      throw new Error(`initialization failed and rollback was incomplete: ${failures.join("; ")}`);
    }
  }
}

/** Repository display name: directory base name. */
export function repoDisplayName(repoRoot: string): string {
  const normalized = repoRoot.replaceAll("\\", "/").replace(/\/+$/, "");
  const base = normalized.slice(normalized.lastIndexOf("/") + 1);
  return base.length > 0 ? base : repoRoot;
}
