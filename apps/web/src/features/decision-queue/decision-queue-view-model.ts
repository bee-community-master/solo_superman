import type {
  ConfidenceCompletionProjection,
  DecisionQueueProjection,
  PendingEffectSummaryDto,
  Phase15bUpgradeHintApiRecord,
  Phase15bUpgradeHintProjection,
  PlanningHandoffArtifactDto,
  PlanningHandoffBlockerArtifactDto,
  PlanningHandoffProjection,
  PlanningHandoffResidualRiskDto,
  PlanningHandoffSourceRefDto,
  ProjectionVersion,
  ResearchAllowlistGovernanceProjection,
  ResearchDisclosureLogProjection,
  ResearchEvidenceProjection,
  ResearchRunControlProjection,
  RuntimeActivityProjection,
  SessionId,
  SseEvent,
  StatusEndpointDto
} from "@solo-superman/contracts";

export type QueueSectionId = "active" | "next" | "blocked" | "deferred";

export interface QueueSectionViewModel {
  readonly id: QueueSectionId;
  readonly title: string;
  readonly emptyLabel: string;
  readonly items: DecisionQueueProjection[QueueSectionId];
}

export type DecisionQueueRecoveryUiStatus = "idle" | "pending_refetch" | "recovering" | "recovered_by_refetch" | "stale";

export interface DecisionQueueRecoveryViewModel {
  readonly status: DecisionQueueRecoveryUiStatus;
  readonly label: string;
  readonly refetchLabel: string;
  readonly sseLabel: string;
  readonly activeBatchLabel: string;
}

export type Phase15aExitGateStatus = "ready_for_1_5b" | "blocked_for_1_5b";

export interface Phase15aOperationsInput {
  readonly allowlists: ResearchAllowlistGovernanceProjection | null;
  readonly disclosures: ResearchDisclosureLogProjection | null;
  readonly runs: ResearchRunControlProjection | null;
  readonly research: ResearchEvidenceProjection | null;
}

export interface Phase15aOperationsViewModel {
  readonly activeAllowlistCount: number;
  readonly allowlistPolicyLabel: string;
  readonly disclosureActivityLabel: string;
  readonly runRecoveryLabel: string;
  readonly qualityGateLabel: string;
  readonly staleOrFailureReasons: readonly string[];
  readonly exitGate: {
    readonly status: Phase15aExitGateStatus;
    readonly label: string;
    readonly blockers: readonly string[];
  };
}

export type Phase15bReadinessStatus = "metadata_visible" | "empty";

export interface Phase15bReadinessRecordViewModel {
  readonly hintId: string;
  readonly surfaceLabel: string;
  readonly statusLabel: string;
  readonly previewSummary: string;
  readonly approvalLabel: string;
  readonly sandboxLabel: string;
  readonly rollbackLabel: string;
  readonly evidenceLabel: string;
  readonly riskLabel: string;
  readonly sourceRefLabel: string;
}

export interface Phase15bReadinessViewModel {
  readonly status: Phase15bReadinessStatus;
  readonly statusLabel: string;
  readonly label: string;
  readonly noExecutionLabel: string;
  readonly exportLabel: string;
  readonly emptyLabel: string;
  readonly records: readonly Phase15bReadinessRecordViewModel[];
}

export type PlanningHandoffUiStatus = "empty" | "final" | "blocked";

export interface PlanningHandoffDetailGroup {
  readonly title: string;
  readonly items: readonly string[];
}

export interface PlanningHandoffArtifactViewModel {
  readonly heading: string;
  readonly groups: readonly PlanningHandoffDetailGroup[];
}

export interface PlanningHandoffViewModel {
  readonly status: PlanningHandoffUiStatus;
  readonly statusLabel: string;
  readonly label: string;
  readonly summary: string;
  readonly noExecutionLabel: string;
  readonly refetchLabel: string;
  readonly sourceRefsLabel: string;
  readonly final: PlanningHandoffArtifactViewModel | null;
  readonly blocker: PlanningHandoffArtifactViewModel | null;
  readonly emptyLabel: string;
}

const READINESS_DETAIL_SEPARATOR = " · ";
const PLANNING_HANDOFF_EMPTY_LABEL = "No final handoff or blocker artifact is available for this session yet.";
const PLANNING_HANDOFF_NO_EXECUTION_LABEL =
  "Planning Handoff is read-only planning context; no file, shell, browser, deploy, external mutation, credential, or active delegation controls are available.";
