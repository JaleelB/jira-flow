import type { Command } from "commander";
import { Command as CommanderCommand } from "commander";
import { VERSION } from "../version";

/**
 * Builds the root Commander program.
 *
 * Commander is a CLI adapter only: it must not run Git, edit config, write
 * files, or resolve linking modes (ADR-0002, architecture §34).
 *
 * `--help` and `--version` must work outside a Git repository (ADR-0007/O-02),
 * so no repository discovery happens here or in `main.ts` before parsing.
 */
export function buildProgram(): Command {
  const program = new CommanderCommand();

  program
    .name("jira-flow")
    .description("Link git commits with Jira issues")
    .version(VERSION, "--version", "print the JiraFlow version")
    .helpOption("-h, --help", "print help for JiraFlow");

  return program;
}
