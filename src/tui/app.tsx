import { useKeyboard } from "@opentui/react";
import type { StartupContext } from "../application/use-cases/get-startup-context";
import { type TuiServices, TuiServicesContext } from "./app-context";
import { RepositoryOverview } from "./screens/repository-overview";

/**
 * TUI root (architecture §27-28, VS-1 single-screen subset).
 *
 * Routes the startup context to one screen. The full S1-S14 screen map and
 * navigation reducer arrive with E10.
 */
export function App({
  services,
  initialContext,
  onQuit,
}: {
  services: TuiServices;
  initialContext: StartupContext;
  onQuit: () => void;
}) {
  return (
    <TuiServicesContext.Provider value={services}>
      {renderRoute(initialContext, onQuit)}
    </TuiServicesContext.Provider>
  );
}

function renderRoute(context: StartupContext, onQuit: () => void) {
  switch (context.kind) {
    case "repository-overview":
      return <RepositoryOverview status={context.status} onQuit={onQuit} />;
    case "unconfigured-repo":
      return <UnconfiguredRepoStub repoPath={context.repoPath} onQuit={onQuit} />;
    case "empty-state":
      return <EmptyStateStub onQuit={onQuit} />;
  }
}

/** VS-1 stub; replaced by the full Unconfigured Repository screen (E10). */
function UnconfiguredRepoStub({ repoPath, onQuit }: { repoPath: string; onQuit: () => void }) {
  useKeyboard((key) => {
    if (key.eventType === "release") return;
    if (key.name.toLowerCase() === "q") onQuit();
  });

  return (
    <box
      style={{
        flexDirection: "column",
        paddingLeft: 2,
        paddingTop: 1,
        width: "100%",
        height: "100%",
      }}
    >
      <text>JiraFlow</text>
      <text> </text>
      <text>This repository is not configured for JiraFlow:</text>
      <text>{repoPath}</text>
      <text> </text>
      <text>Run `jira-flow init --yes` to set it up.</text>
      <text> </text>
      <text>[Q] Quit</text>
    </box>
  );
}

/** VS-1 stub; replaced by Empty State / Global Dashboard (E10). */
function EmptyStateStub({ onQuit }: { onQuit: () => void }) {
  useKeyboard((key) => {
    if (key.eventType === "release") return;
    if (key.name.toLowerCase() === "q") onQuit();
  });

  return (
    <box
      style={{
        flexDirection: "column",
        paddingLeft: 2,
        paddingTop: 1,
        width: "100%",
        height: "100%",
      }}
    >
      <text>JiraFlow</text>
      <text> </text>
      <text>Not inside a Git repository.</text>
      <text>Run `jira-flow init --yes` inside a repository to begin.</text>
      <text> </text>
      <text>[Q] Quit</text>
    </box>
  );
}
