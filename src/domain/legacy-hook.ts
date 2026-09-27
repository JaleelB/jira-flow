export type LegacyHookName = "commit-msg" | "post-checkout";

export type LegacyHookArtifact =
  | { kind: "missing" }
  | { kind: "file"; content: string; executable: boolean }
  | { kind: "symlink"; target: string }
  | { kind: "other" };

export type LegacyHookClassification =
  | { kind: "missing"; hookName: LegacyHookName }
  | {
      kind: "legacy-wrapper" | "legacy-helper-symlink";
      hookName: LegacyHookName;
      helper: "commitmsg" | "postco";
    }
  | { kind: "unknown"; hookName: LegacyHookName; reason: string };

const SAFE_GENERATED_PATH = /^[A-Za-z0-9_./\\: +@()-]+$/;

/** Exact forms emitted by v0.5.0 internal/git.go and internal/status.go. */
export function classifyLegacyHook(
  hookName: LegacyHookName,
  artifact: LegacyHookArtifact,
): LegacyHookClassification {
  if (artifact.kind === "missing") return { kind: "missing", hookName };
  const helper = hookName === "commit-msg" ? "commitmsg" : "postco";
  if (artifact.kind === "symlink") {
    return helperBasename(artifact.target) === helper ||
      helperBasename(artifact.target) === `${helper}.exe`
      ? { kind: "legacy-helper-symlink", hookName, helper }
      : { kind: "unknown", hookName, reason: "symlink target is not the v0.5 helper" };
  }
  if (artifact.kind === "other") {
    return { kind: "unknown", hookName, reason: "hook is not a regular file or symlink" };
  }
  const prefix = "#!/bin/sh\n";
  const suffix = ' "$@"';
  if (!artifact.content.startsWith(prefix) || !artifact.content.endsWith(suffix)) {
    return { kind: "unknown", hookName, reason: "content does not match the v0.5 wrapper" };
  }
  let binaryPath = artifact.content.slice(prefix.length, -suffix.length);
  if (binaryPath.startsWith('"') && binaryPath.endsWith('"')) {
    binaryPath = binaryPath.slice(1, -1);
  }
  if (!SAFE_GENERATED_PATH.test(binaryPath)) {
    return {
      kind: "unknown",
      hookName,
      reason: "wrapper path contains non-generated shell syntax",
    };
  }
  const basename = helperBasename(binaryPath);
  if (basename !== helper && basename !== `${helper}.exe`) {
    return { kind: "unknown", hookName, reason: "wrapper does not invoke the v0.5 helper" };
  }
  return { kind: "legacy-wrapper", hookName, helper };
}

function helperBasename(path: string): string {
  const normalized = path.replaceAll("\\\\", "/").replaceAll("\\", "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}
