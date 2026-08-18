import { useKeyboard } from "@opentui/react";

/**
 * VS-0 toolchain smoke screen (T-05).
 *
 * Exists only to prove that OpenTUI React renders and handles keyboard input
 * inside both `bun run` and the compiled binary. Replaced by the repository
 * overview screen in T-19.
 *
 * `Q` (or `Escape`) quits with exit code 0.
 */
export function SmokeScreen({ onQuit }: { onQuit: () => void }) {
  useKeyboard((key) => {
    if (key.eventType === "release") return;
    const name = key.name.toLowerCase();
    if (name === "q" || name === "escape") {
      onQuit();
    }
  });

  return (
    <box
      style={{
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: "100%",
      }}
    >
      <text>JiraFlow</text>
      <text>toolchain smoke</text>
      <text>[Q] Quit</text>
    </box>
  );
}
