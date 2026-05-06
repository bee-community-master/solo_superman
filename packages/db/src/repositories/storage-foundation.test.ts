import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION,
  type CommandId,
  type CorrelationId,
  type DecisionEvidencePackId,
  type EvidenceItemId,
  type EffectTaskId,
  type EventId,
  type Phase15bUpgradeHints,
  type ProjectionVersion,
  type ProjectId,
  type ResearchResultId,
  type ResearchRunId,
  type ResearchTaskId,
  type RuntimeArtifactId,
  type SessionId
} from "@solo-superman/contracts";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "../client";
import { createConfigRepository } from "./config-repository";
import { createEffectTaskRepository } from "./effect-task-repository";
import { createEventRepository, persistDerivedStateAfterEvent } from "./event-repository";
import { createPhase15bUpgradeHintRepository } from "./phase15b-upgrade-hint-repository";
import { createProjectRepository } from "./project-repository";
import { createResearchRepository } from "./research-repository";
import { createRuntimeRepository } from "./runtime-repository";
import { appConfig, effectTasks, phase15bUpgradeHints, runtimeTaskRefs } from "../schema";

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

function phase15bHintsFixture(overrides: Partial<Phase15bUpgradeHints> = {}): Phase15bUpgradeHints {
  return {
    executionIntent: {
      candidateActionType: "shell_command",
      targetSurface: "local workspace verification",
      nonExecutingSummary: "Readiness metadata for a later approved verification command."
    },
    approvalRequirements: [
      {
        approvalType: "task_level_execution",
        reason: "A future phase must ask before running the command.",
        scope: "pnpm verify in an isolated worktree",
        requiredActor: "user",
        reconfirmRule: "Reconfirm if cwd, command, or base ref changes."
      }
    ],
    sandboxRequirements: {
      isolatedWorktreeRequired: true,
      browserSandboxRequired: false,
      networkMode: "offline",
      commandAllowlist: ["pnpm verify"],
      secretGrantBoundary: "No secret values are required.",
      environmentPolicy: "Use the project-local workspace and capture logs.",
      logCaptureRequired: true
    },
    rollbackReference: {
      baseRef: "origin/main",
      diffRef: "runtime_artifact_storage.diff",
      rollbackNote: "Discard preview metadata or revert the later implementation commit.",
      reversible: true,
      cleanupExpectation: "Remove temporary logs and worktree after inspection."
    },
    expectedEvidence: {
      tests: ["pnpm verify"],
      smokeChecks: ["pnpm smoke:e2e"],
      artifactPaths: ["apps/sidecar/src/e2e-dry-run.fixture.ts"],
      manualInspection: ["Confirm labels say readiness or preview."],
      expectedLogs: ["phase15b readiness metadata exported"]
    },
    riskNormalization: {
      riskLevel: "medium",
      blockedActionType: "shell_command",
      blockReason: "Phase 1.5B must not execute shell commands.",
      userVisibleAction: "Request explicit task-level execution approval later.",
      escalationTarget: "Phase 3 safe-execution policy"
    },
    sourceRefs: [
      {
        kind: "preview_artifact",
        refId: "runtime_artifact_storage",
        label: "ImplementationPlanPreviewArtifact"
      },
      {
        kind: "research_run",
        refId: "research_run_storage",
        label: "ResearchRunProjection"
      },
      {
        kind: "evidence_matrix",
        refId: "evidence_matrix_storage",
        label: "EvidenceMatrix"
      },
      {
        kind: "research_allowlist",
        refId: "research_allowlist_storage",
        label: "ResearchAllowlistProjection"
      },
      {
        kind: "research_disclosure_log",
        refId: "research_disclosure_storage",
        label: "ResearchDisclosureLogProjection"
      }
    ],
    createdAt: "2026-05-06T00:00:00.000Z",
    schemaVersion: PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION,
    ...overrides
  };
}

