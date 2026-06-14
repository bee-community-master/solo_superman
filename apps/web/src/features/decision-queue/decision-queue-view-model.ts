import {
  isTerminalResearchRunStatus,
  type DecisionQueueProjection,
  type Phase15bUpgradeHintApiRecord,
  type Phase15bUpgradeHintProjection,
  type PlanningHandoffArtifactDto,
  type PlanningHandoffBlockerArtifactDto,
  type PlanningHandoffProjection,
  type PlanningHandoffResidualRiskDto,
  type PlanningHandoffSourceRefDto,
  type ResearchAllowlistGovernanceProjection,
  type ResearchDisclosureLogProjection,
  type ResearchEvidenceProjection,
  type ResearchRunControlProjection,
  type ResearchTaskId,
  type SseEvent
} from "@solo-superman/contracts";
import { formatListWithFallback as commaList } from "./text-formatting";
import { taskCanStartPublicSearchResearch } from "./research-routing-readiness";

export type QueueSectionId = "active" | "next" | "blocked" | "deferred";

export interface QueueSectionViewModel {
  readonly id: QueueSectionId;
  readonly title: string;
  readonly emptyLabel: string;
  readonly items: DecisionQueueProjection[QueueSectionId];
}

export type QueueSectionItem = DecisionQueueProjection[QueueSectionId][number];
type ResearchAllowlistProjection = ResearchAllowlistGovernanceProjection["allowlists"][number];

export type DecisionQueueRecoveryUiStatus = "idle" | "pending_refetch" | "recovering" | "recovered_by_refetch" | "stale";

export interface DecisionQueueRecoveryViewModel {
  readonly status: DecisionQueueRecoveryUiStatus;
  readonly label: string;
  readonly refetchLabel: string;
  readonly sseLabel: string;
  readonly activeBatchLabel: string;
}

export interface QuestionProgressViewModel {
  readonly generatedQuestionCount: number;
  readonly openQuestionCount: number;
  readonly answeredQuestionCount: number;
  readonly terminalQuestionCount: number;
  readonly followUpQuestionCount: number;
  readonly followUpOpenQuestionCount: number;
  readonly topicCoverageCount: number;
  readonly openTopicCoverageCount: number;
  readonly followUpBudgetRemainingCount: number;
  readonly visibleQuestionDebtCount: number;
  readonly activeQuestionCount: number;
  readonly upcomingQuestionCount: number;
  readonly blockedQuestionCount: number;
  readonly backlogQuestionCount: number;
  readonly completionPercent: number;
}

export type QuestionFatigueLevel = "checkpoint" | "break_recommended";

export interface QuestionFatigueViewModel {
  readonly shouldShow: boolean;
  readonly level: QuestionFatigueLevel;
  readonly generatedQuestionCount: number;
  readonly openQuestionCount: number;
  readonly completionPercent: number;
  readonly followUpBudgetRemainingCount: number;
}

const QUESTION_FATIGUE_MIN_GENERATED = 20;
const QUESTION_FATIGUE_MIN_OPEN = 12;
const QUESTION_FATIGUE_MIN_VISIBLE = 6;
const QUESTION_FATIGUE_MIN_FOLLOW_UP_OPEN = 6;
const QUESTION_FATIGUE_MIN_FOLLOW_UP_BUDGET = 30;
const QUESTION_FATIGUE_MAX_COMPLETION = 40;
const QUESTION_FATIGUE_BREAK_GENERATED = 50;
const QUESTION_FATIGUE_BREAK_OPEN = 30;
const QUESTION_FATIGUE_BREAK_FOLLOW_UP_BUDGET = 60;

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

