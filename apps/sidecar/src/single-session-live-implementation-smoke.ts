import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { type CodexRuntimeStatusDto } from "@solo-superman/contracts";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "@solo-superman/db";
import {
  getJson,
  lastRecord,
  objectAt,
  postJson,
  recordArray,
  sessionEventCount,
  stringAt,
  type JsonRecord,
  type SmokeSidecarApp,
  type SmokeStorage
} from "./auto-implementation-smoke-fixtures";
import {
  LIVE_TURNS_ENV,
  LIVE_WORKER_JOB_VERIFY_ENV
} from "./auto-implementation-worker-smoke";
import { createCodexRuntimeAdapter, type CodexRuntimeAdapter } from "./runtime";
import { createSidecarApp } from "./server";
import {
  runSingleSessionProductLoopSmoke,
  type SingleSessionProductLoopSmokeEvidence
} from "./single-session-product-loop-smoke";
import { removeTemporaryDirectory } from "./test-cleanup";

export const SINGLE_SESSION_LIVE_IMPLEMENTATION_SMOKE = "single_session_live_implementation" as const;

const FIXTURE_NOW = "2026-05-25T00:00:00.000Z";
type SmokeMode = "fixture" | "live_web_worker";
type SmokeStatus = "blocked" | "passed";

type SingleSessionRunner = (input: {
  readonly appDataDir: string;
  readonly localCapabilityToken: string;
  readonly mode: "fixture" | "live_web";
}) => Promise<SingleSessionProductLoopSmokeEvidence>;

interface WorkerScenario {
  readonly app: SmokeSidecarApp;
  readonly storage: SmokeStorage;
  readonly codexRuntimeAdapter: CodexRuntimeAdapter;
}

interface WorkerExecutionResult {
  readonly runId: string;
  readonly jobId: string;
  readonly stageBefore: string;
  readonly issueRelativePath: string;
  readonly implementationStepId: string;
  readonly generatedProductAllowedScope: readonly string[];
  readonly workerJobAfterRun: JsonRecord;
  readonly ledger: JsonRecord;
  readonly advancedRun?: JsonRecord;
}

export interface SingleSessionLiveImplementationSmokeOptions {
  readonly appDataDir?: string;
  readonly cleanupAppDataDir?: boolean;
  readonly localCapabilityToken?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly mode?: SmokeMode;
  readonly runtimeAdapter?: CodexRuntimeAdapter;
  readonly runSingleSession?: SingleSessionRunner;
}

export interface SingleSessionLiveImplementationSmokeEvidence {
  readonly status: SmokeStatus;
  readonly smoke: typeof SINGLE_SESSION_LIVE_IMPLEMENTATION_SMOKE;
  readonly mode: SmokeMode;
  readonly singleSession?: SingleSessionProductLoopSmokeEvidence;
  readonly project?: {
    readonly projectId: string;
    readonly sessionId: string;
  };
  readonly runtime?: {
    readonly status: CodexRuntimeStatusDto["status"];
    readonly executionMode: CodexRuntimeStatusDto["executionMode"];
    readonly liveTurnExecutionEnabled: boolean;
    readonly accountStatus: CodexRuntimeStatusDto["account"]["status"];
  };
  readonly worker?: {
    readonly runId: string;
    readonly jobId: string;
    readonly sameSessionRunId: string;
    readonly jobStatus: string;
    readonly blockedReason?: string;
    readonly missingEvidence?: readonly string[];
    readonly nextRequiredAction?: string;
    readonly stageBefore: string;
    readonly stageAfter: string;
    readonly ledgerStatus: string;
    readonly implementationStepId: string;
    readonly issueRelativePath: string;
    readonly generatedProductAllowedScope: readonly string[];
    readonly generatedProductChangedFiles: readonly string[];
    readonly generatedProductChangedFileCount: number;
  };
  readonly reason?: string;
  readonly blockers?: readonly string[];
  readonly checked: readonly string[];
}

function envFlagEnabled(env: Readonly<Record<string, string | undefined>>, key: string) {
  return env[key] === "1";
}

