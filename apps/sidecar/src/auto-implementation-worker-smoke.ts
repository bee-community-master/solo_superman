import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  CONTRACT_SCHEMA_VERSION,
  type CodexRuntimeStatusDto,
  type CommandId,
  type CorrelationId,
  type EventId,
  type PlanningHandoffSourceRefDto,
  type ProjectId,
  type ProjectionVersion,
  type SessionId
} from "@solo-superman/contracts";
import {
  applyMigrations,
  createEventRepository,
  createSoloStorage,
  localDatabaseUrlFromAppDataDir
} from "@solo-superman/db";
import { createCodexRuntimeAdapter, type CodexRuntimeAdapter } from "./runtime";
import { createSidecarApp } from "./server";

export const LIVE_WORKER_JOB_VERIFY_ENV = "SOLO_VERIFY_CODEX_LIVE_WORKER_JOB" as const;
export const LIVE_TURNS_ENV = "SOLO_CODEX_APP_SERVER_LIVE_TURNS" as const;
export const AUTO_IMPLEMENTATION_WORKER_SMOKE = "auto_implementation_worker_job" as const;

const FIXTURE_NOW = "2026-05-23T00:00:00.000Z";
const PROJECT_FOLDER_NAME = "worker-job-smoke-demo";
const REQUIRED_LIVE_GATE_BLOCKER = `${LIVE_TURNS_ENV}=1 is required before live worker-job execution can be verified`;
const PLANNING_READY_SPEC_VERSION_REF = "spec_version_worker_job_smoke_ready";
const PLANNING_READY_RESEARCH_TASK_ID = "research_task_worker_job_smoke_ready";
const PLANNING_READY_RESEARCH_RESULT_ID = "research_result_worker_job_smoke_ready";
const PLANNING_READY_EVIDENCE_ITEM_ID = "evidence_item_worker_job_smoke_ready";
const PLANNING_READY_EVIDENCE_PACK_ID = "evidence_pack_worker_job_smoke_ready";
const PLANNING_READY_QUEUE_ITEM_ID = "queue_item_worker_job_smoke_ready";
const PLANNING_READY_PROJECTION_VERSION = 3 as ProjectionVersion;

type SmokeMode = "fixture" | "live";
type SmokeStatus = "blocked" | "passed";
type JsonRecord = Readonly<Record<string, unknown>>;

export interface AutoImplementationWorkerGateEvidence {
  readonly status: "ready" | "blocked";
  readonly smoke: typeof AUTO_IMPLEMENTATION_WORKER_SMOKE;
  readonly mode: SmokeMode;
  readonly reason?: string;
  readonly blockers?: readonly string[];
  readonly checked: readonly string[];
}

export interface AutoImplementationWorkerSmokeEvidence {
  readonly status: SmokeStatus;
  readonly smoke: typeof AUTO_IMPLEMENTATION_WORKER_SMOKE;
  readonly mode: SmokeMode;
  readonly runtime?: {
    readonly status: CodexRuntimeStatusDto["status"];
    readonly executionMode: CodexRuntimeStatusDto["executionMode"];
    readonly liveTurnExecutionEnabled: boolean;
    readonly accountStatus: CodexRuntimeStatusDto["account"]["status"];
  };
  readonly worker?: {
    readonly runId: string;
    readonly jobId: string;
    readonly jobStatus: string;
    readonly stageBefore: string;
    readonly stageAfter: string;
    readonly ledgerStatus: string;
    readonly implementationStepId: string;
    readonly projectFolderName: string;
    readonly issueRelativePath: string;
  };
  readonly reason?: string;
  readonly blockers?: readonly string[];
  readonly checked: readonly string[];
}

export interface AutoImplementationWorkerSmokeOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly runtimeAdapter?: CodexRuntimeAdapter;
  readonly appDataDir?: string;
  readonly cleanupAppDataDir?: boolean;
  readonly localCapabilityToken?: string;
}

interface WorkerScenario {
  readonly storageApp: ReturnType<typeof createSidecarApp>;
  readonly storage: Awaited<ReturnType<typeof createSoloStorage>>;
  readonly codexRuntimeAdapter: CodexRuntimeAdapter;
  readonly workspaceRoot: string;
}

