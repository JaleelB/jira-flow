/**
 * Build script: compiles the standalone `jira-flow` executable (ADR-0001/O-01,
 * ADR-0007/O-01, ADR-0007/O-03).
 *
 * Injects version, commit SHA, and build date at compile time via `--define`.
 * `jira-flow --version` reads these constants; it must never read
 * `package.json` at runtime.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const projectRoot = join(dirname(import.meta.path), "..");
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8")) as {
  version: string;
};

interface GitValue {
  value: string;
}

function run(command: string, args: string[]): GitValue | null {
  const proc = Bun.spawnSync([command, ...args], {
    cwd: projectRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    return null;
  }
  return { value: new TextDecoder().decode(proc.stdout).trim() };
}

const version = packageJson.version;
const commit = run("git", ["rev-parse", "--short", "HEAD"])?.value ?? "unknown";
const buildDate = new Date().toISOString();

const define = (key: string, value: string): string => `${key}=${JSON.stringify(value)}`;

const args = [
  "build",
  "--compile",
  join("src", "main.ts"),
  "--outfile",
  join("dist", "jira-flow"),
  "--define",
  define("__JIRAFLOW_VERSION__", version),
  "--define",
  define("__JIRAFLOW_COMMIT__", commit),
  "--define",
  define("__JIRAFLOW_BUILD_DATE__", buildDate),
];

console.log(`Building jira-flow ${version} (commit ${commit}, built ${buildDate})...`);

const proc = Bun.spawnSync([process.execPath, ...args], {
  cwd: projectRoot,
  stdout: "inherit",
  stderr: "inherit",
});

if (proc.exitCode !== 0) {
  console.error(`Build failed with exit code ${proc.exitCode}`);
  process.exit(proc.exitCode ?? 1);
}

console.log(`Built ${join("dist", "jira-flow")}`);
