import type {
  ProjectId,
  ProjectionVersion,
  ResearchAllowlistId,
  ResearchConnectorId,
  ResearchDisclosureLogId
} from "../ids";
import {
  AUTOMATIC_RESEARCH_SOURCE_CATEGORIES,
  MANUAL_RESEARCH_SOURCE_CATEGORIES,
  assertSafeResearchConnectorId,
  type ResearchSourceCategory
} from "./research-allowlist";

export type ResearchDisclosureLogStatus = "automatic_payload_ready" | "blocked_manual_handoff";

export type ResearchDisclosureBlockReason =
  | "allowlist_missing"
  | "allowlist_paused"
  | "allowlist_revoked"
  | "connector_not_allowed"
  | "source_category_not_allowed"
  | "manual_source_category"
  | "private_context_material";

export interface ResearchDisclosureLogEntry {
  readonly logId: ResearchDisclosureLogId;
  readonly projectId: ProjectId;
  readonly allowlistId?: ResearchAllowlistId;
  readonly connectorId: ResearchConnectorId;
  readonly sourceCategory: ResearchSourceCategory;
  readonly researchObjective: string;
  readonly objectiveSummary: string;
  readonly publicSafeSummarySent: string;
  readonly sourceRefs: readonly string[];
  readonly automaticExternalTransferAllowed: boolean;
  readonly status: ResearchDisclosureLogStatus;
  readonly blockReason?: ResearchDisclosureBlockReason;
  readonly manualHandoffReason?: string;
  readonly createdAt: string;
}

export interface ResearchDisclosureLogProjection {
  readonly kind: "ResearchDisclosureLogProjection";
  readonly version: ProjectionVersion;
  readonly projectId: ProjectId;
  readonly generatedAt: string;
  readonly stale: false;
  readonly refetchUrl: string;
  readonly disclosureLogs: readonly ResearchDisclosureLogEntry[];
  readonly latestDisclosureLog?: ResearchDisclosureLogEntry;
}

export const RESEARCH_DISCLOSURE_LOG_STATUSES = [
  "automatic_payload_ready",
  "blocked_manual_handoff"
] as const satisfies readonly ResearchDisclosureLogStatus[];

export const RESEARCH_DISCLOSURE_BLOCK_REASONS = [
  "allowlist_missing",
  "allowlist_paused",
  "allowlist_revoked",
  "connector_not_allowed",
  "source_category_not_allowed",
  "manual_source_category",
  "private_context_material"
] as const satisfies readonly ResearchDisclosureBlockReason[];

export class ResearchDisclosureLogValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResearchDisclosureLogValidationError";
  }
}

const RESEARCH_DISCLOSURE_LOG_ENTRY_KEYS = [
  "logId",
  "projectId",
  "allowlistId",
  "connectorId",
  "sourceCategory",
  "researchObjective",
  "objectiveSummary",
  "publicSafeSummarySent",
  "sourceRefs",
  "automaticExternalTransferAllowed",
  "status",
  "blockReason",
  "manualHandoffReason",
  "createdAt"
] as const;

function assertObjectKeys(value: unknown, fieldName: string, allowedKeys: readonly string[]): asserts value is object {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ResearchDisclosureLogValidationError(`${fieldName} must be a JSON object.`);
  }

  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.includes(key));

  if (unknownKeys.length > 0) {
    throw new ResearchDisclosureLogValidationError(`${fieldName} contains unsupported fields: ${unknownKeys.join(", ")}.`);
  }
}

function hasOwnField(value: object, fieldName: string) {
  return Object.prototype.hasOwnProperty.call(value, fieldName);
}

function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ResearchDisclosureLogValidationError(`${fieldName} must be a non-empty string.`);
  }
}

function assertOptionalNonEmptyString(value: unknown, fieldName: string): asserts value is string | undefined {
  if (value === undefined) {
    return;
  }

  assertNonEmptyString(value, fieldName);
}

function assertIsoTimestamp(value: unknown, fieldName: string) {
  assertNonEmptyString(value, fieldName);

  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new ResearchDisclosureLogValidationError(`${fieldName} must be an ISO timestamp.`);
  }
}

