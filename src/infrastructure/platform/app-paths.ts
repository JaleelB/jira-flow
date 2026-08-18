import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Platform application-data paths (architecture §21).
 *
 * The JiraFlow SQLite database lives in the platform data directory:
 *
 *   macOS:   ~/Library/Application Support/JiraFlow/jira-flow.db
 *   Windows: %LOCALAPPDATA%\JiraFlow\jira-flow.db
 *   Linux:   $XDG_DATA_HOME/jira-flow/jira-flow.db
 *            (fallback ~/.local/share/jira-flow/jira-flow.db)
 *
 * `JIRAFLOW_DATA_DIR` overrides the directory for tests and diagnostics so
 * isolated runs never touch a developer's real data location (DR-0015).
 */
export function getAppDataDir(): string {
  const override = process.env.JIRAFLOW_DATA_DIR;
  if (override && override.trim() !== "") {
    return override;
  }

  switch (process.platform) {
    case "darwin":
      return join(homedir(), "Library", "Application Support", "JiraFlow");
    case "win32":
      return join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "JiraFlow");
    default:
      return getXdgDataDir();
  }
}

function getXdgDataDir(): string {
  const xdg = process.env.XDG_DATA_HOME;
  if (xdg && xdg.trim() !== "") {
    return join(xdg, "jira-flow");
  }
  return join(homedir(), ".local", "share", "jira-flow");
}

/** Database file name inside the app data directory. */
export function getDatabasePath(dataDir: string = getAppDataDir()): string {
  return join(dataDir, "jira-flow.db");
}
