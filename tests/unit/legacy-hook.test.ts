import { describe, expect, test } from "bun:test";
import { classifyLegacyHook } from "../../src/domain/legacy-hook";
import fixtures from "../fixtures/legacy-v0.5/hooks.json";

describe("exact JiraFlow v0.5 hook signatures", () => {
  test("recognizes frozen POSIX and Windows wrappers", () => {
    expect(
      classifyLegacyHook("commit-msg", {
        kind: "file",
        content: fixtures.commitMsg,
        executable: true,
      }).kind,
    ).toBe("legacy-wrapper");
    expect(
      classifyLegacyHook("post-checkout", {
        kind: "file",
        content: fixtures.postCheckout,
        executable: true,
      }).kind,
    ).toBe("legacy-wrapper");
    expect(
      classifyLegacyHook("commit-msg", {
        kind: "file",
        content: fixtures.windowsCommitMsg,
        executable: true,
      }).kind,
    ).toBe("legacy-wrapper");
  });

  test("recognizes only matching helper symlink targets", () => {
    expect(
      classifyLegacyHook("commit-msg", { kind: "symlink", target: "/npm/bin/commitmsg" }).kind,
    ).toBe("legacy-helper-symlink");
    expect(
      classifyLegacyHook("post-checkout", { kind: "symlink", target: "C:\\bin\\postco.exe" }).kind,
    ).toBe("legacy-helper-symlink");
    expect(
      classifyLegacyHook("commit-msg", { kind: "symlink", target: "/usr/bin/foreign" }).kind,
    ).toBe("unknown");
  });

  test("refuses extra content, wrong helpers, and shell syntax", () => {
    for (const content of [
      `${fixtures.commitMsg}\n`,
      `${fixtures.commitMsg}\necho foreign`,
      '#!/bin/sh\n/usr/local/bin/postco "$@"',
      '#!/bin/sh\n/usr/local/bin/commitmsg; rm -rf / "$@"',
    ]) {
      expect(
        classifyLegacyHook("commit-msg", { kind: "file", content, executable: true }).kind,
      ).toBe("unknown");
    }
  });
});
