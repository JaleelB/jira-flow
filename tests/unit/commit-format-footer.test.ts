import { describe, expect, test } from "bun:test";
import { applyIssueReference } from "../../src/domain/commit-format";
import type { JiraKey } from "../../src/domain/issue-key";

/**
 * VT-09 (part 3) — footer format (product spec §10.1, §10.5).
 */

function key(value: string): JiraKey {
  return value as JiraKey;
}

describe("applyIssueReference — footer format", () => {
  test("appends footer to a single-line subject", () => {
    const result = applyIssueReference({
      message: "feat(auth): add login",
      issue: key("ABC-123"),
      format: "footer",
    });
    expect(result).toEqual({
      changed: true,
      message: "feat(auth): add login\n\nJira: ABC-123",
    });
  });

  test("appends footer after a multiline body", () => {
    const result = applyIssueReference({
      message: "feat(auth): add login\n\nExtends the session refresh flow\nand adds tests.",
      issue: key("ABC-123"),
      format: "footer",
    });
    expect(result.changed).toBe(true);
    expect(result.message).toBe(
      "feat(auth): add login\n\nExtends the session refresh flow\nand adds tests.\n\nJira: ABC-123",
    );
  });

  test("normalizes trailing whitespace before the footer", () => {
    const result = applyIssueReference({
      message: "feat: x\n\n\n",
      issue: key("ABC-123"),
      format: "footer",
    });
    expect(result.changed).toBe(true);
    expect(result.message).toBe("feat: x\n\nJira: ABC-123");
  });

  test("already-present footer is idempotent", () => {
    const message = "feat(auth): add login\n\nJira: ABC-123";
    const result = applyIssueReference({ message, issue: key("ABC-123"), format: "footer" });
    expect(result).toEqual({ changed: false, message, reason: "already-present" });
  });

  test("already-present footer recognized with trailing whitespace", () => {
    const message = "feat(auth): add login\n\nJira: ABC-123   ";
    const result = applyIssueReference({ message, issue: key("ABC-123"), format: "footer" });
    expect(result).toEqual({ changed: false, message, reason: "already-present" });
  });

  test("a different issue's footer is not treated as already-present", () => {
    const message = "feat(auth): add login\n\nJira: OPS-992";
    const result = applyIssueReference({ message, issue: key("ABC-123"), format: "footer" });
    expect(result.changed).toBe(true);
    expect(result.message).toBe("feat(auth): add login\n\nJira: OPS-992\n\nJira: ABC-123");
  });

  test("key mentioned in the subject does not suppress the footer", () => {
    const message = "ABC-123: fix the login timeout";
    const result = applyIssueReference({ message, issue: key("ABC-123"), format: "footer" });
    expect(result.changed).toBe(true);
    expect(result.message).toBe("ABC-123: fix the login timeout\n\nJira: ABC-123");
  });

  test("empty message is left untouched", () => {
    const result = applyIssueReference({ message: "", issue: key("ABC-123"), format: "footer" });
    expect(result).toEqual({ changed: false, message: "", reason: "no-change" });
  });

  test("whitespace-only message is left untouched", () => {
    const result = applyIssueReference({
      message: "  \n\n ",
      issue: key("ABC-123"),
      format: "footer",
    });
    expect(result).toEqual({ changed: false, message: "  \n\n ", reason: "no-change" });
  });

  test("key regex metacharacters cannot forge a footer match", () => {
    // A malicious-ish key containing regex syntax must be escaped in detection.
    const forged = "feat: x\n\nJira: ABC-123";
    const result = applyIssueReference({
      message: forged,
      issue: key("ABC.123" as string),
      format: "footer",
    });
    expect(result.changed).toBe(true);
    expect(result.message).toContain("Jira: ABC.123");
  });
});
