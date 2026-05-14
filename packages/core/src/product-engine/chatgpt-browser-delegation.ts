import {
  CHATGPT_BROWSER_DELEGATION_ARTIFACT_KINDS,
  CHATGPT_BROWSER_DELEGATION_CREATE_PAYLOAD_KEYS,
  CHATGPT_BROWSER_DELEGATION_FALLBACK_LANES,
  CHATGPT_BROWSER_DELEGATION_FORBIDDEN_FIELD_KINDS,
  CHATGPT_BROWSER_DELEGATION_IMPORT_GATE_STATUSES,
  CHATGPT_BROWSER_DELEGATION_REVOKE_PAYLOAD_KEYS,
  CHATGPT_BROWSER_DELEGATION_SCHEMA_VERSION,
  CHATGPT_BROWSER_DELEGATION_VERDICTS,
  chatGptBrowserDelegationIsRevokableStatus,
  chatGptBrowserDelegationStatusForRun,
  chatGptBrowserDelegationSummaryForStatus,
  containsExecutionAuthoritySecretValueLeak,
  executionAuthorityLedgerStatusForRecord,
  isChatGptBrowserDelegationApprovalDecision as isContractChatGptBrowserDelegationApprovalDecision,
  isChatGptBrowserDelegationStatus as isContractChatGptBrowserDelegationStatus,
  validateChatGptBrowserDelegationProjection,
  type ChatGptBrowserDelegationApprovalDecision,
  type ChatGptBrowserDelegationArtifactKind,
  type ChatGptBrowserDelegationAuditEntry,
  type ChatGptBrowserDelegationBlockCode,
  type ChatGptBrowserDelegationBlockReasonDto,
  type ChatGptBrowserDelegationDataDisclosurePreview,
  type ChatGptBrowserDelegationFallbackLane,
  type ChatGptBrowserDelegationFallbackState,
  type ChatGptBrowserDelegationForbiddenFieldKind,
  type ChatGptBrowserDelegationImportGateStatus,
  type ChatGptBrowserDelegationProjection,
  type ChatGptBrowserDelegationRedactionSummary,
  type ChatGptBrowserDelegationResultImportGate,
  type ChatGptBrowserDelegationRun,
  type ChatGptBrowserDelegationStatus,
  type ChatGptBrowserDelegationVerdict,
  type ChatGptBrowserDelegationVerdictDto,
  type CreateChatGptBrowserDelegationRunPayload,
  type ProductEngineCommand,
  type ProductEngineReduction,
  type ProductEngineRejectionCode,
  type ProductEngineStateSnapshot,
  type ProjectionVersion,
  type ResearchResultId,
  type ResearchTaskId,
  type RevokeChatGptBrowserDelegationRunPayload
} from "@solo-superman/contracts";
import {
  acceptedReduction,
  eventDraft,
  projectionVersionFor,
  reject,
  stableToken
} from "./reduction-helpers";
import {
  hasOnlyRecordKeys,
  optionalStringArray,
  recordFromUnknown,
  requiredString,
  stringArray,
  uniqueStringRefs,
  uniqueStrings
} from "./value-helpers";

type ChatGptDelegationForbiddenFieldKinds = readonly ChatGptBrowserDelegationForbiddenFieldKind[];
type ChatGptDelegationRetainedArtifactKinds = readonly ChatGptBrowserDelegationArtifactKind[];

function containsUnsupportedChatGptBrowserDelegationPayload(command: ProductEngineCommand) {
  return !hasOnlyRecordKeys(command.payload, CHATGPT_BROWSER_DELEGATION_CREATE_PAYLOAD_KEYS);
}

function isChatGptDelegationVerdict(value: unknown): value is ChatGptBrowserDelegationVerdict {
  return typeof value === "string" && CHATGPT_BROWSER_DELEGATION_VERDICTS.includes(value as ChatGptBrowserDelegationVerdict);
}

function isChatGptDelegationApprovalDecision(value: unknown): value is ChatGptBrowserDelegationApprovalDecision {
  return isContractChatGptBrowserDelegationApprovalDecision(value);
}

function isChatGptDelegationFallbackLane(value: unknown): value is ChatGptBrowserDelegationFallbackLane {
  return (
    typeof value === "string" &&
    CHATGPT_BROWSER_DELEGATION_FALLBACK_LANES.includes(value as ChatGptBrowserDelegationFallbackLane)
  );
}

function isChatGptDelegationForbiddenFieldKind(value: unknown): value is ChatGptBrowserDelegationForbiddenFieldKind {
  return (
    typeof value === "string" &&
    CHATGPT_BROWSER_DELEGATION_FORBIDDEN_FIELD_KINDS.includes(value as ChatGptBrowserDelegationForbiddenFieldKind)
  );
}

function isChatGptDelegationArtifactKind(value: unknown): value is ChatGptBrowserDelegationArtifactKind {
  return (
    typeof value === "string" &&
    CHATGPT_BROWSER_DELEGATION_ARTIFACT_KINDS.includes(value as ChatGptBrowserDelegationArtifactKind)
  );
}

function isChatGptDelegationImportGateStatus(value: unknown): value is ChatGptBrowserDelegationImportGateStatus {
  return (
    typeof value === "string" &&
    CHATGPT_BROWSER_DELEGATION_IMPORT_GATE_STATUSES.includes(value as ChatGptBrowserDelegationImportGateStatus)
  );
}

function isChatGptDelegationRunStatus(value: unknown): value is ChatGptBrowserDelegationStatus {
  return isContractChatGptBrowserDelegationStatus(value);
}

function chatGptDelegationOptionalStatusFromValue(
  value: unknown
): ChatGptBrowserDelegationStatus | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return isChatGptDelegationRunStatus(value) ? value : null;
}

