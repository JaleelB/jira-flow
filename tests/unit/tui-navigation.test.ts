import { describe, expect, test } from "bun:test";
import {
  createNavigationState,
  navigationReducer,
  routeFromStartup,
  SCREEN_IDS,
  type TuiRoute,
} from "../../src/tui/navigation";
import { parityRows, screenDefinition } from "../../src/tui/screen-models";

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

describe("TUI navigation", () => {
  test("preserves typed history across push, help, and back", () => {
    let state = createNavigationState({ name: "global-dashboard" });
    state = navigationReducer(state, {
      type: "push",
      route: { name: "repository-overview", repoPath: "/repo" },
    });
    state = navigationReducer(state, { type: "toggle-help" });
    expect(state.helpVisible).toBe(true);
    state = navigationReducer(state, { type: "back" });
    expect(state.current.name).toBe("repository-overview");
    expect(state.helpVisible).toBe(false);
    state = navigationReducer(state, { type: "back" });
    expect(state.current.name).toBe("global-dashboard");
    expect(state.history).toEqual([]);
  });

  test("maps every startup context to its required first screen", () => {
    expect(routeFromStartup({ kind: "empty-state" }).name).toBe("empty-state");
    expect(routeFromStartup({ kind: "global-dashboard" }).name).toBe("global-dashboard");
    expect(routeFromStartup({ kind: "unconfigured-repo", repoPath: "/repo" }).name).toBe(
      "unconfigured-repo",
    );
    expect(
      routeFromStartup({ kind: "repository-overview", status: { repoPath: "/repo" } }).name,
    ).toBe("repository-overview");
  });
});

describe("TUI screen contract", () => {
  test("declares all and only S1-S14 with visible actions", () => {
    expect(Object.keys(SCREEN_IDS)).toHaveLength(14);
    const actualIds: string[] = [...new Set(Object.values(SCREEN_IDS))].sort();
    expect(actualIds).toEqual(Array.from({ length: 14 }, (_, index) => `S${index + 1}`).sort());
    for (const route of routes) {
      const definition = screenDefinition(route);
      expect(definition.id).toBe(SCREEN_IDS[route.name]);
      expect(definition.title.length).toBeGreaterThan(0);
      expect(definition.actions.length).toBeGreaterThan(0);
    }
  });

  test("records a headless equivalent for every mutating management action", () => {
    const rows = parityRows();
    expect(rows.map((row) => row.action)).toContain("Initialize");
    expect(rows.map((row) => row.action)).toContain("Remove");
    expect(rows.map((row) => row.action)).toContain("Generate PR title");
    expect(rows.every((row) => row.headless.length > 0)).toBe(true);
  });
});
