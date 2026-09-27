import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..", "..", "..");

function verify(args: string[]): { exitCode: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync(
    [process.execPath, join(root, "scripts", "verify-release.ts"), ...args],
    {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

describe("release version and automation contract", () => {
  test("source, Release Please, tag, and stable channel agree", () => {
    const result = verify(["--tag", "v1.0.0", "--channel", "latest"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("1.0.0 (latest)");
  });

  test("version and prerelease-channel drift are hard failures", () => {
    expect(verify(["--tag", "v1.0.1", "--channel", "latest"]).exitCode).not.toBe(0);
    expect(verify(["--tag", "v1.0.0", "--channel", "next"]).exitCode).not.toBe(0);
  });

  test("publishing is manual, protected, OIDC-only, and universal-last", () => {
    const publish = readFileSync(join(root, ".github", "workflows", "publish.yml"), "utf8");
    expect(publish).toContain("workflow_dispatch:");
    expect(publish).toContain("options: [1.0.0]");
    expect(publish).toContain("environment: release");
    expect(publish).toContain("id-token: write");
    expect(publish).toContain("refs/heads/main");
    expect(publish).toContain("jira-flow-candidate-");
    expect(publish).toContain("actions/download-artifact@v4");
    expect(publish).not.toContain("NPM_TOKEN");
    expect(publish).not.toContain("options: [next, latest]");
    expect(publish.indexOf("Publish native npm packages")).toBeLessThan(
      publish.indexOf("Publish universal npm package"),
    );

    const candidate = readFileSync(join(root, ".github", "workflows", "candidate.yml"), "utf8");
    expect(candidate).toContain("workflow_dispatch:");
    expect(candidate).toContain("refs/heads/main");
    expect(candidate).toContain("actions/upload-artifact@v4");
    expect(candidate).not.toContain("npm publish");

    const releasePlease = readFileSync(
      join(root, ".github", "workflows", "release-please.yml"),
      "utf8",
    );
    expect(releasePlease).toContain("skip-github-release: true");
    expect(releasePlease).toContain("initial_v1_release");
  });

  test("real-Git and package smoke matrices exercise all six native targets", () => {
    const integration = readFileSync(join(root, ".github", "workflows", "integration.yml"), "utf8");
    for (const runner of ["ubuntu-24.04-arm", "macos-15", "macos-15-intel", "windows-11-arm"]) {
      expect(integration).toContain(runner);
    }
    expect(integration).toContain("Linux x64");
    expect(integration).toContain("Windows x64");

    const packageSmoke = readFileSync(
      join(root, ".github", "workflows", "package-smoke.yml"),
      "utf8",
    );
    for (const platform of [
      "linux-arm64",
      "linux-x64",
      "darwin-arm64",
      "darwin-x64",
      "win32-arm64",
      "win32-x64",
    ]) {
      expect(packageSmoke).toContain(platform);
    }
  });

  test("Windows ARM64 builds use an OpenTUI FFI-capable Bun toolchain", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      packageManager: string;
    };
    expect(packageJson.packageManager).toBe("bun@1.4.2");

    for (const workflow of [
      "ci.yml",
      "integration.yml",
      "package-smoke.yml",
      "candidate.yml",
      "publish.yml",
    ]) {
      const contents = readFileSync(join(root, ".github", "workflows", workflow), "utf8");
      expect(contents).toContain("bun-version: 1.4.2");
    }

    const packageSmoke = readFileSync(
      join(root, ".github", "workflows", "package-smoke.yml"),
      "utf8",
    );
    expect(packageSmoke).toContain("bun-version: 1.4.0");
  });

  test("release notes list the six archives and legacy release boundary", () => {
    const notes = readFileSync(join(root, "docs", "releases", "v1.0.0.md"), "utf8");
    for (const platform of [
      "darwin-arm64",
      "darwin-x64",
      "linux-arm64",
      "linux-x64",
      "win32-arm64",
      "win32-x64",
    ]) {
      expect(notes).toContain(platform);
    }
    expect(notes).toContain("final legacy Go release");
    expect(notes).toContain("SHA256SUMS");
  });

  test("obsolete release systems remain absent", () => {
    expect(existsSync(join(root, ".changeset"))).toBe(false);
    expect(existsSync(join(root, ".goreleaser.yml"))).toBe(false);
    expect(existsSync(join(root, ".github", "workflows", "release.yml"))).toBe(false);
  });
});
