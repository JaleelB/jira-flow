import type { CommitFormat } from "../../domain/commit-format";
import { DEFAULT_ISSUE_PATTERN } from "../../domain/issue-key";
import type { LinkingMode } from "../../domain/linking-mode";
import type { RepoWorkflowConfig } from "../ports/repo-config.port";

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

export type ConfigValueSource = "one-shot" | "repo" | "built-in";

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
): EffectiveWorkflowConfig {
  const repo = repoConfig;
  return {
    enabled: overlay.enabled ?? repo?.enabled ?? DEFAULT_ENABLED,
    mode: overlay.mode ?? repo?.mode ?? BUILT_IN_DEFAULTS.mode,
    issuePattern: overlay.issuePattern ?? repo?.issuePattern ?? BUILT_IN_DEFAULTS.issuePattern,
    commitFormat: overlay.commitFormat ?? repo?.commitFormat ?? BUILT_IN_DEFAULTS.commitFormat,
    prTitleTemplate:
      overlay.prTitleTemplate ?? repo?.prTitleTemplate ?? BUILT_IN_DEFAULTS.prTitleTemplate,
    dateFormat: overlay.dateFormat ?? repo?.dateFormat ?? BUILT_IN_DEFAULTS.dateFormat,
  };
}

export function describeEffectiveSources(
  repoConfig: RepoWorkflowConfig | null,
  overlay: OneShotConfigOverlay = {},
): EffectiveConfigSources {
  return {
    enabled: sourceFor(overlay.enabled !== undefined, repoConfig !== null),
    mode: sourceFor(overlay.mode !== undefined, repoConfig?.mode !== undefined),
    issuePattern: sourceFor(
      overlay.issuePattern !== undefined,
      repoConfig?.issuePattern !== null && repoConfig?.issuePattern !== undefined,
    ),
    commitFormat: sourceFor(
      overlay.commitFormat !== undefined,
      repoConfig?.commitFormat !== null && repoConfig?.commitFormat !== undefined,
    ),
    prTitleTemplate: sourceFor(
      overlay.prTitleTemplate !== undefined,
      repoConfig?.prTitleTemplate !== null && repoConfig?.prTitleTemplate !== undefined,
    ),
    dateFormat: sourceFor(
      overlay.dateFormat !== undefined,
      repoConfig?.dateFormat !== null && repoConfig?.dateFormat !== undefined,
    ),
  };
}

function sourceFor(oneShot: boolean, repo: boolean): ConfigValueSource {
  if (oneShot) return "one-shot";
  if (repo) return "repo";
  return "built-in";
}