interface WorkerScenarioInput {
  readonly mode: SmokeMode;
  readonly gateChecked: readonly string[];
  readonly appDataDir: string;
  readonly localCapabilityToken: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly runtimeAdapter?: CodexRuntimeAdapter;
}

interface WorkerExecutionResult {
  readonly runId: string;
  readonly jobId: string;
  readonly stageBefore: string;
  readonly issueRelativePath: string;
  readonly implementationStepId: string;
  readonly runAfterWorker: JsonRecord;
  readonly workerJobAfterRun: JsonRecord;
  readonly ledger: JsonRecord;
  readonly advancedRun?: JsonRecord;
}

function envFlagEnabled(env: Readonly<Record<string, string | undefined>>, key: string) {
  return env[key] === "1";
}

export function liveWorkerJobVerificationRequested(env: Readonly<Record<string, string | undefined>> = process.env) {
  return envFlagEnabled(env, LIVE_WORKER_JOB_VERIFY_ENV);
}

export function autoImplementationWorkerGateEvidence(
  env: Readonly<Record<string, string | undefined>> = process.env
): AutoImplementationWorkerGateEvidence {
  if (!liveWorkerJobVerificationRequested(env)) {
    return {
      status: "ready",
      smoke: AUTO_IMPLEMENTATION_WORKER_SMOKE,
      mode: "fixture",
      checked: [
        `${LIVE_WORKER_JOB_VERIFY_ENV} is not set; fixture worker-job smoke will run`,
        "default smoke remains credential-free"
      ]
    };
  }

  if (!envFlagEnabled(env, LIVE_TURNS_ENV)) {
    return {
      status: "blocked",
      smoke: AUTO_IMPLEMENTATION_WORKER_SMOKE,
      mode: "live",
      reason: `Live worker-job verification was requested, but ${LIVE_TURNS_ENV}=1 is missing.`,
      blockers: [REQUIRED_LIVE_GATE_BLOCKER],
      checked: [
        `${LIVE_WORKER_JOB_VERIFY_ENV}=1 requested live worker-job verification`,
        REQUIRED_LIVE_GATE_BLOCKER
      ]
    };
  }

  return {
    status: "ready",
    smoke: AUTO_IMPLEMENTATION_WORKER_SMOKE,
    mode: "live",
    checked: [
      `${LIVE_WORKER_JOB_VERIFY_ENV}=1 requested live worker-job verification`,
      `${LIVE_TURNS_ENV}=1 enables bounded local worker turns`
    ]
  };
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`
  };
}

async function jsonEnvelope(response: Response, label: string) {
  const body = (await response.json()) as JsonRecord;

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${label} failed with HTTP ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function postJson(
  app: ReturnType<typeof createSidecarApp>,
  path: string,
  localCapabilityToken: string,
  body: Readonly<Record<string, unknown>>
) {
  const response = await app.request(path, {
    method: "POST",
    headers: {
      ...authHeaders(localCapabilityToken),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = dataRecord(await jsonEnvelope(response, path), path);

  if (data.category === "rejected") {
    throw new Error(`${path} rejected: ${JSON.stringify(data.error ?? data)}`);
  }

  return data;
}

async function getJson(app: ReturnType<typeof createSidecarApp>, path: string, localCapabilityToken: string) {
  const response = await app.request(path, {
    headers: authHeaders(localCapabilityToken)
  });

  return dataRecord(await jsonEnvelope(response, path), path);
}

function dataRecord(body: JsonRecord, label: string) {
  if (!body.ok || typeof body.data !== "object" || body.data === null) {
    throw new Error(`${label} did not return an ok data envelope.`);
  }

  return body.data as JsonRecord;
}

function objectAt(value: unknown, label: string) {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${label} must be an object; received ${JSON.stringify(value)}.`);
  }

  return value as JsonRecord;
}

function recordArray(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "object" || item === null)) {
    throw new Error(`${label} must be an array of objects.`);
  }

  return value as readonly JsonRecord[];
}

function lastRecord(value: unknown, label: string) {
  const records = recordArray(value, label);
  const last = records.at(-1);

  if (!last) {
    throw new Error(`${label} must not be empty.`);
  }

  return last;
}

function stringAt(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}


function runtimePublicStatus(status: CodexRuntimeStatusDto) {
  return {
    status: status.status,
    executionMode: status.executionMode,
    liveTurnExecutionEnabled: status.liveTurnExecutionEnabled,
    accountStatus: status.account.status
  };
}

