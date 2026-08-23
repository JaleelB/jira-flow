# OpenTUI Control Plane

Run `jira-flow` with no arguments. Startup routes to the current configured
repository, unconfigured setup, the global dashboard, or empty state.

Global keys are `Esc` for back/close, `?` for help, and `Q` to quit where the
screen is not accepting text or confirming destruction. Every mutation uses the
same application use case as its headless command.

| ID | Screen | Main purpose |
|---|---|---|
| S1 | Empty State | Explain first initialization |
| S2 | Unconfigured Repository | Enter setup or global dashboard |
| S3 | Global Dashboard | Open, refresh, diagnose, or configure registered repos |
| S4 | Repository Overview | Issue, mode, enabled state, settings, PR title, Doctor, remove |
| S5 | Setup | Safe defaults or exact v0.5 migration |
| S6 | Setup Customization | Stage mode and workflow overrides before init |
| S7 | Link Issue | Link `ISSUE :: optional title` |
| S8 | Mode Selection | Hybrid, Branch, or Manual |
| S9 | Workflow Settings | Set/reset repository overrides |
| S10 | PR Title Generator | Preview or copy a local title |
| S11 | Doctor | Repository or global health and owned repair |
| S12 | Global Settings | Set constrained defaults/preferences |
| S13 | Missing Repository | Locate, forget, or ignore a stale path |
| S14 | Remove Confirmation | Explicit JiraFlow-only removal |

Screens show loading, action failure, and retry states without moving business
logic into React components. The typed navigation reducer owns history and help
state. `Q` is disabled on S14 so accidental quit input cannot confirm removal.

The global dashboard is registry-based and never scans the filesystem. Missing
paths stay visible until located or forgotten. Opening/refreshing updates
disposable `last_seen`/cache data; repository truth continues to come from Git.
