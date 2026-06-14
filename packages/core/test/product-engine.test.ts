import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  CANONICAL_INITIAL_SPEC_SECTIONS,
  type BusinessCriticIntensity,
  type BusinessCriticPressureKind,
  type CommandId,
  type CorrelationId,
  type DecisionQueueProjection,
  type EventId,
  type ProductEngineStateSnapshot,
  type ProjectionVersion,
  type ProjectId,
  type QueueItemId,
  type SessionId,
  type StateVersion
} from "@solo-superman/contracts";
import {
  GENERATED_AMBIGUITY_QUESTION_PROMPT_TEMPLATE_REF,
  GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
  createInitialProductEngineState,
  decisionQueueProjectionWithRecovery,
  reduceProductEngineCommand,
  replayProductEngineEvents,
  sessionPhaseForProductEngineEvent,
  sessionShellPhaseForProductEnginePhase
} from "../src/product-engine";

const projectId = "proj_product_engine_test" as ProjectId;
const sessionId = "sess_product_engine_test" as SessionId;
const correlationId = "corr_product_engine_test" as CorrelationId;
const canonicalInitialSpecSectionSet = new Set<string>(CANONICAL_INITIAL_SPEC_SECTIONS);
const docsRequiredAmbiguityTopicKeys = [
  "primary_customer_narrowing",
  "buyer_user_split",
  "payment_hesitation_reason",
  "problem_pain_intensity",
  "value_prop_switching_reason",
  "alternative_dissatisfaction_gap",
  "mvp_validation_scope",
  "non_goal_boundaries",
  "success_metric_measurability",
  "first_validation_experiment",
  "acquisition_channel_realism",
  "implementation_resource_fit",
  "operational_risk_boundary",
  "founder_advantage"
] as const;

function command(
  commandType: Parameters<typeof reduceProductEngineCommand>[0]["commandType"],
  expectedStateVersion: number,
  payload: Readonly<Record<string, unknown>>,
  index: number
) {
  return {
    commandId: `cmd_product_engine_${index}` as CommandId,
    commandType,
    projectId,
    sessionId,
    actor: "user",
    issuedAt: `2026-05-05T00:00:0${index}.000Z`,
    idempotencyKey: `${commandType}:${index}`,
    expectedStateVersion: expectedStateVersion as StateVersion,
    causationId: index === 1 ? null : (`cmd_product_engine_${index - 1}` as CommandId),
    correlationId,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    payload
  } as const;
}

function generatedOption(id: string, label: string) {
  return {
    id,
    label,
    value: `${label}을 우선 선택한다.`,
    primaryDetail: `${label} 기준으로 첫 판단을 좁힙니다.`,
    secondaryDetail: "다른 후보와 반례는 계속 확인합니다."
  };
}

function generatedQuestion(input: {
  readonly sectionRef: string;
  readonly topicKey: string;
  readonly uncertaintyType?: string;
  readonly severity?: string;
  readonly summary: string;
  readonly questionText: string;
  readonly expectedAnswerType?: "choice" | "text" | "rank" | "evidence" | "experiment";
  readonly ambiguityDimension?: string;
  readonly ambiguityRoutingPath?: "human_judgment" | "existing_fact_check" | "current_research";
  readonly businessCriticIntensityMinimum?: BusinessCriticIntensity;
  readonly businessCriticPressureKind?: BusinessCriticPressureKind;
  readonly possibleRoutes?: readonly string[];
  readonly answerOptions?: readonly ReturnType<typeof generatedOption>[];
}) {
  const expectedAnswerType = input.expectedAnswerType ?? "text";
  const ambiguityRoutingPath = input.ambiguityRoutingPath ?? "human_judgment";
  const possibleRoutes = input.possibleRoutes ?? (
    ambiguityRoutingPath === "current_research" ? ["question", "research_needed"] : ["question", "decision_candidate"]
  );

  return {
    sectionRef: input.sectionRef,
    topicKey: input.topicKey,
    uncertaintyType: input.uncertaintyType ?? "missing",
    severity: input.severity ?? "high",
    summary: input.summary,
    whyItMatters: `${input.summary}이면 founder product spec과 customer interview 판단이 흔들립니다.`,
    questionText: input.questionText,
    expectedAnswerType,
    ...(expectedAnswerType === "choice" ? { answerSelectionMode: "single" } : {}),
    ...(expectedAnswerType === "rank" ? { answerSelectionMode: "ranked" } : {}),
    ...(expectedAnswerType !== "text"
      ? {
          answerOptions: input.answerOptions ?? [
            generatedOption(`${input.topicKey}_a`, "창업자 고객 인터뷰"),
            generatedOption(`${input.topicKey}_b`, "제품 스펙 범위"),
            generatedOption(`${input.topicKey}_c`, "Founder Brief 반복 사용 근거")
          ]
        }
      : { answerOptions: [] }),
    decisionItUnlocks: `${input.summary}에 대한 founder product spec 결정을 엽니다.`,
    ambiguityDimension: input.ambiguityDimension ?? "scope",
    ambiguityRoutingPath,
    ...(input.businessCriticIntensityMinimum ? { businessCriticIntensityMinimum: input.businessCriticIntensityMinimum } : {}),
    ...(input.businessCriticPressureKind ? { businessCriticPressureKind: input.businessCriticPressureKind } : {}),
    ...(ambiguityRoutingPath === "current_research"
      ? {
          researchQuestion: `${input.summary}에 대해 founder product spec 공개 사례와 반례는 무엇인가?`,
          suggestedResearchTask:
            `창업자 커뮤니티, 제품 스펙 사례, 고객 인터뷰 글에서 ${input.summary} 공개 단서를 찾고, ` +
            "그 가정을 약하게 만드는 반례와 남은 판단을 분리합니다."
        }
      : {}),
    possibleRoutes
  };
}

function generatedBusinessQuestionSet(
  intensity: BusinessCriticIntensity = "balanced"
) {
  const baseQuestions = [
    generatedQuestion({
      sectionRef: "Problem",
      topicKey: "problem_pain_intensity",
      summary: "창업자 고객 인터뷰 문제 강도 미확인",
      questionText: "창업자가 제품 스펙을 만들기 전 가장 자주 막히는 고객 인터뷰 문제는 무엇인가요?",
      ambiguityDimension: "success_criteria",
      ambiguityRoutingPath: "current_research"
    }),
    generatedQuestion({
      sectionRef: "Target Customer",
      topicKey: "primary_customer_narrowing",
      uncertaintyType: "vague",
      summary: "첫 창업자 고객군이 넓음",
      questionText: "Founder Brief 제품 스펙을 가장 먼저 검증할 창업자 고객군은 누구인가요?",
      expectedAnswerType: "choice",
      answerOptions: [
        generatedOption("paid_interview_founder", "유료 인터뷰를 준비하는 1인 창업자"),
        generatedOption("spec_drafting_founder", "제품 스펙 초안을 만드는 창업자"),
        generatedOption("evidence_tracking_founder", "근거 추적이 필요한 창업자")
      ]
    }),
    generatedQuestion({
      sectionRef: "MVP Scope",
      topicKey: "mvp_validation_scope",
      summary: "첫 제품 스펙 범위가 넓음",
      questionText: "Founder Brief 첫 버전에서 반드시 검증할 제품 스펙 기능은 무엇인가요?",
      expectedAnswerType: "choice",
      possibleRoutes: ["question", "decision_candidate", "deferred"]
    }),
    generatedQuestion({
      sectionRef: "Current Alternatives",
      topicKey: "alternative_dissatisfaction_gap",
      uncertaintyType: "missing_con_evidence",
      summary: "현재 대체재 불만족 근거 부족",
      questionText: "창업자는 현재 어떤 방식으로 제품 스펙을 만들고 어디서 충분하지 않다고 느끼나요?",
      expectedAnswerType: "evidence",
      ambiguityRoutingPath: "current_research",
      possibleRoutes: ["research_needed", "missing_con_evidence"]
    }),
    generatedQuestion({
      sectionRef: "Target Customer",
      topicKey: "buyer_user_split",
      summary: "구매자와 사용자 분리 미확인",
      questionText: "Founder Brief를 실제로 쓰는 창업자와 비용을 승인하는 사람은 같은가요?",
      expectedAnswerType: "choice"
    }),
    generatedQuestion({
      sectionRef: "Value Proposition",
      topicKey: "payment_hesitation_reason",
      uncertaintyType: "missing_con_evidence",
      summary: "돈을 내기 망설일 이유 미확인",
      questionText: "창업자가 Founder Brief에 돈을 내기 망설일 가장 큰 이유는 무엇인가요?",
      expectedAnswerType: "experiment",
      ambiguityDimension: "assumption_pressure",
      possibleRoutes: ["question", "missing_con_evidence", "deferred"]
    }),
    generatedQuestion({
      sectionRef: "Validation Plan",
      topicKey: "first_validation_experiment",
      summary: "첫 검증 행동 미정",
      questionText: "이번 주 어떤 창업자에게 Founder Brief 결과를 보여주고 반응을 확인할까요?",
      expectedAnswerType: "experiment",
      ambiguityRoutingPath: "current_research"
    }),
    generatedQuestion({
      sectionRef: "Success Criteria",
      topicKey: "success_metric_measurability",
      uncertaintyType: "vague",
      summary: "반복 사용 신호 미정",
      questionText: "창업자가 Founder Brief를 다시 쓴다고 볼 수 있는 쉬운 행동 신호는 무엇인가요?"
    }),
    generatedQuestion({
      sectionRef: "Value Proposition",
      topicKey: "value_prop_switching_reason",
      uncertaintyType: "decision_required",
      summary: "대체재 전환 이유 미정",
      questionText: "창업자가 기존 노트와 문서 대신 Founder Brief로 옮겨올 이유는 무엇인가요?",
      expectedAnswerType: "rank",
      ambiguityDimension: "assumption_pressure"
    }),
    generatedQuestion({
      sectionRef: "Evidence Status",
      topicKey: "evidence_balance",
      uncertaintyType: "unsupported",
      severity: "medium",
      summary: "핵심 주장 근거 균형 부족",
      questionText: "Founder Brief 핵심 주장을 뒷받침하는 단서와 반례 중 무엇이 비어 있나요?",
      expectedAnswerType: "evidence",
      ambiguityRoutingPath: "current_research",
      possibleRoutes: ["research_needed", "missing_con_evidence"]
    }),
    generatedQuestion({
      sectionRef: "Non-goals",
      topicKey: "non_goal_boundaries",
      uncertaintyType: "decision_required",
      severity: "medium",
      summary: "이번 버전 제외 범위 미정",
      questionText: "Founder Brief 첫 버전에서 의도적으로 만들지 않을 범위는 무엇인가요?",
      expectedAnswerType: "choice",
      possibleRoutes: ["question", "deferred", "decision_candidate"]
    }),
    generatedQuestion({
      sectionRef: "Validation Plan",
      topicKey: "acquisition_channel_realism",
      uncertaintyType: "unsupported",
      severity: "medium",
      summary: "첫 창업자 모집 채널 근거 부족",
      questionText: "Founder Brief를 테스트할 창업자를 어디서 현실적으로 모집할 수 있나요?",
      expectedAnswerType: "evidence",
      ambiguityRoutingPath: "current_research",
      possibleRoutes: ["research_needed", "spec_update_candidate"]
    }),
    generatedQuestion({
      sectionRef: "MVP Scope",
      topicKey: "implementation_resource_fit",
      uncertaintyType: "unsupported",
      severity: "medium",
      summary: "첫 구현 범위 적합성 미확인",
      questionText: "현재 리소스로 Founder Brief 첫 제품 스펙 기능을 구현할 수 있나요?"
    }),
    generatedQuestion({
      sectionRef: "Differentiation",
      topicKey: "founder_advantage",
      uncertaintyType: "unsupported",
      severity: "medium",
      summary: "창업자 대상 차별화 근거 부족",
      questionText: "이 제품이 창업자 제품 스펙 문제를 더 잘 풀 수 있는 근거는 무엇인가요?",
      expectedAnswerType: "evidence",
      ambiguityRoutingPath: "current_research",
      possibleRoutes: ["research_needed", "spec_update_candidate"]
    }),
    generatedQuestion({
      sectionRef: "JTBD / Use Case",
      topicKey: "job_context_specificity",
      uncertaintyType: "vague",
      severity: "medium",
      summary: "창업자 사용 맥락 부족",
      questionText: "창업자는 어떤 상황에서 Founder Brief 제품 스펙을 써야 하나요?"
    }),
    generatedQuestion({
      sectionRef: "Known Risks / Open Questions",
      topicKey: "operational_risk_boundary",
      severity: "low",
      summary: "운영 리스크 경계 미정",
      questionText: "Founder Brief에 남겨야 할 보안, 법률, 운영 리스크는 무엇인가요?",
      possibleRoutes: ["question", "deferred", "repeat_limit_reached"]
    })
  ];
  const strongQuestions = [
    generatedQuestion({
      sectionRef: "Value Proposition",
      topicKey: "strong_paid_intent_core_assumption",
      uncertaintyType: "missing_con_evidence",
      summary: "돈을 낼 핵심 가정 반례 미확인",
      questionText: "창업자가 Founder Brief에 돈을 내지 않을 가장 위험한 이유는 무엇인가요?",
      expectedAnswerType: "experiment",
      ambiguityDimension: "assumption_pressure",
      businessCriticIntensityMinimum: "strong",
      businessCriticPressureKind: "core_assumption_challenge",
      possibleRoutes: ["question", "missing_con_evidence", "deferred", "repeat_limit_reached"]
    }),
    generatedQuestion({
      sectionRef: "Problem",
      topicKey: "strong_customer_pain_frequency",
      summary: "문제 빈도 핵심 가정 미확인",
      questionText: "창업자가 제품 스펙 문제를 충분히 자주 겪지 않는다면 어떤 신호가 보일까요?",
      ambiguityDimension: "assumption_pressure",
      businessCriticIntensityMinimum: "strong",
      businessCriticPressureKind: "core_assumption_challenge"
    }),
    generatedQuestion({
      sectionRef: "Validation Plan",
      topicKey: "strong_acquisition_channel_failure",
      uncertaintyType: "unsupported",
      summary: "획득 채널 실패 가정 미확인",
      questionText: "Founder Brief 첫 창업자 모집 채널이 실패한다면 가장 가능성 높은 원인은 무엇인가요?",
      expectedAnswerType: "evidence",
      ambiguityRoutingPath: "current_research",
      businessCriticIntensityMinimum: "strong",
      businessCriticPressureKind: "core_assumption_challenge"
    })
  ];
  const investorQuestions = [
    generatedQuestion({
      sectionRef: "Value Proposition",
      topicKey: "investor_pricing_pressure",
      uncertaintyType: "missing_con_evidence",
      summary: "가격 압박 근거 부족",
      questionText: "Founder Brief에서 어떤 가격을 보여주면 창업자가 망설일까요?",
      expectedAnswerType: "experiment",
      ambiguityDimension: "assumption_pressure",
      businessCriticIntensityMinimum: "investor_grade",
      businessCriticPressureKind: "investor_pressure_pass",
      possibleRoutes: ["question", "missing_con_evidence", "deferred", "repeat_limit_reached"]
    }),
    generatedQuestion({
      sectionRef: "Validation Plan",
      topicKey: "investor_retention_proxy_pressure",
      summary: "반복 사용 압박 근거 부족",
      questionText: "Founder Brief를 다시 쓰는 행동을 어떤 신호로 볼 수 있나요?",
      businessCriticIntensityMinimum: "investor_grade",
      businessCriticPressureKind: "investor_pressure_pass"
    }),
    generatedQuestion({
      sectionRef: "Known Risks / Open Questions",
      topicKey: "investor_market_timing_pressure",
      uncertaintyType: "unsupported",
      summary: "시장 타이밍 압박 근거 부족",
      questionText: "왜 지금 창업자 제품 스펙 문제가 더 급해졌나요?",
      expectedAnswerType: "evidence",
      ambiguityRoutingPath: "current_research",
      businessCriticIntensityMinimum: "investor_grade",
      businessCriticPressureKind: "investor_pressure_pass",
      possibleRoutes: ["question", "research_needed", "deferred", "repeat_limit_reached"]
    }),
    generatedQuestion({
      sectionRef: "Known Risks / Open Questions",
      topicKey: "investor_legal_ops_pressure",
      summary: "법무 운영 압박 미확인",
      questionText: "Founder Brief 판매나 운영을 먼저 막을 수 있는 문제는 무엇인가요?",
      businessCriticIntensityMinimum: "investor_grade",
      businessCriticPressureKind: "investor_pressure_pass",
      possibleRoutes: ["question", "deferred", "repeat_limit_reached"]
    }),
    generatedQuestion({
      sectionRef: "Differentiation",
      topicKey: "investor_founder_advantage_pressure",
      uncertaintyType: "unsupported",
      summary: "차별화 압박 근거 부족",
      questionText: "왜 이 팀이 창업자 제품 스펙 문제를 더 잘 풀 수 있나요?",
      expectedAnswerType: "evidence",
      ambiguityRoutingPath: "current_research",
      businessCriticIntensityMinimum: "investor_grade",
      businessCriticPressureKind: "investor_pressure_pass",
      possibleRoutes: ["question", "research_needed", "deferred", "repeat_limit_reached"]
    })
  ];

  return {
    schemaVersion: GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
    sourceSummary: "Founder product spec workflow",
    questions: [
      ...baseQuestions,
      ...(intensity === "strong" || intensity === "investor_grade" ? strongQuestions : []),
      ...(intensity === "investor_grade" ? investorQuestions : [])
    ]
  };
}

function generatedPersonalQuestionSet() {
  return {
    schemaVersion: GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
    sourceSummary: "Personal local workflow helper",
    questions: [
      generatedQuestion({
        sectionRef: "JTBD / Use Case",
        topicKey: "personal_workflow_context",
        summary: "개인 workflow 맥락 부족",
        questionText: "개인 local workflow는 어떤 순서로 진행되나요?"
      }),
      generatedQuestion({
        sectionRef: "JTBD / Use Case",
        topicKey: "personal_usage_frequency",
        uncertaintyType: "missing_con_evidence",
        summary: "개인 workflow 빈도 미확인",
        questionText: "이 개인 local workflow는 얼마나 자주 반복되나요?",
        ambiguityDimension: "assumption_pressure"
      }),
      generatedQuestion({
        sectionRef: "MVP Scope",
        topicKey: "personal_gui_fit",
        summary: "개인 도구 UI 범위 미정",
        questionText: "개인 workflow 첫 버전은 GUI가 필요한가요, 아니면 로컬 화면으로 충분한가요?",
        expectedAnswerType: "choice",
        answerOptions: [
          generatedOption("local_workflow_screen", "local workflow 전용 로컬 화면"),
          generatedOption("local_workflow_command", "local workflow 명령어 실행"),
          generatedOption("local_workflow_checklist", "local workflow 문서 체크리스트")
        ]
      }),
      generatedQuestion({
        sectionRef: "MVP Scope",
        topicKey: "personal_implementation_feasibility",
        summary: "개인 도구 구현 가능성 미확인",
        questionText: "현재 시간과 기술로 가장 작게 만들 수 있는 개인 workflow 기능은 무엇인가요?"
      }),
      generatedQuestion({
        sectionRef: "Known Risks / Open Questions",
        topicKey: "personal_local_data_security",
        summary: "개인 local data 경계 미정",
        questionText: "이 개인 local workflow 도구가 읽거나 보관할 local data와 secret 경계는 무엇인가요?"
      })
    ]
  };
}

function effectExecutorCommand(
  commandType: Parameters<typeof reduceProductEngineCommand>[0]["commandType"],
  expectedStateVersion: number,
  payload: Readonly<Record<string, unknown>>,
  index: number
) {
  return {
    ...command(commandType, expectedStateVersion, payload, index),
    actor: "effect_executor" as const
  };
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
      businessCriticIntensityEffect: "주요 판단 영역마다 최소 1개의 다른 관점 질문을 유지합니다.",
      businessCriticIntensityAudit: []
    }
  };
}

