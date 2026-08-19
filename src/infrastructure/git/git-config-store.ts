import type { GitRepositoryContext } from "../../application/ports/git.port";
import type { RepoConfigPort, RepoWorkflowConfig } from "../../application/ports/repo-config.port";
import { type CommitFormat, isCommitFormat } from "../../domain/commit-format";
import { ConfigInvalidError } from "../../domain/errors";
import { isLinkingMode, type LinkingMode } from "../../domain/linking-mode";
import type { GitRunner } from "./git-runner";

/**
 * Stores JiraFlow repo-wide workflow configuration in `git config --local`
 * (ADR-0004/O-01, architecture §10).
 *
 * All reads and writes go through the Git executable; `.git/config` is never
 * edited as text.
 */

const SECTION_PREFIX = "jiraflow.";

export class GitConfigStore implements RepoConfigPort {
  private readonly runner: GitRunner;

  constructor(runner: GitRunner) {
    this.runner = runner;
  }

  async read(repo: GitRepositoryContext): Promise<RepoWorkflowConfig | null> {
    const enabled = await this.runner.run({
      cwd: repo.root,
      args: ["config", "--local", "--type=bool", "--get", "jiraflow.enabled"],
    });
    const enabledValue =
      enabled.exitCode === 0 ? parseBool("jiraflow.enabled", enabled.stdout.trim()) : true;

    const batch = await this.runner.run({
      cwd: repo.root,
      args: ["config", "--local", "--get-regexp", `^${SECTION_PREFIX}`],
    });

    if (batch.exitCode !== 0 && enabled.exitCode !== 0) {
      return null;
    }

    const overrides = new Map<string, string>();
    if (batch.exitCode === 0) {
      for (const line of batch.stdout.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;
        const separator = trimmed.indexOf(" ");
        if (separator === -1) continue;
        const key = trimmed.slice(0, separator);
        const value = trimmed.slice(separator + 1);
        if (key.startsWith(SECTION_PREFIX)) {
          overrides.set(key.slice(SECTION_PREFIX.length).toLowerCase(), value);
        }
      }
    }

    return {
      enabled: enabledValue,
      mode: this.parseMode(overrides.get("mode")),
      issuePattern: optionalString(overrides.get("issuepattern")),
      commitFormat: this.parseFormat(overrides.get("commitformat")),
      prTitleTemplate: optionalString(overrides.get("prtitletemplate")),
      dateFormat: optionalString(overrides.get("dateformat")),
    };
  }

  async setEnabled(repo: GitRepositoryContext, value: boolean): Promise<void> {
    await this.runOk(repo, [
      "config",
      "--local",
      "--type=bool",
      "jiraflow.enabled",
      value ? "true" : "false",
    ]);
  }

  async setMode(repo: GitRepositoryContext, mode: LinkingMode): Promise<void> {
    await this.runOk(repo, ["config", "--local", "jiraflow.mode", mode]);
  }

  async setCommitFormat(repo: GitRepositoryContext, format: CommitFormat | null): Promise<void> {
    if (format === null) {
      await this.unsetKey(repo, "jiraflow.commitFormat");
      return;
    }
    await this.runOk(repo, ["config", "--local", "jiraflow.commitFormat", format]);
  }

  async setIssuePattern(repo: GitRepositoryContext, pattern: string | null): Promise<void> {
    if (pattern === null) {
      await this.unsetKey(repo, "jiraflow.issuePattern");
      return;
    }
    await this.runOk(repo, ["config", "--local", "jiraflow.issuePattern", pattern]);
  }

  async setPrTitleTemplate(repo: GitRepositoryContext, value: string | null): Promise<void> {
    if (value === null) {
      await this.unsetKey(repo, "jiraflow.prTitleTemplate");
      return;
    }
    await this.runOk(repo, ["config", "--local", "jiraflow.prTitleTemplate", value]);
  }

  async setDateFormat(repo: GitRepositoryContext, value: string | null): Promise<void> {
    if (value === null) {
      await this.unsetKey(repo, "jiraflow.dateFormat");
      return;
    }
    await this.runOk(repo, ["config", "--local", "jiraflow.dateFormat", value]);
  }

  async unset(repo: GitRepositoryContext, key: string): Promise<void> {
    await this.unsetKey(repo, key.startsWith("jiraflow.") ? key : `jiraflow.${key}`);
  }

  async removeAll(repo: GitRepositoryContext): Promise<void> {
    const result = await this.runner.run({
      cwd: repo.root,
      args: ["config", "--local", "--remove-section", "jiraflow"],
    });
    if (result.exitCode === 0) return;
    if (result.stderr.includes("no such section")) return;
    throw new Error(`git config --remove-section jiraflow failed: ${result.stderr.trim()}`);
  }

  private async unsetKey(repo: GitRepositoryContext, key: string): Promise<void> {
    const result = await this.runner.run({
      cwd: repo.root,
      args: ["config", "--local", "--unset", key],
    });
    if (result.exitCode === 0) return;
    if (result.exitCode === 5 || result.stderr.toLowerCase().includes("not found")) {
      return;
    }
    throw new Error(`git config --unset ${key} failed: ${result.stderr.trim()}`);
  }

  private async runOk(repo: GitRepositoryContext, args: string[]): Promise<void> {
    const result = await this.runner.run({ cwd: repo.root, args });
    if (result.exitCode !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
    }
  }

  private parseMode(value: string | undefined): LinkingMode {
    if (value === undefined || value.length === 0) {
      return "hybrid";
    }
    if (!isLinkingMode(value)) {
      throw new ConfigInvalidError("jiraflow.mode", value);
    }
    return value;
  }

  private parseFormat(value: string | undefined): CommitFormat | null {
    if (value === undefined || value.length === 0) {
      return null;
    }
    if (!isCommitFormat(value)) {
      throw new ConfigInvalidError("jiraflow.commitFormat", value);
    }
    return value;
  }
}

function optionalString(value: string | undefined): string | null {
  if (value === undefined || value.length === 0) {
    return null;
  }
  return value;
}

function parseBool(key: string, value: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new ConfigInvalidError(key, value);
}
