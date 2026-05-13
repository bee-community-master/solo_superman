import type { ProjectionVersion, ResearchResultId, ResearchTaskId, SchemaVersion, SessionId } from "../ids";
import { containsExecutionAuthoritySecretValueLeak, isExecutionAuthorityIsoTimestamp } from "./execution-authority";

export const CHATGPT_BROWSER_DELEGATION_SCHEMA_VERSION =
  "solo-superman.post-phase3-chatgpt-browser-delegation.v1" as SchemaVersion;

export const CHATGPT_BROWSER_DELEGATION_STATUSES = [
  "ready_for_browser_action",
  "result_import_ready",
  "fallback_required",
  "blocked"
] as const;

export type ChatGptBrowserDelegationStatus = (typeof CHATGPT_BROWSER_DELEGATION_STATUSES)[number];

export const CHATGPT_BROWSER_DELEGATION_VERDICTS = ["pass", "block"] as const;
export type ChatGptBrowserDelegationVerdict = (typeof CHATGPT_BROWSER_DELEGATION_VERDICTS)[number];

export const CHATGPT_BROWSER_DELEGATION_APPROVAL_DECISIONS = [
  "pending",
  "approved",
  "rejected",
  "revision_requested"
] as const;

export type ChatGptBrowserDelegationApprovalDecision =
  (typeof CHATGPT_BROWSER_DELEGATION_APPROVAL_DECISIONS)[number];

export const CHATGPT_BROWSER_DELEGATION_FALLBACK_LANES = [
  "manual_prompt_handoff",
  "official_codex_path",
  "known_risk"
] as const;

export type ChatGptBrowserDelegationFallbackLane = (typeof CHATGPT_BROWSER_DELEGATION_FALLBACK_LANES)[number];

export const CHATGPT_BROWSER_DELEGATION_ARTIFACT_KINDS = [
  "prompt",
  "imported_result",
  "screenshot",
  "log"
] as const;

export type ChatGptBrowserDelegationArtifactKind = (typeof CHATGPT_BROWSER_DELEGATION_ARTIFACT_KINDS)[number];

export const CHATGPT_BROWSER_DELEGATION_FORBIDDEN_FIELD_KINDS = [
  "credential",
  "session",
  "secret",
  "2fa",
  "payment",
  "legal_sensitive"
] as const;

export type ChatGptBrowserDelegationForbiddenFieldKind =
  (typeof CHATGPT_BROWSER_DELEGATION_FORBIDDEN_FIELD_KINDS)[number];

export const CHATGPT_BROWSER_DELEGATION_IMPORT_GATE_STATUSES = ["pass", "block"] as const;
export type ChatGptBrowserDelegationImportGateStatus =
  (typeof CHATGPT_BROWSER_DELEGATION_IMPORT_GATE_STATUSES)[number];

export const CHATGPT_BROWSER_DELEGATION_BLOCK_CODES = [
  "missing_data_disclosure_preview",
  "redaction_preview_missing",
  "missing_user_approval",
  "policy_risk_blocked",
  "session_ownership_blocked",
  "credential_or_session_custody_required",
  "account_sharing_or_resale_risk",
  "unattended_queue_risk",
  "missing_browser_action_authority",
  "result_import_gate_failed",
  "fallback_state_missing"
] as const;

export type ChatGptBrowserDelegationBlockCode = (typeof CHATGPT_BROWSER_DELEGATION_BLOCK_CODES)[number];

export interface ChatGptBrowserDelegationVerdictDto {
  readonly verdict: ChatGptBrowserDelegationVerdict;
  readonly rationale: string;
  readonly evidenceRefs: readonly string[];
}

