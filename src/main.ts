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
    await program.parseAsync(process.argv);
    return 0;
  }

  // Headless commands share the CLI composition root.
  const headlessCommand = new Set(["init", "status", "doctor"]);
  if (argv[0] !== undefined && headlessCommand.has(argv[0])) {
    const { createCliContainer } = await import("./bootstrap/cli-container");
    const { registerInitCommand } = await import("./cli/commands/init");
    const { registerStatusCommand } = await import("./cli/commands/status");
    const { registerDoctorCommand } = await import("./cli/commands/doctor");
    const container = createCliContainer();
    const program = buildProgram();
    registerInitCommand(program, container);
    registerStatusCommand(program, container);
    registerDoctorCommand(program, container);
    await program.parseAsync(process.argv);
    return 0;
  }

  // Root command with no arguments launches the TUI (product §6.1). The
  // TUI module is dynamically imported so headless paths never load
  // OpenTUI (ADR-0002/O-02, architecture §32).
  if (argv.length === 0) {
    const { runTui } = await import("./tui/run-tui");
    await runTui();
    return 0;
  }

  const program = buildProgram();
  await program.parseAsync(process.argv);
  return 0;
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
