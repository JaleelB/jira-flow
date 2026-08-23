import type { ControlPlaneRegistryPort } from "../application/ports/registry.port";
import type { SettingsPort } from "../application/ports/settings.port";
import { GeneratePrTitle } from "../application/use-cases/generate-pr-title";
import { GetRepositoryStatus } from "../application/use-cases/get-repository-status";
import { InitializeRepository } from "../application/use-cases/initialize-repository";
import { LinkIssue } from "../application/use-cases/link-issue";
import { ListRepositories } from "../application/use-cases/list-repositories";
import { ManageConfig } from "../application/use-cases/manage-config";
import { ManageRepositoryRegistry } from "../application/use-cases/manage-repository-registry";
import { ProcessCommitMessage } from "../application/use-cases/process-commit-message";
import { RemoveRepository } from "../application/use-cases/remove-repository";
import { RepairRepository } from "../application/use-cases/repair-repository";
import { RunDoctor } from "../application/use-cases/run-doctor";
import { SetEnabled } from "../application/use-cases/set-enabled";
import { SetMode } from "../application/use-cases/set-mode";
import { UnlinkIssue } from "../application/use-cases/unlink-issue";
import { SystemFilesystem } from "../infrastructure/filesystem/system-filesystem";
import { GitAdapter } from "../infrastructure/git/git-adapter";
import { GitConfigStore } from "../infrastructure/git/git-config-store";
import { GitRunner } from "../infrastructure/git/git-runner";
import { HookManager } from "../infrastructure/hooks/hook-manager";
import { IntegrationMetadataStore } from "../infrastructure/hooks/integration-metadata";
import { getAppDataDir, getDatabasePath } from "../infrastructure/platform/app-paths";
import { SystemClipboard } from "../infrastructure/platform/clipboard";
import { resolveCurrentExecutable } from "../infrastructure/platform/executable-path";
import { TerminalStoryTitlePrompt } from "../infrastructure/platform/terminal-story-title-prompt";
import { SqliteIssueMetadataRepository } from "../infrastructure/sqlite/issue-metadata-repository";
import { SqliteRepositoryRegistry } from "../infrastructure/sqlite/repository-registry";
import { SqliteSettingsRepository } from "../infrastructure/sqlite/settings-repository";
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
class LazyRegistry implements ControlPlaneRegistryPort {
  private inner: ControlPlaneRegistryPort | null = null;

  constructor(private readonly factory: () => ControlPlaneRegistryPort) {}

  async register(input: { path: string; displayName: string; remoteUrl: string | null }) {
    this.inner ??= this.factory();
    return this.inner.register(input);
  }

  async findByPath(path: string) {
    this.inner ??= this.factory();
    return this.inner.findByPath(path);
  }

  async unregister(path: string) {
    this.inner ??= this.factory();
    return this.inner.unregister(path);
  }
  async unregisterById(id: string) {
    this.inner ??= this.factory();
    return this.inner.unregisterById(id);
  }
  async findById(id: string) {
    this.inner ??= this.factory();
    return this.inner.findById(id);
  }
  async list() {
    this.inner ??= this.factory();
    return this.inner.list();
  }
  async relocate(id: string, path: string, displayName: string, remoteUrl: string | null) {
    this.inner ??= this.factory();
    return this.inner.relocate(id, path, displayName, remoteUrl);
  }
  async touchSeen(id: string) {
    this.inner ??= this.factory();
    return this.inner.touchSeen(id);
  }
  async touchOpened(id: string) {
    this.inner ??= this.factory();
    return this.inner.touchOpened(id);
  }
  async upsertCache(entry: Parameters<ControlPlaneRegistryPort["upsertCache"]>[0]) {
    this.inner ??= this.factory();
    return this.inner.upsertCache(entry);
  }
  async getCache(repositoryId: string) {
    this.inner ??= this.factory();
    return this.inner.getCache(repositoryId);
  }
}