function runtimeStatusBlockers(mode: SmokeMode, status: CodexRuntimeStatusDto) {
  const blockers: string[] = [];

  if (status.status !== "available") {
    blockers.push(`runtime status must be available; received ${JSON.stringify(status.status)}`);
  }

  if (mode === "fixture" && status.executionMode !== "fixture") {
    blockers.push(`fixture smoke requires executionMode=fixture; received ${JSON.stringify(status.executionMode)}`);
  }

  if (mode === "live" && status.executionMode !== "live") {
    blockers.push(`live smoke requires executionMode=live; received ${JSON.stringify(status.executionMode)}`);
  }

  if (mode === "live" && status.liveTurnExecutionEnabled !== true) {
    blockers.push("live smoke requires liveTurnExecutionEnabled=true");
  }

  if (mode === "live" && status.account.status !== "authenticated") {
    blockers.push(`live smoke requires an authenticated Codex account; received ${JSON.stringify(status.account.status)}`);
  }

  return blockers;
}

function planningReadySourceRefs(sessionId: string): readonly PlanningHandoffSourceRefDto[] {
  return [
    {
      sourceType: "spec_version",
      sourceId: PLANNING_READY_SPEC_VERSION_REF,
      sourceLabel: "Worker smoke ready SpecVersion",
      required: true,
      stale: false
    },
    {
      sourceType: "completion_candidate",
      sourceId: `completion_candidate:${sessionId}:${PLANNING_READY_PROJECTION_VERSION}`,
      sourceLabel: "Worker smoke completion candidate",
      required: true,
      stale: false
    },
    {
      sourceType: "decision_linked_evidence_pack",
      sourceId: PLANNING_READY_EVIDENCE_PACK_ID,
      sourceLabel: "Worker smoke Evidence Pack",
      required: true,
      stale: false
    },
    {
      sourceType: "research_updated_queue_item",
      sourceId: PLANNING_READY_QUEUE_ITEM_ID,
      sourceLabel: "Worker smoke research queue card",
      required: true,
      stale: false
    }
  ];
}

async function seedPlanningReadyState(
  storage: Awaited<ReturnType<typeof createSoloStorage>>,
  projectId: string,
  sessionId: string
) {
  const eventRepository = createEventRepository(storage.db);
  const correlationId = `corr_worker_job_smoke_${sessionId}` as CorrelationId;

  await eventRepository.append({
    eventId: `evt_worker_job_smoke_spec_${sessionId}` as EventId,
    eventType: "SpecVersionCreated",
    projectId: projectId as ProjectId,
    sessionId: sessionId as SessionId,
    sourceCommandId: `cmd_worker_job_smoke_spec_${sessionId}` as CommandId,
    correlationId,
    causationId: null,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    occurredAt: "2026-05-23T00:01:00.000Z",
    payload: {
      versionRef: PLANNING_READY_SPEC_VERSION_REF,
      title: "Worker smoke Planning Handoff ready spec",
      sections: ["Problem", "Customer", "Value", "Validation"]
    }
  });

  await eventRepository.append({
    eventId: `evt_worker_job_smoke_evidence_${sessionId}` as EventId,
    eventType: "EvidenceSynthesized",
    projectId: projectId as ProjectId,
    sessionId: sessionId as SessionId,
    sourceCommandId: `cmd_worker_job_smoke_evidence_${sessionId}` as CommandId,
    correlationId,
    causationId: null,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    occurredAt: "2026-05-23T00:02:00.000Z",
    payload: planningReadyEvidencePayload(sessionId)
  });
}

