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
import type { RepoConfigPort } from "../ports/repo-config.port";
import type { WorktreeStatePort } from "../ports/worktree-state.port";
import { computeEffectiveConfig } from "../services/effective-config";

/**
 * `runDoctor` — read-only repository health checks (VS1-9).
 *
 * Checks: git repository, config validity, hook presence, ownership
 * markers, issue pattern compilation, active-issue resolution. Doctor never
 * mutates state; `--repair` arrives with E6.
 */

export interface RunDoctorDeps {
  git: GitPort;
  config: RepoConfigPort;
  state: WorktreeStatePort;
  hooks: HookManagerPort;
}

export interface RunDoctorInput {
  path: string;
}

export class RunDoctor {
  private readonly deps: RunDoctorDeps;

  constructor(deps: RunDoctorDeps) {
    this.deps = deps;
  }

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
        checks.push({ id: "git.repository", status: "fail", detail: error.message });
        return { repoPath: null, checks, overall: overallFor(checks) };
      }
      throw error;
    }

    // config.valid
    let config = null;
    try {
      config = await this.deps.config.read(repo);
      if (config === null) {
        checks.push({
          id: "config.valid",
          status: "fail",
          detail: "JiraFlow is not configured for this repository; run `jira-flow init --yes`",
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

    // hooks.present + hooks.ownership
    const inspection = await this.deps.hooks.inspect(repo);
    if (inspection.status === "owned") {
      checks.push({ id: "hooks.present", status: "pass" });
      checks.push({ id: "hooks.ownership", status: "pass", detail: "JiraFlow managed block v1" });
    } else if (inspection.status === "missing") {
      checks.push({
        id: "hooks.present",
        status: "fail",
        detail: "commit-msg hook is missing; run `jira-flow init --yes`",
      });
      checks.push({ id: "hooks.ownership", status: "warning", detail: "no hook to inspect" });
    } else {
      checks.push({ id: "hooks.present", status: "pass" });
      checks.push({
        id: "hooks.ownership",
        status: "fail",
        detail: inspection.reason ?? "hook is not owned by JiraFlow",
      });
    }

    // issue.pattern
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

    // active-issue.resolve
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
