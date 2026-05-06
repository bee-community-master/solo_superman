import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  CommandId,
  CorrelationId,
  DecisionEvidencePackId,
  DecisionQueueProjection,
  EffectTaskId,
  EventId,
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
  SchemaVersion,
  SessionId,
  StatusEndpointDto
} from "@solo-superman/contracts";
import {
  pendingEffectSummary,
  type Phase15aOperationsInput,
  phase15aOperationsViewModel,
  queueSections,
  runtimeActivityProjectionFromStatuses
} from "./decision-queue-view-model";
import { Phase15aOperationsPanel } from "./Phase15aOperationsPanel";
import { buildDesktopResearchRunRequest } from "./phase15a-research-run-request";

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

  it("summarizes Phase 1.5A operations recovery and keeps blocking research cards explicit", () => {
    const operations = phase15aOperations();

    expect(operations.allowlistPolicyLabel).toContain("public_search");
    expect(operations.allowlistPolicyLabel).toContain("2 concurrent / 12 per session");
    expect(operations.disclosureActivityLabel).toContain("automatic_payload_ready");
    expect(operations.runRecoveryLabel).toContain("/api/v1/projects/proj_phase15a_ui/research-runs");
    expect(operations.qualityGateLabel).toContain("needs_review");
    expect(operations.staleOrFailureReasons).toEqual([
      expect.stringContaining("Source reliability is insufficient")
    ]);
    expect(operations.exitGate).toMatchObject({
      status: "blocked_for_1_5b",
      blockers: [expect.stringContaining("Research card still blocks Planning-ready")]
    });
  });

  it("marks the Phase 1.5A exit gate ready only when recovery, quality gate, and research cards are terminal", () => {
    const operations = phase15aOperations({
      runs: runProjection("accepted"),
      research: researchProjection(false)
    });

    expect(operations.exitGate).toEqual({
      status: "ready_for_1_5b",
      label: "Phase 1.5A exit gate is explicit and ready for 1.5B sequencing.",
      blockers: []
    });
  });

  it("keeps terminal research-insufficient high-impact cards blocking 1.5B readiness", () => {
    const research = researchProjection(false);
    const terminalBlockingResearch = {
      ...research,
      reviewCards: research.reviewCards.map((card) => ({
        ...card,
        terminalOutcome: "research_insufficient" as const,
        terminalRationale: "Evidence remains too weak for Planning-ready handoff.",
        blocksPlanning: true
      }))
    };
    const operations = phase15aOperations({
      runs: runProjection("accepted"),
      research: terminalBlockingResearch
    });

    expect(operations.exitGate).toMatchObject({
      status: "blocked_for_1_5b",
      blockers: [expect.stringContaining("Review public onboarding evidence")]
    });
  });

  it("keeps review-card-only quality gate metadata visible", () => {
    const research = researchProjection(true);
    const reviewCardOnlyResearch = {
      ...research,
      evidencePacks: [],
      reviewCards: research.reviewCards.map((card) => ({
        ...card,
        reviewReason: "Manual quality gate review is still required."
      }))
    };
    const operations = phase15aOperations({
      runs: null,
      research: reviewCardOnlyResearch
    });

    expect(operations.qualityGateLabel).toContain("Review public onboarding evidence");
    expect(operations.qualityGateLabel).toContain("needs_review");
  });

  it("keeps the Phase 1.5A exit gate blocked when allowlist refetch recovery is missing", () => {
    const allowlistsWithoutVisibleRefetch: ResearchAllowlistGovernanceProjection = {
      ...allowlistProjection(),
      refetchUrl: ""
    };

    const operations = phase15aOperations({
      allowlists: allowlistsWithoutVisibleRefetch,
      runs: runProjection("accepted"),
      research: researchProjection(false)
    });

    expect(operations.exitGate).toMatchObject({
      status: "blocked_for_1_5b",
      blockers: ["Allowlist governance refetch recovery is not visible."]
    });
  });

  it("builds read-only run requests from the selected research task instead of the first task", () => {
    const research = researchProjection(true);
    const [firstTask] = research.tasks;
    const [allowlist] = allowlistProjection().allowlists;

    if (!firstTask || !allowlist) {
      throw new Error("Phase 1.5A research request fixture is incomplete.");
    }

    const selectedTaskId = "research_task_phase15a_selected" as ResearchTaskId;
    const selectedTask = {
      ...firstTask,
      researchTaskId: selectedTaskId,
      objective: "Validate the second task source linkage.",
      sourceQueueItemId: "queue_item_selected" as QueueItemId
    };
    const request = buildDesktopResearchRunRequest({
      allowlist,
      specTitle: "Selected task product",
      task: selectedTask
    });

    expect(request).toMatchObject({
      researchTaskId: selectedTaskId,
      researchObjective: "Validate the second task source linkage.",
      productCategory: "Selected task product",
      sourceRefs: ["queue_item_selected"]
    });
    expect(request.contextHash).toContain(selectedTaskId);
  });

  it("renders the extracted Phase 1.5A operations panel controls and session gating", () => {
    const noop = () => undefined;
    const markup = renderToStaticMarkup(
      createElement(Phase15aOperationsPanel, {
        hasActiveSession: false,
        isBusy: false,
        operations: phase15aOperations(),
        researchOperations: {
          allowlists: allowlistProjection(),
          disclosures: disclosureProjection(),
          runs: runProjection()
        },
        onCreateOrReactivateAllowlist: noop,
        onRefreshOperations: noop,
        onPauseAllowlist: noop,
        onRevokeAllowlist: noop,
        onRefreshResearchRunStatus: noop,
        onCancelResearchRun: noop,
        onRetryResearchRun: noop
      })
    );

    expect(markup).toContain("1.5A Operations");
    expect(markup).toContain("<button type=\"button\" disabled=\"\">Create/reactivate allowlist</button>");
    expect(markup).toContain("<button type=\"button\" disabled=\"\">Refresh operations</button>");
    expect(markup).toContain("<button type=\"button\" disabled=\"\">Pause</button>");
    expect(markup).toContain("<button type=\"button\" disabled=\"\">Revoke</button>");
    expect(markup).toContain("<button type=\"button\" disabled=\"\">Refresh status</button>");
    expect(markup).toContain("quality gate: pending_review");
  });
});
