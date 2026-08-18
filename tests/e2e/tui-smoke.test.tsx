import { afterEach, describe, expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { act } from "react";
import { SmokeScreen } from "../../src/tui/screens/smoke";

/**
 * VT-03 — OpenTUI smoke.
 *
 * Renders the VS-0 smoke screen through OpenTUI's test renderer (no real
 * terminal required) and proves the Q key quits.
 *
 * Note: a lone ESC byte is buffered by the key parser until a follow-up byte
 * arrives, so the mock cannot synthesize a standalone Escape press; Q is the
 * primary quit binding for the smoke screen.
 */

const setups: Array<() => void> = [];

afterEach(() => {
  for (const teardown of setups.splice(0)) teardown();
});

describe("OpenTUI toolchain smoke screen", () => {
  test("renders title, smoke text, and quit hint", async () => {
    const setup = await testRender(<SmokeScreen onQuit={() => {}} />, {
      width: 40,
      height: 12,
    });
    setups.push(() => setup.renderer.destroy());
    await setup.waitForVisualIdle();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("JiraFlow");
    expect(frame).toContain("toolchain smoke");
    expect(frame.toUpperCase()).toContain("[Q] QUIT");
  });

  test("quits on lowercase q", async () => {
    let quitCount = 0;
    const setup = await testRender(<SmokeScreen onQuit={() => quitCount++} />, {
      width: 40,
      height: 12,
    });
    setups.push(() => setup.renderer.destroy());
    await setup.waitForVisualIdle();
    await act(async () => {
      setup.mockInput.pressKey("q");
      await setup.flush();
    });
    expect(quitCount).toBe(1);
  });

  test("quits on uppercase Q (shift)", async () => {
    let quitCount = 0;
    const setup = await testRender(<SmokeScreen onQuit={() => quitCount++} />, {
      width: 40,
      height: 12,
    });
    setups.push(() => setup.renderer.destroy());
    await setup.waitForVisualIdle();
    await act(async () => {
      setup.mockInput.pressKey("Q", { shift: true });
      await setup.flush();
    });
    expect(quitCount).toBe(1);
  });

  test("ignores unrelated keys", async () => {
    let quitCount = 0;
    const setup = await testRender(<SmokeScreen onQuit={() => quitCount++} />, {
      width: 40,
      height: 12,
    });
    setups.push(() => setup.renderer.destroy());
    await setup.waitForVisualIdle();
    await act(async () => {
      setup.mockInput.pressKey("x");
      setup.mockInput.pressKey("RETURN");
      await setup.flush();
    });
    expect(quitCount).toBe(0);
  });
});
