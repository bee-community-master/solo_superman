import { describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  type AmbiguityIssueSnapshot,
  type CommandId,
  type CorrelationId,
  type ProductEngineCommand,
  type ProductEngineCommandType,
  type ProductEngineStateSnapshot,
  type ProjectId,
  type ProjectionVersion,
  type QueueItemId,
  type QueueItemProjection,
  type SessionId,
  type StateVersion
} from "@solo-superman/contracts";
import { createInitialProductEngineState, reduceProductEngineCommand } from "./index";

const projectId = "proj_follow_up_answer_variety" as ProjectId;
const sessionId = "sess_follow_up_answer_variety" as SessionId;
const issuedAt = "2026-05-25T00:00:00.000Z";

function sourceQueueItemId(repeatCount: number) {
  return `queue_follow_up_variety_source_${repeatCount}` as QueueItemId;
}

function command(
  commandType: ProductEngineCommandType,
  payload: ProductEngineCommand["payload"],
  expectedStateVersion: StateVersion = 5 as StateVersion
): ProductEngineCommand {
  return {
    commandId: `cmd_follow_up_answer_variety_${commandType}_${expectedStateVersion}` as CommandId,
    commandType,
    projectId,
    sessionId,
    actor: "user",
    issuedAt,
    idempotencyKey: `${commandType}:${expectedStateVersion}`,
    expectedStateVersion,
    causationId: null,
    correlationId: "corr_follow_up_answer_variety" as CorrelationId,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    payload
  };
}

function activeQuestionState(repeatCount: number): ProductEngineStateSnapshot {
  const base = createInitialProductEngineState(projectId, sessionId);
  const queueItemId = sourceQueueItemId(repeatCount);
  const issue: AmbiguityIssueSnapshot = {
    queueItemId,
    sectionRef: "Target Customer",
    topicKey: "primary_customer_narrowing",
    uncertaintyType: "decision_required",
    severity: "medium",
    summary: "답변 형태 다양화 확인",
    whyItMatters: "후속 질문은 질문 의도에 맞는 답변 방식으로 이어져야 합니다.",
    status: "open",
    questionText: "이전 답변을 더 구체화해주세요.",
    expectedAnswerType: "text",
    answerOptions: [],
    decisionItUnlocks: "다음 질문의 답변 형식을 잠급니다.",
    repeatCount,
    repeatLimit: 16,
    possibleRoutes: ["question", "research_needed"],
    sourceRef: "follow_up_answer_variety"
  };
  const activeItem: QueueItemProjection = {
    queueItemId,
    title: issue.questionText ?? issue.summary,
    state: "active",
    cardType: repeatCount > 0 ? "follow_up_question" : "question",
    sectionRef: "Target Customer",
    topicKey: "primary_customer_narrowing",
    severity: "medium",
    whyItMatters: "후속 질문은 질문 의도에 맞는 답변 방식으로 이어져야 합니다.",
    decisionItUnlocks: "다음 질문의 답변 형식을 잠급니다.",
    expectedAnswerType: "text",
    answerOptions: [],
    possibleRoutes: ["question", "research_needed"],
    sourceRef: "follow_up_answer_variety"
  };

  return {
    ...base,
    stateVersion: 5 as StateVersion,
    project: {
      ...base.project,
      projectPurposeMode: "business",
      projectPurposeModeSelectionStatus: "confirmed",
      projectPurposeModeLabel: "사업 검증",
      projectPurposeModeReason: "테스트에서 사용자 확인된 사업 목적입니다.",
      businessCriticIntensity: "balanced",
      businessCriticIntensitySelectionStatus: "confirmed",
      businessCriticIntensityLabel: "균형 검증",
      businessCriticIntensityEffect: "중요한 판단과 보완할 관점을 함께 확인합니다.",
      rawIdeaText: "답변 형태가 다양한 질문 UX"
    },
    session: {
      sessionId,
      phase: "question_loop"
    },
    openIssues: [issue],
    queueProjection: {
      ...base.queueProjection,
      version: 5 as ProjectionVersion,
      generatedAt: issuedAt,
      projectPurposeMode: "business",
      projectPurposeModeSelectionStatus: "confirmed",
      businessCriticIntensity: "balanced",
      businessCriticIntensitySelectionStatus: "confirmed",
      active: [activeItem],
      next: [],
      blocked: [],
      deferred: [],
      progress: {
        ...base.queueProjection.progress!,
        generatedQuestionCount: 1,
        openQuestionCount: 1,
        followUpQuestionCount: repeatCount > 0 ? 1 : 0,
        followUpOpenQuestionCount: repeatCount > 0 ? 1 : 0,
        followUpBudgetRemainingCount: 16 - repeatCount,
        topicCoverageCount: 1,
        openTopicCoverageCount: 1,
        visibleQuestionDebtCount: 1,
        activeQuestionCount: 1
      }
    }
  };
}