export interface ChatGptBrowserDelegationRedactionSummary {
  readonly redactionPreviewRef: string;
  readonly redactedFieldKinds: readonly ChatGptBrowserDelegationForbiddenFieldKind[];
  readonly retainedArtifactKinds: readonly ChatGptBrowserDelegationArtifactKind[];
  readonly defaultRetention: "prompt_result_screenshot_log";
  readonly forbiddenRetentionPolicy: "no_credential_session_secret_2fa_payment_or_legal_sensitive_fields";
  readonly userExportDeleteControls: true;
  readonly deletionLeavesAuditMetadataOnly: true;
}

export interface ChatGptBrowserDelegationDataDisclosurePreview {
  readonly disclosurePreviewRef: string;
  readonly promptContextSummaryRef: string;
  readonly redactedPromptPreviewRef: string;
  readonly excludedSensitiveFieldKinds: readonly ChatGptBrowserDelegationForbiddenFieldKind[];
  readonly redactionPreviewShown: boolean;
  readonly userCanEditPromptBeforeRun: boolean;
}

export interface ChatGptBrowserDelegationResultImportGate {
  readonly sourceProvenanceStatus: ChatGptBrowserDelegationImportGateStatus;
  readonly uncertaintyStatus: ChatGptBrowserDelegationImportGateStatus;
  readonly conEvidenceStatus: ChatGptBrowserDelegationImportGateStatus;
  readonly staleRiskStatus: ChatGptBrowserDelegationImportGateStatus;
  readonly sourceRefs: readonly string[];
  readonly uncertaintyRefs: readonly string[];
  readonly conEvidenceRefs: readonly string[];
  readonly staleRiskRefs: readonly string[];
  readonly importRationale: string;
}

export interface ChatGptBrowserDelegationFallbackState {
  readonly lane: ChatGptBrowserDelegationFallbackLane;
  readonly visibleState: string;
  readonly reason: string;
  readonly userAction: string;
}

export interface ChatGptBrowserDelegationBlockReasonDto {
  readonly code: ChatGptBrowserDelegationBlockCode;
  readonly message: string;
  readonly evidenceRefs: readonly string[];
}

export interface ChatGptBrowserDelegationRun {
  readonly runId: string;
  readonly researchTaskId: ResearchTaskId;
  readonly promptPreviewRef: string;
  readonly dataDisclosurePreview: ChatGptBrowserDelegationDataDisclosurePreview;
  readonly redactionSummary: ChatGptBrowserDelegationRedactionSummary;
  readonly policyRiskVerdict: ChatGptBrowserDelegationVerdictDto;
  readonly sessionOwnershipVerdict: ChatGptBrowserDelegationVerdictDto;
  readonly approvalDecision: ChatGptBrowserDelegationApprovalDecision;
  readonly browserActionAuthorityRef: string | null;
  readonly resultImportRef: ResearchResultId | null;
  readonly resultImportGate: ChatGptBrowserDelegationResultImportGate | null;
  readonly fallbackApplied: ChatGptBrowserDelegationFallbackState | null;
  readonly blockReasons: readonly ChatGptBrowserDelegationBlockReasonDto[];
  readonly screenshotRefs: readonly string[];
  readonly logRefs: readonly string[];
  readonly auditRefs: readonly string[];
  readonly createdAt: string;
  readonly schemaVersion: typeof CHATGPT_BROWSER_DELEGATION_SCHEMA_VERSION;
}

export interface CreateChatGptBrowserDelegationRunPayload {
  readonly researchTaskId: ResearchTaskId;
  readonly promptPreviewRef: string;
  readonly dataDisclosurePreview: ChatGptBrowserDelegationDataDisclosurePreview;
  readonly redactionSummary: ChatGptBrowserDelegationRedactionSummary;
  readonly policyRiskVerdict: ChatGptBrowserDelegationVerdictDto;
  readonly sessionOwnershipVerdict: ChatGptBrowserDelegationVerdictDto;
  readonly approvalDecision: ChatGptBrowserDelegationApprovalDecision;
  readonly browserActionAuthorityRef?: string;
  readonly resultImportRef?: ResearchResultId;
  readonly resultImportGate?: ChatGptBrowserDelegationResultImportGate;
  readonly fallbackApplied?: ChatGptBrowserDelegationFallbackState;
  readonly screenshotRefs?: readonly string[];
  readonly logRefs?: readonly string[];
  readonly auditRefs?: readonly string[];
}

