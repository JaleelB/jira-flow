import { describe, expect, test } from "bun:test";
import type { LegacyHookSnapshot } from "../../src/application/ports/legacy-hooks.port";
import { MigrateLegacyRepository } from "../../src/application/use-cases/migrate-legacy-repository";

const snapshot: LegacyHookSnapshot = {
  hooksDir: "/repo/.git/hooks",
  hooks: {
    "commit-msg": { kind: "file", content: '#!/bin/sh\n/bin/commitmsg "$@"', executable: true },
    "post-checkout": { kind: "symlink", target: "/bin/postco" },
  },
};

function inspection(overrides: Record<string, unknown> = {}) {
  return {
    repoPath: "/repo",
    hooksDir: snapshot.hooksDir,
    detected: true,
    eligible: true,
    defaultMode: "hybrid" as const,
    changes: [],
    legacyHooks: ["commit-msg", "post-checkout"] as const,
    ambiguousPaths: [],
    snapshot,
    ...overrides,
  };
}

describe("MigrateLegacyRepository", () => {
  test("removes only recognized names and initializes enabled Hybrid", async () => {
    const calls: string[] = [];
    const migrate = new MigrateLegacyRepository({
      inspect: { execute: async () => inspection() } as never,
      legacyHooks: {
        capture: async () => snapshot,
        removeVerified: async (_snapshot, names) => {
          calls.push(`remove:${names.join(",")}`);
        },
        restore: async () => {
          calls.push("restore");
        },
      },
      initialize: {
        execute: async (input: { mode?: string }) => {
          calls.push(`init:${input.mode}`);
          return {
            outcome: "initialized",
            repoPath: "/repo",
            hook: { strategy: "owned", hookPath: "/repo/.git/hooks/commit-msg", created: true },
          };
        },
      } as never,
    });
    const result = await migrate.execute({ path: "/repo" });
    expect(result.mode).toBe("hybrid");
    expect(calls).toEqual(["remove:commit-msg,post-checkout", "init:hybrid"]);
  });

  test("restores exact legacy artifacts when v1 initialization fails", async () => {
    const calls: string[] = [];
    const migrate = new MigrateLegacyRepository({
      inspect: { execute: async () => inspection() } as never,
      legacyHooks: {
        capture: async () => snapshot,
        removeVerified: async () => {
          calls.push("remove");
        },
        restore: async (_snapshot, names) => {
          calls.push(`restore:${names.join(",")}`);
        },
      },
      initialize: { execute: async () => Promise.reject(new Error("install failed")) } as never,
    });
    await expect(migrate.execute({ path: "/repo" })).rejects.toThrow("install failed");
    expect(calls).toEqual(["remove", "restore:commit-msg,post-checkout"]);
  });

  test("ambiguous hooks refuse before removal", async () => {
    let removed = false;
    const migrate = new MigrateLegacyRepository({
      inspect: {
        execute: async () =>
          inspection({ eligible: false, ambiguousPaths: ["/repo/.git/hooks/post-checkout"] }),
      } as never,
      legacyHooks: {
        capture: async () => snapshot,
        removeVerified: async () => {
          removed = true;
        },
        restore: async () => {},
      },
      initialize: { execute: async () => Promise.reject(new Error("not reached")) } as never,
    });
    await expect(migrate.execute({ path: "/repo" })).rejects.toMatchObject({
      code: "LEGACY_HOOK_AMBIGUOUS",
    });
    expect(removed).toBe(false);
  });
});
