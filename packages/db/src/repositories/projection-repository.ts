import { and, eq } from "drizzle-orm";
import type {
  DecisionQueueProjection,
  LivingSpecProjection,
  ProjectId,
  ProjectionVersion,
  SchemaVersion,
  SessionId,
  SessionShellProjection
} from "@solo-superman/contracts";
import type { SoloDatabaseExecutor } from "../client";
import { parseJsonRecord, stringifyJson } from "../json";
import { projections } from "../schema";

export type PersistedProjection = DecisionQueueProjection | LivingSpecProjection | SessionShellProjection;
export type PersistedProjectionKind = PersistedProjection["kind"];

export interface SaveProjectionInput<TProjection extends PersistedProjection = PersistedProjection> {
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
  readonly projection: TProjection;
  readonly schemaVersion: SchemaVersion;
  readonly updatedAt?: string;
}

function projectionId(sessionId: SessionId, projectionKind: PersistedProjectionKind) {
  return `${sessionId}:${projectionKind}`;
}

function projectionVersion(projection: PersistedProjection) {
  return Number(projection.version as ProjectionVersion);
}

function mapProjection(row: typeof projections.$inferSelect): PersistedProjection {
  return parseJsonRecord(row.payloadJson) as unknown as PersistedProjection;
}

export function createProjectionRepository(db: SoloDatabaseExecutor) {
  return {
    async save<TProjection extends PersistedProjection>(input: SaveProjectionInput<TProjection>): Promise<TProjection> {
      const updatedAt = input.updatedAt ?? new Date().toISOString();
      const id = projectionId(input.sessionId, input.projection.kind);

      await db
        .insert(projections)
        .values({
          id,
          projectId: input.projectId,
          sessionId: input.sessionId,
          projectionKind: input.projection.kind,
          version: projectionVersion(input.projection),
          payloadJson: stringifyJson(input.projection),
          updatedAt,
          schemaVersion: input.schemaVersion
        })
        .onConflictDoUpdate({
          target: projections.id,
          set: {
            version: projectionVersion(input.projection),
            payloadJson: stringifyJson(input.projection),
            updatedAt,
            schemaVersion: input.schemaVersion
          }
        });

      return input.projection;
    },

    async get<TProjection extends PersistedProjection = PersistedProjection>(
      sessionId: SessionId,
      projectionKind: PersistedProjectionKind
    ): Promise<TProjection | null> {
      const rows = await db
        .select()
        .from(projections)
        .where(and(eq(projections.sessionId, sessionId), eq(projections.projectionKind, projectionKind)))
        .limit(1);
      const row = rows[0];

      return row ? (mapProjection(row) as TProjection) : null;
    }
  };
}
