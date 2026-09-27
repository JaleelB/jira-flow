/**
 * Resolution of the currently running JiraFlow executable (ADR-0007).
 *
 * When running as a compiled standalone binary, `process.execPath` is the
 * `jira-flow` executable itself and is captured into the hook shim. Under
 * `bun run` / Node development mode, `process.execPath` is the interpreter,
 * which must NOT be captured; the hook then relies on the `jira-flow`
 * PATH fallback.
 */

export interface ExecutableResolution {
  kind: "compiled" | "dev";
  /** Absolute path to the compiled binary; null in dev mode. */
  binaryPath: string | null;
}

const INTERPRETER_BASENAMES = new Set(["bun", "bunx", "node", "nodejs", "deno"]);

export function resolveCurrentExecutable(): ExecutableResolution {
  const execPath = process.execPath;
  if (!execPath || execPath.length === 0) {
    return { kind: "dev", binaryPath: null };
  }

  const normalized = execPath.replaceAll("\\", "/");
  const basename = normalized.slice(normalized.lastIndexOf("/") + 1);
  const bareName = basename.replace(/\.exe$/i, "");

  if (INTERPRETER_BASENAMES.has(bareName) || bareName.startsWith("bun-")) {
    return { kind: "dev", binaryPath: null };
  }

  return { kind: "compiled", binaryPath: execPath };
}
