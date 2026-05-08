import type { SchemaVersion } from "../ids";
import { BLOCKED_ACTION_TYPES, type BlockedActionType, type CodexArtifactKind } from "./reexports";

export const PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION = "solo-superman.phase15b-hints.v1" as SchemaVersion;

export const PHASE15B_HINT_ARTIFACT_KINDS = [
  "ImplementationPlanPreviewArtifact",
  "BlockedActionArtifact"
] as const satisfies readonly CodexArtifactKind[];
export type Phase15bHintArtifactKind = (typeof PHASE15B_HINT_ARTIFACT_KINDS)[number];

export const PHASE15B_APPROVAL_TYPES = [
  "task_level_execution",
  "project_level_delegation",
  "credential_grant",
  "destructive_action",
  "browser_action",
  "network_write",
  "phase3_safe_execution"
] as const;

export const PHASE15B_REQUIRED_ACTORS = ["user", "project_owner", "system_policy"] as const;
export const PHASE15B_NETWORK_MODES = ["offline", "read_only", "restricted_write_requires_phase3_approval"] as const;
export const PHASE15B_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export const PHASE15B_SOURCE_REF_KINDS = [
  "preview_artifact",
  "blocked_action",
  "research_run",
  "evidence_matrix",
  "decision_evidence_pack",
  "research_allowlist",
  "research_disclosure_log",
  "audit_log",
  "spec_section"
] as const;

export type Phase15bApprovalType = (typeof PHASE15B_APPROVAL_TYPES)[number];
export type Phase15bRequiredActor = (typeof PHASE15B_REQUIRED_ACTORS)[number];
export type Phase15bNetworkMode = (typeof PHASE15B_NETWORK_MODES)[number];
export type Phase15bRiskLevel = (typeof PHASE15B_RISK_LEVELS)[number];
export type Phase15bSourceRefKind = (typeof PHASE15B_SOURCE_REF_KINDS)[number];

export interface Phase15bExecutionIntent {
  readonly candidateActionType: BlockedActionType;
  readonly targetSurface: string;
  readonly nonExecutingSummary: string;
}

export interface Phase15bApprovalRequirement {
  readonly approvalType: Phase15bApprovalType;
  readonly reason: string;
  readonly scope: string;
  readonly requiredActor: Phase15bRequiredActor;
  readonly reconfirmRule: string;
}

export interface Phase15bSandboxRequirements {
  readonly isolatedWorktreeRequired: boolean;
  readonly browserSandboxRequired: boolean;
  readonly networkMode: Phase15bNetworkMode;
  readonly commandAllowlist: readonly string[];
  readonly secretGrantBoundary: string;
  readonly environmentPolicy: string;
  readonly logCaptureRequired: boolean;
}

export interface Phase15bRollbackReference {
  readonly baseRef: string;
  readonly diffRef?: string;
  readonly rollbackNote: string;
  readonly reversible: boolean;
  readonly cleanupExpectation: string;
}

export interface Phase15bExpectedEvidence {
  readonly tests: readonly string[];
  readonly smokeChecks: readonly string[];
  readonly artifactPaths: readonly string[];
  readonly manualInspection: readonly string[];
  readonly expectedLogs: readonly string[];
}

export interface Phase15bRiskNormalization {
  readonly riskLevel: Phase15bRiskLevel;
  readonly blockedActionType: BlockedActionType;
  readonly blockReason: string;
  readonly userVisibleAction: string;
  readonly escalationTarget: string;
}

export interface Phase15bUpgradeHintSourceRef {
  readonly kind: Phase15bSourceRefKind;
  readonly refId: string;
  readonly label?: string;
}

export interface Phase15bUpgradeHints {
  readonly executionIntent: Phase15bExecutionIntent;
  readonly approvalRequirements: readonly Phase15bApprovalRequirement[];
  readonly sandboxRequirements: Phase15bSandboxRequirements;
  readonly rollbackReference: Phase15bRollbackReference;
  readonly expectedEvidence: Phase15bExpectedEvidence;
  readonly riskNormalization: Phase15bRiskNormalization;
  readonly sourceRefs: readonly Phase15bUpgradeHintSourceRef[];
  readonly createdAt: string;
  readonly schemaVersion: typeof PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION;
}

