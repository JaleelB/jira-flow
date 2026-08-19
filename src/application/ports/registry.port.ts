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
  /** Unix epoch milliseconds (SQLite schema stores INTEGER). */
  createdAt: number;
  updatedAt: number;
}

export interface RegisterRepositoryInput {
  path: string;
  displayName: string;
  remoteUrl: string | null;
}

export interface RegistryPort {
  register(input: RegisterRepositoryInput): Promise<RegisteredRepository>;
  findByPath(path: string): Promise<RegisteredRepository | null>;
  unregister(path: string): Promise<boolean>;
}
