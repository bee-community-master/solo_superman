import type {
  DecisionQueueProjection,
  Phase15bUpgradeHintApiRecord,
  Phase15bUpgradeHintProjection,
  PlanningHandoffArtifactDto,
  PlanningHandoffBlockerArtifactDto,
  PlanningHandoffProjection,
  PlanningHandoffResidualRiskDto,
  PlanningHandoffSourceRefDto,
  ResearchAllowlistGovernanceProjection,
  ResearchDisclosureLogProjection,
  ResearchEvidenceProjection,
  ResearchRunControlProjection,
  SseEvent
} from "@solo-superman/contracts";
import { formatListWithFallback as commaList } from "./text-formatting";

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
const PLANNING_HANDOFF_EMPTY_LABEL = "No final handoff or blocker is available for this session yet.";
const PLANNING_HANDOFF_NO_EXECUTION_LABEL =
  "Planning handoff is read-only planning context; file, shell, browser, deploy, credential, and delegation controls stay unavailable.";
const PLANNING_READY_TOKEN_PATTERN = /\bplanning[-_]ready\b/giu;

export function queueSections(queue: DecisionQueueProjection | null): readonly QueueSectionViewModel[] {
  return [
    {
      id: "active",
      title: "Current questions",
      emptyLabel: "No current questions.",
      items: queue?.active ?? []
    },
    {
      id: "next",
      title: "Up next",
      emptyLabel: "No upcoming questions.",
      items: queue?.next ?? []
    },
    {
      id: "blocked",
      title: "Needs attention",
      emptyLabel: "No blocked items.",
      items: queue?.blocked ?? []
    },
    {
      id: "deferred",
      title: "Saved for later",
      emptyLabel: "No saved items.",
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
  const currentRoundLabel = activeBatchCount === 1 ? "1 current question" : `${activeBatchCount} current questions`;

  return {
    status,
    label:
      status === "stale"
        ? `Questions may be out of date. Refresh before using them as the source of truth. ${queue?.recovery?.staleReason ?? ""}`.trim()
        : status === "pending_refetch"
          ? `${pendingCount} question update(s) pending. This list will refresh from the local service.`
          : status === "recovering"
            ? "Questions are refreshing after a live update or reconnect."
            : status === "recovered_by_refetch"
              ? "Questions refreshed after a live update."
              : "Questions are up to date. Live updates will refresh this list.",
    refetchLabel: queue?.refetchUrl ? `Question refresh ${queue.refetchUrl}` : "Question refresh path is not loaded yet.",
    sseLabel: queue?.recovery?.sseStreamUrl
      ? `Live update stream ${queue.recovery.sseStreamUrl}`
      : "Live update stream is not loaded yet.",
    activeBatchLabel: queue?.activeBatch
      ? `${currentRoundLabel} selected for this round.`
      : "Current question details are not loaded yet."
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


function readableToken(value: string) {
  return value.replace(/[_-]+/gu, " ");
}

function userFacingCopy(value: string) {
  return value
    .replace(/Phase 1\.5A/gu, "리서치 준비")
    .replace(/Phase 1\.5B/gu, "실행 준비")
    .replace(/\b1\.5A\b/gu, "리서치 준비")
    .replace(/\b1\.5B\b/gu, "실행 준비")
    .replace(/readiness preview handoff metadata/gu, "실행 준비 노트")
    .replace(/readiness\/preview\/handoff metadata/gu, "실행 준비 노트")
    .replace(/Blocked Action Artifact/gu, "차단 작업 검토 자료")
    .replace(/ChatGPT Pro local browser delegation/gu, "외부 AI 작업공간")
    .replace(/ChatGPT browser delegation/gu, "외부 AI 작업공간")
    .replace(/ChatGPT delegation/gu, "외부 AI 작업공간")
    .replace(/chatgpt web automation/gu, "외부 AI 작업공간 자동화");
}

function readableUserToken(value: string) {
  return userFacingCopy(readableToken(value));
}

function readableArtifactKind(value: string) {
  return readableUserToken(value.replace(/([a-z])([A-Z])/gu, "$1 $2"));
}

function readinessDetails(parts: readonly (string | null | undefined)[]) {
  return parts
    .filter((part): part is string => Boolean(part))
    .map(userFacingCopy)
    .join(READINESS_DETAIL_SEPARATOR);
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
  return commaList(sourceRefs.map(sourceRefLabel), "no source references");
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
    "no execution preparation notes"
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
    readableUserToken(record.metadataLabel),
    "검토 노트만 저장됨; 실제 작업은 실행하지 않음",
    `위임 상태 ${readableUserToken(record.noExecution.delegationState)}`
  ]);

  return {
    hintId: record.hintId,
    surfaceLabel: userFacingCopy(
      `${readableUserToken(hints.executionIntent.candidateActionType)} readiness for ${hints.executionIntent.targetSurface}`
    ),
    statusLabel,
    previewSummary: userFacingCopy(hints.executionIntent.nonExecutingSummary),
    approvalLabel,
    sandboxLabel,
    rollbackLabel,
    evidenceLabel,
    riskLabel,
    sourceRefLabel: commaList(
      hints.sourceRefs.map((sourceRef) => `${readableToken(sourceRef.kind)}:${sourceRef.refId}`),
      "no source references"
    )
  };
}

export function phase15bReadinessViewModel(
  projection: Phase15bUpgradeHintProjection | null
): Phase15bReadinessViewModel {
  const records = projection?.records.map(readinessRecordViewModel) ?? [];
  const noExecutionLabel = projection
    ? [
        readableUserToken(projection.metadataLabel),
        "실제 작업은 실행하지 않음",
        `위임 상태 ${readableUserToken(projection.noExecution.delegationState)}`,
        `인증 정보 ${readableUserToken(projection.noExecution.credentialValueState)}`
      ].join("; ") + "."
    : "실행 준비 노트가 아직 없습니다. 실제 작업은 실행하지 않았고 인증 정보도 저장하지 않았습니다.";

  return {
    status: records.length ? "metadata_visible" : "empty",
    statusLabel: records.length ? "실행 준비 노트 있음" : "실행 준비 대기",
    label: records.length
      ? `${records.length}개 실행 준비 노트가 계획 및 안전 검토용으로 표시됩니다.`
      : "아직 표시할 실행 준비 노트가 없습니다.",
    noExecutionLabel,
    exportLabel: projection?.exportUrl
      ? `실행 준비 내보내기 정보: ${projection.exportUrl}`
      : "실행 준비 내보내기 정보가 아직 로드되지 않았습니다.",
    emptyLabel: projection
      ? "이 프로젝트에 표시할 실행 준비 노트가 아직 없습니다."
      : "실행 준비 노트가 아직 로드되지 않았습니다.",
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
      title: "Execution preparation notes",
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
      title: "Execution preparation notes",
      items: [phase15bHintMappingLabel(blockerArtifact.phase15bHintMapping)]
    }
  ];
}

export function planningHandoffViewModel(projection: PlanningHandoffProjection | null): PlanningHandoffViewModel {
  if (!projection) {
    return {
      status: "empty",
      statusLabel: "handoff pending",
      label: "No planning handoff has loaded yet.",
      summary: "Run or refresh the planning handoff check after it creates a final handoff or blocker.",
      noExecutionLabel: PLANNING_HANDOFF_NO_EXECUTION_LABEL,
      refetchLabel: "Planning handoff refresh path is not loaded yet.",
      sourceRefsLabel: "no source references",
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
      refetchLabel: `Refresh ${projection.refetchUrl}`,
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
    refetchLabel: `Refresh ${projection.refetchUrl}`,
    sourceRefsLabel: displayPlanningReadyLabel(sourceRefsLabel(projection.sourceRefs), false),
    final: null,
    blocker: planningHandoffArtifactView("Blocker report", blockerPlanningHandoffGroups(blockerArtifact), false),
    emptyLabel: PLANNING_HANDOFF_EMPTY_LABEL
  };
}

export {
  confidencePlaceholder,
  pendingEffectSummary,
  phase15aOperationsViewModel,
  runtimeActivityProjectionFromStatuses
} from "./decision-queue-operations-view-model";