function chatGptDelegationStringArray(value: unknown, allowEmpty = true) {
  const strings = stringArray(value, allowEmpty);

  return strings ? uniqueStringRefs(strings) : null;
}

function chatGptDelegationVerdictFromValue(value: unknown): ChatGptBrowserDelegationVerdictDto | null {
  const record = recordFromUnknown(value);

  if (!record) {
    return null;
  }

  const rationale = requiredString(record.rationale);
  const evidenceRefs = chatGptDelegationStringArray(record.evidenceRefs);

  if (!isChatGptDelegationVerdict(record.verdict) || !rationale || !evidenceRefs) {
    return null;
  }

  return {
    verdict: record.verdict,
    rationale,
    evidenceRefs
  };
}

function chatGptForbiddenFieldKindsFromValue(value: unknown): ChatGptDelegationForbiddenFieldKinds | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const kinds = value.map((item) => (isChatGptDelegationForbiddenFieldKind(item) ? item : null));

  return kinds.every(Boolean)
    ? (uniqueStrings(
        kinds as readonly ChatGptBrowserDelegationForbiddenFieldKind[]
      ) as ChatGptDelegationForbiddenFieldKinds)
    : null;
}

function chatGptArtifactKindsFromValue(value: unknown): ChatGptDelegationRetainedArtifactKinds | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const kinds = value.map((item) => (isChatGptDelegationArtifactKind(item) ? item : null));

  return kinds.every(Boolean)
    ? (uniqueStrings(
        kinds as readonly ChatGptBrowserDelegationArtifactKind[]
      ) as ChatGptDelegationRetainedArtifactKinds)
    : null;
}

function chatGptRedactionSummaryFromValue(value: unknown): ChatGptBrowserDelegationRedactionSummary | null {
  const record = recordFromUnknown(value);

  if (!record) {
    return null;
  }

  const redactionPreviewRef = requiredString(record.redactionPreviewRef);
  const redactedFieldKinds = chatGptForbiddenFieldKindsFromValue(record.redactedFieldKinds);
  const retainedArtifactKinds = chatGptArtifactKindsFromValue(record.retainedArtifactKinds);

  if (
    !redactionPreviewRef ||
    !redactedFieldKinds ||
    !retainedArtifactKinds ||
    record.defaultRetention !== "prompt_result_screenshot_log" ||
    record.forbiddenRetentionPolicy !== "no_credential_session_secret_2fa_payment_or_legal_sensitive_fields" ||
    record.userExportDeleteControls !== true ||
    record.deletionLeavesAuditMetadataOnly !== true
  ) {
    return null;
  }

  return {
    redactionPreviewRef,
    redactedFieldKinds,
    retainedArtifactKinds,
    defaultRetention: "prompt_result_screenshot_log",
    forbiddenRetentionPolicy: "no_credential_session_secret_2fa_payment_or_legal_sensitive_fields",
    userExportDeleteControls: true,
    deletionLeavesAuditMetadataOnly: true
  };
}

function chatGptDataDisclosurePreviewFromValue(value: unknown): ChatGptBrowserDelegationDataDisclosurePreview | null {
  const record = recordFromUnknown(value);

  if (!record) {
    return null;
  }

  const disclosurePreviewRef = requiredString(record.disclosurePreviewRef);
  const promptContextSummaryRef = requiredString(record.promptContextSummaryRef);
  const redactedPromptPreviewRef = requiredString(record.redactedPromptPreviewRef);
  const excludedSensitiveFieldKinds = chatGptForbiddenFieldKindsFromValue(record.excludedSensitiveFieldKinds);

  if (
    !disclosurePreviewRef ||
    !promptContextSummaryRef ||
    !redactedPromptPreviewRef ||
    !excludedSensitiveFieldKinds ||
    typeof record.redactionPreviewShown !== "boolean" ||
    typeof record.userCanEditPromptBeforeRun !== "boolean"
  ) {
    return null;
  }

  return {
    disclosurePreviewRef,
    promptContextSummaryRef,
    redactedPromptPreviewRef,
    excludedSensitiveFieldKinds,
    redactionPreviewShown: record.redactionPreviewShown,
    userCanEditPromptBeforeRun: record.userCanEditPromptBeforeRun
  };
}

function chatGptResultImportGateFromValue(value: unknown): ChatGptBrowserDelegationResultImportGate | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = recordFromUnknown(value);

  if (!record) {
    return null;
  }

  const sourceRefs = chatGptDelegationStringArray(record.sourceRefs, false);
  const uncertaintyRefs = chatGptDelegationStringArray(record.uncertaintyRefs);
  const conEvidenceRefs = chatGptDelegationStringArray(record.conEvidenceRefs);
  const staleRiskRefs = chatGptDelegationStringArray(record.staleRiskRefs);
  const importRationale = requiredString(record.importRationale);

  if (
    !isChatGptDelegationImportGateStatus(record.sourceProvenanceStatus) ||
    !isChatGptDelegationImportGateStatus(record.uncertaintyStatus) ||
    !isChatGptDelegationImportGateStatus(record.conEvidenceStatus) ||
    !isChatGptDelegationImportGateStatus(record.staleRiskStatus) ||
    !sourceRefs ||
    !uncertaintyRefs ||
    !conEvidenceRefs ||
    !staleRiskRefs ||
    !importRationale
  ) {
    return null;
  }

  return {
    sourceProvenanceStatus: record.sourceProvenanceStatus,
    uncertaintyStatus: record.uncertaintyStatus,
    conEvidenceStatus: record.conEvidenceStatus,
    staleRiskStatus: record.staleRiskStatus,
    sourceRefs,
    uncertaintyRefs,
    conEvidenceRefs,
    staleRiskRefs,
    importRationale
  };
}