function planningReadyEvidencePayload(sessionId: string) {
  return {
    projection: {
      kind: "ResearchEvidenceProjection",
      version: PLANNING_READY_PROJECTION_VERSION,
      taskIds: [PLANNING_READY_RESEARCH_TASK_ID],
      tasks: [planningReadyTask(sessionId)],
      results: [planningReadyResult()],
      evidenceMatrices: [planningReadyEvidenceMatrix()],
      evidencePacks: [planningReadyEvidencePack()],
      reviewCards: [planningReadyReviewCard()],
      knownRisks: [],
      nextValidationActions: [],
      proConBalanceStatus: "balanced"
    },
    queueProjection: {
      kind: "DecisionQueueProjection",
      version: PLANNING_READY_PROJECTION_VERSION,
      active: [],
      next: [],
      blocked: [],
      deferred: [planningReadyDeferredQueueItem()]
    },
    confidenceProjection: {
      kind: "ConfidenceCompletionProjection",
      version: PLANNING_READY_PROJECTION_VERSION,
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
  };
}

function planningReadyTask(sessionId: string) {
  return {
    researchTaskId: PLANNING_READY_RESEARCH_TASK_ID,
    sessionId: sessionId as SessionId,
    objective: "Validate worker-job smoke Planning Handoff evidence.",
    routeOutcome: "research_needed",
    impact: "high",
    status: "evidence_ready",
    createdAt: "2026-05-23T00:01:30.000Z"
  };
}

function planningReadyResult() {
  return {
    researchResultId: PLANNING_READY_RESEARCH_RESULT_ID,
    researchTaskId: PLANNING_READY_RESEARCH_TASK_ID,
    resultSummary: "Accepted evidence supports a worker-job smoke run.",
    sourceReliability: "high",
    claim: "The worker smoke can exercise a bounded local implementation slice.",
    decisionContext: "Worker smoke Planning Handoff",
    importedAt: "2026-05-23T00:01:45.000Z"
  };
}

function planningReadyEvidenceMatrix() {
  return {
    evidenceMatrixId: "evidence_matrix_worker_job_smoke_ready",
    researchTaskId: PLANNING_READY_RESEARCH_TASK_ID,
    researchResultId: PLANNING_READY_RESEARCH_RESULT_ID,
    synthesisVersion: 1,
    proEvidence: [
      {
        evidenceItemId: PLANNING_READY_EVIDENCE_ITEM_ID,
        kind: "pro",
        summary: "Worker smoke fixture has accepted evidence."
      }
    ],
    conEvidence: [],
    uncertainties: [],
    additionalQuestions: [],
    balanceStatus: "balanced",
    decisionBlocked: false
  };
}

function planningReadyEvidencePack() {
  return {
    evidencePackId: PLANNING_READY_EVIDENCE_PACK_ID,
    researchTaskId: PLANNING_READY_RESEARCH_TASK_ID,
    researchResultId: PLANNING_READY_RESEARCH_RESULT_ID,
    claim: "The worker smoke can exercise a bounded local implementation slice.",
    decisionContext: "Worker smoke Planning Handoff",
    sourceReliability: "high",
    retrievedAt: "2026-05-23T00:01:50.000Z",
    gateStatus: "accepted",
    gateChecks: [
      {
        code: "source_metadata",
        status: "passed",
        reason: "Source metadata is present."
      }
    ],
    proEvidenceItemIds: [PLANNING_READY_EVIDENCE_ITEM_ID],
    conEvidenceItemIds: [],
    uncertaintyItemIds: [],
    limitationRefs: [],
    implicationScope: "Worker smoke Planning Handoff",
    createdAt: "2026-05-23T00:01:55.000Z"
  };
}

function planningReadyReviewCard() {
  return {
    cardId: PLANNING_READY_QUEUE_ITEM_ID,
    researchTaskId: PLANNING_READY_RESEARCH_TASK_ID,
    evidencePackId: PLANNING_READY_EVIDENCE_PACK_ID,
    cardType: "research_review",
    title: "Worker smoke Planning Handoff evidence",
    state: "resolved",
    impact: "high",
    gateStatus: "accepted",
    availableOutcomes: ["approved", "revised", "risk_accepted", "research_insufficient"],
    terminalOutcome: "approved",
    blocksPlanning: true,
    recoveryActions: ["approve_evidence"]
  };
}

function planningReadyDeferredQueueItem() {
  return {
    queueItemId: PLANNING_READY_QUEUE_ITEM_ID,
    title: "Worker smoke Planning Handoff evidence",
    state: "resolved",
    cardType: "research_review",
    researchTaskId: PLANNING_READY_RESEARCH_TASK_ID,
    evidencePackId: PLANNING_READY_EVIDENCE_PACK_ID,
    blocksPlanning: true,
    availableOutcomes: ["approved", "revised", "risk_accepted", "research_insufficient"],
    terminalOutcome: "approved"
  };
}

async function createProject(app: ReturnType<typeof createSidecarApp>, localCapabilityToken: string) {
  const data = await postJson(app, "/api/v1/projects", localCapabilityToken, {
    rawIdea: "A worker-job smoke idea that should become a bounded local implementation slice.",
    localPrivacyMode: "local_only",
    projectPurposeMode: "business",
    projectPurposeModeConfirmation: "user_confirmed",
    businessCriticIntensity: "balanced",
    businessCriticIntensityConfirmation: "user_confirmed"
  });
  const projection = objectAt(data.immediateProjection, "project immediateProjection");

  return {
    projectId: stringAt(projection.projectId, "projectId"),
    sessionId: stringAt(projection.sessionId, "sessionId")
  };
}

async function createPlanningHandoff(input: {
  readonly scenario: WorkerScenario;
  readonly localCapabilityToken: string;
  readonly projectId: string;
  readonly sessionId: string;
}) {
  await seedPlanningReadyState(input.scenario.storage, input.projectId, input.sessionId);

  const expectedStateVersion = await sessionEventCount(input.scenario.storage, input.sessionId);
  const data = await postJson(
    input.scenario.storageApp,
    `/api/v1/sessions/${input.sessionId}/planning-handoff`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      expectedStateVersion,
      sourceRefs: planningReadySourceRefs(input.sessionId)
    }
  );
  const projection = objectAt(data.immediateProjection, "planning handoff projection");
  const finalArtifact = objectAt(projection.finalArtifact, "planning handoff finalArtifact");

  if (projection.currentStatus !== "planning_ready") {
    throw new Error(`planning handoff must be planning_ready; received ${JSON.stringify(projection.currentStatus)}`);
  }

  return stringAt(finalArtifact.artifactId, "planning handoff artifactId");
}

