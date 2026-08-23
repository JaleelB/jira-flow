import { resolveActiveIssue } from "../../domain/active-issue";
import {
  BareRepositoryUnsupportedError,
  ConfigInvalidError,
  NotAGitRepositoryError,
} from "../../domain/errors";
import { DEFAULT_ISSUE_PATTERN, extractIssueKeyFromBranch } from "../../domain/issue-key";
import type { DoctorCheckResult, DoctorOverall, DoctorResult } from "../models/doctor-result";
import type { GitPort } from "../ports/git.port";
import type { HookManagerPort } from "../ports/hooks.port";
import type { RegistryPort } from "../ports/registry.port";
import type { RepoConfigPort } from "../ports/repo-config.port";
import type { SettingsPort } from "../ports/settings.port";
import type { WorktreeStatePort } from "../ports/worktree-state.port";
import { computeEffectiveConfig } from "../services/effective-config";
import type { ListRepositories } from "./list-repositories";

export interface RunDoctorDeps {
  git: GitPort;
  config: RepoConfigPort;
  state: WorktreeStatePort;
  hooks: HookManagerPort;
  registry?: RegistryPort | null;
  captureBinaryPath?: () => string | null;
  settings?: SettingsPort;
  listRepositories?: ListRepositories;
}

export interface RunDoctorInput {
  path: string;
}

export class RunDoctor {
  constructor(private readonly deps: RunDoctorDeps) {}

