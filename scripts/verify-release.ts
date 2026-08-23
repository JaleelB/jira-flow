import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { NATIVE_PLATFORMS } from "./native-platforms";

const root = join(import.meta.dir, "..");
const args = process.argv.slice(2);
const manifest = readJson<{ name: string; version: string }>(join(root, "package.json"));
const version = manifest.version;

const releaseManifest = readJson<Record<string, string>>(
  join(root, ".release-please-manifest.json"),
);
equal(releaseManifest["."], version, "Release Please manifest version");

const versionSource = readFileSync(join(root, "src", "version.ts"), "utf8");
const fallback = versionSource.match(
  /DEVELOPMENT_VERSION\s*=\s*["']([^"']+)["'];\s*\/\/ x-release-please-version/,
)?.[1];
equal(fallback, version, "source fallback version");

const tag = option("--tag") ?? process.env.JIRAFLOW_RELEASE_TAG;
if (tag) equal(tag, `v${version}`, "release tag");

const channel = option("--channel") ?? process.env.JIRAFLOW_NPM_CHANNEL;
if (channel) {
  if (channel !== "next" && channel !== "latest") fail(`unsupported npm channel ${channel}`);
  if (version.includes("-") && channel !== "next") {
    fail(`prerelease ${version} must publish to next, not ${channel}`);
  }
  if (!version.includes("-") && channel !== "latest") {
    fail(`stable ${version} must publish to latest, not ${channel}`);
  }
}

if (args.includes("--artifacts")) verifyArtifacts();
process.stdout.write(`release version verified: ${version}${channel ? ` (${channel})` : ""}\n`);

function verifyArtifacts(): void {
  const binary = join(
    root,
    "dist",
    "native",
    `${process.platform}-${process.arch}`,
    process.platform === "win32" ? "jira-flow.exe" : "jira-flow",
  );
  if (existsSync(binary)) {
    const result = Bun.spawnSync([binary, "--version"], { stdout: "pipe", stderr: "pipe" });
    if (result.exitCode !== 0) fail(`host binary failed: ${result.stderr.toString()}`);
    equal(result.stdout.toString().trim(), version, "compiled binary version");
  }

  const packageDir = join(root, "dist", "packages");
  const expectedPackages = [
    `${manifest.name}-${version}.tgz`,
    ...Object.values(NATIVE_PLATFORMS).map((target) => `${target.package}-${version}.tgz`),
  ].sort();
  const actualPackages = readdirSync(packageDir)
    .filter((file) => file.endsWith(".tgz"))
    .sort();
  equal(JSON.stringify(actualPackages), JSON.stringify(expectedPackages), "npm package set");

  for (const file of actualPackages) {
    const packageManifest = readPackedManifest(join(packageDir, file));
    equal(packageManifest.version, version, `${file} version`);
    if (packageManifest.name === manifest.name) {
      const optional = packageManifest.optionalDependencies ?? {};
      equal(
        Object.keys(optional).length,
        Object.keys(NATIVE_PLATFORMS).length,
        "optional package count",
      );
      for (const target of Object.values(NATIVE_PLATFORMS)) {
        equal(optional[target.package], version, `${target.package} dependency version`);
      }
      if (packageManifest.scripts) fail("universal package must not contain lifecycle scripts");
    }
  }

  const releaseDir = join(root, "dist", "release");
  const expectedArchives = Object.keys(NATIVE_PLATFORMS)
    .map(
      (key) =>
        `jira-flow-v${version}-${key}.${NATIVE_PLATFORMS[key]?.os === "win32" ? "zip" : "tar.gz"}`,
    )
    .sort();
  const actualArchives = readdirSync(releaseDir)
    .filter((file) => file.endsWith(".zip") || file.endsWith(".tar.gz"))
    .sort();
  equal(JSON.stringify(actualArchives), JSON.stringify(expectedArchives), "release archive set");

  const checksumLines = readFileSync(join(releaseDir, "SHA256SUMS"), "utf8").trim().split("\n");
  equal(checksumLines.length, expectedArchives.length, "checksum count");
  for (const line of checksumLines) {
    const match = line.match(/^([a-f0-9]{64}) {2}(.+)$/);
    if (!match) fail(`invalid checksum line: ${line}`);
    const [, expected, file] = match;
    if (!file || !expected || !expectedArchives.includes(file))
      fail(`unexpected checksum file: ${file}`);
    const actual = createHash("sha256")
      .update(readFileSync(join(releaseDir, file)))
      .digest("hex");
    equal(actual, expected, `${basename(file)} checksum`);
  }
}

function readPackedManifest(path: string): {
  name: string;
  version: string;
  optionalDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
} {
  const result = Bun.spawnSync(["tar", "-xOf", path, "package/package.json"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) fail(`cannot inspect ${path}: ${result.stderr.toString()}`);
  return JSON.parse(result.stdout.toString());
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function option(name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) fail(`${label} mismatch: expected ${expected}, received ${actual}`);
}

function fail(message: string): never {
  throw new Error(message);
}
