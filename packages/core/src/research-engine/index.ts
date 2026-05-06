import {
  derivePendingResearchReviewCardOutcomeMetadata,
  deriveResearchReviewCardOutcomeMetadata
} from "@solo-superman/contracts";
import type {
  DecisionEvidencePackId,
  DecisionEvidencePackProjection,
  EvidenceItemId,
  EvidenceMatrixProjection,
  ProjectionVersion,
  QueueItemId,
  ResearchEvidenceProjection,
  ResearchImpact,
  ResearchQueueTerminalOutcome,
  ResearchQualityGateCheckProjection,
  ResearchResultId,
  ResearchResultProjection,
  ResearchRunId,
  ResearchReviewCardProjection,
  ResearchRouteOutcome,
  ResearchSourceReliability,
  ResearchTaskId,
  ResearchTaskProjection,
  SessionId
} from "@solo-superman/contracts";

export * from "./public-safe-summary";
export * from "./background-research-runtime";

export const RESEARCH_ENGINE_SLICE_STATUS = "research-evidence-loop-pr-06" as const;

export interface PlanResearchTaskInput {
  readonly researchTaskId: ResearchTaskId;
  readonly sessionId: SessionId;
  readonly objective: string;
  readonly routeOutcome: ResearchRouteOutcome;
  readonly impact: ResearchImpact;
  readonly createdAt: string;
  readonly sourceQueueItemId?: QueueItemId;
  readonly sourceAnswerRef?: string;
}

export interface ImportResearchResultInput {
  readonly researchResultId: ResearchResultId;
  readonly researchTaskId: ResearchTaskId;
  readonly result: string;
  readonly importedAt: string;
  readonly researchRunId?: ResearchRunId;
  readonly sourceTitle?: string;
  readonly sourceUrl?: string;
  readonly sourceReliability?: ResearchSourceReliability;
  readonly sourcePublishedAt?: string;
  readonly sourceRetrievedAt?: string;
  readonly limitationNotes?: string;
  readonly claim?: string;
  readonly decisionContext?: string;
  readonly specSectionRef?: string;
  readonly questionRef?: string;
  readonly implicationScope?: string;
  readonly staleSensitive?: boolean;
  readonly sourceRequiredAfter?: string;
}

export interface SynthesizeEvidenceInput {
  readonly researchTask: ResearchTaskProjection;
  readonly researchResult: ResearchResultProjection;
  readonly synthesisVersion: number;
}

const EMPTY_RESEARCH_PROJECTION: Omit<ResearchEvidenceProjection, "version"> = {
  kind: "ResearchEvidenceProjection",
  taskIds: [],
  tasks: [],
  results: [],
  evidenceMatrices: [],
  evidencePacks: [],
  reviewCards: [],
  knownRisks: [],
  nextValidationActions: [],
  proConBalanceStatus: "unknown"
};
const PRO_EVIDENCE_MARKERS = ["pro:", "찬성", "supports", "support", "긍정", "validates"] as const;
const CON_EVIDENCE_MARKERS = ["con:", "risk:", "risks:", "반대", "우려", "부정", "caution"] as const;
const CON_EVIDENCE_SNIPPET_MARKERS = ["con:", "risk:", "risks:", "risk", "risks", "반대", "우려", "부정", "caution"] as const;
const UNCERTAINTY_MARKERS = ["uncertain", "unknown", "불확실", "limitation", "한계"] as const;