const PLANNING_READY_TOKEN_PATTERN = /\bplanning[-_]ready\b/giu;

export function queueSections(queue: DecisionQueueProjection | null): readonly QueueSectionViewModel[] {
  return [
    {
      id: "active",
      title: "Active batch",
      emptyLabel: "No active questions.",
      items: queue?.active ?? []
    },
    {
      id: "next",
      title: "Next",
      emptyLabel: "No queued-next items.",
      items: queue?.next ?? []
    },
    {
      id: "blocked",
      title: "Blocked",
      emptyLabel: "No blocked cards.",
      items: queue?.blocked ?? []
    },
    {
      id: "deferred",
      title: "Deferred",
      emptyLabel: "No deferred cards.",
      items: queue?.deferred ?? []
    }
  ];
}

function queueRecoveryStatus(queue: DecisionQueueProjection | null): DecisionQueueRecoveryUiStatus {
  if (!queue) {
    return "idle";
  }

  if (queue.stale) {
    return "stale";
  }

  if (queue.recovery?.status === "pending_refetch" || (queue.recovery?.pendingEffectCount ?? 0) > 0) {
    return "pending_refetch";
  }

  if (queue.recovery?.status === "recovering" || queue.recovery?.status === "recovered_by_refetch") {
    return queue.recovery.status;
  }

  return "idle";
}

export function decisionQueueRecoveryViewModel(queue: DecisionQueueProjection | null): DecisionQueueRecoveryViewModel {
  const status = queueRecoveryStatus(queue);
  const pendingCount = queue?.recovery?.pendingEffectCount ?? 0;
  const activeBatchCount = queue?.activeBatch?.queueItemIds.length ?? 0;

  return {
    status,
    label:
      status === "stale"
        ? `Queue projection is stale; refetch before using it as canonical state. ${queue?.recovery?.staleReason ?? ""}`.trim()
        : status === "pending_refetch"
          ? `${pendingCount} queue projection effect(s) pending; SSE is notification-only and refetch remains canonical.`
          : status === "recovering"
            ? "Queue recovery is in progress after an SSE notification or reconnect."
            : status === "recovered_by_refetch"
              ? "Queue recovered from canonical projection refetch after an SSE notification."
              : "Queue projection is fresh; SSE notifications will trigger refetch instead of local state mutation.",
    refetchLabel: queue?.refetchUrl ? `Canonical refetch ${queue.refetchUrl}` : "Canonical queue refetch URL is not loaded yet.",
    sseLabel: queue?.recovery?.sseStreamUrl
      ? `SSE notification stream ${queue.recovery.sseStreamUrl}`
      : "SSE notification stream is not loaded yet.",
    activeBatchLabel: queue?.activeBatch
      ? `${activeBatchCount} item active batch · ${queue.activeBatch.priorityReason}`
      : "No active batch metadata loaded yet."
  };
}

export function shouldRefetchQueueForSseNotification(
  event: SseEvent,
  queue: DecisionQueueProjection | null
): boolean {
  return (
    event.event === "projection.updated" &&
    event.projectionKind === "DecisionQueueProjection" &&
    (!queue?.sessionId || event.affectedIds.includes(queue.sessionId)) &&
    (!queue || Number(event.version) >= Number(queue.version))
  );
}

function commaList(items: readonly string[], fallback: string) {
  return items.length ? items.join(", ") : fallback;
}

function readableToken(value: string) {
  return value.replace(/[_-]+/gu, " ");
}

function readableArtifactKind(value: string) {
  return readableToken(value.replace(/([a-z])([A-Z])/gu, "$1 $2"));
}

function readinessDetails(parts: readonly (string | null | undefined)[]) {
  return parts.filter((part): part is string => Boolean(part)).join(READINESS_DETAIL_SEPARATOR);
}

function displayPlanningReadyLabel(value: string, allowFinalLabel: boolean) {
  return value.replace(PLANNING_READY_TOKEN_PATTERN, allowFinalLabel ? "Planning-ready" : "final handoff");
}

