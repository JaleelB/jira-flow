import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Isolated Git environment for tests (DR-0015, architecture §42.3).
 *
 * Points GIT_CONFIG_GLOBAL and GIT_CONFIG_SYSTEM at empty fixture files so
 * no test can read or write the developer's real global/system Git config.
 */
export interface GitEnvironment {
  /** Environment map safe to pass to Git and JiraFlow subprocesses. */
  readonly env: Record<string, string | undefined>;
  /** Directory holding the fixture config files. */
  readonly dir: string;
  /** Removes the fixture directory. */
  dispose(): void;
}

export function createIsolatedGitEnvironment(): GitEnvironment {
  const dir = mkdtempSync(join(tmpdir(), "jiraflow-git-env-"));
  const globalConfig = join(dir, "gitconfig");
  writeFileSync(globalConfig, "", "utf8");

  const env: Record<string, string | undefined> = {
    ...process.env,
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_SYSTEM: globalConfig,
    GIT_CONFIG_NOSYSTEM: "1",
  };

  return {
    env,
    dir,
    dispose(): void {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
