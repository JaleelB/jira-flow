import type { LegacyHookArtifact, LegacyHookName } from "../../domain/legacy-hook";

export interface LegacyHookSnapshot {
  hooksDir: string;
  hooks: Record<LegacyHookName, LegacyHookArtifact>;
}

export interface LegacyHooksPort {
  capture(hooksDir: string): Promise<LegacyHookSnapshot>;
  /** Verify the complete snapshot still matches, then remove only requested names. */
  removeVerified(snapshot: LegacyHookSnapshot, names: LegacyHookName[]): Promise<void>;
  /** Restore removed artifacts only into still-missing paths. */
  restore(snapshot: LegacyHookSnapshot, names: LegacyHookName[]): Promise<void>;
}
