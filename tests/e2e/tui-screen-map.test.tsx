import { describe, expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
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
      expect(frame).toContain(`${SCREEN_IDS[route.name]} · JIRAFLOW`);
      expect(frame).toContain(screenDefinition(route).title);
      setup.renderer.destroy();
    }
  });
});
