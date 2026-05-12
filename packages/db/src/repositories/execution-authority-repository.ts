import { desc, eq } from "drizzle-orm";
import {
  executionAuthorityLedgerStatusForRecord,
  executionAuthorityLedgerSummaryForStatus,
  validateExecutionAuthorityLedgerProjection,
  type BoundedAgentOutputRecord,
  type CommandId,
  type EventId,
  type ExecutionAuthorityBlockReasonDto,
  type ExecutionAuthorityLedgerProjection,
  type ExecutionAuthorityRecord,
  type ExecutionResultState,
  type ProjectId,
  type SchemaVersion,
  type SessionId,
  type StateVersion
} from "@solo-superman/contracts";
import type { SoloDatabaseExecutor } from "../client";
import { parseJsonArray, parseJsonRecord, stringifyJson } from "../json";
import { boundedAgentOutputRecords, executionAuthorityRecords } from "../schema";

export interface SaveExecutionAuthorityLedgerProjectionInput {
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
  readonly sourceCommandId: CommandId;
  readonly sourceEventId: EventId;
  readonly sourceStateVersion: StateVersion;
  readonly projection: ExecutionAuthorityLedgerProjection;
}

export interface UpdateExecutionAuthorityOutcomeInput {
  readonly recordId: string;
  readonly executionResult: Extract<ExecutionResultState, "blocked" | "completed" | "failed" | "partial">;
  readonly blockReasons: readonly ExecutionAuthorityBlockReasonDto[];
  readonly evidenceRefs: readonly string[];
  readonly auditRefs: readonly string[];
}

function assertAuthorityRecordId(recordId: string) {
  if (!recordId.startsWith("exec_auth_")) {
    throw new Error(`Execution authority record id must use the exec_auth_ prefix: ${recordId}`);
  }
}

function parseJsonRecordArray<TValue extends object>(
  value: string,
  fieldName: string
): readonly TValue[] {
  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed) || parsed.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
    throw new Error(`${fieldName} must be a JSON object array.`);
  }

  return parsed as readonly TValue[];
}

function authorityProjectionFromRow(row: typeof executionAuthorityRecords.$inferSelect): ExecutionAuthorityLedgerProjection {
  const record: ExecutionAuthorityRecord = {
    recordId: row.id,
    sourcePlanningHandoffRef: row.sourcePlanningHandoffRef,
    boundedAgentOutputId: row.boundedAgentOutputId,
    actionClass: row.actionClass as ExecutionAuthorityRecord["actionClass"],
    previewArtifactRef: row.previewArtifactRef,
    previewArtifactHash: row.previewArtifactHash,
    reviewedPreviewArtifactHash: row.reviewedPreviewArtifactHash,
    requestedScope: parseJsonRecord(row.requestedScopeJson, "execution_authority_records.requested_scope_json"),
    approvalDecision: row.approvalDecision as ExecutionAuthorityRecord["approvalDecision"],
    approver: row.approverJson
      ? parseJsonRecord(row.approverJson, "execution_authority_records.approver_json")
      : null,
    sandboxBoundary: parseJsonRecord(row.sandboxBoundaryJson, "execution_authority_records.sandbox_boundary_json"),
    rollbackReference: row.rollbackReferenceJson
      ? parseJsonRecord(row.rollbackReferenceJson, "execution_authority_records.rollback_reference_json")
      : null,
    executionResult: row.executionResult as ExecutionAuthorityRecord["executionResult"],
    blockReasons: parseJsonRecordArray<ExecutionAuthorityBlockReasonDto>(
      row.blockReasonsJson,
      "execution_authority_records.block_reasons_json"
    ),
    evidenceRefs: parseJsonArray(row.evidenceRefsJson, "execution_authority_records.evidence_refs_json"),
    auditRefs: parseJsonArray(row.auditRefsJson, "execution_authority_records.audit_refs_json"),
    createdAt: row.createdAt,
    schemaVersion: row.schemaVersion as SchemaVersion
  };

  const currentStatus = executionAuthorityLedgerStatusForRecord(record);

  return {
    kind: "ExecutionAuthorityLedgerProjection",
    sessionId: row.sessionId as SessionId,
    version: (row.sourceStateVersion + 1) as ExecutionAuthorityLedgerProjection["version"],
    currentStatus,
    records: [record],
    boundedOutputs: [],
    latestRecord: record,
    blockedPreconditions: record.blockReasons,
    summary: executionAuthorityLedgerSummaryForStatus(currentStatus),
    refetchUrl: `/api/v1/sessions/${row.sessionId}/execution-authority`
  };
}

