import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  type CommandId,
  type CorrelationId,
  type EvidenceItemId,
  type EffectTaskId,
  type EventId,
  type ProjectionVersion,
  type ProjectId,
  type ResearchResultId,
  type ResearchTaskId,
  type SessionId
} from "@solo-superman/contracts";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "../client";
import { createConfigRepository } from "./config-repository";
import { createEffectTaskRepository } from "./effect-task-repository";
import { createEventRepository, persistDerivedStateAfterEvent } from "./event-repository";
import { createProjectRepository } from "./project-repository";
import { createResearchRepository } from "./research-repository";
import { appConfig, effectTasks } from "../schema";

const tempDirs: string[] = [];

async function makeTempAppDataDir() {
  const tempDir = await mkdtemp(join(tmpdir(), "solo-superman-db-test-"));

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

  return { storage, appDataDir, migrationStatus };
}

describe("PR-03 local libSQL storage foundation", () => {
  it("creates a local DB file and applies generated migrations", async () => {
    const { storage, appDataDir, migrationStatus } = await createMigratedStorage();

    try {
      expect(existsSync(join(appDataDir, "solo-superman.db"))).toBe(true);
      expect(migrationStatus).toMatchObject({
        state: "migrated",
        appliedMigrationCount: 3
      });
      expect(migrationStatus.latestMigrationMillis).toEqual(expect.any(Number));
    } finally {
      await storage.close();
    }
  });

  it("creates the PR-03 table and index contract from generated migrations", async () => {
    const { storage } = await createMigratedStorage();

    try {
      const sqliteObjects = await storage.client.execute(
        "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'index')"
      );
      const objectNames = sqliteObjects.rows.map((row) => String(row.name));

      expect(objectNames).toEqual(
        expect.arrayContaining([
          "projects",
          "sessions",
          "events",
          "effect_tasks",
          "projections",
          "research_tasks",
          "research_results",
          "evidence_matrices",
          "app_config",
          "secret_refs",
          "events_session_sequence_idx",
          "effect_tasks_idempotency_key_idx",
          "effect_tasks_session_status_idx",
          "projections_session_kind_idx",
          "research_tasks_session_status_idx",
          "evidence_matrices_result_version_idx"
        ])
      );
    } finally {
      await storage.close();
    }
  });

  it("rejects remote libSQL URLs in Phase 1 storage code", async () => {
    await expect(createSoloStorage({ url: "libsql://example.turso.io" })).rejects.toThrow(
      "Phase 1 storage only accepts local libSQL file URLs"
    );
  });

  it("persists the event before derived project/session state in one transaction", async () => {
    const { storage } = await createMigratedStorage();

    try {
      const projectId = "proj_storage_test" as ProjectId;
      const sessionId = "sess_storage_test" as SessionId;
      const eventId = "evt_project_started" as EventId;

      const result = await persistDerivedStateAfterEvent(
        storage.db,
        {
          eventId,
          eventType: "ProjectStarted",
          projectId,
          sessionId,
          sourceCommandId: "cmd_project_start" as CommandId,
          correlationId: "corr_project_start" as CorrelationId,
          causationId: null,
          schemaVersion: CONTRACT_SCHEMA_VERSION,
          payload: {
            rawIdeaText: "A focused founder brief generator"
          },
          occurredAt: "2026-05-05T00:00:00.000Z"
        },
        async (transaction) => {
          const projectRepository = createProjectRepository(transaction);
          const project = await projectRepository.createProject({
            projectId,
            rawIdeaText: "A focused founder brief generator",
            now: "2026-05-05T00:00:01.000Z"
          });
          const session = await projectRepository.createSession({
            projectId,
            sessionId,
            status: "intake",
            currentPhase: "phase_1",
            now: "2026-05-05T00:00:02.000Z"
          });

          return { project, session };
        }
      );
      const eventRepository = createEventRepository(storage.db);
      const events = await eventRepository.listForSession(sessionId);

      expect(result.event).toMatchObject({
        eventId,
        sequence: 1,
        eventType: "ProjectStarted"
      });
      expect(result.derivedState.project.projectId).toBe(projectId);
      expect(result.derivedState.session.sessionId).toBe(sessionId);
      expect(events.map((event) => event.eventId)).toEqual([eventId]);
    } finally {
      await storage.close();
    }
  });

  it("rolls back the event when derived state persistence fails", async () => {
    const { storage } = await createMigratedStorage();

    try {
      const projectId = "proj_rollback_test" as ProjectId;
      const sessionId = "sess_rollback_test" as SessionId;
      const eventId = "evt_rollback_project_started" as EventId;

      await expect(
        persistDerivedStateAfterEvent(
          storage.db,
          {
            eventId,
            eventType: "ProjectStarted",
            projectId,
            sessionId,
            sourceCommandId: "cmd_rollback_project_start" as CommandId,
            correlationId: "corr_rollback_project_start" as CorrelationId,
            causationId: null,
            schemaVersion: CONTRACT_SCHEMA_VERSION,
            payload: {
              rawIdeaText: "Rollback should keep the event log clean"
            },
            occurredAt: "2026-05-05T00:00:00.000Z"
          },
          async (transaction) => {
            const projectRepository = createProjectRepository(transaction);

            await projectRepository.createProject({
              projectId,
              rawIdeaText: "Rollback should keep the event log clean",
              now: "2026-05-05T00:00:01.000Z"
            });
            await projectRepository.createSession({
              projectId,
              sessionId,
              status: "intake",
              currentPhase: "phase_1",
              now: "2026-05-05T00:00:02.000Z"
            });

            throw new Error("derived state persistence failed");
          }
        )
      ).rejects.toThrow("derived state persistence failed");

      const eventRepository = createEventRepository(storage.db);
      const projectRepository = createProjectRepository(storage.db);

      expect(await eventRepository.listForSession(sessionId)).toEqual([]);
      expect(await projectRepository.getProject(projectId)).toBeNull();
      expect(await projectRepository.getSession(sessionId)).toBeNull();
    } finally {
      await storage.close();
    }
  });

  it("assigns event sequences per session", async () => {
    const { storage } = await createMigratedStorage();

    try {
      const eventRepository = createEventRepository(storage.db);
      const projectId = "proj_sequence_test" as ProjectId;
      const firstSessionId = "sess_sequence_first" as SessionId;
      const secondSessionId = "sess_sequence_second" as SessionId;
      const baseEvent = {
        eventType: "ProjectStarted" as const,
        projectId,
        sourceCommandId: "cmd_sequence" as CommandId,
        correlationId: "corr_sequence" as CorrelationId,
        causationId: null,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        payload: {}
      };

      await eventRepository.append({
        ...baseEvent,
        eventId: "evt_sequence_first_1" as EventId,
        sessionId: firstSessionId,
        occurredAt: "2026-05-05T00:00:00.000Z"
      });
      await eventRepository.append({
        ...baseEvent,
        eventId: "evt_sequence_first_2" as EventId,
        sessionId: firstSessionId,
        occurredAt: "2026-05-05T00:00:01.000Z"
      });
      await eventRepository.append({
        ...baseEvent,
        eventId: "evt_sequence_second_1" as EventId,
        sessionId: secondSessionId,
        occurredAt: "2026-05-05T00:00:02.000Z"
      });

      expect((await eventRepository.listForSession(firstSessionId)).map((event) => event.sequence)).toEqual([1, 2]);
      expect((await eventRepository.listForSession(secondSessionId)).map((event) => event.sequence)).toEqual([1]);
    } finally {
      await storage.close();
    }
  });

  it("creates, reads, and updates persisted effect tasks", async () => {
    const { storage } = await createMigratedStorage();

    try {
      const projectId = "proj_effect_test" as ProjectId;
      const sessionId = "sess_effect_test" as SessionId;
      const sourceEventId = "evt_answer_submitted" as EventId;
      const eventRepository = createEventRepository(storage.db);
      const {
        create: createEffectTask,
        findByIdempotencyKey,
        getInput,
        updateStatus
      } = createEffectTaskRepository(storage.db);

      await eventRepository.append({
        eventId: sourceEventId,
        eventType: "AnswerSubmitted",
        projectId,
        sessionId,
        sourceCommandId: "cmd_submit_answer" as CommandId,
        correlationId: "corr_submit_answer" as CorrelationId,
        causationId: null,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        payload: {
          questionId: "q_effect_test"
        },
        occurredAt: "2026-05-05T00:00:00.000Z"
      });
      await expect(
        createEffectTask({
          effectTaskId: "eft_missing_source" as EffectTaskId,
          effectType: "queue_projection_effect",
          projectId,
          sessionId,
          sourceEventId: "evt_missing_source" as EventId,
          sourceEventIds: ["evt_missing_source" as EventId],
          sourceCommandId: "cmd_submit_answer" as CommandId,
          correlationId: "corr_submit_answer" as CorrelationId,
          idempotencyKey: "evt_missing_source:decision_queue",
          maxAttempts: 3,
          input: {},
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).rejects.toThrow("Effect task source events must exist");
      await expect(
        createEffectTask({
          effectTaskId: "eft_missing_primary_source_ref" as EffectTaskId,
          effectType: "queue_projection_effect",
          projectId,
          sessionId,
          sourceEventId,
          sourceEventIds: [],
          sourceCommandId: "cmd_submit_answer" as CommandId,
          correlationId: "corr_submit_answer" as CorrelationId,
          idempotencyKey: "evt_answer_submitted:missing_primary_ref",
          maxAttempts: 3,
          input: {},
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).rejects.toThrow("sourceEventIds must include sourceEventId");
      await expect(
        createEffectTask({
          effectTaskId: "eft_invalid_attempt_limit" as EffectTaskId,
          effectType: "queue_projection_effect",
          projectId,
          sessionId,
          sourceEventId,
          sourceEventIds: [sourceEventId],
          sourceCommandId: "cmd_submit_answer" as CommandId,
          correlationId: "corr_submit_answer" as CorrelationId,
          idempotencyKey: "evt_answer_submitted:invalid_attempt_limit",
          maxAttempts: 0,
          input: {},
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).rejects.toThrow("maxAttempts must be a positive integer");

      const task = await createEffectTask({
        effectTaskId: "eft_projection_1" as EffectTaskId,
        effectType: "queue_projection_effect",
        projectId,
        sessionId,
        sourceEventId,
        sourceEventIds: [sourceEventId, sourceEventId],
        sourceCommandId: "cmd_submit_answer" as CommandId,
        correlationId: "corr_submit_answer" as CorrelationId,
        idempotencyKey: "evt_answer_submitted:decision_queue",
        maxAttempts: 3,
        input: {
          projectionKind: "decision_queue"
        },
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        queuedAt: "2026-05-05T00:00:00.000Z"
      });

      expect(task).toMatchObject({
        status: "queued",
        attemptCount: 0,
        maxAttempts: 3,
        sourceEventIds: ["evt_answer_submitted"],
        queuedAt: "2026-05-05T00:00:00.000Z",
        updatedAt: "2026-05-05T00:00:00.000Z"
      });
      expect(await findByIdempotencyKey("evt_answer_submitted:decision_queue")).toMatchObject({
        effectTaskId: "eft_projection_1"
      });
      expect(await findByIdempotencyKey("missing:idempotency:key")).toBeNull();
      await expect(
        createEffectTask({
          effectTaskId: "eft_projection_duplicate" as EffectTaskId,
          effectType: "queue_projection_effect",
          projectId,
          sessionId,
          sourceEventId,
          sourceEventIds: [sourceEventId],
          sourceCommandId: "cmd_submit_answer" as CommandId,
          correlationId: "corr_submit_answer" as CorrelationId,
          idempotencyKey: "evt_answer_submitted:decision_queue",
          maxAttempts: 3,
          input: {},
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).rejects.toThrow();
      const leased = await updateStatus({
        effectTaskId: "eft_projection_1" as EffectTaskId,
        status: "leased",
        leaseOwner: "projection-worker-1",
        leaseExpiresAt: "2026-05-05T00:05:00.000Z",
        updatedAt: "2026-05-05T00:00:15.000Z"
      });
      const leaseRows = await storage.db
        .select({
          leaseOwner: effectTasks.leaseOwner,
          leaseExpiresAt: effectTasks.leaseExpiresAt
        })
        .from(effectTasks)
        .where(eq(effectTasks.id, "eft_projection_1"));

      expect(leased).toMatchObject({
        status: "leased",
        updatedAt: "2026-05-05T00:00:15.000Z"
      });
      expect(leaseRows).toEqual([
        {
          leaseOwner: "projection-worker-1",
          leaseExpiresAt: "2026-05-05T00:05:00.000Z"
        }
      ]);
      await expect(
        updateStatus({
          effectTaskId: "eft_projection_1" as EffectTaskId,
          status: "succeeded",
          updatedAt: "2026-05-05T00:00:30.000Z"
        })
      ).rejects.toThrow("Succeeded effect tasks require output metadata");
      await expect(
        updateStatus({
          effectTaskId: "eft_projection_1" as EffectTaskId,
          status: "failed",
          updatedAt: "2026-05-05T00:00:30.000Z"
        })
      ).rejects.toThrow("Failed or blocked effect tasks require error metadata");
      await expect(
        updateStatus({
          effectTaskId: "eft_projection_1" as EffectTaskId,
          status: "leased",
          updatedAt: "2026-05-05T00:00:30.000Z"
        })
      ).rejects.toThrow("Leased or running effect tasks require lease metadata");
      await expect(
        updateStatus({
          effectTaskId: "eft_projection_1" as EffectTaskId,
          status: "running",
          leaseOwner: "projection-worker-1",
          leaseExpiresAt: "",
          updatedAt: "2026-05-05T00:00:30.000Z"
        })
      ).rejects.toThrow("Leased or running effect tasks require lease metadata");
      await expect(
        updateStatus({
          effectTaskId: "eft_projection_1" as EffectTaskId,
          status: "running",
          leaseOwner: "projection-worker-1",
          leaseExpiresAt: "2026-05-05T00:05:00.000Z",
          attemptCount: -1,
          updatedAt: "2026-05-05T00:00:30.000Z"
        })
      ).rejects.toThrow("attemptCount must be a non-negative integer");

      const failed = await updateStatus({
        effectTaskId: "eft_projection_1" as EffectTaskId,
        status: "failed",
        attemptCount: 3,
        error: {
          code: "PROJECTION_BUILD_FAILED",
          message: "Projection could not be built.",
          retryAvailable: true
        },
        updatedAt: "2026-05-05T00:00:30.000Z"
      });

      expect(failed).toMatchObject({
        status: "failed",
        attemptCount: 3,
        updatedAt: "2026-05-05T00:00:30.000Z",
        error: {
          code: "PROJECTION_BUILD_FAILED",
          message: "Projection could not be built.",
          retryAvailable: false
        }
      });
      expect(failed.outputRef).toBeUndefined();

      const updated = await updateStatus({
        effectTaskId: "eft_projection_1" as EffectTaskId,
        status: "succeeded",
        attemptCount: 1,
        output: {
          projectionRef: "queue_projection_latest"
        },
        updatedAt: "2026-05-05T00:01:00.000Z"
      });
      const storedInput = await getInput("eft_projection_1" as EffectTaskId);
      const terminalLeaseRows = await storage.db
        .select({
          leaseOwner: effectTasks.leaseOwner,
          leaseExpiresAt: effectTasks.leaseExpiresAt
        })
        .from(effectTasks)
        .where(eq(effectTasks.id, "eft_projection_1"));

      expect(updated).toMatchObject({
        status: "succeeded",
        attemptCount: 1,
        updatedAt: "2026-05-05T00:01:00.000Z",
        outputRef: {
          refType: "effect_output_json",
          refId: "eft_projection_1"
        }
      });
      expect(updated.error).toBeUndefined();
      expect(storedInput).toEqual({ projectionKind: "decision_queue" });
      expect(terminalLeaseRows).toEqual([
        {
          leaseOwner: null,
          leaseExpiresAt: null
        }
      ]);
    } finally {
      await storage.close();
    }
  });

  it("stores remote DB configuration only as a disabled local slot", async () => {
    const { storage } = await createMigratedStorage();

    try {
      const configRepository = createConfigRepository(storage.db);
      const defaultConfig = await configRepository.getRemoteConfig();

      expect(defaultConfig).toMatchObject({
        remoteDbUrl: null,
        remoteDbTokenRef: null,
        remoteSyncEnabled: false,
        lastRemoteSyncAt: null,
        remoteSyncStatus: "not_configured"
      });
      await expect(
        configRepository.saveDisabledRemoteConfig({
          remoteDbTokenRef: "plain_remote_token_value",
          updatedAt: "2026-05-05T00:00:00.000Z"
        })
      ).rejects.toThrow("remoteDbTokenRef must be an OS secret reference id");

      const saved = await configRepository.saveDisabledRemoteConfig({
        remoteDbUrl: "libsql://future-remote.example",
        remoteDbTokenRef: "secret_ref_future_remote",
        updatedAt: "2026-05-05T00:00:00.000Z"
      });
      const loaded = await configRepository.getRemoteConfig();

      expect(saved).toEqual({
        remoteDbUrl: "libsql://future-remote.example",
        remoteDbTokenRef: "secret_ref_future_remote",
        remoteSyncEnabled: false,
        lastRemoteSyncAt: null,
        remoteSyncStatus: "configured_disabled",
        updatedAt: "2026-05-05T00:00:00.000Z"
      });
      expect(loaded).toEqual(saved);

      const overwritten = await configRepository.saveDisabledRemoteConfig({
        remoteDbUrl: "libsql://replacement.example",
        updatedAt: "2026-05-05T00:01:00.000Z"
      });

      expect(overwritten).toEqual({
        remoteDbUrl: "libsql://replacement.example",
        remoteDbTokenRef: null,
        remoteSyncEnabled: false,
        lastRemoteSyncAt: null,
        remoteSyncStatus: "configured_disabled",
        updatedAt: "2026-05-05T00:01:00.000Z"
      });

      await storage.db
        .insert(appConfig)
        .values({
          key: "remote_db_config",
          valueJson: JSON.stringify({
            remoteDbUrl: "libsql://legacy.example",
            remoteDbTokenRef: "secret_ref_legacy",
            remoteSyncEnabled: true,
            lastRemoteSyncAt: "2026-05-04T00:00:00.000Z",
            remoteSyncStatus: "enabled"
          }),
          updatedAt: "2026-05-05T00:02:00.000Z"
        })
        .onConflictDoUpdate({
          target: appConfig.key,
          set: {
            valueJson: JSON.stringify({
              remoteDbUrl: "libsql://legacy.example",
              remoteDbTokenRef: "secret_ref_legacy",
              remoteSyncEnabled: true,
              lastRemoteSyncAt: "2026-05-04T00:00:00.000Z",
              remoteSyncStatus: "enabled"
            }),
            updatedAt: "2026-05-05T00:02:00.000Z"
          }
        });

      expect(await configRepository.getRemoteConfig()).toEqual({
        remoteDbUrl: "libsql://legacy.example",
        remoteDbTokenRef: "secret_ref_legacy",
        remoteSyncEnabled: false,
        lastRemoteSyncAt: null,
        remoteSyncStatus: "not_configured",
        updatedAt: "2026-05-05T00:02:00.000Z"
      });
    } finally {
      await storage.close();
    }
  });

  it("persists ResearchTask, ResearchResult, and EvidenceMatrix rows for the PR-06 loop", async () => {
    const { storage } = await createMigratedStorage();

    try {
      const repository = createResearchRepository(storage.db);
      const projectId = "proj_research_storage" as ProjectId;
      const sessionId = "sess_research_storage" as SessionId;
      const researchTaskId = "research_task_storage" as ResearchTaskId;
      const researchResultId = "research_result_storage" as ResearchResultId;

      await repository.saveTask({
        projectId,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        task: {
          researchTaskId,
          sessionId,
          objective: "Validate high-impact claim",
          routeOutcome: "missing_con_evidence",
          impact: "high",
          status: "planned",
          createdAt: "2026-05-05T00:00:00.000Z"
        }
      });
      await repository.saveResult({
        projectId,
        sessionId,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        result: {
          researchResultId,
          researchTaskId,
          resultSummary: "Pro: source supports the claim.",
          limitationNotes: "No con evidence imported yet.",
          importedAt: "2026-05-05T00:01:00.000Z"
        }
      });
      await repository.saveEvidenceMatrix({
        projectId,
        sessionId,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        matrix: {
          evidenceMatrixId: "evidence_matrix_storage",
          researchTaskId,
          researchResultId,
          synthesisVersion: 1,
          proEvidence: [
            {
              evidenceItemId: "evidence_pro_storage" as EvidenceItemId,
              kind: "pro",
              summary: "Imported source supports the claim."
            }
          ],
          conEvidence: [],
          uncertainties: [],
          additionalQuestions: ["Find credible counter-evidence."],
          balanceStatus: "missing_con_evidence",
          decisionBlocked: true,
          missingConEvidenceReason: "Skeptical search not completed.",
          knownRisk: "High-impact claim lacks con evidence."
        }
      });

      const task = await repository.getTask(researchTaskId);
      const projection = await repository.getProjection(sessionId);

      expect(task).toMatchObject({
        researchTaskId,
        status: "planned"
      });
      expect(projection).toMatchObject({
        kind: "ResearchEvidenceProjection",
        version: 3 as ProjectionVersion,
        taskIds: [researchTaskId],
        evidenceMatrices: [
          expect.objectContaining({
            balanceStatus: "missing_con_evidence",
            decisionBlocked: true
          })
        ],
        knownRisks: ["High-impact claim lacks con evidence."]
      });
    } finally {
      await storage.close();
    }
  });
});
