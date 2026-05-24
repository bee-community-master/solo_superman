import { describe, expect, it } from "vitest";
import type {
  AmbiguityIssueSnapshot,
  EvidenceItemId,
  EvidenceMatrixProjection,
  QueueItemId,
  ResearchResultId,
  ResearchTaskId,
  ResearchTaskProjection,
  SessionId
} from "@solo-superman/contracts";
import {
  classifyResearchFollowUpAnswerShape,
  researchFollowUpAnswerOptions,
  researchFollowUpAnswerSelectionMode,
  researchFollowUpExpectedAnswerType
} from "./research-follow-up-answer-shape";

const researchTaskId = "research_task_answer_shape" as ResearchTaskId;
const sessionId = "session_answer_shape" as SessionId;

function task(objective: string): ResearchTaskProjection {
  return {
    researchTaskId,
    sessionId,
    objective,
    routeOutcome: "research_needed",
    impact: "medium",
    status: "evidence_ready",
    createdAt: "2026-05-24T00:00:00.000Z"
  };
}

function sourceQuestion(overrides: Partial<AmbiguityIssueSnapshot> = {}): AmbiguityIssueSnapshot {
  return {
    queueItemId: "queue_answer_shape_source" as QueueItemId,
    summary: "사용자가 직접 설명해야 하는 질문",
    uncertaintyType: "missing",
    severity: "medium",
    status: "open",
    questionText: "실제 상황을 설명해주세요.",
    expectedAnswerType: "text",
    ...overrides
  };
}

function evidenceMatrix(overrides: Partial<EvidenceMatrixProjection> = {}): EvidenceMatrixProjection {
  return {
    evidenceMatrixId: "evidence_matrix_answer_shape",
    researchTaskId,
    researchResultId: "research_result_answer_shape" as ResearchResultId,
    synthesisVersion: 1,
    proEvidence: [],
    conEvidence: [],
    uncertainties: [],
    additionalQuestions: [],
    balanceStatus: "source_quality_insufficient",
    decisionBlocked: false,
    ...overrides
  };
}

