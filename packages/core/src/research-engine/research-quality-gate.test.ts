import { describe, expect, it } from "vitest";
import type {
  ProjectionVersion,
  QueueItemId,
  ResearchResultId,
  ResearchRunId,
  ResearchTaskId,
  SessionId
} from "@solo-superman/contracts";
import {
  addResearchResultToProjection,
  buildDecisionEvidencePack,
  emptyResearchEvidenceProjection,
  importResearchResult,
  planResearchTask,
  synthesizeEvidenceMatrix
} from "./index";

const sessionId = "sess_quality_gate" as SessionId;

function task(overrides: Partial<Parameters<typeof planResearchTask>[0]> = {}) {
  return planResearchTask({
    researchTaskId: "research_task_quality_gate" as ResearchTaskId,
    sessionId,
    objective: "Validate paid founder urgency",
    routeOutcome: "missing_con_evidence",
    impact: "high",
    sourceQueueItemId: "queue_quality_gate" as QueueItemId,
    createdAt: "2026-05-05T00:00:00.000Z",
    ...overrides
  });
}

function result(overrides: Partial<Parameters<typeof importResearchResult>[0]> = {}) {
  return importResearchResult({
    researchResultId: "research_result_quality_gate" as ResearchResultId,
    researchTaskId: "research_task_quality_gate" as ResearchTaskId,
    researchRunId: "research_run_quality_gate" as ResearchRunId,
    result: "Pro: founders report urgency. Con: replacement workflows may already be good enough.",
    limitationNotes: "Manual import still needs source breadth review.",
    sourceReliability: "medium",
    claim: "Founders have urgent paid demand.",
    decisionContext: "problem",
    specSectionRef: "spec:problem",
    questionRef: "queue_quality_gate",
    implicationScope: "Supports review only; do not update SpecVersion automatically.",
    importedAt: "2026-05-05T00:01:00.000Z",
    ...overrides
  });
}

