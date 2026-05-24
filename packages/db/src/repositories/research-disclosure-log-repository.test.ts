import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  type ProjectId,
  type ResearchAllowlistId,
  type ResearchConnectorId,
  type ResearchDisclosureLogEntry,
  type ResearchDisclosureLogId
} from "@solo-superman/contracts";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "../client";
import { removeTemporaryDirectory } from "../test-cleanup";
import { createResearchDisclosureLogRepository } from "./research-disclosure-log-repository";

const tempDirs: string[] = [];

async function makeTempAppDataDir() {
  const tempDir = await mkdtemp(join(tmpdir(), "solo-superman-disclosure-test-"));

  tempDirs.push(tempDir);

  return tempDir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(removeTemporaryDirectory));
});

type DisclosureLogFixtureOverrides = Partial<Omit<ResearchDisclosureLogEntry, "allowlistId">> & {
  readonly allowlistId?: ResearchAllowlistId | undefined;
};

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

function disclosureLogFixture(overrides: DisclosureLogFixtureOverrides = {}): ResearchDisclosureLogEntry {
  const entry = {
    logId: "research_disclosure_db" as ResearchDisclosureLogId,
    projectId: "proj_disclosure_db" as ProjectId,
    allowlistId: "research_allowlist_db" as ResearchAllowlistId,
    connectorId: "public_search" as ResearchConnectorId,
    sourceCategory: "public_web",
    researchObjective: "Find public source evidence.",
    objectiveSummary: "Find public source evidence.",
    publicSafeSummarySent:
      "Product category: founder workflow assistant. Customer/problem hypothesis: founders need safer research. Research objective: Find public source evidence.",
    sourceRefs: ["queue_item_db"],
    automaticExternalTransferAllowed: true,
    status: "automatic_payload_ready",
    createdAt: "2026-05-05T00:00:00.000Z",
    ...overrides
  } as Record<string, unknown>;

  for (const key of ["allowlistId", "blockReason", "manualHandoffReason"]) {
    if (entry[key] === undefined) {
      delete entry[key];
    }
  }

  return entry as unknown as ResearchDisclosureLogEntry;
}

describe("Research disclosure log repository", () => {
  it("persists and queries automatic disclosure logs by project", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createResearchDisclosureLogRepository(storage.db);
      const projectId = "proj_disclosure_query" as ProjectId;

      await repository.create({
        log: disclosureLogFixture({
          projectId,
          logId: "research_disclosure_first" as ResearchDisclosureLogId,
          createdAt: "2026-05-05T00:01:00.000Z"
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });
      await repository.create({
        log: disclosureLogFixture({
          projectId,
          logId: "research_disclosure_second" as ResearchDisclosureLogId,
          connectorId: "official_docs" as ResearchConnectorId,
          sourceCategory: "official_docs",
          sourceRefs: ["docs_30"],
          createdAt: "2026-05-05T00:02:00.000Z"
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      await expect(repository.getProjection(projectId)).resolves.toMatchObject({
        kind: "ResearchDisclosureLogProjection",
        version: 2,
        projectId,
        refetchUrl: `/api/v1/projects/${projectId}/research-disclosures`,
        disclosureLogs: [
          expect.objectContaining({
            logId: "research_disclosure_first",
            publicSafeSummarySent: expect.stringContaining("Product category")
          }),
          expect.objectContaining({
            logId: "research_disclosure_second",
            connectorId: "official_docs",
            sourceRefs: ["docs_30"]
          })
        ],
        latestDisclosureLog: expect.objectContaining({
          logId: "research_disclosure_second"
        })
      });
    } finally {
      await storage.close();
    }
  });

  it("persists blocked manual-handoff disclosure logs without private payload", async () => {
    const storage = await createMigratedStorage();

    try {
      const repository = createResearchDisclosureLogRepository(storage.db);
      const projectId = "proj_disclosure_blocked" as ProjectId;

      await repository.create({
        log: disclosureLogFixture({
          projectId,
          allowlistId: undefined,
          sourceCategory: "credentialed_source",
          automaticExternalTransferAllowed: false,
          status: "blocked_manual_handoff",
          blockReason: "manual_source_category",
          manualHandoffReason: "credentialed_source requires task-level approval or manual handoff.",
          publicSafeSummarySent: "Research objective: Find public source evidence."
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      const rows = await storage.client.execute("SELECT * FROM research_disclosure_logs");
      const serializedRows = JSON.stringify(rows.rows);

      expect(serializedRows).not.toContain("raw private idea");
      expect(rows.rows[0]).toMatchObject({
        allowlist_id: null,
        status: "blocked_manual_handoff",
        automatic_external_transfer_allowed: 0,
        block_reason: "manual_source_category"
      });
      await expect(repository.getProjection(projectId)).resolves.toMatchObject({
        disclosureLogs: [
          expect.objectContaining({
            status: "blocked_manual_handoff",
            automaticExternalTransferAllowed: false,
            manualHandoffReason: "credentialed_source requires task-level approval or manual handoff."
          })
        ]
      });
    } finally {
      await storage.close();
    }
  });
});
