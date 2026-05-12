import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "@solo-superman/db";
import { PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE } from "@solo-superman/contracts";
import type { PlanningHandoffSourceRefDto, SessionId, StateVersion } from "@solo-superman/contracts";
import { createProductEngineCommandService } from "./command-service";

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
  await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
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

describe("ProductEngine command service Planning Handoff persistence", () => {
  it("accepts CreatePlanningHandoff and persists blocker rows in the command transaction", async () => {
    const storage = await createMigratedStorage();

    try {
      const service = createProductEngineCommandService(storage);
      const start = await service.startProject({
        rawIdea: "A command-service Planning Handoff persistence fixture",
        localPrivacyMode: "local_only"
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

describe("ProductEngine command service Phase 2.5 persistence", () => {
  it("accepts CreatePhase25ResearchComparison and persists comparison rows in the command transaction", async () => {
    const storage = await createMigratedStorage();

    try {
      const service = createProductEngineCommandService(storage);
      const start = await service.startProject({
        rawIdea: "A command-service Phase 2.5 comparison persistence fixture",
        localPrivacyMode: "local_only"
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