function stateWithActiveQuestionBatch(
  businessCriticIntensity: BusinessCriticIntensity = "balanced"
) {
  const commands = [
    command("StartProject", 0, {
      rawIdea: "A focused founder brief generator",
      localPrivacyMode: "local_only",
      projectPurposeMode: "business",
      projectPurposeModeConfirmation: "user_confirmed",
      businessCriticIntensity,
      businessCriticIntensityConfirmation: "user_confirmed"
    }, 1),
    command("CaptureIntake", 1, {
      answer: "Help solo founders turn a rough idea into a traceable product spec."
    }, 2),
    command("DraftInitialSpec", 2, {}, 3),
    command("AnalyzeAmbiguity", 3, {
      targetRef: "current_spec",
      generatedQuestionSet: generatedBusinessQuestionSet(businessCriticIntensity)
    }, 4),
    command("ActivateQuestionBatch", 4, {}, 5)
  ] as const;
  let state = createInitialProductEngineState(projectId, sessionId);
  const eventDrafts = [];

  for (const nextCommand of commands) {
    const reduction = reduceProductEngineCommand(nextCommand, state);

    expect(reduction.accepted).toBe(true);
    eventDrafts.push(reduction.events[0]);
    state = replayProductEngineEvents(
      projectId,
      sessionId,
      eventDrafts.map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_active_batch_${index + 1}`,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:00:${index + 1}0.000Z`
      }))
    );
  }

  return { state, eventDrafts } as const;
}

function stateWithPersonalActiveQuestionBatch() {
  const commands = [
    command("StartProject", 0, {
      rawIdea: "A focused personal workflow helper",
      localPrivacyMode: "local_only",
      projectPurposeMode: "personal",
      projectPurposeModeConfirmation: "user_confirmed"
    }, 1),
    command("CaptureIntake", 1, {
      answer: "Help one user automate a repeated local workflow."
    }, 2),
    command("DraftInitialSpec", 2, {}, 3),
    command("AnalyzeAmbiguity", 3, {
      targetRef: "current_spec",
      generatedQuestionSet: generatedPersonalQuestionSet()
    }, 4),
    command("ActivateQuestionBatch", 4, {}, 5)
  ] as const;
  let state = createInitialProductEngineState(projectId, sessionId);
  const eventDrafts = [];

  for (const nextCommand of commands) {
    const reduction = reduceProductEngineCommand(nextCommand, state);

    expect(reduction.accepted).toBe(true);
    eventDrafts.push(reduction.events[0]);
    state = replayProductEngineEvents(
      projectId,
      sessionId,
      eventDrafts.map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_personal_active_batch_${index + 1}`,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:00:${index + 1}0.000Z`
      }))
    );
  }

  return { state, eventDrafts } as const;
}

