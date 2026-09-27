/**
 * Jira issue key value object (architecture §5.1).
 *
 * Validated keys are branded; construction happens only through
 * `parseJiraKey` (or `extractIssueKeyFromBranch`, which produces keys by
 * regex match construction).
 */

import { InvalidIssuePatternError, InvalidJiraKeyError } from "./errors";

/** Built-in default issue pattern (product spec §11.1). */
export const DEFAULT_ISSUE_PATTERN = "[A-Z][A-Z0-9]*-\\d+";

export type JiraKey = string & {
  readonly __brand: "JiraKey";
};

function compilePattern(pattern: string): RegExp {
  try {
    return new RegExp(pattern);
  } catch (error) {
    throw new InvalidIssuePatternError(
      pattern,
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Strict whole-token validation (product spec §11.2).
 *
 * The entire input must match the pattern; a substring match is rejected.
 * Throws `InvalidJiraKeyError` for non-matching input and
 * `InvalidIssuePatternError` for an invalid regex.
 */
export function parseJiraKey(input: string, pattern: string = DEFAULT_ISSUE_PATTERN): JiraKey {
  const anchored = anchoredPattern(pattern);
  if (!anchored.test(input)) {
    throw new InvalidJiraKeyError(input);
  }
  return input as JiraKey;
}

/** Wraps a pattern so the whole input must match it. */
function anchoredPattern(pattern: string): RegExp {
  try {
    return new RegExp(`^(?:${pattern})$`);
  } catch (error) {
    throw new InvalidIssuePatternError(
      pattern,
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Extracts an issue key from anywhere within a branch name
 * (product spec §11.1).
 *
 * Returns the first match, or null when the branch carries no issue key.
 * `null`/empty branches return null.
 */
export function extractIssueKeyFromBranch(
  branch: string | null,
  pattern: string = DEFAULT_ISSUE_PATTERN,
): JiraKey | null {
  if (branch === null || branch.length === 0) {
    return null;
  }
  const global = compilePattern(pattern);
  const match = global.exec(branch);
  if (!match || match.index === undefined || match[0] === undefined) {
    return null;
  }
  return match[0] as JiraKey;
}

/** Returns true when the input is a whole-token match for the pattern. */
export function isJiraKey(input: string, pattern: string = DEFAULT_ISSUE_PATTERN): boolean {
  try {
    parseJiraKey(input, pattern);
    return true;
  } catch {
    return false;
  }
}
