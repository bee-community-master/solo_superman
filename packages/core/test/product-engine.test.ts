import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  CANONICAL_INITIAL_SPEC_SECTIONS,
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
      businessCriticIntensityEffect: "주요 decision group마다 최소 1개의 반대/비판 질문을 유지합니다.",
      businessCriticIntensityAudit: []
    }
  };
}

function stateWithActiveQuestionBatch(
  businessCriticIntensity: "balanced" | "strong" | "investor_grade" = "balanced"
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
      targetRef: "current_spec"
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
      targetRef: "current_spec"
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

  it("runs the deterministic first command path and returns an active-batch-safe projection", () => {
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
        targetRef: "current_spec"
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
    expect(state.openIssues).toHaveLength(15);
    expect(state.openIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sectionRef: "Target Customer",
          severity: "high",
          uncertaintyType: "vague",
          topicKey: "primary_customer_narrowing",
          whyItMatters: expect.any(String),
          decisionItUnlocks: expect.any(String),
          expectedAnswerType: "choice",
          answerOptions: expect.arrayContaining([
            expect.objectContaining({
              label: expect.any(String),
              value: expect.any(String),
              pro: expect.any(String),
              con: expect.any(String)
            })
          ]),
          possibleRoutes: expect.arrayContaining(["question", "decision_candidate"]),
          repeatCount: 0,
          repeatLimit: 16
        }),
        expect.objectContaining({
          sectionRef: "Target Customer",
          topicKey: "buyer_user_split",
          severity: "high",
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
          sectionRef: "MVP Scope",
          topicKey: "implementation_resource_fit",
          possibleRoutes: expect.arrayContaining(["spec_update_candidate"])
        }),
        expect.objectContaining({
          sectionRef: "Evidence Status",
          severity: "medium",
          uncertaintyType: "unsupported",
          expectedAnswerType: "evidence",
          suggestedResearchTask: expect.any(String),
          possibleRoutes: expect.arrayContaining(["research_needed", "missing_con_evidence"])
        })
      ])
    );
    expect(state.openIssues.every((issue) => canonicalInitialSpecSectionSet.has(issue.sectionRef ?? ""))).toBe(
      true
    );
    expect(state.openIssues.map((issue) => issue.topicKey)).toEqual(
      expect.arrayContaining([...docsRequiredAmbiguityTopicKeys])
    );
    const firstSevenQuestionTexts = state.openIssues.slice(0, 7).map((issue) => issue.questionText);

    expect(firstSevenQuestionTexts).toEqual([
      "“A focused founder brief generator”를 가장 먼저 써볼 사람은 누구이고, 그 사람은 지금 어떤 상황에 있나요?",
      "그 사람이 직접 돈을 내거나 승인할 수 있나요? 아니라면 누가 결정하고 누가 실제로 쓰나요?",
      "그 사람이 겪는 불편은 언제 생기고, 시간·돈·스트레스 중 무엇을 가장 크게 쓰게 하나요?",
      "그 사람이 지금 쓰는 방법을 두고 “A focused founder brief generator”를 선택하게 만들 쉬운 이유 하나는 무엇인가요?",
      "지금은 어떤 방법으로 버티고 있고, 그 방법이 괜찮을 때와 답답할 때는 각각 언제인가요?",
      "“Help solo founders turn a rough idea into a traceable product spec.”에 가장 도움이 되는 첫 버전 기능 하나와 이번에 만들지 않을 기능 하나는 무엇인가요?",
      "제품을 만들기 전에 “이게 필요하다”는 실제 반응을 어떻게 작게 확인할 수 있나요?"
    ]);
    expect(state.openIssues[0]?.questionText).toContain("A focused founder brief generator");
    expect(state.openIssues[5]?.questionText).toContain("Help solo founders turn a rough idea");
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
    expect(state.queueProjection.active).toHaveLength(5);
    const visibleActiveQueueCopy = state.queueProjection.active
      .map((item) => [item.title, item.whyItMatters, item.decisionItUnlocks, item.nextValidationAction].filter(Boolean).join(" "))
      .join("\n");
    expect(visibleActiveQueueCopy).not.toMatch(
      /\b(primary customer|Build Slice|MVP|workflow|GUI|CLI|planning-ready|tradeoff|proxy|scope creep|customer lock-in|paid intent|research_needed|high-impact gate|Spec section|completion gate|concierge|owner\/date|confidence|pivot|daemon|Known Risk|Next Validation Action|legal\/ops\/security|price proxy|willingness-to-pay)\b/iu
    );
    const activeIssueIds = new Set(state.queueProjection.active.map((item) => item.queueItemId));
    const activeIssues = state.openIssues.filter((issue) => activeIssueIds.has(issue.queueItemId));
    expect(activeIssues.every((issue) => issue.severity === "high")).toBe(true);
    expect(state.queueProjection.active.every((item) => item.state === "active")).toBe(true);
    expect(state.queueProjection.active.every((item) => item.cardType === "question")).toBe(true);
    expect(state.queueProjection.active).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sectionRef: "Target Customer",
          topicKey: "primary_customer_narrowing",
          severity: "high",
          whyItMatters: expect.any(String),
          decisionItUnlocks: expect.any(String),
          expectedAnswerType: "choice",
          answerOptions: expect.arrayContaining([
            expect.objectContaining({
              pro: expect.any(String),
              con: expect.any(String)
            })
          ]),
          possibleRoutes: expect.arrayContaining(["question", "decision_candidate"])
        })
      ])
    );
    expect(state.queueProjection.next).toEqual([]);
    expect(state.queueProjection.progress).toMatchObject({
      generatedQuestionCount: 15,
      openQuestionCount: 15,
      answeredQuestionCount: 0,
      topicCoverageCount: 15,
      openTopicCoverageCount: 15,
      followUpBudgetRemainingCount: 240,
      visibleQuestionDebtCount: 5,
      activeQuestionCount: 5,
      completionPercent: 0
    });
    expect(state.session.phase).toBe("question_loop");
  });

  it("preserves onboarding wording while simplifying generated prompt language", () => {
    const { state } = stateWithPersonalActiveQuestionBatch();
    const activeTitles = state.queueProjection.active.map((item) => item.title).join("\n");

    expect(activeTitles).toContain("A focused personal workflow helper");
    expect(activeTitles).toContain("Help one user automate a repeated local workflow.");
    expect(activeTitles).toContain("를 쓰기 바로 전과 후에 사용자는 실제로 어떤 일을 하나요?");
    expect(activeTitles).toContain("얼마나 자주 반복되고");
    expect(activeTitles).toContain("꼭 화면으로 보고 눌러야 하는 순간");
    expect(activeTitles).toContain("에 맞춰 가장 작게 만든다면 어떤 입력을 받아 어떤 결과 하나만 내면 충분한가요?");
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
      projectPurposeModeReason: "Personal workflow tool confirmed by the user."
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
      projectPurposeModeLabel: "개인 workflow 구현 중심"
    });
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
      businessCriticIntensityLabel: "상업성 검증 강도 선택 필요"
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
          rawIdea: "A business idea that selects critic intensity after the draft",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed"
        }, 1),
        state
      ),
      "evt_late_business_critic"
    );
    appendAcceptedEvent(
      reduceProductEngineCommand(command("CaptureIntake", 1, { answer: "Business validation." }, 2), state),
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

    const analyze = reduceProductEngineCommand(command("AnalyzeAmbiguity", 4, { targetRef: "current_spec" }, 5), state);

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

  it("keeps queued_next limited to elevated business critic pressure for explicit stronger starts", () => {
    const strongState = stateWithActiveQuestionBatch("strong").state;
    const investorGradeState = stateWithActiveQuestionBatch("investor_grade").state;

    expect(strongState.queueProjection.active.some((item) => item.businessCriticPressureKind === "core_assumption_challenge")).toBe(true);
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
    ).toBe(true);
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

  it("rejects explicit stronger business batches that omit a core-assumption challenge", () => {
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
      command("DraftInitialSpec", 2, {}, 3),
      command("AnalyzeAmbiguity", 3, {
        targetRef: "current_spec"
      }, 4)
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

    const baseOnlyQueueItemIds = state.openIssues
      .filter((issue) => issue.businessCriticPressureKind !== "core_assumption_challenge")
      .slice(0, 5)
      .map((issue) => issue.queueItemId);
    const activate = reduceProductEngineCommand(
      command("ActivateQuestionBatch", Number(state.stateVersion), {
        queueItemIds: baseOnlyQueueItemIds
      }, 5),
      state
    );

    expect(activate).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "COMMAND_PRECONDITION_FAILED",
        details: {
          businessCriticIntensity: "strong",
          requiredBusinessCriticPressureKind: "core_assumption_challenge"
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
      command("AnalyzeAmbiguity", 3, { targetRef: "current_spec" }, 4),
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
      command("AnalyzeAmbiguity", 3, { targetRef: "current_spec" }, 4),
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
      modeEffectSummary: expect.stringContaining("유료 의향")
    });
    expect(personalState.openIssues.map((issue) => issue.topicKey)).toEqual(
      expect.arrayContaining(["personal_workflow_context", "personal_usage_frequency", "personal_gui_fit"])
    );
    expect(personalState.openIssues.map((issue) => issue.topicKey)).not.toEqual(
      expect.arrayContaining(["buyer_user_split", "acquisition_channel_realism"])
    );
    expect(personalState.queueProjection.active).toHaveLength(5);
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
            projectPurposeModeLabel: "개인 workflow 구현 중심",
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
      projectPurposeModeLabel: "개인 workflow 구현 중심"
    });
    expect(reduction.nextState).toMatchObject({
      queueProjection: {
        projectPurposeMode: "personal",
        modeEffectSummary: expect.stringContaining("workflow"),
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
    expect(deferredProjection.active).toHaveLength(5);

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
    expect(replayed.queueProjection.active).toHaveLength(5);
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
    expect((reduction.immediateProjection as DecisionQueueProjection).active).toHaveLength(5);

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
    expect(replayed.queueProjection.active).toHaveLength(5);
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
        targetRef: "current_spec"
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

  it("defaults to a canonical five-item batch and still supports explicit 3 to 5 item selection", () => {
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
      active: openIssues.slice(0, 5).map((issue) =>
        expect.objectContaining({
          queueItemId: issue.queueItemId,
          state: "active",
          cardType: "question",
          answerOptions: expect.arrayContaining([
            expect.objectContaining({
              pro: expect.any(String),
              con: expect.any(String)
            })
          ])
        })
      )
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
      active: openIssues.slice(2, 7).map((issue) =>
        expect.objectContaining({
          queueItemId: issue.queueItemId,
          state: "active",
          cardType: "question"
        })
      )
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
        targetRef: "current_spec"
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
    const answeredQueueItemId = activeItemIds[0];
    const blankAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: activeItemIds[1],
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
    const firstActiveItem = state.queueProjection.active[0];

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
    const noMoreResearchAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: answeredQueueItemId,
        answer: "리서치 필요 없음. 지금 답변으로 충분합니다."
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
          title: expect.stringContaining("founder teams with repeated manual planning pain"),
          answerOptions: []
        })
      ],
      next: [
        expect.objectContaining({
          state: "next"
        })
      ]
    });
    expect(JSON.stringify(sensitiveFollowUpAnswer.immediateProjection)).toContain("[민감한 값 숨김]");
    expect(JSON.stringify(sensitiveFollowUpAnswer.immediateProjection)).not.toContain("sk-secret-answer-value");
    expect(answer.accepted).toBe(true);
    expect(broaderResearchAnswer.accepted).toBe(true);
    expect(broaderResearchAnswer.nextState.researchState.tasks[0]?.objective).toContain(
      "Broaden research beyond existing notes"
    );
    expect(broaderResearchAnswer.nextState.researchState.tasks[0]?.objective).toContain(
      "collect wider sources and counter-evidence"
    );
    expect(noMoreResearchAnswer.accepted).toBe(true);
    expect(noMoreResearchAnswer.nextState.researchState.tasks[0]?.objective).toContain("Validate evidence for:");
    expect(noMoreResearchAnswer.nextState.researchState.tasks[0]?.objective).not.toContain(
      "Broaden research beyond existing notes"
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
        ...activeItemIds.slice(1).map((queueItemId) =>
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
          questionText: expect.stringContaining("paid founder urgency"),
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
      generatedQuestionCount: 16,
      openQuestionCount: 15,
      answeredQuestionCount: 1,
      terminalQuestionCount: 1,
      followUpQuestionCount: 1,
      followUpOpenQuestionCount: 1,
      topicCoverageCount: 16,
      openTopicCoverageCount: 15,
      followUpBudgetRemainingCount: 239,
      visibleQuestionDebtCount: 5,
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
    expect(replayed.queueProjection.active).toHaveLength(5);
    expect(replayed.queueProjection.next).toHaveLength(1);
    expect(replayed.queueProjection.progress).toMatchObject({
      generatedQuestionCount: 16,
      openQuestionCount: 15,
      answeredQuestionCount: 1,
      followUpQuestionCount: 1,
      topicCoverageCount: 16,
      openTopicCoverageCount: 15,
      followUpBudgetRemainingCount: 239,
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
      projectPurposeModeEffect: expect.stringContaining("유료 의향")
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
        reviewCards: [
          expect.objectContaining({
            additionalQuestions: [
              expect.stringContaining("paid founder urgency를 조금 더 구체화")
            ]
          })
        ],
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
          questionText: expect.stringContaining("paid founder urgency를 조금 더 구체화"),
          whyItMatters: expect.stringContaining("찬성 근거:"),
          decisionItUnlocks: expect.stringContaining("Founder urgency evidence notes"),
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
            whyItMatters: expect.stringContaining("반대 근거"),
            sourceRef: expect.stringContaining(`research:${researchTaskId}:`)
          })
        ],
        blocked: [
          expect.objectContaining({
            additionalQuestions: [
              expect.stringContaining("paid founder urgency를 조금 더 구체화")
            ]
          })
        ],
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

    expect(researchFollowUpIssue?.answerOptions?.length).toBeGreaterThanOrEqual(3);
    expect(researchFollowUpIssue?.answerOptions?.length).toBeLessThanOrEqual(10);
    expect(synthesized.events[0]?.payload).toMatchObject({
      researchFollowUpQueueItemIds: [expect.stringMatching(/^queue_research_followup_/)]
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
            title: expect.stringContaining("Quality gate review required")
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
            title: expect.stringContaining("Evidence still insufficient")
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
        reviewCards: [
          expect.objectContaining({
            terminalOutcome: "risk_accepted",
            terminalRationale: "Founder accepts the missing counter-evidence risk before a later validation sprint.",
            blocksPlanning: false
          })
        ]
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
            passed: true
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
        reviewCards: [
          expect.objectContaining({
            terminalOutcome: "research_insufficient",
            blocksPlanning: false
          })
        ]
      },
      queueProjection: {
        blocked: [
          expect.objectContaining({
            queueItemId: card?.cardId,
            terminalOutcome: "research_insufficient",
            blocksPlanning: false
          })
        ]
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
        blocked: [
          expect.objectContaining({
            queueItemId: reviewQueueItemId,
            state: "blocked",
            title: expect.stringContaining("Evidence still insufficient"),
            cardType: "risk_acceptance",
            blocksPlanning: true,
            availableOutcomes: expect.arrayContaining(["risk_accepted", "research_insufficient"])
          })
        ]
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
            title: expect.stringContaining("Evidence ready")
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