function displayPlanningHandoffGroup(
  group: PlanningHandoffDetailGroup,
  allowFinalLabel: boolean
): PlanningHandoffDetailGroup {
  return {
    title: displayPlanningReadyLabel(group.title, allowFinalLabel),
    items: group.items.map((item) => displayPlanningReadyLabel(item, allowFinalLabel))
  };
}

function sourceRefLabel(sourceRef: PlanningHandoffSourceRefDto) {
  return readinessDetails([
    `${readableToken(sourceRef.sourceType)}:${sourceRef.sourceId}`,
    sourceRef.sourceLabel,
    sourceRef.required ? "required" : "optional",
    sourceRef.stale ? "stale" : "current"
  ]);
}

function sourceRefsLabel(sourceRefs: readonly PlanningHandoffSourceRefDto[]) {
  return commaList(sourceRefs.map(sourceRefLabel), "no source refs");
}

function phase15bHintMappingLabel(mappings: PlanningHandoffArtifactDto["phase15bHintMapping"]) {
  return commaList(
    mappings.map((mapping) =>
      readinessDetails([
        `hint ${sourceRefLabel(mapping.hintRef)}`,
        `approvals ${commaList(mapping.requiredApprovals, "none")}`,
        `sandbox ${mapping.sandboxBoundary}`,
        `rollback ${mapping.rollbackReference}`,
        `expected evidence ${commaList(mapping.expectedEvidence, "none")}`,
        `risk ${readableToken(mapping.riskNormalization.blockedActionType)} ${mapping.riskNormalization.riskLevel}`,
        `source trace ${commaList(
          mapping.sourceTrace.map((sourceRef) => `${sourceRef.kind}:${sourceRef.refId}`),
          "none"
        )}`,
        `policy ${readableToken(mapping.noExecutionPolicy)}`
      ])
    ),
    "no Phase 1.5B readiness hints"
  );
}

function residualRiskItems(residualRisks: readonly PlanningHandoffResidualRiskDto[]) {
  return residualRisks.length
    ? residualRisks.map((risk) =>
        readinessDetails([
          `${risk.riskId}: ${readableToken(risk.riskClass)} (${risk.severity})`,
          risk.title,
          `assumption ${risk.assumption}`,
          `prerequisite ${risk.prerequisite}`,
          `validation ${risk.validationDependency}`,
          `owner ${risk.ownerRole}`,
          `follow-up ${risk.followUpTrigger}`,
          `sources ${sourceRefsLabel(risk.sourceRefs)}`
        ])
      )
    : ["No additional residual risk entries are hidden for this handoff state."];
}

function gateVerdictLabel(
  gateVerdict: PlanningHandoffArtifactDto["gateVerdict"] | PlanningHandoffBlockerArtifactDto["gateVerdict"]
) {
  return readinessDetails([
    `verdict ${readableToken(gateVerdict.verdict)}`,
    `reviewed ${commaList(gateVerdict.reviewedQueueItemIds, "no queue items")}`,
    `fatal classes ${commaList(gateVerdict.fatalBlockerClassesChecked.map(readableToken), "none")}`,
    `residual risk visibility ${gateVerdict.residualRiskVisibilityCheck}`,
    gateVerdict.rationale,
    `terminal outcomes ${commaList(
      gateVerdict.terminalOutcomeSummary.map((outcome) =>
        readinessDetails([
          `${outcome.queueItemId}: ${readableToken(outcome.outcome)}`,
          outcome.riskAccepted ? "risk accepted" : "risk not accepted",
          outcome.blockerClass ? `blocker ${readableToken(outcome.blockerClass)}` : null,
          outcome.residualRiskClass ? `residual risk ${readableToken(outcome.residualRiskClass)}` : null,
          `sources ${sourceRefsLabel(outcome.sourceRefs)}`
        ])
      ),
      "none"
    )}`
  ]);
}

