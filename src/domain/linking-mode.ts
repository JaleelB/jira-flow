/** Linking modes (product spec §4.2). */
export type LinkingMode = "hybrid" | "branch" | "manual";

export const DEFAULT_LINKING_MODE: LinkingMode = "hybrid";

export function isLinkingMode(value: string): value is LinkingMode {
  return value === "hybrid" || value === "branch" || value === "manual";
}
