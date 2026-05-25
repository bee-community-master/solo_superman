import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "@solo-superman/db";
import { PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE, PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE } from "@solo-superman/contracts";
import type {
  PlanningHandoffSourceRefDto,
  ProjectId,
  ResearchAllowlistId,
  ResearchConnectorId,
  ResearchEvidenceProjection,
  ResearchRunId,
  ResearchRunProjection,
  ResearchTaskId,
  SessionId,
  StateVersion
} from "@solo-superman/contracts";
import { createProductEngineCommandService } from "./command-service";
import { removeTemporaryDirectory } from "../test-cleanup";

const tempDirs: string[] = [];

async function makeTempAppDataDir() {
  const tempDir = await mkdtemp(join(tmpdir(), "solo-superman-command-service-test-"));

  tempDirs.push(tempDir);

  return tempDir;
}

async function createMigratedStorage() {
  const appDataDir = await makeTempAppDataDir();
  const storage = await createSoloStorage({ url: localDatabaseUrlFromAppDataDir(appDataDir) });
  const migrationStatus = await applyMigrations(storage);

  if (migrationStatus.state === "failed") {
    await storage.close();
    throw new Error(migrationStatus.errorMessage);
  }

  return storage;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(removeTemporaryDirectory));
});

const missingRequiredSourceRefs = [
  {
    sourceType: "spec_version",
    sourceId: "spec_version_missing",
    sourceLabel: "Missing SpecVersion",
    required: true,
    stale: false
  },
  {
    sourceType: "founder_brief",
    sourceId: "founder_brief_missing",
    sourceLabel: "Missing Founder Brief",
    required: true,
    stale: false
  },
  {
    sourceType: "decision_linked_evidence_pack",
    sourceId: "evidence_pack_missing",
    sourceLabel: "Missing Evidence Pack",
    required: true,
    stale: false
  },
  {
    sourceType: "research_updated_queue_item",
    sourceId: "queue_item_missing",
    sourceLabel: "Missing Research Queue Item",
    required: true,
    stale: false
  }
] as const satisfies readonly PlanningHandoffSourceRefDto[];

