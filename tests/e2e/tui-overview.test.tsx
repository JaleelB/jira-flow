import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { testRender } from "@opentui/react/test-utils";
import { act } from "react";
import { GetRepositoryStatus } from "../../src/application/use-cases/get-repository-status";
import { GitAdapter } from "../../src/infrastructure/git/git-adapter";
import { GitConfigStore } from "../../src/infrastructure/git/git-config-store";
import { GitRunner } from "../../src/infrastructure/git/git-runner";
import { HookManager } from "../../src/infrastructure/hooks/hook-manager";
import { WorktreeStateStore } from "../../src/infrastructure/state/worktree-state-store";
import { App } from "../../src/tui/app";
import type { TuiServices } from "../../src/tui/app-context";
import { createTempGitRepository, type TempRepository } from "../helpers/temp-repository";

/**
 * VT-14 — TUI repository overview (VS1-11).
 *
 * The overview renders the same status fields the CLI prints, sourced from
 * the `getRepositoryStatus` use case over a real temp repository. The
 * component itself performs no Git execution and no SQLite access.
 */

const repos: TempRepository[] = [];
const projectRoot = join(import.meta.dir, "..", "..");

afterAll(() => {
  for (const repo of repos.splice(0)) repo.cleanup();
});

const noopServices = {
  getStartupContext: async () => ({ kind: "empty-state" }),
  getRepositoryStatus: async () => {
    throw new Error("not expected in this test");
  },
} as unknown as TuiServices;

interface RenderSetup {
  captureCharFrame(): string;
  flush(): Promise<void>;
}

async function captureWhenReady(setup: RenderSetup, marker: string): Promise<string> {
  let frame = setup.captureCharFrame();
  for (let attempt = 0; attempt < 100 && !frame.includes(marker); attempt++) {
    await act(async () => {
      await Bun.sleep(10);
      await setup.flush();
    });
    frame = setup.captureCharFrame();
  }
  return frame;
}

async function makeStatusView() {
  const repo = createTempGitRepository({ initialBranch: "main" });
  repos.push(repo);
  await repo.runOk(["commit", "--allow-empty", "-m", "initial"]);
  await repo.runOk(["switch", "-c", "feat/ABC-123-login"]);

  const runner = new GitRunner({ env: repo.env });
  const git = new GitAdapter(runner);
  const context = await git.discoverRepository(repo.root);
  const config = new GitConfigStore(runner);
  await config.setEnabled(context, true);
  await config.setMode(context, "hybrid");
  await config.setCommitFormat(context, "footer");
  const state = new WorktreeStateStore(runner);
  const hooks = new HookManager(git, runner);
  await hooks.installOwned(context, { binaryPath: "/opt/jira-flow/jira-flow" });

  const getRepositoryStatus = new GetRepositoryStatus({ git, config, state, hooks });
  const view = await getRepositoryStatus.execute({ path: repo.root });
  return { repo, view };
}

describe("Repository overview", () => {
  test("renders status fields from the application view model", async () => {
    const { view } = await makeStatusView();
    const setup = await testRender(
      <App
        services={{ ...noopServices, getRepositoryStatus: async () => view }}
        initialContext={{ kind: "repository-overview", status: view }}
        onQuit={() => {}}
      />,
      { width: 90, height: 26 },
    );
    const frame = await captureWhenReady(setup, "ACTIVE TICKET");

    expect(frame).toContain(view.repoName);
    expect(frame).toContain("ACTIVE TICKET");
    expect(frame).toContain("WORKFLOW");
    expect(frame).toContain("REPOSITORY");
    expect(frame).toContain("Enabled");
    expect(frame).toContain("Hybrid");
    expect(frame).toContain("ABC-123");
    expect(frame).toContain("feat/ABC-123-login");
    expect(frame).toContain("Healthy");
    expect(frame).toContain("footer");
    expect(frame.toUpperCase()).toContain("Q QUIT");
    setup.renderer.destroy();
  });

  test("quits on q", async () => {
    const { view } = await makeStatusView();
    let quitCount = 0;
    const setup = await testRender(
      <App
        services={{ ...noopServices, getRepositoryStatus: async () => view }}
        initialContext={{ kind: "repository-overview", status: view }}
        onQuit={() => quitCount++}
      />,
      { width: 72, height: 26 },
    );
    await captureWhenReady(setup, "ACTIVE TICKET");
    await act(async () => {
      setup.mockInput.pressKey("q");
      await setup.flush();
    });
    expect(quitCount).toBe(1);
    setup.renderer.destroy();
  });
});

describe("App routing", () => {
  test("unconfigured repo route renders setup navigation", async () => {
    const repo = createTempGitRepository();
    repos.push(repo);
    const setup = await testRender(
      <App
        services={noopServices}
        initialContext={{ kind: "unconfigured-repo", repoPath: repo.root }}
        onQuit={() => {}}
      />,
      { width: 64, height: 20 },
    );
    const frame = await captureWhenReady(setup, "JIRAFLOW");
    expect(frame).toContain("JIRAFLOW");
    expect(frame).toContain("S2");
    expect(frame).toContain("Unconfigured Repository");
    expect(frame).toContain("Set up JiraFlow");
    setup.renderer.destroy();
  });

  test("empty state route renders the global empty state", async () => {
    const setup = await testRender(
      <App services={noopServices} initialContext={{ kind: "empty-state" }} onQuit={() => {}} />,
      { width: 64, height: 20 },
    );
    const frame = await captureWhenReady(setup, "JIRAFLOW");
    expect(frame).toContain("JIRAFLOW");
    expect(frame).toContain("S1");
    expect(frame).toContain("No repositories are configured yet");
    setup.renderer.destroy();
  });
});

describe("TUI component boundaries (VT-14)", () => {
  test("presentation components have no Git or SQLite imports", () => {
    const source = readFileSync(
      join(projectRoot, "src", "tui", "screens", "route-content.tsx"),
      "utf8",
    );
    expect(source).not.toContain("bun:sqlite");
    expect(source).not.toContain("runGit");
    expect(source).not.toContain("GitRunner");
    expect(source).not.toContain("infrastructure/");
  });

  test("app component has no Git or SQLite imports", () => {
    const source = readFileSync(join(projectRoot, "src", "tui", "app.tsx"), "utf8");
    expect(source).not.toContain("bun:sqlite");
    expect(source).not.toContain("GitRunner");
    expect(source).not.toContain("infrastructure/");
  });
});
