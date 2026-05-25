import { eq } from "drizzle-orm";
import {
  derivePendingResearchReviewCardOutcomeMetadata,
  deriveResearchReviewCardOutcomeMetadata
} from "@solo-superman/contracts";
import type {
  DecisionEvidencePackId,
  DecisionEvidencePackProjection,
  EvidenceItemProjection,
  EvidenceItemId,
  EvidenceMatrixProjection,
  ProjectId,
  QueueItemId,
  ResearchEvidenceProjection,
  ResearchResultId,
  ResearchResultProjection,
  ResearchRunId,
  ResearchReviewCardProjection,
  ResearchQualityGateCheckProjection,
  ResearchTaskId,
  ResearchTaskProjection,
  SchemaVersion,
  SessionId
} from "@solo-superman/contracts";
import type { SoloDatabaseExecutor } from "../client";
import { parseJsonArray, stringifyJson } from "../json";
import { decisionEvidencePacks, evidenceMatrices, researchResults, researchTasks } from "../schema";

export interface SaveResearchTaskInput {
  readonly projectId: ProjectId;
  readonly task: ResearchTaskProjection;
  readonly schemaVersion: SchemaVersion;
  readonly updatedAt?: string;
}

export interface SaveResearchResultInput {
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
  readonly result: ResearchResultProjection;
  readonly schemaVersion: SchemaVersion;
}

export interface SaveEvidenceMatrixInput {
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
  readonly matrix: EvidenceMatrixProjection;
  readonly schemaVersion: SchemaVersion;
  readonly createdAt?: string;
}

export interface SaveDecisionEvidencePackInput {
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
  readonly pack: DecisionEvidencePackProjection;
  readonly schemaVersion: SchemaVersion;
}

function evidenceItemsFromJson(value: string): readonly EvidenceItemProjection[] {
  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON evidence item array.");
  }

  return parsed as readonly EvidenceItemProjection[];
}

function mapTask(row: typeof researchTasks.$inferSelect): ResearchTaskProjection {
  return {
    researchTaskId: row.id as ResearchTaskId,
    sessionId: row.sessionId as SessionId,
    ...(row.sourceQueueItemId ? { sourceQueueItemId: row.sourceQueueItemId as QueueItemId } : {}),
    ...(row.sourceAnswerRef ? { sourceAnswerRef: row.sourceAnswerRef } : {}),
    objective: row.objective,
    routeOutcome: row.routeOutcome as ResearchTaskProjection["routeOutcome"],
    impact: row.impact as ResearchTaskProjection["impact"],
    status: row.status as ResearchTaskProjection["status"],
    createdAt: row.createdAt
  };
}

function mapResult(row: typeof researchResults.$inferSelect): ResearchResultProjection {
  return {
    researchResultId: row.id as ResearchResultId,
    researchTaskId: row.researchTaskId as ResearchTaskId,
    ...(row.researchRunId ? { researchRunId: row.researchRunId as ResearchRunId } : {}),
    ...(row.sourceTitle ? { sourceTitle: row.sourceTitle } : {}),
    ...(row.sourceUrl ? { sourceUrl: row.sourceUrl } : {}),
    ...(row.sourceReliability
      ? { sourceReliability: row.sourceReliability as NonNullable<ResearchResultProjection["sourceReliability"]> }
      : {}),
    ...(row.sourcePublishedAt ? { sourcePublishedAt: row.sourcePublishedAt } : {}),
    ...(row.sourceRetrievedAt ? { sourceRetrievedAt: row.sourceRetrievedAt } : {}),
    resultSummary: row.resultSummary,
    ...(row.limitationNotes ? { limitationNotes: row.limitationNotes } : {}),
    ...(row.claim ? { claim: row.claim } : {}),
    ...(row.decisionContext ? { decisionContext: row.decisionContext } : {}),
    ...(row.specSectionRef ? { specSectionRef: row.specSectionRef } : {}),
    ...(row.questionRef ? { questionRef: row.questionRef } : {}),
    ...(row.implicationScope ? { implicationScope: row.implicationScope } : {}),
    ...(row.staleSensitive !== null ? { staleSensitive: row.staleSensitive } : {}),
    ...(row.sourceRequiredAfter ? { sourceRequiredAfter: row.sourceRequiredAfter } : {}),
    importedAt: row.importedAt
  };
}

