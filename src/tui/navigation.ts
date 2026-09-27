export type TuiRoute =
  | { name: "empty-state" }
  | { name: "unconfigured-repo"; repoPath: string }
  | { name: "global-dashboard" }
  | { name: "repository-overview"; repoId?: string; repoPath: string }
  | { name: "setup"; repoPath: string }
  | { name: "setup-customization"; repoPath: string }
  | { name: "link-issue"; repoId?: string; repoPath: string }
  | { name: "mode-selection"; repoId?: string; repoPath: string }
  | { name: "workflow-settings"; repoId?: string; repoPath: string }
  | { name: "pr-title"; repoId?: string; repoPath: string }
  | { name: "doctor"; repoId?: string; repoPath?: string }
  | { name: "global-settings" }
  | { name: "missing-repository"; repoId: string; repoPath: string }
  | { name: "remove-confirmation"; repoId?: string; repoPath: string };

export interface NavigationState {
  current: TuiRoute;
  history: TuiRoute[];
  helpVisible: boolean;
}

export type NavigationAction =
  | { type: "push"; route: TuiRoute }
  | { type: "replace"; route: TuiRoute }
  | { type: "back" }
  | { type: "toggle-help" }
  | { type: "close-help" };

export function createNavigationState(route: TuiRoute): NavigationState {
  return { current: route, history: [], helpVisible: false };
}

export function navigationReducer(
  state: NavigationState,
  action: NavigationAction,
): NavigationState {
  switch (action.type) {
    case "push":
      return {
        current: action.route,
        history: [...state.history, state.current],
        helpVisible: false,
      };
    case "replace":
      return { ...state, current: action.route, helpVisible: false };
    case "back": {
      if (state.helpVisible) return { ...state, helpVisible: false };
      const previous = state.history.at(-1);
      if (!previous) return state;
      return { current: previous, history: state.history.slice(0, -1), helpVisible: false };
    }
    case "toggle-help":
      return { ...state, helpVisible: !state.helpVisible };
    case "close-help":
      return { ...state, helpVisible: false };
  }
}

export function routeFromStartup(
  context:
    | { kind: "empty-state" }
    | { kind: "global-dashboard" }
    | { kind: "unconfigured-repo"; repoPath: string }
    | { kind: "repository-overview"; status: { repoPath: string } },
): TuiRoute {
  switch (context.kind) {
    case "empty-state":
      return { name: "empty-state" };
    case "global-dashboard":
      return { name: "global-dashboard" };
    case "unconfigured-repo":
      return { name: "unconfigured-repo", repoPath: context.repoPath };
    case "repository-overview":
      return { name: "repository-overview", repoPath: context.status.repoPath };
  }
}

export const SCREEN_IDS = {
  "empty-state": "S1",
  "unconfigured-repo": "S2",
  "global-dashboard": "S3",
  "repository-overview": "S4",
  setup: "S5",
  "setup-customization": "S6",
  "link-issue": "S7",
  "mode-selection": "S8",
  "workflow-settings": "S9",
  "pr-title": "S10",
  doctor: "S11",
  "global-settings": "S12",
  "missing-repository": "S13",
  "remove-confirmation": "S14",
} as const satisfies Record<TuiRoute["name"], string>;
