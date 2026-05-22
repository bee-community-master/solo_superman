import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BLOCKED_ACTION_TYPES,
} from "@solo-superman/contracts";
import type {
  DecisionEvidencePackId,
  Phase15bUpgradeHintProjection,
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
} from "@solo-superman/contracts";
import {
  type Phase15aOperationsInput,
  pendingEffectSummary,
  phase15aOperationsViewModel,
  runtimeActivityProjectionFromStatuses,
  phase15bReadinessViewModel,
} from "./decision-queue-view-model";
import { Phase15aOperationsPanel } from "./Phase15aOperationsPanel";
import { Phase15bReadinessPanel } from "./Phase15bReadinessPanel";
import { DECISION_QUEUE_COPY } from "./shell/decision-queue-copy";
import { renderEnglishMarkup } from "./test-rendering";

import { allowlistPermitsWebPublicResearch, buildWebResearchRunRequest } from "./phase15a-research-run-request";

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
  return phase15aOperationsViewModel(
    {
      allowlists: allowlistProjection(),
      disclosures: disclosureProjection(),
      runs: runProjection(),
      research: researchProjection(true),
      ...overrides
    },
    DECISION_QUEUE_COPY.en.phase15a
  );
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

describe("Decision Queue view model readiness-panels", () => {
  it("keeps runtime status helpers from blank-screening on malformed status entries", () => {
    const malformedStatus = {
      commandId: "runtime_status_without_effects",
      commandStatus: "succeeded"
    } as unknown as Parameters<typeof pendingEffectSummary>[0][number];

    expect(pendingEffectSummary([malformedStatus])).toMatchObject({
      totalPending: 0,
      byType: {}
    });
    expect(runtimeActivityProjectionFromStatuses([malformedStatus])).toMatchObject({
      effects: [],
      runtimeStatus: "scaffold_placeholder"
    });
  });

  it("summarizes Phase 1.5B readiness hints without execution-result copy", () => {
    const readiness = phase15bReadinessViewModel(phase15bHintProjection());
    const [record] = readiness.records;

    expect(readiness).toMatchObject({
      status: "metadata_visible",
      statusLabel: "실행 준비 노트 있음",
      label: expect.stringContaining("실행 준비 노트"),
      noExecutionLabel: expect.stringContaining("실제 작업은 실행하지 않음"),
      exportLabel: expect.stringContaining("/phase15b-upgrade-hints/export"),
      emptyLabel: expect.stringContaining("실행 준비 노트")
    });
    expect(record).toMatchObject({
      surfaceLabel: expect.stringContaining("Planning handoff checklist"),
      approvalLabel: expect.stringContaining("task level execution"),
      sandboxLabel: expect.stringContaining("isolated worktree required"),
      rollbackLabel: expect.stringContaining("origin/main"),
      evidenceLabel: expect.stringContaining("pnpm verify"),
      riskLabel: expect.stringContaining("실행 준비"),
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
    const request = buildWebResearchRunRequest({
      allowlist,
      specTitle: "Selected task product",
      task: selectedTask
    });

    expect(request).toMatchObject({
      researchTaskId: selectedTaskId,
      connectorId: "public_search",
      sourceCategory: "public_web",
      adapterKind: "web_search_readonly",
      researchObjective: "Validate the second task source linkage.",
      productCategory: "Selected task product",
      sourceRefs: ["queue_item_selected"]
    });
    expect(request.contextHash).toContain(selectedTaskId);
  });

  it("keeps web research requests pinned to public web even when an allowlist has extra sources", () => {
    const research = researchProjection(true);
    const [task] = research.tasks;
    const [baseAllowlist] = allowlistProjection().allowlists;

    if (!task || !baseAllowlist) {
      throw new Error("Phase 1.5A research request fixture is incomplete.");
    }

    const mixedAllowlist = {
      ...baseAllowlist,
      connectorIds: ["official_docs" as ResearchConnectorId, "public_search" as ResearchConnectorId],
      sourceCategories: ["official_docs", "public_web"] as const
    };
    const request = buildWebResearchRunRequest({
      allowlist: mixedAllowlist,
      task
    });

    expect(allowlistPermitsWebPublicResearch(mixedAllowlist)).toBe(true);
    expect(allowlistPermitsWebPublicResearch({
      ...baseAllowlist,
      connectorIds: ["official_docs" as ResearchConnectorId],
      sourceCategories: ["official_docs"] as const
    })).toBe(false);
    expect(request).toMatchObject({
      connectorId: "public_search",
      sourceCategory: "public_web",
      adapterKind: "web_search_readonly"
    });
  });

  it("renders the extracted Phase 1.5A operations panel controls and session gating", () => {
    const noop = () => undefined;
    const markup = renderEnglishMarkup(
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

    expect(markup).toContain("Research operations");
    expect(markup).toContain("<button type=\"button\" disabled=\"\">Enable research sources</button>");
    expect(markup).toContain("<button type=\"button\" disabled=\"\">Refresh status</button>");
    expect(markup).toContain("<button type=\"button\" disabled=\"\">Pause</button>");
    expect(markup).toContain("<button type=\"button\" disabled=\"\">Revoke</button>");
    expect(markup).toContain("<button type=\"button\" disabled=\"\">Refresh status</button>");
    expect(markup).toContain("quality check: pending_review");
  });

  it("renders research run cards without a blank screen when provider metadata is malformed", () => {
    const noop = () => undefined;
    const malformedRuns = {
      ...runProjection(),
      runs: runProjection().runs.map((run) => ({
        ...run,
        provider: undefined,
        sourceRefs: undefined
      })) as unknown as ResearchRunControlProjection["runs"]
    };
    const markup = renderEnglishMarkup(
      createElement(Phase15aOperationsPanel, {
        hasActiveSession: true,
        isBusy: false,
        operations: phase15aOperations(),
        researchOperations: {
          allowlists: allowlistProjection(),
          disclosures: disclosureProjection(),
          runs: malformedRuns
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

    expect(markup).toContain("adapter_unavailable");
    expect(markup).toContain("source refs: 0");
  });

  it("renders Phase 1.5B readiness metadata on a non-executing handoff panel", () => {
    const markup = renderEnglishMarkup(
      createElement(Phase15bReadinessPanel, {
        hasActiveProject: true,
        isBusy: false,
        readiness: phase15bReadinessViewModel(phase15bHintProjection()),
        onRefreshReadiness: () => undefined
      })
    );

    expect(markup).toContain("Execution readiness notes");
    expect(markup).toContain("실행 준비 노트 있음");
    expect(markup).toContain("Safe execution note");
    expect(markup).toContain("Approval:");
    expect(markup).toContain("Execution isolation:");
    expect(markup).toContain("Rollback:");
    expect(markup).toContain("Evidence:");
    expect(markup).toContain("Blocked risk:");
    expect(markup).toContain("Source:");
    expect(markup).toContain("실제 작업은 실행하지 않음");
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
    expect(markup).toContain(`${BLOCKED_ACTION_TYPES.length}개 실행 준비 노트`);

    for (const actionType of BLOCKED_ACTION_TYPES) {
      const readableActionType =
        actionType === "chatgpt_web_automation"
          ? "외부 AI 작업공간 자동화"
          : actionType.replace(/[_-]+/gu, " ");

      expect(markup).toContain(`${readableActionType} readiness`);
      expect(markup).toContain(`${readableActionType} risk`);
      expect(markup).toContain(`runtime_artifact_phase15b_${actionType}:${actionType}`);
    }

    expect(markup).toContain("실제 작업은 실행하지 않음");
    expect(markup).not.toMatch(/\b(executed|succeeded|applied)\b/iu);
    expect(markup).not.toContain("metadata_only_no_execution");
    expect(markup).not.toContain("readiness_preview_handoff_metadata");
  });

  it("distinguishes unloaded readiness metadata from loaded empty records", () => {
    expect(phase15bReadinessViewModel(null)).toMatchObject({
      status: "empty",
      statusLabel: "실행 준비 대기",
      emptyLabel: "실행 준비 노트가 아직 로드되지 않았습니다.",
      exportLabel: "실행 준비 내보내기 정보가 아직 로드되지 않았습니다."
    });

    expect(
      phase15bReadinessViewModel({
        ...phase15bHintProjection(),
        records: []
      })
    ).toMatchObject({
      status: "empty",
      statusLabel: "실행 준비 대기",
      emptyLabel: "이 프로젝트에 표시할 실행 준비 노트가 아직 없습니다.",
      exportLabel: expect.stringContaining("/phase15b-upgrade-hints/export")
    });
  });

});
