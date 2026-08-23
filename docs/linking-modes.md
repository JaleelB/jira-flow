# Linking Modes

JiraFlow resolves one active issue for each commit. Enabled state is evaluated
first; disabled repositories always produce no active issue.

| Mode | First choice | Fallback | `link` allowed |
|---|---|---|---|
| Hybrid | Worktree-linked issue | Issue parsed from branch | Yes |
| Branch | Issue parsed from branch | None | No |
| Manual | Worktree-linked issue | None | Yes |

The built-in issue pattern is `[A-Z][A-Z0-9]*-\d+`. Branches such as
`feat/ABC-123-login` and `fix/team/OPS2-991-crash` resolve the first match.
Detached HEAD and branches without a key are normal no-issue states.

`jira-flow link ABC-123` writes only the current worktree's JiraFlow state.
Linked worktrees sharing one repository can therefore use different issues.
Switching to Branch mode does not erase a saved linked issue; it becomes active
again after returning to Hybrid or Manual. Enable/disable likewise preserves
mode and issue state.

Repository defaults are Hybrid, enabled, and footer format. Global defaults
apply when a repository is initialized, while repository-local overrides remain
authoritative for that repository.
