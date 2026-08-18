import type { CommitFormat } from "../../domain/commit-format";
import { DEFAULT_ISSUE_PATTERN } from "../../domain/issue-key";
import type { LinkingMode } from "../../domain/linking-mode";
import type { RepoWorkflowConfig } from "../ports/repo-config.port";

/**
 * Effective workflow configuration (architecture §12, VS-1 subset).
 *
 * Precedence in VS-1: repo-local Git config over built-in defaults. Global
 * SQLite defaults join the chain in E8; the commit hook never needs them
 * (ADR-0004/O-03).
 */

export interface EffectiveWorkflowConfig {
  enabled: boolean;
  mode: LinkingMode;
  issuePattern: string;
  commitFormat: CommitFormat;
}

export const BUILT_IN_DEFAULTS: Readonly<Omit<EffectiveWorkflowConfig, "enabled">> = {
  mode: "hybrid",
  issuePattern: DEFAULT_ISSUE_PATTERN,
  commitFormat: "footer",
};

export const DEFAULT_ENABLED = true;

export function computeEffectiveConfig(
  repoConfig: RepoWorkflowConfig | null,
): EffectiveWorkflowConfig {
  if (repoConfig === null) {
    return { enabled: DEFAULT_ENABLED, ...BUILT_IN_DEFAULTS };
  }
  return {
    enabled: repoConfig.enabled,
    mode: repoConfig.mode,
    issuePattern: repoConfig.issuePattern ?? BUILT_IN_DEFAULTS.issuePattern,
    commitFormat: repoConfig.commitFormat ?? BUILT_IN_DEFAULTS.commitFormat,
  };
}
