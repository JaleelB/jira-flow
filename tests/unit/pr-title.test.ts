import { describe, expect, test } from "bun:test";
import { calendarQuarter, formatLocalDate, renderPrTitle } from "../../src/domain/pr-title";
import { commandsFor, SystemClipboard } from "../../src/infrastructure/platform/clipboard";

describe("PR-title domain", () => {
  test("renders all supported variables without evaluating template code", () => {
    expect(
      renderPrTitle("{jiraKey}|{storyTitle}|{branch}|{repo}|{date}|{quarter}", {
        jiraKey: "ABC-123",
        storyTitle: "Fix login",
        branch: "feat/ABC-123-login",
        repo: "web",
        date: "2026-08-23",
        quarter: "Q3",
      }),
    ).toBe("ABC-123|Fix login|feat/ABC-123-login|web|2026-08-23|Q3");
  });

  test("unknown placeholders remain literal", () => {
    expect(
      renderPrTitle("{jiraKey} {unknown}", {
        jiraKey: "ABC-1",
        storyTitle: "",
        branch: "",
        repo: "repo",
        date: "2026-01-01",
        quarter: "Q1",
      }),
    ).toBe("ABC-1 {unknown}");
  });

  test("formats calendar quarters and configured date tokens", () => {
    expect(calendarQuarter(new Date(2026, 0, 1))).toBe("Q1");
    expect(calendarQuarter(new Date(2026, 3, 1))).toBe("Q2");
    expect(calendarQuarter(new Date(2026, 6, 1))).toBe("Q3");
    expect(calendarQuarter(new Date(2026, 11, 31))).toBe("Q4");
    expect(formatLocalDate(new Date(2026, 7, 3), "DD/MM/YYYY")).toBe("03/08/2026");
  });
});

describe("clipboard platform adapters", () => {
  test("selects native commands without a shell", () => {
    expect(commandsFor("darwin")).toEqual([{ command: "pbcopy", args: [] }]);
    expect(commandsFor("win32")).toEqual([{ command: "clip.exe", args: [] }]);
    expect(commandsFor("linux").map((entry) => entry.command)).toEqual(["wl-copy", "xclip"]);
  });

  test("unsupported platform is a nonfatal warning", async () => {
    expect(await new SystemClipboard("aix").copy("title")).toEqual({
      copied: false,
      warning: "clipboard unsupported on aix",
    });
  });
});
