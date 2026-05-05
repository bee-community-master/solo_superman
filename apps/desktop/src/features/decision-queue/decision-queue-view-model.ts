import type {
  ConfidenceCompletionProjection,
  DecisionQueueProjection,
  PendingEffectSummaryDto,
  ProjectionVersion,
  RuntimeActivityProjection,
  SessionId,
  StatusEndpointDto
} from "@solo-superman/contracts";

export type QueueSectionId = "active" | "next" | "blocked" | "deferred";

export interface QueueSectionViewModel {
  readonly id: QueueSectionId;
  readonly title: string;
  readonly emptyLabel: string;
  readonly items: DecisionQueueProjection[QueueSectionId];
}

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
