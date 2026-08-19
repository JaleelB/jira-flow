import type { DoctorResult } from "../../application/models/doctor-result";
import type { RepositoryStatusView } from "../../application/models/status-view";
import type { InitializeRepositoryResult } from "../../application/use-cases/initialize-repository";
import { type Ansi, createAnsi } from "./ansi";

/**
 * Human output formatters (architecture §35).
 *
 * Result models stay separate from formatters. Color is TTY-only and is
 * suppressed by NO_COLOR. JSON mode (later) must not call these.
 */

const LABEL_WIDTH = 14;

export function formatRepositoryStatus(
  view: RepositoryStatusView,
  ansi: Ansi = createAnsi(),
): string {
  const active = view.activeIssue?.key ?? "none";
  const activeStyled = view.activeIssue !== null ? ansi.ticket(active) : ansi.mute("none");

  return rail(ansi, [
    `${ansi.bold("jira-flow")}  ${ansi.mute(view.repoName)}`,
    "",
    row(ansi, "JiraFlow", view.enabled ? ansi.ok("enabled") : ansi.fail("disabled")),
    row(ansi, "Mode", capitalize(view.mode)),
    row(ansi, "Active issue", activeStyled),
    row(ansi, "Active source", view.activeIssue?.source ?? "none"),
    row(ansi, "Branch", view.branch ?? "(detached HEAD)"),
    row(ansi, "Branch issue", view.branchIssue ?? "none"),
    row(ansi, "Linked issue", view.linkedIssue ?? "none"),
    row(ansi, "Commit format", view.commitFormat),
    row(ansi, "Integration", integrationValue(ansi, view.integration.status)),
  ]);
}

export function formatInitializeResult(
  result: InitializeRepositoryResult,
  ansi: Ansi = createAnsi(),
): string {
  const title =
    result.outcome === "initialized"
      ? `Initialized JiraFlow for ${result.repoPath}`
      : `JiraFlow is already configured for ${result.repoPath}`;

  const hook =
    result.hook.strategy === "composed"
      ? `Composed commit-msg integration: ${result.hook.hookPath}`
      : result.hook.created
        ? `Installed owned commit-msg integration: ${result.hook.hookPath}`
        : `Owned commit-msg integration verified: ${result.hook.hookPath}`;

  const lines = [ansi.ok(ansi.bold(title)), hook];
  if (result.registryWarning !== undefined) {
    lines.push(ansi.warn(`Warning: ${result.registryWarning}`));
  }
  return rail(ansi, lines);
}

export function formatDoctorResult(result: DoctorResult, ansi: Ansi = createAnsi()): string {
  const overall =
    result.overall === "healthy"
      ? ansi.ok("healthy")
      : result.overall === "warning"
        ? ansi.warn("warning")
        : ansi.fail("broken");

  const lines: string[] = [`${ansi.bold("Doctor")}: ${overall}`];
  if (result.repoPath !== null) {
    lines.push(ansi.mute(result.repoPath));
  }
  lines.push("");
  for (const check of result.checks) {
    const marker =
      check.status === "pass"
        ? ansi.ok("[ok]")
        : check.status === "warning"
          ? ansi.warn("[warn]")
          : ansi.fail("[fail]");
    const detail = check.detail !== undefined ? ansi.mute(`: ${check.detail}`) : "";
    lines.push(`${marker} ${check.id}${detail}`);
  }

  const nextActions = result.checks
    .filter((check) => check.status === "fail" && check.repairHint !== undefined)
    .map((check) => check.repairHint)
    .filter((hint, index, all) => all.indexOf(hint) === index);
  if (nextActions.length > 0) {
    lines.push("");
    lines.push(ansi.bold("Next"));
    for (const action of nextActions) {
      lines.push(action ?? "");
    }
  }
  return rail(ansi, lines);
}

function rail(ansi: Ansi, lines: string[]): string {
  const diamond = ansi.ticket("◆");
  const bar = ansi.mute("│");
  const end = ansi.mute("└");
  const body = lines.map((line, index) => {
    if (index === 0) {
      return `${diamond}  ${line}`;
    }
    return line.length === 0 ? `${bar}` : `${bar}  ${line}`;
  });
  return `${body.join("\n")}\n${end}\n`;
}

function row(ansi: Ansi, label: string, value: string): string {
  const padded = label.padEnd(LABEL_WIDTH);
  return `${ansi.mute(padded)}  ${value}`;
}

function integrationValue(
  ansi: Ansi,
  status: RepositoryStatusView["integration"]["status"],
): string {
  switch (status) {
    case "owned":
    case "managed-block":
      return ansi.ok("healthy");
    case "missing":
      return ansi.warn("missing");
    default:
      return ansi.fail(status);
  }
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0]?.toUpperCase()}${value.slice(1)}`;
}
