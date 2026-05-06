import { eq } from "drizzle-orm";
import {
  assertPhase15bHintArtifactKind,
  assertPhase15bUpgradeHintsMatchBlockedAction,
  validatePhase15bUpgradeHints
} from "@solo-superman/contracts";
import type {
  BlockedActionType,
  EffectTaskId,
  Phase15bUpgradeHints,
  ProjectionVersion,
  ProjectId,
  RuntimeActivityProjection,
  RuntimeArtifactId,
  RuntimePreviewArtifact,
  SchemaVersion,
  SessionId
} from "@solo-superman/contracts";
import type { SoloDatabaseExecutor } from "../client";
import { parseJsonArray, parseJsonRecord, stringifyJson } from "../json";
import { runtimePreviewArtifacts, runtimeTaskRefs } from "../schema";
import { createPhase15bUpgradeHintRepository } from "./phase15b-upgrade-hint-repository";

export interface SaveRuntimePreviewArtifactInput {
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
  readonly artifact: RuntimePreviewArtifact;
  readonly schemaVersion: SchemaVersion;
}

function mapArtifact(row: typeof runtimePreviewArtifacts.$inferSelect): RuntimePreviewArtifact {
  const blockedAction =
    row.blockedActionType && row.blockReason
      ? {
          actionType: row.blockedActionType as BlockedActionType,
          reason: row.blockReason,
          ...(row.suggestedSafeAlternative ? { suggestedSafeAlternative: row.suggestedSafeAlternative } : {})
        }
      : undefined;

  return {
    artifactId: row.id as RuntimeArtifactId,
    turnPurpose: row.turnPurpose as RuntimePreviewArtifact["turnPurpose"],
    kind: row.artifactKind as RuntimePreviewArtifact["kind"],
    applyPolicy: row.applyPolicy as RuntimePreviewArtifact["applyPolicy"],
    status: row.status as RuntimePreviewArtifact["status"],
    source: row.source as RuntimePreviewArtifact["source"],
    targetObject: row.targetObject,
    summary: row.summary,
    payload: parseJsonRecord(row.payloadJson),
    sourceRefs: parseJsonArray(row.sourceRefsJson, "sourceRefsJson").map(String),
    contextHash: row.contextHash,
    runtimeAdapterVersion: row.runtimeAdapterVersion,
    ...(row.sourceEffectTaskId ? { sourceEffectTaskId: row.sourceEffectTaskId as EffectTaskId } : {}),
    ...(blockedAction ? { blockedAction } : {}),
    createdAt: row.createdAt,
    schemaVersion: row.schemaVersion as SchemaVersion
  };
}

function projectionFromArtifacts(artifacts: readonly RuntimePreviewArtifact[]): RuntimeActivityProjection {
  const hasBlocked = artifacts.some((artifact) => artifact.status === "blocked");
  const hasUnavailable = artifacts.some((artifact) => artifact.status === "manual_handoff");

  return {
    kind: "RuntimeActivityProjection",
    version: artifacts.length as ProjectionVersion,
    effects: [],
    runtimeArtifacts: artifacts,
    runtimeStatus: hasBlocked ? "blocked" : hasUnavailable ? "unavailable" : artifacts.length ? "available" : "scaffold_placeholder"
  };
}

function phase15bHintsFromArtifact(artifact: RuntimePreviewArtifact): Phase15bUpgradeHints | null {
  const hints = artifact.payload.phase15bUpgradeHints;

  if (hints === undefined) {
    return null;
  }

  assertPhase15bHintArtifactKind(artifact.kind);

  const validatedHints = validatePhase15bUpgradeHints(hints);

  if (artifact.kind === "BlockedActionArtifact" && artifact.blockedAction) {
    assertPhase15bUpgradeHintsMatchBlockedAction(validatedHints, artifact.blockedAction.actionType);
  }

  return validatedHints;
}

