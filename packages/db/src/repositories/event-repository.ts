import { desc, eq } from "drizzle-orm";
import type { CommandId, EventId, ProductEngineEvent, ProductEngineEventDraft, SessionId } from "@solo-superman/contracts";
import type { SoloDatabase, SoloDatabaseExecutor, SoloDatabaseTransaction } from "../client";
import { parseJsonRecord, stringifyJson } from "../json";
import { events } from "../schema";

export interface AppendEventInput extends ProductEngineEventDraft {
  readonly eventId: EventId;
  readonly occurredAt?: string;
}

function mapEvent(row: typeof events.$inferSelect): ProductEngineEvent {
  return {
    eventId: row.id as EventId,
    sequence: row.sequence,
    eventType: row.eventType as ProductEngineEvent["eventType"],
    projectId: row.projectId as ProductEngineEvent["projectId"],
    sessionId: row.sessionId as ProductEngineEvent["sessionId"],
    sourceCommandId: row.sourceCommandId as ProductEngineEvent["sourceCommandId"],
    correlationId: row.correlationId as ProductEngineEvent["correlationId"],
    causationId: row.causationId as ProductEngineEvent["causationId"],
    schemaVersion: row.schemaVersion as ProductEngineEvent["schemaVersion"],
    payload: parseJsonRecord(row.payloadJson),
    occurredAt: row.createdAt
  };
}

async function nextSequence(db: SoloDatabaseExecutor, sessionId: SessionId) {
  const rows = await db
    .select({ sequence: events.sequence })
    .from(events)
    .where(eq(events.sessionId, sessionId))
    .orderBy(desc(events.sequence))
    .limit(1);
  const row = rows[0];

  return row ? row.sequence + 1 : 1;
}

export function createEventRepository(db: SoloDatabaseExecutor) {
  return {
    async append(input: AppendEventInput): Promise<ProductEngineEvent> {
      const occurredAt = input.occurredAt ?? new Date().toISOString();
      const sequence = await nextSequence(db, input.sessionId);

      await db.insert(events).values({
        id: input.eventId,
        sequence,
        projectId: input.projectId,
        sessionId: input.sessionId,
        eventType: input.eventType,
        sourceCommandId: input.sourceCommandId,
        causationId: input.causationId,
        correlationId: input.correlationId,
        payloadJson: stringifyJson(input.payload),
        schemaVersion: input.schemaVersion,
        createdAt: occurredAt
      });

      return {
        ...input,
        sequence,
        occurredAt
      };
    },

    async listForSession(sessionId: SessionId): Promise<readonly ProductEngineEvent[]> {
      const rows = await db.select().from(events).where(eq(events.sessionId, sessionId)).orderBy(events.sequence);

      return rows.map(mapEvent);
    },

    async listForCommand(commandId: CommandId): Promise<readonly ProductEngineEvent[]> {
      const rows = await db
        .select()
        .from(events)
        .where(eq(events.sourceCommandId, commandId))
        .orderBy(events.sequence);

      return rows.map(mapEvent);
    }
  };
}

export async function persistDerivedStateAfterEvent<TResult>(
  db: SoloDatabase,
  eventInput: AppendEventInput,
  writeDerivedState: (transaction: SoloDatabaseTransaction, event: ProductEngineEvent) => Promise<TResult>
): Promise<{ readonly event: ProductEngineEvent; readonly derivedState: TResult }> {
  return db.transaction(async (transaction) => {
    const event = await createEventRepository(transaction).append(eventInput);
    const derivedState = await writeDerivedState(transaction, event);

    return { event, derivedState };
  });
}
