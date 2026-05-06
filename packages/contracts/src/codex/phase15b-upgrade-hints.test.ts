import { describe, expect, it } from "vitest";
import {
  PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION,
  type CodexPreviewArtifactPayload,
  type Phase15bUpgradeHints,
  validatePhase15bUpgradeHints
} from "./index";

function phase15bHintsFixture(overrides: Partial<Phase15bUpgradeHints> = {}): Phase15bUpgradeHints {
  return {
    executionIntent: {
      candidateActionType: "shell_command",
      targetSurface: "local workspace verification",
      nonExecutingSummary: "Capture the command that Phase 3 may run after explicit approval."
    },
    approvalRequirements: [
      {
        approvalType: "task_level_execution",
        reason: "A later phase must ask before running the verification command.",
        scope: "pnpm verify in the isolated implementation worktree",
        requiredActor: "user",
        reconfirmRule: "Reconfirm when the base ref, command, or cwd changes."
      }
    ],
    sandboxRequirements: {
      isolatedWorktreeRequired: true,
      browserSandboxRequired: false,
      networkMode: "offline",
      commandAllowlist: ["pnpm verify"],
      secretGrantBoundary: "No secret values; OS secret refs only if a future phase requires them.",
      environmentPolicy: "Use the project-local workspace with deterministic env vars.",
      logCaptureRequired: true
    },
    rollbackReference: {
      baseRef: "origin/main",
      diffRef: "runtime_artifact_storage.diff",
      rollbackNote: "Discard the preview artifact or revert the future implementation commit.",
      reversible: true,
      cleanupExpectation: "Remove generated logs and temporary worktree after inspection."
    },
    expectedEvidence: {
      tests: ["pnpm verify"],
      smokeChecks: ["pnpm smoke:e2e"],
      artifactPaths: ["apps/sidecar/src/e2e-dry-run.fixture.ts"],
      manualInspection: ["Confirm readiness labels never say executed."],
      expectedLogs: ["phase15b readiness metadata exported"]
    },
    riskNormalization: {
      riskLevel: "medium",
      blockedActionType: "shell_command",
      blockReason: "Phase 1.5B stores command readiness only.",
      userVisibleAction: "Ask for task-level execution approval in Phase 3.",
      escalationTarget: "Phase 3 safe-execution policy review"
    },
    sourceRefs: [
      {
        kind: "preview_artifact",
        refId: "runtime_artifact_storage",
        label: "ImplementationPlanPreviewArtifact"
      },
      {
        kind: "research_run",
        refId: "research_run_storage",
        label: "ResearchRunProjection"
      },
      {
        kind: "evidence_matrix",
        refId: "evidence_matrix_storage",
        label: "EvidenceMatrix"
      },
      {
        kind: "research_allowlist",
        refId: "research_allowlist_storage",
        label: "ResearchAllowlistProjection"
      },
      {
        kind: "research_disclosure_log",
        refId: "research_disclosure_storage",
        label: "ResearchDisclosureLogProjection"
      }
    ],
    createdAt: "2026-05-06T00:00:00.000Z",
    schemaVersion: PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION,
    ...overrides
  };
}

describe("Phase15bUpgradeHints contract", () => {
  it("validates structured readiness metadata with source refs and no execution permission", () => {
    const hints = validatePhase15bUpgradeHints(phase15bHintsFixture());

    expect(hints).toMatchObject({
      executionIntent: {
        candidateActionType: "shell_command",
        nonExecutingSummary: expect.stringContaining("after explicit approval")
      },
      approvalRequirements: [
        expect.objectContaining({
          approvalType: "task_level_execution",
          requiredActor: "user"
        })
      ],
      sandboxRequirements: {
        isolatedWorktreeRequired: true,
        networkMode: "offline",
        commandAllowlist: ["pnpm verify"]
      },
      riskNormalization: {
        blockedActionType: "shell_command"
      },
      schemaVersion: PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION
    });
    expect(hints.sourceRefs.map((sourceRef) => sourceRef.kind)).toEqual([
      "preview_artifact",
      "research_run",
      "evidence_matrix",
      "research_allowlist",
      "research_disclosure_log"
    ]);
  });

  it("keeps CodexPreviewArtifactPayload typed to structured Phase15bUpgradeHints", () => {
    const payload = {
      title: "Implementation readiness preview",
      body: "Readiness metadata only; no action was executed.",
      targetObject: "PlanningNote",
      sourceRefs: ["runtime_artifact_storage"],
      phase15bUpgradeHints: phase15bHintsFixture()
    } satisfies CodexPreviewArtifactPayload;

    expect(validatePhase15bUpgradeHints(payload.phase15bUpgradeHints)).toMatchObject({
      schemaVersion: PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION
    });
  });

  it("rejects legacy open-ended records without required field families", () => {
    expect(() =>
      validatePhase15bUpgradeHints({
        readiness: true,
        sourceRefs: ["runtime_artifact_storage"],
        schemaVersion: PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION
      })
    ).toThrow("unsupported keys");
  });

  it("rejects fields that imply active execution or delegation", () => {
    expect(() =>
      validatePhase15bUpgradeHints({
        ...phase15bHintsFixture(),
        sandboxRequirements: {
          ...phase15bHintsFixture().sandboxRequirements,
          canExecute: true
        }
      })
    ).toThrow("canExecute is forbidden");

    expect(() =>
      validatePhase15bUpgradeHints({
        ...phase15bHintsFixture(),
        approvalRequirements: [
          {
            ...phase15bHintsFixture().approvalRequirements[0],
            delegationActive: true
          }
        ]
      })
    ).toThrow("delegationActive is forbidden");
  });

  it("rejects non-ISO timestamps and internally inconsistent blocked action metadata", () => {
    expect(() =>
      validatePhase15bUpgradeHints({
        ...phase15bHintsFixture(),
        createdAt: "May 6 2026"
      })
    ).toThrow("createdAt must be an ISO UTC timestamp");

    expect(() =>
      validatePhase15bUpgradeHints({
        ...phase15bHintsFixture(),
        createdAt: "2026-02-30T00:00:00.000Z"
      })
    ).toThrow("createdAt must be an ISO UTC timestamp");

    expect(() =>
      validatePhase15bUpgradeHints({
        ...phase15bHintsFixture(),
        riskNormalization: {
          ...phase15bHintsFixture().riskNormalization,
          blockedActionType: "browser_action"
        }
      })
    ).toThrow("candidateActionType must match riskNormalization.blockedActionType");
  });

  it("requires source refs to retain research and audit lineage", () => {
    expect(() =>
      validatePhase15bUpgradeHints({
        ...phase15bHintsFixture(),
        sourceRefs: []
      })
    ).toThrow("sourceRefs must be a non-empty array");

    expect(() =>
      validatePhase15bUpgradeHints({
        ...phase15bHintsFixture(),
        sourceRefs: [{ kind: "research_run", label: "missing id" }]
      })
    ).toThrow("sourceRefs[0].refId");
  });
});
