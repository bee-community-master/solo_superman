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
  StatusEndpointDto
} from "@solo-superman/contracts";
import {
  pendingEffectSummary,
  type Phase15aOperationsInput,
  type PlanningHandoffViewModel,
  phase15aOperationsViewModel,
  phase15bReadinessViewModel,
  planningHandoffViewModel,
  queueSections,
  runtimeActivityProjectionFromStatuses
} from "./decision-queue-view-model";
import { Phase15aOperationsPanel } from "./Phase15aOperationsPanel";
import { Phase15bReadinessPanel } from "./Phase15bReadinessPanel";
import { PlanningHandoffPanel } from "./PlanningHandoffPanel";
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
            artifactPaths: ["apps/desktop/src/features/decision-queue/Phase15bReadinessPanel.tsx"],
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

  it("summarizes Phase 1.5B readiness hints without execution-result copy", () => {
    const readiness = phase15bReadinessViewModel(phase15bHintProjection());
    const [record] = readiness.records;

    expect(readiness).toMatchObject({
      status: "metadata_visible",
      statusLabel: "readiness metadata visible",
      label: expect.stringContaining("readiness/preview/handoff"),
      noExecutionLabel: expect.stringContaining("product action not performed"),
      exportLabel: expect.stringContaining("/phase15b-upgrade-hints/export"),
      emptyLabel: expect.stringContaining("No readiness/preview/handoff metadata records")
    });
    expect(record).toMatchObject({
      surfaceLabel: expect.stringContaining("Planning handoff checklist"),
      approvalLabel: expect.stringContaining("task level execution"),
      sandboxLabel: expect.stringContaining("isolated worktree required"),
      rollbackLabel: expect.stringContaining("origin/main"),
      evidenceLabel: expect.stringContaining("pnpm verify"),
      riskLabel: expect.stringContaining("Phase 1.5B"),
      sourceRefLabel: expect.stringContaining("blocked action:runtime_artifact_phase15b_ui")
    });

    const renderedCopy = [
      readiness.label,
      readiness.noExecutionLabel,
      readiness.exportLabel,
      ...readiness.records.flatMap((item) => [
        item.surfaceLabel,
        item.statusLabel,
        item.previewSummary,
        item.approvalLabel,
        item.sandboxLabel,
        item.rollbackLabel,
        item.evidenceLabel,
        item.riskLabel,
        item.sourceRefLabel
      ])
    ].join(" ");

    expect(renderedCopy).not.toMatch(/\b(executed|succeeded|applied)\b/iu);
    expect(renderedCopy).not.toContain("metadata_only_no_execution");
    expect(renderedCopy).not.toContain("readiness_preview_handoff_metadata");
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

  it("renders Phase 1.5B readiness metadata on a non-executing handoff panel", () => {
    const markup = renderToStaticMarkup(
      createElement(Phase15bReadinessPanel, {
        hasActiveProject: true,
        isBusy: false,
        readiness: phase15bReadinessViewModel(phase15bHintProjection()),
        onRefreshReadiness: () => undefined
      })
    );

    expect(markup).toContain("1.5B Readiness Handoff");
    expect(markup).toContain("readiness metadata visible");
    expect(markup).toContain("readiness preview handoff");
    expect(markup).toContain("approvals:");
    expect(markup).toContain("sandbox:");
    expect(markup).toContain("rollback:");
    expect(markup).toContain("expected evidence:");
    expect(markup).toContain("blocked risk:");
    expect(markup).toContain("source refs:");
    expect(markup).toContain("product action not performed");
    expect(markup).not.toMatch(/\b(executed|succeeded|applied)\b/iu);
    expect(markup).not.toContain("metadata_visible");
    expect(markup).not.toContain("metadata_only_no_execution");
    expect(markup).not.toContain("readiness_preview_handoff_metadata");
  });

  it("renders Phase 1.5B readiness copy for every blocked runtime boundary", () => {
    const [baseRecord] = phase15bHintProjection().records;

    if (!baseRecord) {
      throw new Error("Phase 1.5B readiness fixture is incomplete.");
    }

    const readiness = phase15bReadinessViewModel({
      ...phase15bHintProjection(),
      records: BLOCKED_ACTION_TYPES.map((actionType) => ({
        ...baseRecord,
        hintId: `phase15b_hint_${actionType}`,
        artifactId: `runtime_artifact_phase15b_${actionType}` as RuntimeArtifactId,
        hints: {
          ...baseRecord.hints,
          executionIntent: {
            ...baseRecord.hints.executionIntent,
            candidateActionType: actionType,
            targetSurface: `${actionType} blocked boundary`,
            nonExecutingSummary: `Readiness metadata for ${actionType}; no product action was performed.`
          },
          riskNormalization: {
            ...baseRecord.hints.riskNormalization,
            blockedActionType: actionType,
            blockReason: `Phase 1.5B stores ${actionType} readiness only.`
          },
          sourceRefs: [
            {
              kind: "preview_artifact",
              refId: `runtime_artifact_phase15b_${actionType}`
            },
            {
              kind: "blocked_action",
              refId: `runtime_artifact_phase15b_${actionType}:${actionType}`
            }
          ]
        }
      }))
    });
    const markup = renderToStaticMarkup(
      createElement(Phase15bReadinessPanel, {
        hasActiveProject: true,
        isBusy: false,
        readiness,
        onRefreshReadiness: () => undefined
      })
    );

    expect(readiness.records).toHaveLength(BLOCKED_ACTION_TYPES.length);
    expect(markup).toContain(`${BLOCKED_ACTION_TYPES.length} readiness/preview/handoff metadata record`);

    for (const actionType of BLOCKED_ACTION_TYPES) {
      const readableActionType = actionType.replace(/[_-]+/gu, " ");

      expect(markup).toContain(`${readableActionType} readiness`);
      expect(markup).toContain(`${readableActionType} risk`);
      expect(markup).toContain(`runtime_artifact_phase15b_${actionType}:${actionType}`);
    }

    expect(markup).toContain("product action not performed");
    expect(markup).not.toMatch(/\b(executed|succeeded|applied)\b/iu);
    expect(markup).not.toContain("metadata_only_no_execution");
    expect(markup).not.toContain("readiness_preview_handoff_metadata");
  });

  it("distinguishes unloaded readiness metadata from loaded empty records", () => {
    expect(phase15bReadinessViewModel(null)).toMatchObject({
      status: "empty",
      statusLabel: "readiness handoff pending",
      emptyLabel: "No readiness metadata loaded yet.",
      exportLabel: "Planning handoff export metadata is not loaded yet."
    });

    expect(
      phase15bReadinessViewModel({
        ...phase15bHintProjection(),
        records: []
      })
    ).toMatchObject({
      status: "empty",
      statusLabel: "readiness handoff pending",
      emptyLabel: "No readiness/preview/handoff metadata records are available for this project yet.",
      exportLabel: expect.stringContaining("/phase15b-upgrade-hints/export")
    });
  });

  it("renders Planning-ready only for a final Planning Handoff artifact", () => {
    const handoff = planningHandoffViewModel(handoffProjectionFixture("final"));
    const copy = handoffCopy(handoff);
    const markup = renderToStaticMarkup(
      createElement(PlanningHandoffPanel, {
        hasActiveSession: true,
        isBusy: false,
        handoff,
        onRefreshHandoff: () => undefined
      })
    );

    expect(handoff).toMatchObject({
      status: "final",
      statusLabel: "Planning-ready",
      blocker: null
    });
    expect(handoff.final).not.toBeNull();
    expect(copy).toContain("Planning-ready");
    expect(copy).toContain("final handoff shows only when the gate verdict is Planning-ready");
    expect(copy).toContain("Readiness hint requires explicit future execution approval");
    expect(copy).toContain("residual risk visibility passed");
    expect(copy).toContain("no file, shell, browser, deploy, external mutation");
    expect(markup).toContain("Planning Handoff");
    expect(markup).toContain("Planning-ready");
    expect(markup).toContain("Residual risks");
    expect(markup).toContain("source refs:");
    expect(markup).not.toMatch(/\b(executed|succeeded|applied)\b/iu);
    expect(markup).not.toContain("no_file_shell_browser_deploy_or_external_mutation");
  });

  it("keeps blocker Planning Handoff copy mutually exclusive from the final label", () => {
    const handoff = planningHandoffViewModel({
      ...handoffProjectionFixture("blocker"),
      summary: "Blocked lowercase planning-ready and planning_ready copy must remain a blocker report."
    });
    const copy = handoffCopy(handoff);
    const markup = renderToStaticMarkup(
      createElement(PlanningHandoffPanel, {
        hasActiveSession: true,
        isBusy: false,
        handoff,
        onRefreshHandoff: () => undefined
      })
    );

    expect(handoff).toMatchObject({
      status: "blocked",
      final: null
    });
    expect(handoff.blocker).not.toBeNull();
    expect(copy).not.toContain("Planning-ready");
    expect(copy).not.toMatch(/\bplanning[-_]ready\b/iu);
    expect(copy).toContain("handoff blocker: source trace incomplete");
    expect(copy).toContain("Blocked lowercase final handoff and final handoff copy must remain a blocker report.");
    expect(copy).toContain("required next action research more");
    expect(copy).toContain("Safe preview refs");
    expect(copy).toContain("No additional residual risk entries are hidden");
    expect(markup).toContain("Blocker report");
    expect(markup).not.toContain("Planning-ready");
    expect(markup).not.toMatch(/\bplanning[-_]ready\b/iu);
    expect(markup).not.toMatch(/\b(executed|succeeded|applied)\b/iu);
  });

  it("keeps Planning Handoff empty state read-only until a final or blocker projection is loaded", () => {
    const handoff = planningHandoffViewModel(null);
    const markup = renderToStaticMarkup(
      createElement(PlanningHandoffPanel, {
        hasActiveSession: false,
        isBusy: false,
        handoff,
        onRefreshHandoff: () => undefined
      })
    );

    expect(handoff).toMatchObject({
      status: "empty",
      statusLabel: "handoff pending",
      final: null,
      blocker: null
    });
    expect(markup).toContain("No final handoff or blocker artifact is available");
    expect(markup).toContain("<button type=\"button\" disabled=\"\">Refresh handoff</button>");
    expect(markup).not.toMatch(/\b(executed|succeeded|applied)\b/iu);
  });
});
