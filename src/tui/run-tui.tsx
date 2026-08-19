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
export async function runTui(options: { path?: string } = {}): Promise<void> {
  const container = createTuiContainer();

  const services: TuiServices = {
    getStartupContext: (input) => container.getStartupContext.execute(input),
    getRepositoryStatus: (input) => container.getRepositoryStatus.execute(input),
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
      <App services={services} initialContext={initialContext} onQuit={() => resolve()} />,
    );
  });

  await quit;
  root.unmount();
  renderer.stop();
  renderer.destroy();
}
