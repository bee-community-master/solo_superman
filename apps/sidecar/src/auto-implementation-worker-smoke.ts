import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  type CodexRuntimeStatusDto
} from "@solo-superman/contracts";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "@solo-superman/db";
import {
  createSmokePlanningHandoff,
  createSmokeProject,
  getJson,
  lastRecord,
  objectAt,
  postJson,
  recordArray,
  sessionEventCount,
  stringAt,
  type AutoImplementationSmokePlanningFixture,
  type JsonRecord,
  type SmokeSidecarApp,
  type SmokeStorage
} from "./auto-implementation-smoke-fixtures";
import { createCodexRuntimeAdapter, type CodexRuntimeAdapter } from "./runtime";
import { createSidecarApp } from "./server";
import { removeTemporaryDirectory } from "./test-cleanup";

export const LIVE_WORKER_JOB_VERIFY_ENV = "SOLO_VERIFY_CODEX_LIVE_WORKER_JOB" as const;
export const LIVE_TURNS_ENV = "SOLO_CODEX_SDK_LIVE_TURNS" as const;
export const AUTO_IMPLEMENTATION_WORKER_SMOKE = "auto_implementation_worker_job" as const;

const FIXTURE_NOW = "2026-05-23T00:00:00.000Z";
const PROJECT_FOLDER_NAME = "worker-job-smoke-demo";
const REQUIRED_LIVE_GATE_BLOCKER = `${LIVE_TURNS_ENV}=1 is required before live worker-job execution can be verified`;
const PLANNING_FIXTURE: AutoImplementationSmokePlanningFixture = {
  idPrefix: "worker_job_smoke",
  sourceLabelPrefix: "Worker smoke Planning Handoff",
  specTitle: "Worker smoke Planning Handoff ready spec",
  taskObjective: "Validate worker-job smoke Planning Handoff evidence.",
  resultSummary: "Accepted evidence supports a worker-job smoke run.",
  claim: "The worker smoke can exercise a bounded local implementation slice.",
  decisionContext: "Worker smoke Planning Handoff",
  completionSummary: "Spec and research are ready for Planning Handoff.",
  nextBuildSliceSummary: "Next build slice can be planned."
};

type SmokeMode = "fixture" | "live";
type SmokeStatus = "blocked" | "passed";

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
    readonly blockedReason?: string;
    readonly missingEvidence?: readonly string[];
    readonly nextRequiredAction?: string;
    readonly stageBefore: string;
    readonly stageAfter: string;
    readonly ledgerStatus: string;
    readonly implementationStepId: string;
    readonly projectFolderName: string;
    readonly issueRelativePath: string;
    readonly generatedProductAllowedScope: readonly string[];
    readonly generatedProductChangedFiles: readonly string[];
    readonly generatedProductChangedFileCount: number;
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
  readonly storageApp: SmokeSidecarApp;
  readonly storage: SmokeStorage;
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
  readonly generatedProductAllowedScope: readonly string[];
  readonly runAfterWorker: JsonRecord;
  readonly workerJobAfterRun: JsonRecord;
  readonly ledger: JsonRecord;
  readonly advancedRun?: JsonRecord;
}

interface PreparedWorkerRun {
  readonly sessionId: string;
  readonly runId: string;
  readonly generatedRepoPath: string;
}

