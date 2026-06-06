import type {
  ConfidenceCompletionProjection,
  PendingEffectSummaryDto,
  ProjectionVersion,
  ResearchEvidenceProjection,
  ResearchRunControlProjection,
  RuntimeActivityProjection,
  SessionId,
  StatusEndpointDto
} from "@solo-superman/contracts";
import type { Phase15aOperationsInput, Phase15aOperationsViewModel } from "./decision-queue-view-model";
import {
  joinPhase15aResearchLabels,
  phase15aAllowlistStatusLabel,
  phase15aConnectorLabels,
  phase15aContextModeLabel,
  phase15aDisclosureStatusLabel,
  phase15aEvidenceGateStatusLabel,
  type Phase15aOperationLabelCopy,
  phase15aQualityGateStatusLabel,
  phase15aReviewCardStateLabel,
  phase15aRunStatusLabel,
  phase15aSourceCategoryLabels,
  phase15aTerminalReasonLabel
} from "./phase15a-operation-labels";

export interface Phase15aOperationsCopy extends Phase15aOperationLabelCopy {
  readonly blockers: {
    readonly noActiveAllowlist: string;
    readonly noAllowlistRefetch: string;
    readonly noDisclosureRefetch: string;
    readonly noRunsRefetch: string;
    readonly noRunSse: string;
    readonly noQualityGate: string;
    readonly reviewCardRemaining: (title: string) => string;
  };
  readonly allowlistPolicyLoaded: (
    status: string,
    connectors: string,
    sourceCategories: string,
    contextMode: string,
    concurrentRuns: number,
    runsPerSession: number,
    logRequired: boolean
  ) => string;
  readonly noAllowlistPolicyLoaded: string;
  readonly disclosureActivityLoaded: (logCount: number, latestStatus: string) => string;
  readonly noDisclosureActivity: string;
  readonly runRecoveryLoaded: (runCount: number, attentionCount: number, refetchUrl: string) => string;
  readonly noRunStatus: string;
  readonly qualityGatePending: string;
  readonly exitGateBlocked: string;
  readonly exitGateReady: string;
}

export function pendingEffectSummary(statuses: readonly StatusEndpointDto[]): PendingEffectSummaryDto {
  const byType = statuses.reduce<Record<string, number>>((summary, status) => {
    const effects = Array.isArray(status.effects) ? status.effects : [];

    for (const effect of effects) {
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
    visibleLabel: totalPending ? `${totalPending} background task(s) pending.` : "No background tasks are pending."
  };
}

export function runtimeActivityProjectionFromStatuses(
  statuses: readonly StatusEndpointDto[]
): RuntimeActivityProjection {
  const effects = statuses.flatMap((status) => Array.isArray(status.effects) ? status.effects : []);
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

function uniqueLabels(labels: readonly string[]) {
  return [...new Set(labels)];
}

function researchQualityGateLabels(input: Phase15aOperationsInput, copy: Phase15aOperationsCopy) {
  return [
    ...(input.research?.evidencePacks.map((pack) =>
      `${pack.claim}: ${phase15aEvidenceGateStatusLabel(copy, pack.gateStatus)}`
    ) ?? []),
    ...(input.research?.reviewCards
      .filter((card) => Boolean(card.gateStatus || card.reviewReason))
      .map((card) =>
        [
          card.title,
          card.gateStatus
            ? phase15aEvidenceGateStatusLabel(copy, card.gateStatus)
            : phase15aReviewCardStateLabel(copy, card.state),
          card.reviewReason
        ]
          .filter((part): part is string => Boolean(part))
          .join(": ")
      ) ?? []),
    ...(input.runs?.runs.map((run) =>
      `${run.researchRunId}: ${phase15aQualityGateStatusLabel(copy, run.qualityGateStatus)}`
    ) ?? [])
  ];
}

export function phase15aOperationsViewModel(
  input: Phase15aOperationsInput,
  copy: Phase15aOperationsCopy
): Phase15aOperationsViewModel {
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
  const blockers = uniqueLabels([
    ...(activeAllowlists.length === 0 ? [copy.blockers.noActiveAllowlist] : []),
    ...(!input.allowlists?.refetchUrl ? [copy.blockers.noAllowlistRefetch] : []),
    ...(!input.disclosures?.refetchUrl ? [copy.blockers.noDisclosureRefetch] : []),
    ...(!input.runs?.refetchUrl ? [copy.blockers.noRunsRefetch] : []),
    ...(input.runs && !input.runs.recovery.sseEventNames.includes("projection.updated")
      ? [copy.blockers.noRunSse]
      : []),
    ...(!qualityGateVisible ? [copy.blockers.noQualityGate] : []),
    ...planningBlockingCards(input.research).map((card) => copy.blockers.reviewCardRemaining(card.title))
  ]);
  const allowlistPolicyLabel = selectedAllowlist
    ? copy.allowlistPolicyLoaded(
        phase15aAllowlistStatusLabel(copy, selectedAllowlist.status),
        joinPhase15aResearchLabels(phase15aConnectorLabels(copy, selectedAllowlist.connectorIds)),
        joinPhase15aResearchLabels(phase15aSourceCategoryLabels(copy, selectedAllowlist.sourceCategories)),
        phase15aContextModeLabel(copy, selectedAllowlist.contextMode),
        selectedAllowlist.rateBudgetPolicy.maxConcurrentRunsPerProject,
        selectedAllowlist.rateBudgetPolicy.maxRunsPerSession,
        selectedAllowlist.disclosureLogPolicy.logEveryAutomaticRun
      )
    : copy.noAllowlistPolicyLoaded;

  return {
    activeAllowlistCount: activeAllowlists.length,
    allowlistPolicyLabel,
    disclosureActivityLabel: latestDisclosure
      ? copy.disclosureActivityLoaded(
          input.disclosures?.disclosureLogs.length ?? 0,
          phase15aDisclosureStatusLabel(copy, latestDisclosure.status)
        )
      : copy.noDisclosureActivity,
    runRecoveryLabel: input.runs
      ? copy.runRecoveryLoaded(runs.length, attentionRuns.length, input.runs.recovery.refetchUrl)
      : copy.noRunStatus,
    qualityGateLabel: qualityGateVisible
      ? researchQualityGateLabels(input, copy).slice(0, 3).join(" · ")
      : copy.qualityGatePending,
    staleOrFailureReasons: attentionRuns.map((run) =>
      [
        run.researchRunId,
        phase15aRunStatusLabel(copy, run.status),
        run.terminalReason ? phase15aTerminalReasonLabel(copy, run.terminalReason) : null,
        run.qualityGateReviewReason
      ]
        .filter((part): part is string => Boolean(part))
        .join(" · ")
    ),
    exitGate: {
      status: blockers.length || !recoveryIsVisible ? "blocked_for_1_5b" : "ready_for_1_5b",
      label: blockers.length || !recoveryIsVisible ? copy.exitGateBlocked : copy.exitGateReady,
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
