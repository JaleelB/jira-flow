import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { createTuiContainer } from "../bootstrap/tui-container";
import { App } from "./app";
import type { TuiServices } from "./app-context";

/**
 * TUI entry point (architecture §32).
 *
 * `main.ts` dynamically imports this module only when the TUI is actually
 * needed. The internal hook command must never load it.
 *
 * VS-1: the startup context decides between the repository overview and
 * short stub screens. `Q` quits with exit code 0.
 */
export async function runTui(options: { path?: string; startSetup?: boolean } = {}): Promise<void> {
  const container = createTuiContainer();

  const services: TuiServices = {
    getStartupContext: (input) => container.getStartupContext.execute(input),
    getRepositoryStatus: (input) => container.getRepositoryStatus.execute(input),
    listRepositories: (input) => container.listRepositories.execute(input),
    initializeRepository: (input) => container.initializeRepository.execute(input),
    linkIssue: (input) => container.linkIssue.execute(input),
    unlinkIssue: (input) => container.unlinkIssue.execute(input),
    setMode: (input) => container.setMode.execute(input),
    setEnabled: (input) => container.setEnabled.execute(input),
    generatePrTitle: (input) => container.generatePrTitle.execute(input),
    runDoctor: (input) => container.runDoctor.execute(input),
    repairRepository: (input) => container.repairRepository.execute(input),
    removeRepository: (input) => container.removeRepository.execute({ ...input, yes: true }),
    manageConfig: (input) => container.manageConfig.execute(input),
    getGlobalSettings: () => container.settings.read(),
    setGlobalSetting: (key, value) => container.settings.set(key, value as never),
    locateRepository: (input) => container.manageRepositoryRegistry.locate(input),
    forgetRepository: (input) => container.manageRepositoryRegistry.remove(input),
  };

  const initialContext = await container.getStartupContext.execute({
    path: options.path ?? process.cwd(),
  });

  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    clearOnShutdown: true,
  });

  const root = createRoot(renderer);

  const quit = new Promise<void>((resolve) => {
    root.render(
      <App
        services={services}
        initialContext={initialContext}
        initialRoute={
          options.startSetup
            ? { name: "setup", repoPath: options.path ?? process.cwd() }
            : undefined
        }
        onQuit={() => resolve()}
      />,
    );
  });

  await quit;
  root.unmount();
  renderer.stop();
  renderer.destroy();
}
