import { isCommitFormat } from "../../domain/commit-format";
import {
  ConfigInvalidError,
  GlobalConfigUnavailableError,
  RepositoryNotConfiguredError,
  UnknownConfigKeyError,
} from "../../domain/errors";
import { isLinkingMode } from "../../domain/linking-mode";
import type { GitPort } from "../ports/git.port";
import type { RepoConfigPort } from "../ports/repo-config.port";
import {
  computeEffectiveConfig,
  describeEffectiveSources,
  type EffectiveWorkflowConfig,
} from "../services/effective-config";

export const CONFIG_KEYS = [
  "enabled",
  "mode",
  "issuePattern",
  "commitFormat",
  "prTitleTemplate",
  "dateFormat",
] as const;

export type ConfigKey = (typeof CONFIG_KEYS)[number];

function isConfigKey(value: string): value is ConfigKey {
  return (CONFIG_KEYS as readonly string[]).includes(value);
}

export class ManageConfig {
  constructor(private readonly deps: { git: GitPort; config: RepoConfigPort }) {}

  async execute(input: {
    path: string;
    action: "list" | "get" | "set" | "unset";
    key?: string;
    value?: string;
    global?: boolean;
  }): Promise<{
    effective: EffectiveWorkflowConfig;
    sources: ReturnType<typeof describeEffectiveSources>;
    key?: string;
    value?: string;
  }> {
    if (input.global === true) {
      throw new GlobalConfigUnavailableError();
    }
    const repo = await this.deps.git.discoverRepository(input.path);
    let config = await this.deps.config.read(repo);
    if (config === null && input.action !== "list") {
      throw new RepositoryNotConfiguredError(repo.root);
    }

    if (input.action === "get") {
      if (input.key === undefined || !isConfigKey(input.key)) {
        throw new UnknownConfigKeyError(input.key ?? "");
      }
      const effective = computeEffectiveConfig(config);
      return {
        effective,
        sources: describeEffectiveSources(config),
        key: input.key,
        value: String(effective[input.key]),
      };
    }

    if (input.action === "set") {
      if (input.key === undefined || !isConfigKey(input.key)) {
        throw new UnknownConfigKeyError(input.key ?? "");
      }
      if (config === null || input.value === undefined) {
        throw new RepositoryNotConfiguredError(repo.root);
      }
      await this.writeKey(repo, input.key, input.value);
      config = await this.deps.config.read(repo);
    }

    if (input.action === "unset") {
      if (input.key === undefined || !isConfigKey(input.key)) {
        throw new UnknownConfigKeyError(input.key ?? "");
      }
      if (input.key === "enabled" || input.key === "mode") {
        throw new ConfigInvalidError(input.key, "required key cannot be unset");
      }
      await this.deps.config.unset(repo, input.key);
      config = await this.deps.config.read(repo);
    }

    return {
      effective: computeEffectiveConfig(config),
      sources: describeEffectiveSources(config),
    };
  }

  private async writeKey(
    repo: Parameters<RepoConfigPort["read"]>[0],
    key: ConfigKey,
    value: string,
  ): Promise<void> {
    switch (key) {
      case "enabled":
        await this.deps.config.setEnabled(repo, value === "true" || value === "1");
        return;
      case "mode":
        if (!isLinkingMode(value)) throw new ConfigInvalidError("mode", value);
        await this.deps.config.setMode(repo, value);
        return;
      case "commitFormat":
        if (!isCommitFormat(value)) throw new ConfigInvalidError("commitFormat", value);
        await this.deps.config.setCommitFormat(repo, value);
        return;
      case "issuePattern":
        await this.deps.config.setIssuePattern(repo, value);
        return;
      case "prTitleTemplate":
        await this.deps.config.setPrTitleTemplate(repo, value);
        return;
      case "dateFormat":
        await this.deps.config.setDateFormat(repo, value);
        return;
    }
  }
}