function chatGptFallbackStateFromValue(value: unknown): ChatGptBrowserDelegationFallbackState | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = recordFromUnknown(value);

  if (!record) {
    return null;
  }

  const visibleState = requiredString(record.visibleState);
  const reason = requiredString(record.reason);
  const userAction = requiredString(record.userAction);

  if (!isChatGptDelegationFallbackLane(record.lane) || !visibleState || !reason || !userAction) {
    return null;
  }

  return {
    lane: record.lane,
    visibleState,
    reason,
    userAction
  };
}

function chatGptDelegationBlockReason(
  code: ChatGptBrowserDelegationBlockCode,
  message: string,
  evidenceRefs: readonly string[] = [`chatgpt_browser_delegation:${code}`]
): ChatGptBrowserDelegationBlockReasonDto {
  return {
    code,
    message,
    evidenceRefs
  };
}

function uniqueChatGptBlockReasons(
  reasons: readonly ChatGptBrowserDelegationBlockReasonDto[]
): readonly ChatGptBrowserDelegationBlockReasonDto[] {
  const byCode = new Map<ChatGptBrowserDelegationBlockCode, ChatGptBrowserDelegationBlockReasonDto>();

  for (const reason of reasons) {
    byCode.set(reason.code, reason);
  }

  return [...byCode.values()];
}

function chatGptDelegationBrowserActionAuthorityBlockReason(
  browserActionAuthorityRef: string | null,
  state: ProductEngineStateSnapshot
): ChatGptBrowserDelegationBlockReasonDto | null {
  if (!browserActionAuthorityRef) {
    return chatGptDelegationBlockReason(
      "missing_browser_action_authority",
      "A ready ExecutionAuthorityRecord is required before browser action start.",
      ["execution-authority:missing"]
    );
  }

  const authorityRecord = state.executionAuthorityLedger?.records.find(
    (record) => record.recordId === browserActionAuthorityRef
  );

  if (!authorityRecord) {
    return chatGptDelegationBlockReason(
      "missing_browser_action_authority",
      "browserActionAuthorityRef must reference an existing ExecutionAuthorityRecord in this session.",
      [`execution-authority:${browserActionAuthorityRef}:missing`]
    );
  }

  if (authorityRecord.actionClass !== "browser_action") {
    return chatGptDelegationBlockReason(
      "missing_browser_action_authority",
      "browserActionAuthorityRef must reference a browser_action ExecutionAuthorityRecord.",
      [`execution-authority:${browserActionAuthorityRef}:action-class:${authorityRecord.actionClass}`]
    );
  }

  if (
    authorityRecord.approvalDecision !== "approved" ||
    authorityRecord.blockReasons.length ||
    authorityRecord.executionResult === "blocked" ||
    authorityRecord.executionResult === "failed" ||
    authorityRecord.executionResult === "running" ||
    authorityRecord.executionResult === "partial"
  ) {
    return chatGptDelegationBlockReason(
      "missing_browser_action_authority",
      "browserActionAuthorityRef must reference an approved, unblocked browser_action authority.",
      [`execution-authority:${browserActionAuthorityRef}:status:${executionAuthorityLedgerStatusForRecord(authorityRecord)}`]
    );
  }

  if (
    authorityRecord.sandboxBoundary.mode !== "browser_preview_session" ||
    authorityRecord.sandboxBoundary.networkPolicy !== "loopback_only" ||
    authorityRecord.sandboxBoundary.secretPolicy !== "no_secret_values" ||
    !authorityRecord.requestedScope.browserTargetRef ||
    authorityRecord.rollbackReference?.kind !== "browser_state_reset"
  ) {
    return chatGptDelegationBlockReason(
      "missing_browser_action_authority",
      "browserActionAuthorityRef must preserve the Phase 3 browser_action loopback sandbox, no-secret, target, and reset boundary.",
      [`execution-authority:${browserActionAuthorityRef}:boundary-invalid`]
    );
  }

  return null;
}

function chatGptDelegationRiskText(verdict: ChatGptBrowserDelegationVerdictDto) {
  return `${verdict.rationale} ${verdict.evidenceRefs.join(" ")}`.toLowerCase();
}

const CHATGPT_DELEGATION_ACCOUNT_SHARING_RISK_PATTERN =
  /account sharing|resale|third[- ]party|backend|shared capacity/u;
const CHATGPT_DELEGATION_UNATTENDED_QUEUE_RISK_PATTERN =
  /unattended|overnight|background queue|long[- ]running|project[- ]level/u;
const CHATGPT_DELEGATION_FAILURE_BLOCK_CODES = new Set<ChatGptBrowserDelegationBlockCode>([
  "chatgpt_ui_changed",
  "login_or_session_expired",
  "captcha_or_antibot_required",
  "usage_limit_reached",
  "result_parse_failed",
  "result_import_gate_failed"
]);

