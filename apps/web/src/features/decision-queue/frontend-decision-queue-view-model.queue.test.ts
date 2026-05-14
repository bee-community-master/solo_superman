/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BLOCKED_ACTION_TYPES,
  PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE,
  PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE
} from "@solo-superman/contracts";
import type {
  CommandId,
  CorrelationId,
  DecisionEvidencePackId,
  DecisionQueueProjection,
  EffectTaskId,
  EventId,
  Phase15bUpgradeHintProjection,
  PlanningHandoffProjection,
  ProjectId,
  ProjectionVersion,
  QueueItemId,
  ResearchAllowlistGovernanceProjection,
  ResearchAllowlistId,
  ResearchConnectorId,
  ResearchDisclosureLogId,
  ResearchDisclosureLogProjection,
  ResearchEvidenceProjection,
  ResearchResultId,
  ResearchRunControlProjection,
  ResearchRunId,
  ResearchTaskId,
  RuntimeArtifactId,
  SchemaVersion,
  SessionId,
  SseEvent,
  StatusEndpointDto
} from "@solo-superman/contracts";
import {
  decisionQueueRecoveryViewModel,
  pendingEffectSummary,
  type Phase15aOperationsInput,
  type PlanningHandoffViewModel,
  phase15aOperationsViewModel,
  phase15bReadinessViewModel,
  planningHandoffViewModel,
  queueSections,
  runtimeActivityProjectionFromStatuses,
  shouldRefetchQueueForSseNotification
} from "./decision-queue-view-model";
import { Phase15aOperationsPanel } from "./Phase15aOperationsPanel";
import { Phase15bReadinessPanel } from "./Phase15bReadinessPanel";
import { PlanningHandoffPanel } from "./PlanningHandoffPanel";
import { buildWebResearchRunRequest } from "./phase15a-research-run-request";

const projectId = "proj_phase15a_ui" as ProjectId;
const allowlistId = "research_allowlist_phase15a_ui" as ResearchAllowlistId;
const researchTaskId = "research_task_phase15a_ui" as ResearchTaskId;

function allowlistProjection(): ResearchAllowlistGovernanceProjection {
  return {
    kind: "ResearchAllowlistGovernanceProjection",
    projectionKind: "ResearchAllowlistProjection",
    projectId,
    version: 1 as ProjectionVersion,
    generatedAt: "2026-05-06T00:00:00.000Z",
    stale: false,
    refetchUrl: `/api/v1/projects/${projectId}/research-allowlists`,
    pendingEffectSummary: {
      totalPending: 0,
      byType: {},
      visibleLabel: "No async ProductEngine effects are pending for this allowlist governance action."
    },
    allowlists: [
      {
        kind: "ResearchAllowlistProjection",
        version: 1 as ProjectionVersion,
        allowlistId,
        projectId,
        status: "active",
        connectorIds: ["public_search" as ResearchConnectorId],
        sourceCategories: ["public_web"],
        contextMode: "public_safe_summary",
        rateBudgetPolicy: {
          maxConcurrentRunsPerProject: 2,
          maxRunsPerSession: 12,
          maxAutomaticRetriesPerRun: 2,
          runTimeoutSeconds: 600,
          retryBackoffSeconds: [30, 120]
        },
        stalenessPolicy: {
          staleWhenRunExceedsTaskFreshnessWindow: true,
          staleWhenSourcePredatesTaskRequirement: true
        },
        disclosureLogPolicy: {
          logEveryAutomaticRun: true,
          publicSafeSummaryRequired: true
        },
        approvedBy: "owner_ui",
        approvedAt: "2026-05-06T00:00:00.000Z",
        createdAt: "2026-05-06T00:00:00.000Z",
        updatedAt: "2026-05-06T00:00:00.000Z"
      }
    ],
    automaticRunStartPolicies: [
      {
        allowed: true,
        allowlistId,
        allowlistVersion: 1 as ProjectionVersion,
        reason: "active_public_safe_allowlist"
      }
    ]
  };
}

