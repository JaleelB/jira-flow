/**
 * Registry port (architecture §7.5, VS-1 subset).
 *
 * The SQLite registry is a dashboard registry only — never repository
 * truth. VS-1 needs registration after init; listing/removal arrive with
 * E8.
 */

export interface RegisteredRepository {
  id: string;
  path: string;
  displayName: string;
  remoteUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterRepositoryInput {
  path: string;
  displayName: string;
  remoteUrl: string | null;
}

export interface RegistryPort {
  /**
   * Registers (or refreshes) a repository in the global registry.
   * Implementations must tolerate re-registration of a known path.
   */
  register(input: RegisterRepositoryInput): Promise<RegisteredRepository>;
}
