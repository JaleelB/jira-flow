import { GetRepositoryStatus } from "../application/use-cases/get-repository-status";
import { GetStartupContext } from "../application/use-cases/get-startup-context";
import { GitAdapter } from "../infrastructure/git/git-adapter";
import { GitConfigStore } from "../infrastructure/git/git-config-store";
import { GitRunner } from "../infrastructure/git/git-runner";
import { HookManager } from "../infrastructure/hooks/hook-manager";
import { WorktreeStateStore } from "../infrastructure/state/worktree-state-store";

/**
 * TUI composition root (architecture §33).
 *
 * VS-1's overview screen consumes the same use cases as the CLI. The SQLite
 * registry joins the TUI container with the dashboard epic (E8/E10); the
 * commit hook keeps its own root.
 */

export function createTuiContainer(): {
  getStartupContext: GetStartupContext;
  getRepositoryStatus: GetRepositoryStatus;
} {
  const runner = new GitRunner();
  const git = new GitAdapter(runner);
  const config = new GitConfigStore(runner);
  const state = new WorktreeStateStore(runner);
  const hooks = new HookManager(git, runner);

  const getRepositoryStatus = new GetRepositoryStatus({ git, config, state, hooks });
  const getStartupContext = new GetStartupContext({ git, getRepositoryStatus });

  return { getStartupContext, getRepositoryStatus };
}
