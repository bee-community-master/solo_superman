import type { ProjectId, ProjectionVersion, ResearchAllowlistId, ResearchConnectorId } from "../ids";

export type ResearchAllowlistStatus = "active" | "paused" | "revoked";

export type ResearchSourceCategory =
  | "public_web"
  | "official_docs"
  | "public_dataset"
  | "academic_source"
  | "user_provided_public_url"
  | "private_document"
  | "credentialed_source"
  | "account_session_source";

export type AutomaticResearchSourceCategory =
  | "public_web"
  | "official_docs"
  | "public_dataset"
  | "academic_source"
  | "user_provided_public_url";

export type ResearchContextMode = "public_safe_summary";

export interface ResearchRateBudgetPolicy {
  readonly maxConcurrentRunsPerProject: number;
  readonly maxRunsPerSession: number;
  readonly maxAutomaticRetriesPerRun: number;
  readonly runTimeoutSeconds: number;
  readonly retryBackoffSeconds: readonly number[];
}

export interface ResearchStalenessPolicy {
  readonly staleWhenRunExceedsTaskFreshnessWindow: true;
  readonly staleWhenSourcePredatesTaskRequirement: true;
}

export interface ResearchDisclosureLogPolicy {
  readonly logEveryAutomaticRun: true;
  readonly publicSafeSummaryRequired: true;
}

export interface ResearchAllowlistProjection {
  readonly kind: "ResearchAllowlistProjection";
  readonly version: ProjectionVersion;
  readonly allowlistId: ResearchAllowlistId;
  readonly projectId: ProjectId;
  readonly status: ResearchAllowlistStatus;
  readonly connectorIds: readonly ResearchConnectorId[];
  readonly sourceCategories: readonly AutomaticResearchSourceCategory[];
  readonly contextMode: ResearchContextMode;
  readonly rateBudgetPolicy: ResearchRateBudgetPolicy;
  readonly stalenessPolicy: ResearchStalenessPolicy;
  readonly disclosureLogPolicy: ResearchDisclosureLogPolicy;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly pausedAt?: string;
  readonly revokedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const AUTOMATIC_RESEARCH_SOURCE_CATEGORIES = [
  "public_web",
  "official_docs",
  "public_dataset",
  "academic_source",
  "user_provided_public_url"
] as const satisfies readonly AutomaticResearchSourceCategory[];

export const RESEARCH_ALLOWLIST_STATUSES = [
  "active",
  "paused",
  "revoked"
] as const satisfies readonly ResearchAllowlistStatus[];

export const APPROVED_RESEARCH_CONNECTOR_IDS: readonly string[] = [
  "public_search",
  "official_docs",
  "public_dataset",
  "academic_source",
  "user_public_url"
];

export const MANUAL_RESEARCH_SOURCE_CATEGORIES = [
  "private_document",
  "credentialed_source",
  "account_session_source"
] as const satisfies readonly ResearchSourceCategory[];

export const DEFAULT_RESEARCH_RATE_BUDGET_POLICY = {
  maxConcurrentRunsPerProject: 2,
  maxRunsPerSession: 12,
  maxAutomaticRetriesPerRun: 2,
  runTimeoutSeconds: 600,
  retryBackoffSeconds: [30, 120]
} as const satisfies ResearchRateBudgetPolicy;

export const DEFAULT_RESEARCH_STALENESS_POLICY = {
  staleWhenRunExceedsTaskFreshnessWindow: true,
  staleWhenSourcePredatesTaskRequirement: true
} as const satisfies ResearchStalenessPolicy;

export const DEFAULT_RESEARCH_DISCLOSURE_LOG_POLICY = {
  logEveryAutomaticRun: true,
  publicSafeSummaryRequired: true
} as const satisfies ResearchDisclosureLogPolicy;

export class ResearchAllowlistValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResearchAllowlistValidationError";
  }
}

const RESEARCH_ALLOWLIST_PROJECTION_KEYS = [
  "kind",
  "version",
  "allowlistId",
  "projectId",
  "status",
  "connectorIds",
  "sourceCategories",
  "contextMode",
  "rateBudgetPolicy",
  "stalenessPolicy",
  "disclosureLogPolicy",
  "approvedBy",
  "approvedAt",
  "pausedAt",
  "revokedAt",
  "createdAt",
  "updatedAt"
] as const;

function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ResearchAllowlistValidationError(`${fieldName} must be a non-empty string.`);
  }
}

function assertProjectionVersion(value: unknown): asserts value is ProjectionVersion {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new ResearchAllowlistValidationError("version must be a non-negative integer.");
  }
}

