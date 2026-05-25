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

  it("can verify the same research path through the live-web adapter branch without fixture source URLs", async () => {
    const evidence = await runResearchPipelineSmoke({
      mode: "live_web",
      liveWebSearch: async ({ query, now }) => [
        {
          title: `공개 반려동물 시장 근거: ${query}`,
          url: "https://www.nias.go.kr/companion/new_petBoard.do?cmCode=M210524110205412",
          snippet: "반려동물 보호자 유형과 의료, 돌봄, 보험 니즈를 확인할 수 있는 공개 자료입니다.",
          retrievedAt: now()
        },
        {
          title: "반려동물 보험·의료비 확인이 더 필요하다는 공개 근거",
          url: "https://www.mafra.go.kr/",
          snippet:
            "공개 자료만으로는 고객 세그먼트별 결제 의향과 보험 청구 행동을 확정하기 어려워 추가 반대 근거와 품질 검토가 필요합니다.",
          retrievedAt: now()
        }
      ]
    });

    expect(evidence).toMatchObject({
      status: "passed",
      smoke: RESEARCH_PIPELINE_SMOKE,
      mode: "live_web",
      research: expect.objectContaining({
        providerAdapterKind: "web_search_readonly",
        sourceUrls: [
          "https://www.nias.go.kr/companion/new_petBoard.do?cmCode=M210524110205412",
          "https://www.mafra.go.kr/"
        ]
      })
    });
    expect(evidence.checked).toContain("live public-web adapter path imported non-fixture public source URLs");
    expect(evidence.research?.sourceUrls.some((sourceUrl) => sourceUrl.includes("example."))).toBe(false);
  });
});
