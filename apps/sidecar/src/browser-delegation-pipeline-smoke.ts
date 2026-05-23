import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { BrowserActionPreviewDto } from "@solo-superman/contracts";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "@solo-superman/db";
import { sessionEventCount } from "./auto-implementation-smoke-fixtures";
import {
  createLocalBrowserTargetServer,
  safeBrowserActionPreview,
  stringArrayAt
} from "./browser-smoke-helpers";
import { hashBrowserActionPreview } from "./product-engine/browser-action-adapter";
import { createSidecarApp } from "./server";
import {
  getJson,
  objectAt,
  postJson,
  recordArray,
  stringAt,
  type JsonRecord,
  type SmokeRequestApp
} from "./smoke-helpers";

export const BROWSER_DELEGATION_PIPELINE_SMOKE = "browser_delegation_pipeline" as const;

const PROJECT_IDEA = "A browser delegation pipeline smoke idea for founder validation.";
const SOURCE_QUEUE_ITEM_ID = "queue_browser_delegation_pipeline_smoke";
const MOCK_CHATGPT_READY_PAGE = [
  "<!doctype html>",
  "<title>Mock ChatGPT ready state</title>",
  '<main data-chatgpt-page-state="ready">User-owned ChatGPT browser session mock</main>'
].join("");
const EXECUTION_WINDOW = {
  requestedAt: "2026-05-23T01:00:00.000Z",
  approvalExpiresAt: "2026-05-23T01:05:00.000Z"
} as const;
const FORBIDDEN_FIELD_KINDS = ["credential", "session", "secret", "2fa", "payment", "legal_sensitive"] as const;

type SmokeStatus = "blocked" | "passed";

type SmokeStorage = Awaited<ReturnType<typeof createSoloStorage>>;

interface BrowserDelegationScenario {
  readonly storage: SmokeStorage;
  readonly app: SmokeRequestApp;
}

interface ProjectContext {
  readonly projectId: string;
  readonly sessionId: string;
}

interface BrowserDelegationFlowResult {
  readonly project: ProjectContext;
  readonly researchTaskId: string;
  readonly authorityRecordId: string;
  readonly browserResult: JsonRecord;
  readonly readyDelegation: JsonRecord;
  readonly listedDelegation: JsonRecord;
  readonly revokedDelegation: JsonRecord;
}

export interface BrowserDelegationPipelineSmokeEvidence {
  readonly status: SmokeStatus;
  readonly smoke: typeof BROWSER_DELEGATION_PIPELINE_SMOKE;
  readonly mode: "fixture";
  readonly project?: {
    readonly projectId: string;
    readonly sessionId: string;
  };
  readonly browser?: {
    readonly authorityRecordId: string;
    readonly status: string;
    readonly hostname: string;
    readonly screenshotRefCount: number;
    readonly logRefCount: number;
    readonly auditRefCount: number;
  };
  readonly delegation?: {
    readonly runId: string;
    readonly statusBeforeRevoke: string;
    readonly statusAfterRevoke: string;
    readonly approvalDecision: string;
    readonly blockReasonCountBeforeRevoke: number;
    readonly blockReasonCountAfterRevoke: number;
    readonly auditEventTypes: readonly string[];
  };
  readonly reason?: string;
  readonly blockers?: readonly string[];
  readonly checked: readonly string[];
}

export interface BrowserDelegationPipelineSmokeOptions {
  readonly appDataDir?: string;
  readonly cleanupAppDataDir?: boolean;
  readonly localCapabilityToken?: string;
}

function firstRecordAt(value: unknown, label: string) {
  const first = recordArray(value, label)[0];

  if (!first) {
    throw new Error(`${label} must contain at least one record.`);
  }

  return first;
}

function latestRunFromProjection(projection: JsonRecord, label: string) {
  return objectAt(projection.latestRun, `${label} latestRun`);
}

function createProject(app: SmokeRequestApp, localCapabilityToken: string): Promise<ProjectContext> {
  return postJson(app, "/api/v1/projects", localCapabilityToken, {
    rawIdea: PROJECT_IDEA,
    localPrivacyMode: "local_only",
    projectPurposeMode: "business",
    projectPurposeModeConfirmation: "user_confirmed",
    businessCriticIntensity: "balanced",
    businessCriticIntensityConfirmation: "user_confirmed"
  }).then((data) => {
    const projection = objectAt(data.immediateProjection, "project immediateProjection");

    return {
      projectId: stringAt(projection.projectId, "projectId"),
      sessionId: stringAt(projection.sessionId, "sessionId")
    };
  });
}