function assertSourceRefs(sourceRefs: readonly string[]) {
  if (!Array.isArray(sourceRefs)) {
    throw new ResearchDisclosureLogValidationError("sourceRefs must be an array.");
  }

  const seen = new Set<string>();

  for (const sourceRef of sourceRefs) {
    assertNonEmptyString(sourceRef, "sourceRefs");

    if (seen.has(sourceRef)) {
      throw new ResearchDisclosureLogValidationError("sourceRefs must not contain duplicate values.");
    }

    seen.add(sourceRef);
  }
}

function isResearchDisclosureLogStatus(value: string): value is ResearchDisclosureLogStatus {
  return RESEARCH_DISCLOSURE_LOG_STATUSES.includes(value as ResearchDisclosureLogStatus);
}

function isResearchDisclosureBlockReason(value: string): value is ResearchDisclosureBlockReason {
  return RESEARCH_DISCLOSURE_BLOCK_REASONS.includes(value as ResearchDisclosureBlockReason);
}

function isResearchSourceCategory(value: string): value is ResearchSourceCategory {
  return [
    ...AUTOMATIC_RESEARCH_SOURCE_CATEGORIES,
    ...MANUAL_RESEARCH_SOURCE_CATEGORIES
  ].includes(value as ResearchSourceCategory);
}

function assertResearchConnectorId(value: ResearchConnectorId) {
  try {
    assertSafeResearchConnectorId(value);
  } catch {
    throw new ResearchDisclosureLogValidationError(
      "connectorId must be a stable approved non-secret research connector slug."
    );
  }
}

export function validateResearchDisclosureLogEntry(
  entry: ResearchDisclosureLogEntry
): ResearchDisclosureLogEntry {
  assertObjectKeys(entry, "disclosureLog", RESEARCH_DISCLOSURE_LOG_ENTRY_KEYS);
  assertNonEmptyString(entry.logId, "logId");
  assertNonEmptyString(entry.projectId, "projectId");
  assertOptionalNonEmptyString(entry.allowlistId, "allowlistId");
  assertNonEmptyString(entry.connectorId, "connectorId");
  assertResearchConnectorId(entry.connectorId);
  assertNonEmptyString(entry.sourceCategory, "sourceCategory");
  if (!isResearchSourceCategory(entry.sourceCategory)) {
    throw new ResearchDisclosureLogValidationError("sourceCategory must be a canonical research source category.");
  }
  assertNonEmptyString(entry.researchObjective, "researchObjective");
  assertNonEmptyString(entry.objectiveSummary, "objectiveSummary");
  assertNonEmptyString(entry.publicSafeSummarySent, "publicSafeSummarySent");
  assertSourceRefs(entry.sourceRefs);
  assertIsoTimestamp(entry.createdAt, "createdAt");

  if (!isResearchDisclosureLogStatus(entry.status)) {
    throw new ResearchDisclosureLogValidationError("status must be automatic_payload_ready or blocked_manual_handoff.");
  }

  if (entry.automaticExternalTransferAllowed !== (entry.status === "automatic_payload_ready")) {
    throw new ResearchDisclosureLogValidationError(
      "automaticExternalTransferAllowed must match the disclosure log status."
    );
  }

  if (entry.status === "automatic_payload_ready") {
    if (!entry.allowlistId) {
      throw new ResearchDisclosureLogValidationError("automatic disclosure logs require allowlistId.");
    }

    if (hasOwnField(entry, "blockReason") || hasOwnField(entry, "manualHandoffReason")) {
      throw new ResearchDisclosureLogValidationError(
        "automatic disclosure logs must not carry blockReason or manualHandoffReason."
      );
    }
  } else {
    assertNonEmptyString(entry.blockReason, "blockReason");
    assertNonEmptyString(entry.manualHandoffReason, "manualHandoffReason");

    if (!isResearchDisclosureBlockReason(entry.blockReason)) {
      throw new ResearchDisclosureLogValidationError("blockReason must be a canonical research disclosure blocker.");
    }
  }

  return entry;
}