function assertIsoTimestamp(value: unknown, fieldName: string) {
  assertNonEmptyString(value, fieldName);

  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,3}))?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(
    value
  );

  if (!match || Number.isNaN(Date.parse(value))) {
    throw new ResearchAllowlistValidationError(`${fieldName} must be an ISO timestamp.`);
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, millisecondText = "0"] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number(millisecondText.padEnd(3, "0"));
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day ||
    utcDate.getUTCHours() !== hour ||
    utcDate.getUTCMinutes() !== minute ||
    utcDate.getUTCSeconds() !== second ||
    utcDate.getUTCMilliseconds() !== millisecond
  ) {
    throw new ResearchAllowlistValidationError(`${fieldName} must be an ISO timestamp.`);
  }
}

function assertUniqueStrings(values: readonly string[], fieldName: string) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new ResearchAllowlistValidationError(`${fieldName} must not be empty.`);
  }

  const seen = new Set<string>();

  for (const value of values) {
    assertNonEmptyString(value, fieldName);

    if (seen.has(value)) {
      throw new ResearchAllowlistValidationError(`${fieldName} must not contain duplicate values.`);
    }

    seen.add(value);
  }
}

function isAutomaticResearchSourceCategory(value: string): value is AutomaticResearchSourceCategory {
  return AUTOMATIC_RESEARCH_SOURCE_CATEGORIES.includes(value as AutomaticResearchSourceCategory);
}

function isResearchAllowlistStatus(value: string): value is ResearchAllowlistStatus {
  return RESEARCH_ALLOWLIST_STATUSES.includes(value as ResearchAllowlistStatus);
}

function isApprovedResearchConnectorId(value: string) {
  return APPROVED_RESEARCH_CONNECTOR_IDS.includes(value);
}

function isSecretLikeValue(value: string) {
  return (
    /^(sk-|gh[po]_|xox[baprs]-|AKIA)/i.test(value) ||
    /(^|[_-])(api[_-]?key|secret|token|password)([_-]|$)/i.test(value)
  );
}

function assertObjectKeys(value: unknown, fieldName: string, allowedKeys: readonly string[]): asserts value is object {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ResearchAllowlistValidationError(`${fieldName} must be a JSON object.`);
  }

  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.includes(key));

  if (unknownKeys.length > 0) {
    throw new ResearchAllowlistValidationError(`${fieldName} contains unsupported fields: ${unknownKeys.join(", ")}.`);
  }
}

function assertSafeConnectorIds(connectorIds: readonly ResearchConnectorId[]) {
  assertUniqueStrings(connectorIds, "connectorIds");

  for (const connectorId of connectorIds) {
    if (!/^[a-z][a-z0-9_-]{1,63}$/.test(connectorId)) {
      throw new ResearchAllowlistValidationError(
        "connectorIds must be stable non-secret slugs, not provider credentials or raw secrets."
      );
    }

    if (isSecretLikeValue(connectorId)) {
      throw new ResearchAllowlistValidationError("connectorIds must not contain secret-like values.");
    }

    if (!isApprovedResearchConnectorId(connectorId)) {
      throw new ResearchAllowlistValidationError("connectorIds must reference approved read-only connector slugs.");
    }
  }
}

export function assertSupportedResearchAllowlistCombination(
  sourceCategories: readonly ResearchSourceCategory[],
  contextMode: ResearchContextMode
): asserts sourceCategories is readonly AutomaticResearchSourceCategory[] {
  if (contextMode !== "public_safe_summary") {
    throw new ResearchAllowlistValidationError("Phase 1.5A allowlists support only public_safe_summary context mode.");
  }

  assertUniqueStrings(sourceCategories, "sourceCategories");

  const unsupported = sourceCategories.filter((category) => !isAutomaticResearchSourceCategory(category));

  if (unsupported.length > 0) {
    throw new ResearchAllowlistValidationError(
      `Unsupported source categories for automatic allowlists: ${unsupported.join(", ")}.`
    );
  }
}

