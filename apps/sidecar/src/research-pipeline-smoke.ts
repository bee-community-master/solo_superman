import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "@solo-superman/db";
import { createProductEngineCommandService } from "./product-engine/command-service";
import { createSidecarApp } from "./server";
import {
  objectAt,
  postJson,
  getJson,
  recordArray,
  stringAt,
  type JsonRecord,
  type SmokeRequestApp
} from "./smoke-helpers";
import { sessionEventCount } from "./auto-implementation-smoke-fixtures";

export const RESEARCH_PIPELINE_SMOKE = "research_pipeline" as const;

const PROJECT_IDEA = "A research pipeline smoke idea for founder validation.";
const ALLOWLIST_ID = "research_allowlist_pipeline_smoke";
const RESEARCH_RUN_ID = "research_run_pipeline_smoke";
const SOURCE_QUEUE_ITEM_ID = "queue_item_pipeline_smoke";

type SmokeStatus = "blocked" | "passed";

type SmokeStorage = Awaited<ReturnType<typeof createSoloStorage>>;

export interface ResearchPipelineSmokeEvidence {
  readonly status: SmokeStatus;
  readonly smoke: typeof RESEARCH_PIPELINE_SMOKE;
  readonly mode: "fixture";
  readonly project?: {
    readonly projectId: string;
    readonly sessionId: string;
  };
  readonly research?: {
    readonly allowlistId: string;
    readonly researchRunId: string;
    readonly researchTaskId: string;
    readonly runStatus: string;
    readonly effectStatus: string;
    readonly matrixBalanceStatus: string;
    readonly evidencePackGateStatus: string;
    readonly reviewCardState: string;
    readonly followUpQuestionCount: number;
    readonly queueBlockedCount: number;
  };
  readonly reason?: string;
  readonly blockers?: readonly string[];
  readonly checked: readonly string[];
}

export interface ResearchPipelineSmokeOptions {
  readonly appDataDir?: string;
  readonly cleanupAppDataDir?: boolean;
  readonly localCapabilityToken?: string;
}

interface ResearchScenario {
  readonly storage: SmokeStorage;
  readonly app: SmokeRequestApp;
}

interface ProjectContext {
  readonly projectId: string;
  readonly sessionId: string;
}

interface ResearchFlowResult {
  readonly project: ProjectContext;
  readonly startRun: JsonRecord;
  readonly effectResult: JsonRecord;
  readonly researchProjection: JsonRecord;
  readonly queueProjection: JsonRecord;
}

function firstRecordAt(value: unknown, label: string) {
  const first = recordArray(value, label)[0];

  if (!first) {
    throw new Error(`${label} must contain at least one record.`);
  }

  return first;
}

function maybeString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
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

async function createAllowlist(app: SmokeRequestApp, localCapabilityToken: string, projectId: string) {
  await postJson(app, `/api/v1/projects/${projectId}/research-allowlists`, localCapabilityToken, {
    allowlistId: ALLOWLIST_ID,
    connectorIds: ["public_search"],
    sourceCategories: ["public_web"],
    approvedBy: "research_pipeline_smoke"
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
    objective: "Find public validation evidence for the founder workflow assistant.",
    sourceQueueItemId: SOURCE_QUEUE_ITEM_ID,
    routeOutcome: "research_needed",
    impact: "high"
  });
  const projection = objectAt(data.immediateProjection, "plan research immediateProjection");
  const researchTaskId = stringAt(recordArray(projection.tasks, "planned research tasks")[0]?.researchTaskId, "researchTaskId");

  return researchTaskId;
}

async function startResearchRun(
  app: SmokeRequestApp,
  localCapabilityToken: string,
  projectId: string,
  researchTaskId: string
) {
  return postJson(app, `/api/v1/projects/${projectId}/research-runs`, localCapabilityToken, {
    researchRunId: RESEARCH_RUN_ID,
    researchTaskId,
    allowlistId: ALLOWLIST_ID,
    connectorId: "public_search",
    sourceCategory: "public_web",
    researchObjective: "Find public validation evidence for the founder workflow assistant.",
    productCategory: "Founder workflow assistant",
    customerProblemHypothesis: "Early founders need safer validation research before implementation.",
    contextHash: "ctx_research_pipeline_smoke",
    sourceRefs: [SOURCE_QUEUE_ITEM_ID]
  });
}

