import type { DoctorResult } from "../../application/models/doctor-result";
import type { RepositoryStatusView } from "../../application/models/status-view";

export function formatDoctorJson(result: DoctorResult): string {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      repoPath: result.repoPath,
      overall: result.overall,
      checks: result.checks.map((check) => ({
        id: check.id,
        status: check.status,
        ...(check.detail !== undefined ? { detail: check.detail } : {}),
        ...(check.repairHint !== undefined ? { repairHint: check.repairHint } : {}),
      })),
    },
    null,
    2,
  )}\n`;
}

export function formatStatusJson(view: RepositoryStatusView): string {
  return `${JSON.stringify({ schemaVersion: 1, ...view }, null, 2)}\n`;
}