describe("ProductEngine command service research memory persistence", () => {
  it("writes markdown research memory after evidence synthesis so later duplicate research can cite it", async () => {
    const storage = await createMigratedStorage();
    const researchMemoryMarkdownRoot = await makeTempAppDataDir();

    try {
      const service = createProductEngineCommandService(storage, undefined, {
        researchMemoryMarkdownRoot
      });
      const start = await service.startProject({
        rawIdea: "A command-service research memory fixture",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "balanced",
        businessCriticIntensityConfirmation: "user_confirmed"
      });
      const startProjection = start.immediateProjection as { readonly sessionId: SessionId };
      const planned = await service.runSessionCommand({
        sessionId: startProjection.sessionId,
        commandType: "PlanResearch",
        expectedStateVersion: start.stateVersionAfter as StateVersion,
        payload: {
          objective: "Validate broader founder urgency evidence",
          routeOutcome: "research_needed",
          impact: "high"
        }
      });
      const research = planned.immediateProjection as ResearchEvidenceProjection;
      const researchTaskId = research.tasks[0]?.researchTaskId;

      expect(researchTaskId).toBeDefined();

      const imported = await service.runSessionCommand({
        sessionId: startProjection.sessionId,
        commandType: "ImportResearchResult",
        expectedStateVersion: planned.stateVersionAfter as StateVersion,
        payload: {
          researchTaskId,
          result:
            "Pro: founders report repeated planning pain. Con: some founders already use docs successfully.",
          sourceTitle: "Founder urgency public notes",
          sourceUrl: "https://example.com/founder-urgency",
          sourceReliability: "medium",
          limitationNotes: "Needs wider counter-evidence before planning-ready."
        }
      });

      expect(imported.effectTaskIds).toHaveLength(1);

      const effectResults = await service.runPendingResearchEvidenceEffects();
      const succeededEffect = effectResults.find((result) => result.status === "succeeded");
      const memoryPath = succeededEffect?.status === "succeeded"
        ? succeededEffect.researchMemoryMarkdownPath
        : undefined;

      expect(memoryPath).toMatch(/^proj_[^/]+\/sess_[^/]+\/research_task_.*\.md$/);
      if (!memoryPath) {
        throw new Error("Expected research memory markdown path.");
      }

      const markdown = await readFile(join(researchMemoryMarkdownRoot, memoryPath), "utf8");

      expect(markdown).toContain("# Research memory: Validate broader founder urgency evidence");
      expect(markdown).toContain("Founder urgency public notes");
      expect(markdown).toContain("If the user explicitly asks for more, broader, wider, or deeper research");
    } finally {
      await storage.close();
    }
  });

  it("attaches prior markdown memory refs when a user asks for broader follow-up research", async () => {
    const storage = await createMigratedStorage();
    const researchMemoryMarkdownRoot = await makeTempAppDataDir();

    try {
      const service = createProductEngineCommandService(storage, undefined, {
        researchMemoryMarkdownRoot
      });
      const start = await service.startProject({
        rawIdea: "A command-service wider research memory fixture",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "balanced",
        businessCriticIntensityConfirmation: "user_confirmed"
      });
      const startProjection = start.immediateProjection as { readonly projectId: ProjectId; readonly sessionId: SessionId };
      const planned = await service.runSessionCommand({
        sessionId: startProjection.sessionId,
        commandType: "PlanResearch",
        expectedStateVersion: start.stateVersionAfter as StateVersion,
        payload: {
          objective: "Validate broader founder urgency evidence",
          routeOutcome: "research_needed",
          impact: "high"
        }
      });
      const research = planned.immediateProjection as ResearchEvidenceProjection;
      const researchTaskId = research.tasks[0]?.researchTaskId;

      expect(researchTaskId).toBeDefined();

      const imported = await service.runSessionCommand({
        sessionId: startProjection.sessionId,
        commandType: "ImportResearchResult",
        expectedStateVersion: planned.stateVersionAfter as StateVersion,
        payload: {
          researchTaskId,
          result:
            "Pro: founders report repeated planning pain. Con: some founders already use docs successfully.",
          sourceTitle: "Founder urgency public notes",
          sourceUrl: "https://example.com/founder-urgency",
          sourceReliability: "medium",
          limitationNotes: "Needs wider counter-evidence before planning-ready."
        }
      });

      expect(imported.effectTaskIds).toHaveLength(1);

      const effectResults = await service.runPendingResearchEvidenceEffects();
      const succeededEffect = effectResults.find((result) => result.status === "succeeded");
      const memoryPath = succeededEffect?.status === "succeeded"
        ? succeededEffect.researchMemoryMarkdownPath
        : undefined;

      expect(memoryPath).toMatch(/^proj_[^/]+\/sess_[^/]+\/research_task_.*\.md$/);
      if (!memoryPath) {
        throw new Error("Expected research memory markdown path.");
      }

      const currentSession = await service.getSession(startProjection.projectId, startProjection.sessionId);
      const broaderPlanned = await service.runSessionCommand({
        sessionId: startProjection.sessionId,
        commandType: "PlanResearch",
        expectedStateVersion: currentSession.version as unknown as StateVersion,
        payload: {
          objective: "Broaden research beyond existing notes for founder urgency",
          routeOutcome: "research_needed",
          impact: "high"
        }
      });
      const broaderResearch = broaderPlanned.immediateProjection as ResearchEvidenceProjection;
      const broaderResearchTaskId = broaderResearch.tasks.at(-1)?.researchTaskId as ResearchTaskId | undefined;
      const allowlistId = "research_allowlist_memory_reuse" as ResearchAllowlistId;

      expect(broaderResearchTaskId).toBeDefined();
      if (!broaderResearchTaskId) {
        throw new Error("Expected broader follow-up research task.");
      }

      await service.createResearchAllowlist({
        projectId: startProjection.projectId,
        request: {
          allowlistId,
          connectorIds: ["public_search" as ResearchConnectorId],
          sourceCategories: ["public_web"],
          approvedBy: "owner_research_memory_reuse"
        }
      });

      const started = await service.startResearchRun({
        projectId: startProjection.projectId,
        request: {
          researchRunId: "research_run_memory_reuse" as ResearchRunId,
          researchTaskId: broaderResearchTaskId,
          allowlistId,
          connectorId: "public_search" as ResearchConnectorId,
          sourceCategory: "public_web",
          adapterKind: "local_fake_readonly",
          researchObjective: "Broaden research beyond existing notes for founder urgency",
          productCategory: "Founder workflow assistant",
          customerProblemHypothesis: "Early founders need safer validation research.",
          sourceRefs: ["queue_item_memory_reuse"]
        }
      });
      const startResult = started.immediateProjection as {
        readonly researchRun: ResearchRunProjection;
        readonly disclosureLog: { readonly sourceRefs: readonly string[] };
      };
      const memorySourceRef = `research-memory:${memoryPath}`;

      expect(startResult.researchRun.sourceRefs).toEqual(
        expect.arrayContaining(["queue_item_memory_reuse", memorySourceRef])
      );
      expect(startResult.disclosureLog.sourceRefs).toEqual(
        expect.arrayContaining(["queue_item_memory_reuse", memorySourceRef])
      );
    } finally {
      await storage.close();
    }
  });
});

