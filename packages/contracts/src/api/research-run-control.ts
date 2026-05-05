import type {
  ProjectId,
  ProjectionVersion,
  ResearchAllowlistId,
  ResearchConnectorId,
  ResearchDisclosureLogId,
  ResearchRunId,
  ResearchTaskId
} from "../ids";
import type {
  AutomaticResearchSourceCategory,
  BackgroundResearchAdapterKind,
  ResearchDisclosureLogEntry,
  ResearchRunProjection,
  ResearchRunTerminalReason,
  ResearchSourceCategory
} from "../projections";
import type { ProjectionRefetchHint, SseEventName } from "../sse";
import type { PendingEffectSummaryDto } from "./command-response";
import type { PublicSafeResearchDisclosurePayload, PublicSafeResearchSummaryInput } from "./research-disclosure";

export interface StartResearchRunRequest extends PublicSafeResearchSummaryInput {
  readonly projectId?: ProjectId;
  readonly researchRunId?: ResearchRunId;
  readonly researchTaskId: ResearchTaskId;
  readonly allowlistId?: ResearchAllowlistId;
  readonly connectorId: ResearchConnectorId;
  readonly sourceCategory: ResearchSourceCategory;
  readonly adapterKind?: BackgroundResearchAdapterKind;
  readonly contextHash?: string;
  readonly taskFreshnessDeadline?: string;
  readonly sourcePublishedAt?: string;
  readonly sourceRequiredAfter?: string;
}

export interface CancelResearchRunRequest {
  readonly projectId?: ProjectId;
  readonly researchRunId?: ResearchRunId;
  readonly reason?: string;
}

export interface RetryResearchRunRequest {
  readonly projectId?: ProjectId;
  readonly researchRunId?: ResearchRunId;
  readonly retryReason: string;
  readonly contextHash?: string;
}

export interface ResearchRunRecoveryHint {
  readonly statusUrl?: string;
  readonly refetchUrl: string;
  readonly sseEventNames: readonly SseEventName[];
  readonly projectionHints: readonly ProjectionRefetchHint[];
}

export interface ResearchRunControlProjection {
  readonly kind: "ResearchRunControlProjection";
  readonly projectionKind: "ResearchRunProjection";
  readonly projectId: ProjectId;
  readonly version: ProjectionVersion;
  readonly generatedAt: string;
  readonly stale: false;
  readonly refetchUrl: string;
  readonly statusUrl?: string;
  readonly pendingEffectSummary: PendingEffectSummaryDto;
  readonly runs: readonly ResearchRunProjection[];
  readonly selectedRun?: ResearchRunProjection;
  readonly recovery: ResearchRunRecoveryHint;
}

export type ResearchRunControlStatus =
  | "started"
  | "status"
  | "cancel_requested"
  | "cancelled"
  | "retry_started"
  | "blocked_manual_handoff"
  | "blocked_precondition";

export interface ResearchRunControlResult {
  readonly kind: "ResearchRunControlResult";
  readonly action: "start" | "status" | "cancel" | "retry" | "list";
  readonly status: ResearchRunControlStatus;
  readonly projectId: ProjectId;
  readonly researchRun?: ResearchRunProjection;
  readonly researchRunId?: ResearchRunId;
  readonly researchTaskId?: ResearchTaskId;
  readonly allowlistId?: ResearchAllowlistId;
  readonly disclosureLogId?: ResearchDisclosureLogId;
  readonly disclosureLog?: ResearchDisclosureLogEntry;
  readonly publicSafePayload?: PublicSafeResearchDisclosurePayload;
  readonly projection: ResearchRunControlProjection;
  readonly statusUrl?: string;
  readonly recovery: ResearchRunRecoveryHint;
  readonly retryAfterSeconds?: number;
  readonly priorFailure?: {
    readonly researchRunId: ResearchRunId;
    readonly terminalReason?: ResearchRunTerminalReason;
    readonly status: ResearchRunProjection["status"];
    readonly disclosureSummary?: string;
  };
  readonly manualHandoff?: {
    readonly required: true;
    readonly reason: string;
    readonly route: "task_level_approval_or_manual_handoff";
  };
  readonly blocker?: {
    readonly reason: string;
    readonly code:
      | "allowlist_or_context_blocked"
      | "rate_budget_exhausted"
      | "staleness_policy_failed"
      | "adapter_unavailable"
      | "retry_not_allowed";
  };
}

export interface ResearchRunStatusDto extends ResearchRunControlProjection {
  readonly selectedRun: ResearchRunProjection;
  readonly statusUrl: string;
}

export type ResearchRunListDto = ResearchRunControlProjection;
export type AutomaticResearchRunSourceCategory = AutomaticResearchSourceCategory;
