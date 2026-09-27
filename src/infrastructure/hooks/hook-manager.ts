import { createHash } from "node:crypto";
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
import { join } from "node:path";
import type { GitPort, GitRepositoryContext } from "../../application/ports/git.port";
import type {
  HookInspection,
  HookInstallOptions,
  HookInstallResult,
  HookManagerPort,
  HookRemoveResult,
} from "../../application/ports/hooks.port";
import {
  HookConflictError,
  HookPermissionDeniedError,
  HookUnsafeToModifyError,
} from "../../domain/errors";
import type { GitRunner } from "../git/git-runner";
import {
  insertManagedBlockAfterShebang,
  replaceManagedBlock,
  stripManagedBlock,
} from "./compose-shell-hook";
import { analyzeCommitMsgHook } from "./hook-analyzer";
import { classifyHooksPath } from "./hook-path-classification";
import { generateManagedBlock, generateOwnedHookScript, isGeneratedOwnedHook } from "./hook-script";
import { IntegrationMetadataStore } from "./integration-metadata";

/**
 * Hook manager (ADR-0005, architecture §16–18, DR-0018).
 *
 * Effective hooks directory is resolved through Git. `--yes` is not a
 * parameter here; callers pass explicit compose/shared consent.
 */

export class HookManager implements HookManagerPort {
  private readonly git: GitPort;
  private readonly metadata: IntegrationMetadataStore;

  constructor(git: GitPort, runner: GitRunner) {
    this.git = git;
    this.metadata = new IntegrationMetadataStore(runner);
  }

  async inspect(repo: GitRepositoryContext): Promise<HookInspection> {
    const hooks = await this.git.resolveHooks(repo);
    const pathClass = classifyHooksPath(repo, hooks);
    let content: string | null;
    try {
      content = await this.readHookFile(hooks.commitMsgPath);
    } catch {
      return {
        status: "permission-denied",
        hookPath: hooks.commitMsgPath,
        hooksPathClass: pathClass,
        reason: "commit-msg is not readable",
      };
    }

    const analysis = analyzeCommitMsgHook(content);
    const contentClass = analysis.status;
    const base: HookInspection = {
      status: contentClass === "composable-shell" ? "composable-shell" : contentClass,
      hookPath: hooks.commitMsgPath,
      hooksPathClass: pathClass,
      contentClass,
      ...(analysis.status === "composable-shell" ? { interpreter: analysis.interpreter } : {}),
      ...("reason" in analysis ? { reason: analysis.reason } : {}),
    };

    if (
      pathClass === "shared-external" &&
      (contentClass === "missing" || contentClass === "composable-shell")
    ) {
      return {
        ...base,
        status: "shared-external",
        reason:
          contentClass === "missing"
            ? "hooksPath is shared/external; missing commit-msg requires --compose-existing-hook and --allow-shared-hooks"
            : "hooksPath is shared/external; composing requires --compose-existing-hook --allow-shared-hooks",
      };
    }

    if (contentClass === "unsupported" || contentClass === "malformed-jiraflow") {
      return { ...base, status: contentClass };
    }

    return base;
  }

  async installOwned(
    repo: GitRepositoryContext,
    options: HookInstallOptions,
  ): Promise<HookInstallResult> {
    return this.install(repo, { ...options, composeExistingHook: false, allowSharedHooks: false });
  }

  async install(
    repo: GitRepositoryContext,
    options: HookInstallOptions,
  ): Promise<HookInstallResult> {
    const compose = options.composeExistingHook === true;
    const allowShared = options.allowSharedHooks === true;
    const hooks = await this.git.resolveHooks(repo);
    const pathClass = classifyHooksPath(repo, hooks);
    const shared = pathClass === "shared-external";

    let existing: string | null;
    try {
      existing = await this.readHookFile(hooks.commitMsgPath);
    } catch {
      throw new HookPermissionDeniedError(hooks.commitMsgPath);
    }

    const analysis = analyzeCommitMsgHook(existing);

    if (
      shared &&
      (!compose || !allowShared) &&
      analysis.status !== "owned" &&
      analysis.status !== "managed-block"
    ) {
      throw new HookUnsafeToModifyError(
        hooks.commitMsgPath,
        "shared/external hooksPath requires --compose-existing-hook and --allow-shared-hooks",
      );
    }

    if (analysis.status === "unsupported") {
      throw new HookUnsafeToModifyError(hooks.commitMsgPath, analysis.reason);
    }
    if (analysis.status === "malformed-jiraflow") {
      throw new HookUnsafeToModifyError(hooks.commitMsgPath, analysis.reason);
    }

    if (analysis.status === "composable-shell") {
      if (!compose) {
        throw new HookConflictError(hooks.commitMsgPath);
      }
      if (shared && !allowShared) {
        throw new HookUnsafeToModifyError(
          hooks.commitMsgPath,
          "shared/external composition requires --compose-existing-hook and --allow-shared-hooks",
        );
      }
      return this.composeInto(repo, hooks.commitMsgPath, existing ?? "", options.binaryPath);
    }

    if (analysis.status === "missing") {
      if (shared && (!compose || !allowShared)) {
        throw new HookUnsafeToModifyError(
          hooks.commitMsgPath,
          "shared/external hooksPath requires --compose-existing-hook and --allow-shared-hooks",
        );
      }
      const script = generateOwnedHookScript({ binaryPath: options.binaryPath });
      this.writeHookFile(hooks.commitMsgPath, script);
      return { strategy: "owned", hookPath: hooks.commitMsgPath, created: true };
    }

    if (analysis.status === "owned") {
      const script = generateOwnedHookScript({ binaryPath: options.binaryPath });
      if (existing === script) {
        return { strategy: "owned", hookPath: hooks.commitMsgPath, created: false };
      }
      this.writeHookFile(hooks.commitMsgPath, script);
      return { strategy: "owned", hookPath: hooks.commitMsgPath, created: false };
    }

    // managed-block: refresh the block in place, never duplicate.
    const block = generateManagedBlock({ binaryPath: options.binaryPath });
    const next = replaceManagedBlock(existing ?? "", block);
    if (next !== existing) {
      this.writeHookFile(hooks.commitMsgPath, next);
    }
    return { strategy: "composed", hookPath: hooks.commitMsgPath, created: false };
  }

