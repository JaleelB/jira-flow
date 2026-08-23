/**
 * Typed application error model (architecture §36).
 *
 * Error behavior is decided by error type and code, never by string matching.
 * Exit codes follow architecture §37:
 *
 *   0 success
 *   1 unexpected/general error
 *   2 usage / invalid command input
 *   3 repository context/config error
 *   4 hook integration conflict/safety refusal
 *   5 storage/database error
 */

export abstract class JiraFlowError extends Error {
  abstract readonly code: string;
  abstract readonly exitCode: number;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** The current directory (or given path) is not inside a Git work tree. */
export class NotAGitRepositoryError extends JiraFlowError {
  readonly code = "NOT_A_GIT_REPOSITORY";
  readonly exitCode = 3;

  constructor(path: string) {
    super(`Not a Git repository: ${path}`);
  }
}

/** Bare repositories are unsupported in v1 (architecture §8.2). */
export class BareRepositoryUnsupportedError extends JiraFlowError {
  readonly code = "BARE_REPOSITORY_UNSUPPORTED";
  readonly exitCode = 3;

  constructor(path: string) {
    super(`Bare Git repositories are not supported: ${path}`);
  }
}

/** Repository has no JiraFlow configuration. */
export class RepositoryNotConfiguredError extends JiraFlowError {
  readonly code = "REPOSITORY_NOT_CONFIGURED";
  readonly exitCode = 3;

  constructor(path: string) {
    super(`JiraFlow is not configured for this repository: ${path}`);
  }
}

/** A Jira key failed strict whole-token validation. */
export class InvalidJiraKeyError extends JiraFlowError {
  readonly code = "INVALID_JIRA_KEY";
  readonly exitCode = 2;

  constructor(input: string) {
    super(`Invalid Jira issue key: ${input}`);
  }
}

/** A configured issue pattern is not a valid regular expression. */
export class InvalidIssuePatternError extends JiraFlowError {
  readonly code = "INVALID_ISSUE_PATTERN";
  readonly exitCode = 3;

  constructor(pattern: string, reason?: string) {
    super(`Invalid Jira issue pattern: ${pattern}${reason ? ` (${reason})` : ""}`);
  }
}

/** An existing `commit-msg` hook is present; JiraFlow refuses to own it. */
export class HookConflictError extends JiraFlowError {
  readonly code = "HOOK_CONFLICT";
  readonly exitCode = 4;

  constructor(hookPath: string) {
    super(
      `An existing commit-msg hook was detected at ${hookPath}. ` +
        "JiraFlow does not overwrite hooks it does not own. " +
        "Remove or rename the existing hook, then run `jira-flow init --yes` again.",
    );
  }
}

/** The existing hook cannot be modified safely. */
export class HookUnsafeToModifyError extends JiraFlowError {
  readonly code = "HOOK_UNSAFE_TO_MODIFY";
  readonly exitCode = 4;

  constructor(hookPath: string, reason: string) {
    super(`The commit-msg hook at ${hookPath} is unsafe to modify: ${reason}`);
  }
}

/** JiraFlow cannot write to the hook directory. */
export class HookPermissionDeniedError extends JiraFlowError {
  readonly code = "HOOK_PERMISSION_DENIED";
  readonly exitCode = 4;

  constructor(hookPath: string) {
    super(`Permission denied while writing hook: ${hookPath}`);
  }
}

/** The SQLite registry is unavailable. */
export class DatabaseUnavailableError extends JiraFlowError {
  readonly code = "DATABASE_UNAVAILABLE";
  readonly exitCode = 5;

  constructor(reason: string) {
    super(`JiraFlow database unavailable: ${reason}`);
  }
}

/** Persisted JiraFlow configuration is invalid. */
export class ConfigInvalidError extends JiraFlowError {
  readonly code = "CONFIG_INVALID";
  readonly exitCode = 3;

  constructor(key: string, value: string) {
    super(`Invalid JiraFlow configuration value for ${key}: ${value}`);
  }
}

/** The current platform is not supported for this operation. */
export class UnsupportedPlatformError extends JiraFlowError {
  readonly code = "UNSUPPORTED_PLATFORM";
  readonly exitCode = 1;

  constructor(detail: string) {
    super(`Unsupported platform: ${detail}`);
  }
}

/** Git is not installed or cannot be executed. */
export class GitUnavailableError extends JiraFlowError {
  readonly code = "GIT_UNAVAILABLE";
  readonly exitCode = 1;

