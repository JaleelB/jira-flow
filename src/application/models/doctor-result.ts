/**
 * Doctor result model (VS1-9 subset of architecture §41).
 *
 * Doctor checks never mutate; repair actions are separate (E6).
 */

export type DoctorCheckStatus = "pass" | "warning" | "fail";

export interface DoctorCheckResult {
  id: string;
  status: DoctorCheckStatus;
  detail?: string;
  repairHint?: string;
}

export type DoctorOverall = "healthy" | "warning" | "broken";

export interface DoctorResult {
  repoPath: string | null;
  checks: DoctorCheckResult[];
  overall: DoctorOverall;
}