function disclosureProjection(): ResearchDisclosureLogProjection {
  const latestDisclosureLog = {
    logId: "research_disclosure_phase15a_ui" as ResearchDisclosureLogId,
    projectId,
    allowlistId,
    connectorId: "public_search" as ResearchConnectorId,
    sourceCategory: "public_web",
    researchObjective: "Find public onboarding evidence.",
    objectiveSummary: "Find public onboarding evidence.",
    publicSafeSummarySent: "Product category: Founder workflow assistant.",
    sourceRefs: ["queue_item_phase15a"],
    automaticExternalTransferAllowed: true,
    status: "automatic_payload_ready",
    createdAt: "2026-05-06T00:00:00.000Z"
  } as const;

  return {
    kind: "ResearchDisclosureLogProjection",
    version: 1 as ProjectionVersion,
    projectId,
    generatedAt: "2026-05-06T00:00:00.000Z",
    stale: false,
    refetchUrl: `/api/v1/projects/${projectId}/research-disclosures`,
    disclosureLogs: [latestDisclosureLog],
    latestDisclosureLog
  };
}

function runProjection(status: "needs_review" | "accepted" = "needs_review"): ResearchRunControlProjection {
  const researchRunId = "research_run_phase15a_ui" as ResearchRunId;

  return {
    kind: "ResearchRunControlProjection",
    projectionKind: "ResearchRunProjection",
    projectId,
    version: 2 as ProjectionVersion,
    generatedAt: "2026-05-06T00:00:00.000Z",
    stale: false,
    refetchUrl: `/api/v1/projects/${projectId}/research-runs`,
    statusUrl: `/api/v1/projects/${projectId}/research-runs/${researchRunId}/status`,
    pendingEffectSummary: {
      totalPending: 0,
      byType: {},
      visibleLabel: "No async ProductEngine effects are pending."
    },
    runs: [
      {
        kind: "ResearchRunProjection",
        version: 2 as ProjectionVersion,
        researchRunId,
        projectId,
        researchTaskId,
        allowlistId,
        disclosureLogId: "research_disclosure_phase15a_ui" as ResearchDisclosureLogId,
        connectorId: "public_search" as ResearchConnectorId,
        sourceCategory: "public_web",
        status,
        provider: {
          researchRunId,
          researchTaskId,
          adapterKind: "local_fake_readonly",
          adapterVersion: "solo-superman.fake-readonly-research-adapter.v1",
          providerRunId: "fake_readonly_research_run_phase15a_ui",
          sourceCategory: "public_web",
          idempotencyKey: "research-run:v1:phase15a-ui",
          startedAt: "2026-05-06T00:00:00.000Z",
          ...(status === "accepted" ? { completedAt: "2026-05-06T00:01:00.000Z" } : {}),
          attempt: 1
        },
        qualityGateStatus: status === "accepted" ? "passed" : "pending_review",
        ...(status === "needs_review"
          ? { qualityGateReviewReason: "Source reliability is insufficient for automatic acceptance." }
          : { terminalReason: "quality_gate_accepted" as const }),
        sourceRefs: ["queue_item_phase15a"],
        createdAt: "2026-05-06T00:00:00.000Z",
        updatedAt: "2026-05-06T00:01:00.000Z"
      }
    ],
    recovery: {
      statusUrl: `/api/v1/projects/${projectId}/research-runs/${researchRunId}/status`,
      refetchUrl: `/api/v1/projects/${projectId}/research-runs/${researchRunId}/status`,
      sseEventNames: ["projection.updated"],
      projectionHints: [
        {
          projectionKind: "ResearchRunProjection",
          refetchUrl: `/api/v1/projects/${projectId}/research-runs/${researchRunId}/status`
        }
      ]
    }
  };
}

