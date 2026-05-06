import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "@solo-superman/db";
import type { BlockedActionType, ProjectId, SessionId, StateVersion } from "@solo-superman/contracts";
import { createProductEngineCommandService } from "./product-engine/command-service";
import { createCodexRuntimeAdapter } from "./runtime";
import { createSidecarApp } from "./server";
import {
  PHASE1_E2E_ACCEPTANCE_CHECKLIST,
  PHASE1_E2E_INTAKE_ANSWER,
  PHASE1_E2E_RESEARCH_RESULT,
  PHASE1_E2E_SAMPLE_IDEA,
  PHASE1_E2E_SPEC_SECTIONS,
  PHASE15A_ACCEPTANCE_EVIDENCE_MAP,
  PHASE15B_ACCEPTANCE_EVIDENCE_MAP,
  PHASE15B_NO_EXECUTION_ACTION_TYPES
} from "./e2e-dry-run.fixture";

const localCapabilityToken = "test-local-capability-token";
const tempDirs: string[] = [];
const fixtureCodexRuntimeAdapter = createCodexRuntimeAdapter({
  fixtureMode: true,
  now: () => "2026-05-05T00:00:00.000Z",
  env: {}
});

interface JsonResponseBody {
  readonly data?: unknown;
  readonly error?: {
    readonly code: string;
    readonly message?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };
  readonly [key: string]: unknown;
}

async function makeTempAppDataDir() {
  const tempDir = await mkdtemp(join(tmpdir(), "solo-superman-e2e-test-"));

  tempDirs.push(tempDir);

  return tempDir;
}

async function createMigratedStorageApp() {
  const appDataDir = await makeTempAppDataDir();
  const storage = await createSoloStorage({ url: localDatabaseUrlFromAppDataDir(appDataDir) });
  const migrationStatus = await applyMigrations(storage);

  if (migrationStatus.state === "failed") {
    await storage.close();
    throw new Error(migrationStatus.errorMessage);
  }

  return {
    storage,
    app: createSidecarApp({
      localCapabilityToken,
      migrationStatus,
      storage,
      codexRuntimeAdapter: fixtureCodexRuntimeAdapter
    })
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
});

function authHeaders() {
  return {
    Authorization: `Bearer ${localCapabilityToken}`
  };
}

async function jsonBody(response: Response) {
  return (await response.json()) as JsonResponseBody;
}