describe("ProductEngine command service Planning Handoff persistence", () => {
  it("accepts CreatePlanningHandoff and persists blocker rows in the command transaction", async () => {
    const storage = await createMigratedStorage();

    try {
      const service = createProductEngineCommandService(storage);
      const start = await service.startProject({
        rawIdea: "A command-service Planning Handoff persistence fixture",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed"
      });
      const startProjection = start.immediateProjection as { readonly sessionId: SessionId };
      const expectedStateVersion = start.stateVersionAfter as StateVersion;
      const response = await service.runSessionCommand({
        sessionId: startProjection.sessionId,
        commandType: "CreatePlanningHandoff",
        expectedStateVersion,
        payload: {
          sourceRefs: missingRequiredSourceRefs
        }
      });

      expect(response).toMatchObject({
        category: "accepted_with_projection",
        stateVersionBefore: 1,
        stateVersionAfter: 2,
        immediateProjection: {
          kind: "PlanningHandoffProjection",
          currentStatus: "source_trace_incomplete",
          blockerArtifact: {
            kind: "PlanningHandoffBlockerArtifact",
            status: "source_trace_incomplete",
            noFinalLabelRule: "must_not_use_planning_ready_label"
          }
        }
      });
      expect(response.statusUrl).toBeUndefined();

      const handoffRows = await storage.client.execute(
        "SELECT artifact_kind, status, gate_verdict FROM planning_handoffs"
      );
      const projectionRows = await storage.client.execute(
        "SELECT projection_kind, version FROM projections WHERE projection_kind = 'PlanningHandoffProjection'"
      );
      const riskRows = await storage.client.execute(
        "SELECT risk_kind, required_action FROM planning_handoff_risks"
      );

      expect(handoffRows.rows).toEqual([
        expect.objectContaining({
          artifact_kind: "PlanningHandoffBlockerArtifact",
          status: "source_trace_incomplete",
          gate_verdict: "source_trace_incomplete"
        })
      ]);
      expect(projectionRows.rows).toEqual([
        expect.objectContaining({
          projection_kind: "PlanningHandoffProjection",
          version: 2
        })
      ]);
      expect(riskRows.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            risk_kind: "blocker_next_action",
            required_action: "revise"
          }),
          expect.objectContaining({
            risk_kind: "blocker_next_action",
            required_action: "research_more"
          }),
          expect.objectContaining({
            risk_kind: "required_user_action",
            required_action: "revise"
          }),
          expect.objectContaining({
            risk_kind: "required_user_action",
            required_action: "research_more"
          })
        ])
      );
    } finally {
      await storage.close();
    }
  });
});

function phase25PayloadFromFixture() {
  const report = PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE.artifact;

  return {
    researchQuestion: report.researchQuestion,
    decisionContext: report.decisionContext,
    sourceRefs: report.sourceRefs,
    baseline: report.baseline,
    candidate: report.candidate,
    delegationRiskGate: report.delegationRiskGate,
    rubric: report.rubric
  };
}