function readinessRecordViewModel(record: Phase15bUpgradeHintApiRecord): Phase15bReadinessRecordViewModel {
  const { hints } = record;
  const approvalLabel = readinessDetails(
    hints.approvalRequirements.map((requirement) => {
      const approvalType = readableToken(requirement.approvalType);
      const requiredActor = readableToken(requirement.requiredActor);

      return `${approvalType} by ${requiredActor}: ${requirement.reason} (${requirement.scope}; ${requirement.reconfirmRule})`;
    })
  );
  const sandboxLabel = readinessDetails([
    hints.sandboxRequirements.isolatedWorktreeRequired ? "isolated worktree required" : "isolated worktree not required",
    hints.sandboxRequirements.browserSandboxRequired ? "browser sandbox required" : "browser sandbox not required",
    `network ${readableToken(hints.sandboxRequirements.networkMode)}`,
    `commands ${commaList(hints.sandboxRequirements.commandAllowlist, "none")}`,
    `secrets ${hints.sandboxRequirements.secretGrantBoundary}`,
    hints.sandboxRequirements.logCaptureRequired ? "log capture required" : "log capture not required",
    hints.sandboxRequirements.environmentPolicy
  ]);
  const rollbackLabel = readinessDetails([
    `base ${hints.rollbackReference.baseRef}`,
    hints.rollbackReference.diffRef ? `diff ${hints.rollbackReference.diffRef}` : null,
    hints.rollbackReference.reversible ? "reversible" : "not reversible",
    hints.rollbackReference.rollbackNote,
    `cleanup ${hints.rollbackReference.cleanupExpectation}`
  ]);
  const evidenceLabel = readinessDetails([
    `tests ${commaList(hints.expectedEvidence.tests, "none")}`,
    `smoke ${commaList(hints.expectedEvidence.smokeChecks, "none")}`,
    `artifacts ${commaList(hints.expectedEvidence.artifactPaths, "none")}`,
    `manual ${commaList(hints.expectedEvidence.manualInspection, "none")}`,
    `logs ${commaList(hints.expectedEvidence.expectedLogs, "none")}`
  ]);
  const riskLabel = readinessDetails([
    `${readableToken(hints.riskNormalization.blockedActionType)} risk ${hints.riskNormalization.riskLevel}`,
    hints.riskNormalization.blockReason,
    `user handoff ${hints.riskNormalization.userVisibleAction}`,
    `escalate ${hints.riskNormalization.escalationTarget}`
  ]);
  const statusLabel = readinessDetails([
    readableArtifactKind(record.artifactKind),
    readableToken(record.metadataLabel),
    "metadata only; product action not performed",
    `delegation ${readableToken(record.noExecution.delegationState)}`
  ]);

  return {
    hintId: record.hintId,
    surfaceLabel: `${readableToken(hints.executionIntent.candidateActionType)} readiness for ${hints.executionIntent.targetSurface}`,
    statusLabel,
    previewSummary: hints.executionIntent.nonExecutingSummary,
    approvalLabel,
    sandboxLabel,
    rollbackLabel,
    evidenceLabel,
    riskLabel,
    sourceRefLabel: commaList(
      hints.sourceRefs.map((sourceRef) => `${readableToken(sourceRef.kind)}:${sourceRef.refId}`),
      "no source refs"
    )
  };
}

export function phase15bReadinessViewModel(
  projection: Phase15bUpgradeHintProjection | null
): Phase15bReadinessViewModel {
  const records = projection?.records.map(readinessRecordViewModel) ?? [];
  const noExecutionLabel = projection
    ? [
        readableToken(projection.metadataLabel),
        "product action not performed",
        `delegation ${readableToken(projection.noExecution.delegationState)}`,
        `credential values ${readableToken(projection.noExecution.credentialValueState)}`
      ].join("; ") + "."
    : "Metadata only; product action not performed; delegation not active; credential values omitted.";

  return {
    status: records.length ? "metadata_visible" : "empty",
    statusLabel: records.length ? "readiness metadata visible" : "readiness handoff pending",
    label: records.length
      ? `${records.length} readiness/preview/handoff metadata record(s) visible for Planning and BlockedAction review.`
      : "No Phase 1.5B readiness/preview/handoff metadata is visible yet.",
    noExecutionLabel,
    exportLabel: projection?.exportUrl
      ? `Planning handoff export metadata: ${projection.exportUrl}`
      : "Planning handoff export metadata is not loaded yet.",
    emptyLabel: projection
      ? "No readiness/preview/handoff metadata records are available for this project yet."
      : "No readiness metadata loaded yet.",
    records
  };
}

