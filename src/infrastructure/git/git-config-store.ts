import type { GitRepositoryContext } from "../../application/ports/git.port";
import type { RepoConfigPort, RepoWorkflowConfig } from "../../application/ports/repo-config.port";
import type { CommitFormat } from "../../domain/commit-format";
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

function isCommitFormat(value: string): value is CommitFormat {
  return value === "footer" || value === "suffix" || value === "prefix" || value === "scope";
}

export class GitConfigStore implements RepoConfigPort {
  private readonly runner: GitRunner;

  constructor(runner: GitRunner) {
    this.runner = runner;
  }

  async read(repo: GitRepositoryContext): Promise<RepoWorkflowConfig | null> {
    // Booleans are read through Git's own type conversion (architecture §10).
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
          // Git normalizes config keys case-insensitively; `--get-regexp`
          // prints lowercase keys (e.g. `jiraflow.commitformat`).
          overrides.set(key.slice(SECTION_PREFIX.length).toLowerCase(), value);
        }
      }
    }

    const mode = this.parseMode(overrides.get("mode"));
    const commitFormat = this.parseFormat(overrides.get("commitformat"));
    const issuePattern = overrides.get("issuepattern");

    return {
      enabled: enabledValue,
      mode,
      issuePattern: issuePattern === undefined ? null : issuePattern,
      commitFormat,
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

  async setCommitFormat(repo: GitRepositoryContext, format: CommitFormat): Promise<void> {
    await this.runOk(repo, ["config", "--local", "jiraflow.commitFormat", format]);
  }

  async removeAll(repo: GitRepositoryContext): Promise<void> {
    const result = await this.runner.run({
      cwd: repo.root,
      args: ["config", "--local", "--remove-section", "jiraflow"],
    });
    if (result.exitCode === 0) return;
    // A missing section is success: removal is idempotent.
    if (result.stderr.includes("no such section")) return;
    throw new Error(
      `git config --remove-section jiraflow failed: ${result.stderr.trim()}`,
    );
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

function parseBool(key: string, value: string): boolean {
  // Git already normalized the value through --type=bool; accept its output.
  if (value === "true") return true;
  if (value === "false") return false;
  throw new ConfigInvalidError(key, value);
}
