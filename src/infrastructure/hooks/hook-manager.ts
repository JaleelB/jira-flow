import {
  chmodSync,
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  writeSync,
} from "node:fs";
import type { GitPort, GitRepositoryContext } from "../../application/ports/git.port";
import type {
  HookInspection,
  HookInstallOptions,
  HookInstallResult,
  HookManagerPort,
} from "../../application/ports/hooks.port";
import { HookConflictError, HookPermissionDeniedError } from "../../domain/errors";
import type { GitRunner } from "../git/git-runner";
import { analyzeCommitMsgHook } from "./hook-analyzer";
import { generateOwnedHookScript } from "./hook-script";

/**
 * Hook manager (ADR-0005, architecture §16, VS-1 Strategy A only).
 *
 * The effective hooks directory is resolved through Git (ADR-0003/O-01):
 * `core.hooksPath` is honored and the default comes from
 * `git rev-parse --git-path hooks`. JiraFlow never touches `.git/hooks`
 * by string concatenation.
 *
 * Only `commit-msg` is managed; no `post-checkout` hook exists in v1
 * (ADR-0005/O-03).
 */

export class HookManager implements HookManagerPort {
  private readonly git: GitPort;
  private readonly runner: GitRunner;

  constructor(git: GitPort, runner: GitRunner) {
    this.git = git;
    this.runner = runner;
  }

  async inspect(repo: GitRepositoryContext): Promise<HookInspection> {
    const hooks = await this.git.resolveHooks(repo);
    const content = await this.readHookFile(hooks.commitMsgPath);
    const analysis = analyzeCommitMsgHook(content);

    switch (analysis.status) {
      case "missing":
        return { status: "missing", hookPath: hooks.commitMsgPath };
      case "owned":
        return { status: "owned", hookPath: hooks.commitMsgPath };
      case "conflict":
        return {
          status: "conflict",
          hookPath: hooks.commitMsgPath,
          reason: analysis.reason,
        };
    }
  }

  async installOwned(
    repo: GitRepositoryContext,
    options: HookInstallOptions,
  ): Promise<HookInstallResult> {
    const hooks = await this.git.resolveHooks(repo);
    const existing = await this.readHookFile(hooks.commitMsgPath);
    const analysis = analyzeCommitMsgHook(existing);

    if (analysis.status === "conflict") {
      // Foreign or damaged hooks are never modified (ADR-0005/O-01).
      throw new HookConflictError(hooks.commitMsgPath);
    }

    const script = generateOwnedHookScript({ binaryPath: options.binaryPath });
    const created = analysis.status === "missing";

    if (existing === script) {
      return { strategy: "owned", hookPath: hooks.commitMsgPath, created: false };
    }

    this.writeHookFile(hooks.commitMsgPath, script);
    return { strategy: "owned", hookPath: hooks.commitMsgPath, created };
  }

  private async readHookFile(path: string): Promise<string | null> {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      return null;
    }
    return await file.text();
  }

  /**
   * Writes the hook atomically (temp file + rename) with the executable
   * bit set before the rename, so Git never sees a partial or non-
   * executable hook.
   */
  private writeHookFile(path: string, content: string): void {
    mkdirSync(this.dirname(path), { recursive: true });
    const temp = `${path}.jiraflow-tmp-${process.pid}-${Date.now()}`;
    const fd = openSync(temp, "w");
    try {
      writeSync(fd, content);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    chmodSync(temp, 0o755);
    try {
      renameSync(temp, path);
    } catch {
      rmSync(temp, { force: true });
      throw new HookPermissionDeniedError(path);
    }
  }

  private dirname(path: string): string {
    const normalized = path.replaceAll("\\", "/");
    const index = normalized.lastIndexOf("/");
    return index === -1 ? "." : normalized.slice(0, index);
  }
}
