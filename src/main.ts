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