function chatGptDelegationBlockReasons(input: {
  readonly dataDisclosurePreview: ChatGptBrowserDelegationDataDisclosurePreview;
  readonly policyRiskVerdict: ChatGptBrowserDelegationVerdictDto;
  readonly sessionOwnershipVerdict: ChatGptBrowserDelegationVerdictDto;
  readonly approvalDecision: ChatGptBrowserDelegationApprovalDecision;
  readonly browserActionAuthorityRef: string | null;
  readonly resultImportRef: ResearchResultId | null;
  readonly resultImportGate: ChatGptBrowserDelegationResultImportGate | null;
  readonly state: ProductEngineStateSnapshot;
}): readonly ChatGptBrowserDelegationBlockReasonDto[] {
  const reasons: ChatGptBrowserDelegationBlockReasonDto[] = [];
  const resultImportAttempted = Boolean(input.resultImportRef || input.resultImportGate);
  const browserActionAttempted = Boolean(input.browserActionAuthorityRef || resultImportAttempted);

  if (!input.dataDisclosurePreview.disclosurePreviewRef) {
    reasons.push(
      chatGptDelegationBlockReason(
        "missing_data_disclosure_preview",
        "ChatGPT browser delegation cannot start before a data disclosure preview exists."
      )
    );
  }

  if (!input.dataDisclosurePreview.redactionPreviewShown || !input.dataDisclosurePreview.userCanEditPromptBeforeRun) {
    reasons.push(
      chatGptDelegationBlockReason(
        "redaction_preview_missing",
        "The user must see redaction preview and be able to edit the prompt/context before this run starts."
      )
    );
  }

  if (input.policyRiskVerdict.verdict === "block") {
    const text = chatGptDelegationRiskText(input.policyRiskVerdict);

    reasons.push(
      chatGptDelegationBlockReason(
        "policy_risk_blocked",
        "Policy risk verdict blocks this ChatGPT browser delegation run.",
        input.policyRiskVerdict.evidenceRefs
      )
    );

    if (CHATGPT_DELEGATION_ACCOUNT_SHARING_RISK_PATTERN.test(text)) {
      reasons.push(
        chatGptDelegationBlockReason(
          "account_sharing_or_resale_risk",
          "ChatGPT Pro account sharing/resale or third-party backend semantics are blocked.",
          input.policyRiskVerdict.evidenceRefs
        )
      );
    }

    if (CHATGPT_DELEGATION_UNATTENDED_QUEUE_RISK_PATTERN.test(text)) {
      reasons.push(
        chatGptDelegationBlockReason(
          "unattended_queue_risk",
          "Unattended or project-level ChatGPT background queue semantics are blocked.",
          input.policyRiskVerdict.evidenceRefs
        )
      );
    }
  }

  if (input.sessionOwnershipVerdict.verdict === "block") {
    reasons.push(
      chatGptDelegationBlockReason(
        "session_ownership_blocked",
        "Session ownership verdict blocks this run; the user must directly own the local browser session.",
        input.sessionOwnershipVerdict.evidenceRefs
      )
    );
    reasons.push(
      chatGptDelegationBlockReason(
        "credential_or_session_custody_required",
        "Credential, 2FA, cookie, token, or session custody would be required, which is blocked.",
        input.sessionOwnershipVerdict.evidenceRefs
      )
    );
  }

  if (input.approvalDecision === "rejected" || (input.approvalDecision !== "approved" && browserActionAttempted)) {
    reasons.push(
      chatGptDelegationBlockReason(
        "missing_user_approval",
        input.approvalDecision === "rejected"
          ? "The user rejected this ChatGPT browser delegation run."
          : "Per-run user approval is required before ChatGPT browser delegation can start or import results."
      )
    );
  }

  const authorityBlockReason = (input.approvalDecision === "approved" || resultImportAttempted)
    ? chatGptDelegationBrowserActionAuthorityBlockReason(
        input.browserActionAuthorityRef,
        input.state
      )
    : null;

  if (authorityBlockReason) {
    reasons.push(authorityBlockReason);
  }

  if (
    input.resultImportGate &&
    (input.resultImportGate.sourceProvenanceStatus !== "pass" ||
      input.resultImportGate.uncertaintyStatus !== "pass" ||
      input.resultImportGate.conEvidenceStatus !== "pass" ||
      input.resultImportGate.staleRiskStatus !== "pass")
  ) {
    reasons.push(
      chatGptDelegationBlockReason(
        "result_import_gate_failed",
        "ChatGPT result import must preserve source/provenance, uncertainty, con evidence, and stale-risk gates.",
        [
          ...input.resultImportGate.sourceRefs,
          ...input.resultImportGate.uncertaintyRefs,
          ...input.resultImportGate.conEvidenceRefs,
          ...input.resultImportGate.staleRiskRefs
        ]
      )
    );
  }

  return uniqueChatGptBlockReasons(reasons);
}

function defaultChatGptDelegationFallback(
  blockReasons: readonly ChatGptBrowserDelegationBlockReasonDto[]
): ChatGptBrowserDelegationFallbackState {
  return {
    lane: "manual_prompt_handoff",
    visibleState: "ChatGPT 브라우저 위임을 시작하지 않고 수동 프롬프트 전달 또는 Known Risk 처리로 전환해야 합니다.",
    reason: blockReasons.map((reason) => reason.message).join(" "),
    userAction: "redaction preview를 다시 확인한 뒤 수동으로 프롬프트를 전달하거나, official Codex path 또는 Known Risk로 기록하세요."
  };
}

function chatGptDelegationStatusFromFacts(input: {
  readonly approvalDecision: ChatGptBrowserDelegationApprovalDecision;
  readonly browserActionAuthorityRef: string | null;
  readonly resultImportRef: ResearchResultId | null;
  readonly resultImportGate: ChatGptBrowserDelegationResultImportGate | null;
  readonly blockReasons: readonly ChatGptBrowserDelegationBlockReasonDto[];
}): ChatGptBrowserDelegationStatus {
  if (input.blockReasons.length) {
    return input.resultImportRef || input.blockReasons.some((reason) => CHATGPT_DELEGATION_FAILURE_BLOCK_CODES.has(reason.code))
      ? "failed"
      : "blocked";
  }

  if (input.resultImportRef) {
    return input.resultImportGate ? "completed" : "importing_result";
  }

  if (input.approvalDecision === "pending" || input.approvalDecision === "revision_requested") {
    return "waiting_for_approval";
  }

  if (input.approvalDecision === "rejected") {
    return "blocked";
  }

  return input.browserActionAuthorityRef ? "running" : "pending_preflight";
}

