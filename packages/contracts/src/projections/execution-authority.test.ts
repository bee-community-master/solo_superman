import { describe, expect, expectTypeOf, it } from "vitest";
import {
  PHASE3_BOUNDED_OUTPUT_READY_FIXTURE,
  PHASE3_EXECUTION_AUTHORITY_BLOCKED_PROJECTION_FIXTURE,
  PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE,
  executionAuthorityLedgerSummaryForStatus,
  executionAuthorityRecordValidationIssues,
  isExecutionAuthorityIsoTimestamp,
  validateBoundedAgentOutputRecord,
  validateExecutionAuthorityLedgerProjection,
  validateExecutionAuthorityRecord
} from "./execution-authority";
import type {
  BoundedAgentOutputRecord,
  CreateExecutionAuthorityPayload,
  ExecutionApprovalDecision,
  ExecutionAuthorityLedgerProjection,
  ExecutionAuthorityLedgerStatus,
  ExecutionAuthorityRecord,
  ExecutionResultState
} from "./execution-authority";

describe("Phase 3 ExecutionAuthority ledger contract", () => {
  it("keeps the public authority, bounded output, payload, and projection field families exact", () => {
    expectTypeOf<ExecutionApprovalDecision>().toEqualTypeOf<
      "pending" | "approved" | "rejected" | "revoked" | "expired"
    >();
    expectTypeOf<ExecutionResultState>().toEqualTypeOf<"not_run" | "running" | "blocked" | "completed" | "failed" | "partial">();
    expectTypeOf<ExecutionAuthorityLedgerStatus>().toEqualTypeOf<
      "preview_only" | "ready_for_execution" | "running" | "blocked" | "closed"
    >();
    expectTypeOf<keyof ExecutionAuthorityRecord>().toEqualTypeOf<
      | "recordId"
      | "sourcePlanningHandoffRef"
      | "boundedAgentOutputId"
      | "actionClass"
      | "previewArtifactRef"
      | "previewArtifactHash"
      | "reviewedPreviewArtifactHash"
      | "requestedScope"
      | "approvalDecision"
      | "approver"
      | "sandboxBoundary"
      | "rollbackReference"
      | "executionResult"
      | "blockReasons"
      | "evidenceRefs"
      | "auditRefs"
      | "createdAt"
      | "schemaVersion"
    >();
    expectTypeOf<keyof BoundedAgentOutputRecord>().toEqualTypeOf<
      | "outputId"
      | "sourceRefs"
      | "intendedDecisionImpact"
      | "proposedActionPreviewRefs"
      | "requiredApprovals"
      | "evidenceRefs"
      | "failureMode"
      | "noExecutionPolicy"
    >();
    expectTypeOf<keyof CreateExecutionAuthorityPayload>().toEqualTypeOf<
      | "sourcePlanningHandoffRef"
      | "boundedAgentOutput"
      | "actionClass"
      | "previewArtifactRef"
      | "previewArtifactHash"
      | "reviewedPreviewArtifactHash"
      | "requestedScope"
      | "approvalDecision"
      | "approver"
      | "sandboxBoundary"
      | "rollbackReference"
      | "evidenceRefs"
      | "auditRefs"
      | "preconditionChecks"
    >();
    expectTypeOf<keyof ExecutionAuthorityLedgerProjection>().toEqualTypeOf<
      | "kind"
      | "sessionId"
      | "version"
      | "currentStatus"
      | "records"
      | "boundedOutputs"
      | "latestRecord"
      | "blockedPreconditions"
      | "summary"
      | "refetchUrl"
    >();
  });

  it("validates an approved authority record without running an adapter", () => {
    const projection = validateExecutionAuthorityLedgerProjection(PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE);
    const record = validateExecutionAuthorityRecord(projection.latestRecord);
    const output = validateBoundedAgentOutputRecord(PHASE3_BOUNDED_OUTPUT_READY_FIXTURE);

    expect(projection.currentStatus).toBe("ready_for_execution");
    expect(record.approvalDecision).toBe("approved");
    expect(record.executionResult).toBe("not_run");
    expect(record.blockReasons).toEqual([]);
    expect(output.noExecutionPolicy).toBe("controlled_execution_required");
    expect(JSON.stringify(projection)).not.toMatch(/credentialValue|secretValue|sessionCookie|adapterExecuted/iu);
  });

  it("accepts only explicit ISO timestamps for authority expiry checks", () => {
    expect(isExecutionAuthorityIsoTimestamp("2026-05-13T00:05:00.000Z")).toBe(true);
    expect(isExecutionAuthorityIsoTimestamp("2026-05-13T09:05:00+09:00")).toBe(true);
    expect(isExecutionAuthorityIsoTimestamp("2026-05-13")).toBe(false);
    expect(isExecutionAuthorityIsoTimestamp("2026-02-31T00:00:00.000Z")).toBe(false);
  });

  it("keeps running authority gated by approved preview, sandbox, and rollback evidence", () => {
    const runningRecord = {
      ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE.latestRecord,
      executionResult: "running"
    } satisfies ExecutionAuthorityRecord;
    const runningProjection = {
      ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE,
      currentStatus: "running",
      records: [runningRecord],
      latestRecord: runningRecord,
      summary: executionAuthorityLedgerSummaryForStatus("running")
    } satisfies ExecutionAuthorityLedgerProjection;
    const pendingRunningRecord = {
      ...runningRecord,
      approvalDecision: "pending"
    } satisfies ExecutionAuthorityRecord;

    expect(validateExecutionAuthorityRecord(runningRecord)).toMatchObject({ executionResult: "running" });
    expect(validateExecutionAuthorityLedgerProjection(runningProjection).currentStatus).toBe("running");
    expect(executionAuthorityRecordValidationIssues(pendingRunningRecord)).toContain(
      "not_run/running/terminal state requires approved approvalDecision"
    );
  });

  it("validates blocked preconditions as evidence-bearing ledger state", () => {
    const projection = validateExecutionAuthorityLedgerProjection(PHASE3_EXECUTION_AUTHORITY_BLOCKED_PROJECTION_FIXTURE);

    expect(projection.currentStatus).toBe("blocked");
    expect(projection.latestRecord.executionResult).toBe("blocked");
    expect(projection.blockedPreconditions.map((reason) => reason.code)).toEqual([
      "missing_source",
      "missing_preview"
    ]);
    expect(projection.latestRecord.evidenceRefs).toEqual(["block:missing_source", "block:missing_preview"]);
  });

  it("rejects ready records when preview hashes or rollback references are missing", () => {
    const missingRollback = {
      ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE.latestRecord,
      rollbackReference: null
    } satisfies ExecutionAuthorityRecord;
    const previewMismatch = {
      ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE.latestRecord,
      reviewedPreviewArtifactHash: "sha256:different-preview"
    } satisfies ExecutionAuthorityRecord;

    expect(executionAuthorityRecordValidationIssues(missingRollback)).toContain(
      "not_run/running/terminal state requires rollbackReference"
    );
    expect(executionAuthorityRecordValidationIssues(previewMismatch)).toContain(
      "not_run/running/terminal state requires matching preview hashes"
    );
  });

  it("rejects terminal execution records that skip approved authority evidence", () => {
    const terminalWithoutAuthority = {
      ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE.latestRecord,
      approvalDecision: "pending",
      approver: null,
      previewArtifactRef: null,
      previewArtifactHash: null,
      reviewedPreviewArtifactHash: null,
      rollbackReference: null,
      executionResult: "completed"
    } satisfies ExecutionAuthorityRecord;
    const issues = executionAuthorityRecordValidationIssues(terminalWithoutAuthority);

    expect(issues).toEqual(
      expect.arrayContaining([
        "not_run/running/terminal state requires approved approvalDecision",
        "not_run/running/terminal state requires valid approver",
        "not_run/running/terminal state requires previewArtifactRef",
        "not_run/running/terminal state requires matching preview hashes",
        "not_run/running/terminal state requires rollbackReference"
      ])
    );
  });

  it("allows preview-only external mutation records to remain not-run without rollback authority", () => {
    const previewOnlyRecord = {
      ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE.latestRecord,
      actionClass: "external_mutation_preview_only",
      requestedScope: {
        browserTargetRef: "external_preview_policy_ref"
      },
      sandboxBoundary: {
        mode: "browser_preview_session",
        networkPolicy: "blocked",
        secretPolicy: "no_secret_values"
      },
      rollbackReference: null
    } satisfies ExecutionAuthorityRecord;
    const previewOnlyProjection = {
      ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE,
      currentStatus: "preview_only",
      records: [previewOnlyRecord],
      latestRecord: previewOnlyRecord,
      summary: executionAuthorityLedgerSummaryForStatus("preview_only")
    } satisfies ExecutionAuthorityLedgerProjection;
    const misleadingReadyProjection = {
      ...previewOnlyProjection,
      currentStatus: "ready_for_execution"
    } satisfies ExecutionAuthorityLedgerProjection;

    expect(validateExecutionAuthorityRecord(previewOnlyRecord)).toMatchObject({
      actionClass: "external_mutation_preview_only",
      executionResult: "not_run",
      rollbackReference: null
    });
    expect(validateExecutionAuthorityLedgerProjection(previewOnlyProjection).currentStatus).toBe("preview_only");
    expect(() => validateExecutionAuthorityLedgerProjection(misleadingReadyProjection)).toThrow(
      /ready_for_execution projection requires executable latest record/u
    );
  });

  it("rejects unbounded authority records and projections with broken ledger links", () => {
    const unboundedScope = {
      ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE.latestRecord,
      requestedScope: {}
    } satisfies ExecutionAuthorityRecord;
    const unlinkedRecord = {
      ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE.latestRecord,
      boundedAgentOutputId: "bounded_output_missing_from_projection"
    } satisfies ExecutionAuthorityRecord;
    const unlinkedProjection = {
      ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE,
      records: [unlinkedRecord],
      latestRecord: unlinkedRecord
    } satisfies ExecutionAuthorityLedgerProjection;

    expect(executionAuthorityRecordValidationIssues(unboundedScope)).toContain(
      "requestedScope must include at least one workspace, command allowlist, browser target, or file glob boundary"
    );
    expect(() => validateExecutionAuthorityLedgerProjection(unlinkedProjection)).toThrow(
      /must reference a bounded output/u
    );
  });

  it("rejects malformed requested scope boundaries", () => {
    const malformedScope = {
      ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE.latestRecord,
      requestedScope: {
        workspaceRef: " ",
        filePathGlobs: [""],
        maxDurationMs: 0
      }
    } satisfies ExecutionAuthorityRecord;
    const issues = executionAuthorityRecordValidationIssues(malformedScope);

    expect(issues).toEqual(
      expect.arrayContaining([
        "requestedScope.workspaceRef must be a non-empty string when present",
        "requestedScope.filePathGlobs must include non-empty string globs when present",
        "requestedScope.maxDurationMs must be a positive integer when present"
      ])
    );
  });

  it("enforces action-class-specific scope, sandbox, and rollback boundaries", () => {
    const shellWithFileBoundary = {
      ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE.latestRecord,
      actionClass: "shell_command",
      requestedScope: {
        workspaceRef: "workspace_demo_local",
        filePathGlobs: ["packages/**"]
      },
      sandboxBoundary: {
        mode: "workspace_patch",
        networkPolicy: "loopback_only",
        secretPolicy: "no_secret_values"
      },
      rollbackReference: {
        kind: "git_diff_reverse",
        ref: "rollback_diff_phase3_demo_001"
      }
    } satisfies ExecutionAuthorityRecord;
    const issues = executionAuthorityRecordValidationIssues(shellWithFileBoundary);

    expect(issues).toEqual(
      expect.arrayContaining([
        "shell_command authority requires commandAllowlistRef requestedScope",
        "shell_command authority requires maxDurationMs requestedScope",
        "shell_command authority requires command_sandbox sandbox mode",
        "shell_command authority requires command_compensating_action rollback kind"
      ])
    );
  });

  it("rejects approved authority records without approver metadata or with secret-like fields", () => {
    const missingApprover = {
      ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE.latestRecord,
      approver: null
    } satisfies ExecutionAuthorityRecord;
    const secretScope = {
      ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE.latestRecord,
      requestedScope: {
        ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE.latestRecord.requestedScope,
        apiKey: "sk-test-secret-value-000000"
      } as ExecutionAuthorityRecord["requestedScope"]
    } satisfies ExecutionAuthorityRecord;

    expect(executionAuthorityRecordValidationIssues(missingApprover)).toContain(
      "not_run/running/terminal state requires valid approver"
    );
    expect(executionAuthorityRecordValidationIssues(secretScope)).toContain(
      "ExecutionAuthorityRecord must not contain credential or secret values"
    );
  });

  it("rejects blocked projections whose status does not mirror the latest blocked record", () => {
    const statusMismatch = {
      ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE,
      currentStatus: "blocked",
      blockedPreconditions: [
        {
          code: "missing_source",
          message: "Planning source is missing.",
          evidenceRefs: ["block:missing_source"]
        }
      ]
    } satisfies ExecutionAuthorityLedgerProjection;
    const blockReasonMismatch = {
      ...PHASE3_EXECUTION_AUTHORITY_BLOCKED_PROJECTION_FIXTURE,
      blockedPreconditions: [
        {
          code: "missing_preview",
          message: "Different block reason.",
          evidenceRefs: ["block:missing_preview"]
        }
      ]
    } satisfies ExecutionAuthorityLedgerProjection;

    expect(() => validateExecutionAuthorityLedgerProjection(statusMismatch)).toThrow(
      /blocked projection requires latest record to be blocked/u
    );
    expect(() => validateExecutionAuthorityLedgerProjection(blockReasonMismatch)).toThrow(
      /blockedPreconditions must match latest record blockReasons/u
    );
  });

  it("rejects stale blockers or divergent latest records in non-blocked projections", () => {
    const staleBlockers = {
      ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE,
      blockedPreconditions: [
        {
          code: "missing_source",
          message: "Planning source is missing.",
          evidenceRefs: ["block:missing_source"]
        }
      ]
    } satisfies ExecutionAuthorityLedgerProjection;
    const divergentLatestRecord = {
      ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE.latestRecord,
      auditRefs: ["audit_phase3_demo_authority_mutated_001"]
    } satisfies ExecutionAuthorityRecord;
    const divergentLatestProjection = {
      ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE,
      latestRecord: divergentLatestRecord
    } satisfies ExecutionAuthorityLedgerProjection;

    expect(() => validateExecutionAuthorityLedgerProjection(staleBlockers)).toThrow(
      /non-blocked projection must not include blockedPreconditions/u
    );
    expect(() => validateExecutionAuthorityLedgerProjection(divergentLatestProjection)).toThrow(
      /latestRecord must exactly match the last authority record/u
    );
  });

  it("rejects authority ledger summary drift from the canonical status summary", () => {
    const summaryDriftProjection = {
      ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE,
      summary: "Stale copy that no longer matches ready_for_execution semantics."
    } satisfies ExecutionAuthorityLedgerProjection;

    expect(() => validateExecutionAuthorityLedgerProjection(summaryDriftProjection)).toThrow(
      /projection summary must match the canonical currentStatus summary/u
    );
  });

  it("rejects unbounded ready-for-preview agent outputs", () => {
    const unboundedReadyOutput = {
      ...PHASE3_BOUNDED_OUTPUT_READY_FIXTURE,
      sourceRefs: [],
      proposedActionPreviewRefs: [],
      requiredApprovals: [],
      evidenceRefs: [],
      noExecutionPolicy: "preview_only"
    } satisfies BoundedAgentOutputRecord;

    expect(() => validateBoundedAgentOutputRecord(unboundedReadyOutput)).toThrow(
      /ready_for_preview requires sourceRefs/u
    );
  });
});
