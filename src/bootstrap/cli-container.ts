import type { RegistryPort } from "../application/ports/registry.port";
import { GetRepositoryStatus } from "../application/use-cases/get-repository-status";
import { InitializeRepository } from "../application/use-cases/initialize-repository";
import { ProcessCommitMessage } from "../application/use-cases/process-commit-message";
import { RunDoctor } from "../application/use-cases/run-doctor";
import { SystemFilesystem } from "../infrastructure/filesystem/system-filesystem";
import { GitAdapter } from "../infrastructure/git/git-adapter";
import { GitConfigStore } from "../infrastructure/git/git-config-store";
import { GitRunner } from "../infrastructure/git/git-runner";
import { HookManager } from "../infrastructure/hooks/hook-manager";
import { IntegrationMetadataStore } from "../infrastructure/hooks/integration-metadata";
import { getAppDataDir, getDatabasePath } from "../infrastructure/platform/app-paths";
import { resolveCurrentExecutable } from "../infrastructure/platform/executable-path";
import { SqliteRepositoryRegistry } from "../infrastructure/sqlite/repository-registry";
import { WorktreeStateStore } from "../infrastructure/state/worktree-state-store";

/**
 * CLI composition root (architecture §33).
 *
 * Wires the headless command surface. The SQLite registry is created
 * lazily at registration time only, so status/doctor/--version never create
 * the application database (ADR-0006, architecture §21). The commit hook
 * keeps its own lighter composition root.
 */

/** Defers database creation until registration actually runs. */
class LazyRegistry implements RegistryPort {
  private inner: RegistryPort | null = null;

  constructor(private readonly factory: () => RegistryPort) {}

  async register(input: { path: string; displayName: string; remoteUrl: string | null }) {
    this.inner ??= this.factory();
    return this.inner.register(input);
  }
}

export function createCliContainer(options: { registry?: RegistryPort | null } = {}): {
  initializeRepository: InitializeRepository;
  getRepositoryStatus: GetRepositoryStatus;
  runDoctor: RunDoctor;
  processCommitMessage: ProcessCommitMessage;
} {
  const runner = new GitRunner();
  const git = new GitAdapter(runner);
  const config = new GitConfigStore(runner);
  const state = new WorktreeStateStore(runner);
  const hooks = new HookManager(git);
  const metadata = new IntegrationMetadataStore(runner);
  const filesystem = new SystemFilesystem();

  const captureBinaryPath = (): string | null => resolveCurrentExecutable().binaryPath;

  const registry =
    options.registry === undefined
      ? new LazyRegistry(
          () => new SqliteRepositoryRegistry({ databasePath: getDatabasePath(getAppDataDir()) }),
        )
      : options.registry;

  const initializeRepository = new InitializeRepository({
    git,
    config,
    state,
    hooks,
    metadata,
    registry,
    captureBinaryPath,
  });

  const getRepositoryStatus = new GetRepositoryStatus({ git, config, state, hooks });
  const runDoctor = new RunDoctor({ git, config, state, hooks });
  const processCommitMessage = new ProcessCommitMessage({ git, config, state, filesystem });

  return { initializeRepository, getRepositoryStatus, runDoctor, processCommitMessage };
}
