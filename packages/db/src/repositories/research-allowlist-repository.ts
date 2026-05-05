import { and, eq } from "drizzle-orm";
import type {
  ProjectId,
  ProjectionVersion,
  AutomaticResearchSourceCategory,
  ResearchAllowlistId,
  ResearchAllowlistProjection,
  ResearchConnectorId,
  ResearchDisclosureLogPolicy,
  ResearchRateBudgetPolicy,
  ResearchStalenessPolicy,
  SchemaVersion
} from "@solo-superman/contracts";
import { validateResearchAllowlistProjection } from "@solo-superman/contracts";
import type { SoloDatabaseExecutor } from "../client";
import { parseJsonArray, parseJsonRecord, stringifyJson } from "../json";
import { researchAllowlists } from "../schema";

export interface SaveResearchAllowlistInput {
  readonly allowlist: ResearchAllowlistProjection;
  readonly schemaVersion: SchemaVersion;
}

export interface UpdateResearchAllowlistInput extends SaveResearchAllowlistInput {
  readonly expectedVersion: ProjectionVersion;
}

function researchAllowlistRowValues(allowlist: ResearchAllowlistProjection, schemaVersion: SchemaVersion) {
  return {
    id: allowlist.allowlistId,
    version: allowlist.version,
    projectId: allowlist.projectId,
    status: allowlist.status,
    connectorIdsJson: stringifyJson(allowlist.connectorIds),
    sourceCategoriesJson: stringifyJson(allowlist.sourceCategories),
    contextMode: allowlist.contextMode,
    rateBudgetPolicyJson: stringifyJson(allowlist.rateBudgetPolicy),
    stalenessPolicyJson: stringifyJson(allowlist.stalenessPolicy),
    disclosureLogPolicyJson: stringifyJson(allowlist.disclosureLogPolicy),
    approvedBy: allowlist.approvedBy,
    approvedAt: allowlist.approvedAt,
    pausedAt: allowlist.pausedAt ?? null,
    revokedAt: allowlist.revokedAt ?? null,
    createdAt: allowlist.createdAt,
    updatedAt: allowlist.updatedAt,
    schemaVersion
  };
}

function mapAllowlist(row: typeof researchAllowlists.$inferSelect): ResearchAllowlistProjection {
  const allowlist = {
    kind: "ResearchAllowlistProjection",
    version: row.version as ProjectionVersion,
    allowlistId: row.id as ResearchAllowlistId,
    projectId: row.projectId as ProjectId,
    status: row.status as ResearchAllowlistProjection["status"],
    connectorIds: parseJsonArray(row.connectorIdsJson, "connectorIdsJson") as readonly ResearchConnectorId[],
    sourceCategories: parseJsonArray(
      row.sourceCategoriesJson,
      "sourceCategoriesJson"
    ) as readonly AutomaticResearchSourceCategory[],
    contextMode: row.contextMode as ResearchAllowlistProjection["contextMode"],
    rateBudgetPolicy: parseJsonRecord<ResearchRateBudgetPolicy>(row.rateBudgetPolicyJson, "rateBudgetPolicyJson"),
    stalenessPolicy: parseJsonRecord<ResearchStalenessPolicy>(row.stalenessPolicyJson, "stalenessPolicyJson"),
    disclosureLogPolicy: parseJsonRecord<ResearchDisclosureLogPolicy>(
      row.disclosureLogPolicyJson,
      "disclosureLogPolicyJson"
    ),
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt,
    ...(row.pausedAt ? { pausedAt: row.pausedAt } : {}),
    ...(row.revokedAt ? { revokedAt: row.revokedAt } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  } as ResearchAllowlistProjection;

  return validateResearchAllowlistProjection(allowlist);
}

export function createResearchAllowlistRepository(db: SoloDatabaseExecutor) {
  return {
    async create(input: SaveResearchAllowlistInput): Promise<ResearchAllowlistProjection | null> {
      const allowlist = validateResearchAllowlistProjection(input.allowlist);
      const rows = await db
        .insert(researchAllowlists)
        .values(researchAllowlistRowValues(allowlist, input.schemaVersion))
        .onConflictDoNothing()
        .returning();

      return rows[0] ? mapAllowlist(rows[0]) : null;
    },

    async update(input: UpdateResearchAllowlistInput): Promise<ResearchAllowlistProjection | null> {
      const allowlist = validateResearchAllowlistProjection(input.allowlist);
      const rowValues = researchAllowlistRowValues(allowlist, input.schemaVersion);
      const rows = await db
        .update(researchAllowlists)
        .set({
          status: rowValues.status,
          version: rowValues.version,
          connectorIdsJson: rowValues.connectorIdsJson,
          sourceCategoriesJson: rowValues.sourceCategoriesJson,
          contextMode: rowValues.contextMode,
          rateBudgetPolicyJson: rowValues.rateBudgetPolicyJson,
          stalenessPolicyJson: rowValues.stalenessPolicyJson,
          disclosureLogPolicyJson: rowValues.disclosureLogPolicyJson,
          approvedBy: rowValues.approvedBy,
          approvedAt: rowValues.approvedAt,
          pausedAt: rowValues.pausedAt,
          revokedAt: rowValues.revokedAt,
          updatedAt: rowValues.updatedAt,
          schemaVersion: rowValues.schemaVersion
        })
        .where(
          and(
            eq(researchAllowlists.projectId, allowlist.projectId),
            eq(researchAllowlists.id, allowlist.allowlistId),
            eq(researchAllowlists.version, input.expectedVersion)
          )
        )
        .returning();

      return rows[0] ? mapAllowlist(rows[0]) : null;
    },

    async getById(
      projectId: ProjectId,
      allowlistId: ResearchAllowlistId
    ): Promise<ResearchAllowlistProjection | null> {
      const rows = await db
        .select()
        .from(researchAllowlists)
        .where(and(eq(researchAllowlists.projectId, projectId), eq(researchAllowlists.id, allowlistId)))
        .limit(1);
      const row = rows[0];

      return row ? mapAllowlist(row) : null;
    },

    async listForProject(projectId: ProjectId): Promise<readonly ResearchAllowlistProjection[]> {
      const rows = await db
        .select()
        .from(researchAllowlists)
        .where(eq(researchAllowlists.projectId, projectId))
        .orderBy(researchAllowlists.createdAt, researchAllowlists.id);

      return rows.map(mapAllowlist);
    }
  };
}
