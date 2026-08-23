import type { CommitFormat } from "../../domain/commit-format";
import { DEFAULT_ISSUE_PATTERN } from "../../domain/issue-key";
import type { LinkingMode } from "../../domain/linking-mode";
import type { RepoWorkflowConfig } from "../ports/repo-config.port";
import type { GlobalSettings } from "../ports/settings.port";

/**
 * Effective workflow configuration (architecture §12, DR-0017).
 *
 * M2 precedence: one-shot > repo-local Git config > built-in defaults.
 * Global SQLite settings are deferred to M3. The commit hook never reads
 * SQLite (ADR-0004/O-03).
 */

export interface EffectiveWorkflowConfig {
  enabled: boolean;
  mode: LinkingMode;
  issuePattern: string;
  commitFormat: CommitFormat;
  prTitleTemplate: string;
  dateFormat: string;
}

export const DEFAULT_PR_TITLE_TEMPLATE = "{jiraKey} | {date} | {quarter} | {storyTitle}";
export const DEFAULT_DATE_FORMAT = "YYYY-MM-DD";

export const BUILT_IN_DEFAULTS: Readonly<Omit<EffectiveWorkflowConfig, "enabled">> = {
  mode: "hybrid",
  issuePattern: DEFAULT_ISSUE_PATTERN,
  commitFormat: "footer",
  prTitleTemplate: DEFAULT_PR_TITLE_TEMPLATE,
  dateFormat: DEFAULT_DATE_FORMAT,
};

export const DEFAULT_ENABLED = true;

export const BUILT_IN_GLOBAL_SETTINGS: Readonly<GlobalSettings> = {
  defaultMode: BUILT_IN_DEFAULTS.mode,
  defaultIssuePattern: BUILT_IN_DEFAULTS.issuePattern,
  defaultCommitFormat: BUILT_IN_DEFAULTS.commitFormat,
  defaultPrTitleTemplate: BUILT_IN_DEFAULTS.prTitleTemplate,
  defaultDateFormat: BUILT_IN_DEFAULTS.dateFormat,
  copyPrTitleToClipboard: true,
  theme: "system",
  lastSelectedRepositoryId: null,
};

export type ConfigValueSource = "one-shot" | "repo" | "global" | "built-in";

export interface EffectiveConfigSources {
  enabled: ConfigValueSource;
  mode: ConfigValueSource;
  issuePattern: ConfigValueSource;
  commitFormat: ConfigValueSource;
  prTitleTemplate: ConfigValueSource;
  dateFormat: ConfigValueSource;
}

export interface OneShotConfigOverlay {
  enabled?: boolean;
  mode?: LinkingMode;
  issuePattern?: string;
  commitFormat?: CommitFormat;
  prTitleTemplate?: string;
  dateFormat?: string;
}

export function computeEffectiveConfig(
  repoConfig: RepoWorkflowConfig | null,
  overlay: OneShotConfigOverlay = {},
  global: GlobalSettings | null = null,
): EffectiveWorkflowConfig {
  const repo = repoConfig;
  return {
    enabled: overlay.enabled ?? repo?.enabled ?? DEFAULT_ENABLED,
    mode: overlay.mode ?? repo?.mode ?? global?.defaultMode ?? BUILT_IN_DEFAULTS.mode,
    issuePattern:
      overlay.issuePattern ??
      repo?.issuePattern ??
      global?.defaultIssuePattern ??
      BUILT_IN_DEFAULTS.issuePattern,
    commitFormat:
      overlay.commitFormat ??
      repo?.commitFormat ??
      global?.defaultCommitFormat ??
      BUILT_IN_DEFAULTS.commitFormat,
    prTitleTemplate:
      overlay.prTitleTemplate ??
      repo?.prTitleTemplate ??
      global?.defaultPrTitleTemplate ??
      BUILT_IN_DEFAULTS.prTitleTemplate,
    dateFormat:
      overlay.dateFormat ??
      repo?.dateFormat ??
      global?.defaultDateFormat ??
      BUILT_IN_DEFAULTS.dateFormat,
  };
}

export function describeEffectiveSources(
  repoConfig: RepoWorkflowConfig | null,
  overlay: OneShotConfigOverlay = {},
  global: GlobalSettings | null = null,
): EffectiveConfigSources {
  return {
    enabled: sourceFor(overlay.enabled !== undefined, repoConfig !== null),
    mode: sourceFor(overlay.mode !== undefined, repoConfig?.mode !== undefined, global !== null),
    issuePattern: sourceFor(
      overlay.issuePattern !== undefined,
      repoConfig?.issuePattern !== null && repoConfig?.issuePattern !== undefined,
      global !== null,
    ),
    commitFormat: sourceFor(
      overlay.commitFormat !== undefined,
      repoConfig?.commitFormat !== null && repoConfig?.commitFormat !== undefined,
      global !== null,
    ),
    prTitleTemplate: sourceFor(
      overlay.prTitleTemplate !== undefined,
      repoConfig?.prTitleTemplate !== null && repoConfig?.prTitleTemplate !== undefined,
      global !== null,
    ),
    dateFormat: sourceFor(
      overlay.dateFormat !== undefined,
      repoConfig?.dateFormat !== null && repoConfig?.dateFormat !== undefined,
      global !== null,
    ),
  };
}

function sourceFor(oneShot: boolean, repo: boolean, global = false): ConfigValueSource {
  if (oneShot) return "one-shot";
  if (repo) return "repo";
  if (global) return "global";
  return "built-in";
}
