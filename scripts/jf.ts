import { existsSync } from "node:fs";
import { playgroundLayout, playgroundProcessEnv } from "./playground-paths";

/**
 * Runs the VS-1 CLI against the gitignored playground repo.
 *
 *   bun run playground
 *   bun run jf status
 *   bun run jf --status    # same thing
 */

const layout = playgroundLayout();

if (!existsSync(layout.repo)) {
  process.stderr.write("Playground is missing. Run `bun run playground` first.\n");
  process.exit(1);
}

const args = normalizePlaygroundArgs(process.argv.slice(2));
const proc = Bun.spawn([process.execPath, layout.mainTs, ...args], {
  cwd: layout.repo,
  env: playgroundProcessEnv(layout),
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

process.exit(await proc.exited);

/** `status` / `doctor` / `init` are commands, not root flags. */
function normalizePlaygroundArgs(argv: string[]): string[] {
  const first = argv[0];
  if (first === undefined) {
    return argv;
  }

  const aliases: Record<string, string[]> = {
    "--status": ["status"],
    "--doctor": ["doctor"],
    "--init": ["init", "--yes"],
  };
  const mapped = aliases[first];
  if (mapped !== undefined) {
    return [...mapped, ...argv.slice(1)];
  }
  return argv;
}