class LazySettings implements SettingsPort {
  private inner: SettingsPort | null = null;
  constructor(private readonly factory: () => SettingsPort) {}
  private get value(): SettingsPort {
    if (this.inner === null) this.inner = this.factory();
    return this.inner;
  }
  read() {
    return this.value.read();
  }
  get<K extends keyof import("../application/ports/settings.port").GlobalSettings>(key: K) {
    return this.value.get(key);
  }
  set<K extends keyof import("../application/ports/settings.port").GlobalSettings>(
    key: K,
    value: import("../application/ports/settings.port").GlobalSettings[K],
  ) {
    return this.value.set(key, value);
  }
  unset(key: keyof import("../application/ports/settings.port").GlobalSettings) {
    return this.value.unset(key);
  }
}

export interface CliContainer {
  initializeRepository: InitializeRepository;
  getRepositoryStatus: GetRepositoryStatus;
  runDoctor: RunDoctor;
  repairRepository: RepairRepository;
  processCommitMessage: ProcessCommitMessage;
  linkIssue: LinkIssue;
  unlinkIssue: UnlinkIssue;
  setMode: SetMode;
  setEnabled: SetEnabled;
  removeRepository: RemoveRepository;
  manageConfig: ManageConfig;
  listRepositories: ListRepositories;
  manageRepositoryRegistry: ManageRepositoryRegistry;
  settings: SettingsPort;
  issueMetadata: SqliteIssueMetadataRepository;
  generatePrTitle: GeneratePrTitle;
}

export function createCliContainer(
  options: { registry?: ControlPlaneRegistryPort } = {},
): CliContainer {
  const runner = new GitRunner();
  const git = new GitAdapter(runner);
  const config = new GitConfigStore(runner);
  const state = new WorktreeStateStore(runner);
  const hooks = new HookManager(git, runner);
  const metadata = new IntegrationMetadataStore(runner);
  const filesystem = new SystemFilesystem();

  const captureBinaryPath = (): string | null => resolveCurrentExecutable().binaryPath;

  const registry =
    options.registry === undefined
      ? new LazyRegistry(
          () => new SqliteRepositoryRegistry({ databasePath: getDatabasePath(getAppDataDir()) }),
        )
      : options.registry;
  const databasePath = getDatabasePath(getAppDataDir());
  const settings = new LazySettings(() => new SqliteSettingsRepository(databasePath));
  const issueMetadata = new SqliteIssueMetadataRepository(databasePath);

  const initializeRepository = new InitializeRepository({
    git,
    config,
    state,
    hooks,
    metadata,
    registry,
    captureBinaryPath,
    settings,
  });

  const getRepositoryStatus = new GetRepositoryStatus({ git, config, state, hooks });
  const listRepositories = new ListRepositories({ registry, filesystem, getRepositoryStatus });
  const runDoctor = new RunDoctor({
    git,
    config,
    state,
    hooks,
    registry,
    captureBinaryPath,
    settings,
    listRepositories,
  });
  const repairRepository = new RepairRepository({
    git,
    config,
    state,
    hooks,
    metadata,
    registry,
    captureBinaryPath,
  });
  const processCommitMessage = new ProcessCommitMessage({ git, config, state, filesystem });
  const linkIssue = new LinkIssue({ git, config, state, registry, metadata: issueMetadata });
  const unlinkIssue = new UnlinkIssue({ git, config, state });
  const setMode = new SetMode({ git, config });
  const setEnabled = new SetEnabled({ git, config });
  const removeRepository = new RemoveRepository({
    git,
    config,
    state,
    hooks,
    metadata,
    registry,
    captureBinaryPath,
  });
  const manageConfig = new ManageConfig({ git, config, settings });
  const manageRepositoryRegistry = new ManageRepositoryRegistry({ registry, git, config });
  const generatePrTitle = new GeneratePrTitle({
    git,
    config,
    status: getRepositoryStatus,
    registry,
    metadata: issueMetadata,
    settings,
    clipboard: new SystemClipboard(),
    prompt: new TerminalStoryTitlePrompt(),
  });

  return {
    initializeRepository,
    getRepositoryStatus,
    runDoctor,
    repairRepository,
    processCommitMessage,
    linkIssue,
    unlinkIssue,
    setMode,
    setEnabled,
    removeRepository,
    manageConfig,
    listRepositories,
    manageRepositoryRegistry,
    settings,
    issueMetadata,
    generatePrTitle,
  };
}
