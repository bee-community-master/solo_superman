import { and, eq } from "drizzle-orm";
import type {
  ProjectId,
  ProjectionVersion,
  ResearchAllowlistId,
  ResearchAllowlistProjection,
  ResearchConnectorId,
  ResearchDisclosureLogPolicy,
  ResearchRateBudgetPolicy,
  ResearchSourceCategory,
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

function mapAllowlist(row: typeof researchAllowlists.$inferSelect): ResearchAllowlistProjection {
  const allowlist = {
    kind: "ResearchAllowlistProjection",
    version: row.version as ProjectionVersion,
    allowlistId: row.id as ResearchAllowlistId,
    projectId: row.projectId as ProjectId,
    status: row.status as ResearchAllowlistProjection["status"],
    connectorIds: parseJsonArray(row.connectorIdsJson, "connectorIdsJson") as readonly ResearchConnectorId[],
    sourceCategories: parseJsonArray(row.sourceCategoriesJson, "sourceCategoriesJson") as readonly ResearchSourceCategory[],
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
    async save(input: SaveResearchAllowlistInput): Promise<ResearchAllowlistProjection> {
      const allowlist = validateResearchAllowlistProjection(input.allowlist);

      await db
        .insert(researchAllowlists)
        .values({
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
          schemaVersion: input.schemaVersion
        })
        .onConflictDoUpdate({
          target: [researchAllowlists.projectId, researchAllowlists.id],
          set: {
            status: allowlist.status,
            version: allowlist.version,
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
            updatedAt: allowlist.updatedAt,
            schemaVersion: input.schemaVersion
          }
        });

      return allowlist;
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
      const rows = await db.select().from(researchAllowlists).where(eq(researchAllowlists.projectId, projectId));

      return rows.map(mapAllowlist);
    }
  };
}
