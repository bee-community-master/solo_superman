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
  StatusEndpointDto
} from "@solo-superman/contracts";
import { pendingEffectSummary, queueSections, runtimeActivityProjectionFromStatuses } from "./decision-queue-view-model";

describe("Decision Queue view model", () => {
  it("keeps active batch items separate from queued-next items", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 7 as ProjectionVersion,
      active: [
        {
          queueItemId: "queue_active_1" as QueueItemId,
          title: "What problem is most urgent?",
          state: "active"
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
    expect(sections.find((section) => section.id === "next")?.items.map((item) => item.queueItemId)).toEqual([
      "queue_next_1"
    ]);
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