export interface Phase15bUpgradeHintRecord {
  readonly hintId: string;
  readonly projectId: string;
  readonly sessionId: string;
  readonly artifactId: string;
  readonly artifactKind: Phase15bHintArtifactKind;
  readonly hints: Phase15bUpgradeHints;
  readonly createdAt: string;
  readonly schemaVersion: SchemaVersion;
}

export class Phase15bUpgradeHintsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Phase15bUpgradeHintsValidationError";
  }
}

export function isPhase15bHintArtifactKind(artifactKind: CodexArtifactKind): artifactKind is Phase15bHintArtifactKind {
  return PHASE15B_HINT_ARTIFACT_KINDS.includes(artifactKind as Phase15bHintArtifactKind);
}

export function assertPhase15bHintArtifactKind(
  artifactKind: CodexArtifactKind
): asserts artifactKind is Phase15bHintArtifactKind {
  if (!isPhase15bHintArtifactKind(artifactKind)) {
    throw new Phase15bUpgradeHintsValidationError(
      "phase15bUpgradeHints may only be attached to ImplementationPlanPreviewArtifact or BlockedActionArtifact."
    );
  }
}

export const PHASE15B_ISO_UTC_TIMESTAMP_PATTERN = String.raw`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$`;

const ISO_UTC_TIMESTAMP_PATTERN = new RegExp(PHASE15B_ISO_UTC_TIMESTAMP_PATTERN, "u");
const FORBIDDEN_EXECUTION_KEYS = new Set(["executionEnabled", "delegationActive", "autoApply", "canExecute"]);

function assertRecord(value: unknown, label: string): asserts value is Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Phase15bUpgradeHintsValidationError(`${label} must be an object.`);
  }
}

function assertObjectKeys(value: Readonly<Record<string, unknown>>, label: string, allowedKeys: readonly string[]) {
  const allowed = new Set(allowedKeys);
  const unknownKeys = Object.keys(value).filter((key) => !allowed.has(key));

  if (unknownKeys.length > 0) {
    throw new Phase15bUpgradeHintsValidationError(`${label} contains unsupported keys: ${unknownKeys.join(", ")}.`);
  }
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Phase15bUpgradeHintsValidationError(`${label} must be a non-empty string.`);
  }
}

function assertBoolean(value: unknown, label: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new Phase15bUpgradeHintsValidationError(`${label} must be a boolean.`);
  }
}

function assertStringArray(value: unknown, label: string): asserts value is readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw new Phase15bUpgradeHintsValidationError(`${label} must be a string array.`);
  }
}

function assertEnumValue<TValue extends string>(
  value: unknown,
  label: string,
  allowedValues: readonly TValue[]
): asserts value is TValue {
  if (typeof value !== "string" || !allowedValues.includes(value as TValue)) {
    throw new Phase15bUpgradeHintsValidationError(`${label} must be one of: ${allowedValues.join(", ")}.`);
  }
}

function assertIsoTimestamp(value: unknown, label: string): asserts value is string {
  assertNonEmptyString(value, label);
  const timestamp = Date.parse(value);

  if (
    !ISO_UTC_TIMESTAMP_PATTERN.test(value) ||
    Number.isNaN(timestamp) ||
    new Date(timestamp).toISOString() !== value
  ) {
    throw new Phase15bUpgradeHintsValidationError(`${label} must be an ISO UTC timestamp.`);
  }
}

function assertNoForbiddenExecutionKeys(value: unknown, path = "phase15bUpgradeHints") {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenExecutionKeys(item, `${path}[${index}]`));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (FORBIDDEN_EXECUTION_KEYS.has(key)) {
      throw new Phase15bUpgradeHintsValidationError(
        `${path}.${key} is forbidden in Phase 1.5B readiness metadata.`
      );
    }

    assertNoForbiddenExecutionKeys(nestedValue, `${path}.${key}`);
  }
}

