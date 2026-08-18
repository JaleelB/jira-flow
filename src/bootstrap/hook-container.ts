import { ProcessCommitMessage } from "../application/use-cases/process-commit-message";
import { SystemFilesystem } from "../infrastructure/filesystem/system-filesystem";
import { GitAdapter } from "../infrastructure/git/git-adapter";
import { GitConfigStore } from "../infrastructure/git/git-config-store";
import { GitRunner } from "../infrastructure/git/git-runner";
import { WorktreeStateStore } from "../infrastructure/state/worktree-state-store";

/**
 * Hook composition root (architecture §33).
 *
 * Intentionally excludes SQLite, OpenTUI, clipboard, and the global
 * registry. The commit-msg fast path must stay import-light and must never
 * transitively load `bun:sqlite` or any OpenTUI module (ADR-0004/O-03,
 * ADR-0002/O-02). This exclusion is asserted by an import-boundary test.
 */

export function createHookContainer(): {
  processCommitMessage: ProcessCommitMessage;
} {
  const runner = new GitRunner();
  const git = new GitAdapter(runner);
  const config = new GitConfigStore(runner);
  const state = new WorktreeStateStore(runner);
  const filesystem = new SystemFilesystem();

  const processCommitMessage = new ProcessCommitMessage({
    git,
    config,
    state,
    filesystem,
  });

  return { processCommitMessage };
}