function planningHandoffArtifactView(
  heading: string,
  groups: readonly PlanningHandoffDetailGroup[],
  allowFinalLabel: boolean
): PlanningHandoffArtifactViewModel {
  return {
    heading: displayPlanningReadyLabel(heading, allowFinalLabel),
    groups: groups.map((group) => displayPlanningHandoffGroup(group, allowFinalLabel))
  };
}

function finalPlanningHandoffGroups(finalArtifact: PlanningHandoffArtifactDto): readonly PlanningHandoffDetailGroup[] {
  return [
    {
      title: "Gate verdict",
      items: [gateVerdictLabel(finalArtifact.gateVerdict)]
    },
    {
      title: "Task breakdown",
      items: finalArtifact.taskBreakdown.map((task) =>
        readinessDetails([
          `${task.taskId}: ${task.title}`,
          task.intent,
          `owner ${task.ownerRole}`,
          `depends ${commaList(task.dependsOn, "none")}`,
          `evidence ${commaList(task.acceptanceEvidence, "none")}`,
          `non-goals ${commaList(task.nonGoals, "none")}`,
          `risks ${commaList(task.riskRefs, "none")}`,
          `sources ${sourceRefsLabel(task.sourceRefs)}`
        ])
      )
    },
    {
      title: "PR/issue plan",
      items: finalArtifact.prIssuePlan.map((plan) =>
        readinessDetails([
          `${plan.sequenceId}: ${plan.summary}`,
          `tasks ${commaList(plan.includedTaskIds, "none")}`,
          `entry ${commaList(plan.entryPrerequisites, "none")}`,
          `exit ${commaList(plan.exitEvidence, "none")}`,
          `blocked by ${commaList(plan.blockedBy, "none")}`,
          `boundary ${readableToken(plan.phaseBoundary)}`
        ])
      )
    },
    {
      title: "Build slice",
      items: [
        readinessDetails([
          finalArtifact.buildSlicePlan.sliceGoal,
          `capabilities ${commaList(finalArtifact.buildSlicePlan.includedCapabilities, "none")}`,
          `non-goals ${commaList(finalArtifact.buildSlicePlan.nonGoals, "none")}`,
          `acceptance ${commaList(finalArtifact.buildSlicePlan.acceptanceCriteria, "none")}`,
          `smoke ${commaList(finalArtifact.buildSlicePlan.smokeTests, "none")}`,
          `metric ${finalArtifact.buildSlicePlan.validationMetric}`,
          `residual risks ${commaList(finalArtifact.buildSlicePlan.residualRisks, "none")}`,
          `sources ${sourceRefsLabel(finalArtifact.buildSlicePlan.sourceRefs)}`
        ])
      ]
    },
    {
      title: "Serve checklist",
      items: [
        readinessDetails([
          `target ${finalArtifact.serveChecklist.serveTarget}`,
          `env ${commaList(
            finalArtifact.serveChecklist.envVars.map((envVar) =>
              readinessDetails([
                envVar.envVarName,
                envVar.required ? "required" : "optional",
                envVar.present ? "present" : "not present",
                "value omitted",
                envVar.note
              ])
            ),
            "none"
          )}`,
          finalArtifact.serveChecklist.authAndPrivacyCheck,
          `smoke ${commaList(finalArtifact.serveChecklist.smokeTestChecklist, "none")}`,
          `rollback ${finalArtifact.serveChecklist.rollbackPlan}`,
          `launch ${finalArtifact.serveChecklist.launchNote}`,
          `metrics ${commaList(finalArtifact.serveChecklist.learningMetrics, "none")}`
        ])
      ]
    },
    {
      title: "Learning loop",
      items: [
        readinessDetails([
          `signals ${commaList(finalArtifact.learningLoopHook.signalsToCollect, "none")}`,
          finalArtifact.learningLoopHook.interpretationFrame,
          `decisions ${commaList(finalArtifact.learningLoopHook.decisionOptions.map(readableToken), "none")}`,
          `next slice ${finalArtifact.learningLoopHook.recommendedNextSliceRule}`,
          `risk update ${finalArtifact.learningLoopHook.riskUpdateRule}`
        ])
      ]
    },
    {
      title: "Readiness checklist",
      items: [
        readinessDetails([
          `approvals ${commaList(finalArtifact.readinessChecklist.requiredApprovals, "none")}`,
          `sandbox ${finalArtifact.readinessChecklist.sandboxBoundary}`,
          `rollback ${finalArtifact.readinessChecklist.rollbackReference}`,
          `expected evidence ${commaList(finalArtifact.readinessChecklist.expectedEvidence, "none")}`,
          `command preview ${commaList(finalArtifact.readinessChecklist.commandPreviewRequirements, "none")}`,
          `file preview ${commaList(finalArtifact.readinessChecklist.filePreviewRequirements, "none")}`,
          `browser preview ${commaList(finalArtifact.readinessChecklist.browserPreviewRequirements, "none")}`
        ])
      ]
    },
    {
      title: "Residual risks",
      items: residualRiskItems(finalArtifact.residualRiskRegister)
    },
    {
      title: "Phase 1.5B hint mapping",
      items: [phase15bHintMappingLabel(finalArtifact.phase15bHintMapping)]
    }
  ];
}

