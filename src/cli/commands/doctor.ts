import type { Command } from "commander";
import type { RunDoctor } from "../../application/use-cases/run-doctor";
import { formatDoctorResult } from "../output/human";

/**
 * `jira-flow doctor` — read-only health checks (product §6.11 reduced).
 * `--repair` and `--json` arrive with E6 (DR-0013); plain doctor never
 * mutates state.
 */
export function registerDoctorCommand(program: Command, services: { runDoctor: RunDoctor }): void {
  program
    .command("doctor")
    .description("check JiraFlow health for the current repository")
    .argument("[path]", "repository path (default: current directory)")
    .action(async (path: string | undefined) => {
      const result = await services.runDoctor.execute({ path: path ?? process.cwd() });
      process.stdout.write(formatDoctorResult(result));
    });
}
