CREATE TABLE IF NOT EXISTS repository_cache (
    repository_id TEXT PRIMARY KEY,
    branch TEXT,
    branch_issue TEXT,
    linked_issue TEXT,
    active_issue TEXT,
    active_issue_source TEXT,
    mode TEXT,
    enabled INTEGER,
    health TEXT,
    last_sync_at INTEGER NOT NULL,
    FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS issue_metadata (
    repository_id TEXT NOT NULL,
    jira_key TEXT NOT NULL,
    story_title TEXT,
    last_used_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (repository_id, jira_key),
    FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