function executionAuthorityPayloadFromFixture(): Readonly<Record<string, unknown>> {
  const projection = PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE;
  const record = projection.latestRecord;

  return {
    sourcePlanningHandoffRef: record.sourcePlanningHandoffRef,
    boundedAgentOutput: projection.boundedOutputs[0],
    actionClass: record.actionClass,
    previewArtifactRef: record.previewArtifactRef ?? undefined,
    previewArtifactHash: record.previewArtifactHash ?? undefined,
    reviewedPreviewArtifactHash: record.reviewedPreviewArtifactHash ?? undefined,
    requestedScope: record.requestedScope,
    approvalDecision: record.approvalDecision,
    approver: record.approver ?? undefined,
    sandboxBoundary: record.sandboxBoundary,
    rollbackReference: record.rollbackReference ?? undefined,
    evidenceRefs: record.evidenceRefs,
    auditRefs: record.auditRefs,
    preconditionChecks: {
      planningSourceExists: true,
      previewArtifactExists: true,
      previewHashMatches: true,
      rollbackAvailable: true,
      credentialValueRequired: false,
      sandboxEnforced: true
    }
  };
}

describe("ProductEngine command service Phase 2.5 persistence", () => {
  it("accepts CreatePhase25ResearchComparison and persists comparison rows in the command transaction", async () => {
    const storage = await createMigratedStorage();

    try {
      const service = createProductEngineCommandService(storage);
      const start = await service.startProject({
        rawIdea: "A command-service Phase 2.5 comparison persistence fixture",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed"
      });
      const startProjection = start.immediateProjection as { readonly sessionId: SessionId };
      const expectedStateVersion = start.stateVersionAfter as StateVersion;
      const response = await service.runSessionCommand({
        sessionId: startProjection.sessionId,
        commandType: "CreatePhase25ResearchComparison",
        expectedStateVersion,
        payload: phase25PayloadFromFixture()
      });

      expect(response).toMatchObject({
        category: "accepted_with_projection",
        stateVersionBefore: 1,
        stateVersionAfter: 2,
        immediateProjection: {
          kind: "Phase25ResearchComparisonProjection",
          currentStatus: "quality_lift_ready",
          artifact: {
            qualityLiftClaimed: true,
            delegationRiskGate: {
              verdict: "allowed_for_comparative_preview"
            }
          }
        }
      });
      expect(response.statusUrl).toBeUndefined();

      const comparisonRows = await storage.client.execute(
        "SELECT status, gate_verdict, candidate_lane, quality_lift_claimed FROM phase25_research_comparisons"
      );
      const projectionRows = await storage.client.execute(
        "SELECT projection_kind, version FROM projections WHERE projection_kind = 'Phase25ResearchComparisonProjection'"
      );
      const sourceRows = await storage.client.execute(
        "SELECT source_type, source_id FROM phase25_research_comparison_sources"
      );

      expect(comparisonRows.rows).toEqual([
        expect.objectContaining({
          status: "quality_lift_ready",
          gate_verdict: "allowed_for_comparative_preview",
          candidate_lane: "manual_prompt_handoff",
          quality_lift_claimed: 1
        })
      ]);
      expect(projectionRows.rows).toEqual([
        expect.objectContaining({
          projection_kind: "Phase25ResearchComparisonProjection",
          version: 2
        })
      ]);
      expect(sourceRows.rows.length).toBeGreaterThan(0);
    } finally {
      await storage.close();
    }
  });
});

