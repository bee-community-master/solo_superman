import type { ProjectId, SessionId } from "@solo-superman/contracts";

export const DB_PACKAGE_BOUNDARY = "storage-scaffold-without-schema" as const;

export interface DbBoundaryPlaceholder {
  readonly projectId?: ProjectId;
  readonly sessionId?: SessionId;
  readonly schemaStatus: "not_implemented_in_pr_01";
}
