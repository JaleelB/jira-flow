/**
 * JiraFlow version constants.
 *
 * Values are injected at compile time by `scripts/build.ts`
 * (`--define __JIRAFLOW_VERSION__=...`). When running from source with Bun,
 * the defines do not exist, so dev fallbacks are used.
 *
 * `--version` must never read `package.json` at runtime (ADR-0007/O-03).
 */

declare const __JIRAFLOW_VERSION__: string;
declare const __JIRAFLOW_COMMIT__: string;
declare const __JIRAFLOW_BUILD_DATE__: string;

const DEVELOPMENT_VERSION = "1.0.0-alpha.0"; // x-release-please-version

export const VERSION: string =
  typeof __JIRAFLOW_VERSION__ === "undefined" ? DEVELOPMENT_VERSION : __JIRAFLOW_VERSION__;

export const COMMIT: string =
  typeof __JIRAFLOW_COMMIT__ === "undefined" ? "dev" : __JIRAFLOW_COMMIT__;

export const BUILD_DATE: string =
  typeof __JIRAFLOW_BUILD_DATE__ === "undefined" ? "dev" : __JIRAFLOW_BUILD_DATE__;