async function planResearchTask(input: {
  readonly app: SmokeRequestApp;
  readonly storage: SmokeStorage;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
}) {
  const expectedStateVersion = await sessionEventCount(input.storage, input.sessionId);
  const data = await postJson(input.app, `/api/v1/sessions/${input.sessionId}/research-tasks`, input.localCapabilityToken, {
    expectedStateVersion,
    objective: "Use a user-approved local ChatGPT browser session mock to gather deeper competitor counter-evidence.",
    sourceQueueItemId: SOURCE_QUEUE_ITEM_ID,
    routeOutcome: "missing_con_evidence",
    impact: "high"
  });
  const projection = objectAt(data.immediateProjection, "research task immediateProjection");

  return stringAt(firstRecordAt(projection.tasks, "research tasks").researchTaskId, "researchTaskId");
}

async function createBrowserAuthority(input: {
  readonly scenario: BrowserDelegationScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly targetUrl: string;
  readonly previewArtifactHash: string;
}) {
  const expectedStateVersion = await sessionEventCount(input.scenario.storage, input.sessionId);
  const origin = new URL(input.targetUrl).origin;
  const data = await postJson(
    input.scenario.app,
    `/api/v1/sessions/${input.sessionId}/execution-authority`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      expectedStateVersion,
      idempotencyKey: "browser-delegation-smoke:authority",
      sourcePlanningHandoffRef: "planning_handoff_browser_delegation_smoke",
      boundedAgentOutput: {
        outputId: "bounded_output_browser_delegation_smoke",
        sourceRefs: ["planning_handoff_browser_delegation_smoke"],
        intendedDecisionImpact: "Validate the credential-free ChatGPT browser delegation pipeline smoke.",
        proposedActionPreviewRefs: ["preview_browser_delegation_smoke"],
        requiredApprovals: ["approval_browser_delegation_smoke"],
        evidenceRefs: ["evidence_browser_delegation_smoke"],
        failureMode: "ready_for_preview",
        noExecutionPolicy: "controlled_execution_required"
      },
      actionClass: "browser_action",
      previewArtifactRef: "preview_browser_delegation_smoke",
      previewArtifactHash: input.previewArtifactHash,
      reviewedPreviewArtifactHash: input.previewArtifactHash,
      requestedScope: {
        browserTargetRef: `browser_target:${origin}`,
        maxDurationMs: 1_000
      },
      approvalDecision: "approved",
      approver: {
        actorId: "browser_delegation_smoke_owner",
        actorType: "user",
        approvedAt: "2026-05-23T01:00:00.000Z",
        decidedAt: "2026-05-23T01:00:00.000Z"
      },
      sandboxBoundary: {
        mode: "browser_preview_session",
        networkPolicy: "loopback_only",
        secretPolicy: "no_secret_values"
      },
      rollbackReference: {
        kind: "browser_state_reset",
        ref: "rollback_browser_delegation_smoke"
      },
      evidenceRefs: ["browser_delegation_smoke:authority-preview"],
      auditRefs: ["audit:browser_delegation_smoke:authority"],
      preconditionChecks: {
        planningSourceExists: true,
        previewArtifactExists: true,
        previewHashMatches: true,
        rollbackAvailable: true,
        credentialValueRequired: false,
        sandboxEnforced: true
      }
    }
  );
  const projection = objectAt(data.immediateProjection, "execution authority projection");
  const latestRecord = objectAt(projection.latestRecord, "execution authority latestRecord");

  return stringAt(latestRecord.recordId, "execution authority recordId");
}

async function runBrowserAction(input: {
  readonly scenario: BrowserDelegationScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly authorityRecordId: string;
  readonly targetUrl: string;
  readonly action: BrowserActionPreviewDto;
  readonly previewArtifactHash: string;
}) {
  return postJson(
    input.scenario.app,
    `/api/v1/execution-authorities/${input.authorityRecordId}/browser-action`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      idempotencyKey: "browser-delegation-smoke:browser-action",
      previewArtifactHash: input.previewArtifactHash,
      ...EXECUTION_WINDOW,
      targetUrl: input.targetUrl,
      action: input.action
    }
  );
}

