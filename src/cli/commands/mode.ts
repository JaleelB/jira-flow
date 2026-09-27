import type { Command } from "commander";
import type { SetEnabled } from "../../application/use-cases/set-enabled";
import type { SetMode } from "../../application/use-cases/set-mode";

export function registerModeCommands(
  program: Command,
  services: { setMode: SetMode; setEnabled: SetEnabled },
): void {
  program
    .command("mode")
    .description("show or set the linking mode")
    .argument("[mode]", "hybrid, branch, or manual")
    .action(async (mode: string | undefined) => {
      const result = await services.setMode.execute({ path: process.cwd(), mode });
      process.stdout.write(`Mode: ${result.mode}\n`);
    });

  program
    .command("enable")
    .description("enable JiraFlow in this repository")
    .action(async () => {
      await services.setEnabled.execute({ path: process.cwd(), enabled: true });
      process.stdout.write("JiraFlow enabled.\n");
    });

  program
    .command("disable")
    .description("disable JiraFlow in this repository")
    .action(async () => {
      await services.setEnabled.execute({ path: process.cwd(), enabled: false });
      process.stdout.write("JiraFlow disabled.\n");
    });
}
