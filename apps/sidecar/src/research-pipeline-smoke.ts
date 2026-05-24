import { randomUUID } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "@solo-superman/db";
import type { ProjectId, SessionId } from "@solo-superman/contracts";
import { createProductEngineCommandService } from "./product-engine/command-service";
import {
  listResearchMemoryMarkdownSourceRefs,
  RESEARCH_MEMORY_SOURCE_REF_PREFIX
} from "./product-engine/research-memory-markdown";
import { createWebSearchReadOnlyResearchAdapter } from "./product-engine/web-search-readonly-adapter";
import { createSidecarApp } from "./server";
import { removeTemporaryDirectory } from "./test-cleanup";
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
const WIDER_RESEARCH_RUN_ID = "research_run_pipeline_memory_smoke";
const SOURCE_QUEUE_ITEM_ID = "queue_item_pipeline_smoke";
const WIDER_SOURCE_QUEUE_ITEM_ID = "queue_item_pipeline_memory_smoke";
const BASE_RESEARCH_OBJECTIVE = "Find public validation evidence for the founder workflow assistant.";
const WIDER_RESEARCH_OBJECTIVE = "Broaden research beyond existing notes for the founder workflow assistant.";

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
    readonly providerAdapterKind: string;
    readonly qualityGateStatus: string;
    readonly sourceRefCount: number;
    readonly matrixBalanceStatus: string;
    readonly evidencePackGateStatus: string;
    readonly reviewCardState: string;
    readonly followUpQuestionCount: number;
    readonly queueBlockedCount: number;
    readonly researchMemorySourceRefCount: number;
    readonly widerResearchSourceRefCount: number;
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
  readonly autoImplementationWorkspaceRoot: string;
  readonly researchMemoryMarkdownRoot: string;
}

interface ProjectContext {
  readonly projectId: string;
  readonly sessionId: string;
}