function validateExecutionIntent(value: unknown): Phase15bExecutionIntent {
  assertRecord(value, "executionIntent");
  assertObjectKeys(value, "executionIntent", ["candidateActionType", "targetSurface", "nonExecutingSummary"]);
  assertEnumValue(value.candidateActionType, "executionIntent.candidateActionType", BLOCKED_ACTION_TYPES);
  assertNonEmptyString(value.targetSurface, "executionIntent.targetSurface");
  assertNonEmptyString(value.nonExecutingSummary, "executionIntent.nonExecutingSummary");

  return value as unknown as Phase15bExecutionIntent;
}

function validateApprovalRequirements(value: unknown): readonly Phase15bApprovalRequirement[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Phase15bUpgradeHintsValidationError("approvalRequirements must be a non-empty array.");
  }

  return value.map((item, index) => {
    assertRecord(item, `approvalRequirements[${index}]`);
    assertObjectKeys(item, `approvalRequirements[${index}]`, [
      "approvalType",
      "reason",
      "scope",
      "requiredActor",
      "reconfirmRule"
    ]);
    assertEnumValue(item.approvalType, `approvalRequirements[${index}].approvalType`, PHASE15B_APPROVAL_TYPES);
    assertNonEmptyString(item.reason, `approvalRequirements[${index}].reason`);
    assertNonEmptyString(item.scope, `approvalRequirements[${index}].scope`);
    assertEnumValue(item.requiredActor, `approvalRequirements[${index}].requiredActor`, PHASE15B_REQUIRED_ACTORS);
    assertNonEmptyString(item.reconfirmRule, `approvalRequirements[${index}].reconfirmRule`);

    return item as unknown as Phase15bApprovalRequirement;
  });
}

function validateSandboxRequirements(value: unknown): Phase15bSandboxRequirements {
  assertRecord(value, "sandboxRequirements");
  assertObjectKeys(value, "sandboxRequirements", [
    "isolatedWorktreeRequired",
    "browserSandboxRequired",
    "networkMode",
    "commandAllowlist",
    "secretGrantBoundary",
    "environmentPolicy",
    "logCaptureRequired"
  ]);
  assertBoolean(value.isolatedWorktreeRequired, "sandboxRequirements.isolatedWorktreeRequired");
  assertBoolean(value.browserSandboxRequired, "sandboxRequirements.browserSandboxRequired");
  assertEnumValue(value.networkMode, "sandboxRequirements.networkMode", PHASE15B_NETWORK_MODES);
  assertStringArray(value.commandAllowlist, "sandboxRequirements.commandAllowlist");
  assertNonEmptyString(value.secretGrantBoundary, "sandboxRequirements.secretGrantBoundary");
  assertNonEmptyString(value.environmentPolicy, "sandboxRequirements.environmentPolicy");
  assertBoolean(value.logCaptureRequired, "sandboxRequirements.logCaptureRequired");

  return value as unknown as Phase15bSandboxRequirements;
}

function validateRollbackReference(value: unknown): Phase15bRollbackReference {
  assertRecord(value, "rollbackReference");
  assertObjectKeys(value, "rollbackReference", ["baseRef", "diffRef", "rollbackNote", "reversible", "cleanupExpectation"]);
  assertNonEmptyString(value.baseRef, "rollbackReference.baseRef");

  if (value.diffRef !== undefined) {
    assertNonEmptyString(value.diffRef, "rollbackReference.diffRef");
  }

  assertNonEmptyString(value.rollbackNote, "rollbackReference.rollbackNote");
  assertBoolean(value.reversible, "rollbackReference.reversible");
  assertNonEmptyString(value.cleanupExpectation, "rollbackReference.cleanupExpectation");

  return value as unknown as Phase15bRollbackReference;
}

function validateExpectedEvidence(value: unknown): Phase15bExpectedEvidence {
  assertRecord(value, "expectedEvidence");
  assertObjectKeys(value, "expectedEvidence", [
    "tests",
    "smokeChecks",
    "artifactPaths",
    "manualInspection",
    "expectedLogs"
  ]);
  assertStringArray(value.tests, "expectedEvidence.tests");
  assertStringArray(value.smokeChecks, "expectedEvidence.smokeChecks");
  assertStringArray(value.artifactPaths, "expectedEvidence.artifactPaths");
  assertStringArray(value.manualInspection, "expectedEvidence.manualInspection");
  assertStringArray(value.expectedLogs, "expectedEvidence.expectedLogs");

  return value as unknown as Phase15bExpectedEvidence;
}

