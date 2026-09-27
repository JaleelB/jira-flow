import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync } from "node:fs";
import { join } from "node:path";
import type { GitRepositoryContext } from "../../../src/application/ports/git.port";
import { InitializeRepository } from "../../../src/application/use-cases/initialize-repository";
import { GitAdapter } from "../../../src/infrastructure/git/git-adapter";
import { GitConfigStore } from "../../../src/infrastructure/git/git-config-store";
import { GitRunner } from "../../../src/infrastructure/git/git-runner";
import { HookManager } from "../../../src/infrastructure/hooks/hook-manager";
import { BEGIN_MARKER } from "../../../src/infrastructure/hooks/hook-markers";
import { IntegrationMetadataStore } from "../../../src/infrastructure/hooks/integration-metadata";
import { WorktreeStateStore } from "../../../src/infrastructure/state/worktree-state-store";
import { createTempGitRepository, type TempRepository } from "../../helpers/temp-repository";

const repos: TempRepository[] = [];

afterAll(() => {
  for (const repo of repos.splice(0)) repo.cleanup();
});

describe("composed init rollback", () => {
  test("restores the exact pre-init foreign hook when metadata write fails", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);

    const original = "#!/bin/sh\necho keep-me-exactly\nexit 0\n";
    const hookPath = join(repo.root, ".git", "hooks", "commit-msg");
    await Bun.write(hookPath, original);
    chmodSync(hookPath, 0o755);

    const runner = new GitRunner({ env: repo.env });
    const git = new GitAdapter(runner);
    const innerMetadata = new IntegrationMetadataStore(runner);
    const metadata = {
      async write(
        ctx: GitRepositoryContext,
        input: Parameters<IntegrationMetadataStore["write"]>[1],
      ) {
        await innerMetadata.write(ctx, input);
        throw new Error("forced metadata failure");
      },
      async remove(ctx: GitRepositoryContext) {
        await innerMetadata.remove(ctx);
      },
    };

    const useCase = new InitializeRepository({
      git,
      config: new GitConfigStore(runner),
      state: new WorktreeStateStore(runner),
      hooks: new HookManager(git, runner),
      metadata,
      registry: null,
      captureBinaryPath: () => "/opt/jira-flow/jira-flow",
    });

    await expect(useCase.execute({ path: repo.root, composeExistingHook: true })).rejects.toThrow(
      "forced metadata failure",
    );

    expect(await Bun.file(hookPath).text()).toBe(original);
    expect(await Bun.file(hookPath).text()).not.toContain(BEGIN_MARKER);
    const metaPath = (
      await repo.runOk([
        "rev-parse",
        "--path-format=absolute",
        "--git-path",
        "jiraflow/integration.json",
      ])
    ).trim();
    expect(await Bun.file(metaPath).exists()).toBe(false);
  });
});
