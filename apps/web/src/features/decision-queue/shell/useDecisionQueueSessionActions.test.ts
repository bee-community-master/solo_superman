import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  CommandId,
  CommandResponse,
  CorrelationId,
  DecisionQueueProjection,
  ProjectId,
  ProjectionVersion,
  QueueItemId,
  ResearchTaskId,
  SessionId,
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
    expect(boundedQuestionBatchSize(2)).toBe(3);
    expect(boundedQuestionBatchSize(4)).toBe(4);
    expect(boundedQuestionBatchSize(9)).toBe(5);
    expect(boundedQuestionBatchSize(Number.NaN)).toBe(5);
  });

  it("falls back to default activation when too few queued ids would violate the server batch minimum", () => {
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

    expect(nextQuestionBatchIdsForActivation(queue, 3)).toBeUndefined();
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
        initialResearchPermission: "allow_public_web",
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
        initialResearchPermission: "allow_public_web",
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
        initialResearchPermission: "allow_public_web",
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
      undefined
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
        initialResearchPermission: "allow_public_web",
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
        initialResearchPermission: "allow_public_web",
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
        initialResearchPermission: "allow_public_web",
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
});
