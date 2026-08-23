import type { Command } from "commander";
import type { ListRepositories } from "../../application/use-cases/list-repositories";
import type { ManageRepositoryRegistry } from "../../application/use-cases/manage-repository-registry";

export function registerRepositoriesCommand(
  program: Command,
  services: {
    listRepositories: ListRepositories;
    manageRepositoryRegistry: ManageRepositoryRegistry;
  },
): void {
  const repositories = program
    .command("repositories")
    .description("list known JiraFlow repositories without scanning the filesystem")
    .option("--json", "print stable JSON")
    .option("--no-refresh", "use the last disposable cache state")
    .action(async (options: { json?: boolean; refresh?: boolean }) => {
      const result = await services.listRepositories.execute({
        refresh: options.refresh !== false,
      });
      if (options.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }
      if (result.repositories.length === 0) {
        process.stdout.write("No repositories are registered.\n");
        return;
      }
      const lines = result.repositories.map(
        (repo) =>
          `${repo.displayName.padEnd(20)} ${(repo.mode ?? "—").padEnd(8)} ${(repo.activeIssue ?? "—").padEnd(12)} ${repo.health}`,
      );
      process.stdout.write(`${lines.join("\n")}\n`);
    });

  repositories
    .command("locate")
    .description("verify and update the path for a missing repository")
    .argument("<repository-id>", "registry repository id")
    .argument("<path>", "new local repository path")
    .action(async (id: string, path: string) => {
      await services.manageRepositoryRegistry.locate({ id, path });
    });

  repositories
    .command("forget")
    .description("remove a missing repository from the dashboard registry only")
    .argument("<repository-id>", "registry repository id")
    .action(async (id: string) => {
      await services.manageRepositoryRegistry.remove({ id });
    });
}
