import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type {
  CommandId,
  EventId,
  Phase25ResearchComparisonProjection,
  Phase25ResearchQualityComparisonReportDto,
  Phase25SourceRefDto,
  ProjectId,
  SchemaVersion,
  SessionId,
  StateVersion
} from "@solo-superman/contracts";
import type { SoloDatabaseExecutor } from "../client";
import { parseJsonRecord, stringifyJson } from "../json";
import { phase25ResearchComparisonSources, phase25ResearchComparisons } from "../schema";

export interface SavePhase25ResearchComparisonProjectionInput {
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
  readonly sourceCommandId: CommandId;
  readonly sourceEventId: EventId;
  readonly sourceStateVersion: StateVersion;
  readonly projection: Phase25ResearchComparisonProjection;
}

function shortHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function sourceRowId(comparisonId: string, sourceRef: Phase25SourceRefDto) {
  return `phase25_src_${shortHash(`${comparisonId}:${sourceRef.sourceType}:${sourceRef.sourceId}`)}`;
}

function assertComparisonId(comparisonId: string) {
  if (!comparisonId.startsWith("phase25_cmp_")) {
    throw new Error(`Phase 2.5 comparison id must use the phase25_cmp_ prefix: ${comparisonId}`);
  }
}

function projectionFromRow(row: typeof phase25ResearchComparisons.$inferSelect): Phase25ResearchComparisonProjection {
  const artifact = parseJsonRecord<Phase25ResearchQualityComparisonReportDto>(
    row.artifactJson,
    "phase25_research_comparisons.artifact_json"
  );

  return {
    kind: "Phase25ResearchComparisonProjection",
    sessionId: row.sessionId as SessionId,
    version: (row.sourceStateVersion + 1) as Phase25ResearchComparisonProjection["version"],
    currentStatus: artifact.status,
    artifact,
    sourceRefs: artifact.sourceRefs,
    summary: row.summary,
    refetchUrl: `/api/v1/sessions/${row.sessionId}/phase25/research-comparison`
  };
}

function sourceRowsFor(comparisonId: string, sourceRefs: readonly Phase25SourceRefDto[], createdAt: string) {
  return sourceRefs.map((sourceRef) => ({
    id: sourceRowId(comparisonId, sourceRef),
    comparisonId,
    sourceType: sourceRef.sourceType,
    sourceId: sourceRef.sourceId,
    sourceLabel: sourceRef.sourceLabel ?? null,
    required: sourceRef.required,
    stale: sourceRef.stale,
    createdAt
  }));
}

export function createPhase25ResearchComparisonRepository(db: SoloDatabaseExecutor) {
  async function getProjectionById(comparisonId: string): Promise<Phase25ResearchComparisonProjection | null> {
    const rows = await db
      .select()
      .from(phase25ResearchComparisons)
      .where(eq(phase25ResearchComparisons.id, comparisonId))
      .limit(1);
    const row = rows[0];

    return row ? projectionFromRow(row) : null;
  }

  async function insertComparisonRow(input: SavePhase25ResearchComparisonProjectionInput): Promise<boolean> {
    const artifact = input.projection.artifact;
    const rows = await db
      .insert(phase25ResearchComparisons)
      .values({
        id: artifact.artifactId,
        projectId: input.projectId,
        sessionId: input.sessionId,
        sourceCommandId: input.sourceCommandId,
        sourceEventId: input.sourceEventId,
        status: artifact.status,
        gateVerdict: artifact.delegationRiskGate.verdict,
        candidateLane: artifact.candidateLane,
        qualityLiftClaimed: artifact.qualityLiftClaimed,
        sourceStateVersion: Number(input.sourceStateVersion),
        summary: input.projection.summary,
        artifactJson: stringifyJson(artifact),
        createdBy: artifact.createdBy,
        createdAt: artifact.createdAt,
        schemaVersion: artifact.schemaVersion as SchemaVersion
      })
      .onConflictDoNothing({ target: phase25ResearchComparisons.id })
      .returning({ id: phase25ResearchComparisons.id });

    return Boolean(rows[0]);
  }

  async function saveRows(input: SavePhase25ResearchComparisonProjectionInput) {
    const artifact = input.projection.artifact;
    const comparisonId = artifact.artifactId;

    assertComparisonId(comparisonId);

    const inserted = await insertComparisonRow(input);

    if (!inserted) {
      const existingProjection = await getProjectionById(comparisonId);

      if (!existingProjection) {
        throw new Error(`Phase 2.5 comparison idempotent insert conflicted but ${comparisonId} was not found.`);
      }

      return existingProjection;
    }

    const sourceRows = sourceRowsFor(comparisonId, artifact.sourceRefs, artifact.createdAt);

    if (sourceRows.length) {
      await db.insert(phase25ResearchComparisonSources).values(sourceRows);
    }

    return input.projection;
  }

  return {
    async saveFromProjection(
      input: SavePhase25ResearchComparisonProjectionInput
    ): Promise<Phase25ResearchComparisonProjection> {
      return saveRows(input);
    },

    async getById(comparisonId: string): Promise<Phase25ResearchComparisonProjection | null> {
      return getProjectionById(comparisonId);
    },

    async getLatestForSession(sessionId: SessionId): Promise<Phase25ResearchComparisonProjection | null> {
      const rows = await db
        .select()
        .from(phase25ResearchComparisons)
        .where(eq(phase25ResearchComparisons.sessionId, sessionId))
        .orderBy(desc(phase25ResearchComparisons.createdAt), desc(phase25ResearchComparisons.id))
        .limit(1);
      const row = rows[0];

      return row ? projectionFromRow(row) : null;
    },

    async getForSourceCommand(commandId: CommandId): Promise<Phase25ResearchComparisonProjection | null> {
      const rows = await db
        .select()
        .from(phase25ResearchComparisons)
        .where(eq(phase25ResearchComparisons.sourceCommandId, commandId))
        .limit(1);
      const row = rows[0];

      return row ? projectionFromRow(row) : null;
    },

    async hasSourceRef(comparisonId: string, sourceType: string, sourceId: string): Promise<boolean> {
      const rows = await db
        .select({ id: phase25ResearchComparisonSources.id })
        .from(phase25ResearchComparisonSources)
        .where(
          and(
            eq(phase25ResearchComparisonSources.comparisonId, comparisonId),
            eq(phase25ResearchComparisonSources.sourceType, sourceType),
            eq(phase25ResearchComparisonSources.sourceId, sourceId)
          )
        )
        .limit(1);

      return Boolean(rows[0]);
    }
  };
}