  constructor(detail: string) {
    super(`Git is not available: ${detail}`);
  }
}

/** A Git invocation exceeded its timeout and was killed. */
export class GitTimeoutError extends JiraFlowError {
  readonly code = "GIT_TIMEOUT";
  readonly exitCode = 1;

  constructor(detail: string) {
    super(`Git timed out: ${detail}`);
  }
}

/** A worktree state file exists but cannot be parsed. Recoverable. */
export class WorktreeStateInvalidError extends JiraFlowError {
  readonly code = "WORKTREE_STATE_INVALID";
  readonly exitCode = 3;

  constructor(path: string, reason: string) {
    super(`Invalid JiraFlow worktree state at ${path}: ${reason}`);
  }
}

/** Branch mode does not accept `link`. */
export class LinkUnavailableInBranchModeError extends JiraFlowError {
  readonly code = "LINK_UNAVAILABLE_IN_BRANCH_MODE";
  readonly exitCode = 2;

  constructor() {
    super(
      "Issue linking is unavailable in Branch mode.\n\nSwitch to Hybrid or Manual:\n\n  jira-flow mode hybrid\n  jira-flow mode manual",
    );
  }
}

/** Interactive `init` needs a terminal capable of hosting the setup screen. */
export class InteractiveTerminalRequiredError extends JiraFlowError {
  readonly code = "INTERACTIVE_TERMINAL_REQUIRED";
  readonly exitCode = 2;

  constructor() {
    super(
      "Interactive setup requires a terminal. Re-run in a TTY, or use `jira-flow init --yes` to accept safe defaults.",
    );
  }
}

export class LegacyMigrationRequiredError extends JiraFlowError {
  readonly code = "LEGACY_MIGRATION_REQUIRED";
  readonly exitCode = 4;

  constructor() {
    super(
      "JiraFlow v0.5 integration detected. Run `jira-flow migrate` to review and migrate it safely.",
    );
  }
}

export class LegacyHookAmbiguousError extends JiraFlowError {
  readonly code = "LEGACY_HOOK_AMBIGUOUS";
  readonly exitCode = 4;

  constructor(paths: string[]) {
    super(
      `Legacy migration cannot prove ownership of: ${paths.join(", ")}. No hooks were changed.`,
    );
  }
}

export class LegacyMigrationNotNeededError extends JiraFlowError {
  readonly code = "LEGACY_MIGRATION_NOT_NEEDED";
  readonly exitCode = 2;

  constructor() {
    super("No recognized JiraFlow v0.5 integration was found in this repository.");
  }
}

/** A destructive command needs `--yes` when stdin is not a TTY. */
export class ConfirmationRequiredError extends JiraFlowError {
  readonly code = "CONFIRMATION_REQUIRED";
  readonly exitCode = 2;

  constructor(command: string) {
    super(`Refusing to run \`${command}\` without --yes because input is not interactive.`);
  }
}

/** `config` key is not in the constrained schema. */
export class UnknownConfigKeyError extends JiraFlowError {
  readonly code = "UNKNOWN_CONFIG_KEY";
  readonly exitCode = 2;

  constructor(key: string) {
    super(`Unknown configuration key: ${key}`);
  }
}

/** Global config is deferred to M3. */
export class GlobalConfigUnavailableError extends JiraFlowError {
  readonly code = "GLOBAL_CONFIG_UNAVAILABLE";
  readonly exitCode = 2;

  constructor() {
    super("Global configuration is not available yet (SQLite settings are M3).");
  }
}

/** A filesystem operation failed. */
export class FileSystemError extends JiraFlowError {
  readonly code = "FILESYSTEM_ERROR";
  readonly exitCode = 1;
}

export class NoActiveIssueError extends JiraFlowError {
  readonly code = "NO_ACTIVE_ISSUE";
  readonly exitCode = 3;

  constructor() {
    super(
      "No active Jira issue is available for PR-title generation. Link an issue or use a ticket branch.",
    );
  }
}

export class StoryTitleRequiredError extends JiraFlowError {
  readonly code = "STORY_TITLE_REQUIRED";
  readonly exitCode = 2;

  constructor(jiraKey: string) {
    super(
      `A story title is required for ${jiraKey}. Pass --title or run in an interactive terminal.`,
    );
  }
}