export interface Phase15bReadinessViewModelCopy {
  readonly terms: {
    readonly phase15a: string;
    readonly phase15b: string;
    readonly readinessPreviewHandoffMetadata: string;
    readonly blockedActionArtifact: string;
    readonly chatGptDelegation: string;
    readonly chatGptWebAutomation: string;
  };
  readonly statusVisible: string;
  readonly statusPending: string;
  readonly summaryVisible: (recordCount: number) => string;
  readonly summaryEmpty: string;
  readonly actualWorkNotExecuted: string;
  readonly noExecutionUnloaded: string;
  readonly reviewNoteOnly: string;
  readonly delegationState: (value: string) => string;
  readonly credentialState: (value: string) => string;
  readonly exportLoaded: (url: string) => string;
  readonly exportMissing: string;
  readonly loadedEmpty: string;
  readonly unloadedEmpty: string;
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

export function queueItemIsQuestionDebt(item: QueueSectionItem) {
  return item.cardType === undefined || item.cardType === "question" || item.cardType === "follow_up_question";
}

function isAnswerableActiveQuestionCard(item: DecisionQueueProjection["active"][number]) {
  return item.state === "active" && queueItemIsQuestionDebt(item);
}

export function draftedActiveQuestionAnswerIds(
  queue: DecisionQueueProjection | null | undefined,
  answerDrafts: Readonly<Record<string, string>>
) {
  return (
    queue?.active
      .filter(isAnswerableActiveQuestionCard)
      .filter((item) => answerDrafts[item.queueItemId]?.trim())
      .map((item) => item.queueItemId) ?? []
  );
}

export function startableReadOnlyResearchTaskIds({
  research,
  runs,
  allowlist
}: {
  readonly research: ResearchEvidenceProjection | null | undefined;
  readonly runs: ResearchRunControlProjection | null | undefined;
  readonly allowlist: ResearchAllowlistProjection | null | undefined;
}): readonly ResearchTaskId[] {
  if (!research || !allowlist) {
    return [];
  }

  const nonTerminalRuns = runs?.runs.filter((run) => !isTerminalResearchRunStatus(run.status)) ?? [];
  const taskIdsWithActiveRuns = new Set(nonTerminalRuns.map((run) => run.researchTaskId));
  const currentSessionResearchTaskIds = new Set([
    ...research.taskIds,
    ...research.tasks.map((task) => task.researchTaskId)
  ]);
  const currentSessionAllowlistRunCount =
    runs?.runs.filter(
      (run) =>
        currentSessionResearchTaskIds.has(run.researchTaskId) && run.allowlistId === allowlist.allowlistId
    ).length ?? 0;
  const availableConcurrency = Math.max(
    0,
    allowlist.rateBudgetPolicy.maxConcurrentRunsPerProject - nonTerminalRuns.length
  );
  const availableSessionRuns = Math.max(
    0,
    allowlist.rateBudgetPolicy.maxRunsPerSession - currentSessionAllowlistRunCount
  );
  const availableRunSlots = Math.min(availableConcurrency, availableSessionRuns);

  if (availableRunSlots === 0) {
    return [];
  }

  return research.tasks
    .filter((task) => task.status === "planned")
    .filter((task) => !taskIdsWithActiveRuns.has(task.researchTaskId))
    .filter((task) => taskCanStartPublicSearchResearch({ task }))
    .slice(0, availableRunSlots)
    .map((task) => task.researchTaskId);
}

function queueSectionItems(queue: DecisionQueueProjection): readonly QueueSectionItem[] {
  return [...queue.active, ...queue.next, ...queue.blocked, ...queue.deferred];
}

function countQuestionDebtItems(items: readonly QueueSectionItem[]) {
  return items.filter(queueItemIsQuestionDebt).length;
}

function countFollowUpQuestionItems(items: readonly QueueSectionItem[]) {
  return items.filter((item) => item.cardType === "follow_up_question").length;
}

function questionBacklogCount(input: {
  readonly openQuestionCount: number;
  readonly activeQuestionCount: number;
  readonly upcomingQuestionCount: number;
  readonly blockedQuestionCount: number;
}) {
  return Math.max(
    0,
    input.openQuestionCount - input.activeQuestionCount - input.upcomingQuestionCount - input.blockedQuestionCount
  );
}

export function questionProgressViewModel(queue: DecisionQueueProjection | null): QuestionProgressViewModel {
  const allQueueItems = queue ? queueSectionItems(queue) : [];
  const fallbackVisibleQuestionDebtCount = countQuestionDebtItems(allQueueItems);
  const openQuestionCount = queue?.progress?.openQuestionCount ?? fallbackVisibleQuestionDebtCount;
  const activeQuestionCount = queue?.progress?.activeQuestionCount ?? (queue ? countQuestionDebtItems(queue.active) : 0);
  const upcomingQuestionCount = queue?.progress?.upcomingQuestionCount ?? (queue ? countQuestionDebtItems(queue.next) : 0);
  const blockedQuestionCount = queue?.progress?.blockedQuestionCount ?? (queue ? countQuestionDebtItems(queue.blocked) : 0);

  return {
    generatedQuestionCount: queue?.progress?.generatedQuestionCount ?? fallbackVisibleQuestionDebtCount,
    openQuestionCount,
    answeredQuestionCount: queue?.progress?.answeredQuestionCount ?? 0,
    terminalQuestionCount: queue?.progress?.terminalQuestionCount ?? 0,
    followUpQuestionCount: queue?.progress?.followUpQuestionCount ?? countFollowUpQuestionItems(allQueueItems),
    followUpOpenQuestionCount: queue?.progress?.followUpOpenQuestionCount ?? 0,
    topicCoverageCount: queue?.progress?.topicCoverageCount ?? fallbackVisibleQuestionDebtCount,
    openTopicCoverageCount: queue?.progress?.openTopicCoverageCount ?? fallbackVisibleQuestionDebtCount,
    followUpBudgetRemainingCount: queue?.progress?.followUpBudgetRemainingCount ?? 0,
    visibleQuestionDebtCount: queue?.progress?.visibleQuestionDebtCount ?? fallbackVisibleQuestionDebtCount,
    activeQuestionCount,
    upcomingQuestionCount,
    blockedQuestionCount,
    backlogQuestionCount: questionBacklogCount({
      openQuestionCount,
      activeQuestionCount,
      upcomingQuestionCount,
      blockedQuestionCount
    }),
    completionPercent: queue?.progress?.completionPercent ?? 0
  };
}

export function questionFatigueViewModel(progress: QuestionProgressViewModel): QuestionFatigueViewModel {
  const completionPercent = Math.min(100, Math.max(0, progress.completionPercent));
  const hasLongSessionSignals =
    progress.generatedQuestionCount >= QUESTION_FATIGUE_MIN_GENERATED ||
    progress.followUpBudgetRemainingCount >= QUESTION_FATIGUE_MIN_FOLLOW_UP_BUDGET;
  const hasHighOpenDebt =
    progress.openQuestionCount >= QUESTION_FATIGUE_MIN_OPEN ||
    progress.visibleQuestionDebtCount >= QUESTION_FATIGUE_MIN_VISIBLE ||
    progress.followUpOpenQuestionCount >= QUESTION_FATIGUE_MIN_FOLLOW_UP_OPEN;
  const shouldShow =
    hasLongSessionSignals &&
    hasHighOpenDebt &&
    completionPercent < QUESTION_FATIGUE_MAX_COMPLETION;
  const breakRecommended =
    progress.generatedQuestionCount >= QUESTION_FATIGUE_BREAK_GENERATED ||
    progress.openQuestionCount >= QUESTION_FATIGUE_BREAK_OPEN ||
    progress.followUpBudgetRemainingCount >= QUESTION_FATIGUE_BREAK_FOLLOW_UP_BUDGET;

  return {
    shouldShow,
    level: shouldShow && breakRecommended ? "break_recommended" : "checkpoint",
    generatedQuestionCount: progress.generatedQuestionCount,
    openQuestionCount: progress.openQuestionCount,
    completionPercent,
    followUpBudgetRemainingCount: progress.followUpBudgetRemainingCount
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

function readinessDetails(parts: readonly (string | null | undefined)[]) {
  return parts
    .filter((part): part is string => Boolean(part))
    .map(userFacingCopy)
    .join(READINESS_DETAIL_SEPARATOR);
}

const DEFAULT_PHASE15B_READINESS_COPY: Phase15bReadinessViewModelCopy = {
  terms: {
    phase15a: "Research readiness",
    phase15b: "Execution readiness",
    readinessPreviewHandoffMetadata: "execution readiness notes",
    blockedActionArtifact: "Blocked action review artifact",
    chatGptDelegation: "External AI workspace",
    chatGptWebAutomation: "External AI workspace automation"
  },
  statusVisible: "Execution readiness notes visible",
  statusPending: "Execution readiness pending",
  summaryVisible: (recordCount: number) =>
    `${recordCount} execution readiness note${recordCount === 1 ? "" : "s"} shown for planning and safety review.`,
  summaryEmpty: "No execution readiness notes are available to show yet.",
  actualWorkNotExecuted: "Actual work has not been executed",
  noExecutionUnloaded:
    "Execution readiness notes have not loaded yet. Actual work has not been executed and credentials have not been stored.",
  reviewNoteOnly: "Review note only; actual work has not been executed",
  delegationState: (value: string) => `delegation state ${value}`,
  credentialState: (value: string) => `credential state ${value}`,
  exportLoaded: (url: string) => `Execution readiness export: ${url}`,
  exportMissing: "Execution readiness export has not loaded yet.",
  loadedEmpty: "This project has no execution readiness notes to show yet.",
  unloadedEmpty: "Execution readiness notes have not loaded yet."
};

function phase15bUserFacingCopy(value: string, copy: Phase15bReadinessViewModelCopy) {
  return value
    .replace(/Phase 1\.5A/gu, copy.terms.phase15a)
    .replace(/Phase 1\.5B/gu, copy.terms.phase15b)
    .replace(/\b1\.5A\b/gu, copy.terms.phase15a)
    .replace(/\b1\.5B\b/gu, copy.terms.phase15b)
    .replace(/readiness preview handoff metadata/gu, copy.terms.readinessPreviewHandoffMetadata)
    .replace(/readiness\/preview\/handoff metadata/gu, copy.terms.readinessPreviewHandoffMetadata)
    .replace(/Blocked Action Artifact/gu, copy.terms.blockedActionArtifact)
    .replace(/ChatGPT Pro local browser delegation/gu, copy.terms.chatGptDelegation)
    .replace(/ChatGPT browser delegation/gu, copy.terms.chatGptDelegation)
    .replace(/ChatGPT delegation/gu, copy.terms.chatGptDelegation)
    .replace(/chatgpt web automation/gu, copy.terms.chatGptWebAutomation);
}

function readablePhase15bUserToken(value: string, copy: Phase15bReadinessViewModelCopy) {
  return phase15bUserFacingCopy(readableToken(value), copy);
}

function readablePhase15bArtifactKind(value: string, copy: Phase15bReadinessViewModelCopy) {
  return readablePhase15bUserToken(value.replace(/([a-z])([A-Z])/gu, "$1 $2"), copy);
}

function phase15bReadinessDetails(
  parts: readonly (string | null | undefined)[],
  copy: Phase15bReadinessViewModelCopy
) {
  return parts
    .filter((part): part is string => Boolean(part))
    .map((part) => phase15bUserFacingCopy(part, copy))
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

function readinessRecordViewModel(
  record: Phase15bUpgradeHintApiRecord,
  copy: Phase15bReadinessViewModelCopy
): Phase15bReadinessRecordViewModel {
  const { hints } = record;
  const approvalLabel = phase15bReadinessDetails(
    hints.approvalRequirements.map((requirement) => {
      const approvalType = readableToken(requirement.approvalType);
      const requiredActor = readableToken(requirement.requiredActor);

      return `${approvalType} by ${requiredActor}: ${requirement.reason} (${requirement.scope}; ${requirement.reconfirmRule})`;
    }),
    copy
  );
  const sandboxLabel = phase15bReadinessDetails([
    hints.sandboxRequirements.isolatedWorktreeRequired ? "isolated worktree required" : "isolated worktree not required",
    hints.sandboxRequirements.browserSandboxRequired ? "browser sandbox required" : "browser sandbox not required",
    `network ${readableToken(hints.sandboxRequirements.networkMode)}`,
    `commands ${commaList(hints.sandboxRequirements.commandAllowlist, "none")}`,
    `secrets ${hints.sandboxRequirements.secretGrantBoundary}`,
    hints.sandboxRequirements.logCaptureRequired ? "log capture required" : "log capture not required",
    hints.sandboxRequirements.environmentPolicy
  ], copy);
  const rollbackLabel = phase15bReadinessDetails([
    `base ${hints.rollbackReference.baseRef}`,
    hints.rollbackReference.diffRef ? `diff ${hints.rollbackReference.diffRef}` : null,
    hints.rollbackReference.reversible ? "reversible" : "not reversible",
    hints.rollbackReference.rollbackNote,
    `cleanup ${hints.rollbackReference.cleanupExpectation}`
  ], copy);
  const evidenceLabel = phase15bReadinessDetails([
    `tests ${commaList(hints.expectedEvidence.tests, "none")}`,
    `smoke ${commaList(hints.expectedEvidence.smokeChecks, "none")}`,
    `artifacts ${commaList(hints.expectedEvidence.artifactPaths, "none")}`,
    `manual ${commaList(hints.expectedEvidence.manualInspection, "none")}`,
    `logs ${commaList(hints.expectedEvidence.expectedLogs, "none")}`
  ], copy);
  const riskLabel = phase15bReadinessDetails([
    `${readablePhase15bUserToken(hints.riskNormalization.blockedActionType, copy)} risk ${hints.riskNormalization.riskLevel}`,
    hints.riskNormalization.blockReason,
    `user handoff ${hints.riskNormalization.userVisibleAction}`,
    `escalate ${hints.riskNormalization.escalationTarget}`
  ], copy);
  const statusLabel = phase15bReadinessDetails([
    readablePhase15bArtifactKind(record.artifactKind, copy),
    readablePhase15bUserToken(record.metadataLabel, copy),
    copy.reviewNoteOnly,
    copy.delegationState(readablePhase15bUserToken(record.noExecution.delegationState, copy))
  ], copy);

  return {
    hintId: record.hintId,
    surfaceLabel: phase15bUserFacingCopy(
      `${readablePhase15bUserToken(hints.executionIntent.candidateActionType, copy)} readiness for ${hints.executionIntent.targetSurface}`,
      copy
    ),
    statusLabel,
    previewSummary: phase15bUserFacingCopy(hints.executionIntent.nonExecutingSummary, copy),
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
  projection: Phase15bUpgradeHintProjection | null,
  copy: Phase15bReadinessViewModelCopy = DEFAULT_PHASE15B_READINESS_COPY
): Phase15bReadinessViewModel {
  const records = projection?.records.map((record) => readinessRecordViewModel(record, copy)) ?? [];
  const noExecutionLabel = projection
    ? [
        readablePhase15bUserToken(projection.metadataLabel, copy),
        copy.actualWorkNotExecuted,
        copy.delegationState(readablePhase15bUserToken(projection.noExecution.delegationState, copy)),
        copy.credentialState(readablePhase15bUserToken(projection.noExecution.credentialValueState, copy))
      ].join("; ") + "."
    : copy.noExecutionUnloaded;

  return {
    status: records.length ? "metadata_visible" : "empty",
    statusLabel: records.length ? copy.statusVisible : copy.statusPending,
    label: records.length ? copy.summaryVisible(records.length) : copy.summaryEmpty,
    noExecutionLabel,
    exportLabel: projection?.exportUrl ? copy.exportLoaded(projection.exportUrl) : copy.exportMissing,
    emptyLabel: projection ? copy.loadedEmpty : copy.unloadedEmpty,
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