function submitAnswerAndReadFollowUp(repeatCount: number, researchRouteHint: "research_needed" | "missing_con_evidence" = "research_needed") {
  const reduction = reduceProductEngineCommand(
    command("SubmitAnswer", {
      queueItemId: sourceQueueItemId(repeatCount),
      answer: "첫 고객은 혼자 만드는 창업자입니다.",
      researchRouteHint,
      claimImpact: "medium"
    }),
    activeQuestionState(repeatCount)
  );

  expect(reduction.accepted).toBe(true);
  return reduction.events[0]?.payload.followUpIssue as AmbiguityIssueSnapshot;
}

describe("answer follow-up variety", () => {
  it("keeps open narrative follow-ups as text without suggested choices", () => {
    const followUp = submitAnswerAndReadFollowUp(0);

    expect(followUp.questionText).toContain("지금 어떤 방법");
    expect(followUp.summary).toBe("타깃 고객 판단을 한 단계 더 구체화합니다.");
    expect(followUp.decisionItUnlocks).toBe("타깃 고객 판단을 기획서 조각, 리서치 주제, 첫 작업 범위로 연결합니다.");
    expect(followUp.summary).not.toContain("이전 답변");
    expect(followUp.decisionItUnlocks).not.toContain("이 후속 답변");
    expect(followUp.nextValidationAction).not.toContain("기획 메모");
    expect(followUp.expectedAnswerType).toBe("text");
    expect(followUp.answerSelectionMode).toBeUndefined();
    expect(followUp.answerOptions).toEqual([]);
  });

  it("uses explicit proceed-or-hold choices only when the follow-up asks for a stance", () => {
    const followUp = submitAnswerAndReadFollowUp(2);

    expect(followUp.questionText).toContain("초보 사용자와 이미 문서가 있는 사용자");
    expect(followUp.expectedAnswerType).toBe("text");
    expect(followUp.answerSelectionMode).toBeUndefined();
    expect(followUp.answerOptions).toEqual([]);
  });

  it("keeps explicit proceed-or-hold choices when the follow-up asks for a stance", () => {
    const followUp = submitAnswerAndReadFollowUp(5);

    expect(followUp.questionText).toContain("그대로 진행할지");
    expect(followUp.expectedAnswerType).toBe("choice");
    expect(followUp.answerSelectionMode).toBe("single");
    expect(followUp.answerOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "진행 후보로 둔다" }),
        expect.objectContaining({ label: "보류하거나 좁힌다" }),
        expect.objectContaining({ label: "더 설명한 뒤 판단" })
      ])
    );
  });

  it("uses multi-select choices when several implementation-scope options can stay together", () => {
    const followUp = submitAnswerAndReadFollowUp(6);

    expect(followUp.questionText).toContain("첫 버전에 꼭 넣을 것");
    expect(followUp.expectedAnswerType).toBe("choice");
    expect(followUp.answerSelectionMode).toBe("multiple");
    expect(followUp.answerOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "핵심 흐름 하나만 포함" }),
        expect.objectContaining({ label: "수동 운영 + 얇은 UI" }),
        expect.objectContaining({ label: "포함보다 제외 먼저 결정" })
      ])
    );
  });

  it("rotates in one-of-many follow-ups instead of only text, stance, or multi-select prompts", () => {
    const followUp = submitAnswerAndReadFollowUp(1);

    expect(followUp.questionText).toContain("기획서 조각");
    expect(followUp.expectedAnswerType).toBe("text");
    expect(followUp.answerSelectionMode).toBeUndefined();
    expect(followUp.answerOptions).toEqual([]);
  });

  it("rotates in one-of-many follow-ups after initial planning-detail questions", () => {
    const followUp = submitAnswerAndReadFollowUp(4);

    expect(followUp.questionText).toContain("다음에 하나만 정한다면");
    expect(followUp.expectedAnswerType).toBe("choice");
    expect(followUp.answerSelectionMode).toBe("single");
    expect(followUp.answerOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "고객 기준 먼저 확정" }),
        expect.objectContaining({ label: "문제/가치 기준 먼저 확정" }),
        expect.objectContaining({ label: "검증 방법 먼저 확정" }),
        expect.objectContaining({ label: "구현 범위 먼저 확정" })
      ])
    );
    expect(followUp.answerOptions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ label: expect.stringContaining("찬성") })])
    );
  });

  it("keeps missing-counter-evidence follow-ups as a planning-detail question before later risk checks", () => {
    const followUp = submitAnswerAndReadFollowUp(0, "missing_con_evidence");

    expect(followUp.questionText).toContain("기존 방법으로도 충분");
    expect(followUp.expectedAnswerType).toBe("text");
    expect(followUp.answerSelectionMode).toBeUndefined();
    expect(followUp.answerOptions).toEqual([]);
  });
});
