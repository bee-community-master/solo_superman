import type {
  ProjectId,
  ProjectionVersion,
  ResearchAllowlistId,
  ResearchConnectorId,
  ResearchDisclosureLogId,
  ResearchRunId,
  ResearchTaskId
} from "../ids";
import {
  AUTOMATIC_RESEARCH_SOURCE_CATEGORIES,
  assertSafeResearchConnectorId,
  type AutomaticResearchSourceCategory
} from "./research-allowlist";

export type ResearchRunStatus =
  | "queued"
  | "running"
  | "paused"
  | "cancel_requested"
  | "cancelled"
  | "needs_review"
  | "accepted"
  | "research_insufficient"
  | "failed"
  | "stale";

export type ResearchRunTerminalStatus =
  | "cancelled"
  | "accepted"
  | "research_insufficient"
  | "failed"
  | "stale";

export type BackgroundResearchAdapterKind =
  | "codex_official"
  | "openclaw_candidate"
  | "web_search_readonly"
  | "local_fake_readonly";

export type ResearchRunQualityGateStatus =
  | "not_evaluated"
  | "pending_review"
  | "passed"
  | "insufficient"
  | "stale";

export type ResearchRunTerminalReason =
  | "cancelled_by_user"
  | "provider_failed"
  | "provider_cancelled"
  | "timeout"
  | "quality_gate_accepted"
  | "quality_gate_insufficient"
  | "staleness_policy_failed";

export interface ResearchRunProviderReference {
  readonly researchRunId: ResearchRunId;
  readonly researchTaskId: ResearchTaskId;
  readonly adapterKind: BackgroundResearchAdapterKind;
  readonly adapterVersion: string;
  readonly providerRunId?: string;
  readonly sourceCategory: AutomaticResearchSourceCategory;
  readonly idempotencyKey: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly attempt: number;
}

export interface ResearchRunProjection {
  readonly kind: "ResearchRunProjection";
  readonly version: ProjectionVersion;
  readonly researchRunId: ResearchRunId;
  readonly projectId: ProjectId;
  readonly researchTaskId: ResearchTaskId;
  readonly allowlistId: ResearchAllowlistId;
  readonly disclosureLogId: ResearchDisclosureLogId;
  readonly connectorId: ResearchConnectorId;
  readonly sourceCategory: AutomaticResearchSourceCategory;
  readonly status: ResearchRunStatus;
  readonly provider: ResearchRunProviderReference;
  readonly qualityGateStatus: ResearchRunQualityGateStatus;
  readonly qualityGateReviewReason?: string;
  readonly sourceRefs: readonly string[];
  readonly terminalReason?: ResearchRunTerminalReason;
  readonly retryOfRunId?: ResearchRunId;
  readonly retryReason?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BuildResearchRunIdempotencyKeyInput {
  readonly taskObjective: string;
  readonly connectorId: ResearchConnectorId;
  readonly contextHash: string;
  readonly allowlistVersion: ProjectionVersion;
  readonly attempt: number;
}

export const RESEARCH_RUN_STATUSES = [
  "queued",
  "running",
  "paused",
  "cancel_requested",
  "cancelled",
  "needs_review",
  "accepted",
  "research_insufficient",
  "failed",
  "stale"
] as const satisfies readonly ResearchRunStatus[];

export const RESEARCH_RUN_TERMINAL_STATUSES = [
  "cancelled",
  "accepted",
  "research_insufficient",
  "failed",
  "stale"
] as const satisfies readonly ResearchRunTerminalStatus[];

export const BACKGROUND_RESEARCH_ADAPTER_KINDS = [
  "codex_official",
  "openclaw_candidate",
  "web_search_readonly",
  "local_fake_readonly"
] as const satisfies readonly BackgroundResearchAdapterKind[];

export const RESEARCH_RUN_QUALITY_GATE_STATUSES = [
  "not_evaluated",
  "pending_review",
  "passed",
  "insufficient",
  "stale"
] as const satisfies readonly ResearchRunQualityGateStatus[];

export const RESEARCH_RUN_TERMINAL_REASONS = [
  "cancelled_by_user",
  "provider_failed",
  "provider_cancelled",
  "timeout",
  "quality_gate_accepted",
  "quality_gate_insufficient",
  "staleness_policy_failed"
] as const satisfies readonly ResearchRunTerminalReason[];

// A queued run may be cancelled directly because no provider has started yet.
// Once a provider can be involved, cancellation flows through cancel_requested.
const SAME_RUN_TRANSITIONS = {
  queued: ["running", "paused", "cancel_requested", "cancelled"],
  running: ["needs_review", "failed", "stale", "paused", "cancel_requested"],
  paused: ["queued", "running", "cancel_requested"],
  cancel_requested: ["cancelled", "failed"],
  needs_review: ["accepted", "research_insufficient", "stale"],
  cancelled: [],
  accepted: [],
  research_insufficient: [],
  failed: [],
  stale: []
} as const satisfies Record<ResearchRunStatus, readonly ResearchRunStatus[]>;

const RESEARCH_RUN_PROJECTION_KEYS = [
  "kind",
  "version",
  "researchRunId",
  "projectId",
  "researchTaskId",
  "allowlistId",
  "disclosureLogId",
  "connectorId",
  "sourceCategory",
  "status",
  "provider",
  "qualityGateStatus",
  "qualityGateReviewReason",
  "sourceRefs",
  "terminalReason",
  "retryOfRunId",
  "retryReason",
  "createdAt",
  "updatedAt"
] as const;

const PROVIDER_REFERENCE_KEYS = [
  "researchRunId",
  "researchTaskId",
  "adapterKind",
  "adapterVersion",
  "providerRunId",
  "sourceCategory",
  "idempotencyKey",
  "startedAt",
  "completedAt",
  "attempt"
] as const;

export class ResearchRunValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResearchRunValidationError";
  }
}

