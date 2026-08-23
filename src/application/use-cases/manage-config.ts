import { isCommitFormat } from "../../domain/commit-format";
import {
  ConfigInvalidError,
  RepositoryNotConfiguredError,
  UnknownConfigKeyError,
} from "../../domain/errors";
import { isLinkingMode } from "../../domain/linking-mode";
import type { GitPort } from "../ports/git.port";
import type { RepoConfigPort } from "../ports/repo-config.port";
import {
  GLOBAL_SETTING_KEYS,
  type GlobalSettingKey,
  type GlobalSettings,
  type SettingsPort,
} from "../ports/settings.port";
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
  constructor(
    private readonly deps: { git: GitPort; config: RepoConfigPort; settings: SettingsPort },
  ) {}

  async execute(input: {
    path: string;
    action: "list" | "get" | "set" | "unset";
    key?: string;
    value?: string;
    global?: boolean;
  }): Promise<{
    effective: EffectiveWorkflowConfig;
    sources: ReturnType<typeof describeEffectiveSources>;
    globalSettings?: GlobalSettings;
    key?: string;
    value?: string;
  }> {
    if (input.global === true) {
      return this.executeGlobal(input);
    }
    const repo = await this.deps.git.discoverRepository(input.path);
    const globalSettings = await this.deps.settings.read();
    let config = await this.deps.config.read(repo);
    if (config === null && input.action !== "list") {
      throw new RepositoryNotConfiguredError(repo.root);
    }

    if (input.action === "get") {
      if (input.key === undefined || !isConfigKey(input.key)) {
        throw new UnknownConfigKeyError(input.key ?? "");
      }
      const effective = computeEffectiveConfig(config, {}, globalSettings);
      return {
        effective,
        sources: describeEffectiveSources(config, {}, globalSettings),
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
      effective: computeEffectiveConfig(config, {}, globalSettings),
      sources: describeEffectiveSources(config, {}, globalSettings),
    };
  }

  private async executeGlobal(input: {
    action: "list" | "get" | "set" | "unset";
    key?: string;
    value?: string;
  }): Promise<{
    effective: EffectiveWorkflowConfig;
    sources: ReturnType<typeof describeEffectiveSources>;
    globalSettings: GlobalSettings;
    key?: string;
    value?: string;
  }> {
    if (input.action !== "list" && (input.key === undefined || !isGlobalKey(input.key))) {
      throw new UnknownConfigKeyError(input.key ?? "");
    }
    const key = input.key as GlobalSettingKey | undefined;
    if (input.action === "set" && key !== undefined) {
      if (input.value === undefined) throw new ConfigInvalidError(key, "missing value");
      await this.deps.settings.set(key, parseGlobalValue(key, input.value));
    } else if (input.action === "unset" && key !== undefined) {
      await this.deps.settings.unset(key);
    }
    const globalSettings = await this.deps.settings.read();
    const base = {
      effective: computeEffectiveConfig(null, {}, globalSettings),
      sources: describeEffectiveSources(null, {}, globalSettings),
      globalSettings,
    };
    if (input.action === "get" && key !== undefined) {
      return { ...base, key, value: String(globalSettings[key]) };
    }
    return base;
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

function isGlobalKey(value: string): value is GlobalSettingKey {
  return (GLOBAL_SETTING_KEYS as readonly string[]).includes(value);
}

function parseGlobalValue(key: GlobalSettingKey, value: string): GlobalSettings[GlobalSettingKey] {
  switch (key) {
    case "defaultMode":
      if (!isLinkingMode(value)) throw new ConfigInvalidError(key, value);
      return value;
    case "defaultCommitFormat":
      if (!isCommitFormat(value)) throw new ConfigInvalidError(key, value);
      return value;
    case "copyPrTitleToClipboard":
      if (!["true", "false", "1", "0"].includes(value)) throw new ConfigInvalidError(key, value);
      return value === "true" || value === "1";
    case "theme":
      if (value !== "system" && value !== "dark" && value !== "light") {
        throw new ConfigInvalidError(key, value);
      }
      return value;
    case "lastSelectedRepositoryId":
      return value === "" || value === "null" ? null : value;
    case "defaultIssuePattern":
      try {
        new RegExp(value);
      } catch {
        throw new ConfigInvalidError(key, value);
      }
      return value;
    case "defaultPrTitleTemplate":
    case "defaultDateFormat":
      if (value.length === 0) throw new ConfigInvalidError(key, value);
      return value;
  }
}
