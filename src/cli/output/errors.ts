import type { JiraFlowError } from "../../domain/errors";

/**
 * Prints a typed JiraFlow error for human consumption.
 *
 * The stable `code` prefix keeps output grep-able without callers resorting
 * to string matching for behavior (architecture §36).
 */
export function printError(error: JiraFlowError): void {
  process.stderr.write(`jira-flow: ${error.code}: ${error.message}\n`);
}

/** Prints an unexpected (non-typed) error. Exit code stays 1. */
export function printUnexpectedError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`jira-flow: unexpected error: ${message}\n`);
  if (process.env.JIRAFLOW_DEBUG === "1" && error instanceof Error && error.stack) {
    process.stderr.write(`${error.stack}\n`);
  }
}
