import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { SmokeScreen } from "./screens/smoke";

/**
 * TUI entry point.
 *
 * `main.ts` dynamically imports this module only when the TUI is actually
 * needed (ADR-0002/O-02, architecture §32). The internal hook command must
 * never load it.
 */

/**
 * VS-0 smoke TUI: renders the toolchain smoke screen and exits cleanly on Q.
 * Replaced by the real startup router in T-19.
 */
export async function runSmokeTui(): Promise<void> {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    clearOnShutdown: true,
  });

  const root = createRoot(renderer);

  const quit = new Promise<void>((resolve) => {
    root.render(<SmokeScreen onQuit={() => resolve()} />);
  });

  await quit;
  root.unmount();
  renderer.stop();
  renderer.destroy();
}