export function singleSessionLiveImplementationEnvFromArgv(
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

export function singleSessionLiveImplementationModeFromArgv(argv: readonly string[]): SmokeMode {
  let mode: SmokeMode = "fixture";

  for (const arg of argv) {
    if (arg === "--live") {
      mode = "live_web_worker";
      continue;
    }
    if (arg === "--fixture") {
      mode = "fixture";
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return mode;
}

function liveGateBlockers(mode: SmokeMode, env: Readonly<Record<string, string | undefined>>) {
  if (mode === "fixture") {
    return [];
  }

  const blockers: string[] = [];

  if (!envFlagEnabled(env, LIVE_WORKER_JOB_VERIFY_ENV)) {
    blockers.push(`${LIVE_WORKER_JOB_VERIFY_ENV}=1 is required for same-session live implementation verification.`);
  }
  if (!envFlagEnabled(env, LIVE_TURNS_ENV)) {
    blockers.push(`${LIVE_TURNS_ENV}=1 is required for same-session live Codex worker execution.`);
  }

  return blockers;
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
    blockers.push(`fixture same-session worker proof requires executionMode=fixture; received ${JSON.stringify(status.executionMode)}`);
  }

  if (mode === "live_web_worker" && status.executionMode !== "live") {
    blockers.push(`live same-session implementation proof requires executionMode=live; received ${JSON.stringify(status.executionMode)}`);
  }

  if (mode === "live_web_worker" && status.liveTurnExecutionEnabled !== true) {
    blockers.push("live same-session implementation proof requires liveTurnExecutionEnabled=true");
  }

  if (mode === "live_web_worker" && status.account.status !== "authenticated") {
    blockers.push(`live same-session implementation proof requires an authenticated Codex account; received ${JSON.stringify(status.account.status)}`);
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
  const changedFiles = recordArray(ledger.stepCommitRecords, "same-session implementation ledger stepCommitRecords")
    .flatMap((record) => stringArray(record.changedFiles));

  return [...new Set(generatedProductPaths(changedFiles))];
}

async function createWorkerScenario(input: {
  readonly appDataDir: string;
  readonly localCapabilityToken: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly mode: SmokeMode;
  readonly runtimeAdapter?: CodexRuntimeAdapter;
}): Promise<WorkerScenario> {
  const storage = await createSoloStorage({ url: localDatabaseUrlFromAppDataDir(input.appDataDir) });
  const migrationStatus = await applyMigrations(storage);

  if (migrationStatus.state === "failed") {
    await storage.close();
    throw new Error(migrationStatus.errorMessage);
  }

  const codexRuntimeAdapter = input.runtimeAdapter ?? createCodexRuntimeAdapter({
    fixtureMode: input.mode === "fixture",
    env: input.env,
    now: () => FIXTURE_NOW
  });

  return {
    storage,
    codexRuntimeAdapter,
    app: createSidecarApp({
      localCapabilityToken: input.localCapabilityToken,
      migrationStatus,
      storage,
      codexRuntimeAdapter,
      autoImplementationWorkspaceRoot: join(input.appDataDir, "workspace")
    })
  };
}

function executionAuthorityRequest(input: {
  readonly sessionId: string;
  readonly expectedStateVersion: number;
  readonly workspaceRef: string;
  readonly planningArtifactId: string;
  readonly runId: string;
}) {
  return {
    sessionId: input.sessionId,
    expectedStateVersion: input.expectedStateVersion,
    idempotencyKey: `single-session-live-implementation:${input.runId}:execution-authority`,
    sourcePlanningHandoffRef: input.planningArtifactId,
    boundedAgentOutput: {
      outputId: `bounded_output_${input.runId}`,
      sourceRefs: [input.planningArtifactId],
      intendedDecisionImpact: "Run the first same-session implementation worker after idea clarification, research, and Planning Handoff.",
      proposedActionPreviewRefs: [`single_session_live_implementation_preview:${input.runId}`],
      requiredApprovals: [`single_session_live_implementation_approval:${input.runId}`],
      evidenceRefs: [`single_session_live_implementation_evidence:${input.runId}`],
      failureMode: "ready_for_preview",
      noExecutionPolicy: "controlled_execution_required"
    },
    actionClass: "file_diff",
    previewArtifactRef: `single_session_live_implementation_preview:${input.runId}`,
    previewArtifactHash: `sha256:single-session-live-implementation:${input.runId}`,
    reviewedPreviewArtifactHash: `sha256:single-session-live-implementation:${input.runId}`,
    requestedScope: {
      workspaceRef: input.workspaceRef,
      filePathGlobs: ["**/*"]
    },
    approvalDecision: "approved",
    approver: {
      actorId: "single_session_live_implementation_owner",
      actorType: "user",
      approvedAt: FIXTURE_NOW,
      decidedAt: FIXTURE_NOW
    },
    sandboxBoundary: {
      mode: "workspace_patch",
      networkPolicy: "blocked",
      secretPolicy: "no_secret_values"
    },
    rollbackReference: {
      kind: "git_diff_reverse",
      ref: `single_session_live_implementation_rollback:${input.runId}`
    },
    evidenceRefs: [`single_session_live_implementation_authority_evidence:${input.runId}`],
    auditRefs: [`single_session_live_implementation_authority_audit:${input.runId}`],
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

async function createExecutionAuthority(input: {
  readonly scenario: WorkerScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly generatedRepoPath: string;
  readonly planningArtifactId: string;
  readonly runId: string;
}) {
  const expectedStateVersion = await sessionEventCount(input.scenario.storage, input.sessionId);
  const data = await postJson(
    input.scenario.app,
    `/api/v1/sessions/${input.sessionId}/execution-authority`,
    input.localCapabilityToken,
    executionAuthorityRequest({
      sessionId: input.sessionId,
      expectedStateVersion,
      workspaceRef: input.generatedRepoPath,
      planningArtifactId: input.planningArtifactId,
      runId: input.runId
    })
  );
  const projection = objectAt(data.immediateProjection, "execution authority projection");
  const latestRecord = objectAt(projection.latestRecord, "execution authority latestRecord");

  return stringAt(latestRecord.recordId, "execution authority recordId");
}

function latestRunFromProjection(projection: JsonRecord, label: string) {
  return objectAt(projection.latestRun, `${label} latestRun`);
}

async function getLatestRun(input: {
  readonly scenario: WorkerScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly expectedRunId: string;
}) {
  const projection = objectAt(
    await getJson(input.scenario.app, `/api/v1/sessions/${input.sessionId}/auto-implementation-runs`, input.localCapabilityToken),
    "auto implementation projection"
  );
  const latestRun = latestRunFromProjection(projection, "same-session implementation");
  const actualRunId = stringAt(latestRun.runId, "same-session implementation runId");

  if (actualRunId !== input.expectedRunId) {
    throw new Error(`same-session worker proof must reuse run ${input.expectedRunId}; latest run is ${actualRunId}`);
  }

  return latestRun;
}

async function createWorkerJob(input: {
  readonly scenario: WorkerScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly runId: string;
  readonly executionAuthorityRef: string;
}) {
  const data = await postJson(
    input.scenario.app,
    `/api/v1/sessions/${input.sessionId}/auto-implementation-runs/${input.runId}/worker-jobs`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      runId: input.runId,
      idempotencyKey: `single-session-worker-job-smoke:${input.runId}:plan-worker`,
      executionAuthorityRef: input.executionAuthorityRef
    }
  );
  const latestRun = latestRunFromProjection(data, "same-session planned worker job");

  return {
    latestRun,
    workerJob: lastRecord(latestRun.workerJobs, "same-session planned worker jobs")
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
    input.scenario.app,
    `/api/v1/sessions/${input.sessionId}/auto-implementation-runs/${input.runId}/worker-jobs/${encodeURIComponent(input.jobId)}/run`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      runId: input.runId,
      jobId: input.jobId,
      idempotencyKey: `single-session-live-implementation:${input.runId}:run-worker`,
      evidenceRefs: [`single-session-live-implementation:run:${input.jobId}`]
    }
  );
  const latestRun = latestRunFromProjection(data, "same-session ran worker job");

  return {
    latestRun,
    workerJob: lastRecord(latestRun.workerJobs, "same-session worker jobs after run")
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
    input.scenario.app,
    `/api/v1/sessions/${input.sessionId}/auto-implementation-runs/${input.runId}/worker-jobs/${encodeURIComponent(input.jobId)}/advance-stage`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      runId: input.runId,
      jobId: input.jobId,
      idempotencyKey: `single-session-live-implementation:${input.runId}:advance-stage`,
      tickedAt: FIXTURE_NOW,
      evidenceRefs: [`single-session-live-implementation:advance:${input.jobId}`]
    }
  );

  return latestRunFromProjection(data, "same-session advanced worker stage");
}

async function executeWorkerForSingleSessionRun(input: {
  readonly scenario: WorkerScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly runId: string;
  readonly planningArtifactId: string;
}): Promise<WorkerExecutionResult> {
  const latestRun = await getLatestRun({
    scenario: input.scenario,
    localCapabilityToken: input.localCapabilityToken,
    sessionId: input.sessionId,
    expectedRunId: input.runId
  });
  const generatedRepoPath = stringAt(latestRun.generatedRepoPath, "same-session generatedRepoPath");
  const executionAuthorityRef = await createExecutionAuthority({
    scenario: input.scenario,
    localCapabilityToken: input.localCapabilityToken,
    sessionId: input.sessionId,
    generatedRepoPath,
    planningArtifactId: input.planningArtifactId,
    runId: input.runId
  });
  const planned = await createWorkerJob({
    scenario: input.scenario,
    localCapabilityToken: input.localCapabilityToken,
    sessionId: input.sessionId,
    runId: input.runId,
    executionAuthorityRef
  });
  const jobId = stringAt(planned.workerJob.jobId, "same-session worker jobId");
  const stageBefore = stringAt(planned.workerJob.stage, "same-session worker stage");
  const issueRelativePath = stringAt(planned.workerJob.issueRelativePath, "same-session worker issueRelativePath");
  const executionPlan = objectAt(planned.workerJob.executionPlan, "same-session worker executionPlan");
  const generatedProductAllowedScope = generatedProductPaths(stringArray(executionPlan.allowedWriteScope));
  const ledgerStepDoc = objectAt(executionPlan.ledgerStepDoc, "same-session worker executionPlan.ledgerStepDoc");
  const implementationStepId = stringAt(ledgerStepDoc.stepId, "same-session worker ledgerStepDoc.stepId");
  const ran = await runWorkerJob({
    scenario: input.scenario,
    localCapabilityToken: input.localCapabilityToken,
    sessionId: input.sessionId,
    runId: input.runId,
    jobId
  });

  if (ran.workerJob.status !== "completed") {
    return {
      runId: input.runId,
      jobId,
      stageBefore,
      issueRelativePath,
      implementationStepId,
      generatedProductAllowedScope,
      workerJobAfterRun: ran.workerJob,
      ledger: { currentStatus: "missing" }
    };
  }

  const ledger = objectAt(
    await getJson(input.scenario.app, `/api/v1/sessions/${input.sessionId}/implementation-step-ledger`, input.localCapabilityToken),
    "same-session implementation step ledger"
  );

  return {
    runId: input.runId,
    jobId,
    stageBefore,
    issueRelativePath,
    implementationStepId,
    generatedProductAllowedScope,
    workerJobAfterRun: ran.workerJob,
    ledger,
    advancedRun: await advanceWorkerStage({
      scenario: input.scenario,
      localCapabilityToken: input.localCapabilityToken,
      sessionId: input.sessionId,
      runId: input.runId,
      jobId
    })
  };
}

function workerEvidence(result: WorkerExecutionResult) {
  const advancedRun = result.advancedRun ?? { currentStage: result.stageBefore };
  const jobStatus = stringAt(result.workerJobAfterRun.status, "same-session worker job status");
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
    sameSessionRunId: result.runId,
    jobStatus,
    ...(jobStatus !== "completed" && blockedReason ? { blockedReason } : {}),
    ...(jobStatus !== "completed" && missingEvidence.length ? { missingEvidence } : {}),
    ...(jobStatus !== "completed" && nextRequiredAction ? { nextRequiredAction } : {}),
    stageBefore: result.stageBefore,
    stageAfter: stringAt(advancedRun.currentStage, "same-session advanced currentStage"),
    ledgerStatus: stringAt(result.ledger.currentStatus, "same-session implementation ledger currentStatus"),
    implementationStepId: result.implementationStepId,
    issueRelativePath: result.issueRelativePath,
    generatedProductAllowedScope: result.generatedProductAllowedScope,
    generatedProductChangedFiles,
    generatedProductChangedFileCount: generatedProductChangedFiles.length
  };
}

function workerResultBlockers(result: WorkerExecutionResult) {
  const blockers: string[] = [];

  if (result.workerJobAfterRun.status !== "completed") {
    blockers.push(`same-session worker job must be completed; received ${JSON.stringify(result.workerJobAfterRun.status)}`);
  }

  if (result.ledger.currentStatus !== "completed") {
    blockers.push(`same-session implementation ledger must be completed; received ${JSON.stringify(result.ledger.currentStatus)}`);
  }

  if (result.generatedProductAllowedScope.length < 1) {
    blockers.push("same-session worker plan must explicitly include generated-product files in allowedWriteScope.");
  }

  if (result.ledger.currentStatus === "completed" && ledgerGeneratedProductChangedFiles(result.ledger).length < 1) {
    blockers.push("same-session worker ledger must record at least one generated-product changed file.");
  }

  if (!result.advancedRun) {
    blockers.push("same-session worker stage was not advanced because completed worker evidence was unavailable");
  } else if (result.advancedRun.currentStage === result.stageBefore) {
    blockers.push(`same-session current stage must advance beyond ${result.stageBefore}`);
  }

  const missingEvidence = result.workerJobAfterRun.missingEvidence;

  if (Array.isArray(missingEvidence) && missingEvidence.length > 0) {
    blockers.push(`same-session worker job still reports missing evidence: ${missingEvidence.join(", ")}`);
  }

  return blockers;
}

function missingSingleSessionEvidence(evidence: SingleSessionProductLoopSmokeEvidence) {
  const blockers: string[] = [];

  if (evidence.status !== "passed") {
    blockers.push(`single-session product loop must pass before same-session worker execution; received ${evidence.status}`);
  }
  if (!evidence.project?.sessionId || !evidence.project.projectId) {
    blockers.push("single-session evidence must include project and session ids.");
  }
  if (!evidence.loop?.autoImplementationRunId) {
    blockers.push("single-session evidence must include the auto implementation run id.");
  }
  if (!evidence.loop?.planningArtifactId) {
    blockers.push("single-session evidence must include the Planning Handoff artifact id.");
  }
  if (evidence.loop?.autoImplementationCurrentStage !== "initial_pr") {
    blockers.push(`single-session auto implementation must reach initial_pr before worker execution; received ${evidence.loop?.autoImplementationCurrentStage ?? "missing"}`);
  }

  return blockers;
}

function blockedEvidence(input: {
  readonly mode: SmokeMode;
  readonly reason: string;
  readonly blockers: readonly string[];
  readonly checked: readonly string[];
  readonly singleSession?: SingleSessionProductLoopSmokeEvidence;
  readonly runtime?: CodexRuntimeStatusDto;
  readonly worker?: WorkerExecutionResult;
}): SingleSessionLiveImplementationSmokeEvidence {
  return {
    status: "blocked",
    smoke: SINGLE_SESSION_LIVE_IMPLEMENTATION_SMOKE,
    mode: input.mode,
    ...(input.singleSession ? { singleSession: input.singleSession } : {}),
    ...(input.singleSession?.project ? { project: input.singleSession.project } : {}),
    ...(input.runtime ? { runtime: runtimePublicStatus(input.runtime) } : {}),
    ...(input.worker ? { worker: workerEvidence(input.worker) } : {}),
    reason: input.reason,
    blockers: input.blockers,
    checked: input.checked
  };
}

function passedEvidence(input: {
  readonly mode: SmokeMode;
  readonly singleSession: SingleSessionProductLoopSmokeEvidence;
  readonly runtime: CodexRuntimeStatusDto;
  readonly worker: WorkerExecutionResult;
}): SingleSessionLiveImplementationSmokeEvidence {
  return {
    status: "passed",
    smoke: SINGLE_SESSION_LIVE_IMPLEMENTATION_SMOKE,
    mode: input.mode,
    singleSession: input.singleSession,
    ...(input.singleSession.project ? { project: input.singleSession.project } : {}),
    runtime: runtimePublicStatus(input.runtime),
    worker: workerEvidence(input.worker),
    checked: [
      "one pet-lifecycle idea stayed on one project/session through clarification, answer-linked research, follow-up question debt, readiness, and Planning Handoff",
      ...(input.mode === "live_web_worker"
        ? ["same-session live public-web research imported non-fixture source URLs before implementation"]
        : ["same-session fixture research remained credential-free before implementation"]),
      "same-session auto implementation run reused the Planning Handoff run instead of creating a detached worker smoke run",
      "runtime status was available before same-session worker execution",
      "same-session file-diff ExecutionAuthorityRecord was approved for the generated workspace",
      "same-session Codex worker job completed with ImplementationStepLedger evidence",
      "same-session worker plan targeted generated-product files and the ledger recorded generated-product changed-file evidence",
      "same-session implementation stage advanced beyond initial_pr after worker evidence"
    ]
  };
}

function errorEvidence(error: unknown, mode: SmokeMode) {
  const message = error instanceof Error ? error.message : String(error);

  return blockedEvidence({
    mode,
    reason: "Same-session live implementation smoke failed before full evidence could be collected.",
    blockers: [message],
    checked: ["same-session live implementation smoke started"]
  });
}

async function runSingleSessionStage(input: {
  readonly runner?: SingleSessionRunner;
  readonly appDataDir: string;
  readonly localCapabilityToken: string;
  readonly mode: SmokeMode;
}) {
  const singleSessionMode = input.mode === "live_web_worker" ? "live_web" : "fixture";

  return (input.runner ?? ((runnerInput) => runSingleSessionProductLoopSmoke({
    appDataDir: runnerInput.appDataDir,
    cleanupAppDataDir: false,
    localCapabilityToken: runnerInput.localCapabilityToken,
    mode: runnerInput.mode
  })))( {
    appDataDir: input.appDataDir,
    localCapabilityToken: input.localCapabilityToken,
    mode: singleSessionMode
  });
}

export async function runSingleSessionLiveImplementationSmoke(
  options: SingleSessionLiveImplementationSmokeOptions = {}
): Promise<SingleSessionLiveImplementationSmokeEvidence> {
  const mode = options.mode ?? "fixture";
  const env = options.env ?? process.env;
  const gateBlockers = liveGateBlockers(mode, env);

  if (gateBlockers.length > 0) {
    return blockedEvidence({
      mode,
      reason: "Same-session live implementation verification requires explicit live Codex worker opt-in.",
      blockers: gateBlockers,
      checked: ["same-session live implementation gate inspected"]
    });
  }

  const appDataDir = options.appDataDir ?? (await mkdtemp(join(tmpdir(), "solo-superman-single-session-live-implementation-")));
  const shouldCleanup = options.cleanupAppDataDir ?? !options.appDataDir;
  const localCapabilityToken = options.localCapabilityToken ?? `single-session-live-implementation-${randomUUID()}`;
  let scenario: WorkerScenario | null = null;

  try {
    const singleSession = await runSingleSessionStage({
      appDataDir,
      localCapabilityToken,
      mode,
      ...(options.runSingleSession ? { runner: options.runSingleSession } : {})
    });
    const singleSessionBlockers = missingSingleSessionEvidence(singleSession);

    if (singleSessionBlockers.length > 0 || !singleSession.loop || !singleSession.project) {
      return blockedEvidence({
        mode,
        reason: "Same-session implementation worker proof cannot start because product-loop evidence is incomplete.",
        blockers: [...singleSessionBlockers, ...(singleSession.blockers ?? [])],
        checked: ["single-session product loop evidence inspected before worker execution"],
        singleSession
      });
    }

    scenario = await createWorkerScenario({
      appDataDir,
      localCapabilityToken,
      env,
      mode,
      ...(options.runtimeAdapter ? { runtimeAdapter: options.runtimeAdapter } : {})
    });
    const runtimeStatus = await scenario.codexRuntimeAdapter.getStatus();
    const runtimeBlockers = runtimeStatusBlockers(mode, runtimeStatus);

    if (runtimeBlockers.length > 0) {
      return blockedEvidence({
        mode,
        reason: "Runtime status is not ready for same-session implementation worker execution.",
        blockers: runtimeBlockers,
        checked: ["single-session product loop passed", "runtime status inspected before worker execution"],
        singleSession,
        runtime: runtimeStatus
      });
    }

    const worker = await executeWorkerForSingleSessionRun({
      scenario,
      localCapabilityToken,
      sessionId: singleSession.project.sessionId,
      runId: singleSession.loop.autoImplementationRunId,
      planningArtifactId: singleSession.loop.planningArtifactId
    });
    const workerBlockers = workerResultBlockers(worker);

    if (workerBlockers.length > 0) {
      return blockedEvidence({
        mode,
        reason: "Same-session implementation worker did not complete with ledger evidence and stage advancement.",
        blockers: workerBlockers,
        checked: [
          "single-session product loop passed",
          "runtime status available before worker execution",
          "same-session worker job planned and run",
          "same-session ImplementationStepLedger inspected"
        ],
        singleSession,
        runtime: runtimeStatus,
        worker
      });
    }

    return passedEvidence({ mode, singleSession, runtime: runtimeStatus, worker });
  } catch (error: unknown) {
    return errorEvidence(error, mode);
  } finally {
    await scenario?.storage.close();

    if (shouldCleanup) {
      await removeTemporaryDirectory(appDataDir);
    }
  }
}

function exitCodeForEvidence(evidence: SingleSessionLiveImplementationSmokeEvidence) {
  return evidence.status === "passed" ? 0 : 1;
}

async function main() {
  const argv = process.argv.slice(2);
  const evidence = await runSingleSessionLiveImplementationSmoke({
    mode: singleSessionLiveImplementationModeFromArgv(argv),
    env: singleSessionLiveImplementationEnvFromArgv(argv)
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
