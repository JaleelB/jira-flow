import { useKeyboard } from "@opentui/react";
import type { RepositoryStatusView } from "../../application/models/status-view";

/**
 * Repository Overview (product S4, VS-1 reduced to a read-only status
 * screen per DR-0013).
 *
 * All data comes from the `getRepositoryStatus` view model passed in. This
 * component performs no Git execution and no SQLite access (VT-14).
 * `Q` quits.
 */
export function RepositoryOverview({
  status,
  onQuit,
}: {
  status: RepositoryStatusView;
  onQuit: () => void;
}) {
  useKeyboard((key) => {
    if (key.eventType === "release") return;
    const name = key.name.toLowerCase();
    if (name === "q" || name === "escape") {
      onQuit();
    }
  });

  return (
    <box
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%",
        paddingLeft: 2,
        paddingTop: 1,
      }}
    >
      <text>{status.repoName}</text>
      <text>{status.repoPath}</text>
      <text> </text>
      <text>Status</text>
      <text>─────────────────────────</text>
      <text>JiraFlow {status.enabled ? "Enabled" : "Disabled"}</text>
      <text>Mode {status.mode}</text>
      <text>Active issue {status.activeIssue?.key ?? "none"}</text>
      <text>Active source {status.activeIssue?.source ?? "none"}</text>
      <text>Current branch {status.branch ?? "(detached HEAD)"}</text>
      <text>Integration {integrationLabel(status)}</text>
      <text> </text>
      <text>Workflow</text>
      <text>─────────────────────────</text>
      <text>Commit format {status.commitFormat}</text>
      <text>Linked issue {status.linkedIssue ?? "none"}</text>
      <text>Branch issue {status.branchIssue ?? "none"}</text>
      <text> </text>
      <text>[Q] Quit</text>
    </box>
  );
}

function integrationLabel(status: RepositoryStatusView): string {
  switch (status.integration.status) {
    case "owned":
      return "Healthy";
    case "missing":
      return "Missing";
    case "conflict":
      return "Conflict";
  }
}
