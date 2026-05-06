import { eq } from "drizzle-orm";
import {
  assertPhase15bHintArtifactKind,
  type CodexArtifactKind,
  type Phase15bUpgradeHintRecord,
  type Phase15bUpgradeHints,
  type ProjectionVersion,
  type ProjectId,
  type RuntimeArtifactId,
  type SchemaVersion,
  type SessionId,
  validatePhase15bUpgradeHints
} from "@solo-superman/contracts";
import type { SoloDatabaseExecutor } from "../client";
import { parseJsonRecord, stringifyJson } from "../json";
import { appConfig, phase15bUpgradeHints } from "../schema";

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

function phase15bCollectionVersionKey(projectId: ProjectId) {
  return `phase15b_upgrade_hints_collection_version:${projectId}`;
}

function collectionVersionJson(version: number) {
  return stringifyJson({ version });
}

function readCollectionVersion(valueJson: string | undefined) {
  if (!valueJson) {
    return 0;
  }

  const value = parseJsonRecord(valueJson, "phase15bUpgradeHintCollectionVersion");
  const version = value.version;

  return typeof version === "number" && Number.isSafeInteger(version) && version >= 0 ? version : 0;
}

async function countProjectHintRecords(db: SoloDatabaseExecutor, projectId: ProjectId) {
  const rows = await db
    .select({ id: phase15bUpgradeHints.id })
    .from(phase15bUpgradeHints)
    .where(eq(phase15bUpgradeHints.projectId, projectId));

  return rows.length;
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

  async function persistCollectionVersion(projectId: ProjectId, version: number): Promise<ProjectionVersion> {
    const updatedAt = new Date().toISOString();

    await db
      .insert(appConfig)
      .values({
        key: phase15bCollectionVersionKey(projectId),
        valueJson: collectionVersionJson(version),
        updatedAt
      })
      .onConflictDoUpdate({
        target: appConfig.key,
        set: {
          valueJson: collectionVersionJson(version),
          updatedAt
        }
      });

    return version as ProjectionVersion;
  }

  async function collectionVersion(projectId: ProjectId): Promise<ProjectionVersion> {
    const rows = await db
      .select({ valueJson: appConfig.valueJson })
      .from(appConfig)
      .where(eq(appConfig.key, phase15bCollectionVersionKey(projectId)))
      .limit(1);
    const row = rows[0];

    if (row) {
      return readCollectionVersion(row.valueJson) as ProjectionVersion;
    }

    return persistCollectionVersion(projectId, await countProjectHintRecords(db, projectId));
  }

  async function bumpCollectionVersion(
    projectId: ProjectId,
    versionBefore: ProjectionVersion
  ): Promise<ProjectionVersion> {
    return persistCollectionVersion(projectId, Number(versionBefore) + 1);
  }

  return {
    async saveForArtifact(input: SavePhase15bUpgradeHintInput): Promise<Phase15bUpgradeHintRecord> {
      assertPhase15bHintArtifactKind(input.artifactKind);
      const hints = validatePhase15bUpgradeHints(input.hints);
      const hintId = phase15bHintIdForArtifact(input.artifactId);
      const hintsJson = stringifyJson(hints);
      const existing = await getForArtifact(input.artifactId);
      const versionBefore = await collectionVersion(input.projectId);
      const previousProjectVersionBefore =
        existing && existing.projectId !== input.projectId
          ? await collectionVersion(existing.projectId as ProjectId)
          : null;

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

      await bumpCollectionVersion(input.projectId, versionBefore);

      if (previousProjectVersionBefore !== null && existing) {
        await bumpCollectionVersion(existing.projectId as ProjectId, previousProjectVersionBefore);
      }

      return saved;
    },

    getForArtifact,

    collectionVersion,

    async deleteForArtifact(artifactId: RuntimeArtifactId): Promise<void> {
      const existing = await getForArtifact(artifactId);
      const versionBefore = existing ? await collectionVersion(existing.projectId as ProjectId) : null;

      await db.delete(phase15bUpgradeHints).where(eq(phase15bUpgradeHints.artifactId, artifactId));

      if (existing && versionBefore !== null) {
        await bumpCollectionVersion(existing.projectId as ProjectId, versionBefore);
      }
    },

    async listForSession(sessionId: SessionId): Promise<readonly Phase15bUpgradeHintRecord[]> {
      const rows = await db
        .select()
        .from(phase15bUpgradeHints)
        .where(eq(phase15bUpgradeHints.sessionId, sessionId))
        .orderBy(phase15bUpgradeHints.createdAt, phase15bUpgradeHints.id);

      return rows.map(mapHintRecord);
    },

    async listForProject(projectId: ProjectId): Promise<readonly Phase15bUpgradeHintRecord[]> {
      const rows = await db
        .select()
        .from(phase15bUpgradeHints)
        .where(eq(phase15bUpgradeHints.projectId, projectId))
        .orderBy(phase15bUpgradeHints.createdAt, phase15bUpgradeHints.id);

      return rows.map(mapHintRecord);
    }
  };
}