describe("ProductEngine command service execution authority persistence", () => {
  it("accepts CreateExecutionAuthority and persists authority plus bounded-output rows in the command transaction", async () => {
    const storage = await createMigratedStorage();

    try {
      const service = createProductEngineCommandService(storage);
      const start = await service.startProject({
        rawIdea: "A command-service Phase 3 execution authority persistence fixture",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed"
      });
      const startProjection = start.immediateProjection as { readonly sessionId: SessionId };
      const expectedStateVersion = start.stateVersionAfter as StateVersion;
      const response = await service.runSessionCommand({
        sessionId: startProjection.sessionId,
        commandType: "CreateExecutionAuthority",
        expectedStateVersion,
        payload: executionAuthorityPayloadFromFixture()
      });

      expect(response).toMatchObject({
        category: "accepted_with_projection",
        stateVersionBefore: 1,
        stateVersionAfter: 2,
        immediateProjection: {
          kind: "ExecutionAuthorityLedgerProjection",
          currentStatus: "ready_for_execution",
          latestRecord: {
            approvalDecision: "approved",
            executionResult: "not_run"
          }
        }
      });
      expect(response.statusUrl).toBeUndefined();

      const authorityRows = await storage.client.execute(
        "SELECT approval_decision, execution_result, action_class FROM execution_authority_records"
      );
      const outputRows = await storage.client.execute(
        "SELECT failure_mode, no_execution_policy FROM bounded_agent_output_records"
      );
      const projectionRows = await storage.client.execute(
        "SELECT projection_kind, version FROM projections WHERE projection_kind = 'ExecutionAuthorityLedgerProjection'"
      );

      expect(authorityRows.rows).toEqual([
        expect.objectContaining({
          approval_decision: "approved",
          execution_result: "not_run",
          action_class: "file_diff"
        })
      ]);
      expect(outputRows.rows).toEqual([
        expect.objectContaining({
          failure_mode: "ready_for_preview",
          no_execution_policy: "controlled_execution_required"
        })
      ]);
      expect(projectionRows.rows).toEqual([
        expect.objectContaining({
          projection_kind: "ExecutionAuthorityLedgerProjection",
          version: 2
        })
      ]);
    } finally {
      await storage.close();
    }
  });

  it("persists pending to approved authority lifecycle records for the same bounded output", async () => {
    const storage = await createMigratedStorage();

    try {
      const service = createProductEngineCommandService(storage);
      const start = await service.startProject({
        rawIdea: "A command-service Phase 3 authority lifecycle persistence fixture",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed"
      });
      const startProjection = start.immediateProjection as { readonly sessionId: SessionId };
      const pending = await service.runSessionCommand({
        sessionId: startProjection.sessionId,
        commandType: "CreateExecutionAuthority",
        expectedStateVersion: start.stateVersionAfter as StateVersion,
        payload: {
          ...executionAuthorityPayloadFromFixture(),
          approvalDecision: "pending",
          approver: undefined
        }
      });
      const approved = await service.runSessionCommand({
        sessionId: startProjection.sessionId,
        commandType: "CreateExecutionAuthority",
        expectedStateVersion: pending.stateVersionAfter! as StateVersion,
        payload: executionAuthorityPayloadFromFixture()
      });

      expect(pending).toMatchObject({
        category: "accepted_with_projection",
        immediateProjection: {
          kind: "ExecutionAuthorityLedgerProjection",
          currentStatus: "blocked",
          latestRecord: {
            boundedAgentOutputId: PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE.boundedOutputs[0]?.outputId,
            approvalDecision: "pending",
            executionResult: "blocked"
          }
        }
      });
      expect(approved).toMatchObject({
        category: "accepted_with_projection",
        stateVersionBefore: 2,
        stateVersionAfter: 3,
        immediateProjection: {
          kind: "ExecutionAuthorityLedgerProjection",
          currentStatus: "ready_for_execution",
          latestRecord: {
            boundedAgentOutputId: PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE.boundedOutputs[0]?.outputId,
            approvalDecision: "approved",
            executionResult: "not_run"
          }
        }
      });

      const authorityRows = await storage.client.execute("SELECT id FROM execution_authority_records");
      const outputRows = await storage.client.execute("SELECT id FROM bounded_agent_output_records");
      const latestAuthority = await service.getExecutionAuthority(startProjection.sessionId);

      expect(authorityRows.rows).toHaveLength(2);
      expect(outputRows.rows).toHaveLength(1);
      expect(latestAuthority).toMatchObject({
        currentStatus: "ready_for_execution",
        latestRecord: {
          boundedAgentOutputId: PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE.boundedOutputs[0]?.outputId,
          approvalDecision: "approved",
          executionResult: "not_run"
        },
        boundedOutputs: [
          expect.objectContaining({
            outputId: PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE.boundedOutputs[0]?.outputId,
            noExecutionPolicy: "controlled_execution_required"
          })
        ]
      });
    } finally {
      await storage.close();
    }
  });
});
