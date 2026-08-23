import { chmodSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NATIVE_PLATFORMS, selectedNativeTargets } from "./native-platforms";

const projectRoot = join(import.meta.dir, "..");
const manifest = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8")) as {
  version: string;
};
const version = manifest.version;
const commit = runGit(["rev-parse", "--short", "HEAD"]) ?? "unknown";
const buildDate = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
  : new Date().toISOString();
const targets = selectedNativeTargets(process.argv.slice(2));

if (
  targets.some((key) => !existsSync(join(projectRoot, "node_modules", "@opentui", `core-${key}`)))
) {
  process.stdout.write("Installing locked OpenTUI native packages for cross-compilation...\n");
  const install = Bun.spawnSync(
    [process.execPath, "install", "--frozen-lockfile", "--os=*", "--cpu=*"],
    { cwd: projectRoot, stdout: "inherit", stderr: "inherit" },
  );
  if (install.exitCode !== 0) throw new Error("failed to install cross-platform build inputs");
}

for (const key of targets) {
  const platform = NATIVE_PLATFORMS[key];
  if (!platform) throw new Error(`missing platform metadata for ${key}`);
  const outputDir = join(projectRoot, "dist", "native", key);
  mkdirSync(outputDir, { recursive: true });
  const outfile = join(outputDir, platform.binary.replace(/\.exe$/, ""));
  process.stdout.write(`Building ${key} for JiraFlow ${version}...\n`);
  const result = Bun.spawnSync(
    [
      process.execPath,
      "build",
      "--compile",
      `--target=${platform.bunTarget}`,
      "--no-compile-autoload-dotenv",
      "--no-compile-autoload-bunfig",
      join("src", "main.ts"),
      "--outfile",
      outfile,
      "--define",
      define("__JIRAFLOW_VERSION__", version),
      "--define",
      define("__JIRAFLOW_COMMIT__", commit),
      "--define",
      define("__JIRAFLOW_BUILD_DATE__", buildDate),
    ],
    { cwd: projectRoot, stdout: "inherit", stderr: "inherit" },
  );
  if (result.exitCode !== 0) throw new Error(`native build failed for ${key}`);
  const actualOutput = platform.binary.endsWith(".exe") ? `${outfile}.exe` : outfile;
  if (platform.os !== "win32") chmodSync(actualOutput, 0o755);
}

function runGit(args: string[]): string | null {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: projectRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  return result.exitCode === 0 ? result.stdout.toString().trim() : null;
}

function define(key: string, value: string): string {
  return `${key}=${JSON.stringify(value)}`;
}
