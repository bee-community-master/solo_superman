import type { ProjectionVersion, SchemaVersion, SessionId } from "../ids";

export const EXECUTION_AUTHORITY_SCHEMA_VERSION =
  "solo-superman.phase3-execution-authority.v1" as SchemaVersion;

export const EXECUTION_AUTHORITY_ACTION_CLASSES = [
  "file_diff",
  "shell_command",
  "browser_action",
  "external_mutation_preview_only"
] as const;

export type ExecutionAuthorityActionClass = (typeof EXECUTION_AUTHORITY_ACTION_CLASSES)[number];

export const EXECUTION_APPROVAL_DECISIONS = ["pending", "approved", "rejected", "revoked", "expired"] as const;

export type ExecutionApprovalDecision = (typeof EXECUTION_APPROVAL_DECISIONS)[number];

export const EXECUTION_RESULT_STATES = ["not_run", "running", "blocked", "completed", "failed", "partial"] as const;

export type ExecutionResultState = (typeof EXECUTION_RESULT_STATES)[number];

const EXECUTION_TERMINAL_RESULT_STATES = ["completed", "failed", "partial"] as const;

export const EXECUTION_AUTHORITY_LEDGER_STATUSES = [
  "preview_only",
  "ready_for_execution",
  "running",
  "blocked",
  "closed"
] as const;

export type ExecutionAuthorityLedgerStatus = (typeof EXECUTION_AUTHORITY_LEDGER_STATUSES)[number];

export const EXECUTION_SANDBOX_MODES = [
  "workspace_patch",
  "command_sandbox",
  "browser_preview_session"
] as const;

export type ExecutionSandboxMode = (typeof EXECUTION_SANDBOX_MODES)[number];

export const EXECUTION_NETWORK_POLICIES = ["loopback_only", "approved_public_read", "blocked"] as const;

export type ExecutionNetworkPolicy = (typeof EXECUTION_NETWORK_POLICIES)[number];

export const EXECUTION_SECRET_POLICIES = ["no_secret_values", "explicit_secret_ref_only"] as const;

export type ExecutionSecretPolicy = (typeof EXECUTION_SECRET_POLICIES)[number];

export const EXECUTION_ROLLBACK_KINDS = [
  "git_diff_reverse",
  "filesystem_snapshot",
  "command_compensating_action",
  "browser_state_reset",
  "not_applicable_preview_only"
] as const;

export type ExecutionRollbackKind = (typeof EXECUTION_ROLLBACK_KINDS)[number];

export const EXECUTION_AUTHORITY_BLOCK_CODES = [
  "missing_source",
  "missing_preview",
  "preview_hash_mismatch",
  "missing_approval",
  "rejected_approval",
  "revoked_approval",
  "expired_approval",
  "missing_rollback",
  "credential_value_required",
  "sandbox_failure"
] as const;

export type ExecutionAuthorityBlockCode = (typeof EXECUTION_AUTHORITY_BLOCK_CODES)[number];

export const BOUNDED_AGENT_FAILURE_MODES = [
  "insufficient_source",
  "insufficient_evidence",
  "approval_required",
  "policy_blocked",
  "ready_for_preview"
] as const;

export type BoundedAgentFailureMode = (typeof BOUNDED_AGENT_FAILURE_MODES)[number];

export const BOUNDED_AGENT_NO_EXECUTION_POLICIES = [
  "suggestion_only",
  "preview_only",
  "controlled_execution_required"
] as const;

export type BoundedAgentNoExecutionPolicy = (typeof BOUNDED_AGENT_NO_EXECUTION_POLICIES)[number];

export interface ExecutionAuthorityRequestedScope {
  readonly workspaceRef?: string;
  readonly commandAllowlistRef?: string;
  readonly browserTargetRef?: string;
  readonly filePathGlobs?: readonly string[];
  readonly maxDurationMs?: number;
}

export interface ExecutionAuthorityApprover {
  readonly actorId: string;
  readonly actorType: "user" | "local_operator";
  readonly approvedAt?: string;
  readonly decidedAt?: string;
}

export interface ExecutionSandboxBoundary {
  readonly mode: ExecutionSandboxMode;
  readonly networkPolicy: ExecutionNetworkPolicy;
  readonly secretPolicy: ExecutionSecretPolicy;
}

export interface ExecutionRollbackReference {
  readonly kind: ExecutionRollbackKind;
  readonly ref: string;
}

