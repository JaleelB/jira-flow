import { describe, expect, test } from "bun:test";
import { BUILT_IN_GLOBAL_SETTINGS } from "../../src/application/services/effective-config";
import { GeneratePrTitle } from "../../src/application/use-cases/generate-pr-title";

const repo = {
  root: "/repo",
  gitDir: "/repo/.git",
  commonGitDir: "/repo/.git",
  isLinkedWorktree: false,
};
const config = {
  enabled: true,
  mode: "hybrid" as const,
  issuePattern: null,
  commitFormat: "footer" as const,
  prTitleTemplate: null,
  dateFormat: null,
};

function makeUseCase(copy: () => Promise<{ copied: boolean; warning?: string }>) {
  return new GeneratePrTitle({
    git: {
      async discoverRepository() {
        return repo;
      },
      async getCurrentBranch() {
        return "feat/ABC-1";
      },
      async getRemoteUrl() {
        return null;
      },
      async resolveHooks() {
        return {
          hooksDir: "/repo/.git/hooks",
          commitMsgPath: "/repo/.git/hooks/commit-msg",
          hooksPathOrigin: "unknown" as const,
        };
      },
    },
    config: {
      async read() {
        return config;
      },
      async setEnabled() {},
      async setMode() {},
      async setCommitFormat() {},
      async setIssuePattern() {},
      async setPrTitleTemplate() {},
      async setDateFormat() {},
      async unset() {},
      async removeAll() {},
    },
    status: {
      async execute() {
        return {
          repoPath: "/repo",
          repoName: "repo",
          enabled: true,
          mode: "hybrid" as const,
          branch: "feat/ABC-1",
          branchIssue: "ABC-1" as never,
          linkedIssue: null,
          activeIssue: { key: "ABC-1" as never, source: "branch" as const },
          commitFormat: "footer" as const,
          issuePattern: "[A-Z]+-\\d+",
          integration: { status: "owned" as const },
        };
      },
    } as never,
    registry: {
      async findByPath() {
        return {
          id: "repo-id",
          path: "/repo",
          displayName: "repo",
          remoteUrl: null,
          createdAt: 1,
          updatedAt: 1,
        };
      },
    } as never,
    metadata: {
      async find() {
        return null;
      },
      async save() {
        throw new Error("cache unavailable");
      },
    },
    settings: {
      async read() {
        return { ...BUILT_IN_GLOBAL_SETTINGS };
      },
    } as never,
    clipboard: { copy },
    prompt: {
      async prompt() {
        return null;
      },
    },
    now: () => new Date(2026, 7, 23),
  });
}

describe("GeneratePrTitle", () => {
  test("clipboard exceptions and metadata cache failures are nonfatal", async () => {
    const useCase = makeUseCase(async () => {
      throw new Error("no clipboard");
    });
    const result = await useCase.execute({ path: "/repo", title: "Story" });
    expect(result.value).toBe("ABC-1 | 2026-08-23 | Q3 | Story");
    expect(result.copied).toBe(false);
    expect(result.warning).toContain("clipboard unavailable");
  });
});
