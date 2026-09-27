import { createInterface } from "node:readline/promises";
import type { Command } from "commander";
import type { MigrateLegacyRepository } from "../../application/use-cases/migrate-legacy-repository";
import {
  ConfirmationRequiredError,
  LegacyHookAmbiguousError,
  LegacyMigrationNotNeededError,
} from "../../domain/errors";

export function registerMigrateCommand(
  program: Command,
  services: { migrateLegacyRepository: MigrateLegacyRepository },
): void {
  program
    .command("migrate")
    .description("migrate an exact JiraFlow v0.5 hook integration")
    .argument("[path]", "repository path (default: current directory)")
    .option("--yes", "confirm the displayed migration plan")
    .option("--json", "print stable JSON")
    .action(async (path: string | undefined, options: { yes?: boolean; json?: boolean }) => {
      const target = path ?? process.cwd();
      const preview = await services.migrateLegacyRepository.preview({ path: target });
      if (!preview.detected) throw new LegacyMigrationNotNeededError();
      if (!preview.eligible) throw new LegacyHookAmbiguousError(preview.ambiguousPaths);

      if (options.yes !== true) {
        if (!process.stdin.isTTY || !process.stdout.isTTY) {
          throw new ConfirmationRequiredError("jira-flow migrate");
        }
        process.stdout.write(formatPreview(preview));
        const terminal = createInterface({ input: process.stdin, output: process.stdout });
        const answer = await terminal.question("Migrate this repository? [y/N] ");
        terminal.close();
        if (answer.trim().toLowerCase() !== "y" && answer.trim().toLowerCase() !== "yes") return;
      }

      const result = await services.migrateLegacyRepository.execute({ path: target });
      if (options.json) {
        process.stdout.write(`${JSON.stringify({ schemaVersion: 1, ...result }, null, 2)}\n`);
        return;
      }
      process.stdout.write(
        `Migrated JiraFlow v0.5 integration in ${result.repoPath}.\nMode: hybrid\nRemoved: ${result.removedLegacyHooks.join(", ")}\n`,
      );
    });
}

function formatPreview(preview: Awaited<ReturnType<MigrateLegacyRepository["preview"]>>): string {
  return [
    "Legacy JiraFlow integration detected.",
    "",
    "This will:",
    ...preview.changes.map((change) => `  • ${change}`),
    "",
  ].join("\n");
}
