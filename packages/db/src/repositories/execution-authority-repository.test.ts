import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  PHASE3_EXECUTION_AUTHORITY_BLOCKED_PROJECTION_FIXTURE,
  PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE,
  type CommandId,
  type EventId,
  type ExecutionAuthorityLedgerProjection,
  type ProjectId,
  type StateVersion
} from "@solo-superman/contracts";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "../client";
import { removeTemporaryDirectory } from "../test-cleanup";
import { createExecutionAuthorityRepository } from "./execution-authority-repository";

const tempDirs: string[] = [];

async function makeTempAppDataDir() {
  const tempDir = await mkdtemp(join(tmpdir(), "solo-superman-execution-authority-test-"));

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

function readyProjection(overrides: Partial<ExecutionAuthorityLedgerProjection> = {}) {
  return {
    ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE,
    ...overrides
  } as ExecutionAuthorityLedgerProjection;
}

function blockedProjection(overrides: Partial<ExecutionAuthorityLedgerProjection> = {}) {
  return {
    ...PHASE3_EXECUTION_AUTHORITY_BLOCKED_PROJECTION_FIXTURE,
    ...overrides
  } as ExecutionAuthorityLedgerProjection;
}

const tableColumnContracts = [
  {
    tableName: "execution_authority_records",
    columns: [
      { name: "id", notNull: true, primaryKey: true },
      { name: "project_id", notNull: true, primaryKey: false },
      { name: "session_id", notNull: true, primaryKey: false },
      { name: "source_command_id", notNull: true, primaryKey: false },
      { name: "source_event_id", notNull: true, primaryKey: false },
      { name: "source_state_version", notNull: true, primaryKey: false },
      { name: "source_planning_handoff_ref", notNull: true, primaryKey: false },
      { name: "bounded_agent_output_id", notNull: true, primaryKey: false },
      { name: "action_class", notNull: true, primaryKey: false },
      { name: "approval_decision", notNull: true, primaryKey: false },
      { name: "execution_result", notNull: true, primaryKey: false },
      { name: "preview_artifact_ref", notNull: false, primaryKey: false },
      { name: "preview_artifact_hash", notNull: false, primaryKey: false },
      { name: "reviewed_preview_artifact_hash", notNull: false, primaryKey: false },
      { name: "requested_scope_json", notNull: true, primaryKey: false },
      { name: "approver_json", notNull: false, primaryKey: false },
      { name: "sandbox_boundary_json", notNull: true, primaryKey: false },
      { name: "rollback_reference_json", notNull: false, primaryKey: false },
      { name: "block_reasons_json", notNull: true, primaryKey: false },
      { name: "evidence_refs_json", notNull: true, primaryKey: false },
      { name: "audit_refs_json", notNull: true, primaryKey: false },
      { name: "created_at", notNull: true, primaryKey: false },
      { name: "schema_version", notNull: true, primaryKey: false }
    ]
  },
  {
    tableName: "bounded_agent_output_records",
    columns: [
      { name: "id", notNull: true, primaryKey: true },
      { name: "project_id", notNull: true, primaryKey: false },
      { name: "session_id", notNull: true, primaryKey: false },
      { name: "authority_record_id", notNull: true, primaryKey: false },
      { name: "source_refs_json", notNull: true, primaryKey: false },
      { name: "intended_decision_impact", notNull: true, primaryKey: false },
      { name: "proposed_action_preview_refs_json", notNull: true, primaryKey: false },
      { name: "required_approvals_json", notNull: true, primaryKey: false },
      { name: "evidence_refs_json", notNull: true, primaryKey: false },
      { name: "failure_mode", notNull: true, primaryKey: false },
      { name: "no_execution_policy", notNull: true, primaryKey: false },
      { name: "created_at", notNull: true, primaryKey: false },
      { name: "schema_version", notNull: true, primaryKey: false }
    ]
  }
] as const;

describe("Execution authority repository", () => {
  it("persists and recovers an approved not-run authority record with bounded output", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createExecutionAuthorityRepository(storage.db);
      const projection = readyProjection();

      await expect(
        repository.saveFromProjection({
          projectId: "proj_phase3_authority_ready" as ProjectId,
          sessionId: projection.sessionId,
          sourceCommandId: "cmd_phase3_authority_ready" as CommandId,
          sourceEventId: "evt_phase3_authority_ready" as EventId,
          sourceStateVersion: 7 as StateVersion,
          projection
        })
      ).resolves.toMatchObject({
        currentStatus: "ready_for_execution",
        latestRecord: {
          approvalDecision: "approved",
          executionResult: "not_run"
        }
      });

      await expect(repository.getById(projection.latestRecord.recordId)).resolves.toMatchObject({
        version: 8,
        currentStatus: "ready_for_execution",
        boundedOutputs: [
          expect.objectContaining({
            outputId: projection.boundedOutputs[0]?.outputId,
            noExecutionPolicy: "controlled_execution_required"
          })
        ]
      });

      const rows = await storage.client.execute(
        "SELECT approval_decision, execution_result, action_class FROM execution_authority_records"
      );
      const outputRows = await storage.client.execute(
        "SELECT failure_mode, no_execution_policy FROM bounded_agent_output_records"
      );

      expect(rows.rows).toEqual([
        expect.objectContaining({
          approval_decision: "approved",
          execution_result: "not_run",
          action_class: "file_diff"
        })
      ]);
      expect(outputRows.rows).toEqual([
        expect.objectContaining({
          failure_mode: "ready_for_preview",
          no_execution_policy: "controlled_execution_required"
        })
      ]);
    } finally {
      await storage.close();
    }
  });

  it("recovers the latest blocked precondition record per session", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createExecutionAuthorityRepository(storage.db);
      const ready = readyProjection();
      const blockedRecord = {
        ...PHASE3_EXECUTION_AUTHORITY_BLOCKED_PROJECTION_FIXTURE.latestRecord,
        createdAt: ready.latestRecord.createdAt
      };
      const blocked = blockedProjection({
        records: [blockedRecord],
        latestRecord: blockedRecord
      });

      await repository.saveFromProjection({
        projectId: "proj_phase3_authority_latest" as ProjectId,
        sessionId: ready.sessionId,
        sourceCommandId: "cmd_phase3_authority_latest_ready" as CommandId,
        sourceEventId: "evt_phase3_authority_latest_ready" as EventId,
        sourceStateVersion: 1 as StateVersion,
        projection: ready
      });
      await repository.saveFromProjection({
        projectId: "proj_phase3_authority_latest" as ProjectId,
        sessionId: blocked.sessionId,
        sourceCommandId: "cmd_phase3_authority_latest_blocked" as CommandId,
        sourceEventId: "evt_phase3_authority_latest_blocked" as EventId,
        sourceStateVersion: 2 as StateVersion,
        projection: blocked
      });

      await expect(repository.getLatestForSession(ready.sessionId)).resolves.toMatchObject({
        version: 3,
        currentStatus: "blocked",
        latestRecord: {
          recordId: blocked.latestRecord.recordId,
          blockReasons: expect.arrayContaining([expect.objectContaining({ code: "missing_source" })])
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("reuses bounded output rows across pending to approved authority lifecycle records", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createExecutionAuthorityRepository(storage.db);
      const ready = readyProjection();
      const pendingRecord = {
        ...ready.latestRecord,
        recordId: "exec_auth_phase3_same_output_pending",
        approvalDecision: "pending",
        approver: null,
        executionResult: "blocked",
        blockReasons: [
          {
            code: "missing_approval",
            message: "Approval decision is not an active approved state for execution start.",
            evidenceRefs: ["block:missing_approval"]
          }
        ],
        evidenceRefs: ["block:missing_approval"],
        auditRefs: ["audit_phase3_same_output_pending"]
      } as const;
      const pending = readyProjection({
        currentStatus: "blocked",
        records: [pendingRecord],
        latestRecord: pendingRecord,
        blockedPreconditions: pendingRecord.blockReasons
      });
      const approvedRecord = {
        ...ready.latestRecord,
        recordId: "exec_auth_phase3_same_output_approved",
        createdAt: "2026-05-12T00:10:00.000Z"
      };
      const approved = readyProjection({
        records: [approvedRecord],
        latestRecord: approvedRecord
      });

      await repository.saveFromProjection({
        projectId: "proj_phase3_authority_same_output" as ProjectId,
        sessionId: ready.sessionId,
        sourceCommandId: "cmd_phase3_authority_same_output_pending" as CommandId,
        sourceEventId: "evt_phase3_authority_same_output_pending" as EventId,
        sourceStateVersion: 1 as StateVersion,
        projection: pending
      });
      await repository.saveFromProjection({
        projectId: "proj_phase3_authority_same_output" as ProjectId,
        sessionId: ready.sessionId,
        sourceCommandId: "cmd_phase3_authority_same_output_approved" as CommandId,
        sourceEventId: "evt_phase3_authority_same_output_approved" as EventId,
        sourceStateVersion: 2 as StateVersion,
        projection: approved
      });

      await expect(repository.getLatestForSession(ready.sessionId)).resolves.toMatchObject({
        version: 3,
        currentStatus: "ready_for_execution",
        latestRecord: {
          recordId: approved.latestRecord.recordId,
          boundedAgentOutputId: ready.boundedOutputs[0]?.outputId
        },
        boundedOutputs: [
          expect.objectContaining({
            outputId: ready.boundedOutputs[0]?.outputId
          })
        ]
      });

      const authorityRows = await storage.client.execute("SELECT id FROM execution_authority_records");
      const outputRows = await storage.client.execute("SELECT id FROM bounded_agent_output_records");

      expect(authorityRows.rows).toHaveLength(2);
      expect(outputRows.rows).toHaveLength(1);
    } finally {
      await storage.close();
    }
  });

  it("backfills bounded output rows on idempotent authority retries", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createExecutionAuthorityRepository(storage.db);
      const projection = readyProjection();
      const output = projection.boundedOutputs[0];

      if (!output) {
        throw new Error("Execution authority retry fixture must include a bounded output.");
      }

      const input = {
        projectId: "proj_phase3_authority_retry_backfill" as ProjectId,
        sessionId: projection.sessionId,
        sourceCommandId: "cmd_phase3_authority_retry_backfill" as CommandId,
        sourceEventId: "evt_phase3_authority_retry_backfill" as EventId,
        sourceStateVersion: 5 as StateVersion,
        projection
      };

      await repository.saveFromProjection(input);
      await storage.client.execute(`DELETE FROM bounded_agent_output_records WHERE id = '${output.outputId}'`);

      await expect(repository.saveFromProjection(input)).resolves.toMatchObject({
        latestRecord: {
          recordId: projection.latestRecord.recordId
        },
        boundedOutputs: [
          expect.objectContaining({
            outputId: output.outputId
          })
        ]
      });

      const outputRows = await storage.client.execute("SELECT id FROM bounded_agent_output_records");

      expect(outputRows.rows).toHaveLength(1);
    } finally {
      await storage.close();
    }
  });

  it("recovers running records as running instead of ready-for-execution", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createExecutionAuthorityRepository(storage.db);
      const runningRecord = {
        ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE.latestRecord,
        recordId: "exec_auth_phase3_running_repo",
        executionResult: "running"
      } as const;
      const running = readyProjection({
        currentStatus: "running",
        records: [runningRecord],
        latestRecord: runningRecord
      });

      await repository.saveFromProjection({
        projectId: "proj_phase3_authority_running" as ProjectId,
        sessionId: running.sessionId,
        sourceCommandId: "cmd_phase3_authority_running" as CommandId,
        sourceEventId: "evt_phase3_authority_running" as EventId,
        sourceStateVersion: 4 as StateVersion,
        projection: running
      });

      await expect(repository.getById(running.latestRecord.recordId)).resolves.toMatchObject({
        currentStatus: "running",
        summary: expect.stringContaining("is running"),
        latestRecord: {
          executionResult: "running"
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("matches the authority ledger table column contracts", async () => {
    const storage = await createMigratedStorage();

    try {
      for (const { tableName, columns: expectedColumns } of tableColumnContracts) {
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
});
