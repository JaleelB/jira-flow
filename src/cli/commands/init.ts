import type { Command } from "commander";
import type { InitializeRepository } from "../../application/use-cases/initialize-repository";
import { formatInitializeResult } from "../output/human";

/**
 * `jira-flow init` — VS-1 form: `init --yes [path]` (product §6.3 reduced
 * by DR-0013). Interactive setup is out of scope, so `--yes` is required
 * rather than pretending an interactive flow exists.
 */
export function registerInitCommand(
  program: Command,
  services: { initializeRepository: InitializeRepository },
): void {
  program
    .command("init")
    .description("initialize JiraFlow for the current Git repository")
    .argument("[path]", "repository path (default: current directory)")
    .requiredOption("--yes", "accept safe defaults without interactive setup")
    .action(async (path: string | undefined) => {
      const result = await services.initializeRepository.execute({
        path: path ?? process.cwd(),
      });
      process.stdout.write(formatInitializeResult(result));
    });
}