export function createRuntimeRepository(db: SoloDatabaseExecutor) {
  const phase15bHintRepository = createPhase15bUpgradeHintRepository(db);

  async function getArtifact(artifactId: RuntimeArtifactId): Promise<RuntimePreviewArtifact | null> {
    const rows = await db
      .select()
      .from(runtimePreviewArtifacts)
      .where(eq(runtimePreviewArtifacts.id, artifactId))
      .limit(1);
    const row = rows[0];

    return row ? mapArtifact(row) : null;
  }

  async function listArtifactsForSession(sessionId: SessionId): Promise<readonly RuntimePreviewArtifact[]> {
    const rows = await db
      .select()
      .from(runtimePreviewArtifacts)
      .where(eq(runtimePreviewArtifacts.sessionId, sessionId));

    return rows.map(mapArtifact);
  }

  return {
    async saveArtifact(input: SaveRuntimePreviewArtifactInput): Promise<RuntimePreviewArtifact> {
      const { artifact } = input;
      const phase15bUpgradeHints = phase15bHintsFromArtifact(artifact);

      await db
        .insert(runtimePreviewArtifacts)
        .values({
          id: artifact.artifactId,
          projectId: input.projectId,
          sessionId: input.sessionId,
          sourceEffectTaskId: artifact.sourceEffectTaskId ?? null,
          turnPurpose: artifact.turnPurpose,
          artifactKind: artifact.kind,
          applyPolicy: artifact.applyPolicy,
          status: artifact.status,
          source: artifact.source,
          targetObject: artifact.targetObject,
          contextHash: artifact.contextHash,
          runtimeAdapterVersion: artifact.runtimeAdapterVersion,
          summary: artifact.summary,
          payloadJson: stringifyJson(artifact.payload),
          sourceRefsJson: stringifyJson(artifact.sourceRefs),
          blockedActionType: artifact.blockedAction?.actionType ?? null,
          blockReason: artifact.blockedAction?.reason ?? null,
          suggestedSafeAlternative: artifact.blockedAction?.suggestedSafeAlternative ?? null,
          createdAt: artifact.createdAt,
          schemaVersion: input.schemaVersion
        })
        .onConflictDoUpdate({
          target: runtimePreviewArtifacts.id,
          set: {
            sourceEffectTaskId: artifact.sourceEffectTaskId ?? null,
            artifactKind: artifact.kind,
            applyPolicy: artifact.applyPolicy,
            status: artifact.status,
            source: artifact.source,
            targetObject: artifact.targetObject,
            summary: artifact.summary,
            payloadJson: stringifyJson(artifact.payload),
            sourceRefsJson: stringifyJson(artifact.sourceRefs),
            blockedActionType: artifact.blockedAction?.actionType ?? null,
            blockReason: artifact.blockedAction?.reason ?? null,
            suggestedSafeAlternative: artifact.blockedAction?.suggestedSafeAlternative ?? null,
            schemaVersion: input.schemaVersion
          }
        });

      if (artifact.sourceEffectTaskId) {
        await db
          .insert(runtimeTaskRefs)
          .values({
            id: `${artifact.sourceEffectTaskId}:${artifact.artifactId}`,
            projectId: input.projectId,
            sessionId: input.sessionId,
            effectTaskId: artifact.sourceEffectTaskId,
            artifactId: artifact.artifactId,
            runtimeAdapterVersion: artifact.runtimeAdapterVersion,
            status: artifact.status,
            createdAt: artifact.createdAt,
            schemaVersion: input.schemaVersion
          })
          .onConflictDoUpdate({
            target: runtimeTaskRefs.id,
            set: {
              status: artifact.status,
              runtimeAdapterVersion: artifact.runtimeAdapterVersion,
              schemaVersion: input.schemaVersion
            }
          });
      }

      if (phase15bUpgradeHints) {
        await phase15bHintRepository.saveForArtifact({
          projectId: input.projectId,
          sessionId: input.sessionId,
          artifactId: artifact.artifactId,
          artifactKind: artifact.kind,
          hints: phase15bUpgradeHints,
          schemaVersion: input.schemaVersion
        });
      } else {
        await phase15bHintRepository.deleteForArtifact(artifact.artifactId);
      }

      const saved = await getArtifact(artifact.artifactId);

      if (!saved) {
        throw new Error(`RuntimePreviewArtifact was not persisted: ${artifact.artifactId}`);
      }

      return saved;
    },

    getArtifact,

    listArtifactsForSession,

    async getProjection(sessionId: SessionId): Promise<RuntimeActivityProjection> {
      return projectionFromArtifacts(await listArtifactsForSession(sessionId));
    }
  };
}
