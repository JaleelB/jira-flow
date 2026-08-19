import type { Command } from "commander";
import type { RemoveRepository } from "../../application/use-cases/remove-repository";

export function registerRemoveCommand(
  program: Command,
  services: { removeRepository: RemoveRepository },
): void {
  program
    .command("remove")
    .description("remove JiraFlow from this repository")
    .option("--yes", "confirm removal without a prompt")
    .action(async (options: { yes?: boolean }) => {
      const result = await services.removeRepository.execute({
        path: process.cwd(),
        yes: options.yes === true,
      });
      process.stdout.write(`Removed JiraFlow from ${result.repoPath} (${result.hookMode})\n`);
    });
}
