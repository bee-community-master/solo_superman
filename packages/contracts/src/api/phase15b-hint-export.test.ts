import { describe, expect, it } from "vitest";
import {
  PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION,
  type Phase15bUpgradeHints
} from "../codex";
import type {
  ProjectId,
  ProjectionVersion,
  RuntimeArtifactId,
  SchemaVersion,
  SessionId
} from "../ids";
import type {
  Phase15bUpgradeHintExportDto,
  PublicPhase15bUpgradeHintSourceRef
} from "./phase15b-hint-export";

type PublicSourceRefHasLabel = "label" extends keyof PublicPhase15bUpgradeHintSourceRef ? true : false;

function phase15bHintsFixture(): Phase15bUpgradeHints {
  return {
    executionIntent: {
      candidateActionType: "shell_command",
      targetSurface: "local verification command",
      nonExecutingSummary: "Future execution readiness metadata only."
    },
    approvalRequirements: [
      {
        approvalType: "task_level_execution",
        reason: "User must approve before any future shell execution.",
        scope: "pnpm verify",
        requiredActor: "user",
        reconfirmRule: "Ask again immediately before execution."
      }
    ],
    sandboxRequirements: {
      isolatedWorktreeRequired: true,
      browserSandboxRequired: false,
      networkMode: "offline",
      commandAllowlist: ["pnpm verify"],
      secretGrantBoundary: "No secret values required.",
      environmentPolicy: "Use local-only workspace state.",
      logCaptureRequired: true
    },
    rollbackReference: {
      baseRef: "main",
      rollbackNote: "Discard readiness metadata if no later approval is granted.",
      reversible: true,
      cleanupExpectation: "Remove temporary logs."
    },
    expectedEvidence: {
      tests: ["pnpm verify"],
      smokeChecks: ["GET /phase15b-upgrade-hints/export"],
      artifactPaths: ["packages/contracts/src/api/phase15b-hint-export.ts"],
      manualInspection: ["Confirm export labels remain readiness metadata."],
      expectedLogs: ["phase15b readiness metadata exported"]
    },
    riskNormalization: {
      riskLevel: "medium",
      blockedActionType: "shell_command",
      blockReason: "Shell execution is blocked in Phase 1.5B.",
      userVisibleAction: "Review and approve later in safe-execution phase.",
      escalationTarget: "phase3_safe_execution"
    },
    sourceRefs: [
      {
        kind: "preview_artifact",
        refId: "runtime_artifact_export_contract"
      },
      {
        kind: "blocked_action",
        refId: "runtime_artifact_export_contract:shell_command"
      }
    ],
    createdAt: "2026-05-06T00:00:00.000Z",
    schemaVersion: PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION
  };
}

describe("Phase 1.5B hint export DTO", () => {
  it("keeps public source refs label-free at the DTO type boundary", () => {
    const publicSourceRefHasLabel: PublicSourceRefHasLabel = false;

    expect(publicSourceRefHasLabel).toBe(false);
  });

  it("serializes approval, sandbox, rollback, evidence, risk, and source traceability without private payloads", () => {
    const dto = {
      kind: "Phase15bUpgradeHintExport",
      projectionKind: "Phase15bUpgradeHintProjection",
      projectId: "proj_phase15b_export_contract" as ProjectId,
      version: 1 as ProjectionVersion,
      generatedAt: "2026-05-06T00:00:00.000Z",
      exportedAt: "2026-05-06T00:00:00.000Z",
      stale: false,
      refetchUrl: "/api/v1/projects/proj_phase15b_export_contract/phase15b-upgrade-hints",
      exportUrl: "/api/v1/projects/proj_phase15b_export_contract/phase15b-upgrade-hints/export",
      format: "json",
      pendingEffectSummary: {
        totalPending: 0,
        byType: {},
        visibleLabel: "No execution effects are pending."
      },
      metadataLabel: "readiness_preview_handoff_metadata",
      privatePayloadPolicy: "public_safe_metadata_only",
      noExecution: {
        semantic: "metadata_only_no_execution",
        productActionPerformed: false,
        delegationState: "not_active",
        credentialValueState: "omitted"
      },
      records: [
        {
          hintId: "phase15b_hint:runtime_artifact_export_contract",
          projectId: "proj_phase15b_export_contract",
          sessionId: "sess_phase15b_export_contract" as SessionId,
          artifactId: "runtime_artifact_export_contract" as RuntimeArtifactId,
          artifactKind: "ImplementationPlanPreviewArtifact",
          metadataLabel: "readiness_preview_handoff_metadata",
          privatePayloadPolicy: "public_safe_metadata_only",
          noExecution: {
            semantic: "metadata_only_no_execution",
            productActionPerformed: false,
            delegationState: "not_active",
            credentialValueState: "omitted"
          },
          sourceRefLabelPolicy: "labels_omitted_to_avoid_private_payload_export",
          hints: phase15bHintsFixture(),
          createdAt: "2026-05-06T00:00:00.000Z",
          schemaVersion: "solo-superman.contracts.v1" as SchemaVersion
        }
      ],
      exportPolicy: {
        privatePayloadsIncluded: false,
        credentialValuesIncluded: false,
        sourceRefLabelsIncluded: false,
        reason: "phase15b_exports_are_public_safe_readiness_metadata_only"
      }
    } satisfies Phase15bUpgradeHintExportDto;
    const serialized = JSON.stringify(dto);

    expect(dto.records[0]?.hints).toMatchObject({
      approvalRequirements: [expect.objectContaining({ approvalType: "task_level_execution" })],
      sandboxRequirements: expect.objectContaining({ commandAllowlist: ["pnpm verify"] }),
      rollbackReference: expect.objectContaining({ baseRef: "main" }),
      expectedEvidence: expect.objectContaining({ tests: ["pnpm verify"] }),
      riskNormalization: expect.objectContaining({ blockedActionType: "shell_command" }),
      sourceRefs: expect.arrayContaining([
        expect.objectContaining({ kind: "preview_artifact", refId: "runtime_artifact_export_contract" })
      ])
    });
    expect(dto.exportPolicy.privatePayloadsIncluded).toBe(false);
    expect(dto.noExecution.semantic).toBe("metadata_only_no_execution");
    expect(serialized).not.toContain("privateCustomerNames");
    expect(serialized).not.toContain("sk-secret");
  });
});
