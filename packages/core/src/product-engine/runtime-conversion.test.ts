import { describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
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
          runtimeAdapterVersion: "codex-app-server-preview-v1",
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
});
