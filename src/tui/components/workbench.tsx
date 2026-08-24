import type { ReactNode } from "react";
import { palette } from "../../ui/theme";

export type Tone = "ink" | "muted" | "ticket" | "ok" | "warn" | "fail" | "info";

export function toneColor(tone: Tone): string {
  switch (tone) {
    case "muted":
      return palette.mute;
    case "ticket":
      return palette.ticket;
    case "ok":
      return palette.ok;
    case "warn":
      return palette.warn;
    case "fail":
      return palette.fail;
    case "info":
      return palette.info;
    default:
      return palette.ink;
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <box
      style={{
        width: "100%",
        height: "100%",
        padding: 1,
        backgroundColor: palette.canvas,
      }}
    >
      <box
        style={{
          width: "100%",
          height: "100%",
          flexDirection: "column",
          backgroundColor: palette.surface,
          border: true,
          borderStyle: "rounded",
          borderColor: palette.rule,
        }}
      >
        {children}
      </box>
    </box>
  );
}

export function ScreenHeader({
  screenId,
  title,
  description,
  context,
}: {
  screenId: string;
  title: string;
  description: string;
  context?: { label: string; tone: Tone };
}) {
  return (
    <box
      style={{
        height: 3,
        paddingX: 2,
        flexDirection: "row",
        alignItems: "center",
        border: ["bottom"],
        borderColor: palette.rule,
      }}
    >
      <box style={{ flexDirection: "column", flexGrow: 1 }}>
        <text style={{ fg: palette.ink }}>
          <b>◆ JIRAFLOW</b>
          <span fg={palette.mute}> / {title}</span>
        </text>
        <text style={{ fg: palette.mute, truncate: true }}>{description}</text>
      </box>
      {context ? <StatusBadge label={context.label} tone={context.tone} /> : null}
      <text style={{ fg: palette.mute }}> {screenId}</text>
    </box>
  );
}

export function Panel({
  title,
  children,
  tone = "muted",
  width,
  flexGrow,
}: {
  title: string;
  children: ReactNode;
  tone?: Tone;
  width?: number | `${number}%`;
  flexGrow?: number;
}) {
  return (
    <box
      title={` ${title.toUpperCase()} `}
      titleColor={toneColor(tone)}
      style={{
        width,
        flexGrow,
        flexDirection: "column",
        overflow: "hidden",
        border: true,
        borderStyle: "single",
        borderColor: tone === "muted" ? palette.rule : toneColor(tone),
        backgroundColor: palette.panel,
        paddingX: 1,
        paddingY: 0,
      }}
    >
      {children}
    </box>
  );
}

export function FieldRow({
  label,
  value,
  tone = "ink",
  compact = false,
}: {
  label: string;
  value: string;
  tone?: Tone;
  compact?: boolean;
}) {
  return (
    <box style={{ flexDirection: "row", width: "100%", height: 1 }}>
      <text style={{ fg: palette.mute, width: compact ? 14 : 18 }}>{label}</text>
      <text style={{ fg: toneColor(tone), truncate: true }}>{value}</text>
    </box>
  );
}

export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <text style={{ fg: toneColor(tone), bg: palette.panel }}>
      <b> {label.toUpperCase()} </b>
    </text>
  );
}

export function TicketStub({
  issue,
  source,
  enabled = true,
}: {
  issue: string | null;
  source?: string | null;
  enabled?: boolean;
}) {
  const active = issue !== null && enabled;
  return (
    <box style={{ flexDirection: "column", width: "100%", height: 5 }}>
      <text style={{ fg: palette.mute }}>ACTIVE TICKET</text>
      <box
        style={{
          height: 4,
          width: "100%",
          border: true,
          borderStyle: "rounded",
          borderColor: active ? palette.ticket : palette.rule,
          backgroundColor: active ? palette.selection : palette.surface,
          paddingX: 2,
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <text style={{ fg: active ? palette.ticket : palette.mute }}>
          <b>{active ? issue : "NO ACTIVE ISSUE"}</b>
        </text>
        <text style={{ fg: palette.mute }}>
          {enabled
            ? source
              ? `resolved from ${source}`
              : "link or detect an issue"
            : "workflow disabled"}
        </text>
      </box>
    </box>
  );
}

export function InputDock({
  value,
  placeholder,
  onInput,
  onSubmit,
}: {
  value: string;
  placeholder: string;
  onInput: (value: string) => void;
  onSubmit: (value: string) => void;
}) {
  return (
    <box
      title=" COMMAND INPUT "
      titleColor={palette.ticket}
      style={{
        flexDirection: "column",
        border: true,
        borderColor: palette.ticket,
        backgroundColor: palette.selection,
        paddingX: 1,
        height: 4,
      }}
    >
      <input
        focused
        value={value}
        placeholder={placeholder}
        onInput={onInput}
        onSubmit={onSubmit as never}
        style={{
          textColor: palette.ink,
          focusedTextColor: palette.ink,
          backgroundColor: palette.selection,
          focusedBackgroundColor: palette.selection,
          placeholderColor: palette.mute,
        }}
      />
    </box>
  );
}

export function NoticeBar({ message, busy }: { message: string | null; busy: boolean }) {
  if (!message && !busy) return null;
  const error = message?.startsWith("Error") ?? false;
  return (
    <box
      style={{
        height: 3,
        paddingX: 2,
        alignItems: "center",
        backgroundColor: palette.panel,
        border: ["top"],
        borderColor: error ? palette.fail : palette.ticket,
      }}
    >
      <text style={{ fg: error ? palette.fail : palette.ticket }}>
        {busy ? "◌ Working…" : message}
      </text>
    </box>
  );
}

export function ActionBar({
  actions,
  destructive = false,
  height = 3,
}: {
  actions: string[];
  destructive?: boolean;
  height?: number;
}) {
  return (
    <box
      style={{
        height,
        paddingX: 2,
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        backgroundColor: palette.panel,
        border: ["top"],
        borderColor: destructive ? palette.fail : palette.rule,
      }}
    >
      {actions.map((action) => {
        const match = /^\[([^\]]+)\]\s*(.*)$/.exec(action);
        return (
          <text key={action} style={{ fg: palette.mute, marginRight: 2 }}>
            <span fg={destructive && match?.[1] === "Enter" ? palette.fail : palette.ticket}>
              {match ? match[1] : "•"}
            </span>
            {match ? ` ${match[2]}` : ` ${action}`}
          </text>
        );
      })}
      <text style={{ fg: palette.mute, marginRight: 2 }}>
        <span fg={palette.ticket}>?</span> Help
      </text>
    </box>
  );
}

export function StateMessage({
  title,
  detail,
  tone = "muted",
}: {
  title: string;
  detail?: string;
  tone?: Tone;
}) {
  return (
    <box
      style={{
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flexGrow: 1,
      }}
    >
      <text style={{ fg: toneColor(tone) }}>
        <b>{title}</b>
      </text>
      {detail ? <text style={{ fg: palette.mute }}>{detail}</text> : null}
    </box>
  );
}
