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
});
