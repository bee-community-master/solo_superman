import { createHash } from "node:crypto";
import {
  BLOCKED_ACTION_TYPES,
  PHASE15B_APPROVAL_TYPES,
  PHASE15B_NETWORK_MODES,
  PHASE15B_REQUIRED_ACTORS,
  PHASE15B_RISK_LEVELS,
  PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION,
  type PendingEffectSummaryDto,
  type Phase15bUpgradeHintApiRecord,
  type Phase15bUpgradeHintExportDto,
  type Phase15bUpgradeHintProjection,
  type Phase15bUpgradeHintRecord,
  type Phase15bUpgradeHintSourceRef,
  type Phase15bUpgradeHints,
  type ProjectId,
  type ProjectionVersion,
  type PublicPhase15bUpgradeHints
} from "@solo-superman/contracts";

function regexLiteral(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function exactPublicSafeValuePattern(values: readonly string[]) {
  return new RegExp(`^(?:${values.map(regexLiteral).join("|")})$`, "u");
}

const BLOCKED_ACTION_TYPE_PATTERN = exactPublicSafeValuePattern(BLOCKED_ACTION_TYPES);
const APPROVAL_TYPE_PATTERN = exactPublicSafeValuePattern(PHASE15B_APPROVAL_TYPES);
const NETWORK_MODE_PATTERN = exactPublicSafeValuePattern(PHASE15B_NETWORK_MODES);
const REQUIRED_ACTOR_PATTERN = exactPublicSafeValuePattern(PHASE15B_REQUIRED_ACTORS);
const RISK_LEVEL_PATTERN = exactPublicSafeValuePattern(PHASE15B_RISK_LEVELS);
const SCHEMA_VERSION_PATTERN = exactPublicSafeValuePattern([PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION]);

const METADATA_LABEL = "readiness_preview_handoff_metadata";
const PRIVATE_PAYLOAD_POLICY = "public_safe_metadata_only";
const SOURCE_REF_LABEL_POLICY = "labels_omitted_to_avoid_private_payload_export";

function phase15bHintCollectionRefetchUrl(projectIdValue: ProjectId) {
  return `/api/v1/projects/${projectIdValue}/phase15b-upgrade-hints`;
}

function phase15bHintExportUrl(projectIdValue: ProjectId) {
  return `${phase15bHintCollectionRefetchUrl(projectIdValue)}/export`;
}

function phase15bHintProjectionPendingSummary(): PendingEffectSummaryDto {
  return {
    totalPending: 0,
    byType: {},
    visibleLabel: "Phase 1.5B readiness hint query/export is metadata-only; no execution effects are pending."
  };
}

function phase15bHintNoExecution() {
  return {
    semantic: "metadata_only_no_execution",
    productActionPerformed: false,
    delegationState: "not_active",
    credentialValueState: "omitted"
  } as const;
}

const NON_EXPORTABLE_HINT_TEXT_PATTERN =
  /(sk-[A-Za-z0-9][A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{20,}|(?:api[_-]?key|password|secret|token|credential)\s*[=:]\s*["']?[^\s,"']{4,}|bearer\s+[A-Za-z0-9._~+/=-]{10,}|https?:\/\/\S*(?:api[_-]?key|password|secret|token|credential)=\S*)/iu;
const NON_EXPORTABLE_SOURCE_REF_TEXT_PATTERN =
  /(?:private|customer|raw[_-]?idea|payload|internal|roadmap|secret|token|credential|password|bearer|sk-)/iu;
const NON_EXPORTABLE_HINT_TEXT = "[redacted_phase15b_non_exportable_metadata]";

const PUBLIC_SAFE_PHASE15B_HINT_TEXT_PATTERNS = new Map<string, RegExp>([
  ["executionIntent.candidateActionType", BLOCKED_ACTION_TYPE_PATTERN],
  ["approvalRequirements[].approvalType", APPROVAL_TYPE_PATTERN],
  ["approvalRequirements[].requiredActor", REQUIRED_ACTOR_PATTERN],
  ["sandboxRequirements.networkMode", NETWORK_MODE_PATTERN],
  ["sandboxRequirements.commandAllowlist[]", /^(pnpm (?:verify|test|lint|typecheck|build|smoke:e2e)|git diff --check)$/u],
  ["rollbackReference.baseRef", /^(main|origin\/main|[a-f0-9]{7,40})$/u],
  ["rollbackReference.diffRef", /^runtime_artifact_[A-Za-z0-9_:-]+$/u],
  ["expectedEvidence.tests[]", /^(pnpm (?:verify|test|lint|typecheck|build|smoke:e2e)|git diff --check)$/u],
  ["expectedEvidence.smokeChecks[]", /^GET \/[-/A-Za-z0-9_:?=&.]+$/u],
  ["expectedEvidence.artifactPaths[]", /^(?:apps|packages|docs|scripts|e2e)\/[-A-Za-z0-9_./:]+$/u],
  ["riskNormalization.riskLevel", RISK_LEVEL_PATTERN],
  ["riskNormalization.blockedActionType", BLOCKED_ACTION_TYPE_PATTERN],
  ["riskNormalization.escalationTarget", /^phase[0-9a-z_:-]+$/u],
  ["createdAt", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u],
  ["schemaVersion", SCHEMA_VERSION_PATTERN]
]);

const PHASE15B_SOURCE_REF_PATTERNS = {
  preview_artifact: /^runtime_artifact_[A-Za-z0-9_:-]+$/u,
  blocked_action: /^runtime_artifact_[A-Za-z0-9_:-]+(?::[A-Za-z0-9_:-]+)?$/u,
  research_run: /^research_run_[A-Za-z0-9_:-]+$/u,
  evidence_matrix: /^evidence_matrix_[A-Za-z0-9_:-]+$/u,
  decision_evidence_pack: /^(?:decision_evidence_pack|evidence_pack)_[A-Za-z0-9_:-]+$/u,
  research_allowlist: /^research_allowlist_[A-Za-z0-9_:-]+$/u,
  research_disclosure_log: /^research_disclosure(?:_log)?_[A-Za-z0-9_:-]+$/u,
  audit_log: /^audit_log_[A-Za-z0-9_:-]+$/u,
  spec_section: /^spec(?:_section)?_[A-Za-z0-9_:-]+$/u
} as const satisfies Record<Phase15bUpgradeHintSourceRef["kind"], RegExp>;

function redactedPhase15bSourceRefId(sourceRef: Phase15bUpgradeHintSourceRef) {
  const digest = createHash("sha256")
    .update(sourceRef.kind)
    .update("\0")
    .update(sourceRef.refId)
    .digest("hex")
    .slice(0, 16);

  return `redacted_ref:${sourceRef.kind}:${digest}`;
}

function isExportablePhase15bSourceRefId(sourceRef: Phase15bUpgradeHintSourceRef) {
  return (
    PHASE15B_SOURCE_REF_PATTERNS[sourceRef.kind].test(sourceRef.refId) &&
    !NON_EXPORTABLE_HINT_TEXT_PATTERN.test(sourceRef.refId) &&
    !NON_EXPORTABLE_SOURCE_REF_TEXT_PATTERN.test(sourceRef.refId)
  );
}

function sanitizedPhase15bSourceRef(sourceRef: Phase15bUpgradeHintSourceRef) {
  return {
    kind: sourceRef.kind,
    refId: isExportablePhase15bSourceRefId(sourceRef) ? sourceRef.refId : redactedPhase15bSourceRefId(sourceRef)
  };
}

function redactNonExportablePhase15bText<TValue>(value: TValue, path = ""): TValue {
  if (typeof value === "string") {
    const publicSafePattern = PUBLIC_SAFE_PHASE15B_HINT_TEXT_PATTERNS.get(path);

    return (publicSafePattern?.test(value) === true && !NON_EXPORTABLE_HINT_TEXT_PATTERN.test(value)
      ? value
      : NON_EXPORTABLE_HINT_TEXT) as TValue;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactNonExportablePhase15bText(item, `${path}[]`)) as TValue;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        redactNonExportablePhase15bText(nestedValue, path ? `${path}.${key}` : key)
      ])
    ) as TValue;
  }

  return value;
}