function blockerPlanningHandoffGroups(
  blockerArtifact: PlanningHandoffBlockerArtifactDto
): readonly PlanningHandoffDetailGroup[] {
  return [
    {
      title: "Gate blocker",
      items: [gateVerdictLabel(blockerArtifact.gateVerdict)]
    },
    {
      title: "Blockers",
      items: blockerArtifact.blockers.map((blocker) =>
        readinessDetails([
          `${blocker.blockerId}: ${readableToken(blocker.blockerClass)}`,
          blocker.queueItemId ? `queue ${blocker.queueItemId}` : null,
          blocker.currentOutcome ? `outcome ${readableToken(blocker.currentOutcome)}` : null,
          blocker.whyFatal,
          `required next action ${readableToken(blocker.requiredNextAction)}`,
          `sources ${sourceRefsLabel(blocker.sourceRefs)}`
        ])
      )
    },
    {
      title: "Required user actions",
      items: [commaList(blockerArtifact.requiredUserActions.map(readableToken), "none")]
    },
    {
      title: "Residual risks",
      items: residualRiskItems(blockerArtifact.residualRisks)
    },
    {
      title: "Safe preview refs",
      items: [sourceRefsLabel(blockerArtifact.safePreviewRefs)]
    },
    {
      title: "Phase 1.5B hint mapping",
      items: [phase15bHintMappingLabel(blockerArtifact.phase15bHintMapping)]
    }
  ];
}

export function planningHandoffViewModel(projection: PlanningHandoffProjection | null): PlanningHandoffViewModel {
  if (!projection) {
    return {
      status: "empty",
      statusLabel: "handoff pending",
      label: "No Planning Handoff projection is loaded yet.",
      summary: "Run or refresh the handoff query after the Planning Handoff gate creates a final or blocker artifact.",
      noExecutionLabel: PLANNING_HANDOFF_NO_EXECUTION_LABEL,
      refetchLabel: "Planning Handoff refetch URL is not loaded yet.",
      sourceRefsLabel: "no source refs",
      final: null,
      blocker: null,
      emptyLabel: PLANNING_HANDOFF_EMPTY_LABEL
    };
  }

  if (projection.currentStatus === "planning_ready") {
    const { finalArtifact } = projection;

    return {
      status: "final",
      statusLabel: "Planning-ready",
      label: "Final Planning-ready handoff is visible with residual risk and readiness context.",
      summary: displayPlanningReadyLabel(projection.summary, true),
      noExecutionLabel: PLANNING_HANDOFF_NO_EXECUTION_LABEL,
      refetchLabel: `Refetch ${projection.refetchUrl}`,
      sourceRefsLabel: displayPlanningReadyLabel(sourceRefsLabel(projection.sourceRefs), true),
      final: planningHandoffArtifactView(finalArtifact.handoffSummary, finalPlanningHandoffGroups(finalArtifact), true),
      blocker: null,
      emptyLabel: PLANNING_HANDOFF_EMPTY_LABEL
    };
  }

  const { blockerArtifact } = projection;

  return {
    status: "blocked",
    statusLabel: `handoff blocker: ${readableToken(projection.currentStatus)}`,
    label: "Planning handoff remains blocked; final handoff label is withheld until the gate returns final state.",
    summary: displayPlanningReadyLabel(projection.summary, false),
    noExecutionLabel: PLANNING_HANDOFF_NO_EXECUTION_LABEL,
    refetchLabel: `Refetch ${projection.refetchUrl}`,
    sourceRefsLabel: displayPlanningReadyLabel(sourceRefsLabel(projection.sourceRefs), false),
    final: null,
    blocker: planningHandoffArtifactView("Blocker report", blockerPlanningHandoffGroups(blockerArtifact), false),
    emptyLabel: PLANNING_HANDOFF_EMPTY_LABEL
  };
}