function boundedOutputRow(input: SaveExecutionAuthorityLedgerProjectionInput, output: BoundedAgentOutputRecord) {
  return {
    id: output.outputId,
    projectId: input.projectId,
    sessionId: input.sessionId,
    authorityRecordId: input.projection.latestRecord.recordId,
    sourceRefsJson: stringifyJson(output.sourceRefs),
    intendedDecisionImpact: output.intendedDecisionImpact,
    proposedActionPreviewRefsJson: stringifyJson(output.proposedActionPreviewRefs),
    requiredApprovalsJson: stringifyJson(output.requiredApprovals),
    evidenceRefsJson: stringifyJson(output.evidenceRefs),
    failureMode: output.failureMode,
    noExecutionPolicy: output.noExecutionPolicy,
    createdAt: input.projection.latestRecord.createdAt,
    schemaVersion: input.projection.latestRecord.schemaVersion
  };
}

function recordRow(input: SaveExecutionAuthorityLedgerProjectionInput, record: ExecutionAuthorityRecord) {
  return {
    id: record.recordId,
    projectId: input.projectId,
    sessionId: input.sessionId,
    sourceCommandId: input.sourceCommandId,
    sourceEventId: input.sourceEventId,
    sourceStateVersion: Number(input.sourceStateVersion),
    sourcePlanningHandoffRef: record.sourcePlanningHandoffRef,
    boundedAgentOutputId: record.boundedAgentOutputId,
    actionClass: record.actionClass,
    approvalDecision: record.approvalDecision,
    executionResult: record.executionResult,
    previewArtifactRef: record.previewArtifactRef,
    previewArtifactHash: record.previewArtifactHash,
    reviewedPreviewArtifactHash: record.reviewedPreviewArtifactHash,
    requestedScopeJson: stringifyJson(record.requestedScope),
    approverJson: record.approver ? stringifyJson(record.approver) : null,
    sandboxBoundaryJson: stringifyJson(record.sandboxBoundary),
    rollbackReferenceJson: record.rollbackReference ? stringifyJson(record.rollbackReference) : null,
    blockReasonsJson: stringifyJson(record.blockReasons),
    evidenceRefsJson: stringifyJson(record.evidenceRefs),
    auditRefsJson: stringifyJson(record.auditRefs),
    createdAt: record.createdAt,
    schemaVersion: record.schemaVersion
  };
}

