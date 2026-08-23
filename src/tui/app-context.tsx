import { createContext, useContext } from "react";
import type { DoctorResult } from "../application/models/doctor-result";
import type { RepositoryListView } from "../application/models/repository-summary";
import type { RepositoryStatusView } from "../application/models/status-view";
import type { GlobalSettings } from "../application/ports/settings.port";
import type { GeneratedPrTitle } from "../application/use-cases/generate-pr-title";
import type { StartupContext } from "../application/use-cases/get-startup-context";
import type { ManageConfig } from "../application/use-cases/manage-config";

/**
 * TUI service facade (architecture §27).
 *
 * The TUI receives application-facing use cases only; components never
 * touch Git config, SQLite, or hook files directly.
 */

export interface TuiServices {
  getStartupContext(input: { path: string }): Promise<StartupContext>;
  getRepositoryStatus(input: { path: string }): Promise<RepositoryStatusView>;
  listRepositories(input?: { refresh?: boolean }): Promise<RepositoryListView>;
  initializeRepository(input: {
    path: string;
    mode?: "hybrid" | "branch" | "manual";
    composeExistingHook?: boolean;
    allowSharedHooks?: boolean;
  }): Promise<unknown>;
  linkIssue(input: { path: string; issue: string; title?: string }): Promise<unknown>;
  unlinkIssue(input: { path: string }): Promise<unknown>;
  setMode(input: { path: string; mode: "hybrid" | "branch" | "manual" }): Promise<unknown>;
  setEnabled(input: { path: string; enabled: boolean }): Promise<unknown>;
  generatePrTitle(input: {
    path: string;
    title?: string;
    copy?: boolean;
  }): Promise<GeneratedPrTitle>;
  runDoctor(input: { path: string }): Promise<DoctorResult>;
  repairRepository(input: { path: string }): Promise<unknown>;
  removeRepository(input: { path: string }): Promise<unknown>;
  manageConfig(input: {
    path: string;
    action: "list" | "get" | "set" | "unset";
    key?: string;
    value?: string;
    global?: boolean;
  }): ReturnType<ManageConfig["execute"]>;
  getGlobalSettings(): Promise<GlobalSettings>;
  setGlobalSetting(
    key: keyof GlobalSettings,
    value: GlobalSettings[keyof GlobalSettings],
  ): Promise<void>;
  locateRepository(input: { id: string; path: string }): Promise<void>;
  forgetRepository(input: { id: string }): Promise<boolean>;
}

export const TuiServicesContext = createContext<TuiServices | null>(null);

export function useTuiServices(): TuiServices {
  const services = useContext(TuiServicesContext);
  if (services === null) {
    throw new Error("TuiServicesContext is missing a provider");
  }
  return services;
}
