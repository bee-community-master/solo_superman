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


describe("Decision Queue view model phase15a", () => {
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

});
