import type { ProductEngineEffectPlanItem } from "../effects";
import type { ProductEngineEventDraft } from "./events";

export type ProductEngineRejectionCode =
  | "VALIDATION_FAILED"
  | "COMMAND_PRECONDITION_FAILED"
  | "STATE_VERSION_CONFLICT"
  | "RUNTIME_ACTION_BLOCKED";

export interface ProductEngineRejection {
  readonly code: ProductEngineRejectionCode;
  readonly message: string;
}

export interface ProductEngineReduction {
  readonly accepted: boolean;
  readonly rejectionReason?: ProductEngineRejection;
  readonly events: readonly ProductEngineEventDraft[];
  readonly effectPlan: readonly ProductEngineEffectPlanItem[];
}