interface PlannedWorkerJobContext {
  readonly jobId: string;
  readonly stageBefore: string;
  readonly issueRelativePath: string;
  readonly implementationStepId: string;
  readonly generatedProductAllowedScope: readonly string[];
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

export function autoImplementationWorkerSmokeEnvFromArgv(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env
): Readonly<Record<string, string | undefined>> {
  const nextEnv = { ...env };

  for (const arg of argv) {
    if (arg === "--live") {
      nextEnv[LIVE_WORKER_JOB_VERIFY_ENV] = "1";
      nextEnv[LIVE_TURNS_ENV] = "1";
      continue;
    }
    if (arg === "--fixture") {
      delete nextEnv[LIVE_WORKER_JOB_VERIFY_ENV];
      delete nextEnv[LIVE_TURNS_ENV];
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return nextEnv;
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

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function generatedProductPaths(values: readonly string[]) {
  return values.filter((value) => value.startsWith("generated-product/"));
}

function ledgerGeneratedProductChangedFiles(ledger: JsonRecord) {
  const changedFiles = recordArray(ledger.stepCommitRecords, "implementation ledger stepCommitRecords")
    .flatMap((record) => stringArray(record.changedFiles));

  return [...new Set(generatedProductPaths(changedFiles))];
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
    boundedAgentOutput: executionAuthorityBoundedOutput(),
    actionClass: "file_diff",
    previewArtifactRef: "worker_job_smoke_preview",
    previewArtifactHash: "sha256:worker-job-smoke",
    reviewedPreviewArtifactHash: "sha256:worker-job-smoke",
    requestedScope: {
      workspaceRef,
      filePathGlobs: ["**/*"]
    },
    approvalDecision: "approved",
    approver: executionAuthorityApprover(),
    sandboxBoundary: executionAuthoritySandboxBoundary(),
    rollbackReference: {
      kind: "git_diff_reverse",
      ref: "worker_job_smoke_rollback"
    },
    evidenceRefs: ["worker_job_smoke_authority_evidence"],
    auditRefs: ["worker_job_smoke_authority_audit"],
    preconditionChecks: executionAuthorityPreconditionChecks()
  };
}

function executionAuthorityBoundedOutput() {
  return {
    outputId: "bounded_output_worker_job_smoke",
    sourceRefs: ["worker-job-smoke-planning-handoff"],
    intendedDecisionImpact: "Validate a bounded local worker job smoke run.",
    proposedActionPreviewRefs: ["worker_job_smoke_preview"],
    requiredApprovals: ["worker_job_smoke_approval"],
    evidenceRefs: ["worker_job_smoke_evidence"],
    failureMode: "ready_for_preview",
    noExecutionPolicy: "controlled_execution_required"
  };
}

function executionAuthorityApprover() {
  return {
    actorId: "worker_job_smoke_owner",
    actorType: "user",
    approvedAt: "2026-05-23T00:03:00.000Z",
    decidedAt: "2026-05-23T00:03:00.000Z"
  };
}

function executionAuthoritySandboxBoundary() {
  return {
    mode: "workspace_patch",
    networkPolicy: "blocked",
    secretPolicy: "no_secret_values"
  };
}

function executionAuthorityPreconditionChecks() {
  return {
    planningSourceExists: true,
    previewArtifactExists: true,
    previewHashMatches: true,
    rollbackAvailable: true,
    credentialValueRequired: false,
    sandboxEnforced: true
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

async function prepareWorkerRun(scenario: WorkerScenario, localCapabilityToken: string): Promise<PreparedWorkerRun> {
  const { projectId, sessionId } = await createSmokeProject({
    app: scenario.storageApp,
    localCapabilityToken,
    rawIdea: "A worker-job smoke idea that should become a bounded local implementation slice."
  });
  const sourcePlanningRef = await createSmokePlanningHandoff({
    app: scenario.storageApp,
    storage: scenario.storage,
    localCapabilityToken,
    projectId,
    sessionId,
    fixture: PLANNING_FIXTURE
  });
  const createdRun = await createAutoImplementationRun({ scenario, localCapabilityToken, sessionId, sourcePlanningRef });
  const runId = stringAt(createdRun.runId, "auto implementation runId");
  const generatedRepoPath = stringAt(createdRun.generatedRepoPath, "auto implementation generatedRepoPath");

  return { sessionId, runId, generatedRepoPath };
}

async function planWorkerJob(input: {
  readonly scenario: WorkerScenario;
  readonly localCapabilityToken: string;
  readonly preparedRun: PreparedWorkerRun;
}): Promise<PlannedWorkerJobContext> {
  const executionAuthorityRef = await createExecutionAuthority({
    scenario: input.scenario,
    localCapabilityToken: input.localCapabilityToken,
    sessionId: input.preparedRun.sessionId,
    generatedRepoPath: input.preparedRun.generatedRepoPath
  });
  const planned = await createWorkerJob({
    scenario: input.scenario,
    localCapabilityToken: input.localCapabilityToken,
    sessionId: input.preparedRun.sessionId,
    runId: input.preparedRun.runId,
    executionAuthorityRef
  });
  const jobId = stringAt(planned.workerJob.jobId, "worker jobId");
  const stageBefore = stringAt(planned.workerJob.stage, "worker job stage");
  const issueRelativePath = stringAt(planned.workerJob.issueRelativePath, "worker issueRelativePath");
  const executionPlan = objectAt(planned.workerJob.executionPlan, "worker executionPlan");
  const generatedProductAllowedScope = generatedProductPaths(stringArray(executionPlan.allowedWriteScope));
  const ledgerStepDoc = objectAt(executionPlan.ledgerStepDoc, "worker executionPlan.ledgerStepDoc");
  const implementationStepId = stringAt(ledgerStepDoc.stepId, "worker ledgerStepDoc.stepId");

  return { jobId, stageBefore, issueRelativePath, implementationStepId, generatedProductAllowedScope };
}

async function executeWorkerFlow(scenario: WorkerScenario, localCapabilityToken: string): Promise<WorkerExecutionResult> {
  const preparedRun = await prepareWorkerRun(scenario, localCapabilityToken);
  const plannedJob = await planWorkerJob({ scenario, localCapabilityToken, preparedRun });
  const ran = await runWorkerJob({
    scenario,
    localCapabilityToken,
    sessionId: preparedRun.sessionId,
    runId: preparedRun.runId,
    jobId: plannedJob.jobId
  });

  if (ran.workerJob.status !== "completed") {
    return {
      runId: preparedRun.runId,
      ...plannedJob,
      runAfterWorker: ran.latestRun,
      workerJobAfterRun: ran.workerJob,
      ledger: { currentStatus: "missing" }
    };
  }

  const ledger = await getJson(
    scenario.storageApp,
    `/api/v1/sessions/${preparedRun.sessionId}/implementation-step-ledger`,
    localCapabilityToken
  );

  return {
    runId: preparedRun.runId,
    ...plannedJob,
    runAfterWorker: ran.latestRun,
    workerJobAfterRun: ran.workerJob,
    ledger,
    advancedRun: await advanceWorkerStage({
      scenario,
      localCapabilityToken,
      sessionId: preparedRun.sessionId,
      runId: preparedRun.runId,
      jobId: plannedJob.jobId
    })
  };
}

function workerEvidence(result: WorkerExecutionResult) {
  const advancedRun = result.advancedRun ?? result.runAfterWorker;
  const jobStatus = stringAt(result.workerJobAfterRun.status, "worker job status");
  const blockedReason = typeof result.workerJobAfterRun.blockedReason === "string"
    ? result.workerJobAfterRun.blockedReason
    : null;
  const nextRequiredAction = typeof result.workerJobAfterRun.nextRequiredAction === "string"
    ? result.workerJobAfterRun.nextRequiredAction
    : null;
  const missingEvidence = Array.isArray(result.workerJobAfterRun.missingEvidence)
    ? result.workerJobAfterRun.missingEvidence.filter((item): item is string => typeof item === "string")
    : [];
  const generatedProductChangedFiles = result.ledger.currentStatus === "completed"
    ? ledgerGeneratedProductChangedFiles(result.ledger)
    : [];

  return {
    runId: result.runId,
    jobId: result.jobId,
    jobStatus,
    ...(jobStatus !== "completed" && blockedReason ? { blockedReason } : {}),
    ...(jobStatus !== "completed" && missingEvidence.length ? { missingEvidence } : {}),
    ...(jobStatus !== "completed" && nextRequiredAction ? { nextRequiredAction } : {}),
    stageBefore: result.stageBefore,
    stageAfter: stringAt(advancedRun.currentStage, "advanced currentStage"),
    ledgerStatus: stringAt(result.ledger.currentStatus, "implementation ledger currentStatus"),
    implementationStepId: result.implementationStepId,
    projectFolderName: PROJECT_FOLDER_NAME,
    issueRelativePath: result.issueRelativePath,
    generatedProductAllowedScope: result.generatedProductAllowedScope,
    generatedProductChangedFiles,
    generatedProductChangedFileCount: generatedProductChangedFiles.length
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

  if (result.generatedProductAllowedScope.length < 1) {
    blockers.push("worker execution plan must explicitly include generated-product files in allowedWriteScope.");
  }

  if (result.ledger.currentStatus === "completed" && ledgerGeneratedProductChangedFiles(result.ledger).length < 1) {
    blockers.push("worker ledger must record at least one generated-product changed file.");
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

  if (
    result.workerJobAfterRun.status !== "completed" &&
    typeof result.workerJobAfterRun.blockedReason === "string" &&
    result.workerJobAfterRun.blockedReason.trim().length > 0
  ) {
    blockers.push(`worker job blocked reason: ${result.workerJobAfterRun.blockedReason}`);
  }

  if (
    result.workerJobAfterRun.status !== "completed" &&
    typeof result.workerJobAfterRun.nextRequiredAction === "string" &&
    result.workerJobAfterRun.nextRequiredAction.trim().length > 0
  ) {
    blockers.push(`worker job next required action: ${result.workerJobAfterRun.nextRequiredAction}`);
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
      "worker plan targeted generated-product files and ledger changed-file evidence references generated-product",
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
      await removeTemporaryDirectory(appDataDir);
    }
  }
}

function exitCodeForEvidence(evidence: AutoImplementationWorkerSmokeEvidence) {
  return evidence.status === "passed" ? 0 : 1;
}

async function main() {
  const evidence = await runAutoImplementationWorkerSmoke({
    env: autoImplementationWorkerSmokeEnvFromArgv(process.argv.slice(2))
  });

  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = exitCodeForEvidence(evidence);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
