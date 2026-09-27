import { describe, expect, test } from "bun:test";
import { applyIssueReference } from "../../src/domain/commit-format";
import type { JiraKey } from "../../src/domain/issue-key";

function key(value: string): JiraKey {
  return value as JiraKey;
}

const ISSUE = key("ABC-123");

describe("applyIssueReference — suffix", () => {
  test("appends [KEY] to the subject", () => {
    const result = applyIssueReference({
      message: "feat(auth): add login",
      issue: ISSUE,
      format: "suffix",
    });
    expect(result).toEqual({ changed: true, message: "feat(auth): add login [ABC-123]" });
  });

  test("preserves a multiline body", () => {
    const result = applyIssueReference({
      message: "feat: x\n\nbody",
      issue: ISSUE,
      format: "suffix",
    });
    expect(result.changed).toBe(true);
    expect(result.message).toBe("feat: x [ABC-123]\n\nbody");
  });

  test("already-present suffix is idempotent for the active issue", () => {
    const message = "feat: x [ABC-123]";
    expect(applyIssueReference({ message, issue: ISSUE, format: "suffix" })).toEqual({
      changed: false,
      message,
      reason: "already-present",
    });
  });

  test("a different key suffix does not block the active issue", () => {
    const result = applyIssueReference({
      message: "feat: x [OPS-992]",
      issue: ISSUE,
      format: "suffix",
    });
    expect(result.changed).toBe(true);
    expect(result.message).toBe("feat: x [OPS-992] [ABC-123]");
  });
});

describe("applyIssueReference — prefix", () => {
  test("prepends KEY to the subject", () => {
    const result = applyIssueReference({
      message: "feat(auth): add login",
      issue: ISSUE,
      format: "prefix",
    });
    expect(result).toEqual({ changed: true, message: "ABC-123 feat(auth): add login" });
  });

  test("already-present prefix is idempotent for the active issue", () => {
    const message = "ABC-123 feat: x";
    expect(applyIssueReference({ message, issue: ISSUE, format: "prefix" })).toEqual({
      changed: false,
      message,
      reason: "already-present",
    });
  });

  test("a different key prefix does not block the active issue", () => {
    const result = applyIssueReference({
      message: "OPS-992 feat: x",
      issue: ISSUE,
      format: "prefix",
    });
    expect(result.changed).toBe(true);
    expect(result.message).toBe("ABC-123 OPS-992 feat: x");
  });
});

describe("applyIssueReference — scope (DR-0019)", () => {
  test("inserts KEY when the subject has no scope", () => {
    const result = applyIssueReference({
      message: "feat: add login",
      issue: ISSUE,
      format: "scope",
    });
    expect(result).toEqual({ changed: true, message: "feat(ABC-123): add login" });
  });

  test("inserts KEY when the existing scope is empty", () => {
    const result = applyIssueReference({
      message: "feat(): add login",
      issue: ISSUE,
      format: "scope",
    });
    expect(result).toEqual({ changed: true, message: "feat(ABC-123): add login" });
  });

  test("preserves breaking-change bang", () => {
    const result = applyIssueReference({
      message: "feat!: add login",
      issue: ISSUE,
      format: "scope",
    });
    expect(result).toEqual({ changed: true, message: "feat(ABC-123)!: add login" });
  });

  test("leaves a non-empty existing scope unchanged", () => {
    const message = "feat(auth): add login";
    expect(applyIssueReference({ message, issue: ISSUE, format: "scope" })).toEqual({
      changed: false,
      message,
      reason: "unsafe-scope",
    });
  });

  test("already-present scope is idempotent for the active issue", () => {
    const message = "feat(ABC-123): add login";
    expect(applyIssueReference({ message, issue: ISSUE, format: "scope" })).toEqual({
      changed: false,
      message,
      reason: "already-present",
    });
  });

  test("a different key in scope is unsafe, not a combine", () => {
    const message = "feat(OPS-992): add login";
    expect(applyIssueReference({ message, issue: ISSUE, format: "scope" })).toEqual({
      changed: false,
      message,
      reason: "unsafe-scope",
    });
  });

  test("freeform subjects are not mutated", () => {
    const message = "add login";
    expect(applyIssueReference({ message, issue: ISSUE, format: "scope" })).toEqual({
      changed: false,
      message,
      reason: "unsafe-scope",
    });
  });

  test("preserves a multiline body when inserting scope", () => {
    const result = applyIssueReference({
      message: "feat: add login\n\nbody",
      issue: ISSUE,
      format: "scope",
    });
    expect(result.changed).toBe(true);
    expect(result.message).toBe("feat(ABC-123): add login\n\nbody");
  });
});

describe("applyIssueReference — empty messages", () => {
  test("empty message is left untouched for every format", () => {
    for (const format of ["footer", "suffix", "prefix", "scope"] as const) {
      expect(applyIssueReference({ message: "", issue: ISSUE, format })).toEqual({
        changed: false,
        message: "",
        reason: "no-change",
      });
    }
  });
});

describe("applyIssueReference — footer different key", () => {
  test("a different issue footer does not block the active issue", () => {
    const result = applyIssueReference({
      message: "feat: x\n\nJira: OPS-992",
      issue: ISSUE,
      format: "footer",
    });
    expect(result.changed).toBe(true);
    expect(result.message).toContain("Jira: OPS-992");
    expect(result.message).toContain("Jira: ABC-123");
  });
});
