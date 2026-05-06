import { eq } from "drizzle-orm";
import {
  assertPhase15bHintArtifactKind,
  type CodexArtifactKind,
  type Phase15bUpgradeHintRecord,
  type Phase15bUpgradeHints,
  type ProjectId,
  type RuntimeArtifactId,
  type SchemaVersion,
  type SessionId,
  validatePhase15bUpgradeHints
} from "@solo-superman/contracts";
import type { SoloDatabaseExecutor } from "../client";
import { parseJsonRecord, stringifyJson } from "../json";
import { phase15bUpgradeHints } from "../schema";

export interface SavePhase15bUpgradeHintInput {
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
  readonly artifactId: RuntimeArtifactId;
  readonly artifactKind: CodexArtifactKind;
  readonly hints: Phase15bUpgradeHints;
  readonly schemaVersion: SchemaVersion;
}

function phase15bHintIdForArtifact(artifactId: RuntimeArtifactId) {
  return `phase15b_hint:${artifactId}`;
}

function mapHintRecord(row: typeof phase15bUpgradeHints.$inferSelect): Phase15bUpgradeHintRecord {
  const hints = validatePhase15bUpgradeHints(parseJsonRecord(row.hintsJson, "phase15bUpgradeHints"));
  const artifactKind = row.artifactKind as CodexArtifactKind;

  assertPhase15bHintArtifactKind(artifactKind);

  return {
    hintId: row.id,
    projectId: row.projectId,
    sessionId: row.sessionId,
    artifactId: row.artifactId,
    artifactKind,
    hints,
    createdAt: row.createdAt,
    schemaVersion: row.schemaVersion as SchemaVersion
  };
}

export function createPhase15bUpgradeHintRepository(db: SoloDatabaseExecutor) {
  async function getForArtifact(artifactId: RuntimeArtifactId): Promise<Phase15bUpgradeHintRecord | null> {
    const rows = await db
      .select()
      .from(phase15bUpgradeHints)
      .where(eq(phase15bUpgradeHints.artifactId, artifactId))
      .limit(1);
    const row = rows[0];

    return row ? mapHintRecord(row) : null;
  }

  return {
    async saveForArtifact(input: SavePhase15bUpgradeHintInput): Promise<Phase15bUpgradeHintRecord> {
      assertPhase15bHintArtifactKind(input.artifactKind);
      const hints = validatePhase15bUpgradeHints(input.hints);
      const hintId = phase15bHintIdForArtifact(input.artifactId);
      const hintsJson = stringifyJson(hints);

      await db
        .insert(phase15bUpgradeHints)
        .values({
          id: hintId,
          projectId: input.projectId,
          sessionId: input.sessionId,
          artifactId: input.artifactId,
          artifactKind: input.artifactKind,
          blockedActionType: hints.riskNormalization.blockedActionType,
          riskLevel: hints.riskNormalization.riskLevel,
          hintsJson,
          createdAt: hints.createdAt,
          schemaVersion: input.schemaVersion
        })
        .onConflictDoUpdate({
          target: phase15bUpgradeHints.artifactId,
          set: {
            projectId: input.projectId,
            sessionId: input.sessionId,
            artifactKind: input.artifactKind,
            blockedActionType: hints.riskNormalization.blockedActionType,
            riskLevel: hints.riskNormalization.riskLevel,
            hintsJson,
            createdAt: hints.createdAt,
            schemaVersion: input.schemaVersion
          }
        });

      const saved = await getForArtifact(input.artifactId);

      if (!saved) {
        throw new Error(`Phase15bUpgradeHints were not persisted for artifact: ${input.artifactId}`);
      }

      return saved;
    },

    getForArtifact,

    async deleteForArtifact(artifactId: RuntimeArtifactId): Promise<void> {
      await db.delete(phase15bUpgradeHints).where(eq(phase15bUpgradeHints.artifactId, artifactId));
    },

    async listForSession(sessionId: SessionId): Promise<readonly Phase15bUpgradeHintRecord[]> {
      const rows = await db
        .select()
        .from(phase15bUpgradeHints)
        .where(eq(phase15bUpgradeHints.sessionId, sessionId))
        .orderBy(phase15bUpgradeHints.createdAt, phase15bUpgradeHints.id);

      return rows.map(mapHintRecord);
    }
  };
}
