import { describe, expect, test } from "bun:test";
import { InvalidIssuePatternError, InvalidJiraKeyError } from "../../src/domain/errors";
import type { JiraKey } from "../../src/domain/issue-key";
import {
  DEFAULT_ISSUE_PATTERN,
  extractIssueKeyFromBranch,
  isJiraKey,
  parseJiraKey,
} from "../../src/domain/issue-key";

/**
 * VT-09 (part 1) — issue key parse/extract truth table (product spec §11).
 */

function key(value: string): JiraKey {
  return value as JiraKey;
}

describe("parseJiraKey (strict whole-token validation)", () => {
  test("accepts a plain key", () => {
    expect(parseJiraKey("ABC-123")).toBe(key("ABC-123"));
  });

  test("accepts alphanumeric project prefix (OPS2-991)", () => {
    expect(parseJiraKey("OPS2-991")).toBe(key("OPS2-991"));
  });

  test("rejects a substring embedded in text", () => {
    expect(() => parseJiraKey("feat/ABC-123-login")).toThrow(InvalidJiraKeyError);
  });

  test("rejects lowercase project", () => {
    expect(() => parseJiraKey("abc-123")).toThrow(InvalidJiraKeyError);
  });

  test("rejects missing number", () => {
    expect(() => parseJiraKey("ABC-")).toThrow(InvalidJiraKeyError);
  });

  test("rejects trailing characters", () => {
    expect(() => parseJiraKey("ABC-123 extra")).toThrow(InvalidJiraKeyError);
  });

  test("rejects empty input", () => {
    expect(() => parseJiraKey("")).toThrow(InvalidJiraKeyError);
  });

  test("supports a custom pattern override", () => {
    expect(parseJiraKey("proj_9", "[a-z]+_\\d+")).toBe(key("proj_9"));
  });

  test("invalid pattern produces a typed recoverable error", () => {
    expect(() => parseJiraKey("ABC-123", "([A-Z]")).toThrow(InvalidIssuePatternError);
  });
});

describe("extractIssueKeyFromBranch", () => {
  test("extracts from a feature branch", () => {
    expect(extractIssueKeyFromBranch("feat/ABC-123-login")).toBe(key("ABC-123"));
  });

  test("extracts from a nested team branch (OPS2-991)", () => {
    expect(extractIssueKeyFromBranch("fix/team/OPS2-991-crash")).toBe(key("OPS2-991"));
  });

  test("returns null for a non-ticket branch", () => {
    expect(extractIssueKeyFromBranch("chore/update-deps")).toBeNull();
  });

  test("returns null for main", () => {
    expect(extractIssueKeyFromBranch("main")).toBeNull();
  });

  test("returns null for null branch (detached HEAD)", () => {
    expect(extractIssueKeyFromBranch(null)).toBeNull();
  });

  test("returns null for empty branch", () => {
    expect(extractIssueKeyFromBranch("")).toBeNull();
  });

  test("uses the first match", () => {
    expect(extractIssueKeyFromBranch("feat/ABC-123-OPS-991")).toBe(key("ABC-123"));
  });

  test("default pattern matches the spec default", () => {
    expect(DEFAULT_ISSUE_PATTERN).toBe("[A-Z][A-Z0-9]*-\\d+");
  });
});

describe("isJiraKey", () => {
  test("true for valid keys", () => {
    expect(isJiraKey("ABC-1")).toBe(true);
  });

  test("false for invalid keys", () => {
    expect(isJiraKey("nope")).toBe(false);
  });
});
