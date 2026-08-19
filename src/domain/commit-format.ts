/**
 * Commit formatting (product spec §10, architecture §5.3, DR-0019).
 *
 * Mutation is pure: file I/O lives in the application/infrastructure layers.
 * Idempotency is per active issue: a different Jira key already in the
 * message must not prevent applying the active issue.
 */

import type { JiraKey } from "./issue-key";

export type CommitFormat = "footer" | "suffix" | "prefix" | "scope";

export const DEFAULT_COMMIT_FORMAT: CommitFormat = "footer";

export function isCommitFormat(value: string): value is CommitFormat {
  return value === "footer" || value === "suffix" || value === "prefix" || value === "scope";
}

export type CommitMutationResult =
  | {
      changed: false;
      message: string;
      reason: "already-present" | "no-change" | "unsafe-scope";
    }
  | {
      changed: true;
      message: string;
    };

export interface ApplyIssueReferenceInput {
  message: string;
  issue: JiraKey;
  format: CommitFormat;
}

/** The footer line this format appends, e.g. `Jira: ABC-123`. */
export function footerLine(issue: JiraKey): string {
  return `Jira: ${issue}`;
}

export function suffixToken(issue: JiraKey): string {
  return `[${issue}]`;
}

/**
 * Applies the configured format. Empty/whitespace-only messages are left
 * untouched. The result carries no trailing newline; file-level newline
 * preservation is the commit-file I/O layer (architecture §38).
 */
export function applyIssueReference(input: ApplyIssueReferenceInput): CommitMutationResult {
  const { message, issue, format } = input;

  const body = message.replace(/[\s\uFEFF\xA0]+$/u, "");
  if (body.length === 0) {
    return { changed: false, message, reason: "no-change" };
  }

  switch (format) {
    case "footer":
      return applyFooter(message, body, issue);
    case "suffix":
      return applySuffix(message, body, issue);
    case "prefix":
      return applyPrefix(message, body, issue);
    case "scope":
      return applyScope(message, body, issue);
  }
}

function applyFooter(message: string, body: string, issue: JiraKey): CommitMutationResult {
  if (hasFooter(message, issue)) {
    return { changed: false, message, reason: "already-present" };
  }
  return { changed: true, message: `${body}\n\n${footerLine(issue)}` };
}

function applySuffix(message: string, body: string, issue: JiraKey): CommitMutationResult {
  if (hasSuffix(message, issue)) {
    return { changed: false, message, reason: "already-present" };
  }
  const newline = body.indexOf("\n");
  const first = newline === -1 ? body : body.slice(0, newline);
  const rest = newline === -1 ? "" : body.slice(newline);
  const token = suffixToken(issue);
  const updatedFirst = `${first.replace(/[ \t]+$/u, "")} ${token}`;
  return { changed: true, message: `${updatedFirst}${rest}` };
}

function applyPrefix(message: string, body: string, issue: JiraKey): CommitMutationResult {
  if (hasPrefix(message, issue)) {
    return { changed: false, message, reason: "already-present" };
  }
  const newline = body.indexOf("\n");
  const first = newline === -1 ? body : body.slice(0, newline);
  const rest = newline === -1 ? "" : body.slice(newline);
  return { changed: true, message: `${issue} ${first}${rest}` };
}

/**
 * Conventional Commit subject: `type:` or `type():` (empty scope) can take
 * the issue as scope. A non-empty existing scope is unsafe (DR-0019).
 */
const CONVENTIONAL_SUBJECT =
  /^(?<type>[A-Za-z]+)(?:\((?<scope>[^)]*)\))?(?<breaking>!)?:(?<space>[ \t]+)(?<rest>.*)$/;

function applyScope(message: string, body: string, issue: JiraKey): CommitMutationResult {
  if (hasScope(message, issue)) {
    return { changed: false, message, reason: "already-present" };
  }

  const newline = body.indexOf("\n");
  const first = newline === -1 ? body : body.slice(0, newline);
  const rest = newline === -1 ? "" : body.slice(newline);
  const match = CONVENTIONAL_SUBJECT.exec(first);
  if (match === null || match.groups === undefined) {
    return { changed: false, message, reason: "unsafe-scope" };
  }

  const existingScope = match.groups.scope;
  if (existingScope !== undefined && existingScope.length > 0) {
    return { changed: false, message, reason: "unsafe-scope" };
  }

  const type = match.groups.type ?? "";
  const breaking = match.groups.breaking ?? "";
  const space = match.groups.space ?? " ";
  const remainder = match.groups.rest ?? "";
  const updatedFirst = `${type}(${issue})${breaking}:${space}${remainder}`;
  return { changed: true, message: `${updatedFirst}${rest}` };
}

export function hasFooter(message: string, issue: JiraKey): boolean {
  const pattern = new RegExp(`^Jira: ${escapeRegExp(issue)}[ \\t]*$`, "m");
  return pattern.test(message);
}

export function hasSuffix(message: string, issue: JiraKey): boolean {
  const first = firstLine(message);
  const token = suffixToken(issue);
  const pattern = new RegExp(`${escapeRegExp(token)}[ \\t]*$`);
  return pattern.test(first);
}

export function hasPrefix(message: string, issue: JiraKey): boolean {
  const first = firstLine(message);
  return new RegExp(`^${escapeRegExp(issue)}[ \\t]`).test(first);
}

export function hasScope(message: string, issue: JiraKey): boolean {
  const first = firstLine(message);
  const match = CONVENTIONAL_SUBJECT.exec(first);
  if (match === null || match.groups === undefined) {
    return false;
  }
  return match.groups.scope === issue;
}

function firstLine(message: string): string {
  const newline = message.indexOf("\n");
  return newline === -1 ? message : message.slice(0, newline);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