  async removeOwned(repo: GitRepositoryContext, options: HookInstallOptions): Promise<boolean> {
    const result = await this.remove(repo, options);
    return result.mode === "owned-file";
  }

  async rollbackInstall(result: HookInstallResult, _options: HookInstallOptions): Promise<void> {
    if (result.strategy !== "composed" || result.backupPath === undefined) {
      throw new HookUnsafeToModifyError(
        result.hookPath,
        "exact composed-hook rollback requires installation backup evidence",
      );
    }

    const original = await this.readHookFile(result.backupPath);
    if (original === null) {
      throw new HookUnsafeToModifyError(result.hookPath, "composition backup is missing");
    }
    const originalSha256 = createHash("sha256").update(original).digest("hex");
    if (result.originalSha256 === undefined || originalSha256 !== result.originalSha256) {
      throw new HookUnsafeToModifyError(result.hookPath, "composition backup hash does not match");
    }

    this.writeHookFile(result.hookPath, original);
    rmSync(result.backupPath, { force: true });
  }

  async remove(
    repo: GitRepositoryContext,
    _options: HookInstallOptions,
  ): Promise<HookRemoveResult> {
    const hooks = await this.git.resolveHooks(repo);
    const pathClass = classifyHooksPath(repo, hooks);
    const existing = await this.readHookFile(hooks.commitMsgPath);
    if (existing === null) {
      return { removed: false, mode: "none", hookPath: hooks.commitMsgPath };
    }

    const analysis = analyzeCommitMsgHook(existing);

    if (pathClass === "shared-external") {
      return { removed: false, mode: "skipped-shared", hookPath: hooks.commitMsgPath };
    }

    if (analysis.status === "owned") {
      // The captured path may differ after an upgrade, but every other byte
      // must still match the generated owned hook before whole-file deletion.
      if (!isGeneratedOwnedHook(existing)) {
        return { removed: false, mode: "none", hookPath: hooks.commitMsgPath };
      }
      rmSync(hooks.commitMsgPath, { force: true });
      return { removed: true, mode: "owned-file", hookPath: hooks.commitMsgPath };
    }

    if (analysis.status === "managed-block") {
      const stripped = stripManagedBlock(existing);
      this.writeHookFile(hooks.commitMsgPath, stripped.endsWith("\n") ? stripped : `${stripped}\n`);
      return { removed: true, mode: "stripped-block", hookPath: hooks.commitMsgPath };
    }

    return { removed: false, mode: "none", hookPath: hooks.commitMsgPath };
  }

  private async composeInto(
    repo: GitRepositoryContext,
    hookPath: string,
    original: string,
    binaryPath: string | null,
  ): Promise<HookInstallResult> {
    const sha = createHash("sha256").update(original).digest("hex");
    const backupDir = await this.metadata.resolveBackupDir(repo);
    mkdirSync(backupDir, { recursive: true });
    const backupPath = join(backupDir, `commit-msg.${sha.slice(0, 16)}.bak`);
    this.writeHookFile(backupPath, original);

    const block = generateManagedBlock({ binaryPath });
    const composed = insertManagedBlockAfterShebang(original, block);
    this.writeHookFile(hookPath, composed);

    try {
      await this.metadata.write(repo, {
        hookPath,
        capturedBinaryPath: binaryPath,
        strategy: "composed",
        originalSha256: sha,
        backupPath,
      });
    } catch (error) {
      this.writeHookFile(hookPath, original);
      throw error;
    }

    return {
      strategy: "composed",
      hookPath,
      created: false,
      backupPath,
      originalSha256: sha,
    };
  }

  private async readHookFile(path: string): Promise<string | null> {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      return null;
    }
    return await file.text();
  }

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