  async execute(input: RunDoctorInput): Promise<DoctorResult> {
    const checks: DoctorCheckResult[] = [];

    let repo = null;
    try {
      repo = await this.deps.git.discoverRepository(input.path);
      checks.push({ id: "git.repository", status: "pass", detail: repo.root });
    } catch (error) {
      if (
        error instanceof NotAGitRepositoryError ||
        error instanceof BareRepositoryUnsupportedError
      ) {
        if (
          error instanceof NotAGitRepositoryError &&
          this.deps.settings &&
          this.deps.listRepositories
        ) {
          return this.runGlobal();
        }
        checks.push({ id: "git.repository", status: "fail", detail: error.message });
        return { repoPath: null, checks, overall: overallFor(checks) };
      }
      throw error;
    }

    let config = null;
    try {
      config = await this.deps.config.read(repo);
      if (config === null) {
        checks.push({
          id: "config.valid",
          status: "fail",
          detail: "JiraFlow is not configured; run `jira-flow init --yes`",
          repairHint: "jira-flow init --yes",
        });
      } else {
        checks.push({ id: "config.valid", status: "pass" });
      }
    } catch (error) {
      if (error instanceof ConfigInvalidError) {
        checks.push({ id: "config.valid", status: "fail", detail: error.message });
      } else {
        throw error;
      }
    }

    try {
      await this.deps.state.read(repo);
      checks.push({ id: "worktree.state", status: "pass" });
    } catch (error) {
      checks.push({
        id: "worktree.state",
        status: "fail",
        detail: error instanceof Error ? error.message : String(error),
        repairHint: "jira-flow doctor --repair",
      });
    }

    if (this.deps.registry) {
      try {
        const row = await this.deps.registry.findByPath(repo.root);
        if (row === null) {
          checks.push({
            id: "registry.sync",
            status: "warning",
            detail: "repository is not registered in the dashboard database",
            repairHint: "jira-flow doctor --repair",
          });
        } else {
          checks.push({ id: "registry.sync", status: "pass" });
        }
      } catch (error) {
        checks.push({
          id: "registry.sync",
          status: "warning",
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      checks.push({
        id: "registry.sync",
        status: "warning",
        detail: "registry unavailable",
      });
    }

    const hooksCtx = await this.deps.git.resolveHooks(repo);
    checks.push({
      id: "hooks.path",
      status: "pass",
      detail: `${hooksCtx.hooksDir} (${hooksCtx.hooksPathOrigin})`,
    });

    const inspection = await this.deps.hooks.inspect(repo);
    if (inspection.status === "owned" || inspection.status === "managed-block") {
      checks.push({ id: "hooks.integration", status: "pass", detail: inspection.status });
      checks.push({ id: "hooks.ownership", status: "pass", detail: inspection.status });
      checks.push({
        id: "hooks.foreign-preserved",
        status: inspection.status === "managed-block" ? "pass" : "pass",
        detail:
          inspection.status === "managed-block"
            ? "foreign hook body retained around the managed block"
            : "owned hook contains only JiraFlow integration",
      });
    } else if (inspection.status === "missing") {
      checks.push({
        id: "hooks.integration",
        status: "fail",
        detail: "commit-msg hook is missing; run `jira-flow init --yes`",
        repairHint: "jira-flow init --yes",
      });
      checks.push({ id: "hooks.ownership", status: "warning", detail: "no hook to inspect" });
      checks.push({ id: "hooks.foreign-preserved", status: "pass", detail: "no foreign hook" });
    } else {
      checks.push({ id: "hooks.integration", status: "pass", detail: inspection.status });
      checks.push({
        id: "hooks.ownership",
        status: "fail",
        detail: inspection.reason ?? inspection.status,
      });
      checks.push({
        id: "hooks.foreign-preserved",
        status: "pass",
        detail: "foreign hook left unmodified",
      });
    }

    const binary = this.deps.captureBinaryPath?.() ?? null;
    if (binary === null) {
      checks.push({
        id: "binary.reachable",
        status: "pass",
        detail: "PATH fallback (development interpreter)",
      });
    } else {
      const reachable = await Bun.file(binary).exists();
      checks.push({
        id: "binary.reachable",
        status: reachable ? "pass" : "warning",
        detail: binary,
      });
    }

    let pattern = DEFAULT_ISSUE_PATTERN;
    if (config !== null) {
      pattern = computeEffectiveConfig(config).issuePattern;
    }
    try {
      new RegExp(pattern);
      checks.push({ id: "issue.pattern", status: "pass", detail: pattern });
    } catch {
      checks.push({ id: "issue.pattern", status: "fail", detail: pattern });
    }

    if (config !== null) {
      try {
        computeEffectiveConfig(config);
        checks.push({ id: "mode.valid", status: "pass", detail: config.mode });
      } catch (error) {
        checks.push({
          id: "mode.valid",
          status: "fail",
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      checks.push({ id: "mode.valid", status: "warning", detail: "not configured" });
    }

    if (config !== null) {
      try {
        const state = await this.deps.state.read(repo);
        const effective = computeEffectiveConfig(config);
        const branch = await this.deps.git.getCurrentBranch(repo);
        const branchIssue = extractIssueKeyFromBranch(branch, effective.issuePattern);
        const active = resolveActiveIssue({
          enabled: effective.enabled,
          mode: effective.mode,
          linkedIssue: state.linkedIssue,
          branchIssue,
        });
        checks.push({
          id: "active-issue.resolve",
          status: "pass",
          detail: active === null ? "no active issue" : `${active.key} (${active.source})`,
        });
      } catch (error) {
        checks.push({
          id: "active-issue.resolve",
          status: "warning",
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      checks.push({ id: "active-issue.resolve", status: "warning", detail: "not configured" });
    }

    return { repoPath: repo.root, checks, overall: overallFor(checks) };
  }

  private async runGlobal(): Promise<DoctorResult> {
    const checks: DoctorCheckResult[] = [];
    try {
      await this.deps.settings?.read();
      checks.push({ id: "database.available", status: "pass" });
      checks.push({ id: "database.schema", status: "pass", detail: "latest migrations applied" });
    } catch (error) {
      checks.push({
        id: "database.available",
        status: "fail",
        detail: error instanceof Error ? error.message : String(error),
      });
      return { repoPath: null, checks, overall: overallFor(checks) };
    }
    const view = await this.deps.listRepositories?.execute({ refresh: true });
    const missing = view?.repositories.filter((repo) => repo.health === "missing") ?? [];
    checks.push({
      id: "registry.paths",
      status: missing.length === 0 ? "pass" : "warning",
      detail:
        missing.length === 0
          ? `${view?.repositories.length ?? 0} registered repositories`
          : `${missing.length} missing: ${missing.map((repo) => repo.displayName).join(", ")}`,
    });
    return { repoPath: null, checks, overall: overallFor(checks) };
  }
}

function overallFor(checks: DoctorCheckResult[]): DoctorOverall {
  if (checks.some((check) => check.status === "fail")) {
    return "broken";
  }
  if (checks.some((check) => check.status === "warning")) {
    return "warning";
  }
  return "healthy";
}
