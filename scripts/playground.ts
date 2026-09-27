import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { playgroundLayout, playgroundProcessEnv } from "./playground-paths";

/**
 * Local CLI playground. Creates a gitignored mock repo so you can run the
 * VS-1 CLI without initializing the jira-flow development tree.
 *
 *   bun run playground
 *   bun run jf -- status
 */

const layout = playgroundLayout();

rmSync(layout.root, { recursive: true, force: true });
mkdirSync(layout.repo, { recursive: true });
mkdirSync(layout.dataDir, { recursive: true });
mkdirSync(layout.binDir, { recursive: true });
writeFileSync(layout.gitconfig, "", "utf8");
writeFileSync(layout.launcher, launcherScript(process.execPath, layout.mainTs), "utf8");
chmodSync(layout.launcher, 0o755);

const env = playgroundProcessEnv(layout);

git(layout.repo, env, ["init", "-b", "main"]);
git(layout.repo, env, ["config", "--local", "user.name", "JiraFlow Playground"]);
git(layout.repo, env, ["config", "--local", "user.email", "playground@jiraflow.invalid"]);
writeFileSync(`${layout.repo}/notes.txt`, "playground file\n", "utf8");
git(layout.repo, env, ["add", "notes.txt"]);
git(layout.repo, env, ["commit", "-m", "initial"]);
git(layout.repo, env, ["switch", "-c", "feat/ABC-123-login"]);

const init = Bun.spawnSync([process.execPath, layout.mainTs, "init", "--yes"], {
  cwd: layout.repo,
  env,
  stdout: "pipe",
  stderr: "pipe",
});
if (init.exitCode !== 0) {
  throw new Error(
    `playground init failed (${init.exitCode}): ${init.stderr.toString()}${init.stdout.toString()}`,
  );
}

process.stdout.write(`Playground ready

  repo: ${layout.repo}
  data: ${layout.dataDir}
  branch: feat/ABC-123-login (active issue ABC-123)

CLI (does not touch the jira-flow git tree):

  bun run jf --help
  bun run jf status
  bun run jf doctor
  bun run jf                 # TUI, Q quits

  bun run jf --status        # also accepted (status is a command, not a flag)

Git footer (cd into the mock repo; PATH already has a jira-flow shim):

  cd ${layout.repo}
  source ${layout.root}/env.sh
  echo more >> notes.txt && git add notes.txt && git commit -m "feat(auth): try the footer"
  git log -1 --pretty=%B

Re-run \`bun run playground\` to wipe and recreate.
`);

writeFileSync(
  `${layout.root}/env.sh`,
  [
    `export JIRAFLOW_DATA_DIR=${shellQuote(layout.dataDir)}`,
    `export PATH=${shellQuote(layout.binDir)}:"$PATH"`,
    `export GIT_CONFIG_GLOBAL=${shellQuote(layout.gitconfig)}`,
    `export GIT_CONFIG_SYSTEM=${shellQuote(layout.gitconfig)}`,
    "export GIT_CONFIG_NOSYSTEM=1",
    "",
  ].join("\n"),
  "utf8",
);

function launcherScript(bunPath: string, mainTs: string): string {
  return `#!/bin/sh
exec ${shellQuote(bunPath)} ${shellQuote(mainTs)} "$@"
`;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function git(cwd: string, env: Record<string, string | undefined>, args: string[]): void {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString()}`);
  }
}
