import type {
  GlobalSettingKey,
  GlobalSettings,
  SettingsPort,
} from "../../application/ports/settings.port";
import { GLOBAL_SETTING_KEYS } from "../../application/ports/settings.port";
import { BUILT_IN_GLOBAL_SETTINGS } from "../../application/services/effective-config";
import { isCommitFormat } from "../../domain/commit-format";
import { ConfigInvalidError } from "../../domain/errors";
import { isLinkingMode } from "../../domain/linking-mode";
import { openSqliteDatabase } from "./database";
import { runMigrations } from "./migrations";

interface SettingRow {
  key: string;
  value_json: string;
}

export class SqliteSettingsRepository implements SettingsPort {
  constructor(private readonly databasePath: string) {}

  async read(): Promise<GlobalSettings> {
    const db = this.open();
    try {
      const result = { ...BUILT_IN_GLOBAL_SETTINGS };
      for (const row of db.query<SettingRow, []>("SELECT key, value_json FROM settings").all()) {
        if (!isGlobalSettingKey(row.key)) continue;
        const value = JSON.parse(row.value_json) as unknown;
        assertSettingValue(row.key, value);
        Object.assign(result, { [row.key]: value });
      }
      return result;
    } finally {
      db.close();
    }
  }

  async get<K extends GlobalSettingKey>(key: K): Promise<GlobalSettings[K]> {
    return (await this.read())[key];
  }

  async set<K extends GlobalSettingKey>(key: K, value: GlobalSettings[K]): Promise<void> {
    assertSettingValue(key, value);
    const db = this.open();
    try {
      db.run(
        `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
        [key, JSON.stringify(value), Date.now()],
      );
    } finally {
      db.close();
    }
  }

  async unset(key: GlobalSettingKey): Promise<void> {
    const db = this.open();
    try {
      db.run("DELETE FROM settings WHERE key = ?", [key]);
    } finally {
      db.close();
    }
  }

  private open() {
    const db = openSqliteDatabase({ path: this.databasePath, ensureDirectory: true });
    runMigrations(db);
    return db;
  }
}

export function isGlobalSettingKey(value: string): value is GlobalSettingKey {
  return (GLOBAL_SETTING_KEYS as readonly string[]).includes(value);
}

export function parseGlobalSetting(
  key: GlobalSettingKey,
  value: string,
): GlobalSettings[GlobalSettingKey] {
  switch (key) {
    case "defaultMode":
      if (!isLinkingMode(value)) throw new ConfigInvalidError(key, value);
      return value;
    case "defaultCommitFormat":
      if (!isCommitFormat(value)) throw new ConfigInvalidError(key, value);
      return value;
    case "copyPrTitleToClipboard":
      if (value !== "true" && value !== "false" && value !== "1" && value !== "0") {
        throw new ConfigInvalidError(key, value);
      }
      return value === "true" || value === "1";
    case "theme":
      if (value !== "system" && value !== "dark" && value !== "light") {
        throw new ConfigInvalidError(key, value);
      }
      return value;
    case "lastSelectedRepositoryId":
      return value === "null" || value === "" ? null : value;
    case "defaultIssuePattern":
      try {
        new RegExp(value);
      } catch {
        throw new ConfigInvalidError(key, value);
      }
      return value;
    case "defaultPrTitleTemplate":
    case "defaultDateFormat":
      if (value.length === 0) throw new ConfigInvalidError(key, value);
      return value;
  }
}

function assertSettingValue(key: GlobalSettingKey, value: unknown): void {
  const valid = (() => {
    switch (key) {
      case "defaultMode":
        return typeof value === "string" && isLinkingMode(value);
      case "defaultCommitFormat":
        return typeof value === "string" && isCommitFormat(value);
      case "copyPrTitleToClipboard":
        return typeof value === "boolean";
      case "theme":
        return value === "system" || value === "dark" || value === "light";
      case "lastSelectedRepositoryId":
        return value === null || typeof value === "string";
      case "defaultIssuePattern":
      case "defaultPrTitleTemplate":
      case "defaultDateFormat":
        return typeof value === "string" && value.length > 0;
    }
  })();
  if (!valid) throw new ConfigInvalidError(key, JSON.stringify(value));
}