function requestedChatGptDelegationStatusMatchesFacts(
  requestedStatus: ChatGptBrowserDelegationStatus,
  derivedStatus: ChatGptBrowserDelegationStatus
) {
  return (
    requestedStatus === derivedStatus ||
    (requestedStatus === "pending_preflight" && derivedStatus === "waiting_for_approval") ||
    (requestedStatus === "waiting_for_user" && derivedStatus === "running") ||
    (requestedStatus === "importing_result" && derivedStatus === "completed")
  );
}

function chatGptDelegationRunEventType(
  status: ChatGptBrowserDelegationStatus,
  blockReasons: readonly ChatGptBrowserDelegationBlockReasonDto[]
) {
  if (status === "failed") {
    return "ChatGptBrowserDelegationRunFailed" as const;
  }

  return blockReasons.length
    ? "ChatGptBrowserDelegationRunBlocked"
    : "ChatGptBrowserDelegationRunRecorded";
}

function chatGptDelegationVisibleState(input: {
  readonly status: ChatGptBrowserDelegationStatus;
  readonly explicitExplanation: string | undefined;
  readonly explicitNextAction: string | undefined;
  readonly fallbackApplied: ChatGptBrowserDelegationFallbackState | null;
  readonly blockReasons: readonly ChatGptBrowserDelegationBlockReasonDto[];
}) {
  const fallback = input.fallbackApplied;
  const blockReason = input.blockReasons.map((reason) => reason.message).join(" ");
  const defaultExplanation = fallback?.visibleState ?? (blockReason || chatGptBrowserDelegationSummaryForStatus(input.status));

  function defaultNextActionForStatus() {
    switch (input.status) {
      case "pending_preflight":
        return "Finish data disclosure, redaction preview, policy/session checks, and authority evidence before asking for approval.";
      case "waiting_for_approval":
        return "Review the redaction preview and approve, request revisions, or reject this run.";
      case "running":
        return "Keep the local browser visible, watch for user-intervention prompts, or revoke this run.";
      case "waiting_for_user":
        return "Complete the visible browser intervention, then continue result capture or revoke this run.";
      case "importing_result":
        return "Review the captured ChatGPT result against source, uncertainty, counter-evidence, and stale-risk gates before import.";
      case "completed":
        return "Import the result only through the Evidence Matrix quality gates and keep provenance attached.";
      case "revoked":
        return "Start a new per-run approval if ChatGPT delegation is still needed.";
      case "blocked":
      case "failed":
        return "Use manual prompt handoff, official Codex fallback, or record a Known Risk before proceeding.";
    }
  }

  const defaultNextAction = fallback?.userAction ?? defaultNextActionForStatus();

  return {
    userVisibleExplanation: input.explicitExplanation?.trim() || defaultExplanation,
    nextAction: input.explicitNextAction?.trim() || defaultNextAction
  };
}

function defaultChatGptAuditLog(input: {
  readonly status: ChatGptBrowserDelegationStatus;
  readonly promptPreviewRef: string;
  readonly redactionSummary: ChatGptBrowserDelegationRedactionSummary;
  readonly approvalDecision: ChatGptBrowserDelegationApprovalDecision;
  readonly browserActionAuthorityRef: string | null;
  readonly resultImportRef: ResearchResultId | null;
  readonly fallbackApplied: ChatGptBrowserDelegationFallbackState | null;
  readonly auditRefs: readonly string[];
}): readonly ChatGptBrowserDelegationAuditEntry[] {
  const entries: ChatGptBrowserDelegationAuditEntry[] = [
    {
      eventType: "prompt_preview",
      label: "Redacted prompt preview and data disclosure were shown before the ChatGPT delegation run.",
      evidenceRefs: [input.promptPreviewRef, input.redactionSummary.redactionPreviewRef]
    }
  ];

  if (input.approvalDecision === "approved") {
    entries.push({
      eventType: "DelegationRunApproved",
      label: "User approved this specific local browser delegation run.",
      evidenceRefs: input.browserActionAuthorityRef ? [input.browserActionAuthorityRef] : ["approval:approved"]
    });
  }

  if (input.status === "running") {
    entries.push({
      eventType: "browser_start",
      label: "The run is using an approved loopback browser action authority.",
      evidenceRefs: input.browserActionAuthorityRef ? [input.browserActionAuthorityRef] : ["browser_action:pending"]
    });
  }

  if (input.status === "waiting_for_user") {
    entries.push({
      eventType: "user_intervention",
      label: "The run is waiting for visible user intervention before continuing.",
      evidenceRefs: input.auditRefs
    });
  }

  if (input.status === "importing_result" || input.status === "completed") {
    entries.push({
      eventType: "result_capture",
      label: "ChatGPT result capture is preserved for Evidence Matrix import gates.",
      evidenceRefs: input.resultImportRef ? [input.resultImportRef] : input.auditRefs
    });
  }

  if (input.status === "completed") {
    entries.push({
      eventType: "DelegationResultImported",
      label: "Result import gates passed with source, uncertainty, con-evidence, and stale-risk evidence preserved.",
      evidenceRefs: input.resultImportRef ? [input.resultImportRef] : input.auditRefs
    });
  }

  if (input.fallbackApplied) {
    entries.push({
      eventType: "DelegationFallbackApplied",
      label: input.fallbackApplied.visibleState,
      evidenceRefs: input.auditRefs
    });
  }

  if (input.status === "blocked" || input.status === "failed") {
    entries.push({
      eventType: input.status === "failed" ? "DelegationRunFailed" : "DelegationRunBlocked",
      label: chatGptBrowserDelegationSummaryForStatus(input.status),
      evidenceRefs: input.auditRefs
    });
  }

  return entries;
}

