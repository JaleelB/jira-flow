import { containsManagedBlock, hasValidManagedMarkers } from "./hook-markers";

/**
 * Hook analysis (ADR-0005, architecture §16, VS-1 subset).
 *
 * Classification for the `commit-msg` hook:
 *
 *  - missing     file does not exist                 → Strategy A (owned)
 *  - owned       valid JiraFlow managed markers      → idempotent reuse
 *  - conflict    foreign hook or damaged markers     → refuse (HOOK_CONFLICT)
 *
 * Composition strategies B-D are E4; VS-1 refuses everything that is not
 * missing or clearly owned.
 */

export type HookAnalysis =
  | { status: "missing" }
  | { status: "owned"; content: string }
  | { status: "conflict"; content: string; reason: string };

export function analyzeCommitMsgHook(content: string | null): HookAnalysis {
  if (content === null) {
    return { status: "missing" };
  }

  if (containsManagedBlock(content)) {
    if (hasValidManagedMarkers(content)) {
      return { status: "owned", content };
    }
    return {
      status: "conflict",
      content,
      reason: "JiraFlow markers are present but damaged or duplicated",
    };
  }

  return {
    status: "conflict",
    content,
    reason: "an existing commit-msg hook is present and is not owned by JiraFlow",
  };
}