async function importResearchResult(input: {
  readonly app: SmokeRequestApp;
  readonly storage: SmokeStorage;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly researchTaskId: string;
}) {
  const expectedStateVersion = await sessionEventCount(input.storage, input.sessionId);

  return postJson(input.app, `/api/v1/research-tasks/${input.researchTaskId}/results`, input.localCapabilityToken, {
    sessionId: input.sessionId,
    researchTaskId: input.researchTaskId,
    researchRunId: RESEARCH_RUN_ID,
    expectedStateVersion,
    result: "Pro: public onboarding evidence supports a sharper founder validation loop.",
    sourceTitle: "Research pipeline smoke source",
    sourceUrl: "https://example.com/research-pipeline-smoke",
    sourceReliability: "medium",
    sourceRetrievedAt: "2026-05-23T00:00:00.000Z",
    limitationNotes: "No counter-evidence source was imported, so skeptical follow-up is still required.",
    claim: "The founder validation loop has enough support to continue, but skeptical evidence is missing.",
    decisionContext: "planning_readiness",
    specSectionRef: "spec:research-pipeline-smoke",
    questionRef: SOURCE_QUEUE_ITEM_ID,
    implicationScope: "Smoke evidence only; no external write or automatic spec update is performed.",
    synthesisVersion: 1
  });
}

async function executeResearchFlow(scenario: ResearchScenario, localCapabilityToken: string): Promise<ResearchFlowResult> {
  const project = await createProject(scenario.app, localCapabilityToken);

  await createAllowlist(scenario.app, localCapabilityToken, project.projectId);
  const researchTaskId = await planResearchTask({
    app: scenario.app,
    storage: scenario.storage,
    localCapabilityToken,
    sessionId: project.sessionId
  });
  const startRun = await startResearchRun(scenario.app, localCapabilityToken, project.projectId, researchTaskId);

  await importResearchResult({
    app: scenario.app,
    storage: scenario.storage,
    localCapabilityToken,
    sessionId: project.sessionId,
    researchTaskId
  });
  const effectResult = firstRecordAt(
    await createProductEngineCommandService(scenario.storage).runPendingResearchEvidenceEffects(),
    "research evidence effect results"
  );
  const researchProjection = await getJson(scenario.app, `/api/v1/sessions/${project.sessionId}/research`, localCapabilityToken);
  const queueProjection = await getJson(scenario.app, `/api/v1/sessions/${project.sessionId}/queue`, localCapabilityToken);

  return {
    project,
    startRun,
    effectResult,
    researchProjection,
    queueProjection
  };
}

function flowBlockers(result: ResearchFlowResult) {
  const blockers: string[] = [];
  const startProjection = objectAt(result.startRun.immediateProjection, "start research immediateProjection");
  const startedRun = objectAt(startProjection.researchRun, "started researchRun");
  const matrices = recordArray(result.researchProjection.evidenceMatrices, "research evidenceMatrices");
  const packs = recordArray(result.researchProjection.evidencePacks, "research evidencePacks");
  const reviewCards = recordArray(result.researchProjection.reviewCards, "research reviewCards");
  const activeQueue = recordArray(result.queueProjection.active, "queue active");
  const nextQueue = recordArray(result.queueProjection.next, "queue next");
  const blockedQueue = recordArray(result.queueProjection.blocked, "queue blocked");
  const deferredQueue = recordArray(result.queueProjection.deferred, "queue deferred");
  const matrix = firstRecordAt(matrices, "research evidenceMatrices");
  const pack = firstRecordAt(packs, "research evidencePacks");
  const reviewCard = firstRecordAt(reviewCards, "research reviewCards");
  const followUps = [...activeQueue, ...nextQueue, ...blockedQueue, ...deferredQueue].filter(
    (item) => item.cardType === "follow_up_question"
  );

  if (startProjection.status !== "started") {
    blockers.push(`research run start status must be started; received ${JSON.stringify(startProjection.status)}`);
  }

  if (startedRun.status !== "running") {
    blockers.push(`research run must start running; received ${JSON.stringify(startedRun.status)}`);
  }

  if (result.effectResult.status !== "succeeded" && result.effectResult.status !== "skipped") {
    blockers.push(`research evidence effect must drain or succeed; received ${JSON.stringify(result.effectResult.status)}`);
  }

  if (matrix.balanceStatus !== "missing_con_evidence") {
    blockers.push(`evidence matrix must expose missing_con_evidence; received ${JSON.stringify(matrix.balanceStatus)}`);
  }

  if (pack.gateStatus !== "research_insufficient") {
    blockers.push(`evidence pack must require research_insufficient review; received ${JSON.stringify(pack.gateStatus)}`);
  }

  if (reviewCard.blocksPlanning !== true) {
    blockers.push("research review card must block planning until skeptical follow-up is handled");
  }

  if (followUps.length < 1) {
    blockers.push("Decision Queue must expose at least one research follow-up question");
  }

  return blockers;
}