function assertObjectKeys(value: unknown, fieldName: string, allowedKeys: readonly string[]): asserts value is object {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ResearchRunValidationError(`${fieldName} must be a JSON object.`);
  }

  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.includes(key));

  if (unknownKeys.length > 0) {
    throw new ResearchRunValidationError(`${fieldName} contains unsupported fields: ${unknownKeys.join(", ")}.`);
  }
}

function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ResearchRunValidationError(`${fieldName} must be a non-empty string.`);
  }
}

function assertOptionalNonEmptyString(value: unknown, fieldName: string): asserts value is string | undefined {
  if (value === undefined) {
    return;
  }

  assertNonEmptyString(value, fieldName);
}

function assertProjectionVersion(value: unknown): asserts value is ProjectionVersion {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new ResearchRunValidationError("version must be a non-negative integer.");
  }
}

function assertPositiveInteger(value: unknown, fieldName: string) {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new ResearchRunValidationError(`${fieldName} must be a positive integer.`);
  }
}

function assertIsoTimestamp(value: unknown, fieldName: string) {
  assertNonEmptyString(value, fieldName);

  const match = /^\d{4}-\d{2}-\d{2}T/.exec(value);

  if (!match || Number.isNaN(Date.parse(value))) {
    throw new ResearchRunValidationError(`${fieldName} must be an ISO timestamp.`);
  }
}

function hasOwnField(value: object, fieldName: string) {
  return Object.prototype.hasOwnProperty.call(value, fieldName);
}

function isSecretLikeValue(value: string) {
  return (
    /(^|[\s:=])(sk-|gh[po]_|xox[baprs]-|AKIA)/i.test(value) ||
    /(^|[\s:=+/_-])(api[_-]?key|secret|token|password)([\s:=+/_-]|$)/i.test(value)
  );
}

function assertNonSecretString(value: string, fieldName: string) {
  if (isSecretLikeValue(value)) {
    throw new ResearchRunValidationError(`${fieldName} must not contain credential-like values.`);
  }
}

function isResearchRunStatus(value: string): value is ResearchRunStatus {
  return RESEARCH_RUN_STATUSES.includes(value as ResearchRunStatus);
}

function isResearchRunTerminalStatus(value: ResearchRunStatus): value is ResearchRunTerminalStatus {
  return RESEARCH_RUN_TERMINAL_STATUSES.includes(value as ResearchRunTerminalStatus);
}

function isBackgroundResearchAdapterKind(value: string): value is BackgroundResearchAdapterKind {
  return BACKGROUND_RESEARCH_ADAPTER_KINDS.includes(value as BackgroundResearchAdapterKind);
}

function isResearchRunQualityGateStatus(value: string): value is ResearchRunQualityGateStatus {
  return RESEARCH_RUN_QUALITY_GATE_STATUSES.includes(value as ResearchRunQualityGateStatus);
}

function isResearchRunTerminalReason(value: string): value is ResearchRunTerminalReason {
  return RESEARCH_RUN_TERMINAL_REASONS.includes(value as ResearchRunTerminalReason);
}

function isAutomaticResearchSourceCategory(value: string): value is AutomaticResearchSourceCategory {
  return AUTOMATIC_RESEARCH_SOURCE_CATEGORIES.includes(value as AutomaticResearchSourceCategory);
}

function assertSourceRefs(sourceRefs: readonly string[]) {
  if (!Array.isArray(sourceRefs)) {
    throw new ResearchRunValidationError("sourceRefs must be an array.");
  }

  const seen = new Set<string>();

  for (const sourceRef of sourceRefs) {
    assertNonEmptyString(sourceRef, "sourceRefs");

    if (seen.has(sourceRef)) {
      throw new ResearchRunValidationError("sourceRefs must not contain duplicate values.");
    }

    seen.add(sourceRef);
  }
}