async function postJson(app: ReturnType<typeof createSidecarApp>, path: string, body: Readonly<Record<string, unknown>>) {
  const response = await app.request(path, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  return {
    response,
    body: await jsonBody(response)
  };
}

async function getJson(app: ReturnType<typeof createSidecarApp>, path: string) {
  const response = await app.request(path, {
    headers: authHeaders()
  });

  return {
    response,
    body: await jsonBody(response)
  };
}

function record(value: unknown) {
  expect(value).toEqual(expect.any(Object));

  return value as Readonly<Record<string, unknown>>;
}

function records(value: unknown) {
  expect(Array.isArray(value)).toBe(true);

  return value as readonly Readonly<Record<string, unknown>>[];
}

function firstRecord(value: unknown) {
  const first = records(value)[0];

  expect(first).toBeDefined();

  return first as Readonly<Record<string, unknown>>;
}

function responseData(body: JsonResponseBody) {
  return record(body.data);
}

function stateVersionAfter(data: Readonly<Record<string, unknown>>) {
  expect(typeof data.stateVersionAfter).toBe("number");

  return data.stateVersionAfter as number;
}

function sessionIdFromStart(data: Readonly<Record<string, unknown>>) {
  const projection = record(data.immediateProjection);

  expect(typeof projection.sessionId).toBe("string");

  return projection.sessionId as string;
}

function projectIdFromStart(data: Readonly<Record<string, unknown>>) {
  const projection = record(data.immediateProjection);

  expect(typeof projection.projectId).toBe("string");

  return projection.projectId as string;
}

describe("PR-09 end-to-end dry-run hardening", () => {
  it("maps the docs-to-runtime acceptance checklist to executable evidence", () => {
    expect(PHASE1_E2E_ACCEPTANCE_CHECKLIST.map((item) => item.criterion)).toEqual([
      "sample_idea_to_first_question_batch",
      "answer_routes_to_research_needed",
      "manual_evidence_to_decision_and_spec_version",
      "effect_queue_and_operations_recovery",
      "forbidden_scope_not_executed"
    ]);
    expect(PHASE1_E2E_ACCEPTANCE_CHECKLIST.every((item) => item.sourceDocs.length >= 2)).toBe(true);
    expect(PHASE1_E2E_ACCEPTANCE_CHECKLIST.every((item) => item.runtimeEvidence.length >= 3)).toBe(true);
  });

  it("maps docs/30 Phase 1.5A Scenario A-D to route-level acceptance evidence labels", () => {
    expect(PHASE15A_ACCEPTANCE_EVIDENCE_MAP.map((item) => item.scenario)).toEqual([
      "Scenario A. Allowlist happy path",
      "Scenario B. Private source approval gate",
      "Scenario C. Revoke, cancel, retry recovery",
      "Scenario D. Evidence quality gate"
    ]);
    expect(
      PHASE15A_ACCEPTANCE_EVIDENCE_MAP.every((item) =>
        item.sourceDocs.includes("docs/30-phase1.5-research-runtime-and-readiness-contract.md")
      )
    ).toBe(true);
    expect(PHASE15A_ACCEPTANCE_EVIDENCE_MAP.flatMap((item) => item.runtimeEvidence)).toEqual(
      expect.arrayContaining([
        "StartResearchRun",
        "blocked_manual_handoff",
        "RetryResearchRun",
        "ResearchRunProjection.qualityGateStatus"
      ])
    );
  });

  it("maps docs/30 Phase 1.5B Scenario E-G to no-execution readiness evidence labels", () => {
    expect(PHASE15B_ACCEPTANCE_EVIDENCE_MAP.map((item) => item.scenario)).toEqual([
      "Scenario E. Phase 1.5B no-execution preservation",
      "Scenario F. Hint export/readiness reuse",
      "Scenario G. Docs contract consistency"
    ]);
    expect(PHASE15B_NO_EXECUTION_ACTION_TYPES).toEqual([
      "file_patch",
      "shell_command",
      "browser_action",
      "network_write",
      "credential_access",
      "destructive_operation",
      "chatgpt_web_automation"
    ]);
    expect(
      PHASE15B_ACCEPTANCE_EVIDENCE_MAP.every((item) =>
        item.sourceDocs.includes("docs/30-phase1.5-research-runtime-and-readiness-contract.md")
      )
    ).toBe(true);
    expect(PHASE15B_ACCEPTANCE_EVIDENCE_MAP.flatMap((item) => item.runtimeEvidence)).toEqual(
      expect.arrayContaining([
        "metadata_only_no_execution",
        "readiness_preview_handoff_metadata",
        "not execution permission"
      ])
    );
  });

  it("stores, queries, and exports Phase 1.5B no-execution hints for every forbidden runtime boundary", async () => {
    const { app, storage } = await createMigratedStorageApp();

    try {
      const start = await postJson(app, "/api/v1/projects", {
        rawIdea: "A Phase 1.5B no-execution readiness acceptance idea",
        localPrivacyMode: "local_only"
      });
      const startData = responseData(start.body);
      const projectId = projectIdFromStart(startData) as ProjectId;
      const sessionId = sessionIdFromStart(startData) as SessionId;
      const service = createProductEngineCommandService(storage, fixtureCodexRuntimeAdapter);
      let expectedStateVersion = stateVersionAfter(startData) as StateVersion;

      for (const actionType of PHASE15B_NO_EXECUTION_ACTION_TYPES) {
        const response = await service.runSessionCommand({
          sessionId,
          commandType: "CreateRuntimePreview",
          expectedStateVersion,
          payload: {
            source: "protocol_fixture",
            runtimeAdapterVersion: "codex-app-server-preview-v1",
            turnPurpose: "implementation_plan_preview",
            contextHash: `ctx_phase15b_${actionType}`,
            prompt: `Preserve ${actionType} readiness metadata without executing the action.`,
            summary: `${actionType} readiness handoff blocked`,
            body: `Preview-only handoff for ${actionType}; no file, shell, browser, network, credential, destructive, or ChatGPT action runs.`,
            sourceRefs: [
              `research_run_phase15b_${actionType}`,
              `evidence_matrix_phase15b_${actionType}`,
              `research_allowlist_phase15b_${actionType}`,
              `research_disclosure_log_phase15b_${actionType}`,
              `audit_log_phase15b_${actionType}`
            ],
            targetObject: "blocked_action",
            requestedActionType: actionType,
            requestedActionReason: `Phase 1.5B stores ${actionType} readiness only.`
          }
        });
        const responseRecord = record(response);

        expect(responseRecord).toMatchObject({
          category: "accepted"
        });
        expect(responseRecord.statusUrl).toBeDefined();
        expectedStateVersion = responseRecord.stateVersionAfter as StateVersion;

        const executorResults = await service.runPendingCodexRuntimePreviewEffects();

        expect(executorResults).toEqual([
          expect.objectContaining({
            status: "blocked",
            blockedActionType: actionType
          })
        ]);
        expectedStateVersion = (Number(expectedStateVersion) + 1) as StateVersion;
      }

      const activity = await getJson(app, `/api/v1/sessions/${sessionId}/activity`);
      const activityData = responseData(activity.body);
      const runtimeArtifacts = records(activityData.runtimeArtifacts);

      expect(runtimeArtifacts).toHaveLength(PHASE15B_NO_EXECUTION_ACTION_TYPES.length);
      expect(runtimeArtifacts.map((artifact) => record(artifact.blockedAction).actionType)).toEqual(
        expect.arrayContaining([...PHASE15B_NO_EXECUTION_ACTION_TYPES])
      );
      expect(runtimeArtifacts.every((artifact) => artifact.status === "blocked")).toBe(true);

      const query = await getJson(app, `/api/v1/projects/${projectId}/phase15b-upgrade-hints`);
      const queryData = responseData(query.body);
      const queryRecords = records(queryData.records);
      const queryJson = JSON.stringify(query.body);

      expect(query.response.status).toBe(200);
      expect(queryData).toMatchObject({
        kind: "Phase15bUpgradeHintProjection",
        metadataLabel: "readiness_preview_handoff_metadata",
        noExecution: {
          semantic: "metadata_only_no_execution",
          productActionPerformed: false,
          delegationState: "not_active",
          credentialValueState: "omitted"
        },
        pendingEffectSummary: {
          totalPending: 0
        }
      });
      expect(queryRecords).toHaveLength(PHASE15B_NO_EXECUTION_ACTION_TYPES.length);
      expect(
        queryRecords.map((hintRecord) =>
          record(record(hintRecord.hints).riskNormalization).blockedActionType as BlockedActionType
        )
      ).toEqual(expect.arrayContaining([...PHASE15B_NO_EXECUTION_ACTION_TYPES]));
      expect(queryRecords.map((hintRecord) => record(hintRecord.hints).createdAt)).not.toContain(
        "2026-05-06T00:00:00.000Z"
      );
      expect(
        queryRecords.every((hintRecord) => {
          const createdAt = record(hintRecord.hints).createdAt;

          return typeof createdAt === "string" && new Date(createdAt).toISOString() === createdAt;
        })
      ).toBe(true);
      expect(
        queryRecords.every((hintRecord) => {
          const hintRecordData = record(hintRecord);
          const hints = record(hintRecordData.hints);
          const noExecution = record(hintRecordData.noExecution);

          return (
            hintRecordData.metadataLabel === "readiness_preview_handoff_metadata" &&
            noExecution.productActionPerformed === false &&
            noExecution.delegationState === "not_active" &&
            records(hints.sourceRefs).some((sourceRef) => sourceRef.kind === "research_run") &&
            records(hints.sourceRefs).some((sourceRef) => sourceRef.kind === "evidence_matrix") &&
            records(hints.sourceRefs).some((sourceRef) => sourceRef.kind === "research_allowlist") &&
            records(hints.sourceRefs).some((sourceRef) => sourceRef.kind === "research_disclosure_log") &&
            records(hints.sourceRefs).some((sourceRef) => sourceRef.kind === "audit_log")
          );
        })
      ).toBe(true);
      expect(queryJson).not.toMatch(/\b(executed|succeeded|applied)\b/iu);
      expect(queryJson).not.toContain("executionEnabled");
      expect(queryJson).not.toContain("delegationActive");
      expect(queryJson).not.toContain("autoApply");
      expect(queryJson).not.toContain("canExecute");

      const exported = await getJson(app, `/api/v1/projects/${projectId}/phase15b-upgrade-hints/export`);
      const exportedData = responseData(exported.body);

      expect(exported.response.status).toBe(200);
      expect(exportedData).toMatchObject({
        kind: "Phase15bUpgradeHintExport",
        format: "json",
        metadataLabel: "readiness_preview_handoff_metadata",
        exportPolicy: {
          privatePayloadsIncluded: false,
          credentialValuesIncluded: false,
          sourceRefLabelsIncluded: false
        },
        noExecution: {
          semantic: "metadata_only_no_execution",
          productActionPerformed: false,
          delegationState: "not_active"
        }
      });
      expect(records(exportedData.records)).toHaveLength(PHASE15B_NO_EXECUTION_ACTION_TYPES.length);

      const specVersions = await getJson(app, `/api/v1/sessions/${sessionId}/spec/versions`);

      expect(specVersions.response.status).toBe(200);
      expect(records(specVersions.body.data)).toHaveLength(0);
    } finally {
      await storage.close();
    }
  });

  it("runs the sample idea through question, evidence, approval, SpecVersion, scoring, Founder Brief, and blocked runtime preview", async () => {
    const { app, storage } = await createMigratedStorageApp();

    try {
      const start = await postJson(app, "/api/v1/projects", {
        rawIdea: PHASE1_E2E_SAMPLE_IDEA,
        localPrivacyMode: "local_only"
      });
      const startData = responseData(start.body);
      const sessionId = sessionIdFromStart(startData);

      expect(start.response.status).toBe(200);
      expect(stateVersionAfter(startData)).toBe(1);

      const intake = await postJson(app, `/api/v1/sessions/${sessionId}/intake`, {
        expectedStateVersion: 1,
        answer: PHASE1_E2E_INTAKE_ANSWER
      });
      const draft = await postJson(app, `/api/v1/sessions/${sessionId}/spec/initial`, {
        expectedStateVersion: 2
      });
      const analyze = await postJson(app, `/api/v1/sessions/${sessionId}/spec/analyze`, {
        expectedStateVersion: 3,
        targetRef: "current_spec"
      });
      const analyzeData = responseData(analyze.body);

      expect(intake.response.status).toBe(200);
      expect(draft.response.status).toBe(200);
      expect(analyze.response.status).toBe(200);
      expect(analyzeData).toMatchObject({
        pendingEffectSummary: {
          byType: {
            queue_projection_effect: 1
          }
        }
      });

      const analyzeStatus = await getJson(app, analyzeData.statusUrl as string);

      expect(responseData(analyzeStatus.body)).toMatchObject({
        effects: [
          expect.objectContaining({
            effectType: "queue_projection_effect",
            maxAttempts: 3
          })
        ],
        projectionHints: [
          {
            projectionKind: "DecisionQueueProjection",
            refetchUrl: `/api/v1/sessions/${sessionId}/queue`
          }
        ]
      });

      const activate = await postJson(app, `/api/v1/sessions/${sessionId}/queue/activate`, {
        expectedStateVersion: 4
      });
      const activateData = responseData(activate.body);
      const activeBatch = record(activateData.immediateProjection);
      const activeItems = records(activeBatch.active);
      const firstQuestion = firstRecord(activeBatch.active);

      expect(activate.response.status).toBe(200);
      expect(activeBatch).toMatchObject({
        kind: "DecisionQueueProjection"
      });
      expect(activeItems).toHaveLength(4);

      const answer = await postJson(app, `/api/v1/questions/${firstQuestion.queueItemId as string}/answers`, {
        sessionId,
        queueItemId: firstQuestion.queueItemId,
        expectedStateVersion: 5,
        answer: "Focus on paid-interview prep founders and validate willingness to pay with a skeptical search.",
        researchRouteHint: "research_needed",
        claimImpact: "high",
        researchObjective: "Validate paid-interview prep urgency and alternatives."
      });
      const answerData = responseData(answer.body);

      expect(answer.response.status).toBe(200);
      expect(answerData).toMatchObject({
        stateVersionAfter: 7,
        pendingEffectSummary: {
          byType: {
            research_evidence_effect: 1
          }
        }
      });

      const researchBeforeImport = await getJson(app, `/api/v1/sessions/${sessionId}/research`);
      const researchBeforeData = responseData(researchBeforeImport.body);
      const researchTask = firstRecord(researchBeforeData.tasks);

      expect(researchTask).toMatchObject({
        routeOutcome: "research_needed",
        impact: "high"
      });

      const importResult = await postJson(app, `/api/v1/research-tasks/${researchTask.researchTaskId as string}/results`, {
        sessionId,
        researchTaskId: researchTask.researchTaskId,
        expectedStateVersion: 7,
        result: PHASE1_E2E_RESEARCH_RESULT,
        sourceTitle: "Manual skeptical search dry-run",
        sourceUrl: "https://example.invalid/manual-research",
        limitationNotes: "Uncertain price sensitivity remains after the first import."
      });
      const importData = responseData(importResult.body);
      const researchExecutorResults = await createProductEngineCommandService(
        storage,
        fixtureCodexRuntimeAdapter
      ).runPendingResearchEvidenceEffects();

      expect(importResult.response.status).toBe(200);
      expect(researchExecutorResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "succeeded",
            balanceStatus: "balanced"
          })
        ])
      );

      const importStatus = await getJson(app, importData.statusUrl as string);

      expect(responseData(importStatus.body)).toMatchObject({
        commandStatus: "complete",
        effects: [
          expect.objectContaining({
            effectType: "research_evidence_effect",
            status: "succeeded",
            maxAttempts: 2
          })
        ],
        projectionHints: [
          {
            projectionKind: "ResearchEvidenceProjection",
            refetchUrl: `/api/v1/sessions/${sessionId}/research`
          }
        ]
      });
      const recoveredAnswerStatus = await getJson(app, answerData.statusUrl as string);

      expect(responseData(recoveredAnswerStatus.body)).toMatchObject({
        commandStatus: "complete",
        effects: [
          expect.objectContaining({
            effectType: "research_evidence_effect",
            status: "cancelled",
            idempotencyKey: `research:${researchTask.researchTaskId as string}`
          })
        ],
        pendingEffectSummary: {
          totalPending: 0
        }
      });

      const researchAfterImport = await getJson(app, `/api/v1/sessions/${sessionId}/research`);
      const researchAfterData = responseData(researchAfterImport.body);
      const evidenceMatrix = firstRecord(researchAfterData.evidenceMatrices);

      expect(evidenceMatrix).toMatchObject({
        balanceStatus: "balanced",
        decisionBlocked: false
      });

      const specUpdate = await postJson(app, "/api/v1/spec-updates", {
        sessionId,
        expectedStateVersion: 9,
        sourceRef: evidenceMatrix.evidenceMatrixId,
        requiredDecisionRef: "primary_customer",
        title: "Founder Brief-ready local-first product coaching session",
        sections: PHASE1_E2E_SPEC_SECTIONS
      });
      const specUpdateData = responseData(specUpdate.body);
      const specUpdateQueue = record(specUpdateData.immediateProjection);
      const specUpdateOutput = records(specUpdateData.deterministicOutputs).find((output) =>
        String(output.outputRef).startsWith("spec_update_")
      );
      const specUpdatePayload = record(specUpdateOutput?.payload);
      const decisionItem = records(specUpdateQueue.next).find((item) =>
        String(item.queueItemId).startsWith("decision_card_decision_")
      );

      expect(specUpdate.response.status).toBe(200);
      expect(specUpdateData).toMatchObject({
        category: "accepted_with_projection",
        pendingEffectSummary: {
          byType: {
            queue_projection_effect: 1
          }
        }
      });
      expect(decisionItem).toBeDefined();

      const decisionId = String(specUpdatePayload.decisionId);
      const approvedPreviewRef = String(specUpdateOutput?.outputRef);

      expect(specUpdatePayload).toMatchObject({
        previewRef: approvedPreviewRef,
        sourceRef: evidenceMatrix.evidenceMatrixId,
        requiredDecisionRef: "primary_customer",
        title: "Founder Brief-ready local-first product coaching session",
        sections: PHASE1_E2E_SPEC_SECTIONS
      });
      expect(decisionItem?.queueItemId).toBe(`decision_card_${decisionId}`);

      const resolveDecision = await postJson(app, `/api/v1/decisions/${decisionId}/resolve`, {
        sessionId,
        decisionId,
        expectedStateVersion: 10,
        outcome: "approved",
        rationale: "Manual evidence includes both support and risk, so the primary customer decision can be approved."
      });
      const resolvedQueue = await getJson(app, `/api/v1/sessions/${sessionId}/queue`);
      const specVersion = await postJson(app, `/api/v1/sessions/${sessionId}/spec/versions`, {
        expectedStateVersion: 11,
        approvedPreviewRef,
        title: "Founder Brief-ready local-first product coaching session",
        sections: PHASE1_E2E_SPEC_SECTIONS
      });
      const specVersionData = responseData(specVersion.body);

      expect(resolveDecision.response.status).toBe(200);
      expect(records(responseData(resolvedQueue.body).next).map((item) => item.queueItemId)).not.toContain(
        `decision_card_${decisionId}`
      );
      expect(specVersion.response.status).toBe(200);
      expect(specVersionData).toMatchObject({
        category: "accepted_with_projection",
        immediateProjection: {
          kind: "LivingSpecProjection",
          approvalStatus: "approved",
          sectionCount: PHASE1_E2E_SPEC_SECTIONS.length
        }
      });

      const versions = await getJson(app, `/api/v1/sessions/${sessionId}/spec/versions`);

      expect(records(versions.body.data)).toEqual([
        expect.objectContaining({
          approved: true,
          sectionCount: PHASE1_E2E_SPEC_SECTIONS.length
        })
      ]);

      const score = await postJson(app, `/api/v1/sessions/${sessionId}/completeness/score`, {
        expectedStateVersion: 12
      });
      const scoreData = responseData(score.body);

      expect(score.response.status).toBe(200);
      expect(scoreData.statusUrl).toBeUndefined();
      expect(scoreData).toMatchObject({
        category: "accepted_with_projection",
        immediateProjection: {
          kind: "ConfidenceCompletionProjection",
          scoreBreakdown: {
            evidenceQuality: expect.any(Number),
            decisionApproval: expect.any(Number)
          }
        }
      });

      const founderBrief = await postJson(app, `/api/v1/sessions/${sessionId}/founder-brief/export`, {
        expectedStateVersion: 13,
        requestedFormat: "markdown"
      });
      const founderBriefData = responseData(founderBrief.body);

      expect(founderBrief.response.status).toBe(200);
      expect(founderBriefData.statusUrl).toBeUndefined();
      expect(founderBriefData).toMatchObject({
        category: "accepted_with_projection",
        immediateProjection: {
          kind: "FounderBriefProjection",
          exportMetadata: {
            writePolicy: "metadata_only_no_file_write"
          },
          topDecisions: expect.arrayContaining([expect.stringContaining("primary_customer")])
        }
      });

      const blockedPreview = await postJson(app, "/api/v1/runtime/codex/preview", {
        sessionId,
        expectedStateVersion: 14,
        turnPurpose: "implementation_plan_preview",
        contextHash: "ctx_pr09_e2e_blocked_shell",
        prompt: "Preview a command plan, but Phase 1 must not execute it.",
        sourceRefs: [approvedPreviewRef, String(evidenceMatrix.evidenceMatrixId)],
        targetObject: "blocked_action",
        requestedActionType: "shell_command",
        requestedActionReason: "The preview suggested running a shell command."
      });
      const blockedPreviewData = responseData(blockedPreview.body);
      const codexExecutorResults = await createProductEngineCommandService(
        storage,
        fixtureCodexRuntimeAdapter
      ).runPendingCodexRuntimePreviewEffects();

      expect(blockedPreview.response.status).toBe(200);
      expect(codexExecutorResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "blocked",
            blockedActionType: "shell_command"
          })
        ])
      );

      const blockedStatus = await getJson(app, blockedPreviewData.statusUrl as string);
      const activity = await getJson(app, `/api/v1/sessions/${sessionId}/activity`);
      const queueAfterBlockedRuntime = await getJson(app, `/api/v1/sessions/${sessionId}/queue`);

      expect(responseData(blockedStatus.body)).toMatchObject({
        commandStatus: "blocked",
        effects: [
          expect.objectContaining({
            effectType: "codex_runtime_preview_effect",
            status: "blocked",
            maxAttempts: 1,
            error: expect.objectContaining({
              code: "RUNTIME_ACTION_BLOCKED"
            })
          })
        ],
        projectionHints: [
          {
            projectionKind: "RuntimeActivityProjection",
            refetchUrl: `/api/v1/sessions/${sessionId}/activity`
          }
        ]
      });
      expect(responseData(activity.body)).toMatchObject({
        runtimeStatus: "blocked",
        runtimeArtifacts: [
          expect.objectContaining({
            kind: "BlockedActionArtifact",
            applyPolicy: "blocked",
            blockedAction: expect.objectContaining({
              actionType: "shell_command"
            })
          })
        ]
      });
      expect(responseData(queueAfterBlockedRuntime.body)).toMatchObject({
        blocked: expect.arrayContaining([
          expect.objectContaining({
            queueItemId: expect.stringMatching(/^runtime_preview_/),
            state: "blocked"
          })
        ])
      });

      const forbiddenFounderBriefWrite = await postJson(app, `/api/v1/sessions/${sessionId}/founder-brief/export`, {
        expectedStateVersion: 16,
        fileWriteRequested: true
      });

      expect(responseData(forbiddenFounderBriefWrite.body)).toMatchObject({
        category: "rejected",
        error: {
          code: "RUNTIME_ACTION_BLOCKED"
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("surfaces research effect terminal failure as user-visible recovery instead of decision-ready evidence", async () => {
    const { app, storage } = await createMigratedStorageApp();

    try {
      const start = await postJson(app, "/api/v1/projects", {
        rawIdea: "A research incident dry-run idea",
        localPrivacyMode: "local_only"
      });
      const sessionId = sessionIdFromStart(responseData(start.body));

      await postJson(app, `/api/v1/sessions/${sessionId}/intake`, {
        expectedStateVersion: 1,
        answer: "Validate a high-impact claim with intentionally insufficient evidence."
      });
      await postJson(app, `/api/v1/sessions/${sessionId}/spec/initial`, {
        expectedStateVersion: 2
      });

      const planResearch = await postJson(app, `/api/v1/sessions/${sessionId}/research-tasks`, {
        expectedStateVersion: 3,
        sourceQueueItemId: "manual_incident_source",
        objective: "Validate a high-impact claim with bad source quality.",
        routeOutcome: "research_needed",
        impact: "high"
      });

      expect(planResearch.response.status).toBe(200);

      const researchBeforeImport = await getJson(app, `/api/v1/sessions/${sessionId}/research`);
      const researchTask = firstRecord(responseData(researchBeforeImport.body).tasks);
      const importResult = await postJson(app, `/api/v1/research-tasks/${researchTask.researchTaskId as string}/results`, {
        sessionId,
        researchTaskId: researchTask.researchTaskId,
        expectedStateVersion: 4,
        result: "This retained source is ambiguous, anecdotal, and unusable for the claim.",
        sourceTitle: "Low-quality retained source"
      });
      const importData = responseData(importResult.body);
      const executorResults = await createProductEngineCommandService(
        storage,
        fixtureCodexRuntimeAdapter
      ).runPendingResearchEvidenceEffects();

      expect(executorResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "failed",
            balanceStatus: "source_quality_insufficient"
          })
        ])
      );

      const failedStatus = await getJson(app, importData.statusUrl as string);
      const failedResearch = await getJson(app, `/api/v1/sessions/${sessionId}/research`);
      const failedResearchData = responseData(failedResearch.body);

      expect(responseData(failedStatus.body)).toMatchObject({
        commandStatus: "failed",
        effects: [
          expect.objectContaining({
            effectType: "research_evidence_effect",
            status: "failed",
            attemptCount: 2,
            maxAttempts: 2,
            error: expect.objectContaining({
              code: "RESEARCH_SOURCE_QUALITY_INSUFFICIENT",
              retryAvailable: false
            })
          })
        ]
      });
      expect(failedResearchData).toMatchObject({
        evidenceMatrices: [
          expect.objectContaining({
            balanceStatus: "source_quality_insufficient",
            decisionBlocked: true
          })
        ],
        reviewCards: [
          expect.objectContaining({
            state: "terminal_failure",
            retainedSourceRef: "Low-quality retained source",
            recoveryActions: expect.arrayContaining(["retry_synthesis", "import_manual_result", "defer_as_known_risk"])
          })
        ],
        knownRisks: [expect.stringContaining("Research source was insufficient")]
      });
    } finally {
      await storage.close();
    }
  });
});