interface ResearchFlowResult {
  readonly project: ProjectContext;
  readonly startRun: JsonRecord;
  readonly widerResearchStartRun: JsonRecord;
  readonly providerProjection: JsonRecord;
  readonly researchProjection: JsonRecord;
  readonly queueProjection: JsonRecord;
  readonly researchMemorySourceRefs: readonly string[];
  readonly researchMemoryMarkdown: string;
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

function arrayLength(value: unknown, label: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value.length;
}

function stringArrayAt(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings.`);
  }

  return value as readonly string[];
}

function createResearchPipelineRuntimeAdapter(adapterKind: string) {
  if (adapterKind !== "web_search_readonly") {
    throw new Error(`research pipeline smoke only mounts web_search_readonly; received ${adapterKind}`);
  }

  return createWebSearchReadOnlyResearchAdapter({
    maxResults: 2,
    maxFetchedPages: 2,
    timeoutMillis: 1_000,
    search: async ({ now }) => [
      {
        title: "Public founder validation workflow evidence",
        url: "https://example.com/research-pipeline-smoke",
        snippet:
          "Public evidence supports asking sharper founder-validation questions before software implementation.",
        retrievedAt: now()
      },
      {
        title: "Skeptical product validation evidence",
        url: "https://example.org/research-pipeline-counterpoint",
        snippet:
          "Public evidence also highlights the need for counter-evidence and quality-gate review before planning-ready.",
        retrievedAt: now()
      }
    ]
  });
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
  readonly objective?: string;
  readonly sourceQueueItemId?: string;
}) {
  const expectedStateVersion = await sessionEventCount(input.storage, input.sessionId);
  const data = await postJson(input.app, `/api/v1/sessions/${input.sessionId}/research-tasks`, input.localCapabilityToken, {
    expectedStateVersion,
    objective: input.objective ?? BASE_RESEARCH_OBJECTIVE,
    sourceQueueItemId: input.sourceQueueItemId ?? SOURCE_QUEUE_ITEM_ID,
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
  researchTaskId: string,
  options: {
    readonly researchRunId?: string;
    readonly researchObjective?: string;
    readonly sourceRefs?: readonly string[];
  } = {}
) {
  return postJson(app, `/api/v1/projects/${projectId}/research-runs`, localCapabilityToken, {
    researchRunId: options.researchRunId ?? RESEARCH_RUN_ID,
    researchTaskId,
    allowlistId: ALLOWLIST_ID,
    connectorId: "public_search",
    sourceCategory: "public_web",
    adapterKind: "web_search_readonly",
    researchObjective: options.researchObjective ?? BASE_RESEARCH_OBJECTIVE,
    productCategory: "Founder workflow assistant",
    customerProblemHypothesis: "Early founders need safer validation research before implementation.",
    contextHash: "ctx_research_pipeline_smoke",
    sourceRefs: options.sourceRefs ?? [SOURCE_QUEUE_ITEM_ID]
  });
}

async function pollResearchProviderResult(input: {
  readonly storage: SmokeStorage;
  readonly projectId: string;
  readonly autoImplementationWorkspaceRoot: string;
}) {
  const commandService = createProductEngineCommandService(input.storage, undefined, {
    autoImplementationWorkspaceRoot: input.autoImplementationWorkspaceRoot,
    researchRuntimeAdapterFactory: createResearchPipelineRuntimeAdapter
  });

  return commandService.listResearchRuns(input.projectId as ProjectId);
}

async function listScenarioResearchMemory(input: {
  readonly researchMemoryMarkdownRoot: string;
  readonly projectId: string;
  readonly sessionId: string;
}) {
  const sourceRefs = await listResearchMemoryMarkdownSourceRefs({
    root: input.researchMemoryMarkdownRoot,
    projectId: input.projectId as ProjectId,
    sessionId: input.sessionId as SessionId
  });
  const firstSourceRef = sourceRefs[0];
  const firstRelativePath = firstSourceRef?.startsWith(RESEARCH_MEMORY_SOURCE_REF_PREFIX)
    ? firstSourceRef.slice(RESEARCH_MEMORY_SOURCE_REF_PREFIX.length)
    : null;
  const markdown = firstRelativePath
    ? await readFile(join(input.researchMemoryMarkdownRoot, firstRelativePath), "utf8")
    : "";

  return {
    sourceRefs,
    markdown
  };
}

async function executeResearchFlow(scenario: ResearchScenario, localCapabilityToken: string): Promise<ResearchFlowResult> {
  const project = await createProject(scenario.app, localCapabilityToken);

  await createAllowlist(scenario.app, localCapabilityToken, project.projectId);
  const researchTaskId = await planResearchTask({
    app: scenario.app,
    storage: scenario.storage,
    localCapabilityToken,
    sessionId: project.sessionId,
    objective: BASE_RESEARCH_OBJECTIVE,
    sourceQueueItemId: SOURCE_QUEUE_ITEM_ID
  });
  const startRun = await startResearchRun(scenario.app, localCapabilityToken, project.projectId, researchTaskId);
  const providerProjection = await pollResearchProviderResult({
    storage: scenario.storage,
    projectId: project.projectId,
    autoImplementationWorkspaceRoot: scenario.autoImplementationWorkspaceRoot
  });
  const researchMemory = await listScenarioResearchMemory({
    researchMemoryMarkdownRoot: scenario.researchMemoryMarkdownRoot,
    projectId: project.projectId,
    sessionId: project.sessionId
  });
  const widerResearchTaskId = await planResearchTask({
    app: scenario.app,
    storage: scenario.storage,
    localCapabilityToken,
    sessionId: project.sessionId,
    objective: WIDER_RESEARCH_OBJECTIVE,
    sourceQueueItemId: WIDER_SOURCE_QUEUE_ITEM_ID
  });
  const widerResearchStartRun = await startResearchRun(
    scenario.app,
    localCapabilityToken,
    project.projectId,
    widerResearchTaskId,
    {
      researchRunId: WIDER_RESEARCH_RUN_ID,
      researchObjective: WIDER_RESEARCH_OBJECTIVE,
      sourceRefs: [WIDER_SOURCE_QUEUE_ITEM_ID]
    }
  );
  const researchProjection = await getJson(scenario.app, `/api/v1/sessions/${project.sessionId}/research`, localCapabilityToken);
  const queueProjection = await getJson(scenario.app, `/api/v1/sessions/${project.sessionId}/queue`, localCapabilityToken);

  return {
    project,
    startRun,
    widerResearchStartRun,
    providerProjection: providerProjection as unknown as JsonRecord,
    researchProjection,
    queueProjection,
    researchMemorySourceRefs: researchMemory.sourceRefs,
    researchMemoryMarkdown: researchMemory.markdown
  };
}

function flowBlockers(result: ResearchFlowResult) {
  const blockers: string[] = [];
  const startProjection = objectAt(result.startRun.immediateProjection, "start research immediateProjection");
  const startedRun = objectAt(startProjection.researchRun, "started researchRun");
  const providerRun = firstRecordAt(result.providerProjection.runs, "provider-polled research runs");
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
  const widerStartProjection = objectAt(result.widerResearchStartRun.immediateProjection, "wider research immediateProjection");
  const widerStartedRun = objectAt(widerStartProjection.researchRun, "wider started researchRun");
  const followUps = [...activeQueue, ...nextQueue, ...blockedQueue, ...deferredQueue].filter(
    (item) => item.cardType === "follow_up_question"
  );

  if (startProjection.status !== "started") {
    blockers.push(`research run start status must be started; received ${JSON.stringify(startProjection.status)}`);
  }

  if (startedRun.status !== "running") {
    blockers.push(`research run must start running; received ${JSON.stringify(startedRun.status)}`);
  }

  if (providerRun.status !== "research_insufficient") {
    blockers.push(`provider-polled research run must finish as research_insufficient; received ${JSON.stringify(providerRun.status)}`);
  }

  const provider = objectAt(providerRun.provider, "provider-polled research run provider");
  if (provider.adapterKind !== "web_search_readonly") {
    blockers.push(`provider-polled research run must use web_search_readonly; received ${JSON.stringify(provider.adapterKind)}`);
  }

  if (providerRun.qualityGateStatus !== "insufficient") {
    blockers.push(`provider-polled research run must carry insufficient quality gate; received ${JSON.stringify(providerRun.qualityGateStatus)}`);
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

  if (result.researchMemorySourceRefs.length < 1) {
    blockers.push("provider-polled research must write at least one markdown research memory source ref");
  }

  if (!result.researchMemoryMarkdown.includes("## Reuse guidance")) {
    blockers.push("research memory markdown must include reuse guidance");
  }

  if (!result.researchMemoryMarkdown.includes("collect wider sources")) {
    blockers.push("research memory markdown must tell wider follow-up research to collect wider sources");
  }

  if (widerStartProjection.status !== "started") {
    blockers.push(`wider research run start status must be started; received ${JSON.stringify(widerStartProjection.status)}`);
  }

  const widerSourceRefs = stringArrayAt(widerStartedRun.sourceRefs, "wider research sourceRefs");
  if (!result.researchMemorySourceRefs.some((sourceRef) => widerSourceRefs.includes(sourceRef))) {
    blockers.push("wider follow-up research must carry existing markdown memory refs as baseline source refs");
  }

  return blockers;
}

function passedEvidence(result: ResearchFlowResult): ResearchPipelineSmokeEvidence {
  const startProjection = objectAt(result.startRun.immediateProjection, "start research immediateProjection");
  const startedRun = objectAt(startProjection.researchRun, "started researchRun");
  const providerRun = firstRecordAt(result.providerProjection.runs, "provider-polled research runs");
  const provider = objectAt(providerRun.provider, "provider-polled research run provider");
  const matrix = firstRecordAt(result.researchProjection.evidenceMatrices, "research evidenceMatrices");
  const pack = firstRecordAt(result.researchProjection.evidencePacks, "research evidencePacks");
  const reviewCard = firstRecordAt(result.researchProjection.reviewCards, "research reviewCards");
  const widerStartProjection = objectAt(result.widerResearchStartRun.immediateProjection, "wider research immediateProjection");
  const widerStartedRun = objectAt(widerStartProjection.researchRun, "wider started researchRun");
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
      runStatus: stringAt(providerRun.status, "provider-polled run status"),
      providerAdapterKind: stringAt(provider.adapterKind, "provider adapterKind"),
      qualityGateStatus: stringAt(providerRun.qualityGateStatus, "provider-polled run qualityGateStatus"),
      sourceRefCount: arrayLength(providerRun.sourceRefs, "provider-polled run sourceRefs"),
      matrixBalanceStatus: stringAt(matrix.balanceStatus, "matrix balanceStatus"),
      evidencePackGateStatus: stringAt(pack.gateStatus, "pack gateStatus"),
      reviewCardState: maybeString(reviewCard.state) ?? "unknown",
      followUpQuestionCount: followUps.length,
      queueBlockedCount: blockedQueue.length,
      researchMemorySourceRefCount: result.researchMemorySourceRefs.length,
      widerResearchSourceRefCount: stringArrayAt(widerStartedRun.sourceRefs, "wider started run sourceRefs").length
    },
    checked: [
      "temporary local sidecar and app data created",
      "public-web allowlist created without credentials",
      "read-only research run started",
      "mounted web_search_readonly provider result polled and imported with source trace",
      "provider-polled research writes markdown memory for future duplicate or broader research decisions",
      "wider follow-up research carries existing markdown memory refs as baseline context while still starting a new run",
      "provider quality gate marked insufficient evidence for review",
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
  const autoImplementationWorkspaceRoot = join(appDataDir, "workspace");

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
      autoImplementationWorkspaceRoot
    }),
    autoImplementationWorkspaceRoot,
    researchMemoryMarkdownRoot: join(autoImplementationWorkspaceRoot, "research-memory")
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
      await removeTemporaryDirectory(appDataDir);
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
