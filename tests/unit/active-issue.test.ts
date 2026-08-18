import { describe, expect, test } from "bun:test";
import { resolveActiveIssue } from "../../src/domain/active-issue";
import type { JiraKey } from "../../src/domain/issue-key";

/**
 * VT-09 (part 2) — Hybrid resolution truth table (VS-1 rows, product §4.3).
 */

function key(value: string): JiraKey {
  return value as JiraKey;
}

describe("resolveActiveIssue — Hybrid (VS-1 truth table)", () => {
  const mode = "hybrid" as const;

  test("disabled → null regardless of linked/branch issues", () => {
    expect(
      resolveActiveIssue({
        enabled: false,
        mode,
        linkedIssue: key("OPS-992"),
        branchIssue: key("ABC-123"),
      }),
    ).toBeNull();
  });

  test("enabled + no override + branch issue → branch source", () => {
    expect(
      resolveActiveIssue({ enabled: true, mode, linkedIssue: null, branchIssue: key("ABC-123") }),
    ).toEqual({ key: key("ABC-123"), source: "branch" });
  });

  test("enabled + override + branch issue → override wins", () => {
    expect(
      resolveActiveIssue({
        enabled: true,
        mode,
        linkedIssue: key("OPS-992"),
        branchIssue: key("ABC-123"),
      }),
    ).toEqual({ key: key("OPS-992"), source: "override" });
  });

  test("enabled + override + no branch issue → override", () => {
    expect(
      resolveActiveIssue({ enabled: true, mode, linkedIssue: key("OPS-992"), branchIssue: null }),
    ).toEqual({ key: key("OPS-992"), source: "override" });
  });

  test("enabled + no override + no branch issue → null", () => {
    expect(
      resolveActiveIssue({ enabled: true, mode, linkedIssue: null, branchIssue: null }),
    ).toBeNull();
  });

  test("enabled + no issue anywhere on non-ticket branch → null (normal, not error)", () => {
    expect(
      resolveActiveIssue({
        enabled: true,
        mode,
        linkedIssue: null,
        branchIssue: null,
      }),
    ).toBeNull();
  });
});

describe("resolveActiveIssue — other modes (domain completeness)", () => {
  test("branch mode ignores the linked issue", () => {
    expect(
      resolveActiveIssue({
        enabled: true,
        mode: "branch",
        linkedIssue: key("OPS-992"),
        branchIssue: key("ABC-123"),
      }),
    ).toEqual({ key: key("ABC-123"), source: "branch" });
  });

  test("branch mode with no branch issue → null", () => {
    expect(
      resolveActiveIssue({
        enabled: true,
        mode: "branch",
        linkedIssue: key("OPS-992"),
        branchIssue: null,
      }),
    ).toBeNull();
  });

  test("manual mode uses only the linked issue", () => {
    expect(
      resolveActiveIssue({
        enabled: true,
        mode: "manual",
        linkedIssue: key("OPS-992"),
        branchIssue: key("ABC-123"),
      }),
    ).toEqual({ key: key("OPS-992"), source: "manual" });
  });

  test("manual mode with no linked issue → null", () => {
    expect(
      resolveActiveIssue({
        enabled: true,
        mode: "manual",
        linkedIssue: null,
        branchIssue: key("ABC-123"),
      }),
    ).toBeNull();
  });
});
