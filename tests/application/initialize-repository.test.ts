import { describe, expect, test } from "bun:test";
import type { GitPort, GitRepositoryContext } from "../../src/application/ports/git.port";
import type {
  HookInspection,
  HookInstallOptions,
  HookInstallResult,
  HookManagerPort,
} from "../../src/application/ports/hooks.port";
import type { RegistryPort } from "../../src/application/ports/registry.port";
import type {
  RepoConfigPort,
  RepoWorkflowConfig,
} from "../../src/application/ports/repo-config.port";
import type {
  WorktreeState,
  WorktreeStatePort,
} from "../../src/application/ports/worktree-state.port";
import { InitializeRepository } from "../../src/application/use-cases/initialize-repository";
import { HookConflictError } from "../../src/domain/errors";
import type { JiraKey } from "../../src/domain/issue-key";

/**
 * VT-15 — init compensating rollback (DR-0016, architecture §42.2).
 *
 * Fake ports prove orchestration, not Git itself: hook-install failure
 * after config+state writes triggers rollback of exactly those JiraFlow
 * mutations; registry failure leaves the functional repository intact.
 */

const REPO: GitRepositoryContext = {
  root: "/tmp/fake-repo",
  gitDir: "/tmp/fake-repo/.git",
  commonGitDir: "/tmp/fake-repo/.git",
  isLinkedWorktree: false,
};

function key(value: string): JiraKey {
  return value as JiraKey;
}

class FakeConfig implements RepoConfigPort {
  store = new Map<string, string>();
  writes: string[] = [];
  removeAllCalls = 0;

  async read(): Promise<RepoWorkflowConfig | null> {
    if (this.store.size === 0) return null;
    return {
      enabled: this.store.get("enabled") === "true",
      mode: (this.store.get("mode") as RepoWorkflowConfig["mode"]) ?? "hybrid",
      issuePattern: this.store.get("issuePattern") ?? null,
      commitFormat: (this.store.get("commitFormat") as RepoWorkflowConfig["commitFormat"]) ?? null,
      prTitleTemplate: this.store.get("prTitleTemplate") ?? null,
      dateFormat: this.store.get("dateFormat") ?? null,
    };
  }

  async setEnabled(_repo: unknown, value: boolean): Promise<void> {
    this.writes.push(`enabled=${value}`);
    this.store.set("enabled", String(value));
  }

  async setMode(_repo: unknown, mode: RepoWorkflowConfig["mode"]): Promise<void> {
    this.writes.push(`mode=${mode}`);
    this.store.set("mode", mode);
  }

  async setCommitFormat(
    _repo: unknown,
    format: NonNullable<RepoWorkflowConfig["commitFormat"]>,
  ): Promise<void> {
    this.writes.push(`commitFormat=${format}`);
    this.store.set("commitFormat", format);
  }

  async setIssuePattern(_repo: unknown, pattern: string | null): Promise<void> {
    if (pattern === null) this.store.delete("issuePattern");
    else this.store.set("issuePattern", pattern);
  }

  async setPrTitleTemplate(_repo: unknown, value: string | null): Promise<void> {
    if (value === null) this.store.delete("prTitleTemplate");
    else this.store.set("prTitleTemplate", value);
  }

  async setDateFormat(_repo: unknown, value: string | null): Promise<void> {
    if (value === null) this.store.delete("dateFormat");
    else this.store.set("dateFormat", value);
  }

  async unset(_repo: unknown, key: string): Promise<void> {
    this.store.delete(key.replace(/^jiraflow\./, ""));
  }

  async removeAll(): Promise<void> {
    this.removeAllCalls += 1;
    this.store.clear();
  }
}

class FakeState implements WorktreeStatePort {
  existsFlag = false;
  linked: JiraKey | null = null;
  writeCalls = 0;
  clearCalls = 0;

  async read(): Promise<WorktreeState> {
    return { schemaVersion: 1, linkedIssue: this.linked, updatedAt: "2026-08-18T00:00:00.000Z" };
  }

  async exists(): Promise<boolean> {
    return this.existsFlag;
  }

  async setLinkedIssue(_repo: unknown, issue: JiraKey | null): Promise<void> {
    this.writeCalls += 1;
    this.linked = issue;
    this.existsFlag = true;
  }

  async clear(): Promise<void> {
    this.clearCalls += 1;
    this.linked = null;
    this.existsFlag = false;
  }
}

class FakeHooks implements HookManagerPort {
  inspection: HookInspection = {
    status: "missing",
    hookPath: "/tmp/fake-repo/.git/hooks/commit-msg",
  };
  failInstall: Error | null = null;
  installed = false;
  removeOwnedCalls = 0;

  async inspect(): Promise<HookInspection> {
    return { ...this.inspection };
  }

