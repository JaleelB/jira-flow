import { useKeyboard } from "@opentui/react";
import type { RepositoryStatusView } from "../../application/models/status-view";
import { palette } from "../../ui/theme";

/**
 * Repository Overview (product S4, VS-1 reduced).
 *
 * Visual identity: dark ticket-desk. The active Jira key is the only
 * loud element — a brass stub. Everything else is labeled mute ink.
 * Data comes from `getRepositoryStatus` only (VT-14). Q quits.
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

  const issue = status.activeIssue?.key ?? "none";

  return (
    <box
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: palette.surface,
        paddingLeft: 2,
        paddingTop: 1,
        paddingRight: 2,
        gap: 0,
      }}
    >
      <text style={{ fg: palette.mute }}>JIRAFLOW</text>
      <text style={{ fg: palette.ink }}>{status.repoName}</text>
      <text style={{ fg: palette.mute }}>{status.repoPath}</text>
      <text> </text>
      <box
        style={{
          border: true,
          borderStyle: "rounded",
          borderColor: status.activeIssue !== null ? palette.ticket : palette.rule,
          paddingLeft: 1,
          paddingRight: 1,
          width: 28,
          height: 3,
        }}
      >
        <text
          style={{
            fg: status.activeIssue !== null ? palette.ticket : palette.mute,
          }}
        >
          {issue}
        </text>
      </box>
      <text style={{ fg: palette.mute }}>
        {status.activeIssue !== null ? `from ${status.activeIssue.source}` : "no active issue"}
      </text>
      <text> </text>
      <text style={{ fg: palette.mute }}>Status</text>
      <Field
        label="JiraFlow"
        value={status.enabled ? "Enabled" : "Disabled"}
        tone={status.enabled ? "ok" : "fail"}
      />
      <Field label="Mode" value={status.mode} />
      <Field label="Current branch" value={status.branch ?? "(detached HEAD)"} />
      <Field label="Integration" value={integrationLabel(status)} tone={integrationTone(status)} />
      <text> </text>
      <text style={{ fg: palette.mute }}>Workflow</text>
      <Field label="Commit format" value={status.commitFormat} />
      <Field label="Linked issue" value={status.linkedIssue ?? "none"} />
      <Field label="Branch issue" value={status.branchIssue ?? "none"} />
      <text> </text>
      <text style={{ fg: palette.mute }}>[Q] Quit</text>
    </box>
  );
}

function Field({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: string;
  tone?: "ink" | "ok" | "fail" | "warn";
}) {
  const color =
    tone === "ok"
      ? palette.ok
      : tone === "fail"
        ? palette.fail
        : tone === "warn"
          ? palette.warn
          : palette.ink;
  return (
    <box style={{ flexDirection: "row", width: "100%" }}>
      <text style={{ fg: palette.mute, width: 18 }}>{label}</text>
      <text style={{ fg: color }}>{value}</text>
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

function integrationTone(status: RepositoryStatusView): "ok" | "warn" | "fail" {
  switch (status.integration.status) {
    case "owned":
      return "ok";
    case "missing":
      return "warn";
    case "conflict":
      return "fail";
  }
}