describe("research follow-up answer shape", () => {
  it("leaves descriptive follow-up questions as open text instead of forcing pro/con choices", () => {
    const input = {
      question: "고객이 이 문제를 겪는 상황을 본인 말로 설명해주세요.",
      researchTask: task("사용자가 겪는 실제 문제 맥락 확인"),
      sourceQuestion: sourceQuestion(),
      evidenceMatrix: evidenceMatrix()
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("open_text");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("text");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("single");
    expect(researchFollowUpAnswerOptions(input)).toEqual([]);
  });

  it("keeps evidence-backed descriptive prompts open text when they ask for a narrative answer", () => {
    const input = {
      question:
        "리서치 근거는 반복적인 수동 정리 피로이고 한계와 불확실성은 표본이 좁다는 점입니다.\n\n이 근거를 참고해 실제 사용자가 어떤 상황에서 이 문제를 겪는지 본인 말로 3~5문장으로 서술해주세요.",
      researchTask: task("사용자 문제 상황과 맥락 설명"),
      sourceQuestion: sourceQuestion({
        expectedAnswerType: "choice"
      }),
      evidenceMatrix: evidenceMatrix({
        proEvidence: [
          {
            evidenceItemId: "evidence_pro_open_answer_shape" as EvidenceItemId,
            kind: "pro",
            summary: "반복적인 수동 정리 피로"
          }
        ],
        uncertainties: [
          {
            evidenceItemId: "evidence_uncertainty_open_answer_shape" as EvidenceItemId,
            kind: "uncertainty",
            summary: "표본이 좁음"
          }
        ]
      })
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("open_text");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("text");
    expect(researchFollowUpAnswerOptions(input)).toEqual([]);
  });

  it("keeps evidence-balance questions as a single evidence judgment", () => {
    const input = {
      question:
        "첫 고객 세그먼트를 조금 더 구체화하기 위해 리서치 결과를 모아보니 찬성쪽 근거는 반복적인 수동 정리 피로입니다.\n\n한계와 불확실성은 반대 근거가 부족하다는 점입니다.\n\n어느 방향으로 판단하시겠습니까?",
      researchTask: task("첫 고객 세그먼트 근거 확인"),
      sourceQuestion: sourceQuestion({
        topicKey: "primary_customer_narrowing",
        expectedAnswerType: "choice"
      }),
      evidenceMatrix: evidenceMatrix({
        proEvidence: [
          {
            evidenceItemId: "evidence_pro_answer_shape" as EvidenceItemId,
            kind: "pro",
            summary: "반복적인 수동 정리 피로"
          }
        ],
        uncertainties: [
          {
            evidenceItemId: "evidence_uncertainty_answer_shape" as EvidenceItemId,
            kind: "uncertainty",
            summary: "반대 근거 부족"
          }
        ],
        balanceStatus: "missing_con_evidence",
        decisionBlocked: true
      })
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("evidence_judgment");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("evidence");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("single");
    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: expect.stringContaining("근거") })])
    );
  });

  it("supports one-of-many customer segment choices without treating them as evidence pro/con", () => {
    const input = {
      question: "고객 성향 후보는 혼자 만드는 창업자, 도메인 전문 1인 빌더, 팀 리더입니다. 어느 성향의 고객에 집중하시겠습니까?",
      researchTask: task("초기 고객 성향 후보 선택"),
      sourceQuestion: sourceQuestion({
        topicKey: "primary_customer_narrowing",
        expectedAnswerType: "choice"
      }),
      evidenceMatrix: evidenceMatrix()
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("single_choice");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("choice");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("single");
    expect(researchFollowUpAnswerOptions(input).length).toBeGreaterThanOrEqual(3);
  });

  it("keeps evidence-backed customer segment questions as one-of-many choices", () => {
    const input = {
      question:
        "고객 세그먼트가 너무 넓어 리서치 결과를 모아보니 찬성쪽 근거는 반복적인 수동 정리 피로입니다.\n\n한계와 불확실성은 조직형 고객 표본이 좁다는 점입니다.\n\n후보는 혼자 만드는 창업자, 도메인 전문 1인 빌더, 팀 리더입니다. 어느 성향의 고객에 집중하시겠습니까?",
      researchTask: task("첫 고객 세그먼트 후보 선택"),
      sourceQuestion: sourceQuestion({
        topicKey: "primary_customer_narrowing",
        expectedAnswerType: "choice"
      }),
      evidenceMatrix: evidenceMatrix({
        proEvidence: [
          {
            evidenceItemId: "evidence_pro_segment_answer_shape" as EvidenceItemId,
            kind: "pro",
            summary: "반복적인 수동 정리 피로"
          }
        ],
        uncertainties: [
          {
            evidenceItemId: "evidence_uncertainty_segment_answer_shape" as EvidenceItemId,
            kind: "uncertainty",
            summary: "조직형 고객 표본이 좁음"
          }
        ]
      })
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("single_choice");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("choice");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("single");
    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "solo_founders" }),
        expect.objectContaining({ id: "domain_expert_builders" })
      ])
    );
  });

  it("supports explicit agree/disagree questions without forcing every answer into evidence balance", () => {
    const input = {
      question:
        "리서치 근거를 보면 개인 창업자부터 시작하는 방향에 찬성/반대 중 어느 쪽인가요?",
      researchTask: task("초기 고객 선택 방향 찬반 결정"),
      sourceQuestion: sourceQuestion(),
      evidenceMatrix: evidenceMatrix({
        proEvidence: [
          {
            evidenceItemId: "evidence_pro_binary_answer_shape" as EvidenceItemId,
            kind: "pro",
            summary: "개인 창업자의 반복 업무 고통"
          }
        ],
        conEvidence: [
          {
            evidenceItemId: "evidence_con_binary_answer_shape" as EvidenceItemId,
            kind: "con",
            summary: "팀 리더의 예산 권한이 더 큼"
          }
        ]
      })
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("binary_choice");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("choice");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("single");
    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "agree_or_continue", label: expect.stringContaining("찬성") }),
        expect.objectContaining({ id: "disagree_or_stop", label: expect.stringContaining("반대") })
      ])
    );
  });

  it("supports multi-select follow-up questions when several options can be true together", () => {
    const input = {
      question: "이번 아이디어에 해당되는 고객 신호를 여러 개 선택해주세요.",
      researchTask: task("여러 고객 신호를 함께 확인"),
      sourceQuestion: sourceQuestion({
        topicKey: "primary_customer_narrowing",
        expectedAnswerType: "choice"
      }),
      evidenceMatrix: evidenceMatrix()
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("multi_select");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("choice");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("multiple");
    expect(researchFollowUpAnswerOptions(input).length).toBeGreaterThanOrEqual(3);
  });

  it("returns signal-specific options for multi-select signal questions", () => {
    const input = {
      question:
        "리서치 근거와 한계가 섞여 있으니 다음 인터뷰에서 확인할 고객 신호를 하나 혹은 여러 개 선택해주세요.",
      researchTask: task("고객 신호와 검증 기준 선택"),
      sourceQuestion: sourceQuestion(),
      evidenceMatrix: evidenceMatrix()
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("multi_select");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("multiple");
    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "repeat_manual_pain" }),
        expect.objectContaining({ id: "budget_or_paid_intent" })
      ])
    );
  });
});
