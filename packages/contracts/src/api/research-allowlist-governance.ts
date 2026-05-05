import type {
  ProjectId,
  ProjectionVersion,
  ResearchAllowlistId,
  ResearchConnectorId
} from "../ids";
import type {
  AutomaticResearchSourceCategory,
  ResearchAllowlistAutomaticRunStartPolicy,
  ResearchAllowlistProjection,
  ResearchContextMode,
  ResearchDisclosureLogPolicy,
  ResearchRateBudgetPolicy,
  ResearchStalenessPolicy
} from "../projections";
import type { ProjectionRefetchHint } from "../sse";
import type { PendingEffectSummaryDto } from "./command-response";

export type ResearchAllowlistGovernanceAction =
  | "create"
  | "update"
  | "pause"
  | "revoke";

export interface ResearchAllowlistPolicyInput {
  readonly connectorIds?: readonly ResearchConnectorId[];
  readonly sourceCategories?: readonly AutomaticResearchSourceCategory[];
  readonly contextMode?: ResearchContextMode;
  readonly rateBudgetPolicy?: ResearchRateBudgetPolicy;
  readonly stalenessPolicy?: ResearchStalenessPolicy;
  readonly disclosureLogPolicy?: ResearchDisclosureLogPolicy;
}

export interface CreateResearchAllowlistRequest extends ResearchAllowlistPolicyInput {
  readonly projectId?: ProjectId;
  readonly allowlistId?: ResearchAllowlistId;
  readonly approvedBy: string;
}

export interface UpdateResearchAllowlistRequest extends ResearchAllowlistPolicyInput {
  readonly projectId?: ProjectId;
  readonly allowlistId?: ResearchAllowlistId;
  readonly approvedBy?: string;
  readonly status?: "active" | "paused" | "revoked";
}

export interface PauseResearchAllowlistRequest {
  readonly projectId?: ProjectId;
  readonly allowlistId?: ResearchAllowlistId;
  readonly reason?: string;
}

export interface RevokeResearchAllowlistRequest {
  readonly projectId?: ProjectId;
  readonly allowlistId?: ResearchAllowlistId;
  readonly reason?: string;
}

export interface ResearchAllowlistGovernanceProjection {
  readonly kind: "ResearchAllowlistGovernanceProjection";
  readonly projectionKind: "ResearchAllowlistProjection";
  readonly projectId: ProjectId;
  readonly version: ProjectionVersion;
  readonly generatedAt: string;
  readonly stale: false;
  readonly refetchUrl: string;
  readonly pendingEffectSummary: PendingEffectSummaryDto;
  readonly allowlists: readonly ResearchAllowlistProjection[];
  readonly selectedAllowlist?: ResearchAllowlistProjection;
  readonly automaticRunStartPolicies: readonly ResearchAllowlistAutomaticRunStartPolicy[];
}

export interface ResearchAllowlistGovernanceResult {
  readonly action: ResearchAllowlistGovernanceAction | "list";
  readonly projection: ResearchAllowlistGovernanceProjection;
  readonly projectionHints: readonly ProjectionRefetchHint[];
}
