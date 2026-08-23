import { chmodSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { NATIVE_PLATFORMS, selectedNativeTargets } from "./native-platforms";

const projectRoot = join(import.meta.dir, "..");
const rootManifest = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8")) as {
  name: string;
  version: string;
  description: string;
  author: string;
  homepage: string;
  repository: unknown;
  bugs: unknown;
  license: string;
};
const args = process.argv.slice(2);
const targets = selectedNativeTargets(args);
const local = args.includes("--local");
const packageRoot = join(projectRoot, "dist", "packages");
const stagingRoot = join(packageRoot, "staging");
mkdirSync(packageRoot, { recursive: true });
mkdirSync(stagingRoot, { recursive: true });

const nativeTarballs = new Map<string, string>();
for (const key of targets) {
  const platform = NATIVE_PLATFORMS[key];
  if (!platform) throw new Error(`missing platform metadata for ${key}`);
  const sourceBinary = join(projectRoot, "dist", "native", key, platform.binary);
  if (!Bun.file(sourceBinary).size) {
    throw new Error(`missing ${sourceBinary}; run bun run build:native -- --target ${key}`);
  }
  const stage = join(stagingRoot, platform.package);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(join(stage, "bin"), { recursive: true });
  copyFileSync(sourceBinary, join(stage, "bin", platform.binary));
  if (platform.os !== "win32") chmodSync(join(stage, "bin", platform.binary), 0o755);
  copyCommonFiles(stage);
  writeJson(join(stage, "package.json"), {
    name: platform.package,
    version: rootManifest.version,
    description: `${rootManifest.description} (${key} native binary)`,
    license: rootManifest.license,
    author: rootManifest.author,
    homepage: rootManifest.homepage,
    repository: rootManifest.repository,
    bugs: rootManifest.bugs,
    os: [platform.os],
    cpu: [platform.cpu],
    files: ["bin", "README.md", "LICENSE"],
    bin: { "jira-flow": `bin/${platform.binary}` },
    publishConfig: { access: "public", provenance: true },
  });
  nativeTarballs.set(key, pack(stage));
}

const universalStage = join(stagingRoot, rootManifest.name);
rmSync(universalStage, { recursive: true, force: true });
mkdirSync(join(universalStage, "npm"), { recursive: true });
copyFileSync(join(projectRoot, "npm", "launcher.cjs"), join(universalStage, "npm", "launcher.cjs"));
chmodSync(join(universalStage, "npm", "launcher.cjs"), 0o755);
copyFileSync(
  join(projectRoot, "npm", "platforms.json"),
  join(universalStage, "npm", "platforms.json"),
);
copyCommonFiles(universalStage);
const optionalDependencies = local
  ? Object.fromEntries(
      targets.map((key) => {
        const platform = NATIVE_PLATFORMS[key];
        const tarball = nativeTarballs.get(key);
        if (!platform || !tarball) throw new Error(`missing local package for ${key}`);
        return [platform.package, pathToFileURL(tarball).href];
      }),
    )
  : Object.fromEntries(
      Object.values(NATIVE_PLATFORMS).map((platform) => [platform.package, rootManifest.version]),
    );
writeJson(join(universalStage, "package.json"), {
  name: rootManifest.name,
  version: rootManifest.version,
  description: rootManifest.description,
  license: rootManifest.license,
  author: rootManifest.author,
  homepage: rootManifest.homepage,
  repository: rootManifest.repository,
  bugs: rootManifest.bugs,
  type: "module",
  files: ["npm", "README.md", "LICENSE"],
  bin: { "jira-flow": "npm/launcher.cjs" },
  engines: { node: ">=18" },
  optionalDependencies,
  publishConfig: { access: "public", provenance: true },
});
const universalTarball = pack(universalStage);
process.stdout.write(`Universal package: ${universalTarball}\n`);

function copyCommonFiles(destination: string): void {
  copyFileSync(join(projectRoot, "README.md"), join(destination, "README.md"));
  copyFileSync(join(projectRoot, "LICENSE"), join(destination, "LICENSE"));
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function pack(stage: string): string {
  const result = Bun.spawnSync(
    ["npm", "pack", stage, "--json", "--pack-destination", packageRoot],
    { cwd: projectRoot, stdout: "pipe", stderr: "pipe" },
  );
  if (result.exitCode !== 0) {
    throw new Error(`npm pack failed: ${result.stderr.toString()}`);
  }
  const output = JSON.parse(result.stdout.toString()) as Array<{ filename: string }>;
  const filename = output[0]?.filename;
  if (!filename) throw new Error("npm pack did not return a filename");
  return join(packageRoot, filename);
}