describe("PR-04 ProductEngine reducer", () => {
  it("keeps the reducer source free of runtime, DB, Hono, Tauri, filesystem, shell, browser, and network imports", () => {
    const sourcePath = fileURLToPath(new URL("../src/product-engine/index.ts", import.meta.url));
    const source = readFileSync(sourcePath, "utf8");

    expect(source).not.toMatch(/from ["'](?:hono|@hono\/|@solo-superman\/db|drizzle-orm|@tauri-apps\/|node:|fs|http|https)/);
    expect(source).not.toMatch(/(?:\bfetch\s*\(|new WebSocket|document\.|window\.|child_process|exec\()/);
  });

  it("runs the generated first command path and returns an active-batch-safe projection", () => {
    const commands = [
      command("StartProject", 0, {
        rawIdea: "A focused founder brief generator",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "balanced",
        businessCriticIntensityConfirmation: "user_confirmed"
      }, 1),
      command("CaptureIntake", 1, {
        answer: "Help solo founders turn a rough idea into a traceable product spec."
      }, 2),
      command("DraftInitialSpec", 2, {}, 3),
      command("AnalyzeAmbiguity", 3, {
        targetRef: "current_spec",
        generatedQuestionSet: generatedBusinessQuestionSet()
      }, 4),
      command("ActivateQuestionBatch", 4, {}, 5)
    ] as const;
    let state = createInitialProductEngineState(projectId, sessionId);
    const eventDrafts = [];

    for (const nextCommand of commands) {
      const reduction = reduceProductEngineCommand(nextCommand, state);

      expect(reduction.accepted).toBe(true);
      expect(reduction.events).toHaveLength(1);
      expect(reduction.nextState).toMatchObject({
        stateVersion: nextCommand.expectedStateVersion + 1
      });
      eventDrafts.push(reduction.events[0]);
      state = replayProductEngineEvents(
        projectId,
        sessionId,
        eventDrafts.map((eventDraft, index) => ({
          ...eventDraft,
          eventId: `evt_product_engine_${index + 1}`,
          sequence: index + 1,
          occurredAt: `2026-05-05T00:00:${index + 1}0.000Z`
        }))
      );
    }

    expect(state.livingSpecProjection).toMatchObject({
      title: "초기 제품 스펙 초안: A focused founder brief generator",
      sections: CANONICAL_INITIAL_SPEC_SECTIONS,
      sectionCount: CANONICAL_INITIAL_SPEC_SECTIONS.length
    });
    expect(state.openIssues).toHaveLength(16);
    expect(state.openIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sectionRef: "Target Customer",
          severity: "high",
          uncertaintyType: "vague",
          topicKey: "primary_customer_narrowing",
          ambiguityDimension: "scope",
          ambiguityRoutingPath: "human_judgment",
          whyItMatters: expect.any(String),
          decisionItUnlocks: expect.any(String),
          expectedAnswerType: "choice",
          answerOptions: expect.arrayContaining([
            expect.objectContaining({ label: "유료 인터뷰를 준비하는 1인 창업자" }),
            expect.objectContaining({ label: "제품 스펙 초안을 만드는 창업자" }),
            expect.objectContaining({ label: "근거 추적이 필요한 창업자" })
          ]),
          possibleRoutes: expect.arrayContaining(["question", "decision_candidate"]),
          repeatCount: 0,
          repeatLimit: 16
        }),
        expect.objectContaining({
          sectionRef: "Target Customer",
          topicKey: "buyer_user_split",
          severity: "high",
          ambiguityDimension: "scope",
          ambiguityRoutingPath: "human_judgment",
          expectedAnswerType: "choice"
        }),
        expect.objectContaining({
          sectionRef: "Problem",
          topicKey: "problem_pain_intensity",
          expectedAnswerType: "text",
          answerOptions: []
        }),
        expect.objectContaining({
          sectionRef: "Validation Plan",
          topicKey: "acquisition_channel_realism",
          expectedAnswerType: "evidence",
          suggestedResearchTask: expect.any(String)
        }),
        expect.objectContaining({
          sectionRef: "Evidence Status",
          severity: "medium",
          uncertaintyType: "unsupported",
          ambiguityDimension: "scope",
          ambiguityRoutingPath: "current_research",
          expectedAnswerType: "evidence",
          suggestedResearchTask: expect.any(String),
          possibleRoutes: expect.arrayContaining(["research_needed", "missing_con_evidence"])
        })
      ])
    );
    expect(state.openIssues.every((issue) => canonicalInitialSpecSectionSet.has(issue.sectionRef ?? ""))).toBe(
      true
    );
    expect(state.openIssues.every((issue) => issue.ambiguityDimension && issue.ambiguityRoutingPath)).toBe(true);
    expect(state.openIssues.map((issue) => issue.topicKey)).toEqual(
      expect.arrayContaining([...docsRequiredAmbiguityTopicKeys])
    );
    const firstSevenQuestionTexts = state.openIssues.slice(0, 7).map((issue) => issue.questionText);

    expect(firstSevenQuestionTexts).toEqual(
      expect.arrayContaining([
        "창업자가 제품 스펙을 만들기 전 가장 자주 막히는 고객 인터뷰 문제는 무엇인가요?",
        "창업자 요약 제품 스펙을 가장 먼저 검증할 창업자 고객군은 누구인가요?",
        "창업자는 현재 어떤 방식으로 제품 스펙을 만들고 어디서 충분하지 않다고 느끼나요?"
      ])
    );
    expect(state.openIssues[0]?.questionContext).toMatchObject({
      idea: "A focused founder brief generator",
      goal: "Help solo founders turn a rough idea into a traceable product spec."
    });
    expect(state.queueProjection.active[0]?.questionContext).toMatchObject({
      idea: "A focused founder brief generator",
      goal: "Help solo founders turn a rough idea into a traceable product spec."
    });
    expect(state.openIssues[0]?.questionText).not.toContain("A focused founder brief generator");
    expect(state.openIssues[5]?.questionText).not.toContain("Help solo founders turn a rough idea");
    expect(state.openIssues[0]?.questionText).not.toContain("primary customer");
    expect(state.openIssues.map((issue) => issue.questionText).join("\n")).not.toMatch(/가장 먼저 검증할 가장|첫 첫/gu);
    const visibleAnswerOptionCopy = state.openIssues
      .flatMap((issue) => issue.answerOptions ?? [])
      .map((option) => [option.label, option.value, option.pro, option.con].join(" "))
      .join("\n");
    expect(visibleAnswerOptionCopy).not.toMatch(
      /\b(primary customer|Build Slice|MVP|workflow|GUI|CLI|planning-ready|tradeoff|proxy|scope creep|customer lock-in|paid intent|research_needed|high-impact gate|Spec section|completion gate|concierge|owner\/date|confidence|pivot|daemon)\b/iu
    );
    expect(visibleAnswerOptionCopy).not.toMatch(/(?:작업 흐름|일 처리 흐름)[는가를와]/u);
    expect(state.queueProjection.active).toHaveLength(1);
    const visibleActiveQueueCopy = state.queueProjection.active
      .map((item) => [item.title, item.whyItMatters, item.decisionItUnlocks, item.nextValidationAction].filter(Boolean).join(" "))
      .join("\n");
    expect(visibleActiveQueueCopy).not.toMatch(
      /\b(primary customer|Build Slice|MVP|workflow|GUI|CLI|planning-ready|tradeoff|proxy|scope creep|customer lock-in|paid intent|research_needed|high-impact gate|Spec section|completion gate|concierge|owner\/date|confidence|pivot|daemon|Known Risk|Next Validation Action|legal\/ops\/security|price proxy|willingness-to-pay)\b/iu
    );
    const activeIssueIds = new Set(state.queueProjection.active.map((item) => item.queueItemId));
    const activeIssues = state.openIssues.filter((issue) => activeIssueIds.has(issue.queueItemId));
    const rankedValueIssue = state.openIssues.find((issue) => issue.topicKey === "value_prop_switching_reason");

    expect(rankedValueIssue).toMatchObject({
      expectedAnswerType: "rank",
      answerSelectionMode: "ranked"
    });
    expect(activeIssues.every((issue) => issue.severity === "high")).toBe(true);
    expect(state.queueProjection.active.every((item) => item.state === "active")).toBe(true);
    expect(state.queueProjection.active.every((item) => item.cardType === "question")).toBe(true);
    expect(state.queueProjection.active).toEqual([
      expect.objectContaining({
        sectionRef: "Target Customer",
        topicKey: "buyer_user_split",
        severity: "high",
        expectedAnswerType: "choice",
        answerSelectionMode: "single",
        possibleRoutes: expect.arrayContaining(["question", "decision_candidate"])
      })
    ]);
    expect(state.queueProjection.next).toEqual([]);
    expect(state.queueProjection.progress).toMatchObject({
      generatedQuestionCount: 16,
      openQuestionCount: 16,
      answeredQuestionCount: 0,
      topicCoverageCount: 16,
      openTopicCoverageCount: 16,
      followUpBudgetRemainingCount: 256,
      visibleQuestionDebtCount: 1,
      activeQuestionCount: 1,
      completionPercent: 0
    });
    expect(state.session.phase).toBe("question_loop");
  });

  it("uses prompt-template generated JSON questions instead of fixed onboarding questions when provided", () => {
    const generatedQuestionSet = {
      schemaVersion: GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
      sourceSummary: "반려동물 전생애 관리 앱",
      questions: [
        {
          sectionRef: "Target Customer",
          topicKey: "pet_lifecycle_first_guardian_focus",
          uncertaintyType: "vague",
          severity: "high",
          summary: "첫 검증 보호자 유형이 아직 넓음",
          whyItMatters:
            "반려동물의 의료, 급여, 일상, 보험, 장례 정보 중 어떤 문제가 가장 먼저 강한지 보호자 유형별로 달라집니다.",
          questionText:
            "반려동물의 전생애 정보를 한 곳에서 관리하는 앱을 가장 먼저 테스트할 보호자 유형은 누구로 좁히겠습니까?",
          expectedAnswerType: "choice",
          answerSelectionMode: "single",
          answerOptions: [
            {
              id: "first_pet_guardian",
              label: "첫 반려동물을 키우는 보호자",
              value: "첫 반려동물을 키우는 보호자를 첫 테스트 대상으로 둔다.",
              primaryDetail: "초보 보호자의 의료·급여·일상 기록 흐름을 먼저 검증합니다.",
              secondaryDetail: "노령·보험·장례처럼 복잡한 생애 후반 문제는 약하게 보일 수 있습니다."
            },
            {
              id: "senior_chronic_pet_guardian",
              label: "노령·만성질환 반려동물 보호자",
              value: "노령·만성질환 반려동물 보호자를 첫 테스트 대상으로 둔다.",
              primaryDetail: "병원 기록, 약, 보험, 비용 관리의 강한 문제를 먼저 검증합니다.",
              secondaryDetail: "일상 관리 중심의 대중적 사용성은 별도 확인이 필요합니다."
            },
            {
              id: "multi_pet_household",
              label: "여러 마리를 함께 키우는 가구",
              value: "여러 마리를 함께 키우는 가구를 첫 테스트 대상으로 둔다.",
              primaryDetail: "동물별 의료·급여·보험 기록을 구분 관리하는 문제를 확인합니다.",
              secondaryDetail: "한 마리 보호자에게는 기능이 과하게 느껴질 수 있습니다."
            },
            {
              id: "insurance_cost_sensitive_guardian",
              label: "보험·의료비 관리가 필요한 보호자",
              value: "보험·의료비 관리가 필요한 보호자를 첫 테스트 대상으로 둔다.",
              primaryDetail: "돈을 낼 이유와 반복 사용 신호를 비용 관리 문제에서 확인합니다.",
              secondaryDetail: "보험이 없거나 의료비 부담이 낮은 보호자에게는 가치가 약할 수 있습니다."
            }
          ],
          decisionItUnlocks: "첫 고객 인터뷰 대상과 초기 화면의 기록 범위를 정합니다.",
          ambiguityDimension: "scope",
          ambiguityRoutingPath: "human_judgment",
          researchQuestion:
            "보호자 유형별로 의료·보험·일상 기록 관리 니즈가 실제로 어떻게 다른지 확인할 공개 단서와 반례는 무엇인가?",
          possibleRoutes: ["question", "decision_candidate"],
          suggestedResearchTask: "반려동물 보호자 유형별 의료·보험·일상 기록 관리 니즈를 비교합니다."
        },
        {
          sectionRef: "Problem",
          topicKey: "pet_lifecycle_information_fragmentation",
          uncertaintyType: "missing",
          severity: "high",
          summary: "보호자가 실제로 흩어진 정보를 얼마나 자주 찾는지 확인되지 않음",
          whyItMatters: "흩어진 정보 문제가 자주 발생하지 않으면 통합 관리 앱의 반복 사용 이유가 약해집니다.",
          questionText:
            "보호자가 병원 기록, 급여 정보, 보험 서류, 일상 메모를 따로 찾느라 가장 자주 겪는 불편은 무엇인가요?",
          expectedAnswerType: "text",
          decisionItUnlocks: "첫 문제 서술과 성공 기준에 들어갈 반복 불편을 정합니다.",
          ambiguityDimension: "success_criteria",
          ambiguityRoutingPath: "current_research",
          researchQuestion:
            "보호자들이 병원 기록, 급여 정보, 보험 서류, 일상 메모를 따로 찾는 반복 불편을 보여주는 공개 사례와 부족한 반례는 무엇인가?",
          possibleRoutes: ["question", "research_needed"],
          suggestedResearchTask:
            "반려동물 기록 관리 앱 후기와 보호자 커뮤니티에서 반복 불편 사례, 부족한 반례, 남는 불확실성을 찾습니다."
        },
        {
          sectionRef: "Value Proposition",
          topicKey: "pet_lifecycle_switching_reason",
          uncertaintyType: "decision_required",
          severity: "high",
          summary: "기존 메모·앨범·병원 앱 대신 바꿀 이유가 정해지지 않음",
          whyItMatters: "전환 이유가 약하면 여러 정보를 모아도 보호자가 기존 방식을 계속 쓸 수 있습니다.",
          questionText:
            "보호자가 기존 메모, 사진첩, 병원 앱을 두고 이 앱으로 옮겨올 가장 설득력 있는 이유는 무엇인가요?",
          expectedAnswerType: "rank",
          answerSelectionMode: "ranked",
          answerOptions: [
            {
              id: "medical_timeline",
              label: "진료·투약 이력 한눈에 보기",
              value: "진료와 투약 이력을 한눈에 보는 전환 이유를 우선한다.",
              primaryDetail: "병원 방문 전후의 반복 사용 장면을 먼저 설계합니다.",
              secondaryDetail: "일상 기록과 장례 준비 가치는 뒤로 밀릴 수 있습니다."
            },
            {
              id: "insurance_documents",
              label: "보험 청구 서류 정리",
              value: "보험 청구 서류 정리를 전환 이유로 우선한다.",
              primaryDetail: "비용과 청구 업무의 불편을 가치 제안으로 세웁니다.",
              secondaryDetail: "보험 미가입 보호자에게는 매력이 약할 수 있습니다."
            },
            {
              id: "daily_care_context",
              label: "급여·일상 변화 기록",
              value: "급여와 일상 변화 기록을 전환 이유로 우선한다.",
              primaryDetail: "매일 쓰는 기록 습관을 중심으로 첫 화면을 설계합니다.",
              secondaryDetail: "의료·보험처럼 강한 비용 문제보다 돈을 낼 이유가 약할 수 있습니다."
            }
          ],
          decisionItUnlocks: "첫 가치 제안과 홈 화면에서 가장 앞에 둘 기록 범위를 정합니다.",
          ambiguityDimension: "assumption_pressure",
          ambiguityRoutingPath: "human_judgment",
          researchQuestion:
            "보호자가 기존 메모, 사진첩, 병원 앱을 충분하다고 느끼는 순간과 부족하다고 느끼는 순간은 무엇인가?",
          possibleRoutes: ["question", "decision_candidate"]
        }
      ]
    };
    let state = createInitialProductEngineState(projectId, sessionId);
    const eventDrafts = [];

    for (const nextCommand of [
      command("StartProject", 0, {
        rawIdea:
          "반려동물 전생애주기의 의료, 급여, 일상, 보험, 장례 정보를 한 곳에 모아서 관리하는 앱",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "balanced",
        businessCriticIntensityConfirmation: "user_confirmed"
      }, 1),
      command("CaptureIntake", 1, {
        answer: "일반 보호자가 실제로 답하기 쉬운 질문으로 아이디어를 구체화한다."
      }, 2),
      command("DraftInitialSpec", 2, {}, 3)
    ]) {
      const reduction = reduceProductEngineCommand(nextCommand, state);

      expect(reduction.accepted).toBe(true);
      eventDrafts.push(reduction.events[0]);
      state = replayProductEngineEvents(
        projectId,
        sessionId,
        eventDrafts.map((eventDraft, index) => ({
          ...eventDraft,
          eventId: `evt_generated_question_json_${index + 1}` as EventId,
          sequence: index + 1,
          occurredAt: `2026-05-05T00:01:${index + 1}0.000Z`
        }))
      );
    }

    const analyze = reduceProductEngineCommand(
      command("AnalyzeAmbiguity", 3, {
        targetRef: "current_spec",
        generatedQuestionSet
      }, 4),
      state
    );

    expect(analyze.accepted).toBe(true);
    expect(analyze.events[0]?.payload).toMatchObject({
      questionGeneration: {
        mode: "generated_json",
        schemaVersion: GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
        promptTemplateRef: GENERATED_AMBIGUITY_QUESTION_PROMPT_TEMPLATE_REF,
        questionCount: 3
      }
    });
    eventDrafts.push(analyze.events[0]);
    state = replayProductEngineEvents(
      projectId,
      sessionId,
      eventDrafts.map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_generated_question_json_${index + 1}` as EventId,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:01:${index + 1}0.000Z`
      }))
    );

    expect(state.openIssues).toHaveLength(3);
    expect(state.openIssues.map((issue) => issue.topicKey)).toEqual([
      "pet_lifecycle_information_fragmentation",
      "pet_lifecycle_first_guardian_focus",
      "pet_lifecycle_switching_reason"
    ]);
    expect(state.openIssues[0]?.questionText).toContain("보호자");
    expect(state.openIssues[0]?.questionText).not.toContain("primary customer");
    expect(state.openIssues[0]?.sourceRef).toBe("generated_question:pet_lifecycle_information_fragmentation");
    expect(state.openIssues[0]).toMatchObject({
      ambiguityDimension: "success_criteria",
      ambiguityRoutingPath: "current_research",
      researchQuestion:
        "보호자들이 병원 기록, 급여 정보, 보험 서류, 일상 메모를 따로 찾는 반복 불편을 보여주는 공개 사례와 부족한 반례는 무엇인가?"
    });
    expect(
      state.openIssues
        .find((issue) => issue.topicKey === "pet_lifecycle_first_guardian_focus")
        ?.answerOptions?.map((option) => option.label)
    ).toEqual([
      "첫 반려동물을 키우는 보호자",
      "노령·만성질환 반려동물 보호자",
      "여러 마리를 함께 키우는 가구",
      "보험·의료비 관리가 필요한 보호자"
    ]);
    expect(
      state.openIssues
        .flatMap((issue) => issue.answerOptions ?? [])
        .map((option) => option.label)
        .join("\n")
    ).not.toMatch(/(?:1인\s*창업자|도메인\s*전문|팀리더|운영담당자)/u);

    const activate = reduceProductEngineCommand(command("ActivateQuestionBatch", 4, {}, 5), state);

    expect(activate.accepted).toBe(true);
    expect(activate.nextState.queueProjection.active.map((item) => item.title)).toEqual([
      "반려동물의 전생애 정보를 한 곳에서 관리하는 앱을 가장 먼저 테스트할 보호자 유형은 누구로 좁히겠습니까?"
    ]);
    eventDrafts.push(activate.events[0]);
    state = replayProductEngineEvents(
      projectId,
      sessionId,
      eventDrafts.map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_generated_question_json_${index + 1}` as EventId,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:01:${index + 1}0.000Z`
      }))
    );
    const answer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: state.queueProjection.active[0]?.queueItemId,
        answer: "노령·만성질환 반려동물 보호자를 먼저 테스트한다."
      }, 6),
      state
    );
    const researchTask = answer.events.find((event) => event.eventType === "ResearchPlanned")?.payload.researchTask;

    expect(answer.accepted).toBe(true);
    expect(researchTask).toMatchObject({
      objective: expect.stringContaining("보호자 유형별로 의료·보험·일상 기록 관리 니즈")
    });
    expect(String(researchTask?.objective)).toContain("구체화할 부분: 범위");
    expect(String(researchTask?.objective)).toContain("다음 리서치 주제를 확인합니다");
  });

  it("rejects ambiguity analysis when generated questions are missing", () => {
    let state = createInitialProductEngineState(projectId, sessionId);
    const eventDrafts = [];

    for (const nextCommand of [
      command("StartProject", 0, {
        rawIdea: "아파트 주민이 남은 식재료를 교환하는 앱",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "balanced",
        businessCriticIntensityConfirmation: "user_confirmed"
      }, 1),
      command("CaptureIntake", 1, {
        answer: "주민들이 버리는 식재료를 줄이고 안전하게 교환할 첫 사용자를 정한다."
      }, 2),
      command("DraftInitialSpec", 2, {}, 3)
    ]) {
      const reduction = reduceProductEngineCommand(nextCommand, state);

      expect(reduction.accepted).toBe(true);
      eventDrafts.push(reduction.events[0]);
      state = replayProductEngineEvents(
        projectId,
        sessionId,
        eventDrafts.map((eventDraft, index) => ({
          ...eventDraft,
          eventId: `evt_apartment_ingredient_${index + 1}` as EventId,
          sequence: index + 1,
          occurredAt: `2026-05-05T00:05:${index + 1}0.000Z`
        }))
      );
    }

    const analyze = reduceProductEngineCommand(
      command("AnalyzeAmbiguity", 3, { targetRef: "current_spec" }, 4),
      state
    );

    expect(analyze).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "COMMAND_PRECONDITION_FAILED",
        details: {
          questionGeneration: {
            mode: "codex_required",
            reason: "generated_question_set_missing"
          }
        }
      }
    });
  });

  it("ignores business critic metadata if generated JSON includes it for a personal project", () => {
    let state = createInitialProductEngineState(projectId, sessionId);
    const eventDrafts = [];

    for (const nextCommand of [
      command("StartProject", 0, {
        rawIdea: "A personal local workflow helper",
        localPrivacyMode: "local_only",
        projectPurposeMode: "personal",
        projectPurposeModeConfirmation: "user_confirmed"
      }, 1),
      command("CaptureIntake", 1, {
        answer: "Personal tool for a repeated local workflow."
      }, 2),
      command("DraftInitialSpec", 2, {}, 3)
    ]) {
      const reduction = reduceProductEngineCommand(nextCommand, state);

      expect(reduction.accepted).toBe(true);
      eventDrafts.push(reduction.events[0]);
      state = replayProductEngineEvents(
        projectId,
        sessionId,
        eventDrafts.map((eventDraft, index) => ({
          ...eventDraft,
          eventId: `evt_personal_business_metadata_${index + 1}` as EventId,
          sequence: index + 1,
          occurredAt: `2026-05-05T00:06:${index + 1}0.000Z`
        }))
      );
    }

    const generatedQuestionSet = generatedPersonalQuestionSet();
    const analyze = reduceProductEngineCommand(
      command("AnalyzeAmbiguity", 3, {
        targetRef: "current_spec",
        generatedQuestionSet: {
          ...generatedQuestionSet,
          questions: generatedQuestionSet.questions.map((question, index) =>
            index === 1
              ? {
                  ...question,
                  businessCriticPressureKind: "investor_pressure_pass",
                  businessCriticIntensityMinimum: "investor_grade"
                }
              : question
          )
        }
      }, 4),
      state
    );

    expect(analyze.accepted).toBe(true);
    expect(analyze.nextState.openIssues.every((issue) => !issue.businessCriticPressureKind)).toBe(true);
    expect(analyze.nextState.openIssues.every((issue) => !issue.businessCriticIntensityMinimum)).toBe(true);
  });

  it("rejects invalid generated-question JSON instead of falling back to fixed questions", () => {
    let state = createInitialProductEngineState(projectId, sessionId);
    const eventDrafts = [];

    for (const nextCommand of [
      command("StartProject", 0, {
        rawIdea: "아파트 주민이 남은 식재료를 교환하는 앱",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "balanced",
        businessCriticIntensityConfirmation: "user_confirmed"
      }, 1),
      command("CaptureIntake", 1, {
        answer: "주민들이 버리는 식재료를 줄이고 안전하게 교환할 첫 사용자를 정한다."
      }, 2),
      command("DraftInitialSpec", 2, {}, 3)
    ]) {
      const reduction = reduceProductEngineCommand(nextCommand, state);

      expect(reduction.accepted).toBe(true);
      eventDrafts.push(reduction.events[0]);
      state = replayProductEngineEvents(
        projectId,
        sessionId,
        eventDrafts.map((eventDraft, index) => ({
          ...eventDraft,
          eventId: `evt_apartment_invalid_generated_${index + 1}` as EventId,
          sequence: index + 1,
          occurredAt: `2026-05-05T00:07:${index + 1}0.000Z`
        }))
      );
    }

    const analyze = reduceProductEngineCommand(
      command("AnalyzeAmbiguity", 3, {
        targetRef: "current_spec",
        generatedQuestionSet: {
          schemaVersion: "wrong",
          questions: []
        }
      }, 4),
      state
    );

    expect(analyze).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED",
        details: {
          questionGeneration: {
            mode: "codex_required",
            reason: "generated_question_set_invalid",
            validationIssues: expect.arrayContaining([
              expect.stringContaining("$.schemaVersion"),
              expect.stringContaining("$.questions")
            ])
          }
        }
      }
    });
  });

  it("rejects invalid generated JSON without deterministic ambiguity fallback", () => {
    let state = createInitialProductEngineState(projectId, sessionId);
    const eventDrafts = [];

    for (const nextCommand of [
      command("StartProject", 0, {
        rawIdea: "A focused founder brief generator",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "balanced",
        businessCriticIntensityConfirmation: "user_confirmed"
      }, 1),
      command("CaptureIntake", 1, {
        answer: "Help solo founders turn a rough idea into a traceable product spec."
      }, 2),
      command("DraftInitialSpec", 2, {}, 3)
    ]) {
      const reduction = reduceProductEngineCommand(nextCommand, state);

      expect(reduction.accepted).toBe(true);
      eventDrafts.push(reduction.events[0]);
      state = replayProductEngineEvents(
        projectId,
        sessionId,
        eventDrafts.map((eventDraft, index) => ({
          ...eventDraft,
          eventId: `evt_generated_question_fallback_${index + 1}` as EventId,
          sequence: index + 1,
          occurredAt: `2026-05-05T00:02:${index + 1}0.000Z`
        }))
      );
    }

    const analyze = reduceProductEngineCommand(
      command("AnalyzeAmbiguity", 3, {
        targetRef: "current_spec",
        generatedQuestionSet: {
          schemaVersion: "wrong",
          questions: []
        }
      }, 4),
      state
    );

    expect(analyze).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED",
        details: {
          questionGeneration: {
            mode: "codex_required",
            reason: "generated_question_set_invalid",
            validationIssues: expect.arrayContaining([
              expect.stringContaining("$.schemaVersion"),
              expect.stringContaining("$.questions")
            ])
          }
        }
      }
    });
  });

  it("preserves onboarding wording while simplifying generated prompt language", () => {
    const { state } = stateWithPersonalActiveQuestionBatch();
    const activeTitles = state.queueProjection.active.map((item) => item.title).join("\n");
    const activeQuestionContextText = state.queueProjection.active
      .flatMap((item) => [item.questionContext?.idea, item.questionContext?.goal])
      .filter(Boolean)
      .join("\n");

    expect(activeQuestionContextText).toContain("A focused personal workflow helper");
    expect(activeQuestionContextText).toContain("Help one user automate a repeated local workflow.");
    expect(activeTitles).not.toContain("A focused personal workflow helper");
    expect(activeTitles).not.toContain("Help one user automate a repeated local workflow.");
    expect(activeTitles).toContain("개인 작업 흐름 첫 버전은 화면 UI가 필요한가요, 아니면 로컬 화면으로 충분한가요?");
    expect(activeTitles).not.toContain("A focused personal 일 처리 흐름 helper");
    expect(activeTitles).not.toContain("Help one user automate a repeated local 일 처리 흐름.");
    expect(activeTitles).not.toMatch(/(?:작업 흐름|일 처리 흐름)[는가를와]/u);
  });

  it("replays the start-project session shell projection from the event log", () => {
    const startProject = command("StartProject", 0, {
      rawIdea: "A replayable founder brief generator",
      localPrivacyMode: "local_only",
      projectPurposeMode: "personal",
      projectPurposeModeConfirmation: "user_confirmed",
      projectPurposeModeReason: "Personal workflow tool confirmed by the user.",
      initialResearchAutomationPermission: "allow_codex_and_chatgpt_visible"
    }, 1);
    const reduction = reduceProductEngineCommand(startProject, createInitialProductEngineState(projectId, sessionId));

    expect(reduction.accepted).toBe(true);

    const state = replayProductEngineEvents(projectId, sessionId, [
      {
        ...reduction.events[0],
        eventId: "evt_start_project_projection",
        sequence: 1,
        occurredAt: "2026-05-05T00:00:10.000Z"
      }
    ]);

    expect(state.sessionShellProjection).toMatchObject({
      kind: "SessionShellProjection",
      projectId,
      sessionId,
      version: 1,
      phase: "intake",
      projectPurposeMode: "personal",
      projectPurposeModeLabel: "개인 작업 흐름 구현 중심",
      initialResearchAutomationPermission: "allow_codex_and_chatgpt_visible"
    });
    expect(state.project.initialResearchAutomationPermission).toBe("allow_codex_and_chatgpt_visible");
    expect(state.project.projectPurposeModeAudit).toMatchObject([
      {
        newMode: "personal",
        reason: "Personal workflow tool confirmed by the user.",
        actor: "user"
      }
    ]);
  });

  it("keeps missing purpose mode in a mode_required gate until a user confirms the mode", () => {
    const initialState = createInitialProductEngineState(projectId, sessionId);
    const missingMode = reduceProductEngineCommand(
      command("StartProject", 0, {
        rawIdea: "A legacy import without a selected mode",
        localPrivacyMode: "local_only"
      }, 1),
      initialState
    );
    const missingConfirmation = reduceProductEngineCommand(
      command("StartProject", 0, {
        rawIdea: "A project with an inferred but unconfirmed mode",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business"
      }, 1),
      initialState
    );
    const replayedLegacyState = replayProductEngineEvents(projectId, sessionId, [
      {
        eventType: "ProjectStarted",
        projectId,
        sessionId,
        sourceCommandId: "cmd_legacy_project_started" as CommandId,
        correlationId,
        causationId: null,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        payload: {
          rawIdea: "A persisted legacy project without a mode",
          localPrivacyMode: "local_only"
        },
        eventId: "evt_legacy_project_started" as EventId,
        sequence: 1,
        occurredAt: "2026-05-05T00:00:10.000Z"
      }
    ]);

    expect(initialState.project).toMatchObject({
      projectPurposeModeSelectionStatus: "mode_required",
      projectPurposeModeLabel: "프로젝트 목적 선택 필요"
    });
    expect(initialState.project.projectPurposeMode).toBeUndefined();
    expect(missingMode).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED",
        message: "StartProject requires a supported user-confirmed projectPurposeMode."
      }
    });
    expect(missingConfirmation).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED",
        message: "StartProject requires projectPurposeModeConfirmation to be user_confirmed."
      }
    });
    expect(replayedLegacyState.project).toMatchObject({
      projectPurposeModeSelectionStatus: "mode_required",
      projectPurposeModeLabel: "프로젝트 목적 선택 필요"
    });
    expect(replayedLegacyState.project.projectPurposeMode).toBeUndefined();
  });

  it("rejects unsupported onboarding research automation permissions", () => {
    const reduction = reduceProductEngineCommand(
      command("StartProject", 0, {
        rawIdea: "A project with an invalid research automation preference",
        localPrivacyMode: "local_only",
        projectPurposeMode: "personal",
        projectPurposeModeConfirmation: "user_confirmed",
        initialResearchAutomationPermission: "auto_chatgpt_headless"
      }, 1),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(reduction).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED",
        message:
          "StartProject initialResearchAutomationPermission must be manual_only, allow_codex, or allow_codex_and_chatgpt_visible."
      }
    });
  });

  it("requires explicit business critic intensity before business ambiguity analysis", () => {
    let state = createInitialProductEngineState(projectId, sessionId);
    const eventDrafts = [];
    const start = reduceProductEngineCommand(
      command("StartProject", 0, {
        rawIdea: "A business idea that still needs critic intensity selection",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed"
      }, 1),
      state
    );

    expect(start.accepted).toBe(true);
    expect(start.nextState.project).toMatchObject({
      projectPurposeMode: "business",
      businessCriticIntensitySelectionStatus: "intensity_required",
      businessCriticIntensityLabel: "사업 검증 강도 선택 필요"
    });
    eventDrafts.push(start.events[0]);
    state = replayProductEngineEvents(
      projectId,
      sessionId,
      eventDrafts.map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_missing_business_critic_${index + 1}` as EventId,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:25:${index + 1}0.000Z`
      }))
    );

    const intake = reduceProductEngineCommand(command("CaptureIntake", 1, { answer: "Business validation." }, 2), state);
    expect(intake.accepted).toBe(true);
    eventDrafts.push(intake.events[0]);
    state = replayProductEngineEvents(
      projectId,
      sessionId,
      eventDrafts.map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_missing_business_critic_${index + 1}` as EventId,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:25:${index + 1}0.000Z`
      }))
    );

    const draft = reduceProductEngineCommand(command("DraftInitialSpec", 2, {}, 3), state);
    expect(draft.accepted).toBe(true);
    eventDrafts.push(draft.events[0]);
    state = replayProductEngineEvents(
      projectId,
      sessionId,
      eventDrafts.map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_missing_business_critic_${index + 1}` as EventId,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:25:${index + 1}0.000Z`
      }))
    );

    const analyze = reduceProductEngineCommand(command("AnalyzeAmbiguity", 3, { targetRef: "current_spec" }, 4), state);

    expect(analyze).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "COMMAND_PRECONDITION_FAILED"
      }
    });
    expect(analyze.rejectionReason?.details).toMatchObject({
      businessCriticIntensitySelectionStatus: "intensity_required"
    });
  });

  it("allows late business critic intensity selection before ambiguity analysis", () => {
    let state = createInitialProductEngineState(projectId, sessionId);
    const eventDrafts = [];

    const appendAcceptedEvent = (
      reduction: ReturnType<typeof reduceProductEngineCommand>,
      eventPrefix: string
    ) => {
      expect(reduction.accepted).toBe(true);
      eventDrafts.push(reduction.events[0]);
      state = replayProductEngineEvents(
        projectId,
        sessionId,
        eventDrafts.map((eventDraft, index) => ({
          ...eventDraft,
          eventId: `${eventPrefix}_${index + 1}` as EventId,
          sequence: index + 1,
          occurredAt: `2026-05-05T00:26:${index + 1}0.000Z`
        }))
      );
    };

    appendAcceptedEvent(
      reduceProductEngineCommand(
        command("StartProject", 0, {
          rawIdea: "A founder brief business idea that selects critic intensity after the draft",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed"
        }, 1),
        state
      ),
      "evt_late_business_critic"
    );
    appendAcceptedEvent(
      reduceProductEngineCommand(command("CaptureIntake", 1, { answer: "Founder business validation." }, 2), state),
      "evt_late_business_critic"
    );
    appendAcceptedEvent(
      reduceProductEngineCommand(command("DraftInitialSpec", 2, {}, 3), state),
      "evt_late_business_critic"
    );

    const intensityChange = reduceProductEngineCommand(
      command("ChangeBusinessCriticIntensity", 3, {
        businessCriticIntensity: "strong",
        businessCriticIntensityConfirmation: "user_confirmed",
        reason: "User selected strong critic pressure before ambiguity analysis."
      }, 4),
      state
    );

    expect(intensityChange.accepted).toBe(true);
    expect(intensityChange.nextState.project).toMatchObject({
      businessCriticIntensity: "strong",
      businessCriticIntensitySelectionStatus: "confirmed"
    });
    expect(intensityChange.nextState.openIssues).toHaveLength(0);
    expect(intensityChange.nextState.queueProjection.next).toHaveLength(0);
    appendAcceptedEvent(intensityChange, "evt_late_business_critic");

    const analyze = reduceProductEngineCommand(
      command("AnalyzeAmbiguity", 4, {
        targetRef: "current_spec",
        generatedQuestionSet: generatedBusinessQuestionSet("strong")
      }, 5),
      state
    );

    expect(analyze.accepted).toBe(true);
    expect(analyze.nextState.openIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          businessCriticIntensityMinimum: "strong",
          businessCriticPressureKind: "core_assumption_challenge"
        })
      ])
    );
  });

  it("starts explicit stronger business review with a planning bottleneck before counter-evidence pressure", () => {
    const strongState = stateWithActiveQuestionBatch("strong").state;
    const investorGradeState = stateWithActiveQuestionBatch("investor_grade").state;

    expect(strongState.queueProjection.active).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sectionRef: "Target Customer"
        })
      ])
    );
    expect(strongState.queueProjection.active.some((item) => item.businessCriticPressureKind === "core_assumption_challenge")).toBe(false);
    expect(strongState.queueProjection.next).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          state: "next",
          businessCriticPressureKind: "core_assumption_challenge"
        })
      ])
    );
    expect(strongState.queueProjection.next.every((item) => item.businessCriticPressureKind !== "balanced_con")).toBe(true);
    expect(strongState.queueProjection.next.some((item) => item.businessCriticPressureKind === "investor_pressure_pass")).toBe(false);

    expect(
      investorGradeState.queueProjection.active.some((item) => item.businessCriticPressureKind === "core_assumption_challenge")
    ).toBe(false);
    expect(investorGradeState.queueProjection.active).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sectionRef: "Target Customer"
        })
      ])
    );
    expect(investorGradeState.queueProjection.next).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          state: "next",
          businessCriticPressureKind: "core_assumption_challenge"
        }),
        expect.objectContaining({
          state: "next",
          businessCriticPressureKind: "investor_pressure_pass"
        })
      ])
    );
    expect(investorGradeState.queueProjection.next.every((item) => item.businessCriticPressureKind !== "balanced_con")).toBe(true);
  });

  it("rejects explicit stronger business analysis that omits a core-assumption challenge", () => {
    const commands = [
      command("StartProject", 0, {
        rawIdea: "A strong critic explicit batch test idea",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "strong",
        businessCriticIntensityConfirmation: "user_confirmed"
      }, 1),
      command("CaptureIntake", 1, {
        answer: "Validate the strongest business risks without bypassing core assumptions."
      }, 2),
      command("DraftInitialSpec", 2, {}, 3)
    ] as const;
    let state = createInitialProductEngineState(projectId, sessionId);
    const eventDrafts = [];

    for (const nextCommand of commands) {
      const reduction = reduceProductEngineCommand(nextCommand, state);

      expect(reduction.accepted).toBe(true);
      eventDrafts.push(reduction.events[0]);
      state = replayProductEngineEvents(
        projectId,
        sessionId,
        eventDrafts.map((eventDraft, index) => ({
          ...eventDraft,
          eventId: `evt_strong_explicit_batch_${index + 1}` as EventId,
          sequence: index + 1,
          occurredAt: `2026-05-05T00:28:${index + 1}0.000Z`
        }))
      );
    }

    const analyze = reduceProductEngineCommand(
      command("AnalyzeAmbiguity", 3, {
        targetRef: "current_spec",
        generatedQuestionSet: generatedBusinessQuestionSet("balanced")
      }, 4),
      state
    );

    expect(analyze).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED",
        details: {
          questionGeneration: {
            mode: "codex_required",
            reason: "generated_question_set_invalid"
          }
        }
      }
    });
  });

  it("rejects investor-grade generated business analysis that omits an investor pressure pass", () => {
    const commands = [
      command("StartProject", 0, {
        rawIdea: "Founder Brief 제품 스펙과 customer interview 근거 추적 앱",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "investor_grade",
        businessCriticIntensityConfirmation: "user_confirmed"
      }, 1),
      command("CaptureIntake", 1, {
        answer: "Founder product spec과 customer interview 질문 품질을 investor-grade business risk까지 검증한다."
      }, 2),
      command("DraftInitialSpec", 2, {}, 3)
    ] as const;
    let state = createInitialProductEngineState(projectId, sessionId);
    const eventDrafts = [];

    for (const nextCommand of commands) {
      const reduction = reduceProductEngineCommand(nextCommand, state);

      expect(reduction.accepted).toBe(true);
      eventDrafts.push(reduction.events[0]);
      state = replayProductEngineEvents(
        projectId,
        sessionId,
        eventDrafts.map((eventDraft, index) => ({
          ...eventDraft,
          eventId: `evt_investor_explicit_batch_${index + 1}` as EventId,
          sequence: index + 1,
          occurredAt: `2026-05-05T00:29:${index + 1}0.000Z`
        }))
      );
    }

    const analyze = reduceProductEngineCommand(
      command("AnalyzeAmbiguity", 3, {
        targetRef: "current_spec",
        generatedQuestionSet: generatedBusinessQuestionSet("strong")
      }, 4),
      state
    );

    expect(analyze).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED",
        details: {
          questionGeneration: {
            mode: "codex_required",
            reason: "generated_question_set_invalid",
            validationIssues: expect.arrayContaining([
              expect.stringContaining("investor_pressure_pass")
            ])
          }
        }
      }
    });
  });

  it("queues stronger business critic pressure without replacing the active question batch", () => {
    const { state, eventDrafts } = stateWithActiveQuestionBatch();
    const activeItemIds = state.queueProjection.active.map((item) => item.queueItemId);
    const reduction = reduceProductEngineCommand(
      command("ChangeBusinessCriticIntensity", Number(state.stateVersion), {
        businessCriticIntensity: "investor_grade",
        businessCriticIntensityConfirmation: "user_confirmed",
        reason: "Investor-facing review needs pressure on pricing, retention, timing, and channel assumptions."
      }, 6),
      state
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.events[0]).toMatchObject({
      eventType: "BusinessCriticIntensityChanged",
      payload: {
        previousIntensity: "balanced",
        newIntensity: "investor_grade",
        queuedNextCriticalItemCount: expect.any(Number)
      }
    });
    expect(reduction.nextState.queueProjection.active.map((item) => item.queueItemId)).toEqual(activeItemIds);
    expect(reduction.nextState.queueProjection.next).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          state: "next",
          businessCriticPressureKind: "core_assumption_challenge"
        }),
        expect.objectContaining({
          state: "next",
          businessCriticIntensity: "investor_grade",
          businessCriticPressureKind: "investor_pressure_pass",
          businessCriticCategory: "pricing"
        })
      ])
    );

    const replayed = replayProductEngineEvents(
      projectId,
      sessionId,
      [...eventDrafts, reduction.events[0]].map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_business_critic_${index + 1}` as EventId,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:30:${index + 1}0.000Z`
      }))
    );

    expect(replayed.project).toMatchObject({
      businessCriticIntensity: "investor_grade",
      businessCriticIntensitySelectionStatus: "confirmed",
      businessCriticIntensityAudit: expect.arrayContaining([
        expect.objectContaining({
          previousIntensity: "balanced",
          newIntensity: "investor_grade"
        })
      ])
    });
    expect(replayed.queueProjection.active.map((item) => item.queueItemId)).toEqual(activeItemIds);
    expect(replayed.queueProjection.next.map((item) => item.businessCriticPressureKind)).toEqual(
      expect.arrayContaining(["core_assumption_challenge", "investor_pressure_pass"])
    );
  });

  it("downgrades queued business critic pressure without replacing the active question batch", () => {
    const { state, eventDrafts } = stateWithActiveQuestionBatch();
    const activeItemIds = state.queueProjection.active.map((item) => item.queueItemId);
    const investorGrade = reduceProductEngineCommand(
      command("ChangeBusinessCriticIntensity", Number(state.stateVersion), {
        businessCriticIntensity: "investor_grade",
        businessCriticIntensityConfirmation: "user_confirmed",
        reason: "Investor-facing review needs the strongest pressure first."
      }, 6),
      state
    );

    expect(investorGrade.accepted).toBe(true);

    const investorGradeState = replayProductEngineEvents(
      projectId,
      sessionId,
      [...eventDrafts, investorGrade.events[0]].map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_business_critic_downgrade_${index + 1}` as EventId,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:32:${index + 1}0.000Z`
      }))
    );
    const downgraded = reduceProductEngineCommand(
      command("ChangeBusinessCriticIntensity", Number(investorGradeState.stateVersion), {
        businessCriticIntensity: "strong",
        businessCriticIntensityConfirmation: "user_confirmed",
        reason: "User wants strong pressure without investor-grade interrogation."
      }, 7),
      investorGradeState
    );

    expect(downgraded.accepted).toBe(true);
    expect(downgraded.nextState.queueProjection.active.map((item) => item.queueItemId)).toEqual(activeItemIds);
    expect(downgraded.nextState.queueProjection.next).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          businessCriticPressureKind: "core_assumption_challenge"
        })
      ])
    );
    expect(
      downgraded.nextState.queueProjection.next.some(
        (item) =>
          item.businessCriticIntensity === "investor_grade" ||
          item.businessCriticPressureKind === "investor_pressure_pass"
      )
    ).toBe(false);
    expect(
      downgraded.nextState.openIssues.some(
        (issue) => issue.status === "open" && issue.businessCriticPressureKind === "investor_pressure_pass"
      )
    ).toBe(false);
    expect(downgraded.nextState.completeness?.completionCandidate.gateFailures).not.toEqual(
      expect.arrayContaining([expect.stringContaining("Investor-grade pressure")])
    );
  });

  it("accepts investor pressure as a Known Risk only with a next validation action", () => {
    const { state, eventDrafts } = stateWithActiveQuestionBatch();
    const investorGrade = reduceProductEngineCommand(
      command("ChangeBusinessCriticIntensity", Number(state.stateVersion), {
        businessCriticIntensity: "investor_grade",
        businessCriticIntensityConfirmation: "user_confirmed",
        reason: "Escalate to investor-grade pressure before handoff."
      }, 6),
      state
    );

    expect(investorGrade.accepted).toBe(true);

    const investorGradeState = replayProductEngineEvents(
      projectId,
      sessionId,
      [...eventDrafts, investorGrade.events[0]].map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_business_critic_defer_${index + 1}` as EventId,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:35:${index + 1}0.000Z`
      }))
    );
    const pressureItem = investorGradeState.queueProjection.next.find(
      (item) => item.businessCriticPressureKind === "investor_pressure_pass"
    );

    expect(pressureItem).toBeDefined();

    const deferredWithoutKnownRisk = reduceProductEngineCommand(
      command("DeferQueueItem", Number(investorGradeState.stateVersion), {
        queueItemId: pressureItem?.queueItemId,
        reason: "Hide pricing pressure without carrying a follow-up."
      }, 7),
      investorGradeState
    );

    expect(deferredWithoutKnownRisk).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "COMMAND_PRECONDITION_FAILED"
      }
    });

    const deferredWithoutAction = reduceProductEngineCommand(
      command("DeferQueueItem", Number(investorGradeState.stateVersion), {
        queueItemId: pressureItem?.queueItemId,
        reason: "Carry as a known risk but omit the next validation action.",
        riskDisposition: "known_risk_next_validation_action"
      }, 8),
      investorGradeState
    );

    expect(deferredWithoutAction).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED"
      }
    });

    const deferred = reduceProductEngineCommand(
      command("DeferQueueItem", Number(investorGradeState.stateVersion), {
        queueItemId: pressureItem?.queueItemId,
        reason: "Pricing pressure is explicitly carried as a known risk for the next validation step.",
        riskDisposition: "known_risk_next_validation_action",
        nextValidationAction: "Run a price sensitivity smoke test with three target customers."
      }, 9),
      investorGradeState
    );

    expect(deferred.accepted).toBe(true);
    expect(deferred.nextState.openIssues.find((issue) => issue.queueItemId === pressureItem?.queueItemId)).toMatchObject({
      status: "deferred",
      knownRiskAccepted: true,
      nextValidationAction: "Run a price sensitivity smoke test with three target customers."
    });
    expect(deferred.nextState.queueProjection.deferred).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          queueItemId: pressureItem?.queueItemId,
          knownRiskAccepted: true,
          nextValidationAction: "Run a price sensitivity smoke test with three target customers."
        })
      ])
    );

    const replayed = replayProductEngineEvents(
      projectId,
      sessionId,
      [...eventDrafts, investorGrade.events[0], deferred.events[0]].map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_business_critic_known_risk_replay_${index + 1}` as EventId,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:36:${index + 1}0.000Z`
      }))
    );

    expect(replayed.openIssues.find((issue) => issue.queueItemId === pressureItem?.queueItemId)).toMatchObject({
      status: "deferred",
      knownRiskAccepted: true,
      nextValidationAction: "Run a price sensitivity smoke test with three target customers."
    });
  });

  it("switches ambiguity analysis between business and personal purpose modes", () => {
    const businessCommands = [
      command("StartProject", 0, {
        rawIdea: "A paid founder brief generator",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "balanced",
        businessCriticIntensityConfirmation: "user_confirmed"
      }, 1),
      command("CaptureIntake", 1, { answer: "Business validation workflow." }, 2),
      command("DraftInitialSpec", 2, {}, 3),
      command("AnalyzeAmbiguity", 3, {
        targetRef: "current_spec",
        generatedQuestionSet: generatedBusinessQuestionSet()
      }, 4),
      command("ActivateQuestionBatch", 4, {}, 5)
    ] as const;
    const personalCommands = [
      command("StartProject", 0, {
        rawIdea: "A personal local workflow helper",
        localPrivacyMode: "local_only",
        projectPurposeMode: "personal",
        projectPurposeModeConfirmation: "user_confirmed"
      }, 1),
      command("CaptureIntake", 1, { answer: "Personal tool for a repeated local workflow." }, 2),
      command("DraftInitialSpec", 2, {}, 3),
      command("AnalyzeAmbiguity", 3, {
        targetRef: "current_spec",
        generatedQuestionSet: generatedPersonalQuestionSet()
      }, 4),
      command("ActivateQuestionBatch", 4, {}, 5)
    ] as const;

    function replay(commands: readonly ReturnType<typeof command>[]) {
      let state = createInitialProductEngineState(projectId, sessionId);
      const eventDrafts = [];

      for (const nextCommand of commands) {
        const reduction = reduceProductEngineCommand(nextCommand, state);

        expect(reduction.accepted).toBe(true);
        eventDrafts.push(reduction.events[0]);
        state = replayProductEngineEvents(
          projectId,
          sessionId,
          eventDrafts.map((eventDraft, index) => ({
            ...eventDraft,
            eventId: `evt_purpose_mode_${index + 1}` as EventId,
            sequence: index + 1,
            occurredAt: `2026-05-05T00:10:${index + 1}0.000Z`
          }))
        );
      }

      return state;
    }

    const businessState = replay(businessCommands);
    const personalState = replay(personalCommands);

    expect(businessState.openIssues.map((issue) => issue.topicKey)).toEqual(
      expect.arrayContaining(["buyer_user_split", "alternative_dissatisfaction_gap", "acquisition_channel_realism"])
    );
    expect(businessState.queueProjection).toMatchObject({
      projectPurposeMode: "business",
      projectPurposeModeSelectionStatus: "confirmed",
      modeEffectSummary: expect.stringContaining("돈을 낼 이유")
    });
    expect(personalState.openIssues.map((issue) => issue.topicKey)).toEqual(
      expect.arrayContaining(["personal_workflow_context", "personal_usage_frequency", "personal_gui_fit"])
    );
    expect(personalState.openIssues.map((issue) => issue.topicKey)).not.toEqual(
      expect.arrayContaining(["buyer_user_split", "acquisition_channel_realism"])
    );
    expect(personalState.queueProjection.active).toHaveLength(1);
    expect(personalState.queueProjection).toMatchObject({
      projectPurposeMode: "personal",
      projectPurposeModeSelectionStatus: "confirmed",
      skippedCommercializationAxes: expect.arrayContaining(["market_size", "willingness_to_pay"])
    });

    const personalResearch = reduceProductEngineCommand(
      command("PlanResearch", Number(personalState.stateVersion), {
        objective: "Compare current manual workflow friction before building automation.",
        routeOutcome: "research_needed",
        impact: "medium"
      }, 6),
      personalState
    );

    expect(personalResearch.accepted).toBe(true);
    expect(personalResearch.nextState).toMatchObject({
      researchState: {
        tasks: [
          expect.objectContaining({
            projectPurposeMode: "personal",
            projectPurposeModeLabel: "개인 작업 흐름 구현 중심",
            skippedCommercializationAxes: expect.arrayContaining(["market_size", "willingness_to_pay"])
          })
        ]
      }
    });
  });

  it("audits later purpose-mode changes without replacing the active question batch", () => {
    const { state, eventDrafts } = stateWithActiveQuestionBatch();
    const activeItemIds = state.queueProjection.active.map((item) => item.queueItemId);
    const reduction = reduceProductEngineCommand(
      command("ChangeProjectPurposeMode", Number(state.stateVersion), {
        projectPurposeMode: "personal",
        suggestedProjectPurposeMode: "personal",
        reason: "User clarified this is for a private workflow, not commercialization."
      }, 6),
      state
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.events[0]).toMatchObject({
      eventType: "ProjectPurposeModeChanged",
      payload: {
        previousMode: "business",
        newMode: "personal",
        reason: "User clarified this is for a private workflow, not commercialization."
      }
    });
    expect(reduction.immediateProjection).toMatchObject({
      kind: "SessionShellProjection",
      phase: "validation",
      projectPurposeMode: "personal",
      projectPurposeModeLabel: "개인 작업 흐름 구현 중심"
    });
    expect(reduction.nextState).toMatchObject({
      queueProjection: {
        projectPurposeMode: "personal",
        modeEffectSummary: expect.stringContaining("작업 흐름"),
        progress: state.queueProjection.progress
      }
    });
    expect(reduction.events[0].payload.queueProjection).toMatchObject({
      progress: state.queueProjection.progress
    });

    const replayed = replayProductEngineEvents(
      projectId,
      sessionId,
      [...eventDrafts, reduction.events[0]].map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_mode_change_${index + 1}` as EventId,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:20:${index + 1}0.000Z`
      }))
    );

    expect(replayed.project).toMatchObject({
      projectPurposeMode: "personal",
      businessCriticIntensitySelectionStatus: "not_applicable",
      projectPurposeModeAudit: expect.arrayContaining([
        expect.objectContaining({
          previousMode: "business",
          newMode: "personal",
          actor: "user"
        })
      ])
    });
    expect(replayed.project.businessCriticIntensity).toBeUndefined();
    expect(replayed.project.businessCriticIntensityLabel).toBeUndefined();
    expect(replayed.project.businessCriticIntensityEffect).toBeUndefined();
    expect(replayed.queueProjection.active.map((item) => item.queueItemId)).toEqual(activeItemIds);
    expect(replayed.queueProjection).toMatchObject({
      projectPurposeMode: "personal",
      projectPurposeModeSelectionStatus: "confirmed",
      skippedCommercializationAxes: expect.arrayContaining(["market_size", "willingness_to_pay"]),
      progress: state.queueProjection.progress
    });
    expect(replayed.queueProjection.activeBatch?.stabilityPolicy).toBe(
      "preserve_active_batch_until_terminal_or_explicit_reactivation"
    );
  });

  it("keeps session phase mapping centralized for replay and sidecar shell projections", () => {
    const startProject = command("StartProject", 0, {
      rawIdea: "A phase mapping test idea",
      localPrivacyMode: "local_only",
      projectPurposeMode: "business",
      projectPurposeModeConfirmation: "user_confirmed",
      businessCriticIntensity: "balanced",
      businessCriticIntensityConfirmation: "user_confirmed"
    }, 1);
    const started = reduceProductEngineCommand(startProject, createInitialProductEngineState(projectId, sessionId));

    expect(started.accepted).toBe(true);
    expect(sessionPhaseForProductEngineEvent({
      ...started.events[0],
      eventId: "evt_phase_start",
      sequence: 1,
      occurredAt: "2026-05-05T00:00:10.000Z"
    })).toBe("intake");
    expect(sessionShellPhaseForProductEnginePhase("question_loop")).toBe("validation");
    expect(sessionShellPhaseForProductEnginePhase("completion")).toBe("complete");
  });

  it("defers active queue items through reducer and replay", () => {
    const { state, eventDrafts } = stateWithPersonalActiveQuestionBatch();
    const queueItemId = state.queueProjection.active[0]?.queueItemId;

    expect(queueItemId).toBeDefined();

    const reduction = reduceProductEngineCommand(
      command("DeferQueueItem", Number(state.stateVersion), {
        queueItemId,
        reason: "Need external evidence before answering."
      }, 6),
      state
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.events[0]).toMatchObject({
      eventType: "QueueItemDeferred",
      payload: {
        queueItemId,
        reason: "Need external evidence before answering."
      }
    });
    expect(reduction.immediateProjection).toMatchObject({
      deferred: [
        {
          queueItemId,
          state: "deferred"
        }
      ]
    });
    const deferredProjection = reduction.immediateProjection as DecisionQueueProjection;
    expect(deferredProjection.active.map((item) => item.queueItemId)).not.toContain(queueItemId);
    expect(deferredProjection.active).toHaveLength(1);

    const replayed = replayProductEngineEvents(
      projectId,
      sessionId,
      [...eventDrafts, reduction.events[0]].map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_defer_queue_${index + 1}`,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:00:${index + 1}0.000Z`
      }))
    );

    expect(replayed.openIssues.find((issue) => issue.queueItemId === queueItemId)?.status).toBe("deferred");
    expect(replayed.queueProjection.active.some((item) => item.queueItemId === queueItemId)).toBe(false);
    expect(replayed.queueProjection.active).toHaveLength(1);
    expect(replayed.queueProjection.deferred).toContainEqual(
      expect.objectContaining({
        queueItemId,
        state: "deferred"
      })
    );
  });

  it("prevents hiding high-severity business critic items without a Known Risk handoff", () => {
    const { state } = stateWithActiveQuestionBatch();
    const queueItem = state.queueProjection.active.find(
      (item) => item.businessCriticCategory && item.severity === "high"
    );

    expect(queueItem).toBeDefined();

    const deferWithoutKnownRisk = reduceProductEngineCommand(
      command("DeferQueueItem", Number(state.stateVersion), {
        queueItemId: queueItem?.queueItemId,
        reason: "Hide a high-severity business critic question without a follow-up."
      }, 6),
      state
    );
    const dismiss = reduceProductEngineCommand(
      command("DismissQueueItem", Number(state.stateVersion), {
        queueItemId: queueItem?.queueItemId,
        reason: "Dismiss a high-severity business critic question without evidence."
      }, 7),
      state
    );
    const deferWithKnownRisk = reduceProductEngineCommand(
      command("DeferQueueItem", Number(state.stateVersion), {
        queueItemId: queueItem?.queueItemId,
        reason: "Carry the business critic blocker as a known risk.",
        riskDisposition: "known_risk_next_validation_action",
        nextValidationAction: "Run one customer pain validation interview before planning handoff."
      }, 8),
      state
    );

    expect(deferWithoutKnownRisk).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "COMMAND_PRECONDITION_FAILED",
        details: {
          requiredRiskDisposition: "known_risk_next_validation_action"
        }
      }
    });
    expect(dismiss).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "COMMAND_PRECONDITION_FAILED",
        details: {
          requiredRiskDisposition: "known_risk_next_validation_action"
        }
      }
    });
    expect(deferWithKnownRisk.accepted).toBe(true);
  });

  it("dismisses active queue items through reducer and replay", () => {
    const { state, eventDrafts } = stateWithPersonalActiveQuestionBatch();
    const queueItemId = state.queueProjection.active[0]?.queueItemId;

    expect(queueItemId).toBeDefined();

    const reduction = reduceProductEngineCommand(
      command("DismissQueueItem", Number(state.stateVersion), {
        queueItemId,
        reason: "Covered by an existing founder decision."
      }, 6),
      state
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.events[0]).toMatchObject({
      eventType: "QueueItemDismissed",
      payload: {
        queueItemId,
        reason: "Covered by an existing founder decision."
      }
    });
    expect(reduction.immediateProjection).toMatchObject({
      active: expect.not.arrayContaining([
        expect.objectContaining({
          queueItemId
        })
      ])
    });
    expect((reduction.immediateProjection as DecisionQueueProjection).active).toHaveLength(1);

    const replayed = replayProductEngineEvents(
      projectId,
      sessionId,
      [...eventDrafts, reduction.events[0]].map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_dismiss_queue_${index + 1}`,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:00:${index + 1}0.000Z`
      }))
    );

    expect(replayed.openIssues.find((issue) => issue.queueItemId === queueItemId)?.status).toBe("resolved");
    expect(replayed.queueProjection.active.some((item) => item.queueItemId === queueItemId)).toBe(false);
    expect(replayed.queueProjection.active).toHaveLength(1);
    expect(replayed.queueProjection.deferred.some((item) => item.queueItemId === queueItemId)).toBe(false);
  });

  it("rejects stale state and invalid preconditions without events or effects", () => {
    const state = createInitialProductEngineState(projectId, sessionId);
    const stale = reduceProductEngineCommand(
      command("CaptureIntake", 1, {
        answer: "This should not persist"
      }, 2),
      state
    );
    const invalidStart = reduceProductEngineCommand(
      command("StartProject", 0, {
        rawIdea: "",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "balanced",
        businessCriticIntensityConfirmation: "user_confirmed"
      }, 1),
      state
    );

    expect(stale).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "STATE_VERSION_CONFLICT"
      },
      events: [],
      effectPlan: [],
      deterministicOutputs: []
    });
    expect(invalidStart).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED"
      },
      events: [],
      effectPlan: [],
      deterministicOutputs: []
    });
  });

  it("queues durable queue projection effects only for ambiguity analysis and active batch activation", () => {
    let state = createInitialProductEngineState(projectId, sessionId);
    const persistedEvents = [];
    const commands = [
      command("StartProject", 0, {
        rawIdea: "A focused founder brief generator",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "balanced",
        businessCriticIntensityConfirmation: "user_confirmed"
      }, 1),
      command("CaptureIntake", 1, {
        answer: "A session flow for founders."
      }, 2),
      command("DraftInitialSpec", 2, {}, 3),
      command("AnalyzeAmbiguity", 3, {
        targetRef: "current_spec",
        generatedQuestionSet: generatedBusinessQuestionSet()
      }, 4)
    ] as const;

    for (const nextCommand of commands) {
      const reduction = reduceProductEngineCommand(nextCommand, state);

      expect(reduction.accepted).toBe(true);
      persistedEvents.push(reduction.events[0]);
      state = replayProductEngineEvents(
        projectId,
        sessionId,
        persistedEvents.map((eventDraft, index) => ({
          ...eventDraft,
          eventId: `evt_queue_effect_${index + 1}`,
          sequence: index + 1,
          occurredAt: `2026-05-05T00:00:${index + 1}0.000Z`
        }))
      );

      if (nextCommand.commandType === "AnalyzeAmbiguity") {
        expect(reduction.effectPlan).toMatchObject([
          {
            effectType: "queue_projection_effect",
            sourceEventTypes: ["AmbiguityAnalyzed"],
            priority: "normal"
          }
        ]);
      } else {
        expect(reduction.effectPlan).toEqual([]);
      }
    }

    const activation = reduceProductEngineCommand(command("ActivateQuestionBatch", 4, {}, 5), state);

    expect(activation.accepted).toBe(true);
    expect(activation.effectPlan).toMatchObject([
      {
        effectType: "queue_projection_effect",
        sourceEventTypes: ["QuestionBatchActivated"],
        priority: "high"
      }
    ]);
    expect(activation.immediateProjection).toMatchObject({
      kind: "DecisionQueueProjection",
      active: expect.arrayContaining([
        expect.objectContaining({
          state: "active"
        })
      ])
    });
  });

  it("does not keep stale active-batch metadata after canonical queue refetch recovery", () => {
    const queueWithActiveItem: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 7 as ProjectionVersion,
      active: [
        {
          queueItemId: "queue_recovery_active" as QueueItemId,
          title: "Clarify the highest-risk assumption?",
          state: "active",
          severity: "high",
          topicKey: "highest_risk_assumption"
        }
      ],
      next: [],
      blocked: [],
      deferred: []
    };
    const withActiveBatch = decisionQueueProjectionWithRecovery(
      queueWithActiveItem,
      sessionId,
      "2026-05-05T00:00:05.000Z"
    );
    const recoveredWithoutActiveItems = decisionQueueProjectionWithRecovery(
      {
        ...withActiveBatch,
        version: 8 as ProjectionVersion,
        active: []
      },
      sessionId,
      "2026-05-05T00:00:06.000Z"
    );

    expect(withActiveBatch.activeBatch).toMatchObject({
      queueItemIds: ["queue_recovery_active"],
      priorityReason: expect.stringContaining("severity:high")
    });
    expect(recoveredWithoutActiveItems.activeBatch).toBeUndefined();
    expect(recoveredWithoutActiveItems.recovery).toMatchObject({
      status: "fresh",
      pendingEffectCount: 0,
      refetchUrl: `/api/v1/sessions/${sessionId}/queue`
    });
  });

  it("defaults to one active question and still supports explicit 1 to 5 item selection", () => {
    const openIssues = Array.from({ length: 6 }, (_, index) => ({
      queueItemId: `queue_explicit_${index + 1}` as QueueItemId,
      summary: `Ambiguity issue ${index + 1}`,
      status: "open" as const,
      questionText: `Question ${index + 1}?`,
      expectedAnswerType: "choice" as const,
      sourceRef: `issue_${index + 1}`
    }));
    const state = {
      ...withConfirmedBusinessPurposeMode(createInitialProductEngineState(projectId, sessionId)),
      stateVersion: 4 as StateVersion,
      openIssues
    };
    const implicitActivation = reduceProductEngineCommand(command("ActivateQuestionBatch", 4, {}, 5), state);
    const selectedQueueItemIds = openIssues.slice(1, 5).map((issue) => issue.queueItemId);
    const explicitActivation = reduceProductEngineCommand(
      command("ActivateQuestionBatch", 4, {
        queueItemIds: selectedQueueItemIds
      }, 5),
      state
    );
    const missingItemActivation = reduceProductEngineCommand(
      command("ActivateQuestionBatch", 4, {
        queueItemIds: [...selectedQueueItemIds.slice(0, 3), "queue_missing" as QueueItemId]
      }, 5),
      state
    );

    expect(implicitActivation.accepted).toBe(true);
    expect(implicitActivation.immediateProjection).toMatchObject({
      kind: "DecisionQueueProjection",
      active: [
        expect.objectContaining({
          queueItemId: openIssues[0]?.queueItemId,
          state: "active",
          cardType: "question"
        })
      ]
    });
    expect(explicitActivation.accepted).toBe(true);
    expect(explicitActivation.immediateProjection).toMatchObject({
      kind: "DecisionQueueProjection",
      active: selectedQueueItemIds.map((queueItemId) =>
        expect.objectContaining({
          queueItemId,
          state: "active"
        })
      )
    });
    expect(missingItemActivation).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "COMMAND_PRECONDITION_FAILED"
      }
    });
  });

  it("prioritizes high-severity ambiguity issues for the default question batch", () => {
    const openIssues = [
      { queueItemId: "queue_priority_medium_1" as QueueItemId, severity: "medium" as const },
      { queueItemId: "queue_priority_low" as QueueItemId, severity: "low" as const },
      { queueItemId: "queue_priority_high_1" as QueueItemId, severity: "high" as const },
      { queueItemId: "queue_priority_high_2" as QueueItemId, severity: "high" as const },
      { queueItemId: "queue_priority_high_3" as QueueItemId, severity: "high" as const },
      { queueItemId: "queue_priority_high_4" as QueueItemId, severity: "high" as const },
      { queueItemId: "queue_priority_high_5" as QueueItemId, severity: "high" as const },
      { queueItemId: "queue_priority_medium_2" as QueueItemId, severity: "medium" as const }
    ].map((issue, index) => ({
      ...issue,
      summary: `Priority issue ${index + 1}`,
      status: "open" as const,
      questionText: `Priority question ${index + 1}?`,
      sourceRef: `priority_${index + 1}`
    }));
    const state = {
      ...withConfirmedBusinessPurposeMode(createInitialProductEngineState(projectId, sessionId)),
      stateVersion: 4 as StateVersion,
      openIssues
    };
    const activation = reduceProductEngineCommand(command("ActivateQuestionBatch", 4, {}, 5), state);

    expect(activation.accepted).toBe(true);
    expect(activation.immediateProjection).toMatchObject({
      active: [
        expect.objectContaining({
          queueItemId: openIssues[2]?.queueItemId,
          state: "active",
          cardType: "question"
        })
      ]
    });
  });

  it("rejects question batches that would ask the same topic twice", () => {
    const openIssues = [
      {
        queueItemId: "queue_duplicate_topic_1" as QueueItemId,
        topicKey: "duplicate_topic",
        summary: "Duplicate topic issue 1",
        status: "open" as const,
        questionText: "First duplicate topic question?"
      },
      {
        queueItemId: "queue_duplicate_topic_2" as QueueItemId,
        topicKey: "duplicate_topic",
        summary: "Duplicate topic issue 2",
        status: "open" as const,
        questionText: "Second duplicate topic question?"
      },
      {
        queueItemId: "queue_distinct_topic" as QueueItemId,
        topicKey: "distinct_topic",
        summary: "Distinct topic issue",
        status: "open" as const,
        questionText: "Distinct topic question?"
      }
    ];
    const state = {
      ...withConfirmedBusinessPurposeMode(createInitialProductEngineState(projectId, sessionId)),
      stateVersion: 4 as StateVersion,
      openIssues
    };

    const activation = reduceProductEngineCommand(
      command("ActivateQuestionBatch", 4, {
        queueItemIds: openIssues.map((issue) => issue.queueItemId)
      }, 5),
      state
    );

    expect(activation).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "COMMAND_PRECONDITION_FAILED",
        message: "ActivateQuestionBatch requires at most one open issue per topicKey."
      }
    });
  });

  it("routes active question answers into durable research without replacing the active batch", () => {
    const commands = [
      command("StartProject", 0, {
        rawIdea: "A focused founder brief generator",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "balanced",
        businessCriticIntensityConfirmation: "user_confirmed"
      }, 1),
      command("CaptureIntake", 1, {
        answer: "A session flow for founders."
      }, 2),
      command("DraftInitialSpec", 2, {}, 3),
      command("AnalyzeAmbiguity", 3, {
        targetRef: "current_spec",
        generatedQuestionSet: generatedBusinessQuestionSet()
      }, 4),
      command("ActivateQuestionBatch", 4, {}, 5)
    ] as const;
    let state = createInitialProductEngineState(projectId, sessionId);
    const persistedEvents = [];

    for (const nextCommand of commands) {
      const reduction = reduceProductEngineCommand(nextCommand, state);

      expect(reduction.accepted).toBe(true);
      persistedEvents.push(reduction.events[0]);
      state = replayProductEngineEvents(
        projectId,
        sessionId,
        persistedEvents.map((eventDraft, index) => ({
          ...eventDraft,
          eventId: `evt_submit_answer_setup_${index + 1}`,
          sequence: index + 1,
          occurredAt: `2026-05-05T00:00:${index + 1}0.000Z`
        }))
      );
    }

    const activeItemIds = state.queueProjection.active.map((item) => item.queueItemId);
    const answeredQueueItemId =
      state.queueProjection.active.find((item) => item.topicKey === "primary_customer_narrowing")?.queueItemId ??
      activeItemIds[0];
    const blankAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: activeItemIds.find((itemId) => itemId !== answeredQueueItemId),
        answer: "   "
      }, 6),
      state
    );
    const unknownQuestionAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: "queue_missing" as QueueItemId,
        answer: "This answer must reference an active card."
      }, 6),
      state
    );
    const sourceIssue = state.openIssues.find((issue) => issue.queueItemId === answeredQueueItemId);
    const firstActiveItem = state.queueProjection.active.find((item) => item.queueItemId === answeredQueueItemId);

    if (!sourceIssue || !firstActiveItem) {
      throw new Error("Expected the setup state to contain an active source question.");
    }

    const visibleFollowUpAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: answeredQueueItemId,
        answer: "Narrow the first proof around founder teams with repeated manual planning pain."
      }, 7),
      {
        ...state,
        openIssues: [sourceIssue],
        queueProjection: {
          ...state.queueProjection,
          active: [firstActiveItem],
          next: [],
          blocked: [],
          deferred: []
        }
      }
    );
    const sensitiveFollowUpAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: answeredQueueItemId,
        answer: "Use api_key=sk-secret-answer-value only as a fake local note."
      }, 7),
      {
        ...state,
        openIssues: [sourceIssue],
        queueProjection: {
          ...state.queueProjection,
          active: [firstActiveItem],
          next: [],
          blocked: [],
          deferred: []
        }
      }
    );
    const answer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: answeredQueueItemId,
        answer: "The first validation decision should focus on paid founder urgency."
      }, 7),
      state
    );
    const broaderResearchAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: answeredQueueItemId,
        answer: "기존 리서치가 있어도 리서치가 더 필요하니 더 넓은 자료 수집과 반대 근거를 찾아주세요."
      }, 7),
      state
    );
    const broaderResearchOptionValueAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: answeredQueueItemId,
        answer: "지금 답하기에는 근거가 부족하므로 더 넓은 자료를 모은다."
      }, 7),
      state
    );
    const broaderCounterEvidenceOptionValueAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: answeredQueueItemId,
        answer: "찬성/반대를 정하기 전에 더 넓은 근거와 반례를 먼저 확인한다."
      }, 7),
      state
    );
    const broaderNaturalLanguageAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: answeredQueueItemId,
        answer: "아직 판단이 애매하니 자료를 더 찾아보고 조사를 더 해주세요."
      }, 7),
      state
    );
    const broaderEnglishSourceAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: answeredQueueItemId,
        answer: "Please find more sources and gather additional evidence before deciding."
      }, 7),
      state
    );
    const broaderKoreanEvidenceNeededAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: answeredQueueItemId,
        answer: "아직 근거가 더 필요합니다. 출처가 더 필요하니 넓게 확인해주세요."
      }, 7),
      state
    );
    const broaderEnglishEvidenceNeededAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: answeredQueueItemId,
        answer: "I need more evidence and additional sources before deciding."
      }, 7),
      state
    );
    const broaderEnglishPassiveEvidenceNeededAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: answeredQueueItemId,
        answer: "More evidence is needed before we choose this direction."
      }, 7),
      state
    );
    const noMoreResearchAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: answeredQueueItemId,
        answer: "리서치 필요 없음. 지금 답변으로 충분합니다."
      }, 7),
      state
    );
    const noMoreSourcesAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: answeredQueueItemId,
        answer: "자료를 더 찾을 필요 없음. 지금 답변으로 결정하겠습니다."
      }, 7),
      state
    );
    const noNeedToFindMoreSourcesAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: answeredQueueItemId,
        answer: "자료를 더 찾지 않아도 됩니다. 지금 답변으로 결정하겠습니다."
      }, 7),
      state
    );
    const noNeedToCollectMoreEvidenceAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: answeredQueueItemId,
        answer: "근거는 더 모으지 않아도 됩니다. 다음 단계로 넘어가겠습니다."
      }, 7),
      state
    );
    const noMoreEnglishResearchAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: answeredQueueItemId,
        answer: "No more research needed; do not find more sources."
      }, 7),
      state
    );
    const doNotNeedMoreResearchAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: answeredQueueItemId,
        answer: "I do not need more research; this is enough to decide."
      }, 7),
      state
    );
    const doNotNeedMoreEvidenceAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: answeredQueueItemId,
        answer: "I do not need more evidence; move forward."
      }, 7),
      state
    );
    const moreResearchNotNeededAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: answeredQueueItemId,
        answer: "More research is not needed; move forward with this answer."
      }, 7),
      state
    );

    expect(blankAnswer).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED"
      }
    });
    expect(unknownQuestionAnswer).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "COMMAND_PRECONDITION_FAILED"
      }
    });
    expect(visibleFollowUpAnswer.accepted).toBe(true);
    expect(visibleFollowUpAnswer.immediateProjection).toMatchObject({
      kind: "DecisionQueueProjection",
      active: [
        expect.objectContaining({
          cardType: "follow_up_question",
          state: "active",
          title: expect.stringContaining("지금 어떤 방법"),
          answerOptions: []
        })
      ],
      next: [
        expect.objectContaining({
          state: "next"
        })
      ]
    });
    expect(JSON.stringify(sensitiveFollowUpAnswer.immediateProjection)).not.toContain("sk-secret-answer-value");
    expect(answer.accepted).toBe(true);
    expect(broaderResearchAnswer.accepted).toBe(true);
    expect(broaderResearchAnswer.nextState.researchState.tasks[0]?.objective).toContain(
      "더 넓게 살펴봅니다"
    );
    expect(broaderResearchAnswer.nextState.researchState.tasks[0]?.objective).toContain(
      "사용자 미래"
    );
    expect(broaderResearchOptionValueAnswer.accepted).toBe(true);
    expect(broaderResearchOptionValueAnswer.nextState.researchState.tasks[0]?.objective).toContain(
      "더 넓게 살펴봅니다"
    );
    expect(broaderResearchOptionValueAnswer.nextState.researchState.tasks[0]?.objective).toContain(
      "사용자 미래"
    );
    expect(broaderCounterEvidenceOptionValueAnswer.accepted).toBe(true);
    expect(broaderCounterEvidenceOptionValueAnswer.nextState.researchState.tasks[0]?.objective).toContain(
      "더 넓게 살펴봅니다"
    );
    expect(broaderCounterEvidenceOptionValueAnswer.nextState.researchState.tasks[0]?.objective).toContain(
      "사용자 미래"
    );
    expect(broaderNaturalLanguageAnswer.accepted).toBe(true);
    expect(broaderNaturalLanguageAnswer.nextState.researchState.tasks[0]?.objective).toContain(
      "더 넓게 살펴봅니다"
    );
    expect(broaderNaturalLanguageAnswer.nextState.researchState.tasks[0]?.objective).toContain(
      "사용자 미래"
    );
    expect(broaderEnglishSourceAnswer.accepted).toBe(true);
    expect(broaderEnglishSourceAnswer.nextState.researchState.tasks[0]?.objective).toContain(
      "더 넓게 살펴봅니다"
    );
    expect(broaderEnglishSourceAnswer.nextState.researchState.tasks[0]?.objective).toContain(
      "사용자 미래"
    );
    expect(broaderKoreanEvidenceNeededAnswer.accepted).toBe(true);
    expect(broaderKoreanEvidenceNeededAnswer.nextState.researchState.tasks[0]?.objective).toContain(
      "더 넓게 살펴봅니다"
    );
    expect(broaderKoreanEvidenceNeededAnswer.nextState.researchState.tasks[0]?.objective).toContain(
      "사용자 미래"
    );
    expect(broaderEnglishEvidenceNeededAnswer.accepted).toBe(true);
    expect(broaderEnglishEvidenceNeededAnswer.nextState.researchState.tasks[0]?.objective).toContain(
      "더 넓게 살펴봅니다"
    );
    expect(broaderEnglishEvidenceNeededAnswer.nextState.researchState.tasks[0]?.objective).toContain(
      "사용자 미래"
    );
    expect(broaderEnglishPassiveEvidenceNeededAnswer.accepted).toBe(true);
    expect(broaderEnglishPassiveEvidenceNeededAnswer.nextState.researchState.tasks[0]?.objective).toContain(
      "더 넓게 살펴봅니다"
    );
    expect(broaderEnglishPassiveEvidenceNeededAnswer.nextState.researchState.tasks[0]?.objective).toContain(
      "사용자 미래"
    );
    expect(noMoreResearchAnswer.accepted).toBe(true);
    expect(noMoreResearchAnswer.nextState.researchState.tasks[0]?.objective).toContain("다음 기획 판단");
    expect(noMoreResearchAnswer.nextState.researchState.tasks[0]?.objective).not.toContain(
      "더 넓게 살펴봅니다"
    );
    expect(noMoreSourcesAnswer.accepted).toBe(true);
    expect(noMoreSourcesAnswer.nextState.researchState.tasks[0]?.objective).toContain("다음 기획 판단");
    expect(noMoreSourcesAnswer.nextState.researchState.tasks[0]?.objective).not.toContain(
      "더 넓게 살펴봅니다"
    );
    expect(noNeedToFindMoreSourcesAnswer.accepted).toBe(true);
    expect(noNeedToFindMoreSourcesAnswer.nextState.researchState.tasks[0]?.objective).toContain("다음 기획 판단");
    expect(noNeedToFindMoreSourcesAnswer.nextState.researchState.tasks[0]?.objective).not.toContain(
      "더 넓게 살펴봅니다"
    );
    expect(noNeedToCollectMoreEvidenceAnswer.accepted).toBe(true);
    expect(noNeedToCollectMoreEvidenceAnswer.nextState.researchState.tasks[0]?.objective).toContain("다음 기획 판단");
    expect(noNeedToCollectMoreEvidenceAnswer.nextState.researchState.tasks[0]?.objective).not.toContain(
      "더 넓게 살펴봅니다"
    );
    expect(noMoreEnglishResearchAnswer.accepted).toBe(true);
    expect(noMoreEnglishResearchAnswer.nextState.researchState.tasks[0]?.objective).toContain("다음 기획 판단");
    expect(noMoreEnglishResearchAnswer.nextState.researchState.tasks[0]?.objective).not.toContain(
      "더 넓게 살펴봅니다"
    );
    expect(doNotNeedMoreResearchAnswer.accepted).toBe(true);
    expect(doNotNeedMoreResearchAnswer.nextState.researchState.tasks[0]?.objective).toContain("다음 기획 판단");
    expect(doNotNeedMoreResearchAnswer.nextState.researchState.tasks[0]?.objective).not.toContain(
      "더 넓게 살펴봅니다"
    );
    expect(doNotNeedMoreEvidenceAnswer.accepted).toBe(true);
    expect(doNotNeedMoreEvidenceAnswer.nextState.researchState.tasks[0]?.objective).toContain("다음 기획 판단");
    expect(doNotNeedMoreEvidenceAnswer.nextState.researchState.tasks[0]?.objective).not.toContain(
      "더 넓게 살펴봅니다"
    );
    expect(moreResearchNotNeededAnswer.accepted).toBe(true);
    expect(moreResearchNotNeededAnswer.nextState.researchState.tasks[0]?.objective).toContain("다음 기획 판단");
    expect(moreResearchNotNeededAnswer.nextState.researchState.tasks[0]?.objective).not.toContain(
      "더 넓게 살펴봅니다"
    );
    expect(answer.effectPlan).toMatchObject([
      {
        effectType: "research_evidence_effect",
        sourceEventTypes: ["ResearchPlanned"],
        priority: "normal"
      }
    ]);
    expect(answer.events.map((event) => event.eventType)).toEqual(["AnswerSubmitted", "ResearchPlanned"]);
    expect(answer.deterministicOutputs.map((output) => output.outputType)).toEqual(
      expect.arrayContaining(["reducer_deterministic_output", "completeness_snapshot", "confidence_map"])
    );
    expect(answer.immediateProjection).toMatchObject({
      kind: "DecisionQueueProjection",
      active: [
        ...activeItemIds.filter((queueItemId) => queueItemId !== answeredQueueItemId).map((queueItemId) =>
          expect.objectContaining({
            queueItemId,
            state: "active"
          })
        ),
        expect.objectContaining({
          state: "active"
        })
      ],
      next: [
        expect.objectContaining({
          state: "next"
        })
      ]
    });
    expect((answer.immediateProjection as DecisionQueueProjection).active.map((item) => item.queueItemId)).not.toContain(
      answeredQueueItemId
    );
    expect(answer.nextState).toMatchObject({
      stateVersion: 7,
      session: {
        phase: "research"
      },
      completeness: {
        kind: "ConfidenceCompletionProjection",
        version: 7,
        completionCandidate: {
          status: "not_ready"
        }
      }
    });
    expect(answer.nextState.openIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "open",
          topicKey: expect.stringContaining("_follow_up_1"),
          repeatCount: 1,
          repeatLimit: 16,
          expectedAnswerType: "text",
          questionText: expect.stringContaining("지금 어떤 방법"),
          possibleRoutes: expect.arrayContaining(["question", "research_needed"])
        })
      ])
    );
    expect(answer.events[0]?.payload).toMatchObject({
      followUpQueueItemId: expect.stringMatching(/^queue_followup_/),
      followUpRepeatCount: 1,
      followUpRepeatLimit: 16
    });
    expect((answer.immediateProjection as DecisionQueueProjection).progress).toMatchObject({
      generatedQuestionCount: 17,
      openQuestionCount: 16,
      answeredQuestionCount: 1,
      terminalQuestionCount: 1,
      followUpQuestionCount: 1,
      followUpOpenQuestionCount: 1,
      topicCoverageCount: 17,
      openTopicCoverageCount: 16,
      followUpBudgetRemainingCount: 255,
      visibleQuestionDebtCount: 1,
      completionPercent: 6
    });

    const replayed = replayProductEngineEvents(projectId, sessionId, [
      ...persistedEvents.map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_submit_answer_replay_${index + 1}` as const,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:00:${index + 1}0.000Z`
      })),
      {
        ...answer.events[0],
        eventId: "evt_submit_answer_replay_6" as const,
        sequence: 6,
        occurredAt: "2026-05-05T00:01:00.000Z"
      },
      {
        ...answer.events[1],
        eventId: "evt_submit_answer_replay_7" as const,
        sequence: 7,
        occurredAt: "2026-05-05T00:01:01.000Z"
      }
    ]);

    expect(replayed.queueProjection.active.map((item) => item.queueItemId)).not.toContain(answeredQueueItemId);
    expect(replayed.queueProjection.active.every((item) => item.state === "active")).toBe(true);
    expect(replayed.queueProjection.active).toHaveLength(1);
    expect(replayed.queueProjection.next).toHaveLength(1);
    expect(replayed.queueProjection.progress).toMatchObject({
      generatedQuestionCount: 17,
      openQuestionCount: 16,
      answeredQuestionCount: 1,
      followUpQuestionCount: 1,
      topicCoverageCount: 17,
      openTopicCoverageCount: 16,
      followUpBudgetRemainingCount: 255,
      completionPercent: 6
    });
    expect(replayed.openIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          topicKey: expect.stringContaining("_follow_up_1"),
          repeatCount: 1,
          status: "open"
        })
      ])
    );
    expect(replayed.researchState.tasks).toHaveLength(1);
    expect(replayed.researchState.tasks[0]).toMatchObject({
      projectPurposeMode: "business",
      projectPurposeModeLabel: "사업화 검증 중심",
      projectPurposeModeEffect: expect.stringContaining("돈을 낼 이유")
    });
    expect(replayed.completeness).toMatchObject({
      kind: "ConfidenceCompletionProjection",
      version: 7,
      completionCandidate: {
        status: "not_ready"
      }
    });
    expect(replayed.researchState.reviewCards[0]).toMatchObject({
      state: "pending_manual_result",
      recoveryActions: expect.arrayContaining(["import_manual_result"])
    });
  });

  it("splits multi-line answers into multiple immediate follow-up ambiguity branches", () => {
    const { state, eventDrafts } = stateWithActiveQuestionBatch();
    const activeItem = state.queueProjection.active[0];

    if (!activeItem) {
      throw new Error("Expected an active question card.");
    }

    const answer = reduceProductEngineCommand(
      command("SubmitAnswer", Number(state.stateVersion), {
        queueItemId: activeItem.queueItemId,
        answer: [
          "- 첫 검증은 노령·만성질환 반려동물 보호자로 좁힌다.",
          "- 보험·의료비 지불의향은 추가 리서치가 필요하다.",
          "- 장례와 생애 후반 정보는 첫 버전 범위에서 제외할지 따로 판단해야 한다."
        ].join("\n")
      }, 6),
      state
    );

    expect(answer.accepted).toBe(true);
    expect(answer.events[0]?.payload).toMatchObject({
      researchTaskIds: [
        expect.stringMatching(/^research_task_/),
        expect.stringMatching(/^research_task_/),
        expect.stringMatching(/^research_task_/)
      ],
      followUpQueueItemIds: [
        expect.stringMatching(/^queue_followup_/),
        expect.stringMatching(/^queue_followup_/),
        expect.stringMatching(/^queue_followup_/)
      ],
      followUpRepeatCounts: [1, 2, 3]
    });
    expect(answer.events[1]?.payload).toMatchObject({
      researchTasks: [
        expect.objectContaining({
          sourceAnswerRef: expect.stringContaining("branch:1"),
          objective: expect.stringContaining("노령·만성질환 반려동물 보호자")
        }),
        expect.objectContaining({
          sourceAnswerRef: expect.stringContaining("branch:2"),
          objective: expect.stringContaining("보험·의료비 지불의향")
        }),
        expect.objectContaining({
          sourceAnswerRef: expect.stringContaining("branch:3"),
          objective: expect.stringContaining("장례와 생애 후반 정보")
        })
      ]
    });
    expect(answer.effectPlan.map((effect) => effect.inputRef.refId)).toEqual(answer.events[0]?.payload.researchTaskIds);
    expect(answer.nextState.researchState.tasks).toHaveLength(3);
    expect(answer.nextState.queueProjection.next.filter((item) => item.cardType === "research_review")).toHaveLength(3);

    const followUpIssues = answer.nextState.openIssues.filter((issue) =>
      issue.queueItemId.startsWith("queue_followup_")
    );

    expect(followUpIssues).toHaveLength(3);
    expect(followUpIssues.map((issue) => issue.repeatCount)).toEqual([1, 2, 3]);
    expect(followUpIssues.map((issue) => issue.sourceRef)).toEqual([
      expect.stringContaining("branch:1"),
      expect.stringContaining("branch:2"),
      expect.stringContaining("branch:3")
    ]);
    expect(followUpIssues.map((issue) => issue.questionText)).toEqual([
      expect.stringContaining("지금 어떤 방법"),
      expect.stringContaining("기획서 조각"),
      expect.stringContaining("초보 사용자와 이미 문서가 있는 사용자")
    ]);
    expect(followUpIssues[0]?.questionText).not.toContain("노령·만성질환 반려동물 보호자");
    expect(followUpIssues[1]?.questionText).not.toContain("보험·의료비 지불의향");
    expect(followUpIssues[2]?.questionText).not.toContain("장례와 생애 후반 정보");
    expect(followUpIssues.every((issue) => issue.questionContext?.idea === activeItem.questionContext?.idea)).toBe(true);
    expect(followUpIssues.every((issue) => issue.questionContext?.goal === activeItem.questionContext?.goal)).toBe(true);
    expect((answer.immediateProjection as DecisionQueueProjection).progress).toMatchObject({
      followUpQuestionCount: 3,
      followUpOpenQuestionCount: 3
    });

    const replayed = replayProductEngineEvents(projectId, sessionId, [
      ...eventDrafts.map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_multi_follow_up_setup_${index + 1}` as EventId,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:00:${index + 1}0.000Z`
      })),
      {
        ...answer.events[0],
        eventId: "evt_multi_follow_up_answer" as EventId,
        sequence: 6,
        occurredAt: "2026-05-05T00:01:00.000Z"
      },
      {
        ...answer.events[1],
        eventId: "evt_multi_follow_up_research" as EventId,
        sequence: 7,
        occurredAt: "2026-05-05T00:01:01.000Z"
      }
    ]);

    expect(replayed.openIssues.filter((issue) => issue.queueItemId.startsWith("queue_followup_"))).toHaveLength(3);
    expect(replayed.researchState.tasks).toHaveLength(3);
    expect(replayed.researchState.tasks.map((task) => task.sourceAnswerRef)).toEqual([
      expect.stringContaining("branch:1"),
      expect.stringContaining("branch:2"),
      expect.stringContaining("branch:3")
    ]);
    expect(replayed.queueProjection.progress).toMatchObject({
      followUpQuestionCount: 3,
      followUpOpenQuestionCount: 3
    });
  });

  it("imports manual research and blocks high-impact pro-only evidence as known risk", () => {
    const taskId = "research_task_high_impact" as const;
    const initialState = withConfirmedBusinessPurposeMode(createInitialProductEngineState(projectId, sessionId));
    const plannedTaskCommand = command("PlanResearch", 0, {
      objective: "Validate paid founder urgency",
      routeOutcome: "missing_con_evidence",
      impact: "high"
    }, 1);
    const planned = reduceProductEngineCommand(plannedTaskCommand, initialState);

    expect(planned.accepted).toBe(true);

    const plannedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_research_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:00:00.000Z"
      }
    ]);
    const researchTaskId = plannedState.researchState.taskIds[0] ?? taskId;
    const imported = reduceProductEngineCommand(
      command("ImportResearchResult", 1, {
        researchTaskId,
        sourceTitle: "Founder urgency evidence notes",
        result: "Pro: founders report urgency, but no skeptical con evidence was found.",
        limitationNotes: "Counter-evidence still needs a narrower skeptical search."
      }, 2),
      plannedState
    );

    expect(imported.accepted).toBe(true);
    expect(imported.events.map((event) => event.eventType)).toEqual(["ResearchResultImported"]);
    expect(imported.effectPlan).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          effectType: "research_evidence_effect",
          sourceEventTypes: ["ResearchResultImported"],
          idempotencyKey: expect.stringMatching(/^research-result:/)
        })
      ])
    );
    expect(imported.immediateProjection).toBeUndefined();
    expect(imported.nextState).toMatchObject({
      researchState: {
        evidenceMatrices: []
      }
    });

    const importedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_research_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:00:00.000Z"
      },
      {
        ...imported.events[0],
        eventId: "evt_research_import",
        sequence: 2,
        occurredAt: "2026-05-05T00:00:01.000Z"
      }
    ]);
    const researchResultId = importedState.researchState.results[0]?.researchResultId;
    const synthesized = reduceProductEngineCommand(
      effectExecutorCommand("SynthesizeEvidence", 2, {
        researchResultId
      }, 3),
      importedState
    );

    expect(synthesized.accepted).toBe(true);
    expect(synthesized.immediateProjection).toBeUndefined();
    expect(synthesized.deterministicOutputs.map((output) => output.outputType)).toEqual(
      expect.arrayContaining(["reducer_deterministic_output", "completeness_snapshot", "confidence_map"])
    );
    expect(synthesized.nextState).toMatchObject({
      researchState: {
        proConBalanceStatus: "missing_con_evidence",
        evidenceMatrices: [
          expect.objectContaining({
            balanceStatus: "missing_con_evidence",
            decisionBlocked: true,
            additionalQuestions: [
              expect.stringContaining("paid founder urgency를 조금 더 구체화")
            ]
          })
        ],
        reviewCards: expect.arrayContaining([
          expect.objectContaining({
            additionalQuestions: [
              expect.stringContaining("paid founder urgency를 조금 더 구체화")
            ]
          }),
          expect.objectContaining({
            cardType: "research_review",
            retainedSourceRef: expect.stringMatching(/^queue_research_followup_/),
            state: "pending_manual_result",
            title: expect.stringContaining("다른 관점 확인 필요")
          })
        ]),
        knownRisks: [
          expect.stringContaining("missing_con_evidence")
        ]
      },
      openIssues: [
        expect.objectContaining({
          queueItemId: expect.stringMatching(/^queue_research_followup_/),
          status: "open",
          uncertaintyType: "missing_con_evidence",
          expectedAnswerType: "evidence",
          answerSelectionMode: "single",
          answerOptions: expect.arrayContaining([
            expect.objectContaining({ label: expect.stringContaining("근거") })
          ]),
          repeatCount: 1,
          repeatLimit: 16,
          topicKey: expect.stringContaining("_follow_up_1"),
          ambiguityRoutingPath: "current_research",
          severity: "high",
          researchQuestion: expect.stringContaining("Validate paid"),
          suggestedResearchTask: expect.stringContaining("추가 질문"),
          questionText: expect.stringContaining("paid founder urgency를 조금 더 구체화"),
          whyItMatters: expect.stringMatching(
            /리서치 (?:메모리|근거) 요약:\n- 확인된 단서: Pro: founders report urgency, but no skeptical con (?:evidence|근거) was found\.[\s\S]*\n- 한계\/불확실성: (?:Counter-(?:evidence|근거)|반례) still needs a narrower skeptical search\.[\s\S]*\n- 출처 단서: (?:Founder|만드는 사람) urgency (?:evidence|근거) notes/u
          ),
          decisionItUnlocks: expect.stringMatching(/(?:Founder|만드는 사람) urgency 근거 notes/u),
          possibleRoutes: expect.arrayContaining(["question", "missing_con_evidence", "research_needed"]),
          sourceRef: expect.stringContaining(`research:${researchTaskId}:`)
        })
      ],
      queueProjection: {
        active: [
          expect.objectContaining({
            cardType: "follow_up_question",
            title: expect.stringContaining("paid founder urgency를 조금 더 구체화"),
            state: "active",
            topicKey: expect.stringContaining("_follow_up_1"),
            ambiguityRoutingPath: "current_research",
            severity: "high",
            researchQuestion: expect.stringContaining("Validate paid"),
            suggestedResearchTask: expect.stringContaining("추가 질문"),
            whyItMatters: expect.stringMatching(/리서치 (?:메모리|근거) 요약/u),
            sourceRef: expect.stringContaining(`research:${researchTaskId}:`)
          })
        ],
        blocked: expect.arrayContaining([
          expect.objectContaining({
            additionalQuestions: [
              expect.stringContaining("paid founder urgency를 조금 더 구체화")
            ]
          }),
          expect.objectContaining({
            cardType: "research_review",
            state: "blocked",
            title: expect.stringContaining("후속 대안 리서치 대기")
          })
        ]),
        progress: expect.objectContaining({
          generatedQuestionCount: 1,
          openQuestionCount: 1,
          followUpQuestionCount: 1,
          followUpOpenQuestionCount: 1,
          visibleQuestionDebtCount: 1,
          completionPercent: 0
        })
      },
      completeness: {
        kind: "ConfidenceCompletionProjection",
        completionCandidate: {
          status: "not_ready"
        },
        topRisks: expect.arrayContaining([
          expect.stringContaining("missing_con_evidence"),
          expect.stringContaining("Research-updated risk_acceptance card blocks Planning-ready")
        ])
      }
    });
    const researchFollowUpIssue = synthesized.nextState.openIssues.find(
      (issue) => issue.queueItemId.startsWith("queue_research_followup_")
    );
    const researchFollowUpResearchTask = synthesized.nextState.researchState.tasks.find(
      (task) => task.sourceQueueItemId === researchFollowUpIssue?.queueItemId
    );

    expect(researchFollowUpIssue?.answerOptions?.length).toBeGreaterThanOrEqual(3);
    expect(researchFollowUpIssue?.answerOptions?.length).toBeLessThanOrEqual(10);
    expect(researchFollowUpResearchTask).toMatchObject({
      sourceQueueItemId: researchFollowUpIssue?.queueItemId,
      routeOutcome: "missing_con_evidence",
      impact: "high",
      status: "planned",
      objective: expect.stringMatching(/기존 리서치 메모[\s\S]*추가 질문/u)
    });
    expect(synthesized.effectPlan).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          effectType: "research_evidence_effect",
          sourceEventTypes: ["EvidenceSynthesized"],
          inputRef: {
            refType: "ResearchTask",
            refId: researchFollowUpResearchTask?.researchTaskId
          },
          idempotencyKey: researchFollowUpResearchTask
            ? `research:${researchFollowUpResearchTask.researchTaskId}`
            : expect.stringMatching(/^research:/)
        })
      ])
    );
    expect(synthesized.events[0]?.payload).toMatchObject({
      researchFollowUpQueueItemIds: [expect.stringMatching(/^queue_research_followup_/)],
      researchFollowUpResearchTaskIds: [researchFollowUpResearchTask?.researchTaskId]
    });

    const replayedSynthesized = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_research_plan_replay",
        sequence: 1,
        occurredAt: "2026-05-05T00:00:00.000Z"
      },
      {
        ...imported.events[0],
        eventId: "evt_research_import_replay",
        sequence: 2,
        occurredAt: "2026-05-05T00:00:01.000Z"
      },
      {
        ...synthesized.events[0],
        eventId: "evt_research_synthesized_replay",
        sequence: 3,
        occurredAt: "2026-05-05T00:00:02.000Z"
      }
    ]);

    expect(replayedSynthesized.openIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          queueItemId: expect.stringMatching(/^queue_research_followup_/),
          status: "open",
          questionText: expect.stringContaining("paid founder urgency를 조금 더 구체화")
        })
      ])
    );
    expect(replayedSynthesized.researchState.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          researchTaskId: researchFollowUpResearchTask?.researchTaskId,
          sourceQueueItemId: researchFollowUpIssue?.queueItemId,
          routeOutcome: "missing_con_evidence",
          status: "planned"
        })
      ])
    );
    expect(replayedSynthesized.queueProjection.active).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cardType: "follow_up_question",
          title: expect.stringContaining("paid founder urgency를 조금 더 구체화"),
          sourceRef: expect.stringContaining(`research:${researchTaskId}:`)
        })
      ])
    );

    const synthesizedState = {
      ...importedState,
      ...synthesized.nextState
    } as ProductEngineStateSnapshot;
    const originalResearchFollowUpId = synthesizedState.queueProjection.active.find(
      (item) => item.cardType === "follow_up_question"
    )?.queueItemId;

    expect(originalResearchFollowUpId).toBeDefined();

    const stateAfterClosedResearchFollowUp = {
      ...synthesizedState,
      openIssues: synthesizedState.openIssues.map((issue) =>
        issue.queueItemId === originalResearchFollowUpId
          ? {
              ...issue,
              status: "answered" as const
            }
          : issue
      ),
      queueProjection: {
        ...synthesizedState.queueProjection,
        active: synthesizedState.queueProjection.active.filter((item) => item.queueItemId !== originalResearchFollowUpId),
        next: synthesizedState.queueProjection.next.filter((item) => item.queueItemId !== originalResearchFollowUpId),
        blocked: synthesizedState.queueProjection.blocked.filter((item) => item.queueItemId !== originalResearchFollowUpId),
        deferred: synthesizedState.queueProjection.deferred.filter((item) => item.queueItemId !== originalResearchFollowUpId)
      }
    } as ProductEngineStateSnapshot;
    const resynthesized = reduceProductEngineCommand(
      effectExecutorCommand("SynthesizeEvidence", stateAfterClosedResearchFollowUp.stateVersion, { researchResultId }, 4),
      stateAfterClosedResearchFollowUp
    );
    const resynthesizedQueue = resynthesized.nextState.queueProjection as DecisionQueueProjection;
    const resynthesizedQueueIds = [
      ...resynthesizedQueue.active,
      ...resynthesizedQueue.next,
      ...resynthesizedQueue.blocked,
      ...resynthesizedQueue.deferred
    ].map((item) => item.queueItemId);

    expect(resynthesized.accepted).toBe(true);
    expect(resynthesizedQueueIds).not.toContain(originalResearchFollowUpId);
    expect(resynthesized.nextState.openIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          queueItemId: originalResearchFollowUpId,
          status: "answered"
        })
      ])
    );
    expect(resynthesized.events[0]?.payload).not.toHaveProperty("researchFollowUpQueueItemIds");
  });

  it("keeps ambiguity routing metadata on research-generated follow-up questions", () => {
    const sourceIssue = {
      queueItemId: "queue_pet_scope_source" as QueueItemId,
      sectionRef: "Target Customer",
      topicKey: "pet_lifecycle_first_guardian_focus",
      uncertaintyType: "vague",
      severity: "high",
      summary: "첫 검증 보호자 유형이 아직 넓음",
      whyItMatters:
        "보호자 유형별로 의료, 보험, 일상 기록 문제가 달라지므로 첫 구현 범위가 달라집니다.",
      status: "open",
      questionText: "반려동물 전생애 관리 앱을 가장 먼저 테스트할 보호자 유형은 누구인가요?",
      expectedAnswerType: "choice",
      decisionItUnlocks: "첫 고객 인터뷰 대상과 초기 화면의 기록 범위를 정합니다.",
      ambiguityDimension: "scope",
      ambiguityRoutingPath: "current_research",
      researchQuestion:
        "보호자 유형별로 의료·보험·일상 기록 관리 니즈가 실제로 어떻게 다른지 확인할 공개 단서와 반례는 무엇인가?",
      suggestedResearchTask: "반려동물 보호자 유형별 의료·보험·일상 기록 관리 니즈를 비교합니다.",
      possibleRoutes: ["question", "research_needed"],
      questionContext: {
        idea: "반려동물 전생애 관리 앱",
        goal: "보호자 기록 관리를 쉽게 만든다."
      }
    } satisfies ProductEngineStateSnapshot["openIssues"][number];
    const initialState = {
      ...withConfirmedBusinessPurposeMode(createInitialProductEngineState(projectId, sessionId)),
      openIssues: [sourceIssue]
    } as ProductEngineStateSnapshot;
    const planned = reduceProductEngineCommand(
      command("PlanResearch", 0, {
        sourceQueueItemId: sourceIssue.queueItemId,
        objective: "Validate pet guardian segment evidence",
        routeOutcome: "missing_con_evidence",
        impact: "high"
      }, 1),
      initialState
    );

    expect(planned.accepted).toBe(true);

    const plannedState = {
      ...initialState,
      ...planned.nextState
    } as ProductEngineStateSnapshot;
    const researchTaskId = plannedState.researchState.taskIds[0];

    if (!researchTaskId) {
      throw new Error("Expected PlanResearch to create a research task id.");
    }

    const imported = reduceProductEngineCommand(
      command("ImportResearchResult", Number(plannedState.stateVersion), {
        researchTaskId,
        sourceTitle: "Pet guardian record-management notes",
        result: "Pro: senior chronic pet guardians report fragmented medical and insurance records.",
        limitationNotes: "Counter-evidence for first-pet guardians still needs a narrower search."
      }, 2),
      plannedState
    );

    expect(imported.accepted).toBe(true);

    const importedState = {
      ...plannedState,
      ...imported.nextState
    } as ProductEngineStateSnapshot;
    const synthesized = reduceProductEngineCommand(
      effectExecutorCommand("SynthesizeEvidence", Number(importedState.stateVersion), { researchResultId: importedState.researchState.results[0]?.researchResultId }, 3),
      importedState
    );

    expect(synthesized.accepted).toBe(true);

    const researchFollowUpIssue = synthesized.nextState.openIssues.find((issue) =>
      issue.queueItemId.startsWith("queue_research_followup_")
    );
    const researchFollowUpCard = synthesized.nextState.queueProjection.active.find((item) =>
      item.queueItemId === researchFollowUpIssue?.queueItemId
    );

    expect(researchFollowUpIssue).toMatchObject({
      ambiguityDimension: "scope",
      ambiguityRoutingPath: "current_research",
      researchQuestion: sourceIssue.researchQuestion,
      questionContext: sourceIssue.questionContext,
      sourceRef: expect.stringContaining(`research:${researchTaskId}:`)
    });
    expect(researchFollowUpCard).toMatchObject({
      ambiguityDimension: "scope",
      ambiguityRoutingPath: "current_research",
      researchQuestion: sourceIssue.researchQuestion,
      questionContext: sourceIssue.questionContext,
      suggestedResearchTask: expect.stringContaining("추가 질문")
    });
  });

  it("does not invent generic founder candidates from incidental customer evidence", () => {
    const initialState = withConfirmedBusinessPurposeMode(createInitialProductEngineState(projectId, sessionId));
    const planned = reduceProductEngineCommand(
      command("PlanResearch", 0, {
        objective: "초기 고객 세그먼트와 사용자 성향 좁히기",
        routeOutcome: "missing_con_evidence",
        impact: "high"
      }, 1),
      initialState
    );

    expect(planned.accepted).toBe(true);

    const plannedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_research_plan_candidates",
        sequence: 1,
        occurredAt: "2026-05-05T00:00:00.000Z"
      }
    ]);
    const researchTaskId = plannedState.researchState.taskIds[0];

    if (!researchTaskId) {
      throw new Error("Expected PlanResearch to create a research task id.");
    }

    const imported = reduceProductEngineCommand(
      command("ImportResearchResult", 1, {
        researchTaskId,
        sourceTitle: "Customer segment evidence notes",
        result: "Pro: solo founders repeatedly organize product decisions manually.",
        limitationNotes: "Domain expert builder and team leader samples remain narrow."
      }, 2),
      plannedState
    );

    expect(imported.accepted).toBe(true);

    const importedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_research_plan_candidates_replay",
        sequence: 1,
        occurredAt: "2026-05-05T00:00:00.000Z"
      },
      {
        ...imported.events[0],
        eventId: "evt_research_import_candidates_replay",
        sequence: 2,
        occurredAt: "2026-05-05T00:00:01.000Z"
      }
    ]);
    const researchResultId = importedState.researchState.results[0]?.researchResultId;
    const synthesized = reduceProductEngineCommand(
      effectExecutorCommand("SynthesizeEvidence", 2, {
        researchResultId
      }, 3),
      importedState
    );

    expect(synthesized.accepted).toBe(true);
    const additionalQuestion = synthesized.nextState.researchState.evidenceMatrices[0]?.additionalQuestions[0] ?? "";

    expect(additionalQuestion).toContain("선택지 없이");
    expect(additionalQuestion).toContain("이 아이디어에 맞는 첫 고객 후보를 2~4개로 직접 적고");
    expect(additionalQuestion).not.toContain("혼자 만드는 초기 창업자");
    expect(additionalQuestion).not.toContain("도메인 전문 1인 빌더");
    expect(additionalQuestion).not.toContain("팀 리더/운영 담당자");

    const researchFollowUpIssue = synthesized.nextState.openIssues.find((issue) =>
      issue.queueItemId.startsWith("queue_research_followup_")
    );

    expect(researchFollowUpIssue).toMatchObject({
      expectedAnswerType: "text",
      questionText: expect.stringContaining("선택지 없이")
    });
    expect(researchFollowUpIssue?.answerOptions).toEqual([]);
    expect(synthesized.nextState.queueProjection.active).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cardType: "follow_up_question",
          title: expect.stringContaining("선택지 없이"),
          expectedAnswerType: "text",
          answerOptions: []
        })
      ])
    );
  });

  it("carries generic multi-choice candidates from the research objective into queue answer options", () => {
    const initialState = withConfirmedBusinessPurposeMode(createInitialProductEngineState(projectId, sessionId));
    const planned = reduceProductEngineCommand(
      command("PlanResearch", 0, {
        objective: "기능 후보는 빠른 온보딩, 수동 검증, 가격 테스트입니다. 여러 종류 중 하나 혹은 여러 개를 선택해야 하는 후보 결정",
        routeOutcome: "missing_con_evidence",
        impact: "high"
      }, 1),
      initialState
    );

    expect(planned.accepted).toBe(true);

    const plannedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_research_plan_generic_candidates",
        sequence: 1,
        occurredAt: "2026-05-05T00:00:00.000Z"
      }
    ]);
    const researchTaskId = plannedState.researchState.taskIds[0];

    if (!researchTaskId) {
      throw new Error("Expected PlanResearch to create a research task id.");
    }

    const imported = reduceProductEngineCommand(
      command("ImportResearchResult", 1, {
        researchTaskId,
        sourceTitle: "Feature candidate evidence notes",
        result: "Pro: onboarding, manual validation, and pricing tests may all apply to the first validation batch.",
        limitationNotes: "The exact combination still needs a user decision."
      }, 2),
      plannedState
    );

    expect(imported.accepted).toBe(true);

    const importedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_research_plan_generic_candidates_replay",
        sequence: 1,
        occurredAt: "2026-05-05T00:00:00.000Z"
      },
      {
        ...imported.events[0],
        eventId: "evt_research_import_generic_candidates_replay",
        sequence: 2,
        occurredAt: "2026-05-05T00:00:01.000Z"
      }
    ]);
    const researchResultId = importedState.researchState.results[0]?.researchResultId;
    const synthesized = reduceProductEngineCommand(
      effectExecutorCommand("SynthesizeEvidence", 2, {
        researchResultId
      }, 3),
      importedState
    );

    expect(synthesized.accepted).toBe(true);
    expect(synthesized.nextState.researchState.evidenceMatrices[0]?.additionalQuestions[0]).toContain(
      "- 빠른 온보딩"
    );
    expect(synthesized.nextState.researchState.evidenceMatrices[0]?.additionalQuestions[0]).toContain(
      "- 수동 검증"
    );
    expect(synthesized.nextState.researchState.evidenceMatrices[0]?.additionalQuestions[0]).toContain(
      "- 가격 테스트"
    );

    const researchFollowUpIssue = synthesized.nextState.openIssues.find((issue) =>
      issue.queueItemId.startsWith("queue_research_followup_")
    );

    expect(researchFollowUpIssue).toMatchObject({
      expectedAnswerType: "choice",
      answerSelectionMode: "multiple",
      questionText: expect.stringContaining("하나 이상 선택")
    });
    expect(researchFollowUpIssue?.answerOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "question_candidate_1", label: "빠른 온보딩" }),
        expect.objectContaining({ id: "question_candidate_2", label: "수동 검증" }),
        expect.objectContaining({ id: "question_candidate_3", label: "가격 테스트" })
      ])
    );
    expect(synthesized.nextState.queueProjection.active).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cardType: "follow_up_question",
          answerSelectionMode: "multiple",
          answerOptions: expect.arrayContaining([
            expect.objectContaining({ label: "빠른 온보딩" }),
            expect.objectContaining({ label: "수동 검증" }),
            expect.objectContaining({ label: "가격 테스트" })
          ])
        })
      ])
    );
  });

  it("marks conflict-review research follow-up tasks distinctly from generic research", () => {
    const initialState = withConfirmedBusinessPurposeMode(createInitialProductEngineState(projectId, sessionId));
    const conflictPlanned = reduceProductEngineCommand(
      command("PlanResearch", 0, {
        objective: "이혼 준비자를 위한 현금 runway와 유료 의향 검증",
        sourceQueueItemId: "queue_conflict_review_source",
        routeOutcome: "research_needed",
        impact: "high"
      }, 1),
      initialState
    );

    expect(conflictPlanned.accepted).toBe(true);

    const conflictTaskId = conflictPlanned.nextState.researchState.taskIds[0];
    const conflictPlannedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...conflictPlanned.events[0],
        eventId: "evt_conflict_review_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:00:00.000Z"
      }
    ]);
    const conflictImported = reduceProductEngineCommand(
      command("ImportResearchResult", 1, {
        researchTaskId: conflictTaskId,
        result: [
          "Research objective:",
          "이혼 준비자를 위한 현금 runway와 유료 의향 검증",
          "Usable findings:",
          "- [supports] 유료 상담 결제 의향을 후기에 남겼다. — 이혼 전 재무 상담 후기 https://example.org/divorce-paid",
          "- [weakens] 무료 법률구조와 커뮤니티 조언이 대체재로 언급되었다. — 무료 대체재 비교 https://example.org/divorce-free-alternatives",
          "Limitations:",
          "- 공개 snippet 기반이라 실제 결제 전환은 인터뷰로 확인해야 합니다."
        ].join("\n"),
        limitationNotes: "공개 snippet 기반이라 실제 결제 전환은 인터뷰로 확인해야 합니다.",
        sourceReliability: "medium"
      }, 2),
      conflictPlannedState
    );

    expect(conflictImported.accepted).toBe(true);

    const conflictImportedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...conflictPlanned.events[0],
        eventId: "evt_conflict_review_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:00:00.000Z"
      },
      {
        ...conflictImported.events[0],
        eventId: "evt_conflict_review_import",
        sequence: 2,
        occurredAt: "2026-05-05T00:00:01.000Z"
      }
    ]);
    const conflictResultId = conflictImportedState.researchState.results[0]?.researchResultId;
    const conflictSynthesized = reduceProductEngineCommand(
      effectExecutorCommand("SynthesizeEvidence", 2, {
        researchResultId: conflictResultId
      }, 3),
      conflictImportedState
    );

    expect(conflictSynthesized.accepted).toBe(true);
    expect(conflictSynthesized.nextState.openIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uncertaintyType: "conflict",
          possibleRoutes: expect.arrayContaining(["conflict_detected"]),
          questionText: expect.stringContaining("Conflict review:")
        })
      ])
    );
    expect(conflictSynthesized.nextState.researchState.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceQueueItemId: expect.stringMatching(/^queue_research_followup_/),
          routeOutcome: "conflict_review"
        })
      ])
    );
  });

  it("persists a decision-linked Evidence Pack and keeps unknown quality gates in review", () => {
    const initialState = withConfirmedBusinessPurposeMode(createInitialProductEngineState(projectId, sessionId));
    const planned = reduceProductEngineCommand(
      command("PlanResearch", 0, {
        objective: "Validate implementation readiness claim",
        sourceQueueItemId: "queue_quality_gate_unknown",
        routeOutcome: "research_needed",
        impact: "high"
      }, 1),
      initialState
    );

    expect(planned.accepted).toBe(true);

    const plannedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_quality_gate_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:00:00.000Z"
      }
    ]);
    const researchTaskId = plannedState.researchState.taskIds[0];
    const imported = reduceProductEngineCommand(
      command("ImportResearchResult", 1, {
        researchTaskId,
        researchRunId: "research_run_unknown_gate",
        result: "Pro: implementation looks feasible. Con: integration risk remains.",
        sourceReliability: "unknown",
        limitationNotes: "Source reliability was not captured.",
        claim: "Implementation is ready for a planning handoff.",
        decisionContext: "implementation_readiness",
        specSectionRef: "spec:implementation",
        questionRef: "queue_quality_gate_unknown"
      }, 2),
      plannedState
    );

    expect(imported.accepted).toBe(true);

    const importedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_quality_gate_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:00:00.000Z"
      },
      {
        ...imported.events[0],
        eventId: "evt_quality_gate_import",
        sequence: 2,
        occurredAt: "2026-05-05T00:00:01.000Z"
      }
    ]);
    const researchResultId = importedState.researchState.results[0]?.researchResultId;
    const synthesized = reduceProductEngineCommand(
      effectExecutorCommand("SynthesizeEvidence", 2, { researchResultId }, 3),
      importedState
    );

    expect(synthesized.accepted).toBe(true);
    expect(synthesized.nextState).toMatchObject({
      researchState: {
        tasks: [
          expect.objectContaining({
            researchTaskId,
            status: "needs_review"
          })
        ],
        evidencePacks: [
          expect.objectContaining({
            researchRunId: "research_run_unknown_gate",
            gateStatus: "needs_review",
            claim: "Implementation is ready for a planning handoff.",
            specSectionRef: "spec:implementation"
          })
        ],
        reviewCards: [
          expect.objectContaining({
            state: "quality_gate_review",
            reviewReason: expect.stringContaining("insufficient")
          })
        ]
      },
      queueProjection: {
        blocked: [
          expect.objectContaining({
            queueItemId: `research_review_${researchTaskId}`,
            title: expect.stringContaining("근거 품질 검토 필요")
          })
        ]
      }
    });
    expect(synthesized.events[0]?.payload).toMatchObject({
      evidencePack: {
        gateStatus: "needs_review"
      }
    });
  });

  it("keeps balanced but low-reliability high-impact evidence blocked by the quality gate", () => {
    const planned = reduceProductEngineCommand(
      command("PlanResearch", 0, {
        objective: "Validate low-reliability market urgency claim",
        routeOutcome: "research_needed",
        impact: "high"
      }, 1),
      withConfirmedBusinessPurposeMode(createInitialProductEngineState(projectId, sessionId))
    );

    expect(planned.accepted).toBe(true);

    const plannedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_low_reliability_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:00:00.000Z"
      }
    ]);
    const researchTaskId = plannedState.researchState.taskIds[0];
    const imported = reduceProductEngineCommand(
      command("ImportResearchResult", 1, {
        researchTaskId,
        result: "Pro: founders report urgency. Con: incumbent workflows may already be good enough.",
        sourceReliability: "low",
        limitationNotes: "Source was anecdotal and needs a higher-reliability follow-up."
      }, 2),
      plannedState
    );

    expect(imported.accepted).toBe(true);

    const importedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_low_reliability_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:00:00.000Z"
      },
      {
        ...imported.events[0],
        eventId: "evt_low_reliability_import",
        sequence: 2,
        occurredAt: "2026-05-05T00:00:01.000Z"
      }
    ]);
    const researchResultId = importedState.researchState.results[0]?.researchResultId;
    const synthesized = reduceProductEngineCommand(
      effectExecutorCommand("SynthesizeEvidence", 2, { researchResultId }, 3),
      importedState
    );

    expect(synthesized.accepted).toBe(true);
    expect(synthesized.nextState).toMatchObject({
      researchState: {
        tasks: [
          expect.objectContaining({
            researchTaskId,
            status: "research_insufficient"
          })
        ],
        evidenceMatrices: [
          expect.objectContaining({
            balanceStatus: "balanced",
            decisionBlocked: false
          })
        ],
        evidencePacks: [
          expect.objectContaining({
            gateStatus: "research_insufficient"
          })
        ],
        reviewCards: [
          expect.objectContaining({
            state: "research_insufficient",
            reviewReason: expect.stringContaining("Low-reliability source")
          })
        ]
      },
      queueProjection: {
        blocked: [
          expect.objectContaining({
            queueItemId: `research_review_${researchTaskId}`,
            title: expect.stringContaining("추가 근거 필요")
          })
        ]
      }
    });
  });

  it("projects accepted Evidence Packs into decision-approval cards and resolves terminal outcomes", () => {
    const planned = reduceProductEngineCommand(
      command("PlanResearch", 0, {
        objective: "Validate high-impact pricing evidence",
        routeOutcome: "research_needed",
        impact: "high"
      }, 1),
      withConfirmedBusinessPurposeMode(createInitialProductEngineState(projectId, sessionId))
    );

    expect(planned.accepted).toBe(true);

    const plannedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_decision_approval_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:04:00.000Z"
      }
    ]);
    const researchTaskId = plannedState.researchState.taskIds[0];
    const imported = reduceProductEngineCommand(
      command("ImportResearchResult", 1, {
        researchTaskId,
        result: "Pro: paid founders show urgency. Con: some founders still prefer spreadsheets.",
        sourceReliability: "high",
        limitationNotes: "Manual import retained both support and counter-evidence.",
        claim: "Pricing evidence supports concierge validation.",
        decisionContext: "value",
        specSectionRef: "spec:value"
      }, 2),
      plannedState
    );

    expect(imported.accepted).toBe(true);

    const importedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_decision_approval_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:04:00.000Z"
      },
      {
        ...imported.events[0],
        eventId: "evt_decision_approval_import",
        sequence: 2,
        occurredAt: "2026-05-05T00:04:10.000Z"
      }
    ]);
    const researchResultId = importedState.researchState.results[0]?.researchResultId;
    const synthesized = reduceProductEngineCommand(
      effectExecutorCommand("SynthesizeEvidence", 2, { researchResultId }, 3),
      importedState
    );

    expect(synthesized.accepted).toBe(true);
    expect(synthesized.nextState).toMatchObject({
      researchState: {
        reviewCards: [
          expect.objectContaining({
            cardType: "decision_approval",
            impact: "high",
            evidencePackId: expect.stringMatching(/^evidence_pack_/),
            availableOutcomes: expect.arrayContaining(["approved", "revised", "rejected", "deferred"]),
            blocksPlanning: true
          })
        ]
      },
      queueProjection: {
        next: [
          expect.objectContaining({
            cardType: "decision_approval",
            blocksPlanning: true
          })
        ]
      },
      completeness: {
        gates: expect.arrayContaining([
          expect.objectContaining({
            gateId: "research_queue_cards",
            passed: false
          })
        ])
      }
    });

    const synthesizedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_decision_approval_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:04:00.000Z"
      },
      {
        ...imported.events[0],
        eventId: "evt_decision_approval_import",
        sequence: 2,
        occurredAt: "2026-05-05T00:04:10.000Z"
      },
      {
        ...synthesized.events[0],
        eventId: "evt_decision_approval_synthesized",
        sequence: 3,
        occurredAt: "2026-05-05T00:04:20.000Z"
      }
    ]);
    const cardId = synthesizedState.researchState.reviewCards[0]?.cardId;
    const resolved = reduceProductEngineCommand(
      command("ResolveResearchQueueCard", 3, {
        cardId,
        outcome: "approved"
      }, 4),
      synthesizedState
    );

    expect(resolved.accepted).toBe(true);
    expect(resolved.events[0]).toMatchObject({
      eventType: "ResearchQueueCardResolved",
      payload: {
        cardId,
        outcome: "approved"
      }
    });
    expect(resolved.nextState).toMatchObject({
      researchState: {
        reviewCards: [
          expect.objectContaining({
            terminalOutcome: "approved",
            blocksPlanning: false
          })
        ]
      },
      queueProjection: {
        next: expect.not.arrayContaining([
          expect.objectContaining({
            queueItemId: cardId
          })
        ])
      }
    });
  });

  it("requires and preserves user-visible rationale for risk-accepted research outcomes", () => {
    const planned = reduceProductEngineCommand(
      command("PlanResearch", 0, {
        objective: "Validate high-impact launch risk",
        routeOutcome: "missing_con_evidence",
        impact: "high"
      }, 1),
      withConfirmedBusinessPurposeMode(createInitialProductEngineState(projectId, sessionId))
    );
    const plannedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_risk_accept_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:05:00.000Z"
      }
    ]);
    const researchTaskId = plannedState.researchState.taskIds[0];
    const imported = reduceProductEngineCommand(
      command("ImportResearchResult", 1, {
        researchTaskId,
        result: "Pro: launch urgency looks strong.",
        limitationNotes: "No counter-evidence source was found."
      }, 2),
      plannedState
    );
    const importedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_risk_accept_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:05:00.000Z"
      },
      {
        ...imported.events[0],
        eventId: "evt_risk_accept_import",
        sequence: 2,
        occurredAt: "2026-05-05T00:05:10.000Z"
      }
    ]);
    const researchResultId = importedState.researchState.results[0]?.researchResultId;
    const synthesized = reduceProductEngineCommand(
      effectExecutorCommand("SynthesizeEvidence", 2, { researchResultId }, 3),
      importedState
    );
    const synthesizedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_risk_accept_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:05:00.000Z"
      },
      {
        ...imported.events[0],
        eventId: "evt_risk_accept_import",
        sequence: 2,
        occurredAt: "2026-05-05T00:05:10.000Z"
      },
      {
        ...synthesized.events[0],
        eventId: "evt_risk_accept_synthesized",
        sequence: 3,
        occurredAt: "2026-05-05T00:05:20.000Z"
      }
    ]);
    const riskCard = synthesizedState.researchState.reviewCards[0];

    expect(riskCard).toMatchObject({
      cardType: "risk_acceptance",
      availableOutcomes: expect.arrayContaining(["risk_accepted", "research_insufficient", "deferred", "rejected"]),
      blocksPlanning: true
    });

    const missingRationale = reduceProductEngineCommand(
      command("ResolveResearchQueueCard", 3, {
        cardId: riskCard?.cardId,
        outcome: "risk_accepted"
      }, 4),
      synthesizedState
    );
    const acceptedRisk = reduceProductEngineCommand(
      command("ResolveResearchQueueCard", 3, {
        cardId: riskCard?.cardId,
        outcome: "risk_accepted",
        rationale: "Founder accepts the missing counter-evidence risk before a later validation sprint."
      }, 5),
      synthesizedState
    );

    expect(missingRationale).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED"
      }
    });
    expect(acceptedRisk.accepted).toBe(true);
    expect(acceptedRisk.nextState).toMatchObject({
      researchState: {
        knownRisks: expect.arrayContaining([
          expect.stringContaining("Founder accepts the missing counter-evidence risk")
        ]),
        reviewCards: expect.arrayContaining([
          expect.objectContaining({
            terminalOutcome: "risk_accepted",
            terminalRationale: "Founder accepts the missing counter-evidence risk before a later validation sprint.",
            blocksPlanning: false
          })
        ])
      },
      queueProjection: {
        blocked: expect.not.arrayContaining([
          expect.objectContaining({
            queueItemId: riskCard?.cardId
          })
        ])
      },
      completeness: {
        gates: expect.arrayContaining([
          expect.objectContaining({
            gateId: "evidence_balance",
            passed: true
          }),
          expect.objectContaining({
            gateId: "research_queue_cards",
            passed: false
          })
        ]),
        topRisks: expect.arrayContaining([
          expect.stringContaining("Founder accepts the missing counter-evidence risk")
        ])
      }
    });
  });

  it("keeps low-impact terminal insufficient research cards visible without blocking Planning-ready", () => {
    const planned = reduceProductEngineCommand(
      command("PlanResearch", 0, {
        objective: "Validate low-impact onboarding copy evidence",
        sourceQueueItemId: "queue_low_impact_research",
        routeOutcome: "missing_con_evidence",
        impact: "low"
      }, 1),
      withConfirmedBusinessPurposeMode(createInitialProductEngineState(projectId, sessionId))
    );

    expect(planned.accepted).toBe(true);

    const plannedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_low_impact_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:06:00.000Z"
      }
    ]);
    const researchTaskId = plannedState.researchState.taskIds[0];
    const imported = reduceProductEngineCommand(
      command("ImportResearchResult", 1, {
        researchTaskId,
        result: "Pro: a few users liked the onboarding copy.",
        limitationNotes: "Counter-evidence is not yet available."
      }, 2),
      plannedState
    );

    expect(imported.accepted).toBe(true);

    const importedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_low_impact_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:06:00.000Z"
      },
      {
        ...imported.events[0],
        eventId: "evt_low_impact_import",
        sequence: 2,
        occurredAt: "2026-05-05T00:06:10.000Z"
      }
    ]);
    const researchResultId = importedState.researchState.results[0]?.researchResultId;
    const synthesized = reduceProductEngineCommand(
      effectExecutorCommand("SynthesizeEvidence", 2, { researchResultId }, 3),
      importedState
    );

    expect(synthesized.accepted).toBe(true);

    const synthesizedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_low_impact_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:06:00.000Z"
      },
      {
        ...imported.events[0],
        eventId: "evt_low_impact_import",
        sequence: 2,
        occurredAt: "2026-05-05T00:06:10.000Z"
      },
      {
        ...synthesized.events[0],
        eventId: "evt_low_impact_synthesized",
        sequence: 3,
        occurredAt: "2026-05-05T00:06:20.000Z"
      }
    ]);
    const card = synthesizedState.researchState.reviewCards[0];

    expect(card).toMatchObject({
      impact: "low",
      blocksPlanning: false,
      availableOutcomes: expect.arrayContaining(["research_insufficient"])
    });

    const resolved = reduceProductEngineCommand(
      command("ResolveResearchQueueCard", 3, {
        cardId: card?.cardId,
        outcome: "research_insufficient"
      }, 4),
      synthesizedState
    );

    expect(resolved.accepted).toBe(true);
    expect(resolved.nextState).toMatchObject({
      researchState: {
        reviewCards: expect.arrayContaining([
          expect.objectContaining({
            terminalOutcome: "research_insufficient",
            blocksPlanning: false
          })
        ])
      },
      queueProjection: {
        blocked: expect.arrayContaining([
          expect.objectContaining({
            queueItemId: card?.cardId,
            terminalOutcome: "research_insufficient",
            blocksPlanning: false
          })
        ])
      },
      completeness: {
        gates: expect.arrayContaining([
          expect.objectContaining({
            gateId: "research_queue_cards",
            passed: true
          })
        ])
      }
    });
  });

  it("recalculates research review queue state from evidence outcome instead of original route", () => {
    const { state, eventDrafts } = stateWithActiveQuestionBatch();
    const activeItem = state.queueProjection.active[0];

    expect(activeItem).toBeDefined();

    const answer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: activeItem?.queueItemId,
        answer: "Validate the paid-founder urgency claim through research."
      }, 6),
      state
    );

    expect(answer.accepted).toBe(true);

    const answeredState = replayProductEngineEvents(
      projectId,
      sessionId,
      [...eventDrafts, ...answer.events].map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_research_needed_queue_${index + 1}`,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:01:${index + 1}0.000Z`
      }))
    );
    const researchTaskId = answeredState.researchState.taskIds[0];
    const reviewQueueItemId = `research_review_${researchTaskId}`;
    const imported = reduceProductEngineCommand(
      command("ImportResearchResult", 7, {
        researchTaskId,
        result: "Pro: founders report urgency and support paid intent. No risks were found.",
        limitationNotes: "No counter-source imported yet."
      }, 8),
      answeredState
    );

    expect(imported.accepted).toBe(true);
    expect(imported.nextState).toMatchObject({
      researchState: {
        evidenceMatrices: []
      }
    });

    const importedState = replayProductEngineEvents(
      projectId,
      sessionId,
      [...eventDrafts, ...answer.events, ...imported.events].map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_research_needed_import_${index + 1}`,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:01:${index + 1}0.000Z`
      }))
    );
    const researchResultId = importedState.researchState.results[0]?.researchResultId;
    const synthesized = reduceProductEngineCommand(
      effectExecutorCommand("SynthesizeEvidence", 8, {
        researchResultId
      }, 9),
      importedState
    );

    expect(synthesized.accepted).toBe(true);
    expect(synthesized.nextState).toMatchObject({
      queueProjection: {
        blocked: expect.arrayContaining([
          expect.objectContaining({
            queueItemId: reviewQueueItemId,
            state: "blocked",
            title: expect.stringContaining("추가 근거 필요"),
            cardType: "risk_acceptance",
            blocksPlanning: true,
            availableOutcomes: expect.arrayContaining(["risk_accepted", "research_insufficient"])
          })
        ])
      },
      researchState: {
        evidenceMatrices: [
          expect.objectContaining({
            balanceStatus: "missing_con_evidence",
            decisionBlocked: true
          })
        ]
      }
    });
    expect((synthesized.nextState.queueProjection as typeof answeredState.queueProjection).next).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          queueItemId: reviewQueueItemId
        })
      ])
    );
  });

  it("moves a previously blocked missing-con research review to next when evidence becomes balanced", () => {
    const { state, eventDrafts } = stateWithActiveQuestionBatch();
    const activeItem = state.queueProjection.active[0];

    expect(activeItem).toBeDefined();

    const answer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: activeItem?.queueItemId,
        answer: "This answer has only positive evidence so far.",
        evidenceBalanceHint: "pro_only"
      }, 6),
      state
    );

    expect(answer.accepted).toBe(true);

    const answeredState = replayProductEngineEvents(
      projectId,
      sessionId,
      [...eventDrafts, ...answer.events].map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_missing_con_queue_${index + 1}`,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:02:${index + 1}0.000Z`
      }))
    );
    const researchTaskId = answeredState.researchState.taskIds[0];
    const reviewQueueItemId = `research_review_${researchTaskId}`;

    expect(answeredState.queueProjection.blocked).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          queueItemId: reviewQueueItemId
        })
      ])
    );

    const imported = reduceProductEngineCommand(
      command("ImportResearchResult", 7, {
        researchTaskId,
        result: "Pro: founders report urgency and willingness to pay. Risk: replacement workflows may be good enough.",
        limitationNotes: "Manual import retained both support and counter-evidence."
      }, 8),
      answeredState
    );

    expect(imported.accepted).toBe(true);
    expect(imported.nextState).toMatchObject({
      researchState: {
        evidenceMatrices: []
      }
    });

    const importedState = replayProductEngineEvents(
      projectId,
      sessionId,
      [...eventDrafts, ...answer.events, ...imported.events].map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_missing_con_import_${index + 1}`,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:02:${index + 1}0.000Z`
      }))
    );
    const researchResultId = importedState.researchState.results[0]?.researchResultId;
    const synthesized = reduceProductEngineCommand(
      effectExecutorCommand("SynthesizeEvidence", 8, {
        researchResultId
      }, 9),
      importedState
    );

    expect(synthesized.accepted).toBe(true);
    expect(synthesized.nextState).toMatchObject({
      queueProjection: {
        next: [
          expect.objectContaining({
            queueItemId: reviewQueueItemId,
            state: "next",
            title: expect.stringContaining("근거 확인됨")
          })
        ],
        blocked: []
      },
      researchState: {
        evidenceMatrices: [
          expect.objectContaining({
            balanceStatus: "balanced",
            decisionBlocked: false,
            conEvidence: [
              expect.objectContaining({
                summary: expect.stringContaining("Risk: replacement workflows")
              })
            ]
          })
        ]
      }
    });
  });

  it("synthesizes evidence from the full imported result instead of a shortened display summary", () => {
    const plannedTaskCommand = command("PlanResearch", 0, {
      objective: "Validate whether paid founders urgently need this workflow",
      routeOutcome: "missing_con_evidence",
      impact: "high"
    }, 1);
    const planned = reduceProductEngineCommand(
      plannedTaskCommand,
      withConfirmedBusinessPurposeMode(createInitialProductEngineState(projectId, sessionId))
    );

    expect(planned.accepted).toBe(true);

    const plannedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_full_result_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:03:00.000Z"
      }
    ]);
    const researchTaskId = plannedState.researchState.taskIds[0];
    const longPositiveLead = `${"Pro: founder interviews support urgent paid demand. ".repeat(8)}This lead is intentionally long.`;
    const imported = reduceProductEngineCommand(
      command("ImportResearchResult", 1, {
        researchTaskId,
        result: `${longPositiveLead} Risk: incumbent templates may be good enough for early founders.`,
        limitationNotes: "Manual import retained both support and counter-evidence."
      }, 2),
      plannedState
    );

    expect(imported.accepted).toBe(true);
    expect(imported.nextState).toMatchObject({
      researchState: {
        results: [
          expect.objectContaining({
            resultSummary: expect.stringContaining("Risk: incumbent templates")
          })
        ],
        evidenceMatrices: []
      }
    });

    const importedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_full_result_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:03:00.000Z"
      },
      {
        ...imported.events[0],
        eventId: "evt_full_result_import",
        sequence: 2,
        occurredAt: "2026-05-05T00:03:10.000Z"
      }
    ]);
    const researchResultId = importedState.researchState.results[0]?.researchResultId;
    const synthesized = reduceProductEngineCommand(
      effectExecutorCommand("SynthesizeEvidence", 2, {
        researchResultId
      }, 3),
      importedState
    );

    expect(synthesized.accepted).toBe(true);
    expect(synthesized.nextState).toMatchObject({
      researchState: {
        evidenceMatrices: [
          expect.objectContaining({
            balanceStatus: "balanced",
            decisionBlocked: false,
            conEvidence: [
              expect.objectContaining({
                summary: expect.stringContaining("Risk: incumbent templates")
              })
            ]
          })
        ]
      }
    });
  });

  it("rejects non-positive synthesis versions at the reducer boundary", () => {
    const plannedTaskCommand = command("PlanResearch", 0, {
      objective: "Validate whether paid founders urgently need this workflow",
      routeOutcome: "missing_con_evidence",
      impact: "high"
    }, 1);
    const planned = reduceProductEngineCommand(
      plannedTaskCommand,
      withConfirmedBusinessPurposeMode(createInitialProductEngineState(projectId, sessionId))
    );

    expect(planned.accepted).toBe(true);

    const plannedEvent = {
      ...planned.events[0],
      eventId: "evt_synthesis_version_plan",
      sequence: 1,
      occurredAt: "2026-05-05T00:04:00.000Z"
    };
    const plannedState = replayProductEngineEvents(projectId, sessionId, [plannedEvent]);
    const researchTaskId = plannedState.researchState.taskIds[0];
    const invalidImport = reduceProductEngineCommand(
      command("ImportResearchResult", 1, {
        researchTaskId,
        result: "Pro: founders report urgency.",
        synthesisVersion: 0
      }, 2),
      plannedState
    );

    expect(invalidImport).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED"
      }
    });

    const imported = reduceProductEngineCommand(
      command("ImportResearchResult", 1, {
        researchTaskId,
        result: "Pro: founders report urgency. Risk: incumbent workflows may be enough."
      }, 3),
      plannedState
    );

    expect(imported.accepted).toBe(true);

    const importedState = replayProductEngineEvents(projectId, sessionId, [
      plannedEvent,
      {
        ...imported.events[0],
        eventId: "evt_synthesis_version_import",
        sequence: 2,
        occurredAt: "2026-05-05T00:04:01.000Z"
      },
      {
        ...imported.events[1],
        eventId: "evt_synthesis_version_matrix",
        sequence: 3,
        occurredAt: "2026-05-05T00:04:02.000Z"
      }
    ]);
    const researchResultId = importedState.researchState.results[0]?.researchResultId;
    const invalidSynthesis = reduceProductEngineCommand(
      command("SynthesizeEvidence", 3, {
        researchResultId,
        synthesisVersion: -1
      }, 4),
      importedState
    );

    expect(invalidSynthesis).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED"
      }
    });
  });
});
