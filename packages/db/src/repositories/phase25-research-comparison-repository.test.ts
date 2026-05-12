import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE,
  PHASE25_SAFE_FAILURE_PROJECTION_FIXTURE,
  type CommandId,
  type EventId,
  type Phase25ResearchComparisonProjection,
  type ProjectId,
  type StateVersion
} from "@solo-superman/contracts";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "../client";
import { createPhase25ResearchComparisonRepository } from "./phase25-research-comparison-repository";

const tempDirs: string[] = [];

async function makeTempAppDataDir() {
  const tempDir = await mkdtemp(join(tmpdir(), "solo-superman-phase25-test-"));

  tempDirs.push(tempDir);

  return tempDir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
});

async function createMigratedStorage() {
  const appDataDir = await makeTempAppDataDir();
  const storage = await createSoloStorage({ url: localDatabaseUrlFromAppDataDir(appDataDir) });
  const migrationStatus = await applyMigrations(storage);

  if (migrationStatus.state === "failed") {
    await storage.close();
    throw new Error(migrationStatus.errorMessage);
  }

  return storage;
}

function qualityProjection(overrides: Partial<Phase25ResearchComparisonProjection> = {}) {
  return {
    ...PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE,
    ...overrides
  } as Phase25ResearchComparisonProjection;
}

function safeFailureProjection(overrides: Partial<Phase25ResearchComparisonProjection> = {}) {
  return {
    ...PHASE25_SAFE_FAILURE_PROJECTION_FIXTURE,
    ...overrides
  } as Phase25ResearchComparisonProjection;
}

const phase25TableColumnContracts = [
  {
    tableName: "phase25_research_comparisons",
    columns: [
      "id",
      "project_id",
      "session_id",
      "source_command_id",
      "source_event_id",
      "status",
      "gate_verdict",
      "candidate_lane",
      "quality_lift_claimed",
      "source_state_version",
      "summary",
      "artifact_json",
      "created_by",
      "created_at",
      "schema_version"
    ].map((name) => ({ name, notNull: true, primaryKey: name === "id" }))
  },
  {
    tableName: "phase25_research_comparison_sources",
    columns: [
      { name: "id", notNull: true, primaryKey: true },
      { name: "comparison_id", notNull: true, primaryKey: false },
      { name: "source_type", notNull: true, primaryKey: false },
      { name: "source_id", notNull: true, primaryKey: false },
      { name: "source_label", notNull: false, primaryKey: false },
      { name: "required", notNull: true, primaryKey: false },
      { name: "stale", notNull: true, primaryKey: false },
      { name: "created_at", notNull: true, primaryKey: false }
    ]
  }
] as const;

describe("Phase 2.5 research comparison repository", () => {
  it("persists and recovers a quality-lift report with trace source rows", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createPhase25ResearchComparisonRepository(storage.db);
      const projection = qualityProjection();

      await expect(
        repository.saveFromProjection({
          projectId: "proj_phase25_quality" as ProjectId,
          sessionId: projection.sessionId,
          sourceCommandId: "cmd_phase25_quality" as CommandId,
          sourceEventId: "evt_phase25_quality" as EventId,
          sourceStateVersion: 7 as StateVersion,
          projection
        })
      ).resolves.toMatchObject({
        currentStatus: "quality_lift_ready",
        artifact: {
          artifactId: projection.artifact.artifactId,
          qualityLiftClaimed: true
        }
      });

      await expect(repository.getById(projection.artifact.artifactId)).resolves.toMatchObject({
        version: 8,
        currentStatus: "quality_lift_ready",
        artifact: {
          artifactId: projection.artifact.artifactId
        }
      });
      await expect(
        repository.hasSourceRef(projection.artifact.artifactId, "phase15a_baseline", "phase15a_baseline_demo_001")
      ).resolves.toBe(true);

      const rows = await storage.client.execute(
        "SELECT status, gate_verdict, candidate_lane, quality_lift_claimed FROM phase25_research_comparisons"
      );
      const sourceRows = await storage.client.execute("SELECT source_type, source_id FROM phase25_research_comparison_sources");

      expect(rows.rows).toEqual([
        expect.objectContaining({
          status: "quality_lift_ready",
          gate_verdict: "allowed_for_comparative_preview",
          candidate_lane: "manual_prompt_handoff",
          quality_lift_claimed: 1
        })
      ]);
      expect(sourceRows.rows).toHaveLength(projection.artifact.sourceRefs.length);
    } finally {
      await storage.close();
    }
  });

  it("recovers the latest safe-failure report per session without claiming quality lift", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createPhase25ResearchComparisonRepository(storage.db);
      const quality = qualityProjection();
      const safeFailure = safeFailureProjection();

      await repository.saveFromProjection({
        projectId: "proj_phase25_latest" as ProjectId,
        sessionId: quality.sessionId,
        sourceCommandId: "cmd_phase25_latest_quality" as CommandId,
        sourceEventId: "evt_phase25_latest_quality" as EventId,
        sourceStateVersion: 1 as StateVersion,
        projection: quality
      });
      await repository.saveFromProjection({
        projectId: "proj_phase25_latest" as ProjectId,
        sessionId: safeFailure.sessionId,
        sourceCommandId: "cmd_phase25_latest_safe" as CommandId,
        sourceEventId: "evt_phase25_latest_safe" as EventId,
        sourceStateVersion: 2 as StateVersion,
        projection: safeFailure
      });

      await expect(repository.getLatestForSession(quality.sessionId)).resolves.toMatchObject({
        version: 3,
        currentStatus: "safe_failure_blocked",
        artifact: {
          artifactId: safeFailure.artifact.artifactId,
          qualityLiftClaimed: false
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("matches the Phase 2.5 table column contracts and has no execution-state columns", async () => {
    const storage = await createMigratedStorage();

    try {
      for (const { tableName, columns: expectedColumns } of phase25TableColumnContracts) {
        const tableInfo = await storage.client.execute(`PRAGMA table_info(${tableName})`);
        const columns = tableInfo.rows.map((row) => ({
          name: String(row.name),
          notNull: Number(row.notnull) === 1,
          primaryKey: Number(row.pk) === 1
        }));

        expect(columns).toEqual(expectedColumns);
        expect(columns.map((column) => column.name).join("\n")).not.toMatch(
          /file_patch_execution|shell_execution|browser_action|deploy_execution|external_mutation|active_delegation/u
        );
      }
    } finally {
      await storage.close();
    }
  });
});
