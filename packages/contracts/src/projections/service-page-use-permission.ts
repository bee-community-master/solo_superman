import type { ProjectionVersion, SchemaVersion, SessionId } from "../ids";

export const SERVICE_PAGE_USE_PERMISSION_SCHEMA_VERSION =
  "solo-superman.service-page-use-permission.v1" as SchemaVersion;

export const SERVICE_PAGE_USE_PERMISSION_ACTION_CLASSES = [
  "read",
  "fill_draft",
  "preview",
  "copy_generated_value",
  "final_submit_request"
] as const;

export type ServicePageUseActionClass = (typeof SERVICE_PAGE_USE_PERMISSION_ACTION_CLASSES)[number];

export const SERVICE_PAGE_USE_PERMISSION_BLOCKED_ACTION_CLASSES = [
  "credential_entry",
  "secret_storage",
  "unattended_login",
  "payment_submit",
  "legal_submit",
  "medical_submit",
  "financial_submit",
  "privacy_submit",
  "production_deploy",
  "dns_cutover",
  "account_deletion"
] as const;

export type ServicePageBlockedActionClass = (typeof SERVICE_PAGE_USE_PERMISSION_BLOCKED_ACTION_CLASSES)[number];

export const SERVICE_PAGE_USE_PERMISSION_DATA_CATEGORIES = [
  "public_page_content",
  "account_profile_metadata",
  "user_provided_project_context",
  "generated_draft_content",
  "redacted_form_values",
  "prompt_result_screenshot_log_refs"
] as const;

export type ServicePageDataCategory = (typeof SERVICE_PAGE_USE_PERMISSION_DATA_CATEGORIES)[number];

export const SERVICE_PAGE_USE_PERMISSION_APPROVAL_GRANULARITIES = [
  "per_action",
  "per_page",
  "per_setup_step"
] as const;

export type ServicePageApprovalGranularity =
  (typeof SERVICE_PAGE_USE_PERMISSION_APPROVAL_GRANULARITIES)[number];

export const SERVICE_PAGE_USE_PERMISSION_APPROVAL_DECISIONS = ["approved"] as const;

export type ServicePageUsePermissionApprovalDecision =
  (typeof SERVICE_PAGE_USE_PERMISSION_APPROVAL_DECISIONS)[number];

export const SERVICE_PAGE_USE_PERMISSION_STATUSES = [
  "granted",
  "blocked",
  "final_submit_requested",
  "revoked"
] as const;

export type ServicePageUsePermissionStatus = (typeof SERVICE_PAGE_USE_PERMISSION_STATUSES)[number];

export const SERVICE_PAGE_USE_PERMISSION_BLOCK_CODES = [
  "invalid_service_origin",
  "invalid_page_url",
  "missing_redaction_preview",
  "missing_export_delete_controls",
  "missing_user_approval",
  "credential_or_secret_value",
  "user_login_not_present",
  "fill_draft_requires_per_action",
  "copy_generated_value_requires_per_action",
  "final_submit_requires_confirmation_and_authority",
  "sensitive_or_production_action",
  "revoked_by_user"
] as const;

export type ServicePageUsePermissionBlockCode =
  (typeof SERVICE_PAGE_USE_PERMISSION_BLOCK_CODES)[number];

export const SERVICE_PAGE_USE_PERMISSION_AUDIT_EVENT_TYPES = [
  "permission_preview",
  "user_present_login_required",
  "redaction_preview",
  "ServicePagePermissionGranted",
  "ServicePagePermissionRevoked",
  "ServicePageArtifactsDeleted",
  "ServicePageActionBlocked",
  "ServicePageFinalSubmitRequested"
] as const;

export type ServicePageUsePermissionAuditEventType =
  (typeof SERVICE_PAGE_USE_PERMISSION_AUDIT_EVENT_TYPES)[number];

export interface ServicePageUsePermissionBlockReasonDto {
  readonly code: ServicePageUsePermissionBlockCode;
  readonly message: string;
  readonly evidenceRefs: readonly string[];
}

