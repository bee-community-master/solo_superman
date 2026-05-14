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
