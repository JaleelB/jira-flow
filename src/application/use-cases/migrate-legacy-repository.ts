import { LegacyHookAmbiguousError, LegacyMigrationNotNeededError } from "../../domain/errors";
import type { LegacyHooksPort } from "../ports/legacy-hooks.port";
import type { InitializeRepository, InitializeRepositoryResult } from "./initialize-repository";
import type { InspectLegacyRepository, LegacyInspection } from "./inspect-legacy-repository";

export interface LegacyMigrationResult {
  repoPath: string;
  removedLegacyHooks: string[];
  mode: "hybrid";
  initialization: InitializeRepositoryResult;
}

export class MigrateLegacyRepository {
  constructor(
    private readonly deps: {
      inspect: InspectLegacyRepository;
      legacyHooks: LegacyHooksPort;
      initialize: InitializeRepository;
    },
  ) {}

  preview(input: { path: string }): Promise<LegacyInspection> {
    return this.deps.inspect.execute(input);
  }

  async execute(input: { path: string }): Promise<LegacyMigrationResult> {
    const inspection = await this.preview(input);
    if (!inspection.detected) throw new LegacyMigrationNotNeededError();
    if (!inspection.eligible) throw new LegacyHookAmbiguousError(inspection.ambiguousPaths);

    await this.deps.legacyHooks.removeVerified(inspection.snapshot, inspection.legacyHooks);
    try {
      const initialization = await this.deps.initialize.execute({
        path: inspection.repoPath,
        mode: "hybrid",
      });
      return {
        repoPath: inspection.repoPath,
        removedLegacyHooks: inspection.legacyHooks,
        mode: "hybrid",
        initialization,
      };
    } catch (error) {
      try {
        await this.deps.legacyHooks.restore(inspection.snapshot, inspection.legacyHooks);
      } catch (restoreError) {
        throw new Error(
          `legacy migration failed and exact hook restoration failed: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`,
          { cause: error },
        );
      }
      throw error;
    }
  }
}
