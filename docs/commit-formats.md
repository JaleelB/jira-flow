# Commit Formats

Set a repository format with:

```bash
jira-flow config set commitFormat footer
```

Given active issue `ABC-123` and subject `feat: add login`:

| Format | Result |
|---|---|
| `footer` | `feat: add login` followed by a blank line and `Jira: ABC-123` |
| `suffix` | `feat: add login [ABC-123]` |
| `prefix` | `ABC-123 feat: add login` |
| `scope` | `feat(ABC-123): add login` |

All formats are idempotent for the active issue and preserve multiline bodies.
A different Jira key already present does not suppress the active issue.

Scope mode only changes Conventional Commit subjects with no scope or an empty
scope. It preserves `!` breaking markers. A non-empty existing scope such as
`feat(auth): add login` is left unchanged because JiraFlow will not destroy its
meaning. Free-form subjects are also left unchanged in scope mode.

Empty or whitespace-only commit messages are never rewritten. If JiraFlow is
disabled or cannot resolve an issue, the complete message remains unchanged.