function researchProjection(blocksPlanning = true): ResearchEvidenceProjection {
  return {
    kind: "ResearchEvidenceProjection",
    version: 3 as ProjectionVersion,
    taskIds: [researchTaskId],
    tasks: [
      {
        researchTaskId,
        sessionId: "sess_phase15a_ui" as SessionId,
        objective: "Find public onboarding evidence.",
        routeOutcome: "research_needed",
        impact: "high",
        status: "needs_review",
        createdAt: "2026-05-06T00:00:00.000Z"
      }
    ],
    results: [],
    evidenceMatrices: [],
    evidencePacks: [
      {
        evidencePackId: "evidence_pack_phase15a_ui" as DecisionEvidencePackId,
        researchTaskId,
        researchResultId: "research_result_phase15a_ui" as ResearchResultId,
        researchRunId: "research_run_phase15a_ui" as ResearchRunId,
        claim: "Founders need safer onboarding research.",
        decisionContext: "Phase 1.5A acceptance",
        sourceReliability: "unknown",
        retrievedAt: "2026-05-06T00:01:00.000Z",
        gateStatus: blocksPlanning ? "needs_review" : "accepted",
        gateChecks: [],
        proEvidenceItemIds: [],
        conEvidenceItemIds: [],
        uncertaintyItemIds: [],
        limitationRefs: [],
        implicationScope: "UI acceptance coverage",
        createdAt: "2026-05-06T00:01:00.000Z"
      }
    ],
    reviewCards: [
      {
        cardId: "research_card_phase15a_ui" as QueueItemId,
        researchTaskId,
        evidencePackId: "evidence_pack_phase15a_ui" as DecisionEvidencePackId,
        cardType: "research_review",
        title: "Review public onboarding evidence",
        state: blocksPlanning ? "quality_gate_review" : "resolved",
        impact: "high",
        gateStatus: blocksPlanning ? "needs_review" : "accepted",
        availableOutcomes: blocksPlanning ? ["approved", "revised", "research_insufficient"] : [],
        ...(blocksPlanning ? {} : { terminalOutcome: "approved" as const }),
        blocksPlanning,
        recoveryActions: blocksPlanning ? ["import_manual_result", "mark_research_insufficient"] : []
      }
    ],
    knownRisks: [],
    nextValidationActions: [],
    proConBalanceStatus: blocksPlanning ? "source_quality_insufficient" : "balanced"
  };
}

function phase15aOperations(overrides: Partial<Phase15aOperationsInput> = {}) {
  return phase15aOperationsViewModel({
    allowlists: allowlistProjection(),
    disclosures: disclosureProjection(),
    runs: runProjection(),
    research: researchProjection(true),
    ...overrides
  });
}

