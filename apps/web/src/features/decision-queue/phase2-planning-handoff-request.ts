import {
  PROJECT_PURPOSE_MODE_SKIPPED_COMMERCIALIZATION_AXES,
  type ConfidenceCompletionProjection,
  type CreatePlanningHandoffRequest,
  type DecisionQueueProjection,
  type FounderBriefProjection,
  type LivingSpecProjection,
  type Phase15bUpgradeHintProjection,
  type PlanningHandoffRequestedScopeDto,
  type PlanningHandoffSourceRefDto,
  type QueueItemProjection,
  type ResearchEvidenceProjection,
  type SessionShellProjection,
  type StateVersion
} from "@solo-superman/contracts";

interface PlanningHandoffRequestProjectionInputs {
  readonly session: SessionShellProjection;
  readonly spec: LivingSpecProjection | null;
  readonly queue: DecisionQueueProjection | null;
  readonly research: ResearchEvidenceProjection | null;
  readonly confidence: ConfidenceCompletionProjection | null;
  readonly founderBrief: FounderBriefProjection | null;
  readonly phase15bReadiness: Phase15bUpgradeHintProjection | null;
  readonly expectedStateVersion: StateVersion;
}

const PLANNING_HANDOFF_NON_GOALS = [
  "controlled execution",
  "file patches",
  "shell commands",
  "browser automation",
  "external deployment"
] as const;

const PLANNING_HANDOFF_EXCLUDED_INTERNAL_PHASES = [
  "phase3_controlled_execution",
  "chatgpt_web_automation",
  "external_deploy"
] as const satisfies PlanningHandoffRequestedScopeDto["excludedInternalPhases"];

function dedupeSourceRefs(sourceRefs: readonly PlanningHandoffSourceRefDto[]) {
  const seen = new Set<string>();
  const deduped: PlanningHandoffSourceRefDto[] = [];

  for (const sourceRef of sourceRefs) {
    const key = `${sourceRef.sourceType}:${sourceRef.sourceId}`;

    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(sourceRef);
    }
  }

  return deduped;
}

function allQueueItems(queue: DecisionQueueProjection | null): readonly QueueItemProjection[] {
  return queue ? [...queue.active, ...queue.next, ...queue.blocked, ...queue.deferred] : [];
}

function isResearchUpdatedQueueItem(item: QueueItemProjection) {
  return (
    item.cardType === "research_review" ||
    item.cardType === "decision_approval" ||
    item.cardType === "risk_acceptance" ||
    item.cardType === "conflict_resolution" ||
    item.cardType === "follow_up_question" ||
    Boolean(item.researchTaskId) ||
    Boolean(item.evidencePackId) ||
    item.blocksPlanning === true
  );
}

function specSourceRef(session: SessionShellProjection, spec: LivingSpecProjection | null): PlanningHandoffSourceRefDto | null {
  return spec
    ? {
        sourceType: "spec_version",
        sourceId: `living_spec:${session.sessionId}:${spec.version}`,
        sourceLabel: spec.title ? `Living Product Spec: ${spec.title}` : "Living Product Spec",
        required: true,
        stale: false
      }
    : null;
}

function founderOrCompletionSourceRef(
  session: SessionShellProjection,
  confidence: ConfidenceCompletionProjection | null,
  founderBrief: FounderBriefProjection | null
): PlanningHandoffSourceRefDto | null {
  if (founderBrief?.exportReady) {
    return {
      sourceType: "founder_brief",
      sourceId: `founder_brief:${session.sessionId}:${founderBrief.version}`,
      sourceLabel: "Founder Brief export metadata",
      required: true,
      stale: false
    };
  }

  return confidence?.completionCandidate.status === "candidate"
    ? {
        sourceType: "completion_candidate",
        sourceId: `completion_candidate:${session.sessionId}:${confidence.version}`,
        sourceLabel: confidence.completionCandidate.summary,
        required: true,
        stale: false
      }
    : null;
}

function evidencePackSourceRefs(research: ResearchEvidenceProjection | null): readonly PlanningHandoffSourceRefDto[] {
  return (
    research?.evidencePacks
      .filter((pack) => pack.gateStatus === "accepted" || pack.gateStatus === "research_insufficient")
      .map((pack) => ({
        sourceType: "decision_linked_evidence_pack" as const,
        sourceId: pack.evidencePackId,
        sourceLabel: pack.claim,
        required: true,
        stale: pack.gateStatus !== "accepted" && pack.gateStatus !== "research_insufficient"
      })) ?? []
  );
}

function researchQueueSourceRefs(
  queue: DecisionQueueProjection | null,
  research: ResearchEvidenceProjection | null
): readonly PlanningHandoffSourceRefDto[] {
  const queueRefs = allQueueItems(queue)
    .filter(isResearchUpdatedQueueItem)
    .map((item) => ({
      sourceType: "research_updated_queue_item" as const,
      sourceId: item.queueItemId,
      sourceLabel: item.title,
      required: true,
      stale: false
    }));
  const reviewCardRefs =
    research?.reviewCards.map((card) => ({
      sourceType: "research_updated_queue_item" as const,
      sourceId: card.cardId,
      sourceLabel: card.title,
      required: true,
      stale: false
    })) ?? [];

  return dedupeSourceRefs([...queueRefs, ...reviewCardRefs]);
}

