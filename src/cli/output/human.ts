import type { DoctorResult } from "../../application/models/doctor-result";
import type { RepositoryStatusView } from "../../application/models/status-view";
import type { InitializeRepositoryResult } from "../../application/use-cases/initialize-repository";

/**
 * Human output formatters (architecture §35).
 *
 * Result models stay separate from formatters. No color decoration in VS-1.
 */

export function formatRepositoryStatus(view: RepositoryStatusView): string {
  const lines = [
    `JiraFlow: ${view.enabled ? "enabled" : "disabled"}`,
    `Repository: ${view.repoName}`,
    `Mode: ${capitalize(view.mode)}`,
    `Branch: ${view.branch ?? "(detached HEAD)"}`,
    `Branch issue: ${view.branchIssue ?? "none"}`,
    `Linked issue: ${view.linkedIssue ?? "none"}`,
    `Active issue: ${view.activeIssue?.key ?? "none"}`,
    `Active source: ${view.activeIssue?.source ?? "none"}`,
    `Commit format: ${view.commitFormat}`,
    `Integration: ${formatIntegration(view.integration.status)}`,
  ];
  return `${lines.join("\n")}\n`;
}

function formatIntegration(status: RepositoryStatusView["integration"]["status"]): string {
  switch (status) {
    case "owned":
      return "healthy";
    case "missing":
      return "missing";
    case "conflict":
      return "conflict";
  }
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0]?.toUpperCase()}${value.slice(1)}`;
}

export function formatInitializeResult(result: InitializeRepositoryResult): string {
  const lines: string[] = [];
  if (result.outcome === "initialized") {
    lines.push(`Initialized JiraFlow for ${result.repoPath}`);
  } else {
    lines.push(`JiraFlow is already configured for ${result.repoPath}`);
  }
  lines.push(
    result.hook.created
      ? `Installed owned commit-msg integration: ${result.hook.hookPath}`
      : `Owned commit-msg integration verified: ${result.hook.hookPath}`,
  );
  if (result.registryWarning !== undefined) {
    lines.push(`Warning: ${result.registryWarning}`);
  }
  return `${lines.join("\n")}\n`;
}

export function formatDoctorResult(result: DoctorResult): string {
  const lines: string[] = [];
  lines.push(`Doctor: ${result.overall}`);
  if (result.repoPath !== null) {
    lines.push(`Repository: ${result.repoPath}`);
  }
  for (const check of result.checks) {
    const marker =
      check.status === "pass" ? "[ok]" : check.status === "warning" ? "[warn]" : "[fail]";
    lines.push(`${marker} ${check.id}${check.detail !== undefined ? `: ${check.detail}` : ""}`);
  }
  return `${lines.join("\n")}\n`;
}
