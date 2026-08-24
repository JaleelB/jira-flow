import { realpathSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

/**
 * Returns one stable filesystem identity for an absolute or relative path.
 *
 * Git can report a physical path that differs from the spelling supplied by
 * the caller (`/private/var` vs `/var` on macOS, or a long path vs an 8.3 path
 * on Windows). Hook directories may not exist yet, so canonicalize the nearest
 * existing ancestor and preserve the missing suffix.
 */
export function canonicalizePath(path: string): string {
  const absolute = resolve(path);
  const suffix: string[] = [];
  let candidate = absolute;

  while (true) {
    try {
      return resolve(realpathSync.native(candidate), ...suffix);
    } catch {
      const parent = dirname(candidate);
      if (parent === candidate) return absolute;
      suffix.unshift(basename(candidate));
      candidate = parent;
    }
  }
}
