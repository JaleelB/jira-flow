import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GLOBAL_SETTING_KEYS } from "../../src/application/ports/settings.port";
import { CONFIG_KEYS } from "../../src/application/use-cases/manage-config";
import { SCREEN_IDS } from "../../src/tui/navigation";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

describe("published documentation contract", () => {
  test("every local README link resolves", () => {
    const readme = read("README.md");
    const targets = [...readme.matchAll(/\[[^\]]+\]\((?!https?:)([^)#]+)(?:#[^)]+)?\)/g)].map(
      (match) => match[1] as string,
    );

    expect(targets.length).toBeGreaterThan(10);
    for (const target of targets) {
      expect(existsSync(resolve(root, target))).toBe(true);
    }
  });

  test("CLI reference covers the complete public command and configuration surface", () => {
    const cli = read("docs/cli-reference.md");
    const commands = [
      "init",
      "status",
      "doctor",
      "link",
      "unlink",
      "mode",
      "enable",
      "disable",
      "remove",
      "config",
      "repositories",
      "pr-title",
      "migrate",
    ];

    for (const command of commands) expect(cli).toContain(`jira-flow ${command}`);
    for (const key of CONFIG_KEYS) expect(cli).toContain(`\`${key}\``);
    for (const key of GLOBAL_SETTING_KEYS) expect(cli).toContain(`\`${key}\``);
    expect(cli).toContain("schemaVersion: 1");
  });

  test("TUI guide covers the exact S1-S14 screen map", () => {
    const tui = read("docs/tui.md");
    const ids = Object.values(SCREEN_IDS);

    expect(ids).toHaveLength(14);
    for (const id of ids) expect(tui).toContain(`| ${id} |`);
  });

  test("safety-sensitive behavior has dedicated operator guidance", () => {
    expect(read("docs/doctor-and-removal.md")).toContain(
      "bytes match the generated owned structure",
    );
    expect(read("docs/migration/v0.5-to-v1.md")).toContain("exact POSIX");
    expect(read("docs/installation.md")).toContain("no install lifecycle scripts");
    expect(read("docs/troubleshooting.md")).toContain("Bun global command says `node` is missing");
  });
});
