import { describe, expect, it } from "vitest";
import { PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION } from "@solo-superman/contracts";
import type {
  ConfidenceCompletionProjection,
  DecisionEvidencePackId,
  DecisionQueueProjection,
  FounderBriefProjection,
  LivingSpecProjection,
  Phase15bUpgradeHintProjection,
  ProjectionVersion,
  ProjectId,
  QueueItemId,
  ResearchEvidenceProjection,
  ResearchResultId,
  ResearchTaskId,
  SessionId,
  SessionShellProjection,
  StateVersion
} from "@solo-superman/contracts";
import { buildPlanningHandoffRequest } from "./phase2-planning-handoff-request";

const PROJECT_ID = "proj_web_handoff" as ProjectId;
const SESSION_ID = "sess_web_handoff" as SessionId;
const RESEARCH_TASK_ID = "research_task_web" as ResearchTaskId;
const RESEARCH_RESULT_ID = "research_result_web" as ResearchResultId;
const EVIDENCE_PACK_ID = "evidence_pack_web" as DecisionEvidencePackId;
const QUEUE_ITEM_ID = "queue_web_handoff" as QueueItemId;

function sessionFixture(): SessionShellProjection {
  return {
    kind: "SessionShellProjection",
    projectId: PROJECT_ID,
    sessionId: SESSION_ID,
    version: 12 as ProjectionVersion,
    phase: "validation"
  };
}

function specFixture(): LivingSpecProjection {
  return {
    kind: "LivingSpecProjection",
    sessionId: SESSION_ID,
    version: 13 as ProjectionVersion,
    title: "Source-driven Planning Handoff",
    sections: ["Problem", "Evidence", "Build slice"],
    sectionCount: 3,
    approvalStatus: "approved"
  };
}

function confidenceFixture(): ConfidenceCompletionProjection {
  return {
    kind: "ConfidenceCompletionProjection",
    sessionId: SESSION_ID,
    version: 15 as ProjectionVersion,
    compositeScore: 91,
    readinessLabel: "spec_ready",
    axes: [],
    scoreBreakdown: {
      sectionCompleteness: 95,
      questionDebtResolution: 90,
      evidenceQuality: 88,
      decisionApproval: 90,
      consistencyAndConflict: 92
    },
    gates: [],
    topRisks: ["Retain manual verification gap"],
    topRiskCards: [
      {
        riskId: "risk_web_verification",
        title: "Retain manual verification gap",
        severity: "medium",
        sourceRefs: [],
        nextValidationAction: "Verify the generated handoff before execution planning."
      }
    ],
    nextBestActions: ["Run Planning Handoff gate"],
    completionCandidate: {
      status: "candidate",
      summary: "Spec and evidence are ready for handoff.",
      gateFailures: [],
      ifStopNowArtifact: {
        title: "Candidate",
        summary: "Ready for handoff.",
        knownRisks: [],
        nextValidationActions: []
      }
    }
  };
}

function queueFixture(): DecisionQueueProjection {
  return {
    kind: "DecisionQueueProjection",
    sessionId: SESSION_ID,
    version: 16 as ProjectionVersion,
    active: [],
    next: [],
    blocked: [],
    deferred: [
      {
        queueItemId: QUEUE_ITEM_ID,
        title: "Accepted research queue card",
        state: "resolved",
        cardType: "research_review",
        researchTaskId: RESEARCH_TASK_ID,
        evidencePackId: EVIDENCE_PACK_ID,
        blocksPlanning: true,
        terminalOutcome: "approved"
      }
    ]
  };
}

