import { describe, expect, it } from "vitest";
import {
  runSingleSessionProductLoopSmoke,
  SINGLE_SESSION_PRODUCT_LOOP_SMOKE
} from "./single-session-product-loop-smoke";

describe("single-session product loop smoke", () => {
  it("proves one pet-lifecycle idea can move through domain-fit questions, answer-linked research, planning, and implementation start", async () => {
    const evidence = await runSingleSessionProductLoopSmoke();

    expect(evidence).toMatchObject({
      status: "passed",
      smoke: SINGLE_SESSION_PRODUCT_LOOP_SMOKE,
      mode: "fixture",
      loop: {
        generatedQuestionCount: expect.any(Number),
        activeQuestionCount: 1,
        firstQuestionTopicKey: "pet_first_user_situation",
        petDomainQuestionSignalCount: expect.any(Number),
        staleFounderOptionCount: 0,
        answeredQuestionCount: 1,
        providerRunStatus: "research_insufficient",
        providerAdapterKind: "web_search_readonly",
        providerSourceUrls: expect.arrayContaining([
          "https://example.com/senior-pet-care-records",
          "https://example.org/pet-insurance-claim-documents"
        ]),
        followUpQuestionCount: 1,
        followUpResearchTaskCount: 1,
        readinessCompositeScore: 92,
        readinessLabel: "spec_ready",
        completionCandidateStatus: "candidate",
        planningHandoffStatus: "planning_ready",
        autoImplementationStatus: "pending",
        autoImplementationCurrentStage: "initial_pr",
        autoImplementationStageCount: 7,
        autoImplementationGeneratedSoftwareArtifactCount: 6,
        autoImplementationGeneratedSoftwareHasRunnableTest: true,
        generatedProductSourceRefCount: expect.any(Number),
        generatedProductResidualRiskCount: expect.any(Number),
        generatedProductFirstIssueTaskCount: expect.any(Number)
      }
    });
    expect(evidence.loop?.generatedQuestionCount).toBeGreaterThanOrEqual(10);
    expect(evidence.loop?.petDomainQuestionSignalCount).toBeGreaterThanOrEqual(3);
    expect(evidence.loop?.providerSourceRefCount).toBeGreaterThanOrEqual(1);
    expect(evidence.loop?.generatedProductSourceRefCount).toBeGreaterThanOrEqual(1);
    expect(evidence.loop?.generatedProductFirstIssueTaskCount).toBeGreaterThanOrEqual(1);
    expect(evidence.checked).toEqual(expect.arrayContaining([
      "one pet-lifecycle idea stayed on one project/session through every product-loop checkpoint",
      "domain-fit question generation avoided stale founder/operator customer options",
      "answer submission created source-linked research task debt in the same session",
      "same-session research synthesis generated follow-up question debt",
      "same-session research-generated follow-up questions created source-linked planned research task debt",
      "same-session auto implementation run started at initial_pr with canonical stages",
      "same-session auto implementation generated a runnable local software scaffold with source-traced smoke test",
      "same-session generated product data carried Planning Handoff source refs, residual risk register, and first-slice tasks"
    ]));
  }, 30_000);

  it("can run the same single-session loop through the live-web adapter branch with non-fixture public source URLs", async () => {
    const evidence = await runSingleSessionProductLoopSmoke({
      mode: "live_web",
      liveWebSearch: async ({ now }) => [
        {
          title: "Public senior pet care evidence",
          url: "https://www.nias.go.kr/companion/new_petBoard.do?cmCode=M210524110205412",
          snippet:
            "반려동물 보호자 유형과 노령 반려동물 의료 기록, 돌봄 후기, 보험 비용, 상담 대체재 니즈를 확인할 수 있는 공개 자료입니다.",
          retrievedAt: now()
        }
      ]
    });

    expect(evidence).toMatchObject({
      status: "passed",
      smoke: SINGLE_SESSION_PRODUCT_LOOP_SMOKE,
      mode: "live_web",
      loop: {
        providerAdapterKind: "web_search_readonly",
        providerSourceUrls: [
          "https://www.nias.go.kr/companion/new_petBoard.do?cmCode=M210524110205412"
        ],
        planningHandoffStatus: "planning_ready",
        autoImplementationCurrentStage: "initial_pr"
      }
    });
    expect(evidence.checked).toEqual(expect.arrayContaining([
      "same-session live public-web browser search imported non-fixture source URLs",
      "same-session web_search_readonly provider polling imported source-traced research evidence"
    ]));
  }, 30_000);
});