function mapEvidenceMatrix(row: typeof evidenceMatrices.$inferSelect): EvidenceMatrixProjection {
  return {
    evidenceMatrixId: row.id,
    researchTaskId: row.researchTaskId as ResearchTaskId,
    researchResultId: row.researchResultId as ResearchResultId,
    synthesisVersion: row.synthesisVersion,
    proEvidence: evidenceItemsFromJson(row.proEvidenceJson),
    conEvidence: evidenceItemsFromJson(row.conEvidenceJson),
    uncertainties: evidenceItemsFromJson(row.uncertaintiesJson),
    additionalQuestions: parseJsonArray(row.additionalQuestionsJson, "additionalQuestionsJson").map(String),
    balanceStatus: row.balanceStatus as EvidenceMatrixProjection["balanceStatus"],
    decisionBlocked: row.decisionBlocked,
    ...(row.missingConEvidenceReason ? { missingConEvidenceReason: row.missingConEvidenceReason } : {}),
    ...(row.knownRisk ? { knownRisk: row.knownRisk } : {})
  };
}

function evidenceItemIdsFromJson(value: string, fieldName: string): readonly EvidenceItemId[] {
  return parseJsonArray(value, fieldName).map((item) => String(item) as EvidenceItemId);
}

function qualityGateChecksFromJson(value: string): readonly ResearchQualityGateCheckProjection[] {
  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("gateChecksJson must be a JSON array.");
  }

  return parsed as readonly ResearchQualityGateCheckProjection[];
}

function mapEvidencePack(row: typeof decisionEvidencePacks.$inferSelect): DecisionEvidencePackProjection {
  return {
    evidencePackId: row.id as DecisionEvidencePackId,
    researchTaskId: row.researchTaskId as ResearchTaskId,
    researchResultId: row.researchResultId as ResearchResultId,
    ...(row.researchRunId ? { researchRunId: row.researchRunId as ResearchRunId } : {}),
    claim: row.claim,
    decisionContext: row.decisionContext,
    ...(row.specSectionRef ? { specSectionRef: row.specSectionRef } : {}),
    ...(row.questionRef ? { questionRef: row.questionRef } : {}),
    ...(row.sourceTitle ? { sourceTitle: row.sourceTitle } : {}),
    ...(row.sourceUrl ? { sourceUrl: row.sourceUrl } : {}),
    sourceReliability: row.sourceReliability as DecisionEvidencePackProjection["sourceReliability"],
    ...(row.sourcePublishedAt ? { sourcePublishedAt: row.sourcePublishedAt } : {}),
    retrievedAt: row.retrievedAt,
    gateStatus: row.gateStatus as DecisionEvidencePackProjection["gateStatus"],
    gateChecks: qualityGateChecksFromJson(row.gateChecksJson),
    proEvidenceItemIds: evidenceItemIdsFromJson(row.proEvidenceItemIdsJson, "proEvidenceItemIdsJson"),
    conEvidenceItemIds: evidenceItemIdsFromJson(row.conEvidenceItemIdsJson, "conEvidenceItemIdsJson"),
    uncertaintyItemIds: evidenceItemIdsFromJson(row.uncertaintyItemIdsJson, "uncertaintyItemIdsJson"),
    limitationRefs: parseJsonArray(row.limitationRefsJson, "limitationRefsJson").map(String),
    implicationScope: row.implicationScope,
    ...(row.knownRisk ? { knownRisk: row.knownRisk } : {}),
    ...(row.nextValidationAction ? { nextValidationAction: row.nextValidationAction } : {}),
    createdAt: row.createdAt
  };
}

function sourceRetainedRef(
  result: ResearchResultProjection | undefined,
  pack: DecisionEvidencePackProjection
) {
  return result?.sourceUrl ?? result?.sourceTitle ?? pack.sourceUrl ?? pack.sourceTitle ?? pack.researchResultId;
}

