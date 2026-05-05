import { and, eq } from "drizzle-orm";
import type {
  AutomaticResearchSourceCategory,
  BackgroundResearchAdapterKind,
  ProjectId,
  ProjectionVersion,
  ResearchAllowlistId,
  ResearchConnectorId,
  ResearchDisclosureLogId,
  ResearchRunId,
  ResearchRunProjection,
  ResearchRunQualityGateStatus,
  ResearchRunStatus,
  ResearchRunTerminalReason,
  ResearchTaskId,
  SchemaVersion
} from "@solo-superman/contracts";
import {
  assertResearchRunStatusTransition,
  canCreateManualResearchRunRetry,
  validateResearchRunProjection
} from "@solo-superman/contracts";
import type { SoloDatabaseExecutor } from "../client";
import { parseJsonArray, stringifyJson } from "../json";
import { researchRuns } from "../schema";

export interface SaveResearchRunInput {
  readonly run: ResearchRunProjection;
  readonly schemaVersion: SchemaVersion;
}

export interface UpdateResearchRunInput extends SaveResearchRunInput {
  readonly expectedVersion: ProjectionVersion;
}

function researchRunRowValues(run: ResearchRunProjection, schemaVersion: SchemaVersion) {
  return {
    id: run.researchRunId,
    version: run.version,
    projectId: run.projectId,
    researchTaskId: run.researchTaskId,
    allowlistId: run.allowlistId,
    disclosureLogId: run.disclosureLogId,
    connectorId: run.connectorId,
    sourceCategory: run.sourceCategory,
    status: run.status,
    adapterKind: run.provider.adapterKind,
    adapterVersion: run.provider.adapterVersion,
    providerRunId: run.provider.providerRunId ?? null,
    idempotencyKey: run.provider.idempotencyKey,
    attempt: run.provider.attempt,
    qualityGateStatus: run.qualityGateStatus,
    terminalReason: run.terminalReason ?? null,
    retryOfRunId: run.retryOfRunId ?? null,
    retryReason: run.retryReason ?? null,
    sourceRefsJson: stringifyJson(run.sourceRefs),
    startedAt: run.provider.startedAt ?? null,
    completedAt: run.provider.completedAt ?? null,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    schemaVersion
  };
}