function chatGptDelegationProjection(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot,
  run: ChatGptBrowserDelegationRun
): ChatGptBrowserDelegationProjection {
  return chatGptDelegationProjectionFromRuns(command, projectionVersionFor(state), [
    ...(state.chatGptBrowserDelegation?.runs ?? []),
    run
  ]);
}

function chatGptDelegationProjectionFromRuns(
  command: ProductEngineCommand,
  version: ProjectionVersion,
  runs: readonly ChatGptBrowserDelegationRun[]
): ChatGptBrowserDelegationProjection {
  const latestRun = runs.at(-1);

  if (!latestRun) {
    throw new Error("ChatGptBrowserDelegationProjection requires at least one run.");
  }

  const currentStatus = chatGptBrowserDelegationStatusForRun(latestRun);

  return validateChatGptBrowserDelegationProjection({
    kind: "ChatGptBrowserDelegationProjection",
    sessionId: command.sessionId,
    version,
    currentStatus,
    runs,
    latestRun,
    blockedPreconditions: currentStatus === "blocked" || currentStatus === "failed" || currentStatus === "revoked"
      ? latestRun.blockReasons
      : [],
    summary: chatGptBrowserDelegationSummaryForStatus(currentStatus),
    refetchUrl: `/api/v1/sessions/${command.sessionId}/chatgpt-browser-delegations`
  });
}

interface ParsedChatGptDelegationCreatePayload {
  readonly researchTaskId: ResearchTaskId;
  readonly requestedStatus: ChatGptBrowserDelegationStatus | undefined;
  readonly userVisibleExplanation: string | undefined;
  readonly nextAction: string | undefined;
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
  readonly screenshotRefs: readonly string[];
  readonly logRefs: readonly string[];
  readonly auditRefs: readonly string[];
  readonly activityFeedRefs: readonly string[];
}

type ChatGptDelegationRunBuildResult =
  | {
      readonly ok: true;
      readonly run: ChatGptBrowserDelegationRun;
      readonly blockReasons: readonly ChatGptBrowserDelegationBlockReasonDto[];
    }
  | {
      readonly ok: false;
      readonly message: string;
      readonly code: ProductEngineRejectionCode;
    };

function parseChatGptDelegationCreatePayload(
  command: ProductEngineCommand
): ParsedChatGptDelegationCreatePayload | null {
  const payload = command.payload as Partial<CreateChatGptBrowserDelegationRunPayload>;
  const researchTaskId = requiredString(payload.researchTaskId) as ResearchTaskId | null;
  const requestedStatus = chatGptDelegationOptionalStatusFromValue(payload.status);
  const userVisibleExplanation = payload.userVisibleExplanation === undefined
    ? undefined
    : requiredString(payload.userVisibleExplanation);
  const nextAction = payload.nextAction === undefined
    ? undefined
    : requiredString(payload.nextAction);
  const promptPreviewRef = requiredString(payload.promptPreviewRef);
  const dataDisclosurePreview = chatGptDataDisclosurePreviewFromValue(payload.dataDisclosurePreview);
  const redactionSummary = chatGptRedactionSummaryFromValue(payload.redactionSummary);
  const policyRiskVerdict = chatGptDelegationVerdictFromValue(payload.policyRiskVerdict);
  const sessionOwnershipVerdict = chatGptDelegationVerdictFromValue(payload.sessionOwnershipVerdict);
  const approvalDecision = isChatGptDelegationApprovalDecision(payload.approvalDecision)
    ? payload.approvalDecision
    : null;
  const browserActionAuthorityRef = requiredString(payload.browserActionAuthorityRef);
  const resultImportRef = requiredString(payload.resultImportRef) as ResearchResultId | null;
  const resultImportGate = chatGptResultImportGateFromValue(payload.resultImportGate);
  const fallbackApplied = chatGptFallbackStateFromValue(payload.fallbackApplied);
  const screenshotRefs = optionalStringArray(payload.screenshotRefs);
  const logRefs = optionalStringArray(payload.logRefs);
  const auditRefs = optionalStringArray(payload.auditRefs);
  const activityFeedRefs = optionalStringArray(payload.activityFeedRefs);

  if (
    requestedStatus === null ||
    userVisibleExplanation === null ||
    nextAction === null ||
    !researchTaskId ||
    !promptPreviewRef ||
    !dataDisclosurePreview ||
    !redactionSummary ||
    !policyRiskVerdict ||
    !sessionOwnershipVerdict ||
    !approvalDecision ||
    resultImportGate === null ||
    fallbackApplied === null ||
    screenshotRefs === null ||
    logRefs === null ||
    auditRefs === null ||
    activityFeedRefs === null
  ) {
    return null;
  }

  return {
    researchTaskId,
    requestedStatus,
    userVisibleExplanation,
    nextAction,
    promptPreviewRef,
    dataDisclosurePreview,
    redactionSummary,
    policyRiskVerdict,
    sessionOwnershipVerdict,
    approvalDecision,
    browserActionAuthorityRef,
    resultImportRef,
    resultImportGate: resultImportGate ?? null,
    fallbackApplied: fallbackApplied ?? null,
    screenshotRefs,
    logRefs,
    auditRefs,
    activityFeedRefs
  };
}

