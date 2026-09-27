import type { CommitFormat } from "../../domain/commit-format";
import type { LinkingMode } from "../../domain/linking-mode";

export interface GlobalSettings {
  defaultMode: LinkingMode;
  defaultIssuePattern: string;
  defaultCommitFormat: CommitFormat;
  defaultPrTitleTemplate: string;
  defaultDateFormat: string;
  copyPrTitleToClipboard: boolean;
  theme: "system" | "dark" | "light";
  lastSelectedRepositoryId: string | null;
}

export type GlobalSettingKey = keyof GlobalSettings;

export const GLOBAL_SETTING_KEYS = [
  "defaultMode",
  "defaultIssuePattern",
  "defaultCommitFormat",
  "defaultPrTitleTemplate",
  "defaultDateFormat",
  "copyPrTitleToClipboard",
  "theme",
  "lastSelectedRepositoryId",
] as const satisfies readonly GlobalSettingKey[];

export interface SettingsPort {
  read(): Promise<GlobalSettings>;
  get<K extends GlobalSettingKey>(key: K): Promise<GlobalSettings[K]>;
  set<K extends GlobalSettingKey>(key: K, value: GlobalSettings[K]): Promise<void>;
  unset(key: GlobalSettingKey): Promise<void>;
}
