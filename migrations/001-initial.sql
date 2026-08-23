-- JiraFlow initial VS-1 registry schema. E8 control-plane tables are added
-- additively by 002-control-plane.sql so existing development databases
-- upgrade without rewriting migration history.

CREATE TABLE IF NOT EXISTS repositories (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    remote_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_seen_at INTEGER,
    last_opened_at INTEGER
);