export interface ExecutionAuthorityBlockReasonDto {
  readonly code: ExecutionAuthorityBlockCode;
  readonly message: string;
  readonly evidenceRefs: readonly string[];
}

export interface ExecutionAuthorityPreconditionChecks {
  readonly planningSourceExists?: boolean;
  readonly previewArtifactExists?: boolean;
  readonly previewHashMatches?: boolean;
  readonly rollbackAvailable?: boolean;
  readonly credentialValueRequired?: boolean;
  readonly sandboxEnforced?: boolean;
}

export interface BoundedAgentOutputRecord {
  readonly outputId: string;
  readonly sourceRefs: readonly string[];
  readonly intendedDecisionImpact: string;
  readonly proposedActionPreviewRefs: readonly string[];
  readonly requiredApprovals: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly failureMode: BoundedAgentFailureMode;
  readonly noExecutionPolicy: BoundedAgentNoExecutionPolicy;
}

export interface ExecutionAuthorityRecord {
  readonly recordId: string;
  readonly sourcePlanningHandoffRef: string;
  readonly boundedAgentOutputId: string;
  readonly actionClass: ExecutionAuthorityActionClass;
  readonly previewArtifactRef: string | null;
  readonly previewArtifactHash: string | null;
  readonly reviewedPreviewArtifactHash: string | null;
  readonly requestedScope: ExecutionAuthorityRequestedScope;
  readonly approvalDecision: ExecutionApprovalDecision;
  readonly approver: ExecutionAuthorityApprover | null;
  readonly sandboxBoundary: ExecutionSandboxBoundary;
  readonly rollbackReference: ExecutionRollbackReference | null;
  readonly executionResult: ExecutionResultState;
  readonly blockReasons: readonly ExecutionAuthorityBlockReasonDto[];
  readonly evidenceRefs: readonly string[];
  readonly auditRefs: readonly string[];
  readonly createdAt: string;
  readonly schemaVersion: typeof EXECUTION_AUTHORITY_SCHEMA_VERSION;
}

export interface CreateExecutionAuthorityPayload {
  readonly sourcePlanningHandoffRef?: string;
  readonly boundedAgentOutput: BoundedAgentOutputRecord;
  readonly actionClass: ExecutionAuthorityActionClass;
  readonly previewArtifactRef?: string;
  readonly previewArtifactHash?: string;
  readonly reviewedPreviewArtifactHash?: string;
  readonly requestedScope: ExecutionAuthorityRequestedScope;
  readonly approvalDecision: ExecutionApprovalDecision;
  readonly approver?: ExecutionAuthorityApprover;
  readonly sandboxBoundary: ExecutionSandboxBoundary;
  readonly rollbackReference?: ExecutionRollbackReference;
  readonly evidenceRefs?: readonly string[];
  readonly auditRefs?: readonly string[];
  readonly preconditionChecks?: ExecutionAuthorityPreconditionChecks;
}

export interface ExecutionAuthorityLedgerProjection {
  readonly kind: "ExecutionAuthorityLedgerProjection";
  readonly sessionId: SessionId;
  readonly version: ProjectionVersion;
  readonly currentStatus: ExecutionAuthorityLedgerStatus;
  readonly records: readonly ExecutionAuthorityRecord[];
  readonly boundedOutputs: readonly BoundedAgentOutputRecord[];
  readonly latestRecord: ExecutionAuthorityRecord;
  readonly blockedPreconditions: readonly ExecutionAuthorityBlockReasonDto[];
  readonly summary: string;
  readonly refetchUrl: string;
}