function validateRiskNormalization(value: unknown): Phase15bRiskNormalization {
  assertRecord(value, "riskNormalization");
  assertObjectKeys(value, "riskNormalization", [
    "riskLevel",
    "blockedActionType",
    "blockReason",
    "userVisibleAction",
    "escalationTarget"
  ]);
  assertEnumValue(value.riskLevel, "riskNormalization.riskLevel", PHASE15B_RISK_LEVELS);
  assertEnumValue(value.blockedActionType, "riskNormalization.blockedActionType", BLOCKED_ACTION_TYPES);
  assertNonEmptyString(value.blockReason, "riskNormalization.blockReason");
  assertNonEmptyString(value.userVisibleAction, "riskNormalization.userVisibleAction");
  assertNonEmptyString(value.escalationTarget, "riskNormalization.escalationTarget");

  return value as unknown as Phase15bRiskNormalization;
}

function validateSourceRefs(value: unknown): readonly Phase15bUpgradeHintSourceRef[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Phase15bUpgradeHintsValidationError("sourceRefs must be a non-empty array.");
  }

  return value.map((item, index) => {
    assertRecord(item, `sourceRefs[${index}]`);
    assertObjectKeys(item, `sourceRefs[${index}]`, ["kind", "refId", "label"]);
    assertEnumValue(item.kind, `sourceRefs[${index}].kind`, PHASE15B_SOURCE_REF_KINDS);
    assertNonEmptyString(item.refId, `sourceRefs[${index}].refId`);

    if (item.label !== undefined) {
      assertNonEmptyString(item.label, `sourceRefs[${index}].label`);
    }

    return item as unknown as Phase15bUpgradeHintSourceRef;
  });
}

export function validatePhase15bUpgradeHints(hints: unknown): Phase15bUpgradeHints {
  assertRecord(hints, "phase15bUpgradeHints");
  assertNoForbiddenExecutionKeys(hints);
  assertObjectKeys(hints, "phase15bUpgradeHints", [
    "executionIntent",
    "approvalRequirements",
    "sandboxRequirements",
    "rollbackReference",
    "expectedEvidence",
    "riskNormalization",
    "sourceRefs",
    "createdAt",
    "schemaVersion"
  ]);

  const validated = {
    executionIntent: validateExecutionIntent(hints.executionIntent),
    approvalRequirements: validateApprovalRequirements(hints.approvalRequirements),
    sandboxRequirements: validateSandboxRequirements(hints.sandboxRequirements),
    rollbackReference: validateRollbackReference(hints.rollbackReference),
    expectedEvidence: validateExpectedEvidence(hints.expectedEvidence),
    riskNormalization: validateRiskNormalization(hints.riskNormalization),
    sourceRefs: validateSourceRefs(hints.sourceRefs),
    createdAt: hints.createdAt,
    schemaVersion: hints.schemaVersion
  };

  assertIsoTimestamp(validated.createdAt, "createdAt");

  if (validated.schemaVersion !== PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION) {
    throw new Phase15bUpgradeHintsValidationError(
      `schemaVersion must be ${PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION}.`
    );
  }

  if (validated.executionIntent.candidateActionType !== validated.riskNormalization.blockedActionType) {
    throw new Phase15bUpgradeHintsValidationError(
      "executionIntent.candidateActionType must match riskNormalization.blockedActionType."
    );
  }

  return validated as Phase15bUpgradeHints;
}

export function assertPhase15bUpgradeHintsMatchBlockedAction(
  hints: Phase15bUpgradeHints,
  blockedActionType: BlockedActionType
) {
  if (
    hints.executionIntent.candidateActionType !== blockedActionType ||
    hints.riskNormalization.blockedActionType !== blockedActionType
  ) {
    throw new Phase15bUpgradeHintsValidationError(
      "phase15bUpgradeHints action type must match the BlockedActionArtifact actionType."
    );
  }
}
