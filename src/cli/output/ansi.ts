import { palette } from "../../ui/theme";

/**
 * Tiny ANSI helper for human CLI output.
 *
 * Color is opt-in: TTY + not `NO_COLOR` + `TERM` is not `dumb`.
 * `FORCE_COLOR=1` wins (useful for demos). JSON mode never calls this.
 */

export function colorEnabled(stream: { isTTY?: boolean } = process.stdout): boolean {
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "") {
    return false;
  }
  if (process.env.FORCE_COLOR === "0") {
    return false;
  }
  if (process.env.FORCE_COLOR === "1" || process.env.FORCE_COLOR === "2") {
    return true;
  }
  if (process.env.TERM === "dumb") {
    return false;
  }
  return stream.isTTY === true;
}

const reset = "\x1b[0m";

function wrap(open: string, text: string, enabled: boolean): string {
  if (!enabled || text.length === 0) {
    return text;
  }
  return `${open}${text}${reset}`;
}

function fg(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m`;
}

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "");
  return [
    Number.parseInt(raw.slice(0, 2), 16),
    Number.parseInt(raw.slice(2, 4), 16),
    Number.parseInt(raw.slice(4, 6), 16),
  ];
}

export function createAnsi(enabled: boolean = colorEnabled()) {
  return {
    enabled,
    bold: (text: string) => wrap("\x1b[1m", text, enabled),
    dim: (text: string) => wrap("\x1b[2m", text, enabled),
    ink: (text: string) => wrap(fg(palette.ink), text, enabled),
    mute: (text: string) => wrap(fg(palette.mute), text, enabled),
    ticket: (text: string) => wrap(`\x1b[1m${fg(palette.ticket)}`, text, enabled),
    ok: (text: string) => wrap(fg(palette.ok), text, enabled),
    warn: (text: string) => wrap(fg(palette.warn), text, enabled),
    fail: (text: string) => wrap(fg(palette.fail), text, enabled),
  };
}

export type Ansi = ReturnType<typeof createAnsi>;