describe("PR-03 local libSQL storage foundation", () => {
  it("creates a local DB file and applies generated migrations", async () => {
    const { storage, appDataDir, migrationStatus } = await createMigratedStorage();

    try {
      expect(existsSync(join(appDataDir, "solo-superman.db"))).toBe(true);
      expect(migrationStatus).toMatchObject({
        state: "migrated",
        appliedMigrationCount: 9
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
          "decision_evidence_packs",
          "research_allowlists",
          "research_disclosure_logs",
          "research_runs",
          "runtime_preview_artifacts",
          "phase15b_upgrade_hints",
          "runtime_task_refs",
          "app_config",
          "secret_refs",
          "events_session_sequence_idx",
          "effect_tasks_idempotency_key_idx",
          "effect_tasks_session_status_idx",
          "projections_session_kind_idx",
          "research_tasks_session_status_idx",
          "evidence_matrices_result_version_idx",
          "decision_evidence_packs_result_idx",
          "decision_evidence_packs_task_idx",
          "decision_evidence_packs_session_idx",
          "decision_evidence_packs_run_idx",
          "research_allowlists_project_status_idx",
          "research_allowlists_updated_at_idx",
          "research_disclosure_logs_project_created_idx",
          "research_disclosure_logs_allowlist_idx",
          "research_disclosure_logs_status_idx",
          "research_runs_project_idempotency_key_idx",
          "research_runs_project_status_idx",
          "research_runs_task_idx",
          "research_runs_allowlist_idx",
          "research_runs_disclosure_idx",
          "runtime_artifacts_context_idx",
          "phase15b_upgrade_hints_artifact_idx",
          "phase15b_upgrade_hints_session_idx",
          "phase15b_upgrade_hints_risk_idx",
          "runtime_task_refs_effect_artifact_idx"
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
        leaseOwner: "stale-terminal-worker",
        leaseExpiresAt: "2026-05-05T00:10:00.000Z",
        error: {
          code: "PROJECTION_BUILD_FAILED",
          message: "Projection could not be built.",
          retryAvailable: true
        },
        updatedAt: "2026-05-05T00:00:30.000Z"
      });
      const failedLeaseRows = await storage.db
        .select({
          leaseOwner: effectTasks.leaseOwner,
          leaseExpiresAt: effectTasks.leaseExpiresAt
        })
        .from(effectTasks)
        .where(eq(effectTasks.id, "eft_projection_1"));

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
      expect(failedLeaseRows).toEqual([
        {
          leaseOwner: null,
          leaseExpiresAt: null
        }
      ]);

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

      const legacyEnabledRemoteConfigJson = JSON.stringify({
        remoteDbUrl: "libsql://legacy.example",
        remoteDbTokenRef: "secret_ref_legacy",
        remoteSyncEnabled: true,
        lastRemoteSyncAt: "2026-05-04T00:00:00.000Z",
        remoteSyncStatus: "enabled"
      });

      await storage.db
        .insert(appConfig)
        .values({
          key: "remote_db_config",
          valueJson: legacyEnabledRemoteConfigJson,
          updatedAt: "2026-05-05T00:02:00.000Z"
        })
        .onConflictDoUpdate({
          target: appConfig.key,
          set: {
            valueJson: legacyEnabledRemoteConfigJson,
            updatedAt: "2026-05-05T00:02:00.000Z"
          }
        });

      expect(await configRepository.getRemoteConfig()).toEqual({
        remoteDbUrl: "libsql://legacy.example",
        remoteDbTokenRef: "secret_ref_legacy",
        remoteSyncEnabled: false,
        lastRemoteSyncAt: null,
        remoteSyncStatus: "configured_disabled",
        updatedAt: "2026-05-05T00:02:00.000Z"
      });

      const legacySecretLeakConfigJson = JSON.stringify({
        remoteDbUrl: "libsql://legacy-token-leak.example",
        remoteDbTokenRef: "plain_remote_token_value",
        remoteSyncEnabled: true,
        lastRemoteSyncAt: "2026-05-04T00:00:00.000Z",
        remoteSyncStatus: "enabled"
      });

      await storage.db
        .insert(appConfig)
        .values({
          key: "remote_db_config",
          valueJson: legacySecretLeakConfigJson,
          updatedAt: "2026-05-05T00:03:00.000Z"
        })
        .onConflictDoUpdate({
          target: appConfig.key,
          set: {
            valueJson: legacySecretLeakConfigJson,
            updatedAt: "2026-05-05T00:03:00.000Z"
          }
        });

      expect(await configRepository.getRemoteConfig()).toEqual({
        remoteDbUrl: "libsql://legacy-token-leak.example",
        remoteDbTokenRef: null,
        remoteSyncEnabled: false,
        lastRemoteSyncAt: null,
        remoteSyncStatus: "configured_disabled",
        updatedAt: "2026-05-05T00:03:00.000Z"
      });
    } finally {
      await storage.close();
    }
  });

  it("persists ResearchTask, ResearchResult, EvidenceMatrix, and EvidencePack rows for the PR-06 loop", async () => {
    const { storage } = await createMigratedStorage();

    try {
      const repository = createResearchRepository(storage.db);
      const projectId = "proj_research_storage" as ProjectId;
      const sessionId = "sess_research_storage" as SessionId;
      const researchTaskId = "research_task_storage" as ResearchTaskId;
      const researchResultId = "research_result_storage" as ResearchResultId;
      const researchRunId = "research_run_storage" as ResearchRunId;
      const evidencePackId = "evidence_pack_storage" as DecisionEvidencePackId;

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
          researchRunId,
          sourceTitle: "Storage evidence source",
          sourceUrl: "https://example.com/evidence",
          sourceReliability: "medium",
          sourcePublishedAt: "2026-05-04T00:00:00.000Z",
          sourceRetrievedAt: "2026-05-05T00:01:00.000Z",
          resultSummary: "Pro: source supports the claim.",
          limitationNotes: "No con evidence imported yet.",
          claim: "Validate high-impact claim",
          decisionContext: "missing_con_evidence",
          specSectionRef: "spec:validation",
          questionRef: "queue_storage",
          implicationScope: "Preserve as a review item; do not update SpecVersion.",
          staleSensitive: true,
          sourceRequiredAfter: "2026-05-01T00:00:00.000Z",
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
      await repository.saveDecisionEvidencePack({
        projectId,
        sessionId,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        pack: {
          evidencePackId,
          researchTaskId,
          researchResultId,
          researchRunId,
          claim: "Validate high-impact claim",
          decisionContext: "missing_con_evidence",
          sourceTitle: "Storage evidence source",
          sourceUrl: "https://example.com/evidence",
          sourceReliability: "medium",
          sourcePublishedAt: "2026-05-04T00:00:00.000Z",
          retrievedAt: "2026-05-05T00:01:00.000Z",
          gateStatus: "research_insufficient",
          gateChecks: [
            {
              code: "pro_con_balance",
              status: "failed",
              reason: "High-impact claim still lacks con evidence."
            }
          ],
          proEvidenceItemIds: ["evidence_pro_storage" as EvidenceItemId],
          conEvidenceItemIds: [],
          uncertaintyItemIds: [],
          limitationRefs: ["No con evidence imported yet."],
          implicationScope: "Preserve as a review item; do not update SpecVersion.",
          knownRisk: "High-impact claim lacks con evidence.",
          nextValidationAction: "Find credible counter-evidence.",
          createdAt: "2026-05-05T00:01:00.000Z"
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
        version: 4 as ProjectionVersion,
        taskIds: [researchTaskId],
        results: [
          expect.objectContaining({
            researchResultId,
            researchRunId,
            sourceReliability: "medium",
            sourcePublishedAt: "2026-05-04T00:00:00.000Z",
            sourceRetrievedAt: "2026-05-05T00:01:00.000Z",
            claim: "Validate high-impact claim",
            decisionContext: "missing_con_evidence",
            specSectionRef: "spec:validation",
            questionRef: "queue_storage",
            implicationScope: "Preserve as a review item; do not update SpecVersion.",
            staleSensitive: true,
            sourceRequiredAfter: "2026-05-01T00:00:00.000Z"
          })
        ],
        evidenceMatrices: [
          expect.objectContaining({
            balanceStatus: "missing_con_evidence",
            decisionBlocked: true
          })
        ],
        evidencePacks: [
          expect.objectContaining({
            evidencePackId,
            gateStatus: "research_insufficient"
          })
        ],
        reviewCards: [
          expect.objectContaining({
            researchTaskId,
            state: "research_insufficient",
            gateStatus: "research_insufficient",
            retainedSourceRefs: expect.arrayContaining([
              "https://example.com/evidence",
              researchRunId,
              "queue_storage",
              "High-impact claim lacks con evidence."
            ])
          })
        ],
        knownRisks: ["High-impact claim lacks con evidence."]
      });
    } finally {
      await storage.close();
    }
  });

  it("rehydrates conflict-resolution research cards with terminal outcome actions", async () => {
    const { storage } = await createMigratedStorage();

    try {
      const repository = createResearchRepository(storage.db);
      const projectId = "proj_research_conflict_storage" as ProjectId;
      const sessionId = "sess_research_conflict_storage" as SessionId;
      const researchTaskId = "research_task_conflict_storage" as ResearchTaskId;
      const researchResultId = "research_result_conflict_storage" as ResearchResultId;
      const evidencePackId = "evidence_pack_conflict_storage" as DecisionEvidencePackId;

      await repository.saveTask({
        projectId,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        task: {
          researchTaskId,
          sessionId,
          objective: "Resolve conflicting high-impact evidence",
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
          resultSummary: "Pro: supports the claim. Con: credible counter-evidence conflicts with the claim.",
          claim: "Resolve conflicting high-impact evidence",
          decisionContext: "conflict_resolution",
          importedAt: "2026-05-05T00:01:00.000Z"
        }
      });
      await repository.saveEvidenceMatrix({
        projectId,
        sessionId,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        matrix: {
          evidenceMatrixId: "evidence_matrix_conflict_storage",
          researchTaskId,
          researchResultId,
          synthesisVersion: 1,
          proEvidence: [
            {
              evidenceItemId: "evidence_pro_conflict_storage" as EvidenceItemId,
              kind: "pro",
              summary: "The source supports the claim."
            }
          ],
          conEvidence: [
            {
              evidenceItemId: "evidence_con_conflict_storage" as EvidenceItemId,
              kind: "con",
              summary: "A credible source conflicts with the claim."
            }
          ],
          uncertainties: [],
          additionalQuestions: [],
          balanceStatus: "blocked_by_con_evidence",
          decisionBlocked: true,
          missingConEvidenceReason: "Conflicting evidence needs a user decision.",
          knownRisk: "High-impact claim has unresolved conflicting evidence."
        }
      });
      await repository.saveDecisionEvidencePack({
        projectId,
        sessionId,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        pack: {
          evidencePackId,
          researchTaskId,
          researchResultId,
          claim: "Resolve conflicting high-impact evidence",
          decisionContext: "conflict_resolution",
          sourceReliability: "medium",
          retrievedAt: "2026-05-05T00:01:00.000Z",
          gateStatus: "research_insufficient",
          gateChecks: [
            {
              code: "pro_con_balance",
              status: "failed",
              reason: "Conflicting evidence still blocks a deterministic recommendation."
            }
          ],
          proEvidenceItemIds: ["evidence_pro_conflict_storage" as EvidenceItemId],
          conEvidenceItemIds: ["evidence_con_conflict_storage" as EvidenceItemId],
          uncertaintyItemIds: [],
          limitationRefs: [],
          implicationScope: "Ask the user to revise, reject, or accept the risk before Planning-ready.",
          knownRisk: "High-impact claim has unresolved conflicting evidence.",
          createdAt: "2026-05-05T00:01:00.000Z"
        }
      });

      const projection = await repository.getProjection(sessionId);
      const [card] = projection.reviewCards;

      expect(card).toMatchObject({
        researchTaskId,
        evidencePackId,
        cardType: "conflict_resolution",
        availableOutcomes: ["revised", "rejected", "risk_accepted", "research_insufficient", "deferred"],
        suggestedOutcome: "research_insufficient",
        recoveryActions: ["revise_decision", "reject_decision", "accept_risk", "import_manual_result"],
        blocksPlanning: true
      });
    } finally {
      await storage.close();
    }
  });

  it("persists RuntimePreviewArtifact rows and rebuilds the runtime activity projection", async () => {
    const { storage } = await createMigratedStorage();

    try {
      const repository = createRuntimeRepository(storage.db);
      const hintRepository = createPhase15bUpgradeHintRepository(storage.db);
      const projectId = "proj_runtime_storage" as ProjectId;
      const sessionId = "sess_runtime_storage" as SessionId;
      const artifactId = "runtime_artifact_storage" as RuntimeArtifactId;
      const sourceEffectTaskId = "eft_runtime_storage" as EffectTaskId;
      const artifact = {
        artifactId,
        turnPurpose: "implementation_plan_preview",
        kind: "BlockedActionArtifact",
        applyPolicy: "blocked",
        status: "blocked",
        source: "protocol_fixture",
        targetObject: "blocked_action",
        summary: "Forbidden runtime action blocked",
        payload: {
          title: "Forbidden runtime action blocked",
          body: "Command execution is represented as a blocked artifact.",
          targetObject: "blocked_action",
          sourceRefs: ["spec_current"]
        },
        sourceRefs: ["spec_current"],
        contextHash: "ctx_runtime_storage",
        runtimeAdapterVersion: "codex-app-server-preview-v1",
        sourceEffectTaskId,
        blockedAction: {
          actionType: "shell_command",
          reason: "Phase 1 must not execute shell commands."
        },
        createdAt: "2026-05-05T00:00:00.000Z",
        schemaVersion: CONTRACT_SCHEMA_VERSION
      } as const;

      await repository.saveArtifact({
        projectId,
        sessionId,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        artifact
      });
      await expect(hintRepository.getForArtifact(artifactId)).resolves.toBeNull();
      const { blockedAction: _blockedAction, ...unblockedArtifact } = artifact;
      void _blockedAction;

      await repository.saveArtifact({
        projectId,
        sessionId,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        artifact: {
          ...unblockedArtifact,
          kind: "ImplementationPlanPreviewArtifact",
          applyPolicy: "note_only",
          status: "preview_ready",
          targetObject: "PlanningNote",
          summary: "Implementation plan preview ready",
          payload: {
            title: "Implementation plan preview ready",
            body: "Preview only.",
            targetObject: "PlanningNote",
            sourceRefs: ["spec_current"],
            phase15bUpgradeHints: phase15bHintsFixture()
          }
        }
      });

      const savedArtifact = await repository.getArtifact(artifactId);
      const savedHints = await hintRepository.getForArtifact(artifactId);
      const hintRows = await storage.db
        .select()
        .from(phase15bUpgradeHints)
        .where(eq(phase15bUpgradeHints.artifactId, artifactId));
      const projection = await repository.getProjection(sessionId);
      const refs = await storage.db
        .select()
        .from(runtimeTaskRefs)
        .where(eq(runtimeTaskRefs.effectTaskId, sourceEffectTaskId));

      expect(savedArtifact).toMatchObject({
        artifactId,
        kind: "ImplementationPlanPreviewArtifact",
        status: "preview_ready"
      });
      expect(projection).toMatchObject({
        kind: "RuntimeActivityProjection",
        version: 1 as ProjectionVersion,
        runtimeStatus: "available",
        runtimeArtifacts: [
          expect.objectContaining({
            artifactId
          })
        ]
      });
      expect(savedHints).toMatchObject({
        artifactId,
        artifactKind: "ImplementationPlanPreviewArtifact",
        hints: {
          riskNormalization: {
            riskLevel: "medium",
            blockedActionType: "shell_command"
          },
          sourceRefs: expect.arrayContaining([
            expect.objectContaining({ kind: "research_run" }),
            expect.objectContaining({ kind: "evidence_matrix" }),
            expect.objectContaining({ kind: "research_allowlist" }),
            expect.objectContaining({ kind: "research_disclosure_log" })
          ])
        }
      });
      expect(hintRows).toHaveLength(1);
      expect(hintRows[0]).toMatchObject({
        artifactId,
        blockedActionType: "shell_command",
        riskLevel: "medium"
      });
      expect(refs).toHaveLength(1);
      expect(refs[0]).toMatchObject({
        effectTaskId: sourceEffectTaskId,
        artifactId,
        status: "preview_ready"
      });

      await repository.saveArtifact({
        projectId,
        sessionId,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        artifact: {
          ...unblockedArtifact,
          kind: "ImplementationPlanPreviewArtifact",
          applyPolicy: "note_only",
          status: "preview_ready",
          targetObject: "PlanningNote",
          summary: "Implementation plan preview ready",
          payload: {
            title: "Implementation plan preview ready",
            body: "Preview only.",
            targetObject: "PlanningNote",
            sourceRefs: ["spec_current"]
          }
        }
      });

      await expect(hintRepository.getForArtifact(artifactId)).resolves.toBeNull();

      const unsupportedArtifactId = "runtime_artifact_unsupported_hint" as RuntimeArtifactId;

      await expect(
        repository.saveArtifact({
          projectId,
          sessionId,
          schemaVersion: CONTRACT_SCHEMA_VERSION,
          artifact: {
            ...unblockedArtifact,
            artifactId: unsupportedArtifactId,
            turnPurpose: "question_generation",
            kind: "QuestionBatchArtifact",
            applyPolicy: "conditional_auto_apply",
            status: "preview_ready",
            targetObject: "QuestionBatch",
            summary: "Question batch ready",
            contextHash: "ctx_runtime_unsupported_hint",
            payload: {
              title: "Question batch ready",
              body: "Preview only.",
              targetObject: "QuestionBatch",
              sourceRefs: ["spec_current"],
              phase15bUpgradeHints: phase15bHintsFixture()
            }
          }
        })
      ).rejects.toThrow("phase15bUpgradeHints may only be attached");
      await expect(repository.getArtifact(unsupportedArtifactId)).resolves.toBeNull();

      const mismatchedBlockedArtifactId = "runtime_artifact_mismatched_blocked_hint" as RuntimeArtifactId;

      await expect(
        repository.saveArtifact({
          projectId,
          sessionId,
          schemaVersion: CONTRACT_SCHEMA_VERSION,
          artifact: {
            ...unblockedArtifact,
            artifactId: mismatchedBlockedArtifactId,
            kind: "BlockedActionArtifact",
            applyPolicy: "blocked",
            status: "blocked",
            targetObject: "blocked_action",
            summary: "Shell command blocked",
            contextHash: "ctx_runtime_mismatched_blocked_hint",
            blockedAction: {
              actionType: "shell_command",
              reason: "Phase 1.5B records readiness only."
            },
            payload: {
              title: "Shell command blocked",
              body: "Preview only.",
              targetObject: "blocked_action",
              sourceRefs: ["spec_current"],
              phase15bUpgradeHints: phase15bHintsFixture({
                executionIntent: {
                  ...phase15bHintsFixture().executionIntent,
                  candidateActionType: "browser_action"
                },
                riskNormalization: {
                  ...phase15bHintsFixture().riskNormalization,
                  blockedActionType: "browser_action"
                }
              })
            }
          }
        })
      ).rejects.toThrow("phase15bUpgradeHints action type must match");
      await expect(repository.getArtifact(mismatchedBlockedArtifactId)).resolves.toBeNull();
    } finally {
      await storage.close();
    }
  });

  it("bumps source and destination project versions when Phase15b hints move projects", async () => {
    const { storage } = await createMigratedStorage();

    try {
      const repository = createPhase15bUpgradeHintRepository(storage.db);
      const sourceProjectId = "proj_phase15b_hint_source" as ProjectId;
      const destinationProjectId = "proj_phase15b_hint_destination" as ProjectId;
      const sourceSessionId = "sess_phase15b_hint_source" as SessionId;
      const destinationSessionId = "sess_phase15b_hint_destination" as SessionId;
      const artifactId = "runtime_artifact_project_move_hint" as RuntimeArtifactId;

      await repository.saveForArtifact({
        projectId: sourceProjectId,
        sessionId: sourceSessionId,
        artifactId,
        artifactKind: "BlockedActionArtifact",
        hints: phase15bHintsFixture(),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      await expect(repository.collectionVersion(sourceProjectId)).resolves.toBe(1 as ProjectionVersion);
      await expect(repository.collectionVersion(destinationProjectId)).resolves.toBe(0 as ProjectionVersion);

      await repository.saveForArtifact({
        projectId: destinationProjectId,
        sessionId: destinationSessionId,
        artifactId,
        artifactKind: "BlockedActionArtifact",
        hints: phase15bHintsFixture({
          createdAt: "2026-05-06T00:02:00.000Z"
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      await expect(repository.collectionVersion(sourceProjectId)).resolves.toBe(2 as ProjectionVersion);
      await expect(repository.collectionVersion(destinationProjectId)).resolves.toBe(1 as ProjectionVersion);
      await expect(repository.listForProject(sourceProjectId)).resolves.toEqual([]);
      await expect(repository.listForProject(destinationProjectId)).resolves.toMatchObject([{ artifactId }]);
    } finally {
      await storage.close();
    }
  });

  it("stores Phase15bUpgradeHints as dedicated readiness records without broadening artifact kinds", async () => {
    const { storage } = await createMigratedStorage();

    try {
      const repository = createPhase15bUpgradeHintRepository(storage.db);
      const projectId = "proj_phase15b_hint_storage" as ProjectId;
      const sessionId = "sess_phase15b_hint_storage" as SessionId;
      const artifactId = "runtime_artifact_blocked_hint" as RuntimeArtifactId;

      await repository.saveForArtifact({
        projectId,
        sessionId,
        artifactId,
        artifactKind: "BlockedActionArtifact",
        hints: phase15bHintsFixture({
          sourceRefs: [
            {
              kind: "blocked_action",
              refId: "runtime_artifact_blocked_hint",
              label: "BlockedActionArtifact"
            },
            ...phase15bHintsFixture().sourceRefs
          ]
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      await repository.saveForArtifact({
        projectId,
        sessionId,
        artifactId: "runtime_artifact_earlier_hint" as RuntimeArtifactId,
        artifactKind: "ImplementationPlanPreviewArtifact",
        hints: phase15bHintsFixture({
          createdAt: "2026-05-05T23:59:00.000Z"
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      await expect(repository.collectionVersion(projectId)).resolves.toBe(2 as ProjectionVersion);
      await expect(repository.listForSession(sessionId)).resolves.toMatchObject([
        { artifactId: "runtime_artifact_earlier_hint" },
        { artifactId }
      ]);
      await expect(repository.getForArtifact(artifactId)).resolves.toMatchObject({
        artifactId,
        artifactKind: "BlockedActionArtifact",
        hints: {
          sourceRefs: expect.arrayContaining([expect.objectContaining({ kind: "blocked_action" })])
        }
      });
      await repository.saveForArtifact({
        projectId,
        sessionId,
        artifactId,
        artifactKind: "BlockedActionArtifact",
        hints: phase15bHintsFixture({
          createdAt: "2026-05-06T00:01:00.000Z"
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });
      await expect(repository.collectionVersion(projectId)).resolves.toBe(3 as ProjectionVersion);
      await repository.deleteForArtifact("runtime_artifact_earlier_hint" as RuntimeArtifactId);
      await expect(repository.collectionVersion(projectId)).resolves.toBe(4 as ProjectionVersion);
      await expect(repository.listForSession(sessionId)).resolves.toMatchObject([{ artifactId }]);
      await expect(
        repository.saveForArtifact({
          projectId,
          sessionId,
          artifactId: "runtime_artifact_question_hint" as RuntimeArtifactId,
          artifactKind: "QuestionBatchArtifact",
          hints: phase15bHintsFixture(),
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).rejects.toThrow("phase15bUpgradeHints may only be attached");
    } finally {
      await storage.close();
    }
  });
});