function phase15bHintProjection(): Phase15bUpgradeHintProjection {
  return {
    kind: "Phase15bUpgradeHintProjection",
    projectionKind: "Phase15bUpgradeHintProjection",
    projectId,
    version: 4 as ProjectionVersion,
    generatedAt: "2026-05-06T00:02:00.000Z",
    stale: false,
    refetchUrl: `/api/v1/projects/${projectId}/phase15b-upgrade-hints`,
    exportUrl: `/api/v1/projects/${projectId}/phase15b-upgrade-hints/export`,
    pendingEffectSummary: {
      totalPending: 0,
      byType: {},
      visibleLabel: "No execution effects are pending."
    },
    metadataLabel: "readiness_preview_handoff_metadata",
    privatePayloadPolicy: "public_safe_metadata_only",
    noExecution: {
      semantic: "metadata_only_no_execution",
      productActionPerformed: false,
      delegationState: "not_active",
      credentialValueState: "omitted"
    },
    records: [
      {
        hintId: "phase15b_hint_ui",
        projectId,
        sessionId: "sess_phase15a_ui" as SessionId,
        artifactId: "runtime_artifact_phase15b_ui" as RuntimeArtifactId,
        artifactKind: "BlockedActionArtifact",
        metadataLabel: "readiness_preview_handoff_metadata",
        privatePayloadPolicy: "public_safe_metadata_only",
        noExecution: {
          semantic: "metadata_only_no_execution",
          productActionPerformed: false,
          delegationState: "not_active",
          credentialValueState: "omitted"
        },
        sourceRefLabelPolicy: "labels_omitted_to_avoid_private_payload_export",
        hints: {
          executionIntent: {
            candidateActionType: "shell_command",
            targetSurface: "Planning handoff checklist",
            nonExecutingSummary: "Preview the command prerequisites without running them."
          },
          approvalRequirements: [
            {
              approvalType: "task_level_execution",
              reason: "A later phase must ask before a shell command can run.",
              scope: "pnpm verify in an isolated workspace",
              requiredActor: "user",
              reconfirmRule: "Ask again for every new command target."
            }
          ],
          sandboxRequirements: {
            isolatedWorktreeRequired: true,
            browserSandboxRequired: false,
            networkMode: "offline",
            commandAllowlist: ["pnpm verify"],
            secretGrantBoundary: "No secret values are needed for this readiness check.",
            environmentPolicy: "local-only test process",
            logCaptureRequired: true
          },
          rollbackReference: {
            baseRef: "origin/main",
            diffRef: "codex/issue-37-readiness-ui-handoff-copy",
            rollbackNote: "Reset the feature branch to the base ref if the handoff checklist is withdrawn.",
            reversible: true,
            cleanupExpectation: "Delete the feature branch after merge or cancellation."
          },
          expectedEvidence: {
            tests: ["pnpm verify"],
            smokeChecks: ["pnpm smoke:e2e"],
            artifactPaths: ["apps/web/src/features/decision-queue/Phase15bReadinessPanel.tsx"],
            manualInspection: ["Confirm labels say readiness, preview, blocked, or handoff."],
            expectedLogs: ["readiness metadata fetched"]
          },
          riskNormalization: {
            riskLevel: "medium",
            blockedActionType: "shell_command",
            blockReason: "Phase 1.5B may describe shell-command needs but cannot run commands as product behavior.",
            userVisibleAction: "Review the handoff checklist before a later phase asks for approval.",
            escalationTarget: "Phase 3 safe execution policy"
          },
          sourceRefs: [
            {
              kind: "blocked_action",
              refId: "runtime_artifact_phase15b_ui"
            },
            {
              kind: "research_run",
              refId: "research_run_phase15a_ui"
            }
          ],
          createdAt: "2026-05-06T00:02:00.000Z",
          schemaVersion: "solo-superman.phase15b-hints.v1" as SchemaVersion
        },
        createdAt: "2026-05-06T00:02:00.000Z",
        schemaVersion: "solo-superman.phase15b-hints.v1" as SchemaVersion
      }
    ]
  };
}

function handoffProjectionFixture(kind: "final" | "blocker"): PlanningHandoffProjection {
  return kind === "final"
    ? (PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE as PlanningHandoffProjection)
    : (PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE as PlanningHandoffProjection);
}

function handoffCopy(handoff: PlanningHandoffViewModel) {
  const artifact = handoff.final ?? handoff.blocker;

  return [
    handoff.statusLabel,
    handoff.label,
    handoff.summary,
    handoff.noExecutionLabel,
    handoff.refetchLabel,
    handoff.sourceRefsLabel,
    artifact?.heading,
    ...(artifact?.groups.flatMap((group) => [group.title, ...group.items]) ?? [])
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");
}


describe("Decision Queue view model queue", () => {
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

  it("surfaces active batch priority and notification-only SSE refetch recovery state", () => {
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
      refetchLabel: "Canonical refetch /api/v1/sessions/sess_queue_recovery/queue",
      sseLabel: "SSE notification stream /api/v1/events/stream?sessionId=sess_queue_recovery"
    });
    expect(recovery.activeBatchLabel).toContain("severity_ordered_batch");
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