export function pendingEffectSummary(statuses: readonly StatusEndpointDto[]): PendingEffectSummaryDto {
  const byType = statuses.reduce<Record<string, number>>((summary, status) => {
    for (const effect of status.effects) {
      if (effect.status === "queued" || effect.status === "leased" || effect.status === "running") {
        summary[effect.effectType] = (summary[effect.effectType] ?? 0) + 1;
      }
    }

    return summary;
  }, {});
  const totalPending = Object.values(byType).reduce((total, count) => total + count, 0);

  return {
    totalPending,
    byType,
    visibleLabel: totalPending ? `${totalPending} persisted effect task(s) pending.` : "No persisted effects are pending."
  };
}

export function runtimeActivityProjectionFromStatuses(
  statuses: readonly StatusEndpointDto[]
): RuntimeActivityProjection {
  const effects = statuses.flatMap((status) => status.effects);
  const hasBlocked = statuses.some((status) => status.commandStatus === "blocked");
  const hasFailed = statuses.some((status) => status.commandStatus === "failed");

  return {
    kind: "RuntimeActivityProjection",
    version: statuses.length as ProjectionVersion,
    effects,
    runtimeArtifacts: [],
    runtimeStatus: hasBlocked ? "blocked" : hasFailed ? "unavailable" : effects.length ? "available" : "scaffold_placeholder"
  };
}

type ResearchRunStatus = ResearchRunControlProjection["runs"][number]["status"];

function runNeedsOperatorAttention(status: ResearchRunStatus) {
  return status === "failed" || status === "stale" || status === "research_insufficient" || status === "needs_review";
}

function researchQualityGateVisible(input: Phase15aOperationsInput) {
  return Boolean(
    input.research?.evidencePacks.length ||
      input.research?.reviewCards.some((card) => Boolean(card.gateStatus || card.reviewReason)) ||
      input.runs?.runs.some((run) => run.qualityGateStatus !== "not_evaluated" || Boolean(run.qualityGateReviewReason))
  );
}

function planningBlockingCards(research: ResearchEvidenceProjection | null) {
  return research?.reviewCards.filter((card) => card.blocksPlanning) ?? [];
}

function researchQualityGateLabels(input: Phase15aOperationsInput) {
  return [
    ...(input.research?.evidencePacks.map((pack) => `${pack.claim}: ${pack.gateStatus}`) ?? []),
    ...(input.research?.reviewCards
      .filter((card) => Boolean(card.gateStatus || card.reviewReason))
      .map((card) =>
        [
          card.title,
          card.gateStatus ?? card.state,
          card.reviewReason
        ]
          .filter((part): part is string => Boolean(part))
          .join(": ")
      ) ?? []),
    ...(input.runs?.runs.map((run) => `${run.researchRunId}: ${run.qualityGateStatus}`) ?? [])
  ];
}

