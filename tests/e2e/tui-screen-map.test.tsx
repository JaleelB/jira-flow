import { describe, expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { act } from "react";
import { parseJiraKey } from "../../src/domain/issue-key";
import { App } from "../../src/tui/app";
import type { TuiServices } from "../../src/tui/app-context";
import { SCREEN_IDS, type TuiRoute } from "../../src/tui/navigation";
import { screenDefinition } from "../../src/tui/screen-models";

const routes: TuiRoute[] = [
  { name: "empty-state" },
  { name: "unconfigured-repo", repoPath: "/repo" },
  { name: "global-dashboard" },
  { name: "repository-overview", repoId: "repo-1", repoPath: "/repo" },
  { name: "setup", repoPath: "/repo" },
  { name: "setup-customization", repoPath: "/repo" },
  { name: "link-issue", repoId: "repo-1", repoPath: "/repo" },
  { name: "mode-selection", repoId: "repo-1", repoPath: "/repo" },
  { name: "workflow-settings", repoId: "repo-1", repoPath: "/repo" },
  { name: "pr-title", repoId: "repo-1", repoPath: "/repo" },
  { name: "doctor", repoId: "repo-1", repoPath: "/repo" },
  { name: "global-settings" },
  { name: "missing-repository", repoId: "repo-1", repoPath: "/missing" },
  { name: "remove-confirmation", repoId: "repo-1", repoPath: "/repo" },
];

function snapshotFrame(frame: string): string {
  return frame
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd();
}

const services: TuiServices = {
  getStartupContext: async () => ({ kind: "empty-state" }),
  getRepositoryStatus: async ({ path }) => ({
    repoPath: path,
    repoName: "repo",
    enabled: true,
    mode: "hybrid",
    branch: "main",
    branchIssue: null,
    linkedIssue: null,
    activeIssue: null,
    commitFormat: "footer",
    issuePattern: "[A-Z][A-Z0-9]+-\\d+",
    integration: { status: "owned" },
  }),
  listRepositories: async () => ({
    schemaVersion: 1,
    repositories: [
      {
        id: "repo-1",
        path: "/repo",
        displayName: "repo",
        remoteUrl: null,
        mode: "hybrid",
        activeIssue: null,
        health: "healthy",
        branch: "main",
        enabled: true,
        lastSeenAt: null,
        lastOpenedAt: null,
        lastSyncAt: null,
      },
    ],
  }),
  initializeRepository: async () => ({}),
  linkIssue: async () => ({}),
  unlinkIssue: async () => ({}),
  setMode: async () => ({}),
  setEnabled: async () => ({}),
  generatePrTitle: async () => ({
    value: "ABC-123: Story",
    variables: {},
    copied: true,
    storyTitleSource: "option",
  }),
  runDoctor: async ({ path }) => ({ repoPath: path, overall: "healthy", checks: [] }),
  repairRepository: async () => ({}),
  removeRepository: async () => ({}),
  manageConfig: async () => ({
    effective: {
      enabled: true,
      mode: "hybrid",
      issuePattern: "[A-Z][A-Z0-9]+-\\d+",
      commitFormat: "footer",
      prTitleTemplate: "{jiraKey}: {storyTitle}",
      dateFormat: "yyyy-MM-dd",
    },
    sources: {
      enabled: "repo",
      mode: "global",
      issuePattern: "global",
      commitFormat: "global",
      prTitleTemplate: "global",
      dateFormat: "global",
    },
  }),
  getGlobalSettings: async () => ({
    defaultMode: "hybrid",
    defaultIssuePattern: "[A-Z][A-Z0-9]+-\\d+",
    defaultCommitFormat: "footer",
    defaultPrTitleTemplate: "{jiraKey}: {storyTitle}",
    defaultDateFormat: "yyyy-MM-dd",
    copyPrTitleToClipboard: true,
    theme: "system",
    lastSelectedRepositoryId: null,
  }),
  setGlobalSetting: async () => {},
  locateRepository: async () => {},
  forgetRepository: async () => true,
  inspectLegacyRepository: async ({ path }) => ({
    repoPath: path,
    hooksDir: `${path}/.git/hooks`,
    detected: false,
    eligible: false,
    defaultMode: "hybrid",
    changes: [],
    legacyHooks: [],
    ambiguousPaths: [],
    snapshot: {
      hooksDir: `${path}/.git/hooks`,
      hooks: { "commit-msg": { kind: "missing" }, "post-checkout": { kind: "missing" } },
    },
  }),
  migrateLegacyRepository: async ({ path }) => ({
    repoPath: path,
    removedLegacyHooks: ["commit-msg", "post-checkout"],
    mode: "hybrid",
    initialization: {
      outcome: "initialized",
      repoPath: path,
      hook: { strategy: "owned", hookPath: `${path}/.git/hooks/commit-msg`, created: true },
    },
  }),
};

describe("complete TUI screen map", () => {
  test("renders S1-S14 through the application facade", async () => {
    for (const route of routes) {
      const setup = await testRender(
        <App
          services={services}
          initialContext={{ kind: "empty-state" }}
          initialRoute={route}
          onQuit={() => {}}
        />,
        { width: 90, height: 28 },
      );
      await setup.waitForVisualIdle();
      const frame = setup.captureCharFrame();
      expect(frame).toContain("◆ JIRAFLOW");
      expect(frame).toContain(SCREEN_IDS[route.name]);
      expect(frame).toContain(screenDefinition(route).title);
      setup.renderer.destroy();
    }
  });

  test("gives the repository overview a ticket-led workbench hierarchy", async () => {
    const setup = await testRender(
      <App
        services={{
          ...services,
          getRepositoryStatus: async ({ path }) => ({
            ...(await services.getRepositoryStatus({ path })),
            branch: "feat/ABC-123-login",
            branchIssue: parseJiraKey("ABC-123"),
            linkedIssue: parseJiraKey("OPS-42"),
            activeIssue: { key: parseJiraKey("OPS-42"), source: "override" },
          }),
        }}
        initialContext={{ kind: "empty-state" }}
        initialRoute={{ name: "repository-overview", repoPath: "/repo" }}
        onQuit={() => {}}
      />,
      { width: 100, height: 30 },
    );
    await setup.waitForVisualIdle();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("ACTIVE TICKET");
    expect(frame).toContain("OPS-42");
    expect(frame).toContain("WORKFLOW");
    expect(frame).toContain("REPOSITORY");
    expect(frame).toMatch(/Name\s+repo/);
    expect(frame).toContain("feat/ABC-123-login");
    expect(snapshotFrame(frame)).toMatchSnapshot();
    setup.renderer.destroy();
  });

  test("moves and opens the highlighted dashboard repository", async () => {
    const setup = await testRender(
      <App
        services={{
          ...services,
          listRepositories: async () => ({
            schemaVersion: 1,
            repositories: [
              ...(await services.listRepositories({ refresh: true })).repositories,
              {
                id: "repo-2",
                path: "/moved/repo",
                displayName: "moved-repo",
                remoteUrl: null,
                mode: "manual",
                activeIssue: "OPS-42",
                health: "missing",
                branch: null,
                enabled: true,
                lastSeenAt: null,
                lastOpenedAt: null,
                lastSyncAt: null,
              },
            ],
          }),
        }}
        initialContext={{ kind: "empty-state" }}
        initialRoute={{ name: "global-dashboard" }}
        onQuit={() => {}}
      />,
      { width: 90, height: 28 },
    );
    await setup.waitForVisualIdle();
    await act(async () => {
      setup.mockInput.pressArrow("down");
      await setup.flush();
    });
    await act(async () => {
      setup.mockInput.pressEnter();
      await setup.flush();
    });
    await setup.waitForVisualIdle();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("Missing Repository");
    expect(frame).toContain("/moved/repo");
    setup.renderer.destroy();
  });

  test("translates Doctor implementation ids into user-facing checks", async () => {
    const setup = await testRender(
      <App
        services={{
          ...services,
          runDoctor: async ({ path }) => ({
            repoPath: path,
            overall: "warning",
            checks: [
              { id: "hooks.integration", status: "warning", detail: "commit-msg hook is missing" },
            ],
          }),
        }}
        initialContext={{ kind: "empty-state" }}
        initialRoute={{ name: "doctor", repoPath: "/repo" }}
        onQuit={() => {}}
      />,
      { width: 90, height: 28 },
    );
    await setup.waitForVisualIdle();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("Commit hook integration");
    expect(frame).not.toContain("hooks.integration");
    setup.renderer.destroy();
  });

  test("keeps a long Doctor ledger inside its panel and scrolls through every check", async () => {
    const checks = [
      "git.repository",
      "config.valid",
      "worktree.state",
      "registry.sync",
      "hooks.path",
      "legacy.v0.5",
      "hooks.integration",
      "hooks.ownership",
      "hooks.foreign-preserved",
      "binary.reachable",
      "issue.pattern",
      "mode.valid",
      "active-issue.resolve",
    ].map((id) => ({ id, status: "pass" as const, detail: `detail for ${id}` }));
    const setup = await testRender(
      <App
        services={{
          ...services,
          runDoctor: async ({ path }) => ({
            repoPath: path,
            overall: "healthy",
            checks,
          }),
        }}
        initialContext={{ kind: "empty-state" }}
        initialRoute={{ name: "doctor", repoPath: "/repo" }}
        onQuit={() => {}}
      />,
      { width: 100, height: 28 },
    );
    await setup.waitForVisualIdle();

    const firstFrame = setup.captureCharFrame();
    expect(firstFrame).toContain("CHECKS · 13");
    expect(firstFrame).toContain("↑↓ Scroll checks");
    expect(firstFrame).not.toContain("Active issue resolution");

    await act(async () => {
      for (let index = 0; index < 30; index += 1) setup.mockInput.pressArrow("down");
      await setup.flush();
    });
    await setup.waitForVisualIdle();

    const scrolledFrame = setup.captureCharFrame();
    expect(scrolledFrame).toContain("Active issue resolution");
    expect(scrolledFrame).toContain("↑↓ Scroll checks");
    setup.renderer.destroy();
  });

  test("stacks mode controls without losing actions in a narrow terminal", async () => {
    const setup = await testRender(
      <App
        services={services}
        initialContext={{ kind: "empty-state" }}
        initialRoute={{ name: "mode-selection", repoPath: "/repo" }}
        onQuit={() => {}}
      />,
      { width: 60, height: 28 },
    );
    await setup.waitForVisualIdle();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("1 Hybrid");
    expect(frame).toContain("2 Branch");
    expect(frame).toContain("3 Manual");
    expect(frame).toContain("Esc Cancel");
    expect(snapshotFrame(frame)).toMatchSnapshot();
    setup.renderer.destroy();
  });
});