describe("Decision-linked research quality gate", () => {
  it("accepts balanced evidence into a decision-linked Evidence Pack", () => {
    const researchTask = task();
    const researchResult = result();
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });
    const pack = buildDecisionEvidencePack({ researchTask, researchResult, synthesisVersion: 1, matrix });

    expect(matrix).toMatchObject({ balanceStatus: "balanced", decisionBlocked: false });
    expect(pack).toMatchObject({
      gateStatus: "accepted",
      researchRunId: "research_run_quality_gate",
      claim: "Founders have urgent paid demand.",
      decisionContext: "problem",
      specSectionRef: "spec:problem",
      questionRef: "queue_quality_gate",
      proEvidenceItemIds: [expect.stringContaining("evidence_pro")],
      conEvidenceItemIds: [expect.stringContaining("evidence_con")]
    });
  });

  it("keeps gate-unknown evidence in needs_review with an explicit reason", () => {
    const researchTask = task();
    const researchResult = result({
      sourceReliability: "unknown"
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });
    const pack = buildDecisionEvidencePack({ researchTask, researchResult, synthesisVersion: 1, matrix });
    const projection = addResearchResultToProjection(
      emptyResearchEvidenceProjection(),
      researchTask,
      researchResult,
      matrix,
      pack,
      1 as ProjectionVersion
    );

    expect(pack.gateStatus).toBe("needs_review");
    expect(pack.gateChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "source_metadata",
          status: "unknown",
          reason: expect.stringContaining("insufficient")
        })
      ])
    );
    expect(projection.tasks[0]).toMatchObject({ status: "needs_review" });
    expect(projection.reviewCards[0]).toMatchObject({
      state: "quality_gate_review",
      gateStatus: "needs_review",
      reviewReason: expect.stringContaining("insufficient")
    });
  });

  it("fails high-impact pro-only evidence as explicit research_insufficient instead of decision-ready", () => {
    const researchTask = task();
    const researchResult = result({
      result: "Pro: founders report urgency and willingness to pay.",
      limitationNotes: "No counter-evidence source was found in this import."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });
    const pack = buildDecisionEvidencePack({ researchTask, researchResult, synthesisVersion: 1, matrix });

    expect(matrix).toMatchObject({
      balanceStatus: "missing_con_evidence",
      decisionBlocked: true,
      missingConEvidenceReason: expect.stringContaining("No counter-evidence"),
      additionalQuestions: [
        expect.stringContaining("paid founder urgency를 조금 더 구체화")
      ]
    });
    expect(matrix.additionalQuestions[0]).toContain("찬성쪽 근거");
    expect(matrix.additionalQuestions[0]).toContain("한계와 불확실성");
    expect(matrix.additionalQuestions[0]).not.toContain("What evidence would resolve");
    expect(pack).toMatchObject({
      gateStatus: "research_insufficient",
      knownRisk: expect.stringContaining("missing_con_evidence"),
      nextValidationAction: expect.stringContaining("Review or supplement")
    });
  });

  it("turns customer-segment evidence gaps into one-of-many customer choice prompts", () => {
    const researchTask = task({
      objective: "초기 고객 세그먼트와 사용자 성향 좁히기"
    });
    const researchResult = result({
      result: "Pro: solo founders repeatedly organize product decisions manually.",
      limitationNotes: "Organization buyer samples were not broad enough."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix).toMatchObject({
      balanceStatus: "missing_con_evidence",
      additionalQuestions: [expect.stringContaining("어느 성향의 고객에 집중")]
    });
    expect(matrix.additionalQuestions[0]).not.toContain("어느 방향으로 판단");
  });

  it("uses evidence-derived customer candidates in listed follow-up prompts", () => {
    const researchTask = task({
      objective: "초기 고객 세그먼트와 사용자 성향 좁히기"
    });
    const researchResult = result({
      result:
        "Pro: solo founders repeatedly organize product decisions manually.",
      limitationNotes: "Domain expert builder and team leader samples remain narrow."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix.additionalQuestions[0]).toContain("리서치 단서에서 우선 비교할 고객 후보");
    expect(matrix.additionalQuestions[0]).toContain("- 혼자 만드는 초기 창업자");
    expect(matrix.additionalQuestions[0]).toContain("- 도메인 전문 1인 빌더");
    expect(matrix.additionalQuestions[0]).toContain("- 팀 리더/운영 담당자");
    expect(matrix.additionalQuestions[0]).toContain("어느 성향의 고객에 집중");
  });

  it("turns problem-context evidence gaps into open narrative prompts", () => {
    const researchTask = task({
      objective: "사용자가 어떤 상황에서 문제를 겪는지 맥락 설명"
    });
    const researchResult = result({
      result: "Pro: users repeatedly describe manual coordination pain.",
      limitationNotes: "The import still needs wider interview coverage."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix).toMatchObject({
      balanceStatus: "missing_con_evidence",
      additionalQuestions: [expect.stringContaining("본인 말로 3~5문장으로 서술")]
    });
    expect(matrix.additionalQuestions[0]).not.toContain("찬성쪽 근거");
    expect(matrix.additionalQuestions[0]).not.toContain("Pro:");
    expect(matrix.additionalQuestions[0]).toContain("users repeatedly describe manual coordination pain");
  });

  it("keeps open-question objectives narrative even when they mention pro/con evidence", () => {
    const researchTask = task({
      objective: "찬성/반대 근거를 참고하되 open question으로 실제 고객 맥락 서술"
    });
    const researchResult = result({
      result: "Pro: users repeatedly describe manual coordination pain.",
      limitationNotes: "Counter-evidence coverage is still narrow."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix).toMatchObject({
      balanceStatus: "missing_con_evidence",
      additionalQuestions: [expect.stringContaining("본인 말로 3~5문장으로 서술")]
    });
    expect(matrix.additionalQuestions[0]).not.toContain("찬성쪽 근거");
    expect(matrix.additionalQuestions[0]).not.toContain("찬성/반대 중 어느 쪽");
  });

  it("keeps customer-context narrative questions open instead of turning every customer mention into segment choice", () => {
    const researchTask = task({
      objective: "고객이 어떤 상황에서 문제를 겪는지 주관식으로 맥락 설명"
    });
    const researchResult = result({
      result: "Pro: customers mention coordination pain during repeated planning work.",
      limitationNotes: "The exact situation still needs the user's own description."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix).toMatchObject({
      balanceStatus: "missing_con_evidence",
      additionalQuestions: [expect.stringContaining("본인 말로 3~5문장으로 서술")]
    });
    expect(matrix.additionalQuestions[0]).not.toContain("어느 성향의 고객에 집중");
    expect(matrix.additionalQuestions[0]).not.toContain("찬성쪽 근거");
  });

  it("keeps which-customer narrative wording open when it explicitly asks for a written answer", () => {
    const researchTask = task({
      objective: "어느 고객 상황에서 문제가 커지는지 open question으로 주관식 서술"
    });
    const researchResult = result({
      result: "Pro: different customer contexts show different urgency levels.",
      limitationNotes: "The exact context still needs a written user decision."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix).toMatchObject({
      balanceStatus: "missing_con_evidence",
      additionalQuestions: [expect.stringContaining("본인 말로 3~5문장으로 서술")]
    });
    expect(matrix.additionalQuestions[0]).not.toContain("어느 성향의 고객에 집중");
    expect(matrix.additionalQuestions[0]).not.toContain("찬성/반대 중 어느 쪽");
  });

  it("keeps no-choice narrative wording open even when it mentions choices", () => {
    const researchTask = task({
      objective: "선택지 없이 고객이 겪는 제약을 자유롭게 서술"
    });
    const researchResult = result({
      result: "Pro: users describe different constraints around the same workflow.",
      limitationNotes: "A fixed option list would hide the user's actual context."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix).toMatchObject({
      balanceStatus: "missing_con_evidence",
      additionalQuestions: [expect.stringContaining("본인 말로 3~5문장으로 서술")]
    });
    expect(matrix.additionalQuestions[0]).not.toContain("하나의 선택지");
    expect(matrix.additionalQuestions[0]).not.toContain("어느 성향의 고객에 집중");
  });

  it("turns signal evidence gaps into multi-select prompts", () => {
    const researchTask = task({
      objective: "다음 인터뷰에서 확인할 고객 신호와 조건 여러 개 선택"
    });
    const researchResult = result({
      result: "Pro: several signals appear relevant across imported notes.",
      limitationNotes: "The signal list still needs direct customer confirmation."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix).toMatchObject({
      balanceStatus: "missing_con_evidence",
      additionalQuestions: [expect.stringContaining("여러 개 선택")]
    });
  });

  it("uses evidence-derived signal candidates in listed multi-select prompts", () => {
    const researchTask = task({
      objective: "다음 인터뷰에서 확인할 고객 신호와 조건 여러 개 선택"
    });
    const researchResult = result({
      result:
        "Pro: customers mention manual workarounds, budget timing, and repeat-use cues around the workflow.",
      limitationNotes: "Alternative dissatisfaction is still based on a small import."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix.additionalQuestions[0]).toContain("리서치 단서에서 다음에 함께 확인할 고객 신호");
    expect(matrix.additionalQuestions[0]).toContain("- 반복되는 수동 고통");
    expect(matrix.additionalQuestions[0]).toContain("- 예산/지불 의향");
    expect(matrix.additionalQuestions[0]).toContain("- 기존 대안 불만");
    expect(matrix.additionalQuestions[0]).toContain("- 직접 만든 임시 해결책");
    expect(matrix.additionalQuestions[0]).toContain("- 반복 사용/공유 신호");
    expect(matrix.additionalQuestions[0]).toContain("해당되는 신호를 여러 개 선택");
  });

  it("uses exact customer candidates named by research evidence before falling back to defaults", () => {
    const researchTask = task({
      objective: "첫 고객 세그먼트 후보 중 하나 선택"
    });
    const researchResult = result({
      result:
        "Pro: customer segments include independent consultants, bootcamp instructors, and small agency operators.",
      limitationNotes: "The exact first segment still needs founder selection."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix.additionalQuestions[0]).toContain("리서치 단서에서 우선 비교할 고객 후보");
    expect(matrix.additionalQuestions[0]).toContain("- independent consultants");
    expect(matrix.additionalQuestions[0]).toContain("- bootcamp instructors");
    expect(matrix.additionalQuestions[0]).toContain("- small agency operators");
    expect(matrix.additionalQuestions[0]).toContain("어느 성향의 고객에 집중");
  });

  it("keeps customer segment one-or-more objectives as multi-select prompts", () => {
    const researchTask = task({
      objective:
        "고객 세그먼트 후보는 독립 컨설턴트, 부트캠프 강사, 소규모 에이전시 운영자입니다. 여러 종류 중 하나 혹은 여러 개를 선택해야 합니다."
    });
    const researchResult = result({
      result: "Pro: multiple customer segments may fit the first validation batch.",
      limitationNotes: "The exact customer combination still needs direct founder selection."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix.additionalQuestions[0]).toContain("함께 비교할 고객 후보");
    expect(matrix.additionalQuestions[0]).toContain("- 독립 컨설턴트");
    expect(matrix.additionalQuestions[0]).toContain("- 부트캠프 강사");
    expect(matrix.additionalQuestions[0]).toContain("- 소규모 에이전시 운영자");
    expect(matrix.additionalQuestions[0]).toContain("고객 후보를 하나 이상 선택");
    expect(matrix.additionalQuestions[0]).not.toContain("어느 성향의 고객에 집중");
    expect(matrix.additionalQuestions[0]).not.toContain("찬성/반대 중 어느 쪽");
  });

  it("uses exact signal candidates named by research evidence in multi-select prompts", () => {
    const researchTask = task({
      objective: "다음 인터뷰에서 확인할 고객 신호와 조건 여러 개 선택"
    });
    const researchResult = result({
      result:
        "Pro: customer signals include repeated spreadsheet work, budget-owner pressure, and referral requests.",
      limitationNotes: "The exact signal combination still needs direct interview confirmation."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix.additionalQuestions[0]).toContain("리서치 단서에서 다음에 함께 확인할 고객 신호");
    expect(matrix.additionalQuestions[0]).toContain("- repeated spreadsheet work");
    expect(matrix.additionalQuestions[0]).toContain("- budget-owner pressure");
    expect(matrix.additionalQuestions[0]).toContain("- referral requests");
    expect(matrix.additionalQuestions[0]).toContain("해당되는 신호를 여러 개 선택");
  });

  it("does not collapse signal or criteria objectives with incidental 여부 wording into pro/con prompts", () => {
    const researchTask = task({
      objective: "구매 여부를 판단할 고객 신호와 조건 확인"
    });
    const researchResult = result({
      result: "Pro: customers mention budget timing, manual workaround, and repeat-use cues.",
      limitationNotes: "The best signal combination still needs user selection."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix).toMatchObject({
      balanceStatus: "missing_con_evidence",
      additionalQuestions: [expect.stringContaining("여러 개 선택")]
    });
    expect(matrix.additionalQuestions[0]).not.toContain("찬성/반대 중 어느 쪽");
    expect(matrix.additionalQuestions[0]).not.toContain("찬성쪽 근거");
  });

  it("turns generic one-of-many objective wording into a single-choice prompt", () => {
    const researchTask = task({
      objective: "여러 종류 중 하나만 선택해야 하는 객관식 기준 결정"
    });
    const researchResult = result({
      result: "Pro: imported notes narrow the viable categories.",
      limitationNotes: "The category list is still based on a small sample."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix).toMatchObject({
      balanceStatus: "missing_con_evidence",
      additionalQuestions: [expect.stringContaining("하나의 선택지")]
    });
    expect(matrix.additionalQuestions[0]).not.toContain("여러 개 선택");
    expect(matrix.additionalQuestions[0]).not.toContain("찬성쪽 근거");
  });

  it("keeps named generic single-choice candidates visible in the follow-up prompt", () => {
    const researchTask = task({
      objective: "검증 방법 후보는 고객 인터뷰, 랜딩페이지 신청, 수동 concierge 테스트입니다. 여러 종류 중 하나만 선택해야 하는 객관식 기준 결정"
    });
    const researchResult = result({
      result: "Pro: imported notes narrow the viable validation methods.",
      limitationNotes: "The best first validation method still needs a user decision."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix.additionalQuestions[0]).toContain("질문에서 비교할 후보");
    expect(matrix.additionalQuestions[0]).toContain("- 고객 인터뷰");
    expect(matrix.additionalQuestions[0]).toContain("- 랜딩페이지 신청");
    expect(matrix.additionalQuestions[0]).toContain("- 수동 concierge 테스트");
    expect(matrix.additionalQuestions[0]).toContain("하나의 선택지");
  });

  it("turns one-or-more objective wording into a multi-choice prompt", () => {
    const researchTask = task({
      objective: "여러 종류 중 하나 혹은 여러 개를 선택해야 하는 후보 결정"
    });
    const researchResult = result({
      result: "Pro: multiple categories may apply to the first validation batch.",
      limitationNotes: "The exact combination still needs a user decision."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix).toMatchObject({
      balanceStatus: "missing_con_evidence",
      additionalQuestions: [expect.stringContaining("하나 이상 선택")]
    });
    expect(matrix.additionalQuestions[0]).not.toContain("찬성쪽 근거");
    expect(matrix.additionalQuestions[0]).not.toContain("Pro:");
    expect(matrix.additionalQuestions[0]).toContain("multiple categories may apply to the first validation batch");
  });

  it("does not treat answer-form policy wording as candidate choices or pro-con stance", () => {
    const researchTask = task({
      objective:
        "모든 내용이 찬성과 반대가 되는 게 아니라 객관식으로 찬성/반대를 할 수도 있고, 여러 종류 중 하나 혹은 여러 개를 선택해야 할 수도 있습니다. 답변을 다양하게 필요에 맞게 구성"
    });
    const researchResult = result({
      result: "Pro: different question types need different input formats.",
      limitationNotes: "The exact answer form should follow the concrete question intent."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix).toMatchObject({
      balanceStatus: "missing_con_evidence",
      additionalQuestions: [expect.stringContaining("질문마다 답변 형식을 달리")]
    });
    expect(matrix.additionalQuestions[0]).toContain("주관식/서술형, 찬성·반대, 하나 선택, 여러 개 선택, 우선순위");
    expect(matrix.additionalQuestions[0]).not.toContain("찬성/반대 중 어느 쪽");
    expect(matrix.additionalQuestions[0]).not.toContain("하나 이상 선택");
    expect(matrix.additionalQuestions[0]).not.toContain("- 객관식으로 찬성");
  });

  it("keeps explicit open-text and choice families as answer-form policy when they are described together", () => {
    const researchTask = task({
      objective:
        "모든 내용이 찬성과 반대가 되는 게 아니라 open question으로 주관식이나 서술형 답변을 요구할 수도 있고 객관식으로 찬성/반대를 할 수도 있고, 여러 종류중 하나 혹은 여러개를 선택해야 할 수도 있습니다. 답변을 다양하게 필요에 맞게 구성할 수 있어야 합니다."
    });
    const researchResult = result({
      result: "Pro: follow-up cards need to match the user's decision intent.",
      limitationNotes: "The concrete answer form should be selected per question."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix.additionalQuestions[0]).toContain("질문마다 답변 형식을 달리");
    expect(matrix.additionalQuestions[0]).toContain("주관식/서술형, 찬성·반대, 하나 선택, 여러 개 선택, 우선순위");
    expect(matrix.additionalQuestions[0]).not.toContain("찬성쪽 근거");
    expect(matrix.additionalQuestions[0]).not.toContain("찬성/반대 중 어느 쪽");
    expect(matrix.additionalQuestions[0]).not.toContain("하나 이상 선택");
  });

  it("treats mixed subjective and objective wording as an answer-form policy", () => {
    const researchTask = task({
      objective:
        "어떤 질문은 주관식으로 직접 설명하고 어떤 질문은 객관식으로 후보를 고르게 하면서 답변 형식을 질문 의도에 맞게 다양하게 구성"
    });
    const researchResult = result({
      result: "Pro: non-technical users answer better when the input shape matches the decision being made.",
      limitationNotes: "The exact split between text and choice questions still needs product judgment."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix.additionalQuestions[0]).toContain("질문마다 답변 형식을 달리");
    expect(matrix.additionalQuestions[0]).toContain("주관식/서술형, 찬성·반대, 하나 선택, 여러 개 선택, 우선순위");
    expect(matrix.additionalQuestions[0]).not.toContain("찬성/반대 중 어느 쪽");
    expect(matrix.additionalQuestions[0]).not.toContain("하나의 선택지");
  });

  it("keeps named generic multi-choice candidates visible in the follow-up prompt", () => {
    const researchTask = task({
      objective: "기능 후보는 빠른 온보딩, 수동 검증, 가격 테스트입니다. 여러 종류 중 하나 혹은 여러 개를 선택해야 하는 후보 결정"
    });
    const researchResult = result({
      result: "Pro: multiple product slices may apply to the first validation batch.",
      limitationNotes: "The exact combination still needs a user decision."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix.additionalQuestions[0]).toContain("질문에서 함께 비교할 후보");
    expect(matrix.additionalQuestions[0]).toContain("- 빠른 온보딩");
    expect(matrix.additionalQuestions[0]).toContain("- 수동 검증");
    expect(matrix.additionalQuestions[0]).toContain("- 가격 테스트");
    expect(matrix.additionalQuestions[0]).toContain("하나 이상 선택");
  });

  it("lets explicit open-question wording override incidental one-or-many choice language", () => {
    const researchTask = task({
      objective:
        "여러 종류 중 하나 혹은 여러 개를 선택할 수도 있지만 이번 질문은 open question으로 주관식/서술형 답변을 요구"
    });
    const researchResult = result({
      result: "Pro: imported notes mention several possible customer situations.",
      limitationNotes: "The exact user context still needs the founder's own explanation."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix).toMatchObject({
      balanceStatus: "missing_con_evidence",
      additionalQuestions: [expect.stringContaining("본인 말로 3~5문장으로 서술")]
    });
    expect(matrix.additionalQuestions[0]).not.toContain("하나 이상 선택");
    expect(matrix.additionalQuestions[0]).not.toContain("찬성/반대 중 어느 쪽");
  });

  it("turns priority-order objective wording into a ranked prompt", () => {
    const researchTask = task({
      objective: "검증 후보들의 우선순위를 정해야 하는 결정"
    });
    const researchResult = result({
      result: "Pro: imported notes mention several validation candidates.",
      limitationNotes: "The right order still needs a user decision."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix).toMatchObject({
      balanceStatus: "missing_con_evidence",
      additionalQuestions: [expect.stringContaining("우선순위를 1순위부터")]
    });
    expect(matrix.additionalQuestions[0]).not.toContain("찬성/반대 중 어느 쪽");
  });

  it("keeps named ranking candidates visible in the follow-up prompt", () => {
    const researchTask = task({
      objective: "검증 후보는 고객 인터뷰, 랜딩페이지 신청, 수동 테스트입니다. 검증 후보들의 우선순위를 정해야 하는 결정"
    });
    const researchResult = result({
      result: "Pro: imported notes mention several validation candidates.",
      limitationNotes: "The right order still needs a user decision."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix.additionalQuestions[0]).toContain("질문에서 순서를 비교할 후보");
    expect(matrix.additionalQuestions[0]).toContain("- 고객 인터뷰");
    expect(matrix.additionalQuestions[0]).toContain("- 랜딩페이지 신청");
    expect(matrix.additionalQuestions[0]).toContain("- 수동 테스트");
    expect(matrix.additionalQuestions[0]).toContain("우선순위를 1순위부터");
  });

  it("lets explicit priority wording win over incidental several-options wording", () => {
    const researchTask = task({
      objective: "검증 후보는 고객 인터뷰, 랜딩페이지 신청, 수동 테스트입니다. 여러 개 후보의 우선순위를 정해야 하는 결정"
    });
    const researchResult = result({
      result: "Pro: imported notes mention several validation candidates.",
      limitationNotes: "The right order still needs a user decision."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix.additionalQuestions[0]).toContain("질문에서 순서를 비교할 후보");
    expect(matrix.additionalQuestions[0]).toContain("우선순위를 1순위부터");
    expect(matrix.additionalQuestions[0]).not.toContain("하나 이상 선택");
    expect(matrix.additionalQuestions[0]).not.toContain("찬성/반대 중 어느 쪽");
  });

  it("turns proceed-or-hold evidence gaps into explicit agree/disagree prompts", () => {
    const researchTask = task({
      objective: "이 방향을 스펙에 반영할지 여부 결정"
    });
    const researchResult = result({
      result: "Pro: imported notes support adding the direction to the spec.",
      limitationNotes: "Counter-evidence has not been reviewed broadly."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix).toMatchObject({
      balanceStatus: "missing_con_evidence",
      additionalQuestions: [expect.stringContaining("찬성/반대 중 어느 쪽")]
    });
  });

  it("keeps objective answer form over incidental pro/con evidence wording", () => {
    const researchTask = task({
      objective: "찬성/반대 근거를 참고해 고객 후보를 객관식으로 선택"
    });
    const researchResult = result({
      result: "Pro: individual founders mention repeated planning pain.",
      limitationNotes: "The team-leader sample is still narrow."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix).toMatchObject({
      balanceStatus: "missing_con_evidence",
      additionalQuestions: [expect.stringContaining("어느 성향의 고객에 집중")]
    });
    expect(matrix.additionalQuestions[0]).not.toContain("찬성/반대 중 어느 쪽");
    expect(matrix.additionalQuestions[0]).not.toContain("Pro:");
    expect(matrix.additionalQuestions[0]).toContain("individual founders mention repeated planning pain");
  });

  it("lets explicit objective wording ask for a binary agree/disagree answer even when an explanation is needed", () => {
    const researchTask = task({
      objective: "객관식으로 찬성/반대 중 하나를 선택하고 이유는 직접 설명"
    });
    const researchResult = result({
      result: "Pro: imported notes support adding the direction to the spec.",
      limitationNotes: "Counter-evidence has not been reviewed broadly."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix).toMatchObject({
      balanceStatus: "missing_con_evidence",
      additionalQuestions: [expect.stringContaining("찬성/반대 중 어느 쪽")]
    });
    expect(matrix.additionalQuestions[0]).not.toContain("본인 말로 3~5문장으로 서술");
  });

  it("recognizes agree/disagree object wording as a binary answer form", () => {
    const researchTask = task({
      objective: "객관식으로 찬성/반대를 할 수도 있고 이유는 직접 설명"
    });
    const researchResult = result({
      result: "Pro: imported notes support adding the direction to the spec.",
      limitationNotes: "Counter-evidence has not been reviewed broadly."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix).toMatchObject({
      balanceStatus: "missing_con_evidence",
      additionalQuestions: [expect.stringContaining("찬성/반대 중 어느 쪽")]
    });
    expect(matrix.additionalQuestions[0]).not.toContain("하나의 선택지");
    expect(matrix.additionalQuestions[0]).not.toContain("본인 말로 3~5문장으로 서술");
  });

  it("keeps explicit agree/disagree customer-topic objectives as binary instead of candidate choice", () => {
    const researchTask = task({
      objective: "초기 고객 세그먼트 방향을 유지할지 말지 객관식으로 찬성/반대 중 하나를 선택"
    });
    const researchResult = result({
      result: "Pro: individual founders mention repeated planning pain.",
      limitationNotes: "Counter-evidence for broader teams has not been reviewed broadly."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix).toMatchObject({
      balanceStatus: "missing_con_evidence",
      additionalQuestions: [expect.stringContaining("찬성/반대 중 어느 쪽")]
    });
    expect(matrix.additionalQuestions[0]).not.toContain("어느 성향의 고객에 집중");
    expect(matrix.additionalQuestions[0]).not.toContain("하나의 선택지");
  });

  it("prioritizes failed high-impact evidence over secondary unknown checks", () => {
    const researchTask = task();
    const researchResult = result({
      result: "Pro: founders report urgency and willingness to pay.",
      sourceReliability: "unknown",
      limitationNotes: "No counter-evidence source was found in this import."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });
    const pack = buildDecisionEvidencePack({ researchTask, researchResult, synthesisVersion: 1, matrix });
    const projection = addResearchResultToProjection(
      emptyResearchEvidenceProjection(),
      researchTask,
      researchResult,
      matrix,
      pack,
      1 as ProjectionVersion
    );

    expect(pack.gateChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "source_metadata", status: "unknown" }),
        expect.objectContaining({ code: "pro_con_balance", status: "failed" })
      ])
    );
    expect(pack.gateStatus).toBe("research_insufficient");
    expect(projection.reviewCards[0]).toMatchObject({
      state: "research_insufficient",
      reviewReason: expect.stringContaining("High-impact claim")
    });
  });

  it("does not mark balanced evidence ready when a high-impact source reliability gate fails", () => {
    const researchTask = task();
    const researchResult = result({
      sourceReliability: "low"
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });
    const pack = buildDecisionEvidencePack({ researchTask, researchResult, synthesisVersion: 1, matrix });
    const projection = addResearchResultToProjection(
      emptyResearchEvidenceProjection(),
      researchTask,
      researchResult,
      matrix,
      pack,
      1 as ProjectionVersion
    );

    expect(matrix).toMatchObject({
      balanceStatus: "balanced",
      decisionBlocked: false
    });
    expect(pack.gateStatus).toBe("research_insufficient");
    expect(pack.gateChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "source_reliability",
          status: "failed"
        })
      ])
    );
    expect(projection.tasks[0]).toMatchObject({ status: "research_insufficient" });
    expect(projection.reviewCards[0]).toMatchObject({
      state: "research_insufficient",
      gateStatus: "research_insufficient",
      reviewReason: expect.stringContaining("Low-reliability source")
    });
  });

  it("marks stale-sensitive evidence stale when the source predates the freshness requirement", () => {
    const researchTask = task();
    const researchResult = result({
      staleSensitive: true,
      sourcePublishedAt: "2026-05-01T00:00:00.000Z",
      sourceRequiredAfter: "2026-05-04T00:00:00.000Z"
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });
    const pack = buildDecisionEvidencePack({ researchTask, researchResult, synthesisVersion: 1, matrix });

    expect(pack.gateStatus).toBe("stale");
    expect(pack.gateChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "staleness",
          status: "failed"
        })
      ])
    );
  });
});
