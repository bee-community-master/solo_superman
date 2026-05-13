import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const closeout = readFileSync("docs/40-post-phase3-full-vision-closeout-report.md", "utf8");
const backlog = readFileSync("docs/37-post-phase3-full-vision-backlog-contract.md", "utf8");
const validation = readFileSync("docs/12-validation-and-dry-run.md", "utf8");
const docVerifier = readFileSync("scripts/verify-doc-contracts.mjs", "utf8");

describe("#106 Post-Phase3 closeout report", () => {
  it("lists every canonical child issue and keeps #98 absorbed-only", () => {
    for (const issue of [91, 92, 93, 94, 95, 96, 97, 99, 100, 101, 102, 103, 104, 105, 106]) {
      expect(closeout).toContain(`#${issue}`);
    }

    expect(closeout).toContain("#98 was the temporary standalone Post-Phase3 tracker");
    expect(closeout).toContain("closed absorbed reference only");
  });

  it("keeps business and personal mode boundaries explicit in closeout validation", () => {
    expect(backlog).toContain("mode_required");
    expect(backlog).toContain("프로젝트 목적 선택 필요");
    expect(backlog).toContain("minimum pressure count");
    expect(backlog).toContain("시장 타이밍");
    expect(backlog).toContain("개인 workflow");
    expect(backlog).toContain("시장규모, 유료화, 경쟁/대체재, 획득 채널, 투자자 narrative");
    expect(validation).toContain("commercialization axes가 optional/skipped");
  });

  it("records no-duplicate boundaries and remaining implementation risks", () => {
    for (const snippet of [
      "No-duplicate boundary verification",
      "Candidate field/record/event/status/projection/aggregate",
      "read/preview uses page-or-step scope",
      "per-action approval",
      "NoCodeStepEvidence",
      "verify:prod-bundle",
      "auto shutdown/kill evidence",
      "Remaining implementation risks"
    ]) {
      expect(closeout).toContain(snippet);
    }
  });

  it("wires the closeout report into the doc-contract verifier", () => {
    expect(docVerifier).toContain("POST_PHASE3_CLOSEOUT_DOC_PATH");
    expect(docVerifier).toContain("docs/40-post-phase3-full-vision-closeout-report.md");
    expect(docVerifier).toContain("POST_PHASE3_CLOSEOUT_REQUIRED_SNIPPETS");
  });
});
