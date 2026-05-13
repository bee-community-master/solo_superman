import type { ProductEngineEffectPlanItem } from "../effects";
import type {
  DecisionQueueProjection,
  ChatGptBrowserDelegationProjection,
  ExecutionAuthorityLedgerProjection,
  ImplementationStepLedgerProjection,
  ConfidenceCompletionProjection,
  FounderBriefProjection,
  LivingSpecProjection,
  Phase25ResearchComparisonProjection,
  PlanningHandoffProjection,
  ResearchEvidenceProjection,
  RuntimeActivityProjection,
  ServicePageUsePermissionProjection,
  SessionShellProjection
} from "../projections";
import type { ProductEngineEventDraft } from "./events";

export type ProductEngineRejectionCode =
  | "VALIDATION_FAILED"
  | "COMMAND_PRECONDITION_FAILED"
  | "STATE_VERSION_CONFLICT"
  | "RESOURCE_NOT_FOUND"
  | "RUNTIME_ACTION_BLOCKED";

export interface ProductEngineRejection {
  readonly code: ProductEngineRejectionCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type ProductEngineStatePatch = Readonly<Record<string, unknown>>;

export type ProductEngineDeterministicOutputType =
  | "reducer_deterministic_output"
  | "initial_spec_draft"
  | "ambiguity_analysis"
  | "active_question_batch"
  | "completeness_snapshot"
  | "confidence_map"
  | "spec_version_material"
  | "founder_brief_draft"
  | "planning_handoff_artifact"
  | "phase25_research_comparison_report"
  | "execution_authority_record"
  | "chatgpt_browser_delegation_run"
  | "service_page_use_permission"
  | "implementation_step_ledger";

export interface ProductEngineDeterministicOutput {
  readonly outputType: ProductEngineDeterministicOutputType;
  readonly outputRef: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export type ActiveBatchSafeProjection =
  | ConfidenceCompletionProjection
  | DecisionQueueProjection
  | ChatGptBrowserDelegationProjection
  | ExecutionAuthorityLedgerProjection
  | FounderBriefProjection
  | LivingSpecProjection
  | PlanningHandoffProjection
  | Phase25ResearchComparisonProjection
  | ResearchEvidenceProjection
  | RuntimeActivityProjection
  | ServicePageUsePermissionProjection
  | ImplementationStepLedgerProjection
  | SessionShellProjection;

export interface ProductEngineReduction<TImmediateProjection = ActiveBatchSafeProjection> {
  readonly accepted: boolean;
  readonly rejectionReason?: ProductEngineRejection;
  readonly events: readonly ProductEngineEventDraft[];
  readonly nextState: ProductEngineStatePatch;
  readonly effectPlan: readonly ProductEngineEffectPlanItem[];
  readonly deterministicOutputs: readonly ProductEngineDeterministicOutput[];
  readonly immediateProjection?: TImmediateProjection;
}
