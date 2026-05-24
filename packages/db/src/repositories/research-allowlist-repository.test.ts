import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  AUTOMATIC_RESEARCH_SOURCE_CATEGORIES,
  CONTRACT_SCHEMA_VERSION,
  DEFAULT_RESEARCH_DISCLOSURE_LOG_POLICY,
  DEFAULT_RESEARCH_RATE_BUDGET_POLICY,
  DEFAULT_RESEARCH_STALENESS_POLICY,
  MANUAL_RESEARCH_SOURCE_CATEGORIES,
  type ProjectId,
  type ProjectionVersion,
  type ResearchAllowlistId,
  type ResearchAllowlistProjection,
  type ResearchConnectorId
} from "@solo-superman/contracts";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "../client";
import { removeTemporaryDirectory } from "../test-cleanup";
import { createResearchAllowlistRepository } from "./research-allowlist-repository";

const tempDirs: string[] = [];

async function makeTempAppDataDir() {
  const tempDir = await mkdtemp(join(tmpdir(), "solo-superman-allowlist-test-"));

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

function allowlistFixture(overrides: Partial<ResearchAllowlistProjection> = {}): ResearchAllowlistProjection {
  return {
    kind: "ResearchAllowlistProjection",
    version: 1 as ProjectionVersion,
    allowlistId: "research_allowlist_db" as ResearchAllowlistId,
    projectId: "proj_allowlist_db" as ProjectId,
    status: "active",
    connectorIds: ["public_search" as ResearchConnectorId],
    sourceCategories: ["public_web", "official_docs"],
    contextMode: "public_safe_summary",
    rateBudgetPolicy: DEFAULT_RESEARCH_RATE_BUDGET_POLICY,
    stalenessPolicy: DEFAULT_RESEARCH_STALENESS_POLICY,
    disclosureLogPolicy: DEFAULT_RESEARCH_DISCLOSURE_LOG_POLICY,
    approvedBy: "owner_allowlist_db",
    approvedAt: "2026-05-05T00:00:00.000Z",
    createdAt: "2026-05-05T00:00:00.000Z",
    updatedAt: "2026-05-05T00:00:00.000Z",
    ...overrides
  };
}

describe("Research allowlist repository", () => {
  it("stores and queries active, paused, and revoked allowlists locally", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createResearchAllowlistRepository(storage.db);
      const projectId = "proj_allowlist_status" as ProjectId;

      await repository.create({
        allowlist: allowlistFixture({
          allowlistId: "research_allowlist_active" as ResearchAllowlistId,
          projectId,
          status: "active"
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });
      await repository.create({
        allowlist: allowlistFixture({
          allowlistId: "research_allowlist_paused" as ResearchAllowlistId,
          projectId,
          version: 2 as ProjectionVersion,
          status: "paused",
          pausedAt: "2026-05-05T00:03:00.000Z",
          updatedAt: "2026-05-05T00:03:00.000Z"
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });
      await repository.create({
        allowlist: allowlistFixture({
          allowlistId: "research_allowlist_revoked" as ResearchAllowlistId,
          projectId,
          status: "revoked",
          revokedAt: "2026-05-05T00:04:00.000Z",
          updatedAt: "2026-05-05T00:04:00.000Z"
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      const allowlists = await repository.listForProject(projectId);
      const statuses = new Set(allowlists.map((allowlist) => allowlist.status));
      const paused = await repository.getById(projectId, "research_allowlist_paused" as ResearchAllowlistId);
      const revoked = await repository.getById(projectId, "research_allowlist_revoked" as ResearchAllowlistId);

      expect(statuses).toEqual(new Set(["active", "paused", "revoked"]));
      expect(paused).toMatchObject({
        version: 2,
        status: "paused",
        pausedAt: "2026-05-05T00:03:00.000Z"
      });
      expect(revoked).toMatchObject({
        status: "revoked",
        revokedAt: "2026-05-05T00:04:00.000Z"
      });
    } finally {
      await storage.close();
    }
  });

  it("persists the per-session run budget with the rate policy", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createResearchAllowlistRepository(storage.db);
      const allowlistId = "research_allowlist_rate_budget" as ResearchAllowlistId;
      const projectId = "proj_allowlist_rate_budget" as ProjectId;

      await repository.create({
        allowlist: allowlistFixture({
          allowlistId,
          projectId,
          rateBudgetPolicy: {
            ...DEFAULT_RESEARCH_RATE_BUDGET_POLICY,
            maxRunsPerSession: 6
          }
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      await expect(repository.getById(projectId, allowlistId)).resolves.toMatchObject({
        rateBudgetPolicy: {
          maxConcurrentRunsPerProject: 2,
          maxRunsPerSession: 6,
          maxAutomaticRetriesPerRun: 2
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("updates allowlists only when the expected version still matches", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createResearchAllowlistRepository(storage.db);
      const allowlistId = "research_allowlist_version_guard" as ResearchAllowlistId;
      const projectId = "proj_allowlist_version_guard" as ProjectId;

      await repository.create({
        allowlist: allowlistFixture({
          allowlistId,
          projectId
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      await expect(
        repository.update({
          allowlist: allowlistFixture({
            allowlistId,
            projectId,
            version: 2 as ProjectionVersion,
            status: "paused",
            pausedAt: "2026-05-05T00:06:00.000Z",
            updatedAt: "2026-05-05T00:06:00.000Z"
          }),
          expectedVersion: 1 as ProjectionVersion,
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).resolves.toMatchObject({
        version: 2,
        status: "paused"
      });

      await expect(
        repository.update({
          allowlist: allowlistFixture({
            allowlistId,
            projectId,
            version: 3 as ProjectionVersion,
            status: "revoked",
            revokedAt: "2026-05-05T00:07:00.000Z",
            updatedAt: "2026-05-05T00:07:00.000Z"
          }),
          expectedVersion: 1 as ProjectionVersion,
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).resolves.toBeNull();

      await expect(repository.getById(projectId, allowlistId)).resolves.toMatchObject({
        version: 2,
        status: "paused"
      });
    } finally {
      await storage.close();
    }
  });

  it("round-trips every automatic source category", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createResearchAllowlistRepository(storage.db);
      const allowlistId = "research_allowlist_all_sources" as ResearchAllowlistId;
      const projectId = "proj_allowlist_all_sources" as ProjectId;

      await repository.create({
        allowlist: allowlistFixture({
          allowlistId,
          projectId,
          sourceCategories: AUTOMATIC_RESEARCH_SOURCE_CATEGORIES
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      await expect(repository.getById(projectId, allowlistId)).resolves.toMatchObject({
        sourceCategories: [
          "public_web",
          "official_docs",
          "public_dataset",
          "academic_source",
          "user_provided_public_url"
        ]
      });
    } finally {
      await storage.close();
    }
  });

  it("requires project scope when querying an allowlist by id", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createResearchAllowlistRepository(storage.db);
      const allowlistId = "research_allowlist_project_scoped" as ResearchAllowlistId;
      const ownerProjectId = "proj_allowlist_owner" as ProjectId;
      const otherProjectId = "proj_allowlist_other" as ProjectId;

      await repository.create({
        allowlist: allowlistFixture({
          allowlistId,
          projectId: ownerProjectId
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });
      await repository.create({
        allowlist: allowlistFixture({
          allowlistId,
          projectId: otherProjectId,
          status: "paused",
          pausedAt: "2026-05-05T00:05:00.000Z",
          updatedAt: "2026-05-05T00:05:00.000Z"
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      await expect(repository.getById(ownerProjectId, allowlistId)).resolves.toMatchObject({
        allowlistId,
        projectId: ownerProjectId,
        status: "active"
      });
      await expect(repository.getById(otherProjectId, allowlistId)).resolves.toMatchObject({
        allowlistId,
        projectId: otherProjectId,
        status: "paused"
      });
    } finally {
      await storage.close();
    }
  });

  it("rejects unsupported source category and context combinations before persistence", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createResearchAllowlistRepository(storage.db);

      for (const blockedCategory of MANUAL_RESEARCH_SOURCE_CATEGORIES) {
        await expect(
          repository.create({
            allowlist: allowlistFixture({
              sourceCategories: [blockedCategory] as unknown as ResearchAllowlistProjection["sourceCategories"]
            }),
            schemaVersion: CONTRACT_SCHEMA_VERSION
          })
        ).rejects.toThrow("Unsupported source categories");
      }

      await expect(
        repository.create({
          allowlist: allowlistFixture({
            contextMode: "raw_context" as ResearchAllowlistProjection["contextMode"]
          }),
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).rejects.toThrow("public_safe_summary");

      await expect(
        repository.create({
          allowlist: allowlistFixture({
            status: "archived" as ResearchAllowlistProjection["status"]
          }),
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).rejects.toThrow("active, paused, or revoked");
    } finally {
      await storage.close();
    }
  });

  it("rejects secret-like connector values and leaves no libSQL row behind", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createResearchAllowlistRepository(storage.db);

      await expect(
        repository.create({
          allowlist: allowlistFixture({
            allowlistId: "research_allowlist_secret" as ResearchAllowlistId,
            connectorIds: ["sk-secret-api-key" as ResearchConnectorId]
          }),
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).rejects.toThrow("secret");

      const rows = await storage.client.execute("SELECT connector_ids_json FROM research_allowlists");

      expect(rows.rows).toHaveLength(0);
    } finally {
      await storage.close();
    }
  });

  it("returns null for duplicate creates and rejects unsafe updates without replacing the existing row", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createResearchAllowlistRepository(storage.db);
      const allowlistId = "research_allowlist_safe_upsert" as ResearchAllowlistId;
      const projectId = "proj_allowlist_safe_upsert" as ProjectId;

      await repository.create({
        allowlist: allowlistFixture({
          allowlistId,
          projectId,
          connectorIds: ["public_search" as ResearchConnectorId],
          sourceCategories: ["public_web"]
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      await expect(
        repository.create({
          allowlist: allowlistFixture({
            allowlistId,
            projectId,
            connectorIds: ["official_docs" as ResearchConnectorId],
            sourceCategories: ["official_docs"],
            updatedAt: "2026-05-05T00:09:00.000Z"
          }),
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).resolves.toBeNull();

      await expect(
        repository.update({
          allowlist: allowlistFixture({
            allowlistId,
            projectId,
            version: 2 as ProjectionVersion,
            connectorIds: ["sk-secret-api-key" as ResearchConnectorId],
            sourceCategories: ["public_dataset"],
            updatedAt: "2026-05-05T00:10:00.000Z"
          }),
          expectedVersion: 1 as ProjectionVersion,
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).rejects.toThrow("secret");

      await expect(
        repository.update({
          allowlist: allowlistFixture({
            allowlistId,
            projectId,
            version: 2 as ProjectionVersion,
            sourceCategories: ["account_session_source"] as unknown as ResearchAllowlistProjection["sourceCategories"],
            updatedAt: "2026-05-05T00:11:00.000Z"
          }),
          expectedVersion: 1 as ProjectionVersion,
          schemaVersion: CONTRACT_SCHEMA_VERSION
        })
      ).rejects.toThrow("Unsupported source categories");

      const rows = await storage.client.execute("SELECT connector_ids_json FROM research_allowlists");

      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0]?.connector_ids_json).toBe("[\"public_search\"]");
      await expect(repository.getById(projectId, allowlistId)).resolves.toMatchObject({
        connectorIds: ["public_search"],
        sourceCategories: ["public_web"],
        updatedAt: "2026-05-05T00:00:00.000Z"
      });
    } finally {
      await storage.close();
    }
  });
});