function riskSourceRefs(
  confidence: ConfidenceCompletionProjection | null,
  research: ResearchEvidenceProjection | null,
  founderBrief: FounderBriefProjection | null
): readonly PlanningHandoffSourceRefDto[] {
  return dedupeSourceRefs([
    ...(confidence?.topRiskCards.map((risk) => ({
      sourceType: "known_risk" as const,
      sourceId: risk.riskId,
      sourceLabel: risk.title,
      required: false,
      stale: false
    })) ?? []),
    ...(research?.knownRisks.map((risk) => ({
      sourceType: "known_risk" as const,
      sourceId: risk,
      sourceLabel: risk,
      required: false,
      stale: false
    })) ?? []),
    ...(founderBrief?.knownRisks.map((risk) => ({
      sourceType: "known_risk" as const,
      sourceId: risk,
      sourceLabel: risk,
      required: false,
      stale: false
    })) ?? [])
  ]);
}

function phase15bSourceRefs(readiness: Phase15bUpgradeHintProjection | null): readonly PlanningHandoffSourceRefDto[] {
  return (
    readiness?.records.map((record) => ({
      sourceType: "phase15b_hint" as const,
      sourceId: record.artifactId,
      sourceLabel: `${record.hints.executionIntent.candidateActionType} readiness metadata`,
      required: false,
      stale: false
    })) ?? []
  );
}

function planningHandoffSourceRefs(
  inputs: PlanningHandoffRequestProjectionInputs
): readonly PlanningHandoffSourceRefDto[] {
  const sourceRefs = dedupeSourceRefs(
    [
      specSourceRef(inputs.session, inputs.spec),
      founderOrCompletionSourceRef(inputs.session, inputs.confidence, inputs.founderBrief),
      ...evidencePackSourceRefs(inputs.research),
      ...researchQueueSourceRefs(inputs.queue, inputs.research),
      ...riskSourceRefs(inputs.confidence, inputs.research, inputs.founderBrief),
      ...phase15bSourceRefs(inputs.phase15bReadiness)
    ].filter((sourceRef): sourceRef is PlanningHandoffSourceRefDto => Boolean(sourceRef))
  );

  return sourceRefs.length
    ? sourceRefs
    : [
        {
          sourceType: "activity_event",
          sourceId: `web_planning_handoff_gate:${inputs.session.sessionId}:${inputs.expectedStateVersion}`,
          sourceLabel: "Web local gate trigger attempted before source projections were loaded.",
          required: false,
          stale: false
        }
      ];
}

function planningHandoffRequestedScope(inputs: PlanningHandoffRequestProjectionInputs): PlanningHandoffRequestedScopeDto {
  return {
    productSlice:
      inputs.spec?.title ??
      inputs.founderBrief?.problemCustomerValue ??
      inputs.confidence?.completionCandidate.summary ??
      "Founder planning handoff",
    userFacingJourneyLabel: "Planning-ready",
    ...(inputs.session.projectPurposeMode ? { projectPurposeMode: inputs.session.projectPurposeMode } : {}),
    projectPurposeModeLabel: inputs.session.projectPurposeModeLabel,
    projectPurposeModeEffect: inputs.session.projectPurposeModeEffect,
    ...(inputs.session.projectPurposeMode === "personal"
      ? {
          skippedCommercializationAxes: PROJECT_PURPOSE_MODE_SKIPPED_COMMERCIALIZATION_AXES.personal
        }
      : {}),
    nonGoals: PLANNING_HANDOFF_NON_GOALS,
    excludedInternalPhases: PLANNING_HANDOFF_EXCLUDED_INTERNAL_PHASES,
    assumptions: [
      "Web trigger only runs the local Planning Handoff gate and persists final/blocker planning metadata.",
      "Execution remains out of scope: no file patch, shell command, browser action, deploy, credential, external mutation, or active delegation.",
      `Projection versions: session=${inputs.session.version}, spec=${inputs.spec?.version ?? 0}, queue=${inputs.queue?.version ?? 0}, research=${inputs.research?.version ?? 0}, confidence=${inputs.confidence?.version ?? 0}.`
    ]
  };
}

export function buildPlanningHandoffRequest(
  inputs: PlanningHandoffRequestProjectionInputs
): CreatePlanningHandoffRequest {
  return {
    sessionId: inputs.session.sessionId,
    expectedStateVersion: inputs.expectedStateVersion,
    sourceRefs: planningHandoffSourceRefs(inputs),
    requestedScope: planningHandoffRequestedScope(inputs)
  };
}
