import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyMigrations, createEventRepository, createSoloStorage, localDatabaseUrlFromAppDataDir } from "@solo-superman/db";
import {
  CANONICAL_INITIAL_SPEC_SECTIONS,
  CONTRACT_SCHEMA_VERSION,
  SERVICE_PAGE_USE_PERMISSION_BLOCKED_ACTION_CLASSES,
  type BrowserActionPreviewDto,
  type BlockedActionType,
  type CommandId,
  type CorrelationId,
  type DecisionEvidencePackId,
  type EventId,
  type EvidenceItemId,
  type PlanningHandoffSourceRefDto,
  type ProjectId,
  type ProjectionVersion,
  type QueueItemId,
  type ResearchResultId,
  type ResearchTaskId,
  type SessionId,
  type StateVersion
} from "@solo-superman/contracts";
import { createProductEngineCommandService } from "./product-engine/command-service";
import { createCodexRuntimeAdapter } from "./runtime";
import { createSidecarApp } from "./server";
import {
  PHASE1_E2E_ACCEPTANCE_CHECKLIST,
  PHASE1_E2E_INTAKE_ANSWER,
  PHASE1_E2E_RESEARCH_RESULT,
  PHASE1_E2E_SAMPLE_IDEA,
  PHASE1_E2E_SPEC_SECTIONS,
  PHASE1_2_CLOSEOUT_EVIDENCE,
  PHASE15A_ACCEPTANCE_EVIDENCE_MAP,
  PHASE15B_ACCEPTANCE_EVIDENCE_MAP,
  PHASE15B_NO_EXECUTION_ACTION_TYPES,
  PHASE2_ACCEPTANCE_EVIDENCE_MAP,
  PHASE3_CLOSEOUT_DRY_RUN_EVIDENCE_MAP,
  PHASE3_CLOSEOUT_EVIDENCE,
  POST_PHASE3_CHATGPT_DELEGATION_DRY_RUN_EVIDENCE
} from "./e2e-dry-run.fixture";
import { hashBrowserActionPreview } from "./product-engine/browser-action-adapter";
import { hashFileDiffPreview } from "./product-engine/file-diff-adapter";
import { hashShellCommandPreview } from "./product-engine/shell-command-adapter";
import { generatedFounderQuestionSet } from "./generated-ambiguity-question-fixtures";
import { removeTemporaryDirectory } from "./test-cleanup";

const localCapabilityToken = "test-local-capability-token";
const tempDirs: string[] = [];
const fixtureCodexRuntimeAdapter = createCodexRuntimeAdapter({
  fixtureMode: true,
  now: () => "2026-05-05T00:00:00.000Z",
  env: {}
});
const phase3CloseoutExecutionWindow = {
  requestedAt: "2026-05-13T00:01:00.000Z",
  approvalExpiresAt: "2026-05-13T00:05:00.000Z"
} as const;

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

async function createMigratedStorageApp(options: { readonly autoImplementationWorkspaceRoot?: string } = {}) {
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
      codexRuntimeAdapter: fixtureCodexRuntimeAdapter,
      ...(options.autoImplementationWorkspaceRoot
        ? { autoImplementationWorkspaceRoot: options.autoImplementationWorkspaceRoot }
        : {})
    })
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(removeTemporaryDirectory));
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

async function createProjectForE2e(app: ReturnType<typeof createSidecarApp>, rawIdea: string) {
  const start = await postJson(app, "/api/v1/projects", {
    rawIdea,
    localPrivacyMode: "local_only",
    projectPurposeMode: "business",
    projectPurposeModeConfirmation: "user_confirmed",
    businessCriticIntensity: "balanced",
    businessCriticIntensityConfirmation: "user_confirmed"
  });
  const startData = responseData(start.body);

  expect(start.response.status, JSON.stringify(start.body)).toBe(200);

  return {
    sessionId: sessionIdFromStart(startData),
    projectId: projectIdFromStart(startData)
  };
}

async function postAutoImplementationRunForE2e(
  app: ReturnType<typeof createSidecarApp>,
  sessionId: string,
  payload: Readonly<Record<string, unknown>>
) {
  return postJson(app, `/api/v1/sessions/${sessionId}/auto-implementation-runs`, {
    sessionId,
    ...payload
  });
}

async function postAutoImplementationWorkerJobForE2e(
  app: ReturnType<typeof createSidecarApp>,
  sessionId: string,
  runId: string,
  payload: Readonly<Record<string, unknown>>
) {
  return postJson(app, `/api/v1/sessions/${sessionId}/auto-implementation-runs/${runId}/worker-jobs`, {
    sessionId,
    runId,
    ...payload
  });
}

async function postAutoImplementationWorkerRunForE2e(
  app: ReturnType<typeof createSidecarApp>,
  sessionId: string,
  runId: string,
  jobId: string,
  payload: Readonly<Record<string, unknown>>
) {
  return postJson(
    app,
    `/api/v1/sessions/${sessionId}/auto-implementation-runs/${runId}/worker-jobs/${encodeURIComponent(jobId)}/run`,
    {
      sessionId,
      runId,
      jobId,
      ...payload
    }
  );
}

async function postAutoImplementationWorkerStageAdvanceForE2e(
  app: ReturnType<typeof createSidecarApp>,
  sessionId: string,
  runId: string,
  jobId: string,
  payload: Readonly<Record<string, unknown>>
) {
  return postJson(
    app,
    `/api/v1/sessions/${sessionId}/auto-implementation-runs/${runId}/worker-jobs/${encodeURIComponent(jobId)}/advance-stage`,
    {
      sessionId,
      runId,
      jobId,
      ...payload
    }
  );
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

function recordWithStringFieldPrefix(value: unknown, field: string, prefix: string) {
  const match = records(value).find((item) => {
    const fieldValue = item[field];

    return typeof fieldValue === "string" && fieldValue.startsWith(prefix);
  });

  expect(match).toBeDefined();

  return match as Readonly<Record<string, unknown>>;
}

function stringField(record: Readonly<Record<string, unknown>>, field: string) {
  expect(typeof record[field]).toBe("string");

  return record[field] as string;
}

function responseData(body: JsonResponseBody) {
  expect(body.data, JSON.stringify(body)).toEqual(expect.any(Object));

  return body.data as Readonly<Record<string, unknown>>;
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

function executionAuthorityRequestFixture(
  sessionId: string,
  idSuffix: string,
  overrides: Readonly<Record<string, unknown>> = {}
) {
  return {
    sessionId,
    expectedStateVersion: 1,
    idempotencyKey: `phase3-closeout-exec-auth:${idSuffix}`,
    sourcePlanningHandoffRef: `planning_handoff_${idSuffix}`,
    boundedAgentOutput: {
      outputId: `bounded_output_${idSuffix}`,
      sourceRefs: [`planning_handoff_${idSuffix}`],
      intendedDecisionImpact: "Validate the Phase 3 closeout controlled execution dry-run.",
      proposedActionPreviewRefs: [`preview_${idSuffix}`],
      requiredApprovals: [`approval_${idSuffix}`],
      evidenceRefs: [`evidence_${idSuffix}`],
      failureMode: "ready_for_preview",
      noExecutionPolicy: "controlled_execution_required"
    },
    actionClass: "file_diff",
    previewArtifactRef: `preview_${idSuffix}`,
    previewArtifactHash: `sha256:${idSuffix}`,
    reviewedPreviewArtifactHash: `sha256:${idSuffix}`,
    requestedScope: {
      workspaceRef: "workspace:phase3-closeout",
      filePathGlobs: ["packages/**", "apps/**"]
    },
    approvalDecision: "approved",
    approver: {
      actorId: "phase3_closeout_owner",
      actorType: "user",
      approvedAt: "2026-05-13T00:00:00.000Z",
      decidedAt: "2026-05-13T00:00:00.000Z"
    },
    sandboxBoundary: {
      mode: "workspace_patch",
      networkPolicy: "blocked",
      secretPolicy: "no_secret_values"
    },
    rollbackReference: {
      kind: "git_diff_reverse",
      ref: `rollback_${idSuffix}`
    },
    evidenceRefs: [`phase3_closeout_evidence_${idSuffix}`],
    auditRefs: [`phase3_closeout_audit_${idSuffix}`],
    preconditionChecks: {
      planningSourceExists: true,
      previewArtifactExists: true,
      previewHashMatches: true,
      rollbackAvailable: true,
      credentialValueRequired: false,
      sandboxEnforced: true
    },
    ...overrides
  };
}

async function createExecutionAuthorityForE2e(
  app: ReturnType<typeof createSidecarApp>,
  sessionId: string,
  idSuffix: string,
  overrides: Readonly<Record<string, unknown>> = {}
) {
  const { response, body } = await postJson(
    app,
    `/api/v1/sessions/${sessionId}/execution-authority`,
    executionAuthorityRequestFixture(sessionId, idSuffix, overrides)
  );

  expect(response.status, JSON.stringify(body)).toBe(200);

  const data = responseData(body);
  const projection = record(data.immediateProjection);
  const latestRecord = record(projection.latestRecord);

  return {
    projection,
    recordId: stringField(latestRecord, "recordId")
  };
}

async function expectLatestExecutionAuthorityRecord(
  app: ReturnType<typeof createSidecarApp>,
  sessionId: string,
  latestRecord: Readonly<Record<string, unknown>>
) {
  const ledger = await getJson(app, `/api/v1/sessions/${sessionId}/execution-authority`);

  expect(ledger.response.status).toBe(200);
  expect(responseData(ledger.body)).toMatchObject({
    latestRecord
  });
}

async function expectAdapterResultAndLatestLedgerRecord(
  app: ReturnType<typeof createSidecarApp>,
  sessionId: string,
  result: Awaited<ReturnType<typeof postJson>>,
  expectedResult: Readonly<Record<string, unknown>>,
  expectedLatestRecord: Readonly<Record<string, unknown>>
) {
  expect(result.response.status).toBe(200);
  expect(responseData(result.body)).toMatchObject(expectedResult);
  await expectLatestExecutionAuthorityRecord(app, sessionId, expectedLatestRecord);
}

function fileDiffFixture(path: string, beforeLine: string, afterLine: string) {
  return [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    "@@ -1 +1 @@",
    `-${beforeLine}`,
    `+${afterLine}`,
    ""
  ].join("\n");
}

async function createLocalBrowserTargetServer(
  html = "<!doctype html><title>Solo phase 3 closeout</title><h1>Loopback target</h1>",
  path = "/phase3-closeout"
) {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Local browser target server did not expose a TCP address.");
  }

  return {
    targetUrl: `http://127.0.0.1:${address.port}${path}`,
    close: () =>
      new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => {
          if (error) {
            rejectClose(error);
            return;
          }

          resolveClose();
        });
      })
  };
}

const planningReadySpecVersionRef = "spec_version_e2e_closeout_ready";
const planningReadyQueueItemId = "queue_e2e_closeout_ready" as QueueItemId;
const planningReadyResearchTaskId = "research_task_e2e_closeout_ready" as ResearchTaskId;
const planningReadyResearchResultId = "research_result_e2e_closeout_ready" as ResearchResultId;
const planningReadyEvidencePackId = "evidence_pack_e2e_closeout_ready" as DecisionEvidencePackId;
const planningReadyEvidenceItemId = "evidence_item_e2e_closeout_ready" as EvidenceItemId;
const planningReadyProjectionVersion = 3 as ProjectionVersion;

function planningReadySourceRefs(sessionId: string): readonly PlanningHandoffSourceRefDto[] {
  return [
    {
      sourceType: "spec_version",
      sourceId: planningReadySpecVersionRef,
      sourceLabel: "E2E closeout ready SpecVersion",
      required: true,
      stale: false
    },
    {
      sourceType: "completion_candidate",
      sourceId: `completion_candidate:${sessionId}:3`,
      sourceLabel: "E2E closeout completion candidate",
      required: true,
      stale: false
    },
    {
      sourceType: "decision_linked_evidence_pack",
      sourceId: planningReadyEvidencePackId,
      sourceLabel: "E2E closeout Evidence Pack",
      required: true,
      stale: false
    },
    {
      sourceType: "research_updated_queue_item",
      sourceId: planningReadyQueueItemId,
      sourceLabel: "E2E closeout research queue card",
      required: true,
      stale: false
    }
  ];
}

async function seedPlanningReadyState(
  storage: Awaited<ReturnType<typeof createMigratedStorageApp>>["storage"],
  projectId: string,
  sessionId: string
) {
  const eventRepository = createEventRepository(storage.db);

  await eventRepository.append({
    eventId: `evt_e2e_closeout_spec_${sessionId}` as EventId,
    eventType: "SpecVersionCreated",
    projectId: projectId as ProjectId,
    sessionId: sessionId as SessionId,
    sourceCommandId: `cmd_e2e_closeout_spec_${sessionId}` as CommandId,
    correlationId: `corr_e2e_closeout_${sessionId}` as CorrelationId,
    causationId: null,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    occurredAt: "2026-05-06T00:01:00.000Z",
    payload: {
      versionRef: planningReadySpecVersionRef,
      title: "E2E closeout Planning Handoff ready spec",
      sections: ["Problem", "Customer", "Value", "Validation"]
    }
  });

  await eventRepository.append({
    eventId: `evt_e2e_closeout_evidence_${sessionId}` as EventId,
    eventType: "EvidenceSynthesized",
    projectId: projectId as ProjectId,
    sessionId: sessionId as SessionId,
    sourceCommandId: `cmd_e2e_closeout_evidence_${sessionId}` as CommandId,
    correlationId: `corr_e2e_closeout_${sessionId}` as CorrelationId,
    causationId: null,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    occurredAt: "2026-05-06T00:02:00.000Z",
    payload: {
      projection: {
        kind: "ResearchEvidenceProjection",
        version: planningReadyProjectionVersion,
        taskIds: [planningReadyResearchTaskId],
        tasks: [
          {
            researchTaskId: planningReadyResearchTaskId,
            sessionId: sessionId as SessionId,
            objective: "Validate final Planning Handoff closeout evidence.",
            routeOutcome: "research_needed",
            impact: "high",
            status: "evidence_ready",
            createdAt: "2026-05-06T00:01:30.000Z"
          }
        ],
        results: [
          {
            researchResultId: planningReadyResearchResultId,
            researchTaskId: planningReadyResearchTaskId,
            resultSummary: "Accepted evidence supports the final Planning Handoff closeout route.",
            sourceReliability: "high",
            claim: "The final Planning Handoff route can synthesize source-driven build slices.",
            decisionContext: "Planning Handoff closeout",
            importedAt: "2026-05-06T00:01:45.000Z"
          }
        ],
        evidenceMatrices: [
          {
            evidenceMatrixId: "evidence_matrix_e2e_closeout_ready",
            researchTaskId: planningReadyResearchTaskId,
            researchResultId: planningReadyResearchResultId,
            synthesisVersion: 1,
            proEvidence: [
              {
                evidenceItemId: planningReadyEvidenceItemId,
                kind: "pro",
                summary: "Closeout fixture has accepted evidence."
              }
            ],
            conEvidence: [],
            uncertainties: [],
            additionalQuestions: [],
            balanceStatus: "balanced",
            decisionBlocked: false
          }
        ],
        evidencePacks: [
          {
            evidencePackId: planningReadyEvidencePackId,
            researchTaskId: planningReadyResearchTaskId,
            researchResultId: planningReadyResearchResultId,
            claim: "The final Planning Handoff route can synthesize source-driven build slices.",
            decisionContext: "Planning Handoff closeout",
            sourceReliability: "high",
            retrievedAt: "2026-05-06T00:01:50.000Z",
            gateStatus: "accepted",
            gateChecks: [
              {
                code: "source_metadata",
                status: "passed",
                reason: "Source metadata is present."
              }
            ],
            proEvidenceItemIds: [planningReadyEvidenceItemId],
            conEvidenceItemIds: [],
            uncertaintyItemIds: [],
            limitationRefs: [],
            implicationScope: "Phase 2 Planning Handoff",
            createdAt: "2026-05-06T00:01:55.000Z"
          }
        ],
        reviewCards: [
          {
            cardId: planningReadyQueueItemId,
            researchTaskId: planningReadyResearchTaskId,
            evidencePackId: planningReadyEvidencePackId,
            cardType: "research_review",
            title: "E2E closeout Planning Handoff evidence",
            state: "resolved",
            impact: "high",
            gateStatus: "accepted",
            availableOutcomes: ["approved", "revised", "risk_accepted", "research_insufficient"],
            terminalOutcome: "approved",
            blocksPlanning: true,
            recoveryActions: ["approve_evidence"]
          }
        ],
        knownRisks: [],
        nextValidationActions: [],
        proConBalanceStatus: "balanced"
      },
      queueProjection: {
        kind: "DecisionQueueProjection",
        version: planningReadyProjectionVersion,
        active: [],
        next: [],
        blocked: [],
        deferred: [
          {
            queueItemId: planningReadyQueueItemId,
            title: "E2E closeout Planning Handoff evidence",
            state: "resolved",
            cardType: "research_review",
            researchTaskId: planningReadyResearchTaskId,
            evidencePackId: planningReadyEvidencePackId,
            blocksPlanning: true,
            availableOutcomes: ["approved", "revised", "risk_accepted", "research_insufficient"],
            terminalOutcome: "approved"
          }
        ]
      },
      confidenceProjection: {
        kind: "ConfidenceCompletionProjection",
        version: planningReadyProjectionVersion,
        compositeScore: 92,
        readinessLabel: "spec_ready",
        gates: [
          {
            gateId: "research_queue_cards",
            label: "Research-updated Queue cards terminal",
            passed: true
          }
        ],
        topRisks: [],
        topRiskCards: [],
        nextBestActions: ["Create Planning Handoff."],
        completionCandidate: {
          status: "candidate",
          summary: "Spec and research are ready for Planning Handoff.",
          gateFailures: [],
          ifStopNowArtifact: {
            title: "Planning Handoff candidate",
            summary: "Next build slice can be planned.",
            knownRisks: [],
            nextValidationActions: []
          }
        }
      }
    }
  });
}

