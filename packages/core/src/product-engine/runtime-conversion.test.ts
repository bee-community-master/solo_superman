import { describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION,
  type CommandId,
  type CorrelationId,
  type ProjectionVersion,
  type ProductEngineCommand,
  type ProductEngineStateSnapshot,
  type ProjectId,
  type RuntimeArtifactId,
  type SessionId,
  type StateVersion
} from "@solo-superman/contracts";
import { createInitialProductEngineState, reduceProductEngineCommand } from "./index";

function phase15bHintsFixture() {
  return {
    executionIntent: {
      candidateActionType: "shell_command",
      targetSurface: "local workspace verification",
      nonExecutingSummary: "Readiness metadata only; no command was executed."
    },
    approvalRequirements: [
      {
        approvalType: "task_level_execution",
        reason: "A future phase must ask before running the command.",
        scope: "pnpm verify in an isolated worktree",
        requiredActor: "user",
        reconfirmRule: "Reconfirm if cwd, command, or base ref changes."
      }
    ],
    sandboxRequirements: {
      isolatedWorktreeRequired: true,
      browserSandboxRequired: false,
      networkMode: "offline",
      commandAllowlist: ["pnpm verify"],
      secretGrantBoundary: "No secret values are required.",
      environmentPolicy: "Use the project-local workspace and capture logs.",
      logCaptureRequired: true
    },
    rollbackReference: {
      baseRef: "origin/main",
      rollbackNote: "Discard preview metadata or revert the later implementation commit.",
      reversible: true,
      cleanupExpectation: "Remove temporary logs and worktree after inspection."
    },
    expectedEvidence: {
      tests: ["pnpm verify"],
      smokeChecks: ["pnpm smoke:e2e"],
      artifactPaths: ["apps/sidecar/src/e2e-dry-run.fixture.ts"],
      manualInspection: ["Confirm labels say readiness or preview."],
      expectedLogs: ["phase15b readiness metadata exported"]
    },
    riskNormalization: {
      riskLevel: "medium",
      blockedActionType: "shell_command",
      blockReason: "Phase 1.5B must not execute shell commands.",
      userVisibleAction: "Request explicit task-level execution approval later.",
      escalationTarget: "Phase 3 safe-execution policy"
    },
    sourceRefs: [
      {
        kind: "preview_artifact",
        refId: "runtime_artifact_storage"
      }
    ],
    createdAt: "2026-05-06T00:00:00.000Z",
    schemaVersion: PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION
  };
}

function runtimeConversionState(
  projectId: ProjectId,
  sessionId: SessionId,
  artifactId: RuntimeArtifactId
): ProductEngineStateSnapshot {
  return {
    ...createInitialProductEngineState(projectId, sessionId),
    stateVersion: 3 as StateVersion,
    runtimeState: {
      kind: "RuntimeActivityProjection",
      version: 3 as ProjectionVersion,
      effects: [],
      runtimeStatus: "available",
      runtimeArtifacts: [
        {
          artifactId,
          turnPurpose: "implementation_plan_preview",
          kind: "ImplementationPlanPreviewArtifact",
          applyPolicy: "note_only",
          status: "preview_ready",
          source: "protocol_fixture",
          targetObject: "PlanningNote",
          summary: "Implementation plan preview ready",
          payload: {
            title: "Implementation plan preview ready",
            body: "Preview only.",
            targetObject: "PlanningNote",
            sourceRefs: ["spec_current"]
          },
          sourceRefs: ["spec_current"],
          contextHash: "ctx_runtime_conversion",
          runtimeAdapterVersion: "codex-sdk-runtime-v1",
          createdAt: "2026-05-05T00:00:00.000Z",
          schemaVersion: CONTRACT_SCHEMA_VERSION
        }
      ]
    }
  };
}

function runtimeConversionCommand(
  projectId: ProjectId,
  sessionId: SessionId,
  artifactId: RuntimeArtifactId,
  payload: ProductEngineCommand["payload"]
): ProductEngineCommand {
  return {
    commandId: "cmd_runtime_conversion" as CommandId,
    commandType: "ConvertRuntimeArtifact",
    projectId,
    sessionId,
    actor: "user",
    issuedAt: "2026-05-05T00:00:01.000Z",
    idempotencyKey: "ConvertRuntimeArtifact:runtime_conversion",
    expectedStateVersion: 3 as StateVersion,
    causationId: null,
    correlationId: "corr_runtime_conversion" as CorrelationId,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    payload: {
      artifactId,
      ...payload
    }
  };
}

function runtimePreviewCommand(
  projectId: ProjectId,
  sessionId: SessionId,
  payload: ProductEngineCommand["payload"]
): ProductEngineCommand {
  return {
    commandId: "cmd_runtime_preview" as CommandId,
    commandType: "CreateRuntimePreview",
    projectId,
    sessionId,
    actor: "effect_executor",
    issuedAt: "2026-05-05T00:00:01.000Z",
    idempotencyKey: "CreateRuntimePreview:runtime_preview",
    expectedStateVersion: 0 as StateVersion,
    causationId: null,
    correlationId: "corr_runtime_preview" as CorrelationId,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    payload: {
      source: "protocol_fixture",
      turnPurpose: "implementation_plan_preview",
      contextHash: "ctx_runtime_preview",
      prompt: "Preview a future implementation plan.",
      summary: "Implementation plan preview ready",
      body: "Preview only.",
      targetObject: "PlanningNote",
      sourceRefs: ["spec_current"],
      artifactKind: "ImplementationPlanPreviewArtifact",
      applyPolicy: "note_only",
      ...payload
    }
  };
}

