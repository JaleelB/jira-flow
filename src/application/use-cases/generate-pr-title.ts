import { NoActiveIssueError, StoryTitleRequiredError } from "../../domain/errors";
import { calendarQuarter, formatLocalDate, renderPrTitle } from "../../domain/pr-title";
import type { ClipboardPort } from "../ports/clipboard.port";
import type { GitPort } from "../ports/git.port";
import type { IssueMetadataPort } from "../ports/issue-metadata.port";
import type { ControlPlaneRegistryPort } from "../ports/registry.port";
import type { RepoConfigPort } from "../ports/repo-config.port";
import type { SettingsPort } from "../ports/settings.port";
import type { StoryTitlePromptPort } from "../ports/story-title-prompt.port";
import { BUILT_IN_GLOBAL_SETTINGS, computeEffectiveConfig } from "../services/effective-config";
import type { GetRepositoryStatus } from "./get-repository-status";

export interface GeneratedPrTitle {
  value: string;
  variables: Record<string, string>;
  copied: boolean;
  storyTitleSource: "option" | "cache" | "prompt" | "unused";
  warning?: string;
}

export class GeneratePrTitle {
  constructor(
    private readonly deps: {
      git: GitPort;
      config: RepoConfigPort;
      status: GetRepositoryStatus;
      registry: ControlPlaneRegistryPort;
      metadata: IssueMetadataPort;
      settings: SettingsPort;
      clipboard: ClipboardPort;
      prompt: StoryTitlePromptPort;
      now?: () => Date;
    },
  ) {}

  async execute(input: {
    path: string;
    title?: string;
    copy?: boolean;
  }): Promise<GeneratedPrTitle> {
    const status = await this.deps.status.execute({ path: input.path });
    if (status.activeIssue === null) throw new NoActiveIssueError();
    const repo = await this.deps.git.discoverRepository(status.repoPath);
    const repoConfig = await this.deps.config.read(repo);
    const global = await this.readGlobalSettings();
    const effective = computeEffectiveConfig(repoConfig, {}, global);
    const registered = await this.ensureRegistered(status.repoPath, status.repoName, repo);
    const jiraKey = status.activeIssue.key;
    const needsTitle = effective.prTitleTemplate.includes("{storyTitle}");
    let storyTitle = input.title?.trim() || null;
    let storyTitleSource: GeneratedPrTitle["storyTitleSource"] = storyTitle ? "option" : "unused";

    if (needsTitle && storyTitle === null && registered !== null) {
      storyTitle =
        (await this.deps.metadata.find(registered.id, jiraKey))?.storyTitle?.trim() || null;
      if (storyTitle !== null) storyTitleSource = "cache";
    }
    if (needsTitle && storyTitle === null) {
      storyTitle = await this.deps.prompt.prompt(jiraKey);
      if (storyTitle !== null) storyTitleSource = "prompt";
    }
    if (needsTitle && storyTitle === null) throw new StoryTitleRequiredError(jiraKey);

    if (registered !== null && storyTitle !== null && storyTitleSource !== "cache") {
      try {
        await this.deps.metadata.save(registered.id, jiraKey, storyTitle);
      } catch {
        // Cache is convenience data; generation must continue.
      }
    }

    const now = this.deps.now?.() ?? new Date();
    const variables = {
      jiraKey,
      storyTitle: storyTitle ?? "",
      branch: status.branch ?? "",
      repo: status.repoName,
      date: formatLocalDate(now, effective.dateFormat),
      quarter: calendarQuarter(now),
    };
    const value = renderPrTitle(effective.prTitleTemplate, variables);
    const shouldCopy = input.copy !== false && global.copyPrTitleToClipboard;
    let clipboard: { copied: boolean; warning?: string } = { copied: false };
    if (shouldCopy) {
      try {
        clipboard = await this.deps.clipboard.copy(value);
      } catch {
        clipboard = { copied: false, warning: "clipboard unavailable; title was still generated" };
      }
    }
    return {
      value,
      variables,
      copied: clipboard.copied,
      storyTitleSource,
      ...(clipboard.warning ? { warning: clipboard.warning } : {}),
    };
  }

  private async readGlobalSettings() {
    try {
      return await this.deps.settings.read();
    } catch {
      return { ...BUILT_IN_GLOBAL_SETTINGS };
    }
  }

  private async ensureRegistered(
    path: string,
    displayName: string,
    repo: Awaited<ReturnType<GitPort["discoverRepository"]>>,
  ) {
    try {
      return (
        (await this.deps.registry.findByPath(path)) ??
        (await this.deps.registry.register({
          path,
          displayName,
          remoteUrl: await this.deps.git.getRemoteUrl(repo),
        }))
      );
    } catch {
      return null;
    }
  }
}