async function createPlanningReadyHandoffForE2e(
  app: ReturnType<typeof createSidecarApp>,
  storage: Awaited<ReturnType<typeof createMigratedStorageApp>>["storage"],
  projectId: string,
  sessionId: string
) {
  await seedPlanningReadyState(storage, projectId, sessionId);

  const expectedStateVersion = (await createEventRepository(storage.db).listForSession(sessionId as SessionId)).length;
  const planningHandoff = await postJson(app, `/api/v1/sessions/${sessionId}/planning-handoff`, {
    sessionId,
    expectedStateVersion,
    sourceRefs: planningReadySourceRefs(sessionId)
  });

  expect(planningHandoff.response.status, JSON.stringify(planningHandoff.body)).toBe(200);

  const planningHandoffData = responseData(planningHandoff.body);
  const projection = record(planningHandoffData.immediateProjection);
  const finalArtifact = record(projection.finalArtifact);

  expect(projection.currentStatus).toBe("planning_ready");

  return stringField(finalArtifact, "artifactId");
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

  it("maps Phase 2 final/blocker Planning Handoff and tracker closeout evidence to executable labels", () => {
    expect(PHASE2_ACCEPTANCE_EVIDENCE_MAP.map((item) => item.scenario)).toEqual([
      "Scenario H. Phase 2 final Planning Handoff dry-run",
      "Scenario I. Phase 2 blocker Planning Handoff dry-run"
    ]);
    expect(PHASE2_ACCEPTANCE_EVIDENCE_MAP.every((item) => item.sourceDocs.length >= 3)).toBe(true);
    expect(PHASE2_ACCEPTANCE_EVIDENCE_MAP.flatMap((item) => item.runtimeEvidence)).toEqual(
      expect.arrayContaining([
        "PlanningHandoffArtifact",
        "PlanningHandoffBlockerArtifact",
        "must_not_use_planning_ready_label",
        "no_file_shell_browser_deploy_or_external_mutation"
      ])
    );
    expect(PHASE1_2_CLOSEOUT_EVIDENCE.map((item) => item.issue)).toEqual([
      "#66",
      "#67",
      "#68",
      "#69",
      "#70",
      "#71",
      "#74",
      "#75"
    ]);
    expect(PHASE1_2_CLOSEOUT_EVIDENCE.flatMap((item) => item.evidence)).toEqual(
      expect.arrayContaining([
        "canonical 12-section Living Spec",
        "missed-SSE recovery",
        "metadata_only_no_execution",
        "final/blocker Planning Handoff projection",
        "docs/35 closeout report"
      ])
    );
  });

  it("maps Phase 3 closeout evidence to approved and blocked controlled execution labels", () => {
    expect(PHASE3_CLOSEOUT_EVIDENCE.map((item) => item.issue)).toEqual([
      "#92",
      "#93",
      "#94",
      "#95",
      "#96",
      "#97"
    ]);
    expect(PHASE3_CLOSEOUT_DRY_RUN_EVIDENCE_MAP.map((item) => item.scenario)).toEqual([
      "Scenario J. Phase 3 approved controlled execution dry-run",
      "Scenario K. Phase 3 blocked unsafe execution dry-run"
    ]);
    expect(PHASE3_CLOSEOUT_DRY_RUN_EVIDENCE_MAP.flatMap((item) => item.runtimeEvidence)).toEqual(
      expect.arrayContaining([
        "ExecutionAuthorityLedgerProjection.ready_for_execution",
        "FileDiffExecutionResult.completed",
        "ShellCommandExecutionResult.completed",
        "BrowserActionExecutionResult.completed",
        "credential custody blocked",
        "destructive shell command blocked",
        "external-production mutation blocked",
        "blanket approval blocked"
      ])
    );
  });

  it("completes one auto implementation issue slice through the worker run and stage-advance route path", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const { app, storage } = await createMigratedStorageApp({
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { projectId, sessionId } = await createProjectForE2e(
        app,
        "A dry-run issue slice should complete through the local worker runner."
      );
      const sourcePlanningRef = await createPlanningReadyHandoffForE2e(app, storage, projectId, sessionId);
      const createdRun = await postAutoImplementationRunForE2e(app, sessionId, {
        idempotencyKey: "auto-implementation-e2e:worker-ui-run",
        projectName: "Worker UI E2E Demo",
        sourcePlanningRef
      });
      const createdRunProjection = responseData(createdRun.body);
      const latestRun = record(createdRunProjection.latestRun);
      const runId = stringField(latestRun, "runId");
      const authorityExpectedStateVersion = (await createEventRepository(storage.db).listForSession(
        sessionId as SessionId
      )).length;
      const authority = await createExecutionAuthorityForE2e(app, sessionId, "worker_ui_e2e", {
        expectedStateVersion: authorityExpectedStateVersion,
        requestedScope: {
          workspaceRef: join(workspaceRoot, "worker-ui-e2e-demo"),
          filePathGlobs: ["**/*"]
        }
      });
      const plannedJob = await postAutoImplementationWorkerJobForE2e(app, sessionId, runId, {
        idempotencyKey: "worker-ui-e2e:plan",
        executionAuthorityRef: authority.recordId
      });
      const plannedRun = record(responseData(plannedJob.body).latestRun);
      const plannedJobs = records(plannedRun.workerJobs);
      const plannedJobId = stringField(plannedJobs.at(-1)!, "jobId");
      const ranJob = await postAutoImplementationWorkerRunForE2e(app, sessionId, runId, plannedJobId, {
        idempotencyKey: "worker-ui-e2e:run",
        evidenceRefs: [`ui-worker-run:${plannedJobId}`]
      });
      const runAfterWorker = record(responseData(ranJob.body).latestRun);
      const runAfterWorkerJobs = records(runAfterWorker.workerJobs);
      const ledgerAfterWorker = await getJson(app, `/api/v1/sessions/${sessionId}/implementation-step-ledger`);
      const expectedWorkerStepId = `auto-implementation-step:${runId}:initial_pr:local-001`;
      const advanced = await postAutoImplementationWorkerStageAdvanceForE2e(app, sessionId, runId, plannedJobId, {
        idempotencyKey: "worker-ui-e2e:advance",
        tickedAt: "2026-05-22T00:10:00.000Z",
        evidenceRefs: [`ui-worker-stage-advance:${plannedJobId}`]
      });
      const advancedRun = record(responseData(advanced.body).latestRun);
      const advancedStages = records(advancedRun.stagePlan);

      expect(createdRun.response.status, JSON.stringify(createdRun.body)).toBe(200);
      expect(plannedJob.response.status, JSON.stringify(plannedJob.body)).toBe(200);
      expect(ranJob.response.status, JSON.stringify(ranJob.body)).toBe(200);
      expect(runAfterWorker).toMatchObject({
        status: "running",
        currentStage: "initial_pr"
      });
      expect(runAfterWorkerJobs.at(-1)).toMatchObject({
        status: "completed",
        missingEvidence: [],
        blockedReason: null,
        evidenceRefs: expect.arrayContaining([
          `auto-worker-run:${plannedJobId}:worker-ui-e2e:run`,
          `auto-worker-ledger-import:${plannedJobId}:worker-ui-e2e:run:ledger-import`,
          `codex-worker:${plannedJobId}:fixture`,
          "codex-worker:fixture:completed",
          `implementation-step-ledger:${expectedWorkerStepId}`,
          "commit:abcdef1",
          "test:verify",
          `ui-worker-run:${plannedJobId}`
        ])
      });
      expect(ledgerAfterWorker.response.status, JSON.stringify(ledgerAfterWorker.body)).toBe(200);
      expect(responseData(ledgerAfterWorker.body)).toMatchObject({
        kind: "ImplementationStepLedgerProjection",
        currentStatus: "completed",
        steps: expect.arrayContaining([
          expect.objectContaining({
            status: "completed",
            stepDoc: expect.objectContaining({
              stepId: expectedWorkerStepId
            })
          })
        ])
      });
      expect(advanced.response.status, JSON.stringify(advanced.body)).toBe(200);
      expect(advancedRun).toMatchObject({
        status: "running",
        currentStage: "code_review_fix_1"
      });
      expect(advancedStages[0]).toMatchObject({
        stage: "initial_pr",
        status: "completed",
        ledgerEvidence: {
          implementationStepId: expectedWorkerStepId,
          evidenceRefs: expect.arrayContaining([
            `implementation-step-ledger:${expectedWorkerStepId}`,
            "commit:abcdef1",
            "test:verify"
          ])
        },
        evidenceRefs: expect.arrayContaining([
          `auto-worker-stage-advance:${plannedJobId}:worker-ui-e2e:advance`,
          `ui-worker-stage-advance:${plannedJobId}`,
          "codex-worker:fixture:completed"
        ])
      });
      expect(advancedStages[1]).toMatchObject({
        stage: "code_review_fix_1",
        status: "ready"
      });
    } finally {
      await storage.close();
    }
  });

  it("runs a business critic dry-run sample for each explicit intensity", async () => {
    const { app, storage } = await createMigratedStorageApp();

    try {
      for (const intensity of ["balanced", "strong", "investor_grade"] as const) {
        const start = await postJson(app, "/api/v1/projects", {
          rawIdea: `A ${intensity} founder business critic dry-run idea`,
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed",
          businessCriticIntensity: intensity,
          businessCriticIntensityConfirmation: "user_confirmed",
          businessCriticIntensityReason: `E2E dry-run sample for ${intensity}.`
        });
        const startData = responseData(start.body);
        const sessionId = sessionIdFromStart(startData);

        expect(start.response.status).toBe(200);
        expect(record(startData.immediateProjection)).toMatchObject({
          projectPurposeMode: "business",
          businessCriticIntensity: intensity,
          businessCriticIntensitySelectionStatus: "confirmed"
        });

        const intake = await postJson(app, `/api/v1/sessions/${sessionId}/intake`, {
          expectedStateVersion: stateVersionAfter(startData),
          answer: `Validate the ${intensity} business critic path.`
        });
        const draft = await postJson(app, `/api/v1/sessions/${sessionId}/spec/initial`, {
          expectedStateVersion: stateVersionAfter(responseData(intake.body))
        });
        const analyze = await postJson(app, `/api/v1/sessions/${sessionId}/spec/analyze`, {
          expectedStateVersion: stateVersionAfter(responseData(draft.body)),
          targetRef: "current_spec",
          generatedQuestionSet: generatedFounderQuestionSet(intensity)
        });
        const analyzeData = responseData(analyze.body);
        const activate = await postJson(app, `/api/v1/sessions/${sessionId}/queue/activate`, {
          expectedStateVersion: stateVersionAfter(analyzeData)
        });
        const queue = record(responseData(activate.body).immediateProjection);
        const nextItems = records(queue.next);

        expect(intake.response.status).toBe(200);
        expect(draft.response.status).toBe(200);
        expect(analyze.response.status).toBe(200);
        expect(activate.response.status).toBe(200);
        expect(queue).toMatchObject({
          kind: "DecisionQueueProjection",
          businessCriticIntensity: intensity,
          businessCriticIntensitySelectionStatus: "confirmed"
        });
        expect(records(queue.active)).toHaveLength(1);
        expect(analyzeData).toMatchObject({
          deterministicOutputs: [
            expect.objectContaining({
              outputType: "ambiguity_analysis",
              payload: expect.objectContaining({
                issueCount: intensity === "balanced" ? 19 : intensity === "strong" ? 20 : 22
              })
            })
          ]
        });

        if (intensity === "balanced") {
          expect(nextItems).toEqual([]);
        } else if (intensity === "strong") {
          expect([...records(queue.active), ...nextItems]).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                businessCriticPressureKind: "core_assumption_challenge"
              })
            ])
          );
        } else {
          expect(nextItems).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                businessCriticPressureKind: "investor_pressure_pass"
              })
            ])
          );
        }
      }
    } finally {
      await storage.close();
    }
  });

  it("runs Phase 3 approved and blocked controlled execution through the same authority ledger", async () => {
    const { app, storage } = await createMigratedStorageApp();
    let localTarget: Awaited<ReturnType<typeof createLocalBrowserTargetServer>> | undefined;

    try {
      const workspaceRoot = await makeTempAppDataDir();

      await mkdir(join(workspaceRoot, "packages/contracts/src"), { recursive: true });
      await writeFile(join(workspaceRoot, "packages/contracts/src/phase3-closeout-target.ts"), "export const value = 1;\n");
      await writeFile(join(workspaceRoot, "README.md"), "phase 3 closeout workspace\n");
      execFileSync("git", ["init"], { cwd: workspaceRoot, stdio: "ignore" });
      localTarget = await createLocalBrowserTargetServer();

      const start = await postJson(app, "/api/v1/projects", {
        rawIdea: "A Phase 3 closeout controlled execution dry-run idea",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "balanced",
        businessCriticIntensityConfirmation: "user_confirmed"
      });
      const sessionId = sessionIdFromStart(responseData(start.body));
      let expectedStateVersion = 1;
      const nextExpectedStateVersion = () => expectedStateVersion++;

      const fileDiff = fileDiffFixture(
        "packages/contracts/src/phase3-closeout-target.ts",
        "export const value = 1;",
        "export const value = 2;"
      );
      const fileDiffHash = hashFileDiffPreview(fileDiff);
      const { projection: fileDiffProjection, recordId: fileDiffRecordId } = await createExecutionAuthorityForE2e(
        app,
        sessionId,
        "phase3_file_diff_completed",
        {
          expectedStateVersion: nextExpectedStateVersion(),
          previewArtifactHash: fileDiffHash,
          reviewedPreviewArtifactHash: fileDiffHash,
          requestedScope: {
            workspaceRef: `workspace:${workspaceRoot}`,
            filePathGlobs: ["packages/contracts/src/**"]
          }
        }
      );

      expect(fileDiffProjection).toMatchObject({
        kind: "ExecutionAuthorityLedgerProjection",
        currentStatus: "ready_for_execution"
      });

      const fileDiffResult = await postJson(app, `/api/v1/execution-authorities/${fileDiffRecordId}/file-diff`, {
        sessionId,
        idempotencyKey: "phase3-closeout:file-diff:completed",
        previewArtifactHash: fileDiffHash,
        ...phase3CloseoutExecutionWindow,
        workspaceRoot,
        unifiedDiff: fileDiff
      });

      await expectAdapterResultAndLatestLedgerRecord(
        app,
        sessionId,
        fileDiffResult,
        {
          kind: "FileDiffExecutionResult",
          authorityRecordId: fileDiffRecordId,
          status: "completed",
          rollbackReference: {
            kind: "git_diff_reverse"
          },
          evidenceRefs: expect.arrayContaining([
            expect.stringContaining("file_diff:changed_files:packages/contracts/src/phase3-closeout-target.ts")
          ]),
          auditRefs: expect.arrayContaining(["audit:file_diff:phase3-closeout:file-diff:completed"])
        },
        {
          recordId: fileDiffRecordId,
          executionResult: "completed",
          evidenceRefs: expect.arrayContaining([
            expect.stringContaining("file_diff:changed_files:packages/contracts/src/phase3-closeout-target.ts")
          ]),
          auditRefs: expect.arrayContaining(["audit:file_diff:phase3-closeout:file-diff:completed"])
        }
      );

      const secretDiff = fileDiffFixture("packages/secrets.env", "SECRET=old", "SECRET=new");
      const secretDiffHash = hashFileDiffPreview(secretDiff);
      const { recordId: blockedFileDiffRecordId } = await createExecutionAuthorityForE2e(
        app,
        sessionId,
        "phase3_file_diff_blocked",
        {
          expectedStateVersion: nextExpectedStateVersion(),
          previewArtifactHash: secretDiffHash,
          reviewedPreviewArtifactHash: secretDiffHash,
          requestedScope: {
            workspaceRef: `workspace:${workspaceRoot}`,
            filePathGlobs: ["packages/contracts/src/**"]
          }
        }
      );
      const blockedFileDiff = await postJson(
        app,
        `/api/v1/execution-authorities/${blockedFileDiffRecordId}/file-diff`,
        {
          sessionId,
          idempotencyKey: "phase3-closeout:file-diff:blocked",
          previewArtifactHash: secretDiffHash,
          ...phase3CloseoutExecutionWindow,
          workspaceRoot,
          unifiedDiff: secretDiff
        }
      );

      await expectAdapterResultAndLatestLedgerRecord(
        app,
        sessionId,
        blockedFileDiff,
        {
          kind: "FileDiffExecutionResult",
          status: "blocked",
          blockReasons: expect.arrayContaining([
            expect.objectContaining({ code: "sandbox_failure" }),
            expect.objectContaining({ code: "credential_value_required" })
          ])
        },
        {
          recordId: blockedFileDiffRecordId,
          executionResult: "blocked",
          blockReasons: expect.arrayContaining([
            expect.objectContaining({ code: "sandbox_failure" }),
            expect.objectContaining({ code: "credential_value_required" })
          ]),
          evidenceRefs: expect.arrayContaining(["file_diff:sensitive_path:packages/secrets.env"]),
          auditRefs: expect.arrayContaining(["audit:file_diff:phase3-closeout:file-diff:blocked"])
        }
      );

      const shellCommand = ["git", "status", "--short"] as const;
      const shellHash = hashShellCommandPreview({ command: shellCommand });
      const { recordId: shellRecordId } = await createExecutionAuthorityForE2e(
        app,
        sessionId,
        "phase3_shell_completed",
        {
          expectedStateVersion: nextExpectedStateVersion(),
          actionClass: "shell_command",
          previewArtifactHash: shellHash,
          reviewedPreviewArtifactHash: shellHash,
          requestedScope: {
            workspaceRef: `workspace:${workspaceRoot}`,
            commandAllowlistRef: "shell_command:default",
            maxDurationMs: 1_000
          },
          sandboxBoundary: {
            mode: "command_sandbox",
            networkPolicy: "blocked",
            secretPolicy: "no_secret_values"
          },
          rollbackReference: {
            kind: "command_compensating_action",
            ref: "rollback_phase3_shell_completed"
          }
        }
      );
      const shellResult = await postJson(app, `/api/v1/execution-authorities/${shellRecordId}/shell-command`, {
        sessionId,
        idempotencyKey: "phase3-closeout:shell:completed",
        previewArtifactHash: shellHash,
        ...phase3CloseoutExecutionWindow,
        workspaceRoot,
        command: shellCommand
      });

      await expectAdapterResultAndLatestLedgerRecord(
        app,
        sessionId,
        shellResult,
        {
          kind: "ShellCommandExecutionResult",
          authorityRecordId: shellRecordId,
          status: "completed",
          command: {
            executable: "git",
            commandClass: "diagnostic",
            timedOut: false
          },
          evidenceRefs: expect.arrayContaining([expect.stringContaining("shell_command:exit_code:0")]),
          auditRefs: expect.arrayContaining(["audit:shell_command:phase3-closeout:shell:completed"])
        },
        {
          recordId: shellRecordId,
          executionResult: "completed",
          evidenceRefs: expect.arrayContaining([expect.stringContaining("shell_command:exit_code:0")]),
          auditRefs: expect.arrayContaining(["audit:shell_command:phase3-closeout:shell:completed"])
        }
      );

      const destructiveCommand = ["rm", "-rf", "."] as const;
      const destructiveHash = hashShellCommandPreview({ command: destructiveCommand });
      const { recordId: destructiveRecordId } = await createExecutionAuthorityForE2e(
        app,
        sessionId,
        "phase3_shell_blocked",
        {
          expectedStateVersion: nextExpectedStateVersion(),
          actionClass: "shell_command",
          previewArtifactHash: destructiveHash,
          reviewedPreviewArtifactHash: destructiveHash,
          requestedScope: {
            workspaceRef: `workspace:${workspaceRoot}`,
            commandAllowlistRef: "shell_command:default",
            maxDurationMs: 1_000
          },
          sandboxBoundary: {
            mode: "command_sandbox",
            networkPolicy: "blocked",
            secretPolicy: "no_secret_values"
          },
          rollbackReference: {
            kind: "command_compensating_action",
            ref: "rollback_phase3_shell_blocked"
          }
        }
      );
      const blockedShell = await postJson(app, `/api/v1/execution-authorities/${destructiveRecordId}/shell-command`, {
        sessionId,
        idempotencyKey: "phase3-closeout:shell:blocked",
        previewArtifactHash: destructiveHash,
        ...phase3CloseoutExecutionWindow,
        workspaceRoot,
        command: destructiveCommand
      });

      await expectAdapterResultAndLatestLedgerRecord(
        app,
        sessionId,
        blockedShell,
        {
          kind: "ShellCommandExecutionResult",
          status: "blocked",
          blockReasons: expect.arrayContaining([
            expect.objectContaining({
              code: "sandbox_failure"
            })
          ])
        },
        {
          recordId: destructiveRecordId,
          executionResult: "blocked",
          blockReasons: expect.arrayContaining([
            expect.objectContaining({
              code: "sandbox_failure"
            })
          ]),
          evidenceRefs: expect.arrayContaining(["shell_command:sandbox_failure"]),
          auditRefs: expect.arrayContaining(["audit:shell_command:phase3-closeout:shell:blocked"])
        }
      );

      const browserAction = {
        kind: "navigate_and_capture",
        visibleAction: true,
        credentialMode: "none",
        externalMutation: "blocked"
      } as const satisfies BrowserActionPreviewDto;
      const browserHash = hashBrowserActionPreview({ targetUrl: localTarget.targetUrl, action: browserAction });
      const { recordId: browserRecordId } = await createExecutionAuthorityForE2e(
        app,
        sessionId,
        "phase3_browser_completed",
        {
          expectedStateVersion: nextExpectedStateVersion(),
          actionClass: "browser_action",
          previewArtifactHash: browserHash,
          reviewedPreviewArtifactHash: browserHash,
          requestedScope: {
            browserTargetRef: `browser_target:${new URL(localTarget.targetUrl).origin}`,
            maxDurationMs: 1_000
          },
          sandboxBoundary: {
            mode: "browser_preview_session",
            networkPolicy: "loopback_only",
            secretPolicy: "no_secret_values"
          },
          rollbackReference: {
            kind: "browser_state_reset",
            ref: "rollback_phase3_browser_completed"
          }
        }
      );
      const browserResult = await postJson(app, `/api/v1/execution-authorities/${browserRecordId}/browser-action`, {
        sessionId,
        idempotencyKey: "phase3-closeout:browser:completed",
        previewArtifactHash: browserHash,
        ...phase3CloseoutExecutionWindow,
        targetUrl: localTarget.targetUrl,
        action: browserAction
      });

      await expectAdapterResultAndLatestLedgerRecord(
        app,
        sessionId,
        browserResult,
        {
          kind: "BrowserActionExecutionResult",
          authorityRecordId: browserRecordId,
          status: "completed",
          target: {
            hostname: "127.0.0.1"
          },
          screenshotRefs: expect.arrayContaining(["browser_action:screenshot:phase3-closeout:browser:completed"]),
          logRefs: expect.arrayContaining([expect.stringContaining("browser_action:log:phase3-closeout:browser:completed")]),
          rollbackReference: {
            kind: "browser_state_reset"
          },
          evidenceRefs: expect.arrayContaining([
            expect.stringContaining("browser_action:http_status:200"),
            "browser_action:screenshot:phase3-closeout:browser:completed"
          ]),
          auditRefs: expect.arrayContaining(["audit:browser_action:phase3-closeout:browser:completed"])
        },
        {
          recordId: browserRecordId,
          executionResult: "completed",
          evidenceRefs: expect.arrayContaining([
            expect.stringContaining("browser_action:http_status:200"),
            "browser_action:screenshot:phase3-closeout:browser:completed"
          ]),
          auditRefs: expect.arrayContaining(["audit:browser_action:phase3-closeout:browser:completed"])
        }
      );

      const externalTargetUrl = "https://example.com/phase3-closeout";
      const externalHash = hashBrowserActionPreview({ targetUrl: externalTargetUrl, action: browserAction });
      const { recordId: externalBrowserRecordId } = await createExecutionAuthorityForE2e(
        app,
        sessionId,
        "phase3_browser_blocked",
        {
          expectedStateVersion: nextExpectedStateVersion(),
          actionClass: "browser_action",
          previewArtifactHash: externalHash,
          reviewedPreviewArtifactHash: externalHash,
          requestedScope: {
            browserTargetRef: "browser_target:https://example.com",
            maxDurationMs: 1_000
          },
          sandboxBoundary: {
            mode: "browser_preview_session",
            networkPolicy: "loopback_only",
            secretPolicy: "no_secret_values"
          },
          rollbackReference: {
            kind: "browser_state_reset",
            ref: "rollback_phase3_browser_blocked"
          }
        }
      );
      const blockedBrowser = await postJson(
        app,
        `/api/v1/execution-authorities/${externalBrowserRecordId}/browser-action`,
        {
          sessionId,
          idempotencyKey: "phase3-closeout:browser:blocked",
          previewArtifactHash: externalHash,
          ...phase3CloseoutExecutionWindow,
          targetUrl: externalTargetUrl,
          action: browserAction
        }
      );

      await expectAdapterResultAndLatestLedgerRecord(
        app,
        sessionId,
        blockedBrowser,
        {
          kind: "BrowserActionExecutionResult",
          status: "blocked",
          blockReasons: expect.arrayContaining([
            expect.objectContaining({
              code: "sandbox_failure",
              message: expect.stringContaining("loopback HTTP")
            })
          ])
        },
        {
          recordId: externalBrowserRecordId,
          executionResult: "blocked",
          blockReasons: expect.arrayContaining([
            expect.objectContaining({
              code: "sandbox_failure"
            })
          ]),
          evidenceRefs: expect.arrayContaining(["browser_action:sandbox_failure"]),
          auditRefs: expect.arrayContaining(["audit:browser_action:phase3-closeout:browser:blocked"])
        }
      );
    } finally {
      await localTarget?.close();
      await storage.close();
    }
  });

  it("runs ChatGPT Pro local browser delegation preflight with mocked ChatGPT page states", async () => {
    const { app, storage } = await createMigratedStorageApp();
    let mockChatGptTarget: Awaited<ReturnType<typeof createLocalBrowserTargetServer>> | undefined;

    try {
      mockChatGptTarget = await createLocalBrowserTargetServer(
        [
          "<!doctype html>",
          "<title>Mock ChatGPT ready state</title>",
          "<main data-chatgpt-page-state=\"ready\">User-owned ChatGPT browser session mock</main>"
        ].join(""),
        "/mock-chatgpt/ready"
      );

      const start = await postJson(app, "/api/v1/projects", {
        rawIdea: "A ChatGPT delegation dry-run idea",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "balanced",
        businessCriticIntensityConfirmation: "user_confirmed"
      });
      const sessionId = sessionIdFromStart(responseData(start.body));
      const research = await postJson(app, `/api/v1/sessions/${sessionId}/research-tasks`, {
        expectedStateVersion: 1,
        objective: "Use a user-approved ChatGPT Pro browser session to gather deeper competitor counter-evidence.",
        sourceQueueItemId: "queue_chatgpt_delegation_e2e",
        routeOutcome: "missing_con_evidence",
        impact: "high"
      });
      const researchData = responseData(research.body) as Readonly<Record<string, unknown>>;
      const researchOutput = (researchData.deterministicOutputs as readonly Readonly<Record<string, unknown>>[])[0];

      if (!researchOutput) {
        throw new Error("research task command should emit a deterministic output");
      }

      const researchTaskId = researchOutput.outputRef as string;
      const browserAction = {
        kind: "navigate_and_capture",
        visibleAction: true,
        credentialMode: "none",
        externalMutation: "blocked"
      } as const satisfies BrowserActionPreviewDto;
      const browserHash = hashBrowserActionPreview({ targetUrl: mockChatGptTarget.targetUrl, action: browserAction });
      const { recordId: browserRecordId } = await createExecutionAuthorityForE2e(
        app,
        sessionId,
        "post_phase3_chatgpt_mock_ready",
        {
          expectedStateVersion: 2,
          actionClass: "browser_action",
          previewArtifactHash: browserHash,
          reviewedPreviewArtifactHash: browserHash,
          requestedScope: {
            browserTargetRef: `browser_target:${new URL(mockChatGptTarget.targetUrl).origin}`,
            maxDurationMs: 1_000
          },
          sandboxBoundary: {
            mode: "browser_preview_session",
            networkPolicy: "loopback_only",
            secretPolicy: "no_secret_values"
          },
          rollbackReference: {
            kind: "browser_state_reset",
            ref: "rollback_post_phase3_chatgpt_mock_ready"
          }
        }
      );
      const browserResult = await postJson(app, `/api/v1/execution-authorities/${browserRecordId}/browser-action`, {
        sessionId,
        idempotencyKey: "post-phase3:chatgpt-mock:browser-ready",
        previewArtifactHash: browserHash,
        ...phase3CloseoutExecutionWindow,
        targetUrl: mockChatGptTarget.targetUrl,
        action: browserAction
      });
      const browserData = responseData(browserResult.body) as Readonly<Record<string, unknown>>;

      expect(browserData).toMatchObject({
        kind: "BrowserActionExecutionResult",
        status: "completed",
        target: {
          hostname: "127.0.0.1"
        },
        evidenceRefs: expect.arrayContaining([expect.stringContaining("browser_action:http_status:200")])
      });

      const readyDelegation = await postJson(app, `/api/v1/sessions/${sessionId}/chatgpt-browser-delegations`, {
        sessionId,
        expectedStateVersion: 3,
        idempotencyKey: "post-phase3:chatgpt-delegation:ready",
        researchTaskId,
        promptPreviewRef: "prompt_preview_chatgpt_e2e_ready",
        dataDisclosurePreview: {
          disclosurePreviewRef: "disclosure_preview_chatgpt_e2e_ready",
          promptContextSummaryRef: "context_summary_chatgpt_e2e_ready",
          redactedPromptPreviewRef: "redacted_prompt_chatgpt_e2e_ready",
          excludedSensitiveFieldKinds: ["credential", "session", "secret", "2fa", "payment", "legal_sensitive"],
          redactionPreviewShown: true,
          userCanEditPromptBeforeRun: true
        },
        redactionSummary: {
          redactionPreviewRef: "redaction_preview_chatgpt_e2e_ready",
          redactedFieldKinds: ["credential", "session", "secret", "2fa", "payment", "legal_sensitive"],
          retainedArtifactKinds: ["prompt", "imported_result", "screenshot", "log"],
          defaultRetention: "prompt_result_screenshot_log",
          forbiddenRetentionPolicy: "no_credential_session_secret_2fa_payment_or_legal_sensitive_fields",
          userExportDeleteControls: true,
          deletionLeavesAuditMetadataOnly: true
        },
        policyRiskVerdict: {
          verdict: "pass",
          rationale: "One research task, per-run approval, user-owned local session, no account sharing, resale, backend, or unattended queue.",
          evidenceRefs: ["policy:chatgpt-pro:per-run", POST_PHASE3_CHATGPT_DELEGATION_DRY_RUN_EVIDENCE.issue]
        },
        sessionOwnershipVerdict: {
          verdict: "pass",
          rationale: "The browser page state is a local mock of a user-owned ChatGPT session; no credential/session custody is requested.",
          evidenceRefs: ["session:owner-confirmed", "mock-chatgpt-page-state:ready"]
        },
        approvalDecision: "approved",
        browserActionAuthorityRef: browserRecordId,
        screenshotRefs: browserData.screenshotRefs as readonly string[],
        logRefs: browserData.logRefs as readonly string[],
        auditRefs: [
          "audit:chatgpt-browser-delegation:e2e-ready",
          ...((browserData.auditRefs as readonly string[] | undefined) ?? [])
        ]
      });

      expect(responseData(readyDelegation.body)).toMatchObject({
        category: "accepted_with_projection",
        stateVersionBefore: 3,
        stateVersionAfter: 4,
        immediateProjection: {
          kind: "ChatGptBrowserDelegationProjection",
          currentStatus: "running",
          latestRun: {
            researchTaskId,
            browserActionAuthorityRef: browserRecordId,
            blockReasons: []
          }
        }
      });

      const readyRunId = (responseData(readyDelegation.body) as {
        readonly immediateProjection: { readonly latestRun: { readonly runId: string } };
      }).immediateProjection.latestRun.runId;
      const revokedDelegation = await postJson(
        app,
        `/api/v1/sessions/${sessionId}/chatgpt-browser-delegations/${readyRunId}/revoke`,
        {
          sessionId,
          expectedStateVersion: 4,
          idempotencyKey: "post-phase3:chatgpt-delegation:revoked",
          runId: readyRunId,
          reason: "User revoked the mocked ChatGPT delegation run during the dry-run.",
          auditRefs: ["audit:chatgpt-browser-delegation:e2e-revoked"]
        }
      );

      expect(responseData(revokedDelegation.body)).toMatchObject({
        category: "accepted_with_projection",
        stateVersionBefore: 4,
        stateVersionAfter: 5,
        immediateProjection: {
          kind: "ChatGptBrowserDelegationProjection",
          currentStatus: "revoked",
          latestRun: {
            runId: readyRunId,
            canRevoke: false,
            blockReasons: expect.arrayContaining([expect.objectContaining({ code: "revoked_by_user" })])
          }
        }
      });

      const blockedDelegation = await postJson(app, `/api/v1/sessions/${sessionId}/chatgpt-browser-delegations`, {
        sessionId,
        expectedStateVersion: 5,
        idempotencyKey: "post-phase3:chatgpt-delegation:blocked",
        researchTaskId,
        promptPreviewRef: "prompt_preview_chatgpt_e2e_blocked",
        dataDisclosurePreview: {
          disclosurePreviewRef: "disclosure_preview_chatgpt_e2e_blocked",
          promptContextSummaryRef: "context_summary_chatgpt_e2e_blocked",
          redactedPromptPreviewRef: "redacted_prompt_chatgpt_e2e_blocked",
          excludedSensitiveFieldKinds: ["credential", "session", "secret", "2fa", "payment", "legal_sensitive"],
          redactionPreviewShown: true,
          userCanEditPromptBeforeRun: true
        },
        redactionSummary: {
          redactionPreviewRef: "redaction_preview_chatgpt_e2e_blocked",
          redactedFieldKinds: ["credential", "session", "secret", "2fa", "payment", "legal_sensitive"],
          retainedArtifactKinds: ["prompt", "imported_result", "screenshot", "log"],
          defaultRetention: "prompt_result_screenshot_log",
          forbiddenRetentionPolicy: "no_credential_session_secret_2fa_payment_or_legal_sensitive_fields",
          userExportDeleteControls: true,
          deletionLeavesAuditMetadataOnly: true
        },
        policyRiskVerdict: {
          verdict: "block",
          rationale: "Detected account sharing/resale backend semantics and unattended background queue risk.",
          evidenceRefs: ["policy:blocked:resale", "policy:blocked:unattended-queue"]
        },
        sessionOwnershipVerdict: {
          verdict: "block",
          rationale: "Credential/session custody would be required to proceed.",
          evidenceRefs: ["session:blocked:custody"]
        },
        approvalDecision: "pending",
        fallbackApplied: {
          lane: "manual_prompt_handoff",
          visibleState: "ChatGPT 브라우저 위임 대신 수동 프롬프트 전달이 필요합니다.",
          reason: "Policy and session custody gates blocked the run.",
          userAction: "Use manual prompt handoff or mark the research gap as Known Risk."
        },
        auditRefs: ["audit:chatgpt-browser-delegation:e2e-blocked"]
      });

      expect(responseData(blockedDelegation.body)).toMatchObject({
        category: "accepted_with_projection",
        stateVersionBefore: 5,
        stateVersionAfter: 6,
        immediateProjection: {
          kind: "ChatGptBrowserDelegationProjection",
          currentStatus: "blocked",
          latestRun: {
            fallbackApplied: {
              lane: "manual_prompt_handoff"
            },
            blockReasons: expect.arrayContaining([
              expect.objectContaining({ code: "policy_risk_blocked" }),
              expect.objectContaining({ code: "account_sharing_or_resale_risk" }),
              expect.objectContaining({ code: "unattended_queue_risk" }),
              expect.objectContaining({ code: "credential_or_session_custody_required" })
            ])
          }
        }
      });

      const failedDelegation = await postJson(app, `/api/v1/sessions/${sessionId}/chatgpt-browser-delegations`, {
        sessionId,
        expectedStateVersion: 6,
        idempotencyKey: "post-phase3:chatgpt-delegation:failed-import",
        researchTaskId,
        promptPreviewRef: "prompt_preview_chatgpt_e2e_failed",
        dataDisclosurePreview: {
          disclosurePreviewRef: "disclosure_preview_chatgpt_e2e_failed",
          promptContextSummaryRef: "context_summary_chatgpt_e2e_failed",
          redactedPromptPreviewRef: "redacted_prompt_chatgpt_e2e_failed",
          excludedSensitiveFieldKinds: ["credential", "session", "secret", "2fa", "payment", "legal_sensitive"],
          redactionPreviewShown: true,
          userCanEditPromptBeforeRun: true
        },
        redactionSummary: {
          redactionPreviewRef: "redaction_preview_chatgpt_e2e_failed",
          redactedFieldKinds: ["credential", "session", "secret", "2fa", "payment", "legal_sensitive"],
          retainedArtifactKinds: ["prompt", "imported_result", "screenshot", "log"],
          defaultRetention: "prompt_result_screenshot_log",
          forbiddenRetentionPolicy: "no_credential_session_secret_2fa_payment_or_legal_sensitive_fields",
          userExportDeleteControls: true,
          deletionLeavesAuditMetadataOnly: true
        },
        policyRiskVerdict: {
          verdict: "pass",
          rationale: "Per-run local research assist only.",
          evidenceRefs: ["policy:chatgpt-pro:per-run"]
        },
        sessionOwnershipVerdict: {
          verdict: "pass",
          rationale: "User-owned local browser session mock.",
          evidenceRefs: ["session:owner-confirmed"]
        },
        approvalDecision: "approved",
        browserActionAuthorityRef: browserRecordId,
        resultImportRef: "research_result_chatgpt_e2e_failed",
        resultImportGate: {
          sourceProvenanceStatus: "pass",
          uncertaintyStatus: "block",
          conEvidenceStatus: "block",
          staleRiskStatus: "pass",
          sourceRefs: ["chatgpt:conversation:hash-only"],
          uncertaintyRefs: ["uncertainty:missing"],
          conEvidenceRefs: ["con:evidence:missing"],
          staleRiskRefs: ["stale-risk:checked"],
          importRationale: "Mocked ChatGPT output missed uncertainty and counter-evidence gates."
        },
        fallbackApplied: {
          lane: "manual_prompt_handoff",
          visibleState: "ChatGPT 결과 가져오기는 수동 검토가 필요합니다.",
          reason: "Result import quality gates failed.",
          userAction: "Review the transcript manually before importing any result."
        },
        auditRefs: ["audit:chatgpt-browser-delegation:e2e-failed"]
      });

      expect(responseData(failedDelegation.body)).toMatchObject({
        category: "accepted_with_projection",
        stateVersionBefore: 6,
        stateVersionAfter: 7,
        immediateProjection: {
          kind: "ChatGptBrowserDelegationProjection",
          currentStatus: "failed",
          latestRun: {
            resultImportRef: "research_result_chatgpt_e2e_failed",
            fallbackApplied: {
              lane: "manual_prompt_handoff"
            },
            blockReasons: expect.arrayContaining([expect.objectContaining({ code: "result_import_gate_failed" })])
          }
        }
      });
    } finally {
      await mockChatGptTarget?.close();
      await storage.close();
    }
  });

  it("runs external service page-use permission dry-runs for read, fill, preview, revoke, and final-submit-blocked", async () => {
    const { app, storage } = await createMigratedStorageApp();
    let mockServiceTarget: Awaited<ReturnType<typeof createLocalBrowserTargetServer>> | undefined;

    try {
      mockServiceTarget = await createLocalBrowserTargetServer(
        [
          "<!doctype html>",
          "<title>Mock Vercel setup page</title>",
          "<main data-service-page-state=\"ready\">User-owned Vercel login mock with visible setup fields</main>"
        ].join(""),
        "/mock-vercel/setup"
      );

      const start = await postJson(app, "/api/v1/projects", {
        rawIdea: "An external service page-use permission dry-run idea",
        localPrivacyMode: "local_only",
        projectPurposeMode: "personal",
        projectPurposeModeConfirmation: "user_confirmed"
      });
      const sessionId = sessionIdFromStart(responseData(start.body));
      const currentExpectedStateVersion = async () =>
        (await createEventRepository(storage.db).listForSession(sessionId as SessionId)).length as StateVersion;
      const safeBrowserAction = {
        kind: "navigate_and_capture",
        visibleAction: true,
        credentialMode: "none",
        externalMutation: "blocked"
      } as const satisfies BrowserActionPreviewDto;
      const finalSubmitBrowserAction = {
        ...safeBrowserAction,
        externalMutation: "requested"
      } as const satisfies BrowserActionPreviewDto;

      async function createServicePageBrowserAuthority(
        idSuffix: string,
        action: BrowserActionPreviewDto = safeBrowserAction,
        servicePageScope: Readonly<{
          readonly permissionId?: string;
          readonly actionClass?: string;
          readonly serviceOrigin?: string;
          readonly servicePageUrl?: string;
        }> = {}
      ) {
        const browserHash = hashBrowserActionPreview({ targetUrl: mockServiceTarget!.targetUrl, action });
        const { projection, recordId: browserRecordId } = await createExecutionAuthorityForE2e(
          app,
          sessionId,
          idSuffix,
          {
            expectedStateVersion: await currentExpectedStateVersion(),
            actionClass: "browser_action",
            previewArtifactHash: browserHash,
            reviewedPreviewArtifactHash: browserHash,
            requestedScope: {
              browserTargetRef: `browser_target:${mockServiceTarget!.targetUrl}`,
              ...(servicePageScope.permissionId ? { servicePagePermissionId: servicePageScope.permissionId } : {}),
              ...(servicePageScope.actionClass ? { servicePageActionClass: servicePageScope.actionClass } : {}),
              ...(servicePageScope.serviceOrigin ? { serviceOrigin: servicePageScope.serviceOrigin } : {}),
              ...(servicePageScope.servicePageUrl ? { servicePageUrl: servicePageScope.servicePageUrl } : {}),
              maxDurationMs: 1_000
            },
            sandboxBoundary: {
              mode: "browser_preview_session",
              networkPolicy: "loopback_only",
              secretPolicy: "no_secret_values"
            },
            rollbackReference: {
              kind: "browser_state_reset",
              ref: `rollback_${idSuffix}`
            }
          }
        );
        const browserScope = record(record(projection).latestRecord).requestedScope;

        if (servicePageScope.permissionId || servicePageScope.actionClass) {
          expect(browserScope).toMatchObject({
            servicePagePermissionId: servicePageScope.permissionId,
            servicePageActionClass: servicePageScope.actionClass,
            serviceOrigin: servicePageScope.serviceOrigin,
            servicePageUrl: servicePageScope.servicePageUrl
          });
        }

        return {
          browserHash,
          browserRecordId,
          ...(servicePageScope.permissionId ? { servicePagePermissionId: servicePageScope.permissionId } : {}),
          ...(servicePageScope.actionClass ? { servicePageActionClass: servicePageScope.actionClass } : {})
        };
      }

      async function runServicePageBrowserAction(input: {
        readonly browserRecordId: string;
        readonly browserHash: string;
        readonly idempotencyKey: string;
        readonly action?: BrowserActionPreviewDto;
        readonly servicePagePermissionId?: string;
        readonly servicePageActionClass?: string;
      }) {
        return postJson(app, `/api/v1/execution-authorities/${input.browserRecordId}/browser-action`, {
          sessionId,
          idempotencyKey: input.idempotencyKey,
          previewArtifactHash: input.browserHash,
          ...phase3CloseoutExecutionWindow,
          targetUrl: mockServiceTarget!.targetUrl,
          action: input.action ?? safeBrowserAction,
          ...(input.servicePagePermissionId ? { servicePagePermissionId: input.servicePagePermissionId } : {}),
          ...(input.servicePageActionClass ? { servicePageActionClass: input.servicePageActionClass } : {})
        });
      }

      const missingPermissionAuthority = await createServicePageBrowserAuthority(
        "service_page_missing_permission",
        safeBrowserAction,
        {
          permissionId: "service_page_permission_missing",
          actionClass: "read",
          serviceOrigin: "https://vercel.com",
          servicePageUrl: "https://vercel.com/new"
        }
      );
      const missingPermissionBrowser = await runServicePageBrowserAction({
        ...missingPermissionAuthority,
        idempotencyKey: "post-phase3:service-page:browser-missing-permission"
      });

      expect(responseData(missingPermissionBrowser.body)).toMatchObject({
        kind: "BrowserActionExecutionResult",
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({ code: "service_page_permission_required" })
        ])
      });

      const servicePermissionBase = {
        sessionId,
        serviceName: "Vercel",
        serviceOrigin: "https://vercel.com",
        pageUrl: "https://vercel.com/new",
        purpose: "Use a user-present Vercel setup page to read and preview deployment settings.",
        blockedActionClasses: SERVICE_PAGE_USE_PERMISSION_BLOCKED_ACTION_CLASSES,
        dataCategories: ["public_page_content", "user_provided_project_context", "prompt_result_screenshot_log_refs"],
        approvalDecision: "approved",
        userApprovalRef: "user_approval:service-page:e2e",
        promptPreviewRef: "prompt_preview_service_page_e2e",
        redactionPreviewRef: "redaction_preview_service_page_e2e",
        userExportDeleteControls: true,
        evidenceRefs: [
          "evidence:service-page-permission:e2e",
          `execution_authority:${missingPermissionAuthority.browserRecordId}`
        ],
        auditRefs: ["audit:service-page-permission:e2e"],
        activityFeedRefs: ["setup_step:vercel-deploy-settings"]
      } as const;

      const readPreview = await postJson(app, `/api/v1/sessions/${sessionId}/service-page-use-permissions`, {
        ...servicePermissionBase,
        expectedStateVersion: await currentExpectedStateVersion(),
        idempotencyKey: "post-phase3:service-page:read-preview",
        allowedActionClasses: ["read", "preview"],
        approvalGranularity: "per_page"
      });
      const readPreviewData = responseData(readPreview.body);

      expect(readPreviewData).toMatchObject({
        category: "accepted_with_projection",
        immediateProjection: {
          kind: "ServicePageUsePermissionProjection",
          currentStatus: "granted",
          latestPermission: {
            serviceOrigin: "https://vercel.com",
            pageUrl: "https://vercel.com/new",
            userApprovalRef: "user_approval:service-page:e2e",
            credentialEntryDelegated: false,
            canRevoke: true
          }
        }
      });

      const readPreviewPermissionId = stringField(
        record(record(readPreviewData.immediateProjection).latestPermission),
        "permissionId"
      );
      const readPreviewAuthority = await createServicePageBrowserAuthority(
        "service_page_read_preview",
        safeBrowserAction,
        {
          permissionId: readPreviewPermissionId,
          actionClass: "read",
          serviceOrigin: "https://vercel.com",
          servicePageUrl: "https://vercel.com/new"
        }
      );
      const readPreviewBrowser = await runServicePageBrowserAction({
        ...readPreviewAuthority,
        idempotencyKey: "post-phase3:service-page:browser-read-preview"
      });

      expect(responseData(readPreviewBrowser.body)).toMatchObject({
        kind: "BrowserActionExecutionResult",
        status: "completed",
        target: {
          hostname: "127.0.0.1"
        },
        screenshotRefs: expect.arrayContaining(["browser_action:screenshot:post-phase3:service-page:browser-read-preview"]),
        auditRefs: expect.arrayContaining(["audit:browser_action:post-phase3:service-page:browser-read-preview"])
      });

      const completedReplayWithoutEcho = await runServicePageBrowserAction({
        browserRecordId: readPreviewAuthority.browserRecordId,
        browserHash: readPreviewAuthority.browserHash,
        idempotencyKey: "post-phase3:service-page:browser-read-preview-replay-without-echo"
      });

      expect(responseData(completedReplayWithoutEcho.body)).toMatchObject({
        kind: "BrowserActionExecutionResult",
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({ code: "service_page_permission_scope_mismatch" })
        ])
      });

      const omittedEchoAuthority = await createServicePageBrowserAuthority(
        "service_page_omitted_request_echo",
        safeBrowserAction,
        {
          permissionId: readPreviewPermissionId,
          actionClass: "read",
          serviceOrigin: "https://vercel.com",
          servicePageUrl: "https://vercel.com/new"
        }
      );
      const omittedEchoBrowser = await runServicePageBrowserAction({
        browserRecordId: omittedEchoAuthority.browserRecordId,
        browserHash: omittedEchoAuthority.browserHash,
        idempotencyKey: "post-phase3:service-page:browser-omitted-request-echo"
      });

      expect(responseData(omittedEchoBrowser.body)).toMatchObject({
        kind: "BrowserActionExecutionResult",
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({ code: "service_page_permission_scope_mismatch" })
        ])
      });

      const mismatchedEchoAuthority = await createServicePageBrowserAuthority(
        "service_page_mismatched_request_echo",
        safeBrowserAction,
        {
          permissionId: readPreviewPermissionId,
          actionClass: "read",
          serviceOrigin: "https://vercel.com",
          servicePageUrl: "https://vercel.com/new"
        }
      );
      const mismatchedEchoBrowser = await runServicePageBrowserAction({
        ...mismatchedEchoAuthority,
        idempotencyKey: "post-phase3:service-page:browser-mismatched-request-echo",
        servicePageActionClass: "preview"
      });

      expect(responseData(mismatchedEchoBrowser.body)).toMatchObject({
        kind: "BrowserActionExecutionResult",
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({ code: "service_page_permission_scope_mismatch" })
        ])
      });

      const genericAuthorityWithServiceRequest = await createServicePageBrowserAuthority(
        "service_page_generic_authority_with_service_request"
      );
      const genericAuthorityBrowser = await runServicePageBrowserAction({
        ...genericAuthorityWithServiceRequest,
        idempotencyKey: "post-phase3:service-page:browser-generic-authority-with-service-request",
        servicePagePermissionId: readPreviewPermissionId,
        servicePageActionClass: "read"
      });

      expect(responseData(genericAuthorityBrowser.body)).toMatchObject({
        kind: "BrowserActionExecutionResult",
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({ code: "service_page_permission_required" })
        ])
      });

      const previewAuthority = await createServicePageBrowserAuthority(
        "service_page_preview",
        safeBrowserAction,
        {
          permissionId: readPreviewPermissionId,
          actionClass: "preview",
          serviceOrigin: "https://vercel.com",
          servicePageUrl: "https://vercel.com/new"
        }
      );
      const previewBrowser = await runServicePageBrowserAction({
        ...previewAuthority,
        idempotencyKey: "post-phase3:service-page:browser-preview"
      });

      expect(responseData(previewBrowser.body)).toMatchObject({
        kind: "BrowserActionExecutionResult",
        status: "completed",
        screenshotRefs: expect.arrayContaining(["browser_action:screenshot:post-phase3:service-page:browser-preview"])
      });

      const wrongServiceAuthority = await createServicePageBrowserAuthority(
        "service_page_wrong_service_origin",
        safeBrowserAction,
        {
          permissionId: readPreviewPermissionId,
          actionClass: "read",
          serviceOrigin: "https://example.com",
          servicePageUrl: "https://example.com/new"
        }
      );
      const wrongServiceBrowser = await runServicePageBrowserAction({
        ...wrongServiceAuthority,
        idempotencyKey: "post-phase3:service-page:browser-wrong-service-origin"
      });

      expect(responseData(wrongServiceBrowser.body)).toMatchObject({
        kind: "BrowserActionExecutionResult",
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({ code: "service_page_permission_scope_mismatch" })
        ])
      });

      const deletedArtifacts = await postJson(
        app,
        `/api/v1/sessions/${sessionId}/service-page-use-permissions/${readPreviewPermissionId}/artifacts/delete`,
        {
          sessionId,
          expectedStateVersion: await currentExpectedStateVersion(),
          idempotencyKey: "post-phase3:service-page:artifacts-delete",
          permissionId: readPreviewPermissionId,
          reason: "User deleted retained service page-use artifact refs during the dry-run.",
          auditRefs: ["audit:service-page-permission:e2e-artifacts-deleted"]
        }
      );

      expect(responseData(deletedArtifacts.body)).toMatchObject({
        category: "accepted_with_projection",
        immediateProjection: {
          kind: "ServicePageUsePermissionProjection",
          currentStatus: "granted",
          latestPermission: {
            promptPreviewRef: null,
            screenshotRefs: [],
            logRefs: [],
            artifactRetention: {
              promptResultScreenshotLogRetention: "deleted_audit_metadata_only",
              redactionPreviewRef: null,
              artifactRefsDeletionAuditRef: expect.stringContaining("artifacts-deleted")
            },
            auditLog: expect.arrayContaining([expect.objectContaining({ eventType: "ServicePageArtifactsDeleted" })])
          }
        }
      });

      const afterDeleteLatest = await getJson(app, `/api/v1/sessions/${sessionId}/service-page-use-permissions`);

      expect(responseData(afterDeleteLatest.body)).toMatchObject({
        kind: "ServicePageUsePermissionProjection",
        latestPermission: {
          promptPreviewRef: null,
          screenshotRefs: [],
          logRefs: [],
          artifactRetention: {
            promptResultScreenshotLogRetention: "deleted_audit_metadata_only",
            redactionPreviewRef: null
          }
        }
      });

      const revoked = await postJson(
        app,
        `/api/v1/sessions/${sessionId}/service-page-use-permissions/${readPreviewPermissionId}/revoke`,
        {
          sessionId,
          expectedStateVersion: await currentExpectedStateVersion(),
          idempotencyKey: "post-phase3:service-page:revoked",
          permissionId: readPreviewPermissionId,
          reason: "User stopped the mocked Vercel page-use permission during the dry-run.",
          auditRefs: ["audit:service-page-permission:e2e-revoked"]
        }
      );

      expect(responseData(revoked.body)).toMatchObject({
        category: "accepted_with_projection",
        immediateProjection: {
          kind: "ServicePageUsePermissionProjection",
          currentStatus: "revoked",
          latestPermission: {
            canRevoke: false,
            blockReasons: expect.arrayContaining([expect.objectContaining({ code: "revoked_by_user" })])
          }
        }
      });

      const completedReplayAfterRevoke = await runServicePageBrowserAction({
        ...readPreviewAuthority,
        idempotencyKey: "post-phase3:service-page:browser-read-preview-replay-after-revoke"
      });

      expect(responseData(completedReplayAfterRevoke.body)).toMatchObject({
        kind: "BrowserActionExecutionResult",
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({ code: "service_page_permission_revoked" })
        ])
      });

      const revokedPreviewAuthority = await createServicePageBrowserAuthority(
        "service_page_after_revoke",
        safeBrowserAction,
        {
          permissionId: readPreviewPermissionId,
          actionClass: "preview",
          serviceOrigin: "https://vercel.com",
          servicePageUrl: "https://vercel.com/new"
        }
      );
      const revokedPreviewBrowser = await runServicePageBrowserAction({
        ...revokedPreviewAuthority,
        idempotencyKey: "post-phase3:service-page:browser-after-revoke"
      });

      expect(responseData(revokedPreviewBrowser.body)).toMatchObject({
        kind: "BrowserActionExecutionResult",
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({ code: "service_page_permission_revoked" })
        ])
      });

      const fillDraft = await postJson(app, `/api/v1/sessions/${sessionId}/service-page-use-permissions`, {
        ...servicePermissionBase,
        expectedStateVersion: await currentExpectedStateVersion(),
        idempotencyKey: "post-phase3:service-page:fill-draft",
        purpose: "Fill a draft deployment settings form while the user stays present and can stop automation.",
        allowedActionClasses: ["fill_draft"],
        approvalGranularity: "per_action",
        userApprovalRef: "user_approval:service-page:e2e-fill-draft",
        activityFeedRefs: ["setup_step:vercel-fill-draft"]
      });
      const fillDraftData = responseData(fillDraft.body);

      expect(fillDraftData).toMatchObject({
        category: "accepted_with_projection",
        immediateProjection: {
          currentStatus: "granted",
          latestPermission: {
            allowedActionClasses: ["fill_draft"],
            approvalGranularity: "per_action"
          }
        }
      });

      const fillDraftPermissionId = stringField(
        record(record(fillDraftData.immediateProjection).latestPermission),
        "permissionId"
      );
      const fillDraftAuthority = await createServicePageBrowserAuthority(
        "service_page_fill_draft",
        safeBrowserAction,
        {
          permissionId: fillDraftPermissionId,
          actionClass: "fill_draft",
          serviceOrigin: "https://vercel.com",
          servicePageUrl: "https://vercel.com/new"
        }
      );
      const fillDraftBrowser = await runServicePageBrowserAction({
        ...fillDraftAuthority,
        idempotencyKey: "post-phase3:service-page:browser-fill-draft"
      });

      expect(responseData(fillDraftBrowser.body)).toMatchObject({
        kind: "BrowserActionExecutionResult",
        status: "completed",
        action: {
          credentialMode: "none",
          externalMutation: "blocked"
        }
      });

      const finalSubmitBlocked = await postJson(app, `/api/v1/sessions/${sessionId}/service-page-use-permissions`, {
        ...servicePermissionBase,
        expectedStateVersion: await currentExpectedStateVersion(),
        idempotencyKey: "post-phase3:service-page:final-submit-blocked",
        purpose: "Request final submit for a deployment settings form without passing production-mutation contract evidence.",
        allowedActionClasses: ["final_submit_request"],
        approvalGranularity: "per_action",
        finalSubmitRequested: true,
        finalSubmitConfirmationRef: "confirmation_card_fake",
        finalSubmitExecutionAuthorityRef: "execution_authority_fake",
        userApprovalRef: "user_approval:service-page:e2e-final-submit",
        activityFeedRefs: ["setup_step:vercel-final-submit"]
      });
      const finalSubmitBlockedData = responseData(finalSubmitBlocked.body);

      expect(finalSubmitBlockedData).toMatchObject({
        category: "accepted_with_projection",
        immediateProjection: {
          currentStatus: "blocked",
          latestPermission: {
            finalSubmitBoundary: {
              requested: true,
              confirmationCardRef: "confirmation_card_fake",
              executionAuthorityRef: "execution_authority_fake",
              productionMutationPerformed: false
            },
            blockReasons: expect.arrayContaining([
              expect.objectContaining({ code: "final_submit_requires_confirmation_and_authority" })
            ])
          }
        }
      });

      const finalSubmitPermissionId = stringField(
        record(record(finalSubmitBlockedData.immediateProjection).latestPermission),
        "permissionId"
      );
      const finalSubmitAuthority = await createServicePageBrowserAuthority(
        "service_page_final_submit_blocked",
        finalSubmitBrowserAction,
        {
          permissionId: finalSubmitPermissionId,
          actionClass: "final_submit_request",
          serviceOrigin: "https://vercel.com",
          servicePageUrl: "https://vercel.com/new"
        }
      );
      const finalSubmitBrowser = await runServicePageBrowserAction({
        ...finalSubmitAuthority,
        idempotencyKey: "post-phase3:service-page:browser-final-submit-blocked",
        action: finalSubmitBrowserAction
      });

      expect(responseData(finalSubmitBrowser.body)).toMatchObject({
        kind: "BrowserActionExecutionResult",
        status: "blocked",
        action: {
          externalMutation: "requested"
        },
        blockReasons: expect.arrayContaining([
          expect.objectContaining({ code: "service_page_permission_required" })
        ])
      });

      const latest = await getJson(app, `/api/v1/sessions/${sessionId}/service-page-use-permissions`);

      expect(responseData(latest.body)).toMatchObject({
        kind: "ServicePageUsePermissionProjection",
        currentStatus: "blocked"
      });
    } finally {
      await storage.close();
      await mockServiceTarget?.close();
    }
  });

  it("deletes service page-use artifact refs from non-latest permission records through the route", async () => {
    const { app, storage } = await createMigratedStorageApp();

    try {
      const start = await postJson(app, "/api/v1/projects", {
        rawIdea: "A non-latest service page-use artifact delete dry-run idea",
        localPrivacyMode: "local_only",
        projectPurposeMode: "personal",
        projectPurposeModeConfirmation: "user_confirmed"
      });
      const sessionId = sessionIdFromStart(responseData(start.body));
      const basePermission = {
        sessionId,
        blockedActionClasses: SERVICE_PAGE_USE_PERMISSION_BLOCKED_ACTION_CLASSES,
        dataCategories: ["public_page_content", "user_provided_project_context", "prompt_result_screenshot_log_refs"],
        allowedActionClasses: ["read", "preview"],
        approvalGranularity: "per_page",
        approvalDecision: "approved",
        userExportDeleteControls: true
      } as const;

      const first = await postJson(app, `/api/v1/sessions/${sessionId}/service-page-use-permissions`, {
        ...basePermission,
        expectedStateVersion: 1,
        idempotencyKey: "post-phase3:service-page:non-latest-delete-first",
        serviceName: "Vercel",
        serviceOrigin: "https://vercel.com",
        pageUrl: "https://vercel.com/new",
        purpose: "Retain Vercel preview artifacts before a newer service page grant is created.",
        userApprovalRef: "user_approval:service-page:non-latest-vercel",
        promptPreviewRef: "prompt_preview_service_page_nonlatest_vercel",
        redactionPreviewRef: "redaction_preview_service_page_nonlatest_vercel",
        screenshotRefs: ["screenshot:nonlatest-vercel"],
        logRefs: ["log:nonlatest-vercel"],
        evidenceRefs: ["evidence:service-page:nonlatest-vercel"],
        auditRefs: ["audit:service-page:nonlatest-vercel"],
        activityFeedRefs: ["setup_step:nonlatest-vercel"]
      });
      const firstPermissionId = stringField(
        record(record(responseData(first.body).immediateProjection).latestPermission),
        "permissionId"
      );
      const second = await postJson(app, `/api/v1/sessions/${sessionId}/service-page-use-permissions`, {
        ...basePermission,
        expectedStateVersion: 2,
        idempotencyKey: "post-phase3:service-page:non-latest-delete-second",
        serviceName: "Example",
        serviceOrigin: "https://example.com",
        pageUrl: "https://example.com/setup",
        purpose: "Keep a newer Example setup page permission active while deleting old Vercel artifact refs.",
        userApprovalRef: "user_approval:service-page:non-latest-example",
        promptPreviewRef: "prompt_preview_service_page_nonlatest_example",
        redactionPreviewRef: "redaction_preview_service_page_nonlatest_example",
        screenshotRefs: ["screenshot:nonlatest-example"],
        logRefs: ["log:nonlatest-example"],
        evidenceRefs: ["evidence:service-page:nonlatest-example"],
        auditRefs: ["audit:service-page:nonlatest-example"],
        activityFeedRefs: ["setup_step:nonlatest-example"]
      });

      expect(responseData(second.body)).toMatchObject({
        category: "accepted_with_projection",
        immediateProjection: {
          latestPermission: {
            serviceOrigin: "https://example.com",
            promptPreviewRef: "prompt_preview_service_page_nonlatest_example"
          }
        }
      });

      const deleted = await postJson(
        app,
        `/api/v1/sessions/${sessionId}/service-page-use-permissions/${firstPermissionId}/artifacts/delete`,
        {
          sessionId,
          expectedStateVersion: 3,
          idempotencyKey: "post-phase3:service-page:non-latest-artifacts-delete",
          permissionId: firstPermissionId,
          reason: "User deleted retained artifact refs from an older service page grant.",
          auditRefs: ["audit:service-page:nonlatest-artifacts-deleted"]
        }
      );
      const deletedProjection = record(responseData(deleted.body).immediateProjection);
      const deletedOldPermission = record(
        records(deletedProjection.permissions).find((permission) => permission.permissionId === firstPermissionId)
      );

      expect(deletedProjection).toMatchObject({
        currentStatus: "granted",
        latestPermission: {
          serviceOrigin: "https://example.com",
          promptPreviewRef: "prompt_preview_service_page_nonlatest_example",
          artifactRetention: {
            promptResultScreenshotLogRetention: "default_evidence_refs_only"
          }
        }
      });
      expect(deletedOldPermission).toMatchObject({
        promptPreviewRef: null,
        screenshotRefs: [],
        logRefs: [],
        artifactRetention: {
          promptResultScreenshotLogRetention: "deleted_audit_metadata_only",
          redactionPreviewRef: null,
          artifactRefsDeletionAuditRef: expect.stringContaining("artifacts-deleted")
        },
        auditLog: expect.arrayContaining([expect.objectContaining({ eventType: "ServicePageArtifactsDeleted" })])
      });

      const deletedOldPermissionJson = JSON.stringify(deletedOldPermission);

      expect(deletedOldPermissionJson).not.toContain("prompt_preview_service_page_nonlatest_vercel");
      expect(deletedOldPermissionJson).not.toContain("redaction_preview_service_page_nonlatest_vercel");
      expect(deletedOldPermissionJson).not.toContain("screenshot:nonlatest-vercel");
      expect(deletedOldPermissionJson).not.toContain("log:nonlatest-vercel");

      const afterDelete = await getJson(app, `/api/v1/sessions/${sessionId}/service-page-use-permissions`);
      const refetchedProjection = record(responseData(afterDelete.body));
      const refetchedOldPermission = record(
        records(refetchedProjection.permissions).find((permission) => permission.permissionId === firstPermissionId)
      );

      expect(refetchedProjection).toMatchObject({
        latestPermission: {
          serviceOrigin: "https://example.com",
          promptPreviewRef: "prompt_preview_service_page_nonlatest_example"
        }
      });
      expect(JSON.stringify(refetchedOldPermission)).not.toContain("prompt_preview_service_page_nonlatest_vercel");
    } finally {
      await storage.close();
    }
  });

  it("records and refetches implementation step ledger completion and visible blockers", async () => {
    const { app, storage } = await createMigratedStorageApp();

    try {
      const start = await postJson(app, "/api/v1/projects", {
        rawIdea: "An implementation step ledger dry-run idea",
        localPrivacyMode: "local_only",
        projectPurposeMode: "personal",
        projectPurposeModeConfirmation: "user_confirmed"
      });
      const sessionId = sessionIdFromStart(responseData(start.body));
      const trackerDoc = {
        trackerId: "tracker_e2e_issue_104",
        title: "E2E implementation ledger tracker",
        goal: "Prove step-local commit, review, clean-code review, and test evidence gates.",
        sourceRefs: ["issue:104"]
      };
      let expectedStateVersion = 1;
      const recordLedger = async (payload: Readonly<Record<string, unknown>>) => {
        const targetStatus = String(payload.targetStatus);
        const stepDoc = record(payload.stepDoc);
        const stepId = stringField(stepDoc, "stepId");

        return postJson(app, `/api/v1/sessions/${sessionId}/implementation-step-ledger`, {
          ...payload,
          sessionId,
          expectedStateVersion: expectedStateVersion++,
          idempotencyKey: `post-phase3:implementation-ledger:${stepId}:${targetStatus}:${expectedStateVersion}`
        });
      };
      const completedCodeReviewRecord = (
        reviewScope: "feature" | "repository",
        pass: number
      ) => ({
        stepId: "step_e2e_complete",
        reviewId: `review_code_e2e_complete_${reviewScope}_${pass}`,
        reviewer: reviewScope === "feature" ? "codex-feature-code-reviewer" : "codex-repo-code-reviewer",
        reviewScope,
        verdict: "passed",
        comparedFromCommitSha: "1234567",
        comparedToCommitSha: "abcdef1",
        findings: [],
        evidenceRefs: [`review:code:e2e:${reviewScope}:${pass}`]
      });
      const completedCleanCodeReviewRecord = (
        reviewScope: "changed_code" | "repository",
        pass: number
      ) => ({
        stepId: "step_e2e_complete",
        reviewId: `review_clean_e2e_complete_${reviewScope}_${pass}`,
        reviewer: reviewScope === "changed_code" ? "codex-changed-code-clean-reviewer" : "codex-repo-clean-reviewer",
        reviewScope,
        verdict: "passed",
        comparedFromCommitSha: "1234567",
        comparedToCommitSha: "abcdef1",
        simplifications: [],
        evidenceRefs: [`review:clean:e2e:${reviewScope}:${pass}`]
      });
      const completedLedgerPayload = {
        sessionId,
        trackerDoc,
        startedEvidenceRefs: ["started:step_e2e_complete"],
        stepDoc: {
          stepId: "step_e2e_complete",
          title: "Record complete implementation step",
          description: "Dry-run a completed tracked-code step.",
          sourceRefs: ["issue:104", "e2e:implementation-step-ledger"],
          expectedChangeScope: "tracked_code_docs_config"
        },
        stepCommitRecord: {
          stepId: "step_e2e_complete",
          commitSha: "abcdef1",
          previousCommitSha: "1234567",
          diffRange: "1234567..abcdef1",
          changedFiles: ["packages/contracts/src/projections/implementation-step-ledger.ts"],
          rollbackRef: "rollback:git-revert:abcdef1",
          evidenceRefs: ["commit:abcdef1"]
        },
        testEvidenceRecord: {
          stepId: "step_e2e_complete",
          testEvidenceId: "test_e2e_complete",
          commands: ["pnpm test apps/sidecar/src/e2e-dry-run.test.ts"],
          outcome: "passed",
          verifiedCommitSha: "abcdef1",
          passedTestCount: 1,
          failedTestCount: 0,
          notTestedGaps: [],
          evidenceRefs: ["test:e2e"]
        },
        missingTestAuditRecord: {
          stepId: "step_e2e_complete",
          auditId: "missing_test_audit_e2e_complete",
          auditedCriteriaRefs: ["issue:104:acceptance"],
          coverageEvidenceRefs: ["test:e2e"],
          missingTestGaps: [],
          evidenceRefs: ["missing-test-audit:e2e"]
        },
        evidenceRefs: ["ledger:e2e:complete"]
      };
      const completedLedgerTransitions = [
        { targetStatus: "ready" },
        { targetStatus: "implementing" },
        { targetStatus: "committed" },
        { targetStatus: "review_required", codeReviewRecord: completedCodeReviewRecord("feature", 1) },
        { targetStatus: "review_required", codeReviewRecord: completedCodeReviewRecord("feature", 2) },
        { targetStatus: "review_required", codeReviewRecord: completedCodeReviewRecord("repository", 1) },
        { targetStatus: "review_required", codeReviewRecord: completedCodeReviewRecord("repository", 2) },
        { targetStatus: "clean_code_review_required", cleanCodeReviewRecord: completedCleanCodeReviewRecord("changed_code", 1) },
        { targetStatus: "clean_code_review_required", cleanCodeReviewRecord: completedCleanCodeReviewRecord("changed_code", 2) },
        { targetStatus: "clean_code_review_required", cleanCodeReviewRecord: completedCleanCodeReviewRecord("repository", 1) },
        { targetStatus: "clean_code_review_required", cleanCodeReviewRecord: completedCleanCodeReviewRecord("repository", 2) },
        { targetStatus: "tests_required" },
        { targetStatus: "completed" }
      ];
      let completedLedger: Awaited<ReturnType<typeof postJson>> | null = null;

      for (const transitionPayload of completedLedgerTransitions) {
        completedLedger = await recordLedger({
          ...completedLedgerPayload,
          ...transitionPayload
        });

        expect(completedLedger.response.status, JSON.stringify(completedLedger.body)).toBe(200);
      }

      expect(completedLedger?.response.status, JSON.stringify(completedLedger?.body)).toBe(200);
      expect(responseData(completedLedger!.body)).toMatchObject({
        category: "accepted_with_projection",
        immediateProjection: {
          kind: "ImplementationStepLedgerProjection",
          currentStatus: "completed",
          stepCommitRecords: expect.arrayContaining([expect.objectContaining({ commitSha: "abcdef1" })]),
          codeReviewRecords: expect.arrayContaining([
            expect.objectContaining({ reviewId: "review_code_e2e_complete_feature_1", reviewScope: "feature" }),
            expect.objectContaining({ reviewId: "review_code_e2e_complete_feature_2", reviewScope: "feature" }),
            expect.objectContaining({ reviewId: "review_code_e2e_complete_repository_1", reviewScope: "repository" }),
            expect.objectContaining({ reviewId: "review_code_e2e_complete_repository_2", reviewScope: "repository" })
          ]),
          cleanCodeReviewRecords: expect.arrayContaining([
            expect.objectContaining({ reviewId: "review_clean_e2e_complete_changed_code_1", reviewScope: "changed_code" }),
            expect.objectContaining({ reviewId: "review_clean_e2e_complete_changed_code_2", reviewScope: "changed_code" }),
            expect.objectContaining({ reviewId: "review_clean_e2e_complete_repository_1", reviewScope: "repository" }),
            expect.objectContaining({ reviewId: "review_clean_e2e_complete_repository_2", reviewScope: "repository" })
          ]),
          testEvidenceRecords: expect.arrayContaining([expect.objectContaining({ outcome: "passed" })]),
          progressReport: expect.stringContaining("Record complete implementation step")
        }
      });

      const blockedCodeReviewRecord = (
        reviewScope: "feature" | "repository",
        pass: number
      ) => ({
        stepId: "step_e2e_blocked",
        reviewId: `review_code_e2e_blocked_${reviewScope}_${pass}`,
        reviewer: reviewScope === "feature" ? "codex-feature-code-reviewer" : "codex-repo-code-reviewer",
        reviewScope,
        verdict: "passed",
        comparedFromCommitSha: "abcdef1",
        comparedToCommitSha: "bcdef12",
        findings: [],
        evidenceRefs: [`review:code:e2e-blocked:${reviewScope}:${pass}`]
      });
      const blockedCleanCodeReviewRecord = (
        reviewScope: "changed_code" | "repository",
        pass: number
      ) => ({
        stepId: "step_e2e_blocked",
        reviewId: `review_clean_e2e_blocked_${reviewScope}_${pass}`,
        reviewer: reviewScope === "changed_code" ? "codex-changed-code-clean-reviewer" : "codex-repo-clean-reviewer",
        reviewScope,
        verdict: "passed",
        comparedFromCommitSha: "abcdef1",
        comparedToCommitSha: "bcdef12",
        simplifications: [],
        evidenceRefs: [`review:clean:e2e-blocked:${reviewScope}:${pass}`]
      });
      const blockedLedgerBasePayload = {
        trackerDoc,
        startedEvidenceRefs: ["started:step_e2e_blocked"],
        stepDoc: {
          stepId: "step_e2e_blocked",
          title: "Keep missing tests visible",
          description: "Dry-run a step that cannot complete without passing tests.",
          sourceRefs: ["issue:104", "e2e:implementation-step-ledger"],
          expectedChangeScope: "tracked_code_docs_config"
        },
        stepCommitRecord: {
          stepId: "step_e2e_blocked",
          commitSha: "bcdef12",
          previousCommitSha: "abcdef1",
          diffRange: "abcdef1..bcdef12",
          changedFiles: ["packages/core/src/product-engine/index.ts"],
          rollbackRef: "rollback:git-revert:bcdef12",
          evidenceRefs: ["commit:bcdef12"]
        },
        evidenceRefs: ["ledger:e2e:blocked"]
      };
      const blockedLedgerTransitions = [
        { targetStatus: "ready" },
        { targetStatus: "implementing" },
        { targetStatus: "committed" },
        { targetStatus: "review_required", codeReviewRecord: blockedCodeReviewRecord("feature", 1) },
        { targetStatus: "review_required", codeReviewRecord: blockedCodeReviewRecord("feature", 2) },
        { targetStatus: "review_required", codeReviewRecord: blockedCodeReviewRecord("repository", 1) },
        { targetStatus: "review_required", codeReviewRecord: blockedCodeReviewRecord("repository", 2) },
        { targetStatus: "clean_code_review_required", cleanCodeReviewRecord: blockedCleanCodeReviewRecord("changed_code", 1) },
        { targetStatus: "clean_code_review_required", cleanCodeReviewRecord: blockedCleanCodeReviewRecord("changed_code", 2) },
        { targetStatus: "clean_code_review_required", cleanCodeReviewRecord: blockedCleanCodeReviewRecord("repository", 1) },
        { targetStatus: "clean_code_review_required", cleanCodeReviewRecord: blockedCleanCodeReviewRecord("repository", 2) },
        { targetStatus: "tests_required" }
      ];

      for (const transitionPayload of blockedLedgerTransitions) {
        const transition = await recordLedger({
          ...blockedLedgerBasePayload,
          ...transitionPayload
        });

        expect(transition.response.status, JSON.stringify(transition.body)).toBe(200);
      }

      const blockedLedger = await recordLedger({
        ...blockedLedgerBasePayload,
        targetStatus: "completed",
        testEvidenceRecord: {
          stepId: "step_e2e_blocked",
          testEvidenceId: "test_e2e_blocked",
          commands: ["pnpm verify"],
          outcome: "failed",
          verifiedCommitSha: "bcdef12",
          passedTestCount: 12,
          failedTestCount: 1,
          notTestedGaps: ["lint not re-run after the failure"],
          evidenceRefs: ["test:e2e-blocked"]
        }
      });

      expect(blockedLedger.response.status, JSON.stringify(blockedLedger.body)).toBe(200);
      expect(responseData(blockedLedger.body)).toMatchObject({
        immediateProjection: {
          currentStatus: "blocked",
          blockedSteps: [
            expect.objectContaining({
              stepId: "step_e2e_blocked",
              missingEvidence: expect.arrayContaining(["passing TestEvidenceRecord without failed tests or Not-tested gaps"])
            })
          ],
          progressReport: expect.stringContaining("Keep missing tests visible")
        }
      });

      const refetched = await getJson(app, `/api/v1/sessions/${sessionId}/implementation-step-ledger`);

      expect(refetched.response.status).toBe(200);
      expect(responseData(refetched.body)).toMatchObject({
        currentStatus: "blocked",
        steps: expect.arrayContaining([
          expect.objectContaining({ status: "completed" }),
          expect.objectContaining({
            status: "blocked",
            testEvidenceRecord: expect.objectContaining({
              outcome: "failed",
              notTestedGaps: ["lint not re-run after the failure"]
            })
          })
        ])
      });

      const tokenShapedValue = "access_token=redacted_test_value_1234567890";
      const rejectedSecret = await postJson(app, `/api/v1/sessions/${sessionId}/implementation-step-ledger`, {
        sessionId,
        expectedStateVersion,
        idempotencyKey: "post-phase3:implementation-ledger:secret-rejected",
        trackerDoc,
        stepDoc: {
          stepId: "step_e2e_secret_rejected",
          title: "Reject token-shaped evidence",
          description: "Reject ledger payloads that would persist token-shaped values.",
          sourceRefs: ["issue:104"],
          expectedChangeScope: "verification_only"
        },
        targetStatus: "ready",
        evidenceRefs: [`leaked:${tokenShapedValue}`]
      });

      expect(rejectedSecret.response.status, JSON.stringify(rejectedSecret.body)).toBe(200);
      expect(responseData(rejectedSecret.body)).toMatchObject({
        category: "rejected",
        error: {
          code: "VALIDATION_FAILED",
          message: "RecordImplementationStepLedger payload must not contain credential, session, token, or secret values."
        }
      });
      expect(JSON.stringify(rejectedSecret.body)).not.toContain(tokenShapedValue);
    } finally {
      await storage.close();
    }
  });

  it("rejects service page-use permission route bodies that carry credential, cookie, or session material", async () => {
    const { app, storage } = await createMigratedStorageApp();

    try {
      const start = await postJson(app, "/api/v1/projects", {
        rawIdea: "A service page-use permission credential rejection dry-run idea",
        localPrivacyMode: "local_only",
        projectPurposeMode: "personal",
        projectPurposeModeConfirmation: "user_confirmed"
      });
      const sessionId = sessionIdFromStart(responseData(start.body));
      const safeBody = {
        sessionId,
        expectedStateVersion: 1,
        idempotencyKey: "post-phase3:service-page:credential-rejection",
        serviceName: "Vercel",
        serviceOrigin: "https://vercel.com",
        pageUrl: "https://vercel.com/new",
        purpose: "Preview Vercel setup fields while the user stays present.",
        allowedActionClasses: ["read", "preview"],
        blockedActionClasses: SERVICE_PAGE_USE_PERMISSION_BLOCKED_ACTION_CLASSES,
        dataCategories: ["public_page_content", "user_provided_project_context"],
        approvalGranularity: "per_page",
        approvalDecision: "approved",
        userApprovalRef: "user_approval:service-page:credential-rejection",
        promptPreviewRef: "prompt_preview_service_page_credential_rejection",
        redactionPreviewRef: "redaction_preview_service_page_credential_rejection",
        userExportDeleteControls: true,
        auditRefs: ["audit:service-page-credential-rejection"],
        activityFeedRefs: ["setup_step:credential-rejection"]
      } as const;

      const unsupportedCredentialField = await postJson(
        app,
        `/api/v1/sessions/${sessionId}/service-page-use-permissions`,
        {
          ...safeBody,
          credentialPassword: "secret_password=abcd1234"
        }
      );

      expect(unsupportedCredentialField.response.status).toBe(400);
      expect(unsupportedCredentialField.body.error).toMatchObject({
        code: "VALIDATION_FAILED"
      });
      expect(JSON.stringify(unsupportedCredentialField.body)).not.toContain("abcd1234");

      const secretInSupportedField = await postJson(
        app,
        `/api/v1/sessions/${sessionId}/service-page-use-permissions`,
        {
          ...safeBody,
          purpose: "Keep session_cookie=abcd1234 in the Vercel setup evidence."
        }
      );

      expect(secretInSupportedField.response.status).toBe(200);
      expect(responseData(secretInSupportedField.body)).toMatchObject({
        category: "rejected",
        error: {
          code: "VALIDATION_FAILED",
          message: "CreateServicePageUsePermission payload must not contain credential, session, token, or secret values."
        }
      });
      expect(JSON.stringify(secretInSupportedField.body)).not.toContain("abcd1234");

      const secretInRefField = await postJson(
        app,
        `/api/v1/sessions/${sessionId}/service-page-use-permissions`,
        {
          ...safeBody,
          screenshotRefs: ["screenshot:session_cookie_abcd1234567890"],
          auditRefs: ["audit:password-abcd1234567890"]
        }
      );

      expect(secretInRefField.response.status).toBe(200);
      expect(responseData(secretInRefField.body)).toMatchObject({
        category: "rejected",
        error: {
          code: "VALIDATION_FAILED",
          message: "CreateServicePageUsePermission payload must not contain credential, session, token, or secret values."
        }
      });
      expect(JSON.stringify(secretInRefField.body)).not.toContain("abcd1234567890");

      const credentialBearingUrl = await postJson(
        app,
        `/api/v1/sessions/${sessionId}/service-page-use-permissions`,
        {
          ...safeBody,
          pageUrl: "https://user:hunter2@vercel.com/new"
        }
      );

      expect(credentialBearingUrl.response.status).toBe(200);
      expect(responseData(credentialBearingUrl.body)).toMatchObject({
        category: "rejected",
        error: {
          code: "VALIDATION_FAILED",
          message: "CreateServicePageUsePermission payload must not contain credential, session, token, or secret values."
        }
      });
      expect(JSON.stringify(credentialBearingUrl.body)).not.toContain("hunter2");

      const latest = await getJson(app, `/api/v1/sessions/${sessionId}/service-page-use-permissions`);

      expect(latest.response.status).toBe(200);
      expect(latest.body.data).toBeNull();
    } finally {
      await storage.close();
    }
  });

  it("runs an allowlisted Phase 1.5A research lifecycle with status/refetch recovery and no external write", async () => {
    const { app, storage } = await createMigratedStorageApp();

    try {
      const start = await postJson(app, "/api/v1/projects", {
        rawIdea: "A Phase 1.5A lifecycle closeout dry-run idea",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "balanced",
        businessCriticIntensityConfirmation: "user_confirmed"
      });
      const projectId = projectIdFromStart(responseData(start.body));
      const allowlist = await postJson(app, `/api/v1/projects/${projectId}/research-allowlists`, {
        allowlistId: "research_allowlist_phase15a_closeout",
        connectorIds: ["public_search"],
        sourceCategories: ["public_web"],
        approvedBy: "owner_phase15a_closeout"
      });

      expect(allowlist.response.status).toBe(200);
      expect(responseData(allowlist.body)).toMatchObject({
        category: "accepted_with_projection",
        immediateProjection: {
          selectedAllowlist: {
            status: "active",
            connectorIds: ["public_search"],
            sourceCategories: ["public_web"]
          }
        }
      });

      const run = await postJson(app, `/api/v1/projects/${projectId}/research-runs`, {
        researchRunId: "research_run_phase15a_closeout",
        researchTaskId: "research_task_phase15a_closeout",
        allowlistId: "research_allowlist_phase15a_closeout",
        connectorId: "public_search",
        sourceCategory: "public_web",
        adapterKind: "local_fake_readonly",
        researchObjective: "Find public onboarding proof for the Phase 1.5A closeout dry-run.",
        productCategory: "Founder workflow assistant",
        customerProblemHypothesis: "Early founders need public-safe validation research before planning.",
        contextHash: "ctx_phase15a_closeout",
        sourceRefs: ["queue_item_phase15a_closeout"]
      });
      const runData = responseData(run.body);

      expect(run.response.status).toBe(200);
      expect(runData).toMatchObject({
        category: "accepted_with_projection",
        statusUrl: `/api/v1/projects/${projectId}/research-runs/research_run_phase15a_closeout/status`,
        projectionHints: [
          {
            projectionKind: "ResearchRunProjection",
            refetchUrl: `/api/v1/projects/${projectId}/research-runs/research_run_phase15a_closeout/status`
          }
        ],
        deterministicOutputs: [
          expect.objectContaining({
            payload: expect.objectContaining({
              commandType: "StartResearchRun",
              externalMutationPerformed: false,
              sseEventHints: ["projection.updated"]
            })
          })
        ],
        immediateProjection: {
          kind: "ResearchRunControlResult",
          action: "start",
          status: "started",
          disclosureLog: expect.objectContaining({
            automaticExternalTransferAllowed: true
          }),
          researchRun: {
            status: "running",
            provider: {
              adapterKind: "local_fake_readonly"
            }
          }
        }
      });

      const status = await getJson(
        app,
        `/api/v1/projects/${projectId}/research-runs/research_run_phase15a_closeout/status`
      );

      expect(status.response.status).toBe(200);
      expect(responseData(status.body)).toMatchObject({
        kind: "ResearchRunControlProjection",
        selectedRun: {
          status: "running"
        },
        recovery: {
          projectionHints: [
            {
              projectionKind: "ResearchRunProjection",
              refetchUrl: `/api/v1/projects/${projectId}/research-runs/research_run_phase15a_closeout/status`
            }
          ]
        }
      });

      const cancel = await postJson(app, `/api/v1/projects/${projectId}/research-runs/research_run_phase15a_closeout/cancel`, {
        researchRunId: "research_run_phase15a_closeout",
        reason: "Closeout dry-run cancels after proving status/refetch recovery."
      });

      expect(cancel.response.status).toBe(200);
      expect(responseData(cancel.body)).toMatchObject({
        immediateProjection: {
          action: "cancel",
          status: "cancel_requested",
          researchRun: {
            status: "cancel_requested"
          }
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("stores, queries, and exports Phase 1.5B no-execution hints for every forbidden runtime boundary", async () => {
    const { app, storage } = await createMigratedStorageApp();

    try {
      const start = await postJson(app, "/api/v1/projects", {
        rawIdea: "A Phase 1.5B no-execution readiness acceptance idea",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "balanced",
        businessCriticIntensityConfirmation: "user_confirmed"
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
            runtimeAdapterVersion: "codex-sdk-runtime-v1",
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

  it("persists a Phase 2 final Planning Handoff from current accepted source traces", async () => {
    const { app, storage } = await createMigratedStorageApp();

    try {
      const start = await postJson(app, "/api/v1/projects", {
        rawIdea: "A final Planning Handoff closeout dry-run idea",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "balanced",
        businessCriticIntensityConfirmation: "user_confirmed"
      });
      const startData = responseData(start.body);
      const projectId = projectIdFromStart(startData);
      const sessionId = sessionIdFromStart(startData);

      await seedPlanningReadyState(storage, projectId, sessionId);

      const final = await postJson(app, `/api/v1/sessions/${sessionId}/planning-handoff`, {
        sessionId,
        expectedStateVersion: 3,
        sourceRefs: planningReadySourceRefs(sessionId)
      });
      const finalData = responseData(final.body);

      expect(final.response.status).toBe(200);
      expect(finalData.statusUrl).toBeUndefined();
      expect(finalData).toMatchObject({
        category: "accepted_with_projection",
        immediateProjection: {
          kind: "PlanningHandoffProjection",
          currentStatus: "planning_ready",
          finalArtifact: {
            kind: "PlanningHandoffArtifact",
            status: "planning_ready",
            noExecutionPolicy: "no_file_shell_browser_deploy_or_external_mutation",
            gateVerdict: {
              verdict: "planning_ready",
              terminalOutcomeSummary: [
                expect.objectContaining({
                  queueItemId: planningReadyQueueItemId,
                  outcome: "approved"
                })
              ]
            },
            taskBreakdown: expect.arrayContaining([
              expect.objectContaining({
                acceptanceEvidence: expect.arrayContaining([
                  expect.stringContaining("No file, shell, browser, deploy, credential, external mutation")
                ])
              })
            ]),
            prIssuePlan: expect.arrayContaining([
              expect.objectContaining({
                summary: expect.stringContaining("Planning Handoff")
              })
            ]),
            readinessChecklist: expect.objectContaining({
              expectedEvidence: expect.arrayContaining(["pnpm verify:docs"])
            }),
            buildSlicePlan: expect.objectContaining({
              nonGoals: expect.arrayContaining(["external deployment"])
            })
          },
          refetchUrl: `/api/v1/sessions/${sessionId}/planning-handoff`
        }
      });

      const fetched = await getJson(app, `/api/v1/sessions/${sessionId}/planning-handoff`);

      expect(responseData(fetched.body)).toMatchObject({
        currentStatus: "planning_ready",
        finalArtifact: {
          kind: "PlanningHandoffArtifact"
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("persists a Phase 2 blocker Planning Handoff when required source traces are incomplete", async () => {
    const { app, storage } = await createMigratedStorageApp();

    try {
      const start = await postJson(app, "/api/v1/projects", {
        rawIdea: "A blocker Planning Handoff closeout dry-run idea",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "balanced",
        businessCriticIntensityConfirmation: "user_confirmed"
      });
      const sessionId = sessionIdFromStart(responseData(start.body));
      const blocker = await postJson(app, `/api/v1/sessions/${sessionId}/planning-handoff`, {
        sessionId,
        expectedStateVersion: 1,
        sourceRefs: [
          {
            sourceType: "spec_version",
            sourceId: "spec_version_missing_closeout",
            required: true,
            stale: false
          },
          {
            sourceType: "decision_linked_evidence_pack",
            sourceId: "evidence_pack_missing_closeout",
            required: true,
            stale: false
          },
          {
            sourceType: "research_updated_queue_item",
            sourceId: "queue_missing_closeout",
            required: true,
            stale: false
          }
        ]
      });
      const blockerData = responseData(blocker.body);

      expect(blocker.response.status).toBe(200);
      expect(blockerData).toMatchObject({
        category: "accepted_with_projection",
        immediateProjection: {
          kind: "PlanningHandoffProjection",
          currentStatus: "source_trace_incomplete",
          blockerArtifact: {
            kind: "PlanningHandoffBlockerArtifact",
            status: "source_trace_incomplete",
            noFinalLabelRule: "must_not_use_planning_ready_label",
            blockers: expect.arrayContaining([
              expect.objectContaining({
                blockerClass: "source_trace"
              })
            ])
          }
        }
      });

      const fetched = await getJson(app, `/api/v1/sessions/${sessionId}/planning-handoff`);

      expect(responseData(fetched.body)).toMatchObject({
        currentStatus: "source_trace_incomplete",
        blockerArtifact: {
          noFinalLabelRule: "must_not_use_planning_ready_label"
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("runs the sample idea through question, evidence, approval, SpecVersion, scoring, Founder Brief, Planning Handoff blocker, and blocked runtime preview", async () => {
    const { app, storage } = await createMigratedStorageApp();

    try {
      const start = await postJson(app, "/api/v1/projects", {
        rawIdea: PHASE1_E2E_SAMPLE_IDEA,
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "balanced",
        businessCriticIntensityConfirmation: "user_confirmed"
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
      const draftData = responseData(draft.body);
      const analyze = await postJson(app, `/api/v1/sessions/${sessionId}/spec/analyze`, {
        expectedStateVersion: 3,
        targetRef: "current_spec",
        generatedQuestionSet: generatedFounderQuestionSet()
      });
      const analyzeData = responseData(analyze.body);

      expect(intake.response.status).toBe(200);
      expect(draft.response.status).toBe(200);
      expect(analyze.response.status).toBe(200);
      expect(draftData).toMatchObject({
        immediateProjection: {
          kind: "LivingSpecProjection",
          sections: CANONICAL_INITIAL_SPEC_SECTIONS,
          sectionCount: CANONICAL_INITIAL_SPEC_SECTIONS.length
        }
      });
      expect(analyzeData).toMatchObject({
        deterministicOutputs: [
          expect.objectContaining({
            outputType: "ambiguity_analysis",
            payload: expect.objectContaining({
              issueCount: 19,
              issues: expect.arrayContaining([
                expect.objectContaining({
                  sectionRef: "Target Customer",
                  topicKey: "primary_customer_narrowing",
                  severity: "high",
                  uncertaintyType: "vague",
                  whyItMatters: expect.any(String),
                  expectedAnswerType: "choice",
                  answerOptions: expect.arrayContaining([
                    expect.objectContaining({ label: "유료 인터뷰를 준비하는 1인 창업자" })
                  ]),
                  decisionItUnlocks: expect.any(String),
                  possibleRoutes: expect.arrayContaining(["question", "decision_candidate"])
                }),
                expect.objectContaining({
                  sectionRef: "Validation Plan",
                  expectedAnswerType: "experiment",
                  possibleRoutes: expect.arrayContaining(["research_needed"])
                })
              ])
            })
          })
        ],
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
      expect(activeItems).toHaveLength(1);
      expect(firstQuestion).toMatchObject({
        cardType: "question",
        sectionRef: "Target Customer",
        topicKey: "first_user_situation",
        severity: "high",
        expectedAnswerType: "text",
        possibleRoutes: expect.arrayContaining(["question", "decision_candidate"])
      });

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
      const evidencePack = firstRecord(researchAfterData.evidencePacks);
      const researchReviewCard = firstRecord(researchAfterData.reviewCards);
      const researchReviewCardId = String(researchReviewCard.cardId);

      expect(evidenceMatrix).toMatchObject({
        balanceStatus: "balanced",
        decisionBlocked: false
      });
      expect(evidencePack).toMatchObject({
        gateStatus: "accepted"
      });
      expect(researchReviewCard).toMatchObject({
        cardType: "decision_approval",
        blocksPlanning: true,
        availableOutcomes: expect.arrayContaining(["approved"])
      });

      const resolveResearchReview = await postJson(app, `/api/v1/research-cards/${researchReviewCardId}/resolve`, {
        sessionId,
        cardId: researchReviewCardId,
        expectedStateVersion: 9,
        outcome: "approved",
        rationale: "Balanced manual evidence is accepted for the closeout Planning Handoff dry-run."
      });

      expect(resolveResearchReview.response.status).toBe(200);
      expect(responseData(resolveResearchReview.body)).toMatchObject({
        category: "accepted_with_projection",
        queueProjection: {
          blocked: []
        }
      });
      const resolvedResearch = await getJson(app, `/api/v1/sessions/${sessionId}/research`);

      expect(responseData(resolvedResearch.body)).toMatchObject({
        reviewCards: [
          expect.objectContaining({
            cardId: researchReviewCardId,
            terminalOutcome: "approved",
            blocksPlanning: false
          })
        ]
      });

      const specUpdate = await postJson(app, "/api/v1/spec-updates", {
        sessionId,
        expectedStateVersion: 10,
        sourceRef: evidenceMatrix.evidenceMatrixId,
        requiredDecisionRef: "primary_customer",
        title: "Founder Brief-ready local-first product coaching session",
        sections: PHASE1_E2E_SPEC_SECTIONS
      });
      const specUpdateData = responseData(specUpdate.body);
      const specUpdateQueue = record(specUpdateData.immediateProjection);
      const specUpdateOutput = recordWithStringFieldPrefix(
        specUpdateData.deterministicOutputs,
        "outputRef",
        "spec_update_"
      );
      const specUpdatePayload = record(specUpdateOutput.payload);
      const decisionItem = recordWithStringFieldPrefix(
        specUpdateQueue.next,
        "queueItemId",
        "decision_card_decision_"
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

      const decisionId = String(specUpdatePayload.decisionId);
      const approvedPreviewRef = stringField(specUpdateOutput, "outputRef");

      expect(specUpdatePayload).toMatchObject({
        previewRef: approvedPreviewRef,
        sourceRef: evidenceMatrix.evidenceMatrixId,
        requiredDecisionRef: "primary_customer",
        title: "Founder Brief-ready local-first product coaching session",
        sections: PHASE1_E2E_SPEC_SECTIONS
      });
      expect(decisionItem.queueItemId).toBe(`decision_card_${decisionId}`);

      const resolveDecision = await postJson(app, `/api/v1/decisions/${decisionId}/resolve`, {
        sessionId,
        decisionId,
        expectedStateVersion: 11,
        outcome: "approved",
        rationale: "Manual evidence includes both support and risk, so the primary customer decision can be approved."
      });
      const resolvedQueue = await getJson(app, `/api/v1/sessions/${sessionId}/queue`);
      const specVersion = await postJson(app, `/api/v1/sessions/${sessionId}/spec/versions`, {
        expectedStateVersion: 12,
        approvedPreviewRef,
        title: "Founder Brief-ready local-first product coaching session",
        sections: PHASE1_E2E_SPEC_SECTIONS
      });
      const specVersionData = responseData(specVersion.body);
      const specVersionOutput = recordWithStringFieldPrefix(
        specVersionData.deterministicOutputs,
        "outputRef",
        "spec_version_"
      );
      const specVersionRef = stringField(specVersionOutput, "outputRef");

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
        expectedStateVersion: 13
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
        expectedStateVersion: 14,
        requestedFormat: "markdown"
      });
      const founderBriefData = responseData(founderBrief.body);
      const founderBriefProjection = record(founderBriefData.immediateProjection);

      expect(founderBrief.response.status).toBe(200);
      expect(founderBriefData.statusUrl).toBeUndefined();
      expect(founderBriefData).toMatchObject({
        category: "accepted_with_projection",
        immediateProjection: {
          kind: "FounderBriefProjection",
          exportReady: false,
          exportMetadata: {
            writePolicy: "metadata_only_no_file_write"
          },
          topDecisions: expect.arrayContaining([expect.stringContaining("primary_customer")])
        }
      });

      const planningHandoff = await postJson(app, `/api/v1/sessions/${sessionId}/planning-handoff`, {
        sessionId,
        expectedStateVersion: 15,
        sourceRefs: [
          {
            sourceType: "spec_version",
            sourceId: specVersionRef,
            sourceLabel: "Approved closeout SpecVersion",
            required: true,
            stale: false
          },
          {
            sourceType: "founder_brief",
            sourceId: `founder_brief:${sessionId}:${String(founderBriefProjection.version)}`,
            sourceLabel: "Closeout Founder Brief",
            required: true,
            stale: false
          },
          {
            sourceType: "decision_linked_evidence_pack",
            sourceId: String(evidencePack.evidencePackId),
            sourceLabel: String(evidencePack.claim),
            required: true,
            stale: false
          },
          {
            sourceType: "research_updated_queue_item",
            sourceId: researchReviewCardId,
            sourceLabel: String(researchReviewCard.title),
            required: true,
            stale: false
          }
        ]
      });
      const planningHandoffData = responseData(planningHandoff.body);
      const planningHandoffProjection = record(planningHandoffData.immediateProjection);

      expect(planningHandoff.response.status).toBe(200);
      expect(planningHandoffData.statusUrl).toBeUndefined();
      expect(planningHandoffProjection).toMatchObject({
        kind: "PlanningHandoffProjection",
        currentStatus: "source_trace_incomplete",
        blockerArtifact: {
          kind: "PlanningHandoffBlockerArtifact",
          status: "source_trace_incomplete",
          noFinalLabelRule: "must_not_use_planning_ready_label",
          blockers: expect.arrayContaining([
            expect.objectContaining({
              blockerClass: "source_trace",
              requiredNextAction: "revise",
              sourceRefs: expect.arrayContaining([
                expect.objectContaining({
                  sourceType: "founder_brief",
                  sourceId: `founder_brief:${sessionId}:${String(founderBriefProjection.version)}`
                })
              ])
            })
          ])
        },
        refetchUrl: `/api/v1/sessions/${sessionId}/planning-handoff`
      });

      const fetchedPlanningHandoff = await getJson(app, `/api/v1/sessions/${sessionId}/planning-handoff`);

      expect(responseData(fetchedPlanningHandoff.body)).toMatchObject({
        currentStatus: "source_trace_incomplete",
        blockerArtifact: {
          noFinalLabelRule: "must_not_use_planning_ready_label"
        }
      });

      const blockedPreview = await postJson(app, "/api/v1/runtime/codex/preview", {
        sessionId,
        expectedStateVersion: 16,
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
        expectedStateVersion: 18,
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
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "balanced",
        businessCriticIntensityConfirmation: "user_confirmed"
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
        evidenceMatrices: expect.arrayContaining([
          expect.objectContaining({
            balanceStatus: "source_quality_insufficient",
            decisionBlocked: true
          })
        ]),
        reviewCards: expect.arrayContaining([
          expect.objectContaining({
            state: "terminal_failure",
            retainedSourceRef: "Low-quality retained source",
            recoveryActions: expect.arrayContaining(["retry_synthesis", "import_manual_result", "defer_as_known_risk"])
          })
        ]),
        knownRisks: expect.arrayContaining([expect.stringContaining("판단에 쓸 공개 근거가 부족합니다")])
      });
    } finally {
      await storage.close();
    }
  });
});
