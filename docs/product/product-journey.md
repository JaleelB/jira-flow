# JiraFlow v1 - Raw Product Journey

Installation -> first launch -> first repo -> daily commits -> issue switching -> PR title -> multi-repo management

**Capture intent:** Preserve the raw journey from the conversation before translating it into a formal v1 product specification.

Yes. I’d design the **v1 user journey first**, then derive commands/screens/state from it.

And one small refinement from our earlier discussion: I would now make **Enabled/Disabled separate from linking mode**. So the modes are **Hybrid**, **Branch**, and **Manual**; disabling JiraFlow simply pauses it without throwing away the configured mode.

## 1. Installation

The install should feel completely ordinary:

```text
npm install -g jira-flow
```

or:

```text
pnpm add -g jira-flow
bun add -g jira-flow
```

The package installs the JiraFlow executable. Nothing gets added to any repository during package installation.

Afterward:

```text
jira-flow --version
jira-flow --help
```

work **anywhere**, Git repo or not.

No hooks. No prompts. No global repo scanning.

## 2. First launch

I think **jira-flow** with no arguments should be **context-aware**.

#### First launch outside a Git repo

```text
jira-flow
```

opens the TUI:

```text
┌───────────────────────────────────────────────┐
│ JiraFlow                                      │
│                                               │
│ No repositories are configured yet.          │
│                                               │
│ To get started:                               │
│                                               │
│   cd <your-project>                           │
│   jira-flow init                              │
│                                               │
│ [ Quit ]                                      │
└───────────────────────────────────────────────┘
```

I wouldn't give it a filesystem browser yet. That's unnecessary complexity.

#### First launch inside an unconfigured Git repo

```text
cd emblor
jira-flow
```

JiraFlow recognizes:

```text
✓ Git repository detected: emblor
○ JiraFlow is not configured
```

and offers:

```text
> Set up JiraFlow
  Open global dashboard
  Exit
```

So users don't necessarily have to remember init.

But:

```text
jira-flow init
```

takes them directly into setup.

## 3. Initializing the first repo

This should be **extremely lightweight**.

Not the old:

> automatic or manual?

> enter regex?

> configure hooks?

> blah blah

I'd make the normal path almost one-click.

```text
Set up JiraFlow for emblor

Repository
  ~/Developer/emblor

Default behavior
  Hybrid

Issue detection
  ABC-123 style Jira keys

Commit integration
  commit-msg

Commit reference style
  Use global default

──────────────────────────

> Initialize JiraFlow
  Customize first
  Cancel
```

**Hybrid should be the default.**

Why?

Because Hybrid behaves exactly like automatic branch detection until the user explicitly overrides it.

So:

```text
feat/EMB-217-headless-tags
```

means:

```text
EMB-217
```

without the user needing to understand "Hybrid."

But they retain the ability to later say:

```text
jira-flow link OPS-992
```

without changing branches.  
  
That's a great default.

## 4. What initialization actually does

Behind the UI:

```text
jira-flow init
      │
      ├─ detect Git repo
      ├─ resolve repo root
      ├─ resolve real Git dir
      ├─ resolve effective hooks path
      ├─ detect existing JiraFlow state
      ├─ inspect existing commit-msg integration
      ├─ safely install JiraFlow integration
      ├─ write Git-local JiraFlow configuration
      ├─ register repo in global SQLite registry
      └─ verify health
```

Then:

```text
✓ JiraFlow configured

Mode        Hybrid
Issue       None
Branch      main
Integration Healthy

JiraFlow will automatically detect Jira keys from your
branches. You can override the current issue at any time:

  jira-flow link ABC-123
```

**Important:** **being on main, develop, or some random branch during init does not matter.**

## 5. Everyday commits

This should be where JiraFlow almost disappears.

Suppose:

```text
git switch -c feat/ABC-123-login
```

Then:

```text
git commit -m "feat(auth): add login"
```

JiraFlow's hook runs silently:

