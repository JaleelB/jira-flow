import { BEGIN_MARKER, END_MARKER, MANAGED_BLOCK_VERSION } from "./hook-markers";

/**
 * Owned `commit-msg` hook script generation (architecture §15-16.1).
 *
 * The generated file contains only a shell shebang and the JiraFlow managed
 * block. The block:
 *
 *  - prefers the absolute captured binary path (GUI/IDE environments with
 *    incomplete PATH)
 *  - falls back to `command -v jira-flow` so a moved/upgraded installation
 *    recovers
 *  - becomes a no-op when neither is available: a missing JiraFlow
 *    executable must never block a Git commit (ADR-0005/O-02)
 *
 * Paths are emitted POSIX-style with `/` separators so Git for Windows can
 * execute the hook through its shell (architecture §15).
 */

export interface OwnedHookScriptOptions {
  /** Absolute path to the compiled jira-flow binary, when known. */
  binaryPath: string | null;
}

export function generateManagedBlock(options: OwnedHookScriptOptions): string {
  const lines: string[] = [];
  lines.push(BEGIN_MARKER);
  lines.push("# JiraFlow managed commit-msg integration.");
  if (options.binaryPath !== null) {
    lines.push(`JIRAFLOW_BIN=${shellQuote(toPosixPath(options.binaryPath))}`);
    lines.push("");
    lines.push('if [ -x "$JIRAFLOW_BIN" ]; then');
    lines.push('  "$JIRAFLOW_BIN" hook commit-msg "$1" || exit $?');
    lines.push("elif command -v jira-flow >/dev/null 2>&1; then");
    lines.push('  jira-flow hook commit-msg "$1" || exit $?');
    lines.push("fi");
  } else {
    lines.push("if command -v jira-flow >/dev/null 2>&1; then");
    lines.push('  jira-flow hook commit-msg "$1" || exit $?');
    lines.push("fi");
  }
  lines.push(END_MARKER);
  return lines.join("\n");
}

export function generateOwnedHookScript(options: OwnedHookScriptOptions): string {
  return `#!/bin/sh\n\n${generateManagedBlock(options)}\n`;
}

/** Single-quote escaping for POSIX shell assignments. */
export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/** Normalizes Windows separators to `/` for shell consumption. */
export function toPosixPath(path: string): string {
  return path.replaceAll("\\", "/");
}

export const HOOK_COMMAND = "hook commit-msg";

export const BLOCK_VERSION = MANAGED_BLOCK_VERSION;
