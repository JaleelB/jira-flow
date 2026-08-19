-- JiraFlow initial schema (VS-1 subset).
--
-- VS-1 creates only `schema_migrations` (created by the runner) and the
-- `repositories` registry table (ADR-0006). `repository_cache`,
-- `issue_metadata`, and `settings` arrive with E8. The runtime executes an
-- embedded copy of this file so compiled binaries carry their migrations;
-- a test asserts the embedded copy matches this file byte-for-byte.

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
