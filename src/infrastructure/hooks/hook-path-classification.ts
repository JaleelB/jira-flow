import { isAbsolute, relative, resolve, sep } from "node:path";
import type { GitRepositoryContext, HooksContext } from "../../application/ports/git.port";
import { canonicalizePath } from "../platform/path-identity";

/**
 * Classifies the effective hooks directory for hook-safety decisions
 * (architecture §8.4 / §17, E2-3 / E4-8).
 *
 * `shared-external` is anything Git would run from outside this repository's
 * worktree root and common Git dir (global/system hooksPath, or a local
 * absolute path that points elsewhere). JiraFlow must not silently mutate it.
 */

export type HooksPathClass = "repo-default" | "repo-local-custom" | "shared-external";

export function classifyHooksPath(repo: GitRepositoryContext, hooks: HooksContext): HooksPathClass {
  if (hooks.hooksPathOrigin === "global" || hooks.hooksPathOrigin === "system") {
    return "shared-external";
  }

  if (hooks.hooksPathOrigin === "unknown") {
    return "repo-default";
  }

  if (isInside(hooks.hooksDir, repo.root) || isInside(hooks.hooksDir, repo.commonGitDir)) {
    return "repo-local-custom";
  }

  return "shared-external";
}

function isInside(target: string, root: string): boolean {
  const resolvedTarget = canonicalizePath(resolve(target));
  const resolvedRoot = canonicalizePath(resolve(root));
  if (resolvedTarget === resolvedRoot) {
    return true;
  }
  const rel = relative(resolvedRoot, resolvedTarget);
  return rel.length > 0 && !rel.startsWith(`..${sep}`) && !rel.startsWith("..") && !isAbsolute(rel);
}
