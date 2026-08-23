import { join } from "node:path";
import { classifyLegacyHook, type LegacyHookName } from "../../domain/legacy-hook";
import type { GitPort, GitRepositoryContext } from "../ports/git.port";
import type { LegacyHookSnapshot, LegacyHooksPort } from "../ports/legacy-hooks.port";

export interface LegacyInspection {
  repoPath: string;
  hooksDir: string;
  detected: boolean;
  eligible: boolean;
  defaultMode: "hybrid";
  changes: string[];
  legacyHooks: LegacyHookName[];
  ambiguousPaths: string[];
  snapshot: LegacyHookSnapshot;
}

export class InspectLegacyRepository {
  constructor(private readonly deps: { git: GitPort; legacyHooks: LegacyHooksPort }) {}

  async execute(
    input: { path: string } | { repo: GitRepositoryContext },
  ): Promise<LegacyInspection> {
    const repo = "repo" in input ? input.repo : await this.deps.git.discoverRepository(input.path);
    const hooks = await this.deps.git.resolveHooks(repo);
    const snapshot = await this.deps.legacyHooks.capture(hooks.hooksDir);
    const classifications = (["commit-msg", "post-checkout"] as const).map((name) =>
      classifyLegacyHook(name, snapshot.hooks[name]),
    );
    const legacyHooks = classifications
      .filter((item) => item.kind === "legacy-wrapper" || item.kind === "legacy-helper-symlink")
      .map((item) => item.hookName);
    const ambiguousPaths = classifications
      .filter((item) => item.kind === "unknown")
      .map((item) => join(hooks.hooksDir, item.hookName));
    return {
      repoPath: repo.root,
      hooksDir: hooks.hooksDir,
      detected: legacyHooks.length > 0,
      eligible: legacyHooks.length > 0 && ambiguousPaths.length === 0,
      defaultMode: "hybrid",
      changes: [
        ...legacyHooks.map((name) => `remove recognized legacy ${name}`),
        "install the owned v1 commit-msg integration",
        "write enabled=true and mode=hybrid repository configuration",
        "register the repository in the v1 dashboard",
      ],
      legacyHooks,
      ambiguousPaths,
      snapshot,
    };
  }
}
