import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, lstatSync, mkdtempSync, readlinkSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LegacyHookStore } from "../../../src/infrastructure/hooks/legacy-hook-store";

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function makeHooksDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "jiraflow-legacy-hooks-"));
  dirs.push(dir);
  return dir;
}

describe("LegacyHookStore", () => {
  test("round-trips exact file bytes, executable mode, and relative symlink target", async () => {
    const hooksDir = makeHooksDir();
    const commitPath = join(hooksDir, "commit-msg");
    const postPath = join(hooksDir, "post-checkout");
    const content = '#!/bin/sh\n/opt/bin/commitmsg "$@"';
    await Bun.write(commitPath, content);
    chmodSync(commitPath, 0o755);
    symlinkSync("../../bin/postco", postPath);
    const store = new LegacyHookStore();

    const snapshot = await store.capture(hooksDir);
    await store.removeVerified(snapshot, ["commit-msg", "post-checkout"]);
    expect(await Bun.file(commitPath).exists()).toBe(false);
    await store.restore(snapshot, ["commit-msg", "post-checkout"]);

    expect(await Bun.file(commitPath).text()).toBe(content);
    if (process.platform !== "win32") {
      expect(lstatSync(commitPath).mode & 0o111).not.toBe(0);
    }
    expect(readlinkSync(postPath)).toBe("../../bin/postco");
  });

  test("refuses removal when either hook changed after capture", async () => {
    const hooksDir = makeHooksDir();
    const commitPath = join(hooksDir, "commit-msg");
    const original = '#!/bin/sh\n/opt/bin/commitmsg "$@"';
    await Bun.write(commitPath, original);
    const store = new LegacyHookStore();
    const snapshot = await store.capture(hooksDir);
    await Bun.write(commitPath, `${original}\nforeign`);

    await expect(store.removeVerified(snapshot, ["commit-msg"])).rejects.toThrow(
      "changed after inspection",
    );
    expect(await Bun.file(commitPath).text()).toBe(`${original}\nforeign`);
  });
});
