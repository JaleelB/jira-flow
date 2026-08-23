import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

type Manager = "npm" | "pnpm" | "bun";

const args = process.argv.slice(2);
const manager = option("--manager") as Manager | undefined;
if (!manager || !["npm", "pnpm", "bun"].includes(manager)) {
  throw new Error("usage: smoke-package.ts --manager <npm|pnpm|bun> --package <tarball>");
}
const packageArg = option("--package");
if (!packageArg) throw new Error("--package is required");
const tarball = resolve(packageArg);
if (!existsSync(tarball)) throw new Error(`package does not exist: ${tarball}`);

const root = mkdtempSync(join(tmpdir(), `jira-flow-${manager}-smoke with spaces-`));
const repo = join(root, "repository with spaces");
const home = join(root, "home with spaces");
const data = join(root, "data with spaces");
const gitConfig = join(root, "isolated gitconfig");
mkdirSync(repo, { recursive: true });
mkdirSync(home, { recursive: true });
mkdirSync(data, { recursive: true });
writeFileSync(gitConfig, "", "utf8");

const baseEnv: Record<string, string | undefined> = {
  ...process.env,
  HOME: home,
  USERPROFILE: home,
  XDG_CONFIG_HOME: join(home, ".config"),
  XDG_DATA_HOME: data,
  GIT_CONFIG_GLOBAL: gitConfig,
  GIT_CONFIG_SYSTEM: gitConfig,
  GIT_CONFIG_NOSYSTEM: "1",
};

