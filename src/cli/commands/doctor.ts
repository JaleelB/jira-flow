import type { Command } from "commander";
import type { RepairRepository } from "../../application/use-cases/repair-repository";
import type { RunDoctor } from "../../application/use-cases/run-doctor";
import { formatDoctorResult } from "../output/human";
import { formatDoctorJson } from "../output/json";

/**
 * `jira-flow doctor` — read-only health checks unless `--repair` is set.
 */
export function registerDoctorCommand(
  program: Command,
  services: { runDoctor: RunDoctor; repairRepository: RepairRepository },
): void {
  program
    .command("doctor")
    .description("check JiraFlow health for the current repository")
    .argument("[path]", "repository path (default: current directory)")
    .option("--json", "print a machine-readable doctor report")
    .option("--repair", "repair JiraFlow-owned state only")
    .action(async (path: string | undefined, options: { json?: boolean; repair?: boolean }) => {
      const cwd = path ?? process.cwd();
      if (options.repair === true) {
        await services.repairRepository.execute({ path: cwd });
      }
      const result = await services.runDoctor.execute({ path: cwd });
      if (options.json === true) {
        process.stdout.write(formatDoctorJson(result));
        return;
      }
      process.stdout.write(formatDoctorResult(result));
    });
}
