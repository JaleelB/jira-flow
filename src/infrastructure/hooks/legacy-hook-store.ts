import {
  chmodSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type {
  LegacyHookSnapshot,
  LegacyHooksPort,
} from "../../application/ports/legacy-hooks.port";
import type { LegacyHookArtifact, LegacyHookName } from "../../domain/legacy-hook";
import { SystemFilesystem } from "../filesystem/system-filesystem";

export class LegacyHookStore implements LegacyHooksPort {
  constructor(private readonly filesystem = new SystemFilesystem()) {}

  async capture(hooksDir: string): Promise<LegacyHookSnapshot> {
    return {
      hooksDir,
      hooks: {
        "commit-msg": this.read(join(hooksDir, "commit-msg")),
        "post-checkout": this.read(join(hooksDir, "post-checkout")),
      },
    };
  }

  async removeVerified(snapshot: LegacyHookSnapshot, names: LegacyHookName[]): Promise<void> {
    const current = await this.capture(snapshot.hooksDir);
    if (!sameSnapshot(current, snapshot)) {
      throw new Error("legacy hooks changed after inspection; refusing migration");
    }
    for (const name of names) rmSync(join(snapshot.hooksDir, name));
  }

  async restore(snapshot: LegacyHookSnapshot, names: LegacyHookName[]): Promise<void> {
    for (const name of names) {
      const path = join(snapshot.hooksDir, name);
      if ((await this.filesystem.exists(path)) || lstatExists(path)) {
        throw new Error(`cannot restore legacy hook because ${path} is no longer missing`);
      }
      const artifact = snapshot.hooks[name];
      mkdirSync(dirname(path), { recursive: true });
      if (artifact.kind === "file") {
        await this.filesystem.writeFileAtomic(path, artifact.content);
        chmodSync(path, artifact.executable ? 0o755 : 0o644);
      } else if (artifact.kind === "symlink") {
        symlinkSync(artifact.target, path);
      }
    }
  }

  private read(path: string): LegacyHookArtifact {
    try {
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) return { kind: "symlink", target: readlinkSync(path) };
      if (!stat.isFile()) return { kind: "other" };
      return {
        kind: "file",
        content: readFileSync(path, "utf8"),
        executable: (stat.mode & 0o111) !== 0,
      };
    } catch (error) {
      if (isMissing(error)) return { kind: "missing" };
      throw error;
    }
  }
}

function sameSnapshot(left: LegacyHookSnapshot, right: LegacyHookSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function lstatExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
