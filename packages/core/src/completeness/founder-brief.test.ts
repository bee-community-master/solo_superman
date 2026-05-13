import { describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  type CommandId,
  type CorrelationId,
  type DecisionId,
  type ProjectId,
  type ProjectionVersion,
  type SessionId,
  type StateVersion
} from "@solo-superman/contracts";
import { createInitialProductEngineState, reduceProductEngineCommand } from "../product-engine";
import { buildConfidenceCompletionProjection, buildFounderBriefProjection } from "./index";

const projectId = "proj_founder_brief_test" as ProjectId;
const sessionId = "sess_founder_brief_test" as SessionId;
const correlationId = "corr_founder_brief_test" as CorrelationId;
const preparedAt = "2026-05-05T00:00:00.000Z";

function stateWithKnownRisk() {
  return {
    ...createInitialProductEngineState(projectId, sessionId),
    stateVersion: 7 as StateVersion,
    project: {
      projectId,
      privacyMode: "local_only" as const,
      projectPurposeMode: "business" as const,
      projectPurposeModeLabel: "사업화 검증 중심",
      projectPurposeModeReason: "Test fixture",
      projectPurposeModeAudit: [],
      businessCriticIntensity: "balanced" as const,
      businessCriticIntensitySelectionStatus: "confirmed" as const,
      businessCriticIntensityLabel: "균형형 사업 검증",
      businessCriticIntensityEffect: "주요 decision group마다 최소 1개의 반대/비판 질문을 유지합니다.",
      businessCriticIntensityAudit: [],
      rawIdeaText: "Founder Brief Generator"
    },
    currentSpec: {
      draftRef: "spec_draft_risky",
      title: "Founder Brief Generator",
      sections: ["Problem Statement", "Target Customer", "Value Proposition", "Validation Plan"]
    },
    researchState: {
      kind: "ResearchEvidenceProjection" as const,
      version: 7 as ProjectionVersion,
      taskIds: [],
      tasks: [],
      results: [],
      evidenceMatrices: [],
      evidencePacks: [],
      reviewCards: [],
      knownRisks: ["Counter-evidence for customer urgency is still missing."],
      nextValidationActions: ["Run skeptical search for customer urgency."],
      proConBalanceStatus: "missing_con_evidence" as const
    }
  };
}

function command(expectedStateVersion: StateVersion, payload: Readonly<Record<string, unknown>> = {}) {
  return {
    commandId: "cmd_prepare_founder_brief" as CommandId,
    commandType: "PrepareFounderBrief" as const,
    projectId,
    sessionId,
    actor: "user" as const,
    issuedAt: preparedAt,
    idempotencyKey: `PrepareFounderBrief:${expectedStateVersion}`,
    expectedStateVersion,
    causationId: null,
    correlationId,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    payload
  };
}

describe("PR-08 founder-brief projection", () => {
  it("prepares if-stop-now Founder Brief sections with known risks and next validation actions", () => {
    const state = stateWithKnownRisk();
    const completeness = buildConfidenceCompletionProjection(state, 8 as ProjectionVersion);
    const projection = buildFounderBriefProjection(state, completeness, 8 as ProjectionVersion, preparedAt);

    expect(projection.exportReady).toBe(false);
    expect(projection.problemCustomerValue).toContain("Founder Brief Generator");
    expect(projection.knownRisks).toEqual(
      expect.arrayContaining(["Counter-evidence for customer urgency is still missing."])
    );
    expect(projection.nextValidationActions).toEqual(
      expect.arrayContaining(["Run skeptical search for customer urgency."])
    );
    expect(projection.briefSections.map((section) => section.sectionId)).toEqual([
      "project_purpose_mode",
      "problem_customer_value",
      "top_decisions",
      "known_risks",
      "next_validation_actions"
    ]);
    expect(projection.projectPurposeModeLabel).toBe("사업화 검증 중심");
    expect(projection.briefSections.find((section) => section.sectionId === "project_purpose_mode")?.body).toContain(
      "사업화 검증 중심"
    );
    expect(projection.exportMetadata).toMatchObject({
      format: "markdown",
      writePolicy: "metadata_only_no_file_write",
      blockedSideEffects: ["file_write", "external_export"]
    });
  });

  it("carries accepted-risk decisions into Founder Brief known risks", () => {
    const state = {
      ...stateWithKnownRisk(),
      decisions: [
        {
          decisionId: "decision_accept_success_risk" as DecisionId,
          requiredDecisionRef: "success_criteria" as const,
          status: "risk_accepted" as const
        }
      ]
    };
    const completeness = buildConfidenceCompletionProjection(state, 8 as ProjectionVersion);
    const projection = buildFounderBriefProjection(state, completeness, 8 as ProjectionVersion, preparedAt);

    expect(projection.knownRisks).toEqual(
      expect.arrayContaining([
        "Accepted risk carried forward for success_criteria: decision_accept_success_risk"
      ])
    );
    expect(projection.briefSections.find((section) => section.sectionId === "known_risks")?.body).toContain(
      "Accepted risk carried forward for success_criteria"
    );
  });

  it("emits founder_brief_draft as a reducer deterministic output without file writes", () => {
    const state = stateWithKnownRisk();
    const reduction = reduceProductEngineCommand(command(state.stateVersion), state);

    expect(reduction.accepted).toBe(true);
    expect(reduction.effectPlan).toEqual([]);
    expect(reduction.events).toMatchObject([
      {
        eventType: "FounderBriefPrepared",
        payload: {
          exportReady: false
        }
      }
    ]);
    expect(reduction.deterministicOutputs).toMatchObject([
      {
        outputType: "founder_brief_draft"
      }
    ]);
    expect(reduction.immediateProjection).toMatchObject({
      kind: "FounderBriefProjection",
      knownRisks: ["Counter-evidence for customer urgency is still missing."]
    });
  });

  it("blocks Phase 1 file-write attempts while still allowing metadata-only export preparation", () => {
    const state = stateWithKnownRisk();
    const reduction = reduceProductEngineCommand(
      command(state.stateVersion, {
        fileWriteRequested: true
      }),
      state
    );

    expect(reduction).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "RUNTIME_ACTION_BLOCKED"
      },
      events: [],
      effectPlan: []
    });
  });

  it("blocks external export intent and rejects unsupported formats", () => {
    const state = stateWithKnownRisk();
    const externalExport = reduceProductEngineCommand(
      command(state.stateVersion, {
        externalExportRequested: true,
        exportUrl: "https://example.invalid/founder-brief"
      }),
      state
    );
    const unsupportedFormat = reduceProductEngineCommand(
      command(state.stateVersion, {
        requestedFormat: "pdf"
      }),
      state
    );

    expect(externalExport).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "RUNTIME_ACTION_BLOCKED"
      },
      events: [],
      effectPlan: []
    });
    expect(unsupportedFormat).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED"
      },
      events: [],
      effectPlan: []
    });
  });
});