function passedEvidence(result: ResearchFlowResult): ResearchPipelineSmokeEvidence {
  const startProjection = objectAt(result.startRun.immediateProjection, "start research immediateProjection");
  const startedRun = objectAt(startProjection.researchRun, "started researchRun");
  const matrix = firstRecordAt(result.researchProjection.evidenceMatrices, "research evidenceMatrices");
  const pack = firstRecordAt(result.researchProjection.evidencePacks, "research evidencePacks");
  const reviewCard = firstRecordAt(result.researchProjection.reviewCards, "research reviewCards");
  const activeQueue = recordArray(result.queueProjection.active, "queue active");
  const nextQueue = recordArray(result.queueProjection.next, "queue next");
  const blockedQueue = recordArray(result.queueProjection.blocked, "queue blocked");
  const deferredQueue = recordArray(result.queueProjection.deferred, "queue deferred");
  const followUps = [...activeQueue, ...nextQueue, ...blockedQueue, ...deferredQueue].filter(
    (item) => item.cardType === "follow_up_question"
  );

  return {
    status: "passed",
    smoke: RESEARCH_PIPELINE_SMOKE,
    mode: "fixture",
    project: result.project,
    research: {
      allowlistId: ALLOWLIST_ID,
      researchRunId: stringAt(startedRun.researchRunId, "started researchRunId"),
      researchTaskId: stringAt(startedRun.researchTaskId, "started researchTaskId"),
      runStatus: stringAt(startedRun.status, "started run status"),
      effectStatus: stringAt(result.effectResult.status, "research effect status"),
      matrixBalanceStatus: stringAt(matrix.balanceStatus, "matrix balanceStatus"),
      evidencePackGateStatus: stringAt(pack.gateStatus, "pack gateStatus"),
      reviewCardState: maybeString(reviewCard.state) ?? "unknown",
      followUpQuestionCount: followUps.length,
      queueBlockedCount: blockedQueue.length
    },
    checked: [
      "temporary local sidecar and app data created",
      "public-web allowlist created without credentials",
      "read-only research run started",
      "manual/provider-style research result imported with source trace",
      "pending research_evidence_effect drained or evidence synthesis already present",
      "Research projection exposes evidence matrix, evidence pack, and review card",
      "Decision Queue exposes source-traceable follow-up question debt"
    ]
  };
}

function blockedEvidence(result: ResearchFlowResult, blockers: readonly string[]): ResearchPipelineSmokeEvidence {
  return {
    ...passedEvidence(result),
    status: "blocked",
    reason: "Research pipeline smoke did not satisfy every critical-path fixture check.",
    blockers
  };
}

function errorEvidence(error: unknown): ResearchPipelineSmokeEvidence {
  const message = error instanceof Error ? error.message : String(error);

  return {
    status: "blocked",
    smoke: RESEARCH_PIPELINE_SMOKE,
    mode: "fixture",
    reason: "Research pipeline smoke failed before full evidence could be collected.",
    blockers: [message],
    checked: ["temporary local research pipeline smoke started"]
  };
}

async function createScenario(appDataDir: string, localCapabilityToken: string): Promise<ResearchScenario> {
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

export async function runResearchPipelineSmoke(
  options: ResearchPipelineSmokeOptions = {}
): Promise<ResearchPipelineSmokeEvidence> {
  const appDataDir = options.appDataDir ?? (await mkdtemp(join(tmpdir(), "solo-superman-research-pipeline-smoke-")));
  const shouldCleanup = options.cleanupAppDataDir ?? !options.appDataDir;
  const localCapabilityToken = options.localCapabilityToken ?? `research-pipeline-smoke-${randomUUID()}`;
  let scenario: ResearchScenario | null = null;

  try {
    scenario = await createScenario(appDataDir, localCapabilityToken);
    const result = await executeResearchFlow(scenario, localCapabilityToken);
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

function exitCodeForEvidence(evidence: ResearchPipelineSmokeEvidence) {
  return evidence.status === "passed" ? 0 : 1;
}

async function main() {
  const evidence = await runResearchPipelineSmoke();

  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = exitCodeForEvidence(evidence);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