function chatGptDelegationRunFromParsedPayload(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot,
  payload: ParsedChatGptDelegationCreatePayload
): ChatGptDelegationRunBuildResult {
  if (payload.resultImportRef && !payload.resultImportGate) {
    return {
      ok: false,
      message: "CreateChatGptBrowserDelegationRun resultImportGate is required when resultImportRef is provided.",
      code: "VALIDATION_FAILED"
    };
  }

  if (!payload.resultImportRef && payload.resultImportGate) {
    return {
      ok: false,
      message: "CreateChatGptBrowserDelegationRun resultImportRef is required when resultImportGate is provided.",
      code: "VALIDATION_FAILED"
    };
  }

  const blockReasons = chatGptDelegationBlockReasons({
    dataDisclosurePreview: payload.dataDisclosurePreview,
    policyRiskVerdict: payload.policyRiskVerdict,
    sessionOwnershipVerdict: payload.sessionOwnershipVerdict,
    approvalDecision: payload.approvalDecision,
    browserActionAuthorityRef: payload.browserActionAuthorityRef,
    resultImportRef: payload.resultImportRef,
    resultImportGate: payload.resultImportGate,
    state
  });
  const visibleFallback = blockReasons.length
    ? payload.fallbackApplied ?? defaultChatGptDelegationFallback(blockReasons)
    : null;
  const derivedRunStatus = chatGptDelegationStatusFromFacts({
    approvalDecision: payload.approvalDecision,
    browserActionAuthorityRef: payload.browserActionAuthorityRef,
    resultImportRef: payload.resultImportRef,
    resultImportGate: payload.resultImportGate,
    blockReasons
  });

  if (
    payload.requestedStatus &&
    !requestedChatGptDelegationStatusMatchesFacts(payload.requestedStatus, derivedRunStatus)
  ) {
    return {
      ok: false,
      message:
        `CreateChatGptBrowserDelegationRun status ${payload.requestedStatus} conflicts with derived run state ${derivedRunStatus}.`,
      code: "COMMAND_PRECONDITION_FAILED"
    };
  }

  const runStatus = payload.requestedStatus ?? derivedRunStatus;
  const eventType = chatGptDelegationRunEventType(runStatus, blockReasons);
  const visibleState = chatGptDelegationVisibleState({
    status: runStatus,
    explicitExplanation: payload.userVisibleExplanation,
    explicitNextAction: payload.nextAction,
    fallbackApplied: visibleFallback,
    blockReasons
  });
  const resolvedAuditRefs = uniqueStringRefs([
    ...payload.auditRefs,
    `audit:${command.commandId}`,
    `event:${eventType}`
  ]);
  const runId = `chatgpt_delegation_${stableToken(
    JSON.stringify({
      sessionId: command.sessionId,
      expectedStateVersion: command.expectedStateVersion,
      researchTaskId: payload.researchTaskId,
      promptPreviewRef: payload.promptPreviewRef,
      browserActionAuthorityRef: payload.browserActionAuthorityRef,
      resultImportRef: payload.resultImportRef,
      approvalDecision: payload.approvalDecision
    })
  )}`;
  const run: ChatGptBrowserDelegationRun = {
    runId,
    researchTaskId: payload.researchTaskId,
    status: runStatus,
    userVisibleExplanation: visibleState.userVisibleExplanation,
    nextAction: visibleState.nextAction,
    canRevoke: chatGptBrowserDelegationIsRevokableStatus(runStatus),
    promptPreviewRef: payload.promptPreviewRef,
    dataDisclosurePreview: payload.dataDisclosurePreview,
    redactionSummary: payload.redactionSummary,
    policyRiskVerdict: payload.policyRiskVerdict,
    sessionOwnershipVerdict: payload.sessionOwnershipVerdict,
    approvalDecision: payload.approvalDecision,
    browserActionAuthorityRef: payload.browserActionAuthorityRef,
    resultImportRef: payload.resultImportRef,
    resultImportGate: payload.resultImportGate,
    fallbackApplied: visibleFallback,
    blockReasons,
    screenshotRefs: uniqueStringRefs(payload.screenshotRefs),
    logRefs: uniqueStringRefs(payload.logRefs),
    auditRefs: resolvedAuditRefs,
    activityFeedRefs: uniqueStringRefs([
      `research_task:${payload.researchTaskId}`,
      ...payload.activityFeedRefs
    ]),
    auditLog: defaultChatGptAuditLog({
      status: runStatus,
      promptPreviewRef: payload.promptPreviewRef,
      redactionSummary: payload.redactionSummary,
      approvalDecision: payload.approvalDecision,
      browserActionAuthorityRef: payload.browserActionAuthorityRef,
      resultImportRef: payload.resultImportRef,
      fallbackApplied: visibleFallback,
      auditRefs: resolvedAuditRefs
    }),
    createdAt: command.issuedAt,
    schemaVersion: CHATGPT_BROWSER_DELEGATION_SCHEMA_VERSION
  };

  return { ok: true, run, blockReasons };
}

export function reduceCreateChatGptBrowserDelegationRun(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  if (containsUnsupportedChatGptBrowserDelegationPayload(command)) {
    return reject(
      "CreateChatGptBrowserDelegationRun payload contains unsupported keys.",
      "VALIDATION_FAILED"
    );
  }

  const parsedPayload = parseChatGptDelegationCreatePayload(command);

  if (!parsedPayload) {
    return reject("CreateChatGptBrowserDelegationRun payload is invalid.", "VALIDATION_FAILED");
  }

  if (containsExecutionAuthoritySecretValueLeak(command.payload)) {
    return reject(
      "CreateChatGptBrowserDelegationRun payload must not contain credential, session, token, or secret values.",
      "VALIDATION_FAILED"
    );
  }

  const taskExists = state.researchState.tasks.some(
    (task) => task.researchTaskId === parsedPayload.researchTaskId
  );

  if (!taskExists) {
    return reject("CreateChatGptBrowserDelegationRun requires an existing ResearchTask.", "RESOURCE_NOT_FOUND");
  }

  const runBuild = chatGptDelegationRunFromParsedPayload(command, state, parsedPayload);

  if (!runBuild.ok) {
    return reject(runBuild.message, runBuild.code);
  }

  const { run, blockReasons } = runBuild;
  let projection: ChatGptBrowserDelegationProjection;

  try {
    projection = chatGptDelegationProjection(command, state, run);
  } catch (error) {
    return reject(error instanceof Error ? error.message : String(error), "VALIDATION_FAILED");
  }

  const status = projection.currentStatus;
  const eventType = chatGptDelegationRunEventType(run.status, blockReasons);
  const event = eventDraft(command, eventType, {
    runId: run.runId,
    researchTaskId: run.researchTaskId,
    status,
    approvalDecision: run.approvalDecision,
    browserActionAuthorityRef: run.browserActionAuthorityRef,
    resultImportRef: run.resultImportRef,
    blockReasons,
    fallbackApplied: run.fallbackApplied,
    projection,
    summary: projection.summary
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      chatGptBrowserDelegation: projection
    },
    [
      {
        outputType: "chatgpt_browser_delegation_run",
        outputRef: run.runId,
        payload: {
          runId: run.runId,
          researchTaskId: run.researchTaskId,
          status,
          browserActionAuthorityRef: run.browserActionAuthorityRef,
          resultImportRef: run.resultImportRef,
          blockReasons
        }
      }
    ],
    [],
    projection
  );
}