```text
current mode = hybrid
manual override = none
branch = feat/ABC-123-login
derived issue = ABC-123
```

and applies the configured commit format.

There should normally be **no JiraFlow terminal output**.

Git hooks that print success messages on every commit get annoying very quickly.

If no Jira key exists:

```text
branch = chore/update-dependencies
manual override = none
```

then JiraFlow simply does nothing.

The commit succeeds untouched.

No:

> ERROR: YOU DON'T HAVE A JIRA KEY

unless we eventually add an optional strict/company-policy mode.

## 6. Checking what's active

Headless:

```text
jira-flow status
```

Something concise:

```text
JiraFlow: enabled
Repository: emblor
Mode: Hybrid
Branch: feat/ABC-123-login
Branch issue: ABC-123
Override: none
Active issue: ABC-123
Integration: healthy
```

Or inside the TUI:

```text
 Emblor

 Enabled           Yes
 Mode              Hybrid

 Current branch    feat/ABC-123-login
 Branch issue      ABC-123
 Override          —
 Active issue      ABC-123

 Commit format     Jira footer
 Integration       ✓ Healthy

 Actions

 > Link issue
   Change mode
   Generate PR title
   Commit formatting
   Doctor
   Disable
   Remove JiraFlow
```

## 7. Switching Jira issues

This is where Hybrid earns its place.

You're currently on:

```text
feat/ABC-123-login
```

but need the next few commits associated with:

```text
OPS-992
```

Run:

```text
jira-flow link OPS-992
```

Result:

```text
Linked OPS-992

Mode: Hybrid
Branch issue: ABC-123
Override: OPS-992
Active issue: OPS-992
```

Now commits use OPS-992.

When done:

```text
jira-flow unlink
```

Result:

```text
Override cleared.

Active issue: ABC-123
Source: branch
```

That's an excellent workflow.

You don't rename branches.  
  
You don't reconfigure JiraFlow.  
  
You don't reinstall hooks.

## 8. The three linking modes

I'd expose them as:

#### Hybrid — default

```text
manual override?
   yes → use it
   no  → derive from branch
```

Best general-purpose mode.

#### Branch

```text
always derive from branch
```

No overrides.  
  
Useful for teams with strict branch naming.

#### Manual

```text
always use explicitly linked issue
```

Branch doesn't matter.  
  
Useful for people whose branches don't contain Jira keys.

And then separately:

```text
jira-flow disable
jira-flow enable
```

I now prefer this over having an Off mode.

Because:

```text
mode = Hybrid
enabled = false
```

means disabling doesn't destroy how you've configured the repo.  
  
That's cleaner.

## 9. Switching branches

No post-checkout hook.

Nothing needs to happen.

You go from:

```text
feat/ABC-123-login
```

to:

```text
fix/ABC-456-session
```

At the next commit JiraFlow asks Git:

```text
What branch am I currently on?
```

and uses:

```text
ABC-456
```

That's it.  
  
The old package was doing unnecessary branch tracking.

## 10. Manual mode workflow

Suppose a developer doesn't encode Jira IDs in branches.

They configure:

```text
jira-flow mode manual
```

Then:

```text
jira-flow link ABC-123
```

Every commit uses ABC-123.

When work changes:

```text
jira-flow link ABC-456
```

No need to unlink first.

And:

```text
jira-flow unlink
```

in Manual mode means:

```text
Mode: Manual
Active issue: None
```

Commits continue normally but JiraFlow doesn't add anything until another issue gets linked.

I would **not block commits**.

## 11. PR title generation

This fits extremely naturally after the commit workflow.

At work, say your configured template is:

```text
{jiraKey} | {date} | {quarter} | {storyTitle}
```

Run:

```text
jira-flow pr-title
```

JiraFlow already knows:

```text
Jira key → ABC-123
Date     → 2026-08-12
Quarter  → Q3
```

But it doesn't know the official story title because we're intentionally not talking to Jira.

So:

```text
Story title:
> Fix authentication session timeout
```

Then:

```text
ABC-123 | 2026-08-12 | Q3 | Fix authentication session timeout

✓ Copied to clipboard
```

You paste it into your company's PR creation UI.  
  
No GitHub CLI.  
  
No Jira API.  
  
No GitHub API.  
  
No auth.  
  
That's perfectly in scope.

## 12. We can make PR titles nicer with SQLite

This is actually a perfect use of the global DB.

Suppose the first time you use:

```text
ABC-123
```

you enter:

```text
Fix authentication session timeout
```

SQLite can remember:

```text
repo: emblor
issue: ABC-123
title: Fix authentication session timeout
```

That's **cache/convenience metadata**, **not repository configuration**.

The next time:

```text
jira-flow pr-title
```

JiraFlow can say:

```text
Story title:
Fix authentication session timeout

> Use
  Edit
```

And if you delete the SQLite database?

Nothing important breaks.  
  
You just lose cached convenience information.  
  
Exactly what we want.

## 13. PR title configuration

I'd make this global by default, with repo overrides.

Global:

```text
PR Title Template
{jiraKey} | {date} | {quarter} | {storyTitle}
```

Repository can override it:

```text
Emblor
PR title template
[{jiraKey}] {storyTitle}
```

Potential variables:

```text
{jiraKey}
{storyTitle}
{branch}
{repo}
{date}
{quarter}
```

Later maybe:

```text
{username}
{type}
```

but don't build a mini programming language.

## 14. Launching JiraFlow after you have repos

This is where the management suite becomes useful.

#### Running from outside a repository

```text
jira-flow
```

opens the global dashboard.

```text
 JiraFlow

 Repositories

 ┌──────────────────┬──────────┬───────────┬────────────┐
 │ Repository       │ Mode     │ Issue     │ Health     │
 ├──────────────────┼──────────┼───────────┼────────────┤
 │ emblor           │ Hybrid   │ EMB-217   │ ✓ Healthy  │
 │ komanga          │ Hybrid   │ KM-148    │ ✓ Healthy  │
 │ jira-flow        │ Branch   │ —         │ ✓ Healthy  │
 │ portfolio        │ Manual   │ WEB-91    │ ✓ Healthy  │
 │ old-project      │ Hybrid   │ —         │ ⚠ Missing  │
 └──────────────────┴──────────┴───────────┴────────────┘

 [Enter] Manage
 [A] Add repository
 [D] Doctor
 [,] Settings
 [Q] Quit
```

#### Running from an initialized repository

I'd open **that repo's page first**, not the global dashboard.

Because context matters.

```text
cd emblor
jira-flow
```

→ Emblor overview.

Then:

```text
[G] All repositories
```

takes you global.  
  
That's much nicer than always dumping the user into a list.

## 15. Managing multiple repos

Selecting a repo gives:

```text
 Emblor

 ~/Developer/emblor

 Status
 ─────────────────────────
 JiraFlow            Enabled
 Mode                Hybrid
 Active issue        EMB-217
 Current branch      feat/EMB-217-headless
 Integration         Healthy

 Workflow
 ─────────────────────────
 Commit format       Jira Footer
 PR title template   Global default
 Issue pattern       Default

 Actions
 ─────────────────────────
 > Link issue
   Clear override
   Change mode
   Generate PR title
   Configure workflow
   Doctor
   Disable JiraFlow
   Remove JiraFlow
```

I would **not** let the global database blindly mutate repos that haven't been verified.

When you select one, JiraFlow opens it and reconciles:

```text
SQLite cache
      ↓
actual Git-local config
      ↓
actual hook state
```

**Actual repo wins.**

## 16. Moved/deleted repos

Suppose SQLite remembers:

```text
~/Developer/foo
```

but you moved it.

Dashboard:

```text
⚠ foo
  Repository path unavailable
```

Actions:

```text
> Locate repository
  Remove from JiraFlow registry
  Ignore
```

If you later open the moved repo and run JiraFlow there, it could recognize it by things like its remote identity and offer:

```text
This appears to be the previously registered repository "foo".

Update stored location?

> Yes
  No
```

That's a nice later refinement.

## 17. Doctor

From any repo:

```text
jira-flow doctor
```

or TUI:

```text
Doctor
```

Checks:

```text
✓ Git repository detected
✓ JiraFlow configuration valid
✓ Global registry synchronized
✓ commit-msg integration installed
✓ JiraFlow integration ownership verified
✓ Existing hooks preserved
✓ JiraFlow executable available
✓ Issue pattern valid
✓ Mode valid
✓ Active issue resolved

Healthy
```

If broken:

```text
✗ commit-msg integration missing

JiraFlow is configured, but the Git integration
is no longer installed.

> Repair
  View details
  Disable JiraFlow
```

Doctor should become the tool we wish old JiraFlow had whenever something behaves strangely.

## 18. Disable vs Remove

This distinction should be very clear.

#### Disable

```text
jira-flow disable
```

Means:

```text
Keep configuration.
Keep repo registered.
Stop modifying commits.
```

Then:

```text
jira-flow enable
```

resumes.

#### Remove

```text
jira-flow remove
```

Means:

```text
Remove JiraFlow's Git integration
Remove JiraFlow local configuration
Optionally remove registry entry
Do NOT disturb other hooks
```

TUI should confirm this because it's more substantial.

## 19. Uninstalling JiraFlow itself

Eventually:

```text
npm uninstall -g jira-flow
```

should **not** try to crawl through repos removing hooks.

That's dangerous.

Instead the JiraFlow binary should ideally make installed hooks resilient—e.g. if the executable is gone, the managed shim simply becomes a safe no-op rather than blocking Git.

Before uninstall, a user can run:

```text
jira-flow repositories
```

or use the dashboard to remove it from repos.

But package uninstall should not secretly modify arbitrary Git repositories.

## 20. The TUI's role

The TUI isn't mandatory.

Everything meaningful should have a CLI equivalent.

```text
TUI action                   Headless equivalent

Initialize                   jira-flow init
Link issue                   jira-flow link ABC-123
Clear override               jira-flow unlink
Status                       jira-flow status
Change mode                  jira-flow mode hybrid
Disable                      jira-flow disable
Enable                       jira-flow enable
Doctor                       jira-flow doctor
Generate PR title            jira-flow pr-title
Remove                       jira-flow remove
```

This gives us a very strong architecture rule:

> If something can only be done through OpenTUI, we've probably put business logic in the wrong layer.

## The v1 journey in one pass

The intended happy path becomes:

```text
npm install -g jira-flow
        ↓
cd project
        ↓
jira-flow init
        ↓
Hybrid configured
        ↓
create feat/ABC-123-whatever
        ↓
git commit normally
        ↓
JiraFlow references ABC-123 silently
        ↓
need temporary OPS-992 association?
        ↓
jira-flow link OPS-992
        ↓
commit normally
        ↓
jira-flow unlink
        ↓
back to ABC-123 from branch
        ↓
ready for PR?
        ↓
jira-flow pr-title
        ↓
paste generated company-format title
        ↓
jira-flow
        ↓
manage this repo or all JiraFlow repos
```

**That feels like the product to me.**

The biggest thing I'd lock now is this conceptual model:

```text
                 JiraFlow

        ┌──────────────────────┐
        │      OpenTUI         │
        │  Management Layer    │
        └──────────┬───────────┘
                   │
        ┌──────────▼───────────┐
        │   Headless Engine    │
        └──────────┬───────────┘
                   │
       ┌───────────┴────────────┐
       │                        │
 Git-local config         SQLite registry
 source of truth          discovery/cache
       │
 commit-msg integration
```

And I think we should make **Hybrid the default**, **Enabled separate from mode**, **no post-checkout hook**, **no Jira API**, and **PR-title generation local-only**.

The next useful step is to turn this journey into the **actual v1 product spec**: exact command surface, exact TUI screen map, configuration schema, SQLite entities, and which features are v1.0 versus later.