  async installOwned(_repo: unknown, _options: HookInstallOptions): Promise<HookInstallResult> {
    if (this.failInstall !== null) throw this.failInstall;
    const created = !this.installed;
    this.installed = true;
    return { strategy: "owned", hookPath: this.inspection.hookPath, created };
  }

  async install(
    repo: GitRepositoryContext,
    options: HookInstallOptions,
  ): Promise<HookInstallResult> {
    return this.installOwned(repo, options);
  }

  async remove(): Promise<import("../../src/application/ports/hooks.port").HookRemoveResult> {
    const removed = await this.removeOwned();
    return {
      removed,
      mode: removed ? "owned-file" : "none",
      hookPath: this.inspection.hookPath,
    };
  }

  async removeOwned(): Promise<boolean> {
    this.removeOwnedCalls += 1;
    this.installed = false;
    return true;
  }

  async rollbackInstall(): Promise<void> {
    this.installed = false;
  }
}

class FakeMetadata {
  written = 0;
  removed = 0;

  async write() {
    this.written += 1;
    return {};
  }

  async remove() {
    this.removed += 1;
  }
}

class FakeRegistry implements RegistryPort {
  fail = false;
  registrations: Array<{ path: string; displayName: string; remoteUrl: string | null }> = [];

  async register(input: { path: string; displayName: string; remoteUrl: string | null }) {
    if (this.fail) throw new Error("registry down");
    this.registrations.push(input);
    return {
      id: "uuid-1",
      path: input.path,
      displayName: input.displayName,
      remoteUrl: input.remoteUrl,
      createdAt: 0,
      updatedAt: 0,
    };
  }

  async findByPath(path: string) {
    const row = this.registrations.find((entry) => entry.path === path);
    if (row === undefined) {
      return null;
    }
    return {
      id: "uuid-1",
      path: row.path,
      displayName: row.displayName,
      remoteUrl: row.remoteUrl,
      createdAt: 0,
      updatedAt: 0,
    };
  }

  async unregister(path: string) {
    const before = this.registrations.length;
    this.registrations = this.registrations.filter((entry) => entry.path !== path);
    return this.registrations.length < before;
  }
}

const fakeGit: GitPort = {
  discoverRepository: async () => REPO,
  getCurrentBranch: async () => "main",
  getRemoteUrl: async () => null,
  resolveHooks: async () => ({
    hooksDir: "/tmp/fake-repo/.git/hooks",
    hooksPathOrigin: "unknown",
    commitMsgPath: "/tmp/fake-repo/.git/hooks/commit-msg",
  }),
};

function makeUseCase(fakes: {
  config: FakeConfig;
  state: FakeState;
  hooks: FakeHooks;
  metadata: FakeMetadata;
  registry: RegistryPort | null;
}) {
  return new InitializeRepository({
    git: fakeGit,
    config: fakes.config,
    state: fakes.state,
    hooks: fakes.hooks,
    metadata: fakes.metadata,
    registry: fakes.registry,
    captureBinaryPath: () => "/opt/jira-flow/jira-flow",
  });
}

describe("initializeRepository — happy path", () => {
  test("clean repo: writes config, prepares state, installs hook, registers last", async () => {
    const fakes = {
      config: new FakeConfig(),
      state: new FakeState(),
      hooks: new FakeHooks(),
      metadata: new FakeMetadata(),
      registry: new FakeRegistry(),
    };
    const useCase = makeUseCase(fakes);

    const result = await useCase.execute({ path: REPO.root });

    expect(result.outcome).toBe("initialized");
    expect(result.hook.created).toBe(true);
    expect(fakes.config.store.get("mode")).toBe("hybrid");
    expect(fakes.config.store.get("enabled")).toBe("true");
    expect(fakes.config.store.get("commitFormat")).toBe("footer");
    expect(fakes.state.linked).toBeNull();
    expect(fakes.metadata.written).toBe(1);
    expect(fakes.registry.registrations).toHaveLength(1);
    expect(fakes.registry.registrations[0]?.path).toBe(REPO.root);
  });

  test("already configured: no config overwrite, no duplicate hook, success", async () => {
    const config = new FakeConfig();
    config.store.set("enabled", "false"); // pre-existing user value
    const fakes = {
      config,
      state: new FakeState(),
      hooks: new FakeHooks(),
      metadata: new FakeMetadata(),
      registry: new FakeRegistry(),
    };
    const useCase = makeUseCase(fakes);

    const result = await useCase.execute({ path: REPO.root });

    expect(result.outcome).toBe("already-configured");
    expect(config.writes).toEqual([]); // nothing overwritten
    expect(config.store.get("enabled")).toBe("false");
    expect(result.hook.created).toBe(true); // hook was missing; installed now
    expect(fakes.registry.registrations).toHaveLength(1);
  });

  test("pre-existing linked issue is preserved", async () => {
    const state = new FakeState();
    state.existsFlag = true;
    state.linked = key("OPS-992");
    const fakes = {
      config: new FakeConfig(),
      state,
      hooks: new FakeHooks(),
      metadata: new FakeMetadata(),
      registry: new FakeRegistry(),
    };
    const useCase = makeUseCase(fakes);

    await useCase.execute({ path: REPO.root });

    expect(state.writeCalls).toBe(0);
    expect(state.linked).toBe(key("OPS-992"));
  });
});

