import { describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  type CommandId,
  type CorrelationId,
  type EventId,
  type ProductEngineStateSnapshot,
  type ProjectId,
  type SessionId,
  type StateVersion
} from "@solo-superman/contracts";
import {
  createInitialProductEngineState,
  reduceProductEngineCommand,
  replayProductEngineEvents
} from "./index";

const projectId = "proj_ambiguity_reduction_algorithm" as ProjectId;
const sessionId = "sess_ambiguity_reduction_algorithm" as SessionId;
const correlationId = "corr_ambiguity_reduction_algorithm" as CorrelationId;

type ReplayEvent = Parameters<typeof replayProductEngineEvents>[2][number];
type ProductEngineCommandInput = Parameters<typeof reduceProductEngineCommand>[0];

function command(
  commandType: ProductEngineCommandInput["commandType"],
  expectedStateVersion: StateVersion,
  payload: Readonly<Record<string, unknown>>,
  index: number
): ProductEngineCommandInput {
  return {
    commandId: `cmd_ambiguity_reduction_algorithm_${index}` as CommandId,
    commandType,
    projectId,
    sessionId,
    actor: "user",
    issuedAt: `2026-05-26T00:00:0${index}.000Z`,
    idempotencyKey: `${commandType}:${index}`,
    expectedStateVersion,
    causationId: index === 1 ? null : (`cmd_ambiguity_reduction_algorithm_${index - 1}` as CommandId),
    correlationId,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    payload
  } as ProductEngineCommandInput;
}

function eventForReplay(
  event: NonNullable<ReturnType<typeof reduceProductEngineCommand>["events"][number]>,
  sequence: number
): ReplayEvent {
  return {
    ...event,
    eventId: `evt_ambiguity_reduction_algorithm_${sequence}` as EventId,
    sequence,
    occurredAt: `2026-05-26T00:00:0${sequence}.000Z`
  };
}

function runCommandSequence(commands: readonly [ProductEngineCommandInput["commandType"], Readonly<Record<string, unknown>>][]) {
  let state: ProductEngineStateSnapshot = createInitialProductEngineState(projectId, sessionId);
  const events: ReplayEvent[] = [];

  commands.forEach(([commandType, payload], index) => {
    const reduction = reduceProductEngineCommand(
      command(commandType, state.stateVersion, payload, index + 1),
      state
    );

    expect(reduction.accepted).toBe(true);
    const event = reduction.events[0];

    if (!event) {
      throw new Error(`Expected ${commandType} to emit an event.`);
    }

    events.push(eventForReplay(event, events.length + 1));
    state = replayProductEngineEvents(projectId, sessionId, events);
  });

  return state;
}

describe("deterministic ambiguity-reduction research targets", () => {
  it("turns fallback business questions into context-fit source-seeking research tasks", () => {
    const state = runCommandSequence([
      [
        "StartProject",
        {
          rawIdea: "반려동물 전생애주기의 의료, 급여, 일상, 보험, 장례 정보를 한 곳에서 관리하는 앱",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed",
          businessCriticIntensity: "balanced",
          businessCriticIntensityConfirmation: "user_confirmed",
          initialResearchAutomationPermission: "allow_codex_and_chatgpt_visible"
        }
      ],
      [
        "CaptureIntake",
        {
          answer: "초기에는 보호자가 기록을 잃어버리거나 보험 청구 자료를 다시 모으는 문제를 검증하고 싶다."
        }
      ],
      ["DraftInitialSpec", {}],
      ["AnalyzeAmbiguity", { targetRef: "current_spec" }]
    ]);

    const researchIssues = state.openIssues.filter((issue) => issue.possibleRoutes?.includes("research_needed"));
    expect(researchIssues.length).toBeGreaterThanOrEqual(5);

    for (const issue of researchIssues) {
      expect(issue.ambiguityDimension).toBeTruthy();
      expect(issue.ambiguityRoutingPath).toBe("current_research");
      expect(issue.researchQuestion).toEqual(expect.stringContaining("확인 가능한 사실과 사용자가 정해야 할"));
      expect(issue.researchQuestion).toMatch(/동물병원|펫보험|보호자 커뮤니티|장례·말기 케어/u);
    }

    const painIssue = researchIssues.find((issue) => issue.topicKey === "problem_pain_intensity");
    expect(painIssue?.researchQuestion).toContain("문제가 드물거나 기존 방식으로 충분히 해결");
    expect(painIssue?.researchQuestion).toContain("문제 빈도와 강도가 아직 측정되지 않음");

    const alternativesIssue = researchIssues.find((issue) => issue.topicKey === "alternative_dissatisfaction_gap");
    expect(alternativesIssue?.suggestedResearchTask).toContain("대체재 만족/불만족 근거");
    expect(alternativesIssue?.suggestedResearchTask).toContain("기존 대체재가 충분히 좋아서");
    expect(alternativesIssue?.suggestedResearchTask).toMatch(/동물병원|펫보험|보호자 커뮤니티|장례·말기 케어/u);
    expect(alternativesIssue?.suggestedResearchTask).not.toBe("대체재 만족/불만족 근거를 균형 있게 수집합니다.");
  });
});
