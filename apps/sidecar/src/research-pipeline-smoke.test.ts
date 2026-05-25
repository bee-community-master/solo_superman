import { describe, expect, it } from "vitest";
import { RESEARCH_PIPELINE_SMOKE, runResearchPipelineSmoke } from "./research-pipeline-smoke";

describe("research pipeline smoke", () => {
  it("proves the read-only research result to evidence and follow-up queue path", async () => {
    const evidence = await runResearchPipelineSmoke();

    expect(evidence).toMatchObject({
      status: "passed",
      smoke: RESEARCH_PIPELINE_SMOKE,
      mode: "fixture",
      research: expect.objectContaining({
        allowlistId: "research_allowlist_pipeline_smoke",
        researchRunId: "research_run_pipeline_smoke",
        runStatus: "research_insufficient",
        providerAdapterKind: "web_search_readonly",
        qualityGateStatus: "insufficient",
        matrixBalanceStatus: "missing_con_evidence",
        evidencePackGateStatus: "research_insufficient",
        reviewCardState: "research_insufficient",
        researchMemorySourceRefCount: expect.any(Number),
        followUpResearchSourceRefCount: expect.any(Number)
      })
    });
    expect(evidence.research?.followUpQuestionCount).toBeGreaterThanOrEqual(1);
    expect(evidence.research?.followUpResearchTaskCount).toBeGreaterThanOrEqual(1);
    expect(evidence.research?.researchMemorySourceRefCount).toBeGreaterThanOrEqual(1);
    expect(evidence.research?.followUpResearchSourceRefCount).toBeGreaterThanOrEqual(2);
    expect(evidence.checked).toEqual(
      expect.arrayContaining([
        "public-web allowlist created without credentials",
        "read-only research run started",
        "mounted web_search_readonly provider result polled and imported with source trace",
        "provider-polled research writes markdown memory for future duplicate or broader research decisions",
        "generated follow-up research carries existing markdown memory refs as baseline context while still starting a new run",
        "provider quality gate marked insufficient evidence for review",
        "Research projection exposes evidence matrix, evidence pack, and review card",
        "Decision Queue exposes source-traceable follow-up question debt",
        "Research projection exposes source-linked planned research task debt for research-generated follow-up questions"
      ])
    );
  });
});
