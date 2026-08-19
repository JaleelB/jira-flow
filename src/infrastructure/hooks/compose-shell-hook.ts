import { BEGIN_MARKER, END_MARKER } from "./hook-markers";

/**
 * Insert or strip the JiraFlow managed block in a composable shell hook
 * (architecture §16.3 / §16.4). The block is placed immediately after the
 * shebang so JiraFlow mutates the message before later validators run.
 */

export function insertManagedBlockAfterShebang(original: string, block: string): string {
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  const normalized = original.replaceAll("\r\n", "\n");
  const firstBreak = normalized.indexOf("\n");
  if (firstBreak === -1) {
    return `${normalized}\n\n${block}\n`;
  }
  const shebang = normalized.slice(0, firstBreak);
  const rest = normalized.slice(firstBreak + 1);
  const composed = `${shebang}\n\n${block}\n${rest.startsWith("\n") ? rest : `\n${rest}`}`;
  return newline === "\r\n" ? composed.replaceAll("\n", "\r\n") : composed;
}

export function replaceManagedBlock(content: string, block: string): string {
  const start = content.indexOf(BEGIN_MARKER);
  const end = content.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    return content;
  }
  const afterEnd = end + END_MARKER.length;
  const before = content.slice(0, start);
  let after = content.slice(afterEnd);
  if (after.startsWith("\r\n")) {
    after = after.slice(2);
  } else if (after.startsWith("\n")) {
    after = after.slice(1);
  }
  return `${before}${block}${after.startsWith("\n") || after.startsWith("\r\n") ? "" : "\n"}${after}`;
}

export function stripManagedBlock(content: string): string {
  const start = content.indexOf(BEGIN_MARKER);
  const end = content.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    return content;
  }
  const afterEnd = end + END_MARKER.length;
  let before = content.slice(0, start);
  let after = content.slice(afterEnd);
  before = before.replace(/(\r?\n){1,2}$/u, "");
  after = after.replace(/^(\r?\n)/u, "");
  if (before.length === 0) {
    return after.startsWith("#!") ? after : after.replace(/^\r?\n/u, "");
  }
  const join = before.endsWith("\n") ? "" : "\n";
  const body = after.length === 0 ? "\n" : after.startsWith("\n") ? after : `\n${after}`;
  return `${before}${join}${body}`;
}
