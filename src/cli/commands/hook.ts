import { resolve } from "node:path";
import { type Command, Command as CommanderCommand } from "commander";
import type { ProcessCommitMessage } from "../../application/use-cases/process-commit-message";

/**
 * Internal hook command (ADR-0007/O-01, product §6.15).
 *
 * `jira-flow hook commit-msg <commit-message-file>` powers the managed Git
 * integration. It is not a primary user-facing workflow and is hidden from
 * top-level help.
 *
 * This adapter only wires arguments. It is silent on success (architecture
 * invariant 18) and never owns business logic.
 */
export function registerHookCommand(
  program: Command,
  services: { processCommitMessage: ProcessCommitMessage },
): void {
  const commitMsg = new CommanderCommand("commit-msg")
    .description("apply the JiraFlow reference to a commit message file")
    .argument("<file>", "path of the commit message file passed by Git")
    .action(async (file: string) => {
      await services.processCommitMessage.execute({
        cwd: process.cwd(),
        commitMessagePath: resolve(file),
      });
      // Silent on success; no stdout under any outcome.
    });

  const hook = new CommanderCommand("hook")
    .description("internal commands powering the managed Git integration")
    .addCommand(commitMsg);

  program.addCommand(hook, { hidden: true });
}
