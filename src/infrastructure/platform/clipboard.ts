import type { ClipboardPort, ClipboardResult } from "../../application/ports/clipboard.port";

interface ClipboardCommand {
  command: string;
  args: string[];
}

export class SystemClipboard implements ClipboardPort {
  constructor(private readonly platform: NodeJS.Platform = process.platform) {}

  async copy(value: string): Promise<ClipboardResult> {
    const commands = commandsFor(this.platform);
    if (commands.length === 0)
      return { copied: false, warning: `clipboard unsupported on ${this.platform}` };
    for (const candidate of commands) {
      try {
        const proc = Bun.spawn([candidate.command, ...candidate.args], {
          stdin: "pipe",
          stdout: "ignore",
          stderr: "pipe",
        });
        proc.stdin.write(value);
        proc.stdin.end();
        if ((await proc.exited) === 0) return { copied: true };
      } catch {
        // Try the next platform adapter. Clipboard remains optional.
      }
    }
    return { copied: false, warning: "clipboard command unavailable; title was still generated" };
  }
}

export function commandsFor(platform: NodeJS.Platform): ClipboardCommand[] {
  switch (platform) {
    case "darwin":
      return [{ command: "pbcopy", args: [] }];
    case "win32":
      return [{ command: "clip.exe", args: [] }];
    case "linux":
      return [
        { command: "wl-copy", args: [] },
        { command: "xclip", args: ["-selection", "clipboard"] },
      ];
    default:
      return [];
  }
}
