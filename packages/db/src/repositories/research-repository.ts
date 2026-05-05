import { eq } from "drizzle-orm";
import type {
  EvidenceItemProjection,
  EvidenceMatrixProjection,
  ProjectId,
  QueueItemId,
  ResearchEvidenceProjection,
  ResearchResultId,
  ResearchResultProjection,
  ResearchTaskId,
  ResearchTaskProjection,
  SchemaVersion,
  SessionId
} from "@solo-superman/contracts";
import type { SoloDatabaseExecutor } from "../client";
import { parseJsonArray, stringifyJson } from "../json";
import { evidenceMatrices, researchResults, researchTasks } from "../schema";

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
    ...(row.sourceTitle ? { sourceTitle: row.sourceTitle } : {}),
    ...(row.sourceUrl ? { sourceUrl: row.sourceUrl } : {}),
    resultSummary: row.resultSummary,
    ...(row.limitationNotes ? { limitationNotes: row.limitationNotes } : {}),
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
          sourceTitle: input.result.sourceTitle ?? null,
          sourceUrl: input.result.sourceUrl ?? null,
          resultSummary: input.result.resultSummary,
          limitationNotes: input.result.limitationNotes ?? null,
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

    async getTask(researchTaskId: ResearchTaskId): Promise<ResearchTaskProjection | null> {
      const rows = await db.select().from(researchTasks).where(eq(researchTasks.id, researchTaskId)).limit(1);
      const row = rows[0];

      return row ? mapTask(row) : null;
    },

    async getProjection(sessionId: SessionId): Promise<ResearchEvidenceProjection> {
      const [taskRows, resultRows, matrixRows] = await Promise.all([
        db.select().from(researchTasks).where(eq(researchTasks.sessionId, sessionId)),
        db.select().from(researchResults).where(eq(researchResults.sessionId, sessionId)),
        db.select().from(evidenceMatrices).where(eq(evidenceMatrices.sessionId, sessionId))
      ]);
      const tasks = taskRows.map(mapTask);
      const evidence = matrixRows.map(mapEvidenceMatrix);
      const knownRisks = evidence.flatMap((matrix) => (matrix.knownRisk ? [matrix.knownRisk] : []));

      return {
        kind: "ResearchEvidenceProjection",
        version: (tasks.length + resultRows.length + evidence.length) as ResearchEvidenceProjection["version"],
        taskIds: tasks.map((task) => task.researchTaskId),
        tasks,
        results: resultRows.map(mapResult),
        evidenceMatrices: evidence,
        reviewCards: [],
        knownRisks,
        nextValidationActions: knownRisks.map((risk) => `Validate: ${risk}`),
        proConBalanceStatus: evidence.at(-1)?.balanceStatus ?? "unknown"
      };
    }
  };
}