function assertProviderReference(run: ResearchRunProjection) {
  const { provider } = run;

  assertObjectKeys(provider, "provider", PROVIDER_REFERENCE_KEYS);
  assertNonEmptyString(provider.researchRunId, "provider.researchRunId");
  assertNonEmptyString(provider.researchTaskId, "provider.researchTaskId");
  assertNonEmptyString(provider.adapterKind, "provider.adapterKind");
  assertNonEmptyString(provider.adapterVersion, "provider.adapterVersion");
  assertOptionalNonEmptyString(provider.providerRunId, "provider.providerRunId");
  assertNonEmptyString(provider.sourceCategory, "provider.sourceCategory");
  assertNonEmptyString(provider.idempotencyKey, "provider.idempotencyKey");
  assertPositiveInteger(provider.attempt, "provider.attempt");
  assertOptionalNonEmptyString(provider.startedAt, "provider.startedAt");
  assertOptionalNonEmptyString(provider.completedAt, "provider.completedAt");

  if (provider.researchRunId !== run.researchRunId) {
    throw new ResearchRunValidationError("provider.researchRunId must match researchRunId.");
  }

  if (provider.researchTaskId !== run.researchTaskId) {
    throw new ResearchRunValidationError("provider.researchTaskId must match researchTaskId.");
  }

  if (provider.sourceCategory !== run.sourceCategory) {
    throw new ResearchRunValidationError("provider.sourceCategory must match sourceCategory.");
  }

  if (!isBackgroundResearchAdapterKind(provider.adapterKind)) {
    throw new ResearchRunValidationError("provider.adapterKind must be a provider-neutral read-only adapter kind.");
  }

  if (!isAutomaticResearchSourceCategory(provider.sourceCategory)) {
    throw new ResearchRunValidationError("provider.sourceCategory must be an automatic research source category.");
  }

  assertNonSecretString(provider.adapterVersion, "provider.adapterVersion");
  assertNonSecretString(provider.idempotencyKey, "provider.idempotencyKey");

  if (provider.providerRunId) {
    assertNonSecretString(provider.providerRunId, "provider.providerRunId");
  }

  if (provider.startedAt) {
    assertIsoTimestamp(provider.startedAt, "provider.startedAt");
  }

  if (provider.completedAt) {
    assertIsoTimestamp(provider.completedAt, "provider.completedAt");
  }
}

function assertLifecycleFields(run: ResearchRunProjection) {
  const hasStarted = Boolean(run.provider.startedAt);
  const hasCompleted = Boolean(run.provider.completedAt);
  const terminal = isResearchRunTerminalStatus(run.status);
  const requiresProviderStart =
    run.status === "running" || run.status === "needs_review" || (terminal && run.status !== "cancelled");

  if (requiresProviderStart && !hasStarted) {
    throw new ResearchRunValidationError("running, review, and non-cancelled terminal runs require provider.startedAt.");
  }

  if ((run.status === "needs_review" || terminal) && !hasCompleted) {
    throw new ResearchRunValidationError("review and terminal runs require provider.completedAt.");
  }

  if (
    hasStarted &&
    hasCompleted &&
    Date.parse(run.provider.completedAt ?? "") < Date.parse(run.provider.startedAt ?? "")
  ) {
    throw new ResearchRunValidationError("provider.completedAt must not be earlier than provider.startedAt.");
  }

  if (terminal) {
    assertNonEmptyString(run.terminalReason, "terminalReason");

    if (!isResearchRunTerminalReason(run.terminalReason)) {
      throw new ResearchRunValidationError("terminalReason must be a canonical research run terminal reason.");
    }

    if (run.status === "cancelled" && !hasStarted && run.terminalReason !== "cancelled_by_user") {
      throw new ResearchRunValidationError("pre-start cancelled runs must use cancelled_by_user terminalReason.");
    }
  } else if (hasOwnField(run, "terminalReason")) {
    throw new ResearchRunValidationError("non-terminal research runs must not carry terminalReason.");
  }

  if (run.retryOfRunId || run.retryReason) {
    assertNonEmptyString(run.retryOfRunId, "retryOfRunId");
    assertNonEmptyString(run.retryReason, "retryReason");

    if (run.retryOfRunId === run.researchRunId) {
      throw new ResearchRunValidationError("retryOfRunId must reference a different prior research run.");
    }

    if (run.provider.attempt < 2) {
      throw new ResearchRunValidationError("manual retry runs must use an incremented provider.attempt.");
    }
  }
}

