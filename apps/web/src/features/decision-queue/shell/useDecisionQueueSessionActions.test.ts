import { describe, expect, it } from "vitest";
import type {
  DecisionQueueProjection,
  ProjectionVersion,
  QueueItemId,
  ResearchTaskId
} from "@solo-superman/contracts";
import { nextQuestionBatchIdsForActivation } from "./useDecisionQueueSessionActions";

describe("nextQuestionBatchIdsForActivation", () => {
  it("uses queued next question ids while ignoring non-question review cards", () => {
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
