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
import { nextQuestionBatchIdsForActivation, useDecisionQueueSessionActions } from "./useDecisionQueueSessionActions";

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
});
