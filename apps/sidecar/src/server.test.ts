import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  API_ROUTE_CATALOG,
  CANONICAL_INITIAL_SPEC_SECTIONS,
  autoImplementationFinalPrBodyEvidenceRefs,
  CONTRACT_SCHEMA_VERSION,
  CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS,
  IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
  IMPLEMENTATION_STEP_LEDGER_SCHEMA_VERSION,
  PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION,
  type AutoImplementationRemoteStatus,
  type AutoImplementationRunProjection,
  type CommandId,
  type BrowserActionPreviewDto,
  type CorrelationId,
  type DecisionEvidencePackId,
  type EventId,
  type EvidenceItemId,
  type ImplementationStepLedgerProjection,
  type ImplementationStepDoc,
  type Phase15bUpgradeHints,
  type PlanningHandoffSourceRefDto,
  type ProjectId,
  type ProjectionVersion,
  type QueueItemId,
  type RecordImplementationStepLedgerPayload,
  type ResearchAllowlistId,
  type ResearchConnectorId,
  type ResearchDisclosureLogId,
  type ResearchResultId,
  type ResearchRunProjection,
  type ResearchRunId,
  type ResearchTaskId,
  type RuntimeArtifactId,
  type SessionId,
  type TrackerDoc
} from "@solo-superman/contracts";
import {
  applyMigrations,
  createEventRepository,
  createPhase15bUpgradeHintRepository,
  createProjectionRepository,
  createResearchRunRepository,
  createSoloStorage,
  localDatabaseUrlFromAppDataDir
} from "@solo-superman/db";
import { createProductEngineCommandService } from "./product-engine/command-service";
import type {
  AutoImplementationGitHubIssueMutationAdapter,
  AutoImplementationPullRequestMutationAdapter,
  AutoImplementationRemoteStatusProvider
} from "./product-engine/auto-implementation-workspace";
import { hashBrowserActionPreview } from "./product-engine/browser-action-adapter";
import { hashFileDiffPreview } from "./product-engine/file-diff-adapter";
import { hashShellCommandPreview } from "./product-engine/shell-command-adapter";
import {
  CodexRuntimeUnavailableError,
  createCodexRuntimeAdapter,
  fixtureCodexPreviewOutput,
  fixtureCodexWorkerExecutionOutput
} from "./runtime";
import type { CodexRuntimeAdapter } from "./runtime";
import { createSidecarApp } from "./server";
import {
  generatedFounderQuestionSet,
  generatedPetLifecycleQuestionSet
} from "./generated-ambiguity-question-fixtures";
import { removeTemporaryDirectory } from "./test-cleanup";

const localCapabilityToken = "test-local-capability-token";
const tempDirs: string[] = [];
const productApiRouteCount = API_ROUTE_CATALOG.filter((route) => route.path.startsWith("/api/v1")).length;
const unmountedProductApiRouteCount = productApiRouteCount - CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS.length;
const migratedStatus = {
  state: "migrated",
  databaseUrl: ":memory:",
  migrationsFolder: "packages/db/drizzle",
  appliedMigrationCount: 1,
  latestMigrationMillis: 1_700_000_000_000,
  checkedAt: "2026-05-05T00:00:00.000Z"
} as const;
const app = createSidecarApp({ localCapabilityToken, migrationStatus: migratedStatus });
const fixtureCodexRuntimeAdapter = createCodexRuntimeAdapter({
  fixtureMode: true,
  now: () => "2026-05-05T00:00:00.000Z",
  env: {}
});
const storageByTestApp = new WeakMap<object, Awaited<ReturnType<typeof createSoloStorage>>>();

async function makeTempAppDataDir() {
  const tempDir = await mkdtemp(join(tmpdir(), "solo-superman-sidecar-test-"));

  tempDirs.push(tempDir);

  return tempDir;
}

async function createMigratedStorageApp(
  codexRuntimeAdapter = fixtureCodexRuntimeAdapter,
  options: {
    readonly autoImplementationWorkspaceRoot?: string;
    readonly autoImplementationRemoteStatusProvider?: AutoImplementationRemoteStatusProvider;
    readonly autoImplementationGitHubIssueMutationAdapter?: AutoImplementationGitHubIssueMutationAdapter;
    readonly autoImplementationPullRequestMutationAdapter?: AutoImplementationPullRequestMutationAdapter;
  } = {}
) {
  const appDataDir = await makeTempAppDataDir();
  const storage = await createSoloStorage({ url: localDatabaseUrlFromAppDataDir(appDataDir) });
  const migrationStatus = await applyMigrations(storage);

  if (migrationStatus.state === "failed") {
    await storage.close();
    throw new Error(migrationStatus.errorMessage);
  }

  const appOptions = {
    localCapabilityToken,
    migrationStatus,
    storage,
    codexRuntimeAdapter,
    ...(options.autoImplementationWorkspaceRoot
      ? { autoImplementationWorkspaceRoot: options.autoImplementationWorkspaceRoot }
      : {}),
    ...(options.autoImplementationRemoteStatusProvider
      ? { autoImplementationRemoteStatusProvider: options.autoImplementationRemoteStatusProvider }
      : {}),
    ...(options.autoImplementationGitHubIssueMutationAdapter
      ? { autoImplementationGitHubIssueMutationAdapter: options.autoImplementationGitHubIssueMutationAdapter }
      : {}),
    ...(options.autoImplementationPullRequestMutationAdapter
      ? { autoImplementationPullRequestMutationAdapter: options.autoImplementationPullRequestMutationAdapter }
      : {})
  };

  const migratedApp = createSidecarApp(appOptions);

  storageByTestApp.set(migratedApp, storage);

  return {
    storage,
    app: migratedApp
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(removeTemporaryDirectory));
});

function authHeaders(token = localCapabilityToken) {
  return {
    Authorization: `Bearer ${token}`
  };
}

interface JsonResponseBody {
  readonly error?: {
    readonly code: string;
    readonly message?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };
  readonly [key: string]: unknown;
}

async function jsonBody(response: Response) {
  return (await response.json()) as JsonResponseBody;
}

async function withPatchedProcessEnv<T>(
  values: Readonly<Record<string, string | undefined>>,
  callback: () => Promise<T>
) {
  const previous = new Map(Object.keys(values).map((key) => [key, process.env[key]]));

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

interface RequestTestApp {
  request(path: string, init?: RequestInit): Response | Promise<Response>;
}

async function postAutoImplementationRunForTest(
  storageApp: RequestTestApp,
  sessionId: string,
  payload: Readonly<Record<string, unknown>>,
  options: { readonly seedPlanningReady?: boolean } = {}
) {
  // Auto implementation is a post-planning capability; tests using this helper
  // seed a real planning-ready handoff unless they explicitly opt out.
  const sourcePlanningRef = payload.sourcePlanningRef ??
    (options.seedPlanningReady === false
      ? undefined
      : await ensurePlanningReadyForAutoImplementationTest(storageApp, sessionId));

  return Promise.resolve(storageApp.request(`/api/v1/sessions/${sessionId}/auto-implementation-runs`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sessionId,
      ...(sourcePlanningRef ? { sourcePlanningRef } : {}),
      ...payload
    })
  }));
}

async function postAutoImplementationPullRequestMutationForTest(
  storageApp: RequestTestApp,
  sessionId: string,
  runId: string,
  payload: Readonly<Record<string, unknown>>
) {
  return Promise.resolve(storageApp.request(
    `/api/v1/sessions/${sessionId}/auto-implementation-runs/${runId}/pr-mutations`,
    {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sessionId,
        runId,
        ...payload
      })
    }
  ));
}

async function postAutoImplementationStageForTest(
  storageApp: RequestTestApp,
  sessionId: string,
  runId: string,
  stage: string,
  payload: Readonly<Record<string, unknown>>
) {
  return Promise.resolve(storageApp.request(
    `/api/v1/sessions/${sessionId}/auto-implementation-runs/${runId}/stages/${stage}`,
    {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sessionId,
        runId,
        stage,
        ...payload
      })
    }
  ));
}

async function postAutoImplementationWorkerJobForTest(
  storageApp: RequestTestApp,
  sessionId: string,
  runId: string,
  payload: Readonly<Record<string, unknown>>
) {
  return Promise.resolve(storageApp.request(
    `/api/v1/sessions/${sessionId}/auto-implementation-runs/${runId}/worker-jobs`,
    {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sessionId,
        runId,
        ...payload
      })
    }
  ));
}

async function postAutoImplementationWorkerJobCompletionForTest(
  storageApp: RequestTestApp,
  sessionId: string,
  runId: string,
  jobId: string,
  payload: Readonly<Record<string, unknown>>
) {
  return Promise.resolve(storageApp.request(
    `/api/v1/sessions/${sessionId}/auto-implementation-runs/${runId}/worker-jobs/${encodeURIComponent(jobId)}/complete`,
    {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sessionId,
        runId,
        jobId,
        ...payload
      })
    }
  ));
}

async function postAutoImplementationWorkerLedgerImportForTest(
  storageApp: RequestTestApp,
  sessionId: string,
  runId: string,
  jobId: string,
  payload: Readonly<Record<string, unknown>>
) {
  return Promise.resolve(storageApp.request(
    `/api/v1/sessions/${sessionId}/auto-implementation-runs/${runId}/worker-jobs/${encodeURIComponent(jobId)}/ledger-import`,
    {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sessionId,
        runId,
        jobId,
        ...payload
      })
    }
  ));
}

async function postAutoImplementationWorkerRunForTest(
  storageApp: RequestTestApp,
  sessionId: string,
  runId: string,
  jobId: string,
  payload: Readonly<Record<string, unknown>>
) {
  return Promise.resolve(storageApp.request(
    `/api/v1/sessions/${sessionId}/auto-implementation-runs/${runId}/worker-jobs/${encodeURIComponent(jobId)}/run`,
    {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sessionId,
        runId,
        jobId,
        ...payload
      })
    }
  ));
}

async function postAutoImplementationWorkerStageAdvanceForTest(
  storageApp: RequestTestApp,
  sessionId: string,
  runId: string,
  jobId: string,
  payload: Readonly<Record<string, unknown>>
) {
  return Promise.resolve(storageApp.request(
    `/api/v1/sessions/${sessionId}/auto-implementation-runs/${runId}/worker-jobs/${encodeURIComponent(jobId)}/advance-stage`,
    {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sessionId,
        runId,
        jobId,
        ...payload
      })
    }
  ));
}

function implementationStepLedgerImportTransitionsForTest(input: {
  readonly trackerDoc?: TrackerDoc;
  readonly stepDoc?: ImplementationStepDoc;
  readonly changedFiles?: readonly string[];
} = {}) {
  const step = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!;
  const trackerDoc = input.trackerDoc ?? IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.trackerDoc;
  const stepDoc = input.stepDoc ?? step.stepDoc;
  const stepId = stepDoc.stepId;
  const stepCommitRecord = {
    ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.stepCommitRecords[0]!,
    stepId,
    ...(input.changedFiles ? { changedFiles: input.changedFiles } : {})
  };
  const testEvidenceRecord = {
    ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.testEvidenceRecords[0]!,
    stepId
  };
  const missingTestAuditRecord = {
    ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.missingTestAuditRecords[0]!,
    stepId
  };
  const baseTransition = {
    trackerDoc,
    stepDoc
  };

  return [
    { ...baseTransition, targetStatus: "ready" },
    { ...baseTransition, targetStatus: "implementing", startedEvidenceRefs: ["worker:started"] },
    { ...baseTransition, targetStatus: "committed", stepCommitRecord },
    { ...baseTransition, targetStatus: "review_required", stepCommitRecord },
    ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.codeReviewRecords.map((codeReviewRecord) => ({
      ...baseTransition,
      targetStatus: "review_required",
      stepCommitRecord,
      codeReviewRecord: {
        ...codeReviewRecord,
        stepId
      }
    })),
    ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.cleanCodeReviewRecords.map((cleanCodeReviewRecord) => ({
      ...baseTransition,
      targetStatus: "clean_code_review_required",
      stepCommitRecord,
      cleanCodeReviewRecord: {
        ...cleanCodeReviewRecord,
        stepId
      }
    })),
    { ...baseTransition, targetStatus: "tests_required", stepCommitRecord },
    {
      ...baseTransition,
      targetStatus: "completed",
      stepCommitRecord,
      missingTestAuditRecord,
      testEvidenceRecord,
      evidenceRefs: ["worker-ledger-import:completed"]
    }
  ];
}

function workerPlanLedgerDocsForTest(job: Readonly<Record<string, unknown>>) {
  const executionPlan = job.executionPlan as Readonly<Record<string, unknown>>;
  const allowedWriteScope = Array.isArray(executionPlan.allowedWriteScope)
    ? executionPlan.allowedWriteScope.filter((value): value is string => typeof value === "string")
    : [];
  const generatedProductChangedFiles = allowedWriteScope.filter((value) => value.startsWith("generated-product/"));

  return {
    trackerDoc: executionPlan.ledgerTrackerDoc as TrackerDoc,
    stepDoc: executionPlan.ledgerStepDoc as ImplementationStepDoc,
    ...(generatedProductChangedFiles.length ? { changedFiles: generatedProductChangedFiles } : {})
  };
}

function implementationStepLedgerProjectionForWorkerPlanForTest(input: {
  readonly job: Readonly<Record<string, unknown>>;
  readonly sessionId: string;
  readonly refetchUrl: string;
}): ImplementationStepLedgerProjection {
  const planDocs = workerPlanLedgerDocsForTest(input.job);
  const { stepDoc, trackerDoc } = planDocs;
  const step = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!;
  const stepId = stepDoc.stepId;
  const stepCommitRecord = {
    ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.stepCommitRecords[0]!,
    stepId,
    ...(planDocs.changedFiles ? { changedFiles: planDocs.changedFiles } : {})
  };
  const codeReviewRecords = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.codeReviewRecords.map((record) => ({
    ...record,
    stepId
  }));
  const cleanCodeReviewRecords = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.cleanCodeReviewRecords.map((record) => ({
    ...record,
    stepId
  }));
  const missingTestAuditRecord = {
    ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.missingTestAuditRecords[0]!,
    stepId
  };
  const testEvidenceRecord = {
    ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.testEvidenceRecords[0]!,
    stepId
  };

  return {
    ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
    sessionId: input.sessionId as SessionId,
    trackerDoc,
    steps: [
      {
        ...step,
        stepDoc,
        stepCommitRecord,
        codeReviewRecord: codeReviewRecords.at(-1)!,
        cleanCodeReviewRecord: cleanCodeReviewRecords.at(-1)!,
        missingTestAuditRecord,
        testEvidenceRecord
      }
    ],
    stepCommitRecords: [stepCommitRecord],
    codeReviewRecords,
    cleanCodeReviewRecords,
    missingTestAuditRecords: [missingTestAuditRecord],
    testEvidenceRecords: [testEvidenceRecord],
    refetchUrl: input.refetchUrl,
    schemaVersion: IMPLEMENTATION_STEP_LEDGER_SCHEMA_VERSION
  };
}

async function createRunnableAutoImplementationWorkerJobForTest(input: {
  readonly storageApp: ReturnType<typeof createSidecarApp>;
  readonly workspaceRoot: string;
  readonly idea: string;
  readonly runIdempotencyKey: string;
  readonly projectName: string;
  readonly projectFolderName: string;
  readonly authorityIdSuffix: string;
  readonly workerJobIdempotencyKey: string;
}) {
  const { sessionId } = await createProjectForTest(input.storageApp, input.idea);
  const created = await postAutoImplementationRunForTest(input.storageApp, sessionId, {
    idempotencyKey: input.runIdempotencyKey,
    projectName: input.projectName
  });
  const runId = String(latestAutoImplementationRunFromBody(await jsonBody(created)).runId);
  const { recordId: authorityRecordId } = await createExecutionAuthorityForTest(
    input.storageApp,
    sessionId,
    input.authorityIdSuffix,
    {
      requestedScope: {
        workspaceRef: join(input.workspaceRoot, input.projectFolderName),
        filePathGlobs: ["**/*"]
      }
    }
  );
  const plannedJobResponse = await postAutoImplementationWorkerJobForTest(input.storageApp, sessionId, runId, {
    idempotencyKey: input.workerJobIdempotencyKey,
    executionAuthorityRef: authorityRecordId
  });
  const plannedJobs = latestAutoImplementationRunFromBody(await jsonBody(plannedJobResponse)).workerJobs as
    readonly Readonly<Record<string, unknown>>[];

  return {
    sessionId,
    runId,
    plannedJobId: String(plannedJobs.at(-1)!.jobId)
  };
}

function jsonDataRecord(body: JsonResponseBody) {
  return body.data as Readonly<Record<string, unknown>>;
}

function latestAutoImplementationRunFromBody(body: JsonResponseBody) {
  return jsonDataRecord(body).latestRun as Readonly<Record<string, unknown>>;
}

function timestampAfterProviderStart(run: ResearchRunProjection) {
  const startMillis = Date.parse(run.provider.startedAt ?? run.createdAt);

  return new Date(startMillis + 60_000).toISOString();
}

function phase15bHintsFixture(overrides: Partial<Phase15bUpgradeHints> = {}): Phase15bUpgradeHints {
  const createdAt = "2026-05-06T00:00:00.000Z";

  return {
    executionIntent: {
      candidateActionType: "shell_command",
      targetSurface: "local verification command",
      nonExecutingSummary: "Prepare metadata for a future verification command without running it."
    },
    approvalRequirements: [
      {
        approvalType: "task_level_execution",
        reason: "A future phase must ask before shell execution.",
        scope: "pnpm verify in an isolated worktree",
        requiredActor: "user",
        reconfirmRule: "Reconfirm immediately before execution."
      }
    ],
    sandboxRequirements: {
      isolatedWorktreeRequired: true,
      browserSandboxRequired: false,
      networkMode: "offline",
      commandAllowlist: ["pnpm verify"],
      secretGrantBoundary: "No secret values are needed or exported.",
      environmentPolicy: "Use local-only repository state.",
      logCaptureRequired: true
    },
    rollbackReference: {
      baseRef: "main",
      diffRef: "runtime_artifact_hint_export",
      rollbackNote: "Drop the preview metadata if the future execution is not approved.",
      reversible: true,
      cleanupExpectation: "Remove temporary worktree and captured logs after review."
    },
    expectedEvidence: {
      tests: ["pnpm verify"],
      smokeChecks: ["GET /phase15b-upgrade-hints/export"],
      artifactPaths: ["packages/contracts/src/api/phase15b-hint-export.ts"],
      manualInspection: ["Confirm labels say readiness metadata."],
      expectedLogs: ["phase15b readiness metadata exported"]
    },
    riskNormalization: {
      riskLevel: "medium",
      blockedActionType: "shell_command",
      blockReason: "Shell commands remain blocked in Phase 1.5B.",
      userVisibleAction: "Review command metadata and approve in a later safe-execution phase.",
      escalationTarget: "phase3_safe_execution"
    },
    sourceRefs: [
      {
        kind: "preview_artifact",
        refId: "runtime_artifact_hint_export",
        label: "Private customer Alpha raw idea payload"
      },
      {
        kind: "blocked_action",
        refId: "runtime_artifact_hint_export:shell_command",
        label: "Shell command blocked"
      },
      {
        kind: "research_run",
        refId: "research_run_hint_export",
        label: "Read-only research run"
      },
      {
        kind: "evidence_matrix",
        refId: "evidence_matrix_hint_export",
        label: "Evidence Matrix source"
      },
      {
        kind: "research_allowlist",
        refId: "research_allowlist_hint_export",
        label: "Public web allowlist"
      },
      {
        kind: "research_disclosure_log",
        refId: "research_disclosure_hint_export",
        label: "Public-safe disclosure log"
      },
      {
        kind: "audit_log",
        refId: "audit_log_hint_export",
        label: "Audit trail"
      }
    ],
    createdAt,
    schemaVersion: PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION,
    ...overrides
  };
}

function phase15aRecoveryRunFixture(
  projectId: string,
  allowlistId: string,
  researchRunId: string,
  status: "queued" | "running"
): ResearchRunProjection {
  const researchTaskId = `${researchRunId}_task` as ResearchTaskId;
  const startedAt = "2026-05-06T00:00:30.000Z";

  return {
    kind: "ResearchRunProjection",
    version: 1 as ProjectionVersion,
    researchRunId: researchRunId as ResearchRunId,
    projectId: projectId as ProjectId,
    researchTaskId,
    allowlistId: allowlistId as ResearchAllowlistId,
    disclosureLogId: `${researchRunId}_disclosure` as ResearchDisclosureLogId,
    connectorId: "public_search" as ResearchConnectorId,
    sourceCategory: "public_web",
    status,
    provider: {
      researchRunId: researchRunId as ResearchRunId,
      researchTaskId,
      adapterKind: "local_fake_readonly",
      adapterVersion: "solo-superman.fake-readonly-research-adapter.v1",
      ...(status === "running" ? { providerRunId: `fake_readonly_${researchRunId}`, startedAt } : {}),
      sourceCategory: "public_web",
      idempotencyKey: `research-run:v1:${researchRunId}`,
      attempt: 1
    },
    qualityGateStatus: "not_evaluated",
    sourceRefs: [`${researchRunId}_source`],
    createdAt: "2026-05-06T00:00:00.000Z",
    updatedAt: status === "running" ? startedAt : "2026-05-06T00:00:00.000Z"
  };
}

async function createProjectForTest(storageApp: ReturnType<typeof createSidecarApp>, rawIdea: string) {
  const start = await storageApp.request("/api/v1/projects", {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      rawIdea,
      localPrivacyMode: "local_only",
      projectPurposeMode: "business",
      projectPurposeModeConfirmation: "user_confirmed",
      businessCriticIntensity: "balanced",
      businessCriticIntensityConfirmation: "user_confirmed"
    })
  });
  const startBody = await jsonBody(start);
  const startData = startBody.data as Readonly<Record<string, unknown>>;
  const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;

  return {
    projectId: sessionProjection.projectId as string,
    sessionId: sessionProjection.sessionId as string
  };
}

function executionAuthorityRequestFixture(
  sessionId: string,
  idSuffix: string,
  overrides: Readonly<Record<string, unknown>> = {}
) {
  return {
    sessionId,
    expectedStateVersion: 1,
    idempotencyKey: `exec-auth-route:${idSuffix}`,
    sourcePlanningHandoffRef: `planning_handoff_${idSuffix}`,
    boundedAgentOutput: {
      outputId: `bounded_output_${idSuffix}`,
      sourceRefs: [`planning_handoff_${idSuffix}`],
      intendedDecisionImpact: "Validate the Phase 3 approval/API boundary before adapter execution.",
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
      workspaceRef: "workspace:solo-superman",
      filePathGlobs: ["packages/**", "apps/**"]
    },
    approvalDecision: "approved",
    approver: {
      actorId: "user_route_approver",
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
    evidenceRefs: [`route_evidence_${idSuffix}`],
    auditRefs: [`audit_${idSuffix}`],
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

async function createExecutionAuthorityForTest(
  storageApp: ReturnType<typeof createSidecarApp>,
  sessionId: string,
  idSuffix: string,
  overrides: Readonly<Record<string, unknown>> = {}
) {
  const storage = storageByTestApp.get(storageApp);
  const defaultExpectedStateVersion = storage
    ? (await createEventRepository(storage.db).listForSession(sessionId as SessionId)).length
    : 1;
  const response = await storageApp.request(`/api/v1/sessions/${sessionId}/execution-authority`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(executionAuthorityRequestFixture(sessionId, idSuffix, {
      expectedStateVersion: defaultExpectedStateVersion,
      ...overrides
    }))
  });
  const body = await jsonBody(response);
  const data = body.data as Readonly<Record<string, unknown>>;
  const projection = data.immediateProjection as Readonly<Record<string, unknown>>;
  const latestRecord = projection.latestRecord as Readonly<Record<string, unknown>>;

  return {
    response,
    body,
    projection,
    recordId: latestRecord.recordId as string
  };
}

function chatGptDelegationRouteRequestFixture(input: {
  readonly sessionId: string;
  readonly expectedStateVersion: number;
  readonly idempotencyKey: string;
  readonly researchTaskId: string;
  readonly browserActionAuthorityRef: string;
}) {
  return {
    sessionId: input.sessionId,
    expectedStateVersion: input.expectedStateVersion,
    idempotencyKey: input.idempotencyKey,
    researchTaskId: input.researchTaskId,
    promptPreviewRef: "prompt_preview_route_ready",
    dataDisclosurePreview: {
      disclosurePreviewRef: "disclosure_preview_route_ready",
      promptContextSummaryRef: "context_summary_route_ready",
      redactedPromptPreviewRef: "redacted_prompt_route_ready",
      excludedSensitiveFieldKinds: ["credential", "session", "secret", "2fa", "payment", "legal_sensitive"],
      redactionPreviewShown: true,
      userCanEditPromptBeforeRun: true
    },
    redactionSummary: {
      redactionPreviewRef: "redaction_preview_route_ready",
      redactedFieldKinds: ["credential", "session", "secret", "2fa", "payment", "legal_sensitive"],
      retainedArtifactKinds: ["prompt", "imported_result", "screenshot", "log"],
      defaultRetention: "prompt_result_screenshot_log",
      forbiddenRetentionPolicy: "no_credential_session_secret_2fa_payment_or_legal_sensitive_fields",
      userExportDeleteControls: true,
      deletionLeavesAuditMetadataOnly: true
    },
    policyRiskVerdict: {
      verdict: "pass",
      rationale: "Per-run local research assist only; no account sharing, resale, backend, or unattended queue.",
      evidenceRefs: ["policy:route:pass"]
    },
    sessionOwnershipVerdict: {
      verdict: "pass",
      rationale: "User confirms they logged into the local browser directly.",
      evidenceRefs: ["session:route:owner-confirmed"]
    },
    approvalDecision: "approved",
    browserActionAuthorityRef: input.browserActionAuthorityRef,
    screenshotRefs: ["browser_action:screenshot:route-chatgpt-ready"],
    logRefs: ["browser_action:log:route-chatgpt-ready"],
    auditRefs: ["audit:chatgpt-browser-delegation:route-ready"]
  };
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

function fileDiffCreateFixture(path: string, contentLine: string) {
  return [
    `diff --git a/${path} b/${path}`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ b/${path}`,
    "@@ -0,0 +1 @@",
    `+${contentLine}`,
    ""
  ].join("\n");
}

async function createLocalBrowserTargetServer() {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><title>Solo local preview</title><h1>Local browser target</h1>");
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
    targetUrl: `http://127.0.0.1:${address.port}/preview`,
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

function planningHandoffSourceRefsFixture(idSuffix: string): readonly PlanningHandoffSourceRefDto[] {
  return [
    {
      sourceType: "spec_version",
      sourceId: `spec_version_${idSuffix}`,
      required: true,
      stale: false
    },
    {
      sourceType: "founder_brief",
      sourceId: `founder_brief_${idSuffix}`,
      required: true,
      stale: false
    },
    {
      sourceType: "decision_linked_evidence_pack",
      sourceId: `evidence_pack_${idSuffix}`,
      required: true,
      stale: false
    },
    {
      sourceType: "research_updated_queue_item",
      sourceId: `queue_${idSuffix}`,
      required: true,
      stale: false
    }
  ];
}

async function createAllowlistForTest(
  storageApp: ReturnType<typeof createSidecarApp>,
  projectId: string,
  allowlistId: string,
  overrides: Readonly<Record<string, unknown>> = {}
) {
  const response = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      allowlistId,
      connectorIds: ["public_search"],
      sourceCategories: ["public_web"],
      approvedBy: "owner_research_run_route",
      ...overrides
    })
  });
  const body = await jsonBody(response);

  expect(response.status).toBe(200);
  expect(body.data).toBeTruthy();

  return { body, response };
}

async function planResearchTaskForTest(
  storageApp: RequestTestApp,
  input: {
    readonly sessionId: string;
    readonly expectedStateVersion: number;
    readonly objective: string;
    readonly sourceQueueItemId: string;
  }
) {
  const response = await storageApp.request(`/api/v1/sessions/${input.sessionId}/research-tasks`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      expectedStateVersion: input.expectedStateVersion,
      objective: input.objective,
      sourceQueueItemId: input.sourceQueueItemId,
      routeOutcome: "research_needed",
      impact: "high"
    })
  });
  const body = await jsonBody(response);
  const data = body.data as Readonly<Record<string, unknown>>;
  const projection = data.immediateProjection as Readonly<Record<string, unknown>>;
  const taskIds = projection.taskIds as readonly ResearchTaskId[];

  expect(response.status).toBe(200);

  return taskIds.at(-1) as ResearchTaskId;
}

function webResearchRunRequestPayload(
  researchRunId: string,
  allowlistId: string,
  overrides: Readonly<Record<string, unknown>> = {}
) {
  const suffix = researchRunId.replace(/^research_run_/, "");

  return {
    researchRunId,
    researchTaskId: `research_task_${suffix}`,
    allowlistId,
    connectorId: "public_search",
    sourceCategory: "public_web",
    adapterKind: "web_search_readonly",
    researchObjective: "Find public onboarding proof through a browser search.",
    productCategory: "Founder workflow assistant",
    customerProblemHypothesis: "Early founders need safer validation research.",
    contextHash: `ctx_${researchRunId}`,
    sourceRefs: [`queue_item_${suffix}`],
    ...overrides
  };
}

async function startWebResearchRunForTest(
  storageApp: RequestTestApp,
  projectId: string,
  allowlistId: string,
  researchRunId: string,
  overrides: Readonly<Record<string, unknown>> = {}
) {
  return storageApp.request(`/api/v1/projects/${projectId}/research-runs`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(webResearchRunRequestPayload(researchRunId, allowlistId, overrides))
  });
}

const planningReadySpecVersionRef = "spec_version_api_ready";
const planningReadyQueueItemId = "queue_api_ready" as QueueItemId;
const planningReadyResearchTaskId = "research_task_api_ready" as ResearchTaskId;
const planningReadyResearchResultId = "research_result_api_ready" as ResearchResultId;
const planningReadyEvidencePackId = "evidence_pack_api_ready" as DecisionEvidencePackId;
const planningReadyEvidenceItemId = "evidence_item_api_ready" as EvidenceItemId;
const planningReadyProjectionVersion = 3 as ProjectionVersion;

function planningReadySourceRefs(sessionId: string): readonly PlanningHandoffSourceRefDto[] {
  return [
    {
      sourceType: "spec_version",
      sourceId: planningReadySpecVersionRef,
      sourceLabel: "API ready SpecVersion",
      required: true,
      stale: false
    },
    {
      sourceType: "completion_candidate",
      sourceId: `completion_candidate:${sessionId}:3`,
      sourceLabel: "API ready completion candidate",
      required: true,
      stale: false
    },
    {
      sourceType: "decision_linked_evidence_pack",
      sourceId: planningReadyEvidencePackId,
      sourceLabel: "API ready Evidence Pack",
      required: true,
      stale: false
    },
    {
      sourceType: "research_updated_queue_item",
      sourceId: planningReadyQueueItemId,
      sourceLabel: "API ready research queue card",
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
    eventId: `evt_planning_ready_spec_${sessionId}` as EventId,
    eventType: "SpecVersionCreated",
    projectId: projectId as ProjectId,
    sessionId: sessionId as SessionId,
    sourceCommandId: `cmd_seed_spec_version_${sessionId}` as CommandId,
    correlationId: `corr_seed_planning_ready_${sessionId}` as CorrelationId,
    causationId: null,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    occurredAt: "2026-05-06T00:01:00.000Z",
    payload: {
      versionRef: planningReadySpecVersionRef,
      title: "Planning Handoff API ready spec",
      sections: ["Problem", "Customer", "Value", "Validation"]
    }
  });

  await eventRepository.append({
    eventId: `evt_planning_ready_evidence_${sessionId}` as EventId,
    eventType: "EvidenceSynthesized",
    projectId: projectId as ProjectId,
    sessionId: sessionId as SessionId,
    sourceCommandId: `cmd_seed_evidence_${sessionId}` as CommandId,
    correlationId: `corr_seed_planning_ready_${sessionId}` as CorrelationId,
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
            objective: "Validate Planning Handoff API route evidence.",
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
            resultSummary: "Accepted evidence supports the API handoff route.",
            sourceReliability: "high",
            claim: "The Planning Handoff route can return a final handoff.",
            decisionContext: "Planning Handoff API route",
            importedAt: "2026-05-06T00:01:45.000Z"
          }
        ],
        evidenceMatrices: [
          {
            evidenceMatrixId: "evidence_matrix_api_ready",
            researchTaskId: planningReadyResearchTaskId,
            researchResultId: planningReadyResearchResultId,
            synthesisVersion: 1,
            proEvidence: [
              {
                evidenceItemId: planningReadyEvidenceItemId,
                kind: "pro",
                summary: "Route fixture has accepted evidence."
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
            claim: "The Planning Handoff route can return a final handoff.",
            decisionContext: "Planning Handoff API route",
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
            title: "Planning Handoff API route evidence",
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
            title: "Planning Handoff API route evidence",
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

async function ensurePlanningReadyForAutoImplementationTest(storageApp: RequestTestApp, sessionId: string) {
  const existing = await storageApp.request(`/api/v1/sessions/${sessionId}/planning-handoff`, {
    headers: authHeaders()
  });
  const existingBody = await jsonBody(existing);
  const existingProjection = existingBody.data as Readonly<Record<string, unknown>> | null;

  if (existingProjection?.currentStatus === "planning_ready") {
    return ((existingProjection.finalArtifact as Readonly<Record<string, unknown>>).artifactId as string);
  }

  const storage = storageByTestApp.get(storageApp);

  if (!storage) {
    throw new Error("Planning-ready auto implementation test setup requires a migrated storage app.");
  }

  const eventRepository = createEventRepository(storage.db);
  const eventsBeforeSeed = await eventRepository.listForSession(sessionId as SessionId);
  const projectId = eventsBeforeSeed[0]?.projectId;

  if (!projectId) {
    throw new Error(`Cannot seed planning-ready state for unknown session ${sessionId}.`);
  }

  await seedPlanningReadyState(storage, projectId, sessionId);

  const expectedStateVersion = (await eventRepository.listForSession(sessionId as SessionId)).length;
  const created = await storageApp.request(`/api/v1/sessions/${sessionId}/planning-handoff`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sessionId,
      expectedStateVersion,
      sourceRefs: planningReadySourceRefs(sessionId)
    })
  });
  const createdBody = await jsonBody(created);
  const createdData = createdBody.data as Readonly<Record<string, unknown>>;
  const immediateProjection = createdData.immediateProjection as Readonly<Record<string, unknown>> | undefined;

  if (created.status !== 200 || immediateProjection?.currentStatus !== "planning_ready") {
    throw new Error(`Failed to seed planning-ready handoff for auto implementation test session ${sessionId}.`);
  }

  return ((immediateProjection.finalArtifact as Readonly<Record<string, unknown>>).artifactId as string);
}

describe("PR-02 sidecar health shell", () => {
  it("serves health without auth before storage or ProductEngine initialization", async () => {
    const response = await app.request("/healthz");
    const body = await jsonBody(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      sidecarPhase: "phase_1_queue_sse_refetch_recovery",
      checks: {
        process: "alive"
      },
      productApiRoutePlaceholderCount: unmountedProductApiRouteCount
    });
  });

  it("serves readiness with migrated storage status until later ProductEngine PRs", async () => {
    const response = await app.request("/readyz");
    const body = await jsonBody(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "not_ready",
      ready: false,
      code: "SIDECAR_NOT_READY",
      checks: {
        db: "migrated",
        productEngine: "not_initialized_until_storage_available",
        codex: "runtime_status_endpoint_mounted_pr_07"
      },
      migrations: {
        state: "migrated",
        appliedMigrationCount: 1
      }
    });
  });

  it("reports readiness after migrated storage and ProductEngine command handling are mounted", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const response = await storageApp.request("/readyz");
      const body = await jsonBody(response);

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        status: "ready",
        ready: true,
        checks: {
          db: "migrated",
          productEngine: "initialized_pr_04",
          codex: "runtime_status_endpoint_mounted_pr_07"
        },
        migrations: {
          state: "migrated"
        }
      });
      expect(body.code).toBeUndefined();
    } finally {
      await storage.close();
    }
  });

  it("redacts migration diagnostics from the unauthenticated readiness response", async () => {
    const fileApp = createSidecarApp({
      localCapabilityToken,
      migrationStatus: {
        ...migratedStatus,
        databaseUrl: "file:/Users/founder/Library/Application Support/Solo Superman/dev/solo-superman.db"
      }
    });
    const response = await fileApp.request("/readyz");
    const body = await jsonBody(response);
    const migrations = body.migrations as Readonly<Record<string, unknown>>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      migrations: {
        state: "migrated",
        appliedMigrationCount: 1
      }
    });
    expect(migrations.databaseUrl).toBeUndefined();
    expect(migrations.migrationsFolder).toBeUndefined();
  });

  it("keeps readiness unavailable when migration execution fails", async () => {
    const failedApp = createSidecarApp({
      localCapabilityToken,
      migrationStatus: {
        state: "failed",
        databaseUrl: "libsql://future-remote.example",
        migrationsFolder: "packages/db/drizzle",
        appliedMigrationCount: 0,
        latestMigrationMillis: null,
        checkedAt: "2026-05-05T00:00:00.000Z",
        errorMessage: "synthetic migration failure"
      }
    });
    const response = await failedApp.request("/readyz");
    const body = await jsonBody(response);

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: "not_ready",
      ready: false,
      code: "MIGRATION_FAILED",
      checks: {
        db: "migration_failed"
      },
      migrations: {
        state: "failed",
        errorCode: "MIGRATION_FAILED"
      }
    });
    expect((body.migrations as Readonly<Record<string, unknown>>).errorMessage).toBeUndefined();
  });

  it("rejects non-health API routes without the local capability token", async () => {
    const response = await app.request("/api/v1/projects");
    const body = await jsonBody(response);

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "AUTH_REQUIRED"
      },
      meta: {
        schemaVersion: expect.any(String)
      }
    });
  });

  it("rejects non-health API routes with the wrong local capability token", async () => {
    const response = await app.request("/api/v1/projects", {
      headers: {
        ...authHeaders("wrong-token"),
        "X-Request-Id": "req_wrong_token"
      }
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(401);
    expect(body.error?.code).toBe("AUTH_REQUIRED");
    expect(body.meta).toMatchObject({
      requestId: "req_wrong_token",
      schemaVersion: expect.any(String)
    });
    expect(response.headers.get("x-request-id")).toBe("req_wrong_token");
  });

  it("rejects empty app-local capability token configuration", () => {
    expect(() => createSidecarApp({ localCapabilityToken: "   " })).toThrow("localCapabilityToken must not be empty");
  });

  it("answers CORS preflight for the local web frontend before the auth guard", async () => {
    const response = await app.request("/api/v1/projects", {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:1420",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Authorization, X-Request-Id"
      }
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:1420");
    expect(response.headers.get("access-control-allow-headers")).toContain("Authorization");
    expect(response.headers.get("access-control-allow-headers")).toContain("X-Request-Id");
  });

  it("answers CORS preflight for dynamically allocated local web ports", async () => {
    const response = await app.request("/api/v1/runtime/codex/login/start", {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:58973",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Authorization"
      }
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:58973");
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("answers CORS preflight for localhost and IPv6 loopback frontend origins", async () => {
    for (const origin of ["http://localhost:55222", "http://[::1]:55222"]) {
      const response = await app.request("/api/v1/runtime/status", {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "Authorization"
        }
      });

      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    }
  });

  it("exposes request ids to the local web frontend for correlation", async () => {
    const response = await app.request("/api/v1/commands/cmd_demo/status", {
      headers: {
        ...authHeaders(),
        Origin: "http://127.0.0.1:58973",
        "X-Request-Id": "req_command_status"
      }
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(503);
    expect(body.error?.code).toBe("EFFECT_STATUS_UNAVAILABLE");
    expect(response.headers.get("x-request-id")).toBe("req_command_status");
    expect(response.headers.get("access-control-expose-headers")).toContain("x-request-id");
  });

  it("does not grant CORS to non-local origins", async () => {
    const response = await app.request("/api/v1/projects", {
      method: "OPTIONS",
      headers: {
        Origin: "https://example.com",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Authorization"
      }
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(403);
    expect(body.error?.code).toBe("AUTH_REQUIRED");
    expect(body.error?.details?.policy).toBe("explicit_local_cors_allowlist");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("does not grant CORS to loopback-looking hosted origins", async () => {
    const response = await app.request("/api/v1/projects", {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1.evil.example:1420",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Authorization"
      }
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(403);
    expect(body.error?.code).toBe("AUTH_REQUIRED");
    expect(body.error?.details?.policy).toBe("explicit_local_cors_allowlist");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("does not normalize malformed loopback origin headers into allowed origins", async () => {
    const response = await app.request("/api/v1/projects", {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:58973/unexpected-path",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Authorization"
      }
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(403);
    expect(body.error?.code).toBe("AUTH_REQUIRED");
    expect(body.error?.details?.policy).toBe("explicit_local_cors_allowlist");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rejects hosted origins before they can obtain local execution authority", async () => {
    const response = await app.request("/api/v1/sessions/sess_hosted/execution-authority", {
      method: "POST",
      headers: {
        ...authHeaders(),
        Origin: "https://example.com"
      }
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(403);
    expect(body.error?.code).toBe("AUTH_REQUIRED");
    expect(body.error?.details?.policy).toBe("explicit_local_cors_allowlist");
  });

  it("rejects explicitly non-loopback preflight before CORS handling", async () => {
    const response = await app.request("/api/v1/projects", {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:1420",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Authorization",
        "X-Forwarded-For": "203.0.113.10"
      }
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(403);
    expect(body.error?.details?.policy).toBe("loopback_only");
  });

  it("rejects explicitly non-loopback API requests before route handling", async () => {
    const response = await app.request("/api/v1/projects", {
      headers: {
        ...authHeaders(),
        "X-Forwarded-For": "203.0.113.10"
      }
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "AUTH_REQUIRED",
        details: {
          policy: "loopback_only"
        }
      },
      meta: {
        requestId: expect.any(String),
        schemaVersion: expect.any(String)
      }
    });
  });

  it("mounts the authenticated command-status placeholder without ProductEngine backing", async () => {
    const response = await app.request("/api/v1/commands/cmd_demo/status", {
      headers: authHeaders()
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "EFFECT_STATUS_UNAVAILABLE",
        details: {
          commandId: "cmd_demo",
          statusEndpointShape: {
            commandId: "cmd_demo",
            commandStatus: "pending",
            effects: [],
            projectionHints: []
          }
        }
      },
      meta: {
        requestId: expect.any(String),
        schemaVersion: expect.any(String)
      }
    });
  });

  it("requires session scope for the authenticated SSE event stream", async () => {
    const response = await app.request("/api/v1/events/stream", {
      headers: authHeaders()
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "STREAM_SESSION_REQUIRED",
      details: {
        requiredQueryParams: ["sessionId"]
      }
    });
  });

  it("streams Decision Queue projection notifications as refetch hints rather than canonical state", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { sessionId } = await createProjectForTest(storageApp, "A Decision Queue SSE recovery route test idea");
      const response = await storageApp.request(`/api/v1/events/stream?sessionId=${sessionId}`, {
        headers: authHeaders()
      });
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/event-stream");
      expect(body).toContain("event: projection.updated");
      expect(body).toContain(`"refetchUrl":"/api/v1/sessions/${sessionId}/queue"`);
      expect(body).toContain('"projectionKind":"DecisionQueueProjection"');
      expect(body).not.toContain('"active":');
    } finally {
      await storage.close();
    }
  });

  it("keeps product command routes unavailable until migrated storage is mounted", async () => {
    const response = await app.request("/api/v1/projects", {
      method: "POST",
      headers: authHeaders()
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(503);
    expect(body.error?.code).toBe("SIDECAR_NOT_READY");
  });

  it("keeps mounted product query routes unavailable until migrated storage is mounted", async () => {
    const response = await app.request("/api/v1/sessions/sess_demo/spec/versions", {
      headers: authHeaders()
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(503);
    expect(body.error?.code).toBe("SIDECAR_NOT_READY");
  });

  it("rejects non-object JSON bodies before route field validation", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const response = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify([])
      });
      const body = await jsonBody(response);

      expect(response.status).toBe(400);
      expect(body.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "Request body must be a JSON object."
      });
    } finally {
      await storage.close();
    }
  });

  it("rejects project creation until the user confirms a business or personal purpose mode", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const missingMode = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A mode-required route test idea",
          localPrivacyMode: "local_only"
        })
      });
      const missingConfirmation = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A mode-confirmation route test idea",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business"
        })
      });
      const missingModeBody = await jsonBody(missingMode);
      const missingConfirmationBody = await jsonBody(missingConfirmation);

      expect(missingMode.status).toBe(400);
      expect(missingModeBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "projectPurposeMode must be a non-empty string."
      });
      expect(missingConfirmation.status).toBe(400);
      expect(missingConfirmationBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "projectPurposeModeConfirmation must be user_confirmed."
      });
    } finally {
      await storage.close();
    }
  });

  it("persists the onboarding research automation permission through project creation", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const response = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A durable research automation permission route test idea",
          localPrivacyMode: "local_only",
          projectPurposeMode: "personal",
          projectPurposeModeConfirmation: "user_confirmed",
          initialResearchAutomationPermission: "allow_codex_and_chatgpt_visible"
        })
      });
      const body = await jsonBody(response);
      const data = body.data as Readonly<Record<string, unknown>>;

      expect(response.status).toBe(200);
      expect(data.immediateProjection).toMatchObject({
        kind: "SessionShellProjection",
        initialResearchAutomationPermission: "allow_codex_and_chatgpt_visible"
      });
    } finally {
      await storage.close();
    }
  });

  it("rejects unsupported onboarding research automation permissions at the route boundary", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const response = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A rejected research automation permission route test idea",
          localPrivacyMode: "local_only",
          projectPurposeMode: "personal",
          projectPurposeModeConfirmation: "user_confirmed",
          initialResearchAutomationPermission: "auto_headless_chatgpt"
        })
      });
      const body = await jsonBody(response);

      expect(response.status).toBe(400);
      expect(body.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message:
          "initialResearchAutomationPermission must be manual_only, allow_codex, or allow_codex_and_chatgpt_visible."
      });
    } finally {
      await storage.close();
    }
  });

  it("changes project purpose mode through a user-audited session command route", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { sessionId } = await createProjectForTest(storageApp, "A personal workflow mode route test idea");
      const response = await storageApp.request(`/api/v1/sessions/${sessionId}/project-purpose-mode`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 1,
          projectPurposeMode: "personal",
          suggestedProjectPurposeMode: "personal",
          reason: "User clarified this project is for a private workflow."
        })
      });
      const body = await jsonBody(response);
      const data = body.data as Readonly<Record<string, unknown>>;

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        category: "accepted_with_projection",
        stateVersionBefore: 1,
        stateVersionAfter: 2,
        immediateProjection: {
          kind: "SessionShellProjection",
          projectPurposeMode: "personal",
          projectPurposeModeLabel: "개인 작업 흐름 구현 중심"
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("changes business critic intensity through a user-audited session command route", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { sessionId } = await createProjectForTest(storageApp, "A business critic intensity route test idea");
      const response = await storageApp.request(`/api/v1/sessions/${sessionId}/business-critic-intensity`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 1,
          businessCriticIntensity: "strong",
          businessCriticIntensityConfirmation: "user_confirmed",
          reason: "User wants stronger commercialization pressure."
        })
      });
      const body = await jsonBody(response);
      const data = body.data as Readonly<Record<string, unknown>>;

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        category: "accepted_with_projection",
        stateVersionBefore: 1,
        stateVersionAfter: 2,
        immediateProjection: {
          kind: "SessionShellProjection",
          projectPurposeMode: "business",
          businessCriticIntensity: "strong",
          businessCriticIntensitySelectionStatus: "confirmed",
          businessCriticIntensityLabel: "강한 사업 검증"
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("records ChatGPT browser delegation preflight through the session command route", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { sessionId } = await createProjectForTest(storageApp, "A ChatGPT browser delegation route test idea");
      const research = await storageApp.request(`/api/v1/sessions/${sessionId}/research-tasks`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 1,
          objective: "Compare competitor evidence using a user-owned ChatGPT browser run.",
          sourceQueueItemId: "queue_chatgpt_delegation_route",
          routeOutcome: "research_needed",
          impact: "high"
        })
      });
      const researchBody = await jsonBody(research);
      const researchData = researchBody.data as Readonly<Record<string, unknown>>;
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
      const previewArtifactHash = hashBrowserActionPreview({
        targetUrl: "http://127.0.0.1:4173/mock-chatgpt",
        action: browserAction
      });
      const { recordId: browserActionAuthorityRef } = await createExecutionAuthorityForTest(
        storageApp,
        sessionId,
        "route_chatgpt_browser",
        {
          expectedStateVersion: 2,
          actionClass: "browser_action",
          previewArtifactRef: "preview_route_chatgpt_browser",
          previewArtifactHash,
          reviewedPreviewArtifactHash: previewArtifactHash,
          requestedScope: {
            browserTargetRef: "browser_target:http://127.0.0.1:4173",
            maxDurationMs: 1_000
          },
          sandboxBoundary: {
            mode: "browser_preview_session",
            networkPolicy: "loopback_only",
            secretPolicy: "no_secret_values"
          },
          rollbackReference: {
            kind: "browser_state_reset",
            ref: "rollback_route_chatgpt_browser"
          }
        }
      );
      const delegationRequestBody = chatGptDelegationRouteRequestFixture({
        sessionId,
        expectedStateVersion: 3,
        idempotencyKey: "chatgpt-delegation-route:ready",
        researchTaskId,
        browserActionAuthorityRef
      });
      const invalidStatus = await storageApp.request(`/api/v1/sessions/${sessionId}/chatgpt-browser-delegations`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...delegationRequestBody,
          idempotencyKey: "chatgpt-delegation-route:invalid-status",
          status: "ready_for_browser_action"
        })
      });
      const invalidStatusBody = await jsonBody(invalidStatus);

      expect(invalidStatus.status).toBe(400);
      expect(invalidStatusBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "status must be a valid ChatGPT browser delegation status."
      });

      const invalidApproval = await storageApp.request(`/api/v1/sessions/${sessionId}/chatgpt-browser-delegations`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...delegationRequestBody,
          idempotencyKey: "chatgpt-delegation-route:invalid-approval",
          approvalDecision: "auto_approved"
        })
      });
      const invalidApprovalBody = await jsonBody(invalidApproval);

      expect(invalidApproval.status).toBe(400);
      expect(invalidApprovalBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "approvalDecision must be a valid ChatGPT browser delegation approval decision."
      });

      const response = await storageApp.request(`/api/v1/sessions/${sessionId}/chatgpt-browser-delegations`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(delegationRequestBody)
      });
      const body = await jsonBody(response);
      const data = body.data as Readonly<Record<string, unknown>>;

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        category: "accepted_with_projection",
        stateVersionBefore: 3,
        stateVersionAfter: 4,
        immediateProjection: {
          kind: "ChatGptBrowserDelegationProjection",
          currentStatus: "running",
          latestRun: {
            researchTaskId,
            approvalDecision: "approved",
            browserActionAuthorityRef,
            blockReasons: []
          }
        }
      });

      const query = await storageApp.request(`/api/v1/sessions/${sessionId}/chatgpt-browser-delegations`, {
        headers: authHeaders()
      });
      const queryBody = await jsonBody(query);

      expect(query.status).toBe(200);
      expect(queryBody.data).toMatchObject({
        kind: "ChatGptBrowserDelegationProjection",
        latestRun: {
          researchTaskId
        }
      });

      const runId = (queryBody.data as { readonly latestRun: { readonly runId: string } }).latestRun.runId;
      const revoke = await storageApp.request(`/api/v1/sessions/${sessionId}/chatgpt-browser-delegations/${runId}/revoke`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 4,
          idempotencyKey: "chatgpt-delegation-route:revoke",
          runId,
          reason: "Route test revokes the visible ChatGPT delegation run.",
          auditRefs: ["audit:chatgpt-browser-delegation:route-revoke"]
        })
      });
      const revokeBody = await jsonBody(revoke);

      expect(revoke.status).toBe(200);
      expect(revokeBody.data).toMatchObject({
        category: "accepted_with_projection",
        immediateProjection: {
          kind: "ChatGptBrowserDelegationProjection",
          currentStatus: "revoked",
          latestRun: {
            runId,
            canRevoke: false,
            blockReasons: expect.arrayContaining([expect.objectContaining({ code: "revoked_by_user" })])
          }
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("queues investor-grade pressure through the sidecar without replacing an active batch", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    async function postCommand(path: string, body: Readonly<Record<string, unknown>>) {
      const response = await storageApp.request(path, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      const responseBody = await jsonBody(response);

      return {
        response,
        data: responseBody.data as Readonly<Record<string, unknown>>
      };
    }

    try {
      const { sessionId } = await createProjectForTest(
        storageApp,
        "A post-active founder business critic intensity route test idea"
      );
      await postCommand(`/api/v1/sessions/${sessionId}/intake`, {
        expectedStateVersion: 1,
        answer: "Validate investor-grade pressure after the first batch is already active."
      });
      await postCommand(`/api/v1/sessions/${sessionId}/spec/initial`, {
        expectedStateVersion: 2
      });
      await postCommand(`/api/v1/sessions/${sessionId}/spec/analyze`, {
        expectedStateVersion: 3,
        targetRef: "current_spec",
        generatedQuestionSet: generatedFounderQuestionSet()
      });
      const activate = await postCommand(`/api/v1/sessions/${sessionId}/queue/activate`, {
        expectedStateVersion: 4
      });
      const activeIds = ((activate.data.queueProjection as Readonly<Record<string, unknown>>).active as readonly Readonly<
        Record<string, unknown>
      >[]).map((item) => item.queueItemId);
      const change = await postCommand(`/api/v1/sessions/${sessionId}/business-critic-intensity`, {
        sessionId,
        expectedStateVersion: 5,
        businessCriticIntensity: "investor_grade",
        businessCriticIntensityConfirmation: "user_confirmed",
        reason: "Escalate after preserving the active question batch."
      });
      const queueProjection = change.data.queueProjection as Readonly<Record<string, unknown>>;

      expect(change.response.status).toBe(200);
      expect((queueProjection.active as readonly Readonly<Record<string, unknown>>[]).map((item) => item.queueItemId)).toEqual(
        activeIds
      );
      expect(queueProjection.next).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            businessCriticPressureKind: "investor_pressure_pass"
          })
        ])
      );
    } finally {
      await storage.close();
    }
  });

  it("generates initial ambiguity questions through the Codex prompt template route", async () => {
    const generatedQuestionSet = generatedPetLifecycleQuestionSet();
    let seenPrompt = "";
    const codexRuntimeAdapter = createCodexRuntimeAdapter({
      env: { SOLO_CODEX_APP_SERVER_LIVE_TURNS: "1" },
      accountReader: async () => ({
        status: "authenticated",
        loginCommand: "codex auth login",
        loginStatusCommand: "codex login status",
        accountType: "chatgpt"
      }),
      livePreviewCreator: async (input) => {
        seenPrompt = input.prompt;

        return {
          schemaVersion: CONTRACT_SCHEMA_VERSION,
          turnPurpose: "question_generation",
          artifactKind: "QuestionBatchArtifact",
          applyPolicy: "auto_apply",
          summary: "Generated question JSON ready",
          payload: {
            title: "Generated question JSON ready",
            body: JSON.stringify(generatedQuestionSet),
            targetObject: "generated_ambiguity_question_set",
            sourceRefs: input.sourceRefs
          }
        };
      }
    });
    const { app: storageApp, storage } = await createMigratedStorageApp(codexRuntimeAdapter);

    try {
      const { sessionId } = await createProjectForTest(
        storageApp,
        "A pet lifecycle management app for medical, food, daily, insurance, and funeral records"
      );
      const response = await storageApp.request(`/api/v1/sessions/${sessionId}/questions/generate`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 3,
          rawIdea: "A pet lifecycle management app for medical, food, daily, insurance, and funeral records",
          intakeGoal: "Ask domain-fit questions instead of founder/team-lead defaults.",
          projectPurposeMode: "business",
          businessCriticIntensity: "balanced"
        })
      });
      const body = await jsonBody(response);
      const data = body.data as Readonly<Record<string, unknown>>;

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        status: "generated",
        promptTemplateRef: "prompt-template:generated-ambiguity-questions:v1",
        schemaVersion: "solo-superman-generated-ambiguity-questions.v1",
        source: "codex_runtime_preview",
        generatedQuestionSet
      });
      expect(seenPrompt).toContain("Prompt artifact: generated-ambiguity-questions.v1.md");
      expect(seenPrompt).toContain("Do not use a fixed question template");
      expect(seenPrompt).toContain("Apply an Idea-Fit Gate");
      expect(seenPrompt).toContain("For a pet lifecycle app, ask about guardians");
      expect(seenPrompt).toContain("Business critic intensity: balanced");
      expect(seenPrompt).toContain('businessCriticPressureKind "core_assumption_challenge"');
      expect(seenPrompt).toContain("Business validation mode does not make those personas valid by default");
    } finally {
      await storage.close();
    }
  });

  it("mounts Phase 1.5A allowlist governance create/update/pause/revoke without reducer effects", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A research allowlist governance route test idea",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed",
          businessCriticIntensity: "balanced",
          businessCriticIntensityConfirmation: "user_confirmed"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const projectId = sessionProjection.projectId as string;
      const allowlistId = "research_allowlist_route";
      const create = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          projectId,
          allowlistId,
          connectorIds: ["public_search"],
          sourceCategories: ["public_web"],
          approvedBy: "owner_route_test"
        })
      });
      const createBody = await jsonBody(create);
      const createData = createBody.data as Readonly<Record<string, unknown>>;
      const createProjection = createData.immediateProjection as Readonly<Record<string, unknown>>;
      const policies = createProjection.automaticRunStartPolicies as readonly Readonly<Record<string, unknown>>[];

      expect(create.status).toBe(200);
      expect(createData).toMatchObject({
        category: "accepted_with_projection",
        projectionHints: [
          {
            projectionKind: "ResearchAllowlistProjection",
            refetchUrl: `/api/v1/projects/${projectId}/research-allowlists`
          }
        ],
        deterministicOutputs: [
          expect.objectContaining({
            payload: expect.objectContaining({
              productEngineReducerSideEffects: false
            })
          })
        ]
      });
      expect(createData.statusUrl).toBeUndefined();
      expect(createProjection).toMatchObject({
        kind: "ResearchAllowlistGovernanceProjection",
        projectionKind: "ResearchAllowlistProjection",
        projectId,
        refetchUrl: `/api/v1/projects/${projectId}/research-allowlists`,
        pendingEffectSummary: {
          totalPending: 0
        },
        selectedAllowlist: {
          allowlistId,
          status: "active",
          connectorIds: ["public_search"],
          sourceCategories: ["public_web"]
        }
      });
      expect(policies[0]).toMatchObject({
        allowed: true,
        reason: "active_public_safe_allowlist"
      });

      const list = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists`, {
        headers: authHeaders()
      });
      const listBody = await jsonBody(list);

      expect(list.status).toBe(200);
      expect(listBody.data).toMatchObject({
        allowlists: [
          expect.objectContaining({
            allowlistId,
            status: "active"
          })
        ]
      });

      const pauseReason = "Route test pauses automatic research.";
      const pause = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists/${allowlistId}/pause`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          projectId,
          allowlistId,
          reason: pauseReason
        })
      });
      const pauseBody = await jsonBody(pause);
      const pauseData = pauseBody.data as Readonly<Record<string, unknown>>;
      const pauseProjection = pauseData.immediateProjection as Readonly<Record<string, unknown>>;
      const pauseDeterministicOutputs = pauseData.deterministicOutputs as readonly Readonly<Record<string, unknown>>[];

      expect(pause.status).toBe(200);
      expect(pauseDeterministicOutputs[0]?.payload).toMatchObject({
        commandType: "PauseResearchAllowlist",
        governanceReason: pauseReason,
        productEngineReducerSideEffects: false
      });
      expect(pauseProjection).toMatchObject({
        selectedAllowlist: {
          status: "paused",
          pausedAt: expect.any(String)
        },
        automaticRunStartPolicies: [
          expect.objectContaining({
            allowed: false,
            blockedByStatus: "paused",
            reason: "allowlist_paused"
          })
        ]
      });

      const missingReactivationApproval = await storageApp.request(
        `/api/v1/projects/${projectId}/research-allowlists/${allowlistId}`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            status: "active"
          })
        }
      );
      const missingReactivationApprovalBody = await jsonBody(missingReactivationApproval);

      expect(missingReactivationApproval.status).toBe(400);
      expect(missingReactivationApprovalBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "approvedBy is required when updating allowlist policy or activating automatic research."
      });

      const reactivate = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists/${allowlistId}`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: "active",
          sourceCategories: ["public_web", "official_docs"],
          approvedBy: "owner_route_reactivation"
        })
      });
      const reactivateBody = await jsonBody(reactivate);
      const reactivateData = reactivateBody.data as Readonly<Record<string, unknown>>;
      const reactivateProjection = reactivateData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(reactivate.status).toBe(200);
      expect(reactivateProjection).toMatchObject({
        selectedAllowlist: {
          status: "active",
          sourceCategories: ["public_web", "official_docs"]
        },
        automaticRunStartPolicies: [
          expect.objectContaining({
            allowed: true
          })
        ]
      });

      const revoke = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists/${allowlistId}/revoke`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });
      const revokeBody = await jsonBody(revoke);
      const revokeData = revokeBody.data as Readonly<Record<string, unknown>>;
      const revokeProjection = revokeData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(revoke.status).toBe(200);
      expect(revokeProjection).toMatchObject({
        selectedAllowlist: {
          status: "revoked",
          revokedAt: expect.any(String)
        },
        automaticRunStartPolicies: [
          expect.objectContaining({
            allowed: false,
            blockedByStatus: "revoked",
            reason: "allowlist_revoked"
          })
        ]
      });
    } finally {
      await storage.close();
    }
  });

  it("applies Phase 1.5A pause/revoke recovery to queued and running research runs", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { projectId } = await createProjectForTest(storageApp, "A run recovery allowlist route test idea");
      const allowlistId = "research_allowlist_run_recovery";
      const repository = createResearchRunRepository(storage.db);

      await createAllowlistForTest(storageApp, projectId, allowlistId);
      await repository.create({
        run: phase15aRecoveryRunFixture(projectId, allowlistId, "research_run_pause_queued", "queued"),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });
      await repository.create({
        run: phase15aRecoveryRunFixture(projectId, allowlistId, "research_run_pause_running", "running"),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      const pause = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists/${allowlistId}/pause`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          reason: "Pause should preserve queued run recovery."
        })
      });
      const pauseBody = await jsonBody(pause);

      expect(pause.status).toBe(200);
      expect(pauseBody.data).toBeTruthy();
      await expect(repository.getById(projectId as ProjectId, "research_run_pause_queued" as ResearchRunId)).resolves.toMatchObject({
        status: "paused",
        qualityGateStatus: "not_evaluated"
      });
      await expect(
        repository.getById(projectId as ProjectId, "research_run_pause_running" as ResearchRunId)
      ).resolves.toMatchObject({
        status: "cancel_requested",
        qualityGateStatus: "not_evaluated"
      });

      const reactivate = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists/${allowlistId}`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: "active",
          sourceCategories: ["public_web"],
          approvedBy: "owner_run_recovery_reactivation"
        })
      });
      const reactivateBody = await jsonBody(reactivate);

      expect(reactivate.status).toBe(200);
      expect(reactivateBody.data).toBeTruthy();
      await expect(repository.getById(projectId as ProjectId, "research_run_pause_queued" as ResearchRunId)).resolves.toMatchObject({
        status: "running",
        provider: {
          adapterKind: "local_fake_readonly",
          providerRunId: "fake_readonly_research_run_pause_queued"
        }
      });

      await repository.create({
        run: phase15aRecoveryRunFixture(projectId, allowlistId, "research_run_revoke_queued", "queued"),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });
      await repository.create({
        run: phase15aRecoveryRunFixture(projectId, allowlistId, "research_run_revoke_running", "running"),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      const revoke = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists/${allowlistId}/revoke`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          reason: "Revoke should stop active automatic run recovery."
        })
      });
      const runList = await storageApp.request(`/api/v1/projects/${projectId}/research-runs`, {
        headers: authHeaders()
      });
      const revokeBody = await jsonBody(revoke);
      const runListBody = await jsonBody(runList);

      expect(revoke.status).toBe(200);
      expect(revokeBody.data).toBeTruthy();
      expect(runList.status).toBe(200);
      expect(runListBody.data).toMatchObject({
        recovery: {
          sseEventNames: ["projection.updated"]
        },
        runs: expect.arrayContaining([
          expect.objectContaining({
            researchRunId: "research_run_revoke_queued",
            status: "cancelled",
            terminalReason: "cancelled_by_user"
          }),
          expect.objectContaining({
            researchRunId: "research_run_revoke_running",
            status: "cancel_requested"
          })
        ])
      });
    } finally {
      await storage.close();
    }
  });

  it("does not resume paused research runs when reactivated policy no longer allows the original source", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { projectId } = await createProjectForTest(storageApp, "A narrowed allowlist recovery test idea");
      const allowlistId = "research_allowlist_policy_narrowed_resume";
      const repository = createResearchRunRepository(storage.db);

      await createAllowlistForTest(storageApp, projectId, allowlistId);
      await repository.create({
        run: phase15aRecoveryRunFixture(projectId, allowlistId, "research_run_policy_narrowed", "queued"),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      const pause = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists/${allowlistId}/pause`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          reason: "Pause before narrowing the allowlist policy."
        })
      });
      const pauseBody = await jsonBody(pause);

      expect(pause.status).toBe(200);
      expect(pauseBody.data).toBeTruthy();
      await expect(repository.getById(projectId as ProjectId, "research_run_policy_narrowed" as ResearchRunId)).resolves.toMatchObject({
        status: "paused",
        provider: expect.not.objectContaining({
          providerRunId: expect.any(String)
        })
      });

      const reactivate = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists/${allowlistId}`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: "active",
          connectorIds: ["official_docs"],
          sourceCategories: ["official_docs"],
          approvedBy: "owner_policy_narrowed_reactivation"
        })
      });
      const reactivateBody = await jsonBody(reactivate);

      expect(reactivate.status).toBe(200);
      expect(reactivateBody.data).toBeTruthy();
      await expect(repository.getById(projectId as ProjectId, "research_run_policy_narrowed" as ResearchRunId)).resolves.toMatchObject({
        status: "cancelled",
        terminalReason: "cancelled_by_user",
        provider: expect.not.objectContaining({
          providerRunId: expect.any(String)
        })
      });
    } finally {
      await storage.close();
    }
  });

  it("increments the allowlist governance collection version across multiple allowlists", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A multi-allowlist governance projection test idea",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed",
          businessCriticIntensity: "balanced",
          businessCriticIntensityConfirmation: "user_confirmed"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const projectId = sessionProjection.projectId as string;
      const firstAllowlistId = "research_allowlist_collection_first";
      const secondAllowlistId = "research_allowlist_collection_second";

      const firstCreate = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          allowlistId: firstAllowlistId,
          connectorIds: ["public_search"],
          sourceCategories: ["public_web"],
          approvedBy: "owner_collection_test"
        })
      });
      const firstCreateBody = await jsonBody(firstCreate);
      const firstCreateData = firstCreateBody.data as Readonly<Record<string, unknown>>;

      expect(firstCreate.status).toBe(200);
      expect(firstCreateData).toMatchObject({
        stateVersionBefore: 0,
        stateVersionAfter: 1,
        immediateProjection: {
          version: 1
        }
      });

      const secondCreate = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          allowlistId: secondAllowlistId,
          connectorIds: ["official_docs"],
          sourceCategories: ["official_docs"],
          approvedBy: "owner_collection_test"
        })
      });
      const secondCreateBody = await jsonBody(secondCreate);
      const secondCreateData = secondCreateBody.data as Readonly<Record<string, unknown>>;
      const secondCreateProjection = secondCreateData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(secondCreate.status).toBe(200);
      expect(secondCreateData).toMatchObject({
        stateVersionBefore: 1,
        stateVersionAfter: 2
      });
      expect(secondCreateProjection).toMatchObject({
        version: 2,
        allowlists: [
          expect.objectContaining({
            allowlistId: firstAllowlistId,
            version: 1
          }),
          expect.objectContaining({
            allowlistId: secondAllowlistId,
            version: 1
          })
        ]
      });

      const pause = await storageApp.request(
        `/api/v1/projects/${projectId}/research-allowlists/${firstAllowlistId}/pause`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        }
      );
      const pauseBody = await jsonBody(pause);
      const pauseData = pauseBody.data as Readonly<Record<string, unknown>>;
      const pauseProjection = pauseData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(pause.status).toBe(200);
      expect(pauseData).toMatchObject({
        stateVersionBefore: 2,
        stateVersionAfter: 3
      });
      expect(pauseProjection).toMatchObject({
        version: 3,
        selectedAllowlist: {
          allowlistId: firstAllowlistId,
          version: 2,
          status: "paused"
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("prepares public-safe disclosure payloads and persists queryable disclosure logs", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A disclosure-safe research route test idea",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed",
          businessCriticIntensity: "balanced",
          businessCriticIntensityConfirmation: "user_confirmed"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const projectId = sessionProjection.projectId as string;
      const allowlistId = "research_allowlist_disclosure_route";

      await createAllowlistForTest(storageApp, projectId, allowlistId, {
        approvedBy: "owner_disclosure_route"
      });

      const disclosure = await storageApp.request(`/api/v1/projects/${projectId}/research-disclosures`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          allowlistId,
          connectorId: "public_search",
          sourceCategory: "public_web",
          researchObjective: "Find public onboarding examples for founder@example.com.",
          productCategory: "Founder workflow assistant",
          customerProblemHypothesis: "Early founders need safer validation research.",
          sourceRefs: ["queue_item_disclosure", "https://docs.example.com/report?token=secret-value"]
        })
      });
      const disclosureBody = await jsonBody(disclosure);
      const disclosureData = disclosureBody.data as Readonly<Record<string, unknown>>;
      const preparation = disclosureData.immediateProjection as Readonly<Record<string, unknown>>;
      const publicSafePayload = preparation.publicSafePayload as Readonly<Record<string, unknown>>;

      expect(disclosure.status).toBe(200);
      expect(disclosureData).toMatchObject({
        category: "accepted_with_projection",
        projectionHints: [
          {
            projectionKind: "ResearchDisclosureLogProjection",
            refetchUrl: `/api/v1/projects/${projectId}/research-disclosures`
          }
        ],
        deterministicOutputs: [
          expect.objectContaining({
            payload: expect.objectContaining({
              commandType: "PrepareResearchDisclosure",
              providerExecution: false,
              externalTransferPerformed: false
            })
          })
        ]
      });
      expect(preparation).toMatchObject({
        kind: "ResearchDisclosurePreparationResult",
        status: "automatic_payload_ready",
        automaticExternalTransferAllowed: true,
        disclosureLog: {
          allowlistId,
          connectorId: "public_search",
          sourceCategory: "public_web",
          publicSafeSummarySent: expect.stringContaining("Product category")
        },
        projection: {
          kind: "ResearchDisclosureLogProjection",
          projectId,
          refetchUrl: `/api/v1/projects/${projectId}/research-disclosures`
        }
      });
      expect(publicSafePayload.researchObjective).toBe("Find public onboarding examples for [redacted contact].");
      expect(JSON.stringify(disclosureBody)).not.toContain("founder@example.com");
      expect(JSON.stringify(disclosureBody)).not.toContain("secret-value");

      const list = await storageApp.request(`/api/v1/projects/${projectId}/research-disclosures`, {
        headers: authHeaders()
      });
      const listBody = await jsonBody(list);

      expect(list.status).toBe(200);
      expect(listBody.data).toMatchObject({
        kind: "ResearchDisclosureLogProjection",
        disclosureLogs: [
          expect.objectContaining({
            status: "automatic_payload_ready",
            sourceRefs: ["queue_item_disclosure", "https://docs.example.com/report?[redacted secret]"]
          })
        ],
        latestDisclosureLog: expect.objectContaining({
          status: "automatic_payload_ready"
        })
      });

      const rows = await storage.client.execute("SELECT source_refs_json FROM research_disclosure_logs");

      expect(JSON.stringify(rows.rows)).not.toContain("secret-value");
    } finally {
      await storage.close();
    }
  });

  it("blocks private or credentialed disclosure requests before automatic transfer and logs the blocker", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A disclosure blocked route test idea",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed",
          businessCriticIntensity: "balanced",
          businessCriticIntensityConfirmation: "user_confirmed"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const projectId = sessionProjection.projectId as string;
      const blocked = await storageApp.request(`/api/v1/projects/${projectId}/research-disclosures`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          connectorId: "public_search",
          sourceCategory: "credentialed_source",
          researchObjective: "Compare private account session evidence for Jane Founder.",
          productCategory: "Founder workflow assistant",
          customerProblemHypothesis: "Jane Founder needs sensitive validation help.",
          rawIdea: "Raw idea with stealth pricing details must not leave the app.",
          detailedAnswers: ["Detailed willingness-to-pay answer must not leave the app."],
          privateCustomerNames: ["Jane Founder"],
          sourceRefs: ["queue_item_private"]
        })
      });
      const blockedBody = await jsonBody(blocked);
      const blockedData = blockedBody.data as Readonly<Record<string, unknown>>;
      const preparation = blockedData.immediateProjection as Readonly<Record<string, unknown>>;
      const disclosureLog = preparation.disclosureLog as Readonly<Record<string, unknown>>;

      expect(blocked.status).toBe(200);
      expect(blockedData).toMatchObject({
        category: "blocked",
        blockingCard: {
          userAction: "task_level_approval_or_manual_handoff"
        }
      });
      expect(preparation).toMatchObject({
        status: "blocked_manual_handoff",
        automaticExternalTransferAllowed: false,
        manualHandoff: {
          required: true,
          route: "task_level_approval_or_manual_handoff"
        }
      });
      expect(disclosureLog).toMatchObject({
        status: "blocked_manual_handoff",
        sourceCategory: "credentialed_source",
        automaticExternalTransferAllowed: false,
        blockReason: "manual_source_category"
      });

      const serialized = JSON.stringify(blockedBody);

      expect(serialized).not.toContain("Raw idea with stealth pricing");
      expect(serialized).not.toContain("willingness-to-pay");
      expect(serialized).not.toContain("Jane Founder");
      expect(serialized).toContain("[redacted private context]");

      const rows = await storage.client.execute("SELECT public_safe_summary_sent FROM research_disclosure_logs");

      expect(JSON.stringify(rows.rows)).not.toContain("Raw idea with stealth pricing");
    } finally {
      await storage.close();
    }
  });

  it("starts, observes, cancels, and retries Phase 1.5A research runs with refetch recovery hints", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { projectId } = await createProjectForTest(storageApp, "A research run control route test idea");
      const allowlistId = "research_allowlist_run_route";

      await createAllowlistForTest(storageApp, projectId, allowlistId);

      const startRun = await storageApp.request(`/api/v1/projects/${projectId}/research-runs`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          researchRunId: "research_run_route",
          researchTaskId: "research_task_route",
          allowlistId,
          connectorId: "public_search",
          sourceCategory: "public_web",
          adapterKind: "local_fake_readonly",
          researchObjective: "Find public onboarding proof for founder validation tools.",
          productCategory: "Founder workflow assistant",
          customerProblemHypothesis: "Early founders need safer validation research.",
          contextHash: "ctx_research_run_route",
          sourceRefs: ["queue_item_run_route"]
        })
      });
      const startRunBody = await jsonBody(startRun);
      const startRunData = startRunBody.data as Readonly<Record<string, unknown>>;
      const startResult = startRunData.immediateProjection as Readonly<Record<string, unknown>>;
      const startedRun = startResult.researchRun as ResearchRunProjection;
      const statusUrl = startRunData.statusUrl as string;

      expect(startRun.status).toBe(200);
      expect(startRunData).toMatchObject({
        category: "accepted_with_projection",
        statusUrl: `/api/v1/projects/${projectId}/research-runs/research_run_route/status`,
        projectionHints: [
          {
            projectionKind: "ResearchRunProjection",
            refetchUrl: `/api/v1/projects/${projectId}/research-runs/research_run_route/status`
          }
        ],
        deterministicOutputs: [
          expect.objectContaining({
            payload: expect.objectContaining({
              commandType: "StartResearchRun",
              sseEventHints: ["projection.updated"],
              externalMutationPerformed: false
            })
          })
        ]
      });
      expect(startResult).toMatchObject({
        kind: "ResearchRunControlResult",
        action: "start",
        status: "started",
        disclosureLog: expect.objectContaining({
          status: "automatic_payload_ready",
          automaticExternalTransferAllowed: true
        }),
        recovery: {
          refetchUrl: `/api/v1/projects/${projectId}/research-runs/research_run_route/status`,
          sseEventNames: ["projection.updated"]
        }
      });
      expect(startedRun).toMatchObject({
        researchRunId: "research_run_route",
        status: "running",
        provider: {
          adapterKind: "local_fake_readonly",
          providerRunId: "fake_readonly_research_run_route",
          attempt: 1
        }
      });

      const status = await storageApp.request(statusUrl, { headers: authHeaders() });
      const statusBody = await jsonBody(status);

      expect(status.status).toBe(200);
      expect(statusBody.data).toMatchObject({
        kind: "ResearchRunControlProjection",
        selectedRun: {
          researchRunId: "research_run_route",
          status: "running"
        },
        recovery: {
          projectionHints: [
            {
              projectionKind: "ResearchRunProjection",
              refetchUrl: statusUrl
            }
          ]
        }
      });

      const cancel = await storageApp.request(`/api/v1/projects/${projectId}/research-runs/research_run_route/cancel`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          researchRunId: "research_run_route",
          reason: "User cancelled after provider start."
        })
      });
      const cancelBody = await jsonBody(cancel);
      const cancelData = cancelBody.data as Readonly<Record<string, unknown>>;
      const cancelResult = cancelData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(cancel.status).toBe(200);
      expect(cancelResult).toMatchObject({
        action: "cancel",
        status: "cancel_requested",
        researchRun: {
          researchRunId: "research_run_route",
          status: "cancel_requested"
        }
      });

      const retrySourceStart = await storageApp.request(`/api/v1/projects/${projectId}/research-runs`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          researchRunId: "research_run_failed_source",
          researchTaskId: "research_task_retry_route",
          allowlistId,
          connectorId: "public_search",
          sourceCategory: "public_web",
          adapterKind: "local_fake_readonly",
          researchObjective: "Find public onboarding proof for retry behavior.",
          productCategory: "Founder workflow assistant",
          customerProblemHypothesis: "Early founders need safer validation research.",
          contextHash: "ctx_research_run_retry_route",
          sourceRefs: ["queue_item_retry_route"]
        })
      });
      const retrySourceBody = await jsonBody(retrySourceStart);
      const retrySourceData = retrySourceBody.data as Readonly<Record<string, unknown>>;
      const retrySourceResult = retrySourceData.immediateProjection as Readonly<Record<string, unknown>>;
      const retrySourceRun = retrySourceResult.researchRun as ResearchRunProjection;
      const repository = createResearchRunRepository(storage.db);
      const failedAt = timestampAfterProviderStart(retrySourceRun);
      const failedRun = {
        ...retrySourceRun,
        version: 3 as ProjectionVersion,
        status: "failed",
        provider: {
          ...retrySourceRun.provider,
          completedAt: failedAt
        },
        terminalReason: "timeout",
        updatedAt: failedAt
      } satisfies ResearchRunProjection;

      await repository.update({
        run: failedRun,
        expectedVersion: 2 as ProjectionVersion,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      const retry = await storageApp.request(`/api/v1/projects/${projectId}/research-runs/research_run_failed_source/retry`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          researchRunId: "research_run_failed_source",
          retryReason: "Retry after provider timeout.",
          contextHash: "ctx_research_run_retry_route"
        })
      });
      const retryBody = await jsonBody(retry);
      const retryData = retryBody.data as Readonly<Record<string, unknown>>;
      const retryResult = retryData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(retry.status).toBe(200);
      expect(retryResult).toMatchObject({
        action: "retry",
        status: "retry_started",
        retryAfterSeconds: 30,
        priorFailure: {
          researchRunId: "research_run_failed_source",
          terminalReason: "timeout",
          status: "failed",
          disclosureSummary: expect.stringContaining("Product category")
        },
        researchRun: {
          status: "running",
          retryOfRunId: "research_run_failed_source",
          retryReason: "Retry after provider timeout.",
          provider: {
            attempt: 2,
            idempotencyKey: expect.stringContaining("attempt=2")
          }
        }
      });

      const list = await storageApp.request(`/api/v1/projects/${projectId}/research-runs`, { headers: authHeaders() });
      const listBody = await jsonBody(list);

      expect(list.status).toBe(200);
      expect(listBody.data).toMatchObject({
        runs: [
          expect.objectContaining({ researchRunId: "research_run_route", status: "cancel_requested" }),
          expect.objectContaining({ researchRunId: "research_run_failed_source", status: "failed" }),
          expect.objectContaining({ retryOfRunId: "research_run_failed_source", status: "running" })
        ]
      });
    } finally {
      await storage.close();
    }
  });

  it("mounts web_search_readonly research runs without falling back to fake results", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { projectId } = await createProjectForTest(storageApp, "A web research adapter route test idea");
      const allowlistId = "research_allowlist_web_route";

      await createAllowlistForTest(storageApp, projectId, allowlistId);

      const startRun = await startWebResearchRunForTest(
        storageApp,
        projectId,
        allowlistId,
        "research_run_web_route"
      );
      const startRunBody = await jsonBody(startRun);
      const startRunData = startRunBody.data as Readonly<Record<string, unknown>>;
      const startResult = startRunData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(startRun.status).toBe(200);
      expect(startRunData).toMatchObject({
        category: "accepted_with_projection",
        deterministicOutputs: [
          expect.objectContaining({
            payload: expect.objectContaining({
              commandType: "StartResearchRun",
              providerExecution: "web_search_readonly",
              externalMutationPerformed: false
            })
          })
        ]
      });
      expect(startResult).toMatchObject({
        kind: "ResearchRunControlResult",
        status: "started",
        researchRun: {
          researchRunId: "research_run_web_route",
          status: "running",
          provider: {
            adapterKind: "web_search_readonly",
            providerRunId: "web_search_readonly_research_run_web_route",
            attempt: 1
          }
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("blocks web_search_readonly starts when browser-search configuration is invalid", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { projectId } = await createProjectForTest(storageApp, "A web adapter config blocker route test idea");
      const allowlistId = "research_allowlist_web_config_blocked";

      await createAllowlistForTest(storageApp, projectId, allowlistId);

      await withPatchedProcessEnv({ SOLO_RESEARCH_WEB_MAX_RESULTS: "token=secret" }, async () => {
        const startRun = await startWebResearchRunForTest(
          storageApp,
          projectId,
          allowlistId,
          "research_run_web_config_blocked"
        );
        const startRunBody = await jsonBody(startRun);
        const startRunData = startRunBody.data as Readonly<Record<string, unknown>>;
        const startResult = startRunData.immediateProjection as Readonly<Record<string, unknown>>;

        expect(startRun.status).toBe(200);
        expect(startResult).toMatchObject({
          kind: "ResearchRunControlResult",
          status: "blocked_precondition",
          blocker: {
            code: "adapter_unavailable",
            reason: expect.stringContaining("SOLO_RESEARCH_WEB_MAX_RESULTS")
          }
        });
        expect(JSON.stringify(startRunBody)).not.toContain("token=secret");
      });
    } finally {
      await storage.close();
    }
  });

  it("keeps web_search_readonly cancellation recoverable if adapter configuration later becomes invalid", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { projectId } = await createProjectForTest(storageApp, "A web adapter cancellation route test idea");
      const allowlistId = "research_allowlist_web_cancel_config";

      await createAllowlistForTest(storageApp, projectId, allowlistId);

      const startRun = await startWebResearchRunForTest(
        storageApp,
        projectId,
        allowlistId,
        "research_run_web_cancel_config"
      );
      const startRunBody = await jsonBody(startRun);

      expect(startRun.status).toBe(200);
      expect(startRunBody.data).toBeTruthy();

      await withPatchedProcessEnv({ SOLO_RESEARCH_WEB_MAX_RESULTS: "token=secret" }, async () => {
        const cancel = await storageApp.request(
          `/api/v1/projects/${projectId}/research-runs/research_run_web_cancel_config/cancel`,
          {
            method: "POST",
            headers: {
              ...authHeaders(),
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              researchRunId: "research_run_web_cancel_config",
              reason: "User cancelled after provider start."
            })
          }
        );
        const cancelBody = await jsonBody(cancel);
        const cancelData = cancelBody.data as Readonly<Record<string, unknown>>;
        const cancelResult = cancelData.immediateProjection as Readonly<Record<string, unknown>>;

        expect(cancel.status).toBe(200);
        expect(cancelResult).toMatchObject({
          action: "cancel",
          status: "cancel_requested",
          researchRun: {
            researchRunId: "research_run_web_cancel_config",
            status: "cancel_requested",
            provider: {
              adapterKind: "web_search_readonly",
              providerRunId: "web_search_readonly_research_run_web_cancel_config"
            }
          }
        });
      });
    } finally {
      await storage.close();
    }
  });

  it("marks web_search_readonly provider status polling failed instead of crashing on invalid configuration", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { projectId } = await createProjectForTest(storageApp, "A web adapter status failure route test idea");
      const allowlistId = "research_allowlist_web_status_config";

      await createAllowlistForTest(storageApp, projectId, allowlistId);

      const startRun = await startWebResearchRunForTest(
        storageApp,
        projectId,
        allowlistId,
        "research_run_web_status_config"
      );
      const startRunBody = await jsonBody(startRun);

      expect(startRun.status).toBe(200);
      expect(startRunBody.data).toBeTruthy();

      await withPatchedProcessEnv({ SOLO_RESEARCH_WEB_MAX_RESULTS: "token=secret" }, async () => {
        const status = await storageApp.request(
          `/api/v1/projects/${projectId}/research-runs/research_run_web_status_config/status`,
          { headers: authHeaders() }
        );
        const statusBody = await jsonBody(status);

        expect(status.status).toBe(200);
        expect(statusBody.data).toMatchObject({
          selectedRun: {
            researchRunId: "research_run_web_status_config",
            status: "failed",
            terminalReason: "provider_failed",
            qualityGateStatus: "not_evaluated"
          }
        });
        expect(JSON.stringify(statusBody)).not.toContain("token=secret");
      });
    } finally {
      await storage.close();
    }
  });

  it("blocks web_search_readonly retry before creating a retry run when adapter configuration is invalid", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { projectId } = await createProjectForTest(storageApp, "A web adapter retry config blocker test idea");
      const allowlistId = "research_allowlist_web_retry_config";

      await createAllowlistForTest(storageApp, projectId, allowlistId);

      const startRun = await startWebResearchRunForTest(
        storageApp,
        projectId,
        allowlistId,
        "research_run_web_retry_config"
      );
      const startRunBody = await jsonBody(startRun);

      expect(startRun.status).toBe(200);
      expect(startRunBody.data).toBeTruthy();

      await withPatchedProcessEnv({ SOLO_RESEARCH_WEB_MAX_RESULTS: "token=secret" }, async () => {
        const status = await storageApp.request(
          `/api/v1/projects/${projectId}/research-runs/research_run_web_retry_config/status`,
          { headers: authHeaders() }
        );
        const retry = await storageApp.request(
          `/api/v1/projects/${projectId}/research-runs/research_run_web_retry_config/retry`,
          {
            method: "POST",
            headers: {
              ...authHeaders(),
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              researchRunId: "research_run_web_retry_config",
              retryReason: "Retry after local adapter configuration is fixed.",
              contextHash: "ctx_research_run_web_retry_config_retry"
            })
          }
        );
        const statusBody = await jsonBody(status);
        const retryBody = await jsonBody(retry);
        const retryData = retryBody.data as Readonly<Record<string, unknown>>;
        const retryResult = retryData.immediateProjection as Readonly<Record<string, unknown>>;

        expect(status.status).toBe(200);
        expect(statusBody.data).toBeTruthy();
        expect(retry.status).toBe(200);
        expect(retryResult).toMatchObject({
          action: "retry",
          status: "blocked_precondition",
          researchRun: {
            researchRunId: "research_run_web_retry_config",
            status: "failed"
          },
          blocker: {
            code: "adapter_unavailable",
            reason: expect.stringContaining("SOLO_RESEARCH_WEB_MAX_RESULTS")
          }
        });
        expect(JSON.stringify(retryBody)).not.toContain("token=secret");
      });
    } finally {
      await storage.close();
    }
  });

  it("polls completed local fake provider runs into needs_review without accepting evidence", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { projectId } = await createProjectForTest(storageApp, "A provider polling route test idea");
      const allowlistId = "research_allowlist_provider_poll";
      const repository = createResearchRunRepository(storage.db);

      await createAllowlistForTest(storageApp, projectId, allowlistId);
      await repository.create({
        run: phase15aRecoveryRunFixture(projectId, allowlistId, "research_run_provider_poll", "running"),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      const status = await storageApp.request(
        `/api/v1/projects/${projectId}/research-runs/research_run_provider_poll/status`,
        { headers: authHeaders() }
      );
      const statusBody = await jsonBody(status);

      expect(status.status).toBe(200);
      expect(statusBody.data).toMatchObject({
        selectedRun: {
          researchRunId: "research_run_provider_poll",
          status: "needs_review",
          qualityGateStatus: "pending_review",
          qualityGateReviewReason: expect.stringContaining("Evidence Pack quality-gate"),
          provider: {
            completedAt: expect.any(String)
          }
        },
        recovery: {
          refetchUrl: `/api/v1/projects/${projectId}/research-runs/research_run_provider_poll/status`,
          sseEventNames: ["projection.updated"]
        }
      });
      await expect(repository.getById(projectId as ProjectId, "research_run_provider_poll" as ResearchRunId)).resolves.toMatchObject({
        status: "needs_review"
      });

      const repeatStatus = await storageApp.request(
        `/api/v1/projects/${projectId}/research-runs/research_run_provider_poll/status`,
        { headers: authHeaders() }
      );
      const repeatStatusBody = await jsonBody(repeatStatus);

      expect(repeatStatus.status).toBe(200);
      expect(repeatStatusBody.data).toMatchObject({
        selectedRun: {
          researchRunId: "research_run_provider_poll",
          status: "needs_review",
          qualityGateStatus: "pending_review"
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("polls ready mounted research runs during project-level run refresh", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { projectId, sessionId } = await createProjectForTest(
        storageApp,
        "A project-level research refresh test idea"
      );
      const allowlistId = "research_allowlist_project_list_poll";
      const researchTaskId = await planResearchTaskForTest(storageApp, {
        sessionId,
        expectedStateVersion: 1,
        objective: "Validate project-level research run refresh ingestion.",
        sourceQueueItemId: "queue_project_list_poll"
      });
      const repository = createResearchRunRepository(storage.db);
      const providerRun = phase15aRecoveryRunFixture(
        projectId,
        allowlistId,
        "research_run_project_list_poll",
        "running"
      );

      await createAllowlistForTest(storageApp, projectId, allowlistId);
      await repository.create({
        run: {
          ...providerRun,
          researchTaskId,
          provider: {
            ...providerRun.provider,
            researchTaskId
          },
          sourceRefs: ["queue_project_list_poll"]
        },
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      const list = await storageApp.request(`/api/v1/projects/${projectId}/research-runs`, {
        headers: authHeaders()
      });
      const listBody = await jsonBody(list);

      expect(list.status).toBe(200);
      expect(listBody.data).toMatchObject({
        runs: [
          expect.objectContaining({
            researchRunId: "research_run_project_list_poll",
            status: "research_insufficient",
            qualityGateStatus: "insufficient",
            terminalReason: "quality_gate_insufficient"
          })
        ]
      });

      const research = await storageApp.request(`/api/v1/sessions/${sessionId}/research`, {
        headers: authHeaders()
      });
      const researchBody = await jsonBody(research);

      expect(research.status).toBe(200);
      expect(researchBody.data).toMatchObject({
        results: [
          expect.objectContaining({
            researchRunId: "research_run_project_list_poll"
          })
        ],
        evidencePacks: [
          expect.objectContaining({
            researchRunId: "research_run_project_list_poll",
            gateStatus: "research_insufficient"
          })
        ]
      });

      const queue = await storageApp.request(`/api/v1/sessions/${sessionId}/queue`, {
        headers: authHeaders()
      });
      const queueBody = await jsonBody(queue);

      expect(queue.status).toBe(200);
      expect(queueBody.data).toMatchObject({
        blocked: [
          expect.objectContaining({
            researchTaskId,
            blocksPlanning: true
          })
        ]
      });

      const repeatedList = await storageApp.request(`/api/v1/projects/${projectId}/research-runs`, {
        headers: authHeaders()
      });
      const repeatedListBody = await jsonBody(repeatedList);

      expect(repeatedList.status).toBe(200);
      expect(repeatedListBody.data).toMatchObject({
        runs: [
          expect.objectContaining({
            researchRunId: "research_run_project_list_poll",
            status: "research_insufficient"
          })
        ]
      });
    } finally {
      await storage.close();
    }
  });

  it("ingests completed provider results into Evidence Pack and Research-updated Queue", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { projectId, sessionId } = await createProjectForTest(storageApp, "A provider ingest route test idea");
      const allowlistId = "research_allowlist_provider_ingest";
      await createAllowlistForTest(storageApp, projectId, allowlistId);

      const planResearch = await storageApp.request(`/api/v1/sessions/${sessionId}/research-tasks`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 1,
          objective: "Validate provider result ingest traceability",
          sourceQueueItemId: "queue_provider_ingest",
          routeOutcome: "research_needed",
          impact: "high"
        })
      });
      const planResearchBody = await jsonBody(planResearch);
      const planResearchData = planResearchBody.data as Readonly<Record<string, unknown>>;
      const researchProjection = planResearchData.immediateProjection as Readonly<Record<string, unknown>>;
      const researchTaskId = (researchProjection.taskIds as readonly string[])[0] as ResearchTaskId;
      const repository = createResearchRunRepository(storage.db);
      const providerRun = phase15aRecoveryRunFixture(
        projectId,
        allowlistId,
        "research_run_provider_ingest",
        "running"
      );

      expect(planResearch.status).toBe(200);
      await repository.create({
        run: {
          ...providerRun,
          researchTaskId,
          provider: {
            ...providerRun.provider,
            researchTaskId
          },
          sourceRefs: ["queue_provider_ingest"]
        },
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      const status = await storageApp.request(
        `/api/v1/projects/${projectId}/research-runs/research_run_provider_ingest/status`,
        { headers: authHeaders() }
      );
      const statusBody = await jsonBody(status);

      expect(status.status).toBe(200);
      expect(statusBody.data).toMatchObject({
        selectedRun: {
          researchRunId: "research_run_provider_ingest",
          status: "research_insufficient",
          qualityGateStatus: "insufficient",
          terminalReason: "quality_gate_insufficient"
        }
      });

      const research = await storageApp.request(`/api/v1/sessions/${sessionId}/research`, {
        headers: authHeaders()
      });
      const researchBody = await jsonBody(research);

      expect(research.status).toBe(200);
      expect(researchBody.data).toMatchObject({
        results: expect.arrayContaining([
          expect.objectContaining({
            researchRunId: "research_run_provider_ingest",
            sourceRetrievedAt: expect.any(String)
          })
        ]),
        evidencePacks: expect.arrayContaining([
          expect.objectContaining({
            researchRunId: "research_run_provider_ingest",
            gateStatus: "research_insufficient",
            claim: "Validate provider result ingest traceability"
          })
        ]),
        reviewCards: expect.arrayContaining([
          expect.objectContaining({
            state: "terminal_failure",
            gateStatus: "research_insufficient",
            blocksPlanning: true,
            retainedSourceRefs: expect.arrayContaining(["research_run_provider_ingest"])
          })
        ])
      });

      const queue = await storageApp.request(`/api/v1/sessions/${sessionId}/queue`, {
        headers: authHeaders()
      });
      const queueBody = await jsonBody(queue);

      expect(queue.status).toBe(200);
      expect(queueBody.data).toMatchObject({
        blocked: [
          expect.objectContaining({
            researchTaskId,
            blocksPlanning: true,
            availableOutcomes: expect.arrayContaining(["research_insufficient"])
          })
        ]
      });
    } finally {
      await storage.close();
    }
  });

  it("keeps quality-gate-unknown research run results in needs_review with Evidence Pack trace", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { projectId, sessionId } = await createProjectForTest(
        storageApp,
        "A decision-linked evidence pack route test idea"
      );
      const allowlistId = "research_allowlist_evidence_pack";
      await createAllowlistForTest(storageApp, projectId, allowlistId);

      const planResearch = await storageApp.request(`/api/v1/sessions/${sessionId}/research-tasks`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 1,
          objective: "Validate implementation readiness source quality",
          sourceQueueItemId: "queue_quality_gate_route",
          routeOutcome: "research_needed",
          impact: "high"
        })
      });
      const planResearchBody = await jsonBody(planResearch);
      const planResearchData = planResearchBody.data as Readonly<Record<string, unknown>>;
      const researchProjection = planResearchData.immediateProjection as Readonly<Record<string, unknown>>;
      const taskIds = researchProjection.taskIds as readonly string[];
      const researchTaskId = taskIds[0];

      expect(planResearch.status).toBe(200);
      expect(researchTaskId).toEqual(expect.stringMatching(/^research_task_/));

      const startRun = await storageApp.request(`/api/v1/projects/${projectId}/research-runs`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          researchRunId: "research_run_quality_gate_unknown",
          researchTaskId,
          allowlistId,
          connectorId: "public_search",
          sourceCategory: "public_web",
          adapterKind: "local_fake_readonly",
          researchObjective: "Validate implementation readiness source quality",
          productCategory: "Founder workflow assistant",
          customerProblemHypothesis: "Founders need reliable handoff evidence.",
          contextHash: "ctx_research_run_quality_gate_unknown",
          sourceRefs: ["queue_quality_gate_route"]
        })
      });
      const startRunBody = await jsonBody(startRun);

      expect(startRun.status).toBe(200);
      expect(startRunBody.data).toBeTruthy();

      const importResult = await storageApp.request(`/api/v1/research-tasks/${researchTaskId}/results`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          researchTaskId,
          researchRunId: "research_run_quality_gate_unknown",
          expectedStateVersion: 2,
          result: "Pro: implementation looks feasible. Con: integration risk remains.",
          sourceReliability: "unknown",
          limitationNotes: "Source reliability was not captured.",
          claim: "Implementation is ready for a planning handoff.",
          decisionContext: "implementation_readiness",
          specSectionRef: "spec:implementation",
          questionRef: "queue_quality_gate_route"
        })
      });
      const importResultBody = await jsonBody(importResult);

      expect(importResult.status).toBe(200);
      expect(importResultBody.data).toBeTruthy();

      const executorResults = await createProductEngineCommandService(storage).runPendingResearchEvidenceEffects();

      expect(executorResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "succeeded",
            balanceStatus: "balanced"
          })
        ])
      );

      const research = await storageApp.request(`/api/v1/sessions/${sessionId}/research`, {
        headers: authHeaders()
      });
      const researchBody = await jsonBody(research);

      expect(research.status).toBe(200);
      expect(researchBody.data).toMatchObject({
        evidencePacks: [
          expect.objectContaining({
            researchRunId: "research_run_quality_gate_unknown",
            gateStatus: "needs_review",
            claim: "Implementation is ready for a planning handoff."
          })
        ],
        reviewCards: [
          expect.objectContaining({
            state: "quality_gate_review",
            gateStatus: "needs_review"
          })
        ]
      });

      const runStatus = await storageApp.request(
        `/api/v1/projects/${projectId}/research-runs/research_run_quality_gate_unknown/status`,
        { headers: authHeaders() }
      );
      const runStatusBody = await jsonBody(runStatus);

      expect(runStatus.status).toBe(200);
      expect(runStatusBody.data).toMatchObject({
        selectedRun: {
          status: "needs_review",
          qualityGateStatus: "pending_review",
          qualityGateReviewReason: expect.stringContaining("insufficient")
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("resolves Research-updated Queue cards through the route with rationale-preserving terminal outcomes", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { sessionId } = await createProjectForTest(
        storageApp,
        "A research-updated queue terminal route test idea"
      );
      const planResearch = await storageApp.request(`/api/v1/sessions/${sessionId}/research-tasks`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 1,
          objective: "Validate high-impact launch risk",
          sourceQueueItemId: "queue_risk_accept_route",
          routeOutcome: "missing_con_evidence",
          impact: "high"
        })
      });
      const planResearchBody = await jsonBody(planResearch);
      const planResearchData = planResearchBody.data as Readonly<Record<string, unknown>>;
      const researchProjection = planResearchData.immediateProjection as Readonly<Record<string, unknown>>;
      const researchTaskId = (researchProjection.taskIds as readonly string[])[0];

      expect(planResearch.status).toBe(200);

      const importResult = await storageApp.request(`/api/v1/research-tasks/${researchTaskId}/results`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          researchTaskId,
          expectedStateVersion: 2,
          result: "Pro: launch urgency looks strong.",
          limitationNotes: "No counter-evidence source was found."
        })
      });
      const importResultBody = await jsonBody(importResult);

      expect(importResult.status).toBe(200);
      expect(importResultBody.data).toBeTruthy();
      expect(await createProductEngineCommandService(storage).runPendingResearchEvidenceEffects()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "succeeded",
            balanceStatus: "missing_con_evidence"
          })
        ])
      );

      const beforeResolve = await storageApp.request(`/api/v1/sessions/${sessionId}/research`, {
        headers: authHeaders()
      });
      const beforeResolveBody = await jsonBody(beforeResolve);
      const riskCard = ((beforeResolveBody.data as Readonly<Record<string, unknown>>).reviewCards as readonly Readonly<Record<string, unknown>>[])[0];

      expect(riskCard).toBeDefined();
      if (!riskCard) {
        throw new Error("Expected risk_acceptance research card.");
      }
      expect(riskCard).toMatchObject({
        cardType: "risk_acceptance",
        blocksPlanning: true,
        availableOutcomes: expect.arrayContaining(["risk_accepted", "research_insufficient"])
      });
      const cardId = riskCard.cardId as string;

      const missingRationale = await storageApp.request(`/api/v1/research-cards/${cardId}/resolve`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          cardId,
          expectedStateVersion: 4,
          outcome: "risk_accepted"
        })
      });
      const missingRationaleBody = await jsonBody(missingRationale);

      expect(missingRationale.status).toBe(200);
      expect(missingRationaleBody.data).toMatchObject({
        category: "rejected",
        error: {
          code: "VALIDATION_FAILED",
          message: expect.stringContaining("rationale")
        }
      });

      const resolved = await storageApp.request(`/api/v1/research-cards/${cardId}/resolve`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          cardId,
          expectedStateVersion: 4,
          outcome: "risk_accepted",
          rationale: "Founder accepts this missing counter-evidence risk for the next validation sprint."
        })
      });
      const resolvedBody = await jsonBody(resolved);

      expect(resolved.status).toBe(200);
      expect(resolvedBody.data).toMatchObject({
        category: "accepted_with_projection",
        queueProjection: {
          blocked: expect.not.arrayContaining([
            expect.objectContaining({
              queueItemId: cardId
            })
          ])
        }
      });

      const afterResolve = await storageApp.request(`/api/v1/sessions/${sessionId}/research`, {
        headers: authHeaders()
      });
      const afterResolveBody = await jsonBody(afterResolve);

      expect(afterResolveBody.data).toMatchObject({
        reviewCards: expect.arrayContaining([
          expect.objectContaining({
            cardId,
            terminalOutcome: "risk_accepted",
            terminalRationale: "Founder accepts this missing counter-evidence risk for the next validation sprint.",
            blocksPlanning: false
          })
        ]),
        knownRisks: expect.arrayContaining([
          expect.stringContaining("Founder accepts this missing counter-evidence risk")
        ])
      });
    } finally {
      await storage.close();
    }
  });

  it("returns an existing research run for duplicate starts before applying rate budget blockers", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    async function postStart(projectId: string, body: Readonly<Record<string, unknown>>) {
      return storageApp.request(`/api/v1/projects/${projectId}/research-runs`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
    }

    try {
      const { projectId } = await createProjectForTest(storageApp, "A duplicate research run start test idea");
      const allowlistId = "research_allowlist_idempotent_run";
      const startBody = {
        researchTaskId: "research_task_idempotent",
        allowlistId,
        connectorId: "public_search",
        sourceCategory: "public_web",
        adapterKind: "local_fake_readonly",
        researchObjective: "Find public onboarding proof for idempotent start behavior.",
        productCategory: "Founder workflow assistant",
        customerProblemHypothesis: "Early founders need safe duplicate retry recovery.",
        contextHash: "ctx_research_run_idempotent",
        sourceRefs: ["queue_item_idempotent"]
      };

      await createAllowlistForTest(storageApp, projectId, allowlistId, {
        rateBudgetPolicy: {
          maxConcurrentRunsPerProject: 1,
          maxRunsPerSession: 12,
          maxAutomaticRetriesPerRun: 2,
          runTimeoutSeconds: 600,
          retryBackoffSeconds: [30, 120]
        }
      });

      const first = await postStart(projectId, startBody);
      const firstBody = await jsonBody(first);
      const firstData = firstBody.data as Readonly<Record<string, unknown>>;
      const firstResult = firstData.immediateProjection as Readonly<Record<string, unknown>>;
      const firstRun = firstResult.researchRun as ResearchRunProjection;

      expect(first.status).toBe(200);
      expect(firstResult).toMatchObject({
        action: "start",
        status: "started",
        researchRun: {
          status: "running"
        }
      });

      const duplicate = await postStart(projectId, startBody);
      const duplicateBody = await jsonBody(duplicate);
      const duplicateData = duplicateBody.data as Readonly<Record<string, unknown>>;
      const duplicateResult = duplicateData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(duplicate.status).toBe(200);
      expect(duplicateData).toMatchObject({
        category: "accepted_with_projection"
      });
      expect(duplicateResult).toMatchObject({
        action: "start",
        status: "started",
        researchRun: {
          researchRunId: firstRun.researchRunId,
          status: "running"
        }
      });
      expect(duplicateResult).not.toHaveProperty("blocker");

      const conflicting = await postStart(projectId, {
        ...startBody,
        researchTaskId: "research_task_rate_budget_conflict",
        researchObjective: "Find public onboarding proof for a second concurrent run.",
        contextHash: "ctx_research_run_rate_budget_conflict"
      });
      const conflictingBody = await jsonBody(conflicting);

      expect(conflicting.status).toBe(200);
      expect(conflictingBody.data).toMatchObject({
        category: "blocked",
        immediateProjection: {
          status: "blocked_precondition",
          blocker: {
            code: "rate_budget_exhausted"
          }
        }
      });

      const runRows = await storage.client.execute("SELECT id FROM research_runs");
      const disclosureRows = await storage.client.execute("SELECT id FROM research_disclosure_logs");

      expect(runRows.rows).toHaveLength(1);
      expect(disclosureRows.rows).toHaveLength(2);
    } finally {
      await storage.close();
    }
  });

  it("enforces the active allowlist session run budget in the sidecar start API", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { projectId, sessionId } = await createProjectForTest(
        storageApp,
        "A backend research session budget test idea"
      );
      const allowlistId = "research_allowlist_backend_session_budget";

      await createAllowlistForTest(storageApp, projectId, allowlistId, {
        rateBudgetPolicy: {
          maxConcurrentRunsPerProject: 1,
          maxRunsPerSession: 1,
          maxAutomaticRetriesPerRun: 2,
          runTimeoutSeconds: 600,
          retryBackoffSeconds: [30, 120]
        }
      });

      const firstTaskId = await planResearchTaskForTest(storageApp, {
        sessionId,
        expectedStateVersion: 1,
        objective: "Find first public evidence before the session budget is spent.",
        sourceQueueItemId: "queue_backend_session_budget_first"
      });
      const secondTaskId = await planResearchTaskForTest(storageApp, {
        sessionId,
        expectedStateVersion: 2,
        objective: "Find second public evidence after the session budget is spent.",
        sourceQueueItemId: "queue_backend_session_budget_second"
      });

      const firstStart = await startWebResearchRunForTest(
        storageApp,
        projectId,
        allowlistId,
        "research_run_backend_session_budget_first",
        {
          researchTaskId: firstTaskId,
          contextHash: "ctx_backend_session_budget_first",
          sourceRefs: ["queue_backend_session_budget_first"]
        }
      );
      const firstStartBody = await jsonBody(firstStart);
      const firstStartData = firstStartBody.data as Readonly<Record<string, unknown>>;
      const firstStartProjection = firstStartData.immediateProjection as Readonly<Record<string, unknown>>;
      const firstRun = firstStartProjection.researchRun as ResearchRunProjection;
      const completedAt = timestampAfterProviderStart(firstRun);
      const savedTerminalRun = await createResearchRunRepository(storage.db).update({
        run: {
          ...firstRun,
          version: (Number(firstRun.version) + 1) as ProjectionVersion,
          status: "failed",
          provider: {
            ...firstRun.provider,
            completedAt
          },
          terminalReason: "provider_failed",
          updatedAt: completedAt
        },
        expectedVersion: firstRun.version,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      expect(firstStart.status).toBe(200);
      expect(savedTerminalRun).toMatchObject({
        researchRunId: "research_run_backend_session_budget_first",
        status: "failed"
      });

      const overBudgetStart = await startWebResearchRunForTest(
        storageApp,
        projectId,
        allowlistId,
        "research_run_backend_session_budget_second",
        {
          researchTaskId: secondTaskId,
          contextHash: "ctx_backend_session_budget_second",
          sourceRefs: ["queue_backend_session_budget_second"]
        }
      );
      const overBudgetBody = await jsonBody(overBudgetStart);

      expect(overBudgetStart.status).toBe(200);
      expect(overBudgetBody.data).toMatchObject({
        category: "blocked",
        immediateProjection: {
          status: "blocked_precondition",
          blocker: {
            code: "rate_budget_exhausted",
            reason: expect.stringContaining("per-session run budget")
          }
        }
      });

      const overBudgetRetry = await storageApp.request(
        `/api/v1/projects/${projectId}/research-runs/${firstRun.researchRunId}/retry`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            researchRunId: firstRun.researchRunId,
            retryReason: "Retry should also respect the spent session run budget.",
            contextHash: "ctx_backend_session_budget_retry"
          })
        }
      );
      const overBudgetRetryBody = await jsonBody(overBudgetRetry);

      expect(overBudgetRetry.status).toBe(200);
      expect(overBudgetRetryBody.data).toMatchObject({
        category: "blocked",
        immediateProjection: {
          action: "retry",
          status: "blocked_precondition",
          blocker: {
            code: "rate_budget_exhausted",
            reason: expect.stringContaining("per-session run budget")
          }
        }
      });

      const runRows = await storage.client.execute("SELECT id FROM research_runs");

      expect(runRows.rows).toHaveLength(1);
    } finally {
      await storage.close();
    }
  });

  it("does not spend a sidecar session run budget on another allowlist", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { projectId, sessionId } = await createProjectForTest(
        storageApp,
        "A backend allowlist-scoped session budget test idea"
      );
      const activeAllowlistId = "research_allowlist_backend_session_budget_active";
      const otherAllowlistId = "research_allowlist_backend_session_budget_other";
      const rateBudgetPolicy = {
        maxConcurrentRunsPerProject: 1,
        maxRunsPerSession: 1,
        maxAutomaticRetriesPerRun: 2,
        runTimeoutSeconds: 600,
        retryBackoffSeconds: [30, 120]
      };

      await createAllowlistForTest(storageApp, projectId, activeAllowlistId, { rateBudgetPolicy });
      await createAllowlistForTest(storageApp, projectId, otherAllowlistId, { rateBudgetPolicy });

      const otherAllowlistTaskId = await planResearchTaskForTest(storageApp, {
        sessionId,
        expectedStateVersion: 1,
        objective: "Find public evidence under another allowlist.",
        sourceQueueItemId: "queue_backend_session_budget_other_allowlist"
      });
      const activeAllowlistTaskId = await planResearchTaskForTest(storageApp, {
        sessionId,
        expectedStateVersion: 2,
        objective: "Find public evidence under the active allowlist.",
        sourceQueueItemId: "queue_backend_session_budget_active_allowlist"
      });
      const otherAllowlistStart = await startWebResearchRunForTest(
        storageApp,
        projectId,
        otherAllowlistId,
        "research_run_backend_session_budget_other_allowlist",
        {
          researchTaskId: otherAllowlistTaskId,
          contextHash: "ctx_backend_session_budget_other_allowlist",
          sourceRefs: ["queue_backend_session_budget_other_allowlist"]
        }
      );
      const otherAllowlistStartBody = await jsonBody(otherAllowlistStart);
      const otherAllowlistStartData = otherAllowlistStartBody.data as Readonly<Record<string, unknown>>;
      const otherAllowlistProjection = otherAllowlistStartData.immediateProjection as Readonly<Record<string, unknown>>;
      const otherAllowlistRun = otherAllowlistProjection.researchRun as ResearchRunProjection;
      const completedAt = timestampAfterProviderStart(otherAllowlistRun);
      const savedOtherAllowlistRun = await createResearchRunRepository(storage.db).update({
        run: {
          ...otherAllowlistRun,
          version: (Number(otherAllowlistRun.version) + 1) as ProjectionVersion,
          status: "failed",
          provider: {
            ...otherAllowlistRun.provider,
            completedAt
          },
          terminalReason: "provider_failed",
          updatedAt: completedAt
        },
        expectedVersion: otherAllowlistRun.version,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      expect(otherAllowlistStart.status).toBe(200);
      expect(savedOtherAllowlistRun).toMatchObject({
        allowlistId: otherAllowlistId,
        status: "failed"
      });

      const activeAllowlistStart = await startWebResearchRunForTest(
        storageApp,
        projectId,
        activeAllowlistId,
        "research_run_backend_session_budget_active_allowlist",
        {
          researchTaskId: activeAllowlistTaskId,
          contextHash: "ctx_backend_session_budget_active_allowlist",
          sourceRefs: ["queue_backend_session_budget_active_allowlist"]
        }
      );
      const activeAllowlistStartBody = await jsonBody(activeAllowlistStart);

      expect(activeAllowlistStart.status).toBe(200);
      expect(activeAllowlistStartBody.data).toMatchObject({
        category: "accepted_with_projection",
        immediateProjection: {
          status: "started",
          researchRun: {
            allowlistId: activeAllowlistId,
            status: "running"
          }
        }
      });

      const runRows = await storage.client.execute("SELECT id FROM research_runs");

      expect(runRows.rows).toHaveLength(2);
    } finally {
      await storage.close();
    }
  });

  it("keeps manual retry idempotent while enforcing rate budget for new retry attempts", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    async function postStart(projectId: string, body: Readonly<Record<string, unknown>>) {
      return storageApp.request(`/api/v1/projects/${projectId}/research-runs`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
    }

    async function postRetry(projectId: string, researchRunId: string, body: Readonly<Record<string, unknown>>) {
      return storageApp.request(`/api/v1/projects/${projectId}/research-runs/${researchRunId}/retry`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
    }

    try {
      const { projectId } = await createProjectForTest(storageApp, "A manual retry idempotency and budget test idea");
      const allowlistId = "research_allowlist_retry_budget";

      await createAllowlistForTest(storageApp, projectId, allowlistId, {
        rateBudgetPolicy: {
          maxConcurrentRunsPerProject: 1,
          maxRunsPerSession: 12,
          maxAutomaticRetriesPerRun: 2,
          runTimeoutSeconds: 600,
          retryBackoffSeconds: [30, 120]
        }
      });

      const sourceStart = await postStart(projectId, {
        researchRunId: "research_run_retry_source",
        researchTaskId: "research_task_retry_source",
        allowlistId,
        connectorId: "public_search",
        sourceCategory: "public_web",
        adapterKind: "local_fake_readonly",
        researchObjective: "Find public onboarding proof for manual retry idempotency.",
        productCategory: "Founder workflow assistant",
        customerProblemHypothesis: "Early founders need safe retry recovery.",
        contextHash: "ctx_research_run_retry_source",
        sourceRefs: ["queue_item_retry_source"]
      });
      const sourceStartBody = await jsonBody(sourceStart);
      const sourceStartData = sourceStartBody.data as Readonly<Record<string, unknown>>;
      const sourceStartResult = sourceStartData.immediateProjection as Readonly<Record<string, unknown>>;
      const sourceRun = sourceStartResult.researchRun as ResearchRunProjection;
      const repository = createResearchRunRepository(storage.db);
      const failedAt = timestampAfterProviderStart(sourceRun);
      const failedSourceRun = {
        ...sourceRun,
        version: (Number(sourceRun.version) + 1) as ProjectionVersion,
        status: "failed",
        provider: {
          ...sourceRun.provider,
          completedAt: failedAt
        },
        terminalReason: "timeout",
        updatedAt: failedAt
      } satisfies ResearchRunProjection;

      const savedFailedSourceRun = await repository.update({
        run: failedSourceRun,
        expectedVersion: sourceRun.version,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      expect(savedFailedSourceRun).not.toBeNull();

      const retryBody = {
        researchRunId: "research_run_retry_source",
        retryReason: "Retry after provider timeout.",
        contextHash: "ctx_research_run_retry_source"
      };
      const retry = await postRetry(projectId, "research_run_retry_source", retryBody);
      const retryResponseBody = await jsonBody(retry);
      const retryData = retryResponseBody.data as Readonly<Record<string, unknown>>;
      const retryResult = retryData.immediateProjection as Readonly<Record<string, unknown>>;
      const attemptTwoRun = retryResult.researchRun as ResearchRunProjection;

      expect(retry.status).toBe(200);
      expect(retryResult).toMatchObject({
        action: "retry",
        status: "retry_started",
        researchRun: {
          retryOfRunId: "research_run_retry_source",
          status: "running",
          provider: {
            attempt: 2
          }
        }
      });

      const duplicateRetry = await postRetry(projectId, "research_run_retry_source", retryBody);
      const duplicateRetryBody = await jsonBody(duplicateRetry);
      const duplicateRetryData = duplicateRetryBody.data as Readonly<Record<string, unknown>>;
      const duplicateRetryResult = duplicateRetryData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(duplicateRetry.status).toBe(200);
      expect(duplicateRetryResult).toMatchObject({
        action: "retry",
        status: "retry_started",
        researchRun: {
          researchRunId: attemptTwoRun.researchRunId,
          status: "running",
          provider: {
            attempt: 2
          }
        }
      });
      expect(duplicateRetryResult).not.toHaveProperty("blocker");

      const rowsAfterDuplicate = await storage.client.execute("SELECT id FROM research_runs");

      expect(rowsAfterDuplicate.rows).toHaveLength(2);

      const attemptTwoFailedAt = timestampAfterProviderStart(attemptTwoRun);
      const failedAttemptTwoRun = {
        ...attemptTwoRun,
        version: (Number(attemptTwoRun.version) + 1) as ProjectionVersion,
        status: "failed",
        provider: {
          ...attemptTwoRun.provider,
          completedAt: attemptTwoFailedAt
        },
        terminalReason: "timeout",
        updatedAt: attemptTwoFailedAt
      } satisfies ResearchRunProjection;

      const savedFailedAttemptTwoRun = await repository.update({
        run: failedAttemptTwoRun,
        expectedVersion: attemptTwoRun.version,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      expect(savedFailedAttemptTwoRun).not.toBeNull();

      const terminalDuplicateRetry = await postRetry(projectId, "research_run_retry_source", retryBody);
      const terminalDuplicateRetryBody = await jsonBody(terminalDuplicateRetry);
      const terminalDuplicateRetryData = terminalDuplicateRetryBody.data as Readonly<Record<string, unknown>>;
      const terminalDuplicateRetryResult =
        terminalDuplicateRetryData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(terminalDuplicateRetry.status).toBe(200);
      expect(terminalDuplicateRetryResult).toMatchObject({
        action: "retry",
        status: "status",
        researchRun: {
          researchRunId: attemptTwoRun.researchRunId,
          status: "failed",
          provider: {
            attempt: 2
          }
        }
      });
      expect(terminalDuplicateRetryResult).not.toHaveProperty("retryAfterSeconds");
      expect(terminalDuplicateRetryData.deterministicOutputs).toEqual([
        expect.objectContaining({
          payload: expect.objectContaining({
            providerExecution: false
          })
        })
      ]);

      const attemptThreeRetry = await postRetry(projectId, attemptTwoRun.researchRunId, {
        researchRunId: attemptTwoRun.researchRunId,
        retryReason: "Retry the failed second attempt.",
        contextHash: "ctx_research_run_retry_attempt_three"
      });
      const attemptThreeRetryBody = await jsonBody(attemptThreeRetry);
      const attemptThreeRetryData = attemptThreeRetryBody.data as Readonly<Record<string, unknown>>;
      const attemptThreeRetryResult = attemptThreeRetryData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(attemptThreeRetry.status).toBe(200);
      expect(attemptThreeRetryResult).toMatchObject({
        action: "retry",
        status: "retry_started",
        researchRun: {
          retryOfRunId: attemptTwoRun.researchRunId,
          status: "running",
          provider: {
            attempt: 3
          }
        }
      });

      const savedBudgetBlockedPriorRun = await repository.create({
        run: {
          ...failedSourceRun,
          version: 1 as ProjectionVersion,
          researchRunId: "research_run_retry_budget_blocked" as ResearchRunProjection["researchRunId"],
          researchTaskId: "research_task_retry_budget_blocked" as ResearchRunProjection["researchTaskId"],
          provider: {
            ...failedSourceRun.provider,
            researchRunId: "research_run_retry_budget_blocked" as ResearchRunProjection["researchRunId"],
            researchTaskId: "research_task_retry_budget_blocked" as ResearchRunProjection["researchTaskId"],
            providerRunId: "fake_readonly_research_run_retry_budget_blocked",
            idempotencyKey:
              "research-run:v1:objective=Budget+blocked:connector=public_search:context=ctx_retry_budget_blocked:allowlistVersion=1:attempt=1",
            startedAt: "2026-05-06T00:30:00.000Z",
            completedAt: "2026-05-06T00:31:00.000Z",
            attempt: 1
          },
          createdAt: "2026-05-06T00:30:00.000Z",
          updatedAt: "2026-05-06T00:31:00.000Z"
        } satisfies ResearchRunProjection,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      expect(savedBudgetBlockedPriorRun).not.toBeNull();

      const budgetBlockedRetry = await postRetry(projectId, "research_run_retry_budget_blocked", {
        researchRunId: "research_run_retry_budget_blocked",
        retryReason: "Retry should respect the active retry budget.",
        contextHash: "ctx_retry_budget_blocked"
      });
      const budgetBlockedRetryBody = await jsonBody(budgetBlockedRetry);

      expect(budgetBlockedRetry.status).toBe(200);
      expect(budgetBlockedRetryBody.data).toMatchObject({
        category: "blocked",
        immediateProjection: {
          action: "retry",
          status: "blocked_precondition",
          researchRun: {
            researchRunId: "research_run_retry_budget_blocked",
            status: "failed"
          },
          blocker: {
            code: "rate_budget_exhausted"
          }
        }
      });

      const rowsAfterBudgetBlock = await storage.client.execute(
        "SELECT id FROM research_runs WHERE retry_of_run_id = 'research_run_retry_budget_blocked'"
      );

      expect(rowsAfterBudgetBlock.rows).toHaveLength(0);
    } finally {
      await storage.close();
    }
  });

  it("blocks research run start when allowlist state or public-safe preconditions are not satisfied", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    async function postStart(projectId: string, body: Readonly<Record<string, unknown>>) {
      return storageApp.request(`/api/v1/projects/${projectId}/research-runs`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          researchTaskId: "research_task_blocked",
          connectorId: "public_search",
          sourceCategory: "public_web",
          researchObjective: "Find public evidence.",
          contextHash: "ctx_blocked_run",
          ...body
        })
      });
    }

    try {
      const { projectId } = await createProjectForTest(storageApp, "A research run blocker route test idea");
      const missing = await postStart(projectId, {});
      const missingBody = await jsonBody(missing);

      expect(missing.status).toBe(200);
      expect(missingBody.data).toMatchObject({
        category: "blocked",
        immediateProjection: {
          status: "blocked_manual_handoff",
          blocker: {
            code: "allowlist_or_context_blocked"
          }
        }
      });

      await createAllowlistForTest(storageApp, projectId, "research_allowlist_paused_run");
      const pause = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists/research_allowlist_paused_run/pause`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          reason: "Pause before automatic run start."
        })
      });
      const pauseBody = await jsonBody(pause);

      expect(pause.status).toBe(200);
      expect(pauseBody.data).toBeTruthy();

      const paused = await postStart(projectId, { allowlistId: "research_allowlist_paused_run" });
      const pausedBody = await jsonBody(paused);

      expect(paused.status).toBe(200);
      expect(pausedBody.data).toMatchObject({
        category: "blocked",
        immediateProjection: {
          status: "blocked_manual_handoff",
          manualHandoff: {
            route: "task_level_approval_or_manual_handoff"
          }
        }
      });

      await createAllowlistForTest(storageApp, projectId, "research_allowlist_stale_run");
      const malformedFreshness = await postStart(projectId, {
        allowlistId: "research_allowlist_stale_run",
        taskFreshnessDeadline: "not-a-date"
      });
      const malformedFreshnessBody = await jsonBody(malformedFreshness);

      expect(malformedFreshness.status).toBe(400);
      expect(malformedFreshnessBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "taskFreshnessDeadline must be an ISO timestamp."
      });

      const malformedSourceTimestamp = await postStart(projectId, {
        allowlistId: "research_allowlist_stale_run",
        sourcePublishedAt: "not-a-date"
      });
      const malformedSourceTimestampBody = await jsonBody(malformedSourceTimestamp);

      expect(malformedSourceTimestamp.status).toBe(400);
      expect(malformedSourceTimestampBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "sourcePublishedAt must be an ISO timestamp."
      });

      const stale = await postStart(projectId, {
        allowlistId: "research_allowlist_stale_run",
        taskFreshnessDeadline: "2026-05-05T00:00:00.000Z"
      });
      const staleBody = await jsonBody(stale);

      expect(stale.status).toBe(200);
      expect(staleBody.data).toMatchObject({
        category: "blocked",
        immediateProjection: {
          status: "blocked_precondition",
          blocker: {
            code: "staleness_policy_failed"
          }
        }
      });

      const rows = await storage.client.execute("SELECT * FROM research_runs");

      expect(rows.rows).toHaveLength(0);
    } finally {
      await storage.close();
    }
  });

  it("rejects secret-like disclosure connector ids before they can be stored in the disclosure log", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A disclosure connector secret guard test idea",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed",
          businessCriticIntensity: "balanced",
          businessCriticIntensityConfirmation: "user_confirmed"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const projectId = sessionProjection.projectId as string;
      const rejected = await storageApp.request(`/api/v1/projects/${projectId}/research-disclosures`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          connectorId: "sk-secret-token-value",
          sourceCategory: "public_web",
          researchObjective: "Find public onboarding evidence."
        })
      });
      const rejectedBody = await jsonBody(rejected);

      expect(rejected.status).toBe(400);
      expect(rejectedBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "connectorIds must not contain secret-like values."
      });

      const rows = await storage.client.execute("SELECT connector_id FROM research_disclosure_logs");

      expect(rows.rows).toHaveLength(0);
      expect(JSON.stringify(rows.rows)).not.toContain("sk-secret-token-value");
    } finally {
      await storage.close();
    }
  });

  it("queries and exports Phase 1.5B upgrade hints as sanitized no-execution metadata", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { projectId, sessionId } = await createProjectForTest(
        storageApp,
        "A Phase 1.5B hint query/export route test idea"
      );
      const artifactId = "runtime_artifact_hint_export" as RuntimeArtifactId;
      const hintFixture = phase15bHintsFixture();

      await createPhase15bUpgradeHintRepository(storage.db).saveForArtifact({
        projectId: projectId as ProjectId,
        sessionId: sessionId as SessionId,
        artifactId,
        artifactKind: "BlockedActionArtifact",
        hints: phase15bHintsFixture({
          executionIntent: {
            ...hintFixture.executionIntent,
            targetSurface: "https://example.invalid/private-source?token=secret-token-value",
            nonExecutingSummary: "Private customer Alpha raw idea payload"
          },
          expectedEvidence: {
            ...hintFixture.expectedEvidence,
            manualInspection: ["Customer Jane internal roadmap"],
            expectedLogs: ["Bearer abcdefghijklmnop"]
          },
          sourceRefs: [
            ...hintFixture.sourceRefs,
            {
              kind: "spec_section",
              refId: "https://example.invalid/spec?token=secret-token-value",
              label: "Private source URL"
            },
            {
              kind: "spec_section",
              refId: "spec_section_private_customer_alpha_raw_idea",
              label: "Private source id"
            }
          ]
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      const query = await storageApp.request(`/api/v1/projects/${projectId}/phase15b-upgrade-hints`, {
        headers: authHeaders()
      });
      const queryBody = await jsonBody(query);
      const queryJson = JSON.stringify(queryBody);
      const queryData = queryBody.data as {
        readonly records: readonly [
          {
            readonly hints: {
              readonly sourceRefs: readonly Readonly<Record<string, unknown>>[];
            };
          }
        ];
      };

      expect(query.status).toBe(200);
      expect(queryBody.data).toMatchObject({
        kind: "Phase15bUpgradeHintProjection",
        projectionKind: "Phase15bUpgradeHintProjection",
        projectId,
        metadataLabel: "readiness_preview_handoff_metadata",
        privatePayloadPolicy: "public_safe_metadata_only",
        noExecution: {
          semantic: "metadata_only_no_execution",
          productActionPerformed: false,
          delegationState: "not_active",
          credentialValueState: "omitted"
        },
        refetchUrl: `/api/v1/projects/${projectId}/phase15b-upgrade-hints`,
        exportUrl: `/api/v1/projects/${projectId}/phase15b-upgrade-hints/export`,
        records: [
          expect.objectContaining({
            artifactId,
            artifactKind: "BlockedActionArtifact",
            metadataLabel: "readiness_preview_handoff_metadata",
            sourceRefLabelPolicy: "labels_omitted_to_avoid_private_payload_export",
            hints: expect.objectContaining({
              approvalRequirements: [
                expect.objectContaining({
                  approvalType: "task_level_execution"
                })
              ],
              sandboxRequirements: expect.objectContaining({
                commandAllowlist: ["pnpm verify"]
              }),
              rollbackReference: expect.objectContaining({
                baseRef: "main"
              }),
              expectedEvidence: expect.objectContaining({
                tests: ["pnpm verify"]
              }),
              sourceRefs: expect.arrayContaining([
                expect.objectContaining({ kind: "preview_artifact", refId: "runtime_artifact_hint_export" }),
                expect.objectContaining({ kind: "blocked_action", refId: "runtime_artifact_hint_export:shell_command" }),
                expect.objectContaining({ kind: "research_run", refId: "research_run_hint_export" }),
                expect.objectContaining({ kind: "evidence_matrix", refId: "evidence_matrix_hint_export" }),
                expect.objectContaining({ kind: "research_allowlist", refId: "research_allowlist_hint_export" }),
                expect.objectContaining({ kind: "research_disclosure_log", refId: "research_disclosure_hint_export" }),
                expect.objectContaining({ kind: "audit_log", refId: "audit_log_hint_export" })
              ])
            })
          })
        ]
      });
      expect(queryData.records[0].hints.sourceRefs.every((sourceRef) => !("label" in sourceRef))).toBe(true);
      expect(queryData.records[0].hints.sourceRefs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "spec_section",
            refId: expect.stringMatching(/^redacted_ref:spec_section:/)
          })
        ])
      );
      expect(queryJson).not.toContain("Private customer Alpha");
      expect(queryJson).not.toContain("Customer Jane internal roadmap");
      expect(queryJson).not.toContain("spec_section_private_customer_alpha_raw_idea");
      expect(queryJson).not.toContain("token=secret-token-value");
      expect(queryJson).not.toContain("Bearer abcdefghijklmnop");

      const exported = await storageApp.request(`/api/v1/projects/${projectId}/phase15b-upgrade-hints/export`, {
        headers: authHeaders()
      });
      const exportedBody = await jsonBody(exported);
      const exportedJson = JSON.stringify(exportedBody);
      const exportedData = exportedBody.data as {
        readonly records: readonly [
          {
            readonly hints: {
              readonly sourceRefs: readonly Readonly<Record<string, unknown>>[];
            };
          }
        ];
      };

      expect(exported.status).toBe(200);
      expect(exportedBody.data).toMatchObject({
        kind: "Phase15bUpgradeHintExport",
        format: "json",
        exportPolicy: {
          privatePayloadsIncluded: false,
          credentialValuesIncluded: false,
          sourceRefLabelsIncluded: false,
          reason: "phase15b_exports_are_public_safe_readiness_metadata_only"
        },
        records: [
          expect.objectContaining({
            hints: expect.objectContaining({
              expectedEvidence: expect.objectContaining({
                smokeChecks: ["GET /phase15b-upgrade-hints/export"]
              })
            })
          })
        ]
      });
      expect(exportedData.records[0].hints.sourceRefs.every((sourceRef) => !("label" in sourceRef))).toBe(true);
      expect(exportedJson).not.toContain("Private customer Alpha");
      expect(exportedJson).not.toContain("Customer Jane internal roadmap");
      expect(exportedJson).not.toContain("spec_section_private_customer_alpha_raw_idea");
      expect(exportedJson).not.toContain("token=secret-token-value");
      expect(exportedJson).not.toContain("Bearer abcdefghijklmnop");
    } finally {
      await storage.close();
    }
  });

  it("mounts Planning Handoff POST/GET routes for blocker and final projections", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { projectId, sessionId } = await createProjectForTest(
        storageApp,
        "A Planning Handoff API final route test idea"
      );
      const empty = await storageApp.request(`/api/v1/sessions/${sessionId}/planning-handoff`, {
        headers: authHeaders()
      });
      const emptyBody = await jsonBody(empty);

      expect(empty.status).toBe(200);
      expect(emptyBody.data).toBeNull();

      await seedPlanningReadyState(storage, projectId, sessionId);

      const create = await storageApp.request(`/api/v1/sessions/${sessionId}/planning-handoff`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 3,
          sourceRefs: planningReadySourceRefs(sessionId)
        })
      });
      const createBody = await jsonBody(create);
      const createData = createBody.data as Readonly<Record<string, unknown>>;

      expect(create.status).toBe(200);
      expect(createData).toMatchObject({
        category: "accepted_with_projection",
        stateVersionBefore: 3,
        stateVersionAfter: 4,
        effectTaskIds: [],
        immediateProjection: {
          kind: "PlanningHandoffProjection",
          currentStatus: "planning_ready",
          finalArtifact: {
            kind: "PlanningHandoffArtifact",
            status: "planning_ready",
            noExecutionPolicy: "no_file_shell_browser_deploy_or_external_mutation"
          },
          refetchUrl: `/api/v1/sessions/${sessionId}/planning-handoff`
        }
      });
      expect(createData.statusUrl).toBeUndefined();

      const fetched = await storageApp.request(`/api/v1/sessions/${sessionId}/planning-handoff`, {
        headers: authHeaders()
      });
      const fetchedBody = await jsonBody(fetched);

      expect(fetched.status).toBe(200);
      expect(fetchedBody.data).toMatchObject({
        kind: "PlanningHandoffProjection",
        currentStatus: "planning_ready",
        finalArtifact: {
          kind: "PlanningHandoffArtifact"
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("keeps Planning Handoff blocker, missing session, malformed body, and stale version outcomes explicit", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { sessionId } = await createProjectForTest(
        storageApp,
        "A Planning Handoff API blocker route test idea"
      );
      const sourceRefs = planningHandoffSourceRefsFixture("missing_api");

      const blocker = await storageApp.request(`/api/v1/sessions/${sessionId}/planning-handoff`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          scaffoldOnly: true,
          sessionId,
          expectedStateVersion: 1,
          sourceRefs
        })
      });
      const blockerBody = await jsonBody(blocker);
      const blockerData = blockerBody.data as Readonly<Record<string, unknown>>;

      expect(blocker.status).toBe(200);
      expect(blockerData).toMatchObject({
        category: "accepted_with_projection",
        stateVersionBefore: 1,
        stateVersionAfter: 2,
        effectTaskIds: [],
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
      expect(blockerData.statusUrl).toBeUndefined();

      const fetchedBlocker = await storageApp.request(`/api/v1/sessions/${sessionId}/planning-handoff`, {
        headers: authHeaders()
      });
      const fetchedBlockerBody = await jsonBody(fetchedBlocker);

      expect(fetchedBlockerBody.data).toMatchObject({
        currentStatus: "source_trace_incomplete",
        blockerArtifact: {
          noFinalLabelRule: "must_not_use_planning_ready_label"
        }
      });

      const eventCountBeforeValidationFailures = (await createEventRepository(storage.db).listForSession(sessionId as SessionId)).length;

      const missingSession = await storageApp.request("/api/v1/sessions/sess_missing/planning-handoff", {
        headers: authHeaders()
      });
      const missingSessionBody = await jsonBody(missingSession);

      expect(missingSession.status).toBe(404);
      expect(missingSessionBody.error).toMatchObject({
        code: "RESOURCE_NOT_FOUND"
      });

      const malformedBody = await storageApp.request(`/api/v1/sessions/${sessionId}/planning-handoff`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId: "different_session",
          expectedStateVersion: 2,
          sourceRefs
        })
      });
      const malformedBodyJson = await jsonBody(malformedBody);

      expect(malformedBody.status).toBe(400);
      expect(malformedBodyJson.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "sessionId must match the route param."
      });

      const emptySourceRefs = await storageApp.request(`/api/v1/sessions/${sessionId}/planning-handoff`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 2,
          sourceRefs: []
        })
      });
      const emptySourceRefsBody = await jsonBody(emptySourceRefs);

      expect(emptySourceRefs.status).toBe(400);
      expect(emptySourceRefsBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "sourceRefs must include at least one Planning Handoff source ref."
      });

      const invalidRequestedScope = await storageApp.request(`/api/v1/sessions/${sessionId}/planning-handoff`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 2,
          sourceRefs,
          requestedScope: {
            productSlice: "Planning Handoff invalid scope",
            userFacingJourneyLabel: "Not Planning-ready",
            nonGoals: ["Do not execute anything."],
            excludedInternalPhases: ["phase3_controlled_execution"],
            assumptions: ["Invalid label should reject before persistence."]
          }
        })
      });
      const invalidRequestedScopeBody = await jsonBody(invalidRequestedScope);

      expect(invalidRequestedScope.status).toBe(200);
      expect(invalidRequestedScopeBody.data).toMatchObject({
        category: "rejected",
        error: {
          code: "VALIDATION_FAILED"
        }
      });
      expect(await createEventRepository(storage.db).listForSession(sessionId as SessionId)).toHaveLength(
        eventCountBeforeValidationFailures
      );

      const stale = await storageApp.request(`/api/v1/sessions/${sessionId}/planning-handoff`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 1,
          sourceRefs
        })
      });
      const staleBody = await jsonBody(stale);

      expect(stale.status).toBe(200);
      expect(staleBody.data).toMatchObject({
        category: "rejected",
        error: {
          code: "STATE_VERSION_CONFLICT"
        }
      });
      expect(await createEventRepository(storage.db).listForSession(sessionId as SessionId)).toHaveLength(
        eventCountBeforeValidationFailures
      );

      const fetchedAfterStale = await storageApp.request(`/api/v1/sessions/${sessionId}/planning-handoff`, {
        headers: authHeaders()
      });
      const fetchedAfterStaleBody = await jsonBody(fetchedAfterStale);

      expect(fetchedAfterStale.status).toBe(200);
      expect(fetchedAfterStaleBody.data).toEqual(fetchedBlockerBody.data);
    } finally {
      await storage.close();
    }
  });

  it("rejects Planning Handoff unsupported and execution-intent keys before command construction", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { sessionId } = await createProjectForTest(
        storageApp,
        "A Planning Handoff strict request validation test idea"
      );
      const sourceRefs = planningHandoffSourceRefsFixture("strict_validation");
      const eventCountBeforeStrictValidation = (await createEventRepository(storage.db).listForSession(sessionId as SessionId)).length;
      const postPlanningHandoff = (body: Readonly<Record<string, unknown>>) =>
        storageApp.request(`/api/v1/sessions/${sessionId}/planning-handoff`, {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });

      const invalidScaffoldOnly = await postPlanningHandoff({
        scaffoldOnly: false,
        sessionId,
        expectedStateVersion: 1,
        sourceRefs
      });
      const invalidScaffoldOnlyBody = await jsonBody(invalidScaffoldOnly);

      expect(invalidScaffoldOnly.status).toBe(400);
      expect(invalidScaffoldOnlyBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "scaffoldOnly must be true when provided."
      });

      const unsupportedTopLevelKey = await postPlanningHandoff({
        sessionId,
        expectedStateVersion: 1,
        sourceRefs,
        debugMode: true
      });
      const unsupportedTopLevelKeyBody = await jsonBody(unsupportedTopLevelKey);

      expect(unsupportedTopLevelKey.status).toBe(400);
      expect(unsupportedTopLevelKeyBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: 'Planning Handoff request body includes unsupported key "debugMode".'
      });

      const unsupportedExecutionIntentKey = await postPlanningHandoff({
        sessionId,
        expectedStateVersion: 1,
        sourceRefs: [
          {
            ...sourceRefs[0],
            shellCommand: "pnpm verify"
          },
          ...sourceRefs.slice(1)
        ]
      });
      const unsupportedExecutionIntentKeyBody = await jsonBody(unsupportedExecutionIntentKey);

      expect(unsupportedExecutionIntentKey.status).toBe(400);
      expect(unsupportedExecutionIntentKeyBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: 'sourceRefs[0] includes unsupported execution-intent key "shellCommand".'
      });
      expect(await createEventRepository(storage.db).listForSession(sessionId as SessionId)).toHaveLength(
        eventCountBeforeStrictValidation
      );
    } finally {
      await storage.close();
    }
  });

  it("mounts Execution Authority POST/GET routes on the ProductEngine ledger boundary", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { sessionId } = await createProjectForTest(
        storageApp,
        "An Execution Authority route boundary test idea"
      );
      const empty = await storageApp.request(`/api/v1/sessions/${sessionId}/execution-authority`, {
        headers: authHeaders()
      });
      const emptyBody = await jsonBody(empty);

      expect(empty.status).toBe(200);
      expect(emptyBody.data).toBeNull();

      const { response, body, recordId } = await createExecutionAuthorityForTest(
        storageApp,
        sessionId,
        "route_ready"
      );

      expect(response.status).toBe(200);
      expect(body.data).toMatchObject({
        category: "accepted_with_projection",
        immediateProjection: {
          currentStatus: "ready_for_execution",
          latestRecord: {
            recordId,
            actionClass: "file_diff",
            approvalDecision: "approved",
            executionResult: "not_run"
          },
          refetchUrl: `/api/v1/sessions/${sessionId}/execution-authority`
        }
      });

      const fetched = await storageApp.request(`/api/v1/sessions/${sessionId}/execution-authority`, {
        headers: authHeaders()
      });
      const fetchedBody = await jsonBody(fetched);

      expect(fetched.status).toBe(200);
      expect(fetchedBody.data).toMatchObject({
        latestRecord: {
          recordId,
          approvalDecision: "approved",
          executionResult: "not_run"
        }
      });

      const replay = await storageApp.request(`/api/v1/sessions/${sessionId}/execution-authority`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(executionAuthorityRequestFixture(sessionId, "route_ready"))
      });
      const replayBody = await jsonBody(replay);

      expect(replay.status).toBe(200);
      expect(replayBody.data).toMatchObject({
        category: "rejected",
        error: {
          code: "STATE_VERSION_CONFLICT"
        }
      });
      expect(await createEventRepository(storage.db).listForSession(sessionId as SessionId)).toHaveLength(2);
    } finally {
      await storage.close();
    }
  });

  it("keeps Execution Authority route validation fail-closed before command construction", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { sessionId } = await createProjectForTest(
        storageApp,
        "An Execution Authority route validation test idea"
      );
      const eventCountBeforeValidationFailures = (await createEventRepository(storage.db).listForSession(sessionId as SessionId)).length;
      const postExecutionAuthority = (body: Readonly<Record<string, unknown>>) =>
        storageApp.request(`/api/v1/sessions/${sessionId}/execution-authority`, {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });

      const missingIdempotencyKey = await postExecutionAuthority({
        ...executionAuthorityRequestFixture(sessionId, "missing_idempotency"),
        idempotencyKey: ""
      });
      const missingIdempotencyKeyBody = await jsonBody(missingIdempotencyKey);

      expect(missingIdempotencyKey.status).toBe(400);
      expect(missingIdempotencyKeyBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "idempotencyKey must be a non-empty string."
      });

      const unsupportedTopLevelKey = await postExecutionAuthority({
        ...executionAuthorityRequestFixture(sessionId, "unsupported_key"),
        adapterCommand: "pnpm verify"
      });
      const unsupportedTopLevelKeyBody = await jsonBody(unsupportedTopLevelKey);

      expect(unsupportedTopLevelKey.status).toBe(400);
      expect(unsupportedTopLevelKeyBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: 'Execution Authority request body includes unsupported key "adapterCommand".'
      });

      const unsupportedBoundedOutputFixture = executionAuthorityRequestFixture(
        sessionId,
        "unsupported_bounded_output_key"
      );
      const unsupportedBoundedOutputKey = await postExecutionAuthority({
        ...unsupportedBoundedOutputFixture,
        boundedAgentOutput: {
          ...unsupportedBoundedOutputFixture.boundedAgentOutput,
          shellCommand: "pnpm verify"
        }
      });
      const unsupportedBoundedOutputKeyBody = await jsonBody(unsupportedBoundedOutputKey);

      expect(unsupportedBoundedOutputKey.status).toBe(400);
      expect(unsupportedBoundedOutputKeyBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: 'boundedAgentOutput includes unsupported key "shellCommand".'
      });

      const invalidBoundedOutputPolicyFixture = executionAuthorityRequestFixture(
        sessionId,
        "invalid_bounded_output_policy"
      );
      const invalidBoundedOutputPolicy = await postExecutionAuthority({
        ...invalidBoundedOutputPolicyFixture,
        boundedAgentOutput: {
          ...invalidBoundedOutputPolicyFixture.boundedAgentOutput,
          noExecutionPolicy: "execute_immediately"
        }
      });
      const invalidBoundedOutputPolicyBody = await jsonBody(invalidBoundedOutputPolicy);

      expect(invalidBoundedOutputPolicy.status).toBe(400);
      expect(invalidBoundedOutputPolicyBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "boundedAgentOutput.noExecutionPolicy must be a Phase 3 no-execution policy."
      });

      const routeMismatch = await storageApp.request("/api/v1/sessions/sess_other/execution-authority", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(executionAuthorityRequestFixture(sessionId, "route_mismatch"))
      });
      const routeMismatchBody = await jsonBody(routeMismatch);

      expect(routeMismatch.status).toBe(400);
      expect(routeMismatchBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "sessionId must match the route param."
      });
      expect(await createEventRepository(storage.db).listForSession(sessionId as SessionId)).toHaveLength(
        eventCountBeforeValidationFailures
      );
    } finally {
      await storage.close();
    }
  });

  it("runs Execution Authority preflight without executing adapters and blocks unsafe attempts", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { sessionId } = await createProjectForTest(
        storageApp,
        "An Execution Authority adapter preflight test idea"
      );
      const { recordId } = await createExecutionAuthorityForTest(storageApp, sessionId, "preflight_ready");
      const postPreflight = (targetRecordId: string, body: Readonly<Record<string, unknown>>) =>
        storageApp.request(`/api/v1/execution-authorities/${targetRecordId}/preflight`, {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });
      const preflightBody = {
        sessionId,
        idempotencyKey: "exec-preflight:ready",
        actionClass: "file_diff",
        previewArtifactHash: "sha256:preflight_ready",
        requestedAt: "2026-05-13T00:01:00.000Z",
        approvalExpiresAt: "2026-05-13T00:05:00.000Z"
      };

      const ready = await postPreflight(recordId, preflightBody);
      const readyBody = await jsonBody(ready);

      expect(ready.status).toBe(200);
      expect(readyBody.data).toMatchObject({
        kind: "ExecutionAuthorityPreflightResult",
        authorityRecordId: recordId,
        status: "ready_for_execution",
        blockReasons: []
      });

      const { recordId: previewOnlyRecordId, body: previewOnlyBody } = await createExecutionAuthorityForTest(
        storageApp,
        sessionId,
        "preflight_preview_only",
        {
          expectedStateVersion: 2,
          actionClass: "external_mutation_preview_only",
          requestedScope: {
            browserTargetRef: "browser_target_external_preview_review"
          },
          sandboxBoundary: {
            mode: "browser_preview_session",
            networkPolicy: "blocked",
            secretPolicy: "no_secret_values"
          },
          rollbackReference: undefined
        }
      );

      expect(previewOnlyBody.data).toMatchObject({
        immediateProjection: {
          currentStatus: "preview_only"
        }
      });

      const previewOnlyPreflight = await postPreflight(previewOnlyRecordId, {
        sessionId,
        idempotencyKey: "exec-preflight:preview-only",
        actionClass: "external_mutation_preview_only",
        previewArtifactHash: "sha256:preflight_preview_only",
        requestedAt: "2026-05-13T00:01:00.000Z",
        approvalExpiresAt: "2026-05-13T00:05:00.000Z"
      });
      const previewOnlyPreflightBody = await jsonBody(previewOnlyPreflight);

      expect(previewOnlyPreflight.status).toBe(200);
      expect(previewOnlyPreflightBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "sandbox_failure"
          })
        ])
      });

      const hashMismatch = await postPreflight(recordId, {
        ...preflightBody,
        idempotencyKey: "exec-preflight:hash-mismatch",
        previewArtifactHash: "sha256:tampered"
      });
      const hashMismatchBody = await jsonBody(hashMismatch);

      expect(hashMismatch.status).toBe(200);
      expect(hashMismatchBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "preview_hash_mismatch"
          })
        ])
      });

      const actionMismatch = await postPreflight(recordId, {
        ...preflightBody,
        idempotencyKey: "exec-preflight:action-mismatch",
        actionClass: "shell_command"
      });
      const actionMismatchBody = await jsonBody(actionMismatch);

      expect(actionMismatch.status).toBe(200);
      expect(actionMismatchBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "sandbox_failure"
          })
        ])
      });

      const expired = await postPreflight(recordId, {
        ...preflightBody,
        idempotencyKey: "exec-preflight:expired",
        requestedAt: "2026-05-13T00:06:00.000Z"
      });
      const expiredBody = await jsonBody(expired);

      expect(expired.status).toBe(200);
      expect(expiredBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "expired_approval"
          })
        ])
      });

      const expiresAtBoundary = await postPreflight(recordId, {
        ...preflightBody,
        idempotencyKey: "exec-preflight:expires-at-boundary",
        requestedAt: "2026-05-13T00:05:00.000Z"
      });
      const expiresAtBoundaryBody = await jsonBody(expiresAtBoundary);

      expect(expiresAtBoundary.status).toBe(200);
      expect(expiresAtBoundaryBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "expired_approval"
          })
        ])
      });

      const missingAuthority = await postPreflight("exec_auth_missing", {
        ...preflightBody,
        idempotencyKey: "exec-preflight:missing-authority"
      });
      const missingAuthorityBody = await jsonBody(missingAuthority);

      expect(missingAuthority.status).toBe(200);
      expect(missingAuthorityBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "missing_source"
          })
        ])
      });

      const malformedPreflight = await postPreflight(recordId, {
        ...preflightBody,
        idempotencyKey: ""
      });
      const malformedPreflightBody = await jsonBody(malformedPreflight);

      expect(malformedPreflight.status).toBe(400);
      expect(malformedPreflightBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "idempotencyKey must be a non-empty string."
      });

      const looseTimestampPreflight = await postPreflight(recordId, {
        ...preflightBody,
        idempotencyKey: "exec-preflight:loose-timestamp",
        requestedAt: "2026-05-13"
      });
      const looseTimestampPreflightBody = await jsonBody(looseTimestampPreflight);

      expect(looseTimestampPreflight.status).toBe(400);
      expect(looseTimestampPreflightBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "requestedAt must be an ISO timestamp."
      });
    } finally {
      await storage.close();
    }
  });

  it("executes file_diff only after exact authority, path, rollback, evidence, and audit checks", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const workspaceRoot = await makeTempAppDataDir();
      await mkdir(join(workspaceRoot, "packages/contracts/src"), { recursive: true });
      await writeFile(join(workspaceRoot, "packages/contracts/src/file-diff-target.ts"), "export const value = 1;\n");

      const { sessionId } = await createProjectForTest(
        storageApp,
        "A file_diff controlled adapter route test idea"
      );
      const diff = fileDiffFixture(
        "packages/contracts/src/file-diff-target.ts",
        "export const value = 1;",
        "export const value = 2;"
      );
      const previewArtifactHash = hashFileDiffPreview(diff);
      const { recordId } = await createExecutionAuthorityForTest(storageApp, sessionId, "file_diff_apply", {
        previewArtifactHash,
        reviewedPreviewArtifactHash: previewArtifactHash,
        requestedScope: {
          workspaceRef: `workspace:${workspaceRoot}`,
          filePathGlobs: ["packages/contracts/src/**"]
        }
      });
      const postFileDiff = (targetRecordId: string, body: Readonly<Record<string, unknown>>) =>
        storageApp.request(`/api/v1/execution-authorities/${targetRecordId}/file-diff`, {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });
      const requestBody = {
        sessionId,
        idempotencyKey: "file-diff:apply",
        previewArtifactHash,
        requestedAt: "2026-05-13T00:01:00.000Z",
        approvalExpiresAt: "2026-05-13T00:05:00.000Z",
        workspaceRoot,
        unifiedDiff: diff
      };

      const applied = await postFileDiff(recordId, requestBody);
      const appliedBody = await jsonBody(applied);

      expect(applied.status).toBe(200);
      expect(appliedBody.data).toMatchObject({
        kind: "FileDiffExecutionResult",
        authorityRecordId: recordId,
        status: "completed",
        changedFiles: [
          {
            path: "packages/contracts/src/file-diff-target.ts",
            additions: 1,
            deletions: 1
          }
        ],
        diffStats: {
          fileCount: 1,
          additions: 1,
          deletions: 1
        },
        rollbackReference: {
          kind: "git_diff_reverse"
        },
        evidenceRefs: expect.arrayContaining([
          expect.stringContaining("file_diff:changed_files:packages/contracts/src/file-diff-target.ts")
        ]),
        auditRefs: expect.arrayContaining(["audit:file_diff:file-diff:apply"])
      });
      await expect(readFile(join(workspaceRoot, "packages/contracts/src/file-diff-target.ts"), "utf8")).resolves.toBe(
        "export const value = 2;\n"
      );

      const fetchedAfterApply = await storageApp.request(`/api/v1/sessions/${sessionId}/execution-authority`, {
        headers: authHeaders()
      });
      const fetchedAfterApplyBody = await jsonBody(fetchedAfterApply);

      expect(fetchedAfterApplyBody.data).toMatchObject({
        latestRecord: {
          recordId,
          executionResult: "completed",
          evidenceRefs: expect.arrayContaining([
            expect.stringContaining("file_diff:changed_files:packages/contracts/src/file-diff-target.ts")
          ]),
          auditRefs: expect.arrayContaining(["audit:file_diff:file-diff:apply"])
        }
      });

      const replayApplied = await postFileDiff(recordId, requestBody);
      const replayAppliedBody = await jsonBody(replayApplied);

      expect(replayApplied.status).toBe(200);
      expect(replayAppliedBody.data).toMatchObject({
        status: "completed",
        blockReasons: []
      });

      const fetchedAfterReplay = await storageApp.request(`/api/v1/sessions/${sessionId}/execution-authority`, {
        headers: authHeaders()
      });
      const fetchedAfterReplayBody = await jsonBody(fetchedAfterReplay);

      expect(fetchedAfterReplayBody.data).toMatchObject({
        latestRecord: {
          recordId,
          executionResult: "completed",
          blockReasons: []
        }
      });

      const tamperedReplay = await postFileDiff(recordId, {
        ...requestBody,
        idempotencyKey: "file-diff:tampered-replay",
        previewArtifactHash: "sha256:tampered"
      });
      const tamperedReplayBody = await jsonBody(tamperedReplay);
      const tamperedReplayData = tamperedReplayBody.data as Readonly<Record<string, unknown>>;

      expect(tamperedReplay.status).toBe(200);
      expect(tamperedReplayData).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "preview_hash_mismatch"
          })
        ])
      });
      expect(tamperedReplayData.auditRefs).not.toContain("audit:file_diff:file-diff:tampered-replay");

      const fetchedAfterTamperedReplay = await storageApp.request(
        `/api/v1/sessions/${sessionId}/execution-authority`,
        {
          headers: authHeaders()
        }
      );
      const fetchedAfterTamperedReplayBody = await jsonBody(fetchedAfterTamperedReplay);

      expect(fetchedAfterTamperedReplayBody.data).toMatchObject({
        latestRecord: {
          recordId,
          executionResult: "completed",
          blockReasons: []
        }
      });

      const mismatchDiff = fileDiffFixture(
        "packages/contracts/src/hash-mismatch.ts",
        "export const value = 1;",
        "export const value = 2;"
      );
      const mismatchHash = hashFileDiffPreview(mismatchDiff);
      const { recordId: mismatchRecordId } = await createExecutionAuthorityForTest(
        storageApp,
        sessionId,
        "file_diff_hash_mismatch",
        {
          expectedStateVersion: 2,
          previewArtifactHash: mismatchHash,
          reviewedPreviewArtifactHash: mismatchHash,
          requestedScope: {
            workspaceRef: `workspace:${workspaceRoot}`,
            filePathGlobs: ["packages/contracts/src/**"]
          }
        }
      );
      const hashMismatch = await postFileDiff(mismatchRecordId, {
        ...requestBody,
        idempotencyKey: "file-diff:hash-mismatch",
        previewArtifactHash: mismatchHash,
        unifiedDiff: diff
      });
      const hashMismatchBody = await jsonBody(hashMismatch);

      expect(hashMismatch.status).toBe(200);
      expect(hashMismatchBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "preview_hash_mismatch"
          })
        ])
      });

      const outsideDiff = fileDiffFixture(
        "packages/secrets.env",
        "SECRET=old",
        "SECRET=new"
      );
      const outsideHash = hashFileDiffPreview(outsideDiff);
      const { recordId: outsideRecordId } = await createExecutionAuthorityForTest(
        storageApp,
        sessionId,
        "file_diff_outside_scope",
        {
          expectedStateVersion: 3,
          previewArtifactHash: outsideHash,
          reviewedPreviewArtifactHash: outsideHash,
          requestedScope: {
            workspaceRef: `workspace:${workspaceRoot}`,
            filePathGlobs: ["packages/contracts/src/**"]
          }
        }
      );
      const outside = await postFileDiff(outsideRecordId, {
        ...requestBody,
        idempotencyKey: "file-diff:outside-scope",
        previewArtifactHash: outsideHash,
        unifiedDiff: outsideDiff
      });
      const outsideBody = await jsonBody(outside);

      expect(outside.status).toBe(200);
      expect(outsideBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "sandbox_failure"
          }),
          expect.objectContaining({
            code: "credential_value_required"
          })
        ])
      });

      const missingRollbackHash = hashFileDiffPreview(diff);
      const { recordId: missingRollbackRecordId } = await createExecutionAuthorityForTest(
        storageApp,
        sessionId,
        "file_diff_missing_rollback",
        {
          expectedStateVersion: 4,
          previewArtifactHash: missingRollbackHash,
          reviewedPreviewArtifactHash: missingRollbackHash,
          requestedScope: {
            workspaceRef: `workspace:${workspaceRoot}`,
            filePathGlobs: ["packages/contracts/src/**"]
          },
          rollbackReference: undefined,
          preconditionChecks: {
            planningSourceExists: true,
            previewArtifactExists: true,
            previewHashMatches: true,
            rollbackAvailable: false,
            credentialValueRequired: false,
            sandboxEnforced: true
          }
        }
      );
      const missingRollback = await postFileDiff(missingRollbackRecordId, {
        ...requestBody,
        idempotencyKey: "file-diff:missing-rollback"
      });
      const missingRollbackBody = await jsonBody(missingRollback);

      expect(missingRollback.status).toBe(200);
      expect(missingRollbackBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "missing_rollback"
          })
        ])
      });

      await writeFile(join(workspaceRoot, "packages/contracts/src/existing-create-target.ts"), "keep me\n");
      const createOverwriteDiff = fileDiffCreateFixture(
        "packages/contracts/src/existing-create-target.ts",
        "overwrite"
      );
      const createOverwriteHash = hashFileDiffPreview(createOverwriteDiff);
      const { recordId: createOverwriteRecordId } = await createExecutionAuthorityForTest(
        storageApp,
        sessionId,
        "file_diff_create_overwrite",
        {
          expectedStateVersion: 5,
          previewArtifactHash: createOverwriteHash,
          reviewedPreviewArtifactHash: createOverwriteHash,
          requestedScope: {
            workspaceRef: `workspace:${workspaceRoot}`,
            filePathGlobs: ["packages/contracts/src/**"]
          }
        }
      );
      const createOverwrite = await postFileDiff(createOverwriteRecordId, {
        ...requestBody,
        idempotencyKey: "file-diff:create-overwrite",
        previewArtifactHash: createOverwriteHash,
        unifiedDiff: createOverwriteDiff
      });
      const createOverwriteBody = await jsonBody(createOverwrite);

      expect(createOverwrite.status).toBe(200);
      expect(createOverwriteBody.data).toMatchObject({
        status: "failed",
        changedFiles: [],
        diffStats: {
          fileCount: 0,
          additions: 0,
          deletions: 0
        },
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "sandbox_failure",
            message: expect.stringContaining("refused to overwrite existing target")
          })
        ])
      });
      await expect(readFile(join(workspaceRoot, "packages/contracts/src/existing-create-target.ts"), "utf8")).resolves.toBe(
        "keep me\n"
      );

      const fetchedAfterCreateOverwrite = await storageApp.request(`/api/v1/sessions/${sessionId}/execution-authority`, {
        headers: authHeaders()
      });
      const fetchedAfterCreateOverwriteBody = await jsonBody(fetchedAfterCreateOverwrite);

      expect(fetchedAfterCreateOverwriteBody.data).toMatchObject({
        latestRecord: {
          recordId: createOverwriteRecordId,
          executionResult: "failed",
          blockReasons: [],
          evidenceRefs: expect.arrayContaining(["file_diff:sandbox_failure"])
        },
        blockedPreconditions: []
      });
    } finally {
      await storage.close();
    }
  });

  it("executes shell_command only for exact allowlisted commands and records safe terminal evidence", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const workspaceRoot = await makeTempAppDataDir();
      await writeFile(
        join(workspaceRoot, "public-output.txt"),
        "token=super-secret-value\nNPM_TOKEN=plain-npm-token-value\nvisible line\n"
      );
      await writeFile(join(workspaceRoot, "token=super-secret-value"), "redaction path fixture\n");
      await writeFile(join(workspaceRoot, "NPM_TOKEN=plain-npm-token-value"), "redaction path fixture\n");
      await writeFile(join(workspaceRoot, "visible-line.txt"), "visible line\n");
      await mkdir(join(workspaceRoot, "nested"));
      await writeFile(join(workspaceRoot, "nested", "cwd-output.txt"), "cwd visible\n");
      execFileSync("git", ["init"], { cwd: workspaceRoot, stdio: "ignore" });

      if (process.platform !== "win32") {
        execFileSync("mkfifo", [join(workspaceRoot, "wait.fifo")]);
      }

      const { sessionId } = await createProjectForTest(
        storageApp,
        "A shell_command controlled adapter route test idea"
      );
      let expectedStateVersion = 1;
      const nextExpectedStateVersion = () => expectedStateVersion++;
      const postShellCommand = (targetRecordId: string, body: Readonly<Record<string, unknown>>) =>
        storageApp.request(`/api/v1/execution-authorities/${targetRecordId}/shell-command`, {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });
      const createShellAuthority = (
        idSuffix: string,
        command: readonly string[],
        expectedStateVersion: number,
        options: {
          readonly authorityOverrides?: Readonly<Record<string, unknown>>;
          readonly workspaceRoot?: string;
          readonly workingDirectory?: string;
        } = {}
      ) => {
        const authorityWorkspaceRoot = options.workspaceRoot ?? workspaceRoot;
        const previewArtifactHash = hashShellCommandPreview({
          command,
          ...(options.workingDirectory ? { workingDirectory: options.workingDirectory } : {})
        });

        return createExecutionAuthorityForTest(storageApp, sessionId, idSuffix, {
          expectedStateVersion,
          actionClass: "shell_command",
          previewArtifactHash,
          reviewedPreviewArtifactHash: previewArtifactHash,
          requestedScope: {
            workspaceRef: `workspace:${authorityWorkspaceRoot}`,
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
            ref: `rollback_${idSuffix}`
          },
          preconditionChecks: {
            planningSourceExists: true,
            previewArtifactExists: true,
            previewHashMatches: true,
            rollbackAvailable: true,
            credentialValueRequired: false,
            sandboxEnforced: true
          },
          ...options.authorityOverrides
        });
      };

      const safeGitStatusCommand = ["git", "status", "--short"] as const;
      const listCommand = safeGitStatusCommand;
      const listHash = hashShellCommandPreview({ command: listCommand });
      const { recordId } = await createShellAuthority("shell_command_git_status", listCommand, nextExpectedStateVersion());
      const requestBody = {
        sessionId,
        idempotencyKey: "shell-command:git-status",
        previewArtifactHash: listHash,
        requestedAt: "2026-05-13T00:01:00.000Z",
        approvalExpiresAt: "2026-05-13T00:05:00.000Z",
        workspaceRoot,
        command: listCommand
      };

      const completed = await postShellCommand(recordId, requestBody);
      const completedBody = await jsonBody(completed);

      expect(completed.status).toBe(200);
      expect(completedBody.data).toMatchObject({
        kind: "ShellCommandExecutionResult",
        authorityRecordId: recordId,
        status: "completed",
        command: {
          executable: "git",
          args: ["status", "--short"],
          commandClass: "diagnostic",
          timeoutMs: 1_000,
          timedOut: false
        },
        exitCode: 0,
        rollbackReference: {
          kind: "command_compensating_action"
        },
        evidenceRefs: expect.arrayContaining([
          expect.stringContaining("shell_command:exit_code:0")
        ]),
        auditRefs: expect.arrayContaining(["audit:shell_command:shell-command:git-status"])
      });

      const replayCompleted = await postShellCommand(recordId, requestBody);
      const replayCompletedBody = await jsonBody(replayCompleted);

      expect(replayCompleted.status).toBe(200);
      expect(replayCompletedBody.data).toMatchObject({
        status: "completed",
        blockReasons: []
      });

      const cwdCommand = safeGitStatusCommand;
      const cwdHash = hashShellCommandPreview({ command: cwdCommand, workingDirectory: "nested" });
      const { recordId: cwdRecordId } = await createShellAuthority(
        "shell_command_cwd",
        cwdCommand,
        nextExpectedStateVersion(),
        { workingDirectory: "nested" }
      );
      const cwdResult = await postShellCommand(cwdRecordId, {
        ...requestBody,
        idempotencyKey: "shell-command:cwd",
        previewArtifactHash: cwdHash,
        command: cwdCommand,
        workingDirectory: "nested"
      });
      const cwdBody = await jsonBody(cwdResult);

      expect(cwdResult.status).toBe(200);
      expect(cwdBody.data).toMatchObject({
        status: "completed",
        command: {
          workingDirectory: "nested"
        },
        stdoutSummary: expect.stringContaining("?? ./")
      });

      const cwdEscapeCommand = safeGitStatusCommand;
      const cwdEscapeHash = hashShellCommandPreview({ command: cwdEscapeCommand, workingDirectory: "../" });
      const { recordId: cwdEscapeRecordId } = await createShellAuthority(
        "shell_command_cwd_escape",
        cwdEscapeCommand,
        nextExpectedStateVersion(),
        { workingDirectory: "../" }
      );
      const cwdEscape = await postShellCommand(cwdEscapeRecordId, {
        ...requestBody,
        idempotencyKey: "shell-command:cwd-escape",
        previewArtifactHash: cwdEscapeHash,
        command: cwdEscapeCommand,
        workingDirectory: "../"
      });
      const cwdEscapeBody = await jsonBody(cwdEscape);

      expect(cwdEscape.status).toBe(200);
      expect(cwdEscapeBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "sandbox_failure",
            message: expect.stringContaining("workingDirectory")
          })
        ])
      });

      const tamperedReplay = await postShellCommand(recordId, {
        ...requestBody,
        idempotencyKey: "shell-command:tampered-replay",
        previewArtifactHash: "sha256:tampered"
      });
      const tamperedReplayBody = await jsonBody(tamperedReplay);

      expect(tamperedReplay.status).toBe(200);
      expect(tamperedReplayBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "preview_hash_mismatch"
          })
        ])
      });

      const redactionCommand = safeGitStatusCommand;
      const redactionHash = hashShellCommandPreview({ command: redactionCommand });
      const { recordId: redactionRecordId } = await createShellAuthority(
        "shell_command_redaction",
        redactionCommand,
        nextExpectedStateVersion()
      );
      const redacted = await postShellCommand(redactionRecordId, {
        ...requestBody,
        idempotencyKey: "shell-command:redaction",
        previewArtifactHash: redactionHash,
        command: redactionCommand
      });
      const redactedBody = await jsonBody(redacted);
      const redactedData = redactedBody.data as Readonly<Record<string, unknown>>;

      expect(redacted.status).toBe(200);
      expect(redactedData).toMatchObject({
        status: "completed",
        stdoutSummary: expect.stringContaining("token=[REDACTED]")
      });
      expect(redactedData.stdoutSummary).toEqual(expect.stringContaining("NPM_TOKEN=[REDACTED]"));
      expect(redactedData.stdoutSummary).toEqual(expect.stringContaining("visible-line.txt"));
      expect(redactedData.stdoutSummary).not.toContain("super-secret-value");
      expect(redactedData.stdoutSummary).not.toContain("plain-npm-token-value");

      const nonRepoWorkspaceRoot = await makeTempAppDataDir();
      const nonzeroCommand = safeGitStatusCommand;
      const nonzeroHash = hashShellCommandPreview({ command: nonzeroCommand });
      const { recordId: nonzeroRecordId } = await createShellAuthority(
        "shell_command_nonzero",
        nonzeroCommand,
        nextExpectedStateVersion(),
        { workspaceRoot: nonRepoWorkspaceRoot }
      );
      const nonzero = await postShellCommand(nonzeroRecordId, {
        ...requestBody,
        idempotencyKey: "shell-command:nonzero",
        previewArtifactHash: nonzeroHash,
        workspaceRoot: nonRepoWorkspaceRoot,
        command: nonzeroCommand
      });
      const nonzeroBody = await jsonBody(nonzero);

      expect(nonzero.status).toBe(200);
      expect(nonzeroBody.data).toMatchObject({
        status: "failed",
        exitCode: expect.any(Number),
        evidenceRefs: expect.arrayContaining([
          expect.stringMatching(/^shell_command:exit_code:/u)
        ])
      });

      const destructiveCommand = ["rm", "-rf", "."] as const;
      const destructiveHash = hashShellCommandPreview({ command: destructiveCommand });
      const { recordId: destructiveRecordId } = await createShellAuthority(
        "shell_command_destructive",
        destructiveCommand,
        nextExpectedStateVersion()
      );
      const destructive = await postShellCommand(destructiveRecordId, {
        ...requestBody,
        idempotencyKey: "shell-command:destructive",
        previewArtifactHash: destructiveHash,
        command: destructiveCommand
      });
      const destructiveBody = await jsonBody(destructive);

      expect(destructive.status).toBe(200);
      expect(destructiveBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "sandbox_failure",
            message: expect.stringContaining("outside the default allowlist")
          })
        ])
      });

      if (process.platform !== "win32") {
        const timeoutCommand = ["cat", "wait.fifo"] as const;
        const timeoutHash = hashShellCommandPreview({ command: timeoutCommand });
        const { recordId: timeoutRecordId } = await createShellAuthority(
          "shell_command_timeout",
          timeoutCommand,
          nextExpectedStateVersion(),
          {
            authorityOverrides: {
              requestedScope: {
                workspaceRef: `workspace:${workspaceRoot}`,
                commandAllowlistRef: "diagnostics:read_only",
                maxDurationMs: 100
              }
            }
          }
        );
        const timeout = await postShellCommand(timeoutRecordId, {
          ...requestBody,
          idempotencyKey: "shell-command:timeout",
          previewArtifactHash: timeoutHash,
          command: timeoutCommand
        });
        const timeoutBody = await jsonBody(timeout);

        expect(timeout.status).toBe(200);
        expect(timeoutBody.data).toMatchObject({
          status: "failed",
          command: {
            timedOut: true
          },
          blockReasons: expect.arrayContaining([
            expect.objectContaining({
              message: expect.stringContaining("timed out")
            })
          ])
        });
      }

      const outsideDir = await makeTempAppDataDir();
      await writeFile(join(outsideDir, "data.txt"), "password=should-not-be-readable\n");
      await symlink(outsideDir, join(workspaceRoot, "outside-link"), process.platform === "win32" ? "junction" : "dir");

      const symlinkEscapeCommand = ["cat", "outside-link/data.txt"] as const;
      const symlinkEscapeHash = hashShellCommandPreview({ command: symlinkEscapeCommand });
      const { recordId: symlinkEscapeRecordId } = await createShellAuthority(
        "shell_command_symlink_escape",
        symlinkEscapeCommand,
        nextExpectedStateVersion()
      );
      const symlinkEscape = await postShellCommand(symlinkEscapeRecordId, {
        ...requestBody,
        idempotencyKey: "shell-command:symlink-escape",
        previewArtifactHash: symlinkEscapeHash,
        command: symlinkEscapeCommand
      });
      const symlinkEscapeBody = await jsonBody(symlinkEscape);

      expect(symlinkEscape.status).toBe(200);
      expect(symlinkEscapeBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "sandbox_failure",
            message: expect.stringContaining("symlink outside the workspace boundary")
          })
        ])
      });

      if (process.platform !== "win32") {
        const safeRgCommand = ["rg", "visible", "public-output.txt"] as const;
        const safeRgHash = hashShellCommandPreview({ command: safeRgCommand });
        const { recordId: safeRgRecordId } = await createShellAuthority(
          "shell_command_rg_file",
          safeRgCommand,
          nextExpectedStateVersion()
        );
        const safeRg = await postShellCommand(safeRgRecordId, {
          ...requestBody,
          idempotencyKey: "shell-command:rg-file",
          previewArtifactHash: safeRgHash,
          command: safeRgCommand
        });
        const safeRgBody = await jsonBody(safeRg);

        expect(safeRg.status).toBe(200);
        expect(safeRgBody.data).toMatchObject({
          status: "completed",
          stdoutSummary: expect.stringContaining("visible line")
        });
      }

      const implicitRgScanCommand = ["rg", "visible"] as const;
      const implicitRgScanHash = hashShellCommandPreview({ command: implicitRgScanCommand });
      const { recordId: implicitRgScanRecordId } = await createShellAuthority(
        "shell_command_rg_implicit_scan",
        implicitRgScanCommand,
        nextExpectedStateVersion()
      );
      const implicitRgScan = await postShellCommand(implicitRgScanRecordId, {
        ...requestBody,
        idempotencyKey: "shell-command:rg-implicit",
        previewArtifactHash: implicitRgScanHash,
        command: implicitRgScanCommand
      });
      const implicitRgScanBody = await jsonBody(implicitRgScan);

      expect(implicitRgScan.status).toBe(200);
      expect(implicitRgScanBody.data).toMatchObject({
        status: "blocked",
        stdoutSummary: "",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "credential_value_required",
            message: expect.stringContaining("implicit workspace scans are blocked")
          })
        ])
      });

      const recursiveRgScanCommand = ["rg", "visible", "."] as const;
      const recursiveRgScanHash = hashShellCommandPreview({ command: recursiveRgScanCommand });
      const { recordId: recursiveRgScanRecordId } = await createShellAuthority(
        "shell_command_rg_recursive_scan",
        recursiveRgScanCommand,
        nextExpectedStateVersion()
      );
      const recursiveRgScan = await postShellCommand(recursiveRgScanRecordId, {
        ...requestBody,
        idempotencyKey: "shell-command:rg-recursive",
        previewArtifactHash: recursiveRgScanHash,
        command: recursiveRgScanCommand
      });
      const recursiveRgScanBody = await jsonBody(recursiveRgScan);

      expect(recursiveRgScan.status).toBe(200);
      expect(recursiveRgScanBody.data).toMatchObject({
        status: "blocked",
        stdoutSummary: "",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "credential_value_required",
            message: expect.stringContaining("recursive directory scans are blocked")
          })
        ])
      });

      const unsafeRgFlagCommand = ["rg", "--pre", "cat", "visible"] as const;
      const unsafeRgFlagHash = hashShellCommandPreview({ command: unsafeRgFlagCommand });
      const { recordId: unsafeRgFlagRecordId } = await createShellAuthority(
        "shell_command_rg_pre",
        unsafeRgFlagCommand,
        nextExpectedStateVersion()
      );
      const unsafeRgFlag = await postShellCommand(unsafeRgFlagRecordId, {
        ...requestBody,
        idempotencyKey: "shell-command:rg-pre",
        previewArtifactHash: unsafeRgFlagHash,
        command: unsafeRgFlagCommand
      });
      const unsafeRgFlagBody = await jsonBody(unsafeRgFlag);

      expect(unsafeRgFlag.status).toBe(200);
      expect(unsafeRgFlagBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "sandbox_failure",
            message: expect.stringContaining("rg option is outside")
          })
        ])
      });

      await writeFile(join(workspaceRoot, ".npmrc"), "//registry.npmjs.org/:_authToken=plain-npm-token-value\n");
      const credentialPathCommand = ["cat", ".npmrc"] as const;
      const credentialPathHash = hashShellCommandPreview({ command: credentialPathCommand });
      const { recordId: credentialPathRecordId } = await createShellAuthority(
        "shell_command_npmrc_path",
        credentialPathCommand,
        nextExpectedStateVersion()
      );
      const credentialPath = await postShellCommand(credentialPathRecordId, {
        ...requestBody,
        idempotencyKey: "shell-command:npmrc-path",
        previewArtifactHash: credentialPathHash,
        command: credentialPathCommand
      });
      const credentialPathBody = await jsonBody(credentialPath);

      expect(credentialPath.status).toBe(200);
      expect(credentialPathBody.data).toMatchObject({
        status: "blocked",
        stdoutSummary: "",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "credential_value_required",
            message: expect.stringContaining("credential/secret/key material")
          })
        ])
      });

      const credentialArgCommand = ["rg", "NPM_TOKEN=plain-secret-value", "public-output.txt"] as const;
      const credentialArgHash = hashShellCommandPreview({ command: credentialArgCommand });
      const { recordId: credentialArgRecordId } = await createShellAuthority(
        "shell_command_secret_arg",
        credentialArgCommand,
        nextExpectedStateVersion()
      );
      const credentialArg = await postShellCommand(credentialArgRecordId, {
        ...requestBody,
        idempotencyKey: "shell-command:secret-arg",
        previewArtifactHash: credentialArgHash,
        command: credentialArgCommand
      });
      const credentialArgBody = await jsonBody(credentialArg);

      expect(credentialArg.status).toBe(200);
      expect(credentialArgBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "credential_value_required",
            message: expect.stringContaining("credential or secret values")
          })
        ])
      });
    } finally {
      await storage.close();
    }
  });

  it("executes browser_action only for exact loopback targets with reset, screenshot, log, evidence, and audit refs", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();
    const localTarget = await createLocalBrowserTargetServer();

    try {
      const { sessionId } = await createProjectForTest(
        storageApp,
        "A browser_action controlled adapter route test idea"
      );
      let expectedStateVersion = 1;
      const nextExpectedStateVersion = () => expectedStateVersion++;
      const safeAction = {
        kind: "navigate_and_capture",
        visibleAction: true,
        credentialMode: "none",
        externalMutation: "blocked"
      } as const satisfies BrowserActionPreviewDto;
      const postBrowserAction = (targetRecordId: string, body: Readonly<Record<string, unknown>>) =>
        storageApp.request(`/api/v1/execution-authorities/${targetRecordId}/browser-action`, {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });
      const createBrowserAuthority = (
        idSuffix: string,
        targetUrl: string,
        action: BrowserActionPreviewDto,
        expectedStateVersion: number,
        authorityOverrides: Readonly<Record<string, unknown>> = {}
      ) => {
        const previewArtifactHash = hashBrowserActionPreview({ targetUrl, action });
        const origin = new URL(targetUrl).origin;

        return createExecutionAuthorityForTest(storageApp, sessionId, idSuffix, {
          expectedStateVersion,
          actionClass: "browser_action",
          previewArtifactHash,
          reviewedPreviewArtifactHash: previewArtifactHash,
          requestedScope: {
            browserTargetRef: `browser_target:${origin}`,
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
          },
          preconditionChecks: {
            planningSourceExists: true,
            previewArtifactExists: true,
            previewHashMatches: true,
            rollbackAvailable: true,
            credentialValueRequired: false,
            sandboxEnforced: true
          },
          ...authorityOverrides
        });
      };

      const localHash = hashBrowserActionPreview({ targetUrl: localTarget.targetUrl, action: safeAction });
      const { recordId } = await createBrowserAuthority(
        "browser_action_local",
        localTarget.targetUrl,
        safeAction,
        nextExpectedStateVersion()
      );
      const requestBody = {
        sessionId,
        idempotencyKey: "browser-action:local",
        previewArtifactHash: localHash,
        requestedAt: "2026-05-13T00:01:00.000Z",
        approvalExpiresAt: "2026-05-13T00:05:00.000Z",
        targetUrl: localTarget.targetUrl,
        action: safeAction
      };

      const completed = await postBrowserAction(recordId, requestBody);
      const completedBody = await jsonBody(completed);

      expect(completed.status).toBe(200);
      expect(completedBody.data).toMatchObject({
        kind: "BrowserActionExecutionResult",
        authorityRecordId: recordId,
        status: "completed",
        target: {
          origin: new URL(localTarget.targetUrl).origin,
          hostname: "127.0.0.1"
        },
        action: safeAction,
        httpStatusCode: 200,
        screenshotRefs: expect.arrayContaining(["browser_action:screenshot:browser-action:local"]),
        logRefs: expect.arrayContaining([expect.stringContaining("browser_action:log:browser-action:local")]),
        rollbackReference: {
          kind: "browser_state_reset"
        },
        evidenceRefs: expect.arrayContaining([
          expect.stringContaining("browser_action:http_status:200"),
          "browser_action:screenshot:browser-action:local"
        ]),
        auditRefs: expect.arrayContaining(["audit:browser_action:browser-action:local"])
      });

      const replayCompleted = await postBrowserAction(recordId, requestBody);
      const replayCompletedBody = await jsonBody(replayCompleted);

      expect(replayCompleted.status).toBe(200);
      expect(replayCompletedBody.data).toMatchObject({
        status: "completed",
        blockReasons: []
      });

      const mismatchedReplay = await postBrowserAction(recordId, {
        ...requestBody,
        idempotencyKey: "browser-action:mismatched-replay",
        targetUrl: `${localTarget.targetUrl}?view=other`
      });
      const mismatchedReplayBody = await jsonBody(mismatchedReplay);

      expect(mismatchedReplay.status).toBe(200);
      expect(mismatchedReplayBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "preview_hash_mismatch",
            message: expect.stringContaining("targetUrl and action")
          })
        ])
      });

      const tamperedReplay = await postBrowserAction(recordId, {
        ...requestBody,
        idempotencyKey: "browser-action:tampered-replay",
        previewArtifactHash: "sha256:tampered"
      });
      const tamperedReplayBody = await jsonBody(tamperedReplay);

      expect(tamperedReplay.status).toBe(200);
      expect(tamperedReplayBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "preview_hash_mismatch"
          })
        ])
      });

      const externalTargetUrl = "https://example.com/preview";
      const { recordId: externalRecordId } = await createBrowserAuthority(
        "browser_action_external",
        externalTargetUrl,
        safeAction,
        nextExpectedStateVersion(),
        {
          requestedScope: {
            browserTargetRef: "browser_target:https://example.com",
            maxDurationMs: 1_000
          }
        }
      );
      const externalTarget = await postBrowserAction(externalRecordId, {
        ...requestBody,
        idempotencyKey: "browser-action:external-target",
        previewArtifactHash: hashBrowserActionPreview({ targetUrl: externalTargetUrl, action: safeAction }),
        targetUrl: externalTargetUrl
      });
      const externalTargetBody = await jsonBody(externalTarget);

      expect(externalTarget.status).toBe(200);
      expect(externalTargetBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "sandbox_failure",
            message: expect.stringContaining("loopback HTTP")
          })
        ])
      });

      const credentialTargetUrl = `${localTarget.targetUrl}?token=plain-secret-value`;
      const { recordId: credentialTargetRecordId } = await createBrowserAuthority(
        "browser_action_credential_target",
        credentialTargetUrl,
        safeAction,
        nextExpectedStateVersion()
      );
      const credentialTarget = await postBrowserAction(credentialTargetRecordId, {
        ...requestBody,
        idempotencyKey: "browser-action:credential-target",
        previewArtifactHash: hashBrowserActionPreview({ targetUrl: credentialTargetUrl, action: safeAction }),
        targetUrl: credentialTargetUrl
      });
      const credentialTargetBody = await jsonBody(credentialTarget);

      expect(credentialTarget.status).toBe(200);
      expect(credentialTargetBody.data).toMatchObject({
        status: "blocked",
        target: null,
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "credential_value_required",
            message: expect.stringContaining("targetUrl")
          })
        ])
      });
      expect(JSON.stringify(credentialTargetBody.data)).not.toContain("plain-secret-value");

      const privateLanTargetUrl = "http://192.168.0.10:3000/preview";
      const { recordId: privateLanRecordId } = await createBrowserAuthority(
        "browser_action_private_lan",
        privateLanTargetUrl,
        safeAction,
        nextExpectedStateVersion(),
        {
          requestedScope: {
            browserTargetRef: "browser_target:http://192.168.0.10:3000",
            maxDurationMs: 1_000
          }
        }
      );
      const privateLanTarget = await postBrowserAction(privateLanRecordId, {
        ...requestBody,
        idempotencyKey: "browser-action:private-lan-target",
        previewArtifactHash: hashBrowserActionPreview({ targetUrl: privateLanTargetUrl, action: safeAction }),
        targetUrl: privateLanTargetUrl
      });
      const privateLanTargetBody = await jsonBody(privateLanTarget);

      expect(privateLanTarget.status).toBe(200);
      expect(privateLanTargetBody.data).toMatchObject({
        status: "blocked",
        target: null,
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "sandbox_failure",
            message: expect.stringContaining("localhost")
          })
        ])
      });

      const missingResetHash = hashBrowserActionPreview({ targetUrl: localTarget.targetUrl, action: safeAction });
      const { recordId: missingResetRecordId } = await createBrowserAuthority(
        "browser_action_missing_reset",
        localTarget.targetUrl,
        safeAction,
        nextExpectedStateVersion(),
        {
          rollbackReference: undefined,
          preconditionChecks: {
            planningSourceExists: true,
            previewArtifactExists: true,
            previewHashMatches: true,
            rollbackAvailable: false,
            credentialValueRequired: false,
            sandboxEnforced: true
          }
        }
      );
      const missingReset = await postBrowserAction(missingResetRecordId, {
        ...requestBody,
        idempotencyKey: "browser-action:missing-reset",
        previewArtifactHash: missingResetHash
      });
      const missingResetBody = await jsonBody(missingReset);

      expect(missingReset.status).toBe(200);
      expect(missingResetBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "missing_rollback"
          })
        ])
      });

      const hiddenAction = {
        ...safeAction,
        visibleAction: false
      } as const;
      const { recordId: hiddenRecordId } = await createBrowserAuthority(
        "browser_action_hidden",
        localTarget.targetUrl,
        hiddenAction,
        nextExpectedStateVersion()
      );
      const hidden = await postBrowserAction(hiddenRecordId, {
        ...requestBody,
        idempotencyKey: "browser-action:hidden",
        previewArtifactHash: hashBrowserActionPreview({ targetUrl: localTarget.targetUrl, action: hiddenAction }),
        action: hiddenAction
      });
      const hiddenBody = await jsonBody(hidden);

      expect(hidden.status).toBe(200);
      expect(hiddenBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "sandbox_failure",
            message: expect.stringContaining("visible action")
          })
        ])
      });

      const credentialAction = {
        ...safeAction,
        credentialMode: "session_custody"
      } as const;
      const { recordId: credentialRecordId } = await createBrowserAuthority(
        "browser_action_credential",
        localTarget.targetUrl,
        credentialAction,
        nextExpectedStateVersion()
      );
      const credential = await postBrowserAction(credentialRecordId, {
        ...requestBody,
        idempotencyKey: "browser-action:credential",
        previewArtifactHash: hashBrowserActionPreview({
          targetUrl: localTarget.targetUrl,
          action: credentialAction
        }),
        action: credentialAction
      });
      const credentialBody = await jsonBody(credential);

      expect(credential.status).toBe(200);
      expect(credentialBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "credential_value_required"
          })
        ])
      });

      const externalMutationAction = {
        ...safeAction,
        externalMutation: "requested"
      } as const;
      const { recordId: externalMutationRecordId } = await createBrowserAuthority(
        "browser_action_external_mutation",
        localTarget.targetUrl,
        externalMutationAction,
        nextExpectedStateVersion()
      );
      const externalMutation = await postBrowserAction(externalMutationRecordId, {
        ...requestBody,
        idempotencyKey: "browser-action:external-mutation",
        previewArtifactHash: hashBrowserActionPreview({
          targetUrl: localTarget.targetUrl,
          action: externalMutationAction
        }),
        action: externalMutationAction
      });
      const externalMutationBody = await jsonBody(externalMutation);

      expect(externalMutation.status).toBe(200);
      expect(externalMutationBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "sandbox_failure",
            message: expect.stringContaining("external-production mutation")
          })
        ])
      });

      const { recordId: expiredRecordId } = await createBrowserAuthority(
        "browser_action_expired",
        localTarget.targetUrl,
        safeAction,
        nextExpectedStateVersion()
      );
      const expired = await postBrowserAction(expiredRecordId, {
        ...requestBody,
        idempotencyKey: "browser-action:expired",
        requestedAt: "2026-05-13T00:06:00.000Z",
        approvalExpiresAt: "2026-05-13T00:05:00.000Z"
      });
      const expiredBody = await jsonBody(expired);

      expect(expired.status).toBe(200);
      expect(expiredBody.data).toMatchObject({
        status: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({
            code: "expired_approval"
          })
        ])
      });
    } finally {
      await localTarget.close();
      await storage.close();
    }
  });

  it("normalizes allowlist governance ownership and source-category failures", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const missingProject = await storageApp.request("/api/v1/projects/proj_missing/research-allowlists", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          connectorIds: ["public_search"],
          sourceCategories: ["public_web"],
          approvedBy: "owner_route_test"
        })
      });
      const missingProjectBody = await jsonBody(missingProject);

      expect(missingProject.status).toBe(404);
      expect(missingProjectBody.error?.code).toBe("RESOURCE_NOT_FOUND");

      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A route failure normalization test idea",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed",
          businessCriticIntensity: "balanced",
          businessCriticIntensityConfirmation: "user_confirmed"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const projectId = sessionProjection.projectId as string;
      const mismatchedProject = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          projectId: "proj_wrong",
          connectorIds: ["public_search"],
          sourceCategories: ["public_web"],
          approvedBy: "owner_route_test"
        })
      });
      const mismatchedProjectBody = await jsonBody(mismatchedProject);

      expect(mismatchedProject.status).toBe(400);
      expect(mismatchedProjectBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "projectId must match the route param."
      });

      const unsupportedSource = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          connectorIds: ["public_search"],
          sourceCategories: ["credentialed_source"],
          approvedBy: "owner_route_test"
        })
      });
      const unsupportedSourceBody = await jsonBody(unsupportedSource);

      expect(unsupportedSource.status).toBe(400);
      expect(unsupportedSourceBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: expect.stringContaining("Unsupported source categories")
      });

      const create = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          allowlistId: "research_allowlist_policy_approval",
          connectorIds: ["public_search"],
          sourceCategories: ["public_web"],
          approvedBy: "owner_route_test"
        })
      });
      const createBody = await jsonBody(create);

      expect(create.status).toBe(200);
      expect(createBody.data).toBeTruthy();

      const duplicateCreate = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          allowlistId: "research_allowlist_policy_approval",
          connectorIds: ["public_search"],
          sourceCategories: ["public_web"],
          approvedBy: "owner_route_test"
        })
      });
      const duplicateCreateBody = await jsonBody(duplicateCreate);

      expect(duplicateCreate.status).toBe(400);
      expect(duplicateCreateBody.error).toMatchObject({
        code: "COMMAND_PRECONDITION_FAILED",
        message: "Research allowlist already exists for this project."
      });

      const invalidLifecycleReason = await storageApp.request(
        `/api/v1/projects/${projectId}/research-allowlists/research_allowlist_policy_approval/pause`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            reason: 123
          })
        }
      );
      const invalidLifecycleReasonBody = await jsonBody(invalidLifecycleReason);

      expect(invalidLifecycleReason.status).toBe(400);
      expect(invalidLifecycleReasonBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "reason must be a non-empty string."
      });

      const mismatchedLifecycleBody = await storageApp.request(
        `/api/v1/projects/${projectId}/research-allowlists/research_allowlist_policy_approval/pause`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            allowlistId: "research_allowlist_wrong"
          })
        }
      );
      const mismatchedLifecycleBodyError = await jsonBody(mismatchedLifecycleBody);

      expect(mismatchedLifecycleBody.status).toBe(400);
      expect(mismatchedLifecycleBodyError.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "allowlistId must match the route param."
      });

      const emptyUpdate = await storageApp.request(
        `/api/v1/projects/${projectId}/research-allowlists/research_allowlist_policy_approval`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        }
      );
      const emptyUpdateBody = await jsonBody(emptyUpdate);

      expect(emptyUpdate.status).toBe(400);
      expect(emptyUpdateBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "UpdateResearchAllowlistRequest must include at least one allowlist update field."
      });

      const approvalOnlyUpdate = await storageApp.request(
        `/api/v1/projects/${projectId}/research-allowlists/research_allowlist_policy_approval`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            approvedBy: "owner_without_policy_change"
          })
        }
      );
      const approvalOnlyUpdateBody = await jsonBody(approvalOnlyUpdate);

      expect(approvalOnlyUpdate.status).toBe(400);
      expect(approvalOnlyUpdateBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "UpdateResearchAllowlistRequest must include at least one allowlist update field."
      });

      const missingUpdateApproval = await storageApp.request(
        `/api/v1/projects/${projectId}/research-allowlists/research_allowlist_policy_approval`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            sourceCategories: ["official_docs"]
          })
        }
      );
      const missingUpdateApprovalBody = await jsonBody(missingUpdateApproval);

      expect(missingUpdateApproval.status).toBe(400);
      expect(missingUpdateApprovalBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "approvedBy is required when updating allowlist policy or activating automatic research."
      });

      const revoke = await storageApp.request(
        `/api/v1/projects/${projectId}/research-allowlists/research_allowlist_policy_approval/revoke`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        }
      );
      const revokeBody = await jsonBody(revoke);

      expect(revoke.status).toBe(200);
      expect(revokeBody.data).toBeTruthy();

      const updateAfterRevoke = await storageApp.request(
        `/api/v1/projects/${projectId}/research-allowlists/research_allowlist_policy_approval`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            sourceCategories: ["official_docs"],
            approvedBy: "owner_after_revoke"
          })
        }
      );
      const updateAfterRevokeBody = await jsonBody(updateAfterRevoke);

      expect(updateAfterRevoke.status).toBe(400);
      expect(updateAfterRevokeBody.error).toMatchObject({
        code: "COMMAND_PRECONDITION_FAILED",
        message: "Revoked research allowlists are immutable."
      });

      const pauseAfterRevoke = await storageApp.request(
        `/api/v1/projects/${projectId}/research-allowlists/research_allowlist_policy_approval/pause`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        }
      );
      const pauseAfterRevokeBody = await jsonBody(pauseAfterRevoke);

      expect(pauseAfterRevoke.status).toBe(400);
      expect(pauseAfterRevokeBody.error).toMatchObject({
        code: "COMMAND_PRECONDITION_FAILED",
        message: "Revoked research allowlists cannot be paused."
      });
    } finally {
      await storage.close();
    }
  });

  it("runs the PR-04 ProductEngine command path through first active question batch", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A focused founder brief generator",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed",
          businessCriticIntensity: "balanced",
          businessCriticIntensityConfirmation: "user_confirmed"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const startResponse = startData as Readonly<Record<string, unknown>>;
      const sessionProjection = startResponse.immediateProjection as Readonly<Record<string, unknown>>;
      const projectId = sessionProjection.projectId as string;
      const sessionId = sessionProjection.sessionId as string;

      expect(start.status).toBe(200);
      expect(startData).toMatchObject({
        category: "accepted_with_projection",
        stateVersionBefore: 0,
        stateVersionAfter: 1
      });
      expect(sessionProjection).toMatchObject({
        kind: "SessionShellProjection",
        phase: "intake"
      });

      const intake = await storageApp.request(`/api/v1/sessions/${sessionId}/intake`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 1,
          answer: "Help solo founders turn a rough idea into a traceable product spec."
        })
      });
      const intakeBody = await jsonBody(intake);
      const intakeData = intakeBody.data as Readonly<Record<string, unknown>>;

      expect(intake.status).toBe(200);
      expect(intakeData).toMatchObject({
        category: "accepted",
        stateVersionAfter: 2
      });

      const intakeStatus = await storageApp.request(`/api/v1/commands/${intakeData.commandId as string}/status`, {
        headers: authHeaders()
      });
      const intakeStatusBody = await jsonBody(intakeStatus);

      expect(intakeStatus.status).toBe(200);
      expect(intakeStatusBody.data).toMatchObject({
        category: "accepted",
        commandStatus: "complete",
        pendingEffectSummary: {
          totalPending: 0
        },
        projectionHints: []
      });

      const draft = await storageApp.request(`/api/v1/sessions/${sessionId}/spec/initial`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 2
        })
      });
      const draftBody = await jsonBody(draft);
      const draftData = draftBody.data as Readonly<Record<string, unknown>>;
      const draftProjection = draftData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(draft.status).toBe(200);
      expect(draftBody.data).toMatchObject({
        category: "accepted_with_projection",
        stateVersionAfter: 3
      });
      expect(draftProjection).toMatchObject({
        kind: "LivingSpecProjection",
        title: "초기 제품 스펙 초안: A focused founder brief generator",
        sections: CANONICAL_INITIAL_SPEC_SECTIONS,
        sectionCount: CANONICAL_INITIAL_SPEC_SECTIONS.length
      });

      const spec = await storageApp.request(`/api/v1/sessions/${sessionId}/spec`, {
        headers: authHeaders()
      });
      const specBody = await jsonBody(spec);

      expect(spec.status).toBe(200);
      expect(specBody.data).toMatchObject({
        title: "초기 제품 스펙 초안: A focused founder brief generator",
        sections: CANONICAL_INITIAL_SPEC_SECTIONS,
        sectionCount: CANONICAL_INITIAL_SPEC_SECTIONS.length
      });

      const specSession = await storageApp.request(`/api/v1/projects/${projectId}/sessions/${sessionId}`, {
        headers: authHeaders()
      });
      const specSessionBody = await jsonBody(specSession);

      expect(specSession.status).toBe(200);
      expect(specSessionBody.data).toMatchObject({
        kind: "SessionShellProjection",
        version: 3,
        phase: "spec"
      });

      const analyze = await storageApp.request(`/api/v1/sessions/${sessionId}/spec/analyze`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 3,
          targetRef: "current_spec",
          generatedQuestionSet: generatedFounderQuestionSet()
        })
      });
      const analyzeBody = await jsonBody(analyze);
      const analyzeData = analyzeBody.data as Readonly<Record<string, unknown>>;

      expect(analyze.status).toBe(200);
      expect(analyzeData).toMatchObject({
        category: "accepted",
        stateVersionAfter: 4,
        deterministicOutputs: [
          expect.objectContaining({
            outputType: "ambiguity_analysis",
            payload: expect.objectContaining({
              issueCount: 16,
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
                })
              ])
            })
          })
        ],
        pendingEffectSummary: {
          totalPending: 1,
          byType: {
            queue_projection_effect: 1
          }
        }
      });

      const activate = await storageApp.request(`/api/v1/sessions/${sessionId}/queue/activate`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 4
        })
      });
      const activateBody = await jsonBody(activate);
      const activateData = activateBody.data as Readonly<Record<string, unknown>>;
      const queueProjection = activateData.queueProjection as Readonly<Record<string, unknown>>;
      const activeItems = queueProjection.active as readonly Readonly<Record<string, unknown>>[];

      expect(activate.status).toBe(200);
      expect(activateData).toMatchObject({
        category: "accepted_with_projection",
        stateVersionAfter: 5,
        pendingEffectSummary: {
          totalPending: 1
        }
      });
      expect(queueProjection).toMatchObject({
        kind: "DecisionQueueProjection",
        progress: {
          generatedQuestionCount: 16,
          openQuestionCount: 16,
          answeredQuestionCount: 0,
          visibleQuestionDebtCount: 1,
          completionPercent: 0
        }
      });
      expect(activeItems).toHaveLength(1);
      expect(activeItems[0]).toMatchObject({
        cardType: "question",
        sectionRef: "Problem",
        topicKey: "problem_pain_intensity",
        severity: "high",
        expectedAnswerType: "text",
        answerOptions: [],
        possibleRoutes: expect.arrayContaining(["question", "research_needed"])
      });

      const validationSession = await storageApp.request(`/api/v1/projects/${projectId}/sessions/${sessionId}`, {
        headers: authHeaders()
      });
      const validationSessionBody = await jsonBody(validationSession);

      expect(validationSession.status).toBe(200);
      expect(validationSessionBody.data).toMatchObject({
        kind: "SessionShellProjection",
        version: 5,
        phase: "validation"
      });

      const wrongProjectSession = await storageApp.request(`/api/v1/projects/proj_wrong/sessions/${sessionId}`, {
        headers: authHeaders()
      });
      const wrongProjectBody = await jsonBody(wrongProjectSession);

      expect(wrongProjectSession.status).toBe(404);
      expect(wrongProjectBody.error?.code).toBe("RESOURCE_NOT_FOUND");

      const queue = await storageApp.request(`/api/v1/sessions/${sessionId}/queue`, {
        headers: authHeaders()
      });
      const queueBody = await jsonBody(queue);

      expect(queue.status).toBe(200);
      expect(queueBody.data).toMatchObject({
        kind: "DecisionQueueProjection",
        active: expect.arrayContaining([
          expect.objectContaining({
            state: "active"
          })
        ])
      });

      const statusUrl = activateData.statusUrl as string;
      const status = await storageApp.request(statusUrl, {
        headers: authHeaders()
      });
      const statusBody = await jsonBody(status);
      const statusData = statusBody.data as Readonly<Record<string, unknown>>;
      const effects = statusData.effects as readonly Readonly<Record<string, unknown>>[];
      const activateEventIds = activateData.eventIds as readonly string[];

      expect(status.status).toBe(200);
      expect(statusData).toMatchObject({
        category: "accepted_with_projection",
        commandStatus: "pending",
        pendingEffectSummary: {
          totalPending: 1
        },
        projectionHints: [
          {
            projectionKind: "DecisionQueueProjection",
            refetchUrl: `/api/v1/sessions/${sessionId}/queue`
          }
        ]
      });
      expect(effects[0]).toMatchObject({
        idempotencyKey: `${activateEventIds[0]}:decision_queue`
      });

      const firstQuestionId = (activeItems[0] as Readonly<Record<string, unknown>>).queueItemId as string;
      const missingQueueItemId = await storageApp.request(`/api/v1/questions/${firstQuestionId}/answers`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 5,
          answer: "This answer is missing the shared contract queueItemId."
        })
      });
      const missingQueueItemIdBody = await jsonBody(missingQueueItemId);

      expect(missingQueueItemId.status).toBe(400);
      expect(missingQueueItemIdBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "queueItemId must be a non-empty string."
      });

      const mismatchedQueueItemId = await storageApp.request(`/api/v1/questions/${firstQuestionId}/answers`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          queueItemId: "queue_wrong",
          expectedStateVersion: 5,
          answer: "This answer must not bind to a different route question."
        })
      });
      const mismatchedQueueItemIdBody = await jsonBody(mismatchedQueueItemId);

      expect(mismatchedQueueItemId.status).toBe(400);
      expect(mismatchedQueueItemIdBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "queueItemId must match the question route param."
      });

      const invalidAnswer = await storageApp.request(`/api/v1/questions/${firstQuestionId}/answers`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          queueItemId: firstQuestionId,
          expectedStateVersion: 5,
          answer: {
            kind: "single_choice"
          }
        })
      });
      const invalidAnswerBody = await jsonBody(invalidAnswer);

      expect(invalidAnswer.status).toBe(400);
      expect(invalidAnswerBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "answer must be a non-empty string."
      });

      const answer = await storageApp.request(`/api/v1/questions/${firstQuestionId}/answers`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          queueItemId: firstQuestionId,
          expectedStateVersion: 5,
          answer: "Paid solo founders need sharper evidence before building the MVP."
        })
      });
      const answerBody = await jsonBody(answer);
      const answerData = answerBody.data as Readonly<Record<string, unknown>>;
      const answeredQueue = answerData.queueProjection as Readonly<Record<string, unknown>>;

      expect(answer.status).toBe(200);
      expect(answerData).toMatchObject({
        category: "accepted_with_projection",
        stateVersionAfter: 7,
        pendingEffectSummary: {
          totalPending: 1,
          byType: {
            research_evidence_effect: 1
          }
        }
      });
      expect(answerData.statusUrl).toEqual(expect.any(String));
      expect(answeredQueue).toMatchObject({
        kind: "DecisionQueueProjection",
        progress: {
          generatedQuestionCount: 17,
          openQuestionCount: 16,
          answeredQuestionCount: 1,
          followUpQuestionCount: 1,
          completionPercent: 6
        },
        active: expect.arrayContaining([
          expect.objectContaining({
            state: "active"
          })
        ]),
        next: expect.arrayContaining([
          expect.objectContaining({
            state: "next"
          })
        ])
      });
      expect(((answeredQueue.active ?? []) as readonly Readonly<Record<string, unknown>>[]).map((item) => item.queueItemId)).not.toContain(
        firstQuestionId
      );

      const research = await storageApp.request(`/api/v1/sessions/${sessionId}/research`, {
        headers: authHeaders()
      });
      const researchBody = await jsonBody(research);
      const researchData = researchBody.data as Readonly<Record<string, unknown>>;
      const researchTasks = researchData.tasks as readonly Readonly<Record<string, unknown>>[];
      const researchTaskId = researchTasks[0]?.researchTaskId as string;

      expect(research.status).toBe(200);
      expect(researchData).toMatchObject({
        kind: "ResearchEvidenceProjection",
        proConBalanceStatus: "unknown",
        tasks: [
          expect.objectContaining({
            sourceQueueItemId: firstQuestionId,
            status: "planned"
          })
        ],
        reviewCards: [
          expect.objectContaining({
            state: "pending_manual_result"
          })
        ]
      });

      const answerStatus = await storageApp.request(answerData.statusUrl as string, {
        headers: authHeaders()
      });
      const answerStatusBody = await jsonBody(answerStatus);

      expect(answerStatus.status).toBe(200);
      expect(answerStatusBody.data).toMatchObject({
        commandStatus: "pending",
        projectionHints: [
          {
            projectionKind: "ResearchEvidenceProjection",
            refetchUrl: `/api/v1/sessions/${sessionId}/research`
          }
        ],
        effects: [
          expect.objectContaining({
            effectType: "research_evidence_effect",
            maxAttempts: 2,
            idempotencyKey: `research:${researchTaskId}`
          })
        ]
      });

      const answerCompleteness = await storageApp.request(`/api/v1/sessions/${sessionId}/completeness`, {
        headers: authHeaders()
      });
      const answerCompletenessBody = await jsonBody(answerCompleteness);

      expect(answerCompleteness.status).toBe(200);
      expect(answerCompletenessBody.data).toMatchObject({
        kind: "ConfidenceCompletionProjection",
        version: 7,
        completionCandidate: {
          status: "not_ready"
        },
        gates: expect.arrayContaining([
          expect.objectContaining({
            gateId: "question_debt",
            passed: false
          })
        ])
      });

      const refetchedQueue = await storageApp.request(`/api/v1/sessions/${sessionId}/queue`, {
        headers: authHeaders()
      });
      const refetchedQueueBody = await jsonBody(refetchedQueue);
      const refetchedQueueData = refetchedQueueBody.data as Readonly<Record<string, unknown>>;

      expect(refetchedQueue.status).toBe(200);
      expect((refetchedQueueData.active as readonly Readonly<Record<string, unknown>>[]).map((item) => item.queueItemId)).not.toContain(
        firstQuestionId
      );
      expect(refetchedQueueData).toMatchObject({
        active: expect.arrayContaining([
          expect.objectContaining({
            state: "active"
          })
        ])
      });

      const secondQuestionId = ((refetchedQueueData.active as readonly Readonly<Record<string, unknown>>[])[0] as Readonly<Record<string, unknown>>).queueItemId as string;
      const staleAnswer = await storageApp.request(`/api/v1/questions/${secondQuestionId}/answers`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          queueItemId: secondQuestionId,
          expectedStateVersion: 6,
          answer: "This command carries the pre-answer state version."
        })
      });
      const staleAnswerBody = await jsonBody(staleAnswer);

      expect(staleAnswer.status).toBe(200);
      expect(staleAnswerBody.data).toMatchObject({
        category: "rejected",
        error: {
          code: "STATE_VERSION_CONFLICT"
        }
      });

      const duplicateAnswer = await storageApp.request(`/api/v1/questions/${firstQuestionId}/answers`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          queueItemId: firstQuestionId,
          expectedStateVersion: 7,
          answer: "The answered card cannot be submitted a second time."
        })
      });
      const duplicateAnswerBody = await jsonBody(duplicateAnswer);

      expect(duplicateAnswer.status).toBe(200);
      expect(duplicateAnswerBody.data).toMatchObject({
        category: "rejected",
        error: {
          code: "COMMAND_PRECONDITION_FAILED",
          message: "SubmitAnswer requires an active question card."
        }
      });

      const importResult = await storageApp.request(`/api/v1/research-tasks/${researchTaskId}/results`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          researchTaskId,
          expectedStateVersion: 7,
          result: "Pro: founders report urgency and willingness to pay. Risk: replacement workflows may be good enough.",
          limitationNotes: "Manual import includes both support and risk, but source breadth is still limited."
        })
      });
      const importResultBody = await jsonBody(importResult);
      const importResultData = importResultBody.data as Readonly<Record<string, unknown>>;

      expect(importResult.status).toBe(200);
      expect(importResultData).toMatchObject({
        category: "accepted",
        stateVersionAfter: 8,
        pendingEffectSummary: {
          byType: {
            research_evidence_effect: 1
          }
        }
      });
      expect(importResultData.immediateProjection).toBeUndefined();

      const importedStatus = await storageApp.request(importResultData.statusUrl as string, {
        headers: authHeaders()
      });
      const importedStatusBody = await jsonBody(importedStatus);
      const importedStatusData = importedStatusBody.data as Readonly<Record<string, unknown>>;
      const importedEffects = importedStatusData.effects as readonly Readonly<Record<string, unknown>>[];

      expect(importedStatus.status).toBe(200);
      expect(importedStatusData).toMatchObject({
        commandStatus: "pending"
      });
      expect(importedEffects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            effectType: "research_evidence_effect",
            status: "queued",
            maxAttempts: 2
          })
        ])
      );

      const executorResults = await createProductEngineCommandService(storage).runPendingResearchEvidenceEffects();

      expect(executorResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "succeeded",
            balanceStatus: "balanced"
          })
        ])
      );

      const completedResearch = await storageApp.request(`/api/v1/sessions/${sessionId}/research`, {
        headers: authHeaders()
      });
      const completedResearchBody = await jsonBody(completedResearch);

      expect(completedResearch.status).toBe(200);
      expect(completedResearchBody.data).toMatchObject({
        kind: "ResearchEvidenceProjection",
        proConBalanceStatus: "balanced",
        evidenceMatrices: [
          expect.objectContaining({
            balanceStatus: "balanced",
            decisionBlocked: false
          })
        ]
      });

      const completedQueue = await storageApp.request(`/api/v1/sessions/${sessionId}/queue`, {
        headers: authHeaders()
      });
      const completedQueueBody = await jsonBody(completedQueue);

      expect(completedQueue.status).toBe(200);
      expect(completedQueueBody.data).toMatchObject({
        next: expect.arrayContaining([
          expect.objectContaining({
            state: "next"
          })
        ])
      });

      const completedStatus = await storageApp.request(importResultData.statusUrl as string, {
        headers: authHeaders()
      });
      const completedStatusBody = await jsonBody(completedStatus);
      const completedStatusData = completedStatusBody.data as Readonly<Record<string, unknown>>;
      const completedProjectionHints = completedStatusData.projectionHints as readonly Readonly<Record<string, unknown>>[];
      const completedEffects = completedStatusData.effects as readonly Readonly<Record<string, unknown>>[];

      expect(completedStatus.status).toBe(200);
      expect(completedStatusData).toMatchObject({
        commandStatus: "complete"
      });
      expect(completedProjectionHints).toEqual(
        expect.arrayContaining([
          {
            projectionKind: "ResearchEvidenceProjection",
            refetchUrl: `/api/v1/sessions/${sessionId}/research`
          }
        ])
      );
      expect(importedEffects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            effectType: "research_evidence_effect",
            status: "queued"
          })
        ])
      );
      expect(completedEffects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            effectType: "research_evidence_effect",
            status: "succeeded",
            maxAttempts: 2,
            outputRef: expect.objectContaining({
              refType: "effect_output_json"
            })
          })
        ])
      );
    } finally {
      await storage.close();
    }
  });

  it("rejects untraceable or duplicate PlanResearch commands without leaking DB idempotency errors", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A duplicate research task test idea",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed",
          businessCriticIntensity: "balanced",
          businessCriticIntensityConfirmation: "user_confirmed"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const untraceable = await storageApp.request(`/api/v1/sessions/${sessionId}/research-tasks`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 1,
          objective: "This research task is missing a source ref"
        })
      });
      const untraceableBody = await jsonBody(untraceable);

      expect(untraceable.status).toBe(400);
      expect(untraceableBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "sourceQueueItemId is required for PlanResearch traceability."
      });

      const planRequest = {
        expectedStateVersion: 1,
        objective: "Validate paid founder urgency",
        sourceQueueItemId: "queue_traceable_research",
        impact: "high"
      };
      const firstPlan = await storageApp.request(`/api/v1/sessions/${sessionId}/research-tasks`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(planRequest)
      });
      const firstPlanBody = await jsonBody(firstPlan);
      const duplicatePlan = await storageApp.request(`/api/v1/sessions/${sessionId}/research-tasks`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...planRequest,
          expectedStateVersion: 2
        })
      });
      const duplicatePlanBody = await jsonBody(duplicatePlan);

      expect(firstPlan.status).toBe(200);
      expect(firstPlanBody.data).toMatchObject({
        category: "accepted_with_projection",
        stateVersionAfter: 2
      });
      expect(duplicatePlan.status).toBe(200);
      expect(duplicatePlanBody.data).toMatchObject({
        category: "rejected",
        error: {
          code: "IDEMPOTENCY_CONFLICT"
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("starts Codex CLI auth login through the runtime adapter", async () => {
    const startedAt = "2026-05-17T00:00:00.000Z";
    const { app: storageApp, storage } = await createMigratedStorageApp({
      ...fixtureCodexRuntimeAdapter,
      async startLogin() {
        return {
          status: "started",
          command: "codex auth login",
          statusCommand: "codex login status",
          startedAt,
          terminal: "Terminal.app",
          message: "Opened `codex auth login` in a background Terminal window."
        };
      }
    });

    try {
      const response = await storageApp.request("/api/v1/runtime/codex/login/start", {
        method: "POST",
        headers: authHeaders()
      });
      const body = await jsonBody(response);

      expect(response.status).toBe(200);
      expect(body.data).toMatchObject({
        status: "started",
        command: "codex auth login",
        statusCommand: "codex login status",
        terminal: "Terminal.app"
      });
    } finally {
      await storage.close();
    }
  });

  it("exposes runtime status and creates manual handoff RuntimePreviewArtifact without Codex execution", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A runtime handoff test idea",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed",
          businessCriticIntensity: "balanced",
          businessCriticIntensityConfirmation: "user_confirmed"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const status = await storageApp.request("/api/v1/runtime/status", {
        headers: authHeaders()
      });
      const statusBody = await jsonBody(status);

      expect(status.status).toBe(200);
      expect(statusBody.data).toMatchObject({
        status: "available",
        adapterVersion: "codex-app-server-preview-v1",
        generatedSchemaVersion: "codex-cli-0.128.0",
        transport: "stdio",
        manualHandoffAvailable: true,
        liveTurnExecutionEnabled: false,
        executionMode: "fixture"
      });

      const handoff = await storageApp.request("/api/v1/runtime/manual-handoff", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 1,
          turnPurpose: "research_prompt",
          contextHash: "ctx_manual_research_prompt",
          prompt: "Draft a skeptical research prompt for the founder.",
          sourceRefs: ["research_task_manual"],
          targetObject: "ResearchTask"
        })
      });
      const handoffBody = await jsonBody(handoff);
      const handoffData = handoffBody.data as Readonly<Record<string, unknown>>;
      const runtimeProjection = handoffData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(handoff.status).toBe(200);
      expect(handoffData).toMatchObject({
        category: "accepted_with_projection",
        stateVersionAfter: 2
      });
      expect(runtimeProjection).toMatchObject({
        kind: "RuntimeActivityProjection",
        runtimeStatus: "unavailable",
        runtimeArtifacts: [
          expect.objectContaining({
            turnPurpose: "research_prompt",
            kind: "ResearchPromptArtifact",
            applyPolicy: "manual_handoff_required",
            status: "manual_handoff",
            source: "manual_prompt_handoff"
          })
        ]
      });

      const activity = await storageApp.request(`/api/v1/sessions/${sessionId}/activity`, {
        headers: authHeaders()
      });
      const activityBody = await jsonBody(activity);

      expect(activity.status).toBe(200);
      expect(activityBody.data).toMatchObject({
        kind: "RuntimeActivityProjection",
        runtimeStatus: "unavailable",
        runtimeArtifacts: [
          expect.objectContaining({
            contextHash: "ctx_manual_research_prompt"
          })
        ]
      });
    } finally {
      await storage.close();
    }
  });

  it("blocks an existing runtime artifact through the block route without executing it", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A runtime artifact block route test idea",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed",
          businessCriticIntensity: "balanced",
          businessCriticIntensityConfirmation: "user_confirmed"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const handoff = await storageApp.request("/api/v1/runtime/manual-handoff", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 1,
          turnPurpose: "implementation_plan_preview",
          contextHash: "ctx_block_existing_artifact",
          prompt: "Prepare a planning handoff but do not execute it.",
          sourceRefs: ["spec_current"],
          targetObject: "PlanningNote"
        })
      });
      const handoffBody = await jsonBody(handoff);
      const handoffData = handoffBody.data as Readonly<Record<string, unknown>>;
      const runtimeProjection = handoffData.immediateProjection as Readonly<Record<string, unknown>>;
      const artifacts = runtimeProjection.runtimeArtifacts as readonly Readonly<Record<string, unknown>>[];
      const artifactId = artifacts[0]?.artifactId as string;

      const block = await storageApp.request(`/api/v1/runtime/artifacts/${artifactId}/block`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          artifactId,
          expectedStateVersion: 2,
          blockedActionType: "destructive_operation",
          reason: "Manual safety review blocked this preview before any execution."
        })
      });
      const blockBody = await jsonBody(block);
      const blockData = blockBody.data as Readonly<Record<string, unknown>>;
      const blockProjection = blockData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(block.status).toBe(200);
      expect(blockData).toMatchObject({
        category: "blocked",
        stateVersionAfter: 3
      });
      expect(blockProjection).toMatchObject({
        kind: "RuntimeActivityProjection",
        runtimeStatus: "blocked",
        runtimeArtifacts: [
          expect.objectContaining({
            artifactId,
            kind: "BlockedActionArtifact",
            applyPolicy: "blocked",
            status: "blocked",
            targetObject: "blocked_action",
            blockedAction: {
              actionType: "destructive_operation",
              reason: "Manual safety review blocked this preview before any execution."
            }
          })
        ]
      });
      expect(blockData.queueProjection).toMatchObject({
        blocked: [
          expect.objectContaining({
            state: "blocked",
            queueItemId: `runtime_preview_${artifactId}`
          })
        ]
      });

      const queue = await storageApp.request(`/api/v1/sessions/${sessionId}/queue`, {
        headers: authHeaders()
      });
      const queueBody = await jsonBody(queue);

      expect(queueBody.data).toMatchObject({
        blocked: [
          expect.objectContaining({
            state: "blocked",
            queueItemId: `runtime_preview_${artifactId}`
          })
        ]
      });

      const completeness = await storageApp.request(`/api/v1/sessions/${sessionId}/completeness`, {
        headers: authHeaders()
      });
      const completenessBody = await jsonBody(completeness);

      expect(completeness.status).toBe(200);
      expect(completenessBody.data).toMatchObject({
        kind: "ConfidenceCompletionProjection",
        completionCandidate: {
          status: "not_ready"
        },
        gates: expect.arrayContaining([
          expect.objectContaining({
            gateId: "blocking_incidents",
            passed: false
          })
        ]),
        topRiskCards: expect.arrayContaining([
          expect.objectContaining({
            severity: "high",
            sourceRefs: expect.arrayContaining([artifactId])
          })
        ])
      });

      const convertAgain = await storageApp.request(`/api/v1/runtime/artifacts/${artifactId}/convert`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          artifactId,
          expectedStateVersion: 3,
          target: "ExecutionPlan"
        })
      });
      const convertAgainBody = await jsonBody(convertAgain);
      const convertAgainData = convertAgainBody.data as Readonly<Record<string, unknown>>;

      expect(convertAgain.status).toBe(200);
      expect(convertAgainData).toMatchObject({
        category: "blocked",
        stateVersionAfter: 4
      });
    } finally {
      await storage.close();
    }
  });

  it("rejects runtime preview requests without traceable sourceRefs", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const missingSourceRefs = await storageApp.request("/api/v1/runtime/codex/preview", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId: "sess_missing_source_refs",
          expectedStateVersion: 1,
          turnPurpose: "spec_update_preview",
          contextHash: "ctx_missing_source_refs",
          prompt: "Preview a spec update."
        })
      });
      const missingBody = await jsonBody(missingSourceRefs);
      const emptySourceRefs = await storageApp.request("/api/v1/runtime/manual-handoff", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId: "sess_empty_source_refs",
          expectedStateVersion: 1,
          turnPurpose: "research_prompt",
          contextHash: "ctx_empty_source_refs",
          prompt: "Draft a handoff prompt.",
          sourceRefs: []
        })
      });
      const emptyBody = await jsonBody(emptySourceRefs);

      expect(missingSourceRefs.status).toBe(400);
      expect(missingBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "sourceRefs must include at least one trace reference."
      });
      expect(emptySourceRefs.status).toBe(400);
      expect(emptyBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "sourceRefs must include at least one trace reference."
      });
    } finally {
      await storage.close();
    }
  });

  it("mounts PR-08 completeness scoring and Founder Brief metadata routes without async scoring effects", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A completion route test idea",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed",
          businessCriticIntensity: "balanced",
          businessCriticIntensityConfirmation: "user_confirmed"
        })
      });
      const startData = (await jsonBody(start)).data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;

      const intake = await storageApp.request(`/api/v1/sessions/${sessionId}/intake`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 1,
          answer: "Help founders produce a stop-now brief with explicit risks."
        })
      });
      const intakeBody = await jsonBody(intake);
      const draft = await storageApp.request(`/api/v1/sessions/${sessionId}/spec/initial`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 2
        })
      });
      const draftBody = await jsonBody(draft);
      const score = await storageApp.request(`/api/v1/sessions/${sessionId}/completeness/score`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 3
        })
      });
      const scoreBody = await jsonBody(score);
      const scoreData = scoreBody.data as Readonly<Record<string, unknown>>;
      const confidence = scoreData.immediateProjection as Readonly<Record<string, unknown>>;
      const fetchedCompleteness = await storageApp.request(`/api/v1/sessions/${sessionId}/completeness`, {
        headers: authHeaders()
      });
      const fetchedCompletenessBody = await jsonBody(fetchedCompleteness);
      const candidate = await storageApp.request(`/api/v1/sessions/${sessionId}/completion-candidate`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 4
        })
      });
      const candidateBody = await jsonBody(candidate);
      const candidateData = candidateBody.data as Readonly<Record<string, unknown>>;
      const founderBrief = await storageApp.request(`/api/v1/sessions/${sessionId}/founder-brief/export`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 4,
          requestedFormat: "markdown"
        })
      });
      const founderBriefBody = await jsonBody(founderBrief);
      const founderBriefData = founderBriefBody.data as Readonly<Record<string, unknown>>;
      const founderBriefProjection = founderBriefData.immediateProjection as Readonly<Record<string, unknown>>;
      const fetchedFounderBrief = await storageApp.request(`/api/v1/sessions/${sessionId}/founder-brief`, {
        headers: authHeaders()
      });
      const fetchedFounderBriefBody = await jsonBody(fetchedFounderBrief);
      const fileWrite = await storageApp.request(`/api/v1/sessions/${sessionId}/founder-brief/export`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 5,
          fileWriteRequested: true
        })
      });
      const fileWriteBody = await jsonBody(fileWrite);
      const fileWriteData = fileWriteBody.data as Readonly<Record<string, unknown>>;
      const legacyWriteFile = await storageApp.request(`/api/v1/sessions/${sessionId}/founder-brief/export`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 5,
          writeFile: true
        })
      });
      const legacyWriteFileBody = await jsonBody(legacyWriteFile);
      const legacyWriteFileData = legacyWriteFileBody.data as Readonly<Record<string, unknown>>;
      const externalExport = await storageApp.request(`/api/v1/sessions/${sessionId}/founder-brief/export`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 5,
          externalExportRequested: true,
          exportUrl: "https://example.invalid/founder-brief"
        })
      });
      const externalExportBody = await jsonBody(externalExport);
      const externalExportData = externalExportBody.data as Readonly<Record<string, unknown>>;
      const unsupportedFormat = await storageApp.request(`/api/v1/sessions/${sessionId}/founder-brief/export`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 5,
          requestedFormat: "pdf"
        })
      });
      const unsupportedFormatBody = await jsonBody(unsupportedFormat);
      const unsupportedFormatData = unsupportedFormatBody.data as Readonly<Record<string, unknown>>;

      expect(intake.status).toBe(200);
      expect(intakeBody.data).toBeTruthy();
      expect(draft.status).toBe(200);
      expect(draftBody.data).toBeTruthy();
      expect(score.status).toBe(200);
      expect(scoreData).toMatchObject({
        category: "accepted_with_projection",
        stateVersionAfter: 4
      });
      expect(scoreData.statusUrl).toBeUndefined();
      expect(confidence).toMatchObject({
        kind: "ConfidenceCompletionProjection",
        completionCandidate: {
          status: "not_ready"
        }
      });
      expect(fetchedCompleteness.status).toBe(200);
      expect(fetchedCompletenessBody.data).toMatchObject({
        kind: "ConfidenceCompletionProjection",
        completionCandidate: {
          status: "not_ready"
        }
      });
      expect(candidate.status).toBe(200);
      expect(candidateData).toMatchObject({
        category: "rejected",
        error: {
          code: "COMMAND_PRECONDITION_FAILED",
          details: {
            completionCandidate: {
              status: "not_ready"
            },
            gates: expect.any(Array),
            topRisks: expect.any(Array)
          }
        }
      });
      expect(founderBrief.status).toBe(200);
      expect(founderBriefProjection).toMatchObject({
        kind: "FounderBriefProjection",
        exportReady: false,
        exportMetadata: {
          writePolicy: "metadata_only_no_file_write"
        }
      });
      expect(fetchedFounderBrief.status).toBe(200);
      expect(fetchedFounderBriefBody.data).toBeTruthy();
      expect(fileWrite.status).toBe(200);
      expect(fileWriteData).toMatchObject({
        category: "rejected",
        error: {
          code: "RUNTIME_ACTION_BLOCKED"
        }
      });
      expect(legacyWriteFile.status).toBe(200);
      expect(legacyWriteFileData).toMatchObject({
        category: "rejected",
        error: {
          code: "RUNTIME_ACTION_BLOCKED"
        }
      });
      expect(externalExport.status).toBe(200);
      expect(externalExportData).toMatchObject({
        category: "rejected",
        error: {
          code: "RUNTIME_ACTION_BLOCKED"
        }
      });
      expect(unsupportedFormat.status).toBe(200);
      expect(unsupportedFormatData).toMatchObject({
        category: "rejected",
        error: {
          code: "VALIDATION_FAILED"
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("queues codex runtime preview effects and persists fixture artifacts with durable idempotency", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A runtime fixture test idea",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed",
          businessCriticIntensity: "balanced",
          businessCriticIntensityConfirmation: "user_confirmed"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const preview = await storageApp.request("/api/v1/runtime/codex/preview", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 1,
          turnPurpose: "implementation_plan_preview",
          contextHash: "ctx_fixture_plan",
          prompt: "Preview an implementation plan without executing it.",
          sourceRefs: ["spec_current"],
          targetObject: "PlanningNote"
        })
      });
      const previewBody = await jsonBody(preview);
      const previewData = previewBody.data as Readonly<Record<string, unknown>>;

      expect(preview.status).toBe(200);
      expect(previewData).toMatchObject({
        category: "accepted",
        stateVersionAfter: 2,
        pendingEffectSummary: {
          byType: {
            codex_runtime_preview_effect: 1
          }
        }
      });
      expect(previewData.statusUrl).toEqual(expect.any(String));

      const queuedStatus = await storageApp.request(previewData.statusUrl as string, {
        headers: authHeaders()
      });
      const queuedStatusBody = await jsonBody(queuedStatus);

      expect(queuedStatusBody.data).toMatchObject({
        commandStatus: "pending",
        projectionHints: [
          {
            projectionKind: "RuntimeActivityProjection",
            refetchUrl: `/api/v1/sessions/${sessionId}/activity`
          }
        ],
        effects: [
          expect.objectContaining({
            effectType: "codex_runtime_preview_effect",
            maxAttempts: 1,
            idempotencyKey: `codex:${sessionId}:implementation_plan_preview:ctx_fixture_plan:codex-app-server-preview-v1`
          })
        ]
      });

      const executorResults = await createProductEngineCommandService(
        storage,
        fixtureCodexRuntimeAdapter
      ).runPendingCodexRuntimePreviewEffects();

      expect(executorResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "succeeded",
            kind: "ImplementationPlanPreviewArtifact"
          })
        ])
      );

      const completedStatus = await storageApp.request(previewData.statusUrl as string, {
        headers: authHeaders()
      });
      const completedStatusBody = await jsonBody(completedStatus);

      expect(completedStatusBody.data).toMatchObject({
        commandStatus: "complete",
        effects: [
          expect.objectContaining({
            effectType: "codex_runtime_preview_effect",
            status: "succeeded",
            outputRef: expect.objectContaining({
              refType: "effect_output_json"
            })
          })
        ]
      });

      const activity = await storageApp.request(`/api/v1/sessions/${sessionId}/activity`, {
        headers: authHeaders()
      });
      const activityBody = await jsonBody(activity);

      expect(activityBody.data).toMatchObject({
        runtimeStatus: "available",
        runtimeArtifacts: [
          expect.objectContaining({
            turnPurpose: "implementation_plan_preview",
            kind: "ImplementationPlanPreviewArtifact",
            source: "protocol_fixture",
            status: "preview_ready"
          })
        ]
      });

      const activityData = activityBody.data as Readonly<Record<string, unknown>>;
      const artifacts = activityData.runtimeArtifacts as readonly Readonly<Record<string, unknown>>[];
      const artifactId = artifacts[0]?.artifactId as string;
      const convert = await storageApp.request(`/api/v1/runtime/artifacts/${artifactId}/convert`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          artifactId,
          expectedStateVersion: 3,
          target: "planning_note"
        })
      });
      const convertBody = await jsonBody(convert);
      const convertData = convertBody.data as Readonly<Record<string, unknown>>;
      const convertEvents = await createEventRepository(storage.db).listForCommand(convertData.commandId as CommandId);

      expect(convert.status).toBe(200);
      expect(convertData).toMatchObject({
        category: "accepted",
        stateVersionAfter: 4
      });
      expect(convertEvents.at(-1)?.payload).toMatchObject({
        conversionStatus: "preview_only",
        target: "planning_note"
      });
    } finally {
      await storage.close();
    }
  });

  it("allows manual handoff and later Codex preview for the same runtime context without DB conflicts", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A cross-source runtime context test idea",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed",
          businessCriticIntensity: "balanced",
          businessCriticIntensityConfirmation: "user_confirmed"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const commonPayload = {
        sessionId,
        turnPurpose: "implementation_plan_preview",
        contextHash: "ctx_cross_source_runtime",
        prompt: "Prepare a planning preview for the same context.",
        sourceRefs: ["spec_current"],
        targetObject: "PlanningNote"
      };
      const handoff = await storageApp.request("/api/v1/runtime/manual-handoff", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...commonPayload,
          expectedStateVersion: 1
        })
      });
      const handoffBody = await jsonBody(handoff);
      const handoffData = handoffBody.data as Readonly<Record<string, unknown>>;
      const handoffProjection = handoffData.immediateProjection as Readonly<Record<string, unknown>>;
      const handoffArtifacts = handoffProjection.runtimeArtifacts as readonly Readonly<Record<string, unknown>>[];
      const preview = await storageApp.request("/api/v1/runtime/codex/preview", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...commonPayload,
          expectedStateVersion: 2
        })
      });
      const previewBody = await jsonBody(preview);
      const previewData = previewBody.data as Readonly<Record<string, unknown>>;
      const executorResults = await createProductEngineCommandService(
        storage,
        fixtureCodexRuntimeAdapter
      ).runPendingCodexRuntimePreviewEffects();
      const activity = await storageApp.request(`/api/v1/sessions/${sessionId}/activity`, {
        headers: authHeaders()
      });
      const activityBody = await jsonBody(activity);
      const activityData = activityBody.data as Readonly<Record<string, unknown>>;
      const artifacts = activityData.runtimeArtifacts as readonly Readonly<Record<string, unknown>>[];

      expect(preview.status).toBe(200);
      expect(previewData).toMatchObject({
        category: "accepted",
        pendingEffectSummary: {
          byType: {
            codex_runtime_preview_effect: 1
          }
        }
      });
      expect(executorResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "succeeded"
          })
        ])
      );
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]).toMatchObject({
        artifactId: handoffArtifacts[0]?.artifactId,
        source: "protocol_fixture",
        status: "preview_ready"
      });
    } finally {
      await storage.close();
    }
  });

  it("fails Codex runtime preview effects when adapter output does not match the request trace", async () => {
    const mismatchedAdapter = {
      ...fixtureCodexRuntimeAdapter,
      async createPreview(input: Parameters<typeof fixtureCodexRuntimeAdapter.createPreview>[0]) {
        return fixtureCodexPreviewOutput({
          ...input,
          turnPurpose: "research_prompt"
        });
      }
    };
    const { app: storageApp, storage } = await createMigratedStorageApp(mismatchedAdapter);

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A mismatched runtime adapter output test idea",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed",
          businessCriticIntensity: "balanced",
          businessCriticIntensityConfirmation: "user_confirmed"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const preview = await storageApp.request("/api/v1/runtime/codex/preview", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 1,
          turnPurpose: "spec_update_preview",
          contextHash: "ctx_mismatched_adapter_output",
          prompt: "Preview a spec update with mismatched adapter output.",
          sourceRefs: ["spec_current"],
          targetObject: "SpecUpdate"
        })
      });
      const previewBody = await jsonBody(preview);
      const previewData = previewBody.data as Readonly<Record<string, unknown>>;
      const executorResults = await createProductEngineCommandService(
        storage,
        mismatchedAdapter
      ).runPendingCodexRuntimePreviewEffects();
      const failedStatus = await storageApp.request(previewData.statusUrl as string, {
        headers: authHeaders()
      });
      const failedStatusBody = await jsonBody(failedStatus);
      const activity = await storageApp.request(`/api/v1/sessions/${sessionId}/activity`, {
        headers: authHeaders()
      });
      const activityBody = await jsonBody(activity);

      expect(preview.status).toBe(200);
      expect(executorResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "failed",
            error: "Codex preview output turnPurpose must match the requested turnPurpose."
          })
        ])
      );
      expect(failedStatusBody.data).toMatchObject({
        commandStatus: "failed",
        effects: [
          expect.objectContaining({
            status: "failed",
            error: expect.objectContaining({
              code: "CODEX_RUNTIME_PREVIEW_FAILED"
            })
          })
        ]
      });
      expect(activityBody.data).toMatchObject({
        runtimeStatus: "scaffold_placeholder",
        runtimeArtifacts: []
      });
    } finally {
      await storage.close();
    }
  });

  it("scopes Codex runtime preview idempotency to each session", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const sessionIds: string[] = [];

      for (const rawIdea of ["First same-context session", "Second same-context session"]) {
        const start = await storageApp.request("/api/v1/projects", {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            rawIdea,
            localPrivacyMode: "local_only",
            projectPurposeMode: "business",
            projectPurposeModeConfirmation: "user_confirmed",
            businessCriticIntensity: "balanced",
            businessCriticIntensityConfirmation: "user_confirmed"
          })
        });
        const startBody = await jsonBody(start);
        const startData = startBody.data as Readonly<Record<string, unknown>>;
        const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;

        sessionIds.push(sessionProjection.sessionId as string);
      }

      for (const sessionId of sessionIds) {
        const preview = await storageApp.request("/api/v1/runtime/codex/preview", {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            sessionId,
            expectedStateVersion: 1,
            turnPurpose: "implementation_plan_preview",
            contextHash: "ctx_shared_across_sessions",
            prompt: "Preview the same context hash in separate sessions.",
            sourceRefs: ["spec_current"],
            targetObject: "PlanningNote"
          })
        });
        const previewBody = await jsonBody(preview);

        expect(preview.status).toBe(200);
        expect(previewBody.data).toMatchObject({
          category: "accepted",
          pendingEffectSummary: {
            byType: {
              codex_runtime_preview_effect: 1
            }
          }
        });
      }
    } finally {
      await storage.close();
    }
  });

  it("falls back to manual handoff when Codex runtime preview execution is unavailable", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();
    const unavailableAdapter = {
      ...fixtureCodexRuntimeAdapter,
      async createPreview() {
        throw new CodexRuntimeUnavailableError("Synthetic Codex app-server unavailable.");
      }
    };

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A runtime unavailable fallback test idea",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed",
          businessCriticIntensity: "balanced",
          businessCriticIntensityConfirmation: "user_confirmed"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const preview = await storageApp.request("/api/v1/runtime/codex/preview", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 1,
          turnPurpose: "spec_update_preview",
          contextHash: "ctx_unavailable_fallback",
          prompt: "Preview a spec update with unavailable runtime.",
          sourceRefs: ["spec_current"],
          targetObject: "SpecUpdate"
        })
      });
      const previewBody = await jsonBody(preview);
      const previewData = previewBody.data as Readonly<Record<string, unknown>>;
      const executorResults = await createProductEngineCommandService(
        storage,
        unavailableAdapter
      ).runPendingCodexRuntimePreviewEffects();
      const completedStatus = await storageApp.request(previewData.statusUrl as string, {
        headers: authHeaders()
      });
      const completedStatusBody = await jsonBody(completedStatus);
      const activity = await storageApp.request(`/api/v1/sessions/${sessionId}/activity`, {
        headers: authHeaders()
      });
      const activityBody = await jsonBody(activity);

      expect(preview.status).toBe(200);
      expect(executorResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "succeeded",
            fallback: "manual_prompt_handoff"
          })
        ])
      );
      expect(completedStatusBody.data).toMatchObject({
        commandStatus: "complete",
        effects: [
          expect.objectContaining({
            status: "succeeded",
            attemptCount: 1,
            outputRef: expect.objectContaining({
              refType: "effect_output_json"
            })
          })
        ]
      });
      expect(activityBody.data).toMatchObject({
        runtimeStatus: "unavailable",
        runtimeArtifacts: [
          expect.objectContaining({
            source: "manual_prompt_handoff",
            status: "manual_handoff"
          })
        ]
      });

      const retryPreview = await storageApp.request("/api/v1/runtime/codex/preview", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 3,
          turnPurpose: "spec_update_preview",
          contextHash: "ctx_unavailable_fallback",
          prompt: "Preview a spec update with unavailable runtime.",
          sourceRefs: ["spec_current"],
          targetObject: "SpecUpdate"
        })
      });
      const retryBody = await jsonBody(retryPreview);
      const retryData = retryBody.data as Readonly<Record<string, unknown>>;
      const retryResults = await createProductEngineCommandService(
        storage,
        fixtureCodexRuntimeAdapter
      ).runPendingCodexRuntimePreviewEffects();
      const retryActivity = await storageApp.request(`/api/v1/sessions/${sessionId}/activity`, {
        headers: authHeaders()
      });
      const retryActivityBody = await jsonBody(retryActivity);

      expect(retryPreview.status).toBe(200);
      expect(retryData).toMatchObject({
        category: "accepted",
        stateVersionAfter: 4,
        pendingEffectSummary: {
          byType: {
            codex_runtime_preview_effect: 1
          }
        }
      });
      expect(retryResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "succeeded",
            kind: "SpecUpdatePreviewArtifact"
          })
        ])
      );
      expect(retryActivityBody.data).toMatchObject({
        runtimeStatus: "available",
        runtimeArtifacts: [
          expect.objectContaining({
            source: "protocol_fixture",
            status: "preview_ready"
          })
        ]
      });
    } finally {
      await storage.close();
    }
  });

  it("marks Codex runtime preview effects failed after a non-recoverable adapter error", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();
    const failingAdapter = {
      ...fixtureCodexRuntimeAdapter,
      async createPreview() {
        throw new Error("Synthetic non-recoverable Codex preview failure.");
      }
    };

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A runtime failure test idea",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed",
          businessCriticIntensity: "balanced",
          businessCriticIntensityConfirmation: "user_confirmed"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const preview = await storageApp.request("/api/v1/runtime/codex/preview", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 1,
          turnPurpose: "spec_update_preview",
          contextHash: "ctx_nonrecoverable_failure",
          prompt: "Preview a spec update with generic runtime failure.",
          sourceRefs: ["spec_current"],
          targetObject: "SpecUpdate"
        })
      });
      const previewBody = await jsonBody(preview);
      const previewData = previewBody.data as Readonly<Record<string, unknown>>;
      const executorResults = await createProductEngineCommandService(
        storage,
        failingAdapter
      ).runPendingCodexRuntimePreviewEffects();
      const failedStatus = await storageApp.request(previewData.statusUrl as string, {
        headers: authHeaders()
      });
      const failedStatusBody = await jsonBody(failedStatus);

      expect(preview.status).toBe(200);
      expect(executorResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "failed",
            error: "Synthetic non-recoverable Codex preview failure."
          })
        ])
      );
      expect(failedStatusBody.data).toMatchObject({
        commandStatus: "failed",
        effects: [
          expect.objectContaining({
            status: "failed",
            attemptCount: 1,
            error: expect.objectContaining({
              code: "CODEX_RUNTIME_PREVIEW_FAILED",
              retryAvailable: false
            })
          })
        ]
      });
    } finally {
      await storage.close();
    }
  });

  it("converts forbidden runtime action requests into blocked artifacts and blocked command status", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A runtime blocked action test idea",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed",
          businessCriticIntensity: "balanced",
          businessCriticIntensityConfirmation: "user_confirmed"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const blockedPreview = await storageApp.request("/api/v1/runtime/codex/preview", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 1,
          turnPurpose: "implementation_plan_preview",
          contextHash: "ctx_block_shell",
          prompt: "Suggest a shell command but do not execute it.",
          sourceRefs: ["spec_current"],
          targetObject: "blocked_action",
          requestedActionType: "shell_command",
          requestedActionReason: "The preview suggested running pnpm verify."
        })
      });
      const blockedPreviewBody = await jsonBody(blockedPreview);
      const blockedPreviewData = blockedPreviewBody.data as Readonly<Record<string, unknown>>;
      const executorResults = await createProductEngineCommandService(
        storage,
        fixtureCodexRuntimeAdapter
      ).runPendingCodexRuntimePreviewEffects();

      expect(blockedPreview.status).toBe(200);
      expect(executorResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "blocked",
            blockedActionType: "shell_command"
          })
        ])
      );

      const blockedStatus = await storageApp.request(blockedPreviewData.statusUrl as string, {
        headers: authHeaders()
      });
      const blockedStatusBody = await jsonBody(blockedStatus);

      expect(blockedStatusBody.data).toMatchObject({
        commandStatus: "blocked",
        effects: [
          expect.objectContaining({
            effectType: "codex_runtime_preview_effect",
            status: "blocked",
            outputRef: expect.objectContaining({
              refType: "effect_output_json"
            }),
            error: expect.objectContaining({
              code: "RUNTIME_ACTION_BLOCKED"
            })
          })
        ]
      });

      const activity = await storageApp.request(`/api/v1/sessions/${sessionId}/activity`, {
        headers: authHeaders()
      });
      const activityBody = await jsonBody(activity);

      expect(activityBody.data).toMatchObject({
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

      const queue = await storageApp.request(`/api/v1/sessions/${sessionId}/queue`, {
        headers: authHeaders()
      });
      const queueBody = await jsonBody(queue);

      expect(queueBody.data).toMatchObject({
        blocked: [
          expect.objectContaining({
            state: "blocked"
          })
        ]
      });
    } finally {
      await storage.close();
    }
  });

  it("rejects auto implementation workspace creation before planning-ready handoff", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { sessionId } = await createProjectForTest(
        storageApp,
        "A premature auto implementation workspace should stay blocked"
      );
      const response = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:blocked-before-planning-ready",
        projectName: "Premature Workspace"
      }, { seedPlanningReady: false });
      const body = await jsonBody(response);

      expect(response.status).toBe(400);
      expect(body.error).toMatchObject({
        code: "COMMAND_PRECONDITION_FAILED",
        message: "Auto implementation workspace creation requires a planning_ready Planning Handoff.",
        details: {
          currentPlanningHandoffStatus: "missing",
          requiredStatus: "planning_ready"
        }
      });

      await ensurePlanningReadyForAutoImplementationTest(storageApp, sessionId);
      const mismatchedSource = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:mismatched-planning-source",
        projectName: "Mismatched Planning Source",
        sourcePlanningRef: "planning_handoff_wrong_artifact"
      });
      const mismatchedBody = await jsonBody(mismatchedSource);

      expect(mismatchedSource.status).toBe(400);
      expect(mismatchedBody.error).toMatchObject({
        code: "COMMAND_PRECONDITION_FAILED",
        message: "Auto implementation workspace sourcePlanningRef must match the latest planning_ready final artifact.",
        details: {
          sourcePlanningRef: "planning_handoff_wrong_artifact"
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("creates a workspace/<project> git repo with markdown fallback issues for auto implementation runs", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { sessionId } = await createProjectForTest(storageApp, "A local app that should be implemented after planning");
      const response = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:test",
        projectName: "Demo Workspace App",
        trackerGoal: "Build the planned demo workspace app through reviewed PR-sized stages."
      });
      const body = await jsonBody(response);
      const projection = jsonDataRecord(body);
      const latestRun = latestAutoImplementationRunFromBody(body);
      const issueManagement = latestRun.issueManagement as Readonly<Record<string, unknown>>;
      const planningIssueDocs = issueManagement.planningIssueDocs as readonly Readonly<Record<string, unknown>>[];
      const issueDocs = issueManagement.issueDocs as readonly Readonly<Record<string, unknown>>[];
      const stagePlan = latestRun.stagePlan as readonly Readonly<Record<string, unknown>>[];
      const projectDir = join(workspaceRoot, "demo-workspace-app");

      expect(response.status).toBe(200);
      expect(projection).toMatchObject({
        kind: "AutoImplementationRunProjection",
        version: 1,
        summary: "Auto implementation workspace is ready for demo-workspace-app; remote status is no_remote."
      });
      expect(latestRun).toMatchObject({
        projectFolderName: "demo-workspace-app",
        workspaceRoot,
        generatedRepoPath: projectDir,
        remoteStatus: "no_remote",
        currentStage: "initial_pr"
      });
      expect(stagePlan).toHaveLength(7);
      expect(issueManagement).toMatchObject({
        mode: "markdown_fallback",
        trackerRelativePath: "implementation-tracker.md",
        issueStatusSummary: {
          total: 7,
          open: 7,
          completed: 0,
          blocked: 0
        },
        githubIssueUrls: [],
        githubIssueMutation: {
          status: "not_requested",
          requiredRemoteStatus: "connected",
          mutatesGitHub: false,
          perActionApprovalRequired: true,
          approval: null,
          blockedReason: null,
          createdIssueUrls: [],
          auditEvidenceRefs: ["github-issue-mutation:not_requested"],
          verifierEvidenceRefs: []
        }
      });
      expect((issueManagement.githubIssueMutation as Readonly<Record<string, unknown>>).plannedIssues).toHaveLength(7);
      expect(issueManagement.planningIssueSequenceTrackerRelativePath).toBe("planning-handoff-pr-issue-sequence.md");
      expect(planningIssueDocs.length).toBeGreaterThan(0);
      expect(planningIssueDocs[0]).toMatchObject({
        relativePath: expect.stringMatching(/^planning-handoff-pr-issues\//u),
        includedTaskIds: expect.arrayContaining([expect.any(String)]),
        status: "active"
      });
      expect(issueDocs).toHaveLength(7);
      expect(issueDocs[0]).toMatchObject({
        issueId: "local-001",
        relativePath: "implementation-issues/001-initial_pr.md",
        status: "open"
      });

      const tracker = await readFile(join(projectDir, "implementation-tracker.md"), "utf8");
      const sequenceTracker = await readFile(join(projectDir, "planning-handoff-pr-issue-sequence.md"), "utf8");
      const planningPlan = await readFile(join(projectDir, "planning-handoff-implementation-plan.md"), "utf8");
      const generatedProductReadme = await readFile(join(projectDir, "generated-product", "README.md"), "utf8");
      const generatedProductPackage = JSON.parse(
        await readFile(join(projectDir, "generated-product", "package.json"), "utf8")
      ) as Readonly<Record<string, unknown>>;
      const generatedProductData = JSON.parse(
        await readFile(join(projectDir, "generated-product", "product-slice.json"), "utf8")
      ) as Readonly<Record<string, unknown>>;
      const generatedProductHtml = await readFile(join(projectDir, "generated-product", "index.html"), "utf8");
      const generatedProductModule = await readFile(join(projectDir, "generated-product", "src", "product-slice.mjs"), "utf8");
      const generatedProductTest = await readFile(
        join(projectDir, "generated-product", "src", "product-slice.test.mjs"),
        "utf8"
      );
      const issueMarkdownByPath = new Map(
        await Promise.all(
          issueDocs.map(async (issueDoc) => {
            if (typeof issueDoc.relativePath !== "string") {
              throw new Error("Generated issue docs must record a relativePath.");
            }
            return [issueDoc.relativePath, await readFile(join(projectDir, issueDoc.relativePath), "utf8")] as const;
          })
        )
      );
      const getIssueMarkdown = (relativePath: string) => {
        const issueMarkdown = issueMarkdownByPath.get(relativePath);
        if (issueMarkdown === undefined) {
          throw new Error(`Missing generated issue markdown: ${relativePath}`);
        }
        return issueMarkdown;
      };
      const firstIssue = getIssueMarkdown("implementation-issues/001-initial_pr.md");
      const finalVerifyIssue = getIssueMarkdown("implementation-issues/006-final_verify_pr_update.md");
      const mergeIssue = getIssueMarkdown("implementation-issues/007-merge_main.md");
      const planningIssueEvidenceRefs = (latestRun.evidenceRefs as readonly string[]).filter((ref) =>
        ref.startsWith("planning-handoff-pr-issue:")
      );
      const firstPlanningIssueRelativePath = planningIssueEvidenceRefs[0]?.replace(
        "planning-handoff-pr-issue:",
        ""
      );

      expect(firstPlanningIssueRelativePath).toBeDefined();

      const firstPlanningIssue = await readFile(join(projectDir, firstPlanningIssueRelativePath!), "utf8");
      const expectedReviewEvidenceSlots = [
        "Feature code review: record two consecutive no-finding passes",
        "Repository code review: record two consecutive no-finding passes",
        "Changed-code clean-code review: record two consecutive no-finding passes",
        "Repository clean-code review: record two consecutive no-finding passes"
      ] as const;
      const expectScopeSpecificReviewEvidenceSlots = (markdown: string) => {
        expect(markdown).toContain("## Scope-specific review evidence slots");
        for (const reviewEvidenceSlot of expectedReviewEvidenceSlots) {
          expect(markdown).toContain(reviewEvidenceSlot);
        }
      };
      expect(tracker).toContain("<!-- solo-superman:auto-implementation-run-state:start -->");
      expect(tracker).toContain("## Auto implementation run state");
      expect(tracker).toContain("### Planning PR-sized issue slices");
      expect(tracker).toContain(`${planningIssueDocs[0]?.title ?? ""} (active;`);
      expect(tracker).toContain("- Run status: pending");
      expect(tracker).toContain("- Current stage: initial_pr");
      expect(tracker).toContain("- Issue status summary: 0 completed / 0 blocked / 7 open / 7 total");
      expect(tracker).toContain("- Latest worker job: none");
      expect(tracker).toContain("- Latest PR mutation: none");
      expect(firstIssue).toContain("<!-- solo-superman:auto-implementation-issue-state:start -->");
      expect(firstIssue).toContain("## Auto implementation issue state");
      expect(firstIssue).toContain("- Issue status: open");
      expect(firstIssue).toContain("- GitHub issue URL: none");
      expect(firstIssue).toContain("- Stage status: ready");
      expect(firstIssue).toContain("- Issue status summary: 0 completed / 0 blocked / 7 open / 7 total");
      expect(firstIssue).toContain("- Stage evidence refs: none");
      expect(firstIssue).toContain("- Stage blocker evidence refs: none");
      expect(firstIssue).toContain("- Latest stage worker job: none");
      expect(firstIssue).toContain("- Latest stage worker evidence refs: none");
      const manifest = JSON.parse(await readFile(join(projectDir, ".solo-superman", "auto-implementation-run.json"), "utf8")) as
        Readonly<Record<string, unknown>>;
      const gitHead = await readFile(join(projectDir, ".git", "HEAD"), "utf8");
      const gitStatus = execFileSync("git", ["status", "--short"], { cwd: projectDir, encoding: "utf8" });
      const bootstrapEvidenceRef = (latestRun.evidenceRefs as readonly string[]).find((ref) =>
        ref.startsWith("git:workspace-bootstrap-ref:")
      );
      expect(bootstrapEvidenceRef).toBe(`git:workspace-bootstrap-ref:refs/tags/solo-superman/bootstrap/${latestRun.runId}`);
      const bootstrapTagRef = bootstrapEvidenceRef!.replace("git:workspace-bootstrap-ref:", "");
      const bootstrapCommitMessage = execFileSync("git", ["log", "--format=%s", "-n", "1", bootstrapTagRef], {
        cwd: projectDir,
        encoding: "utf8"
      }).trim();
      const bootstrapTagSha = execFileSync("git", ["rev-parse", "--verify", bootstrapTagRef], {
        cwd: projectDir,
        encoding: "utf8"
      }).trim();
      const headCommitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectDir, encoding: "utf8" }).trim();
      const bootstrapTreePaths = execFileSync("git", ["ls-tree", "-r", "--name-only", "HEAD"], {
        cwd: projectDir,
        encoding: "utf8"
      });
      const generatedProductTestOutput = execFileSync("node", ["--test", "src/product-slice.test.mjs"], {
        cwd: join(projectDir, "generated-product"),
        encoding: "utf8"
      });
      const commitCountBeforeReplay = execFileSync("git", ["rev-list", "--count", "HEAD"], {
        cwd: projectDir,
        encoding: "utf8"
      }).trim();

      expect(tracker).toContain("Remote status: no_remote");
      expect(tracker).toContain("Planning Handoff implementation plan");
      expect(tracker).toContain("[planning-handoff-implementation-plan.md](planning-handoff-implementation-plan.md)");
      expect(tracker).toContain("## Generated software scaffold");
      expect(tracker).toContain("[generated-product/README.md](generated-product/README.md)");
      expect(tracker).toContain("`generated-product/package.json` contains a dependency-free `npm test` smoke command");
      expect(tracker).toContain("## Planning-derived PR/issue files");
      expect(tracker).toContain("PR issue sequence tracker: [planning-handoff-pr-issue-sequence.md]");
      expect(tracker).toContain(firstPlanningIssueRelativePath!);
      expect(sequenceTracker).toContain("# Planning Handoff PR issue sequence tracker");
      expect(sequenceTracker).toContain("## Planning issue sequence state");
      expect(sequenceTracker).toContain("## Sequence gates");
      expect(sequenceTracker).toContain("Do not start a later PR-sized slice until the predecessor slice has merged");
      expect(sequenceTracker).toContain("This sequence tracker owns cross-slice order");
      expect(tracker).toContain("git remote add origin <github-repo-url>");
      expect(tracker).toContain("GitHub issue mutation contract");
      expect(tracker).toContain("Status: not_requested");
      expect(tracker).toContain("Created GitHub issue URLs: none");
      expect(tracker).toContain("Verifier evidence refs: none");
      expect(tracker).toContain("ImplementationStepLedger evidence template");
      expect(tracker).toContain("CodeReviewRecord.reviewScope");
      expectScopeSpecificReviewEvidenceSlots(tracker);
      expect(tracker).toContain("Do not merge until the feature PR code review reaches two consecutive no-finding passes");
      expect(tracker).toContain("Update the PR body with scope, review streak evidence, missing-test audit evidence, test evidence");
      expect(planningPlan).toContain("# Planning Handoff implementation plan");
      expect(planningPlan).toContain("## Build slice plan");
      expect(planningPlan).toContain("## Source-driven task breakdown");
      expect(planningPlan).toContain("## PR/issue plan");
      expect(planningPlan).toContain(`- Markdown issue: ${firstPlanningIssueRelativePath}`);
      expect(planningPlan).toContain("API ready SpecVersion");
      expect(planningPlan).toContain("Research-updated queue queue_api_ready terminal outcome is approved.");
      expect(planningPlan).toContain("Spec/Evidence/Queue sources drive task");
      expect(generatedProductReadme).toContain("# Generated product slice");
      expect(generatedProductReadme).toContain("Source Planning Handoff artifact:");
      expect(generatedProductReadme).toContain("## Included capabilities");
      expect(generatedProductReadme).toContain("## Acceptance criteria");
      expect(generatedProductReadme).toContain("## Evidence source trace");
      expect(generatedProductReadme).toContain("## Residual risks");
      expect(generatedProductPackage).toMatchObject({
        name: "demo-workspace-app-generated-product",
        private: true,
        type: "module",
        scripts: {
          test: "node --test src/product-slice.test.mjs"
        }
      });
      expect(generatedProductData).toMatchObject({
        source: {
          artifactId: expect.any(String),
          status: "planning_ready"
        },
        evidence: {
          sourceRefs: expect.arrayContaining([
            expect.objectContaining({
              required: true,
              stale: false
            })
          ]),
          readiness: {
            expectedEvidence: expect.arrayContaining([expect.any(String)])
          },
          residualRisks: expect.any(Array)
        }
      });
      expect(generatedProductHtml).toContain('data-product-slice-root');
      expect(generatedProductHtml).toContain('./src/product-slice.mjs');
      expect(generatedProductModule).toContain("export const productSlice");
      expect(generatedProductModule).toContain("renderProductSlice");
      expect(generatedProductTest).toContain("generated product slice keeps the Planning Handoff source trace");
      expect(generatedProductTestOutput).toContain("pass 3");
      expect(bootstrapTreePaths).toContain("generated-product/README.md");
      expect(bootstrapTreePaths).toContain("generated-product/package.json");
      expect(bootstrapTreePaths).toContain("generated-product/product-slice.json");
      expect(bootstrapTreePaths).toContain("generated-product/index.html");
      expect(bootstrapTreePaths).toContain("generated-product/src/product-slice.mjs");
      expect(bootstrapTreePaths).toContain("generated-product/src/product-slice.test.mjs");
      expect(firstPlanningIssue).toContain("# PR/issue 1");
      expect(firstPlanningIssue).toContain("## Product tasks in this PR-sized slice");
      expect(firstPlanningIssue).toContain("API ready SpecVersion");
      expect(firstPlanningIssue).toContain("Living Product Spec source trace is current.");
      expect(firstPlanningIssue).toContain("## Review and verification contract");
      expectScopeSpecificReviewEvidenceSlots(firstPlanningIssue);
      for (const issueMarkdown of issueMarkdownByPath.values()) {
        expectScopeSpecificReviewEvidenceSlots(issueMarkdown);
      }
      expect(firstIssue).toContain("## Acceptance");
      expect(firstIssue).toContain("Planning Handoff implementation plan: planning-handoff-implementation-plan.md");
      expect(firstIssue).toContain("## Planning source");
      expect(firstIssue).toContain("### Planning-derived PR/issue markdown files");
      expect(firstIssue).toContain(firstPlanningIssueRelativePath!);
      expect(firstIssue).toContain("## Generated software scaffold");
      expect(firstIssue).toContain("generated-product/src/product-slice.mjs");
      expect(firstIssue).toContain("## Required review gates");
      expect(firstIssue).toContain("## ImplementationStepLedger evidence template");
      expect(firstIssue).toContain("CleanCodeReviewRecord.reviewScope");
      expect(firstIssue).toContain("Create the smallest behavior-complete implementation for this issue slice.");
      expect(firstIssue).toContain("## Stage-specific evidence requirements");
      expect(firstIssue).toContain("initial implementation PR evidence links the PR-sized issue");
      expect(firstIssue).toContain("Review streak evidence is recorded before the next stage is marked complete.");
      expect(finalVerifyIssue).toContain("Audit missing tests against the issue acceptance criteria");
      expect(finalVerifyIssue).toContain("Update the PR description with scope, review streaks, exact verification commands");
      expect(finalVerifyIssue).toContain("final missing-test audit records zero uncovered targeted-test gaps");
      expect(finalVerifyIssue).toContain("final PR body evidence refs are ready to prove scope");
      expect(mergeIssue).toContain("applied GitHub PR merge mutation record is present before merge_main completion");
      expect(mergeIssue).toContain("post-merge-verify:<stage>:<command>");
      expect(mergeIssue).toContain(
        "Sync main after merge and rerun the full verification command on main with post-merge verification evidence."
      );
      expect(manifest).toMatchObject({
        runId: latestRun.runId,
        projectFolderName: "demo-workspace-app",
        remoteStatus: "no_remote",
        evidenceRefs: expect.arrayContaining([
          bootstrapEvidenceRef,
          "planning-handoff-plan:planning-handoff-implementation-plan.md",
          "generated-software-artifact:generated-product/README.md",
          "generated-software-artifact:generated-product/product-slice.json",
          "generated-software-artifact:generated-product/src/product-slice.test.mjs",
          expect.stringMatching(/^planning-handoff-pr-issue:planning-handoff-pr-issues\//u)
        ]),
        issueManagement: {
          planningIssueSequenceTrackerRelativePath: "planning-handoff-pr-issue-sequence.md",
          planningIssueDocs: expect.arrayContaining([
            expect.objectContaining({
              relativePath: firstPlanningIssueRelativePath,
              status: "active"
            })
          ]),
          githubIssueMutation: {
            status: "not_requested",
            mutatesGitHub: false,
            plannedIssues: expect.arrayContaining([
              expect.objectContaining({
                issueId: "local-001",
                bodyMarkdownPath: "implementation-issues/001-initial_pr.md",
                sourceStage: "initial_pr"
              })
            ])
          }
        },
        reviewProtocol: {
          deliveryGates: expect.arrayContaining([
            expect.stringContaining("ImplementationStepLedger trackerDoc"),
            expect.stringContaining("two consecutive no-finding passes")
          ]),
          stageGates: expect.arrayContaining([
            expect.objectContaining({
              stage: "final_verify_pr_update",
              gates: expect.arrayContaining([
                expect.stringContaining("Update the PR description")
              ])
            })
          ])
        }
      });
      expect(gitHead).toContain("refs/heads/main");
      expect(gitStatus).toBe("");
      expect(bootstrapCommitMessage).toBe("Bootstrap Solo Superman implementation workspace");
      expect(bootstrapTagSha).toBe(headCommitSha);

      const replay = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:test",
        projectName: "Demo Workspace App"
      });
      const replayProjection = jsonDataRecord(await jsonBody(replay));

      expect(replay.status).toBe(200);
      expect(replayProjection).toMatchObject({
        version: 1
      });
      expect(replayProjection.runs as readonly unknown[]).toHaveLength(1);
      expect(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: projectDir, encoding: "utf8" }).trim())
        .toBe(commitCountBeforeReplay);
      expect(execFileSync("git", ["status", "--short"], { cwd: projectDir, encoding: "utf8" })).toBe("");
    } finally {
      await storage.close();
    }
  });

  it("can prepare a run for a selected Planning Handoff PR-sized issue slice", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { sessionId } = await createProjectForTest(
        storageApp,
        "A selected PR-sized implementation slice test"
      );
      await ensurePlanningReadyForAutoImplementationTest(storageApp, sessionId);
      const planningResponse = await storageApp.request(`/api/v1/sessions/${sessionId}/planning-handoff`, {
        headers: authHeaders()
      });
      const planningProjection = jsonDataRecord(await jsonBody(planningResponse));
      const finalArtifact = planningProjection.finalArtifact as Readonly<Record<string, unknown>>;
      const prIssuePlan = finalArtifact.prIssuePlan as readonly Readonly<Record<string, unknown>>[];
      const selectedPlanningIssueId = String(prIssuePlan[1]?.sequenceId);

      const response = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: `auto-implementation-route:selected:${selectedPlanningIssueId}`,
        projectName: "Selected Planning Slice App",
        planningIssueId: selectedPlanningIssueId
      });
      const body = await jsonBody(response);
      const latestRun = latestAutoImplementationRunFromBody(body);
      const issueManagement = latestRun.issueManagement as Readonly<Record<string, unknown>>;
      const planningIssueDocs = issueManagement.planningIssueDocs as readonly Readonly<Record<string, unknown>>[];
      const projectDir = join(workspaceRoot, "selected-planning-slice-app");
      const tracker = await readFile(join(projectDir, "implementation-tracker.md"), "utf8");

      expect(response.status).toBe(200);
      expect(issueManagement.planningIssueSequenceTrackerRelativePath).toBe("planning-handoff-pr-issue-sequence.md");
      expect(planningIssueDocs[0]).toMatchObject({ status: "completed" });
      expect(planningIssueDocs[1]).toMatchObject({
        issueId: selectedPlanningIssueId,
        status: "active"
      });
      expect(latestRun.evidenceRefs as readonly string[]).toEqual(expect.arrayContaining([
        expect.stringMatching(/^planning-handoff-active-pr-issue:planning-handoff-pr-issues\//u)
      ]));
      expect(tracker).toContain(`${selectedPlanningIssueId}:`);
      expect(tracker).toContain("(active; planning-handoff-pr-issues/");
    } finally {
      await storage.close();
    }
  });

  it("creates bounded local Codex worker jobs for the current auto implementation issue document", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { projectId, sessionId } = await createProjectForTest(
        storageApp,
        "An auto implementation local worker job test"
      );
      const created = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:worker-job",
        projectName: "Worker Job Demo"
      });
      const createdRun = latestAutoImplementationRunFromBody(await jsonBody(created));
      const runId = String(createdRun.runId);
      const planningIssueEvidenceRefs = (createdRun.evidenceRefs as readonly string[]).filter((ref) =>
        ref.startsWith("planning-handoff-pr-issue:")
      );
      expect(planningIssueEvidenceRefs.length).toBeGreaterThan(0);
      const firstPlanningIssueEvidenceRef = planningIssueEvidenceRefs[0]!;
      const blockedJobResponse = await postAutoImplementationWorkerJobForTest(storageApp, sessionId, runId, {
        idempotencyKey: "worker-job:missing-authority"
      });
      const blockedJobRun = latestAutoImplementationRunFromBody(await jsonBody(blockedJobResponse));
      const blockedJobs = blockedJobRun.workerJobs as readonly Readonly<Record<string, unknown>>[];
      const blockedIssueDocs = (blockedJobRun.issueManagement as Readonly<Record<string, unknown>>)
        .issueDocs as readonly Readonly<Record<string, unknown>>[];
      const blockedManifest = JSON.parse(
        await readFile(join(workspaceRoot, "worker-job-demo", ".solo-superman", "auto-implementation-run.json"), "utf8")
      ) as Readonly<Record<string, unknown>>;
      const blockedManifestIssueDocs = ((blockedManifest.issueManagement as Readonly<Record<string, unknown>>)
        .issueDocs ?? []) as readonly Readonly<Record<string, unknown>>[];
      const blockedWorkerIssue = await readFile(
        join(workspaceRoot, "worker-job-demo", "implementation-issues", "001-initial_pr.md"),
        "utf8"
      );

      expect(blockedJobResponse.status).toBe(200);
      expect(blockedJobRun).toMatchObject({
        status: "blocked",
        currentStage: "initial_pr"
      });
      expect(blockedJobs).toHaveLength(1);
      expect(blockedJobs[0]).toMatchObject({
        runId,
        stage: "initial_pr",
        issueId: "local-001",
        issueRelativePath: "implementation-issues/001-initial_pr.md",
        status: "blocked",
        blockedReason: expect.stringContaining("ExecutionAuthorityRecord"),
        missingEvidence: ["ExecutionAuthorityRecord"],
        executionPlan: {
          executionMode: "local_sandboxed_codex",
          workingDirectory: join(workspaceRoot, "worker-job-demo"),
          issueDocumentPath: "implementation-issues/001-initial_pr.md",
          executionAuthorityRef: null,
          forbiddenActions: expect.arrayContaining([
            expect.stringContaining("credential"),
            expect.stringContaining("production deploy")
          ]),
          requiredEvidence: expect.arrayContaining([
            expect.stringContaining("ImplementationStepLedger"),
            expect.stringContaining("Planning Handoff PR-sized issue refs"),
            expect.stringContaining("separate CodeReviewRecord ids"),
            expect.stringContaining("separate CleanCodeReviewRecord ids"),
            expect.stringContaining("MissingTestAuditRecord"),
            expect.stringContaining("generated-product product-slice JSON/module"),
            expect.stringContaining("StepCommitRecord.changedFiles includes a generated-product path"),
            expect.stringContaining("evidence refs"),
            expect.stringContaining("initial implementation PR evidence")
          ]),
          allowedWriteScope: expect.arrayContaining([
            "generated-product/product-slice.json",
            "generated-product/src/product-slice.mjs",
            "generated-product/src/product-slice.test.mjs"
          ]),
          sourceRefs: expect.arrayContaining([firstPlanningIssueEvidenceRef])
        }
      });
      expect(blockedJobs[0]!.evidenceRefs).toEqual(expect.arrayContaining([firstPlanningIssueEvidenceRef]));
      expect(blockedIssueDocs[0]).toMatchObject({
        issueId: "local-001",
        status: "blocked"
      });
      expect(blockedJobRun.issueManagement).toMatchObject({
        issueStatusSummary: {
          total: 7,
          open: 6,
          completed: 0,
          blocked: 1
        }
      });
      expect(blockedManifestIssueDocs[0]).toMatchObject({
        issueId: "local-001",
        status: "blocked"
      });
      expect(blockedManifest.issueManagement).toMatchObject({
        issueStatusSummary: {
          total: 7,
          open: 6,
          completed: 0,
          blocked: 1
        }
      });
      expect(blockedWorkerIssue).toContain("- Issue status: blocked");
      expect(blockedWorkerIssue).toContain("- Issue status summary: 0 completed / 1 blocked / 6 open / 7 total");
      expect(blockedWorkerIssue).toContain(`- Latest stage worker job: ${String(blockedJobs[0]!.jobId)} (blocked)`);
      expect(blockedWorkerIssue).toContain("- Latest stage worker missing evidence: ExecutionAuthorityRecord");
      expect(blockedWorkerIssue).toContain(`- Latest stage worker evidence refs: ${String(blockedJobs[0]!.jobId)}`);

      const replay = await postAutoImplementationWorkerJobForTest(storageApp, sessionId, runId, {
        idempotencyKey: "worker-job:missing-authority"
      });
      const replayRun = latestAutoImplementationRunFromBody(await jsonBody(replay));

      expect(replay.status).toBe(200);
      expect(replayRun.workerJobs as readonly unknown[]).toHaveLength(1);

      const invalidAuthorityRefResponse = await postAutoImplementationWorkerJobForTest(storageApp, sessionId, runId, {
        idempotencyKey: "worker-job:invalid-authority-ref",
        executionAuthorityRef: "not_an_execution_authority_record"
      });
      const invalidAuthorityRefBody = await jsonBody(invalidAuthorityRefResponse);

      expect(invalidAuthorityRefResponse.status).toBe(400);
      expect(invalidAuthorityRefBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "executionAuthorityRef must reference an ExecutionAuthorityRecord id.",
        details: {
          expectedPrefix: "exec_auth_"
        }
      });

      const fakeAuthorityResponse = await postAutoImplementationWorkerJobForTest(storageApp, sessionId, runId, {
        idempotencyKey: "worker-job:fake-authority",
        executionAuthorityRef: "exec_auth_missing_auto_worker_initial_pr"
      });
      const fakeAuthorityRun = latestAutoImplementationRunFromBody(await jsonBody(fakeAuthorityResponse));
      const fakeAuthorityJobs = fakeAuthorityRun.workerJobs as readonly Readonly<Record<string, unknown>>[];

      expect(fakeAuthorityResponse.status).toBe(200);
      expect(fakeAuthorityRun).toMatchObject({
        status: "blocked"
      });
      expect(fakeAuthorityJobs.at(-1)).toMatchObject({
        status: "blocked",
        missingEvidence: ["ExecutionAuthorityRecord"],
        executionPlan: {
          executionAuthorityRef: "exec_auth_missing_auto_worker_initial_pr"
        },
        nextRequiredAction: expect.stringContaining("ExecutionAuthorityRecord")
      });

      const { recordId: previewOnlyAuthorityId } = await createExecutionAuthorityForTest(
        storageApp,
        sessionId,
        "auto_worker_preview_only",
        {
          actionClass: "external_mutation_preview_only",
          requestedScope: {
            browserTargetRef: "browser_target_auto_worker_preview_only"
          },
          sandboxBoundary: {
            mode: "browser_preview_session",
            networkPolicy: "blocked",
            secretPolicy: "no_secret_values"
          },
          rollbackReference: undefined
        }
      );
      const previewOnlyJobResponse = await postAutoImplementationWorkerJobForTest(storageApp, sessionId, runId, {
        idempotencyKey: "worker-job:preview-only-authority",
        executionAuthorityRef: previewOnlyAuthorityId
      });
      const previewOnlyJobRun = latestAutoImplementationRunFromBody(await jsonBody(previewOnlyJobResponse));
      const previewOnlyJobs = previewOnlyJobRun.workerJobs as readonly Readonly<Record<string, unknown>>[];

      expect(previewOnlyJobResponse.status).toBe(200);
      expect(previewOnlyJobs.at(-1)).toMatchObject({
        status: "blocked",
        missingEvidence: ["ExecutionAuthorityRecord.ready_for_execution"],
        blockedReason: expect.stringContaining("ready_for_execution"),
        executionPlan: {
          executionAuthorityRef: previewOnlyAuthorityId
        }
      });

      const { recordId: wrongScopeAuthorityId } = await createExecutionAuthorityForTest(
        storageApp,
        sessionId,
        "auto_worker_wrong_scope"
      );
      const wrongScopeJobResponse = await postAutoImplementationWorkerJobForTest(storageApp, sessionId, runId, {
        idempotencyKey: "worker-job:wrong-scope-authority",
        executionAuthorityRef: wrongScopeAuthorityId
      });
      const wrongScopeJobRun = latestAutoImplementationRunFromBody(await jsonBody(wrongScopeJobResponse));
      const wrongScopeJobs = wrongScopeJobRun.workerJobs as readonly Readonly<Record<string, unknown>>[];

      expect(wrongScopeJobResponse.status).toBe(200);
      expect(wrongScopeJobs.at(-1)).toMatchObject({
        status: "blocked",
        missingEvidence: ["ExecutionAuthorityRecord.generated_workspace_scope"],
        blockedReason: expect.stringContaining("generated workspace"),
        executionPlan: {
          executionAuthorityRef: wrongScopeAuthorityId
        }
      });

      const { recordId: wrongActionAuthorityId } = await createExecutionAuthorityForTest(
        storageApp,
        sessionId,
        "auto_worker_wrong_action",
        {
          actionClass: "shell_command",
          requestedScope: {
            workspaceRef: join(workspaceRoot, "worker-job-demo"),
            commandAllowlistRef: "allowlist:auto-worker",
            maxDurationMs: 300_000
          },
          sandboxBoundary: {
            mode: "command_sandbox",
            networkPolicy: "blocked",
            secretPolicy: "no_secret_values"
          },
          rollbackReference: {
            kind: "command_compensating_action",
            ref: "rollback_auto_worker_shell"
          }
        }
      );
      const wrongActionJobResponse = await postAutoImplementationWorkerJobForTest(storageApp, sessionId, runId, {
        idempotencyKey: "worker-job:wrong-action-authority",
        executionAuthorityRef: wrongActionAuthorityId
      });
      const wrongActionJobRun = latestAutoImplementationRunFromBody(await jsonBody(wrongActionJobResponse));
      const wrongActionJobs = wrongActionJobRun.workerJobs as readonly Readonly<Record<string, unknown>>[];

      expect(wrongActionJobResponse.status).toBe(200);
      expect(wrongActionJobs.at(-1)).toMatchObject({
        status: "blocked",
        missingEvidence: ["ExecutionAuthorityRecord.file_diff_action"],
        blockedReason: expect.stringContaining("file_diff"),
        executionPlan: {
          executionAuthorityRef: wrongActionAuthorityId
        }
      });

      const { recordId: authorityRecordId } = await createExecutionAuthorityForTest(
        storageApp,
        sessionId,
        "auto_worker_initial_pr",
        {
          requestedScope: {
            workspaceRef: join(workspaceRoot, "worker-job-demo"),
            filePathGlobs: ["**/*"]
          }
        }
      );
      const plannedJobResponse = await postAutoImplementationWorkerJobForTest(storageApp, sessionId, runId, {
        idempotencyKey: "worker-job:with-authority",
        executionAuthorityRef: authorityRecordId
      });
      const plannedJobRun = latestAutoImplementationRunFromBody(await jsonBody(plannedJobResponse));
      const plannedJobs = plannedJobRun.workerJobs as readonly Readonly<Record<string, unknown>>[];

      expect(plannedJobResponse.status).toBe(200);
      expect(plannedJobRun).toMatchObject({
        status: "running",
        currentStage: "initial_pr"
      });
      expect(plannedJobs).toHaveLength(6);
      expect(plannedJobs[5]).toMatchObject({
        status: "planned",
        missingEvidence: [],
        blockedReason: null,
        nextRequiredAction: expect.stringContaining("ImplementationStepLedger evidence"),
        executionPlan: {
          executionAuthorityRef: authorityRecordId,
          sourceRefs: expect.arrayContaining([
            firstPlanningIssueEvidenceRef,
            "generated-software-artifact:generated-product/product-slice.json",
            "generated-software-artifact:generated-product/src/product-slice.mjs"
          ]),
          ledgerTrackerDoc: {
            trackerId: `auto-implementation-tracker:${runId}`,
            sourceRefs: expect.arrayContaining([
              `auto-implementation-run:${runId}`,
              "tracker-doc:implementation-tracker.md"
            ])
          },
          ledgerStepDoc: {
            stepId: `auto-implementation-step:${runId}:initial_pr:local-001`,
            sourceRefs: expect.arrayContaining([
              `auto-implementation-worker-job:${String(plannedJobs[5]!.jobId)}`,
              "issue-doc:implementation-issues/001-initial_pr.md",
              "planning-handoff-plan:planning-handoff-implementation-plan.md",
              firstPlanningIssueEvidenceRef,
              "generated-software-artifact:generated-product/product-slice.json"
            ])
          }
        },
        evidenceRefs: expect.arrayContaining([
          firstPlanningIssueEvidenceRef,
          `execution-authority:${authorityRecordId}`
        ])
      });

      const duplicateCurrentStageJobResponse = await postAutoImplementationWorkerJobForTest(
        storageApp,
        sessionId,
        runId,
        {
          idempotencyKey: "worker-job:duplicate-current-stage",
          executionAuthorityRef: authorityRecordId
        }
      );
      const duplicateCurrentStageJobBody = await jsonBody(duplicateCurrentStageJobResponse);

      expect(duplicateCurrentStageJobResponse.status).toBe(400);
      expect(duplicateCurrentStageJobBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: expect.stringContaining("already has a usable local Codex worker job")
      });

      const plannedJobId = String(plannedJobs[5]!.jobId);
      const plannedWorkerStepId = workerPlanLedgerDocsForTest(plannedJobs[5]!).stepDoc.stepId;
      const missingLedgerCompletion = await postAutoImplementationWorkerJobCompletionForTest(
        storageApp,
        sessionId,
        runId,
        plannedJobId,
        {
          idempotencyKey: "worker-job-complete:missing-ledger",
          implementationStepId: "step_demo",
          evidenceRefs: ["worker-job:complete-attempt"]
        }
      );
      const missingLedgerCompletionRun = latestAutoImplementationRunFromBody(await jsonBody(missingLedgerCompletion));
      const missingLedgerCompletionJobs = missingLedgerCompletionRun.workerJobs as readonly Readonly<Record<string, unknown>>[];

      expect(missingLedgerCompletion.status).toBe(200);
      expect(missingLedgerCompletionRun).toMatchObject({
        status: "blocked",
        currentStage: "initial_pr"
      });
      expect(missingLedgerCompletionJobs.at(-1)).toMatchObject({
        status: "blocked",
        missingEvidence: ["ImplementationStepLedger completed step"],
        nextRequiredAction: expect.stringContaining("ImplementationStepLedger")
      });

      await createProjectionRepository(storage.db).save({
        projectId: projectId as ProjectId,
        sessionId: sessionId as SessionId,
        projection: {
          ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
          sessionId: sessionId as SessionId,
          refetchUrl: `/api/v1/sessions/${sessionId}/implementation-step-ledger`,
          schemaVersion: IMPLEMENTATION_STEP_LEDGER_SCHEMA_VERSION
        },
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        updatedAt: "2026-05-20T00:05:00.000Z"
      });

      const mismatchedLedgerCompletionResponse = await postAutoImplementationWorkerJobCompletionForTest(
        storageApp,
        sessionId,
        runId,
        plannedJobId,
        {
          idempotencyKey: "worker-job-complete:mismatched-ledger-docs",
          implementationStepId: "step_demo",
          evidenceRefs: ["worker-job:complete-mismatched-ledger-docs"]
        }
      );
      const mismatchedLedgerCompletionRun = latestAutoImplementationRunFromBody(
        await jsonBody(mismatchedLedgerCompletionResponse)
      );
      const mismatchedLedgerCompletionJobs = mismatchedLedgerCompletionRun.workerJobs as readonly Readonly<Record<string, unknown>>[];

      expect(mismatchedLedgerCompletionResponse.status).toBe(200);
      expect(mismatchedLedgerCompletionRun).toMatchObject({
        status: "blocked",
        currentStage: "initial_pr"
      });
      expect(mismatchedLedgerCompletionJobs.at(-1)).toMatchObject({
        status: "blocked",
        missingEvidence: ["ImplementationStepLedger completed step"],
        blockedReason: expect.stringContaining("planned worker ledger docs"),
        evidenceRefs: expect.arrayContaining([
          "worker-blocked:missing-implementation-ledger",
          "worker-job:complete-mismatched-ledger-docs"
        ])
      });

      await createProjectionRepository(storage.db).save({
        projectId: projectId as ProjectId,
        sessionId: sessionId as SessionId,
        projection: implementationStepLedgerProjectionForWorkerPlanForTest({
          job: plannedJobs[5]!,
          sessionId,
          refetchUrl: `/api/v1/sessions/${sessionId}/implementation-step-ledger`
        }),
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        updatedAt: "2026-05-20T00:06:00.000Z"
      });

      const completedWorkerJobResponse = await postAutoImplementationWorkerJobCompletionForTest(
        storageApp,
        sessionId,
        runId,
        plannedJobId,
        {
          idempotencyKey: "worker-job-complete:with-ledger",
          implementationStepId: plannedWorkerStepId,
          evidenceRefs: ["worker-job:complete"]
        }
      );
      const completedWorkerJobRun = latestAutoImplementationRunFromBody(await jsonBody(completedWorkerJobResponse));
      const completedWorkerJobs = completedWorkerJobRun.workerJobs as readonly Readonly<Record<string, unknown>>[];
      const completedWorkerStages = completedWorkerJobRun.stagePlan as readonly Readonly<Record<string, unknown>>[];
      const completedWorkerTracker = await readFile(
        join(workspaceRoot, "worker-job-demo", "implementation-tracker.md"),
        "utf8"
      );
      const completedWorkerIssue = await readFile(
        join(workspaceRoot, "worker-job-demo", "implementation-issues", "001-initial_pr.md"),
        "utf8"
      );

      expect(completedWorkerJobResponse.status).toBe(200);
      expect(completedWorkerJobRun).toMatchObject({
        status: "running",
        currentStage: "initial_pr"
      });
      expect(completedWorkerStages[0]).toMatchObject({
        stage: "initial_pr",
        status: "ready",
        ledgerEvidence: null
      });
      expect(completedWorkerJobs.at(-1)).toMatchObject({
        status: "completed",
        missingEvidence: [],
        blockedReason: null,
        nextRequiredAction: expect.stringContaining("existing stage endpoint"),
        evidenceRefs: expect.arrayContaining([
          `implementation-step-ledger:${plannedWorkerStepId}`,
          "commit:abcdef1",
          "test:verify",
          "worker-job:complete"
        ])
      });
      expect(completedWorkerTracker).toContain(`- Latest worker job: ${plannedJobId} (completed)`);
      expect(completedWorkerTracker).toContain("- Stage: initial_pr");
      expect(completedWorkerTracker).toContain("- Issue: local-001 Workspace repo bootstrap and initial implementation PR");
      expect(completedWorkerTracker).toContain("- Missing evidence: none");
      expect(completedWorkerTracker).toContain("- Blocked reason: none");
      expect(completedWorkerIssue).toContain(`- Latest stage worker job: ${plannedJobId} (completed)`);
      expect(completedWorkerIssue).toContain("- Latest stage worker missing evidence: none");
      expect(completedWorkerIssue).toContain(`- Latest stage worker evidence refs: ${plannedJobId}`);
      expect(completedWorkerIssue).toContain("- Required next action: Advance the current auto implementation stage through the existing stage endpoint with the validated ImplementationStepLedger evidence.");
    } finally {
      await storage.close();
    }
  });

  it("imports local worker ledger transitions through the existing ledger reducer without advancing stages", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { sessionId } = await createProjectForTest(
        storageApp,
        "An auto implementation worker ledger import test"
      );
      const created = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:worker-ledger-import",
        projectName: "Worker Ledger Import Demo"
      });
      const runId = String(latestAutoImplementationRunFromBody(await jsonBody(created)).runId);
      const { recordId: authorityRecordId } = await createExecutionAuthorityForTest(
        storageApp,
        sessionId,
        "auto_worker_ledger_import",
        {
          requestedScope: {
            workspaceRef: join(workspaceRoot, "worker-ledger-import-demo"),
            filePathGlobs: ["**/*"]
          }
        }
      );
      const plannedJobResponse = await postAutoImplementationWorkerJobForTest(storageApp, sessionId, runId, {
        idempotencyKey: "worker-job:ledger-import",
        executionAuthorityRef: authorityRecordId
      });
      const plannedJobs = latestAutoImplementationRunFromBody(await jsonBody(plannedJobResponse)).workerJobs as
        readonly Readonly<Record<string, unknown>>[];
      const plannedJobId = String(plannedJobs.at(-1)!.jobId);
      const importResponse = await postAutoImplementationWorkerLedgerImportForTest(
        storageApp,
        sessionId,
        runId,
        plannedJobId,
        {
          idempotencyKey: "worker-ledger-import:completed",
          ledgerTransitions: implementationStepLedgerImportTransitionsForTest(
            workerPlanLedgerDocsForTest(plannedJobs.at(-1)!)
          ) as readonly RecordImplementationStepLedgerPayload[],
          evidenceRefs: ["worker-ledger-import:stdout"]
        }
      );
      const importRun = latestAutoImplementationRunFromBody(await jsonBody(importResponse));
      const importedJobs = importRun.workerJobs as readonly Readonly<Record<string, unknown>>[];
      const importedStages = importRun.stagePlan as readonly Readonly<Record<string, unknown>>[];
      const ledgerResponse = await storageApp.request(`/api/v1/sessions/${sessionId}/implementation-step-ledger`, {
        headers: authHeaders()
      });
      const ledger = jsonDataRecord(await jsonBody(ledgerResponse));
      const expectedWorkerStepId = `auto-implementation-step:${runId}:initial_pr:local-001`;

      expect(importResponse.status).toBe(200);
      expect(importRun).toMatchObject({
        status: "running",
        currentStage: "initial_pr"
      });
      expect(importedStages[0]).toMatchObject({
        stage: "initial_pr",
        status: "ready",
        ledgerEvidence: null
      });
      expect(importedJobs.at(-1)).toMatchObject({
        status: "completed",
        missingEvidence: [],
        blockedReason: null,
        nextRequiredAction: expect.stringContaining("existing stage endpoint"),
        evidenceRefs: expect.arrayContaining([
          `auto-worker-ledger-import:${plannedJobId}:worker-ledger-import:completed`,
          `implementation-step-ledger:${expectedWorkerStepId}`,
          "commit:abcdef1",
          "test:verify",
          "worker-ledger-import:completed",
          "worker-ledger-import:stdout"
        ])
      });
      expect(ledgerResponse.status).toBe(200);
      expect(ledger).toMatchObject({
        kind: "ImplementationStepLedgerProjection",
        currentStatus: "completed",
        summary: expect.stringContaining("completed")
      });

      const invalidTickResponse = await postAutoImplementationWorkerStageAdvanceForTest(
        storageApp,
        sessionId,
        runId,
        plannedJobId,
        {
          idempotencyKey: "worker-stage-advance:invalid-tick",
          tickedAt: "not-an-iso-date",
          evidenceRefs: ["worker-stage-advance:invalid-tick"]
        }
      );
      const invalidTickBody = await jsonBody(invalidTickResponse);

      expect(invalidTickResponse.status).toBe(400);
      expect(invalidTickBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "tickedAt must be an ISO timestamp."
      });

      const advancedFromWorkerResponse = await postAutoImplementationWorkerStageAdvanceForTest(
        storageApp,
        sessionId,
        runId,
        plannedJobId,
        {
          idempotencyKey: "worker-stage-advance:completed-ledger",
          tickedAt: "2026-05-20T00:10:00.000Z",
          evidenceRefs: ["worker-stage-advance:completed"]
        }
      );
      const advancedFromWorkerRun = latestAutoImplementationRunFromBody(await jsonBody(advancedFromWorkerResponse));
      const advancedStages = advancedFromWorkerRun.stagePlan as readonly Readonly<Record<string, unknown>>[];

      expect(advancedFromWorkerResponse.status).toBe(200);
      expect(advancedFromWorkerRun).toMatchObject({
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
          `auto-worker-stage-advance:${plannedJobId}:worker-stage-advance:completed-ledger`,
          "worker-stage-advance:completed",
          "worker-ledger-import:completed"
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

  it("keeps manual worker ledger imports bound to the planned ledger docs", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { sessionId, runId, plannedJobId } = await createRunnableAutoImplementationWorkerJobForTest({
        storageApp,
        workspaceRoot,
        idea: "An auto implementation manual ledger import planned-doc binding test",
        runIdempotencyKey: "auto-implementation-route:manual-ledger-import-binding",
        projectName: "Manual Ledger Import Binding Demo",
        projectFolderName: "manual-ledger-import-binding-demo",
        authorityIdSuffix: "auto_worker_manual_ledger_import_binding",
        workerJobIdempotencyKey: "worker-job:manual-ledger-import-binding"
      });
      const importResponse = await postAutoImplementationWorkerLedgerImportForTest(
        storageApp,
        sessionId,
        runId,
        plannedJobId,
        {
          idempotencyKey: "worker-ledger-import:mismatched-docs",
          ledgerTransitions: implementationStepLedgerImportTransitionsForTest() as readonly RecordImplementationStepLedgerPayload[],
          evidenceRefs: ["worker-ledger-import:mismatched-docs"]
        }
      );
      const importRun = latestAutoImplementationRunFromBody(await jsonBody(importResponse));
      const importedJobs = importRun.workerJobs as readonly Readonly<Record<string, unknown>>[];

      expect(importResponse.status).toBe(200);
      expect(importRun).toMatchObject({
        status: "blocked",
        currentStage: "initial_pr"
      });
      expect(importedJobs.at(-1)).toMatchObject({
        status: "blocked",
        missingEvidence: ["ImplementationStepLedger import"],
        blockedReason: expect.stringContaining("planned worker ledger docs"),
        nextRequiredAction: expect.stringContaining("Retry the worker ledger import"),
        evidenceRefs: expect.arrayContaining([
          `auto-worker-ledger-import:${plannedJobId}:worker-ledger-import:mismatched-docs`,
          "worker-blocked:ledger-import",
          "worker-ledger-import:mismatched-docs"
        ])
      });
    } finally {
      await storage.close();
    }
  });

  it("runs planned local Codex worker jobs and imports returned ledger evidence", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { sessionId } = await createProjectForTest(
        storageApp,
        "An auto implementation worker run bridge test"
      );
      const created = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:worker-run",
        projectName: "Worker Run Demo"
      });
      const runId = String(latestAutoImplementationRunFromBody(await jsonBody(created)).runId);
      const { recordId: authorityRecordId } = await createExecutionAuthorityForTest(
        storageApp,
        sessionId,
        "auto_worker_run",
        {
          requestedScope: {
            workspaceRef: join(workspaceRoot, "worker-run-demo"),
            filePathGlobs: ["**/*"]
          }
        }
      );
      const plannedJobResponse = await postAutoImplementationWorkerJobForTest(storageApp, sessionId, runId, {
        idempotencyKey: "worker-job:run",
        executionAuthorityRef: authorityRecordId
      });
      const plannedJobs = latestAutoImplementationRunFromBody(await jsonBody(plannedJobResponse)).workerJobs as
        readonly Readonly<Record<string, unknown>>[];
      const plannedJobId = String(plannedJobs.at(-1)!.jobId);
      const runResponse = await postAutoImplementationWorkerRunForTest(
        storageApp,
        sessionId,
        runId,
        plannedJobId,
        {
          idempotencyKey: "worker-run:fixture",
          evidenceRefs: ["worker-run:route-request"]
        }
      );
      const runProjection = latestAutoImplementationRunFromBody(await jsonBody(runResponse));
      const runJobs = runProjection.workerJobs as readonly Readonly<Record<string, unknown>>[];
      const runStages = runProjection.stagePlan as readonly Readonly<Record<string, unknown>>[];
      const ledgerResponse = await storageApp.request(`/api/v1/sessions/${sessionId}/implementation-step-ledger`, {
        headers: authHeaders()
      });
      const ledger = jsonDataRecord(await jsonBody(ledgerResponse));
      const expectedWorkerStepId = `auto-implementation-step:${runId}:initial_pr:local-001`;

      expect(runResponse.status).toBe(200);
      expect(runProjection).toMatchObject({
        status: "running",
        currentStage: "initial_pr"
      });
      expect(runStages[0]).toMatchObject({
        stage: "initial_pr",
        status: "ready",
        ledgerEvidence: null
      });
      expect(runJobs.at(-1)).toMatchObject({
        status: "completed",
        missingEvidence: [],
        blockedReason: null,
        nextRequiredAction: expect.stringContaining("existing stage endpoint"),
        evidenceRefs: expect.arrayContaining([
          `auto-worker-run:${plannedJobId}:worker-run:fixture`,
          `auto-worker-ledger-import:${plannedJobId}:worker-run:fixture:ledger-import`,
          `codex-worker:${plannedJobId}:fixture`,
          "codex-worker:fixture:completed",
          `implementation-step-ledger:${expectedWorkerStepId}`,
          "commit:abcdef1",
          "test:verify",
          "worker-run:route-request"
        ])
      });
      expect(ledgerResponse.status).toBe(200);
      expect(ledger).toMatchObject({
        kind: "ImplementationStepLedgerProjection",
        currentStatus: "completed",
        summary: expect.stringContaining("completed"),
        trackerDoc: {
          trackerId: `auto-implementation-tracker:${runId}`
        },
        steps: expect.arrayContaining([
          expect.objectContaining({
            stepDoc: expect.objectContaining({
              stepId: expectedWorkerStepId,
              sourceRefs: expect.arrayContaining([
                `auto-implementation-worker-job:${plannedJobId}`,
                "issue-doc:implementation-issues/001-initial_pr.md",
                "generated-software-artifact:generated-product/product-slice.json"
              ])
            }),
            stepCommitRecord: expect.objectContaining({
              changedFiles: expect.arrayContaining([
                "generated-product/product-slice.json",
                "generated-product/src/product-slice.mjs"
              ])
            })
          })
        ])
      });
    } finally {
      await storage.close();
    }
  });

  it("keeps worker jobs visibly blocked when completed worker ledger docs do not match the planned docs", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const mismatchedLedgerAdapter = {
      ...fixtureCodexRuntimeAdapter,
      async executeWorker(input: Parameters<CodexRuntimeAdapter["executeWorker"]>[0]) {
        const output = fixtureCodexWorkerExecutionOutput(input);

        return {
          ...output,
          ledgerTransitions: output.ledgerTransitions.map((transition) => ({
            ...transition,
            stepDoc: {
              ...input.ledgerStepDoc,
              stepId: "unexpected-worker-ledger-step"
            }
          })),
          evidenceRefs: [...output.evidenceRefs, "codex-worker:mismatched-ledger-doc"]
        };
      }
    } satisfies CodexRuntimeAdapter;
    const { app: storageApp, storage } = await createMigratedStorageApp(mismatchedLedgerAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { sessionId, runId, plannedJobId } = await createRunnableAutoImplementationWorkerJobForTest({
        storageApp,
        workspaceRoot,
        idea: "An auto implementation worker ledger doc mismatch guard test",
        runIdempotencyKey: "auto-implementation-route:worker-run-ledger-doc-guard",
        projectName: "Worker Run Ledger Doc Guard Demo",
        projectFolderName: "worker-run-ledger-doc-guard-demo",
        authorityIdSuffix: "auto_worker_run_ledger_doc_guard",
        workerJobIdempotencyKey: "worker-job:run-ledger-doc-guard"
      });
      const runResponse = await postAutoImplementationWorkerRunForTest(
        storageApp,
        sessionId,
        runId,
        plannedJobId,
        {
          idempotencyKey: "worker-run:ledger-doc-guard"
        }
      );
      const runProjection = latestAutoImplementationRunFromBody(await jsonBody(runResponse));
      const runJobs = runProjection.workerJobs as readonly Readonly<Record<string, unknown>>[];

      expect(runResponse.status).toBe(200);
      expect(runProjection).toMatchObject({
        status: "blocked",
        currentStage: "initial_pr"
      });
      expect(runJobs.at(-1)).toMatchObject({
        status: "blocked",
        missingEvidence: ["Local Codex worker execution"],
        blockedReason: expect.stringContaining("planned ledger contract"),
        evidenceRefs: expect.arrayContaining([
          `auto-worker-run:${plannedJobId}:worker-run:ledger-doc-guard`,
          "worker-blocked:ledger-contract",
          "codex-worker:mismatched-ledger-doc"
        ])
      });
    } finally {
      await storage.close();
    }
  });

  it("keeps worker jobs visibly blocked when local Codex runtime execution is unavailable", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const unavailableAdapter = {
      ...fixtureCodexRuntimeAdapter,
      async executeWorker() {
        throw new CodexRuntimeUnavailableError("Synthetic local Codex worker unavailable.");
      }
    } satisfies CodexRuntimeAdapter;
    const { app: storageApp, storage } = await createMigratedStorageApp(unavailableAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { sessionId } = await createProjectForTest(
        storageApp,
        "An auto implementation worker unavailable run bridge test"
      );
      const created = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:worker-run-unavailable",
        projectName: "Worker Run Unavailable Demo"
      });
      const runId = String(latestAutoImplementationRunFromBody(await jsonBody(created)).runId);
      const { recordId: authorityRecordId } = await createExecutionAuthorityForTest(
        storageApp,
        sessionId,
        "auto_worker_run_unavailable",
        {
          requestedScope: {
            workspaceRef: join(workspaceRoot, "worker-run-unavailable-demo"),
            filePathGlobs: ["**/*"]
          }
        }
      );
      const plannedJobResponse = await postAutoImplementationWorkerJobForTest(storageApp, sessionId, runId, {
        idempotencyKey: "worker-job:run-unavailable",
        executionAuthorityRef: authorityRecordId
      });
      const plannedJobs = latestAutoImplementationRunFromBody(await jsonBody(plannedJobResponse)).workerJobs as
        readonly Readonly<Record<string, unknown>>[];
      const plannedJobId = String(plannedJobs.at(-1)!.jobId);
      const runResponse = await postAutoImplementationWorkerRunForTest(
        storageApp,
        sessionId,
        runId,
        plannedJobId,
        {
          idempotencyKey: "worker-run:unavailable"
        }
      );
      const runProjection = latestAutoImplementationRunFromBody(await jsonBody(runResponse));
      const runJobs = runProjection.workerJobs as readonly Readonly<Record<string, unknown>>[];

      expect(runResponse.status).toBe(200);
      expect(runProjection).toMatchObject({
        status: "blocked",
        currentStage: "initial_pr"
      });
      expect(runJobs.at(-1)).toMatchObject({
        status: "blocked",
        missingEvidence: ["Local Codex worker execution"],
        blockedReason: "Synthetic local Codex worker unavailable.",
        nextRequiredAction: expect.stringContaining("Retry the local Codex worker run"),
        evidenceRefs: expect.arrayContaining([
          `auto-worker-run:${plannedJobId}:worker-run:unavailable`,
          "worker-blocked:codex-runtime"
        ])
      });
    } finally {
      await storage.close();
    }
  });

  it("recovers runtime-blocked worker jobs through manual ledger import", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const unavailableAdapter = {
      ...fixtureCodexRuntimeAdapter,
      async executeWorker() {
        throw new CodexRuntimeUnavailableError("Synthetic local Codex worker unavailable before manual import.");
      }
    } satisfies CodexRuntimeAdapter;
    const { app: storageApp, storage } = await createMigratedStorageApp(unavailableAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { sessionId, runId, plannedJobId } = await createRunnableAutoImplementationWorkerJobForTest({
        storageApp,
        workspaceRoot,
        idea: "An auto implementation manual worker import recovery test",
        runIdempotencyKey: "auto-implementation-route:worker-run-manual-import-recovery",
        projectName: "Worker Manual Import Recovery Demo",
        projectFolderName: "worker-manual-import-recovery-demo",
        authorityIdSuffix: "auto_worker_manual_import_recovery",
        workerJobIdempotencyKey: "worker-job:manual-import-recovery"
      });
      const runResponse = await postAutoImplementationWorkerRunForTest(
        storageApp,
        sessionId,
        runId,
        plannedJobId,
        {
          idempotencyKey: "worker-run:manual-import-recovery"
        }
      );
      const blockedRun = latestAutoImplementationRunFromBody(await jsonBody(runResponse));
      const blockedJobs = blockedRun.workerJobs as readonly Readonly<Record<string, unknown>>[];
      const importResponse = await postAutoImplementationWorkerLedgerImportForTest(
        storageApp,
        sessionId,
        runId,
        plannedJobId,
        {
          idempotencyKey: "worker-ledger-import:manual-recovery",
          ledgerTransitions: implementationStepLedgerImportTransitionsForTest(
            workerPlanLedgerDocsForTest(blockedJobs.at(-1)!)
          ) as readonly RecordImplementationStepLedgerPayload[],
          evidenceRefs: ["worker-ledger-import:manual-recovery"]
        }
      );
      const importedRun = latestAutoImplementationRunFromBody(await jsonBody(importResponse));
      const importedJobs = importedRun.workerJobs as readonly Readonly<Record<string, unknown>>[];

      expect(runResponse.status).toBe(200);
      expect(blockedJobs.at(-1)).toMatchObject({
        status: "blocked",
        missingEvidence: ["Local Codex worker execution"]
      });
      expect(importResponse.status).toBe(200);
      expect(importedRun).toMatchObject({
        status: "running",
        currentStage: "initial_pr"
      });
      expect(importedJobs.at(-1)).toMatchObject({
        status: "completed",
        missingEvidence: [],
        blockedReason: null,
        nextRequiredAction: expect.stringContaining("existing stage endpoint"),
        evidenceRefs: expect.arrayContaining([
          `auto-worker-ledger-import:${plannedJobId}:worker-ledger-import:manual-recovery`,
          "worker-ledger-import:manual-recovery"
        ])
      });
    } finally {
      await storage.close();
    }
  });

  it("blocks local worker output that contains credential or secret-like text before it can be stored", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const secretLikeValue = "NPM_TOKEN=plain-secret-value";
    const unsafeSecretAdapter = {
      ...fixtureCodexRuntimeAdapter,
      async executeWorker(input: Parameters<CodexRuntimeAdapter["executeWorker"]>[0]) {
        return {
          schemaVersion: CONTRACT_SCHEMA_VERSION,
          jobId: input.jobId,
          status: "completed",
          summary: `Worker leaked ${secretLikeValue} in its output.`,
          ledgerTransitions: implementationStepLedgerImportTransitionsForTest({
            trackerDoc: input.ledgerTrackerDoc,
            stepDoc: input.ledgerStepDoc
          }) as readonly RecordImplementationStepLedgerPayload[],
          evidenceRefs: ["codex-worker:unsafe-secret-output"]
        };
      }
    } satisfies CodexRuntimeAdapter;
    const { app: storageApp, storage } = await createMigratedStorageApp(unsafeSecretAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { sessionId, runId, plannedJobId } = await createRunnableAutoImplementationWorkerJobForTest({
        storageApp,
        workspaceRoot,
        idea: "An auto implementation worker secret guard test",
        runIdempotencyKey: "auto-implementation-route:worker-run-secret-guard",
        projectName: "Worker Run Secret Guard Demo",
        projectFolderName: "worker-run-secret-guard-demo",
        authorityIdSuffix: "auto_worker_run_secret_guard",
        workerJobIdempotencyKey: "worker-job:run-secret-guard"
      });
      const runResponse = await postAutoImplementationWorkerRunForTest(
        storageApp,
        sessionId,
        runId,
        plannedJobId,
        {
          idempotencyKey: "worker-run:secret-guard"
        }
      );
      const runBody = await jsonBody(runResponse);
      const runProjection = latestAutoImplementationRunFromBody(runBody);
      const runJobs = runProjection.workerJobs as readonly Readonly<Record<string, unknown>>[];

      expect(runResponse.status).toBe(200);
      expect(JSON.stringify(runBody)).not.toContain(secretLikeValue);
      expect(runProjection).toMatchObject({
        status: "blocked"
      });
      expect(runJobs.at(-1)).toMatchObject({
        status: "blocked",
        missingEvidence: ["Local Codex worker execution"],
        blockedReason: expect.stringContaining("must not contain credential"),
        nextRequiredAction: expect.stringContaining("Retry the local Codex worker run"),
        evidenceRefs: expect.arrayContaining([
          `auto-worker-run:${plannedJobId}:worker-run:secret-guard`,
          "worker-blocked:codex-runtime"
        ])
      });
    } finally {
      await storage.close();
    }
  });

  it("blocks completed worker output that claims external production mutation evidence", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const unsafeMutationAdapter = {
      ...fixtureCodexRuntimeAdapter,
      async executeWorker(input: Parameters<CodexRuntimeAdapter["executeWorker"]>[0]) {
        return {
          schemaVersion: CONTRACT_SCHEMA_VERSION,
          jobId: input.jobId,
          status: "completed",
          summary: "Worker reports that a production deploy completed.",
          ledgerTransitions: implementationStepLedgerImportTransitionsForTest({
            trackerDoc: input.ledgerTrackerDoc,
            stepDoc: input.ledgerStepDoc
          }) as readonly RecordImplementationStepLedgerPayload[],
          evidenceRefs: ["deploy:production"]
        };
      }
    } satisfies CodexRuntimeAdapter;
    const { app: storageApp, storage } = await createMigratedStorageApp(unsafeMutationAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { sessionId, runId, plannedJobId } = await createRunnableAutoImplementationWorkerJobForTest({
        storageApp,
        workspaceRoot,
        idea: "An auto implementation worker external mutation guard test",
        runIdempotencyKey: "auto-implementation-route:worker-run-external-guard",
        projectName: "Worker Run External Guard Demo",
        projectFolderName: "worker-run-external-guard-demo",
        authorityIdSuffix: "auto_worker_run_external_guard",
        workerJobIdempotencyKey: "worker-job:run-external-guard"
      });
      const runResponse = await postAutoImplementationWorkerRunForTest(
        storageApp,
        sessionId,
        runId,
        plannedJobId,
        {
          idempotencyKey: "worker-run:external-guard"
        }
      );
      const runProjection = latestAutoImplementationRunFromBody(await jsonBody(runResponse));
      const runJobs = runProjection.workerJobs as readonly Readonly<Record<string, unknown>>[];

      expect(runResponse.status).toBe(200);
      expect(runProjection).toMatchObject({
        status: "blocked"
      });
      expect(runJobs.at(-1)).toMatchObject({
        status: "blocked",
        missingEvidence: ["Local Codex worker execution"],
        blockedReason: expect.stringContaining("must not claim external"),
        evidenceRefs: expect.arrayContaining([
          `auto-worker-run:${plannedJobId}:worker-run:external-guard`,
          "worker-blocked:codex-runtime"
        ])
      });
      expect(runJobs.at(-1)?.evidenceRefs).not.toEqual(expect.arrayContaining(["deploy:production"]));
    } finally {
      await storage.close();
    }
  });

  it("keeps worker jobs visibly blocked when imported ledger transitions are incomplete", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { sessionId } = await createProjectForTest(
        storageApp,
        "An auto implementation incomplete worker ledger import test"
      );
      const created = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:worker-ledger-import-incomplete",
        projectName: "Worker Ledger Import Incomplete Demo"
      });
      const runId = String(latestAutoImplementationRunFromBody(await jsonBody(created)).runId);
      const { recordId: authorityRecordId } = await createExecutionAuthorityForTest(
        storageApp,
        sessionId,
        "auto_worker_ledger_import_incomplete",
        {
          requestedScope: {
            workspaceRef: join(workspaceRoot, "worker-ledger-import-incomplete-demo"),
            filePathGlobs: ["**/*"]
          }
        }
      );
      const plannedJobResponse = await postAutoImplementationWorkerJobForTest(storageApp, sessionId, runId, {
        idempotencyKey: "worker-job:ledger-import-incomplete",
        executionAuthorityRef: authorityRecordId
      });
      const plannedJobs = latestAutoImplementationRunFromBody(await jsonBody(plannedJobResponse)).workerJobs as
        readonly Readonly<Record<string, unknown>>[];
      const plannedJobId = String(plannedJobs.at(-1)!.jobId);
      const importResponse = await postAutoImplementationWorkerLedgerImportForTest(
        storageApp,
        sessionId,
        runId,
        plannedJobId,
        {
          idempotencyKey: "worker-ledger-import:incomplete",
          ledgerTransitions: implementationStepLedgerImportTransitionsForTest(
            workerPlanLedgerDocsForTest(plannedJobs.at(-1)!)
          ).slice(0, 1),
          evidenceRefs: ["worker-ledger-import:partial"]
        }
      );
      const importRun = latestAutoImplementationRunFromBody(await jsonBody(importResponse));
      const importedJobs = importRun.workerJobs as readonly Readonly<Record<string, unknown>>[];

      expect(importResponse.status).toBe(200);
      expect(importRun).toMatchObject({
        status: "blocked",
        currentStage: "initial_pr"
      });
      expect(importedJobs.at(-1)).toMatchObject({
        status: "blocked",
        missingEvidence: ["ImplementationStepLedger import"],
        blockedReason: expect.stringContaining("completed ImplementationStepLedger transition"),
        nextRequiredAction: expect.stringContaining("Retry the worker ledger import"),
        evidenceRefs: expect.arrayContaining([
          `auto-worker-ledger-import:${plannedJobId}:worker-ledger-import:incomplete`,
          "worker-blocked:ledger-import",
          "worker-ledger-import:partial"
        ])
      });

      const advanceBlockedJob = await postAutoImplementationWorkerStageAdvanceForTest(
        storageApp,
        sessionId,
        runId,
        plannedJobId,
        {
          idempotencyKey: "worker-stage-advance:blocked-ledger-import"
        }
      );
      const advanceBlockedJobBody = await jsonBody(advanceBlockedJob);

      expect(advanceBlockedJob.status).toBe(400);
      expect(advanceBlockedJobBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "Only completed auto implementation worker jobs can advance their stage."
      });
    } finally {
      await storage.close();
    }
  });

  it("normalizes legacy auto implementation projections before worker job reads and writes", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { projectId, sessionId } = await createProjectForTest(
        storageApp,
        "An auto implementation legacy worker job migration test"
      );
      const created = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:legacy-worker-job",
        projectName: "Legacy Worker Job Demo"
      });
      const projection = jsonDataRecord(await jsonBody(created)) as unknown as AutoImplementationRunProjection;
      const legacyRuns = projection.runs.map((run) => {
        const legacyRun = { ...run } as Record<string, unknown>;
        const issueManagement = { ...(legacyRun.issueManagement as Record<string, unknown>) };

        delete legacyRun.workerJobs;
        delete issueManagement.issueStatusSummary;
        legacyRun.issueManagement = issueManagement;

        return legacyRun;
      });
      const legacyProjection = {
        ...projection,
        latestRun: legacyRuns.at(-1) ?? null,
        runs: legacyRuns
      } as unknown as AutoImplementationRunProjection;

      await createProjectionRepository(storage.db).save({
        projectId: projectId as ProjectId,
        sessionId: sessionId as SessionId,
        projection: legacyProjection,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      const fetched = await storageApp.request(`/api/v1/sessions/${sessionId}/auto-implementation-runs`, {
        headers: authHeaders()
      });
      const fetchedRun = latestAutoImplementationRunFromBody(await jsonBody(fetched));

      expect(fetched.status).toBe(200);
      expect(fetchedRun.workerJobs).toEqual([]);
      expect(fetchedRun.issueManagement).toMatchObject({
        issueStatusSummary: {
          total: 7,
          open: 7,
          completed: 0,
          blocked: 0
        }
      });

      const runId = String(fetchedRun.runId);
      const workerJobResponse = await postAutoImplementationWorkerJobForTest(storageApp, sessionId, runId, {
        idempotencyKey: "worker-job:legacy-missing-authority"
      });
      const workerJobBody = await jsonBody(workerJobResponse);
      const workerJobRun = latestAutoImplementationRunFromBody(workerJobBody);

      expect(workerJobResponse.status).toBe(200);
      expect(workerJobRun.workerJobs as readonly unknown[]).toHaveLength(1);
      expect(workerJobRun).toMatchObject({
        status: "blocked",
        currentStage: "initial_pr"
      });

      const workerJobProjection = jsonDataRecord(workerJobBody) as unknown as AutoImplementationRunProjection;
      const legacyWorkerPlanRuns = workerJobProjection.runs.map((run) => ({
        ...run,
        workerJobs: run.workerJobs.map((job) => {
          const executionPlan = { ...job.executionPlan } as Record<string, unknown>;

          delete executionPlan.ledgerTrackerDoc;
          delete executionPlan.ledgerStepDoc;

          return {
            ...job,
            executionPlan
          };
        })
      }));
      const legacyWorkerPlanProjection = {
        ...workerJobProjection,
        latestRun: legacyWorkerPlanRuns.at(-1) ?? null,
        runs: legacyWorkerPlanRuns
      } as unknown as AutoImplementationRunProjection;

      await createProjectionRepository(storage.db).save({
        projectId: projectId as ProjectId,
        sessionId: sessionId as SessionId,
        projection: legacyWorkerPlanProjection,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      const normalizedWorkerPlanResponse = await storageApp.request(`/api/v1/sessions/${sessionId}/auto-implementation-runs`, {
        headers: authHeaders()
      });
      const normalizedWorkerPlanRun = latestAutoImplementationRunFromBody(await jsonBody(normalizedWorkerPlanResponse));
      const normalizedWorkerJobs = normalizedWorkerPlanRun.workerJobs as readonly Readonly<Record<string, unknown>>[];
      const normalizedWorkerJob = normalizedWorkerJobs.at(-1);

      expect(normalizedWorkerPlanResponse.status).toBe(200);
      expect(normalizedWorkerJob?.executionPlan as Readonly<Record<string, unknown>> | undefined).toMatchObject({
        ledgerTrackerDoc: {
          trackerId: `auto-implementation-tracker:${runId}`
        },
        ledgerStepDoc: {
          stepId: `auto-implementation-step:${runId}:initial_pr:local-001`
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("blocks GitHub issue creation dry runs when remote state is not connected while keeping markdown issues", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { sessionId } = await createProjectForTest(storageApp, "A dry-run GitHub issue request without a remote");
      const response = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:github-issue-dry-run-blocked",
        projectName: "Dry Run Without Remote",
        githubIssueCreation: {
          mode: "dry_run"
        }
      });
      const body = await jsonBody(response);
      const latestRun = latestAutoImplementationRunFromBody(body);
      const issueManagement = latestRun.issueManagement as Readonly<Record<string, unknown>>;

      expect(response.status).toBe(200);
      expect(latestRun).toMatchObject({
        remoteStatus: "no_remote"
      });
      expect(issueManagement).toMatchObject({
        mode: "markdown_fallback",
        githubIssueUrls: [],
        githubIssueMutation: {
          status: "blocked",
          requiredRemoteStatus: "connected",
          mutatesGitHub: false,
          perActionApprovalRequired: true,
          approval: null,
          blockedReason: "GitHub issue creation requires remote status connected; current status is no_remote.",
          createdIssueUrls: [],
          auditEvidenceRefs: ["github-issue-mutation:blocked:no_remote"],
          verifierEvidenceRefs: []
        }
      });
      expect(issueManagement.issueDocs as readonly unknown[]).toHaveLength(7);
      await expect(readFile(
        join(workspaceRoot, "dry-run-without-remote", "implementation-issues", "001-initial_pr.md"),
        "utf8"
      )).resolves.toContain("## Acceptance");
    } finally {
      await storage.close();
    }
  });

  it("applies approved GitHub issue creation through the injected mutation adapter", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const issueCreateInputs: unknown[] = [];
    const issueAdapter: AutoImplementationGitHubIssueMutationAdapter = {
      async createIssues(input) {
        issueCreateInputs.push(input);

        expect(input.projectDir).toBe(join(workspaceRoot, "approved-github-issues"));
        expect(input.plans).toHaveLength(7);
        await expect(readFile(input.plans[0]!.bodyFilePath, "utf8")).resolves.toContain("## Acceptance");

        return {
          createdIssueUrls: input.plans.map((_, index) =>
            `https://github.com/bee-community-master/generated-demo/issues/${index + 101}`
          ),
          auditEvidenceRefs: ["github-issue-mutation:mock-adapter:created"]
        };
      }
    };
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot,
      autoImplementationRemoteStatusProvider: async () => "connected",
      autoImplementationGitHubIssueMutationAdapter: issueAdapter
    });

    try {
      const { sessionId } = await createProjectForTest(storageApp, "An approved GitHub issue mutation test");
      const response = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:github-issue-approved",
        projectName: "Approved GitHub Issues",
        githubIssueCreation: {
          mode: "approved",
          approval: {
            approvalId: "approval_github_issue_create",
            approvedBy: "local_operator",
            approvedAt: "2026-05-05T00:00:00.000Z",
            actionClass: "github_issue_create",
            approvalGranularity: "per_action",
            remoteStatusAtApproval: "connected",
            rollbackPlan: "Close any generated GitHub issues if the run is cancelled.",
            evidenceRefs: ["approval:github-issue-create"]
          },
          verifierEvidenceRefs: ["verifier:github-issue-create-ready"]
        }
      });
      const body = await jsonBody(response);
      const latestRun = latestAutoImplementationRunFromBody(body);
      const issueManagement = latestRun.issueManagement as Readonly<Record<string, unknown>>;
      const githubIssueMutation = issueManagement.githubIssueMutation as Readonly<Record<string, unknown>>;
      const tracker = await readFile(join(workspaceRoot, "approved-github-issues", "implementation-tracker.md"), "utf8");
      const firstIssue = await readFile(
        join(workspaceRoot, "approved-github-issues", "implementation-issues", "001-initial_pr.md"),
        "utf8"
      );

      expect(response.status).toBe(200);
      expect(issueCreateInputs).toHaveLength(1);
      expect(latestRun).toMatchObject({
        remoteStatus: "connected"
      });
      expect(issueManagement).toMatchObject({
        mode: "github_ready",
        githubIssueUrls: [
          "https://github.com/bee-community-master/generated-demo/issues/101",
          "https://github.com/bee-community-master/generated-demo/issues/102",
          "https://github.com/bee-community-master/generated-demo/issues/103",
          "https://github.com/bee-community-master/generated-demo/issues/104",
          "https://github.com/bee-community-master/generated-demo/issues/105",
          "https://github.com/bee-community-master/generated-demo/issues/106",
          "https://github.com/bee-community-master/generated-demo/issues/107"
        ],
        githubIssueMutation: {
          status: "applied",
          mutatesGitHub: true,
          blockedReason: null,
          createdIssueUrls: [
            "https://github.com/bee-community-master/generated-demo/issues/101",
            "https://github.com/bee-community-master/generated-demo/issues/102",
            "https://github.com/bee-community-master/generated-demo/issues/103",
            "https://github.com/bee-community-master/generated-demo/issues/104",
            "https://github.com/bee-community-master/generated-demo/issues/105",
            "https://github.com/bee-community-master/generated-demo/issues/106",
            "https://github.com/bee-community-master/generated-demo/issues/107"
          ],
          verifierEvidenceRefs: ["verifier:github-issue-create-ready"]
        }
      });
      expect(githubIssueMutation.auditEvidenceRefs as readonly string[]).toEqual(
        expect.arrayContaining([
          "github-issue-mutation:approved_ready",
          "github-issue-mutation:applied",
          "github-issue-mutation:mock-adapter:created",
          "approval:github-issue-create"
        ])
      );
      expect(tracker).toContain("- Status: applied");
      expect(tracker).toContain("Created GitHub issue URLs: https://github.com/bee-community-master/generated-demo/issues/101");
      expect(firstIssue).toContain("- GitHub issue URL: https://github.com/bee-community-master/generated-demo/issues/101");

      const duplicateResponse = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:github-issue-approved-duplicate",
        projectName: "Approved GitHub Issues",
        githubIssueCreation: {
          mode: "approved",
          approval: {
            approvalId: "approval_github_issue_create_duplicate",
            approvedBy: "local_operator",
            approvedAt: "2026-05-05T00:01:00.000Z",
            actionClass: "github_issue_create",
            approvalGranularity: "per_action",
            remoteStatusAtApproval: "connected",
            rollbackPlan: "Close duplicate generated GitHub issues if a stale request creates them.",
            evidenceRefs: ["approval:github-issue-create:duplicate"]
          },
          verifierEvidenceRefs: ["verifier:github-issue-create-duplicate-ready"]
        }
      });
      const duplicateRun = latestAutoImplementationRunFromBody(await jsonBody(duplicateResponse));
      const duplicateIssueManagement = duplicateRun.issueManagement as Readonly<Record<string, unknown>>;

      expect(duplicateResponse.status).toBe(200);
      expect(issueCreateInputs).toHaveLength(1);
      expect(duplicateRun.runId).toBe(latestRun.runId);
      expect(duplicateIssueManagement.githubIssueUrls).toEqual(issueManagement.githubIssueUrls);
    } finally {
      await storage.close();
    }
  });

  it("keeps connected GitHub issue dry-runs read-only and refuses blocked remote states", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    let remoteStatus: AutoImplementationRemoteStatus = "connected";
    let mutationAttempts = 0;
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot,
      autoImplementationRemoteStatusProvider: async () => remoteStatus,
      autoImplementationGitHubIssueMutationAdapter: {
        async createIssues() {
          mutationAttempts += 1;
          throw new Error("Mutation adapter must not run for dry-run or blocked remote states.");
        }
      }
    });

    try {
      const { sessionId: dryRunSessionId } = await createProjectForTest(
        storageApp,
        "A connected GitHub issue dry-run test"
      );
      const dryRun = await postAutoImplementationRunForTest(storageApp, dryRunSessionId, {
        idempotencyKey: "auto-implementation-route:github-issue-dry-run-connected",
        projectName: "Connected Dry Run",
        githubIssueCreation: {
          mode: "dry_run"
        }
      });
      const dryRunIssueManagement = latestAutoImplementationRunFromBody(await jsonBody(dryRun)).issueManagement as
        Readonly<Record<string, unknown>>;

      expect(dryRun.status).toBe(200);
      expect(dryRunIssueManagement).toMatchObject({
        mode: "github_ready",
        githubIssueUrls: [],
        githubIssueMutation: {
          status: "dry_run_ready",
          mutatesGitHub: false,
          createdIssueUrls: [],
          auditEvidenceRefs: ["github-issue-mutation:dry_run_ready"]
        }
      });
      expect(mutationAttempts).toBe(0);

      for (const blockedRemoteStatus of ["not_authenticated", "permission_denied", "offline", "unsupported_remote"] as const) {
        remoteStatus = blockedRemoteStatus;
        const { sessionId } = await createProjectForTest(
          storageApp,
          `A blocked GitHub issue mutation test for ${blockedRemoteStatus}`
        );
        const blocked = await postAutoImplementationRunForTest(storageApp, sessionId, {
          idempotencyKey: `auto-implementation-route:github-issue-blocked:${blockedRemoteStatus}`,
          projectName: `Blocked ${blockedRemoteStatus}`,
          githubIssueCreation: {
            mode: "approved",
            approval: {
              approvalId: `approval_${blockedRemoteStatus}`,
              approvedBy: "local_operator",
              approvedAt: "2026-05-05T00:00:00.000Z",
              actionClass: "github_issue_create",
              approvalGranularity: "per_action",
              remoteStatusAtApproval: "connected",
              rollbackPlan: "Close any generated GitHub issues if mutation unexpectedly occurs.",
              evidenceRefs: [`approval:${blockedRemoteStatus}`]
            },
            verifierEvidenceRefs: [`verifier:${blockedRemoteStatus}`]
          }
        });
        const issueManagement = latestAutoImplementationRunFromBody(await jsonBody(blocked)).issueManagement as
          Readonly<Record<string, unknown>>;

        expect(blocked.status).toBe(200);
        expect(issueManagement).toMatchObject({
          mode: "markdown_fallback",
          githubIssueUrls: [],
          githubIssueMutation: {
            status: "blocked",
            mutatesGitHub: false,
            approval: null,
            blockedReason: `GitHub issue creation requires remote status connected; current status is ${blockedRemoteStatus}.`,
            createdIssueUrls: [],
            auditEvidenceRefs: [`github-issue-mutation:blocked:${blockedRemoteStatus}`],
            verifierEvidenceRefs: []
          }
        });
      }

      expect(mutationAttempts).toBe(0);
    } finally {
      await storage.close();
    }
  });

  it("rejects non-canonical local GitHub PR issue links before recording a mutation", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    let mutationAttempts = 0;
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot,
      autoImplementationRemoteStatusProvider: async () => "connected",
      autoImplementationPullRequestMutationAdapter: {
        async mutate() {
          mutationAttempts += 1;
          throw new Error("PR mutation adapter must not run for invalid issueLinks.");
        }
      }
    });

    try {
      const { sessionId } = await createProjectForTest(storageApp, "An invalid PR issue link test");
      const created = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:pr-mutation-invalid-link",
        projectName: "Invalid PR Issue Link"
      });
      const runId = String(latestAutoImplementationRunFromBody(await jsonBody(created)).runId);
      const response = await postAutoImplementationPullRequestMutationForTest(storageApp, sessionId, runId, {
        action: "update_pr_body",
        requestMode: "dry_run",
        idempotencyKey: "pr-mutation:dry-run:invalid-issue-link",
        pullRequestUrl: "https://github.com/bee-community-master/generated-demo/pull/123",
        issueLinks: ["local-001\n### injected heading"],
        implementationScope: "Attempt to inject markdown through a local issue link.",
        reviewStreakRefs: ["code-review:changed:clean-1", "code-review:changed:clean-2"],
        verificationCommands: ["pnpm verify"],
        rollbackNotes: "Dry-run should fail before any PR mutation evidence is recorded.",
        bodyEvidenceRefs: ["pr-body:current-evidence"]
      });
      const body = await jsonBody(response);

      expect(response.status).toBe(400);
      expect(body.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "issueLinks must include only canonical local issue ids like local-001 or canonical GitHub issue URLs."
      });
      expect(mutationAttempts).toBe(0);
    } finally {
      await storage.close();
    }
  });

  it("records connected GitHub PR body update dry-runs without adapter mutation", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    let mutationAttempts = 0;
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot,
      autoImplementationRemoteStatusProvider: async () => "connected",
      autoImplementationPullRequestMutationAdapter: {
        async mutate() {
          mutationAttempts += 1;
          throw new Error("PR mutation adapter must not run for dry-run requests.");
        }
      }
    });

    try {
      const { sessionId } = await createProjectForTest(storageApp, "A connected GitHub PR dry-run test");
      const created = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:pr-mutation-dry-run",
        projectName: "Connected PR Dry Run"
      });
      const runId = String(latestAutoImplementationRunFromBody(await jsonBody(created)).runId);
      const response = await postAutoImplementationPullRequestMutationForTest(storageApp, sessionId, runId, {
        action: "update_pr_body",
        requestMode: "dry_run",
        idempotencyKey: "pr-mutation:dry-run:update-body",
        pullRequestUrl: "https://github.com/bee-community-master/generated-demo/pull/123",
        issueLinks: ["local-001", "https://github.com/bee-community-master/generated-demo/issues/101"],
        implementationScope: "Refresh the generated implementation PR body with current review and test evidence.",
        reviewStreakRefs: ["code-review:changed:clean-1", "code-review:changed:clean-2"],
        verificationCommands: ["pnpm test apps/sidecar/src/server.test.ts", "pnpm verify"],
        knownGaps: ["Live gh PR mutation remains unexecuted in this dry-run."],
        rollbackNotes: "Restore the previous PR body if this body update is reverted.",
        bodyEvidenceRefs: ["pr-body:current-evidence"]
      });
      const latestRun = latestAutoImplementationRunFromBody(await jsonBody(response));
      const pullRequestMutations = latestRun.pullRequestMutations as Readonly<Record<string, unknown>>;
      const manifest = JSON.parse(
        await readFile(join(workspaceRoot, "connected-pr-dry-run", ".solo-superman", "auto-implementation-run.json"), "utf8")
      ) as Readonly<Record<string, unknown>>;
      const manifestPullRequestMutations = manifest.pullRequestMutations as Readonly<Record<string, unknown>>;
      const tracker = await readFile(join(workspaceRoot, "connected-pr-dry-run", "implementation-tracker.md"), "utf8");

      expect(response.status).toBe(200);
      expect(mutationAttempts).toBe(0);
      expect(pullRequestMutations).toMatchObject({
        latestRecord: {
          action: "update_pr_body",
          requestMode: "dry_run",
          status: "dry_run_ready",
          mutatesGitHub: false,
          pullRequestUrl: "https://github.com/bee-community-master/generated-demo/pull/123",
          issueLinks: ["local-001", "https://github.com/bee-community-master/generated-demo/issues/101"],
          bodyEvidenceRefs: ["pr-body:current-evidence"],
          auditEvidenceRefs: expect.arrayContaining([
            "auto-pr-mutation:update_pr_body:pr-mutation:dry-run:update-body",
            "github-pr-mutation:dry_run_ready"
          ])
        }
      });
      expect(manifestPullRequestMutations).toMatchObject({
        latestRecord: {
          action: "update_pr_body",
          requestMode: "dry_run",
          status: "dry_run_ready",
          pullRequestUrl: "https://github.com/bee-community-master/generated-demo/pull/123",
          bodyEvidenceRefs: ["pr-body:current-evidence"]
        }
      });
      expect(tracker).toContain("- Latest PR mutation: update_pr_body (dry_run_ready)");
      expect(tracker).toContain("- Request mode: dry_run");
      expect(tracker).toContain("- Pull request URL: https://github.com/bee-community-master/generated-demo/pull/123");
      expect(tracker).toContain("- Body evidence refs: pr-body:current-evidence");
      expect(pullRequestMutations.records as readonly unknown[]).toHaveLength(1);
    } finally {
      await storage.close();
    }
  });

  it("applies approved GitHub PR body updates through the injected adapter", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const mutationInputs: unknown[] = [];
    const adapter: AutoImplementationPullRequestMutationAdapter = {
      async mutate(input) {
        mutationInputs.push(input);
        expect(input).toMatchObject({
          projectDir: join(workspaceRoot, "approved-pr-body-update"),
          action: "update_pr_body",
          pullRequestTitle: "Evidence refresh PR",
          pullRequestUrl: "https://github.com/bee-community-master/generated-demo/pull/124"
        });
        expect(input.bodyMarkdown).toContain("### Code review streak evidence");
        expect(input.bodyMarkdown).toContain("### Issue traceability");
        expect(input.bodyMarkdown).toContain(
          "- local-001: Workspace repo bootstrap and initial implementation PR (implementation-issues/001-initial_pr.md; stage: initial_pr; GitHub issue: none)"
        );
        expect(input.bodyMarkdown).toContain(
          "- local-007: Merge verified PR to main (implementation-issues/007-merge_main.md; stage: merge_main; GitHub issue: none)"
        );
        expect(input.bodyMarkdown).toContain("### Issue document status summary");
        expect(input.bodyMarkdown).toContain("- Total issue docs: 7");
        expect(input.bodyMarkdown).toContain("- Completed issue docs: 0/7");
        expect(input.bodyMarkdown).toContain("- Blocked issue docs: 0");
        expect(input.bodyMarkdown).toContain("- Open issue docs: 7");
        expect(input.bodyMarkdown).toContain("- local-001: open; stage: initial_pr; GitHub issue: none");
        expect(input.bodyMarkdown).toContain("- local-007: open; stage: merge_main; GitHub issue: none");
        expect(input.bodyMarkdown).toContain("### Stage status summary");
        expect(input.bodyMarkdown).toContain("- Current stage: initial_pr");
        expect(input.bodyMarkdown).toContain("- Completed stages: 0/7");
        expect(input.bodyMarkdown).toContain("- Open stages: 7");
        expect(input.bodyMarkdown).toContain("- initial_pr: ready; ledger evidence: none");
        expect(input.bodyMarkdown).toContain("- merge_main: pending; ledger evidence: none");
        expect(input.bodyMarkdown).toContain("### Review gate summary");
        expect(input.bodyMarkdown).toContain("#### Code review");
        expect(input.bodyMarkdown).toContain("- feature: missing (1/2 no-finding code-review refs recorded)");
        expect(input.bodyMarkdown).toContain("- repository: missing (1/2 no-finding code-review refs recorded)");
        expect(input.bodyMarkdown).toContain("#### Clean-code review");
        expect(input.bodyMarkdown).toContain("- changed_code: missing (0/2 no-finding clean-code review refs recorded)");
        expect(input.bodyMarkdown).toContain("- repository: missing (0/2 no-finding clean-code review refs recorded)");
        expect(input.bodyMarkdown).toContain("### Evidence gate summary");
        expect(input.bodyMarkdown).toContain("- implementation evidence: missing (0 refs)");
        expect(input.bodyMarkdown).toContain("- test evidence: missing (0 refs)");
        expect(input.bodyMarkdown).toContain("- missing-test audit evidence: missing (0 refs)");
        expect(input.bodyMarkdown).toContain("- PR body evidence: present (1 refs)");
        expect(input.bodyMarkdown).toContain("- merge evidence: missing (0 refs)");
        expect(input.bodyMarkdown).toContain("### Missing-test audit summary");
        expect(input.bodyMarkdown).toContain("- Completed stage audits: 0/7");
        expect(input.bodyMarkdown).toContain("- Zero-gap completed audits: 0/0");
        expect(input.bodyMarkdown).toContain("- Pending stage audits: 7");
        expect(input.bodyMarkdown).toContain("- initial_pr: pending; refs: 0; ledger evidence: none");
        expect(input.bodyMarkdown).toContain("- merge_main: pending; refs: 0; ledger evidence: none");
        expect(input.bodyMarkdown).toContain("#### feature");
        expect(input.bodyMarkdown).toContain("- code-review:feature:clean-1");
        expect(input.bodyMarkdown).toContain("#### repository");
        expect(input.bodyMarkdown).toContain("- code-review:repository:clean-2");
        expect(input.bodyMarkdown).toContain("### Clean-code review streak evidence");
        expect(input.bodyMarkdown).toContain("- no changed_code clean-code review streak evidence recorded");
        expect(input.bodyMarkdown).toContain("- no repository clean-code review streak evidence recorded");
        expect(input.bodyMarkdown).toContain("### Implementation evidence");
        expect(input.bodyMarkdown).toContain("- no completed stage implementation evidence recorded");
        expect(input.bodyMarkdown).toContain("### Test evidence");
        expect(input.bodyMarkdown).toContain("- no completed stage test evidence recorded");
        expect(input.bodyMarkdown).toContain("### Missing-test audit evidence");
        expect(input.bodyMarkdown).toContain("- no completed stage missing-test audit evidence recorded");
        expect(input.bodyMarkdown).toContain("### Verification commands");
        expect(input.bodyMarkdown).toContain("`pnpm verify`");
        expect(input.bodyMarkdown).toContain("- `` pnpm test --grep `canonical link` ``");

        return {
          pullRequestUrl: input.pullRequestUrl ?? "https://github.com/bee-community-master/generated-demo/pull/124",
          auditEvidenceRefs: ["github-pr-mutation:mock-adapter:body-updated"],
          mergeEvidenceRefs: []
        };
      }
    };
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot,
      autoImplementationRemoteStatusProvider: async () => "connected",
      autoImplementationPullRequestMutationAdapter: adapter
    });

    try {
      const { sessionId } = await createProjectForTest(storageApp, "An approved GitHub PR mutation test");
      const created = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:pr-mutation-approved",
        projectName: "Approved PR Body Update"
      });
      const runId = String(latestAutoImplementationRunFromBody(await jsonBody(created)).runId);
      const response = await postAutoImplementationPullRequestMutationForTest(storageApp, sessionId, runId, {
        action: "update_pr_body",
        requestMode: "approved",
        idempotencyKey: "pr-mutation:approved:update-body",
        pullRequestTitle: "Evidence refresh PR",
        pullRequestUrl: "https://github.com/bee-community-master/generated-demo/pull/124",
        issueLinks: ["https://github.com/bee-community-master/generated-demo/issues/101"],
        implementationScope: "Apply the PR body evidence refresh after review and verifier approval.",
        reviewStreakRefs: ["code-review:feature:clean-1", "code-review:repository:clean-2"],
        verificationCommands: ["pnpm verify", "pnpm test --grep `canonical link`"],
        rollbackNotes: "Use gh pr edit with the previous body captured in audit logs.",
        bodyEvidenceRefs: ["pr-body:current-evidence"],
        approval: {
          approvalId: "approval_pr_body_update",
          approvedBy: "local_operator",
          approvedAt: "2026-05-05T00:00:00.000Z",
          actionClass: "github_pr_mutation",
          approvalGranularity: "per_action",
          remoteStatusAtApproval: "connected",
          rollbackPlan: "Reapply the previous PR body if the generated body is wrong.",
          evidenceRefs: ["approval:pr-body-update"]
        },
        verifierEvidenceRefs: ["verifier:pr-body-update-ready"]
      });
      const latestRun = latestAutoImplementationRunFromBody(await jsonBody(response));
      const pullRequestMutations = latestRun.pullRequestMutations as Readonly<Record<string, unknown>>;

      expect(response.status).toBe(200);
      expect(mutationInputs).toHaveLength(1);
      expect(pullRequestMutations).toMatchObject({
        latestRecord: {
          action: "update_pr_body",
          requestMode: "approved",
          status: "applied",
          mutatesGitHub: true,
          pullRequestUrl: "https://github.com/bee-community-master/generated-demo/pull/124",
          verifierEvidenceRefs: ["verifier:pr-body-update-ready"],
          auditEvidenceRefs: expect.arrayContaining([
            "approval:pr-body-update",
            "github-pr-mutation:applied",
            "github-pr-mutation:mock-adapter:body-updated"
          ])
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("applies approved GitHub PR creation through the injected adapter", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const issueAdapter: AutoImplementationGitHubIssueMutationAdapter = {
      async createIssues(input) {
        expect(input.projectDir).toBe(join(workspaceRoot, "approved-pr-open"));
        expect(input.plans).toHaveLength(7);

        return {
          createdIssueUrls: input.plans.map((_, index) =>
            `https://github.com/bee-community-master/generated-demo/issues/${index + 201}`
          ),
          auditEvidenceRefs: ["github-issue-mutation:mock-adapter:created-for-pr-body"]
        };
      }
    };
    const mutationInputs: unknown[] = [];
    const adapter: AutoImplementationPullRequestMutationAdapter = {
      async mutate(input) {
        mutationInputs.push(input);
        expect(input).toMatchObject({
          projectDir: join(workspaceRoot, "approved-pr-open"),
          action: "open_pr",
          pullRequestTitle: "Initial implementation PR",
          pullRequestUrl: null
        });
        expect(input.bodyMarkdown).toContain("### Issue links");
        expect(input.bodyMarkdown).toContain("### Issue traceability");
        expect(input.bodyMarkdown).toContain(
          "- local-001: Workspace repo bootstrap and initial implementation PR (implementation-issues/001-initial_pr.md; stage: initial_pr; GitHub issue: https://github.com/bee-community-master/generated-demo/issues/201)"
        );
        expect(input.bodyMarkdown).toContain(
          "- local-007: Merge verified PR to main (implementation-issues/007-merge_main.md; stage: merge_main; GitHub issue: https://github.com/bee-community-master/generated-demo/issues/207)"
        );
        expect(input.bodyMarkdown).toContain("### Issue document status summary");
        expect(input.bodyMarkdown).toContain("- Total issue docs: 7");
        expect(input.bodyMarkdown).toContain("- Completed issue docs: 1/7");
        expect(input.bodyMarkdown).toContain("- Blocked issue docs: 0");
        expect(input.bodyMarkdown).toContain("- Open issue docs: 6");
        expect(input.bodyMarkdown).toContain(
          "- local-001: completed; stage: initial_pr; GitHub issue: https://github.com/bee-community-master/generated-demo/issues/201"
        );
        expect(input.bodyMarkdown).toContain(
          "- local-007: open; stage: merge_main; GitHub issue: https://github.com/bee-community-master/generated-demo/issues/207"
        );
        expect(input.bodyMarkdown).toContain("### Stage status summary");
        expect(input.bodyMarkdown).toContain("- Completed stages: 1/7");
        expect(input.bodyMarkdown).toContain("- initial_pr: completed; ledger evidence: step_demo");
        expect(input.bodyMarkdown).toContain("### Code review streak evidence");
        expect(input.bodyMarkdown).toContain("### Review gate summary");
        expect(input.bodyMarkdown).toContain("- feature: satisfied (2/2 no-finding code-review refs recorded)");
        expect(input.bodyMarkdown).toContain("- repository: satisfied (2/2 no-finding code-review refs recorded)");
        expect(input.bodyMarkdown).toContain("- changed_code: satisfied (2/2 no-finding clean-code review refs recorded)");
        expect(input.bodyMarkdown).toContain("- repository: satisfied (2/2 no-finding clean-code review refs recorded)");
        expect(input.bodyMarkdown).toContain("### Evidence gate summary");
        expect(input.bodyMarkdown).toContain("- implementation evidence: present (1 refs)");
        expect(input.bodyMarkdown).toContain("- test evidence: present (1 refs)");
        expect(input.bodyMarkdown).toContain("- missing-test audit evidence: present (2 refs)");
        expect(input.bodyMarkdown).toContain("- PR body evidence: missing (0 refs)");
        expect(input.bodyMarkdown).toContain("- merge evidence: missing (0 refs)");
        expect(input.bodyMarkdown).toContain("### Missing-test audit summary");
        expect(input.bodyMarkdown).toContain("- Completed stage audits: 1/7");
        expect(input.bodyMarkdown).toContain("- Zero-gap completed audits: 1/1");
        expect(input.bodyMarkdown).toContain("- Pending stage audits: 6");
        expect(input.bodyMarkdown).toContain("- initial_pr: passed (0 missing targeted-test gaps); refs: 2; ledger evidence: step_demo");
        expect(input.bodyMarkdown).toContain("- merge_main: pending; refs: 0; ledger evidence: none");
        expect(input.bodyMarkdown).toContain("- code-review:feature:review_code_feature_demo_2");
        expect(input.bodyMarkdown).toContain("- code-review:repository:review_code_repository_demo_2");
        expect(input.bodyMarkdown).toContain("### Clean-code review streak evidence");
        expect(input.bodyMarkdown).toContain("- clean-code-review:changed_code:review_clean_changed_demo_2");
        expect(input.bodyMarkdown).toContain("- clean-code-review:repository:review_clean_repository_demo_2");
        expect(input.bodyMarkdown).toContain("### Verification commands");
        expect(input.bodyMarkdown).toContain("### Implementation evidence");
        expect(input.bodyMarkdown).toContain("- commit:abcdef1");
        expect(input.bodyMarkdown).toContain("### Test evidence");
        expect(input.bodyMarkdown).toContain("- test:verify");
        expect(input.bodyMarkdown).toContain("### Missing-test audit evidence");
        expect(input.bodyMarkdown).toContain("- missing-test-audit:demo");
        expect(input.bodyMarkdown).toContain("`pnpm verify`");

        return {
          pullRequestUrl: "https://github.com/bee-community-master/generated-demo/pull/126",
          auditEvidenceRefs: ["github-pr-mutation:mock-adapter:pr-opened"],
          mergeEvidenceRefs: []
        };
      }
    };
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot,
      autoImplementationRemoteStatusProvider: async () => "connected",
      autoImplementationGitHubIssueMutationAdapter: issueAdapter,
      autoImplementationPullRequestMutationAdapter: adapter
    });

    try {
      const { projectId, sessionId } = await createProjectForTest(storageApp, "An approved GitHub PR open test");
      const created = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:pr-open-approved",
        projectName: "Approved PR Open",
        githubIssueCreation: {
          mode: "approved",
          approval: {
            approvalId: "approval_github_issue_create_for_pr_body",
            approvedBy: "local_operator",
            approvedAt: "2026-05-05T00:00:00.000Z",
            actionClass: "github_issue_create",
            approvalGranularity: "per_action",
            remoteStatusAtApproval: "connected",
            rollbackPlan: "Close any generated GitHub issues if the run is cancelled.",
            evidenceRefs: ["approval:github-issue-create:pr-body"]
          },
          verifierEvidenceRefs: ["verifier:github-issue-create-pr-body-ready"]
        }
      });
      const runId = String(latestAutoImplementationRunFromBody(await jsonBody(created)).runId);
      const blockedBeforeInitialStage = await postAutoImplementationPullRequestMutationForTest(
        storageApp,
        sessionId,
        runId,
        {
          action: "open_pr",
          requestMode: "approved",
          idempotencyKey: "pr-mutation:approved:open-pr-before-initial-stage",
          pullRequestTitle: "Initial implementation PR",
          issueLinks: ["https://github.com/bee-community-master/generated-demo/issues/101"],
          implementationScope: "Attempt to open the generated implementation PR before the initial stage is done.",
          reviewStreakRefs: [],
          verificationCommands: ["pnpm verify"],
          rollbackNotes: "Close the generated PR if the approved open action targets the wrong scope.",
          approval: {
            approvalId: "approval_pr_open_before_initial_stage",
            approvedBy: "local_operator",
            approvedAt: "2026-05-05T00:00:00.000Z",
            actionClass: "github_pr_mutation",
            approvalGranularity: "per_action",
            remoteStatusAtApproval: "connected",
            rollbackPlan: "Close the generated pull request if the approved PR open action is wrong.",
            evidenceRefs: ["approval:pr-open:before-initial-stage"]
          },
          verifierEvidenceRefs: ["verifier:pr-open-before-initial-stage-ready"]
        }
      );
      const blockedBeforeInitialStageRun = latestAutoImplementationRunFromBody(await jsonBody(blockedBeforeInitialStage));
      const blockedBeforeInitialStageRecord = (blockedBeforeInitialStageRun.pullRequestMutations as
        Readonly<Record<string, unknown>>).latestRecord as Readonly<Record<string, unknown>>;

      expect(blockedBeforeInitialStage.status).toBe(200);
      expect(mutationInputs).toHaveLength(0);
      expect(blockedBeforeInitialStageRecord).toMatchObject({
        action: "open_pr",
        requestMode: "approved",
        status: "blocked",
        mutatesGitHub: false,
        pullRequestUrl: null,
        blockedReason: "GitHub PR open is blocked until initial_pr has completed validated implementation ledger evidence."
      });

      await createProjectionRepository(storage.db).save({
        projectId: projectId as ProjectId,
        sessionId: sessionId as SessionId,
        projection: {
          ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
          sessionId: sessionId as SessionId,
          refetchUrl: `/api/v1/sessions/${sessionId}/implementation-step-ledger`,
          schemaVersion: IMPLEMENTATION_STEP_LEDGER_SCHEMA_VERSION
        },
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        updatedAt: "2026-05-05T00:00:00.000Z"
      });
      const startedInitialStage = await postAutoImplementationStageForTest(storageApp, sessionId, runId, "initial_pr", {
        idempotencyKey: "auto-stage:start:pr-open-initial",
        action: "start",
        tickedAt: "2026-05-05T00:00:00.000Z",
        evidenceRefs: ["stage:initial_pr:start:pr-open"]
      });
      const completedInitialStage = await postAutoImplementationStageForTest(storageApp, sessionId, runId, "initial_pr", {
        idempotencyKey: "auto-stage:complete:pr-open-initial",
        action: "complete",
        implementationStepId: "step_demo",
        tickedAt: "2026-05-05T00:05:00.000Z",
        evidenceRefs: ["stage:initial_pr:complete:pr-open"]
      });
      const startedInitialStageBody = await jsonBody(startedInitialStage);
      const completedInitialStageBody = await jsonBody(completedInitialStage);
      const response = await postAutoImplementationPullRequestMutationForTest(storageApp, sessionId, runId, {
        action: "open_pr",
        requestMode: "approved",
        idempotencyKey: "pr-mutation:approved:open-pr",
        pullRequestTitle: "Initial implementation PR",
        issueLinks: ["https://github.com/bee-community-master/generated-demo/issues/101"],
        implementationScope: "Open the initial generated implementation PR after dry-run and verifier evidence.",
        reviewStreakRefs: [],
        verificationCommands: ["pnpm verify"],
        rollbackNotes: "Close the generated PR if the approved open action targets the wrong scope.",
        approval: {
          approvalId: "approval_pr_open",
          approvedBy: "local_operator",
          approvedAt: "2026-05-05T00:00:00.000Z",
          actionClass: "github_pr_mutation",
          approvalGranularity: "per_action",
          remoteStatusAtApproval: "connected",
          rollbackPlan: "Close the generated pull request if the approved PR open action is wrong.",
          evidenceRefs: ["approval:pr-open"]
        },
        verifierEvidenceRefs: ["verifier:pr-open-ready"]
      });
      const latestRun = latestAutoImplementationRunFromBody(await jsonBody(response));
      const pullRequestMutations = latestRun.pullRequestMutations as Readonly<Record<string, unknown>>;
      const duplicateOpenResponse = await postAutoImplementationPullRequestMutationForTest(storageApp, sessionId, runId, {
        action: "open_pr",
        requestMode: "approved",
        idempotencyKey: "pr-mutation:approved:duplicate-open-pr",
        pullRequestTitle: "Duplicate initial implementation PR",
        issueLinks: ["https://github.com/bee-community-master/generated-demo/issues/101"],
        implementationScope: "Attempt a duplicate generated implementation PR open after the first PR URL was recorded.",
        reviewStreakRefs: [],
        verificationCommands: ["pnpm verify"],
        rollbackNotes: "Close the generated PR if the approved open action targets the wrong scope.",
        approval: {
          approvalId: "approval_pr_open_duplicate",
          approvedBy: "local_operator",
          approvedAt: "2026-05-05T00:01:00.000Z",
          actionClass: "github_pr_mutation",
          approvalGranularity: "per_action",
          remoteStatusAtApproval: "connected",
          rollbackPlan: "Close the generated pull request if the approved PR open action is wrong.",
          evidenceRefs: ["approval:pr-open:duplicate"]
        },
        verifierEvidenceRefs: ["verifier:pr-open-duplicate-ready"]
      });
      const duplicateOpenRun = latestAutoImplementationRunFromBody(await jsonBody(duplicateOpenResponse));
      const duplicateOpenRecord = (duplicateOpenRun.pullRequestMutations as Readonly<Record<string, unknown>>)
        .latestRecord as Readonly<Record<string, unknown>>;

      expect(startedInitialStage.status).toBe(200);
      expect(startedInitialStageBody.data).toBeTruthy();
      expect(completedInitialStage.status).toBe(200);
      expect(completedInitialStageBody.data).toBeTruthy();
      expect(response.status).toBe(200);
      expect(mutationInputs).toHaveLength(1);
      expect(pullRequestMutations).toMatchObject({
        latestRecord: {
          action: "open_pr",
          requestMode: "approved",
          status: "applied",
          mutatesGitHub: true,
          pullRequestUrl: "https://github.com/bee-community-master/generated-demo/pull/126",
          verifierEvidenceRefs: ["verifier:pr-open-ready"],
          auditEvidenceRefs: expect.arrayContaining([
            "approval:pr-open",
            "github-pr-mutation:applied",
            "github-pr-mutation:mock-adapter:pr-opened"
          ])
        }
      });
      expect(duplicateOpenResponse.status).toBe(200);
      expect(mutationInputs).toHaveLength(1);
      expect(duplicateOpenRecord).toMatchObject({
        action: "open_pr",
        requestMode: "approved",
        status: "blocked",
        mutatesGitHub: false,
        pullRequestUrl: null,
        blockedReason: "GitHub PR open is blocked because a pull request URL is already recorded for this auto implementation run."
      });
    } finally {
      await storage.close();
    }
  });

  it("blocks GitHub PR merges until final verification and current PR body evidence are recorded", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const mutationInputs: unknown[] = [];
    const adapter: AutoImplementationPullRequestMutationAdapter = {
      async mutate(input) {
        mutationInputs.push(input);
        expect(input).toMatchObject({
          action: "merge_pr",
          pullRequestUrl: "https://github.com/bee-community-master/generated-demo/pull/125"
        });

        return {
          pullRequestUrl: input.pullRequestUrl ?? "https://github.com/bee-community-master/generated-demo/pull/125",
          auditEvidenceRefs: ["github-pr-mutation:mock-adapter:merged"],
          mergeEvidenceRefs: ["github-pr-mutation:mock-adapter:merge-completed"]
        };
      }
    };
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot,
      autoImplementationRemoteStatusProvider: async () => "connected",
      autoImplementationPullRequestMutationAdapter: adapter
    });

    function approval(approvalId: string) {
      return {
        approvalId,
        approvedBy: "local_operator",
        approvedAt: "2026-05-05T00:00:00.000Z",
        actionClass: "github_pr_mutation",
        approvalGranularity: "per_action",
        remoteStatusAtApproval: "connected",
        rollbackPlan: "Reopen or revert the merge commit if readiness evidence is wrong.",
        evidenceRefs: [`approval:${approvalId}`]
      };
    }

    function mergeRequest(idempotencyKey: string, overrides: Readonly<Record<string, unknown>> = {}) {
      return {
        action: "merge_pr",
        requestMode: "approved",
        idempotencyKey,
        pullRequestTitle: "Merge-ready implementation PR",
        pullRequestUrl: "https://github.com/bee-community-master/generated-demo/pull/125",
        issueLinks: ["https://github.com/bee-community-master/generated-demo/issues/101"],
        implementationScope: "Merge only after final verifier evidence and current PR body evidence are present.",
        reviewStreakRefs: ["code-review:feature:clean-1", "clean-code-review:repository:clean-2"],
        verificationCommands: ["pnpm verify"],
        rollbackNotes: "Revert the merge commit if post-merge verification fails.",
        mergeEvidenceRefs: ["merge-ready:checks-green"],
        approval: approval(idempotencyKey.replaceAll(":", "_")),
        verifierEvidenceRefs: [`verifier:${idempotencyKey}`],
        ...overrides
      };
    }

    function completedStageLedgerEvidence(stage: string) {
      return {
        implementationStepId: `step_${stage}`,
        trackerDocRef: "implementation-step-ledger:tracker:tracker_demo",
        stepDocRef: `implementation-step-ledger:step:step_${stage}`,
        implementationEvidenceRefs: [`commit:${stage}:abcdef1`],
        codeReviewStreakRefs: [
          `code-review:feature:${stage}:1`,
          `code-review:feature:${stage}:2`,
          `code-review:repository:${stage}:1`,
          `code-review:repository:${stage}:2`
        ],
        cleanCodeReviewStreakRefs: [
          `clean-code-review:changed_code:${stage}:1`,
          `clean-code-review:changed_code:${stage}:2`,
          `clean-code-review:repository:${stage}:1`,
          `clean-code-review:repository:${stage}:2`
        ],
        missingTestAuditRefs: [`missing-test-audit:${stage}:coverage`],
        testEvidenceRefs: [`test:${stage}:verify`],
        blockerEvidenceRefs: [],
        evidenceRefs: [
          `implementation-step-ledger:step_${stage}`,
          `missing-test-audit:${stage}:coverage`,
          `test:${stage}:verify`
        ]
      };
    }

    try {
      const { projectId, sessionId } = await createProjectForTest(storageApp, "A guarded GitHub PR merge test");
      const created = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:pr-merge-gate",
        projectName: "Guarded PR Merge"
      });
      const createdRun = latestAutoImplementationRunFromBody(await jsonBody(created));
      const runId = String(createdRun.runId);
      const finalPrBodyEvidenceRefs = autoImplementationFinalPrBodyEvidenceRefs(runId);
      const blockedBeforeFinalVerify = await postAutoImplementationPullRequestMutationForTest(
        storageApp,
        sessionId,
        runId,
        mergeRequest("pr-mutation:merge:blocked-final", {
          bodyEvidenceRefs: ["pr-body:current-evidence"]
        })
      );
      const blockedBeforeFinalVerifyRun = latestAutoImplementationRunFromBody(await jsonBody(blockedBeforeFinalVerify));
      const blockedBeforeFinalVerifyRecord = (blockedBeforeFinalVerifyRun.pullRequestMutations as
        Readonly<Record<string, unknown>>).latestRecord as Readonly<Record<string, unknown>>;
      const blockedProjection = jsonDataRecord(await jsonBody(await storageApp.request(
        `/api/v1/sessions/${sessionId}/auto-implementation-runs`,
        { headers: authHeaders() }
      ))) as unknown as AutoImplementationRunProjection;
      const blockedRun = blockedProjection.latestRun!;
      const readyStagePlan = blockedRun.stagePlan.map((stage) => {
        if (stage.stage === "merge_main") {
          return {
            ...stage,
            status: "ready" as const,
            nextScheduledAt: "2026-05-20T00:45:00.000Z",
            evidenceRefs: [...stage.evidenceRefs, "auto-stage-ready:merge_main:fixture"],
            ledgerEvidence: null,
            blocker: null
          };
        }

        return {
          ...stage,
          status: "completed" as const,
          nextScheduledAt: "2026-05-20T00:45:00.000Z",
          evidenceRefs: [...stage.evidenceRefs, `stage:${stage.stage}:completed`],
          ledgerEvidence: completedStageLedgerEvidence(stage.stage),
          blocker: null
        };
      });
      const readyRun = {
        ...blockedRun,
        currentStage: "merge_main" as const,
        status: "running" as const,
        nextTickAt: "2026-05-20T00:45:00.000Z",
        stagePlan: readyStagePlan,
        updatedAt: "2026-05-20T00:40:00.000Z"
      };
      const readyProjection = {
        ...blockedProjection,
        version: (Number(blockedProjection.version) + 1) as ProjectionVersion,
        latestRun: readyRun,
        runs: blockedProjection.runs.map((run) => run.runId === runId ? readyRun : run),
        summary: "Auto implementation final verification is ready for PR merge testing."
      };

      await createProjectionRepository(storage.db).save({
        projectId: projectId as ProjectId,
        sessionId: sessionId as SessionId,
        projection: readyProjection,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        updatedAt: "2026-05-20T00:40:00.000Z"
      });

      await createProjectionRepository(storage.db).save({
        projectId: projectId as ProjectId,
        sessionId: sessionId as SessionId,
        projection: {
          ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
          sessionId: sessionId as SessionId,
          refetchUrl: `/api/v1/sessions/${sessionId}/implementation-step-ledger`,
          schemaVersion: IMPLEMENTATION_STEP_LEDGER_SCHEMA_VERSION
        },
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        updatedAt: "2026-05-20T00:44:00.000Z"
      });

      const blockedStaleBodyUpdate = await postAutoImplementationPullRequestMutationForTest(storageApp, sessionId, runId, {
        action: "update_pr_body",
        requestMode: "approved",
        idempotencyKey: "pr-mutation:update-body:blocked-stale-final",
        pullRequestTitle: "Merge-ready implementation PR",
        pullRequestUrl: "https://github.com/bee-community-master/generated-demo/pull/125",
        issueLinks: ["https://github.com/bee-community-master/generated-demo/issues/101"],
        implementationScope: "Attempt to refresh the PR body with evidence that predates final verification.",
        reviewStreakRefs: ["code-review:feature:clean-1", "clean-code-review:repository:clean-2"],
        verificationCommands: ["pnpm verify"],
        rollbackNotes: "Reapply the final verification PR body if this stale update is attempted.",
        bodyEvidenceRefs: ["pr-body:current-evidence"],
        approval: approval("pr_mutation_update_body_blocked_stale_final"),
        verifierEvidenceRefs: ["verifier:pr-mutation:update-body:blocked-stale-final"]
      });
      const blockedStaleBodyUpdateRun = latestAutoImplementationRunFromBody(await jsonBody(blockedStaleBodyUpdate));
      const blockedStaleBodyUpdateRecord = (blockedStaleBodyUpdateRun.pullRequestMutations as
        Readonly<Record<string, unknown>>).latestRecord as Readonly<Record<string, unknown>>;
      const blockedMissingBody = await postAutoImplementationPullRequestMutationForTest(
        storageApp,
        sessionId,
        runId,
        mergeRequest("pr-mutation:merge:blocked-body", {
          bodyEvidenceRefs: []
        })
      );
      const blockedMissingBodyRun = latestAutoImplementationRunFromBody(await jsonBody(blockedMissingBody));
      const blockedMissingBodyRecord = (blockedMissingBodyRun.pullRequestMutations as
        Readonly<Record<string, unknown>>).latestRecord as Readonly<Record<string, unknown>>;
      const blockedStaleBody = await postAutoImplementationPullRequestMutationForTest(
        storageApp,
        sessionId,
        runId,
        mergeRequest("pr-mutation:merge:blocked-stale-body", {
          bodyEvidenceRefs: ["pr-body:current-evidence"]
        })
      );
      const blockedStaleBodyRun = latestAutoImplementationRunFromBody(await jsonBody(blockedStaleBody));
      const blockedStaleBodyRecord = (blockedStaleBodyRun.pullRequestMutations as
        Readonly<Record<string, unknown>>).latestRecord as Readonly<Record<string, unknown>>;
      const blockedMergeMainComplete = await postAutoImplementationStageForTest(storageApp, sessionId, runId, "merge_main", {
        idempotencyKey: "auto-stage:complete:merge-main-before-applied-merge",
        action: "complete",
        implementationStepId: "step_demo",
        tickedAt: "2026-05-20T00:50:00.000Z",
        evidenceRefs: ["stage:merge_main:complete-before-applied-merge"]
      });
      const blockedMergeMainCompleteBody = await jsonBody(blockedMergeMainComplete);
      const applied = await postAutoImplementationPullRequestMutationForTest(storageApp, sessionId, runId, mergeRequest(
        "pr-mutation:merge:applied",
        {
          bodyEvidenceRefs: finalPrBodyEvidenceRefs
        }
      ));
      const appliedRun = latestAutoImplementationRunFromBody(await jsonBody(applied));
      const appliedRecord = (appliedRun.pullRequestMutations as Readonly<Record<string, unknown>>).latestRecord as
        Readonly<Record<string, unknown>>;
      const staleMergeMainVerification = await postAutoImplementationStageForTest(storageApp, sessionId, runId, "merge_main", {
        idempotencyKey: "auto-stage:complete:merge-main-before-post-merge-verify",
        action: "complete",
        implementationStepId: "step_demo",
        tickedAt: "2026-05-20T00:50:00.000Z",
        evidenceRefs: ["stage:merge_main:complete-before-post-merge-verify"]
      });
      const staleMergeMainVerificationBody = await jsonBody(staleMergeMainVerification);
      const postMergeVerifyRef = "post-merge-verify:merge_main:pnpm-verify";

      await createProjectionRepository(storage.db).save({
        projectId: projectId as ProjectId,
        sessionId: sessionId as SessionId,
        projection: {
          ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
          sessionId: sessionId as SessionId,
          steps: IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps.map((step, index) => index === 0
            ? {
                ...step,
                evidenceRefs: [...step.evidenceRefs, postMergeVerifyRef],
                testEvidenceRecord: {
                  ...step.testEvidenceRecord!,
                  evidenceRefs: [...step.testEvidenceRecord!.evidenceRefs, postMergeVerifyRef]
                },
                missingTestAuditRecord: {
                  ...step.missingTestAuditRecord!,
                  coverageEvidenceRefs: [...step.missingTestAuditRecord!.coverageEvidenceRefs, postMergeVerifyRef]
                }
              }
            : step),
          testEvidenceRecords: IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.testEvidenceRecords.map((record, index) =>
            index === 0
              ? {
                  ...record,
                  evidenceRefs: [...record.evidenceRefs, postMergeVerifyRef]
                }
              : record
          ),
          missingTestAuditRecords: IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.missingTestAuditRecords.map((record, index) =>
            index === 0
              ? {
                  ...record,
                  coverageEvidenceRefs: [...record.coverageEvidenceRefs, postMergeVerifyRef]
                }
              : record
          ),
          refetchUrl: `/api/v1/sessions/${sessionId}/implementation-step-ledger`,
          schemaVersion: IMPLEMENTATION_STEP_LEDGER_SCHEMA_VERSION
        },
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        updatedAt: "2026-05-20T00:49:00.000Z"
      });
      const completedMergeMain = await postAutoImplementationStageForTest(storageApp, sessionId, runId, "merge_main", {
        idempotencyKey: "auto-stage:complete:merge-main-after-applied-merge",
        action: "complete",
        implementationStepId: "step_demo",
        tickedAt: "2026-05-20T00:50:00.000Z",
        evidenceRefs: ["stage:merge_main:complete-after-applied-merge"]
      });
      const completedMergeMainRun = latestAutoImplementationRunFromBody(await jsonBody(completedMergeMain));
      const duplicateMerge = await postAutoImplementationPullRequestMutationForTest(storageApp, sessionId, runId, mergeRequest(
        "pr-mutation:merge:duplicate-applied",
        {
          bodyEvidenceRefs: finalPrBodyEvidenceRefs,
          mergeEvidenceRefs: ["merge-ready:duplicate-checks-green"]
        }
      ));
      const duplicateMergeRun = latestAutoImplementationRunFromBody(await jsonBody(duplicateMerge));
      const duplicateMergeRecord = (duplicateMergeRun.pullRequestMutations as Readonly<Record<string, unknown>>).latestRecord as
        Readonly<Record<string, unknown>>;

      expect(blockedBeforeFinalVerify.status).toBe(200);
      expect(blockedBeforeFinalVerifyRecord).toMatchObject({
        action: "merge_pr",
        status: "blocked",
        mutatesGitHub: false,
        blockedReason: "GitHub PR merge is blocked until final_verify_pr_update has completed validated final verification evidence."
      });
      expect(blockedStaleBodyUpdate.status).toBe(200);
      expect(blockedStaleBodyUpdateRecord).toMatchObject({
        action: "update_pr_body",
        status: "blocked",
        mutatesGitHub: false,
        blockedReason: "GitHub PR body update is blocked until the PR body evidence references final_verify_pr_update."
      });
      expect(blockedMissingBody.status).toBe(200);
      expect(blockedMissingBodyRecord).toMatchObject({
        action: "merge_pr",
        status: "blocked",
        mutatesGitHub: false,
        blockedReason: "GitHub PR merge is blocked until the PR body contains current evidence."
      });
      expect(blockedStaleBody.status).toBe(200);
      expect(blockedStaleBodyRecord).toMatchObject({
        action: "merge_pr",
        status: "blocked",
        mutatesGitHub: false,
        blockedReason: "GitHub PR merge is blocked until the PR body is refreshed after final_verify_pr_update evidence."
      });
      expect(blockedMergeMainComplete.status).toBe(400);
      expect(blockedMergeMainCompleteBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "Auto implementation merge_main completion requires an applied GitHub PR merge mutation record."
      });
      expect(applied.status).toBe(200);
      expect(mutationInputs).toHaveLength(1);
      expect(appliedRecord).toMatchObject({
        action: "merge_pr",
        requestMode: "approved",
        status: "applied",
        mutatesGitHub: true,
        pullRequestUrl: "https://github.com/bee-community-master/generated-demo/pull/125",
        bodyEvidenceRefs: finalPrBodyEvidenceRefs,
        mergeEvidenceRefs: expect.arrayContaining([
          "merge-ready:checks-green",
          "github-pr-mutation:mock-adapter:merge-completed"
        ]),
        auditEvidenceRefs: expect.arrayContaining([
          "github-pr-mutation:applied",
          "github-pr-mutation:mock-adapter:merged"
        ])
      });
      expect(staleMergeMainVerification.status).toBe(400);
      expect(staleMergeMainVerificationBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "Auto implementation stage completion requires complete ledger evidence.",
        details: {
          missingEvidence: ["post-merge verification evidence ref for merge_main"]
        }
      });
      expect(completedMergeMain.status).toBe(200);
      expect(completedMergeMainRun).toMatchObject({
        status: "completed",
        currentStage: "merge_main"
      });
      expect(duplicateMerge.status).toBe(200);
      expect(mutationInputs).toHaveLength(1);
      expect(duplicateMergeRecord).toMatchObject({
        action: "merge_pr",
        requestMode: "approved",
        status: "blocked",
        mutatesGitHub: false,
        pullRequestUrl: "https://github.com/bee-community-master/generated-demo/pull/125",
        blockedReason: "GitHub PR merge is blocked because a pull request merge is already recorded for this auto implementation run."
      });
    } finally {
      await storage.close();
    }
  });

  it("advances auto implementation stages only after completed implementation ledger evidence", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { projectId, sessionId } = await createProjectForTest(storageApp, "An auto implementation stage runner test");
      const created = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:stage-runner",
        projectName: "Stage Runner App"
      });
      const createdRun = latestAutoImplementationRunFromBody(await jsonBody(created));
      const runId = createdRun.runId as string;
      const missingLedger = await postAutoImplementationStageForTest(storageApp, sessionId, runId, "initial_pr", {
        idempotencyKey: "auto-stage:complete:missing-ledger",
        action: "complete",
        implementationStepId: "step_demo",
        tickedAt: "2026-05-20T00:05:00.000Z",
        evidenceRefs: ["stage:initial_pr:complete-attempt"]
      });
      const missingLedgerBody = await jsonBody(missingLedger);

      expect(missingLedger.status).toBe(400);
      expect(missingLedgerBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "Auto implementation stage completion requires an ImplementationStepLedger projection."
      });

      await createProjectionRepository(storage.db).save({
        projectId: projectId as ProjectId,
        sessionId: sessionId as SessionId,
        projection: {
          ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
          sessionId: sessionId as SessionId,
          steps: IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps.map((step, index) => index === 0
            ? {
                ...step,
                testEvidenceRecord: {
                  ...step.testEvidenceRecord!,
                  passedTestCount: 0
                }
              }
            : step),
          testEvidenceRecords: IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.testEvidenceRecords.map((record, index) =>
            index === 0
              ? {
                  ...record,
                  passedTestCount: 0
                }
              : record
          ),
          refetchUrl: `/api/v1/sessions/${sessionId}/implementation-step-ledger`,
          schemaVersion: IMPLEMENTATION_STEP_LEDGER_SCHEMA_VERSION
        },
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        updatedAt: "2026-05-20T00:05:30.000Z"
      });

      const invalidLedger = await postAutoImplementationStageForTest(storageApp, sessionId, runId, "initial_pr", {
        idempotencyKey: "auto-stage:complete:invalid-ledger",
        action: "complete",
        implementationStepId: "step_demo",
        tickedAt: "2026-05-20T00:06:00.000Z",
        evidenceRefs: ["stage:initial_pr:complete-attempt"]
      });
      const invalidLedgerBody = await jsonBody(invalidLedger);

      expect(invalidLedger.status).toBe(400);
      expect(invalidLedgerBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "Auto implementation stage completion requires a valid ImplementationStepLedger projection."
      });

      await createProjectionRepository(storage.db).save({
        projectId: projectId as ProjectId,
        sessionId: sessionId as SessionId,
        projection: {
          ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
          sessionId: sessionId as SessionId,
          refetchUrl: `/api/v1/sessions/${sessionId}/implementation-step-ledger`,
          schemaVersion: IMPLEMENTATION_STEP_LEDGER_SCHEMA_VERSION
        },
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        updatedAt: "2026-05-20T00:05:00.000Z"
      });

      const started = await postAutoImplementationStageForTest(storageApp, sessionId, runId, "initial_pr", {
        idempotencyKey: "auto-stage:start:initial-pr",
        action: "start",
        tickedAt: "2026-05-20T00:10:00.000Z",
        evidenceRefs: ["stage:initial_pr:start"]
      });
      const startedRun = latestAutoImplementationRunFromBody(await jsonBody(started));
      const startedStage = (startedRun.stagePlan as readonly Readonly<Record<string, unknown>>[])[0]!;

      expect(started.status).toBe(200);
      expect(startedRun).toMatchObject({
        status: "running",
        currentStage: "initial_pr",
        nextTickAt: "2026-05-20T00:15:00.000Z"
      });
      expect(startedStage).toMatchObject({
        status: "running",
        tickRecords: [
          expect.objectContaining({
            action: "start",
            status: "running",
            recordedAt: "2026-05-20T00:10:00.000Z"
          })
        ]
      });

      const prematureComplete = await postAutoImplementationStageForTest(storageApp, sessionId, runId, "initial_pr", {
        idempotencyKey: "auto-stage:complete:premature-cadence",
        action: "complete",
        implementationStepId: "step_demo",
        tickedAt: "2026-05-20T00:12:00.000Z",
        evidenceRefs: ["stage:initial_pr:complete-before-tick-due"]
      });
      const prematureCompleteBody = await jsonBody(prematureComplete);

      const completed = await postAutoImplementationStageForTest(storageApp, sessionId, runId, "initial_pr", {
        idempotencyKey: "auto-stage:complete:initial-pr",
        action: "complete",
        implementationStepId: "step_demo",
        tickedAt: "2026-05-20T00:15:00.000Z",
        evidenceRefs: ["stage:initial_pr:complete"]
      });
      const completedProjection = jsonDataRecord(await jsonBody(completed));
      const completedRun = completedProjection.latestRun as Readonly<Record<string, unknown>>;
      const completedStages = completedRun.stagePlan as readonly Readonly<Record<string, unknown>>[];
      const completedIssueDocs = (completedRun.issueManagement as Readonly<Record<string, unknown>>)
        .issueDocs as readonly Readonly<Record<string, unknown>>[];
      const completedInitial = completedStages[0]!;
      const nextStage = completedStages[1]!;
      const syncedManifest = JSON.parse(
        await readFile(join(workspaceRoot, "stage-runner-app", ".solo-superman", "auto-implementation-run.json"), "utf8")
      ) as Readonly<Record<string, unknown>>;
      const syncedManifestIssueDocs = ((syncedManifest.issueManagement as Readonly<Record<string, unknown>>)
        .issueDocs ?? []) as readonly Readonly<Record<string, unknown>>[];
      const syncedTracker = await readFile(join(workspaceRoot, "stage-runner-app", "implementation-tracker.md"), "utf8");
      const syncedIssue = await readFile(
        join(workspaceRoot, "stage-runner-app", "implementation-issues", "001-initial_pr.md"),
        "utf8"
      );
      const syncedManifestStages = syncedManifest.stagePlan as readonly Readonly<Record<string, unknown>>[];
      const replay = await postAutoImplementationStageForTest(storageApp, sessionId, runId, "initial_pr", {
        idempotencyKey: "auto-stage:complete:initial-pr",
        action: "complete",
        implementationStepId: "step_demo",
        tickedAt: "2026-05-20T00:15:00.000Z",
        evidenceRefs: ["stage:initial_pr:complete"]
      });
      const replayProjection = jsonDataRecord(await jsonBody(replay));
      const sameKeyNextStage = await postAutoImplementationStageForTest(storageApp, sessionId, runId, "code_review_fix_1", {
        idempotencyKey: "auto-stage:complete:initial-pr",
        action: "start",
        tickedAt: "2026-05-20T00:20:00.000Z",
        evidenceRefs: ["stage:code_review_fix_1:start"]
      });
      const sameKeyNextStageRun = latestAutoImplementationRunFromBody(await jsonBody(sameKeyNextStage));
      const sameKeyNextStageStages = sameKeyNextStageRun.stagePlan as readonly Readonly<Record<string, unknown>>[];
      const reusedLedgerStep = await postAutoImplementationStageForTest(storageApp, sessionId, runId, "code_review_fix_1", {
        idempotencyKey: "auto-stage:complete:reused-step",
        action: "complete",
        implementationStepId: "step_demo",
        tickedAt: "2026-05-20T00:25:00.000Z",
        evidenceRefs: ["stage:code_review_fix_1:complete"]
      });
      const reusedLedgerStepBody = await jsonBody(reusedLedgerStep);

      expect(completed.status).toBe(200);
      expect(completedRun).toMatchObject({
        status: "running",
        currentStage: "code_review_fix_1",
        nextTickAt: "2026-05-20T00:20:00.000Z"
      });
      expect(syncedManifest).toMatchObject({
        runId,
        status: "running",
        currentStage: "code_review_fix_1",
        updatedAt: "2026-05-20T00:15:00.000Z"
      });
      expect(syncedManifestStages[0]).toMatchObject({
        stage: "initial_pr",
        status: "completed",
        ledgerEvidence: {
          implementationStepId: "step_demo",
          implementationEvidenceRefs: ["commit:abcdef1"],
          missingTestAuditRefs: ["missing-test-audit:demo", "test:verify"],
          testEvidenceRefs: ["test:verify"]
        }
      });
      expect(completedIssueDocs[0]).toMatchObject({
        issueId: "local-001",
        status: "completed"
      });
      expect(syncedManifestIssueDocs[0]).toMatchObject({
        issueId: "local-001",
        status: "completed"
      });
      expect(completedRun.issueManagement).toMatchObject({
        issueStatusSummary: {
          total: 7,
          open: 6,
          completed: 1,
          blocked: 0
        }
      });
      expect(syncedManifest.issueManagement).toMatchObject({
        issueStatusSummary: {
          total: 7,
          open: 6,
          completed: 1,
          blocked: 0
        }
      });
      expect(syncedTracker).toContain("- Run status: running");
      expect(syncedTracker).toContain("- Current stage: code_review_fix_1");
      expect(syncedTracker).toContain("- Issue status summary: 1 completed / 0 blocked / 6 open / 7 total");
      expect(syncedTracker).toContain("- 1. initial_pr (Initial implementation and PR creation)");
      expect(syncedTracker).toContain("  - Status: completed");
      expect(syncedTracker).toContain("  - Ledger step: step_demo");
      expect(syncedTracker).toContain("  - Implementation evidence refs: commit:abcdef1");
      expect(syncedTracker).toContain(
        "  - Code review streak summary: feature 2/2 no-finding passes satisfied"
      );
      expect(syncedTracker).toContain(
        "  - Clean-code review streak summary: changed_code 2/2 no-finding passes satisfied"
      );
      expect(syncedTracker).toContain("  - Missing-test audit refs: missing-test-audit:demo, test:verify");
      expect(syncedTracker).toContain(
        "  - Missing-test audit summary: missing_test_audit_demo: 0 missing targeted-test gaps (satisfied)"
      );
      expect(syncedTracker).toContain("  - Test evidence refs: test:verify");
      expect(syncedTracker).toContain(
        "  - Test evidence summary: test_verify_demo: passed; passed 10 / failed 0; not-tested gaps 0; commands pnpm verify"
      );
      expect(syncedIssue).toContain("- Issue status: completed");
      expect(syncedIssue).toContain("- Stage status: completed");
      expect(syncedIssue).toContain("- Issue status summary: 1 completed / 0 blocked / 6 open / 7 total");
      expect(syncedIssue).toContain("- Ledger step: step_demo");
      expect(syncedIssue).toContain("- Implementation evidence refs: commit:abcdef1");
      expect(syncedIssue).toContain("- Code review streak summary: feature 2/2 no-finding passes satisfied");
      expect(syncedIssue).toContain("- Clean-code review streak summary: changed_code 2/2 no-finding passes satisfied");
      expect(syncedIssue).toContain("- Missing-test audit refs: missing-test-audit:demo, test:verify");
      expect(syncedIssue).toContain(
        "- Missing-test audit summary: missing_test_audit_demo: 0 missing targeted-test gaps (satisfied)"
      );
      expect(syncedIssue).toContain("- Test evidence refs: test:verify");
      expect(syncedIssue).toContain(
        "- Test evidence summary: test_verify_demo: passed; passed 10 / failed 0; not-tested gaps 0; commands pnpm verify"
      );
      expect(syncedIssue).toContain("- Stage evidence refs:");
      expect(syncedIssue).toContain("stage:initial_pr:start");
      expect(syncedIssue).toContain("stage:initial_pr:complete");
      expect(syncedIssue).toContain("- Stage blocker evidence refs: none");
      expect(completedInitial).toMatchObject({
        status: "completed",
        ledgerEvidence: {
          implementationStepId: "step_demo",
          trackerDocRef: "implementation-step-ledger:tracker:tracker_demo",
          stepDocRef: "implementation-step-ledger:step:step_demo",
          implementationEvidenceRefs: ["commit:abcdef1"],
          codeReviewStreaks: [
            expect.objectContaining({
              reviewScope: "feature",
              currentNoFindingPasses: 2,
              requiredNoFindingPasses: 2,
              satisfied: true,
              latestReviewIds: ["review_code_feature_demo_1", "review_code_feature_demo_2"]
            }),
            expect.objectContaining({
              reviewScope: "repository",
              currentNoFindingPasses: 2,
              requiredNoFindingPasses: 2,
              satisfied: true,
              latestReviewIds: ["review_code_repository_demo_1", "review_code_repository_demo_2"]
            })
          ],
          cleanCodeReviewStreaks: [
            expect.objectContaining({
              reviewScope: "changed_code",
              currentNoFindingPasses: 2,
              requiredNoFindingPasses: 2,
              satisfied: true,
              latestReviewIds: ["review_clean_changed_demo_1", "review_clean_changed_demo_2"]
            }),
            expect.objectContaining({
              reviewScope: "repository",
              currentNoFindingPasses: 2,
              requiredNoFindingPasses: 2,
              satisfied: true,
              latestReviewIds: ["review_clean_repository_demo_1", "review_clean_repository_demo_2"]
            })
          ],
          missingTestAuditSummary: {
            auditId: "missing_test_audit_demo",
            missingTestGapCount: 0,
            satisfied: true
          },
          testEvidenceSummary: {
            testEvidenceId: "test_verify_demo",
            outcome: "passed",
            passedTestCount: 10,
            failedTestCount: 0,
            notTestedGapCount: 0,
            satisfied: true,
            commands: ["pnpm verify"]
          },
          missingTestAuditRefs: ["missing-test-audit:demo", "test:verify"],
          testEvidenceRefs: ["test:verify"]
        }
      });
      expect((completedInitial.ledgerEvidence as Readonly<Record<string, unknown>>).codeReviewStreakRefs as readonly unknown[])
        .toHaveLength(4);
      expect((completedInitial.ledgerEvidence as Readonly<Record<string, unknown>>).cleanCodeReviewStreakRefs as readonly unknown[])
        .toHaveLength(4);
      expect(nextStage).toMatchObject({
        stage: "code_review_fix_1",
        status: "ready",
        tickRecords: [
          expect.objectContaining({
            action: "tick",
            status: "ready",
            recordedAt: "2026-05-20T00:15:00.000Z"
          })
        ]
      });
      expect(replay.status).toBe(200);
      expect(replayProjection.version).toBe(completedProjection.version);
      expect(sameKeyNextStage.status).toBe(200);
      expect(sameKeyNextStageRun).toMatchObject({
        status: "running",
        currentStage: "code_review_fix_1",
        nextTickAt: "2026-05-20T00:25:00.000Z"
      });
      expect(sameKeyNextStageStages[1]).toMatchObject({
        stage: "code_review_fix_1",
        status: "running",
        tickRecords: [
          expect.objectContaining({
            action: "tick",
            status: "ready"
          }),
          expect.objectContaining({
            action: "start",
            status: "running"
          })
        ]
      });
      expect(reusedLedgerStep.status).toBe(400);
      expect(reusedLedgerStepBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "Auto implementation stage completion requires an implementation step that has not completed another stage."
      });
      expect(prematureComplete.status).toBe(400);
      expect(prematureCompleteBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "Auto implementation stage completion cannot happen before the current 5-minute tick is due.",
        details: {
          stage: "initial_pr",
          recordedAt: "2026-05-20T00:12:00.000Z",
          nextScheduledAt: "2026-05-20T00:15:00.000Z"
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("records visible blockers for auto implementation stage ticks", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { sessionId } = await createProjectForTest(storageApp, "An auto implementation stage blocker test");
      const created = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:stage-blocker",
        projectName: "Stage Blocker App"
      });
      const createdRun = latestAutoImplementationRunFromBody(await jsonBody(created));
      const runId = createdRun.runId as string;
      const blocked = await postAutoImplementationStageForTest(storageApp, sessionId, runId, "initial_pr", {
        idempotencyKey: "auto-stage:block:initial-pr",
        action: "block",
        tickedAt: "2026-05-20T00:05:00.000Z",
        evidenceRefs: ["stage:initial_pr:block"],
        blocker: {
          stage: "initial_pr",
          reason: "ImplementationStepLedger evidence is missing.",
          missingEvidence: ["ImplementationStepLedger completed step"],
          nextRequiredAction: "Record the implementation ledger step before completing the stage.",
          evidenceRefs: ["blocker:initial_pr:ledger-missing"]
        }
      });
      const blockedRun = latestAutoImplementationRunFromBody(await jsonBody(blocked));
      const blockedStage = (blockedRun.stagePlan as readonly Readonly<Record<string, unknown>>[])[0]!;
      const blockedIssue = await readFile(
        join(workspaceRoot, "stage-blocker-app", "implementation-issues", "001-initial_pr.md"),
        "utf8"
      );

      expect(blocked.status).toBe(200);
      expect(blockedRun).toMatchObject({
        status: "blocked",
        currentStage: "initial_pr",
        nextTickAt: "2026-05-20T00:10:00.000Z"
      });
      expect(blockedStage).toMatchObject({
        status: "blocked",
        blocker: {
          reason: "ImplementationStepLedger evidence is missing.",
          missingEvidence: ["ImplementationStepLedger completed step"]
        },
        tickRecords: [
          expect.objectContaining({
            action: "block",
            status: "blocked"
          })
        ]
      });
      expect(blockedIssue).toContain("- Issue status: blocked");
      expect(blockedIssue).toContain("- Stage blocker: ImplementationStepLedger evidence is missing.");
      expect(blockedIssue).toContain("- Stage blocker evidence refs: blocker:initial_pr:ledger-missing");
      expect(blockedIssue).toContain("- Stage evidence refs:");
      expect(blockedIssue).toContain("stage:initial_pr:block");
    } finally {
      await storage.close();
    }
  });

  it("creates distinct safe workspace folders for non-ASCII project names", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { sessionId } = await createProjectForTest(storageApp, "A Korean named app that should be implemented");
      const response = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:korean-name",
        projectName: "고양이 펜팔 서비스",
        trackerTitle: "고양이 펜팔 서비스 implementation tracker"
      });
      const body = await jsonBody(response);
      const latestRun = latestAutoImplementationRunFromBody(body);
      const projectFolderName = latestRun.projectFolderName as string;

      expect(response.status).toBe(200);
      expect(projectFolderName).toMatch(/^solo-superman-project-[a-f0-9]{16}$/u);
      expect(projectFolderName).not.toBe("solo-superman-project");
      await expect(readFile(join(workspaceRoot, projectFolderName, "implementation-tracker.md"), "utf8")).resolves.toContain(
        "고양이 펜팔 서비스 implementation tracker"
      );
    } finally {
      await storage.close();
    }
  });

  it("keeps markdown fallback active for non-GitHub remotes", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const projectDir = join(workspaceRoot, "existing-local-remote-repo");

    await mkdir(projectDir, { recursive: true });
    execFileSync("git", ["init"], { cwd: projectDir, stdio: "ignore" });
    execFileSync("git", ["checkout", "-B", "main"], { cwd: projectDir, stdio: "ignore" });
    execFileSync("git", ["remote", "add", "origin", join(workspaceRoot, "not-github.git")], {
      cwd: projectDir,
      stdio: "ignore"
    });
    await writeFile(join(projectDir, "operator-notes.md"), "operator-owned draft\n");
    execFileSync("git", ["add", "operator-notes.md"], { cwd: projectDir, stdio: "ignore" });

    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { sessionId } = await createProjectForTest(storageApp, "A non-GitHub remote test");
      const response = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:unsupported-remote",
        projectFolderName: "existing-local-remote-repo"
      });
      const body = await jsonBody(response);
      const latestRun = latestAutoImplementationRunFromBody(body);
      const issueManagement = latestRun.issueManagement as Readonly<Record<string, unknown>>;
      const tracker = await readFile(join(projectDir, "implementation-tracker.md"), "utf8");
      const generatedPathStatus = execFileSync(
        "git",
        [
          "status",
          "--short",
          "--",
          "planning-handoff-implementation-plan.md",
          "implementation-tracker.md",
          "implementation-issues",
          ".solo-superman"
        ],
        { cwd: projectDir, encoding: "utf8" }
      );
      const workspaceStatus = execFileSync("git", ["status", "--short"], { cwd: projectDir, encoding: "utf8" });
      const committedPaths = execFileSync("git", ["ls-tree", "-r", "--name-only", "HEAD"], {
        cwd: projectDir,
        encoding: "utf8"
      });

      expect(response.status).toBe(200);
      expect(latestRun).toMatchObject({
        remoteStatus: "unsupported_remote"
      });
      expect(issueManagement).toMatchObject({
        mode: "markdown_fallback",
        warning: "Remote exists, but it is not a GitHub remote. Local markdown issues remain active."
      });
      expect(tracker).toContain("Remote status: unsupported_remote");
      expect(tracker).toContain("git remote set-url origin <github-repo-url>");
      expect(generatedPathStatus).toBe("");
      expect(workspaceStatus).toContain("A  operator-notes.md");
      expect(committedPaths).not.toContain("operator-notes.md");
    } finally {
      await storage.close();
    }
  });

  it("rejects auto implementation project folders that are symlinks outside the workspace root", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const outsideDir = await makeTempAppDataDir();
    await symlink(outsideDir, join(workspaceRoot, "escape-app"), process.platform === "win32" ? "junction" : "dir");
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { sessionId } = await createProjectForTest(storageApp, "A symlinked auto implementation request test");
      const response = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:symlink-project",
        projectFolderName: "escape-app"
      });
      const body = await jsonBody(response);

      expect(response.status).toBe(400);
      expect(body.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "Auto implementation workspace could not be prepared safely.",
        details: {
          message: "Workspace output directories must not contain symbolic links."
        }
      });
      await expect(readFile(join(outsideDir, "implementation-tracker.md"), "utf8")).rejects.toMatchObject({
        code: "ENOENT"
      });
    } finally {
      await storage.close();
    }
  });

  it("rejects auto implementation workspace roots that are symlinks", async () => {
    const workspaceParent = await makeTempAppDataDir();
    const outsideDir = await makeTempAppDataDir();
    const workspaceRoot = join(workspaceParent, "workspace-link");
    await symlink(outsideDir, workspaceRoot, process.platform === "win32" ? "junction" : "dir");
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { sessionId } = await createProjectForTest(storageApp, "A symlinked auto implementation workspace root test");
      const response = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:symlink-root",
        projectFolderName: "escape-app"
      });
      const body = await jsonBody(response);

      expect(response.status).toBe(400);
      expect(body.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "Auto implementation workspace could not be prepared safely.",
        details: {
          message: "Workspace root must be a real directory."
        }
      });
      await expect(readFile(join(outsideDir, "escape-app", "implementation-tracker.md"), "utf8")).rejects.toMatchObject({
        code: "ENOENT"
      });
    } finally {
      await storage.close();
    }
  });

  it("rejects auto implementation output files that are symlinks outside the workspace root", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const outsideDir = await makeTempAppDataDir();
    const outsideTrackerPath = join(outsideDir, "outside-tracker.md");
    const projectDir = join(workspaceRoot, "existing-app");

    await mkdir(projectDir, { recursive: true });
    await writeFile(outsideTrackerPath, "outside content must remain unchanged\n");
    await symlink(
      process.platform === "win32" ? outsideDir : outsideTrackerPath,
      join(projectDir, "implementation-tracker.md"),
      process.platform === "win32" ? "junction" : "file"
    );

    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { sessionId } = await createProjectForTest(storageApp, "A symlinked auto implementation output test");
      const response = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:symlink-file",
        projectFolderName: "existing-app"
      });
      const body = await jsonBody(response);

      expect(response.status).toBe(400);
      expect(body.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "Auto implementation workspace could not be prepared safely.",
        details: {
          message: "Workspace output files must be regular files."
        }
      });
      await expect(readFile(outsideTrackerPath, "utf8")).resolves.toBe("outside content must remain unchanged\n");
    } finally {
      await storage.close();
    }
  });

  it("rejects existing auto implementation repos that are not on main", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const projectDir = join(workspaceRoot, "existing-non-main-repo");

    await mkdir(projectDir, { recursive: true });
    execFileSync("git", ["init"], { cwd: projectDir, stdio: "ignore" });
    execFileSync("git", ["checkout", "-B", "not-main"], { cwd: projectDir, stdio: "ignore" });

    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { sessionId } = await createProjectForTest(storageApp, "An existing non-main repo test");
      const response = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:non-main",
        projectFolderName: "existing-non-main-repo"
      });
      const body = await jsonBody(response);

      expect(response.status).toBe(400);
      expect(body.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "Auto implementation workspace could not be prepared safely.",
        details: {
          message: "Auto implementation workspace git repo must be on main."
        }
      });
      await expect(readFile(join(projectDir, "implementation-tracker.md"), "utf8")).rejects.toMatchObject({
        code: "ENOENT"
      });
    } finally {
      await storage.close();
    }
  });

  it("rejects malformed auto implementation run requests before filesystem writes", async () => {
    const workspaceRoot = await makeTempAppDataDir();
    const { app: storageApp, storage } = await createMigratedStorageApp(fixtureCodexRuntimeAdapter, {
      autoImplementationWorkspaceRoot: workspaceRoot
    });

    try {
      const { sessionId } = await createProjectForTest(storageApp, "A malformed auto implementation request test");
      const unsupported = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:bad",
        unsafe: true
      });
      const unsupportedBody = await jsonBody(unsupported);
      const tooManyTitles = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:too-many-titles",
        issueTitles: ["1", "2", "3", "4", "5", "6", "7", "8"]
      });
      const tooManyTitlesBody = await jsonBody(tooManyTitles);
      const invalidGithubIssueMode = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:bad-github-issue-mode",
        githubIssueCreation: {
          mode: "apply_now"
        }
      });
      const invalidGithubIssueModeBody = await jsonBody(invalidGithubIssueMode);
      const invalidGithubIssueApproval = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:bad-github-issue-approval",
        githubIssueCreation: {
          mode: "approved",
          approval: {
            approvalId: "approval_bad",
            approvedBy: "local_operator",
            approvedAt: "not-an-iso-timestamp",
            actionClass: "github_issue_create",
            approvalGranularity: "per_action",
            remoteStatusAtApproval: "connected",
            rollbackPlan: "Close any created issues.",
            evidenceRefs: ["approval:bad"]
          }
        }
      });
      const invalidGithubIssueApprovalBody = await jsonBody(invalidGithubIssueApproval);
      const missingGithubIssueVerifier = await postAutoImplementationRunForTest(storageApp, sessionId, {
        idempotencyKey: "auto-implementation-route:missing-github-issue-verifier",
        githubIssueCreation: {
          mode: "approved",
          approval: {
            approvalId: "approval_missing_verifier",
            approvedBy: "local_operator",
            approvedAt: "2026-05-05T00:00:00.000Z",
            actionClass: "github_issue_create",
            approvalGranularity: "per_action",
            remoteStatusAtApproval: "connected",
            rollbackPlan: "Close any created issues.",
            evidenceRefs: ["approval:missing-verifier"]
          }
        }
      });
      const missingGithubIssueVerifierBody = await jsonBody(missingGithubIssueVerifier);

      expect(unsupported.status).toBe(400);
      expect(unsupportedBody.error).toMatchObject({
        code: "VALIDATION_FAILED"
      });
      expect(tooManyTitles.status).toBe(400);
      expect(tooManyTitlesBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "issueTitles must include at most 7 values."
      });
      expect(invalidGithubIssueMode.status).toBe(400);
      expect(invalidGithubIssueModeBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "githubIssueCreation.mode must be not_requested, dry_run, or approved."
      });
      expect(invalidGithubIssueApproval.status).toBe(400);
      expect(invalidGithubIssueApprovalBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "githubIssueCreation.approval.approvedAt must be an ISO timestamp."
      });
      expect(missingGithubIssueVerifier.status).toBe(400);
      expect(missingGithubIssueVerifierBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "githubIssueCreation.verifierEvidenceRefs must include at least one verifier evidence reference for approved mode."
      });
    } finally {
      await storage.close();
    }
  });

  it("rejects synthesize requests when the body researchResultId does not match the route param", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const response = await storageApp.request("/api/v1/research-results/research_result_path/synthesize", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId: "sess_synthesize_mismatch",
          researchResultId: "research_result_body",
          expectedStateVersion: 1
        })
      });
      const body = await jsonBody(response);

      expect(response.status).toBe(400);
      expect(body.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "researchResultId must match the route param."
      });
    } finally {
      await storage.close();
    }
  });

  it("rejects ambiguity analysis when the required targetRef is missing", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const response = await storageApp.request("/api/v1/sessions/sess_missing_target/spec/analyze", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 3
        })
      });
      const body = await jsonBody(response);

      expect(response.status).toBe(400);
      expect(body.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "targetRef must be a non-empty string."
      });
    } finally {
      await storage.close();
    }
  });

  it("rejects ambiguity analysis when generated question JSON is missing at the route boundary", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { sessionId } = await createProjectForTest(
        storageApp,
        "A route test idea that requires generated questions before analysis"
      );
      await storageApp.request(`/api/v1/sessions/${sessionId}/intake`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 1,
          answer: "Validate the generated-question-only route boundary."
        })
      });
      await storageApp.request(`/api/v1/sessions/${sessionId}/spec/initial`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 2
        })
      });

      const response = await storageApp.request(`/api/v1/sessions/${sessionId}/spec/analyze`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 3,
          targetRef: "current_spec"
        })
      });
      const body = await jsonBody(response);
      const data = body.data as Readonly<Record<string, unknown>>;

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        category: "rejected",
        error: {
          code: "COMMAND_PRECONDITION_FAILED",
          message: "AnalyzeAmbiguity requires Codex-generated question JSON.",
          details: {
            questionGeneration: {
              mode: "codex_required",
              reason: "generated_question_set_missing"
            }
          }
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("rejects stale ProductEngine expectedStateVersion without appending events", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A stale version test idea",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed",
          businessCriticIntensity: "balanced",
          businessCriticIntensityConfirmation: "user_confirmed"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const response = await storageApp.request(`/api/v1/sessions/${sessionId}/intake`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 0,
          answer: "This stale command should not append an event."
        })
      });
      const body = await jsonBody(response);

      expect(response.status).toBe(200);
      expect(body.data).toMatchObject({
        category: "rejected",
        error: {
          code: "STATE_VERSION_CONFLICT"
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("serializes same-session commands so concurrent stale writes return an enveloped rejection", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A concurrent command test idea",
          localPrivacyMode: "local_only",
          projectPurposeMode: "business",
          projectPurposeModeConfirmation: "user_confirmed",
          businessCriticIntensity: "balanced",
          businessCriticIntensityConfirmation: "user_confirmed"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const requestInit = {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 1,
          answer: "Only one concurrent intake command should win."
        })
      };
      const responses = await Promise.all([
        storageApp.request(`/api/v1/sessions/${sessionId}/intake`, requestInit),
        storageApp.request(`/api/v1/sessions/${sessionId}/intake`, requestInit)
      ]);
      const bodies = await Promise.all(responses.map(jsonBody));
      const categories = bodies.map((body) => (body.data as Readonly<Record<string, unknown>>).category).sort();

      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      expect(categories).toEqual(["accepted", "rejected"]);
      expect(
        bodies.some((body) => {
          const data = body.data as Readonly<Record<string, unknown>>;
          const error = data.error as Readonly<Record<string, unknown>> | undefined;

          return error?.code === "STATE_VERSION_CONFLICT";
        })
      ).toBe(true);
    } finally {
      await storage.close();
    }
  });
});