function mapResearchRun(row: typeof researchRuns.$inferSelect): ResearchRunProjection {
  const researchRunId = row.id as ResearchRunId;
  const researchTaskId = row.researchTaskId as ResearchTaskId;
  const sourceCategory = row.sourceCategory as AutomaticResearchSourceCategory;
  const run = {
    kind: "ResearchRunProjection",
    version: row.version as ProjectionVersion,
    researchRunId,
    projectId: row.projectId as ProjectId,
    researchTaskId,
    allowlistId: row.allowlistId as ResearchAllowlistId,
    disclosureLogId: row.disclosureLogId as ResearchDisclosureLogId,
    connectorId: row.connectorId as ResearchConnectorId,
    sourceCategory,
    status: row.status as ResearchRunStatus,
    provider: {
      researchRunId,
      researchTaskId,
      adapterKind: row.adapterKind as BackgroundResearchAdapterKind,
      adapterVersion: row.adapterVersion,
      ...(row.providerRunId ? { providerRunId: row.providerRunId } : {}),
      sourceCategory,
      idempotencyKey: row.idempotencyKey,
      ...(row.startedAt ? { startedAt: row.startedAt } : {}),
      ...(row.completedAt ? { completedAt: row.completedAt } : {}),
      attempt: row.attempt
    },
    qualityGateStatus: row.qualityGateStatus as ResearchRunQualityGateStatus,
    sourceRefs: parseJsonArray(row.sourceRefsJson, "sourceRefsJson").map(String),
    ...(row.terminalReason ? { terminalReason: row.terminalReason as ResearchRunTerminalReason } : {}),
    ...(row.retryOfRunId ? { retryOfRunId: row.retryOfRunId as ResearchRunId } : {}),
    ...(row.retryReason ? { retryReason: row.retryReason } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  } as ResearchRunProjection;

  return validateResearchRunProjection(run);
}

function assertStableField(fieldName: string, current: unknown, next: unknown) {
  if (current !== next) {
    throw new Error(`research run ${fieldName} cannot change after creation.`);
  }
}

function assertStableOptionalField(fieldName: string, current: string | undefined, next: string | undefined) {
  if (current !== undefined && current !== next) {
    throw new Error(`research run ${fieldName} cannot change after being captured.`);
  }
}

function assertUpdateKeepsRunIdentity(current: ResearchRunProjection, next: ResearchRunProjection) {
  assertStableField("projectId", current.projectId, next.projectId);
  assertStableField("researchTaskId", current.researchTaskId, next.researchTaskId);
  assertStableField("allowlistId", current.allowlistId, next.allowlistId);
  assertStableField("disclosureLogId", current.disclosureLogId, next.disclosureLogId);
  assertStableField("connectorId", current.connectorId, next.connectorId);
  assertStableField("sourceCategory", current.sourceCategory, next.sourceCategory);
  assertStableField("provider.adapterKind", current.provider.adapterKind, next.provider.adapterKind);
  assertStableField("provider.adapterVersion", current.provider.adapterVersion, next.provider.adapterVersion);
  assertStableField("provider.idempotencyKey", current.provider.idempotencyKey, next.provider.idempotencyKey);
  assertStableField("provider.attempt", current.provider.attempt, next.provider.attempt);
  assertStableField("createdAt", current.createdAt, next.createdAt);
  assertStableField("retryOfRunId", current.retryOfRunId, next.retryOfRunId);
  assertStableField("retryReason", current.retryReason, next.retryReason);
  assertStableOptionalField("provider.providerRunId", current.provider.providerRunId, next.provider.providerRunId);
  assertStableOptionalField("provider.startedAt", current.provider.startedAt, next.provider.startedAt);
  assertStableOptionalField("provider.completedAt", current.provider.completedAt, next.provider.completedAt);
}

function assertNextProjectionVersion(current: ResearchRunProjection, next: ResearchRunProjection) {
  if (next.version !== current.version + 1) {
    throw new Error("research run version must increment exactly once on update.");
  }
}

export function createResearchRunRepository(db: SoloDatabaseExecutor) {
  async function getById(projectId: ProjectId, researchRunId: ResearchRunId): Promise<ResearchRunProjection | null> {
    const rows = await db
      .select()
      .from(researchRuns)
      .where(and(eq(researchRuns.projectId, projectId), eq(researchRuns.id, researchRunId)))
      .limit(1);
    const row = rows[0];

    return row ? mapResearchRun(row) : null;
  }

  async function getByRunId(researchRunId: ResearchRunId): Promise<ResearchRunProjection | null> {
    const rows = await db.select().from(researchRuns).where(eq(researchRuns.id, researchRunId)).limit(1);
    const row = rows[0];

    return row ? mapResearchRun(row) : null;
  }

  async function getByProjectIdAndIdempotencyKey(
    projectId: ProjectId,
    idempotencyKey: string
  ): Promise<ResearchRunProjection | null> {
    const rows = await db
      .select()
      .from(researchRuns)
      .where(and(eq(researchRuns.projectId, projectId), eq(researchRuns.idempotencyKey, idempotencyKey)))
      .limit(1);
    const row = rows[0];

    return row ? mapResearchRun(row) : null;
  }

  async function assertRetrySourceIsRetryable(run: ResearchRunProjection) {
    if (!run.retryOfRunId) {
      return;
    }

    const priorRun = await getById(run.projectId, run.retryOfRunId);

    if (!priorRun || !canCreateManualResearchRunRetry(priorRun.status)) {
      throw new Error("manual retry runs must reference a prior failed, stale, or research_insufficient run.");
    }

    if (priorRun.researchTaskId !== run.researchTaskId) {
      throw new Error("manual retry runs must reference a prior run from the same research task.");
    }

    if (run.provider.attempt !== priorRun.provider.attempt + 1) {
      throw new Error("manual retry attempts must increment exactly once from the prior run.");
    }
  }

  async function recoverIdempotentCreateConflict(run: ResearchRunProjection): Promise<ResearchRunProjection | null> {
    const [existingByRunId, existingByIdempotencyKey] = await Promise.all([
      getByRunId(run.researchRunId),
      getByProjectIdAndIdempotencyKey(run.projectId, run.provider.idempotencyKey)
    ]);

    if (existingByRunId && existingByRunId.provider.idempotencyKey !== run.provider.idempotencyKey) {
      return null;
    }

    if (
      existingByRunId &&
      existingByIdempotencyKey &&
      existingByRunId.researchRunId !== existingByIdempotencyKey.researchRunId
    ) {
      return null;
    }

    return existingByIdempotencyKey;
  }

  return {
    async create(input: SaveResearchRunInput): Promise<ResearchRunProjection | null> {
      const run = validateResearchRunProjection(input.run);
      await assertRetrySourceIsRetryable(run);
      const rows = await db
        .insert(researchRuns)
        .values(researchRunRowValues(run, input.schemaVersion))
        .onConflictDoNothing()
        .returning();

      return rows[0] ? mapResearchRun(rows[0]) : recoverIdempotentCreateConflict(run);
    },

    async update(input: UpdateResearchRunInput): Promise<ResearchRunProjection | null> {
      const run = validateResearchRunProjection(input.run);
      const current = await getById(run.projectId, run.researchRunId);

      if (!current) {
        return null;
      }

      if (current.version !== input.expectedVersion) {
        return null;
      }

      assertNextProjectionVersion(current, run);
      assertUpdateKeepsRunIdentity(current, run);
      assertResearchRunStatusTransition(current.status, run.status);
      const rowValues = researchRunRowValues(run, input.schemaVersion);
      const rows = await db
        .update(researchRuns)
        .set({
          version: rowValues.version,
          status: rowValues.status,
          providerRunId: rowValues.providerRunId,
          qualityGateStatus: rowValues.qualityGateStatus,
          terminalReason: rowValues.terminalReason,
          sourceRefsJson: rowValues.sourceRefsJson,
          startedAt: rowValues.startedAt,
          completedAt: rowValues.completedAt,
          updatedAt: rowValues.updatedAt,
          schemaVersion: rowValues.schemaVersion
        })
        .where(
          and(
            eq(researchRuns.projectId, run.projectId),
            eq(researchRuns.id, run.researchRunId),
            eq(researchRuns.version, input.expectedVersion)
          )
        )
        .returning();

      return rows[0] ? mapResearchRun(rows[0]) : null;
    },

    getById,
    getByProjectIdAndIdempotencyKey,

    async listForProject(projectId: ProjectId): Promise<readonly ResearchRunProjection[]> {
      const rows = await db
        .select()
        .from(researchRuns)
        .where(eq(researchRuns.projectId, projectId))
        .orderBy(researchRuns.createdAt, researchRuns.id);

      return rows.map(mapResearchRun);
    },

    async listForResearchTask(researchTaskId: ResearchTaskId): Promise<readonly ResearchRunProjection[]> {
      const rows = await db
        .select()
        .from(researchRuns)
        .where(eq(researchRuns.researchTaskId, researchTaskId))
        .orderBy(researchRuns.attempt, researchRuns.createdAt, researchRuns.id);

      return rows.map(mapResearchRun);
    }
  };
}
