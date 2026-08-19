import { type Command, CommanderError } from "commander";
import { buildProgram } from "./cli/build-program";
import { printError, printUnexpectedError } from "./cli/output/errors";
import type { JiraFlowError } from "./domain/errors";

/**
 * Process entry point (architecture §34).
 *
 * Responsibilities:
 *  1. process-level crash boundary
 *  2. build the command router or TUI
 *  3. map the final exit code
 *
 * `main.ts` must not run `git rev-parse` or any repository discovery before
 * parsing argv: `--help`/`--version` work anywhere (ADR-0007/O-02).
 *
 * Exit codes follow architecture §37.
 */
async function main(): Promise<number> {
  const argv = process.argv.slice(2);

  // The internal hook command gets its own composition root that excludes
  // SQLite and OpenTUI (ADR-0002/O-02, ADR-0004/O-03). It must stay
  // import-light for commit latency.
  if (argv[0] === "hook") {
    const { createHookContainer } = await import("./bootstrap/hook-container");
    const { registerHookCommand } = await import("./cli/commands/hook");
    const program = buildProgram();
    registerHookCommand(program, createHookContainer());
    return parseProgram(program);
  }

  // Root command with no arguments launches the TUI (product §6.1). The
  // TUI module is dynamically imported so headless paths never load
  // OpenTUI (ADR-0002/O-02, architecture §32).
  if (argv.length === 0) {
    const { runTui } = await import("./tui/run-tui");
    await runTui();
    return 0;
  }

  const { createCliContainer } = await import("./bootstrap/cli-container");
  const { registerInitCommand } = await import("./cli/commands/init");
  const { registerStatusCommand } = await import("./cli/commands/status");
  const { registerDoctorCommand } = await import("./cli/commands/doctor");
  const { registerLinkCommands } = await import("./cli/commands/link");
  const { registerModeCommands } = await import("./cli/commands/mode");
  const { registerRemoveCommand } = await import("./cli/commands/remove");
  const { registerConfigCommand } = await import("./cli/commands/config");
  const container = createCliContainer();
  const program = buildProgram();
  registerInitCommand(program, container);
  registerStatusCommand(program, container);
  registerDoctorCommand(program, container);
  registerLinkCommands(program, container);
  registerModeCommands(program, container);
  registerRemoveCommand(program, container);
  registerConfigCommand(program, container);
  return parseProgram(program);
}

async function parseProgram(program: Command): Promise<number> {
  applyExitOverride(program);
  program.showHelpAfterError(false);
  try {
    await program.parseAsync(process.argv);
    return 0;
  } catch (error) {
    if (error instanceof CommanderError) {
      if (
        error.code === "commander.helpDisplayed" ||
        error.code === "commander.help" ||
        error.code === "commander.version"
      ) {
        return 0;
      }
      process.stderr.write(`jira-flow: ${error.message}\n`);
      return 2;
    }
    throw error;
  }
}

function applyExitOverride(command: Command): void {
  command.exitOverride();
  for (const child of command.commands) {
    applyExitOverride(child);
  }
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    if (isJiraFlowError(error)) {
      printError(error);
      process.exitCode = error.exitCode;
      return;
    }
    printUnexpectedError(error);
    process.exitCode = 1;
  });

function isJiraFlowError(error: unknown): error is JiraFlowError {
  return (
    error instanceof Error &&
    typeof (error as JiraFlowError).code === "string" &&
    typeof (error as JiraFlowError).exitCode === "number" &&
    Number.isInteger((error as JiraFlowError).exitCode)
  );
}
