import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "..");

export interface PlaygroundLayout {
  projectRoot: string;
  root: string;
  repo: string;
  dataDir: string;
  binDir: string;
  launcher: string;
  gitconfig: string;
  mainTs: string;
}

export function playgroundLayout(): PlaygroundLayout {
  const root = join(PROJECT_ROOT, "playground");
  const binDir = join(root, "bin");
  return {
    projectRoot: PROJECT_ROOT,
    root,
    repo: join(root, "repo"),
    dataDir: join(root, "data"),
    binDir,
    launcher: join(binDir, "jira-flow"),
    gitconfig: join(root, "gitconfig"),
    mainTs: join(PROJECT_ROOT, "src", "main.ts"),
  };
}

export function playgroundProcessEnv(layout: PlaygroundLayout): Record<string, string | undefined> {
  return {
    ...process.env,
    JIRAFLOW_DATA_DIR: layout.dataDir,
    PATH: `${layout.binDir}:${process.env.PATH ?? ""}`,
    GIT_CONFIG_GLOBAL: layout.gitconfig,
    GIT_CONFIG_SYSTEM: layout.gitconfig,
    GIT_CONFIG_NOSYSTEM: "1",
  };
}