async function sessionEventCount(storage: Awaited<ReturnType<typeof createSoloStorage>>, sessionId: string) {
  return (await createEventRepository(storage.db).listForSession(sessionId as SessionId)).length;
}

async function createAutoImplementationRun(input: {
  readonly scenario: WorkerScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly sourcePlanningRef: string;
}) {
  const data = await postJson(
    input.scenario.storageApp,
    `/api/v1/sessions/${input.sessionId}/auto-implementation-runs`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      idempotencyKey: "worker-job-smoke:auto-run",
      projectFolderName: PROJECT_FOLDER_NAME,
      projectName: "Worker Job Smoke Demo",
      sourcePlanningRef: input.sourcePlanningRef
    }
  );

  return latestRunFromProjection(data, "created auto implementation run");
}

function latestRunFromProjection(projection: JsonRecord, label: string) {
  return objectAt(projection.latestRun, `${label} latestRun`);
}

async function createExecutionAuthority(input: {
  readonly scenario: WorkerScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly generatedRepoPath: string;
}) {
  const expectedStateVersion = await sessionEventCount(input.scenario.storage, input.sessionId);
  const data = await postJson(
    input.scenario.storageApp,
    `/api/v1/sessions/${input.sessionId}/execution-authority`,
    input.localCapabilityToken,
    executionAuthorityRequest(input.sessionId, expectedStateVersion, input.generatedRepoPath)
  );
  const projection = objectAt(data.immediateProjection, "execution authority projection");
  const latestRecord = objectAt(projection.latestRecord, "execution authority latestRecord");

  return stringAt(latestRecord.recordId, "execution authority recordId");
}

