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
  GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
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

function generatedPetLifecycleQuestionSet() {
  return {
    schemaVersion: GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
    sourceSummary: "Pet lifecycle question fixture",
    questions: [
      {
        sectionRef: "Problem",
        topicKey: "problem_pain_intensity",
        uncertaintyType: "missing",
        severity: "high",
        summary: "보호자의 기록 문제 강도 미확인",
        whyItMatters: "문제 강도가 약하면 통합 관리 앱의 반복 사용 이유가 약해집니다.",
        questionText: "보호자가 병원 기록, 급여, 보험 서류를 찾느라 가장 자주 겪는 불편은 무엇인가요?",
        expectedAnswerType: "text",
        answerOptions: [],
        decisionItUnlocks: "첫 문제 서술과 성공 기준을 정합니다.",
        ambiguityDimension: "success_criteria",
        ambiguityRoutingPath: "current_research",
        researchQuestion:
          "동물병원, 펫보험, 보호자 커뮤니티, 장례·말기 케어에서 문제가 드물거나 기존 방식으로 충분히 해결되는 사례와 문제 빈도와 강도가 아직 측정되지 않음의 단서는 무엇인가?",
        possibleRoutes: ["question", "research_needed"],
        suggestedResearchTask:
          "동물병원, 펫보험, 보호자 커뮤니티, 장례·말기 케어 자료에서 기록 문제 근거를 찾고 반례와 남은 판단을 분리합니다."
      },
      {
        sectionRef: "Target Customer",
        topicKey: "primary_customer_narrowing",
        uncertaintyType: "vague",
        severity: "high",
        summary: "첫 보호자 유형이 넓음",
        whyItMatters: "보호자 유형이 넓으면 의료, 보험, 일상 기록 중 첫 가치가 흐려집니다.",
        questionText: "가장 먼저 테스트할 보호자 유형은 누구인가요?",
        expectedAnswerType: "choice",
        answerSelectionMode: "single",
        answerOptions: [
          { id: "first_pet_guardian", label: "첫 반려동물 보호자", value: "첫 반려동물 보호자를 우선한다.", primaryDetail: "초보 보호자 문제를 봅니다.", secondaryDetail: "노령 케어는 별도 확인합니다." },
          { id: "senior_pet_guardian", label: "노령·만성질환 보호자", value: "노령·만성질환 보호자를 우선한다.", primaryDetail: "의료 기록 문제를 봅니다.", secondaryDetail: "일상 기록은 별도 확인합니다." },
          { id: "multi_pet_guardian", label: "여러 마리 보호자", value: "여러 마리 보호자를 우선한다.", primaryDetail: "동물별 기록 구분 문제를 봅니다.", secondaryDetail: "한 마리 보호자는 별도 확인합니다." }
        ],
        decisionItUnlocks: "첫 고객 인터뷰 대상을 정합니다.",
        ambiguityDimension: "scope",
        ambiguityRoutingPath: "human_judgment",
        possibleRoutes: ["question", "decision_candidate"]
      },
      {
        sectionRef: "Current Alternatives",
        topicKey: "alternative_dissatisfaction_gap",
        uncertaintyType: "missing_con_evidence",
        severity: "high",
        summary: "대체재 불만족 근거 부족",
        whyItMatters: "기존 메모와 병원 앱이 충분하면 전환 이유가 약합니다.",
        questionText: "보호자는 메모, 사진첩, 병원 앱 중 어디서 충분하지 않다고 느끼나요?",
        expectedAnswerType: "evidence",
        answerSelectionMode: "single",
        answerOptions: [
          { id: "clinic_records", label: "병원 기록", value: "병원 기록 불만을 우선한다.", primaryDetail: "진료 전후 문제를 봅니다.", secondaryDetail: "일상 기록은 별도 확인합니다." },
          { id: "insurance_docs", label: "보험 청구 서류", value: "보험 서류 불만을 우선한다.", primaryDetail: "비용 문제를 봅니다.", secondaryDetail: "무보험 보호자는 별도 확인합니다." },
          { id: "daily_care", label: "일상 돌봄 기록", value: "일상 기록 불만을 우선한다.", primaryDetail: "반복 사용을 봅니다.", secondaryDetail: "의료 문제는 별도 확인합니다." }
        ],
        decisionItUnlocks: "첫 전환 이유를 정합니다.",
        ambiguityDimension: "assumption_pressure",
        ambiguityRoutingPath: "current_research",
        researchQuestion:
          "동물병원, 펫보험, 보호자 커뮤니티, 장례·말기 케어에서 대체재 만족/불만족 근거와 기존 대체재가 충분히 좋아서 전환하지 않는 반례는 무엇인가?",
        possibleRoutes: ["question", "research_needed", "missing_con_evidence"],
        suggestedResearchTask:
          "동물병원, 펫보험, 보호자 커뮤니티, 장례·말기 케어 자료에서 대체재 만족/불만족 근거를 찾고 기존 대체재가 충분히 좋아서 전환하지 않는 반례와 남은 판단을 분리합니다."
      }
    ]
  };
}

describe("deterministic ambiguity-reduction research targets", () => {
  it("turns generated business questions into context-fit source-seeking research tasks", () => {
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
      ["AnalyzeAmbiguity", {
        targetRef: "current_spec",
        generatedQuestionSet: generatedPetLifecycleQuestionSet()
      }]
    ]);

    const researchIssues = state.openIssues.filter((issue) => issue.possibleRoutes?.includes("research_needed"));
    expect(researchIssues.length).toBeGreaterThanOrEqual(2);

    for (const issue of researchIssues) {
      expect(issue.ambiguityDimension).toBeTruthy();
      expect(issue.ambiguityRoutingPath).toBe("current_research");
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
