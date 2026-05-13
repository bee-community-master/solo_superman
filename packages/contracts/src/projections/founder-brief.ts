import type { ProjectionVersion, SessionId } from "../ids";
import type { ProjectPurposeMode } from "../product-engine";
import type { IfStopNowArtifactProjection } from "./confidence-completion";

export interface FounderBriefSectionProjection {
  readonly sectionId:
    | "project_purpose_mode"
    | "problem_customer_value"
    | "top_decisions"
    | "known_risks"
    | "next_validation_actions";
  readonly title: string;
  readonly body: string;
}

export interface FounderBriefExportMetadata {
  readonly format: "markdown";
  readonly filename: string;
  readonly preparedAt: string;
  readonly writePolicy: "metadata_only_no_file_write";
  readonly blockedSideEffects: readonly string[];
}

export interface FounderBriefProjection {
  readonly kind: "FounderBriefProjection";
  readonly sessionId: SessionId;
  readonly version: ProjectionVersion;
  readonly projectPurposeMode: ProjectPurposeMode;
  readonly projectPurposeModeLabel: string;
  readonly projectPurposeModeNarrative: string;
  readonly skippedCommercializationAxes: readonly string[];
  readonly exportReady: boolean;
  readonly problemCustomerValue: string;
  readonly topDecisions: readonly string[];
  readonly knownRisks: readonly string[];
  readonly nextValidationActions: readonly string[];
  readonly briefSections: readonly FounderBriefSectionProjection[];
  readonly ifStopNowArtifact: IfStopNowArtifactProjection;
  readonly exportMetadata: FounderBriefExportMetadata;
}