function executionAuthorityRequest(sessionId: string, expectedStateVersion: number, workspaceRef: string) {
  return {
    sessionId,
    expectedStateVersion,
    idempotencyKey: "worker-job-smoke:execution-authority",
    sourcePlanningHandoffRef: "worker-job-smoke-planning-handoff",
    boundedAgentOutput: {
      outputId: "bounded_output_worker_job_smoke",
      sourceRefs: ["worker-job-smoke-planning-handoff"],
      intendedDecisionImpact: "Validate a bounded local worker job smoke run.",
      proposedActionPreviewRefs: ["worker_job_smoke_preview"],
      requiredApprovals: ["worker_job_smoke_approval"],
      evidenceRefs: ["worker_job_smoke_evidence"],
      failureMode: "ready_for_preview",
      noExecutionPolicy: "controlled_execution_required"
    },
    actionClass: "file_diff",
    previewArtifactRef: "worker_job_smoke_preview",
    previewArtifactHash: "sha256:worker-job-smoke",
    reviewedPreviewArtifactHash: "sha256:worker-job-smoke",
    requestedScope: {
      workspaceRef,
      filePathGlobs: ["**/*"]
    },
    approvalDecision: "approved",
    approver: {
      actorId: "worker_job_smoke_owner",
      actorType: "user",
      approvedAt: "2026-05-23T00:03:00.000Z",
      decidedAt: "2026-05-23T00:03:00.000Z"
    },
    sandboxBoundary: {
      mode: "workspace_patch",
      networkPolicy: "blocked",
      secretPolicy: "no_secret_values"
    },
    rollbackReference: {
      kind: "git_diff_reverse",
      ref: "worker_job_smoke_rollback"
    },
    evidenceRefs: ["worker_job_smoke_authority_evidence"],
    auditRefs: ["worker_job_smoke_authority_audit"],
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

async function createWorkerJob(input: {
  readonly scenario: WorkerScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly runId: string;
  readonly executionAuthorityRef: string;
}) {
  const data = await postJson(
    input.scenario.storageApp,
    `/api/v1/sessions/${input.sessionId}/auto-implementation-runs/${input.runId}/worker-jobs`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      runId: input.runId,
      idempotencyKey: "worker-job-smoke:plan-worker",
      executionAuthorityRef: input.executionAuthorityRef
    }
  );
  const latestRun = latestRunFromProjection(data, "planned worker job");

  return {
    latestRun,
    workerJob: lastRecord(latestRun.workerJobs, "planned worker jobs")
  };
}

async function runWorkerJob(input: {
  readonly scenario: WorkerScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly runId: string;
  readonly jobId: string;
}) {
  const data = await postJson(
    input.scenario.storageApp,
    `/api/v1/sessions/${input.sessionId}/auto-implementation-runs/${input.runId}/worker-jobs/${encodeURIComponent(input.jobId)}/run`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      runId: input.runId,
      jobId: input.jobId,
      idempotencyKey: "worker-job-smoke:run-worker",
      evidenceRefs: [`worker-job-smoke:run:${input.jobId}`]
    }
  );
  const latestRun = latestRunFromProjection(data, "ran worker job");

  return {
    latestRun,
    workerJob: lastRecord(latestRun.workerJobs, "worker jobs after run")
  };
}

async function advanceWorkerStage(input: {
  readonly scenario: WorkerScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly runId: string;
  readonly jobId: string;
}) {
  const data = await postJson(
    input.scenario.storageApp,
    `/api/v1/sessions/${input.sessionId}/auto-implementation-runs/${input.runId}/worker-jobs/${encodeURIComponent(input.jobId)}/advance-stage`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      runId: input.runId,
      jobId: input.jobId,
      idempotencyKey: "worker-job-smoke:advance-stage",
      tickedAt: "2026-05-23T00:10:00.000Z",
      evidenceRefs: [`worker-job-smoke:advance:${input.jobId}`]
    }
  );

  return latestRunFromProjection(data, "advanced worker stage");
}