function assertRateBudgetPolicy(policy: ResearchRateBudgetPolicy) {
  assertObjectKeys(policy, "rateBudgetPolicy", [
    "maxConcurrentRunsPerProject",
    "maxRunsPerSession",
    "maxAutomaticRetriesPerRun",
    "runTimeoutSeconds",
    "retryBackoffSeconds"
  ]);

  if (!Number.isInteger(policy.maxConcurrentRunsPerProject) || policy.maxConcurrentRunsPerProject < 1) {
    throw new ResearchAllowlistValidationError("maxConcurrentRunsPerProject must be a positive integer.");
  }

  if (!Number.isInteger(policy.maxRunsPerSession) || policy.maxRunsPerSession < 1) {
    throw new ResearchAllowlistValidationError("maxRunsPerSession must be a positive integer.");
  }

  if (policy.maxRunsPerSession < policy.maxConcurrentRunsPerProject) {
    throw new ResearchAllowlistValidationError(
      "maxRunsPerSession must be greater than or equal to maxConcurrentRunsPerProject."
    );
  }

  if (!Number.isInteger(policy.maxAutomaticRetriesPerRun) || policy.maxAutomaticRetriesPerRun < 0) {
    throw new ResearchAllowlistValidationError("maxAutomaticRetriesPerRun must be a non-negative integer.");
  }

  if (!Number.isInteger(policy.runTimeoutSeconds) || policy.runTimeoutSeconds < 1) {
    throw new ResearchAllowlistValidationError("runTimeoutSeconds must be a positive integer.");
  }

  if (
    !Array.isArray(policy.retryBackoffSeconds) ||
    policy.retryBackoffSeconds.some((value) => !Number.isInteger(value) || value < 0)
  ) {
    throw new ResearchAllowlistValidationError("retryBackoffSeconds must contain non-negative integers.");
  }

  if (policy.retryBackoffSeconds.length !== policy.maxAutomaticRetriesPerRun) {
    throw new ResearchAllowlistValidationError(
      "retryBackoffSeconds length must match maxAutomaticRetriesPerRun."
    );
  }
}

function assertStalenessPolicy(policy: ResearchStalenessPolicy) {
  assertObjectKeys(policy, "stalenessPolicy", [
    "staleWhenRunExceedsTaskFreshnessWindow",
    "staleWhenSourcePredatesTaskRequirement"
  ]);

  if (
    policy.staleWhenRunExceedsTaskFreshnessWindow !== true ||
    policy.staleWhenSourcePredatesTaskRequirement !== true
  ) {
    throw new ResearchAllowlistValidationError("stalenessPolicy must preserve the docs/30 stale-sensitive defaults.");
  }
}

function assertDisclosureLogPolicy(policy: ResearchDisclosureLogPolicy) {
  assertObjectKeys(policy, "disclosureLogPolicy", ["logEveryAutomaticRun", "publicSafeSummaryRequired"]);

  if (policy.logEveryAutomaticRun !== true || policy.publicSafeSummaryRequired !== true) {
    throw new ResearchAllowlistValidationError("disclosureLogPolicy must require logs and public-safe summaries.");
  }
}

function assertLifecycleTimestamps(allowlist: ResearchAllowlistProjection) {
  if (allowlist.status === "active") {
    if (allowlist.pausedAt || allowlist.revokedAt) {
      throw new ResearchAllowlistValidationError("active allowlists must not carry pausedAt or revokedAt.");
    }

    return;
  }

  if (allowlist.status === "paused") {
    if (!allowlist.pausedAt) {
      throw new ResearchAllowlistValidationError("paused allowlists require pausedAt.");
    }

    if (allowlist.revokedAt) {
      throw new ResearchAllowlistValidationError("paused allowlists must not carry revokedAt.");
    }

    assertIsoTimestamp(allowlist.pausedAt, "pausedAt");
    return;
  }

  if (!allowlist.revokedAt) {
    throw new ResearchAllowlistValidationError("revoked allowlists require revokedAt.");
  }

  if (allowlist.pausedAt) {
    throw new ResearchAllowlistValidationError("revoked allowlists must not carry pausedAt.");
  }

  assertIsoTimestamp(allowlist.revokedAt, "revokedAt");
}

export function validateResearchAllowlistProjection(
  allowlist: ResearchAllowlistProjection
): ResearchAllowlistProjection {
  assertObjectKeys(allowlist, "allowlist", RESEARCH_ALLOWLIST_PROJECTION_KEYS);

  if (allowlist.kind !== "ResearchAllowlistProjection") {
    throw new ResearchAllowlistValidationError("allowlist kind must be ResearchAllowlistProjection.");
  }

  assertProjectionVersion(allowlist.version);
  assertNonEmptyString(allowlist.allowlistId, "allowlistId");
  assertNonEmptyString(allowlist.projectId, "projectId");
  assertNonEmptyString(allowlist.approvedBy, "approvedBy");

  if (!isResearchAllowlistStatus(allowlist.status)) {
    throw new ResearchAllowlistValidationError("allowlist status must be active, paused, or revoked.");
  }

  assertIsoTimestamp(allowlist.approvedAt, "approvedAt");
  assertIsoTimestamp(allowlist.createdAt, "createdAt");
  assertIsoTimestamp(allowlist.updatedAt, "updatedAt");
  assertSafeConnectorIds(allowlist.connectorIds);
  assertSupportedResearchAllowlistCombination(allowlist.sourceCategories, allowlist.contextMode);
  assertRateBudgetPolicy(allowlist.rateBudgetPolicy);
  assertStalenessPolicy(allowlist.stalenessPolicy);
  assertDisclosureLogPolicy(allowlist.disclosureLogPolicy);
  assertLifecycleTimestamps(allowlist);

  return allowlist;
}