export interface ChatGptBrowserDelegationProjection {
  readonly kind: "ChatGptBrowserDelegationProjection";
  readonly sessionId: SessionId;
  readonly version: ProjectionVersion;
  readonly currentStatus: ChatGptBrowserDelegationStatus;
  readonly runs: readonly ChatGptBrowserDelegationRun[];
  readonly latestRun: ChatGptBrowserDelegationRun;
  readonly blockedPreconditions: readonly ChatGptBrowserDelegationBlockReasonDto[];
  readonly summary: string;
  readonly refetchUrl: string;
}

export class ChatGptBrowserDelegationValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid ChatGptBrowserDelegationRun: ${issues.join("; ")}`);
    this.name = "ChatGptBrowserDelegationValidationError";
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stringArray(value: unknown) {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function nonEmptyStringArray(value: unknown) {
  return stringArray(value) && value.length > 0;
}

function includesOnly<TValue extends string>(values: readonly string[], allowed: readonly TValue[]) {
  return values.every((value) => allowed.includes(value as TValue));
}

function hasDuplicates(values: readonly string[]) {
  return new Set(values).size !== values.length;
}

function isVerdictDto(value: unknown): value is ChatGptBrowserDelegationVerdictDto {
  return (
    isRecord(value) &&
    CHATGPT_BROWSER_DELEGATION_VERDICTS.includes(value.verdict as ChatGptBrowserDelegationVerdict) &&
    isNonEmptyString(value.rationale) &&
    stringArray(value.evidenceRefs)
  );
}

function isRedactionSummary(value: unknown): value is ChatGptBrowserDelegationRedactionSummary {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.redactionPreviewRef) &&
    stringArray(value.redactedFieldKinds) &&
    includesOnly(value.redactedFieldKinds as readonly string[], CHATGPT_BROWSER_DELEGATION_FORBIDDEN_FIELD_KINDS) &&
    stringArray(value.retainedArtifactKinds) &&
    includesOnly(value.retainedArtifactKinds as readonly string[], CHATGPT_BROWSER_DELEGATION_ARTIFACT_KINDS) &&
    value.defaultRetention === "prompt_result_screenshot_log" &&
    value.forbiddenRetentionPolicy === "no_credential_session_secret_2fa_payment_or_legal_sensitive_fields" &&
    value.userExportDeleteControls === true &&
    value.deletionLeavesAuditMetadataOnly === true
  );
}

function isDataDisclosurePreview(value: unknown): value is ChatGptBrowserDelegationDataDisclosurePreview {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.disclosurePreviewRef) &&
    isNonEmptyString(value.promptContextSummaryRef) &&
    isNonEmptyString(value.redactedPromptPreviewRef) &&
    stringArray(value.excludedSensitiveFieldKinds) &&
    includesOnly(value.excludedSensitiveFieldKinds as readonly string[], CHATGPT_BROWSER_DELEGATION_FORBIDDEN_FIELD_KINDS) &&
    typeof value.redactionPreviewShown === "boolean" &&
    typeof value.userCanEditPromptBeforeRun === "boolean"
  );
}

function isResultImportGate(value: unknown): value is ChatGptBrowserDelegationResultImportGate {
  if (!isRecord(value)) {
    return false;
  }

  return (
    CHATGPT_BROWSER_DELEGATION_IMPORT_GATE_STATUSES.includes(
      value.sourceProvenanceStatus as ChatGptBrowserDelegationImportGateStatus
    ) &&
    CHATGPT_BROWSER_DELEGATION_IMPORT_GATE_STATUSES.includes(
      value.uncertaintyStatus as ChatGptBrowserDelegationImportGateStatus
    ) &&
    CHATGPT_BROWSER_DELEGATION_IMPORT_GATE_STATUSES.includes(
      value.conEvidenceStatus as ChatGptBrowserDelegationImportGateStatus
    ) &&
    CHATGPT_BROWSER_DELEGATION_IMPORT_GATE_STATUSES.includes(
      value.staleRiskStatus as ChatGptBrowserDelegationImportGateStatus
    ) &&
    nonEmptyStringArray(value.sourceRefs) &&
    stringArray(value.uncertaintyRefs) &&
    stringArray(value.conEvidenceRefs) &&
    stringArray(value.staleRiskRefs) &&
    isNonEmptyString(value.importRationale)
  );
}

function isFallbackState(value: unknown): value is ChatGptBrowserDelegationFallbackState {
  return (
    isRecord(value) &&
    CHATGPT_BROWSER_DELEGATION_FALLBACK_LANES.includes(value.lane as ChatGptBrowserDelegationFallbackLane) &&
    isNonEmptyString(value.visibleState) &&
    isNonEmptyString(value.reason) &&
    isNonEmptyString(value.userAction)
  );
}

function isBlockReason(value: unknown): value is ChatGptBrowserDelegationBlockReasonDto {
  return (
    isRecord(value) &&
    CHATGPT_BROWSER_DELEGATION_BLOCK_CODES.includes(value.code as ChatGptBrowserDelegationBlockCode) &&
    isNonEmptyString(value.message) &&
    stringArray(value.evidenceRefs)
  );
}

export function chatGptBrowserDelegationStatusForRun(run: ChatGptBrowserDelegationRun): ChatGptBrowserDelegationStatus {
  if (run.blockReasons.length) {
    return run.fallbackApplied ? "fallback_required" : "blocked";
  }

  return run.resultImportRef ? "result_import_ready" : "ready_for_browser_action";
}

export function chatGptBrowserDelegationSummaryForStatus(status: ChatGptBrowserDelegationStatus) {
  switch (status) {
    case "ready_for_browser_action":
      return "ChatGPT browser delegation preflight is approved for one user-reviewed browser action run.";
    case "result_import_ready":
      return "ChatGPT browser delegation result is ready for research/evidence import with provenance gates preserved.";
    case "fallback_required":
      return "ChatGPT browser delegation is blocked and has a visible fallback state.";
    case "blocked":
      return "ChatGPT browser delegation is blocked before browser action start.";
  }
}

export function chatGptBrowserDelegationRunValidationIssues(
  run: ChatGptBrowserDelegationRun
): readonly string[] {
  const issues: string[] = [];

  if (!isNonEmptyString(run.runId)) {
    issues.push("runId is required");
  }

  if (!isNonEmptyString(run.researchTaskId)) {
    issues.push("researchTaskId is required");
  }

  if (!isNonEmptyString(run.promptPreviewRef)) {
    issues.push("promptPreviewRef is required");
  }

  if (!isDataDisclosurePreview(run.dataDisclosurePreview)) {
    issues.push("dataDisclosurePreview must include disclosure, context, redacted prompt, and redaction preview fields");
  } else {
    if (!run.dataDisclosurePreview.redactionPreviewShown) {
      issues.push("dataDisclosurePreview.redactionPreviewShown must be true before run start");
    }

    if (!run.dataDisclosurePreview.userCanEditPromptBeforeRun) {
      issues.push("dataDisclosurePreview.userCanEditPromptBeforeRun must be true before run start");
    }
  }

  if (!isRedactionSummary(run.redactionSummary)) {
    issues.push("redactionSummary must preserve retention/export/delete boundaries");
  } else {
    const retainedKinds = new Set(run.redactionSummary.retainedArtifactKinds);

    for (const artifactKind of CHATGPT_BROWSER_DELEGATION_ARTIFACT_KINDS) {
      if (!retainedKinds.has(artifactKind)) {
        issues.push(`redactionSummary.retainedArtifactKinds must include ${artifactKind}`);
      }
    }
  }

  if (!isVerdictDto(run.policyRiskVerdict)) {
    issues.push("policyRiskVerdict must be a valid verdict");
  }

  if (!isVerdictDto(run.sessionOwnershipVerdict)) {
    issues.push("sessionOwnershipVerdict must be a valid verdict");
  }

  if (!CHATGPT_BROWSER_DELEGATION_APPROVAL_DECISIONS.includes(run.approvalDecision)) {
    issues.push("approvalDecision is invalid");
  }

  if (run.browserActionAuthorityRef !== null && !isNonEmptyString(run.browserActionAuthorityRef)) {
    issues.push("browserActionAuthorityRef must be null or a non-empty string");
  }

  if (run.resultImportRef !== null && !isNonEmptyString(run.resultImportRef)) {
    issues.push("resultImportRef must be null or a non-empty string");
  }

  if (run.resultImportRef && !isResultImportGate(run.resultImportGate)) {
    issues.push("resultImportGate is required when resultImportRef is present");
  }

  if (run.resultImportGate) {
    const gateStatuses = [
      run.resultImportGate.sourceProvenanceStatus,
      run.resultImportGate.uncertaintyStatus,
      run.resultImportGate.conEvidenceStatus,
      run.resultImportGate.staleRiskStatus
    ];

    if (
      gateStatuses.some((status) => status !== "pass") &&
      !run.blockReasons.some((reason) => reason.code === "result_import_gate_failed")
    ) {
      issues.push("resultImportGate failures must be reflected as a result_import_gate_failed block reason");
    }
  }

  if (run.fallbackApplied !== null && !isFallbackState(run.fallbackApplied)) {
    issues.push("fallbackApplied must be null or a visible fallback state");
  }

  if (!Array.isArray(run.blockReasons) || !run.blockReasons.every(isBlockReason)) {
    issues.push("blockReasons must be valid ChatGptBrowserDelegationBlockReasonDto objects");
  }

  if (run.blockReasons.length && !run.fallbackApplied) {
    issues.push("blocked runs must include fallbackApplied so failures are not silent retries");
  }

  if (!stringArray(run.screenshotRefs)) {
    issues.push("screenshotRefs must be string refs");
  }

  if (!stringArray(run.logRefs)) {
    issues.push("logRefs must be string refs");
  }

  if (!stringArray(run.auditRefs) || !run.auditRefs.length) {
    issues.push("auditRefs must include at least one audit ref");
  }

  if (!isExecutionAuthorityIsoTimestamp(run.createdAt)) {
    issues.push("createdAt must be an ISO timestamp");
  }

  if (run.schemaVersion !== CHATGPT_BROWSER_DELEGATION_SCHEMA_VERSION) {
    issues.push("schemaVersion is invalid");
  }

  if (hasDuplicates(run.blockReasons.map((reason) => reason.code))) {
    issues.push("blockReasons must not duplicate block code");
  }

  if (containsExecutionAuthoritySecretValueLeak(run)) {
    issues.push("ChatGptBrowserDelegationRun must not contain credential, session, token, or secret values");
  }

  return issues;
}

export function validateChatGptBrowserDelegationRun(
  run: ChatGptBrowserDelegationRun
): ChatGptBrowserDelegationRun {
  const issues = chatGptBrowserDelegationRunValidationIssues(run);

  if (issues.length) {
    throw new ChatGptBrowserDelegationValidationError(issues);
  }

  return run;
}

export function validateChatGptBrowserDelegationProjection(
  projection: ChatGptBrowserDelegationProjection
): ChatGptBrowserDelegationProjection {
  const issues: string[] = [];

  if (projection.kind !== "ChatGptBrowserDelegationProjection") {
    issues.push("projection kind must be ChatGptBrowserDelegationProjection");
  }

  if (!isNonEmptyString(projection.sessionId)) {
    issues.push("sessionId is required");
  }

  if (!Number.isInteger(Number(projection.version)) || Number(projection.version) < 0) {
    issues.push("version must be a non-negative integer");
  }

  if (!projection.runs.length) {
    issues.push("projection requires at least one run");
  }

  for (const run of projection.runs) {
    issues.push(...chatGptBrowserDelegationRunValidationIssues(run));
  }

  const latestRun = projection.runs.at(-1);

  if (latestRun && latestRun.runId !== projection.latestRun.runId) {
    issues.push("latestRun must be the final run in runs");
  }

  if (latestRun) {
    const expectedStatus = chatGptBrowserDelegationStatusForRun(latestRun);

    if (projection.currentStatus !== expectedStatus) {
      issues.push("currentStatus must match latestRun status");
    }

    const expectedBlocked = expectedStatus === "fallback_required" || expectedStatus === "blocked"
      ? latestRun.blockReasons
      : [];

    if (JSON.stringify(projection.blockedPreconditions) !== JSON.stringify(expectedBlocked)) {
      issues.push("blockedPreconditions must mirror latest blocked run reasons or be empty");
    }

    const expectedSummary = chatGptBrowserDelegationSummaryForStatus(expectedStatus);

    if (projection.summary !== expectedSummary) {
      issues.push("summary must match currentStatus");
    }
  }

  if (!isNonEmptyString(projection.refetchUrl) || !projection.refetchUrl.includes("/chatgpt-browser-delegations")) {
    issues.push("refetchUrl must point to chatgpt browser delegation projection");
  }

  if (issues.length) {
    throw new ChatGptBrowserDelegationValidationError(issues);
  }

  return projection;
}

export const CHATGPT_BROWSER_DELEGATION_READY_RUN_FIXTURE = {
  runId: "chatgpt_delegation_ready_fixture",
  researchTaskId: "research_task_chatgpt_ready" as ResearchTaskId,
  promptPreviewRef: "prompt_preview_chatgpt_ready",
  dataDisclosurePreview: {
    disclosurePreviewRef: "disclosure_preview_chatgpt_ready",
    promptContextSummaryRef: "context_summary_chatgpt_ready",
    redactedPromptPreviewRef: "redacted_prompt_chatgpt_ready",
    excludedSensitiveFieldKinds: ["credential", "session", "secret", "2fa", "payment", "legal_sensitive"],
    redactionPreviewShown: true,
    userCanEditPromptBeforeRun: true
  },
  redactionSummary: {
    redactionPreviewRef: "redaction_preview_chatgpt_ready",
    redactedFieldKinds: ["credential", "session", "secret", "2fa", "payment", "legal_sensitive"],
    retainedArtifactKinds: ["prompt", "imported_result", "screenshot", "log"],
    defaultRetention: "prompt_result_screenshot_log",
    forbiddenRetentionPolicy: "no_credential_session_secret_2fa_payment_or_legal_sensitive_fields",
    userExportDeleteControls: true,
    deletionLeavesAuditMetadataOnly: true
  },
  policyRiskVerdict: {
    verdict: "pass",
    rationale: "Per-run user-owned research assist only; no resale, account sharing, or automated extraction batch.",
    evidenceRefs: ["policy:chatgpt-pro:per-run"]
  },
  sessionOwnershipVerdict: {
    verdict: "pass",
    rationale: "User confirms they signed into the local browser profile directly; app stores no password, 2FA, cookie, or token.",
    evidenceRefs: ["session:owner-confirmed"]
  },
  approvalDecision: "approved",
  browserActionAuthorityRef: "exec_auth_chatgpt_ready",
  resultImportRef: null,
  resultImportGate: null,
  fallbackApplied: null,
  blockReasons: [],
  screenshotRefs: ["browser_action:screenshot:chatgpt-ready"],
  logRefs: ["browser_action:log:chatgpt-ready"],
  auditRefs: ["audit:chatgpt-browser-delegation:ready"],
  createdAt: "2026-05-13T00:00:00.000Z",
  schemaVersion: CHATGPT_BROWSER_DELEGATION_SCHEMA_VERSION
} as const satisfies ChatGptBrowserDelegationRun;

export const CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE = {
  kind: "ChatGptBrowserDelegationProjection",
  sessionId: "sess_chatgpt_delegation_fixture" as SessionId,
  version: 1 as ProjectionVersion,
  currentStatus: "ready_for_browser_action",
  runs: [CHATGPT_BROWSER_DELEGATION_READY_RUN_FIXTURE],
  latestRun: CHATGPT_BROWSER_DELEGATION_READY_RUN_FIXTURE,
  blockedPreconditions: [],
  summary: chatGptBrowserDelegationSummaryForStatus("ready_for_browser_action"),
  refetchUrl: "/api/v1/sessions/sess_chatgpt_delegation_fixture/chatgpt-browser-delegations"
} as const satisfies ChatGptBrowserDelegationProjection;

export const CHATGPT_BROWSER_DELEGATION_FALLBACK_RUN_FIXTURE = {
  ...CHATGPT_BROWSER_DELEGATION_READY_RUN_FIXTURE,
  runId: "chatgpt_delegation_fallback_fixture",
  policyRiskVerdict: {
    verdict: "block",
    rationale: "Detected unattended queue semantics and account sharing/resale risk.",
    evidenceRefs: ["policy:blocked:unattended-queue", "policy:blocked:resale"]
  },
  browserActionAuthorityRef: null,
  fallbackApplied: {
    lane: "manual_prompt_handoff",
    visibleState: "ChatGPT 브라우저 위임 대신 수동 프롬프트 전달이 필요합니다.",
    reason: "Policy risk blocks live browser action.",
    userAction: "Review the redacted prompt and paste it manually, or mark this research task as Known Risk."
  },
  blockReasons: [
    {
      code: "policy_risk_blocked",
      message: "Policy risk verdict blocked the run before browser action start.",
      evidenceRefs: ["policy:blocked:unattended-queue"]
    },
    {
      code: "account_sharing_or_resale_risk",
      message: "ChatGPT Pro account sharing/resale or third-party backend semantics are blocked.",
      evidenceRefs: ["policy:blocked:resale"]
    },
    {
      code: "unattended_queue_risk",
      message: "Project-level or unattended ChatGPT background queue semantics are blocked.",
      evidenceRefs: ["policy:blocked:unattended-queue"]
    },
    {
      code: "missing_browser_action_authority",
      message: "A ready ExecutionAuthorityRecord is required before browser action start.",
      evidenceRefs: ["execution-authority:missing"]
    }
  ],
  auditRefs: ["audit:chatgpt-browser-delegation:fallback"]
} as const satisfies ChatGptBrowserDelegationRun;

export const CHATGPT_BROWSER_DELEGATION_FALLBACK_PROJECTION_FIXTURE = {
  kind: "ChatGptBrowserDelegationProjection",
  sessionId: "sess_chatgpt_delegation_fixture" as SessionId,
  version: 1 as ProjectionVersion,
  currentStatus: "fallback_required",
  runs: [CHATGPT_BROWSER_DELEGATION_FALLBACK_RUN_FIXTURE],
  latestRun: CHATGPT_BROWSER_DELEGATION_FALLBACK_RUN_FIXTURE,
  blockedPreconditions: CHATGPT_BROWSER_DELEGATION_FALLBACK_RUN_FIXTURE.blockReasons,
  summary: chatGptBrowserDelegationSummaryForStatus("fallback_required"),
  refetchUrl: "/api/v1/sessions/sess_chatgpt_delegation_fixture/chatgpt-browser-delegations"
} as const satisfies ChatGptBrowserDelegationProjection;