export interface ServicePageUsePermissionAuditEntry {
  readonly eventType: ServicePageUsePermissionAuditEventType;
  readonly label: string;
  readonly evidenceRefs: readonly string[];
}

export interface ServicePageArtifactRetentionPolicy {
  readonly promptResultScreenshotLogRetention: "default_evidence_refs_only" | "deleted_audit_metadata_only";
  readonly redactionPreviewRef: string | null;
  readonly userExportDeleteControls: true;
  readonly deletionLeavesAuditMetadataOnly: true;
  readonly artifactRefsDeletedAt: string | null;
  readonly artifactRefsDeletionAuditRef: string | null;
  readonly forbiddenRetentionPolicy: "no_credential_session_secret_2fa_payment_legal_medical_financial_privacy_values";
}

export interface ServicePageFinalSubmitBoundary {
  readonly requested: boolean;
  readonly confirmationCardRef: string | null;
  readonly executionAuthorityRef: string | null;
  readonly productionMutationPerformed: false;
}

export interface ServicePageUsePermissionRecord {
  readonly permissionId: string;
  readonly serviceName: string;
  readonly serviceOrigin: string;
  readonly pageUrl: string;
  readonly purpose: string;
  readonly allowedActionClasses: readonly ServicePageUseActionClass[];
  readonly blockedActionClasses: readonly ServicePageBlockedActionClass[];
  readonly dataCategories: readonly ServicePageDataCategory[];
  readonly approvalGranularity: ServicePageApprovalGranularity;
  readonly approvalDecision: ServicePageUsePermissionApprovalDecision;
  readonly userApprovalRef: string;
  readonly status: ServicePageUsePermissionStatus;
  readonly userVisibleExplanation: string;
  readonly nextAction: string;
  readonly userPresentLoginRequired: true;
  readonly credentialEntryDelegated: false;
  readonly fillDraftRequiresPerActionApproval: true;
  readonly finalSubmitRequiresSeparateConfirmation: true;
  readonly finalSubmitBoundary: ServicePageFinalSubmitBoundary;
  readonly artifactRetention: ServicePageArtifactRetentionPolicy;
  readonly promptPreviewRef: string | null;
  readonly screenshotRefs: readonly string[];
  readonly logRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly auditRefs: readonly string[];
  readonly activityFeedRefs: readonly string[];
  readonly blockReasons: readonly ServicePageUsePermissionBlockReasonDto[];
  readonly auditLog: readonly ServicePageUsePermissionAuditEntry[];
  readonly canRevoke: boolean;
  readonly createdAt: string;
  readonly revokedAt: string | null;
  readonly schemaVersion: SchemaVersion;
}

export interface ServicePageUsePermissionProjection {
  readonly kind: "ServicePageUsePermissionProjection";
  readonly sessionId: SessionId;
  readonly version: ProjectionVersion;
  readonly currentStatus: ServicePageUsePermissionStatus;
  readonly permissions: readonly ServicePageUsePermissionRecord[];
  readonly latestPermission: ServicePageUsePermissionRecord;
  readonly blockedPreconditions: readonly ServicePageUsePermissionBlockReasonDto[];
  readonly summary: string;
  readonly refetchUrl: string;
}

export interface CreateServicePageUsePermissionPayload {
  readonly serviceName: string;
  readonly serviceOrigin: string;
  readonly pageUrl: string;
  readonly purpose: string;
  readonly allowedActionClasses: readonly ServicePageUseActionClass[];
  readonly blockedActionClasses: readonly ServicePageBlockedActionClass[];
  readonly dataCategories: readonly ServicePageDataCategory[];
  readonly approvalGranularity: ServicePageApprovalGranularity;
  readonly approvalDecision: ServicePageUsePermissionApprovalDecision;
  readonly userApprovalRef: string;
  readonly promptPreviewRef: string;
  readonly redactionPreviewRef: string;
  readonly userExportDeleteControls: true;
  readonly finalSubmitRequested?: boolean;
  readonly finalSubmitConfirmationRef?: string;
  readonly finalSubmitExecutionAuthorityRef?: string;
  readonly screenshotRefs?: readonly string[];
  readonly logRefs?: readonly string[];
  readonly evidenceRefs?: readonly string[];
  readonly auditRefs?: readonly string[];
  readonly activityFeedRefs?: readonly string[];
}

