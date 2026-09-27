import { describe, expect, test } from "bun:test";
import { insertManagedBlockAfterShebang } from "../../src/infrastructure/hooks/compose-shell-hook";
import { analyzeCommitMsgHook } from "../../src/infrastructure/hooks/hook-analyzer";
import {
  generateManagedBlock,
  generateOwnedHookScript,
} from "../../src/infrastructure/hooks/hook-script";

describe("analyzeCommitMsgHook", () => {
  test("null is missing", () => {
    expect(analyzeCommitMsgHook(null)).toEqual({ status: "missing" });
  });

  test("owned generated script", () => {
    const content = generateOwnedHookScript({ binaryPath: "/opt/jira-flow" });
    expect(analyzeCommitMsgHook(content).status).toBe("owned");
  });

  test("managed-block when extra body exists", () => {
    const block = generateManagedBlock({ binaryPath: "/opt/jira-flow" });
    const content = insertManagedBlockAfterShebang("#!/bin/sh\necho foreign\nexit 0\n", block);
    expect(analyzeCommitMsgHook(content).status).toBe("managed-block");
  });

  test("composable sh/bash/zsh/dash including env form", () => {
    expect(analyzeCommitMsgHook("#!/bin/sh\nexit 0\n").status).toBe("composable-shell");
    expect(analyzeCommitMsgHook("#!/bin/bash\nset -e\nexit 0\n").status).toBe("composable-shell");
    expect(analyzeCommitMsgHook("#!/usr/bin/env zsh\nexit 0\n").status).toBe("composable-shell");
    expect(analyzeCommitMsgHook("#!/usr/bin/env dash\nexit 0\n").status).toBe("composable-shell");
  });

  test("python shebang is unsupported", () => {
    const result = analyzeCommitMsgHook("#!/usr/bin/env python\nprint(1)\n");
    expect(result.status).toBe("unsupported");
  });

  test("binary ELF is unsupported", () => {
    const result = analyzeCommitMsgHook(`\x7fELF${"\0".repeat(8)}`);
    expect(result.status).toBe("unsupported");
  });

  test("damaged markers are malformed-jiraflow", () => {
    const content = generateOwnedHookScript({ binaryPath: "/x" }).replace(
      "# <<< jiraflow managed block v1",
      "# broken",
    );
    expect(analyzeCommitMsgHook(content).status).toBe("malformed-jiraflow");
  });

  test("set -e shell hook is still composable", () => {
    const result = analyzeCommitMsgHook("#!/bin/bash\nset -e\necho hi\n");
    expect(result.status).toBe("composable-shell");
    if (result.status === "composable-shell") {
      expect(result.interpreter).toBe("bash");
    }
  });
});
