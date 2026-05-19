import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const roadmap = readFileSync("docs/roadmap.md", "utf8");
const product = readFileSync("docs/product.md", "utf8");
const safety = readFileSync("docs/safety-and-permissions.md", "utf8");
const decisions = readFileSync("docs/decisions.md", "utf8");
const docVerifier = readFileSync("scripts/verify-doc-contracts.mjs", "utf8");

describe("simplified contributor docs preserve Post-Phase3 decisions", () => {
  it("lists every canonical tracker issue and keeps #98 absorbed-only", () => {
    for (const issue of [91, 92, 93, 94, 95, 96, 97, 99, 100, 101, 102, 103, 104, 105, 106]) {
      expect(roadmap).toContain(`#${issue}`);
    }

    expect(roadmap).toContain("#98 was the temporary standalone Post-Phase3 tracker");
    expect(roadmap).toContain("closed absorbed reference only");
  });

  it("keeps business and personal mode boundaries explicit", () => {
    expect(product).toContain("businessCriticIntensity");
    expect(product).toContain("no default value");
    expect(product).toContain("personal");
    expect(product).toContain("commercialization axes");
    expect(product).toContain("market size");
  });

  it("records no-duplicate safety boundaries and remaining implementation risks", () => {
    for (const snippet of [
      "No credential/2FA/session custody",
      "account sharing/resale",
      "ServicePageUsePermission",
      "external-production mutation",
      "ExecutionAuthorityRecord",
      "ImplementationStepLedger",
      "browser-only DB rewrite",
      "no hosted SaaS default"
    ]) {
      expect(`${safety}\n${roadmap}\n${decisions}`).toContain(snippet);
    }
  });

  it("wires the simplified docs into the doc-contract verifier", () => {
    expect(docVerifier).toContain("CONTRIBUTOR_DOC_PATHS");
    expect(docVerifier).toContain("docs/reference.md");
    expect(docVerifier).toContain("docs/troubleshooting.md");
    expect(readdirSync("docs").filter((entry) => /^\d{2}-.+\.md$/u.test(entry))).toEqual([]);
  });
});
