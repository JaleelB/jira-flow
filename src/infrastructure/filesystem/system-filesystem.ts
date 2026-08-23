import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  writeSync,
} from "node:fs";
import { dirname } from "node:path";
import type { FilesystemPort } from "../../application/ports/filesystem.port";

/**
 * System filesystem adapter.
 *
 * Writes are atomic (temp file + fsync + rename). Reads return raw string
 * content; no newline or encoding transformation happens here.
 */

export class SystemFilesystem implements FilesystemPort {
  async exists(path: string): Promise<boolean> {
    return existsSync(path);
  }

  async readFile(path: string): Promise<string> {
    return await Bun.file(path).text();
  }

  async writeFileAtomic(path: string, content: string): Promise<void> {
    mkdirSync(dirname(path), { recursive: true });
    const temp = `${path}.jiraflow-tmp-${process.pid}-${Date.now()}`;
    const fd = openSync(temp, "w");
    try {
      writeSync(fd, content);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    try {
      renameSync(temp, path);
    } catch {
      rmSync(temp, { force: true });
      throw new Error(`atomic write failed for ${path}`);
    }
  }
}