function uniqueValues(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function primaryGateReviewReason(pack: DecisionEvidencePackProjection) {
  return (
    pack.gateChecks.find((check) => check.status === "failed") ??
    pack.gateChecks.find((check) => check.status === "unknown")
  )?.reason;
}

function pendingReviewCardForTask(task: ResearchTaskProjection): ResearchReviewCardProjection {
  const retainedSourceRef = task.sourceAnswerRef ?? task.sourceQueueItemId;
  const outcomeMetadata = derivePendingResearchReviewCardOutcomeMetadata();

  return {
    cardId: `research_review_${task.researchTaskId}` as QueueItemId,
    researchTaskId: task.researchTaskId,
    cardType: outcomeMetadata.cardType,
    title:
      task.routeOutcome === "missing_con_evidence"
        ? `다른 관점 확인 필요: ${task.objective}`
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

function reviewCardForEvidencePack(
  task: ResearchTaskProjection,
  result: ResearchResultProjection | undefined,
  matrix: EvidenceMatrixProjection | undefined,
  pack: DecisionEvidencePackProjection
): ResearchReviewCardProjection {
  const balanceStatus = matrix?.balanceStatus ?? "unknown";
  const terminalFailure = balanceStatus === "source_quality_insufficient";
  const insufficient =
    pack.gateStatus === "research_insufficient" ||
    balanceStatus === "missing_con_evidence" ||
    balanceStatus === "needs_con_evidence" ||
    balanceStatus === "blocked_by_con_evidence";
  const needsReview = pack.gateStatus === "needs_review";
  const stale = pack.gateStatus === "stale";
  const retainedSourceRef = sourceRetainedRef(result, pack);
  const questionRef = result?.questionRef ?? pack.questionRef;
  const specSectionRef = result?.specSectionRef ?? pack.specSectionRef;
  const outcomeMetadata = deriveResearchReviewCardOutcomeMetadata({
    impact: task.impact,
    gateStatus: pack.gateStatus,
    balanceStatus,
    hasAdditionalQuestions: Boolean(matrix?.additionalQuestions.length)
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
    retainedSourceRef,
    retainedSourceRefs: uniqueValues([
      retainedSourceRef,
      ...(pack.researchRunId ? [pack.researchRunId] : []),
      ...(questionRef ? [questionRef] : []),
      ...(specSectionRef ? [specSectionRef] : []),
      ...(pack.knownRisk ? [pack.knownRisk] : [])
    ]),
    ...(matrix?.additionalQuestions.length ? { additionalQuestions: matrix.additionalQuestions } : {}),
    availableOutcomes: outcomeMetadata.availableOutcomes,
    suggestedOutcome: outcomeMetadata.suggestedOutcome,
    blocksPlanning: task.impact === "high",
    recoveryActions: outcomeMetadata.recoveryActions
  };
}

function reviewCardsFromProjectionRows(
  tasks: readonly ResearchTaskProjection[],
  results: readonly ResearchResultProjection[],
  evidence: readonly EvidenceMatrixProjection[],
  packs: readonly DecisionEvidencePackProjection[]
) {
  return tasks.map((task) => {
    const pack = packs.filter((candidate) => candidate.researchTaskId === task.researchTaskId).at(-1);

    if (!pack) {
      return pendingReviewCardForTask(task);
    }

    return reviewCardForEvidencePack(
      task,
      results.find((result) => result.researchResultId === pack.researchResultId),
      evidence.find((matrix) => matrix.researchResultId === pack.researchResultId),
      pack
    );
  });
}

export function createResearchRepository(db: SoloDatabaseExecutor) {
  return {
    async saveTask(input: SaveResearchTaskInput): Promise<ResearchTaskProjection> {
      const updatedAt = input.updatedAt ?? input.task.createdAt;

      await db
        .insert(researchTasks)
        .values({
          id: input.task.researchTaskId,
          projectId: input.projectId,
          sessionId: input.task.sessionId,
          sourceQueueItemId: input.task.sourceQueueItemId ?? null,
          sourceAnswerRef: input.task.sourceAnswerRef ?? null,
          objective: input.task.objective,
          routeOutcome: input.task.routeOutcome,
          impact: input.task.impact,
          status: input.task.status,
          createdAt: input.task.createdAt,
          updatedAt,
          schemaVersion: input.schemaVersion
        })
        .onConflictDoUpdate({
          target: researchTasks.id,
          set: {
            objective: input.task.objective,
            routeOutcome: input.task.routeOutcome,
            impact: input.task.impact,
            status: input.task.status,
            updatedAt,
            schemaVersion: input.schemaVersion
          }
        });

      return input.task;
    },

    async saveResult(input: SaveResearchResultInput): Promise<ResearchResultProjection> {
      await db
        .insert(researchResults)
        .values({
          id: input.result.researchResultId,
          projectId: input.projectId,
          sessionId: input.sessionId,
          researchTaskId: input.result.researchTaskId,
          researchRunId: input.result.researchRunId ?? null,
          sourceTitle: input.result.sourceTitle ?? null,
          sourceUrl: input.result.sourceUrl ?? null,
          sourceReliability: input.result.sourceReliability ?? null,
          sourcePublishedAt: input.result.sourcePublishedAt ?? null,
          sourceRetrievedAt: input.result.sourceRetrievedAt ?? null,
          resultSummary: input.result.resultSummary,
          limitationNotes: input.result.limitationNotes ?? null,
          claim: input.result.claim ?? null,
          decisionContext: input.result.decisionContext ?? null,
          specSectionRef: input.result.specSectionRef ?? null,
          questionRef: input.result.questionRef ?? null,
          implicationScope: input.result.implicationScope ?? null,
          staleSensitive: input.result.staleSensitive ?? null,
          sourceRequiredAfter: input.result.sourceRequiredAfter ?? null,
          importedAt: input.result.importedAt,
          schemaVersion: input.schemaVersion
        })
        .onConflictDoNothing();

      return input.result;
    },

    async saveEvidenceMatrix(input: SaveEvidenceMatrixInput): Promise<EvidenceMatrixProjection> {
      const createdAt = input.createdAt ?? new Date().toISOString();

      await db
        .insert(evidenceMatrices)
        .values({
          id: input.matrix.evidenceMatrixId,
          projectId: input.projectId,
          sessionId: input.sessionId,
          researchTaskId: input.matrix.researchTaskId,
          researchResultId: input.matrix.researchResultId,
          synthesisVersion: input.matrix.synthesisVersion,
          balanceStatus: input.matrix.balanceStatus,
          proEvidenceJson: stringifyJson(input.matrix.proEvidence),
          conEvidenceJson: stringifyJson(input.matrix.conEvidence),
          uncertaintiesJson: stringifyJson(input.matrix.uncertainties),
          additionalQuestionsJson: stringifyJson(input.matrix.additionalQuestions),
          decisionBlocked: input.matrix.decisionBlocked,
          missingConEvidenceReason: input.matrix.missingConEvidenceReason ?? null,
          knownRisk: input.matrix.knownRisk ?? null,
          createdAt,
          schemaVersion: input.schemaVersion
        })
        .onConflictDoUpdate({
          target: [evidenceMatrices.researchResultId, evidenceMatrices.synthesisVersion],
          set: {
            balanceStatus: input.matrix.balanceStatus,
            proEvidenceJson: stringifyJson(input.matrix.proEvidence),
            conEvidenceJson: stringifyJson(input.matrix.conEvidence),
            uncertaintiesJson: stringifyJson(input.matrix.uncertainties),
            additionalQuestionsJson: stringifyJson(input.matrix.additionalQuestions),
            decisionBlocked: input.matrix.decisionBlocked,
            missingConEvidenceReason: input.matrix.missingConEvidenceReason ?? null,
            knownRisk: input.matrix.knownRisk ?? null,
            schemaVersion: input.schemaVersion
          }
        });

      return input.matrix;
    },

    async saveDecisionEvidencePack(input: SaveDecisionEvidencePackInput): Promise<DecisionEvidencePackProjection> {
      await db
        .insert(decisionEvidencePacks)
        .values({
          id: input.pack.evidencePackId,
          projectId: input.projectId,
          sessionId: input.sessionId,
          researchTaskId: input.pack.researchTaskId,
          researchResultId: input.pack.researchResultId,
          researchRunId: input.pack.researchRunId ?? null,
          claim: input.pack.claim,
          decisionContext: input.pack.decisionContext,
          specSectionRef: input.pack.specSectionRef ?? null,
          questionRef: input.pack.questionRef ?? null,
          sourceTitle: input.pack.sourceTitle ?? null,
          sourceUrl: input.pack.sourceUrl ?? null,
          sourceReliability: input.pack.sourceReliability,
          sourcePublishedAt: input.pack.sourcePublishedAt ?? null,
          retrievedAt: input.pack.retrievedAt,
          gateStatus: input.pack.gateStatus,
          gateChecksJson: stringifyJson(input.pack.gateChecks),
          proEvidenceItemIdsJson: stringifyJson(input.pack.proEvidenceItemIds),
          conEvidenceItemIdsJson: stringifyJson(input.pack.conEvidenceItemIds),
          uncertaintyItemIdsJson: stringifyJson(input.pack.uncertaintyItemIds),
          limitationRefsJson: stringifyJson(input.pack.limitationRefs),
          implicationScope: input.pack.implicationScope,
          knownRisk: input.pack.knownRisk ?? null,
          nextValidationAction: input.pack.nextValidationAction ?? null,
          createdAt: input.pack.createdAt,
          schemaVersion: input.schemaVersion
        })
        .onConflictDoUpdate({
          target: decisionEvidencePacks.id,
          set: {
            gateStatus: input.pack.gateStatus,
            gateChecksJson: stringifyJson(input.pack.gateChecks),
            proEvidenceItemIdsJson: stringifyJson(input.pack.proEvidenceItemIds),
            conEvidenceItemIdsJson: stringifyJson(input.pack.conEvidenceItemIds),
            uncertaintyItemIdsJson: stringifyJson(input.pack.uncertaintyItemIds),
            limitationRefsJson: stringifyJson(input.pack.limitationRefs),
            implicationScope: input.pack.implicationScope,
            knownRisk: input.pack.knownRisk ?? null,
            nextValidationAction: input.pack.nextValidationAction ?? null,
            schemaVersion: input.schemaVersion
          }
        });

      return input.pack;
    },

    async getTask(researchTaskId: ResearchTaskId): Promise<ResearchTaskProjection | null> {
      const rows = await db.select().from(researchTasks).where(eq(researchTasks.id, researchTaskId)).limit(1);
      const row = rows[0];

      return row ? mapTask(row) : null;
    },

    async getProjection(sessionId: SessionId): Promise<ResearchEvidenceProjection> {
      const [taskRows, resultRows, matrixRows, packRows] = await Promise.all([
        db.select().from(researchTasks).where(eq(researchTasks.sessionId, sessionId)),
        db.select().from(researchResults).where(eq(researchResults.sessionId, sessionId)),
        db.select().from(evidenceMatrices).where(eq(evidenceMatrices.sessionId, sessionId)),
        db.select().from(decisionEvidencePacks).where(eq(decisionEvidencePacks.sessionId, sessionId))
      ]);
      const tasks = taskRows.map(mapTask);
      const results = resultRows.map(mapResult);
      const evidence = matrixRows.map(mapEvidenceMatrix);
      const packs = packRows.map(mapEvidencePack);
      const knownRisks = [
        ...new Set([
          ...evidence.flatMap((matrix) => (matrix.knownRisk ? [matrix.knownRisk] : [])),
          ...packs.flatMap((pack) => (pack.knownRisk ? [pack.knownRisk] : []))
        ])
      ];
      const nextValidationActions = [
        ...new Set([
          ...packs.flatMap((pack) => (pack.nextValidationAction ? [pack.nextValidationAction] : [])),
          ...knownRisks.map((risk) => `Validate: ${risk}`)
        ])
      ];

      return {
        kind: "ResearchEvidenceProjection",
        version: (tasks.length + resultRows.length + evidence.length + packs.length) as ResearchEvidenceProjection["version"],
        taskIds: tasks.map((task) => task.researchTaskId),
        tasks,
        results,
        evidenceMatrices: evidence,
        evidencePacks: packs,
        reviewCards: reviewCardsFromProjectionRows(tasks, results, evidence, packs),
        knownRisks,
        nextValidationActions,
        proConBalanceStatus: evidence.at(-1)?.balanceStatus ?? "unknown"
      };
    }
  };
}
