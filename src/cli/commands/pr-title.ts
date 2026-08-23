import type { Command } from "commander";
import type { GeneratePrTitle } from "../../application/use-cases/generate-pr-title";

export function registerPrTitleCommand(
  program: Command,
  services: { generatePrTitle: GeneratePrTitle },
): void {
  program
    .command("pr-title")
    .description("generate a local PR title from the active Jira issue")
    .option("--title <story-title>", "one-shot story title")
    .option("--no-copy", "do not copy the generated title")
    .option("--json", "print stable JSON")
    .action(async (options: { title?: string; copy?: boolean; json?: boolean }) => {
      const result = await services.generatePrTitle.execute({
        path: process.cwd(),
        title: options.title,
        copy: options.copy !== false,
      });
      if (options.json) {
        process.stdout.write(`${JSON.stringify({ schemaVersion: 1, ...result }, null, 2)}\n`);
        return;
      }
      process.stdout.write(`${result.value}\n`);
      if (result.copied) process.stdout.write("\nCopied to clipboard.\n");
      if (result.warning) process.stderr.write(`Warning: ${result.warning}\n`);
    });
}
