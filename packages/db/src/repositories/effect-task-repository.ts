import { and, eq, inArray } from "drizzle-orm";
import type {
  CorrelationId,
  EffectErrorDto,
  EffectTaskDto,
  EffectTaskId,
  EffectTaskStatus,
  EffectType,
  CommandId,
  EventId,
  ProductEngineEvent,
  ProjectId,
  SchemaVersion
} from "@solo-superman/contracts";
import type { SoloDatabaseExecutor } from "../client";
import { parseJsonArray, parseJsonRecord, stringifyJson, type JsonRecord } from "../json";
import { effectTasks, events } from "../schema";

export interface CreateEffectTaskInput {
  readonly effectTaskId: EffectTaskId;
  readonly effectType: EffectType;
  readonly projectId: ProductEngineEvent["projectId"];
  readonly sessionId: ProductEngineEvent["sessionId"];
  readonly sourceEventId: EventId;
  readonly sourceEventIds: readonly EventId[];
  readonly sourceCommandId: ProductEngineEvent["sourceCommandId"];
  readonly correlationId: CorrelationId;
  readonly idempotencyKey: string;
  readonly maxAttempts: number;
  readonly input: JsonRecord;
  readonly schemaVersion: SchemaVersion;
  readonly queuedAt?: string;
}

export interface UpdateEffectTaskStatusInput {
  readonly effectTaskId: EffectTaskId;
  readonly status: EffectTaskStatus;
  readonly attemptCount?: number;
  readonly leaseOwner?: string | null;
  readonly leaseExpiresAt?: string | null;
  readonly output?: JsonRecord | null;
  readonly error?: EffectErrorDto | null;
  readonly updatedAt?: string;
}

export interface EffectTaskRecord extends EffectTaskDto {
  readonly projectId: ProjectId;
  readonly sessionId: ProductEngineEvent["sessionId"];
}

function mapEffectTask(row: typeof effectTasks.$inferSelect): EffectTaskDto {
  const error =
    (row.status === "failed" || row.status === "blocked") && row.lastErrorCode && row.lastErrorMessage
      ? {
          code: row.lastErrorCode,
          message: row.lastErrorMessage,
          retryAvailable: row.attemptCount < row.maxAttempts
        }
      : undefined;
  const outputRef = row.status === "succeeded" && row.outputJson
    ? {
        refType: "effect_output_json",
        refId: row.id
      }
    : undefined;

  return {
    effectTaskId: row.id as EffectTaskId,
    effectType: row.effectType as EffectType,
    status: row.status as EffectTaskStatus,
    sourceCommandId: row.sourceCommandId as EffectTaskDto["sourceCommandId"],
    sourceEventIds: parseJsonArray(row.sourceEventIdsJson) as readonly EventId[],
    correlationId: row.correlationId as CorrelationId,
    idempotencyKey: row.idempotencyKey,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    ...(outputRef ? { outputRef } : {}),
    ...(error ? { error } : {}),
    queuedAt: row.createdAt,
    updatedAt: row.updatedAt,
    schemaVersion: row.schemaVersion as SchemaVersion
  };
}

function mapEffectTaskRecord(row: typeof effectTasks.$inferSelect): EffectTaskRecord {
  return {
    ...mapEffectTask(row),
    projectId: row.projectId as ProjectId,
    sessionId: row.sessionId as ProductEngineEvent["sessionId"]
  };
}

function validateStatusPayload(input: UpdateEffectTaskStatusInput) {
  if (input.attemptCount !== undefined && (!Number.isInteger(input.attemptCount) || input.attemptCount < 0)) {
    throw new Error("attemptCount must be a non-negative integer.");
  }

  if ((input.status === "leased" || input.status === "running") && !hasLeaseMetadata(input)) {
    throw new Error("Leased or running effect tasks require lease metadata.");
  }

  if (input.status === "succeeded" && !input.output) {
    throw new Error("Succeeded effect tasks require output metadata.");
  }

  if ((input.status === "failed" || input.status === "blocked") && !input.error) {
    throw new Error("Failed or blocked effect tasks require error metadata.");
  }
}

function shouldClearLease(status: EffectTaskStatus) {
  return status !== "leased" && status !== "running";
}

function hasLeaseMetadata(input: UpdateEffectTaskStatusInput) {
  return Boolean(input.leaseOwner?.trim() && input.leaseExpiresAt?.trim());
}

function validateCreateEffectTaskInput(input: CreateEffectTaskInput) {
  if (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1) {
    throw new Error("maxAttempts must be a positive integer.");
  }
}

function normalizedSourceEventIds(input: CreateEffectTaskInput) {
  if (!input.sourceEventIds.includes(input.sourceEventId)) {
    throw new Error("sourceEventIds must include sourceEventId.");
  }

  return [...new Set(input.sourceEventIds)];
}

