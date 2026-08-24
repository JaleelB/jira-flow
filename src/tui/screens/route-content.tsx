import type { DoctorCheckResult, DoctorResult } from "../../application/models/doctor-result";
import type {
  RepositoryListView,
  RepositorySummary,
} from "../../application/models/repository-summary";
import type { RepositoryStatusView } from "../../application/models/status-view";
import type { GlobalSettings } from "../../application/ports/settings.port";
import type { LegacyInspection } from "../../application/use-cases/inspect-legacy-repository";
import type { ManageConfig } from "../../application/use-cases/manage-config";
import { palette } from "../../ui/theme";
import {
  FieldRow,
  Panel,
  StateMessage,
  StatusBadge,
  TicketStub,
  type Tone,
  toneColor,
} from "../components/workbench";
import type { AsyncView } from "../hooks/use-screen-data";
import type { TuiRoute } from "../navigation";

export type RouteData =
  | RepositoryListView
  | RepositoryStatusView
  | DoctorResult
  | GlobalSettings
  | Awaited<ReturnType<ManageConfig["execute"]>>
  | LegacyInspection
  | null;

export function RouteContent({
  route,
  view,
  compact,
  selectedRepository,
  mode,
  setupOverrides,
}: {
  route: TuiRoute;
  view: AsyncView<RouteData>;
  compact: boolean;
  selectedRepository: number;
  mode: "hybrid" | "branch" | "manual";
  setupOverrides: Record<string, string>;
}) {
  if (view.status === "loading") {
    return (
      <StateMessage
        title="Reading local state…"
        detail="Git remains the repository authority."
        tone="ticket"
      />
    );
  }
  if (view.status === "error") {
    return <StateMessage title="This view could not be loaded" detail={view.message} tone="fail" />;
  }

  const data = view.data;
  switch (route.name) {
    case "empty-state":
      return <EmptyState />;
    case "unconfigured-repo":
      return <UnconfiguredRepository repoPath={route.repoPath} />;
    case "global-dashboard":
      return (
        <Dashboard
          data={data as RepositoryListView}
          selected={selectedRepository}
          compact={compact}
        />
      );
    case "repository-overview":
      return <RepositoryWorkbench status={data as RepositoryStatusView} compact={compact} />;
    case "setup":
      return (
        <Setup repoPath={route.repoPath} legacy={data as LegacyInspection} compact={compact} />
      );
    case "setup-customization":
      return <SetupCustomization mode={mode} overrides={setupOverrides} compact={compact} />;
    case "link-issue":
      return <LinkIssue status={data as RepositoryStatusView} />;
    case "mode-selection":
      return <ModeSelection status={data as RepositoryStatusView} compact={compact} />;
    case "workflow-settings":
      return <WorkflowSettings data={data as Awaited<ReturnType<ManageConfig["execute"]>>} />;
    case "pr-title":
      return <PrTitle status={data as RepositoryStatusView} />;
    case "doctor":
      return <Doctor data={data as DoctorResult} compact={compact} />;
    case "global-settings":
      return <Settings data={data as GlobalSettings} compact={compact} />;
    case "missing-repository":
      return <MissingRepository repoPath={route.repoPath} />;
    case "remove-confirmation":
      return <RemoveConfirmation status={data as RepositoryStatusView} />;
  }
}

