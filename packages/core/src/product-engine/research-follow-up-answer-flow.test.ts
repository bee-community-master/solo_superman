import { describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  type CommandId,
  type CorrelationId,
  type EventId,
  type ProductEngineStateSnapshot,
  type ProjectId,
  type QueueItemProjection,
  type ResearchResultId,
  type SessionId,
  type StateVersion
} from "@solo-superman/contracts";
import {
  createInitialProductEngineState,
  reduceProductEngineCommand,
  replayProductEngineEvents
} from "./index";

const projectId = "proj_research_follow_up_answer_flow" as ProjectId;
const sessionId = "sess_research_follow_up_answer_flow" as SessionId;
const correlationId = "corr_research_follow_up_answer_flow" as CorrelationId;
type ReplayEvent = Parameters<typeof replayProductEngineEvents>[2][number];

function command(
  commandType: Parameters<typeof reduceProductEngineCommand>[0]["commandType"],
  expectedStateVersion: number,
  payload: Readonly<Record<string, unknown>>,
  index: number,
  actor: "user" | "effect_executor" = "user"
) {
  return {
    commandId: `cmd_research_follow_up_answer_flow_${index}` as CommandId,
    commandType,
    projectId,
    sessionId,
    actor,
    issuedAt: `2026-05-25T00:00:0${index}.000Z`,
    idempotencyKey: `${commandType}:${index}`,
    expectedStateVersion: expectedStateVersion as StateVersion,
    causationId: index === 1 ? null : (`cmd_research_follow_up_answer_flow_${index - 1}` as CommandId),
    correlationId,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    payload
  } as const;
}

function withConfirmedBusinessPurposeMode(state: ProductEngineStateSnapshot): ProductEngineStateSnapshot {
  return {
    ...state,
    project: {
      ...state.project,
      projectPurposeMode: "business",
      projectPurposeModeSelectionStatus: "confirmed",
      projectPurposeModeLabel: "사업화 검증 중심",
      projectPurposeModeReason: "Test fixture confirms business purpose mode.",
      businessCriticIntensity: "balanced",
      businessCriticIntensitySelectionStatus: "confirmed",
      businessCriticIntensityLabel: "균형형 사업 검증",
      businessCriticIntensityEffect: "주요 decision group마다 최소 1개의 반대/비판 질문을 유지합니다.",
      businessCriticIntensityAudit: []
    }
  };
}

function eventForReplay(event: NonNullable<ReturnType<typeof reduceProductEngineCommand>["events"][number]>, sequence: number): ReplayEvent {
  return {
    ...event,
    eventId: `evt_research_follow_up_answer_flow_${sequence}` as EventId,
    sequence,
    occurredAt: `2026-05-25T00:00:0${sequence}.000Z`
  };
}

function firstEvent(reduction: ReturnType<typeof reduceProductEngineCommand>) {
  const event = reduction.events[0];

  if (!event) {
    throw new Error("Expected reducer to emit one event.");
  }

  return event;
}

function synthesizeResearchFollowUp(input: {
  readonly objective: string;
  readonly result: string;
  readonly limitationNotes: string;
}) {
  const initialState = withConfirmedBusinessPurposeMode(createInitialProductEngineState(projectId, sessionId));
  const planned = reduceProductEngineCommand(
    command("PlanResearch", 0, {
      objective: input.objective,
      routeOutcome: "missing_con_evidence",
      impact: "high"
    }, 1),
    initialState
  );

  expect(planned.accepted).toBe(true);

  const plannedEvent = firstEvent(planned);
  const plannedState = replayProductEngineEvents(projectId, sessionId, [eventForReplay(plannedEvent, 1)]);
  const researchTaskId = plannedState.researchState.taskIds[0];

  if (!researchTaskId) {
    throw new Error("Expected PlanResearch to create a research task id.");
  }

  const imported = reduceProductEngineCommand(
    command("ImportResearchResult", 1, {
      researchTaskId,
      sourceTitle: "Research answer-flow evidence notes",
      result: input.result,
      limitationNotes: input.limitationNotes
    }, 2),
    plannedState
  );

  expect(imported.accepted).toBe(true);

  const importedState = replayProductEngineEvents(projectId, sessionId, [
    eventForReplay(plannedEvent, 1),
    eventForReplay(firstEvent(imported), 2)
  ]);
  const researchResultId = importedState.researchState.results[0]?.researchResultId as ResearchResultId | undefined;

  if (!researchResultId) {
    throw new Error("Expected ImportResearchResult to persist a research result id.");
  }

  const synthesized = reduceProductEngineCommand(
    command("SynthesizeEvidence", 2, { researchResultId }, 3, "effect_executor"),
    importedState
  );

  expect(synthesized.accepted).toBe(true);

  const synthesizedState = synthesized.nextState as unknown as ProductEngineStateSnapshot;
  const followUpIssue = synthesizedState.openIssues.find((issue) =>
    issue.queueItemId.startsWith("queue_research_followup_")
  );
  const activeQueueItem = synthesizedState.queueProjection.active.find((item: QueueItemProjection) =>
    item.queueItemId.startsWith("queue_research_followup_")
  );

  return { followUpIssue, activeQueueItem };
}