try {
  git(["init", "-b", "feat/PKG-123-package-smoke"]);
  git(["config", "--local", "user.name", "JiraFlow Package Smoke"]);
  git(["config", "--local", "user.email", "package-smoke@jiraflow.invalid"]);
  writeFileSync(join(repo, "README.md"), "package smoke\n", "utf8");
  git(["add", "README.md"]);
  git(["commit", "-m", "chore: initial"]);

  const before = repositoryFingerprint();
  const installation = install(manager);
  assert(repositoryFingerprint() === before, `${manager} install mutated the Git repository`);

  const version = runCommand(installation.command, ["--version"], installation.env);
  assert(version.stdout.trim() === packageVersion(), `${manager} installed unexpected version`);
  const help = runCommand(installation.command, ["--help"], installation.env);
  assert(help.stdout.includes("Usage:"), `${manager} --help did not render`);

  runCommand(installation.command, ["init", repo, "--yes"], installation.env);
  const hook = gitPath("hooks/commit-msg");
  assert(existsSync(hook), `${manager} init did not install commit-msg`);
  const hookText = readFileSync(hook, "utf8");
  assert(
    hookText.includes("JIRAFLOW_BIN="),
    `${manager} hook did not capture the native executable`,
  );

  writeFileSync(join(repo, "change.txt"), "first\n", "utf8");
  git(["add", "change.txt"]);
  git(["commit", "-m", "feat: packaged commit"]);
  assert(
    git(["log", "-1", "--pretty=%B"]).stdout.includes("PKG-123"),
    "hook did not decorate commit",
  );
  runCommand(installation.command, ["doctor", repo], installation.env);

  upgrade(manager, installation);
  assert(
    runCommand(installation.command, ["--version"], installation.env).stdout.trim() ===
      packageVersion(),
    `${manager} upgrade/reinstall broke command resolution`,
  );

  uninstall(manager, installation);
  assert(
    commandCandidates(dirname(installation.command)).every((candidate) => !existsSync(candidate)),
    `${manager} uninstall left a command shim behind`,
  );
  writeFileSync(join(repo, "after-uninstall.txt"), "still commits\n", "utf8");
  git(["add", "after-uninstall.txt"]);
  git(["commit", "-m", "chore: commit after uninstall"], {
    ...baseEnv,
    PATH: withoutInstallationPath(installation),
  });

  process.stdout.write(
    `${manager} package smoke passed: install, upgrade, hook, doctor, uninstall\n`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}

function install(selected: Manager): { command: string; env: Record<string, string | undefined> } {
  if (selected === "npm") {
    const prefix = join(root, "npm prefix with spaces");
    const env = { ...baseEnv, JIRAFLOW_SMOKE_PREFIX: prefix };
    runCommand("npm", ["install", "-g", "--prefix", prefix, tarball, "--ignore-scripts"], env);
    return { command: globalCommand(join(prefix, process.platform === "win32" ? "" : "bin")), env };
  }
  if (selected === "pnpm") {
    const pnpmHome = join(root, "pnpm home with spaces");
    const globalDir = join(root, "pnpm global with spaces");
    const binDir = process.platform === "win32" ? pnpmHome : join(pnpmHome, "bin");
    mkdirSync(binDir, { recursive: true });
    const env = {
      ...baseEnv,
      PNPM_HOME: pnpmHome,
      PATH: `${binDir}${pathDelimiter()}${baseEnv.PATH}`,
    };
    runCommand("pnpm", ["add", "-g", tarball, "--global-dir", globalDir, "--ignore-scripts"], env);
    return {
      command: globalCommand(binDir),
      env: { ...env, JIRAFLOW_SMOKE_GLOBAL_DIR: globalDir },
    };
  }
  const bunInstall = join(root, "bun install with spaces");
  const binDir = join(bunInstall, "bin");
  mkdirSync(binDir, { recursive: true });
  const env = {
    ...baseEnv,
    BUN_INSTALL: bunInstall,
    PATH: `${binDir}${pathDelimiter()}${baseEnv.PATH}`,
  };
  runCommand("bun", ["add", "-g", tarball, "--ignore-scripts", "--no-cache"], env);
  return { command: globalCommand(binDir), env };
}

function upgrade(
  selected: Manager,
  installation: { command: string; env: Record<string, string | undefined> },
): void {
  if (selected === "npm") {
    const prefix = installation.env.JIRAFLOW_SMOKE_PREFIX ?? "";
    runCommand(
      "npm",
      ["install", "-g", "--prefix", prefix, tarball, "--ignore-scripts", "--force"],
      installation.env,
    );
  } else if (selected === "pnpm") {
    runCommand(
      "pnpm",
      [
        "add",
        "-g",
        tarball,
        "--global-dir",
        installation.env.JIRAFLOW_SMOKE_GLOBAL_DIR ?? "",
        "--ignore-scripts",
        "--force",
      ],
      installation.env,
    );
  } else {
    runCommand(
      "bun",
      ["add", "-g", tarball, "--ignore-scripts", "--no-cache", "--force"],
      installation.env,
    );
  }
}

function uninstall(
  selected: Manager,
  installation: { command: string; env: Record<string, string | undefined> },
): void {
  if (selected === "npm") {
    const prefix = installation.env.JIRAFLOW_SMOKE_PREFIX ?? "";
    runCommand(
      "npm",
      ["uninstall", "-g", "--prefix", prefix, "jira-flow", "--ignore-scripts"],
      installation.env,
    );
  } else if (selected === "pnpm") {
    runCommand(
      "pnpm",
      [
        "remove",
        "-g",
        "jira-flow",
        "--global-dir",
        installation.env.JIRAFLOW_SMOKE_GLOBAL_DIR ?? "",
      ],
      installation.env,
    );
  } else {
    runCommand("bun", ["remove", "-g", "jira-flow", "--ignore-scripts"], installation.env);
  }
}

function globalCommand(binDir: string): string {
  const command = commandCandidates(binDir).find((candidate) => existsSync(candidate));
  if (!command) throw new Error(`jira-flow command was not linked in ${binDir}`);
  return command;
}

function commandCandidates(binDir: string): string[] {
  return process.platform === "win32"
    ? ["jira-flow.exe", "jira-flow.cmd", "jira-flow.ps1", "jira-flow"].map((name) =>
        join(binDir, name),
      )
    : [join(binDir, "jira-flow")];
}

function withoutInstallationPath(installation: {
  command: string;
  env: Record<string, string | undefined>;
}): string {
  const binDir = dirname(installation.command);
  return (installation.env.PATH ?? "")
    .split(pathDelimiter())
    .filter((entry) => resolve(entry) !== resolve(binDir))
    .join(pathDelimiter());
}

function repositoryFingerprint(): string {
  const status = git(["status", "--porcelain=v1", "--untracked-files=all"]).stdout;
  const config = git(["config", "--local", "--list", "--show-origin"]).stdout;
  const hooks = readdirSync(gitPath("hooks")).sort().join("\n");
  return `${status}\u0000${config}\u0000${hooks}`;
}

function gitPath(path: string): string {
  return git(["rev-parse", "--path-format=absolute", "--git-path", path]).stdout.trim();
}

function git(args: string[], env = baseEnv): { stdout: string; stderr: string } {
  return runCommand("git", args, env, repo);
}

function runCommand(
  command: string,
  commandArgs: string[],
  env: Record<string, string | undefined>,
  cwd = repo,
): { stdout: string; stderr: string } {
  const result = Bun.spawnSync([command, ...commandArgs], {
    cwd,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `${command} ${commandArgs.join(" ")} failed (${result.exitCode}): ${result.stderr.toString()}`,
    );
  }
  return { stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

function packageVersion(): string {
  const result = Bun.spawnSync(["tar", "-xOf", tarball, "package/package.json"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0)
    throw new Error(`cannot inspect ${tarball}: ${result.stderr.toString()}`);
  return (JSON.parse(result.stdout.toString()) as { version: string }).version;
}

function pathDelimiter(): string {
  return process.platform === "win32" ? ";" : ":";
}

function option(name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