function EmptyState() {
  return (
    <box
      style={{
        flexGrow: 1,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <box style={{ width: 48, flexDirection: "column" }}>
        <box
          title=" YOUR FIRST TICKET "
          titleColor={palette.ticket}
          style={{
            width: 48,
            height: 5,
            border: true,
            borderStyle: "rounded",
            borderColor: palette.ticket,
            backgroundColor: palette.selection,
            paddingX: 2,
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <text style={{ fg: palette.ticket }}>
            <b>PROJECT-123</b>
          </text>
          <text style={{ fg: palette.mute }}>waiting for a repository</text>
        </box>
        <text> </text>
        <text style={{ fg: palette.ink }}>
          <b>No repositories are configured yet</b>
        </text>
        <text style={{ fg: palette.mute }}>Open a Git repository, then run:</text>
        <text style={{ fg: palette.info }}> jira-flow init</text>
      </box>
    </box>
  );
}

function UnconfiguredRepository({ repoPath }: { repoPath: string }) {
  return (
    <box style={{ flexGrow: 1, padding: 2, flexDirection: "column" }}>
      <Panel title="Git repository detected" tone="info">
        <text style={{ fg: palette.info }}>{repoPath}</text>
        <text> </text>
        <text style={{ fg: palette.ink }}>
          <b>JiraFlow is not configured here.</b>
        </text>
        <text style={{ fg: palette.mute }}>
          Setup adds local config and a safe commit-msg hook.
        </text>
      </Panel>
    </box>
  );
}

function Dashboard({
  data,
  selected,
  compact,
}: {
  data: RepositoryListView;
  selected: number;
  compact: boolean;
}) {
  if (data.repositories.length === 0) {
    return (
      <StateMessage
        title="No repositories registered"
        detail="Press A for setup instructions, or launch JiraFlow inside a Git repository."
      />
    );
  }
  return (
    <box style={{ flexGrow: 1, padding: compact ? 1 : 2, flexDirection: "column" }}>
      <box style={{ flexDirection: "row", marginBottom: 1 }}>
        <text style={{ fg: palette.mute, flexGrow: 1 }}>
          REPOSITORIES {data.repositories.length}
        </text>
        <text style={{ fg: palette.mute }}>↑↓ select · Enter open</text>
      </box>
      {data.repositories.map((repository, index) => (
        <RepositoryRow
          key={repository.id}
          repository={repository}
          selected={index === selected}
          compact={compact}
        />
      ))}
    </box>
  );
}

function RepositoryRow({
  repository,
  selected,
  compact,
}: {
  repository: RepositorySummary;
  selected: boolean;
  compact: boolean;
}) {
  return (
    <box
      style={{
        height: compact ? 2 : 3,
        paddingX: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: selected ? palette.selection : palette.surface,
        border: selected ? ["left"] : false,
        borderColor: palette.ticket,
      }}
    >
      <text style={{ fg: selected ? palette.ticket : palette.mute, width: 3 }}>
        {selected ? "◆" : "·"}
      </text>
      <box style={{ flexGrow: 1, flexDirection: "column" }}>
        <text style={{ fg: palette.ink, truncate: true }}>
          <b>{repository.displayName}</b>
        </text>
        {!compact ? (
          <text style={{ fg: palette.mute, truncate: true }}>{repository.path}</text>
        ) : null}
      </box>
      {!compact ? (
        <text style={{ fg: palette.mute, width: 12 }}>{repository.mode ?? "unconfigured"}</text>
      ) : null}
      <text
        style={{
          fg: repository.activeIssue ? palette.ticket : palette.mute,
          width: compact ? 12 : 14,
        }}
      >
        {repository.activeIssue ?? "no issue"}
      </text>
      <StatusBadge label={repository.health} tone={healthTone(repository.health)} />
    </box>
  );
}

function RepositoryWorkbench({
  status,
  compact,
}: {
  status: RepositoryStatusView;
  compact: boolean;
}) {
  const workflow = (
    <Panel title="Workflow" width={compact ? "100%" : "44%"} flexGrow={compact ? 1 : undefined}>
      <FieldRow
        label="JiraFlow"
        value={status.enabled ? "Enabled" : "Disabled"}
        tone={status.enabled ? "ok" : "warn"}
        compact
      />
      <FieldRow label="Linking mode" value={capitalize(status.mode)} compact />
      <FieldRow label="Commit format" value={status.commitFormat} compact />
      <FieldRow
        label="Hook"
        value={integrationLabel(status)}
        tone={integrationTone(status)}
        compact
      />
    </Panel>
  );
  const repository = (
    <Panel title="Repository" flexGrow={1}>
      <FieldRow label="Name" value={status.repoName} compact />
      <FieldRow label="Branch" value={status.branch ?? "detached HEAD"} tone="info" compact />
      <FieldRow label="Branch issue" value={status.branchIssue ?? "none"} compact />
      <FieldRow label="Saved issue" value={status.linkedIssue ?? "none"} compact />
      <FieldRow label="Issue pattern" value={status.issuePattern} compact />
    </Panel>
  );
  return (
    <box style={{ flexGrow: 1, paddingX: compact ? 1 : 2, paddingY: 1, flexDirection: "column" }}>
      <TicketStub
        issue={status.activeIssue?.key ?? null}
        source={status.activeIssue?.source}
        enabled={status.enabled}
      />
      <text style={{ fg: palette.mute }}>
        {status.branch ?? "detached HEAD"} <span fg={palette.rule}>──▶</span>{" "}
        {status.activeIssue?.key ?? "no issue"} <span fg={palette.rule}>──▶</span> next commit
      </text>
      <box style={{ flexGrow: 1, flexDirection: compact ? "column" : "row", gap: 1 }}>
        {workflow}
        {repository}
      </box>
    </box>
  );
}

function Setup({
  repoPath,
  legacy,
  compact,
}: {
  repoPath: string;
  legacy: LegacyInspection;
  compact: boolean;
}) {
  const legacyTone: Tone = legacy.detected ? (legacy.eligible ? "warn" : "fail") : "ok";
  return (
    <box
      style={{
        flexGrow: 1,
        padding: compact ? 1 : 2,
        flexDirection: compact ? "column" : "row",
        gap: 1,
      }}
    >
      <Panel title="Installation plan" flexGrow={1} tone="ticket">
        <FieldRow label="Repository" value={repoPath} tone="info" compact />
        <FieldRow label="Linking mode" value="Hybrid" compact />
        <FieldRow label="Issue keys" value="ABC-123 style" compact />
        <FieldRow label="Git hook" value="commit-msg only" compact />
        <FieldRow label="Reference" value="Footer" compact />
      </Panel>
      <Panel title="Safety check" flexGrow={1} tone={legacyTone}>
        <StatusBadge
          label={legacy.detected ? (legacy.eligible ? "migration ready" : "blocked") : "clear"}
          tone={legacyTone}
        />
        <text> </text>
        <text style={{ fg: palette.mute }}>
          {legacy.detected
            ? legacy.eligible
              ? "A proven JiraFlow v0.5 integration will be migrated safely."
              : "Hook ownership is ambiguous. Setup will not remove unknown code."
            : "No legacy JiraFlow hooks were detected."}
        </text>
      </Panel>
    </box>
  );
}

function SetupCustomization({
  mode,
  overrides,
  compact,
}: {
  mode: string;
  overrides: Record<string, string>;
  compact: boolean;
}) {
  return (
    <box style={{ flexGrow: 1, padding: 2, flexDirection: "column", gap: 1 }}>
      <Panel title="Linking mode" tone="ticket">
        <ModeCards active={mode} compact={compact} />
      </Panel>
      <Panel title="Staged repository overrides">
        {Object.keys(overrides).length === 0 ? (
          <text style={{ fg: palette.mute }}>
            Using global defaults. Enter a key=value below to stage an override.
          </text>
        ) : (
          Object.entries(overrides).map(([key, value]) => (
            <FieldRow key={key} label={key} value={value} />
          ))
        )}
      </Panel>
    </box>
  );
}

function LinkIssue({ status }: { status: RepositoryStatusView }) {
  return (
    <box style={{ flexGrow: 1, padding: 2, flexDirection: "column", gap: 1 }}>
      <TicketStub issue={status.linkedIssue} source={status.linkedIssue ? "saved link" : null} />
      <Panel title="Link a local issue" tone="ticket">
        <text style={{ fg: palette.ink }}>
          Enter a Jira key and an optional cached story title.
        </text>
        <text style={{ fg: palette.mute }}>
          Example: <span fg={palette.info}>OPS-42 :: Improve login recovery</span>
        </text>
      </Panel>
    </box>
  );
}

function ModeSelection({ status, compact }: { status: RepositoryStatusView; compact: boolean }) {
  return (
    <box style={{ flexGrow: 1, padding: compact ? 1 : 2, flexDirection: "column", gap: 1 }}>
      <ModeCards active={status.mode} compact={compact} />
      <text style={{ fg: palette.mute }}>Changing mode never deletes the saved linked issue.</text>
    </box>
  );
}

function ModeCards({ active, compact }: { active: string; compact: boolean }) {
  const modes = [
    ["1", "hybrid", "Saved link first, then branch"],
    ["2", "branch", "Derive the issue from the branch"],
    ["3", "manual", "Use only the saved linked issue"],
  ] as const;
  return (
    <box style={{ flexDirection: compact ? "column" : "row", gap: 1, width: "100%" }}>
      {modes.map(([key, mode, description]) => {
        const selected = active === mode;
        return (
          <box
            key={mode}
            style={{
              height: 4,
              flexGrow: 1,
              flexDirection: "column",
              paddingX: 1,
              border: true,
              borderColor: selected ? palette.ticket : palette.rule,
              backgroundColor: selected ? palette.selection : palette.panel,
            }}
          >
            <text style={{ fg: selected ? palette.ticket : palette.ink }}>
              <b>
                {key} {capitalize(mode)}
              </b>
            </text>
            <text style={{ fg: palette.mute }}>{description}</text>
          </box>
        );
      })}
    </box>
  );
}

function WorkflowSettings({ data }: { data: Awaited<ReturnType<ManageConfig["execute"]>> }) {
  const rows: Array<[string, string, string]> = [
    ["Issue pattern", data.effective.issuePattern, data.sources.issuePattern],
    ["Commit format", data.effective.commitFormat, data.sources.commitFormat],
    ["PR title", data.effective.prTitleTemplate, data.sources.prTitleTemplate],
    ["Date format", data.effective.dateFormat, data.sources.dateFormat],
  ];
  return (
    <box style={{ flexGrow: 1, padding: 2, flexDirection: "column" }}>
      <Panel title="Effective repository workflow">
        {rows.map(([label, value, source]) => (
          <box key={label} style={{ flexDirection: "row", height: 1 }}>
            <text style={{ fg: palette.mute, width: 17 }}>{label}</text>
            <text style={{ fg: palette.ink, flexGrow: 1, truncate: true }}>{value}</text>
            <text style={{ fg: source === "repo" ? palette.ticket : palette.mute }}>{source}</text>
          </box>
        ))}
      </Panel>
    </box>
  );
}

function PrTitle({ status }: { status: RepositoryStatusView }) {
  return (
    <box style={{ flexGrow: 1, padding: 2, flexDirection: "column", gap: 1 }}>
      <TicketStub issue={status.activeIssue?.key ?? null} source={status.activeIssue?.source} />
      <Panel title="Local title generator" tone="ticket">
        <text style={{ fg: palette.ink }}>
          Type a story title to preview it. Press C to generate and copy.
        </text>
        <text style={{ fg: palette.mute }}>No Jira API · No GitHub API · No gh dependency</text>
      </Panel>
    </box>
  );
}

function Doctor({ data, compact }: { data: DoctorResult; compact: boolean }) {
  const attention = data.checks.filter((check) => check.status !== "pass");
  const passing = data.checks.filter((check) => check.status === "pass");
  const visibleChecks = attention.length > 0 ? attention : passing;
  const overallTone: Tone =
    data.overall === "healthy" ? "ok" : data.overall === "warning" ? "warn" : "fail";
  return (
    <box
      style={{
        flexGrow: 1,
        padding: compact ? 1 : 2,
        flexDirection: compact ? "column" : "row",
        gap: 1,
      }}
    >
      <Panel title="Diagnosis" tone={overallTone} width={compact ? "100%" : "38%"}>
        <StatusBadge label={data.overall} tone={overallTone} />
        <text> </text>
        <text style={{ fg: palette.ink }}>
          <b>
            {attention.length === 0
              ? "Everything is connected"
              : `${attention.length} item${attention.length === 1 ? "" : "s"} need attention`}
          </b>
        </text>
        <text style={{ fg: palette.mute }}>
          {passing.length} of {data.checks.length} checks passed.
        </text>
        {data.repoPath ? (
          <text style={{ fg: palette.info, marginTop: 1 }}>{data.repoPath}</text>
        ) : null}
      </Panel>
      <Panel
        title={`${attention.length > 0 ? "Needs attention" : "Checks"} · ${visibleChecks.length}`}
        flexGrow={1}
      >
        <scrollbox
          focused
          style={{
            flexGrow: 1,
            width: "100%",
            scrollX: false,
            scrollY: true,
            stickyScroll: false,
            rootOptions: { backgroundColor: palette.panel },
            wrapperOptions: { backgroundColor: palette.panel },
            viewportOptions: { backgroundColor: palette.panel },
            contentOptions: {
              flexDirection: "column",
              paddingRight: 1,
              backgroundColor: palette.panel,
            },
            verticalScrollbarOptions: {
              showArrows: true,
              trackOptions: {
                foregroundColor: palette.info,
                backgroundColor: palette.surface,
              },
              arrowOptions: {
                foregroundColor: palette.info,
                backgroundColor: palette.panel,
              },
            },
          }}
        >
          {visibleChecks.map((check) => (
            <DoctorRow key={check.id} check={check} />
          ))}
          {data.checks.length === 0 ? (
            <text style={{ fg: palette.mute }}>No diagnostic checks returned.</text>
          ) : null}
        </scrollbox>
      </Panel>
    </box>
  );
}

function DoctorRow({ check }: { check: DoctorCheckResult }) {
  const tone: Tone = check.status === "pass" ? "ok" : check.status === "warning" ? "warn" : "fail";
  return (
    <box
      style={{
        flexDirection: "column",
        height: 1 + (check.detail ? 1 : 0) + (check.repairHint ? 1 : 0),
        marginBottom: 1,
      }}
    >
      <text style={{ fg: toneColor(tone) }}>
        {check.status === "pass" ? "✓" : check.status === "warning" ? "!" : "×"}{" "}
        <b>{friendlyCheckName(check.id)}</b>
      </text>
      {check.detail ? <text style={{ fg: palette.mute }}> {check.detail}</text> : null}
      {check.repairHint ? (
        <text style={{ fg: palette.info }}> Next: {check.repairHint}</text>
      ) : null}
    </box>
  );
}

function Settings({ data, compact }: { data: GlobalSettings; compact: boolean }) {
  const rows: Array<[string, string]> = [
    ["Default mode", data.defaultMode],
    ["Issue pattern", data.defaultIssuePattern],
    ["Commit format", data.defaultCommitFormat],
    ["PR title", data.defaultPrTitleTemplate],
    ["Date format", data.defaultDateFormat],
    ["Copy PR title", data.copyPrTitleToClipboard ? "Yes" : "No"],
    ["Theme", data.theme],
  ];
  return (
    <box style={{ flexGrow: 1, padding: compact ? 1 : 2, flexDirection: "column" }}>
      <Panel title="Defaults for new repositories">
        {rows.map(([label, value]) => (
          <FieldRow key={label} label={label} value={String(value)} compact={compact} />
        ))}
      </Panel>
    </box>
  );
}

function MissingRepository({ repoPath }: { repoPath: string }) {
  return (
    <box style={{ flexGrow: 1, padding: 2, flexDirection: "column" }}>
      <Panel title="Repository path is missing" tone="warn">
        <text style={{ fg: palette.warn }}>
          <b>The registered location is no longer available.</b>
        </text>
        <text style={{ fg: palette.info }}>{repoPath}</text>
        <text> </text>
        <text style={{ fg: palette.mute }}>
          Enter its new path below, or remove only this stale dashboard entry.
        </text>
      </Panel>
    </box>
  );
}

function RemoveConfirmation({ status }: { status: RepositoryStatusView }) {
  return (
    <box style={{ flexGrow: 1, padding: 2, flexDirection: "column" }}>
      <Panel title="Destructive action" tone="fail">
        <text style={{ fg: palette.fail }}>
          <b>Remove JiraFlow from {status.repoName}?</b>
        </text>
        <text style={{ fg: palette.mute }}>{status.repoPath}</text>
        <text> </text>
        <text style={{ fg: palette.ink }}>
          This removes JiraFlow configuration, owned integration, and its registry entry.
        </text>
        <text style={{ fg: palette.ok }}>Foreign hook content will be preserved.</text>
      </Panel>
    </box>
  );
}

function healthTone(health: RepositorySummary["health"]): Tone {
  return health === "healthy"
    ? "ok"
    : health === "warning" || health === "unknown"
      ? "warn"
      : "fail";
}

function integrationLabel(status: RepositoryStatusView): string {
  return status.integration.status === "owned" || status.integration.status === "managed-block"
    ? "Healthy"
    : capitalize(status.integration.status);
}

function integrationTone(status: RepositoryStatusView): Tone {
  return status.integration.status === "owned" || status.integration.status === "managed-block"
    ? "ok"
    : status.integration.status === "missing"
      ? "warn"
      : "fail";
}

function friendlyCheckName(id: string): string {
  const names: Record<string, string> = {
    "git.repository": "Git repository",
    "config.valid": "Repository configuration",
    "worktree.state": "Worktree issue state",
    "registry.sync": "Dashboard registration",
    "hooks.path": "Git hooks directory",
    "legacy.v0.5": "Legacy JiraFlow integration",
    "hooks.integration": "Commit hook integration",
    "hooks.ownership": "Hook ownership",
    "hooks.foreign-preserved": "Foreign hook preservation",
    "binary.reachable": "JiraFlow executable",
    "issue.pattern": "Issue-key pattern",
    "mode.valid": "Linking mode",
    "active-issue.resolve": "Active issue resolution",
  };
  return (
    names[id] ?? id.replaceAll(/[._-]+/g, " ").replace(/^./, (character) => character.toUpperCase())
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
