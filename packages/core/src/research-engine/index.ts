import type {
  EvidenceItemId,
  EvidenceMatrixProjection,
  ProjectionVersion,
  QueueItemId,
  ResearchEvidenceProjection,
  ResearchImpact,
  ResearchResultId,
  ResearchResultProjection,
  ResearchReviewCardProjection,
  ResearchRouteOutcome,
  ResearchTaskId,
  ResearchTaskProjection,
  SessionId
} from "@solo-superman/contracts";

export * from "./public-safe-summary";

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
  readonly sourceTitle?: string;
  readonly sourceUrl?: string;
  readonly limitationNotes?: string;
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

function mergeById<TItem, TId extends string>(items: readonly TItem[], nextItem: TItem, idOf: (item: TItem) => TId) {
  const nextId = idOf(nextItem);
  const withoutExisting = items.filter((item) => idOf(item) !== nextId);

  return [...withoutExisting, nextItem];
}

function reviewCardForTask(task: ResearchTaskProjection): ResearchReviewCardProjection {
  const retainedSourceRef = task.sourceAnswerRef ?? task.sourceQueueItemId;

  return {
    cardId: `research_review_${task.researchTaskId}` as QueueItemId,
    researchTaskId: task.researchTaskId,
    title:
      task.routeOutcome === "missing_con_evidence"
        ? `반대근거 탐색 필요: ${task.objective}`
        : `Research review: ${task.objective}`,
    state: "pending_manual_result",
    ...(retainedSourceRef ? { retainedSourceRef } : {}),
    recoveryActions: ["import_manual_result", "defer_as_known_risk"]
  };
}

function reviewCardForMatrix(
  task: ResearchTaskProjection,
  result: ResearchResultProjection,
  matrix: EvidenceMatrixProjection
): ResearchReviewCardProjection {
  const terminalFailure = matrix.balanceStatus === "source_quality_insufficient";
  const insufficient =
    matrix.balanceStatus === "missing_con_evidence" ||
    matrix.balanceStatus === "needs_con_evidence" ||
    matrix.balanceStatus === "blocked_by_con_evidence";

  return {
    cardId: `research_review_${task.researchTaskId}` as QueueItemId,
    researchTaskId: task.researchTaskId,
    title: terminalFailure
      ? `Research failed: ${task.objective}`
      : insufficient
        ? `Evidence still insufficient: ${task.objective}`
        : `Evidence ready: ${task.objective}`,
    state: terminalFailure ? "terminal_failure" : insufficient ? "research_insufficient" : "ready_for_review",
    retainedSourceRef: sourceRetainedRef(result),
    recoveryActions: terminalFailure
      ? ["retry_synthesis", "import_manual_result", "defer_as_known_risk"]
      : insufficient
        ? ["import_manual_result", "defer_as_known_risk"]
        : []
  };
}

function taskStatusForMatrix(matrix: EvidenceMatrixProjection): ResearchTaskProjection["status"] {
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

  return {
    researchResultId: input.researchResultId,
    researchTaskId: input.researchTaskId,
    ...(sourceTitle ? { sourceTitle } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    resultSummary: normalizeResultText(input.result, "Manual research result"),
    ...(limitationNotes ? { limitationNotes } : {}),
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
  version: ProjectionVersion
): ResearchEvidenceProjection {
  const updatedTask = {
    ...task,
    status: taskStatusForMatrix(matrix)
  };
  const tasks = mergeById(projection.tasks, updatedTask, (item) => item.researchTaskId);
  const results = mergeById(projection.results, result, (item) => item.researchResultId);
  const evidenceMatrices = mergeById(projection.evidenceMatrices, matrix, (item) => item.evidenceMatrixId);
  const reviewCards = mergeById(
    projection.reviewCards,
    reviewCardForMatrix(updatedTask, result, matrix),
    (item) => item.cardId
  );
  const knownRisks = uniqueValues([...projection.knownRisks, ...(matrix.knownRisk ? [matrix.knownRisk] : [])]);

  return {
    ...projection,
    version,
    taskIds: tasks.map((item) => item.researchTaskId),
    tasks,
    results,
    evidenceMatrices,
    reviewCards,
    knownRisks,
    nextValidationActions: uniqueValues([
      ...projection.nextValidationActions,
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