async function createReadyDelegation(input: {
  readonly scenario: BrowserDelegationScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly researchTaskId: string;
  readonly authorityRecordId: string;
  readonly browserResult: JsonRecord;
}) {
  const expectedStateVersion = await sessionEventCount(input.scenario.storage, input.sessionId);

  return postJson(
    input.scenario.app,
    `/api/v1/sessions/${input.sessionId}/chatgpt-browser-delegations`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      expectedStateVersion,
      idempotencyKey: "browser-delegation-smoke:delegation-ready",
      researchTaskId: input.researchTaskId,
      promptPreviewRef: "prompt_preview_browser_delegation_smoke_ready",
      dataDisclosurePreview: {
        disclosurePreviewRef: "disclosure_preview_browser_delegation_smoke_ready",
        promptContextSummaryRef: "context_summary_browser_delegation_smoke_ready",
        redactedPromptPreviewRef: "redacted_prompt_browser_delegation_smoke_ready",
        excludedSensitiveFieldKinds: FORBIDDEN_FIELD_KINDS,
        redactionPreviewShown: true,
        userCanEditPromptBeforeRun: true
      },
      redactionSummary: {
        redactionPreviewRef: "redaction_preview_browser_delegation_smoke_ready",
        redactedFieldKinds: FORBIDDEN_FIELD_KINDS,
        retainedArtifactKinds: ["prompt", "imported_result", "screenshot", "log"],
        defaultRetention: "prompt_result_screenshot_log",
        forbiddenRetentionPolicy: "no_credential_session_secret_2fa_payment_or_legal_sensitive_fields",
        userExportDeleteControls: true,
        deletionLeavesAuditMetadataOnly: true
      },
      policyRiskVerdict: {
        verdict: "pass",
        rationale: "Per-run user approval with a local visible browser preview; no account sharing, resale, backend, or unattended queue semantics.",
        evidenceRefs: ["policy:chatgpt-pro:per-run", "browser_delegation_smoke:policy"]
      },
      sessionOwnershipVerdict: {
        verdict: "pass",
        rationale: "The page state is a loopback mock of a user-owned ChatGPT browser session; no credential or cookie custody is requested.",
        evidenceRefs: ["session:owner-confirmed", "mock-chatgpt-page-state:ready"]
      },
      approvalDecision: "approved",
      browserActionAuthorityRef: input.authorityRecordId,
      screenshotRefs: stringArrayAt(input.browserResult.screenshotRefs, "browser screenshotRefs"),
      logRefs: stringArrayAt(input.browserResult.logRefs, "browser logRefs"),
      auditRefs: [
        "audit:chatgpt-browser-delegation:browser-delegation-smoke-ready",
        ...stringArrayAt(input.browserResult.auditRefs, "browser auditRefs")
      ],
      activityFeedRefs: ["activity:chatgpt-browser-delegation:browser-delegation-smoke-ready"]
    }
  );
}

async function revokeDelegation(input: {
  readonly scenario: BrowserDelegationScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly runId: string;
}) {
  const expectedStateVersion = await sessionEventCount(input.scenario.storage, input.sessionId);

  return postJson(
    input.scenario.app,
    `/api/v1/sessions/${input.sessionId}/chatgpt-browser-delegations/${input.runId}/revoke`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      expectedStateVersion,
      idempotencyKey: "browser-delegation-smoke:delegation-revoked",
      runId: input.runId,
      reason: "User revoked the local ChatGPT browser delegation smoke run after evidence capture.",
      auditRefs: ["audit:chatgpt-browser-delegation:browser-delegation-smoke-revoked"]
    }
  );
}

async function executeBrowserDelegationFlow(
  scenario: BrowserDelegationScenario,
  localCapabilityToken: string
): Promise<BrowserDelegationFlowResult> {
  const project = await createProject(scenario.app, localCapabilityToken);
  const researchTaskId = await planResearchTask({
    app: scenario.app,
    storage: scenario.storage,
    localCapabilityToken,
    sessionId: project.sessionId
  });
  const browserTarget = await createLocalBrowserTargetServer({
    html: MOCK_CHATGPT_READY_PAGE,
    path: "/mock-chatgpt/ready",
    failureMessage: "Local browser target server did not expose a TCP address."
  });

  try {
    const action = safeBrowserActionPreview();
    const previewArtifactHash = hashBrowserActionPreview({ targetUrl: browserTarget.targetUrl, action });
    const authorityRecordId = await createBrowserAuthority({
      scenario,
      localCapabilityToken,
      sessionId: project.sessionId,
      targetUrl: browserTarget.targetUrl,
      previewArtifactHash
    });
    const browserResult = await runBrowserAction({
      scenario,
      localCapabilityToken,
      sessionId: project.sessionId,
      authorityRecordId,
      targetUrl: browserTarget.targetUrl,
      action,
      previewArtifactHash
    });
    const readyDelegation = await createReadyDelegation({
      scenario,
      localCapabilityToken,
      sessionId: project.sessionId,
      researchTaskId,
      authorityRecordId,
      browserResult
    });
    const readyProjection = objectAt(readyDelegation.immediateProjection, "ready delegation projection");
    const readyRun = latestRunFromProjection(readyProjection, "ready delegation");
    const runId = stringAt(readyRun.runId, "ready delegation runId");
    const listedDelegation = await getJson(
      scenario.app,
      `/api/v1/sessions/${project.sessionId}/chatgpt-browser-delegations`,
      localCapabilityToken
    );
    const revokedDelegation = await revokeDelegation({
      scenario,
      localCapabilityToken,
      sessionId: project.sessionId,
      runId
    });

    return {
      project,
      researchTaskId,
      authorityRecordId,
      browserResult,
      readyDelegation,
      listedDelegation,
      revokedDelegation
    };
  } finally {
    await browserTarget.close();
  }
}