function trimOrNull(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function uniqueValues(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function itemId(prefix: string, token: string, index: number) {
  return `${prefix}_${token}_${index}` as EvidenceItemId;
}

function compactSummary(value: string, fallback: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");

  return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed || fallback;
}

function normalizeResultText(value: string, fallback: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");

  return trimmed || fallback;
}

function optionalNormalizedString(value: string | undefined) {
  return trimOrNull(value) ?? undefined;
}

function evidenceSnippet(value: string, markers: readonly string[], fallback: string) {
  const normalized = normalizeResultText(value, fallback);
  const lower = normalized.toLowerCase();
  const markerIndex = markers
    .map((marker) => lower.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  if (markerIndex === undefined || markerIndex <= 40) {
    return compactSummary(normalized, fallback);
  }

  const start = Math.max(0, markerIndex - 40);
  const excerpt = normalized.slice(start, start + 180).trim();

  return `${start > 0 ? "..." : ""}${excerpt}${start + 180 < normalized.length ? "..." : ""}`;
}

function includesAny(value: string, needles: readonly string[]) {
  return needles.some((needle) => value.includes(needle));
}

function hasNegatedRiskClaim(value: string) {
  return /\b(?:no|not|without)\s+(?:meaningful\s+|material\s+|credible\s+|skeptical\s+)?(?:risk|risks|con evidence|counter-evidence|counter evidence)\b/.test(
    value
  );
}

function sourceRetainedRef(result: ResearchResultProjection) {
  return result.sourceUrl ?? result.sourceTitle ?? result.researchResultId;
}

function retainedSourceRefs(result: ResearchResultProjection, pack?: DecisionEvidencePackProjection) {
  return uniqueValues([
    sourceRetainedRef(result),
    ...(result.researchRunId ? [result.researchRunId] : []),
    ...(result.questionRef ? [result.questionRef] : []),
    ...(result.specSectionRef ? [result.specSectionRef] : []),
    ...(pack?.knownRisk ? [pack.knownRisk] : [])
  ]);
}

function mergeById<TItem, TId extends string>(items: readonly TItem[], nextItem: TItem, idOf: (item: TItem) => TId) {
  const nextId = idOf(nextItem);
  const withoutExisting = items.filter((item) => idOf(item) !== nextId);

  return [...withoutExisting, nextItem];
}

function reviewCardForTask(task: ResearchTaskProjection): ResearchReviewCardProjection {
  const retainedSourceRef = task.sourceAnswerRef ?? task.sourceQueueItemId;
  const outcomeMetadata = derivePendingResearchReviewCardOutcomeMetadata();

  return {
    cardId: `research_review_${task.researchTaskId}` as QueueItemId,
    researchTaskId: task.researchTaskId,
    cardType: outcomeMetadata.cardType,
    title:
      task.routeOutcome === "missing_con_evidence"
        ? `반대근거 탐색 필요: ${task.objective}`
        : `Research review: ${task.objective}`,
    state: "pending_manual_result",
    impact: task.impact,
    ...(retainedSourceRef ? { retainedSourceRef } : {}),
    availableOutcomes: outcomeMetadata.availableOutcomes,
    suggestedOutcome: outcomeMetadata.suggestedOutcome,
    blocksPlanning: task.impact === "high",
    recoveryActions: outcomeMetadata.recoveryActions
  };
}

function reviewCardForMatrix(
  task: ResearchTaskProjection,
  result: ResearchResultProjection,
  matrix: EvidenceMatrixProjection,
  pack: DecisionEvidencePackProjection
): ResearchReviewCardProjection {
  const terminalFailure = matrix.balanceStatus === "source_quality_insufficient";
  const insufficient =
    pack.gateStatus === "research_insufficient" ||
    matrix.balanceStatus === "missing_con_evidence" ||
    matrix.balanceStatus === "needs_con_evidence" ||
    matrix.balanceStatus === "blocked_by_con_evidence";
  const needsReview = pack.gateStatus === "needs_review";
  const stale = pack.gateStatus === "stale";
  const sourceRefs = retainedSourceRefs(result, pack);
  const outcomeMetadata = deriveResearchReviewCardOutcomeMetadata({
    impact: task.impact,
    gateStatus: pack.gateStatus,
    balanceStatus: matrix.balanceStatus,
    hasAdditionalQuestions: matrix.additionalQuestions.length > 0
  });

  return {
    cardId: `research_review_${task.researchTaskId}` as QueueItemId,
    researchTaskId: task.researchTaskId,
    evidencePackId: pack.evidencePackId,
    cardType: outcomeMetadata.cardType,
    title: stale
      ? `Research stale: ${task.objective}`
      : needsReview
        ? `Quality gate review required: ${task.objective}`
        : terminalFailure
      ? `Research failed: ${task.objective}`
      : insufficient
        ? `Evidence still insufficient: ${task.objective}`
        : `Evidence ready: ${task.objective}`,
    state: stale
      ? "stale"
      : needsReview
        ? "quality_gate_review"
        : terminalFailure
          ? "terminal_failure"
          : insufficient
            ? "research_insufficient"
            : "ready_for_review",
    impact: task.impact,
    gateStatus: pack.gateStatus,
    decisionContext: pack.decisionContext,
    reviewReason: primaryGateReviewReason(pack) ?? pack.implicationScope,
    retainedSourceRef: sourceRetainedRef(result),
    retainedSourceRefs: sourceRefs,
    availableOutcomes: outcomeMetadata.availableOutcomes,
    suggestedOutcome: outcomeMetadata.suggestedOutcome,
    blocksPlanning: task.impact === "high",
    recoveryActions: outcomeMetadata.recoveryActions
  };
}

export function resolveResearchReviewCardInProjection(
  projection: ResearchEvidenceProjection,
  cardId: QueueItemId,
  outcome: ResearchQueueTerminalOutcome,
  rationale: string | undefined,
  version: ProjectionVersion
): ResearchEvidenceProjection {
  const reviewCards = projection.reviewCards.map((card) =>
    card.cardId === cardId
      ? {
          ...card,
          state: "resolved" as const,
          terminalOutcome: outcome,
          ...(rationale ? { terminalRationale: rationale } : {}),
          blocksPlanning: card.impact === "high" && (outcome === "deferred" || outcome === "research_insufficient")
        }
      : card
  );
  const resolvedCard = reviewCards.find((card) => card.cardId === cardId);
  const knownRisks = uniqueValues([
    ...projection.knownRisks,
    ...(resolvedCard?.terminalOutcome === "risk_accepted"
      ? [
          `Accepted research risk for ${resolvedCard.title}: ${
            resolvedCard.terminalRationale ?? "No rationale provided."
          }`
        ]
      : []),
    ...(resolvedCard?.terminalOutcome === "deferred" && resolvedCard.terminalRationale
      ? [`Deferred research card ${resolvedCard.title}: ${resolvedCard.terminalRationale}`]
      : [])
  ]);

  return {
    ...projection,
    version,
    reviewCards,
    knownRisks,
    nextValidationActions: uniqueValues([
      ...projection.nextValidationActions,
      ...(outcome === "revised" && rationale ? [rationale] : []),
      ...(outcome === "research_insufficient" ? [`Supplement evidence before relying on ${cardId}.`] : [])
    ])
  };
}

function taskStatusForPack(matrix: EvidenceMatrixProjection, pack: DecisionEvidencePackProjection): ResearchTaskProjection["status"] {
  if (pack.gateStatus === "needs_review") {
    return "needs_review";
  }

  if (pack.gateStatus === "stale") {
    return "stale";
  }

  if (pack.gateStatus === "research_insufficient") {
    return "research_insufficient";
  }

  if (matrix.balanceStatus === "balanced") {
    return "evidence_ready";
  }

  if (matrix.balanceStatus === "source_quality_insufficient") {
    return "failed";
  }

  return "research_insufficient";
}

export function emptyResearchEvidenceProjection(version: ProjectionVersion = 0 as ProjectionVersion): ResearchEvidenceProjection {
  return {
    ...EMPTY_RESEARCH_PROJECTION,
    version
  };
}

export function planResearchTask(input: PlanResearchTaskInput): ResearchTaskProjection {
  return {
    researchTaskId: input.researchTaskId,
    sessionId: input.sessionId,
    ...(input.sourceQueueItemId ? { sourceQueueItemId: input.sourceQueueItemId } : {}),
    ...(input.sourceAnswerRef ? { sourceAnswerRef: input.sourceAnswerRef } : {}),
    objective: input.objective,
    routeOutcome: input.routeOutcome,
    impact: input.impact,
    status: "planned",
    createdAt: input.createdAt
  };
}

export function importResearchResult(input: ImportResearchResultInput): ResearchResultProjection {
  const sourceTitle = trimOrNull(input.sourceTitle);
  const sourceUrl = trimOrNull(input.sourceUrl);
  const limitationNotes = trimOrNull(input.limitationNotes);
  const sourceReliability = input.sourceReliability;
  const sourcePublishedAt = optionalNormalizedString(input.sourcePublishedAt);
  const sourceRetrievedAt = optionalNormalizedString(input.sourceRetrievedAt);
  const claim = optionalNormalizedString(input.claim);
  const decisionContext = optionalNormalizedString(input.decisionContext);
  const specSectionRef = optionalNormalizedString(input.specSectionRef);
  const questionRef = optionalNormalizedString(input.questionRef);
  const implicationScope = optionalNormalizedString(input.implicationScope);
  const sourceRequiredAfter = optionalNormalizedString(input.sourceRequiredAfter);

  return {
    researchResultId: input.researchResultId,
    researchTaskId: input.researchTaskId,
    ...(input.researchRunId ? { researchRunId: input.researchRunId } : {}),
    ...(sourceTitle ? { sourceTitle } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(sourceReliability ? { sourceReliability } : {}),
    ...(sourcePublishedAt ? { sourcePublishedAt } : {}),
    ...(sourceRetrievedAt ? { sourceRetrievedAt } : {}),
    resultSummary: normalizeResultText(input.result, "Manual research result"),
    ...(limitationNotes ? { limitationNotes } : {}),
    ...(claim ? { claim } : {}),
    ...(decisionContext ? { decisionContext } : {}),
    ...(specSectionRef ? { specSectionRef } : {}),
    ...(questionRef ? { questionRef } : {}),
    ...(implicationScope ? { implicationScope } : {}),
    ...(input.staleSensitive !== undefined ? { staleSensitive: input.staleSensitive } : {}),
    ...(sourceRequiredAfter ? { sourceRequiredAfter } : {}),
    importedAt: input.importedAt
  };
}

export function synthesizeEvidenceMatrix(input: SynthesizeEvidenceInput): EvidenceMatrixProjection {
  const resultText = `${input.researchResult.resultSummary} ${input.researchResult.limitationNotes ?? ""}`.toLowerCase();
  const token = `${input.researchResult.researchResultId}_v${input.synthesisVersion}`;
  const hasPro = includesAny(resultText, PRO_EVIDENCE_MARKERS);
  const hasCon =
    includesAny(resultText, CON_EVIDENCE_MARKERS) ||
    (/\brisks?\b/.test(resultText) && !hasNegatedRiskClaim(resultText));
  const hasUncertainty = includesAny(resultText, UNCERTAINTY_MARKERS);
  const proEvidence = hasPro
    ? [
        {
          evidenceItemId: itemId("evidence_pro", token, 1),
          kind: "pro" as const,
          summary: evidenceSnippet(
            input.researchResult.resultSummary,
            PRO_EVIDENCE_MARKERS,
            "Imported result supports the claim."
          )
        }
      ]
    : [];
  const conEvidence = hasCon
    ? [
        {
          evidenceItemId: itemId("evidence_con", token, 1),
          kind: "con" as const,
          summary: evidenceSnippet(
            input.researchResult.resultSummary,
            CON_EVIDENCE_SNIPPET_MARKERS,
            "Imported result raises counter-evidence or risk."
          )
        }
      ]
    : [];
  const uncertainties = hasUncertainty || input.researchResult.limitationNotes
    ? [
        {
          evidenceItemId: itemId("evidence_uncertainty", token, 1),
          kind: "uncertainty" as const,
          summary: input.researchResult.limitationNotes ?? "Imported result still has uncertainty."
        }
      ]
    : [];
  const balanceStatus =
    proEvidence.length > 0 && conEvidence.length > 0
      ? "balanced"
      : proEvidence.length > 0
        ? input.researchTask.impact === "high"
          ? "missing_con_evidence"
          : "needs_con_evidence"
        : conEvidence.length > 0
          ? "blocked_by_con_evidence"
          : "source_quality_insufficient";
  const missingConEvidenceReason =
    balanceStatus === "missing_con_evidence"
      ? input.researchResult.limitationNotes ??
        "Skeptical search/import did not include enough counter-evidence for a high-impact claim."
      : undefined;
  const knownRisk =
    balanceStatus === "balanced"
      ? undefined
      : balanceStatus === "source_quality_insufficient"
        ? `Research source was insufficient for ${input.researchTask.objective}.`
        : `Evidence remains ${balanceStatus} for ${input.researchTask.objective}.`;

  return {
    evidenceMatrixId: `evidence_matrix_${input.researchResult.researchResultId}_v${input.synthesisVersion}`,
    researchTaskId: input.researchTask.researchTaskId,
    researchResultId: input.researchResult.researchResultId,
    synthesisVersion: input.synthesisVersion,
    proEvidence,
    conEvidence,
    uncertainties,
    additionalQuestions:
      balanceStatus === "balanced"
        ? []
        : [`What evidence would resolve ${input.researchTask.objective}?`],
    balanceStatus,
    decisionBlocked: input.researchTask.impact === "high" && balanceStatus !== "balanced",
    ...(missingConEvidenceReason ? { missingConEvidenceReason } : {}),
    ...(knownRisk ? { knownRisk } : {})
  };
}

function isoMillis(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);

  return Number.isNaN(parsed) ? null : parsed;
}

function check(
  code: ResearchQualityGateCheckProjection["code"],
  status: ResearchQualityGateCheckProjection["status"],
  reason: string
): ResearchQualityGateCheckProjection {
  return { code, status, reason };
}

function qualityGateStatusFor(
  task: ResearchTaskProjection,
  matrix: EvidenceMatrixProjection,
  checks: readonly ResearchQualityGateCheckProjection[]
): DecisionEvidencePackProjection["gateStatus"] {
  if (checks.some((candidate) => candidate.code === "staleness" && candidate.status === "failed")) {
    return "stale";
  }

  if (
    checks.some((candidate) => candidate.status === "failed") ||
    matrix.balanceStatus === "source_quality_insufficient" ||
    matrix.balanceStatus === "blocked_by_con_evidence" ||
    (task.impact === "high" && matrix.balanceStatus !== "balanced")
  ) {
    return "research_insufficient";
  }

  if (checks.some((candidate) => candidate.status === "unknown")) {
    return "needs_review";
  }

  return "accepted";
}

function sourceReliabilityFor(result: ResearchResultProjection): ResearchSourceReliability {
  return result.sourceReliability ?? "medium";
}

function limitationRefsFor(result: ResearchResultProjection, matrix: EvidenceMatrixProjection) {
  return uniqueValues([
    ...(result.limitationNotes ? [result.limitationNotes] : []),
    ...(matrix.uncertainties.length ? matrix.uncertainties.map((item) => item.summary) : [])
  ]);
}

function implicationScopeFor(task: ResearchTaskProjection, result: ResearchResultProjection, matrix: EvidenceMatrixProjection) {
  const provided = trimOrNull(result.implicationScope);

  if (provided) {
    return provided;
  }

  if (matrix.balanceStatus === "balanced") {
    return `Evidence is scoped to the research task "${task.objective}" and supports decision review, not automatic SpecVersion updates.`;
  }

  return `Evidence is insufficient for "${task.objective}"; preserve it as a Risk/Review item before changing product decisions.`;
}

function primaryGateReviewReason(pack: DecisionEvidencePackProjection) {
  return (
    pack.gateChecks.find((check) => check.status === "failed") ??
    pack.gateChecks.find((check) => check.status === "unknown")
  )?.reason;
}

export function buildDecisionEvidencePack(
  input: SynthesizeEvidenceInput & { readonly matrix: EvidenceMatrixProjection }
): DecisionEvidencePackProjection {
  const { researchTask, researchResult, matrix } = input;
  const reliability = sourceReliabilityFor(researchResult);
  const limitationRefs = limitationRefsFor(researchResult, matrix);
  const implicationScope = implicationScopeFor(researchTask, researchResult, matrix);
  const publishedAt = isoMillis(researchResult.sourcePublishedAt);
  const requiredAfter = isoMillis(researchResult.sourceRequiredAfter);
  const staleSensitive = researchResult.staleSensitive === true || Boolean(researchResult.sourceRequiredAfter);
  const staleFailed =
    staleSensitive && publishedAt !== null && requiredAfter !== null && publishedAt < requiredAfter;
  const checks = [
    check(
      "source_metadata",
      reliability === "unknown" && !researchResult.sourceTitle && !researchResult.sourceUrl ? "unknown" : "passed",
      reliability === "unknown" && !researchResult.sourceTitle && !researchResult.sourceUrl
        ? "Source metadata is insufficient for automatic quality-gate evaluation."
        : "Source title/url/date metadata is captured when available or the manual import is explicitly retained."
    ),
    check(
      "source_reliability",
      researchTask.impact === "high" && reliability === "low"
        ? "failed"
        : reliability === "unknown"
          ? "unknown"
          : "passed",
      researchTask.impact === "high" && reliability === "low"
        ? "Low-reliability source cannot support a high-impact claim by itself."
        : reliability === "unknown"
          ? "Source reliability requires manual review before evidence acceptance."
          : `Source reliability is ${reliability}.`
    ),
    check(
      "pro_con_balance",
      matrix.proEvidence.length > 0 && matrix.conEvidence.length > 0
        ? "passed"
        : matrix.missingConEvidenceReason || matrix.balanceStatus === "needs_con_evidence"
          ? researchTask.impact === "high"
            ? "failed"
            : "passed"
          : "failed",
      matrix.proEvidence.length > 0 && matrix.conEvidence.length > 0
        ? "Pro and con evidence are both present."
        : matrix.missingConEvidenceReason || matrix.balanceStatus === "needs_con_evidence"
          ? researchTask.impact === "high"
            ? "High-impact claim records missing_con_evidence and remains blocked from decision-ready."
            : "Missing con evidence is explicit and connected to Known Risks/validation actions."
          : "Evidence lacks an explicit pro/con or missing_con_evidence outcome."
    ),
    check(
      "limitations_linked",
      limitationRefs.length > 0 || matrix.knownRisk || matrix.balanceStatus === "balanced" ? "passed" : "unknown",
      limitationRefs.length > 0 || matrix.knownRisk
        ? "Limitations are connected to Known Risks or next validation actions."
        : matrix.balanceStatus === "balanced"
          ? "No separate limitation was declared for the balanced evidence pack."
        : "Limitations are not explicit enough for automatic acceptance."
    ),
    check(
      "staleness",
      staleFailed ? "failed" : staleSensitive && (publishedAt === null || requiredAfter === null) ? "unknown" : "passed",
      staleFailed
        ? "Source timestamp predates the freshness requirement."
        : staleSensitive && (publishedAt === null || requiredAfter === null)
          ? "Stale-sensitive evidence is missing comparable source/freshness timestamps."
          : "Staleness policy is satisfied or not applicable."
    ),
    check(
      "implication_scope",
      implicationScope ? "passed" : "unknown",
      implicationScope
        ? "Implication is scoped to evidence strength and does not silently update SpecVersion."
        : "Product implication scope requires manual review."
    )
  ] as const satisfies readonly ResearchQualityGateCheckProjection[];
  const gateStatus = qualityGateStatusFor(researchTask, matrix, checks);
  const knownRisk =
    gateStatus === "accepted"
      ? matrix.knownRisk
      : matrix.knownRisk ?? `${gateStatus} evidence for ${researchTask.objective}.`;
  const nextValidationAction =
    gateStatus === "accepted"
      ? undefined
      : gateStatus === "stale"
        ? `Refresh source evidence for ${researchTask.objective}.`
        : `Review or supplement evidence for ${researchTask.objective}.`;

  return {
    evidencePackId: `evidence_pack_${researchResult.researchResultId}_v${input.synthesisVersion}` as DecisionEvidencePackId,
    researchTaskId: researchTask.researchTaskId,
    researchResultId: researchResult.researchResultId,
    ...(researchResult.researchRunId ? { researchRunId: researchResult.researchRunId } : {}),
    claim: researchResult.claim ?? researchTask.objective,
    decisionContext: researchResult.decisionContext ?? researchTask.routeOutcome,
    ...(researchResult.specSectionRef ? { specSectionRef: researchResult.specSectionRef } : {}),
    ...(researchResult.questionRef ?? researchTask.sourceQueueItemId
      ? { questionRef: researchResult.questionRef ?? researchTask.sourceQueueItemId }
      : {}),
    ...(researchResult.sourceTitle ? { sourceTitle: researchResult.sourceTitle } : {}),
    ...(researchResult.sourceUrl ? { sourceUrl: researchResult.sourceUrl } : {}),
    sourceReliability: reliability,
    ...(researchResult.sourcePublishedAt ? { sourcePublishedAt: researchResult.sourcePublishedAt } : {}),
    retrievedAt: researchResult.sourceRetrievedAt ?? researchResult.importedAt,
    gateStatus,
    gateChecks: checks,
    proEvidenceItemIds: matrix.proEvidence.map((item) => item.evidenceItemId),
    conEvidenceItemIds: matrix.conEvidence.map((item) => item.evidenceItemId),
    uncertaintyItemIds: matrix.uncertainties.map((item) => item.evidenceItemId),
    limitationRefs,
    implicationScope,
    ...(knownRisk ? { knownRisk } : {}),
    ...(nextValidationAction ? { nextValidationAction } : {}),
    createdAt: researchResult.importedAt
  };
}

export function addResearchTaskToProjection(
  projection: ResearchEvidenceProjection,
  task: ResearchTaskProjection,
  version: ProjectionVersion
): ResearchEvidenceProjection {
  const tasks = mergeById(projection.tasks, task, (item) => item.researchTaskId);
  const reviewCards = mergeById(projection.reviewCards, reviewCardForTask(task), (item) => item.cardId);

  return {
    ...projection,
    version,
    taskIds: tasks.map((item) => item.researchTaskId),
    tasks,
    reviewCards,
    proConBalanceStatus:
      task.routeOutcome === "missing_con_evidence" ? "missing_con_evidence" : projection.proConBalanceStatus
  };
}

export function addResearchResultToProjection(
  projection: ResearchEvidenceProjection,
  task: ResearchTaskProjection,
  result: ResearchResultProjection,
  matrix: EvidenceMatrixProjection,
  pack: DecisionEvidencePackProjection,
  version: ProjectionVersion
): ResearchEvidenceProjection {
  const updatedTask = {
    ...task,
    status: taskStatusForPack(matrix, pack)
  };
  const tasks = mergeById(projection.tasks, updatedTask, (item) => item.researchTaskId);
  const results = mergeById(projection.results, result, (item) => item.researchResultId);
  const evidenceMatrices = mergeById(projection.evidenceMatrices, matrix, (item) => item.evidenceMatrixId);
  const evidencePacks = mergeById(projection.evidencePacks, pack, (item) => item.evidencePackId);
  const reviewCards = mergeById(
    projection.reviewCards,
    reviewCardForMatrix(updatedTask, result, matrix, pack),
    (item) => item.cardId
  );
  const knownRisks = uniqueValues([
    ...projection.knownRisks,
    ...(matrix.knownRisk ? [matrix.knownRisk] : []),
    ...(pack.knownRisk ? [pack.knownRisk] : [])
  ]);

  return {
    ...projection,
    version,
    taskIds: tasks.map((item) => item.researchTaskId),
    tasks,
    results,
    evidenceMatrices,
    evidencePacks,
    reviewCards,
    knownRisks,
    nextValidationActions: uniqueValues([
      ...projection.nextValidationActions,
      ...(pack.nextValidationAction ? [pack.nextValidationAction] : []),
      ...knownRisks.map((risk) => `Validate or explicitly accept: ${risk}`)
    ]),
    proConBalanceStatus: matrix.balanceStatus
  };
}

export function addImportedResearchResultToProjection(
  projection: ResearchEvidenceProjection,
  task: ResearchTaskProjection,
  result: ResearchResultProjection,
  version: ProjectionVersion
): ResearchEvidenceProjection {
  const updatedTask = {
    ...task,
    status: "handoff_ready" as const
  };
  const tasks = mergeById(projection.tasks, updatedTask, (item) => item.researchTaskId);
  const results = mergeById(projection.results, result, (item) => item.researchResultId);

  return {
    ...projection,
    version,
    taskIds: tasks.map((item) => item.researchTaskId),
    tasks,
    results
  };
}
