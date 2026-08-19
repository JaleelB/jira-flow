import type { Command } from "commander";
import type { LinkIssue } from "../../application/use-cases/link-issue";
import type { UnlinkIssue } from "../../application/use-cases/unlink-issue";

export function registerLinkCommands(
  program: Command,
  services: { linkIssue: LinkIssue; unlinkIssue: UnlinkIssue },
): void {
  program
    .command("link")
    .description("link the current worktree to a Jira issue")
    .argument("<issue>", "Jira issue key")
    .action(async (issue: string) => {
      const result = await services.linkIssue.execute({ path: process.cwd(), issue });
      process.stdout.write(`Linked ${result.key} (${result.mode})\n`);
    });

  program
    .command("unlink")
    .description("clear the worktree-linked Jira issue")
    .action(async () => {
      const result = await services.unlinkIssue.execute({ path: process.cwd() });
      if (result.noop) {
        process.stdout.write("Unlink is a no-op in Branch mode.\n");
        return;
      }
      process.stdout.write("Cleared the linked issue.\n");
    });
}