function researchFixture(): ResearchEvidenceProjection {
  return {
    kind: "ResearchEvidenceProjection",
    version: 17 as ProjectionVersion,
    taskIds: [RESEARCH_TASK_ID],
    tasks: [
      {
        researchTaskId: RESEARCH_TASK_ID,
        sessionId: SESSION_ID,
        objective: "Validate handoff evidence.",
        routeOutcome: "research_needed",
        impact: "high",
        status: "evidence_ready",
        createdAt: "2026-05-08T00:00:00.000Z"
      }
    ],
    results: [
      {
        researchResultId: RESEARCH_RESULT_ID,
        researchTaskId: RESEARCH_TASK_ID,
        resultSummary: "Evidence supports the handoff.",
        sourceReliability: "high",
        claim: "Planning Handoff is ready.",
        decisionContext: "Planning Handoff",
        importedAt: "2026-05-08T00:01:00.000Z"
      }
    ],
    evidenceMatrices: [],
    evidencePacks: [
      {
        evidencePackId: EVIDENCE_PACK_ID,
        researchTaskId: RESEARCH_TASK_ID,
        researchResultId: RESEARCH_RESULT_ID,
        claim: "Planning Handoff is ready.",
        decisionContext: "Planning Handoff",
        sourceReliability: "high",
        retrievedAt: "2026-05-08T00:02:00.000Z",
        gateStatus: "accepted",
        gateChecks: [],
        proEvidenceItemIds: [],
        conEvidenceItemIds: [],
        uncertaintyItemIds: [],
        limitationRefs: [],
        implicationScope: "Phase 2 Planning Handoff",
        createdAt: "2026-05-08T00:03:00.000Z"
      }
    ],
    reviewCards: [
      {
        cardId: QUEUE_ITEM_ID,
        researchTaskId: RESEARCH_TASK_ID,
        evidencePackId: EVIDENCE_PACK_ID,
        cardType: "research_review",
        title: "Accepted research queue card",
        state: "resolved",
        impact: "high",
        gateStatus: "accepted",
        availableOutcomes: ["approved", "risk_accepted"],
        terminalOutcome: "approved",
        blocksPlanning: true,
        recoveryActions: []
      }
    ],
    knownRisks: ["Known research residual risk"],
    nextValidationActions: [],
    proConBalanceStatus: "balanced"
  };
}

function founderBriefFixture(): FounderBriefProjection {
  return {
    kind: "FounderBriefProjection",
    sessionId: SESSION_ID,
    version: 18 as ProjectionVersion,
    exportReady: true,
    problemCustomerValue: "Source-driven handoff for solo founders",
    topDecisions: [],
    knownRisks: ["Founder risk stays visible"],
    nextValidationActions: [],
    briefSections: [],
    ifStopNowArtifact: {
      title: "Founder Brief",
      summary: "Ready for handoff.",
      knownRisks: [],
      nextValidationActions: []
    },
    exportMetadata: {
      format: "markdown",
      filename: "founder-brief.md",
      preparedAt: "2026-05-08T00:04:00.000Z",
      writePolicy: "metadata_only_no_file_write",
      blockedSideEffects: ["file_write"]
    }
  };
}

