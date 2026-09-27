import { createCliContainer } from "./cli-container";

/** OpenTUI composition root exposing application use cases only. */
export function createTuiContainer() {
  return createCliContainer();
}