function containsUnsupportedChatGptBrowserDelegationRevokePayload(command: ProductEngineCommand) {
  return !hasOnlyRecordKeys(command.payload, CHATGPT_BROWSER_DELEGATION_REVOKE_PAYLOAD_KEYS);
}

export function reduceRevokeChatGptBrowserDelegationRun(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  if (containsUnsupportedChatGptBrowserDelegationRevokePayload(command)) {
    return reject(
      "RevokeChatGptBrowserDelegationRun payload contains unsupported keys.",
      "VALIDATION_FAILED"
    );
  }

  const payload = command.payload as Partial<RevokeChatGptBrowserDelegationRunPayload>;
  const runId = requiredString(payload.runId);
  const reason = requiredString(payload.reason);
  const auditRefs = optionalStringArray(payload.auditRefs);
  const projectionBefore = state.chatGptBrowserDelegation;

  if (!runId || !reason || auditRefs === null) {
    return reject("RevokeChatGptBrowserDelegationRun payload is invalid.", "VALIDATION_FAILED");
  }

  if (containsExecutionAuthoritySecretValueLeak(command.payload)) {
    return reject(
      "RevokeChatGptBrowserDelegationRun payload must not contain credential, session, token, or secret values.",
      "VALIDATION_FAILED"
    );
  }

  if (!projectionBefore) {
    return reject("RevokeChatGptBrowserDelegationRun requires an existing delegation projection.", "RESOURCE_NOT_FOUND");
  }

  const target = projectionBefore.latestRun.runId === runId ? projectionBefore.latestRun : null;

  if (!target) {
    return reject("RevokeChatGptBrowserDelegationRun can only revoke the latest delegation run.", "RESOURCE_NOT_FOUND");
  }

  if (!chatGptBrowserDelegationIsRevokableStatus(target.status)) {
    return reject("RevokeChatGptBrowserDelegationRun can only revoke pending, waiting, running, or importing runs.", "COMMAND_PRECONDITION_FAILED");
  }

  const revokeAuditRefs = uniqueStringRefs([
    ...auditRefs,
    `audit:${command.commandId}`,
    "audit:chatgpt-browser-delegation:revoked"
  ]);
  const revokedReason = chatGptDelegationBlockReason(
    "revoked_by_user",
    "The user revoked this ChatGPT browser delegation run before further browser action could continue.",
    revokeAuditRefs
  );
  const fallbackApplied = target.fallbackApplied ?? {
    lane: "manual_prompt_handoff",
    visibleState: "ChatGPT 브라우저 위임이 취소되었습니다.",
    reason,
    userAction: "필요하면 redaction preview를 다시 확인한 뒤 새 per-run approval로 다시 시작하세요."
  } satisfies ChatGptBrowserDelegationFallbackState;
  const revokedRun: ChatGptBrowserDelegationRun = {
    ...target,
    status: "revoked",
    userVisibleExplanation: reason,
    nextAction: fallbackApplied.userAction,
    canRevoke: false,
    fallbackApplied,
    blockReasons: uniqueChatGptBlockReasons([...target.blockReasons, revokedReason]),
    auditRefs: uniqueStringRefs([...target.auditRefs, ...revokeAuditRefs]),
    activityFeedRefs: uniqueStringRefs([...target.activityFeedRefs, `research_task:${target.researchTaskId}`, "delegation:revoked"]),
    auditLog: [
      ...target.auditLog,
      {
        eventType: "DelegationRunRevoked",
        label: reason,
        evidenceRefs: revokeAuditRefs
      },
      {
        eventType: "revoke",
        label: "User-visible revoke control stopped any later browser action for this run.",
        evidenceRefs: revokeAuditRefs
      }
    ]
  };
  let projection: ChatGptBrowserDelegationProjection;

  try {
    projection = chatGptDelegationProjectionFromRuns(command, projectionVersionFor(state), [
      ...projectionBefore.runs.slice(0, -1),
      revokedRun
    ]);
  } catch (error) {
    return reject(error instanceof Error ? error.message : String(error), "VALIDATION_FAILED");
  }

  const event = eventDraft(command, "ChatGptBrowserDelegationRunRevoked", {
    runId,
    researchTaskId: revokedRun.researchTaskId,
    status: projection.currentStatus,
    reason,
    projection,
    summary: projection.summary
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      chatGptBrowserDelegation: projection
    },
    [
      {
        outputType: "chatgpt_browser_delegation_run",
        outputRef: runId,
        payload: {
          runId,
          researchTaskId: revokedRun.researchTaskId,
          status: "revoked",
          blockReasons: revokedRun.blockReasons
        }
      }
    ],
    [],
    projection
  );
}