function sanitizedPhase15bHints(hints: Phase15bUpgradeHints): PublicPhase15bUpgradeHints {
  return {
    ...redactNonExportablePhase15bText(hints),
    sourceRefs: hints.sourceRefs.map(sanitizedPhase15bSourceRef)
  };
}

function phase15bHintApiRecord(record: Phase15bUpgradeHintRecord): Phase15bUpgradeHintApiRecord {
  return {
    hintId: record.hintId,
    projectId: record.projectId,
    sessionId: record.sessionId,
    artifactId: record.artifactId,
    artifactKind: record.artifactKind,
    metadataLabel: METADATA_LABEL,
    privatePayloadPolicy: PRIVATE_PAYLOAD_POLICY,
    noExecution: phase15bHintNoExecution(),
    sourceRefLabelPolicy: SOURCE_REF_LABEL_POLICY,
    hints: sanitizedPhase15bHints(record.hints),
    createdAt: record.createdAt,
    schemaVersion: record.schemaVersion
  };
}

export function buildPhase15bHintProjection(
  projectIdValue: ProjectId,
  records: readonly Phase15bUpgradeHintRecord[],
  generatedAt: string,
  version: ProjectionVersion
): Phase15bUpgradeHintProjection {
  return {
    kind: "Phase15bUpgradeHintProjection",
    projectionKind: "Phase15bUpgradeHintProjection",
    projectId: projectIdValue,
    version,
    generatedAt,
    stale: false,
    refetchUrl: phase15bHintCollectionRefetchUrl(projectIdValue),
    exportUrl: phase15bHintExportUrl(projectIdValue),
    pendingEffectSummary: phase15bHintProjectionPendingSummary(),
    metadataLabel: METADATA_LABEL,
    privatePayloadPolicy: PRIVATE_PAYLOAD_POLICY,
    noExecution: phase15bHintNoExecution(),
    records: records.map(phase15bHintApiRecord)
  };
}

export function buildPhase15bHintExport(
  projectIdValue: ProjectId,
  records: readonly Phase15bUpgradeHintRecord[],
  exportedAt: string,
  version: ProjectionVersion
): Phase15bUpgradeHintExportDto {
  return {
    ...buildPhase15bHintProjection(projectIdValue, records, exportedAt, version),
    kind: "Phase15bUpgradeHintExport",
    exportedAt,
    format: "json",
    exportPolicy: {
      privatePayloadsIncluded: false,
      credentialValuesIncluded: false,
      sourceRefLabelsIncluded: false,
      reason: "phase15b_exports_are_public_safe_readiness_metadata_only"
    }
  };
}
