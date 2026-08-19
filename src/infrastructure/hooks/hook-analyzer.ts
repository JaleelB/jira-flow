/**
 * Hook analysis (ADR-0005, architecture §16, E4-1).
 *
 * Content classification is deterministic. Shared/external and
 * permission-denied are applied by the hook manager using Git path
 * classification and filesystem errors — they are not inferred from bytes
 * alone.
 */

import { hasJiraflowMarkerTrace, hasValidManagedMarkers } from "./hook-markers";

export const SUPPORTED_INTERPRETERS = ["sh", "bash", "zsh", "dash"] as const;

export type SupportedInterpreter = (typeof SUPPORTED_INTERPRETERS)[number];

export type HookContentAnalysis =
  | { status: "missing" }
  | { status: "owned"; content: string }
  | { status: "managed-block"; content: string }
  | { status: "composable-shell"; content: string; interpreter: SupportedInterpreter }
  | { status: "malformed-jiraflow"; content: string; reason: string }
  | { status: "unsupported"; content: string; reason: string };

const SHEBANG = /^#![ \t]*(?<path>\S+)(?:[ \t]+(?<rest>.*))?$/;

export function analyzeCommitMsgHook(content: string | null): HookContentAnalysis {
  if (content === null) {
    return { status: "missing" };
  }

  if (content.includes("\0") || looksBinary(content)) {
    return {
      status: "unsupported",
      content,
      reason: "commit-msg is a binary file",
    };
  }

  const validMarkers = hasValidManagedMarkers(content);
  const markerTrace = hasJiraflowMarkerTrace(content);

  if (markerTrace && !validMarkers) {
    return {
      status: "malformed-jiraflow",
      content,
      reason: "JiraFlow markers are present but damaged or duplicated",
    };
  }

  if (validMarkers) {
    if (isOwnedShape(content)) {
      return { status: "owned", content };
    }
    return { status: "managed-block", content };
  }

  const interpreter = parseSupportedInterpreter(content);
  if (interpreter !== null) {
    return { status: "composable-shell", content, interpreter };
  }

  return {
    status: "unsupported",
    content,
    reason: unsupportedReason(content),
  };
}

export function parseSupportedInterpreter(content: string): SupportedInterpreter | null {
  const first = firstLine(content).trim();
  const match = SHEBANG.exec(first);
  if (match === null || match.groups === undefined) {
    return null;
  }

  const path = match.groups.path ?? "";
  const rest = (match.groups.rest ?? "").trim();
  const base = basename(path);

  if (base === "env") {
    const tokens = rest.split(/[ \t]+/).filter((token) => token.length > 0 && token !== "-S");
    const command = tokens[0];
    if (command !== undefined && isSupported(command)) {
      return command;
    }
    return null;
  }

  if (isSupported(base)) {
    return base;
  }
  return null;
}

function isOwnedShape(content: string): boolean {
  const lines = content.replace(/\n$/, "").split("\n");
  if (lines.length === 0) return false;
  if (!lines[0]?.startsWith("#!")) return false;
  let index = 1;
  while (index < lines.length && lines[index]?.trim() === "") {
    index += 1;
  }
  if (lines[index] !== "# >>> jiraflow managed block v1") {
    return false;
  }
  const end = lines.lastIndexOf("# <<< jiraflow managed block v1");
  if (end === -1) return false;
  for (let i = end + 1; i < lines.length; i += 1) {
    if (lines[i]?.trim() !== "") {
      return false;
    }
  }
  return true;
}

function looksBinary(content: string): boolean {
  if (content.startsWith("\x7fELF")) return true;
  let nonText = 0;
  const sample = content.slice(0, 512);
  for (let i = 0; i < sample.length; i += 1) {
    const code = sample.charCodeAt(i);
    if (code === 0) return true;
    if (code < 9 || (code > 13 && code < 32)) {
      nonText += 1;
    }
  }
  return sample.length > 0 && nonText / sample.length > 0.3;
}

function unsupportedReason(content: string): string {
  const first = firstLine(content).trim();
  if (!first.startsWith("#!")) {
    return "commit-msg has no supported shell shebang";
  }
  return `unsupported interpreter in shebang: ${first}`;
}

function isSupported(name: string): name is SupportedInterpreter {
  return (SUPPORTED_INTERPRETERS as readonly string[]).includes(name);
}

function basename(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  const index = normalized.lastIndexOf("/");
  return index === -1 ? normalized : normalized.slice(index + 1);
}

function firstLine(content: string): string {
  const newline = content.indexOf("\n");
  return newline === -1 ? content : content.slice(0, newline);
}
