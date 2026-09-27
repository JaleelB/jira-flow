/**
 * Presentation tokens shared by the headless CLI and OpenTUI adapter.
 *
 * Subject: a commit stamped with a Jira ticket. The issue key is the
 * signature — a brass ticket stub — not a generic accent stripe.
 */

export const palette = {
  /** Ticket-stub brass. Used only for the active issue key. */
  ticket: "#C9922A",
  /** Near-white ink for primary values. */
  ink: "#E7E2D6",
  /** Quiet labels, paths, chrome. */
  mute: "#8A8478",
  /** Healthy / owned integration. */
  ok: "#3FAF7F",
  /** Recoverable warning. */
  warn: "#D89A3B",
  /** Conflict / fail. */
  fail: "#D45C4A",
  /** Screen fill in the TUI. */
  surface: "#161410",
  /** Recessed terminal canvas around the working surface. */
  canvas: "#0D0C0A",
  /** Quiet panel fill used to separate controls from content. */
  panel: "#201D18",
  /** Selected row and focused input fill. */
  selection: "#30291D",
  /** Cool informational accent, used sparingly for paths and guidance. */
  info: "#63A6B8",
  /** Hairline rules, not a second accent. */
  rule: "#3A362E",
} as const;

export type PaletteColor = (typeof palette)[keyof typeof palette];