async function executeWorkerFlow(scenario: WorkerScenario, localCapabilityToken: string): Promise<WorkerExecutionResult> {
  const { projectId, sessionId } = await createProject(scenario.storageApp, localCapabilityToken);
  const sourcePlanningRef = await createPlanningHandoff({ scenario, localCapabilityToken, projectId, sessionId });
  const createdRun = await createAutoImplementationRun({ scenario, localCapabilityToken, sessionId, sourcePlanningRef });
  const runId = stringAt(createdRun.runId, "auto implementation runId");
  const generatedRepoPath = stringAt(createdRun.generatedRepoPath, "auto implementation generatedRepoPath");
  const executionAuthorityRef = await createExecutionAuthority({
    scenario,
    localCapabilityToken,
    sessionId,
    generatedRepoPath
  });
  const planned = await createWorkerJob({ scenario, localCapabilityToken, sessionId, runId, executionAuthorityRef });
  const jobId = stringAt(planned.workerJob.jobId, "worker jobId");
  const stageBefore = stringAt(planned.workerJob.stage, "worker job stage");
  const issueRelativePath = stringAt(planned.workerJob.issueRelativePath, "worker issueRelativePath");
  const executionPlan = objectAt(planned.workerJob.executionPlan, "worker executionPlan");
  const ledgerStepDoc = objectAt(executionPlan.ledgerStepDoc, "worker executionPlan.ledgerStepDoc");
  const implementationStepId = stringAt(ledgerStepDoc.stepId, "worker ledgerStepDoc.stepId");
  const ran = await runWorkerJob({ scenario, localCapabilityToken, sessionId, runId, jobId });

  if (ran.workerJob.status !== "completed") {
    return {
      runId,
      jobId,
      stageBefore,
      issueRelativePath,
      implementationStepId,
      runAfterWorker: ran.latestRun,
      workerJobAfterRun: ran.workerJob,
      ledger: { currentStatus: "missing" }
    };
  }

  const ledger = await getJson(scenario.storageApp, `/api/v1/sessions/${sessionId}/implementation-step-ledger`, localCapabilityToken);

  return {
    runId,
    jobId,
    stageBefore,
    issueRelativePath,
    implementationStepId,
    runAfterWorker: ran.latestRun,
    workerJobAfterRun: ran.workerJob,
    ledger,
    advancedRun: await advanceWorkerStage({ scenario, localCapabilityToken, sessionId, runId, jobId })
  };
}

function workerEvidence(result: WorkerExecutionResult) {
  const advancedRun = result.advancedRun ?? result.runAfterWorker;

  return {
    runId: result.runId,
    jobId: result.jobId,
    jobStatus: stringAt(result.workerJobAfterRun.status, "worker job status"),
    stageBefore: result.stageBefore,
    stageAfter: stringAt(advancedRun.currentStage, "advanced currentStage"),
    ledgerStatus: stringAt(result.ledger.currentStatus, "implementation ledger currentStatus"),
    implementationStepId: result.implementationStepId,
    projectFolderName: PROJECT_FOLDER_NAME,
    issueRelativePath: result.issueRelativePath
  };
}

function workerResultBlockers(result: WorkerExecutionResult) {
  const blockers: string[] = [];

  if (result.workerJobAfterRun.status !== "completed") {
    blockers.push(`worker job must be completed; received ${JSON.stringify(result.workerJobAfterRun.status)}`);
  }

  if (result.ledger.currentStatus !== "completed") {
    blockers.push(`implementation ledger must be completed; received ${JSON.stringify(result.ledger.currentStatus)}`);
  }

  if (!result.advancedRun) {
    blockers.push("worker stage was not advanced because completed worker evidence was unavailable");
  } else if (result.advancedRun.currentStage === result.stageBefore) {
    blockers.push(`current stage must advance beyond ${result.stageBefore}`);
  }

  const missingEvidence = result.workerJobAfterRun.missingEvidence;

  if (Array.isArray(missingEvidence) && missingEvidence.length > 0) {
    blockers.push(`worker job still reports missing evidence: ${missingEvidence.join(", ")}`);
  }

  return blockers;
}

function blockedRuntimeEvidence(input: WorkerScenarioInput, status: CodexRuntimeStatusDto, blockers: readonly string[]) {
  return {
    status: "blocked" as const,
    smoke: AUTO_IMPLEMENTATION_WORKER_SMOKE,
    mode: input.mode,
    runtime: runtimePublicStatus(status),
    reason: "Runtime status is not ready for the requested worker-job smoke mode.",
    blockers,
    checked: [...input.gateChecked, "runtime status read before creating a worker job"]
  };
}

function blockedWorkerEvidence(
  input: WorkerScenarioInput,
  status: CodexRuntimeStatusDto,
  result: WorkerExecutionResult,
  blockers: readonly string[]
) {
  return {
    status: "blocked" as const,
    smoke: AUTO_IMPLEMENTATION_WORKER_SMOKE,
    mode: input.mode,
    runtime: runtimePublicStatus(status),
    worker: workerEvidence(result),
    reason: "Auto implementation worker job did not complete and advance with ledger evidence.",
    blockers,
    checked: [
      ...input.gateChecked,
      "runtime status available before worker execution",
      "planning-ready handoff created",
      "auto implementation workspace run created",
      "ready file-diff ExecutionAuthorityRecord attached",
      "worker job planned and run",
      "ImplementationStepLedger inspected"
    ]
  };
}

