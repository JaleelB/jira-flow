/**
 * Commit formatting (product spec §10, architecture §5.3).
 *
 * VS-1 implements the `footer` format only (DR-0013). The mutation is pure:
 * file I/O lives in the application/infrastructure layers.
 */

import type { JiraKey } from "./issue-key";

export type CommitFormat = "footer" | "suffix" | "prefix" | "scope";

export const DEFAULT_COMMIT_FORMAT: CommitFormat = "footer";

export type CommitMutationResult =
  | {
      changed: false;
      message: string;
      reason: "already-present" | "no-change";
    }
  | {
      changed: true;
      message: string;
    };

export interface ApplyIssueReferenceInput {
  message: string;
  issue: JiraKey;
  format: "footer";
}

/** The footer line this format appends, e.g. `Jira: ABC-123`. */
export function footerLine(issue: JiraKey): string {
  return `Jira: ${issue}`;
}

/**
 * Appends the issue as a trailing footer:
 *
 * ```text
 * feat(auth): add login
 *
 * Jira: ABC-123
 * ```
 *
 * Idempotent: when the exact footer line is already present, the message is
 * returned unchanged. Empty/whitespace-only messages are left untouched.
 * The result carries no trailing newline; file-level newline preservation is
 * the responsibility of the commit-file I/O layer (architecture §38).
 */
export function applyIssueReference(input: ApplyIssueReferenceInput): CommitMutationResult {
  const { message, issue } = input;

  const body = message.replace(/[\s\uFEFF\xA0]+$/u, "");
  if (body.length === 0) {
    return { changed: false, message, reason: "no-change" };
  }

  const footer = footerLine(issue);
  if (hasFooter(message, issue)) {
    return { changed: false, message, reason: "already-present" };
  }

  return {
    changed: true,
    message: `${body}\n\n${footer}`,
  };
}

/**
 * True when the message already contains the reference-recognized footer
 * form for this issue: a line that is exactly `Jira: <key>`.
 */
export function hasFooter(message: string, issue: JiraKey): boolean {
  const pattern = new RegExp(`^Jira: ${escapeRegExp(issue)}[ \\t]*$`, "m");
  return pattern.test(message);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
