import type { TuiRoute } from "./navigation";

export interface ScreenDefinition {
  id: string;
  title: string;
  description: string;
  actions: string[];
  destructive?: boolean;
}

export function screenDefinition(route: TuiRoute): ScreenDefinition {
  switch (route.name) {
    case "empty-state":
      return {
        id: "S1",
        title: "Empty State",
        description: "No repositories are configured yet.",
        actions: ["[Q] Quit"],
      };
    case "unconfigured-repo":
      return {
        id: "S2",
        title: "Unconfigured Repository",
        description: `Git repository detected: ${route.repoPath}`,
        actions: ["[Enter] Set up JiraFlow", "[G] Global dashboard", "[Q] Quit"],
      };
    case "global-dashboard":
      return {
        id: "S3",
        title: "Global Dashboard",
        description: "Registered repositories",
        actions: [
          "[Enter] Open selected",
          "[A] Add / initialize",
          "[D] Doctor",
          "[S] Global settings",
          "[R] Refresh",
          "[Q] Quit",
        ],
      };
    case "repository-overview":
      return {
        id: "S4",
        title: "Repository Overview",
        description: route.repoPath,
        actions: [
          "[L] Link issue",
          "[U] Clear linked issue",
          "[M] Change mode",
          "[P] Generate PR title",
          "[W] Workflow settings",
          "[D] Doctor",
          "[E] Enable / disable",
          "[Delete] Remove JiraFlow",
          "[G] Global dashboard",
        ],
      };
    case "setup":
      return {
        id: "S5",
        title: "Setup",
        description: `Set up JiraFlow for ${route.repoPath}`,
        actions: ["[Enter] Initialize JiraFlow", "[C] Customize first", "[Esc] Cancel"],
      };
    case "setup-customization":
      return {
        id: "S6",
        title: "Setup Customization",
        description: "Mode · Issue pattern · Commit format · PR title template source",
        actions: [
          "[1/2/3] Hybrid / Branch / Manual",
          "[Enter] Stage field override",
          "[S] Save and initialize",
          "[R] Reset defaults",
          "[Esc] Cancel",
        ],
      };
    case "link-issue":
      return {
        id: "S7",
        title: "Link Issue",
        description: "Enter ISSUE-KEY :: optional story title",
        actions: ["[Enter] Link", "[Esc] Cancel"],
      };
    case "mode-selection":
      return {
        id: "S8",
        title: "Mode Selection",
        description: "Saved linked issues are preserved when inactive.",
        actions: ["[1] Hybrid", "[2] Branch", "[3] Manual", "[Esc] Cancel"],
      };
    case "workflow-settings":
      return {
        id: "S9",
        title: "Workflow Settings",
        description: "Repo overrides inherit global defaults when unset. Enter key=value.",
        actions: ["[Enter] Set override", "[R] Reset all repo overrides", "[Esc] Back"],
      };
    case "pr-title":
      return {
        id: "S10",
        title: "PR Title Generator",
        description: "Enter or edit the local story title.",
        actions: ["[Enter] Preview", "[C] Copy title", "[Esc] Cancel"],
      };
    case "doctor":
      return {
        id: "S11",
        title: "Doctor",
        description: route.repoPath ? `Repository: ${route.repoPath}` : "Global JiraFlow health",
        actions: ["[R] Repair / refresh", "[Esc] Back"],
      };
    case "global-settings":
      return {
        id: "S12",
        title: "Global Settings",
        description: "Enter key=value for a constrained global setting.",
        actions: ["[Enter] Save", "[Esc] Back"],
      };
    case "missing-repository":
      return {
        id: "S13",
        title: "Missing Repository",
        description: `Path unavailable: ${route.repoPath}`,
        actions: ["[Enter] Locate at entered path", "[X] Remove from registry", "[I/Esc] Ignore"],
      };
    case "remove-confirmation":
      return {
        id: "S14",
        title: "Remove JiraFlow Confirmation",
        description:
          "Removes only JiraFlow integration, local config, and registry entry. Foreign hooks are preserved.",
        actions: ["[Enter] Remove JiraFlow", "[Esc] Cancel"],
        destructive: true,
      };
  }
}

export function parityRows(): Array<{ action: string; headless: string }> {
  return [
    { action: "Initialize", headless: "init" },
    { action: "Status", headless: "status" },
    { action: "Link issue", headless: "link" },
    { action: "Clear linked issue", headless: "unlink" },
    { action: "Change mode", headless: "mode" },
    { action: "Enable / disable", headless: "enable / disable" },
    { action: "Doctor / repair", headless: "doctor / doctor --repair" },
    { action: "Generate PR title", headless: "pr-title" },
    { action: "Configure workflow", headless: "config" },
    { action: "Remove", headless: "remove" },
    {
      action: "View / locate / forget repositories",
      headless: "repositories / application registry API",
    },
  ];
}
