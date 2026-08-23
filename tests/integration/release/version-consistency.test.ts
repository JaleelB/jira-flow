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
  test("source, Release Please, tag, and prerelease channel agree", () => {
    const result = verify(["--tag", "v1.0.0-alpha.0", "--channel", "next"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("1.0.0-alpha.0 (next)");
  });

  test("version and channel drift are hard failures", () => {
    expect(verify(["--tag", "v1.0.0-alpha.1", "--channel", "next"]).exitCode).not.toBe(0);
    expect(verify(["--tag", "v1.0.0-alpha.0", "--channel", "latest"]).exitCode).not.toBe(0);
  });

  test("publishing is manual, protected, OIDC-only, and universal-last", () => {
    const publish = readFileSync(join(root, ".github", "workflows", "publish.yml"), "utf8");
    expect(publish).toContain("workflow_dispatch:");
    expect(publish).toContain("environment: release");
    expect(publish).toContain("id-token: write");
    expect(publish).toContain("refs/heads/main");
    expect(publish).not.toContain("NPM_TOKEN");
    expect(publish.indexOf("Publish native npm packages")).toBeLessThan(
      publish.indexOf("Publish universal npm package"),
    );

    const releasePlease = readFileSync(
      join(root, ".github", "workflows", "release-please.yml"),
      "utf8",
    );
    expect(releasePlease).toContain("skip-github-release: true");
  });

  test("obsolete release systems remain absent", () => {
    expect(existsSync(join(root, ".changeset"))).toBe(false);
    expect(existsSync(join(root, ".goreleaser.yml"))).toBe(false);
    expect(existsSync(join(root, ".github", "workflows", "release.yml"))).toBe(false);
  });
});