async function assertSourceEventsExist(
  db: SoloDatabaseExecutor,
  input: CreateEffectTaskInput,
  sourceEventIds: readonly EventId[]
) {
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.projectId, input.projectId),
        eq(events.sessionId, input.sessionId),
        inArray(events.id, sourceEventIds)
      )
    );

  if (rows.length !== sourceEventIds.length) {
    throw new Error("Effect task source events must exist before task persistence.");
  }
}

export function createEffectTaskRepository(db: SoloDatabaseExecutor) {
  async function get(effectTaskId: EffectTaskId): Promise<EffectTaskDto | null> {
    const rows = await db.select().from(effectTasks).where(eq(effectTasks.id, effectTaskId)).limit(1);
    const row = rows[0];

    return row ? mapEffectTask(row) : null;
  }

  return {
    async create(input: CreateEffectTaskInput): Promise<EffectTaskDto> {
      const queuedAt = input.queuedAt ?? new Date().toISOString();
      const sourceEventIds = normalizedSourceEventIds(input);

      validateCreateEffectTaskInput(input);
      await assertSourceEventsExist(db, input, sourceEventIds);

      await db.insert(effectTasks).values({
        id: input.effectTaskId,
        projectId: input.projectId,
        sessionId: input.sessionId,
        sourceEventId: input.sourceEventId,
        sourceEventIdsJson: stringifyJson(sourceEventIds),
        sourceCommandId: input.sourceCommandId,
        correlationId: input.correlationId,
        effectType: input.effectType,
        status: "queued",
        idempotencyKey: input.idempotencyKey,
        attemptCount: 0,
        maxAttempts: input.maxAttempts,
        inputJson: stringifyJson(input.input),
        createdAt: queuedAt,
        updatedAt: queuedAt,
        schemaVersion: input.schemaVersion
      });

      const task = await get(input.effectTaskId);

      if (!task) {
        throw new Error(`Effect task was not persisted: ${input.effectTaskId}`);
      }

      return task;
    },

    get,

    async getInput(effectTaskId: EffectTaskId): Promise<JsonRecord | null> {
      const rows = await db
        .select({ inputJson: effectTasks.inputJson })
        .from(effectTasks)
        .where(eq(effectTasks.id, effectTaskId))
        .limit(1);
      const row = rows[0];

      return row ? parseJsonRecord(row.inputJson) : null;
    },

    async findByIdempotencyKey(idempotencyKey: string): Promise<EffectTaskDto | null> {
      const rows = await db
        .select()
        .from(effectTasks)
        .where(eq(effectTasks.idempotencyKey, idempotencyKey))
        .limit(1);
      const row = rows[0];

      return row ? mapEffectTask(row) : null;
    },

    async listForCommand(commandId: CommandId): Promise<readonly EffectTaskDto[]> {
      const rows = await db.select().from(effectTasks).where(eq(effectTasks.sourceCommandId, commandId));

      return rows.map(mapEffectTask);
    },

    async listQueuedByType(effectType: EffectType): Promise<readonly EffectTaskRecord[]> {
      const rows = await db
        .select()
        .from(effectTasks)
        .where(and(eq(effectTasks.effectType, effectType), eq(effectTasks.status, "queued")));

      return rows.map(mapEffectTaskRecord);
    },

    async updateStatus(input: UpdateEffectTaskStatusInput): Promise<EffectTaskDto> {
      const updatedAt = input.updatedAt ?? new Date().toISOString();
      const isFailedOrBlocked = input.status === "failed" || input.status === "blocked";
      const clearsLease = shouldClearLease(input.status);
      const leaseOwner = input.leaseOwner !== undefined ? input.leaseOwner : clearsLease ? null : undefined;
      const leaseExpiresAt =
        input.leaseExpiresAt !== undefined ? input.leaseExpiresAt : clearsLease ? null : undefined;

      validateStatusPayload(input);
      const terminalError = isFailedOrBlocked ? input.error : null;

      await db
        .update(effectTasks)
        .set({
          status: input.status,
          ...(input.attemptCount !== undefined ? { attemptCount: input.attemptCount } : {}),
          ...(leaseOwner !== undefined ? { leaseOwner } : {}),
          ...(leaseExpiresAt !== undefined ? { leaseExpiresAt } : {}),
          outputJson: input.status === "succeeded" ? stringifyJson(input.output) : null,
          lastErrorCode: terminalError?.code ?? null,
          lastErrorMessage: terminalError?.message ?? null,
          updatedAt
        })
        .where(eq(effectTasks.id, input.effectTaskId));

      const task = await get(input.effectTaskId);

      if (!task) {
        throw new Error(`Effect task was not found after status update: ${input.effectTaskId}`);
      }

      return task;
    }
  };
}