export function createExecutionAuthorityRepository(db: SoloDatabaseExecutor) {
  async function getProjectionById(recordId: string): Promise<ExecutionAuthorityLedgerProjection | null> {
    const rows = await db
      .select()
      .from(executionAuthorityRecords)
      .where(eq(executionAuthorityRecords.id, recordId))
      .limit(1);
    const row = rows[0];

    if (!row) {
      return null;
    }

    const projection = authorityProjectionFromRow(row);
    const outputRows = await db
      .select()
      .from(boundedAgentOutputRecords)
      .where(eq(boundedAgentOutputRecords.id, projection.latestRecord.boundedAgentOutputId));
    const boundedOutputs = outputRows.map((outputRow) => ({
      outputId: outputRow.id,
      sourceRefs: parseJsonArray(outputRow.sourceRefsJson, "bounded_agent_output_records.source_refs_json"),
      intendedDecisionImpact: outputRow.intendedDecisionImpact,
      proposedActionPreviewRefs: parseJsonArray(
        outputRow.proposedActionPreviewRefsJson,
        "bounded_agent_output_records.proposed_action_preview_refs_json"
      ),
      requiredApprovals: parseJsonArray(outputRow.requiredApprovalsJson, "bounded_agent_output_records.required_approvals_json"),
      evidenceRefs: parseJsonArray(outputRow.evidenceRefsJson, "bounded_agent_output_records.evidence_refs_json"),
      failureMode: outputRow.failureMode as BoundedAgentOutputRecord["failureMode"],
      noExecutionPolicy: outputRow.noExecutionPolicy as BoundedAgentOutputRecord["noExecutionPolicy"]
    }));

    const hydratedProjection = {
      ...projection,
      boundedOutputs
    };

    return validateExecutionAuthorityLedgerProjection(hydratedProjection);
  }

  async function insertAuthorityRows(input: SaveExecutionAuthorityLedgerProjectionInput): Promise<boolean> {
    const record = input.projection.latestRecord;
    const rows = await db
      .insert(executionAuthorityRecords)
      .values(recordRow(input, record))
      .onConflictDoNothing({ target: executionAuthorityRecords.id })
      .returning({ id: executionAuthorityRecords.id });

    return Boolean(rows[0]);
  }

  async function insertBoundedOutputRows(input: SaveExecutionAuthorityLedgerProjectionInput): Promise<void> {
    if (!input.projection.boundedOutputs.length) {
      return;
    }

    await db
      .insert(boundedAgentOutputRecords)
      .values(input.projection.boundedOutputs.map((output) => boundedOutputRow(input, output)))
      .onConflictDoNothing({ target: boundedAgentOutputRecords.id });
  }

  return {
    async saveFromProjection(
      input: SaveExecutionAuthorityLedgerProjectionInput
    ): Promise<ExecutionAuthorityLedgerProjection> {
      const record = input.projection.latestRecord;

      assertAuthorityRecordId(record.recordId);

      const inserted = await insertAuthorityRows(input);

      if (!inserted) {
        await insertBoundedOutputRows(input);

        const existingProjection = await getProjectionById(record.recordId);

        if (!existingProjection) {
          throw new Error(`Execution authority idempotent insert conflicted but ${record.recordId} was not found.`);
        }

        return existingProjection;
      }

      await insertBoundedOutputRows(input);

      return input.projection;
    },

    async getById(recordId: string): Promise<ExecutionAuthorityLedgerProjection | null> {
      return getProjectionById(recordId);
    },

    async getLatestForSession(sessionId: SessionId): Promise<ExecutionAuthorityLedgerProjection | null> {
      const rows = await db
        .select()
        .from(executionAuthorityRecords)
        .where(eq(executionAuthorityRecords.sessionId, sessionId))
        .orderBy(
          desc(executionAuthorityRecords.sourceStateVersion),
          desc(executionAuthorityRecords.createdAt),
          desc(executionAuthorityRecords.id)
        )
        .limit(1);
      const row = rows[0];

      return row ? getProjectionById(row.id) : null;
    },

    async getForSourceCommand(commandId: CommandId): Promise<ExecutionAuthorityLedgerProjection | null> {
      const rows = await db
        .select()
        .from(executionAuthorityRecords)
        .where(eq(executionAuthorityRecords.sourceCommandId, commandId))
        .limit(1);
      const row = rows[0];

      return row ? getProjectionById(row.id) : null;
    },

    async updateExecutionOutcome(
      input: UpdateExecutionAuthorityOutcomeInput
    ): Promise<ExecutionAuthorityLedgerProjection | null> {
      const rows = await db
        .update(executionAuthorityRecords)
        .set({
          executionResult: input.executionResult,
          blockReasonsJson: stringifyJson(input.blockReasons),
          evidenceRefsJson: stringifyJson(input.evidenceRefs),
          auditRefsJson: stringifyJson(input.auditRefs)
        })
        .where(eq(executionAuthorityRecords.id, input.recordId))
        .returning({ id: executionAuthorityRecords.id });

      return rows[0] ? getProjectionById(rows[0].id) : null;
    }
  };
}