function passedWorkerEvidence(input: WorkerScenarioInput, status: CodexRuntimeStatusDto, result: WorkerExecutionResult) {
  return {
    status: "passed" as const,
    smoke: AUTO_IMPLEMENTATION_WORKER_SMOKE,
    mode: input.mode,
    runtime: runtimePublicStatus(status),
    worker: workerEvidence(result),
    checked: [
      ...input.gateChecked,
      "runtime status available before worker execution",
      "planning-ready handoff created",
      "auto implementation workspace run created",
      "ready file-diff ExecutionAuthorityRecord attached",
      "worker job planned and run",
      "ImplementationStepLedger completed",
      "worker stage advanced through the stage-advance route"
    ]
  };
}

async function createWorkerScenario(
  appDataDir: string,
  mode: SmokeMode,
  localCapabilityToken: string,
  env: Readonly<Record<string, string | undefined>>,
  runtimeAdapter?: CodexRuntimeAdapter
): Promise<WorkerScenario> {
  const storage = await createSoloStorage({ url: localDatabaseUrlFromAppDataDir(appDataDir) });
  const migrationStatus = await applyMigrations(storage);

  if (migrationStatus.state === "failed") {
    await storage.close();
    throw new Error(migrationStatus.errorMessage);
  }

  const workspaceRoot = join(appDataDir, "worker-workspaces");
  const codexRuntimeAdapter = runtimeAdapter ?? createCodexRuntimeAdapter({
    fixtureMode: mode === "fixture",
    env,
    now: () => FIXTURE_NOW
  });

  return {
    storage,
    codexRuntimeAdapter,
    workspaceRoot,
    storageApp: createSidecarApp({
      localCapabilityToken,
      migrationStatus,
      storage,
      codexRuntimeAdapter,
      autoImplementationWorkspaceRoot: workspaceRoot
    })
  };
}

async function runWorkerScenario(input: WorkerScenarioInput) {
  const scenario = await createWorkerScenario(
    input.appDataDir,
    input.mode,
    input.localCapabilityToken,
    input.env,
    input.runtimeAdapter
  );

  try {
    const status = await scenario.codexRuntimeAdapter.getStatus();
    const runtimeBlockers = runtimeStatusBlockers(input.mode, status);

    if (runtimeBlockers.length > 0) {
      return blockedRuntimeEvidence(input, status, runtimeBlockers);
    }

    const result = await executeWorkerFlow(scenario, input.localCapabilityToken);
    const blockers = workerResultBlockers(result);

    if (blockers.length > 0) {
      return blockedWorkerEvidence(input, status, result, blockers);
    }

    return passedWorkerEvidence(input, status, result);
  } finally {
    await scenario.storage.close();
  }
}

export async function runAutoImplementationWorkerSmoke(
  options: AutoImplementationWorkerSmokeOptions = {}
): Promise<AutoImplementationWorkerSmokeEvidence> {
  const env = options.env ?? process.env;
  const gate = autoImplementationWorkerGateEvidence(env);

  if (gate.status === "blocked") {
    return {
      status: "blocked",
      smoke: gate.smoke,
      mode: gate.mode,
      ...(gate.reason ? { reason: gate.reason } : {}),
      ...(gate.blockers ? { blockers: gate.blockers } : {}),
      checked: gate.checked
    };
  }

  const appDataDir = options.appDataDir ?? (await mkdtemp(join(tmpdir(), "solo-superman-worker-job-smoke-")));
  const shouldCleanup = options.cleanupAppDataDir ?? !options.appDataDir;
  const localCapabilityToken = options.localCapabilityToken ?? `worker-job-smoke-${randomUUID()}`;

  try {
    return await runWorkerScenario({
      mode: gate.mode,
      gateChecked: gate.checked,
      appDataDir,
      localCapabilityToken,
      env,
      ...(options.runtimeAdapter ? { runtimeAdapter: options.runtimeAdapter } : {})
    });
  } finally {
    if (shouldCleanup) {
      await rm(appDataDir, { recursive: true, force: true });
    }
  }
}

function exitCodeForEvidence(evidence: AutoImplementationWorkerSmokeEvidence) {
  return evidence.status === "passed" ? 0 : 1;
}

async function main() {
  const evidence = await runAutoImplementationWorkerSmoke();

  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = exitCodeForEvidence(evidence);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
