import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE,
  PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE,
  type CommandId,
  type EventId,
  type PlanningHandoffProjection,
  type ProjectId,
  type StateVersion
} from "@solo-superman/contracts";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "../client";
import { removeTemporaryDirectory } from "../test-cleanup";
import { createPlanningHandoffRepository } from "./planning-handoff-repository";

const tempDirs: string[] = [];

async function makeTempAppDataDir() {
  const tempDir = await mkdtemp(join(tmpdir(), "solo-superman-planning-handoff-test-"));

  tempDirs.push(tempDir);

  return tempDir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(removeTemporaryDirectory));
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

function finalProjection(overrides: Partial<PlanningHandoffProjection> = {}): PlanningHandoffProjection {
  return {
    ...PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE,
    ...overrides
  } as PlanningHandoffProjection;
}

function blockerProjection(overrides: Partial<PlanningHandoffProjection> = {}): PlanningHandoffProjection {
  return {
    ...PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE,
    ...overrides
  } as PlanningHandoffProjection;
}

const planningHandoffTableColumnContracts = [
  {
    tableName: "planning_handoffs",
    columns: [
      "id",
      "project_id",
      "session_id",
      "source_command_id",
      "source_event_id",
      "artifact_kind",
      "status",
      "gate_verdict",
      "source_state_version",
      "summary",
      "artifact_json",
      "created_by",
      "created_at",
      "schema_version"
    ].map((name) => ({ name, notNull: true, primaryKey: name === "id" }))
  },
  {
    tableName: "planning_handoff_sources",
    columns: [
      { name: "id", notNull: true, primaryKey: true },
      { name: "handoff_id", notNull: true, primaryKey: false },
      { name: "source_type", notNull: true, primaryKey: false },
      { name: "source_id", notNull: true, primaryKey: false },
      { name: "source_label", notNull: false, primaryKey: false },
      { name: "required", notNull: true, primaryKey: false },
      { name: "stale", notNull: true, primaryKey: false },
      { name: "created_at", notNull: true, primaryKey: false }
    ]
  },
  {
    tableName: "planning_handoff_tasks",
    columns: [
      "id",
      "handoff_id",
      "sequence_order",
      "title",
      "intent",
      "owner_role",
      "source_refs_json",
      "depends_on_json",
      "acceptance_evidence_json",
      "non_goals_json",
      "risk_refs_json"
    ].map((name) => ({ name, notNull: true, primaryKey: name === "id" }))
  },
  {
    tableName: "planning_handoff_pr_issue_items",
    columns: [
      "id",
      "handoff_id",
      "sequence_order",
      "summary",
      "included_task_ids_json",
      "entry_prerequisites_json",
      "exit_evidence_json",
      "blocked_by_json",
      "phase_boundary"
    ].map((name) => ({ name, notNull: true, primaryKey: name === "id" }))
  },
  {
    tableName: "planning_handoff_risks",
    columns: [
      { name: "id", notNull: true, primaryKey: true },
      { name: "handoff_id", notNull: true, primaryKey: false },
      { name: "risk_kind", notNull: true, primaryKey: false },
      { name: "risk_class", notNull: true, primaryKey: false },
      { name: "severity", notNull: true, primaryKey: false },
      { name: "title", notNull: true, primaryKey: false },
      { name: "source_refs_json", notNull: true, primaryKey: false },
      { name: "owner_role", notNull: true, primaryKey: false },
      { name: "follow_up_trigger", notNull: true, primaryKey: false },
      { name: "required_action", notNull: false, primaryKey: false }
    ]
  }
] as const;

