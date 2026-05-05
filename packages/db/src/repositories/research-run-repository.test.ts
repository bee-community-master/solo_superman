import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildResearchRunIdempotencyKey,
  CONTRACT_SCHEMA_VERSION,
  type ProjectId,
  type ProjectionVersion,
  type ResearchAllowlistId,
  type ResearchConnectorId,
  type ResearchDisclosureLogId,
  type ResearchRunId,
  type ResearchRunProjection,
  type ResearchTaskId
} from "@solo-superman/contracts";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "../client";
import { createResearchRunRepository } from "./research-run-repository";

const tempDirs: string[] = [];

async function makeTempAppDataDir() {
  const tempDir = await mkdtemp(join(tmpdir(), "solo-superman-research-run-test-"));

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

function idempotencyKey(attempt = 1) {
  return buildResearchRunIdempotencyKey({
    taskObjective: "Compare public onboarding proof.",
    connectorId: "public_search" as ResearchConnectorId,
    contextHash: "ctx_research_run_db",
    allowlistVersion: 1 as ProjectionVersion,
    attempt
  });
}

function runFixture(overrides: Partial<ResearchRunProjection> = {}): ResearchRunProjection {
  const researchRunId = (overrides.researchRunId ?? "research_run_db") as ResearchRunId;
  const researchTaskId = (overrides.researchTaskId ?? "research_task_db") as ResearchTaskId;

  return {
    kind: "ResearchRunProjection",
    version: 1 as ProjectionVersion,
    researchRunId,
    projectId: "proj_research_run_db" as ProjectId,
    researchTaskId,
    allowlistId: "research_allowlist_db" as ResearchAllowlistId,
    disclosureLogId: "research_disclosure_db" as ResearchDisclosureLogId,
    connectorId: "public_search" as ResearchConnectorId,
    sourceCategory: "public_web",
    status: "queued",
    provider: {
      researchRunId,
      researchTaskId,
      adapterKind: "web_search_readonly",
      adapterVersion: "solo-superman.research-runtime.v1",
      sourceCategory: "public_web",
      idempotencyKey: idempotencyKey(),
      attempt: 1
    },
    qualityGateStatus: "not_evaluated",
    sourceRefs: ["queue_item_db"],
    createdAt: "2026-05-05T00:00:00.000Z",
    updatedAt: "2026-05-05T00:00:00.000Z",
    ...overrides
  } as ResearchRunProjection;
}

describe("Research run repository", () => {
  it("persists provider-neutral run references without credential fields", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createResearchRunRepository(storage.db);
      const projectId = "proj_research_run_persist" as ProjectId;
      const researchRunId = "research_run_persist" as ResearchRunId;

      await expect(
        repository.create({
          run: runFixture({ projectId, researchRunId }),
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).resolves.toMatchObject({
        researchRunId,
        status: "queued",
        provider: {
          adapterKind: "web_search_readonly",
          idempotencyKey: expect.stringContaining("objective=Compare+public+onboarding+proof.")
        }
      });

      const rows = await storage.client.execute("SELECT * FROM research_runs");
      const serializedRows = JSON.stringify(rows.rows);

      expect(serializedRows).not.toContain("api_key");
      expect(serializedRows).not.toContain("sk-");
      await expect(repository.getById(projectId, researchRunId)).resolves.toMatchObject({
        connectorId: "public_search",
        sourceCategory: "public_web",
        sourceRefs: ["queue_item_db"]
      });
    } finally {
      await storage.close();
    }
  });

  it("enforces same-run transitions and expected version updates", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createResearchRunRepository(storage.db);
      const projectId = "proj_research_run_transition" as ProjectId;
      const researchRunId = "research_run_transition" as ResearchRunId;

      await repository.create({
        run: runFixture({ projectId, researchRunId }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      await expect(
        repository.update({
          run: runFixture({
            projectId,
            researchRunId,
            version: 1 as ProjectionVersion,
            status: "running",
            provider: {
              ...runFixture({ researchRunId }).provider,
              providerRunId: "provider_run_same_version",
              startedAt: "2026-05-05T00:01:00.000Z"
            },
            updatedAt: "2026-05-05T00:01:00.000Z"
          }),
          expectedVersion: 1 as ProjectionVersion,
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).rejects.toThrow("version must increment exactly once");

      const running = await repository.update({
        run: runFixture({
          projectId,
          researchRunId,
          version: 2 as ProjectionVersion,
          status: "running",
          provider: {
            ...runFixture({ researchRunId }).provider,
            providerRunId: "provider_run_transition",
            startedAt: "2026-05-05T00:01:00.000Z"
          },
          updatedAt: "2026-05-05T00:01:00.000Z"
        }),
        expectedVersion: 1 as ProjectionVersion,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      expect(running).toMatchObject({
        version: 2,
        status: "running",
        provider: { providerRunId: "provider_run_transition" }
      });

      await expect(
        repository.update({
          run: runFixture({
            projectId,
            researchRunId,
            version: 3 as ProjectionVersion,
            status: "failed",
            provider: {
              ...runFixture({ researchRunId }).provider,
              providerRunId: "provider_run_transition",
              startedAt: "2026-05-05T00:01:00.000Z",
              completedAt: "2026-05-05T00:02:00.000Z"
            },
            terminalReason: "timeout",
            updatedAt: "2026-05-05T00:02:00.000Z"
          }),
          expectedVersion: 1 as ProjectionVersion,
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).resolves.toBeNull();

      await expect(
        repository.update({
          run: runFixture({
            projectId,
            researchRunId,
            version: 3 as ProjectionVersion,
            status: "accepted",
            provider: {
              ...runFixture({ researchRunId }).provider,
              providerRunId: "provider_run_transition",
              startedAt: "2026-05-05T00:01:00.000Z",
              completedAt: "2026-05-05T00:02:00.000Z"
            },
            qualityGateStatus: "passed",
            terminalReason: "quality_gate_accepted",
            updatedAt: "2026-05-05T00:02:00.000Z"
          }),
          expectedVersion: 2 as ProjectionVersion,
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).rejects.toThrow("running to accepted");

      await expect(repository.getById(projectId, researchRunId)).resolves.toMatchObject({
        version: 2,
        status: "running"
      });
    } finally {
      await storage.close();
    }
  });

  it("persists queued cancellation without forcing a provider start timestamp", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createResearchRunRepository(storage.db);
      const projectId = "proj_research_run_queued_cancel" as ProjectId;
      const researchRunId = "research_run_queued_cancel" as ResearchRunId;

      await repository.create({
        run: runFixture({ projectId, researchRunId }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      const cancelled = await repository.update({
        run: runFixture({
          projectId,
          researchRunId,
          version: 2 as ProjectionVersion,
          status: "cancelled",
          provider: {
            ...runFixture({ researchRunId }).provider,
            completedAt: "2026-05-05T00:02:00.000Z"
          },
          terminalReason: "cancelled_by_user",
          updatedAt: "2026-05-05T00:02:00.000Z"
        }),
        expectedVersion: 1 as ProjectionVersion,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      expect(cancelled).toMatchObject({
        version: 2,
        status: "cancelled",
        terminalReason: "cancelled_by_user",
        provider: {
          completedAt: "2026-05-05T00:02:00.000Z"
        }
      });
      expect(cancelled?.provider.startedAt).toBeUndefined();
    } finally {
      await storage.close();
    }
  });

  it("recovers existing runs for idempotent create replays while keeping id collisions distinct", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createResearchRunRepository(storage.db);
      const projectId = "proj_research_run_idempotent" as ProjectId;
      const idempotentKey = idempotencyKey();

      const original = await repository.create({
        run: runFixture({
          projectId,
          researchRunId: "research_run_idempotent_original" as ResearchRunId
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      expect(original).toMatchObject({
        researchRunId: "research_run_idempotent_original",
        provider: { idempotencyKey: idempotentKey }
      });

      await expect(
        repository.create({
          run: runFixture({
            projectId,
            researchRunId: "research_run_idempotent_replay" as ResearchRunId
          }),
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).resolves.toMatchObject({
        researchRunId: "research_run_idempotent_original",
        provider: { idempotencyKey: idempotentKey }
      });

      await expect(
        repository.getByProjectIdAndIdempotencyKey(projectId, idempotentKey)
      ).resolves.toMatchObject({
        researchRunId: "research_run_idempotent_original"
      });

      await expect(
        repository.create({
          run: runFixture({
            projectId,
            researchRunId: "research_run_idempotent_original" as ResearchRunId,
            provider: {
              ...runFixture({ researchRunId: "research_run_idempotent_original" as ResearchRunId }).provider,
              idempotencyKey: idempotencyKey(2),
              attempt: 2
            }
          }),
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).resolves.toBeNull();

      await expect(
        repository.create({
          run: runFixture({
            projectId: "proj_research_run_idempotent_other" as ProjectId,
            researchRunId: "research_run_idempotent_other_project" as ResearchRunId
          }),
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).resolves.toMatchObject({
        projectId: "proj_research_run_idempotent_other",
        provider: { idempotencyKey: idempotentKey }
      });
    } finally {
      await storage.close();
    }
  });

  it("rejects same-run updates that mutate creation-time provider identity", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createResearchRunRepository(storage.db);
      const projectId = "proj_research_run_stable_identity" as ProjectId;
      const researchRunId = "research_run_stable_identity" as ResearchRunId;

      await repository.create({
        run: runFixture({ projectId, researchRunId }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      await expect(
        repository.update({
          run: runFixture({
            projectId,
            researchRunId,
            researchTaskId: "research_task_mutated" as ResearchTaskId,
            version: 2 as ProjectionVersion,
            status: "running",
            provider: {
              ...runFixture({
                researchRunId,
                researchTaskId: "research_task_mutated" as ResearchTaskId
              }).provider,
              providerRunId: "provider_run_mutated_task",
              startedAt: "2026-05-05T00:01:00.000Z"
            },
            updatedAt: "2026-05-05T00:01:00.000Z"
          }),
          expectedVersion: 1 as ProjectionVersion,
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).rejects.toThrow("researchTaskId cannot change");

      await expect(repository.getById(projectId, researchRunId)).resolves.toMatchObject({
        version: 1,
        researchTaskId: "research_task_db",
        status: "queued"
      });
    } finally {
      await storage.close();
    }
  });

  it("stores manual retry as a new run id with incremented attempt and prior run trace", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createResearchRunRepository(storage.db);
      const projectId = "proj_research_run_retry" as ProjectId;
      const researchTaskId = "research_task_retry" as ResearchTaskId;

      await repository.create({
        run: runFixture({
          projectId,
          researchTaskId,
          researchRunId: "research_run_retry_original" as ResearchRunId,
          status: "failed",
          provider: {
            ...runFixture({ researchRunId: "research_run_retry_original" as ResearchRunId, researchTaskId }).provider,
            providerRunId: "provider_run_failed",
            startedAt: "2026-05-05T00:01:00.000Z",
            completedAt: "2026-05-05T00:10:00.000Z"
          },
          terminalReason: "timeout",
          createdAt: "2026-05-05T00:00:00.000Z",
          updatedAt: "2026-05-05T00:10:00.000Z"
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      await expect(
        repository.create({
          run: runFixture({
            projectId,
            researchTaskId,
            researchRunId: "research_run_retry_wrong_attempt" as ResearchRunId,
            provider: {
              ...runFixture({ researchRunId: "research_run_retry_wrong_attempt" as ResearchRunId, researchTaskId })
                .provider,
              idempotencyKey: idempotencyKey(3),
              attempt: 3
            },
            retryOfRunId: "research_run_retry_original" as ResearchRunId,
            retryReason: "Manual retry attempt should be exactly one higher."
          }),
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).rejects.toThrow("increment exactly once");

      await repository.create({
        run: runFixture({
          projectId,
          researchTaskId,
          researchRunId: "research_run_retry_second" as ResearchRunId,
          provider: {
            ...runFixture({ researchRunId: "research_run_retry_second" as ResearchRunId, researchTaskId }).provider,
            idempotencyKey: idempotencyKey(2),
            attempt: 2
          },
          retryOfRunId: "research_run_retry_original" as ResearchRunId,
          retryReason: "Manual retry after timeout.",
          createdAt: "2026-05-05T00:11:00.000Z",
          updatedAt: "2026-05-05T00:11:00.000Z"
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      await expect(repository.listForResearchTask(researchTaskId)).resolves.toMatchObject([
        { researchRunId: "research_run_retry_original", status: "failed", provider: { attempt: 1 } },
        {
          researchRunId: "research_run_retry_second",
          status: "queued",
          retryOfRunId: "research_run_retry_original",
          retryReason: "Manual retry after timeout.",
          provider: { attempt: 2 }
        }
      ]);
    } finally {
      await storage.close();
    }
  });

  it("rejects manual retry records without a retryable prior terminal run", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createResearchRunRepository(storage.db);
      const projectId = "proj_research_run_retry_guard" as ProjectId;
      const researchTaskId = "research_task_retry_guard" as ResearchTaskId;

      await repository.create({
        run: runFixture({
          projectId,
          researchTaskId,
          researchRunId: "research_run_retry_guard_queued" as ResearchRunId
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      await expect(
        repository.create({
          run: runFixture({
            projectId,
            researchTaskId,
            researchRunId: "research_run_retry_guard_second" as ResearchRunId,
            provider: {
              ...runFixture({ researchRunId: "research_run_retry_guard_second" as ResearchRunId, researchTaskId })
                .provider,
              idempotencyKey: idempotencyKey(2),
              attempt: 2
            },
            retryOfRunId: "research_run_retry_guard_queued" as ResearchRunId,
            retryReason: "Manual retry should only start from a retryable terminal run."
          }),
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).rejects.toThrow("prior failed, stale, or research_insufficient");

      await expect(
        repository.create({
          run: runFixture({
            projectId,
            researchTaskId,
            researchRunId: "research_run_retry_guard_missing" as ResearchRunId,
            provider: {
              ...runFixture({ researchRunId: "research_run_retry_guard_missing" as ResearchRunId, researchTaskId })
                .provider,
              idempotencyKey: idempotencyKey(2),
              attempt: 2
            },
            retryOfRunId: "research_run_retry_guard_absent" as ResearchRunId,
            retryReason: "Manual retry requires a persisted prior run."
          }),
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).rejects.toThrow("prior failed, stale, or research_insufficient");
    } finally {
      await storage.close();
    }
  });
});
