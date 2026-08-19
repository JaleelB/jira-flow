import type { Command } from "commander";
import type { InitializeRepository } from "../../application/use-cases/initialize-repository";
import { ConfigInvalidError, InteractiveSetupDeferredError } from "../../domain/errors";
import { isLinkingMode } from "../../domain/linking-mode";
import { formatInitializeResult } from "../output/human";

/**
 * `jira-flow init` — noninteractive Strategy A is `init --yes` (DR-0018,
 * DR-0019). Bare `init` does not silently apply defaults.
 */
export function registerInitCommand(
  program: Command,
  services: { initializeRepository: InitializeRepository },
): void {
  program
    .command("init")
    .description("initialize JiraFlow for the current Git repository")
    .argument("[path]", "repository path (default: current directory)")
    .option("--yes", "accept safe defaults without interactive setup")
    .option("--mode <mode>", "linking mode: hybrid, branch, or manual")
    .option("--compose-existing-hook", "compose into an existing composable shell hook")
    .option("--allow-shared-hooks", "allow integration when core.hooksPath is shared/external")
    .action(
      async (
        path: string | undefined,
        options: {
          yes?: boolean;
          mode?: string;
          composeExistingHook?: boolean;
          allowSharedHooks?: boolean;
        },
      ) => {
        if (options.yes !== true) {
          throw new InteractiveSetupDeferredError();
        }
        if (options.mode !== undefined && !isLinkingMode(options.mode)) {
          throw new ConfigInvalidError("mode", options.mode);
        }
        const result = await services.initializeRepository.execute({
          path: path ?? process.cwd(),
          mode: options.mode,
          composeExistingHook: options.composeExistingHook === true,
          allowSharedHooks: options.allowSharedHooks === true,
        });
        process.stdout.write(formatInitializeResult(result));
      },
    );
}
