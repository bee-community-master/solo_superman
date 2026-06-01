import { afterEach, describe, expect, it, vi } from "vitest";
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
  evidenceGateConfigFromEnv,
  emptyResearchEvidenceProjection,
  importResearchResult,
  planResearchTask,
  synthesizeEvidenceMatrix
} from "./index";

const sessionId = "sess_quality_gate" as SessionId;

afterEach(() => {
  vi.unstubAllEnvs();
});

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
  it("reads configurable evidence gate thresholds from environment", () => {
    vi.stubEnv("SOLO_RESEARCH_HIGH_IMPACT_REQUIRES_BALANCED_EVIDENCE", "false");
    vi.stubEnv("SOLO_RESEARCH_MINIMUM_USABLE_FINDINGS", "3");
    vi.stubEnv("MAX_EVIDENCE_CONFLICT_RATIO", "0.8");

    expect(evidenceGateConfigFromEnv()).toMatchObject({
      highImpactRequiresBalancedEvidence: false,
      minimumUsableFindings: 3,
      evidenceConflictRatio: 0.8
    });

    const researchTask = task();
    const researchResult = result({
      result: "Pro: founders report urgency and willingness to pay.",
      limitationNotes: "No counter-evidence source was found in this import."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });
    const pack = buildDecisionEvidencePack({ researchTask, researchResult, synthesisVersion: 1, matrix });

    expect(matrix).toMatchObject({
      balanceStatus: "missing_con_evidence",
      decisionBlocked: false
    });
    expect(pack.gateStatus).toBe("research_insufficient");
    expect(pack.gateChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "pro_con_balance",
          status: "failed",
          reason: expect.stringContaining("below configured minimum 3")
        })
      ])
    );
  });

  it("reports invalid evidence gate environment values with the failing variable name", () => {
    vi.stubEnv("SOLO_RESEARCH_HIGH_IMPACT_REQUIRES_BALANCED_EVIDENCE", "maybe");

    expect(() => evidenceGateConfigFromEnv()).toThrow(
      "SOLO_RESEARCH_HIGH_IMPACT_REQUIRES_BALANCED_EVIDENCE must be one of"
    );
  });

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

  it("does not turn rejected public-web noise into pro evidence or follow-up question snippets", () => {
    const researchTask = task({
      objective: "이혼 준비자를 위한 현금 runway와 유료 의향 검증",
      impact: "high"
    });
    const researchResult = result({
      result: [
        "Research objective:",
        "이혼 준비자를 위한 현금 runway와 유료 의향 검증",
        "Queries used:",
        "- 이혼 준비 재무 현금흐름 생계비 결제 의향 후기 상담",
        "Usable findings:",
        "- usable finding 없음",
        "Rejected noise:",
        "- count: 2",
        "- encykorea 인류의 기원 unrelated encyclopedia",
        "- support.microsoft PC 초기화 unrelated OS help",
        "Limitations:",
        "- source_quality_insufficient: no usable finding remained after relevance filtering.",
        "Human decision needed:",
        "공개 리서치에서 유의미한 근거를 찾지 못했으니 사용자가 직접 판단/검증 기준을 정해야 합니다."
      ].join("\n"),
      limitationNotes: "source_quality_insufficient: 공개 검색 결과에서 usable source-linked finding이 없었습니다."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });
    const serializedQuestion = matrix.additionalQuestions.join("\n");

    expect(matrix.balanceStatus).toBe("source_quality_insufficient");
    expect(matrix.proEvidence).toEqual([]);
    expect(matrix.conEvidence).toEqual([]);
    expect(serializedQuestion).toContain("공개 리서치에서 유의미한 근거를 찾지 못했으니 사용자가 직접 판단/검증 기준을 정해야 합니다");
    expect(serializedQuestion).not.toContain("enc");
    expect(serializedQuestion).not.toContain("인류");
    expect(serializedQuestion).not.toContain("support.microsoft");
    expect(serializedQuestion).not.toContain("PC 초기화");
  });

  it("keeps source-quality follow-up questions compact and translates English research snippets", () => {
    const researchTask = task({
      objective:
        "Find decision evidence for: 아이디어 “이혼을 준비하는 사람들을 위해 현재 현금 흐름과 재무상태에 대한 간단한 설문을 진행하여 현금 runway를 계산해서 생존가능 기간을 알려준다”와 목표 “배우자의 귀책사유로 이혼을 준비하는 사람들이 자신의 생존 가능 기간을 무료로 계산해본다” 기준으로 공개 사용자 후기, 커뮤니티 글, 경쟁·대체재 페이지, 가격/정책 자료, 관련 리포트에서 유료 의향을 확인합니다. Original ambiguity: 유료 의향 핵심 가설이 반박 질문 없이 남아 있음 User answer to account for: “가입, 재방문, 결제 의향, 반복 사용 등 행동 대체 지표를 측정한다.”. Decision this should inform: 유료 의향 core-assumption risk를 알려진 리스크 또는 검증 작업으로 닫습니다. Ambiguity dimension: assumption_pressure Collect current public evidence with source freshness, limitations, and counterexamples before treating the answer as implementation-ready. Return source-linked findings, limitations, other perspectives, and what still needs a human decision.",
      impact: "high"
    });
    const researchResult = result({
      result: [
        "Usable findings:",
        "- usable finding 없음",
        "Limitations:",
        "- 6 days ago · Use this divorce financial planning checklist to organize your cash flow, documents, insurance, account updates, and next-step planning during and after divorce."
      ].join("\n"),
      limitationNotes:
        "6 days ago · Use this divorce financial planning checklist to organize your cash flow, documents, insurance, account updates, and next-step planning during and after divorce."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });
    const serializedQuestion = matrix.additionalQuestions.join("\n");

    expect(serializedQuestion).toContain("근거 공백: 유료 의향 핵심 가설");
    expect(serializedQuestion).toContain("한계/불확실성: 최근 공개 검색 요약:");
    expect(serializedQuestion).toContain("이혼 전후의 현금 흐름, 서류, 보험, 계좌 업데이트, 다음 계획");
    expect(serializedQuestion).not.toContain("Find decision");
    expect(serializedQuestion).not.toContain("Original ambiguity");
    expect(serializedQuestion).not.toContain("User answer to account for");
    expect(serializedQuestion).not.toContain("Use this divorce financial planning checklist");
    expect(serializedQuestion.length).toBeLessThan(700);
  });

  it("strips English research objective metadata before localizing source-quality follow-ups", () => {
    const researchTask = task({
      objective:
        "Find decision evidence for: onboarding retention. Decision this should inform: whether to prioritize automated onboarding. Ambiguity dimension: retention. Collect current public evidence with source freshness, limitations, and counterexamples before treating the answer as implementation-ready. Return source-linked findings, limitations, other perspectives, and what still needs a human decision.",
      impact: "high"
    });
    const researchResult = result({
      result: "Usable findings:\n- usable finding 없음",
      limitationNotes: "source_quality_insufficient: no usable finding remained after relevance filtering."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });
    const serializedQuestion = matrix.additionalQuestions.join("\n");

    expect(matrix.balanceStatus).toBe("source_quality_insufficient");
    expect(serializedQuestion).toContain("whether to prioritize automated onboarding");
    expect(serializedQuestion).not.toContain("Find 판단 근거");
    expect(serializedQuestion).not.toContain("판단 this should inform");
    expect(serializedQuestion).not.toContain("Return source-linked findings");
    expect(serializedQuestion).not.toContain("Collect current public evidence");
    expect(serializedQuestion).not.toContain("Ambiguity dimension");
  });

  it("uses only structured supports and weakens findings for public-web evidence synthesis", () => {
    const researchTask = task({
      objective: "이혼 준비자를 위한 현금 runway와 유료 의향 검증",
      impact: "high"
    });
    const researchResult = result({
      result: [
        "Research objective:",
        "이혼 준비자를 위한 현금 runway와 유료 의향 검증",
        "Queries used:",
        "- 이혼 준비 재무 현금흐름 생계비 결제 의향 후기 상담",
        "Usable findings:",
        "- [supports] 이혼 준비자는 생계비와 현금흐름을 계산하는 유료 상담 결제 의향을 후기에 남겼다. — 이혼 전 재무 상담 후기 https://example.org/divorce-paid",
        "- [weakens] 무료 법률구조와 커뮤니티 조언이 대체재로 언급되어 앱 결제 전환은 낮을 수 있다. — 무료 대체재 비교 https://example.org/divorce-free-alternatives",
        "Rejected noise:",
        "- count: 1",
        "- OS 도움말 결과 제외",
        "Limitations:",
        "- 공개 snippet 기반이라 실제 결제 전환은 인터뷰로 확인해야 합니다."
      ].join("\n"),
      limitationNotes: "공개 snippet 기반이라 실제 결제 전환은 인터뷰로 확인해야 합니다."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix.balanceStatus).toBe("balanced");
    expect(matrix.proEvidence[0]?.summary).toContain("유료 상담 결제 의향");
    expect(matrix.conEvidence[0]?.summary).toContain("무료 법률구조");
    expect(matrix.proEvidence[0]?.summary).not.toContain("https://example.org");
    expect(matrix.conEvidence[0]?.summary).not.toContain("https://example.org");
  });

  it("keeps structured research section boundaries when deriving retained source refs", () => {
    const researchTask = task({
      objective: "Validate evidence for: onboarding retention",
      impact: "medium"
    });
    const researchResult = result({
      result: [
        "Usable findings:",
        "- [supports] Users completed onboarding faster after checklist setup — Onboarding report https://example.org/onboarding",
        "Human decision needed: decide rollout owner"
      ].join("\n"),
      limitationNotes: "A single public source was reviewed."
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

    expect(projection.reviewCards[0]?.retainedSourceRef).toBe("Users completed onboarding faster after checklist setup");
    expect(projection.reviewCards[0]?.retainedSourceRef).not.toContain("사용자 판단 needed");
    expect(projection.reviewCards[0]?.retainedSourceRef).not.toContain("Human decision needed");
  });

  it("preserves multiple structured usable findings so configured minimum gates can pass", () => {
    vi.stubEnv("SOLO_RESEARCH_MINIMUM_USABLE_FINDINGS", "3");

    const researchTask = task({
      objective: "반려동물 전생애주기 통합 관리 앱의 유료 수요 검증",
      impact: "high"
    });
    const researchResult = result({
      result: [
        "Research objective:",
        "반려동물 전생애주기 통합 관리 앱의 유료 수요 검증",
        "Usable findings:",
        "- [supports] 보호자는 예방접종, 진료기록, 보험 청구를 한 곳에서 관리하려는 니즈를 보였다. — 펫케어 앱 조사 https://example.org/pet-care-demand",
        "- [supports] 노령 반려동물 보호자는 반복 진료비와 복약 관리를 기록하는 도구에 비용을 지불했다. — 노령견 케어 리포트 https://example.org/senior-pet-care",
        "- [weakens] 동물병원 자체 앱과 보험사 앱이 일부 기록 관리 수요를 대체한다. — 대체재 분석 https://example.org/pet-app-alternatives",
        "Limitations:",
        "- 공개 snippet 기반이라 실제 결제 전환은 인터뷰로 확인해야 합니다."
      ].join("\n"),
      limitationNotes: "공개 snippet 기반이라 실제 결제 전환은 인터뷰로 확인해야 합니다."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });
    const pack = buildDecisionEvidencePack({ researchTask, researchResult, synthesisVersion: 1, matrix });

    expect(matrix.proEvidence).toHaveLength(2);
    expect(matrix.conEvidence).toHaveLength(1);
    expect(pack.gateStatus).toBe("accepted");
    expect(pack.gateChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "pro_con_balance",
          status: "passed"
        })
      ])
    );
  });

  it("creates a conflict-review follow-up for structured supports and weakens findings", () => {
    const researchTask = task({
      objective: "이혼 준비자를 위한 현금 runway와 유료 의향 검증",
      impact: "high"
    });
    const researchResult = result({
      result: [
        "Research objective:",
        "이혼 준비자를 위한 현금 runway와 유료 의향 검증",
        "Usable findings:",
        "- [supports] 이혼 준비자는 생계비와 현금흐름을 계산하는 유료 상담 결제 의향을 후기에 남겼다. — 이혼 전 재무 상담 후기 https://example.org/divorce-paid",
        "- [weakens] 무료 법률구조와 커뮤니티 조언이 대체재로 언급되어 앱 결제 전환은 낮을 수 있다. — 무료 대체재 비교 https://example.org/divorce-free-alternatives",
        "Limitations:",
        "- 공개 snippet 기반이라 실제 결제 전환은 인터뷰로 확인해야 합니다."
      ].join("\n"),
      limitationNotes: "공개 snippet 기반이라 실제 결제 전환은 인터뷰로 확인해야 합니다."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix.balanceStatus).toBe("balanced");
    expect(matrix.additionalQuestions).toEqual([expect.stringContaining("Conflict review:")]);
    expect(matrix.additionalQuestions[0]).toContain("공개 근거가 서로 다른 방향을 가리킵니다");
    expect(matrix.additionalQuestions[0]).toContain("어느 근거를 다음 판단의 기준으로 삼고");
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
    expect(matrix.additionalQuestions[0]).toContain("같은 단서가 확인되었습니다");
    expect(matrix.additionalQuestions[0]).toContain("한계와 불확실성");
    expect(matrix.additionalQuestions[0]).not.toContain("What evidence would resolve");
    expect(pack).toMatchObject({
      gateStatus: "research_insufficient",
      knownRisk: expect.stringContaining("missing_con_evidence"),
      nextValidationAction: expect.stringContaining("Review or supplement")
    });
  });

  it("asks for direct customer candidates when customer evidence names only incidental generic personas", () => {
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
      additionalQuestions: [expect.stringContaining("선택지 없이")]
    });
    expect(matrix.additionalQuestions[0]).toContain("첫 고객 후보를 2~4개로 직접 적고");
    expect(matrix.additionalQuestions[0]).not.toContain("혼자 만드는 초기 창업자");
    expect(matrix.additionalQuestions[0]).not.toContain("팀 리더/운영 담당자");
    expect(matrix.additionalQuestions[0]).not.toContain("어느 방향으로 판단");
  });

  it("does not infer a fixed founder/builder/team list from incidental evidence wording", () => {
    const researchTask = task({
      objective: "초기 고객 세그먼트와 사용자 성향 좁히기"
    });
    const researchResult = result({
      result:
        "Pro: solo founders repeatedly organize product decisions manually.",
      limitationNotes: "Domain expert builder and team leader samples remain narrow."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix.additionalQuestions[0]).toContain("선택지 없이");
    expect(matrix.additionalQuestions[0]).toContain("이 아이디어에 맞는 첫 고객 후보를 2~4개로 직접 적고");
    expect(matrix.additionalQuestions[0]).not.toContain("- 혼자 만드는 초기 창업자");
    expect(matrix.additionalQuestions[0]).not.toContain("- 도메인 전문 1인 빌더");
    expect(matrix.additionalQuestions[0]).not.toContain("- 팀 리더/운영 담당자");
    expect(matrix.additionalQuestions[0]).not.toContain("어느 성향의 고객에 집중");
  });

  it("asks for direct customer candidates instead of inventing generic founder options", () => {
    const researchTask = task({
      objective: "첫 고객 세그먼트 후보 중 하나 선택"
    });
    const researchResult = result({
      result: "Pro: public sources confirm scattered records and repeated manual comparison pain.",
      limitationNotes: "The actual first customer segment split remains unclear."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });
    const question = matrix.additionalQuestions[0] ?? "";

    expect(question).toContain("선택지 없이");
    expect(question).toContain("첫 고객 후보를 2~4개로 직접 적고");
    expect(question).not.toContain("혼자 만드는 초기 창업자");
    expect(question).not.toContain("도메인 전문 1인 빌더");
    expect(question).not.toContain("팀 리더/운영 담당자");
    expect(question).not.toContain("어느 성향의 고객에 집중");
  });

  it("uses pet-lifecycle customer candidates instead of generic builder segments for pet app ideas", () => {
    const researchTask = task({
      objective:
        "반려동물 전생애주기 의료, 급여, 일상, 보험, 장례 정보를 한 곳에서 관리하는 앱의 첫 고객 세그먼트가 너무 넓음을 구체화하기"
    });
    const researchResult = result({
      result:
        "Pro: 반려동물 보호자는 의료 기록, 급여 기록, 보험 청구, 장례 준비 정보를 여러 곳에 나눠 관리한다.",
      limitationNotes: "노령 반려동물 보호자와 첫 반려동물 보호자의 우선순위 차이는 추가 확인이 필요하다."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix.additionalQuestions[0]).toContain("- 첫 반려동물을 키우는 보호자");
    expect(matrix.additionalQuestions[0]).toContain("- 노령·만성질환 반려동물 보호자");
    expect(matrix.additionalQuestions[0]).toContain("- 보험·의료비 관리가 필요한 보호자");
    expect(matrix.additionalQuestions[0]).not.toContain("1인 빌더");
    expect(matrix.additionalQuestions[0]).not.toContain("팀 리더");
  });

  it("removes browser adapter meta text before creating user-facing research follow-up questions", () => {
    const researchTask = task({
      objective: "첫 고객 세그먼트가 너무 넓음을 조금 더 구체화하기"
    });
    const researchResult = result({
      result: [
        "Public source notes for research_task_meta.",
        "Query: Validate evidence for customer segment",
        "Sources reviewed: 1",
        "1. Public pet care report — https://example.com/pet-care",
        "   Pro: 반려동물 보호자는 의료 기록과 보험 서류를 반복해서 찾는다. Page body could not be fetched before timeout; search-result snippet retained for review.",
        "rch-result snippet retained for review. Pro: At least one public source was reachable through a read-only browser search. Limitation: Browser search snippets can be incomplete; quality-gate review must verify claims before acceptance.",
        "Pro: At least one public source was reachable through a read-only browser search.",
        "Limitation: Browser search snippets can be incomplete; quality-gate review must verify claims before acceptance."
      ].join("\n"),
      limitationNotes:
        "Browser-based public web search only; no login, CAPTCHA, anti-bot bypass, paid-service access, or external search API was used. Source snippets and fetched page text require quality-gate review before accepted 근거."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });
    const question = matrix.additionalQuestions[0] ?? "";

    expect(question).toContain("반려동물 보호자는 의료 기록과 보험 서류를 반복해서 찾는다");
    expect(question).not.toContain("snippet retained for review");
    expect(question).not.toContain("rch-result");
    expect(question).not.toContain("quality-gate review");
    expect(question).not.toContain("accepted 근거");
    expect(question).not.toContain("Browser-based public web search only");
    expect(question).not.toContain("At least one public source was reachable");
  });

  it("uses the source idea context when customer-segment research results are otherwise generic", () => {
    const researchTask = task({
      objective: "첫 고객 세그먼트가 너무 넓음"
    });
    const researchResult = result({
      result: "Pro: 공개 자료에서는 통합 기록과 비용 관리 문제를 함께 확인해야 한다는 단서가 있다.",
      limitationNotes: "다른 관점이나 반례가 부족해 과신 가능성이 남아 있습니다."
    });
    const matrix = synthesizeEvidenceMatrix({
      researchTask,
      researchResult,
      synthesisVersion: 1,
      contextText:
        "반려동물 전생애주기의 의료, 급여, 일상, 보험, 장례 정보를 한 곳에서 관리하는 앱"
    });
    const question = matrix.additionalQuestions[0] ?? "";

    expect(question).toContain("첫 반려동물을 키우는 보호자");
    expect(question).toContain("노령·만성질환 반려동물 보호자");
    expect(question).toContain("보험·의료비 관리가 필요한 보호자");
    expect(question).not.toContain("도메인 전문 1인 빌더");
    expect(question).not.toContain("팀 리더/운영 담당자");
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
    expect(matrix.additionalQuestions[0]).not.toContain("진행 후보로 둘지");
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
    expect(matrix.additionalQuestions[0]).not.toContain("진행 후보로 둘지");
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
    expect(matrix.additionalQuestions[0]).toContain("주관식/서술형, 진행·보류 판단, 하나 선택, 여러 개 선택, 우선순위");
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
    expect(matrix.additionalQuestions[0]).toContain("주관식/서술형, 진행·보류 판단, 하나 선택, 여러 개 선택, 우선순위");
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
    expect(matrix.additionalQuestions[0]).toContain("주관식/서술형, 진행·보류 판단, 하나 선택, 여러 개 선택, 우선순위");
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

  it("keeps subjective descriptive wording open even when evidence mentions options", () => {
    const researchTask = task({
      objective: "여러 선택 후보가 있지만 이번 질문은 주관형/서술식 답변으로 실제 고객 맥락을 설명해야 합니다."
    });
    const researchResult = result({
      result: "Pro: imported notes mention solo founders, team leads, and operators as possible customer candidates.",
      limitationNotes: "The actual user context still needs a narrative explanation."
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

  it("turns proceed-or-hold evidence gaps into explicit proceed-or-hold prompts", () => {
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
      additionalQuestions: [expect.stringContaining("진행 후보로 둘지")]
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
      additionalQuestions: [expect.stringContaining("선택지 없이")]
    });
    expect(matrix.additionalQuestions[0]).not.toContain("진행 후보로 둘지");
    expect(matrix.additionalQuestions[0]).not.toContain("Pro:");
    expect(matrix.additionalQuestions[0]).toContain("individual founders mention repeated planning pain");
  });

  it("honors negated pro-con wording when the objective asks for one candidate choice", () => {
    const researchTask = task({
      objective: "찬성/반대 선택이 아니라 고객 후보를 하나 선택해야 합니다. 후보는 개인 창업자, 팀 리더, 운영 담당자입니다."
    });
    const researchResult = result({
      result: "Pro: individual founders, team leads, and operators all show possible need.",
      limitationNotes: "The best first segment still needs a user decision."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix.additionalQuestions[0]).toContain("리서치 단서에서 우선 비교할 고객 후보");
    expect(matrix.additionalQuestions[0]).toContain("- 개인 창업자");
    expect(matrix.additionalQuestions[0]).toContain("- 팀 리더");
    expect(matrix.additionalQuestions[0]).toContain("- 운영 담당자");
    expect(matrix.additionalQuestions[0]).toContain("어느 성향의 고객에 집중");
    expect(matrix.additionalQuestions[0]).not.toContain("찬성/반대 중 어느 쪽");
  });

  it("honors negated pro-con wording when the objective asks for several applicable choices", () => {
    const researchTask = task({
      objective: "찬성/반대가 아니라 여러 고객 신호를 하나 이상 선택해야 합니다. 신호는 반복되는 수동 고통, 예산/지불 의향, 기존 대안 불만입니다."
    });
    const researchResult = result({
      result: "Pro: repeated manual work, budget-owner pressure, and dissatisfaction with alternatives appear together.",
      limitationNotes: "The next interview should choose which signals apply."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });

    expect(matrix.additionalQuestions[0]).toContain("리서치 단서에서 다음에 함께 확인할 고객 신호");
    expect(matrix.additionalQuestions[0]).toContain("반복되는 수동 고통");
    expect(matrix.additionalQuestions[0]).toContain("예산/지불 의향");
    expect(matrix.additionalQuestions[0]).toContain("기존 대안 불만");
    expect(matrix.additionalQuestions[0]).toContain("여러 개 선택");
    expect(matrix.additionalQuestions[0]).not.toContain("찬성/반대 중 어느 쪽");
  });

  it("lets explicit objective wording ask for a binary proceed-or-hold answer even when an explanation is needed", () => {
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
      additionalQuestions: [expect.stringContaining("진행 후보로 둘지")]
    });
    expect(matrix.additionalQuestions[0]).not.toContain("본인 말로 3~5문장으로 서술");
  });

  it("recognizes agree/disagree object wording as a binary answer form with natural copy", () => {
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
      additionalQuestions: [expect.stringContaining("진행 후보로 둘지")]
    });
    expect(matrix.additionalQuestions[0]).not.toContain("하나의 선택지");
    expect(matrix.additionalQuestions[0]).not.toContain("본인 말로 3~5문장으로 서술");
  });

  it("keeps explicit agree/disagree customer-topic objectives as proceed-or-hold instead of candidate choice", () => {
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
      additionalQuestions: [expect.stringContaining("진행 후보로 둘지")]
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
