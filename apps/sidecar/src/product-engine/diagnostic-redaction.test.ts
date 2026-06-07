import { describe, expect, it } from "vitest";
import { redactSensitiveDiagnosticText } from "./diagnostic-redaction";

describe("redactSensitiveDiagnosticText", () => {
  it("redacts token-shaped secrets without removing safe surrounding text", () => {
    const redacted = redactSensitiveDiagnosticText(
      "NPM_TOKEN=plain-npm-token-value Bearer abcdefghijklmnopqrstuvwxyz github_pat_abcdefghijklmnopqrstuvwxyz0123456789 xoxb-1234567890-secret visible-line"
    );

    expect(redacted).toContain("NPM_TOKEN=[REDACTED]");
    expect(redacted).toContain("Bearer [REDACTED]");
    expect(redacted).toContain("[REDACTED_GITHUB_TOKEN]");
    expect(redacted).toContain("xox[REDACTED]");
    expect(redacted).toContain("visible-line");
    expect(redacted).not.toContain("plain-npm-token-value");
    expect(redacted).not.toContain("abcdefghijklmnopqrstuvwxyz");
    expect(redacted).not.toContain("xoxb-1234567890-secret");
  });

  it("redacts sensitive query params and optional local paths", () => {
    const redacted = redactSensitiveDiagnosticText(
      "https://example.com/search?q=founder&access_token=plain-secret-value at /Users/demo/private/project",
      { redactLocalPaths: true }
    );

    expect(redacted).toContain("access_token=[REDACTED]");
    expect(redacted).toContain("[REDACTED_PATH]");
    expect(redacted).not.toContain("plain-secret-value");
    expect(redacted).not.toContain("/Users/demo/private/project");
  });
});
