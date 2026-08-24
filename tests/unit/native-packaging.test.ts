import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NATIVE_PLATFORMS } from "../../scripts/native-platforms";

const root = join(import.meta.dir, "../..");

describe("native packaging contract", () => {
  test("declares the required matrix plus validated arm64 targets", () => {
    expect(Object.keys(NATIVE_PLATFORMS).sort()).toEqual([
      "darwin-arm64",
      "darwin-x64",
      "linux-arm64",
      "linux-x64",
      "win32-arm64",
      "win32-x64",
    ]);
    expect(new Set(Object.values(NATIVE_PLATFORMS).map((target) => target.package)).size).toBe(6);
    expect(NATIVE_PLATFORMS["linux-x64"]?.bunTarget).toContain("baseline");
    expect(NATIVE_PLATFORMS["darwin-x64"]?.bunTarget).toContain("baseline");
    expect(NATIVE_PLATFORMS["win32-x64"]?.bunTarget).toContain("baseline");
  });

  test("the source package has no install lifecycle or runtime downloader", () => {
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(manifest.scripts?.preinstall).toBeUndefined();
    expect(manifest.scripts?.install).toBeUndefined();
    expect(manifest.scripts?.postinstall).toBeUndefined();

    const launcher = readFileSync(join(root, "npm", "launcher.cjs"), "utf8");
    expect(launcher).toContain("require.resolve");
    expect(launcher).toContain("package version mismatch");
    expect(launcher).toContain("toNamespacedPath");
    expect(launcher).not.toContain("fetch(");
    expect(launcher).not.toContain("shell: true");
  });

  test("every target uses the one jira-flow executable contract", () => {
    for (const [key, target] of Object.entries(NATIVE_PLATFORMS)) {
      expect(target.package).toBe(`jira-flow-${key}`);
      expect(target.binary).toBe(target.os === "win32" ? "jira-flow.exe" : "jira-flow");
    }
  });

  test("only the universal package exposes the jira-flow command", () => {
    const packagingScript = readFileSync(join(root, "scripts", "package-native.ts"), "utf8");
    expect(packagingScript.match(/bin: \{ "jira-flow":/g)).toHaveLength(1);
  });
});
