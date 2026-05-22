import { describe, expect, it } from "vitest";

import type {
  CommandId,
  CorrelationId,
  DecisionQueueProjection,
  EffectTaskId,
  EventId,
  ProjectionVersion,
  QueueItemId,
  SchemaVersion,
  SessionId,
  SseEvent,
  StatusEndpointDto
} from "@solo-superman/contracts";
import {
  decisionQueueRecoveryViewModel,
  pendingEffectSummary,
  questionProgressViewModel,
  queueSections,
  runtimeActivityProjectionFromStatuses,
  shouldRefetchQueueForSseNotification
} from "./decision-queue-view-model";


describe("Decision Queue view model queue", () => {
  it("keeps active batch items separate from queued-next items", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 7 as ProjectionVersion,
      active: [
        {
          queueItemId: "queue_active_1" as QueueItemId,
          title: "What problem is most urgent?",
          state: "active",
          answerOptions: [
            {
              id: "urgent_segment",
              label: "Pick one urgent segment",
              value: "The urgent segment is solo founders validating a new product.",
              pro: "Focuses the next validation step.",
              con: "May be too narrow if evidence is weak."
            }
          ]
        }
      ],
      next: [
        {
          queueItemId: "queue_next_1" as QueueItemId,
          title: "Which segment should be next?",
          state: "next"
        }
      ],
      blocked: [],
      deferred: []
    };
    const sections = queueSections(queue);

    expect(sections.find((section) => section.id === "active")?.items.map((item) => item.queueItemId)).toEqual([
      "queue_active_1"
    ]);
    expect(sections.find((section) => section.id === "active")?.items[0]?.answerOptions?.[0]).toMatchObject({
      pro: "Focuses the next validation step.",
      con: "May be too narrow if evidence is weak."
    });
    expect(sections.find((section) => section.id === "next")?.items.map((item) => item.queueItemId)).toEqual([
      "queue_next_1"
    ]);
  });

  it("surfaces current-question selection and notification-only refresh recovery state", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      projectionKind: "DecisionQueueProjection",
      sessionId: "sess_queue_recovery" as SessionId,
      version: 7 as ProjectionVersion,
      generatedAt: "2026-05-08T00:00:00.000Z",
      stale: false,
      refetchUrl: "/api/v1/sessions/sess_queue_recovery/queue",
      activeBatch: {
        batchId: "active-batch:queue_active_1",
        queueItemIds: ["queue_active_1" as QueueItemId],
        selectedAt: "2026-05-08T00:00:00.000Z",
        priorityReason: "severity_ordered_batch(severity:high/topic:primary_customer)",
        stabilityPolicy: "preserve_active_batch_until_terminal_or_explicit_reactivation"
      },
      recovery: {
        status: "pending_refetch",
        refetchUrl: "/api/v1/sessions/sess_queue_recovery/queue",
        sseStreamUrl: "/api/v1/events/stream?sessionId=sess_queue_recovery",
        sseEventNames: ["projection.updated"],
        pendingEffectCount: 1
      },
      active: [
        {
          queueItemId: "queue_active_1" as QueueItemId,
          title: "What problem is most urgent?",
          state: "active",
          severity: "high",
          topicKey: "primary_customer"
        }
      ],
      next: [],
      blocked: [],
      deferred: []
    };
    const event: SseEvent = {
      event: "projection.updated",
      emittedAt: "2026-05-08T00:00:05.000Z",
      projectionKind: "DecisionQueueProjection",
      version: 7 as ProjectionVersion,
      affectedIds: ["sess_queue_recovery"],
      refetchUrl: "/api/v1/sessions/sess_queue_recovery/queue"
    };
    const recovery = decisionQueueRecoveryViewModel(queue);

    expect(recovery).toMatchObject({
      status: "pending_refetch",
      refetchLabel: "Question refresh /api/v1/sessions/sess_queue_recovery/queue",
      sseLabel: "Live update stream /api/v1/events/stream?sessionId=sess_queue_recovery"
    });
    expect(recovery.activeBatchLabel).toBe("1 current question selected for this round.");
    expect(shouldRefetchQueueForSseNotification(event, queue)).toBe(true);
    expect(
      shouldRefetchQueueForSseNotification(
        {
          ...event,
          affectedIds: ["sess_other_queue"]
        },
        queue
      )
    ).toBe(false);
  });

  it("preserves Research-updated Queue card metadata for terminal-outcome rendering", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 8 as ProjectionVersion,
      active: [],
      next: [
        {
          queueItemId: "research_review_task_1" as QueueItemId,
          title: "Evidence ready: Validate pricing",
          state: "next",
          cardType: "decision_approval",
          blocksPlanning: true,
          availableOutcomes: ["approved", "revised", "rejected", "deferred"]
        }
      ],
      blocked: [],
      deferred: []
    };
    const card = queueSections(queue).find((section) => section.id === "next")?.items[0];

    expect(card).toMatchObject({
      cardType: "decision_approval",
      blocksPlanning: true,
      availableOutcomes: expect.arrayContaining(["approved", "deferred"])
    });
  });

  it("summarizes generated, answered, follow-up, and visible question debt", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 9 as ProjectionVersion,
      progress: {
        generatedQuestionCount: 23,
        openQuestionCount: 18,
        answeredQuestionCount: 4,
        deferredQuestionCount: 1,
        resolvedQuestionCount: 0,
        terminalQuestionCount: 5,
        followUpQuestionCount: 8,
        followUpOpenQuestionCount: 7,
        topicCoverageCount: 12,
        openTopicCoverageCount: 9,
        followUpBudgetRemainingCount: 40,
        visibleQuestionDebtCount: 6,
        activeQuestionCount: 5,
        upcomingQuestionCount: 1,
        blockedQuestionCount: 0,
        completionPercent: 22
      },
      active: [
        {
          queueItemId: "queue_active_1" as QueueItemId,
          title: "What decision is next?",
          state: "active",
          cardType: "question"
        }
      ],
      next: [
        {
          queueItemId: "research_review_task_1" as QueueItemId,
          title: "Research review",
          state: "next",
          cardType: "research_review"
        }
      ],
      blocked: [],
      deferred: []
    };

    expect(questionProgressViewModel(queue)).toMatchObject({
      generatedQuestionCount: 23,
      openQuestionCount: 18,
      answeredQuestionCount: 4,
      terminalQuestionCount: 5,
      followUpQuestionCount: 8,
      followUpOpenQuestionCount: 7,
      topicCoverageCount: 12,
      openTopicCoverageCount: 9,
      followUpBudgetRemainingCount: 40,
      visibleQuestionDebtCount: 6,
      activeQuestionCount: 5,
      upcomingQuestionCount: 1,
      blockedQuestionCount: 0,
      completionPercent: 22
    });
  });

  it("summarizes pending effects without inventing product state", () => {
    const statuses: readonly StatusEndpointDto[] = [
      {
        commandId: "cmd_1" as CommandId,
        category: "accepted_with_projection",
        commandStatus: "pending",
        eventIds: [],
        effects: [
          {
            effectTaskId: "eft_1" as EffectTaskId,
            effectType: "queue_projection_effect",
            sourceCommandId: "cmd_1" as CommandId,
            sourceEventIds: ["evt_1" as EventId],
            correlationId: "corr_1" as CorrelationId,
            idempotencyKey: "evt_1:decision_queue",
            status: "queued",
            attemptCount: 0,
            maxAttempts: 3,
            queuedAt: "2026-05-05T00:00:00.000Z",
            updatedAt: "2026-05-05T00:00:00.000Z",
            schemaVersion: "solo-superman.contracts.v1" as SchemaVersion
          }
        ],
        pendingEffectSummary: {
          totalPending: 1,
          byType: {
            queue_projection_effect: 1
          },
          visibleLabel: "1 persisted async effect task(s) queued."
        },
        projectionHints: [],
        lastUpdatedAt: "2026-05-05T00:00:00.000Z"
      }
    ];

    expect(pendingEffectSummary(statuses)).toMatchObject({
      totalPending: 1,
      byType: {
        queue_projection_effect: 1
      }
    });
    expect(runtimeActivityProjectionFromStatuses(statuses)).toMatchObject({
      kind: "RuntimeActivityProjection",
      runtimeStatus: "available",
      effects: [
        expect.objectContaining({
          effectTaskId: "eft_1"
        })
      ]
    });
  });

});
