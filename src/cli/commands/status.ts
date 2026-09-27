import type { Command } from "commander";
import type { GetRepositoryStatus } from "../../application/use-cases/get-repository-status";
import { formatRepositoryStatus } from "../output/human";
import { formatStatusJson } from "../output/json";

/**
 * `jira-flow status` — human-readable repository status (product §6.4).
 */
export function registerStatusCommand(
  program: Command,
  services: { getRepositoryStatus: GetRepositoryStatus },
): void {
  program
    .command("status")
    .description("show JiraFlow status for the current repository")
    .argument("[path]", "repository path (default: current directory)")
    .option("--json", "print machine-readable status")
    .action(async (path: string | undefined, options: { json?: boolean }) => {
      const view = await services.getRepositoryStatus.execute({
        path: path ?? process.cwd(),
      });
      if (options.json === true) {
        process.stdout.write(formatStatusJson(view));
        return;
      }
      process.stdout.write(formatRepositoryStatus(view));
    });
}
