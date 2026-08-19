import type { Command } from "commander";
import type { GetRepositoryStatus } from "../../application/use-cases/get-repository-status";
import { formatRepositoryStatus } from "../output/human";

/**
 * `jira-flow status` — human-readable repository status (product §6.4).
 * `--json` arrives with the headless epic; VS-1 ships human output only
 * (DR-0013).
 */
export function registerStatusCommand(
  program: Command,
  services: { getRepositoryStatus: GetRepositoryStatus },
): void {
  program
    .command("status")
    .description("show JiraFlow status for the current repository")
    .argument("[path]", "repository path (default: current directory)")
    .action(async (path: string | undefined) => {
      const view = await services.getRepositoryStatus.execute({
        path: path ?? process.cwd(),
      });
      process.stdout.write(formatRepositoryStatus(view));
    });
}
