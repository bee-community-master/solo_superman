import { createServer } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyMigrations, createEventRepository, createSoloStorage, localDatabaseUrlFromAppDataDir } from "@solo-superman/db";
import {
  CANONICAL_INITIAL_SPEC_SECTIONS,
  CONTRACT_SCHEMA_VERSION,
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
  PHASE3_CLOSEOUT_EVIDENCE
} from "./e2e-dry-run.fixture";
import { hashBrowserActionPreview } from "./product-engine/browser-action-adapter";
import { hashFileDiffPreview } from "./product-engine/file-diff-adapter";
import { hashShellCommandPreview } from "./product-engine/shell-command-adapter";

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

  expect(response.status).toBe(200);

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

async function createLocalBrowserTargetServer() {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><title>Solo phase 3 closeout</title><h1>Loopback target</h1>");
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
    targetUrl: `http://127.0.0.1:${address.port}/phase3-closeout`,
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

  it("runs Phase 3 approved and blocked controlled execution through the same authority ledger", async () => {
    const { app, storage } = await createMigratedStorageApp();
    let localTarget: Awaited<ReturnType<typeof createLocalBrowserTargetServer>> | undefined;

    try {
      const workspaceRoot = await makeTempAppDataDir();

      await mkdir(join(workspaceRoot, "packages/contracts/src"), { recursive: true });
      await writeFile(join(workspaceRoot, "packages/contracts/src/phase3-closeout-target.ts"), "export const value = 1;\n");
      await writeFile(join(workspaceRoot, "README.md"), "phase 3 closeout workspace\n");
      localTarget = await createLocalBrowserTargetServer();

      const start = await postJson(app, "/api/v1/projects", {
        rawIdea: "A Phase 3 closeout controlled execution dry-run idea",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed"
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

      const shellCommand = ["ls", "."] as const;
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
            executable: "ls",
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

  it("runs an allowlisted Phase 1.5A research lifecycle with status/refetch recovery and no external write", async () => {
    const { app, storage } = await createMigratedStorageApp();

    try {
      const start = await postJson(app, "/api/v1/projects", {
        rawIdea: "A Phase 1.5A lifecycle closeout dry-run idea",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed"
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
        projectPurposeModeConfirmation: "user_confirmed"
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

  it("persists a Phase 2 final Planning Handoff from current accepted source traces", async () => {
    const { app, storage } = await createMigratedStorageApp();

    try {
      const start = await postJson(app, "/api/v1/projects", {
        rawIdea: "A final Planning Handoff closeout dry-run idea",
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed"
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
        projectPurposeModeConfirmation: "user_confirmed"
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
        projectPurposeModeConfirmation: "user_confirmed"
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
        targetRef: "current_spec"
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
              issueCount: 15,
              issues: expect.arrayContaining([
                expect.objectContaining({
                  sectionRef: "Target Customer",
                  topicKey: "primary_customer_narrowing",
                  severity: "high",
                  uncertaintyType: "vague",
                  whyItMatters: expect.any(String),
                  expectedAnswerType: "choice",
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
      expect(activeItems).toHaveLength(5);
      expect(firstQuestion).toMatchObject({
        cardType: "question",
        sectionRef: "Target Customer",
        topicKey: "primary_customer_narrowing",
        severity: "high",
        whyItMatters: expect.any(String),
        decisionItUnlocks: expect.any(String),
        expectedAnswerType: "choice",
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
        currentStatus: "needs_risk_acceptance",
        blockerArtifact: {
          kind: "PlanningHandoffBlockerArtifact",
          status: "needs_risk_acceptance",
          noFinalLabelRule: "must_not_use_planning_ready_label",
          blockers: expect.arrayContaining([
            expect.objectContaining({
              requiredNextAction: "risk_accept"
            })
          ])
        },
        refetchUrl: `/api/v1/sessions/${sessionId}/planning-handoff`
      });

      const fetchedPlanningHandoff = await getJson(app, `/api/v1/sessions/${sessionId}/planning-handoff`);

      expect(responseData(fetchedPlanningHandoff.body)).toMatchObject({
        currentStatus: "needs_risk_acceptance",
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
        projectPurposeModeConfirmation: "user_confirmed"
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