export interface RevokeServicePageUsePermissionPayload {
  readonly permissionId: string;
  readonly reason: string;
  readonly auditRefs?: readonly string[];
}

export interface DeleteServicePageUsePermissionArtifactsPayload {
  readonly permissionId: string;
  readonly reason: string;
  readonly auditRefs?: readonly string[];
}

export class ServicePageUsePermissionValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Invalid ServicePageUsePermissionProjection: ${issues.join("; ")}`);
    this.name = "ServicePageUsePermissionValidationError";
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const SERVICE_PAGE_REF_FORBIDDEN_CONTENT_PATTERN =
  /(?:password|passwd|secret|bearer|cookie|session[_-]?cookie|2fa|mfa|otp|totp|api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|auth[_-]?token|payment[_-]?token|financial[_-]?token|privacy[_-]?token|sk-|xox[baprs]-|gh[pousr]_|github_pat_)/iu;

export function servicePageUsePermissionRefHasForbiddenCustodyContent(value: string) {
  return (
    SERVICE_PAGE_REF_FORBIDDEN_CONTENT_PATTERN.test(value) ||
    /\bBearer\s+[A-Za-z0-9._~+/-]{10,}/u.test(value)
  );
}

function stringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function servicePagePermissionRefStrings(permission: ServicePageUsePermissionRecord) {
  return [
    permission.userApprovalRef,
    permission.promptPreviewRef,
    permission.artifactRetention.redactionPreviewRef,
    permission.artifactRetention.artifactRefsDeletionAuditRef,
    permission.finalSubmitBoundary.confirmationCardRef,
    permission.finalSubmitBoundary.executionAuthorityRef,
    ...permission.screenshotRefs,
    ...permission.logRefs,
    ...permission.evidenceRefs,
    ...permission.auditRefs,
    ...permission.activityFeedRefs,
    ...permission.blockReasons.flatMap((reason) => reason.evidenceRefs),
    ...permission.auditLog.flatMap((entry) => entry.evidenceRefs)
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function isOneOf<TValue extends string>(
  value: unknown,
  allowedValues: readonly TValue[]
): value is TValue {
  return typeof value === "string" && allowedValues.includes(value as TValue);
}

function isActionClass(value: unknown): value is ServicePageUseActionClass {
  return isOneOf(value, SERVICE_PAGE_USE_PERMISSION_ACTION_CLASSES);
}

function isBlockedActionClass(value: unknown): value is ServicePageBlockedActionClass {
  return isOneOf(value, SERVICE_PAGE_USE_PERMISSION_BLOCKED_ACTION_CLASSES);
}

function isDataCategory(value: unknown): value is ServicePageDataCategory {
  return isOneOf(value, SERVICE_PAGE_USE_PERMISSION_DATA_CATEGORIES);
}

function servicePageOriginFromPageUrl(pageUrl: string) {
  const match = pageUrl.match(/^(https:\/\/[a-z0-9.-]+(?::[0-9]{1,5})?)(?:[/?#]|$)/iu);

  return match?.[1] ?? null;
}

function servicePageUrlMatchesOrigin(serviceOrigin: string, pageUrl: string) {
  return servicePageOriginFromPageUrl(pageUrl) === serviceOrigin;
}

function isBlockReason(value: unknown): value is ServicePageUsePermissionBlockReasonDto {
  return (
    isRecord(value) &&
    isOneOf(value.code, SERVICE_PAGE_USE_PERMISSION_BLOCK_CODES) &&
    isNonEmptyString(value.message) &&
    stringArray(value.evidenceRefs)
  );
}

function isAuditEntry(value: unknown): value is ServicePageUsePermissionAuditEntry {
  return (
    isRecord(value) &&
    isOneOf(value.eventType, SERVICE_PAGE_USE_PERMISSION_AUDIT_EVENT_TYPES) &&
    isNonEmptyString(value.label) &&
    stringArray(value.evidenceRefs)
  );
}

function isArtifactRetentionPolicy(value: unknown): value is ServicePageArtifactRetentionPolicy {
  if (!isRecord(value) || value.userExportDeleteControls !== true || value.deletionLeavesAuditMetadataOnly !== true) {
    return false;
  }

  if (
    value.forbiddenRetentionPolicy !==
      "no_credential_session_secret_2fa_payment_legal_medical_financial_privacy_values"
  ) {
    return false;
  }

  if (value.promptResultScreenshotLogRetention === "default_evidence_refs_only") {
    return (
      isNonEmptyString(value.redactionPreviewRef) &&
      value.artifactRefsDeletedAt === null &&
      value.artifactRefsDeletionAuditRef === null
    );
  }

  return (
    value.promptResultScreenshotLogRetention === "deleted_audit_metadata_only" &&
    value.redactionPreviewRef === null &&
    isNonEmptyString(value.artifactRefsDeletedAt) &&
    isNonEmptyString(value.artifactRefsDeletionAuditRef)
  );
}

function isFinalSubmitBoundary(value: unknown): value is ServicePageFinalSubmitBoundary {
  return (
    isRecord(value) &&
    typeof value.requested === "boolean" &&
    (value.confirmationCardRef === null || isNonEmptyString(value.confirmationCardRef)) &&
    (value.executionAuthorityRef === null || isNonEmptyString(value.executionAuthorityRef)) &&
    value.productionMutationPerformed === false
  );
}

export function servicePageUsePermissionSummaryForStatus(status: ServicePageUsePermissionStatus) {
  switch (status) {
    case "granted":
      return "Service page-use permission is granted for bounded visible page actions.";
    case "blocked":
      return "Service page-use permission is blocked until the visible safety boundary is fixed.";
    case "final_submit_requested":
      return "Final submit has been requested but remains gated by confirmation and execution authority.";
    case "revoked":
      return "Service page-use permission was revoked; further page-use actions are blocked.";
  }
}

export function servicePageUsePermissionIsRevokableStatus(status: ServicePageUsePermissionStatus) {
  return status === "granted" || status === "final_submit_requested";
}

export function validateServicePageUsePermissionProjection(
  projection: ServicePageUsePermissionProjection
): ServicePageUsePermissionProjection {
  const issues: string[] = [];
  const latestPermission = projection.latestPermission;

  if (projection.kind !== "ServicePageUsePermissionProjection") {
    issues.push("kind must be ServicePageUsePermissionProjection");
  }
  if (!projection.permissions.length) {
    issues.push("permissions must include at least one ServicePageUsePermission record");
  }
  if (!SERVICE_PAGE_USE_PERMISSION_STATUSES.includes(projection.currentStatus)) {
    issues.push("currentStatus must be a ServicePageUsePermissionStatus");
  }
  if (latestPermission.permissionId !== projection.permissions.at(-1)?.permissionId) {
    issues.push("latestPermission must point to the newest permission record");
  }
  if (projection.summary !== servicePageUsePermissionSummaryForStatus(projection.currentStatus)) {
    issues.push("summary must match the current status");
  }

  for (const permission of projection.permissions) {
    if (!isNonEmptyString(permission.permissionId)) {
      issues.push("permissionId is required");
    }
    if (!isNonEmptyString(permission.serviceName) || !isNonEmptyString(permission.serviceOrigin)) {
      issues.push("serviceName and serviceOrigin are required");
    }
    if (!permission.serviceOrigin.startsWith("https://")) {
      issues.push("serviceOrigin must be an https origin; loopback/browser dry-runs use evidence refs, not credential custody");
    }
    if (!isNonEmptyString(permission.purpose)) {
      issues.push("purpose is required");
    }
    if (!isNonEmptyString(permission.pageUrl)) {
      issues.push("pageUrl is required");
    }
    if (
      permission.status !== "blocked" &&
      !servicePageUrlMatchesOrigin(permission.serviceOrigin, permission.pageUrl)
    ) {
      issues.push("non-blocked pageUrl must be an https URL on the approved service origin");
    }
    if (!permission.allowedActionClasses.length || !permission.allowedActionClasses.every(isActionClass)) {
      issues.push("allowedActionClasses must include valid page-use action classes");
    }
    if (!permission.blockedActionClasses.length || !permission.blockedActionClasses.every(isBlockedActionClass)) {
      issues.push("blockedActionClasses must include valid sensitive/production blocked classes");
    }
    if (!permission.dataCategories.length || !permission.dataCategories.every(isDataCategory)) {
      issues.push("dataCategories must include valid visible data categories");
    }
    if (!SERVICE_PAGE_USE_PERMISSION_APPROVAL_GRANULARITIES.includes(permission.approvalGranularity)) {
      issues.push("approvalGranularity must be valid");
    }
    if (
      !SERVICE_PAGE_USE_PERMISSION_APPROVAL_DECISIONS.includes(permission.approvalDecision) ||
      !isNonEmptyString(permission.userApprovalRef)
    ) {
      issues.push("service page-use grant requires an explicit user approval ref after preview");
    }
    if (permission.userPresentLoginRequired !== true || permission.credentialEntryDelegated !== false) {
      issues.push("login credentials must stay user-owned and never delegated");
    }
    if (!permission.fillDraftRequiresPerActionApproval || !permission.finalSubmitRequiresSeparateConfirmation) {
      issues.push("fill-draft and final-submit permissions must stay separate");
    }
    if (!isFinalSubmitBoundary(permission.finalSubmitBoundary)) {
      issues.push("finalSubmitBoundary must preserve confirmation, authority, and no-production-mutation state");
    }
    if (!isArtifactRetentionPolicy(permission.artifactRetention)) {
      issues.push("artifactRetention must include redaction preview and export/delete controls");
    }
    if (permission.artifactRetention.promptResultScreenshotLogRetention === "default_evidence_refs_only") {
      if (!isNonEmptyString(permission.promptPreviewRef)) {
        issues.push("promptPreviewRef is required while retained artifact refs are available");
      }
    } else if (
      permission.promptPreviewRef !== null ||
      permission.screenshotRefs.length > 0 ||
      permission.logRefs.length > 0
    ) {
      issues.push("deleted artifact refs must clear prompt, screenshot, and log refs while preserving audit metadata");
    }
    if (!stringArray(permission.screenshotRefs) || !stringArray(permission.logRefs)) {
      issues.push("screenshotRefs and logRefs must be string arrays");
    }
    if (!stringArray(permission.evidenceRefs) || !permission.evidenceRefs.length) {
      issues.push("evidenceRefs must preserve page-use evidence");
    }
    if (!stringArray(permission.auditRefs) || !permission.auditRefs.length) {
      issues.push("auditRefs must preserve page-use audit evidence");
    }
    if (!stringArray(permission.activityFeedRefs) || !permission.activityFeedRefs.length) {
      issues.push("activityFeedRefs must link the permission to a setup step or decision");
    }
    if (!Array.isArray(permission.blockReasons) || !permission.blockReasons.every(isBlockReason)) {
      issues.push("blockReasons must use valid ServicePageUsePermissionBlockReasonDto entries");
    }
    if (!Array.isArray(permission.auditLog) || !permission.auditLog.length || !permission.auditLog.every(isAuditEntry)) {
      issues.push("auditLog must include valid user-visible service page-use audit entries");
    }
    if (servicePagePermissionRefStrings(permission).some(servicePageUsePermissionRefHasForbiddenCustodyContent)) {
      issues.push("service page-use refs must not contain credential/session/token/secret-bearing values");
    }
    if (permission.canRevoke !== servicePageUsePermissionIsRevokableStatus(permission.status)) {
      issues.push("canRevoke must match the permission status");
    }
  }

  if (issues.length) {
    throw new ServicePageUsePermissionValidationError(issues);
  }

  return projection;
}

export const SERVICE_PAGE_USE_PERMISSION_READY_FIXTURE: ServicePageUsePermissionRecord = {
  permissionId: "service_page_permission_vercel_ready",
  serviceName: "Vercel",
  serviceOrigin: "https://vercel.com",
  pageUrl: "https://vercel.com/new",
  purpose: "Prepare a deployment settings draft while the user stays present and logged in.",
  allowedActionClasses: ["read", "preview"],
  blockedActionClasses: SERVICE_PAGE_USE_PERMISSION_BLOCKED_ACTION_CLASSES,
  dataCategories: ["public_page_content", "user_provided_project_context", "prompt_result_screenshot_log_refs"],
  approvalGranularity: "per_page",
  approvalDecision: "approved",
  userApprovalRef: "user_approval_service_page_vercel",
  status: "granted",
  userVisibleExplanation: servicePageUsePermissionSummaryForStatus("granted"),
  nextAction: "Keep the service page visible; approve fill-draft or final-submit actions separately.",
  userPresentLoginRequired: true,
  credentialEntryDelegated: false,
  fillDraftRequiresPerActionApproval: true,
  finalSubmitRequiresSeparateConfirmation: true,
  finalSubmitBoundary: {
    requested: false,
    confirmationCardRef: null,
    executionAuthorityRef: null,
    productionMutationPerformed: false
  },
  artifactRetention: {
    promptResultScreenshotLogRetention: "default_evidence_refs_only",
    redactionPreviewRef: "redaction_preview_service_page_vercel",
    userExportDeleteControls: true,
    deletionLeavesAuditMetadataOnly: true,
    artifactRefsDeletedAt: null,
    artifactRefsDeletionAuditRef: null,
    forbiddenRetentionPolicy:
      "no_credential_session_secret_2fa_payment_legal_medical_financial_privacy_values"
  },
  promptPreviewRef: "prompt_preview_service_page_vercel",
  screenshotRefs: ["screenshot:service-page-vercel-preview"],
  logRefs: ["log:service-page-vercel-preview"],
  evidenceRefs: ["evidence:service-page-vercel-preview"],
  auditRefs: ["audit:service-page-vercel-preview"],
  activityFeedRefs: ["setup_step:vercel-deploy-settings"],
  blockReasons: [],
  auditLog: [
    {
      eventType: "permission_preview",
      label: "Service origin, purpose, data categories, allowed actions, and blocked actions were previewed.",
      evidenceRefs: ["prompt_preview_service_page_vercel"]
    },
    {
      eventType: "ServicePagePermissionGranted",
      label: "User granted bounded page-use permission without credential custody.",
      evidenceRefs: ["audit:service-page-vercel-preview"]
    }
  ],
  canRevoke: true,
  createdAt: "2026-05-13T00:00:00.000Z",
  revokedAt: null,
  schemaVersion: SERVICE_PAGE_USE_PERMISSION_SCHEMA_VERSION
};

export const SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE =
  validateServicePageUsePermissionProjection({
    kind: "ServicePageUsePermissionProjection",
    sessionId: "demo-session" as SessionId,
    version: 1 as ProjectionVersion,
    currentStatus: "granted",
    permissions: [SERVICE_PAGE_USE_PERMISSION_READY_FIXTURE],
    latestPermission: SERVICE_PAGE_USE_PERMISSION_READY_FIXTURE,
    blockedPreconditions: [],
    summary: servicePageUsePermissionSummaryForStatus("granted"),
    refetchUrl: "/api/v1/sessions/demo-session/service-page-use-permissions"
  });