describe("Planning Handoff repository", () => {
  it("persists final artifacts with normalized source, task, PR/issue, and residual-risk rows", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createPlanningHandoffRepository(storage.db);
      const projection = finalProjection();
      const finalArtifact = projection.finalArtifact;

      if (!finalArtifact) {
        throw new Error("final projection fixture must include finalArtifact");
      }

      await expect(
        repository.saveFromProjection({
          projectId: "proj_planning_handoff_final" as ProjectId,
          sessionId: projection.sessionId,
          sourceCommandId: "cmd_planning_handoff_final" as CommandId,
          sourceEventId: "evt_planning_handoff_final" as EventId,
          sourceStateVersion: 12 as StateVersion,
          projection
        })
      ).resolves.toMatchObject({
        currentStatus: "planning_ready",
        finalArtifact: {
          artifactId: finalArtifact.artifactId
        }
      });

      await expect(repository.getById(finalArtifact.artifactId)).resolves.toMatchObject({
        version: 13,
        currentStatus: "planning_ready",
        finalArtifact: {
          artifactId: finalArtifact.artifactId
        }
      });
      await expect(repository.hasSourceRef(finalArtifact.artifactId, "spec_version", "spec_version_demo_001"))
        .resolves.toBe(true);

      const sourceRows = await storage.client.execute("SELECT source_type, source_id FROM planning_handoff_sources");
      const taskRows = await storage.client.execute("SELECT title, owner_role FROM planning_handoff_tasks");
      const issueRows = await storage.client.execute("SELECT summary, phase_boundary FROM planning_handoff_pr_issue_items");
      const riskRows = await storage.client.execute(
        "SELECT risk_kind, risk_class, owner_role, follow_up_trigger, required_action FROM planning_handoff_risks"
      );

      expect(sourceRows.rows).toHaveLength(finalArtifact.sourceRefs.length);
      expect(taskRows.rows).toHaveLength(finalArtifact.taskBreakdown.length);
      expect(issueRows.rows).toHaveLength(finalArtifact.prIssuePlan.length);
      expect(riskRows.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            risk_kind: "residual_risk",
            risk_class: "phase15b_readiness_gap",
            owner_role: "security",
            follow_up_trigger: "Before implementing any controlled execution adapter.",
            required_action: null
          }),
          expect.objectContaining({
            risk_kind: "assumption",
            risk_class: "phase15b_readiness_gap",
            required_action: null
          }),
          expect.objectContaining({
            risk_kind: "prerequisite",
            risk_class: "phase15b_readiness_gap",
            required_action: null
          }),
          expect.objectContaining({
            risk_kind: "validation_dependency",
            risk_class: "phase15b_readiness_gap",
            required_action: null
          })
        ])
      );
    } finally {
      await storage.close();
    }
  });

  it("returns the existing projection for identical semantic handoff retries without duplicating rows", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createPlanningHandoffRepository(storage.db);
      const projection = finalProjection();
      const finalArtifact = projection.finalArtifact;

      if (!finalArtifact) {
        throw new Error("final projection fixture must include finalArtifact");
      }

      await repository.saveFromProjection({
        projectId: "proj_planning_handoff_idempotent" as ProjectId,
        sessionId: projection.sessionId,
        sourceCommandId: "cmd_planning_handoff_idempotent_a" as CommandId,
        sourceEventId: "evt_planning_handoff_idempotent_a" as EventId,
        sourceStateVersion: 12 as StateVersion,
        projection
      });

      await expect(
        repository.saveFromProjection({
          projectId: "proj_planning_handoff_idempotent" as ProjectId,
          sessionId: projection.sessionId,
          sourceCommandId: "cmd_planning_handoff_idempotent_b" as CommandId,
          sourceEventId: "evt_planning_handoff_idempotent_b" as EventId,
          sourceStateVersion: 12 as StateVersion,
          projection
        })
      ).resolves.toMatchObject({
        currentStatus: "planning_ready",
        finalArtifact: {
          artifactId: finalArtifact.artifactId
        }
      });

      const handoffRows = await storage.client.execute("SELECT id FROM planning_handoffs");
      const sourceRows = await storage.client.execute("SELECT id FROM planning_handoff_sources");
      const taskRows = await storage.client.execute("SELECT id FROM planning_handoff_tasks");
      const issueRows = await storage.client.execute("SELECT id FROM planning_handoff_pr_issue_items");
      const riskRows = await storage.client.execute("SELECT id FROM planning_handoff_risks");

      expect(handoffRows.rows).toHaveLength(1);
      expect(sourceRows.rows).toHaveLength(finalArtifact.sourceRefs.length);
      expect(taskRows.rows).toHaveLength(finalArtifact.taskBreakdown.length);
      expect(issueRows.rows).toHaveLength(finalArtifact.prIssuePlan.length);
      expect(riskRows.rows).toHaveLength(finalArtifact.residualRiskRegister.length * 4);
    } finally {
      await storage.close();
    }
  });

  it("persists blocker artifacts in the same family and recovers only the latest state per session", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createPlanningHandoffRepository(storage.db);
      const final = finalProjection();
      const blocker = blockerProjection();
      const blockerArtifact = blocker.blockerArtifact;

      if (!blockerArtifact) {
        throw new Error("blocker projection fixture must include blockerArtifact");
      }

      await repository.saveFromProjection({
        projectId: "proj_planning_handoff_latest" as ProjectId,
        sessionId: final.sessionId,
        sourceCommandId: "cmd_planning_handoff_latest_final" as CommandId,
        sourceEventId: "evt_planning_handoff_latest_final" as EventId,
        sourceStateVersion: 1 as StateVersion,
        projection: final
      });
      await repository.saveFromProjection({
        projectId: "proj_planning_handoff_latest" as ProjectId,
        sessionId: blocker.sessionId,
        sourceCommandId: "cmd_planning_handoff_latest_blocker" as CommandId,
        sourceEventId: "evt_planning_handoff_latest_blocker" as EventId,
        sourceStateVersion: 2 as StateVersion,
        projection: blocker
      });

      await expect(repository.getLatestForSession(final.sessionId)).resolves.toMatchObject({
        version: 3,
        currentStatus: "source_trace_incomplete",
        blockerArtifact: {
          artifactId: blockerArtifact.artifactId
        }
      });

      const rows = await storage.client.execute(
        "SELECT artifact_kind, status FROM planning_handoffs ORDER BY created_at ASC, id ASC"
      );

      expect(rows.rows).toEqual([
        expect.objectContaining({ artifact_kind: "PlanningHandoffArtifact", status: "planning_ready" }),
        expect.objectContaining({ artifact_kind: "PlanningHandoffBlockerArtifact", status: "source_trace_incomplete" })
      ]);
    } finally {
      await storage.close();
    }
  });

  it("rolls back the parent handoff row when normalized child-row persistence fails", async () => {
    const storage = await createMigratedStorage();

    try {
      const sourceRef = PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE.finalArtifact.sourceRefs[0];
      const projection = finalProjection({
        sourceRefs: [sourceRef, sourceRef],
        finalArtifact: {
          ...PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE.finalArtifact,
          sourceRefs: [sourceRef, sourceRef]
        }
      });

      await expect(
        storage.db.transaction(async (transaction) =>
          createPlanningHandoffRepository(transaction).saveFromProjection({
            projectId: "proj_planning_handoff_rollback" as ProjectId,
            sessionId: projection.sessionId,
            sourceCommandId: "cmd_planning_handoff_rollback" as CommandId,
            sourceEventId: "evt_planning_handoff_rollback" as EventId,
            sourceStateVersion: 5 as StateVersion,
            projection
          })
        )
      ).rejects.toThrow();

      const handoffRows = await storage.client.execute("SELECT id FROM planning_handoffs");
      const sourceRows = await storage.client.execute("SELECT id FROM planning_handoff_sources");

      expect(handoffRows.rows).toHaveLength(0);
      expect(sourceRows.rows).toHaveLength(0);
    } finally {
      await storage.close();
    }
  });

  it("matches the docs/32 exact Planning Handoff table column contracts", async () => {
    const storage = await createMigratedStorage();

    try {
      for (const { tableName, columns: expectedColumns } of planningHandoffTableColumnContracts) {
        const tableInfo = await storage.client.execute(`PRAGMA table_info(${tableName})`);
        const columns = tableInfo.rows.map((row) => ({
          name: String(row.name),
          notNull: Number(row.notnull) === 1,
          primaryKey: Number(row.pk) === 1
        }));

        expect(columns).toEqual(expectedColumns);
      }
    } finally {
      await storage.close();
    }
  });

  it("keeps Planning Handoff storage free of active execution-state columns", async () => {
    const storage = await createMigratedStorage();

    try {
      const tableNames = [
        "planning_handoffs",
        "planning_handoff_sources",
        "planning_handoff_tasks",
        "planning_handoff_pr_issue_items",
        "planning_handoff_risks"
      ];
      const forbiddenColumnPattern = /file_patch_execution|shell_execution|browser_action|deploy_execution|external_mutation|active_delegation/u;

      for (const tableName of tableNames) {
        const columns = await storage.client.execute(`PRAGMA table_info(${tableName})`);
        const columnNames = columns.rows.map((row) => String(row.name));

        expect(columnNames.join("\n")).not.toMatch(forbiddenColumnPattern);
      }
    } finally {
      await storage.close();
    }
  });
});
