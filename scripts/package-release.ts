import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { NATIVE_PLATFORMS, selectedNativeTargets } from "./native-platforms";

const projectRoot = join(import.meta.dir, "..");
const manifest = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8")) as {
  version: string;
};
const releaseRoot = join(projectRoot, "dist", "release");
const stagingRoot = join(releaseRoot, "staging");
mkdirSync(releaseRoot, { recursive: true });
mkdirSync(stagingRoot, { recursive: true });

const archives: string[] = [];
for (const key of selectedNativeTargets(process.argv.slice(2))) {
  const platform = NATIVE_PLATFORMS[key];
  if (!platform) throw new Error(`missing platform metadata for ${key}`);
  const binary = join(projectRoot, "dist", "native", key, platform.binary);
  if (!Bun.file(binary).size) throw new Error(`missing native binary for ${key}: ${binary}`);

  const baseName = `jira-flow-v${manifest.version}-${key}`;
  const stage = join(stagingRoot, baseName);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  copyFileSync(binary, join(stage, platform.binary));
  if (platform.os !== "win32") chmodSync(join(stage, platform.binary), 0o755);
  copyFileSync(join(projectRoot, "README.md"), join(stage, "README.md"));
  copyFileSync(join(projectRoot, "LICENSE"), join(stage, "LICENSE"));

  const archive =
    platform.os === "win32"
      ? join(releaseRoot, `${baseName}.zip`)
      : join(releaseRoot, `${baseName}.tar.gz`);
  rmSync(archive, { force: true });
  if (platform.os === "win32") {
    run("zip", ["-q", "-X", "-r", archive, baseName], stagingRoot);
  } else {
    run("tar", ["-czf", archive, baseName], stagingRoot);
  }
  archives.push(archive);
}

const checksums = archives
  .sort()
  .map((archive) => `${sha256(archive)}  ${basename(archive)}`)
  .join("\n");
writeFileSync(join(releaseRoot, "SHA256SUMS"), `${checksums}\n`, "utf8");
process.stdout.write(`${checksums}\n`);

function run(command: string, args: string[], cwd: string): void {
  const result = Bun.spawnSync([command, ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    throw new Error(`${command} failed: ${result.stderr.toString()}`);
  }
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