function assertQualityGateConsistency(run: ResearchRunProjection) {
  const expectedGateStatus: Partial<Record<ResearchRunStatus, ResearchRunQualityGateStatus>> = {
    queued: "not_evaluated",
    running: "not_evaluated",
    paused: "not_evaluated",
    cancel_requested: "not_evaluated",
    needs_review: "pending_review",
    accepted: "passed",
    research_insufficient: "insufficient",
    stale: "stale"
  };
  const expected = expectedGateStatus[run.status];

  if (expected && run.qualityGateStatus !== expected) {
    throw new ResearchRunValidationError(`qualityGateStatus must be ${expected} for ${run.status} runs.`);
  }

  if (run.status === "failed" || run.status === "cancelled") {
    if (run.qualityGateStatus !== "not_evaluated" && run.qualityGateStatus !== "pending_review") {
      throw new ResearchRunValidationError("failed/cancelled runs cannot carry an accepted evidence quality gate.");
    }
  }

  if (run.status === "needs_review") {
    assertNonEmptyString(run.qualityGateReviewReason, "qualityGateReviewReason");
  } else if (hasOwnField(run, "qualityGateReviewReason")) {
    throw new ResearchRunValidationError("qualityGateReviewReason is only allowed for needs_review research runs.");
  }
}

function normalizeKeyPart(value: string, fieldName: string) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized) {
    throw new ResearchRunValidationError("idempotency key inputs must be non-empty.");
  }

  assertNonSecretString(normalized, fieldName);

  return encodeURIComponent(normalized).replaceAll("%20", "+");
}

export function isTerminalResearchRunStatus(status: ResearchRunStatus): status is ResearchRunTerminalStatus {
  return isResearchRunTerminalStatus(status);
}

export function canTransitionResearchRunStatus(from: ResearchRunStatus, to: ResearchRunStatus) {
  return (SAME_RUN_TRANSITIONS[from] as readonly ResearchRunStatus[]).includes(to);
}

export function assertResearchRunStatusTransition(from: ResearchRunStatus, to: ResearchRunStatus) {
  if (!canTransitionResearchRunStatus(from, to)) {
    throw new ResearchRunValidationError(
      `ResearchRun status cannot transition from ${from} to ${to} on the same run id.`
    );
  }
}

export function canCreateManualResearchRunRetry(status: ResearchRunStatus) {
  return status === "failed" || status === "stale" || status === "research_insufficient";
}

export function buildResearchRunIdempotencyKey(input: BuildResearchRunIdempotencyKeyInput) {
  assertNonEmptyString(input.taskObjective, "taskObjective");
  assertSafeResearchConnectorId(input.connectorId);
  assertNonEmptyString(input.contextHash, "contextHash");
  assertProjectionVersion(input.allowlistVersion);
  assertPositiveInteger(input.attempt, "attempt");

  return [
    "research-run:v1",
    `objective=${normalizeKeyPart(input.taskObjective, "taskObjective")}`,
    `connector=${input.connectorId}`,
    `context=${normalizeKeyPart(input.contextHash, "contextHash")}`,
    `allowlistVersion=${Number(input.allowlistVersion)}`,
    `attempt=${input.attempt}`
  ].join(":");
}

export function validateResearchRunProjection(run: ResearchRunProjection): ResearchRunProjection {
  assertObjectKeys(run, "researchRun", RESEARCH_RUN_PROJECTION_KEYS);

  if (run.kind !== "ResearchRunProjection") {
    throw new ResearchRunValidationError("researchRun kind must be ResearchRunProjection.");
  }

  assertProjectionVersion(run.version);
  assertNonEmptyString(run.researchRunId, "researchRunId");
  assertNonEmptyString(run.projectId, "projectId");
  assertNonEmptyString(run.researchTaskId, "researchTaskId");
  assertNonEmptyString(run.allowlistId, "allowlistId");
  assertNonEmptyString(run.disclosureLogId, "disclosureLogId");
  assertNonEmptyString(run.connectorId, "connectorId");
  assertSafeResearchConnectorId(run.connectorId);
  assertNonEmptyString(run.sourceCategory, "sourceCategory");
  assertNonEmptyString(run.status, "status");
  assertNonEmptyString(run.qualityGateStatus, "qualityGateStatus");
  assertIsoTimestamp(run.createdAt, "createdAt");
  assertIsoTimestamp(run.updatedAt, "updatedAt");
  assertSourceRefs(run.sourceRefs);
  assertProviderReference(run);
  assertLifecycleFields(run);
  assertQualityGateConsistency(run);

  if (!isAutomaticResearchSourceCategory(run.sourceCategory)) {
    throw new ResearchRunValidationError("sourceCategory must be an automatic research source category.");
  }

  if (!isResearchRunStatus(run.status)) {
    throw new ResearchRunValidationError("status must be a canonical ResearchRun status.");
  }

  if (!isResearchRunQualityGateStatus(run.qualityGateStatus)) {
    throw new ResearchRunValidationError("qualityGateStatus must be a canonical research quality gate status.");
  }

  return run;
}