export function phase15aOperationsViewModel(input: Phase15aOperationsInput): Phase15aOperationsViewModel {
  const activeAllowlists = input.allowlists?.allowlists.filter((allowlist) => allowlist.status === "active") ?? [];
  const selectedAllowlist = activeAllowlists[0] ?? input.allowlists?.allowlists[0] ?? null;
  const latestDisclosure = input.disclosures?.latestDisclosureLog ?? input.disclosures?.disclosureLogs.at(-1) ?? null;
  const runs = input.runs?.runs ?? [];
  const attentionRuns = runs.filter((run) => runNeedsOperatorAttention(run.status));
  const qualityGateVisible = researchQualityGateVisible(input);
  const recoveryIsVisible = Boolean(
    input.allowlists?.refetchUrl &&
      input.disclosures?.refetchUrl &&
      input.runs?.refetchUrl &&
      input.runs.recovery.sseEventNames.includes("projection.updated")
  );
  const blockers = [
    ...(activeAllowlists.length === 0 ? ["No active public-safe research allowlist is visible."] : []),
    ...(!input.allowlists?.refetchUrl ? ["Allowlist governance refetch recovery is not visible."] : []),
    ...(!input.disclosures?.refetchUrl ? ["Disclosure activity refetch recovery is not visible."] : []),
    ...(!input.runs?.refetchUrl ? ["Research run refetch recovery is not visible."] : []),
    ...(input.runs && !input.runs.recovery.sseEventNames.includes("projection.updated")
      ? ["Research run SSE recovery hint is missing."]
      : []),
    ...(!qualityGateVisible ? ["Evidence quality gate result is not visible yet."] : []),
    ...planningBlockingCards(input.research).map((card) => `Research card still blocks Planning-ready: ${card.title}`)
  ];
  const allowlistPolicyLabel = selectedAllowlist
    ? [
        `${selectedAllowlist.status} · ${selectedAllowlist.connectorIds.join(", ")}`,
        selectedAllowlist.sourceCategories.join(", "),
        selectedAllowlist.contextMode,
        `${selectedAllowlist.rateBudgetPolicy.maxConcurrentRunsPerProject} concurrent / ${selectedAllowlist.rateBudgetPolicy.maxRunsPerSession} per session`,
        selectedAllowlist.disclosureLogPolicy.logEveryAutomaticRun ? "disclosure log required" : null
      ]
        .filter((part): part is string => Boolean(part))
        .join(" · ")
    : "No allowlist loaded.";

  return {
    activeAllowlistCount: activeAllowlists.length,
    allowlistPolicyLabel,
    disclosureActivityLabel: latestDisclosure
      ? `${input.disclosures?.disclosureLogs.length ?? 0} disclosure log(s); latest ${latestDisclosure.status}`
      : "No disclosure activity loaded.",
    runRecoveryLabel: input.runs
      ? `${runs.length} run(s); ${attentionRuns.length} need review/recovery; refetch ${input.runs.recovery.refetchUrl}`
      : "No research run projection loaded.",
    qualityGateLabel: qualityGateVisible
      ? researchQualityGateLabels(input).slice(0, 3).join(" · ")
      : "Quality gate has not produced a visible result.",
    staleOrFailureReasons: attentionRuns.map((run) =>
      [run.researchRunId, run.status, run.terminalReason, run.qualityGateReviewReason]
        .filter((part): part is string => Boolean(part))
        .join(" · ")
    ),
    exitGate: {
      status: blockers.length || !recoveryIsVisible ? "blocked_for_1_5b" : "ready_for_1_5b",
      label:
        blockers.length || !recoveryIsVisible
          ? "Phase 1.5A exit gate is blocked; keep recovery and review visible before 1.5B."
          : "Phase 1.5A exit gate is explicit and ready for 1.5B sequencing.",
      blockers
    }
  };
}

export function confidencePlaceholder(
  sessionId: SessionId | null,
  knownRisks: readonly string[] = []
): ConfidenceCompletionProjection | null {
  if (!sessionId) {
    return null;
  }

  return {
    kind: "ConfidenceCompletionProjection",
    sessionId,
    version: knownRisks.length as ProjectionVersion,
    compositeScore: knownRisks.length ? 45 : 0,
    readinessLabel: knownRisks.length ? "clarifying" : "draft",
    axes: [],
    scoreBreakdown: {
      sectionCompleteness: 0,
      questionDebtResolution: 0,
      evidenceQuality: 0,
      decisionApproval: 0,
      consistencyAndConflict: 0
    },
    gates: [],
    topRisks: knownRisks,
    topRiskCards: knownRisks.map((risk, index) => ({
      riskId: `placeholder_risk_${index + 1}`,
      title: risk,
      severity: "medium",
      sourceRefs: [],
      nextValidationAction: `Validate or explicitly accept: ${risk}`
    })),
    nextBestActions: knownRisks.map((risk) => `Validate or explicitly accept: ${risk}`),
    completionCandidate: {
      status: "not_ready",
      summary: "Completeness has not been scored yet.",
      gateFailures: ["Completeness has not been scored yet."],
      ifStopNowArtifact: {
        title: "If stop now",
        summary: "No scored completion candidate exists yet.",
        knownRisks,
        nextValidationActions: knownRisks.map((risk) => `Validate or explicitly accept: ${risk}`)
      }
    }
  };
}
