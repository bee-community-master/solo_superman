import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE,
  CHATGPT_BROWSER_DELEGATION_READY_RUN_FIXTURE
} from "@solo-superman/contracts";
import type {
  CommandId,
  CommandResponse,
  CorrelationId,
  DecisionQueueProjection,
  ProjectId,
  ProjectionVersion,
  QueueItemId,
  ResearchResultId,
  ResearchTaskId,
  SessionId,
  SessionShellProjection,
  StateVersion
} from "@solo-superman/contracts";
import type { SidecarClient } from "../../../shared/api/sidecar-client";
import { DECISION_QUEUE_COPY } from "./decision-queue-copy";
import { emptyProjectionState } from "./decision-queue-shell-model";
import {
  boundedQuestionBatchSize,
  nextQuestionBatchIdsForActivation,
  queueHasActiveQuestionDebt,
  queueShouldAutoActivateNextQuestionBatch,
  useDecisionQueueSessionActions
} from "./useDecisionQueueSessionActions";

describe("nextQuestionBatchIdsForActivation", () => {
  it("uses queued next question ids and research follow-ups while ignoring non-question review cards", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 5 as ProjectionVersion,
      active: [],
      next: [
        {
          queueItemId: "queue_question_1" as QueueItemId,
          title: "First queued question",
          state: "next",
          cardType: "question"
        },
        {
          queueItemId: "queue_research_review" as QueueItemId,
          title: "Review research",
          state: "next",
          cardType: "research_review",
          researchTaskId: "research_task_review" as ResearchTaskId
        },
        {
          queueItemId: "queue_research_follow_up" as QueueItemId,
          title: "Research follow-up question",
          state: "next",
          cardType: "follow_up_question"
        },
        {
          queueItemId: "queue_legacy_question" as QueueItemId,
          title: "Legacy queued question",
          state: "next"
        }
      ],
      blocked: [],
      deferred: []
    };

    expect(nextQuestionBatchIdsForActivation(queue)).toEqual([
      "queue_question_1"
    ]);
    expect(nextQuestionBatchIdsForActivation(queue, 3)).toEqual([
      "queue_question_1",
      "queue_research_follow_up",
      "queue_legacy_question"
    ]);
  });

  it("caps explicit activation ids at the next question batch size", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 5 as ProjectionVersion,
      active: [],
      next: Array.from({ length: 7 }, (_, index) => ({
        queueItemId: `queue_question_${index + 1}` as QueueItemId,
        title: `Queued question ${index + 1}`,
        state: "next" as const,
        cardType: "question" as const
      })),
      blocked: [],
      deferred: []
    };

    expect(nextQuestionBatchIdsForActivation(queue)).toEqual([
      "queue_question_1"
    ]);
    expect(nextQuestionBatchIdsForActivation(queue, 9)).toEqual([
      "queue_question_1",
      "queue_question_2",
      "queue_question_3",
      "queue_question_4",
      "queue_question_5"
    ]);
    expect(nextQuestionBatchIdsForActivation(queue, 3)).toEqual([
      "queue_question_1",
      "queue_question_2",
      "queue_question_3"
    ]);
  });

  it("bounds requested next question batch size to the supported active batch range", () => {
    expect(boundedQuestionBatchSize(2)).toBe(2);
    expect(boundedQuestionBatchSize(4)).toBe(4);
    expect(boundedQuestionBatchSize(9)).toBe(5);
    expect(boundedQuestionBatchSize(Number.NaN)).toBe(1);
  });

  it("uses visible queued ids when at least one next question is available", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 5 as ProjectionVersion,
      progress: {
        generatedQuestionCount: 12,
        openQuestionCount: 6,
        answeredQuestionCount: 6,
        deferredQuestionCount: 0,
        resolvedQuestionCount: 0,
        terminalQuestionCount: 6,
        followUpQuestionCount: 2,
        followUpOpenQuestionCount: 2,
        topicCoverageCount: 8,
        openTopicCoverageCount: 3,
        followUpBudgetRemainingCount: 20,
        visibleQuestionDebtCount: 2,
        activeQuestionCount: 0,
        upcomingQuestionCount: 2,
        blockedQuestionCount: 0,
        completionPercent: 50
      },
      active: [],
      next: [
        {
          queueItemId: "queue_question_1" as QueueItemId,
          title: "Queued question 1",
          state: "next",
          cardType: "question"
        },
        {
          queueItemId: "queue_question_2" as QueueItemId,
          title: "Queued question 2",
          state: "next",
          cardType: "question"
        }
      ],
      blocked: [],
      deferred: []
    };

    expect(nextQuestionBatchIdsForActivation(queue, 3)).toEqual([
      "queue_question_1",
      "queue_question_2"
    ]);
    expect(queueShouldAutoActivateNextQuestionBatch(queue, 3)).toBe(true);
  });

  it("falls back to default activation when no queued next questions exist", () => {
    expect(nextQuestionBatchIdsForActivation(null)).toBeUndefined();
    expect(
      nextQuestionBatchIdsForActivation({
        kind: "DecisionQueueProjection",
        version: 1 as ProjectionVersion,
        active: [],
        next: [],
        blocked: [],
        deferred: []
      })
    ).toBeUndefined();
  });
});

describe("queueHasActiveQuestionDebt", () => {
  it("ignores active non-question cards so long sessions can keep loading question batches", () => {
    expect(
      queueHasActiveQuestionDebt({
        kind: "DecisionQueueProjection",
        version: 1 as ProjectionVersion,
        active: [
          {
            queueItemId: "queue_research_review_active" as QueueItemId,
            title: "Review research evidence",
            state: "active",
            cardType: "research_review"
          },
          {
            queueItemId: "queue_completion_candidate_active" as QueueItemId,
            title: "Review completion candidate",
            state: "active",
            cardType: "completion_candidate"
          }
        ],
        next: [],
        blocked: [],
        deferred: []
      })
    ).toBe(false);

    expect(
      queueHasActiveQuestionDebt({
        kind: "DecisionQueueProjection",
        version: 1 as ProjectionVersion,
        active: [
          {
            queueItemId: "queue_active_question" as QueueItemId,
            title: "Answer this question first",
            state: "active",
            cardType: "question"
          }
        ],
        next: [],
        blocked: [],
        deferred: []
      })
    ).toBe(true);
  });
});

describe("queueShouldAutoActivateNextQuestionBatch", () => {
  it("auto-continues only when no active question debt remains and queued questions exist", () => {
    expect(
      queueShouldAutoActivateNextQuestionBatch({
        kind: "DecisionQueueProjection",
        version: 1 as ProjectionVersion,
        active: [
          {
            queueItemId: "queue_active_research_review" as QueueItemId,
            title: "Review research",
            state: "active",
            cardType: "research_review"
          }
        ],
        next: [
          {
            queueItemId: "queue_next_question" as QueueItemId,
            title: "Next answerable question",
            state: "next",
            cardType: "question"
          }
        ],
        blocked: [],
        deferred: []
      })
    ).toBe(true);

    expect(
      queueShouldAutoActivateNextQuestionBatch({
        kind: "DecisionQueueProjection",
        version: 1 as ProjectionVersion,
        active: [
          {
            queueItemId: "queue_active_question" as QueueItemId,
            title: "Answer this first",
            state: "active",
            cardType: "question"
          }
        ],
        next: [
          {
            queueItemId: "queue_next_question" as QueueItemId,
            title: "Next answerable question",
            state: "next",
            cardType: "question"
          }
        ],
        blocked: [],
        deferred: []
      })
    ).toBe(false);
  });
});

