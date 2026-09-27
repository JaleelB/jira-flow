# PR-Title Workflow

JiraFlow creates a title locally; it does not call Jira, GitHub, or `gh`.

```bash
jira-flow pr-title --title "Improve login errors"
jira-flow pr-title --no-copy
jira-flow pr-title --json
```

The default template is:

```text
{jiraKey} | {date} | {quarter} | {storyTitle}
```

Available variables are `{jiraKey}`, `{storyTitle}`, `{branch}`, `{repo}`,
`{date}`, and `{quarter}`. Quarter is the local calendar quarter. Date tokens
are `YYYY`, `MM`, and `DD`; the default date format is `YYYY-MM-DD`. Unknown
template placeholders remain literal and no template code is evaluated.

Story titles resolve in this order:

1. `--title` for this invocation;
2. the repository/issue metadata cache (for example from `link --title`);
3. an interactive prompt when a terminal is available.

Use `config set prTitleTemplate ...` and `config set dateFormat ...` for
repository overrides, or the corresponding `default*` keys with `--global`.

Copying uses `pbcopy` on macOS, `clip.exe`/PowerShell on Windows, and
`wl-copy`/`xclip`/`xsel` on Linux when available. Adapters execute argument
arrays without a shell. Missing clipboard support is nonfatal and the title is
still printed; `--no-copy` disables the attempt.
