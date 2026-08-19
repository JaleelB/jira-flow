import { createContext, useContext } from "react";
import type { RepositoryStatusView } from "../application/models/status-view";
import type { StartupContext } from "../application/use-cases/get-startup-context";

/**
 * TUI service facade (architecture §27).
 *
 * The TUI receives application-facing use cases only; components never
 * touch Git config, SQLite, or hook files directly.
 */

export interface TuiServices {
  getStartupContext(input: { path: string }): Promise<StartupContext>;
  getRepositoryStatus(input: { path: string }): Promise<RepositoryStatusView>;
}

export const TuiServicesContext = createContext<TuiServices | null>(null);

export function useTuiServices(): TuiServices {
  const services = useContext(TuiServicesContext);
  if (services === null) {
    throw new Error("TuiServicesContext is missing a provider");
  }
  return services;
}
