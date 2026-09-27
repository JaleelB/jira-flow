/**
 * Active issue resolution (product spec §4.3, architecture §5.2).
 *
 * Pure precedence rules owned by the domain. Neither the CLI nor the TUI
 * reimplements this logic.
 */

import type { JiraKey } from "./issue-key";
import type { LinkingMode } from "./linking-mode";

export type ActiveIssueSource = "branch" | "override" | "manual";

export interface ActiveIssue {
  key: JiraKey;
  source: ActiveIssueSource;
}

export interface ResolveActiveIssueInput {
  enabled: boolean;
  mode: LinkingMode;
  /** Worktree-local linked issue override, when present (ADR-0004). */
  linkedIssue: JiraKey | null;
  /** Issue derived from the current branch name, when present. */
  branchIssue: JiraKey | null;
}

/**
 * Hybrid: linked issue wins; otherwise derive from the branch.
 * Branch: always derive from the branch; linked issue is preserved but ignored.
 * Manual: only the linked issue counts.
 * Disabled: no active issue, whatever the other inputs are.
 *
 * No missing issue state blocks a commit: null is a normal result.
 */
export function resolveActiveIssue(input: ResolveActiveIssueInput): ActiveIssue | null {
  if (!input.enabled) {
    return null;
  }

  switch (input.mode) {
    case "hybrid":
      if (input.linkedIssue !== null) {
        return { key: input.linkedIssue, source: "override" };
      }
      if (input.branchIssue !== null) {
        return { key: input.branchIssue, source: "branch" };
      }
      return null;
    case "branch":
      if (input.branchIssue !== null) {
        return { key: input.branchIssue, source: "branch" };
      }
      return null;
    case "manual":
      if (input.linkedIssue !== null) {
        return { key: input.linkedIssue, source: "manual" };
      }
      return null;
  }
}
