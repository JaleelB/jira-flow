/**
 * Filesystem port (architecture §4).
 *
 * Keeps use cases independent of direct Node/Bun filesystem access.
 */

export interface FilesystemPort {
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  /** Atomic write: temp file + rename in the same directory. */
  writeFileAtomic(path: string, content: string): Promise<void>;
}
