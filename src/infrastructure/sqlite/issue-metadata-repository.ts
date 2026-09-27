import type { IssueMetadata, IssueMetadataPort } from "../../application/ports/issue-metadata.port";
import { openSqliteDatabase } from "./database";
import { runMigrations } from "./migrations";

interface MetadataRow {
  repository_id: string;
  jira_key: string;
  story_title: string | null;
  last_used_at: number | null;
  created_at: number;
  updated_at: number;
}

export class SqliteIssueMetadataRepository implements IssueMetadataPort {
  constructor(private readonly databasePath: string) {}

  async find(repositoryId: string, jiraKey: string): Promise<IssueMetadata | null> {
    const db = this.open();
    try {
      const row = db
        .query<MetadataRow, [string, string]>(
          "SELECT * FROM issue_metadata WHERE repository_id = ? AND jira_key = ?",
        )
        .get(repositoryId, jiraKey);
      return row === null ? null : toMetadata(row);
    } finally {
      db.close();
    }
  }

  async save(
    repositoryId: string,
    jiraKey: string,
    storyTitle: string | null,
  ): Promise<IssueMetadata> {
    const db = this.open();
    try {
      const now = Date.now();
      db.run(
        `INSERT INTO issue_metadata (
          repository_id, jira_key, story_title, last_used_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(repository_id, jira_key) DO UPDATE SET
          story_title = excluded.story_title,
          last_used_at = excluded.last_used_at,
          updated_at = excluded.updated_at`,
        [repositoryId, jiraKey, storyTitle, now, now, now],
      );
      const row = db
        .query<MetadataRow, [string, string]>(
          "SELECT * FROM issue_metadata WHERE repository_id = ? AND jira_key = ?",
        )
        .get(repositoryId, jiraKey);
      if (row === null) throw new Error("issue metadata upsert did not return a row");
      return toMetadata(row);
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

function toMetadata(row: MetadataRow): IssueMetadata {
  return {
    repositoryId: row.repository_id,
    jiraKey: row.jira_key,
    storyTitle: row.story_title,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