describe("research follow-up answer flow", () => {
  it("keeps open questions as descriptive answers without suggested choices", () => {
    const { activeQueueItem, followUpIssue } = synthesizeResearchFollowUp({
      objective: "open question으로 실제 사용자 맥락을 주관식 서술형 답변으로 요구",
      result: "Pro: users repeatedly describe manual coordination pain.",
      limitationNotes: "The sample remains narrow and needs direct user context."
    });

    expect(followUpIssue).toMatchObject({
      expectedAnswerType: "text",
      questionText: expect.stringContaining("본인 말로 3~5문장으로 서술")
    });
    expect(followUpIssue?.answerSelectionMode).toBeUndefined();
    expect(followUpIssue?.answerOptions).toEqual([]);
    expect(followUpIssue?.questionText).not.toContain("찬성/반대 중 어느 쪽");
    expect(activeQueueItem).toMatchObject({
      expectedAnswerType: "text",
      answerOptions: []
    });
  });

  it("keeps explicit agree-disagree customer-topic questions as binary choices", () => {
    const { activeQueueItem, followUpIssue } = synthesizeResearchFollowUp({
      objective: "초기 고객 세그먼트 방향을 유지할지 말지 객관식으로 찬성/반대 중 하나를 선택",
      result: "Pro: individual founders mention repeated planning pain.",
      limitationNotes: "Counter-evidence for broader teams has not been reviewed broadly."
    });

    expect(followUpIssue).toMatchObject({
      expectedAnswerType: "choice",
      answerSelectionMode: "single",
      questionText: expect.stringContaining("찬성/반대 중 어느 쪽")
    });
    expect(followUpIssue?.questionText).not.toContain("어느 성향의 고객에 집중");
    expect(followUpIssue?.answerOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "agree_or_continue", label: "찬성 / 진행" }),
        expect.objectContaining({ id: "disagree_or_stop", label: "반대 / 보류" })
      ])
    );
    expect(activeQueueItem).toMatchObject({
      expectedAnswerType: "choice",
      answerSelectionMode: "single",
      answerOptions: expect.arrayContaining([
        expect.objectContaining({ label: "찬성 / 진행" }),
        expect.objectContaining({ label: "반대 / 보류" })
      ])
    });
  });

  it("keeps answer-form policy follow-ups open instead of generating bogus choices", () => {
    const { activeQueueItem, followUpIssue } = synthesizeResearchFollowUp({
      objective:
        "모든 내용이 찬성과 반대가 되는 게 아니라 객관식으로 찬성/반대를 할 수도 있고, 여러 종류 중 하나 혹은 여러 개를 선택해야 할 수도 있습니다. 답변을 다양하게 필요에 맞게 구성",
      result: "Pro: different question types need different input formats.",
      limitationNotes: "The exact answer form should follow the concrete question intent."
    });

    expect(followUpIssue).toMatchObject({
      expectedAnswerType: "text",
      questionText: expect.stringContaining("질문마다 답변 형식을 달리")
    });
    expect(followUpIssue?.answerSelectionMode).toBeUndefined();
    expect(followUpIssue?.answerOptions).toEqual([]);
    expect(followUpIssue?.questionText).not.toContain("찬성/반대 중 어느 쪽");
    expect(followUpIssue?.questionText).not.toContain("하나 이상 선택");
    expect(activeQueueItem).toMatchObject({
      expectedAnswerType: "text",
      answerOptions: []
    });
  });
});
