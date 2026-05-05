import type {
  ProjectId,
  ResearchAllowlistId,
  ResearchConnectorId
} from "../ids";
import type {
  ResearchDisclosureLogEntry,
  ResearchDisclosureLogProjection,
  ResearchSourceCategory
} from "../projections";

export interface PublicSafeResearchSummaryInput {
  readonly researchObjective: string;
  readonly productCategory?: string;
  readonly customerProblemHypothesis?: string;
  readonly highLevelContext?: string;
  readonly rawIdea?: string;
  readonly detailedAnswers?: readonly string[];
  readonly privateCustomerNames?: readonly string[];
  readonly unreleasedPartnerNames?: readonly string[];
  readonly contactDetails?: readonly string[];
  readonly privateDocumentRefs?: readonly string[];
  readonly sourceRefs?: readonly string[];
}

export interface PublicSafeResearchDisclosurePayload {
  readonly researchObjective: string;
  readonly publicSafeSummary: string;
}

export interface PrepareResearchDisclosureRequest extends PublicSafeResearchSummaryInput {
  readonly projectId?: ProjectId;
  readonly allowlistId?: ResearchAllowlistId;
  readonly connectorId: ResearchConnectorId;
  readonly sourceCategory: ResearchSourceCategory;
}

export interface ResearchDisclosurePreparationResult {
  readonly kind: "ResearchDisclosurePreparationResult";
  readonly status: ResearchDisclosureLogEntry["status"];
  readonly automaticExternalTransferAllowed: boolean;
  readonly publicSafePayload: PublicSafeResearchDisclosurePayload;
  readonly disclosureLog: ResearchDisclosureLogEntry;
  readonly projection: ResearchDisclosureLogProjection;
  readonly manualHandoff?: {
    readonly required: true;
    readonly reason: string;
    readonly route: "task_level_approval_or_manual_handoff";
  };
}