function flowBlockers(result: BrowserDelegationFlowResult) {
  const blockers: string[] = [];
  const browserTarget = objectAt(result.browserResult.target, "browser target");
  const screenshotRefs = stringArrayAt(result.browserResult.screenshotRefs, "browser screenshotRefs");
  const logRefs = stringArrayAt(result.browserResult.logRefs, "browser logRefs");
  const auditRefs = stringArrayAt(result.browserResult.auditRefs, "browser auditRefs");
  const readyProjection = objectAt(result.readyDelegation.immediateProjection, "ready delegation projection");
  const readyRun = latestRunFromProjection(readyProjection, "ready delegation");
  const readyBlockReasons = recordArray(readyRun.blockReasons, "ready delegation blockReasons");
  const listedRun = latestRunFromProjection(result.listedDelegation, "listed delegation");
  const revokedProjection = objectAt(result.revokedDelegation.immediateProjection, "revoked delegation projection");
  const revokedRun = latestRunFromProjection(revokedProjection, "revoked delegation");
  const revokedBlockReasons = recordArray(revokedRun.blockReasons, "revoked delegation blockReasons");

  if (result.browserResult.status !== "completed") {
    blockers.push(`browser action must complete; received ${JSON.stringify(result.browserResult.status)}`);
  }

  if (browserTarget.hostname !== "127.0.0.1") {
    blockers.push(`browser action must stay on loopback; received ${JSON.stringify(browserTarget.hostname)}`);
  }

  if (!screenshotRefs.length || !logRefs.length || !auditRefs.length) {
    blockers.push("browser action must return screenshot, log, and audit refs for delegation evidence.");
  }

  if (readyProjection.currentStatus !== "running") {
    blockers.push(`ready delegation must be running before revoke; received ${JSON.stringify(readyProjection.currentStatus)}`);
  }

  if (readyRun.researchTaskId !== result.researchTaskId) {
    blockers.push("ready delegation must retain the planned researchTaskId.");
  }

  if (readyRun.browserActionAuthorityRef !== result.authorityRecordId) {
    blockers.push("ready delegation must retain the approved browserActionAuthorityRef.");
  }

  if (readyRun.approvalDecision !== "approved" || readyRun.canRevoke !== true || readyBlockReasons.length) {
    blockers.push("ready delegation must be approved, revokable, and have no block reasons.");
  }

  if (listedRun.runId !== readyRun.runId) {
    blockers.push("GET chatgpt-browser-delegations must refetch the ready delegation run.");
  }

  if (revokedProjection.currentStatus !== "revoked") {
    blockers.push(`revoked delegation must report revoked; received ${JSON.stringify(revokedProjection.currentStatus)}`);
  }

  if (revokedRun.canRevoke !== false) {
    blockers.push("revoked delegation must disable canRevoke.");
  }

  if (!revokedBlockReasons.some((reason) => reason.code === "revoked_by_user")) {
    blockers.push("revoked delegation must record a revoked_by_user block reason.");
  }

  return blockers;
}

