import type { ProjectId, ProjectionVersion } from "../ids";
import type {
  Phase15bHintArtifactKind,
  Phase15bUpgradeHintRecord,
  Phase15bUpgradeHintSourceRef,
  Phase15bUpgradeHints
} from "../codex";
import type { PendingEffectSummaryDto } from "./command-response";

export type Phase15bHintMetadataLabel = "readiness_preview_handoff_metadata";
export type Phase15bHintPrivatePayloadPolicy = "public_safe_metadata_only";

export interface Phase15bHintNoExecutionSemantics {
  readonly semantic: "metadata_only_no_execution";
  readonly productActionPerformed: false;
  readonly delegationState: "not_active";
  readonly credentialValueState: "omitted";
}

export type PublicPhase15bUpgradeHintSourceRef = Pick<Phase15bUpgradeHintSourceRef, "kind" | "refId">;

export interface PublicPhase15bUpgradeHints extends Omit<Phase15bUpgradeHints, "sourceRefs"> {
  readonly sourceRefs: readonly PublicPhase15bUpgradeHintSourceRef[];
}

export interface Phase15bUpgradeHintApiRecord {
  readonly hintId: Phase15bUpgradeHintRecord["hintId"];
  readonly projectId: Phase15bUpgradeHintRecord["projectId"];
  readonly sessionId: Phase15bUpgradeHintRecord["sessionId"];
  readonly artifactId: Phase15bUpgradeHintRecord["artifactId"];
  readonly artifactKind: Phase15bHintArtifactKind;
  readonly metadataLabel: Phase15bHintMetadataLabel;
  readonly privatePayloadPolicy: Phase15bHintPrivatePayloadPolicy;
  readonly noExecution: Phase15bHintNoExecutionSemantics;
  readonly sourceRefLabelPolicy: "labels_omitted_to_avoid_private_payload_export";
  readonly hints: PublicPhase15bUpgradeHints;
  readonly createdAt: Phase15bUpgradeHintRecord["createdAt"];
  readonly schemaVersion: Phase15bUpgradeHintRecord["schemaVersion"];
}

export interface Phase15bUpgradeHintProjection {
  readonly kind: "Phase15bUpgradeHintProjection";
  readonly projectionKind: "Phase15bUpgradeHintProjection";
  readonly projectId: ProjectId;
  readonly version: ProjectionVersion;
  readonly generatedAt: string;
  readonly stale: false;
  readonly refetchUrl: string;
  readonly exportUrl: string;
  readonly pendingEffectSummary: PendingEffectSummaryDto;
  readonly metadataLabel: Phase15bHintMetadataLabel;
  readonly privatePayloadPolicy: Phase15bHintPrivatePayloadPolicy;
  readonly noExecution: Phase15bHintNoExecutionSemantics;
  readonly records: readonly Phase15bUpgradeHintApiRecord[];
}

export interface Phase15bUpgradeHintExportDto extends Omit<Phase15bUpgradeHintProjection, "kind"> {
  readonly kind: "Phase15bUpgradeHintExport";
  readonly exportedAt: string;
  readonly format: "json";
  readonly exportPolicy: {
    readonly privatePayloadsIncluded: false;
    readonly credentialValuesIncluded: false;
    readonly sourceRefLabelsIncluded: false;
    readonly reason: "phase15b_exports_are_public_safe_readiness_metadata_only";
  };
}