describe("useDecisionQueueSessionActions", () => {
  it("passes prompt-template generated question JSON into the initial ambiguity analysis command", async () => {
    const projectId = "proj_generated_initial_questions" as ProjectId;
    const sessionId = "sess_generated_initial_questions" as SessionId;
    const generatedQuestionSet = {
      schemaVersion: "solo-superman-generated-ambiguity-questions.v1",
      questions: [
        {
          topicKey: "pet_lifecycle_guardian_focus"
        }
      ]
    };
    const sessionProjection: SessionShellProjection = {
      kind: "SessionShellProjection",
      projectId,
      sessionId,
      version: 1 as ProjectionVersion,
      phase: "intake",
      projectPurposeMode: "business",
      projectPurposeModeSelectionStatus: "confirmed",
      projectPurposeModeLabel: "Business validation",
      projectPurposeModeEffect: "Business validation mode keeps commercialization gates active."
    };
    const queueProjection: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 5 as ProjectionVersion,
      active: [],
      next: [],
      blocked: [],
      deferred: []
    };
    const commandResponse = <TProjection,>(
      index: number,
      immediateProjection?: TProjection
    ): CommandResponse<TProjection> => ({
      category: immediateProjection ? "accepted_with_projection" : "accepted",
      commandId: `cmd_generated_initial_questions_${index}` as CommandId,
      correlationId: "corr_generated_initial_questions" as CorrelationId,
      stateVersionBefore: (index - 1) as StateVersion,
      stateVersionAfter: index as StateVersion,
      ...(immediateProjection ? { immediateProjection } : {})
    } as CommandResponse<TProjection>);
    const createProject = vi.fn(async () => commandResponse(1, sessionProjection));
    const createResearchAllowlist = vi.fn(async () => commandResponse(1, {
      kind: "ResearchAllowlistGovernanceProjection"
    } as never));
    const captureIntake = vi.fn(async () => commandResponse(2));
    const draftInitialSpec = vi.fn(async () => commandResponse(3));
    const analyzeAmbiguity = vi.fn(async () => commandResponse(4));
    const activateQuestionBatch = vi.fn(async () => commandResponse(5, queueProjection));
    const generateInitialQuestionSet = vi.fn(async () => ({
      status: "generated" as const,
      promptTemplateRef: "prompt-template:generated-ambiguity-questions:v1",
      schemaVersion: "solo-superman-generated-ambiguity-questions.v1",
      source: "codex_runtime_preview" as const,
      generatedQuestionSet
    }));
    let actions: ReturnType<typeof useDecisionQueueSessionActions> | undefined;

    function Harness() {
      actions = useDecisionQueueSessionActions({
        answerDrafts: {},
        appendCommand: async (_label, response) => response,
        businessCriticIntensity: "balanced",
        businessCriticIntensityChangeReason: "",
        chatGptLoginAcknowledged: true,
        codexLoginAuthenticated: true,
        client: {
          createProject,
          createResearchAllowlist,
          captureIntake,
          draftInitialSpec,
          generateInitialQuestionSet,
          analyzeAmbiguity,
          activateQuestionBatch
        } as unknown as SidecarClient,
        connectionStatus: "connected",
        copy: DECISION_QUEUE_COPY.en,
        idea: "A pet lifecycle management app",
        initialResearchAutomationPermission: "allow_codex",
        initialBusinessCriticIntensityReason: "",
        intake: "Use natural questions tailored to pet guardians.",
        isBusy: false,
        knownRiskDrafts: {},
        projectPurposeMode: "business",
        projections: emptyProjectionState(),
        purposeModeChangeReason: "",
        questionBatchSize: 5,
        refetchQueueAfterSseNotification: vi.fn(async () => undefined),
        refreshProjections: vi.fn(async () => undefined),
        researchDrafts: {},
        setAnswerDrafts: vi.fn(),
        setBusinessCriticIntensity: vi.fn(),
        setBusinessCriticIntensityChangeReason: vi.fn(),
        setCommandLog: vi.fn(),
        setIsBusy: vi.fn(),
        setKnownRiskDrafts: vi.fn(),
        setPhase15bReadiness: vi.fn(),
        setProjectPurposeMode: vi.fn(),
        setProjections: vi.fn(),
        setPurposeModeChangeReason: vi.fn(),
        setResearchDrafts: vi.fn(),
        setResearchOperations: vi.fn(),
        setStatuses: vi.fn(),
        setWorkflowError: vi.fn()
      });

      return null;
    }

    renderToStaticMarkup(createElement(Harness));

    if (!actions) {
      throw new Error("Session actions were not captured.");
    }

    await actions.runInitialQueueFlow({ preventDefault: vi.fn() } as unknown as Parameters<
      typeof actions.runInitialQueueFlow
    >[0]);

    expect(createProject).toHaveBeenCalledWith(expect.objectContaining({
      initialResearchAutomationPermission: "allow_codex"
    }));
    expect(createResearchAllowlist).toHaveBeenCalledTimes(1);
    expect(generateInitialQuestionSet).toHaveBeenCalledWith({
      sessionId,
      expectedStateVersion: 3,
      rawIdea: "A pet lifecycle management app",
      intakeGoal: "Use natural questions tailored to pet guardians.",
      projectPurposeMode: "business",
      businessCriticIntensity: "balanced"
    });
    expect(analyzeAmbiguity).toHaveBeenCalledWith(sessionId, 3, "current_spec", generatedQuestionSet);
  });

  it("uses Codex prompt-template generation while keeping public research manual-only", async () => {
    const projectId = "proj_manual_only_initial_questions" as ProjectId;
    const sessionId = "sess_manual_only_initial_questions" as SessionId;
    const sessionProjection: SessionShellProjection = {
      kind: "SessionShellProjection",
      projectId,
      sessionId,
      version: 1 as ProjectionVersion,
      phase: "intake",
      projectPurposeMode: "personal",
      projectPurposeModeSelectionStatus: "confirmed",
      projectPurposeModeLabel: "Personal workflow build",
      projectPurposeModeEffect: "Personal mode keeps workflow questions active."
    };
    const queueProjection: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 5 as ProjectionVersion,
      active: [],
      next: [],
      blocked: [],
      deferred: []
    };
    const commandResponse = <TProjection,>(
      index: number,
      immediateProjection?: TProjection
    ): CommandResponse<TProjection> => ({
      category: immediateProjection ? "accepted_with_projection" : "accepted",
      commandId: `cmd_manual_only_initial_questions_${index}` as CommandId,
      correlationId: "corr_manual_only_initial_questions" as CorrelationId,
      stateVersionBefore: (index - 1) as StateVersion,
      stateVersionAfter: index as StateVersion,
      ...(immediateProjection ? { immediateProjection } : {})
    } as CommandResponse<TProjection>);
    const createProject = vi.fn(async () => commandResponse(1, sessionProjection));
    const createResearchAllowlist = vi.fn(async () => commandResponse(1, {
      kind: "ResearchAllowlistGovernanceProjection"
    } as never));
    const captureIntake = vi.fn(async () => commandResponse(2));
    const draftInitialSpec = vi.fn(async () => commandResponse(3));
    const analyzeAmbiguity = vi.fn(async () => commandResponse(4));
    const activateQuestionBatch = vi.fn(async () => commandResponse(5, queueProjection));
    const generatedQuestionSet = {
      schemaVersion: "solo-superman-generated-ambiguity-questions.v1",
      questions: [
        {
          topicKey: "private_journal_workflow"
        }
      ]
    };
    const generateInitialQuestionSet = vi.fn(async () => generatedQuestionSet);
    let actions: ReturnType<typeof useDecisionQueueSessionActions> | undefined;

    function Harness() {
      actions = useDecisionQueueSessionActions({
        answerDrafts: {},
        appendCommand: async (_label, response) => response,
        businessCriticIntensity: null,
        businessCriticIntensityChangeReason: "",
        chatGptLoginAcknowledged: false,
        codexLoginAuthenticated: true,
        client: {
          createProject,
          createResearchAllowlist,
          captureIntake,
          draftInitialSpec,
          analyzeAmbiguity,
          activateQuestionBatch
        } as unknown as SidecarClient,
        connectionStatus: "connected",
        copy: DECISION_QUEUE_COPY.en,
        idea: "A private journaling workflow",
        initialResearchAutomationPermission: "manual_only",
        initialBusinessCriticIntensityReason: "",
        intake: "Keep public research disabled while Codex generates the first questions.",
        isBusy: false,
        knownRiskDrafts: {},
        projectPurposeMode: "personal",
        projections: emptyProjectionState(),
        purposeModeChangeReason: "",
        questionBatchSize: 5,
        refetchQueueAfterSseNotification: vi.fn(async () => undefined),
        refreshProjections: vi.fn(async () => undefined),
        researchDrafts: {},
        setAnswerDrafts: vi.fn(),
        setBusinessCriticIntensity: vi.fn(),
        setBusinessCriticIntensityChangeReason: vi.fn(),
        setCommandLog: vi.fn(),
        setIsBusy: vi.fn(),
        setKnownRiskDrafts: vi.fn(),
        setPhase15bReadiness: vi.fn(),
        setProjectPurposeMode: vi.fn(),
        setProjections: vi.fn(),
        setPurposeModeChangeReason: vi.fn(),
        setResearchDrafts: vi.fn(),
        setResearchOperations: vi.fn(),
        setStatuses: vi.fn(),
        setWorkflowError: vi.fn(),
        generateInitialQuestionSet
      });

      return null;
    }

    renderToStaticMarkup(createElement(Harness));

    if (!actions) {
      throw new Error("Session actions were not captured.");
    }

    await actions.runInitialQueueFlow({ preventDefault: vi.fn() } as unknown as Parameters<
      typeof actions.runInitialQueueFlow
    >[0]);

    expect(createProject).toHaveBeenCalledWith(expect.objectContaining({
      initialResearchAutomationPermission: "manual_only"
    }));
    expect(createResearchAllowlist).not.toHaveBeenCalled();
    expect(generateInitialQuestionSet).toHaveBeenCalledWith({
      sessionId,
      expectedStateVersion: 3,
      idea: "A private journaling workflow",
      intake: "Keep public research disabled while Codex generates the first questions.",
      projectPurposeMode: "personal",
      businessCriticIntensity: null
    });
    expect(analyzeAmbiguity).toHaveBeenCalledWith(sessionId, 3, "current_spec", generatedQuestionSet);
  });

  it("submits an answer without waiting for background research starts to finish", async () => {
    const projectId = "proj_answer_nonblocking" as ProjectId;
    const sessionId = "sess_answer_nonblocking" as SessionId;
    const queueItemId = "queue_answer_nonblocking" as QueueItemId;
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 2 as ProjectionVersion,
      active: [
        {
          queueItemId,
          title: "Answerable question",
          state: "active",
          cardType: "question"
        }
      ],
      next: [],
      blocked: [],
      deferred: []
    };
    const response: CommandResponse<DecisionQueueProjection> = {
      category: "accepted_with_projection",
      commandId: "cmd_answer_nonblocking" as CommandId,
      correlationId: "corr_answer_nonblocking" as CorrelationId,
      stateVersionBefore: 1 as StateVersion,
      stateVersionAfter: 2 as StateVersion,
      immediateProjection: queue
    };
    const appendCommand: Parameters<typeof useDecisionQueueSessionActions>[0]["appendCommand"] = async (
      _label,
      commandResponse
    ) => commandResponse;
    const setIsBusy = vi.fn();
    const backgroundResearchStarted = vi.fn(
      () =>
        new Promise<void>(() => undefined)
    );
    let actions: ReturnType<typeof useDecisionQueueSessionActions> | undefined;

    function Harness() {
      actions = useDecisionQueueSessionActions({
        answerDrafts: {
          [queueItemId]: "Keep answering while research runs."
        },
        appendCommand,
        businessCriticIntensity: "balanced",
        businessCriticIntensityChangeReason: "",
        chatGptLoginAcknowledged: true,
        codexLoginAuthenticated: true,
        client: {
          submitAnswer: vi.fn(async () => response)
        } as unknown as SidecarClient,
        connectionStatus: "connected",
        copy: DECISION_QUEUE_COPY.en,
        idea: "Non-blocking answer flow",
        initialResearchAutomationPermission: "allow_codex",
        initialBusinessCriticIntensityReason: "",
        intake: "Keep the queue moving.",
        isBusy: false,
        knownRiskDrafts: {},
        projectPurposeMode: "business",
        projections: {
          ...emptyProjectionState(),
          session: {
            kind: "SessionShellProjection",
            projectId,
            sessionId,
            version: 1 as ProjectionVersion,
            phase: "spec",
            projectPurposeMode: "business",
            projectPurposeModeSelectionStatus: "confirmed",
            projectPurposeModeLabel: "Business validation",
            projectPurposeModeEffect: "Business validation mode keeps commercialization gates active."
          },
          queue
        },
        purposeModeChangeReason: "",
        questionBatchSize: 5,
        refetchQueueAfterSseNotification: vi.fn(async () => undefined),
        refreshProjections: vi.fn(async () => undefined),
        researchDrafts: {},
        setAnswerDrafts: vi.fn(),
        setBusinessCriticIntensity: vi.fn(),
        setBusinessCriticIntensityChangeReason: vi.fn(),
        setCommandLog: vi.fn(),
        setIsBusy,
        setKnownRiskDrafts: vi.fn(),
        setPhase15bReadiness: vi.fn(),
        setProjectPurposeMode: vi.fn(),
        setProjections: vi.fn(),
        setPurposeModeChangeReason: vi.fn(),
        setResearchDrafts: vi.fn(),
        setResearchOperations: vi.fn(),
        setStatuses: vi.fn(),
        setWorkflowError: vi.fn(),
        startReadyReadOnlyResearchRunsAfterAnswer: backgroundResearchStarted
      });

      return null;
    }

    renderToStaticMarkup(createElement(Harness));

    if (!actions) {
      throw new Error("Session actions were not captured.");
    }

    await actions.submitAnswer(queueItemId);
    await Promise.resolve();
    await Promise.resolve();

    expect(backgroundResearchStarted).toHaveBeenCalledTimes(1);
    expect(setIsBusy).toHaveBeenNthCalledWith(1, true);
    expect(setIsBusy).toHaveBeenLastCalledWith(false);
  });

  it("automatically activates the next question batch after the current active question debt is answered", async () => {
    const projectId = "proj_answer_auto_next_batch" as ProjectId;
    const sessionId = "sess_answer_auto_next_batch" as SessionId;
    const answeredQueueItemId = "queue_answered_last_active" as QueueItemId;
    const nextQuestionId = "queue_auto_next_question" as QueueItemId;
    const queueAfterAnswer: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 2 as ProjectionVersion,
      active: [
        {
          queueItemId: "queue_research_review_after_answer" as QueueItemId,
          title: "Review research while continuing questions",
          state: "active",
          cardType: "research_review"
        }
      ],
      next: [
        {
          queueItemId: nextQuestionId,
          title: "Next automatic question",
          state: "next",
          cardType: "question"
        }
      ],
      blocked: [],
      deferred: []
    };
    const queueAfterActivation: DecisionQueueProjection = {
      ...queueAfterAnswer,
      version: 3 as ProjectionVersion,
      active: [
        ...queueAfterAnswer.active,
        {
          queueItemId: nextQuestionId,
          title: "Next automatic question",
          state: "active",
          cardType: "question"
        }
      ],
      next: []
    };
    const answerResponse: CommandResponse<DecisionQueueProjection> = {
      category: "accepted_with_projection",
      commandId: "cmd_answer_auto_next_batch" as CommandId,
      correlationId: "corr_answer_auto_next_batch" as CorrelationId,
      stateVersionBefore: 1 as StateVersion,
      stateVersionAfter: 2 as StateVersion,
      immediateProjection: queueAfterAnswer
    };
    const activateResponse: CommandResponse<DecisionQueueProjection> = {
      category: "accepted_with_projection",
      commandId: "cmd_activate_auto_next_batch" as CommandId,
      correlationId: "corr_activate_auto_next_batch" as CorrelationId,
      stateVersionBefore: 2 as StateVersion,
      stateVersionAfter: 3 as StateVersion,
      immediateProjection: queueAfterActivation
    };
    const appendCommand: Parameters<typeof useDecisionQueueSessionActions>[0]["appendCommand"] = async (
      _label,
      commandResponse
    ) => commandResponse;
    const submitAnswer = vi.fn(async () => answerResponse);
    const activateQuestionBatch = vi.fn(async () => activateResponse);
    const setProjections = vi.fn();
    let actions: ReturnType<typeof useDecisionQueueSessionActions> | undefined;

    function Harness() {
      actions = useDecisionQueueSessionActions({
        answerDrafts: {
          [answeredQueueItemId]: "Answer the final active question and keep going."
        },
        appendCommand,
        businessCriticIntensity: "balanced",
        businessCriticIntensityChangeReason: "",
        chatGptLoginAcknowledged: true,
        codexLoginAuthenticated: true,
        client: {
          submitAnswer,
          activateQuestionBatch
        } as unknown as SidecarClient,
        connectionStatus: "connected",
        copy: DECISION_QUEUE_COPY.en,
        idea: "Auto-continue questions",
        initialResearchAutomationPermission: "allow_codex",
        initialBusinessCriticIntensityReason: "",
        intake: "The next batch should appear automatically.",
        isBusy: false,
        knownRiskDrafts: {},
        projectPurposeMode: "business",
        projections: {
          ...emptyProjectionState(),
          session: {
            kind: "SessionShellProjection",
            projectId,
            sessionId,
            version: 1 as ProjectionVersion,
            phase: "spec",
            projectPurposeMode: "business",
            projectPurposeModeSelectionStatus: "confirmed",
            projectPurposeModeLabel: "Business validation",
            projectPurposeModeEffect: "Business validation mode keeps commercialization gates active."
          },
          queue: {
            kind: "DecisionQueueProjection",
            version: 1 as ProjectionVersion,
            active: [
              {
                queueItemId: answeredQueueItemId,
                title: "Last active question",
                state: "active",
                cardType: "question"
              }
            ],
            next: [
              {
                queueItemId: nextQuestionId,
                title: "Next automatic question",
                state: "next",
                cardType: "question"
              }
            ],
            blocked: [],
            deferred: []
          }
        },
        purposeModeChangeReason: "",
        questionBatchSize: 3,
        refetchQueueAfterSseNotification: vi.fn(async () => undefined),
        refreshProjections: vi.fn(async () => undefined),
        researchDrafts: {},
        setAnswerDrafts: vi.fn(),
        setBusinessCriticIntensity: vi.fn(),
        setBusinessCriticIntensityChangeReason: vi.fn(),
        setCommandLog: vi.fn(),
        setIsBusy: vi.fn(),
        setKnownRiskDrafts: vi.fn(),
        setPhase15bReadiness: vi.fn(),
        setProjectPurposeMode: vi.fn(),
        setProjections,
        setPurposeModeChangeReason: vi.fn(),
        setResearchDrafts: vi.fn(),
        setResearchOperations: vi.fn(),
        setStatuses: vi.fn(),
        setWorkflowError: vi.fn()
      });

      return null;
    }

    renderToStaticMarkup(createElement(Harness));

    if (!actions) {
      throw new Error("Session actions were not captured.");
    }

    await actions.submitAnswer(answeredQueueItemId);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(activateQuestionBatch).toHaveBeenCalledWith(
      sessionId,
      2,
      [nextQuestionId]
    );
    expect(setProjections).toHaveBeenCalledWith(expect.any(Function));
  });

  it("uses server-selected activation after an answer when visible next ids are below the batch minimum", async () => {
    const projectId = "proj_answer_auto_default_batch" as ProjectId;
    const sessionId = "sess_answer_auto_default_batch" as SessionId;
    const answeredQueueItemId = "queue_answered_default_batch" as QueueItemId;
    const queueAfterAnswer: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 2 as ProjectionVersion,
      progress: {
        generatedQuestionCount: 12,
        openQuestionCount: 6,
        answeredQuestionCount: 6,
        deferredQuestionCount: 0,
        resolvedQuestionCount: 0,
        terminalQuestionCount: 6,
        followUpQuestionCount: 2,
        followUpOpenQuestionCount: 2,
        topicCoverageCount: 8,
        openTopicCoverageCount: 3,
        followUpBudgetRemainingCount: 20,
        visibleQuestionDebtCount: 2,
        activeQuestionCount: 0,
        upcomingQuestionCount: 2,
        blockedQuestionCount: 0,
        completionPercent: 50
      },
      active: [
        {
          queueItemId: "queue_research_review_after_default_answer" as QueueItemId,
          title: "Review research while questions remain",
          state: "active",
          cardType: "research_review"
        }
      ],
      next: [
        {
          queueItemId: "queue_visible_next_1" as QueueItemId,
          title: "Visible next question 1",
          state: "next",
          cardType: "question"
        },
        {
          queueItemId: "queue_visible_next_2" as QueueItemId,
          title: "Visible next question 2",
          state: "next",
          cardType: "question"
        }
      ],
      blocked: [],
      deferred: []
    };
    const queueAfterActivation: DecisionQueueProjection = {
      ...queueAfterAnswer,
      version: 3 as ProjectionVersion,
      progress: {
        ...queueAfterAnswer.progress!,
        activeQuestionCount: 3,
        upcomingQuestionCount: 0,
        visibleQuestionDebtCount: 3
      },
      active: [
        ...queueAfterAnswer.active,
        {
          queueItemId: "queue_server_selected_1" as QueueItemId,
          title: "Server-selected question",
          state: "active",
          cardType: "question"
        }
      ],
      next: []
    };
    const answerResponse: CommandResponse<DecisionQueueProjection> = {
      category: "accepted_with_projection",
      commandId: "cmd_answer_auto_default_batch" as CommandId,
      correlationId: "corr_answer_auto_default_batch" as CorrelationId,
      stateVersionBefore: 1 as StateVersion,
      stateVersionAfter: 2 as StateVersion,
      immediateProjection: queueAfterAnswer
    };
    const activateResponse: CommandResponse<DecisionQueueProjection> = {
      category: "accepted_with_projection",
      commandId: "cmd_activate_auto_default_batch" as CommandId,
      correlationId: "corr_activate_auto_default_batch" as CorrelationId,
      stateVersionBefore: 2 as StateVersion,
      stateVersionAfter: 3 as StateVersion,
      immediateProjection: queueAfterActivation
    };
    const appendCommand: Parameters<typeof useDecisionQueueSessionActions>[0]["appendCommand"] = async (
      _label,
      commandResponse
    ) => commandResponse;
    const submitAnswer = vi.fn(async () => answerResponse);
    const activateQuestionBatch = vi.fn(async () => activateResponse);
    let actions: ReturnType<typeof useDecisionQueueSessionActions> | undefined;

    function Harness() {
      actions = useDecisionQueueSessionActions({
        answerDrafts: {
          [answeredQueueItemId]: "Answer and let the server choose the next valid batch."
        },
        appendCommand,
        businessCriticIntensity: "balanced",
        businessCriticIntensityChangeReason: "",
        chatGptLoginAcknowledged: true,
        codexLoginAuthenticated: true,
        client: {
          submitAnswer,
          activateQuestionBatch
        } as unknown as SidecarClient,
        connectionStatus: "connected",
        copy: DECISION_QUEUE_COPY.en,
        idea: "Auto-continue with server fallback",
        initialResearchAutomationPermission: "allow_codex",
        initialBusinessCriticIntensityReason: "",
        intake: "Question debt remains even when the visible next list is short.",
        isBusy: false,
        knownRiskDrafts: {},
        projectPurposeMode: "business",
        projections: {
          ...emptyProjectionState(),
          session: {
            kind: "SessionShellProjection",
            projectId,
            sessionId,
            version: 1 as ProjectionVersion,
            phase: "spec",
            projectPurposeMode: "business",
            projectPurposeModeSelectionStatus: "confirmed",
            projectPurposeModeLabel: "Business validation",
            projectPurposeModeEffect: "Business validation mode keeps commercialization gates active."
          },
          queue: {
            kind: "DecisionQueueProjection",
            version: 1 as ProjectionVersion,
            active: [
              {
                queueItemId: answeredQueueItemId,
                title: "Last active question",
                state: "active",
                cardType: "question"
              }
            ],
            next: [],
            blocked: [],
            deferred: []
          }
        },
        purposeModeChangeReason: "",
        questionBatchSize: 3,
        refetchQueueAfterSseNotification: vi.fn(async () => undefined),
        refreshProjections: vi.fn(async () => undefined),
        researchDrafts: {},
        setAnswerDrafts: vi.fn(),
        setBusinessCriticIntensity: vi.fn(),
        setBusinessCriticIntensityChangeReason: vi.fn(),
        setCommandLog: vi.fn(),
        setIsBusy: vi.fn(),
        setKnownRiskDrafts: vi.fn(),
        setPhase15bReadiness: vi.fn(),
        setProjectPurposeMode: vi.fn(),
        setProjections: vi.fn(),
        setPurposeModeChangeReason: vi.fn(),
        setResearchDrafts: vi.fn(),
        setResearchOperations: vi.fn(),
        setStatuses: vi.fn(),
        setWorkflowError: vi.fn()
      });

      return null;
    }

    renderToStaticMarkup(createElement(Harness));

    if (!actions) {
      throw new Error("Session actions were not captured.");
    }

    await actions.submitAnswer(answeredQueueItemId);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(activateQuestionBatch).toHaveBeenCalledWith(
      sessionId,
      2,
      ["queue_visible_next_1", "queue_visible_next_2"]
    );
  });

  it("loads the next question batch while non-question active cards remain visible", async () => {
    const projectId = "proj_next_batch_non_question_active" as ProjectId;
    const sessionId = "sess_next_batch_non_question_active" as SessionId;
    const nextQuestionId = "queue_next_question" as QueueItemId;
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 3 as ProjectionVersion,
      active: [
        {
          queueItemId: "queue_active_research_review" as QueueItemId,
          title: "Review research evidence",
          state: "active",
          cardType: "research_review"
        }
      ],
      next: [
        {
          queueItemId: nextQuestionId,
          title: "Next answerable question",
          state: "next",
          cardType: "question"
        }
      ],
      blocked: [],
      deferred: []
    };
    const activatedQueue: DecisionQueueProjection = {
      ...queue,
      version: 4 as ProjectionVersion,
      active: [
        ...queue.active,
        {
          queueItemId: nextQuestionId,
          title: "Next answerable question",
          state: "active",
          cardType: "question"
        }
      ],
      next: []
    };
    const response: CommandResponse<DecisionQueueProjection> = {
      category: "accepted_with_projection",
      commandId: "cmd_next_batch_non_question_active" as CommandId,
      correlationId: "corr_next_batch_non_question_active" as CorrelationId,
      stateVersionBefore: 3 as StateVersion,
      stateVersionAfter: 4 as StateVersion,
      immediateProjection: activatedQueue
    };
    const appendCommand: Parameters<typeof useDecisionQueueSessionActions>[0]["appendCommand"] = async (
      _label,
      commandResponse
    ) => commandResponse;
    const activateQuestionBatch = vi.fn(async () => response);
    const setWorkflowError = vi.fn();
    let actions: ReturnType<typeof useDecisionQueueSessionActions> | undefined;

    function Harness() {
      actions = useDecisionQueueSessionActions({
        answerDrafts: {},
        appendCommand,
        businessCriticIntensity: "balanced",
        businessCriticIntensityChangeReason: "",
        chatGptLoginAcknowledged: true,
        codexLoginAuthenticated: true,
        client: {
          activateQuestionBatch
        } as unknown as SidecarClient,
        connectionStatus: "connected",
        copy: DECISION_QUEUE_COPY.en,
        idea: "Keep loading question batches",
        initialResearchAutomationPermission: "allow_codex",
        initialBusinessCriticIntensityReason: "",
        intake: "Research review is active but the next question should still load.",
        isBusy: false,
        knownRiskDrafts: {},
        projectPurposeMode: "business",
        projections: {
          ...emptyProjectionState(),
          session: {
            kind: "SessionShellProjection",
            projectId,
            sessionId,
            version: 3 as ProjectionVersion,
            phase: "spec",
            projectPurposeMode: "business",
            projectPurposeModeSelectionStatus: "confirmed",
            projectPurposeModeLabel: "Business validation",
            projectPurposeModeEffect: "Business validation mode keeps commercialization gates active."
          },
          queue
        },
        purposeModeChangeReason: "",
        questionBatchSize: 3,
        refetchQueueAfterSseNotification: vi.fn(async () => undefined),
        refreshProjections: vi.fn(async () => undefined),
        researchDrafts: {},
        setAnswerDrafts: vi.fn(),
        setBusinessCriticIntensity: vi.fn(),
        setBusinessCriticIntensityChangeReason: vi.fn(),
        setCommandLog: vi.fn(),
        setIsBusy: vi.fn(),
        setKnownRiskDrafts: vi.fn(),
        setPhase15bReadiness: vi.fn(),
        setProjectPurposeMode: vi.fn(),
        setProjections: vi.fn(),
        setPurposeModeChangeReason: vi.fn(),
        setResearchDrafts: vi.fn(),
        setResearchOperations: vi.fn(),
        setStatuses: vi.fn(),
        setWorkflowError
      });

      return null;
    }

    renderToStaticMarkup(createElement(Harness));

    if (!actions) {
      throw new Error("Session actions were not captured.");
    }

    await actions.loadNextQuestionBatch();

    expect(setWorkflowError).not.toHaveBeenCalledWith(
      DECISION_QUEUE_COPY.en.questions.sessionActionErrors.answerCurrentBeforeLoadNextQuestions
    );
    expect(activateQuestionBatch).toHaveBeenCalledWith(
      sessionId,
      3,
      [nextQuestionId]
    );
  });

  it("automatically continues after carrying active question debt as a known risk", async () => {
    const projectId = "proj_known_risk_auto_next_batch" as ProjectId;
    const sessionId = "sess_known_risk_auto_next_batch" as SessionId;
    const riskQueueItemId = "queue_known_risk_question" as QueueItemId;
    const nextQuestionId = "queue_known_risk_next_question" as QueueItemId;
    const queueAfterRisk: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 2 as ProjectionVersion,
      active: [
        {
          queueItemId: "queue_known_risk_research_review" as QueueItemId,
          title: "Review research while questions continue",
          state: "active",
          cardType: "research_review"
        }
      ],
      next: [
        {
          queueItemId: nextQuestionId,
          title: "Next question after known risk",
          state: "next",
          cardType: "question"
        }
      ],
      blocked: [],
      deferred: []
    };
    const queueAfterActivation: DecisionQueueProjection = {
      ...queueAfterRisk,
      version: 3 as ProjectionVersion,
      active: [
        ...queueAfterRisk.active,
        {
          queueItemId: nextQuestionId,
          title: "Next question after known risk",
          state: "active",
          cardType: "question"
        }
      ],
      next: []
    };
    const deferResponse: CommandResponse<DecisionQueueProjection> = {
      category: "accepted_with_projection",
      commandId: "cmd_known_risk_defer" as CommandId,
      correlationId: "corr_known_risk_defer" as CorrelationId,
      stateVersionBefore: 1 as StateVersion,
      stateVersionAfter: 2 as StateVersion,
      immediateProjection: queueAfterRisk
    };
    const activateResponse: CommandResponse<DecisionQueueProjection> = {
      category: "accepted_with_projection",
      commandId: "cmd_known_risk_activate" as CommandId,
      correlationId: "corr_known_risk_activate" as CorrelationId,
      stateVersionBefore: 2 as StateVersion,
      stateVersionAfter: 3 as StateVersion,
      immediateProjection: queueAfterActivation
    };
    const appendCommand: Parameters<typeof useDecisionQueueSessionActions>[0]["appendCommand"] = async (
      _label,
      commandResponse
    ) => commandResponse;
    const deferQueueItem = vi.fn(async () => deferResponse);
    const activateQuestionBatch = vi.fn(async () => activateResponse);
    const backgroundResearchStarted = vi.fn(async () => undefined);
    let actions: ReturnType<typeof useDecisionQueueSessionActions> | undefined;

    function Harness() {
      actions = useDecisionQueueSessionActions({
        answerDrafts: {},
        appendCommand,
        businessCriticIntensity: "balanced",
        businessCriticIntensityChangeReason: "",
        chatGptLoginAcknowledged: true,
        codexLoginAuthenticated: true,
        client: {
          deferQueueItem,
          activateQuestionBatch
        } as unknown as SidecarClient,
        connectionStatus: "connected",
        copy: DECISION_QUEUE_COPY.en,
        idea: "Known risk should not stop the question loop",
        initialResearchAutomationPermission: "allow_codex",
        initialBusinessCriticIntensityReason: "",
        intake: "When a question is carried as risk, the next one should keep flowing.",
        isBusy: false,
        knownRiskDrafts: {
          [riskQueueItemId]: "Accept this as a tracked risk and validate it in the next interview."
        },
        projectPurposeMode: "business",
        projections: {
          ...emptyProjectionState(),
          session: {
            kind: "SessionShellProjection",
            projectId,
            sessionId,
            version: 1 as ProjectionVersion,
            phase: "spec",
            projectPurposeMode: "business",
            projectPurposeModeSelectionStatus: "confirmed",
            projectPurposeModeLabel: "Business validation",
            projectPurposeModeEffect: "Business validation mode keeps commercialization gates active."
          },
          queue: {
            kind: "DecisionQueueProjection",
            version: 1 as ProjectionVersion,
            active: [
              {
                queueItemId: riskQueueItemId,
                title: "Carry this question as a known risk",
                state: "active",
                cardType: "question"
              }
            ],
            next: [
              {
                queueItemId: nextQuestionId,
                title: "Next question after known risk",
                state: "next",
                cardType: "question"
              }
            ],
            blocked: [],
            deferred: []
          }
        },
        purposeModeChangeReason: "",
        questionBatchSize: 3,
        refetchQueueAfterSseNotification: vi.fn(async () => undefined),
        refreshProjections: vi.fn(async () => undefined),
        researchDrafts: {},
        setAnswerDrafts: vi.fn(),
        setBusinessCriticIntensity: vi.fn(),
        setBusinessCriticIntensityChangeReason: vi.fn(),
        setCommandLog: vi.fn(),
        setIsBusy: vi.fn(),
        setKnownRiskDrafts: vi.fn(),
        setPhase15bReadiness: vi.fn(),
        setProjectPurposeMode: vi.fn(),
        setProjections: vi.fn(),
        setPurposeModeChangeReason: vi.fn(),
        setResearchDrafts: vi.fn(),
        setResearchOperations: vi.fn(),
        setStatuses: vi.fn(),
        setWorkflowError: vi.fn(),
        startReadyReadOnlyResearchRunsAfterAnswer: backgroundResearchStarted
      });

      return null;
    }

    renderToStaticMarkup(createElement(Harness));

    if (!actions) {
      throw new Error("Session actions were not captured.");
    }

    await actions.carryQueueItemAsKnownRisk(riskQueueItemId);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(deferQueueItem).toHaveBeenCalledWith(expect.objectContaining({
      queueItemId: riskQueueItemId,
      nextValidationAction: "Accept this as a tracked risk and validate it in the next interview."
    }));
    expect(activateQuestionBatch).toHaveBeenCalledWith(
      sessionId,
      2,
      [nextQuestionId]
    );
    expect(backgroundResearchStarted).toHaveBeenCalledTimes(1);
  });

  it("automatically continues after resolving research cards that generated follow-up questions", async () => {
    const projectId = "proj_research_resolve_auto_next_batch" as ProjectId;
    const sessionId = "sess_research_resolve_auto_next_batch" as SessionId;
    const researchCardId = "queue_research_review_card" as QueueItemId;
    const nextQuestionId = "queue_research_follow_up_next" as QueueItemId;
    const queueAfterResolve: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 2 as ProjectionVersion,
      active: [],
      next: [
        {
          queueItemId: nextQuestionId,
          title: "Research-generated follow-up question",
          state: "next",
          cardType: "follow_up_question"
        }
      ],
      blocked: [],
      deferred: []
    };
    const queueAfterActivation: DecisionQueueProjection = {
      ...queueAfterResolve,
      version: 3 as ProjectionVersion,
      active: [
        {
          queueItemId: nextQuestionId,
          title: "Research-generated follow-up question",
          state: "active",
          cardType: "follow_up_question"
        }
      ],
      next: []
    };
    const resolveResponse: CommandResponse<DecisionQueueProjection> = {
      category: "accepted_with_projection",
      commandId: "cmd_research_resolve_auto_next" as CommandId,
      correlationId: "corr_research_resolve_auto_next" as CorrelationId,
      stateVersionBefore: 1 as StateVersion,
      stateVersionAfter: 2 as StateVersion,
      immediateProjection: queueAfterResolve
    };
    const activateResponse: CommandResponse<DecisionQueueProjection> = {
      category: "accepted_with_projection",
      commandId: "cmd_research_resolve_activate" as CommandId,
      correlationId: "corr_research_resolve_activate" as CorrelationId,
      stateVersionBefore: 2 as StateVersion,
      stateVersionAfter: 3 as StateVersion,
      immediateProjection: queueAfterActivation
    };
    const appendCommand: Parameters<typeof useDecisionQueueSessionActions>[0]["appendCommand"] = async (
      _label,
      commandResponse
    ) => commandResponse;
    const resolveResearchQueueCard = vi.fn(async () => resolveResponse);
    const activateQuestionBatch = vi.fn(async () => activateResponse);
    const backgroundResearchStarted = vi.fn(async () => undefined);
    let actions: ReturnType<typeof useDecisionQueueSessionActions> | undefined;

    function Harness() {
      actions = useDecisionQueueSessionActions({
        answerDrafts: {},
        appendCommand,
        businessCriticIntensity: "balanced",
        businessCriticIntensityChangeReason: "",
        chatGptLoginAcknowledged: true,
        codexLoginAuthenticated: true,
        client: {
          resolveResearchQueueCard,
          activateQuestionBatch
        } as unknown as SidecarClient,
        connectionStatus: "connected",
        copy: DECISION_QUEUE_COPY.en,
        idea: "Research cards should feed the next questions",
        initialResearchAutomationPermission: "allow_codex",
        initialBusinessCriticIntensityReason: "",
        intake: "Follow-up questions should appear after research review resolution.",
        isBusy: false,
        knownRiskDrafts: {},
        projectPurposeMode: "business",
        projections: {
          ...emptyProjectionState(),
          session: {
            kind: "SessionShellProjection",
            projectId,
            sessionId,
            version: 1 as ProjectionVersion,
            phase: "spec",
            projectPurposeMode: "business",
            projectPurposeModeSelectionStatus: "confirmed",
            projectPurposeModeLabel: "Business validation",
            projectPurposeModeEffect: "Business validation mode keeps commercialization gates active."
          },
          queue: {
            kind: "DecisionQueueProjection",
            version: 1 as ProjectionVersion,
            active: [
              {
                queueItemId: researchCardId,
                title: "Review this research result",
                state: "active",
                cardType: "research_review"
              }
            ],
            next: [],
            blocked: [],
            deferred: []
          }
        },
        purposeModeChangeReason: "",
        questionBatchSize: 3,
        refetchQueueAfterSseNotification: vi.fn(async () => undefined),
        refreshProjections: vi.fn(async () => undefined),
        researchDrafts: {},
        setAnswerDrafts: vi.fn(),
        setBusinessCriticIntensity: vi.fn(),
        setBusinessCriticIntensityChangeReason: vi.fn(),
        setCommandLog: vi.fn(),
        setIsBusy: vi.fn(),
        setKnownRiskDrafts: vi.fn(),
        setPhase15bReadiness: vi.fn(),
        setProjectPurposeMode: vi.fn(),
        setProjections: vi.fn(),
        setPurposeModeChangeReason: vi.fn(),
        setResearchDrafts: vi.fn(),
        setResearchOperations: vi.fn(),
        setStatuses: vi.fn(),
        setWorkflowError: vi.fn(),
        startReadyReadOnlyResearchRunsAfterAnswer: backgroundResearchStarted
      });

      return null;
    }

    renderToStaticMarkup(createElement(Harness));

    if (!actions) {
      throw new Error("Session actions were not captured.");
    }

    await actions.resolveResearchCard(researchCardId, "approved", "Review this research result");
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(resolveResearchQueueCard).toHaveBeenCalledWith(expect.objectContaining({
      cardId: researchCardId,
      outcome: "approved"
    }));
    expect(activateQuestionBatch).toHaveBeenCalledWith(
      sessionId,
      2,
      [nextQuestionId]
    );
    expect(backgroundResearchStarted).toHaveBeenCalledTimes(1);
  });

  it("automatically continues when a manual research import returns follow-up queue items", async () => {
    const projectId = "proj_manual_research_import_auto_next" as ProjectId;
    const sessionId = "sess_manual_research_import_auto_next" as SessionId;
    const researchTaskId = "research_task_manual_import" as ResearchTaskId;
    const nextQuestionId = "queue_manual_research_follow_up" as QueueItemId;
    const queueAfterImport: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 2 as ProjectionVersion,
      active: [],
      next: [
        {
          queueItemId: nextQuestionId,
          title: "Manual research follow-up question",
          state: "next",
          cardType: "follow_up_question"
        }
      ],
      blocked: [],
      deferred: []
    };
    const queueAfterActivation: DecisionQueueProjection = {
      ...queueAfterImport,
      version: 3 as ProjectionVersion,
      active: [
        {
          queueItemId: nextQuestionId,
          title: "Manual research follow-up question",
          state: "active",
          cardType: "follow_up_question"
        }
      ],
      next: []
    };
    const importResponse: CommandResponse<unknown> = {
      category: "accepted_with_projection",
      commandId: "cmd_manual_research_import" as CommandId,
      correlationId: "corr_manual_research_import" as CorrelationId,
      stateVersionBefore: 1 as StateVersion,
      stateVersionAfter: 2 as StateVersion,
      immediateProjection: {
        kind: "ResearchEvidenceProjection",
        version: 2
      },
      queueProjection: queueAfterImport
    };
    const activateResponse: CommandResponse<DecisionQueueProjection> = {
      category: "accepted_with_projection",
      commandId: "cmd_manual_research_import_activate" as CommandId,
      correlationId: "corr_manual_research_import_activate" as CorrelationId,
      stateVersionBefore: 2 as StateVersion,
      stateVersionAfter: 3 as StateVersion,
      immediateProjection: queueAfterActivation
    };
    const appendCommand: Parameters<typeof useDecisionQueueSessionActions>[0]["appendCommand"] = async (
      _label,
      commandResponse
    ) => commandResponse;
    const importResearchResult = vi.fn(async () => importResponse);
    const activateQuestionBatch = vi.fn(async () => activateResponse);
    const backgroundResearchStarted = vi.fn(async () => undefined);
    let actions: ReturnType<typeof useDecisionQueueSessionActions> | undefined;

    function Harness() {
      actions = useDecisionQueueSessionActions({
        answerDrafts: {},
        appendCommand,
        businessCriticIntensity: "balanced",
        businessCriticIntensityChangeReason: "",
        chatGptLoginAcknowledged: true,
        codexLoginAuthenticated: true,
        client: {
          importResearchResult,
          activateQuestionBatch
        } as unknown as SidecarClient,
        connectionStatus: "connected",
        copy: DECISION_QUEUE_COPY.en,
        idea: "Manual research should feed the question loop",
        initialResearchAutomationPermission: "allow_codex",
        initialBusinessCriticIntensityReason: "",
        intake: "Manual evidence can also generate follow-up questions.",
        isBusy: false,
        knownRiskDrafts: {},
        projectPurposeMode: "business",
        projections: {
          ...emptyProjectionState(),
          session: {
            kind: "SessionShellProjection",
            projectId,
            sessionId,
            version: 1 as ProjectionVersion,
            phase: "validation",
            projectPurposeMode: "business",
            projectPurposeModeSelectionStatus: "confirmed",
            projectPurposeModeLabel: "Business validation",
            projectPurposeModeEffect: "Business validation mode keeps commercialization gates active."
          },
          queue: {
            kind: "DecisionQueueProjection",
            version: 1 as ProjectionVersion,
            active: [],
            next: [],
            blocked: [],
            deferred: []
          }
        },
        purposeModeChangeReason: "",
        questionBatchSize: 3,
        refetchQueueAfterSseNotification: vi.fn(async () => undefined),
        refreshProjections: vi.fn(async () => undefined),
        researchDrafts: {
          [researchTaskId]: "Manual research says the segment has a sharper workflow pain."
        },
        setAnswerDrafts: vi.fn(),
        setBusinessCriticIntensity: vi.fn(),
        setBusinessCriticIntensityChangeReason: vi.fn(),
        setCommandLog: vi.fn(),
        setIsBusy: vi.fn(),
        setKnownRiskDrafts: vi.fn(),
        setPhase15bReadiness: vi.fn(),
        setProjectPurposeMode: vi.fn(),
        setProjections: vi.fn(),
        setPurposeModeChangeReason: vi.fn(),
        setResearchDrafts: vi.fn(),
        setResearchOperations: vi.fn(),
        setStatuses: vi.fn(),
        setWorkflowError: vi.fn(),
        startReadyReadOnlyResearchRunsAfterAnswer: backgroundResearchStarted
      });

      return null;
    }

    renderToStaticMarkup(createElement(Harness));

    if (!actions) {
      throw new Error("Session actions were not captured.");
    }

    await actions.importResearchResult(researchTaskId);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(importResearchResult).toHaveBeenCalledWith(expect.objectContaining({
      researchTaskId,
      result: "Manual research says the segment has a sharper workflow pain."
    }));
    expect(activateQuestionBatch).toHaveBeenCalledWith(
      sessionId,
      2,
      [nextQuestionId]
    );
    expect(backgroundResearchStarted).toHaveBeenCalledTimes(1);
  });

  it("imports visible ChatGPT research with provenance and records the result-import gate when authority is ready", async () => {
    const projectId = "proj_chatgpt_research_import" as ProjectId;
    const sessionId = "sess_chatgpt_research_import" as SessionId;
    const researchTaskId = CHATGPT_BROWSER_DELEGATION_READY_RUN_FIXTURE.researchTaskId;
    const resultImportRef = "research_result_visible_chatgpt_import" as ResearchResultId;
    const importResponse: CommandResponse<unknown> = {
      category: "accepted_with_projection",
      commandId: "cmd_visible_chatgpt_import" as CommandId,
      correlationId: "corr_visible_chatgpt_import" as CorrelationId,
      stateVersionBefore: 1 as StateVersion,
      stateVersionAfter: 2 as StateVersion,
      immediateProjection: {
        kind: "ResearchEvidenceProjection",
        version: 2
      },
      deterministicOutputs: [
        {
          outputType: "reducer_deterministic_output",
          outputRef: resultImportRef,
          payload: {
            researchTaskId,
            synthesisVersion: 1
          }
        }
      ]
    };
    const delegationResponse: CommandResponse<unknown> = {
      category: "accepted_with_projection",
      commandId: "cmd_visible_chatgpt_gate" as CommandId,
      correlationId: "corr_visible_chatgpt_gate" as CorrelationId,
      stateVersionBefore: 2 as StateVersion,
      stateVersionAfter: 3 as StateVersion,
      immediateProjection: {
        kind: "ChatGptBrowserDelegationProjection",
        sessionId,
        version: 3,
        currentStatus: "completed",
        runs: [],
        latestRun: {
          resultImportRef
        }
      }
    };
    const appendCommandCalls = vi.fn();
    const appendCommand: Parameters<typeof useDecisionQueueSessionActions>[0]["appendCommand"] = async (
      label,
      commandResponse
    ) => {
      appendCommandCalls(label, commandResponse);

      return commandResponse;
    };
    const importResearchResult = vi.fn(async () => importResponse);
    const createChatGptBrowserDelegationRun = vi.fn(async () => delegationResponse);
    let actions: ReturnType<typeof useDecisionQueueSessionActions> | undefined;

    function Harness() {
      actions = useDecisionQueueSessionActions({
        answerDrafts: {},
        appendCommand,
        businessCriticIntensity: "balanced",
        businessCriticIntensityChangeReason: "",
        chatGptLoginAcknowledged: true,
        codexLoginAuthenticated: true,
        client: {
          importResearchResult,
          createChatGptBrowserDelegationRun
        } as unknown as SidecarClient,
        connectionStatus: "connected",
        copy: DECISION_QUEUE_COPY.en,
        idea: "Visible ChatGPT result should feed research evidence",
        initialResearchAutomationPermission: "allow_codex_and_chatgpt_visible",
        initialBusinessCriticIntensityReason: "",
        intake: "Paste a Deep Research result after reviewing it.",
        isBusy: false,
        knownRiskDrafts: {},
        projectPurposeMode: "business",
        projections: {
          ...emptyProjectionState(),
          session: {
            kind: "SessionShellProjection",
            projectId,
            sessionId,
            version: 1 as ProjectionVersion,
            phase: "validation",
            projectPurposeMode: "business",
            projectPurposeModeSelectionStatus: "confirmed",
            projectPurposeModeLabel: "Business validation",
            projectPurposeModeEffect: "Business validation mode keeps commercialization gates active.",
            initialResearchAutomationPermission: "allow_codex_and_chatgpt_visible"
          },
          chatGptDelegation: {
            ...CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE,
            sessionId
          }
        },
        purposeModeChangeReason: "",
        questionBatchSize: 3,
        refetchQueueAfterSseNotification: vi.fn(async () => undefined),
        refreshProjections: vi.fn(async () => undefined),
        researchDrafts: {
          [researchTaskId]: "ChatGPT Deep Research result with cited sources and remaining caveats."
        },
        setAnswerDrafts: vi.fn(),
        setBusinessCriticIntensity: vi.fn(),
        setBusinessCriticIntensityChangeReason: vi.fn(),
        setCommandLog: vi.fn(),
        setIsBusy: vi.fn(),
        setKnownRiskDrafts: vi.fn(),
        setPhase15bReadiness: vi.fn(),
        setProjectPurposeMode: vi.fn(),
        setProjections: vi.fn(),
        setPurposeModeChangeReason: vi.fn(),
        setResearchDrafts: vi.fn(),
        setResearchOperations: vi.fn(),
        setStatuses: vi.fn(),
        setWorkflowError: vi.fn(),
        startReadyReadOnlyResearchRunsAfterAnswer: vi.fn(async () => undefined)
      });

      return null;
    }

    renderToStaticMarkup(createElement(Harness));

    if (!actions) {
      throw new Error("Session actions were not captured.");
    }

    await actions.importResearchResult(researchTaskId);

    expect(importResearchResult).toHaveBeenCalledWith(expect.objectContaining({
      researchTaskId,
      result: "ChatGPT Deep Research result with cited sources and remaining caveats.",
      sourceTitle: "User-supplied ChatGPT Pro/Deep Research result",
      sourceReliability: "unknown",
      questionRef: CHATGPT_BROWSER_DELEGATION_READY_RUN_FIXTURE.promptPreviewRef,
      implicationScope: "visible_chatgpt_deep_research_import",
      staleSensitive: true
    }));
    expect(createChatGptBrowserDelegationRun).toHaveBeenCalledWith(expect.objectContaining({
      expectedStateVersion: 2,
      researchTaskId,
      status: "completed",
      resultImportRef,
      resultImportGate: expect.objectContaining({
        sourceProvenanceStatus: "pass",
        uncertaintyStatus: "pass",
        conEvidenceStatus: "pass",
        staleRiskStatus: "pass"
      })
    }));
    expect(appendCommandCalls).toHaveBeenCalledWith(
      "Record visible ChatGPT result import gate",
      delegationResponse
    );
  });

  it("imports onboarding-only visible ChatGPT handoff results with ChatGPT provenance without recording an authority gate", async () => {
    const projectId = "proj_chatgpt_handoff_only_import" as ProjectId;
    const sessionId = "sess_chatgpt_handoff_only_import" as SessionId;
    const researchTaskId = "research_task_chatgpt_handoff_only" as ResearchTaskId;
    const importResponse: CommandResponse<unknown> = {
      category: "accepted_with_projection",
      commandId: "cmd_visible_chatgpt_handoff_only_import" as CommandId,
      correlationId: "corr_visible_chatgpt_handoff_only_import" as CorrelationId,
      stateVersionBefore: 1 as StateVersion,
      stateVersionAfter: 2 as StateVersion,
      immediateProjection: {
        kind: "ResearchEvidenceProjection",
        version: 2
      }
    };
    const importResearchResult = vi.fn(async () => importResponse);
    const createChatGptBrowserDelegationRun = vi.fn();
    let actions: ReturnType<typeof useDecisionQueueSessionActions> | undefined;

    function Harness() {
      actions = useDecisionQueueSessionActions({
        answerDrafts: {},
        appendCommand: async (_label, commandResponse) => commandResponse,
        businessCriticIntensity: "balanced",
        businessCriticIntensityChangeReason: "",
        chatGptLoginAcknowledged: true,
        codexLoginAuthenticated: true,
        client: {
          importResearchResult,
          createChatGptBrowserDelegationRun
        } as unknown as SidecarClient,
        connectionStatus: "connected",
        copy: DECISION_QUEUE_COPY.en,
        idea: "Onboarding-only visible ChatGPT handoff should preserve provenance",
        initialResearchAutomationPermission: "allow_codex_and_chatgpt_visible",
        initialBusinessCriticIntensityReason: "",
        intake: "Paste a user-reviewed Deep Research result.",
        isBusy: false,
        knownRiskDrafts: {},
        projectPurposeMode: "business",
        projections: {
          ...emptyProjectionState(),
          session: {
            kind: "SessionShellProjection",
            projectId,
            sessionId,
            version: 1 as ProjectionVersion,
            phase: "validation",
            projectPurposeMode: "business",
            projectPurposeModeSelectionStatus: "confirmed",
            projectPurposeModeLabel: "Business validation",
            projectPurposeModeEffect: "Business validation mode keeps commercialization gates active.",
            initialResearchAutomationPermission: "allow_codex_and_chatgpt_visible"
          },
          chatGptDelegation: null
        },
        purposeModeChangeReason: "",
        questionBatchSize: 3,
        refetchQueueAfterSseNotification: vi.fn(async () => undefined),
        refreshProjections: vi.fn(async () => undefined),
        researchDrafts: {
          [researchTaskId]: "User-reviewed ChatGPT Deep Research result with cited public sources."
        },
        setAnswerDrafts: vi.fn(),
        setBusinessCriticIntensity: vi.fn(),
        setBusinessCriticIntensityChangeReason: vi.fn(),
        setCommandLog: vi.fn(),
        setIsBusy: vi.fn(),
        setKnownRiskDrafts: vi.fn(),
        setPhase15bReadiness: vi.fn(),
        setProjectPurposeMode: vi.fn(),
        setProjections: vi.fn(),
        setPurposeModeChangeReason: vi.fn(),
        setResearchDrafts: vi.fn(),
        setResearchOperations: vi.fn(),
        setStatuses: vi.fn(),
        setWorkflowError: vi.fn(),
        startReadyReadOnlyResearchRunsAfterAnswer: vi.fn(async () => undefined)
      });

      return null;
    }

    renderToStaticMarkup(createElement(Harness));

    if (!actions) {
      throw new Error("Session actions were not captured.");
    }

    await actions.importResearchResult(researchTaskId);

    expect(importResearchResult).toHaveBeenCalledWith(expect.objectContaining({
      researchTaskId,
      result: "User-reviewed ChatGPT Deep Research result with cited public sources.",
      sourceTitle: "User-supplied ChatGPT Pro/Deep Research result",
      sourceReliability: "unknown",
      questionRef: `visible_chatgpt_handoff:${researchTaskId}`,
      implicationScope: "visible_chatgpt_deep_research_import",
      staleSensitive: true
    }));
    expect(createChatGptBrowserDelegationRun).not.toHaveBeenCalled();
  });
});