function phase15bFixture(): Phase15bUpgradeHintProjection {
  return {
    kind: "Phase15bUpgradeHintProjection",
    projectionKind: "Phase15bUpgradeHintProjection",
    projectId: PROJECT_ID,
    version: 19 as ProjectionVersion,
    generatedAt: "2026-05-08T00:05:00.000Z",
    stale: false,
    refetchUrl: "/api/v1/projects/proj_web_handoff/phase15b-upgrade-hints",
    exportUrl: "/api/v1/projects/proj_web_handoff/phase15b-upgrade-hints/export",
    pendingEffectSummary: {
      totalPending: 0,
      byType: {},
      visibleLabel: "No persisted effects are pending."
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
        hintId: "hint_web",
        projectId: PROJECT_ID,
        sessionId: SESSION_ID,
        artifactId: "runtime_artifact_web_phase15b",
        artifactKind: "BlockedActionArtifact",
        metadataLabel: "readiness_preview_handoff_metadata",
        privatePayloadPolicy: "public_safe_metadata_only",
        noExecution: {
          semantic: "metadata_only_no_execution",
          productActionPerformed: false,
          delegationState: "not_active",
          credentialValueState: "omitted"
        },
        sourceRefLabelPolicy: "labels_omitted_to_avoid_private_payload_export",
        hints: {
          executionIntent: {
            candidateActionType: "shell_command",
            targetSurface: "local verification",
            nonExecutingSummary: "Preview only."
          },
          approvalRequirements: [],
          sandboxRequirements: {
            isolatedWorktreeRequired: true,
            browserSandboxRequired: false,
            networkMode: "offline",
            commandAllowlist: ["pnpm verify"],
            secretGrantBoundary: "No credential values are required.",
            environmentPolicy: "Local only.",
            logCaptureRequired: true
          },
          rollbackReference: {
            baseRef: "origin/main",
            rollbackNote: "Discard preview metadata.",
            reversible: true,
            cleanupExpectation: "Remove preview logs."
          },
          expectedEvidence: {
            tests: ["pnpm verify"],
            smokeChecks: [],
            artifactPaths: [],
            manualInspection: [],
            expectedLogs: []
          },
          riskNormalization: {
            riskLevel: "medium",
            blockedActionType: "shell_command",
            blockReason: "Shell execution remains blocked.",
            userVisibleAction: "Ask before execution.",
            escalationTarget: "phase3_safe_execution"
          },
          sourceRefs: [],
          createdAt: "2026-05-08T00:05:00.000Z",
          schemaVersion: PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION
        },
        createdAt: "2026-05-08T00:05:00.000Z",
        schemaVersion: PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION
      }
    ]
  };
}

describe("web Planning Handoff request builder", () => {
  it("builds source-driven local gate requests without execution payload fields", () => {
    const request = buildPlanningHandoffRequest({
      session: sessionFixture(),
      spec: specFixture(),
      queue: queueFixture(),
      research: researchFixture(),
      confidence: confidenceFixture(),
      founderBrief: founderBriefFixture(),
      phase15bReadiness: phase15bFixture(),
      expectedStateVersion: 21 as StateVersion
    });

    expect(request).toMatchObject({
      sessionId: SESSION_ID,
      expectedStateVersion: 21,
      requestedScope: {
        productSlice: "Source-driven Planning Handoff",
        userFacingJourneyLabel: "Planning-ready"
      }
    });
    expect(request.sourceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceType: "spec_version", sourceId: `living_spec:${SESSION_ID}:13` }),
        expect.objectContaining({ sourceType: "founder_brief", sourceId: `founder_brief:${SESSION_ID}:18` }),
        expect.objectContaining({ sourceType: "decision_linked_evidence_pack", sourceId: "evidence_pack_web" }),
        expect.objectContaining({ sourceType: "research_updated_queue_item", sourceId: QUEUE_ITEM_ID }),
        expect.objectContaining({ sourceType: "known_risk", sourceId: "risk_web_verification" }),
        expect.objectContaining({ sourceType: "phase15b_hint", sourceId: "runtime_artifact_web_phase15b" })
      ])
    );
    expect(new Set(request.sourceRefs.map((ref) => `${ref.sourceType}:${ref.sourceId}`)).size).toBe(
      request.sourceRefs.length
    );
    expect(JSON.stringify(request)).not.toMatch(/shellCommand|filePatch|browserAction|deployTarget|credentialValue/iu);
  });

  it("keeps the local gate POST valid before source projections are loaded so ProductEngine can emit a blocker", () => {
    const request = buildPlanningHandoffRequest({
      session: sessionFixture(),
      spec: null,
      queue: null,
      research: null,
      confidence: null,
      founderBrief: null,
      phase15bReadiness: null,
      expectedStateVersion: 12 as StateVersion
    });

    expect(request.sourceRefs).toEqual([
      {
        sourceType: "activity_event",
        sourceId: `web_planning_handoff_gate:${SESSION_ID}:12`,
        sourceLabel: "Web local gate trigger attempted before source projections were loaded.",
        required: false,
        stale: false
      }
    ]);
  });
});