describe("PR-07 runtime artifact conversion reducer", () => {
  it("preserves the requested non-blocking conversion target in the deterministic output", () => {
    const projectId = "proj_runtime_conversion" as ProjectId;
    const sessionId = "sess_runtime_conversion" as SessionId;
    const artifactId = "runtime_artifact_conversion" as RuntimeArtifactId;
    const state = runtimeConversionState(projectId, sessionId, artifactId);
    const command = runtimeConversionCommand(projectId, sessionId, artifactId, {
      target: "planning_note"
    });

    const reduction = reduceProductEngineCommand(command, state);

    expect(reduction.accepted).toBe(true);
    expect(reduction.events[0]?.payload).toMatchObject({
      conversionStatus: "preview_only",
      target: "planning_note"
    });
    expect(reduction.deterministicOutputs[0]?.payload).toMatchObject({
      conversionStatus: "preview_only",
      target: "planning_note"
    });
  });

  it("rejects conversion requests without an explicit target", () => {
    const projectId = "proj_runtime_conversion" as ProjectId;
    const sessionId = "sess_runtime_conversion" as SessionId;
    const artifactId = "runtime_artifact_conversion" as RuntimeArtifactId;
    const state = runtimeConversionState(projectId, sessionId, artifactId);
    const command = runtimeConversionCommand(projectId, sessionId, artifactId, {});

    const reduction = reduceProductEngineCommand(command, state);

    expect(reduction.accepted).toBe(false);
    expect(reduction.rejectionReason).toMatchObject({
      code: "VALIDATION_FAILED",
      message: "ConvertRuntimeArtifact requires target."
    });
  });

  it("rejects manual blocked conversions without blocked action taxonomy", () => {
    const projectId = "proj_runtime_conversion" as ProjectId;
    const sessionId = "sess_runtime_conversion" as SessionId;
    const artifactId = "runtime_artifact_conversion" as RuntimeArtifactId;
    const state = runtimeConversionState(projectId, sessionId, artifactId);
    const command = runtimeConversionCommand(projectId, sessionId, artifactId, {
      target: "blocked_action",
      blockReason: "Manual safety review blocked this preview."
    });

    const reduction = reduceProductEngineCommand(command, state);

    expect(reduction.accepted).toBe(false);
    expect(reduction.rejectionReason).toMatchObject({
      code: "VALIDATION_FAILED",
      message: "Blocked runtime artifact conversion requires blockedActionType taxonomy."
    });
  });

  it("rejects malformed Phase 1.5B upgrade hints as command validation failures", () => {
    const projectId = "proj_runtime_preview" as ProjectId;
    const sessionId = "sess_runtime_preview" as SessionId;
    const state = createInitialProductEngineState(projectId, sessionId);
    const command = runtimePreviewCommand(projectId, sessionId, {
      phase15bUpgradeHints: {
        canExecute: true
      }
    });

    const reduction = reduceProductEngineCommand(command, state);

    expect(reduction.accepted).toBe(false);
    expect(reduction.rejectionReason).toMatchObject({
      code: "VALIDATION_FAILED",
      message: expect.stringContaining("phase15bUpgradeHints is invalid")
    });
  });

  it("rejects Phase 1.5B upgrade hints on unsupported runtime artifact kinds", () => {
    const projectId = "proj_runtime_preview" as ProjectId;
    const sessionId = "sess_runtime_preview" as SessionId;
    const state = createInitialProductEngineState(projectId, sessionId);
    const command = runtimePreviewCommand(projectId, sessionId, {
      turnPurpose: "question_generation",
      targetObject: "QuestionBatch",
      artifactKind: "QuestionBatchArtifact",
      applyPolicy: "conditional_auto_apply",
      phase15bUpgradeHints: phase15bHintsFixture()
    });

    const reduction = reduceProductEngineCommand(command, state);

    expect(reduction.accepted).toBe(false);
    expect(reduction.rejectionReason).toMatchObject({
      code: "VALIDATION_FAILED",
      message: expect.stringContaining("phase15bUpgradeHints may only be attached")
    });
  });

  it("rejects Phase 1.5B upgrade hints that do not match the blocked action artifact", () => {
    const projectId = "proj_runtime_preview" as ProjectId;
    const sessionId = "sess_runtime_preview" as SessionId;
    const state = createInitialProductEngineState(projectId, sessionId);
    const browserActionHints = {
      ...phase15bHintsFixture(),
      executionIntent: {
        ...phase15bHintsFixture().executionIntent,
        candidateActionType: "browser_action"
      },
      riskNormalization: {
        ...phase15bHintsFixture().riskNormalization,
        blockedActionType: "browser_action"
      }
    };
    const command = runtimePreviewCommand(projectId, sessionId, {
      blockedActionType: "shell_command",
      blockedActionReason: "Phase 1.5B records readiness only.",
      phase15bUpgradeHints: browserActionHints
    });

    const reduction = reduceProductEngineCommand(command, state);

    expect(reduction.accepted).toBe(false);
    expect(reduction.rejectionReason).toMatchObject({
      code: "VALIDATION_FAILED",
      message: expect.stringContaining("phase15bUpgradeHints action type must match")
    });
  });
});
