import { closeSync, fsyncSync, mkdirSync, openSync, renameSync, rmSync, writeSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Atomic JSON file writes (architecture §11, §E3-4).
 *
 * write temp file -> fsync -> rename over the target. Readers never observe
 * a partially written state file.
 */

export function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });

  const temp = `${path}.tmp-${process.pid}-${Date.now()}`;
  const data = `${JSON.stringify(value, null, 2)}\n`;

  const fd = openSync(temp, "w");
  try {
    writeSync(fd, data);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }

  renameSync(temp, path);
}

/** Reads and parses a JSON file; returns null when it does not exist. */
export async function readJsonFile(path: string): Promise<unknown | null> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return null;
  }
  const text = await file.text();
  return JSON.parse(text);
}

/** Deletes a file if it exists; never throws for a missing file. */
export function removeFileIfExists(path: string): void {
  rmSync(path, { force: true });
}
