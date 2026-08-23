import { useKeyboard } from "@opentui/react";
import { useMemo, useState } from "react";
import type { DoctorResult } from "../../application/models/doctor-result";
import type { RepositoryListView } from "../../application/models/repository-summary";
import type { RepositoryStatusView } from "../../application/models/status-view";
import type { GlobalSettings } from "../../application/ports/settings.port";
import type { LegacyInspection } from "../../application/use-cases/inspect-legacy-repository";
import type { ManageConfig } from "../../application/use-cases/manage-config";
import { palette } from "../../ui/theme";
import type { TuiServices } from "../app-context";
import { useScreenData } from "../hooks/use-screen-data";
import type { NavigationAction, TuiRoute } from "../navigation";
import { screenDefinition } from "../screen-models";

type RouteData =
  | RepositoryListView
  | RepositoryStatusView
  | DoctorResult
  | GlobalSettings
  | Awaited<ReturnType<ManageConfig["execute"]>>
  | LegacyInspection
  | null;

export function ManagementScreen({
  route,
  services,
  dispatch,
  onQuit,
}: {
  route: TuiRoute;
  services: TuiServices;
  dispatch: (action: NavigationAction) => void;
  onQuit: () => void;
}) {
  const definition = screenDefinition(route);
  const routeKey = JSON.stringify(route);
  const { view, reload } = useScreenData<RouteData>(() => loadRouteData(route, services), routeKey);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"hybrid" | "branch" | "manual">("hybrid");
  const [setupOverrides, setSetupOverrides] = useState<Record<string, string>>({});
  const inputRoute = [
    "link-issue",
    "workflow-settings",
    "pr-title",
    "global-settings",
    "missing-repository",
    "setup-customization",
  ].includes(route.name);

  const mutate = async (action: () => Promise<void>) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setNotice(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  useKeyboard((key) => {
    if (key.eventType === "release") return;
    const name = key.name.toLowerCase();
    if (name === "escape") return dispatch({ type: "back" });
    if (name === "?" || (key.shift && name === "/")) return dispatch({ type: "toggle-help" });
    if (name === "q" && !definition.destructive && !inputRoute) return onQuit();
    if (busy) return;

    if (route.name === "unconfigured-repo") {
      if (name === "return" || name === "enter")
        dispatch({ type: "push", route: { name: "setup", repoPath: route.repoPath } });
      if (name === "g") dispatch({ type: "push", route: { name: "global-dashboard" } });
    } else if (route.name === "global-dashboard") {
      if (name === "r") void reload();
      if (name === "d") dispatch({ type: "push", route: { name: "doctor" } });
      if (name === "s") dispatch({ type: "push", route: { name: "global-settings" } });
      if (name === "a")
        setNotice("Run `jira-flow init <path> --yes`, or launch JiraFlow inside the repository.");
      if (name === "return" || name === "enter") openFirstRepository(view, dispatch);
    } else if (route.name === "repository-overview") {
      if (name === "l") {
        const status = readyData<RepositoryStatusView>(view);
        if (status?.mode === "branch") setNotice("Link Issue is unavailable in Branch mode.");
        else
          dispatch({
            type: "push",
            route: { name: "link-issue", repoId: route.repoId, repoPath: route.repoPath },
          });
      }
      if (name === "u")
        void mutate(async () => {
          await services.unlinkIssue({ path: route.repoPath });
          await reload();
          setNotice("Linked issue cleared.");
        });
      if (name === "m")
        dispatch({
          type: "push",
          route: { name: "mode-selection", repoId: route.repoId, repoPath: route.repoPath },
        });
      if (name === "p")
        dispatch({
          type: "push",
          route: { name: "pr-title", repoId: route.repoId, repoPath: route.repoPath },
        });
      if (name === "w")
        dispatch({
          type: "push",
          route: { name: "workflow-settings", repoId: route.repoId, repoPath: route.repoPath },
        });
      if (name === "d")
        dispatch({
          type: "push",
          route: { name: "doctor", repoId: route.repoId, repoPath: route.repoPath },
        });
      if (name === "e")
        void mutate(async () => {
          const status = readyData<RepositoryStatusView>(view);
          await services.setEnabled({ path: route.repoPath, enabled: !(status?.enabled ?? true) });
          await reload();
        });
      if (name === "delete")
        dispatch({
          type: "push",
          route: { name: "remove-confirmation", repoId: route.repoId, repoPath: route.repoPath },
        });
      if (name === "g") dispatch({ type: "push", route: { name: "global-dashboard" } });
    } else if (route.name === "setup") {
      if (name === "c")
        dispatch({
          type: "push",
          route: { name: "setup-customization", repoPath: route.repoPath },
        });
      if (name === "return" || name === "enter") {
        const legacy = readyData<LegacyInspection>(view);
        if (legacy?.detected && !legacy.eligible) {
          setNotice(`Migration blocked: ${legacy.ambiguousPaths.join(", ")}`);
        } else if (legacy?.eligible) {
          void migrateLegacy(route.repoPath, services, dispatch, mutate);
        } else {
          void initialize(route.repoPath, mode, services, dispatch, mutate);
        }
      }
    } else if (route.name === "setup-customization") {
      if (name === "1") setMode("hybrid");
      if (name === "2") setMode("branch");
      if (name === "3") setMode("manual");
      if (name === "r") {
        setMode("hybrid");
        setSetupOverrides({});
      }
      if (name === "s")
        void initializeCustomized(route.repoPath, mode, setupOverrides, services, dispatch, mutate);
    } else if (route.name === "mode-selection") {
      const selected =
        name === "1" ? "hybrid" : name === "2" ? "branch" : name === "3" ? "manual" : null;
      if (selected)
        void mutate(async () => {
          await services.setMode({ path: route.repoPath, mode: selected });
          dispatch({ type: "back" });
        });
    } else if (route.name === "doctor" && name === "r") {
      void mutate(async () => {
        if (route.repoPath) await services.repairRepository({ path: route.repoPath });
        await reload();
      });
    } else if (route.name === "workflow-settings" && name === "r") {
      void mutate(async () => {
        for (const key of ["issuePattern", "commitFormat", "prTitleTemplate", "dateFormat"])
          await services.manageConfig({ path: route.repoPath, action: "unset", key });
        setNotice("Repository overrides reset.");
      });
    } else if (route.name === "missing-repository") {
      if (name === "x")
        void mutate(async () => {
          await services.forgetRepository({ id: route.repoId });
          dispatch({ type: "replace", route: { name: "global-dashboard" } });
        });
      if (name === "i") dispatch({ type: "back" });
    } else if (route.name === "remove-confirmation" && (name === "return" || name === "enter")) {
      void mutate(async () => {
        await services.removeRepository({ path: route.repoPath });
        dispatch({ type: "replace", route: { name: "global-dashboard" } });
      });
    } else if (route.name === "pr-title" && name === "c") {
      void mutate(async () => {
        const result = await services.generatePrTitle({
          path: route.repoPath,
          title: input.trim() || undefined,
          copy: true,
        });
        setNotice(`${result.value}${result.warning ? ` · ${result.warning}` : " · Copied"}`);
      });
    }
  });

  const submit = (value: string) => {
    if (busy) return;
    if (route.name === "link-issue") {
      const [issue = "", title] = value.split("::", 2).map((part) => part.trim());
      void mutate(async () => {
        await services.linkIssue({ path: route.repoPath, issue, title: title || undefined });
        dispatch({ type: "back" });
      });
    } else if (route.name === "pr-title") {
      void mutate(async () => {
        const result = await services.generatePrTitle({
          path: route.repoPath,
          title: value.trim() || undefined,
          copy: false,
        });
        setNotice(`Preview: ${result.value}`);
      });
    } else if (route.name === "workflow-settings") {
      const [key = "", ...rest] = value.split("=");
      void mutate(async () => {
        await services.manageConfig({
          path: route.repoPath,
          action: "set",
          key: key.trim(),
          value: rest.join("=").trim(),
        });
        setNotice("Repository override saved.");
        await reload();
      });
    } else if (route.name === "global-settings") {
      const [key = "", ...rest] = value.split("=");
      void mutate(async () => {
        await services.manageConfig({
          path: process.cwd(),
          action: "set",
          key: key.trim(),
          value: rest.join("=").trim(),
          global: true,
        });
        setNotice("Global setting saved.");
        await reload();
      });
    } else if (route.name === "missing-repository") {
      void mutate(async () => {
        await services.locateRepository({ id: route.repoId, path: value.trim() });
        dispatch({
          type: "replace",
          route: { name: "repository-overview", repoId: route.repoId, repoPath: value.trim() },
        });
      });
    } else if (route.name === "setup-customization") {
      const [key = "", ...rest] = value.split("=");
      const normalizedKey = key.trim();
      if (
        !["issuePattern", "commitFormat", "prTitleTemplate", "dateFormat"].includes(normalizedKey)
      ) {
        setNotice("Use issuePattern, commitFormat, prTitleTemplate, or dateFormat.");
      } else {
        setSetupOverrides((current) => ({
          ...current,
          [normalizedKey]: rest.join("=").trim(),
        }));
        setNotice(`${normalizedKey} override staged for setup.`);
      }
    }
    setInput("");
  };

  const body = useMemo(
    () => [...staticRouteLines(route, mode, setupOverrides), ...renderData(view)],
    [route, mode, setupOverrides, view],
  );
  return (
    <box
      style={{
        flexDirection: "column",
        padding: 1,
        width: "100%",
        height: "100%",
        backgroundColor: palette.surface,
      }}
    >
      <text style={{ fg: palette.ticket }}>{definition.id} · JIRAFLOW</text>
      <text style={{ fg: palette.ink }}>{definition.title}</text>
      <text style={{ fg: palette.mute }}>{definition.description}</text>
      <text> </text>
      {busy ? <text style={{ fg: palette.ticket }}>Working…</text> : null}
      {body.map((line) => (
        <text key={line} style={{ fg: palette.ink }}>
          {line}
        </text>
      ))}
      {inputRoute ? (
        <input
          focused
          value={input}
          placeholder={inputPlaceholder(route)}
          onInput={setInput}
          onSubmit={submit as never}
        />
      ) : null}
      {notice ? (
        <text style={{ fg: notice.startsWith("Error") ? palette.fail : palette.ticket }}>
          {notice}
        </text>
      ) : null}
      <text> </text>
      {definition.actions.map((action) => (
        <text key={action} style={{ fg: palette.mute }}>
          {action}
        </text>
      ))}
      <text style={{ fg: palette.mute }}>[Esc] Back [?] Help</text>
    </box>
  );
}

async function loadRouteData(route: TuiRoute, services: TuiServices): Promise<RouteData> {
  switch (route.name) {
    case "global-dashboard":
      return services.listRepositories({ refresh: true });
    case "setup":
      return services.inspectLegacyRepository({ path: route.repoPath });
    case "repository-overview":
    case "link-issue":
    case "mode-selection":
    case "pr-title":
    case "remove-confirmation":
      return services.getRepositoryStatus({ path: route.repoPath });
    case "workflow-settings":
      return services.manageConfig({ path: route.repoPath, action: "list" });
    case "doctor":
      return services.runDoctor({ path: route.repoPath ?? process.cwd() });
    case "global-settings":
      return services.getGlobalSettings();
    default:
      return null;
  }
}

function readyData<T>(view: ReturnType<typeof useScreenData<RouteData>>["view"]): T | null {
  return view.status === "ready" ? (view.data as T) : null;
}

function renderData(view: ReturnType<typeof useScreenData<RouteData>>["view"]): string[] {
  if (view.status === "loading") return ["Loading…"];
  if (view.status === "error")
    return [`Error: ${view.message}`, "Press R to retry where available."];
  const data = view.data;
  if (data === null) return [];
  if ("repositories" in data)
    return data.repositories.length === 0
      ? ["No repositories registered."]
      : data.repositories.map(
          (repo) =>
            `${repo.displayName.padEnd(18)} ${(repo.mode ?? "—").padEnd(8)} ${(repo.activeIssue ?? "—").padEnd(12)} ${repo.health}`,
        );
  if ("legacyHooks" in data)
    return data.detected
      ? [
          "Legacy JiraFlow v0.5 integration detected.",
          ...data.changes.map((change) => `• ${change}`),
          ...(data.ambiguousPaths.length > 0
            ? data.ambiguousPaths.map((path) => `Cannot prove ownership: ${path}`)
            : []),
        ]
      : [];
  if ("checks" in data)
    return [
      `Overall: ${data.overall}`,
      ...data.checks.map(
        (check) =>
          `${check.status === "pass" ? "✓" : check.status === "warning" ? "!" : "✗"} ${check.id}${check.detail ? ` — ${check.detail}` : ""}`,
      ),
    ];
  if ("repoPath" in data)
    return [
      `JiraFlow: ${data.enabled ? "Enabled" : "Disabled"}`,
      `Mode: ${data.mode}`,
      `Active issue: ${data.activeIssue?.key ?? "—"}`,
      `Saved linked issue: ${data.linkedIssue ?? "—"}`,
      `Active source: ${data.activeIssue?.source ?? "—"}`,
      `Current branch: ${data.branch ?? "detached"}`,
      `Integration: ${data.integration.status}`,
      `Commit format: ${data.commitFormat}`,
      `Issue pattern: ${data.issuePattern}`,
    ];
  if ("effective" in data)
    return [
      `Issue pattern: ${data.effective.issuePattern} (${data.sources.issuePattern})`,
      `Commit format: ${data.effective.commitFormat} (${data.sources.commitFormat})`,
      `PR title template: ${data.effective.prTitleTemplate} (${data.sources.prTitleTemplate})`,
      `Date format: ${data.effective.dateFormat} (${data.sources.dateFormat})`,
    ];
  return Object.entries(data).map(([key, value]) => `${key}: ${String(value)}`);
}

function openFirstRepository(
  view: ReturnType<typeof useScreenData<RouteData>>["view"],
  dispatch: (action: NavigationAction) => void,
) {
  const data = readyData<RepositoryListView>(view);
  const first = data?.repositories[0];
  if (!first) return;
  dispatch({
    type: "push",
    route:
      first.health === "missing"
        ? { name: "missing-repository", repoId: first.id, repoPath: first.path }
        : { name: "repository-overview", repoId: first.id, repoPath: first.path },
  });
}

async function initialize(
  path: string,
  mode: "hybrid" | "branch" | "manual",
  services: TuiServices,
  dispatch: (action: NavigationAction) => void,
  mutate: (action: () => Promise<void>) => Promise<void>,
) {
  await mutate(async () => {
    await services.initializeRepository({ path, mode });
    dispatch({ type: "replace", route: { name: "repository-overview", repoPath: path } });
  });
}

async function initializeCustomized(
  path: string,
  mode: "hybrid" | "branch" | "manual",
  overrides: Record<string, string>,
  services: TuiServices,
  dispatch: (action: NavigationAction) => void,
  mutate: (action: () => Promise<void>) => Promise<void>,
) {
  await mutate(async () => {
    await services.initializeRepository({ path, mode });
    for (const [key, value] of Object.entries(overrides)) {
      await services.manageConfig({ path, action: "set", key, value });
    }
    dispatch({ type: "replace", route: { name: "repository-overview", repoPath: path } });
  });
}

async function migrateLegacy(
  path: string,
  services: TuiServices,
  dispatch: (action: NavigationAction) => void,
  mutate: (action: () => Promise<void>) => Promise<void>,
) {
  await mutate(async () => {
    await services.migrateLegacyRepository({ path });
    dispatch({ type: "replace", route: { name: "repository-overview", repoPath: path } });
  });
}

function staticRouteLines(
  route: TuiRoute,
  mode: "hybrid" | "branch" | "manual",
  overrides: Record<string, string>,
): string[] {
  if (route.name === "empty-state")
    return ["To get started:", "  cd <your-project>", "  jira-flow init"];
  if (route.name === "unconfigured-repo") return ["JiraFlow is not configured."];
  if (route.name === "setup")
    return [
      `Repository: ${route.repoPath}`,
      "Default behavior: Hybrid",
      "Issue detection: ABC-123 style Jira keys",
      "Commit integration: commit-msg",
      "Commit reference style: Footer",
    ];
  if (route.name === "setup-customization")
    return [
      `Mode: ${mode}`,
      ...Object.entries(overrides).map(([key, value]) => `${key}: ${value}`),
    ];
  return [];
}

function inputPlaceholder(route: TuiRoute): string {
  switch (route.name) {
    case "link-issue":
      return "ABC-123 :: Story title (optional)";
    case "workflow-settings":
      return "commitFormat=footer";
    case "pr-title":
      return "Story title";
    case "global-settings":
      return "defaultMode=hybrid";
    case "missing-repository":
      return "/new/path/to/repository";
    case "setup-customization":
      return "commitFormat=footer";
    default:
      return "";
  }
}