function passedEvidence(result: BrowserDelegationFlowResult): BrowserDelegationPipelineSmokeEvidence {
  const browserTarget = objectAt(result.browserResult.target, "browser target");
  const screenshotRefs = stringArrayAt(result.browserResult.screenshotRefs, "browser screenshotRefs");
  const logRefs = stringArrayAt(result.browserResult.logRefs, "browser logRefs");
  const auditRefs = stringArrayAt(result.browserResult.auditRefs, "browser auditRefs");
  const readyProjection = objectAt(result.readyDelegation.immediateProjection, "ready delegation projection");
  const readyRun = latestRunFromProjection(readyProjection, "ready delegation");
  const readyBlockReasons = recordArray(readyRun.blockReasons, "ready delegation blockReasons");
  const revokedProjection = objectAt(result.revokedDelegation.immediateProjection, "revoked delegation projection");
  const revokedRun = latestRunFromProjection(revokedProjection, "revoked delegation");
  const revokedBlockReasons = recordArray(revokedRun.blockReasons, "revoked delegation blockReasons");
  const auditLog = recordArray(revokedRun.auditLog, "revoked delegation auditLog");

  return {
    status: "passed",
    smoke: BROWSER_DELEGATION_PIPELINE_SMOKE,
    mode: "fixture",
    project: result.project,
    browser: {
      authorityRecordId: result.authorityRecordId,
      status: stringAt(result.browserResult.status, "browser status"),
      hostname: stringAt(browserTarget.hostname, "browser hostname"),
      screenshotRefCount: screenshotRefs.length,
      logRefCount: logRefs.length,
      auditRefCount: auditRefs.length
    },
    delegation: {
      runId: stringAt(readyRun.runId, "ready delegation runId"),
      statusBeforeRevoke: stringAt(readyRun.status, "ready delegation status"),
      statusAfterRevoke: stringAt(revokedRun.status, "revoked delegation status"),
      approvalDecision: stringAt(readyRun.approvalDecision, "ready delegation approvalDecision"),
      blockReasonCountBeforeRevoke: readyBlockReasons.length,
      blockReasonCountAfterRevoke: revokedBlockReasons.length,
      auditEventTypes: auditLog.map((entry) => stringAt(entry.eventType, "delegation audit eventType"))
    },
    checked: [
      "temporary local sidecar and app data created",
      "research task created for browser-delegated evidence",
      "loopback mock ChatGPT page served without credentials",
      "approved browser_action ExecutionAuthorityRecord preserved loopback and no-secret sandbox",
      "browser action returned screenshot, log, evidence, and audit refs",
      "ChatGPT browser delegation run retained disclosure, redaction, policy, session ownership, approval, and authority refs",
      "delegation projection is refetchable and revokable",
      "revoke records revoked_by_user and disables further revoke"
    ]
  };
}

function blockedEvidence(
  result: BrowserDelegationFlowResult,
  blockers: readonly string[]
): BrowserDelegationPipelineSmokeEvidence {
  return {
    ...passedEvidence(result),
    status: "blocked",
    reason: "Browser delegation pipeline smoke did not satisfy every critical-path fixture check.",
    blockers
  };
}

function errorEvidence(error: unknown): BrowserDelegationPipelineSmokeEvidence {
  const message = error instanceof Error ? error.message : String(error);

  return {
    status: "blocked",
    smoke: BROWSER_DELEGATION_PIPELINE_SMOKE,
    mode: "fixture",
    reason: "Browser delegation pipeline smoke failed before full evidence could be collected.",
    blockers: [message],
    checked: ["temporary local browser delegation pipeline smoke started"]
  };
}

async function createScenario(appDataDir: string, localCapabilityToken: string): Promise<BrowserDelegationScenario> {
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
      storage
    })
  };
}

export async function runBrowserDelegationPipelineSmoke(
  options: BrowserDelegationPipelineSmokeOptions = {}
): Promise<BrowserDelegationPipelineSmokeEvidence> {
  const appDataDir = options.appDataDir ?? (await mkdtemp(join(tmpdir(), "solo-superman-browser-delegation-smoke-")));
  const shouldCleanup = options.cleanupAppDataDir ?? !options.appDataDir;
  const localCapabilityToken = options.localCapabilityToken ?? `browser-delegation-smoke-${randomUUID()}`;
  let scenario: BrowserDelegationScenario | null = null;

  try {
    scenario = await createScenario(appDataDir, localCapabilityToken);
    const result = await executeBrowserDelegationFlow(scenario, localCapabilityToken);
    const blockers = flowBlockers(result);

    return blockers.length ? blockedEvidence(result, blockers) : passedEvidence(result);
  } catch (error: unknown) {
    return errorEvidence(error);
  } finally {
    await scenario?.storage.close();

    if (shouldCleanup) {
      await rm(appDataDir, { recursive: true, force: true });
    }
  }
}

function exitCodeForEvidence(evidence: BrowserDelegationPipelineSmokeEvidence) {
  return evidence.status === "passed" ? 0 : 1;
}

async function main() {
  const evidence = await runBrowserDelegationPipelineSmoke();

  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = exitCodeForEvidence(evidence);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