export class ExecutionAuthorityValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid Phase 3 ExecutionAuthority ledger: ${issues.join("; ")}`);
    this.name = "ExecutionAuthorityValidationError";
    this.issues = issues;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: readonly string[] | undefined) {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const EXECUTION_AUTHORITY_FORBIDDEN_SECRET_FIELD_NAMES = new Set([
  "accesstoken",
  "apikey",
  "apikeyvalue",
  "authorization",
  "bearer",
  "bearertoken",
  "cookie",
  "credential",
  "credentialvalue",
  "idtoken",
  "password",
  "passwordvalue",
  "refreshtoken",
  "secret",
  "secretvalue",
  "sessioncookie",
  "token"
]);

function normalizedSecretFieldName(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/gu, "");
}

function looksLikeSecretValue(value: string) {
  return (
    /\b(?:api[_-]?key|password|secret|token)\s*[:=]\s*\S+/iu.test(value) ||
    /\bBearer\s+[A-Za-z0-9._~+/-]{10,}/u.test(value) ||
    /\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}/u.test(value) ||
    /\bsk-[A-Za-z0-9_-]{16,}/u.test(value) ||
    /\bxox[baprs]-[A-Za-z0-9-]{10,}/u.test(value)
  );
}

export function containsExecutionAuthoritySecretValueLeak(value: unknown): boolean {
  const visited = new Set<unknown>();

  function visit(candidate: unknown): boolean {
    if (typeof candidate === "string") {
      return looksLikeSecretValue(candidate);
    }

    if (Array.isArray(candidate)) {
      return candidate.some(visit);
    }

    if (!isRecord(candidate)) {
      return false;
    }

    if (visited.has(candidate)) {
      return false;
    }

    visited.add(candidate);

    for (const [key, nestedValue] of Object.entries(candidate)) {
      if (EXECUTION_AUTHORITY_FORBIDDEN_SECRET_FIELD_NAMES.has(normalizedSecretFieldName(key))) {
        return true;
      }

      if (visit(nestedValue)) {
        return true;
      }
    }

    return false;
  }

  return visit(value);
}

function isActionClass(value: unknown): value is ExecutionAuthorityActionClass {
  return (
    typeof value === "string" &&
    EXECUTION_AUTHORITY_ACTION_CLASSES.includes(value as ExecutionAuthorityActionClass)
  );
}

function isApprovalDecision(value: unknown): value is ExecutionApprovalDecision {
  return typeof value === "string" && EXECUTION_APPROVAL_DECISIONS.includes(value as ExecutionApprovalDecision);
}

function isExecutionResult(value: unknown): value is ExecutionResultState {
  return typeof value === "string" && EXECUTION_RESULT_STATES.includes(value as ExecutionResultState);
}

function isTerminalExecutionResult(value: ExecutionResultState) {
  return EXECUTION_TERMINAL_RESULT_STATES.includes(
    value as (typeof EXECUTION_TERMINAL_RESULT_STATES)[number]
  );
}

function isSandboxBoundary(value: unknown): value is ExecutionSandboxBoundary {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.mode === "string" &&
    EXECUTION_SANDBOX_MODES.includes(value.mode as ExecutionSandboxMode) &&
    typeof value.networkPolicy === "string" &&
    EXECUTION_NETWORK_POLICIES.includes(value.networkPolicy as ExecutionNetworkPolicy) &&
    typeof value.secretPolicy === "string" &&
    EXECUTION_SECRET_POLICIES.includes(value.secretPolicy as ExecutionSecretPolicy)
  );
}

function isRollbackReference(value: unknown): value is ExecutionRollbackReference {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.kind === "string" &&
    EXECUTION_ROLLBACK_KINDS.includes(value.kind as ExecutionRollbackKind) &&
    isNonEmptyString(value.ref)
  );
}

function isApprover(value: unknown): value is ExecutionAuthorityApprover {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.actorId) &&
    (value.actorType === "user" || value.actorType === "local_operator") &&
    (value.approvedAt === undefined || isNonEmptyString(value.approvedAt)) &&
    (value.decidedAt === undefined || isNonEmptyString(value.decidedAt))
  );
}

function isBlockReason(value: unknown): value is ExecutionAuthorityBlockReasonDto {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.code === "string" &&
    EXECUTION_AUTHORITY_BLOCK_CODES.includes(value.code as ExecutionAuthorityBlockCode) &&
    isNonEmptyString(value.message) &&
    isStringArray(value.evidenceRefs as readonly string[] | undefined)
  );
}

function blockReasonsEqual(
  left: readonly ExecutionAuthorityBlockReasonDto[],
  right: readonly ExecutionAuthorityBlockReasonDto[]
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function authorityRecordsEqual(left: ExecutionAuthorityRecord, right: ExecutionAuthorityRecord) {
  return stableJson(left) === stableJson(right);
}

function requestedScopeValidationIssues(scope: ExecutionAuthorityRequestedScope): readonly string[] {
  const issues: string[] = [];
  const hasWorkspaceRef = scope.workspaceRef !== undefined;
  const hasCommandAllowlistRef = scope.commandAllowlistRef !== undefined;
  const hasBrowserTargetRef = scope.browserTargetRef !== undefined;
  const hasFilePathGlobs = scope.filePathGlobs !== undefined;

  if (hasWorkspaceRef && !isNonEmptyString(scope.workspaceRef)) {
    issues.push("requestedScope.workspaceRef must be a non-empty string when present");
  }

  if (hasCommandAllowlistRef && !isNonEmptyString(scope.commandAllowlistRef)) {
    issues.push("requestedScope.commandAllowlistRef must be a non-empty string when present");
  }

  if (hasBrowserTargetRef && !isNonEmptyString(scope.browserTargetRef)) {
    issues.push("requestedScope.browserTargetRef must be a non-empty string when present");
  }

  if (hasFilePathGlobs && (!isStringArray(scope.filePathGlobs) || scope.filePathGlobs.length === 0)) {
    issues.push("requestedScope.filePathGlobs must include non-empty string globs when present");
  }

  if (
    scope.maxDurationMs !== undefined &&
    (!Number.isInteger(scope.maxDurationMs) || scope.maxDurationMs <= 0)
  ) {
    issues.push("requestedScope.maxDurationMs must be a positive integer when present");
  }

  if (
    !hasWorkspaceRef &&
    !hasCommandAllowlistRef &&
    !hasBrowserTargetRef &&
    !hasFilePathGlobs
  ) {
    issues.push("requestedScope must include at least one workspace, command allowlist, browser target, or file glob boundary");
  }

  return issues;
}

function actionClassBoundaryValidationIssues(record: ExecutionAuthorityRecord): readonly string[] {
  const issues: string[] = [];
  const rollbackKind = record.rollbackReference?.kind;

  switch (record.actionClass) {
    case "file_diff": {
      if (!record.requestedScope.workspaceRef) {
        issues.push("file_diff authority requires workspaceRef requestedScope");
      }

      if (!record.requestedScope.filePathGlobs?.length) {
        issues.push("file_diff authority requires filePathGlobs requestedScope");
      }

      if (record.sandboxBoundary.mode !== "workspace_patch") {
        issues.push("file_diff authority requires workspace_patch sandbox mode");
      }

      if (rollbackKind && rollbackKind !== "git_diff_reverse" && rollbackKind !== "filesystem_snapshot") {
        issues.push("file_diff authority requires git_diff_reverse or filesystem_snapshot rollback kind");
      }

      break;
    }
    case "shell_command": {
      if (!record.requestedScope.commandAllowlistRef) {
        issues.push("shell_command authority requires commandAllowlistRef requestedScope");
      }

      if (record.requestedScope.maxDurationMs === undefined) {
        issues.push("shell_command authority requires maxDurationMs requestedScope");
      }

      if (record.sandboxBoundary.mode !== "command_sandbox") {
        issues.push("shell_command authority requires command_sandbox sandbox mode");
      }

      if (rollbackKind && rollbackKind !== "command_compensating_action") {
        issues.push("shell_command authority requires command_compensating_action rollback kind");
      }

      break;
    }
    case "browser_action": {
      if (!record.requestedScope.browserTargetRef) {
        issues.push("browser_action authority requires browserTargetRef requestedScope");
      }

      if (record.sandboxBoundary.mode !== "browser_preview_session") {
        issues.push("browser_action authority requires browser_preview_session sandbox mode");
      }

      if (record.sandboxBoundary.networkPolicy !== "loopback_only") {
        issues.push("browser_action authority requires loopback_only network policy");
      }

      if (rollbackKind && rollbackKind !== "browser_state_reset") {
        issues.push("browser_action authority requires browser_state_reset rollback kind");
      }

      break;
    }
    case "external_mutation_preview_only": {
      if (!record.requestedScope.browserTargetRef) {
        issues.push("external_mutation_preview_only authority requires browserTargetRef requestedScope");
      }

      if (record.sandboxBoundary.mode !== "browser_preview_session") {
        issues.push("external_mutation_preview_only authority requires browser_preview_session sandbox mode");
      }

      if (rollbackKind && rollbackKind !== "not_applicable_preview_only") {
        issues.push("external_mutation_preview_only authority only allows not_applicable_preview_only rollback kind");
      }

      break;
    }
  }

  return issues;
}

function isBoundedFailureMode(value: unknown): value is BoundedAgentFailureMode {
  return typeof value === "string" && BOUNDED_AGENT_FAILURE_MODES.includes(value as BoundedAgentFailureMode);
}

function isNoExecutionPolicy(value: unknown): value is BoundedAgentNoExecutionPolicy {
  return (
    typeof value === "string" &&
    BOUNDED_AGENT_NO_EXECUTION_POLICIES.includes(value as BoundedAgentNoExecutionPolicy)
  );
}

export function boundedAgentOutputValidationIssues(output: BoundedAgentOutputRecord): readonly string[] {
  const issues: string[] = [];

  if (!output.outputId.startsWith("bounded_output_")) {
    issues.push("bounded output id must use the bounded_output_ prefix");
  }

  if (!isStringArray(output.sourceRefs)) {
    issues.push("bounded output sourceRefs must be string refs");
  }

  if (!isNonEmptyString(output.intendedDecisionImpact)) {
    issues.push("bounded output intendedDecisionImpact is required");
  }

  if (!isStringArray(output.proposedActionPreviewRefs)) {
    issues.push("bounded output proposedActionPreviewRefs must be string refs");
  }

  if (!isStringArray(output.requiredApprovals)) {
    issues.push("bounded output requiredApprovals must be string refs");
  }

  if (!isStringArray(output.evidenceRefs)) {
    issues.push("bounded output evidenceRefs must be string refs");
  }

  if (!isBoundedFailureMode(output.failureMode)) {
    issues.push("bounded output failureMode is invalid");
  }

  if (!isNoExecutionPolicy(output.noExecutionPolicy)) {
    issues.push("bounded output noExecutionPolicy is invalid");
  }

  if (output.failureMode === "ready_for_preview") {
    if (!output.sourceRefs.length) {
      issues.push("ready_for_preview requires sourceRefs");
    }

    if (!output.proposedActionPreviewRefs.length) {
      issues.push("ready_for_preview requires proposedActionPreviewRefs");
    }

    if (!output.requiredApprovals.length) {
      issues.push("ready_for_preview requires requiredApprovals");
    }

    if (!output.evidenceRefs.length) {
      issues.push("ready_for_preview requires evidenceRefs");
    }

    if (output.noExecutionPolicy !== "controlled_execution_required") {
      issues.push("ready_for_preview requires controlled_execution_required policy");
    }
  }

  if (containsExecutionAuthoritySecretValueLeak(output)) {
    issues.push("bounded output must not contain credential or secret values");
  }

  return issues;
}

export function executionAuthorityRecordValidationIssues(record: ExecutionAuthorityRecord): readonly string[] {
  const issues: string[] = [];

  if (!record.recordId.startsWith("exec_auth_")) {
    issues.push("recordId must use the exec_auth_ prefix");
  }

  if (!isNonEmptyString(record.sourcePlanningHandoffRef)) {
    issues.push("sourcePlanningHandoffRef is required");
  }

  if (!isNonEmptyString(record.boundedAgentOutputId)) {
    issues.push("boundedAgentOutputId is required");
  }

  if (!isActionClass(record.actionClass)) {
    issues.push("actionClass is invalid");
  }

  if (!isApprovalDecision(record.approvalDecision)) {
    issues.push("approvalDecision is invalid");
  }

  if (!isExecutionResult(record.executionResult)) {
    issues.push("executionResult is invalid");
  }

  if (!isSandboxBoundary(record.sandboxBoundary)) {
    issues.push("sandboxBoundary is invalid");
  }

  issues.push(...requestedScopeValidationIssues(record.requestedScope));
  issues.push(...actionClassBoundaryValidationIssues(record));

  if (record.rollbackReference !== null && !isRollbackReference(record.rollbackReference)) {
    issues.push("rollbackReference is invalid");
  }

  if (record.approver !== null && !isApprover(record.approver)) {
    issues.push("approver is invalid");
  }

  if (!record.blockReasons.every(isBlockReason)) {
    issues.push("blockReasons must be valid ExecutionAuthorityBlockReasonDto objects");
  }

  if (!isStringArray(record.evidenceRefs)) {
    issues.push("evidenceRefs must be string refs");
  }

  if (!isStringArray(record.auditRefs) || record.auditRefs.length === 0) {
    issues.push("auditRefs must include at least one audit ref");
  }

  if (record.executionResult === "blocked" && record.blockReasons.length === 0) {
    issues.push("blocked executionResult requires blockReasons");
  }

  if (record.executionResult !== "blocked" && record.blockReasons.length > 0) {
    issues.push("non-blocked executionResult must not include blockReasons");
  }

  const terminalExecutionResult = isTerminalExecutionResult(record.executionResult);
  const requiresApprovedAuthority =
    record.executionResult === "not_run" ||
    record.executionResult === "running" ||
    terminalExecutionResult;

  if (requiresApprovedAuthority && record.approvalDecision !== "approved") {
    issues.push("not_run/running/terminal state requires approved approvalDecision");
  }

  if (requiresApprovedAuthority && !isApprover(record.approver)) {
    issues.push("not_run/running/terminal state requires valid approver");
  }

  if (requiresApprovedAuthority) {
    if (!isNonEmptyString(record.previewArtifactRef)) {
      issues.push("not_run/running/terminal state requires previewArtifactRef");
    }

    if (!isNonEmptyString(record.previewArtifactHash) || record.previewArtifactHash !== record.reviewedPreviewArtifactHash) {
      issues.push("not_run/running/terminal state requires matching preview hashes");
    }

    if (
      record.executionResult === "running" ||
      terminalExecutionResult ||
      record.actionClass !== "external_mutation_preview_only"
    ) {
      if (!record.rollbackReference) {
        issues.push("not_run/running/terminal state requires rollbackReference");
      }
    }
  }

  if (
    record.actionClass === "external_mutation_preview_only" &&
    record.executionResult !== "not_run" &&
    record.executionResult !== "blocked"
  ) {
    issues.push("external_mutation_preview_only records must remain not_run or blocked");
  }

  if (
    record.actionClass !== "external_mutation_preview_only" &&
    record.rollbackReference === null &&
    record.executionResult !== "blocked"
  ) {
    issues.push("rollbackReference is mandatory before non-preview execution");
  }

  if (containsExecutionAuthoritySecretValueLeak(record)) {
    issues.push("ExecutionAuthorityRecord must not contain credential or secret values");
  }

  if (record.schemaVersion !== EXECUTION_AUTHORITY_SCHEMA_VERSION) {
    issues.push("schemaVersion must match Phase 3 execution authority schema");
  }

  return issues;
}

export function validateBoundedAgentOutputRecord(output: BoundedAgentOutputRecord): BoundedAgentOutputRecord {
  const issues = boundedAgentOutputValidationIssues(output);

  if (issues.length) {
    throw new ExecutionAuthorityValidationError(issues);
  }

  return output;
}

export function validateExecutionAuthorityRecord(record: ExecutionAuthorityRecord): ExecutionAuthorityRecord {
  const issues = executionAuthorityRecordValidationIssues(record);

  if (issues.length) {
    throw new ExecutionAuthorityValidationError(issues);
  }

  return record;
}

export function executionAuthorityLedgerStatusForRecord(
  record: ExecutionAuthorityRecord
): ExecutionAuthorityLedgerStatus {
  switch (record.executionResult) {
    case "blocked":
      return "blocked";
    case "running":
      return "running";
    case "completed":
    case "failed":
    case "partial":
      return "closed";
    case "not_run":
      return record.actionClass === "external_mutation_preview_only"
        ? "preview_only"
        : "ready_for_execution";
  }
}

export function executionAuthorityLedgerSummaryForStatus(status: ExecutionAuthorityLedgerStatus) {
  switch (status) {
    case "blocked":
      return "Execution authority is blocked before any adapter can run.";
    case "running":
      return "Execution authority passed approval, preview, sandbox, and rollback checks and is running.";
    case "closed":
      return "Execution authority has terminal execution evidence.";
    case "preview_only":
      return "External mutation preview authority is recorded for review only; no execution path is ready.";
    case "ready_for_execution":
      return "Execution authority is approved and ready, but no adapter execution has run in the common ledger slice.";
  }
}

export function validateExecutionAuthorityLedgerProjection(
  projection: ExecutionAuthorityLedgerProjection
): ExecutionAuthorityLedgerProjection {
  const issues: string[] = [];
  const currentStatus = EXECUTION_AUTHORITY_LEDGER_STATUSES.includes(
    projection.currentStatus as ExecutionAuthorityLedgerStatus
  )
    ? projection.currentStatus
    : null;

  if (projection.kind !== "ExecutionAuthorityLedgerProjection") {
    issues.push("projection kind must be ExecutionAuthorityLedgerProjection");
  }

  if (!currentStatus) {
    issues.push("projection currentStatus is invalid");
  }

  if (currentStatus && projection.summary !== executionAuthorityLedgerSummaryForStatus(currentStatus)) {
    issues.push("projection summary must match the canonical currentStatus summary");
  }

  if (projection.records.length === 0) {
    issues.push("projection records must include at least one authority record");
  }

  if (projection.boundedOutputs.length === 0) {
    issues.push("projection boundedOutputs must include at least one bounded output");
  }

  for (const record of projection.records) {
    issues.push(...executionAuthorityRecordValidationIssues(record));
  }

  for (const output of projection.boundedOutputs) {
    issues.push(...boundedAgentOutputValidationIssues(output));
  }

  const boundedOutputIds = new Set(projection.boundedOutputs.map((output) => output.outputId));

  for (const record of projection.records) {
    if (!boundedOutputIds.has(record.boundedAgentOutputId)) {
      issues.push("every authority record must reference a bounded output in the ledger projection");
    }
  }

  const lastRecord = projection.records.at(-1);

  if (projection.latestRecord.recordId !== lastRecord?.recordId) {
    issues.push("latestRecord must match the last authority record");
  }

  if (lastRecord && !authorityRecordsEqual(projection.latestRecord, lastRecord)) {
    issues.push("latestRecord must exactly match the last authority record");
  }

  if (!boundedOutputIds.has(projection.latestRecord.boundedAgentOutputId)) {
    issues.push("latestRecord must reference a bounded output in the ledger projection");
  }

  if (projection.currentStatus === "blocked" && projection.blockedPreconditions.length === 0) {
    issues.push("blocked projection requires blockedPreconditions");
  }

  if (projection.currentStatus !== "blocked" && projection.blockedPreconditions.length > 0) {
    issues.push("non-blocked projection must not include blockedPreconditions");
  }

  if (projection.currentStatus === "blocked" && projection.latestRecord.executionResult !== "blocked") {
    issues.push("blocked projection requires latest record to be blocked");
  }

  if (
    projection.currentStatus === "blocked" &&
    !blockReasonsEqual(projection.blockedPreconditions, projection.latestRecord.blockReasons)
  ) {
    issues.push("blockedPreconditions must match latest record blockReasons");
  }

  if (
    projection.currentStatus === "preview_only" &&
    (projection.latestRecord.executionResult !== "not_run" ||
      projection.latestRecord.actionClass !== "external_mutation_preview_only")
  ) {
    issues.push("preview_only projection requires a not_run external_mutation_preview_only latest record");
  }

  if (
    projection.currentStatus === "ready_for_execution" &&
    (projection.latestRecord.executionResult !== "not_run" ||
      projection.latestRecord.actionClass === "external_mutation_preview_only")
  ) {
    issues.push("ready_for_execution projection requires executable latest record to be not_run");
  }

  if (projection.currentStatus === "running" && projection.latestRecord.executionResult !== "running") {
    issues.push("running projection requires latest record to be running");
  }

  if (
    projection.currentStatus === "closed" &&
    !["completed", "failed", "partial"].includes(projection.latestRecord.executionResult)
  ) {
    issues.push("closed projection requires a terminal execution result");
  }

  if (issues.length) {
    throw new ExecutionAuthorityValidationError(issues);
  }

  return projection;
}

const demoSessionId = "session_phase3_authority_demo_001" as SessionId;

export const PHASE3_BOUNDED_OUTPUT_READY_FIXTURE = {
  outputId: "bounded_output_demo_ready_001",
  sourceRefs: ["handoff_phase3_demo_001", "evidence_pack_phase3_demo_001"],
  intendedDecisionImpact: "Apply an approved file diff preview only after local user approval.",
  proposedActionPreviewRefs: ["runtime_preview_phase3_demo_001"],
  requiredApprovals: ["approval_phase3_demo_001"],
  evidenceRefs: ["evidence_phase3_demo_preview_summary_001"],
  failureMode: "ready_for_preview",
  noExecutionPolicy: "controlled_execution_required"
} as const satisfies BoundedAgentOutputRecord;

export const PHASE3_EXECUTION_AUTHORITY_READY_RECORD_FIXTURE = {
  recordId: "exec_auth_demo_ready_001",
  sourcePlanningHandoffRef: "handoff_phase3_demo_001",
  boundedAgentOutputId: PHASE3_BOUNDED_OUTPUT_READY_FIXTURE.outputId,
  actionClass: "file_diff",
  previewArtifactRef: "runtime_preview_phase3_demo_001",
  previewArtifactHash: "sha256:phase3-demo-preview",
  reviewedPreviewArtifactHash: "sha256:phase3-demo-preview",
  requestedScope: {
    workspaceRef: "workspace_demo_local",
    filePathGlobs: ["packages/**"],
    maxDurationMs: 120_000
  },
  approvalDecision: "approved",
  approver: {
    actorId: "user_demo_001",
    actorType: "user",
    approvedAt: "2026-05-12T00:00:00.000Z"
  },
  sandboxBoundary: {
    mode: "workspace_patch",
    networkPolicy: "loopback_only",
    secretPolicy: "no_secret_values"
  },
  rollbackReference: {
    kind: "git_diff_reverse",
    ref: "rollback_diff_phase3_demo_001"
  },
  executionResult: "not_run",
  blockReasons: [],
  evidenceRefs: ["evidence_phase3_demo_preview_summary_001"],
  auditRefs: ["audit_phase3_demo_authority_created_001"],
  createdAt: "2026-05-12T00:00:00.000Z",
  schemaVersion: EXECUTION_AUTHORITY_SCHEMA_VERSION
} as const satisfies ExecutionAuthorityRecord;

export const PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE = {
  kind: "ExecutionAuthorityLedgerProjection",
  sessionId: demoSessionId,
  version: 1 as ProjectionVersion,
  currentStatus: "ready_for_execution",
  records: [PHASE3_EXECUTION_AUTHORITY_READY_RECORD_FIXTURE],
  boundedOutputs: [PHASE3_BOUNDED_OUTPUT_READY_FIXTURE],
  latestRecord: PHASE3_EXECUTION_AUTHORITY_READY_RECORD_FIXTURE,
  blockedPreconditions: [],
  summary: executionAuthorityLedgerSummaryForStatus("ready_for_execution"),
  refetchUrl: `/api/v1/sessions/${demoSessionId}/execution-authority`
} as const satisfies ExecutionAuthorityLedgerProjection;

export const PHASE3_BOUNDED_OUTPUT_BLOCKED_FIXTURE = {
  outputId: "bounded_output_demo_blocked_001",
  sourceRefs: [],
  intendedDecisionImpact: "Blocked output remains a visible suggestion until source, preview, approval, and sandbox evidence exist.",
  proposedActionPreviewRefs: [],
  requiredApprovals: [],
  evidenceRefs: [],
  failureMode: "insufficient_source",
  noExecutionPolicy: "suggestion_only"
} as const satisfies BoundedAgentOutputRecord;

export const PHASE3_EXECUTION_AUTHORITY_BLOCKED_RECORD_FIXTURE = {
  ...PHASE3_EXECUTION_AUTHORITY_READY_RECORD_FIXTURE,
  recordId: "exec_auth_demo_blocked_001",
  sourcePlanningHandoffRef: "missing_planning_handoff_source",
  boundedAgentOutputId: PHASE3_BOUNDED_OUTPUT_BLOCKED_FIXTURE.outputId,
  previewArtifactRef: null,
  previewArtifactHash: null,
  reviewedPreviewArtifactHash: null,
  approvalDecision: "pending",
  approver: null,
  rollbackReference: null,
  executionResult: "blocked",
  blockReasons: [
    {
      code: "missing_source",
      message: "Planning Handoff source is missing, so no adapter execution can start.",
      evidenceRefs: ["block:missing_source"]
    },
    {
      code: "missing_preview",
      message: "Preview artifact is missing, so no user-reviewed action can be approved.",
      evidenceRefs: ["block:missing_preview"]
    }
  ],
  evidenceRefs: ["block:missing_source", "block:missing_preview"],
  auditRefs: ["audit_phase3_demo_authority_blocked_001"],
  createdAt: "2026-05-12T00:05:00.000Z"
} as const satisfies ExecutionAuthorityRecord;

export const PHASE3_EXECUTION_AUTHORITY_BLOCKED_PROJECTION_FIXTURE = {
  kind: "ExecutionAuthorityLedgerProjection",
  sessionId: demoSessionId,
  version: 2 as ProjectionVersion,
  currentStatus: "blocked",
  records: [PHASE3_EXECUTION_AUTHORITY_BLOCKED_RECORD_FIXTURE],
  boundedOutputs: [PHASE3_BOUNDED_OUTPUT_BLOCKED_FIXTURE],
  latestRecord: PHASE3_EXECUTION_AUTHORITY_BLOCKED_RECORD_FIXTURE,
  blockedPreconditions: PHASE3_EXECUTION_AUTHORITY_BLOCKED_RECORD_FIXTURE.blockReasons,
  summary: executionAuthorityLedgerSummaryForStatus("blocked"),
  refetchUrl: `/api/v1/sessions/${demoSessionId}/execution-authority`
} as const satisfies ExecutionAuthorityLedgerProjection;