describe("initializeRepository — DR-0016 compensating rollback", () => {
  test("hook install failure after config+state writes rolls back JiraFlow changes", async () => {
    const config = new FakeConfig();
    const state = new FakeState();
    const hooks = new FakeHooks();
    hooks.failInstall = new Error("hooks dir is read-only");
    const fakes = {
      config,
      state,
      hooks,
      metadata: new FakeMetadata(),
      registry: new FakeRegistry(),
    };
    const useCase = makeUseCase(fakes);

    await expect(useCase.execute({ path: REPO.root })).rejects.toThrow("read-only");

    expect(config.removeAllCalls).toBe(1);
    expect(config.store.size).toBe(0);
    expect(state.clearCalls).toBe(1);
    expect(state.existsFlag).toBe(false);
    expect(fakes.registry.registrations).toHaveLength(0); // never reached
  });

  test("failed re-init does not destroy pre-existing JiraFlow state", async () => {
    const config = new FakeConfig();
    config.store.set("enabled", "true");
    config.store.set("mode", "hybrid");
    const state = new FakeState();
    state.existsFlag = true;
    state.linked = key("OPS-992");
    const hooks = new FakeHooks();
    hooks.installed = true; // owned hook already present
    hooks.failInstall = new Error("boom");
    const fakes = {
      config,
      state,
      hooks,
      metadata: new FakeMetadata(),
      registry: new FakeRegistry(),
    };
    const useCase = makeUseCase(fakes);

    await expect(useCase.execute({ path: REPO.root })).rejects.toThrow("boom");

    // This attempt wrote nothing config/state/hook-new: nothing rolled back.
    expect(config.removeAllCalls).toBe(0);
    expect(config.store.get("mode")).toBe("hybrid");
    expect(state.clearCalls).toBe(0);
    expect(state.linked).toBe(key("OPS-992"));
    expect(hooks.removeOwnedCalls).toBe(0);
  });

  test("foreign hook conflict fails before any mutation", async () => {
    const config = new FakeConfig();
    const state = new FakeState();
    const hooks = new FakeHooks();
    hooks.inspection = {
      status: "conflict",
      hookPath: "/tmp/fake-repo/.git/hooks/commit-msg",
      reason: "foreign",
    };
    const fakes = {
      config,
      state,
      hooks,
      metadata: new FakeMetadata(),
      registry: new FakeRegistry(),
    };
    const useCase = makeUseCase(fakes);

    await expect(useCase.execute({ path: REPO.root })).rejects.toBeInstanceOf(HookConflictError);

    expect(config.writes).toEqual([]);
    expect(state.writeCalls).toBe(0);
    expect(hooks.installed).toBe(false);
    expect(fakes.registry.registrations).toHaveLength(0);
  });
});

describe("initializeRepository — registry failure tolerance (DR-0016/O-02)", () => {
  test("registry failure keeps the configured repo and reports a warning", async () => {
    const registry = new FakeRegistry();
    registry.fail = true;
    const fakes = {
      config: new FakeConfig(),
      state: new FakeState(),
      hooks: new FakeHooks(),
      metadata: new FakeMetadata(),
      registry,
    };
    const useCase = makeUseCase(fakes);

    const result = await useCase.execute({ path: REPO.root });

    expect(result.outcome).toBe("initialized");
    expect(result.registryWarning).toBeDefined();
    expect(result.registryWarning).toContain("registration failed");
    // No rollback: repository stays configured.
    expect(fakes.config.store.get("mode")).toBe("hybrid");
    expect(fakes.hooks.installed).toBe(true);
    expect(fakes.config.removeAllCalls).toBe(0);
    expect(fakes.state.clearCalls).toBe(0);
  });

  test("missing registry backend reports an unavailable warning", async () => {
    const fakes = {
      config: new FakeConfig(),
      state: new FakeState(),
      hooks: new FakeHooks(),
      metadata: new FakeMetadata(),
      registry: null,
    };
    const useCase = makeUseCase(fakes);

    const result = await useCase.execute({ path: REPO.root });
    expect(result.outcome).toBe("initialized");
    expect(result.registryWarning).toContain("unavailable");
    expect(fakes.config.store.get("mode")).toBe("hybrid");
  });
});
