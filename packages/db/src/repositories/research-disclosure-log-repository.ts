import { eq } from "drizzle-orm";
import type {
  ProjectId,
  ProjectionVersion,
  ResearchAllowlistId,
  ResearchConnectorId,
  ResearchDisclosureLogEntry,
  ResearchDisclosureLogId,
  ResearchDisclosureLogProjection,
  ResearchDisclosureLogStatus,
  ResearchSourceCategory,
  SchemaVersion
} from "@solo-superman/contracts";
import { validateResearchDisclosureLogEntry } from "@solo-superman/contracts";
import type { SoloDatabaseExecutor } from "../client";
import { parseJsonArray, stringifyJson } from "../json";
import { researchDisclosureLogs } from "../schema";

export interface SaveResearchDisclosureLogInput {
  readonly log: ResearchDisclosureLogEntry;
  readonly schemaVersion: SchemaVersion;
}

function disclosureRefetchUrl(projectId: ProjectId) {
  return `/api/v1/projects/${projectId}/research-disclosures`;
}

function mapDisclosureLog(row: typeof researchDisclosureLogs.$inferSelect): ResearchDisclosureLogEntry {
  const entry = {
    logId: row.id as ResearchDisclosureLogId,
    projectId: row.projectId as ProjectId,
    ...(row.allowlistId ? { allowlistId: row.allowlistId as ResearchAllowlistId } : {}),
    connectorId: row.connectorId as ResearchConnectorId,
    sourceCategory: row.sourceCategory as ResearchSourceCategory,
    researchObjective: row.researchObjective,
    objectiveSummary: row.objectiveSummary,
    publicSafeSummarySent: row.publicSafeSummarySent,
    sourceRefs: parseJsonArray(row.sourceRefsJson, "sourceRefsJson").map(String),
    automaticExternalTransferAllowed: row.automaticExternalTransferAllowed,
    status: row.status as ResearchDisclosureLogStatus,
    ...(row.blockReason ? { blockReason: row.blockReason as ResearchDisclosureLogEntry["blockReason"] } : {}),
    ...(row.manualHandoffReason ? { manualHandoffReason: row.manualHandoffReason } : {}),
    createdAt: row.createdAt
  } as ResearchDisclosureLogEntry;

  return validateResearchDisclosureLogEntry(entry);
}

function projectionFromLogs(
  projectId: ProjectId,
  logs: readonly ResearchDisclosureLogEntry[],
  generatedAt: string
): ResearchDisclosureLogProjection {
  const latestDisclosureLog = logs.at(-1);

  return {
    kind: "ResearchDisclosureLogProjection",
    version: logs.length as ProjectionVersion,
    projectId,
    generatedAt,
    stale: false,
    refetchUrl: disclosureRefetchUrl(projectId),
    disclosureLogs: logs,
    ...(latestDisclosureLog ? { latestDisclosureLog } : {})
  };
}

export function createResearchDisclosureLogRepository(db: SoloDatabaseExecutor) {
  async function listForProject(projectId: ProjectId): Promise<readonly ResearchDisclosureLogEntry[]> {
    const rows = await db
      .select()
      .from(researchDisclosureLogs)
      .where(eq(researchDisclosureLogs.projectId, projectId))
      .orderBy(researchDisclosureLogs.createdAt, researchDisclosureLogs.id);

    return rows.map(mapDisclosureLog);
  }

  return {
    async create(input: SaveResearchDisclosureLogInput): Promise<ResearchDisclosureLogEntry> {
      const log = validateResearchDisclosureLogEntry(input.log);

      await db
        .insert(researchDisclosureLogs)
        .values({
          id: log.logId,
          projectId: log.projectId,
          allowlistId: log.allowlistId ?? null,
          connectorId: log.connectorId,
          sourceCategory: log.sourceCategory,
          researchObjective: log.researchObjective,
          objectiveSummary: log.objectiveSummary,
          publicSafeSummarySent: log.publicSafeSummarySent,
          sourceRefsJson: stringifyJson(log.sourceRefs),
          automaticExternalTransferAllowed: log.automaticExternalTransferAllowed,
          status: log.status,
          blockReason: log.blockReason ?? null,
          manualHandoffReason: log.manualHandoffReason ?? null,
          createdAt: log.createdAt,
          schemaVersion: input.schemaVersion
        })
        .onConflictDoNothing();

      return log;
    },

    listForProject,

    async getProjection(projectId: ProjectId): Promise<ResearchDisclosureLogProjection> {
      return projectionFromLogs(projectId, await listForProject(projectId), new Date().toISOString());
    }
  };
}
