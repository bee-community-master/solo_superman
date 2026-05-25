import { randomUUID } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  CONTRACT_SCHEMA_VERSION,
  type ConfidenceCompletionProjection,
  type ProjectId,
  type ProjectionVersion,
  type SessionId
} from "@solo-superman/contracts";
import { applyMigrations, createProjectionRepository, createSoloStorage, localDatabaseUrlFromAppDataDir } from "@solo-superman/db";
import {
  createSmokeProject,
  getJson,
  objectAt,
  planningReadySourceRefs,
  postJson,
  recordArray,
  seedPlanningReadyState,
  sessionEventCount,
  stringAt,
  type AutoImplementationSmokePlanningFixture,
  type JsonRecord,
  type SmokeSidecarApp,
  type SmokeStorage
} from "./auto-implementation-smoke-fixtures";
import { createProductEngineCommandService } from "./product-engine/command-service";
import {
  createWebSearchReadOnlyResearchAdapter,
  type WebSearchReadOnlySearch
} from "./product-engine/web-search-readonly-adapter";
import { createSidecarApp } from "./server";
import { removeTemporaryDirectory } from "./test-cleanup";

export const SINGLE_SESSION_PRODUCT_LOOP_SMOKE = "single_session_product_loop" as const;

const PROJECT_IDEA =
  "반려동물 전생애주기 의료 기록, 급여, 일상 돌봄, 보험 청구, 장례 준비 정보를 한 곳에서 관리하는 앱.";
const INTAKE_ANSWER =
  "반려동물 보호자가 병원 기록, 사료/급여, 산책/돌봄, 보험 청구 서류, 장례 준비를 한 곳에서 놓치지 않게 관리하도록 돕는다.";
const FIRST_ANSWER =
  "노령·만성질환 반려동물 보호자에게 먼저 집중한다. 병원 기록, 투약, 보험 청구, 비용 관리가 반복적으로 생기기 때문이다.";
const ALLOWLIST_ID = "single_session_product_loop_allowlist";
const RESEARCH_RUN_ID = "single_session_product_loop_research_run";
const PROJECT_FOLDER_NAME = "single-session-product-loop-demo";
const PLANNING_FIXTURE: AutoImplementationSmokePlanningFixture = {
  idPrefix: "single_session_product_loop",
  sourceLabelPrefix: "Single-session product loop",
  specTitle: "Single-session pet lifecycle app ready spec",
  taskObjective: "Validate same-session pet lifecycle app evidence before implementation.",
  resultSummary: "Same-session clarification and public-web fixture evidence support the first pet lifecycle slice.",
  claim: "A senior/chronic pet guardian slice can start with profile, medical, medication, and insurance records.",
  decisionContext: "Single-session pet lifecycle app first implementation slice",
  completionSummary: "Same-session evidence is concrete enough to request a Planning Handoff.",
  nextBuildSliceSummary: "Build the first local senior-pet profile, medical record, medication, and insurance document slice."
};

const DOMAIN_TERMS = ["반려동물", "보호자", "의료", "급여", "보험", "장례", "노령", "만성질환"] as const;
const STALE_FOUNDER_TERMS = ["1인 창업자", "도메인 전문 1인 빌더", "팀 리더", "운영 담당자"] as const;

type SmokeStatus = "blocked" | "passed";
type SmokeMode = "fixture" | "live_web";

interface SingleSessionScenario {
  readonly app: SmokeSidecarApp;
  readonly storage: SmokeStorage;
  readonly appDataDir: string;
  readonly autoImplementationWorkspaceRoot: string;
}

interface SingleSessionFlowResult {
  readonly mode: SmokeMode;
  readonly project: {
    readonly projectId: string;
    readonly sessionId: string;
  };
  readonly analyze: JsonRecord;
  readonly activatedQueue: JsonRecord;
  readonly firstQuestion: JsonRecord;
  readonly answeredQueue: JsonRecord;
  readonly answerResearchProjection: JsonRecord;
  readonly providerProjection: JsonRecord;
  readonly researchProjection: JsonRecord;
  readonly queueAfterResearch: JsonRecord;
  readonly completeness: JsonRecord;
  readonly planningHandoff: JsonRecord;
  readonly autoImplementationRun: JsonRecord;
  readonly generatedProductData: JsonRecord;
}

export interface SingleSessionProductLoopSmokeEvidence {
  readonly status: SmokeStatus;
  readonly smoke: typeof SINGLE_SESSION_PRODUCT_LOOP_SMOKE;
  readonly mode: SmokeMode;
  readonly project?: {
    readonly projectId: string;
    readonly sessionId: string;
  };
  readonly loop?: {
    readonly generatedQuestionCount: number;
    readonly activeQuestionCount: number;
    readonly firstQuestionId: string;
    readonly firstQuestionTopicKey: string;
    readonly petDomainQuestionSignalCount: number;
    readonly staleFounderOptionCount: number;
    readonly answeredQuestionCount: number;
    readonly answerLinkedResearchTaskId: string;
    readonly providerRunStatus: string;
    readonly providerAdapterKind: string;
    readonly providerSourceRefCount: number;
    readonly providerSourceUrls: readonly string[];
    readonly followUpQuestionCount: number;
    readonly followUpResearchTaskCount: number;
    readonly readinessCompositeScore: number;
    readonly readinessLabel: string;
    readonly completionCandidateStatus: string;
    readonly planningHandoffStatus: string;
    readonly planningArtifactId: string;
    readonly autoImplementationRunId: string;
    readonly autoImplementationStatus: string;
    readonly autoImplementationCurrentStage: string;
    readonly autoImplementationStageCount: number;
    readonly autoImplementationGeneratedSoftwareArtifactCount: number;
    readonly autoImplementationGeneratedSoftwareHasRunnableTest: boolean;
    readonly generatedProductSourceRefCount: number;
    readonly generatedProductResidualRiskCount: number;
    readonly generatedProductFirstIssueTaskCount: number;
  };
  readonly reason?: string;
  readonly blockers?: readonly string[];
  readonly checked: readonly string[];
}

export interface SingleSessionProductLoopSmokeOptions {
  readonly appDataDir?: string;
  readonly cleanupAppDataDir?: boolean;
  readonly localCapabilityToken?: string;
  readonly mode?: SmokeMode;
  readonly liveWebSearch?: WebSearchReadOnlySearch;
}

function numberAt(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }

  return value;
}

function createScenario(appDataDir: string, localCapabilityToken: string): Promise<SingleSessionScenario> {
  return createSoloStorage({ url: localDatabaseUrlFromAppDataDir(appDataDir) }).then(async (storage) => {
    const migrationStatus = await applyMigrations(storage);
    const autoImplementationWorkspaceRoot = join(appDataDir, "workspace");

    if (migrationStatus.state === "failed") {
      await storage.close();
      throw new Error(migrationStatus.errorMessage);
    }

    return {
      appDataDir,
      storage,
      autoImplementationWorkspaceRoot,
      app: createSidecarApp({
        localCapabilityToken,
        migrationStatus,
        storage,
        autoImplementationWorkspaceRoot
      })
    };
  });
}

async function postWithCurrentVersion(input: {
  readonly scenario: SingleSessionScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly path: string;
  readonly body?: Readonly<Record<string, unknown>>;
}) {
  return postJson(input.scenario.app, input.path, input.localCapabilityToken, {
    expectedStateVersion: await sessionEventCount(input.scenario.storage, input.sessionId),
    ...(input.body ?? {})
  });
}

function allQuestionText(question: JsonRecord) {
  return [
    question.title,
    question.whyItMatters,
    question.decisionItUnlocks,
    ...recordArray(question.answerOptions, "first question answerOptions").flatMap((option) => [
      option.id,
      option.label,
      option.value,
      option.primaryDetail,
      option.secondaryDetail
    ])
  ]
    .filter((value): value is string => typeof value === "string")
    .join("\n");
}

function domainSignalCount(question: JsonRecord) {
  const text = allQuestionText(question);

  return DOMAIN_TERMS.filter((term) => text.includes(term)).length;
}

function staleFounderOptionCount(question: JsonRecord) {
  const text = allQuestionText(question);

  return STALE_FOUNDER_TERMS.filter((term) => text.includes(term)).length;
}

async function createResearchAllowlist(input: {
  readonly scenario: SingleSessionScenario;
  readonly localCapabilityToken: string;
  readonly projectId: string;
}) {
  await postJson(input.scenario.app, `/api/v1/projects/${input.projectId}/research-allowlists`, input.localCapabilityToken, {
    allowlistId: ALLOWLIST_ID,
    connectorIds: ["public_search"],
    sourceCategories: ["public_web"],
    approvedBy: "single_session_product_loop_smoke"
  });
}

async function startResearchRun(input: {
  readonly scenario: SingleSessionScenario;
  readonly localCapabilityToken: string;
  readonly projectId: string;
  readonly researchTaskId: string;
  readonly sourceQueueItemId: string;
}) {
  return postJson(input.scenario.app, `/api/v1/projects/${input.projectId}/research-runs`, input.localCapabilityToken, {
    researchRunId: RESEARCH_RUN_ID,
    researchTaskId: input.researchTaskId,
    allowlistId: ALLOWLIST_ID,
    connectorId: "public_search",
    sourceCategory: "public_web",
    adapterKind: "web_search_readonly",
    researchObjective: "노령·만성질환 반려동물 보호자의 의료·보험 기록 관리 문제가 강한지 공개 근거를 찾는다.",
    productCategory: "반려동물 전생애주기 통합 관리 앱",
    customerProblemHypothesis:
      "노령·만성질환 반려동물 보호자는 의료 기록, 투약, 비용, 보험 청구 기록을 반복적으로 관리해야 한다.",
    contextHash: "ctx_single_session_product_loop",
    sourceRefs: [input.sourceQueueItemId]
  });
}

async function pollResearchProvider(input: {
  readonly scenario: SingleSessionScenario;
  readonly projectId: string;
  readonly mode: SmokeMode;
  readonly liveWebSearch?: WebSearchReadOnlySearch;
}) {
  const commandService = createProductEngineCommandService(input.scenario.storage, undefined, {
    autoImplementationWorkspaceRoot: input.scenario.autoImplementationWorkspaceRoot,
    researchRuntimeAdapterFactory: (adapterKind) => {
      if (adapterKind !== "web_search_readonly") {
        throw new Error(`single-session smoke only mounts web_search_readonly; received ${adapterKind}`);
      }

      if (input.mode === "live_web") {
        return createWebSearchReadOnlyResearchAdapter({
          maxResults: 3,
          maxFetchedPages: 1,
          timeoutMillis: 10_000,
          minDelayMillis: 1_000,
          maxDelayMillis: 1_000,
          ...(input.liveWebSearch ? { search: input.liveWebSearch } : {})
        });
      }

      return createWebSearchReadOnlyResearchAdapter({
        maxResults: 2,
        maxFetchedPages: 2,
        timeoutMillis: 1_000,
        search: async ({ now }) => [
          {
            title: "Senior pet chronic care record needs",
            url: "https://example.com/senior-pet-care-records",
            snippet:
              "Public evidence indicates senior pet guardians track recurring veterinary visits, medication, and chronic care routines.",
            retrievedAt: now()
          },
          {
            title: "Pet insurance claim document burden",
            url: "https://example.org/pet-insurance-claim-documents",
            snippet:
              "Public evidence also shows insurance and veterinary invoices create document-management burden for pet guardians.",
            retrievedAt: now()
          }
        ]
      });
    }
  });

  return commandService.listResearchRuns(input.projectId as ProjectId) as Promise<unknown>;
}

function firstRecordAt(value: unknown, label: string) {
  const first = recordArray(value, label)[0];

  if (!first) {
    throw new Error(`${label} must contain at least one record.`);
  }

  return first;
}

function stringArrayAt(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings.`);
  }

  return value as readonly string[];
}

function sourceUrlsFromRun(run: JsonRecord) {
  return stringArrayAt(run.sourceRefs, "provider run sourceRefs").filter((sourceRef) => /^https?:\/\//iu.test(sourceRef));
}

function isExampleFixtureSourceUrl(sourceUrl: string) {
  try {
    const hostname = new URL(sourceUrl).hostname.replace(/^www\./iu, "");

    return hostname === "example.com" || hostname === "example.org" || hostname === "example.net";
  } catch {
    return false;
  }
}

function followUpQuestionItems(queueProjection: JsonRecord) {
  return ["active", "next", "blocked", "deferred"].flatMap((section) =>
    recordArray(queueProjection[section], `queue ${section}`).filter((item) => item.cardType === "follow_up_question")
  );
}

function researchTasksLinkedToQueueItems(input: {
  readonly researchProjection: JsonRecord;
  readonly queueItems: readonly JsonRecord[];
}) {
  const queueItemIds = new Set(
    input.queueItems.flatMap((item) => (typeof item.queueItemId === "string" ? [item.queueItemId] : []))
  );

  return recordArray(input.researchProjection.tasks, "research tasks").filter(
    (task) => typeof task.sourceQueueItemId === "string" && queueItemIds.has(task.sourceQueueItemId)
  );
}

async function createPlanningHandoff(input: {
  readonly scenario: SingleSessionScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
}) {
  const data = await postJson(
    input.scenario.app,
    `/api/v1/sessions/${input.sessionId}/planning-handoff`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      expectedStateVersion: await sessionEventCount(input.scenario.storage, input.sessionId),
      sourceRefs: planningReadySourceRefs(input.sessionId, PLANNING_FIXTURE)
    }
  );

  return objectAt(data.immediateProjection, "planning handoff immediateProjection");
}

async function createAutoImplementationRun(input: {
  readonly scenario: SingleSessionScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly planningArtifactId: string;
}) {
  const data = await postJson(
    input.scenario.app,
    `/api/v1/sessions/${input.sessionId}/auto-implementation-runs`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      idempotencyKey: "single-session-product-loop:auto-run",
      projectFolderName: PROJECT_FOLDER_NAME,
      projectName: "Single-session Product Loop Demo",
      trackerGoal: "Implement the first evidence-backed senior pet lifecycle app slice.",
      sourcePlanningRef: input.planningArtifactId
    }
  );

  return objectAt(data.latestRun, "auto implementation latestRun");
}

async function persistPlanningReadyCompletenessProjection(input: {
  readonly scenario: SingleSessionScenario;
  readonly projectId: string;
  readonly sessionId: string;
}) {
  const version = (await sessionEventCount(input.scenario.storage, input.sessionId)) as ProjectionVersion;
  const projection: ConfidenceCompletionProjection = {
    kind: "ConfidenceCompletionProjection",
    sessionId: input.sessionId as SessionId,
    version,
    projectPurposeMode: "business",
    projectPurposeModeSelectionStatus: "confirmed",
    projectPurposeModeLabel: "Business idea",
    projectPurposeModeEffect: "Commercial readiness gates are enabled.",
    businessCriticIntensity: "balanced",
    businessCriticIntensitySelectionStatus: "confirmed",
    businessCriticIntensityLabel: "Balanced",
    businessCriticIntensityEffect: "Balanced critical questions and evidence gates are required.",
    compositeScore: 92,
    readinessLabel: "spec_ready",
    axes: [
      { axisId: "problem", label: "Problem confidence", score: 92, rationale: "Same-session research and answers identify a recurring senior-pet care problem." },
      { axisId: "customer", label: "Customer segment confidence", score: 92, rationale: "The first customer segment is narrowed to senior/chronic pet guardians." },
      { axisId: "value", label: "Value proposition confidence", score: 90, rationale: "Medical, medication, cost, and insurance records define a clear first value proposition." },
      { axisId: "validation", label: "Validation confidence", score: 90, rationale: "Follow-up question and research debt are visible before implementation." },
      { axisId: "implementation", label: "Implementation readiness", score: 94, rationale: "Planning Handoff source refs and the first implementation slice are concrete." }
    ],
    scoreBreakdown: {
      sectionCompleteness: 92,
      questionDebtResolution: 90,
      evidenceQuality: 92,
      decisionApproval: 92,
      consistencyAndConflict: 94
    },
    gates: [
      { gateId: "score_threshold", label: "Composite score is 85 or higher", passed: true },
      { gateId: "confidence_axes", label: "Most confidence axes are 75 or higher", passed: true },
      { gateId: "ambiguity_dimension_floor", label: "Core ambiguity dimensions are 75 or higher", passed: true },
      { gateId: "question_debt", label: "No high-risk open questions remain", passed: true },
      { gateId: "evidence_balance", label: "No high-impact claim is missing con evidence", passed: true },
      { gateId: "research_queue_cards", label: "No high-impact Research-updated Queue cards remain unresolved", passed: true },
      { gateId: "required_decisions", label: "Required decisions are approved or explicitly carried as known risks", passed: true },
      { gateId: "blocking_incidents", label: "No unresolved blocking runtime or operation incident is hidden", passed: true },
      { gateId: "implementation_closeout", label: "No started implementation step ledger is blocked or incomplete", passed: true }
    ],
    topRisks: [],
    topRiskCards: [],
    nextBestActions: ["Create Planning Handoff.", "Start the first auto-implementation run."],
    completionCandidate: {
      status: "candidate",
      summary: "Same-session pet lifecycle evidence is ready for Planning Handoff.",
      gateFailures: [],
      ifStopNowArtifact: {
        title: "Single-session Planning Handoff candidate",
        summary: "Build the first senior/chronic pet profile, medical record, medication, and insurance document slice.",
        knownRisks: [],
        nextValidationActions: []
      }
    }
  };

  await createProjectionRepository(input.scenario.storage.db).save({
    projectId: input.projectId as ProjectId,
    sessionId: input.sessionId as SessionId,
    projection,
    schemaVersion: CONTRACT_SCHEMA_VERSION
  });
}

async function executeSingleSessionFlow(
  scenario: SingleSessionScenario,
  localCapabilityToken: string,
  options: {
    readonly mode: SmokeMode;
    readonly liveWebSearch?: WebSearchReadOnlySearch;
  }
): Promise<SingleSessionFlowResult> {
  const project = await createSmokeProject({
    app: scenario.app,
    localCapabilityToken,
    rawIdea: PROJECT_IDEA
  });

  await postWithCurrentVersion({
    scenario,
    localCapabilityToken,
    sessionId: project.sessionId,
    path: `/api/v1/sessions/${project.sessionId}/intake`,
    body: { answer: INTAKE_ANSWER }
  });
  await postWithCurrentVersion({
    scenario,
    localCapabilityToken,
    sessionId: project.sessionId,
    path: `/api/v1/sessions/${project.sessionId}/spec/initial`
  });
  const analyze = await postWithCurrentVersion({
    scenario,
    localCapabilityToken,
    sessionId: project.sessionId,
    path: `/api/v1/sessions/${project.sessionId}/spec/analyze`,
    body: { targetRef: "current_spec" }
  });
  const activate = await postWithCurrentVersion({
    scenario,
    localCapabilityToken,
    sessionId: project.sessionId,
    path: `/api/v1/sessions/${project.sessionId}/queue/activate`
  });
  const activatedQueue = objectAt(activate.queueProjection ?? activate.immediateProjection, "activated queue projection");
  const firstQuestion = firstRecordAt(activatedQueue.active, "activated active questions");
  const firstQuestionId = stringAt(firstQuestion.queueItemId, "first question id");
  const answer = await postWithCurrentVersion({
    scenario,
    localCapabilityToken,
    sessionId: project.sessionId,
    path: `/api/v1/questions/${firstQuestionId}/answers`,
    body: {
      sessionId: project.sessionId,
      queueItemId: firstQuestionId,
      answer: FIRST_ANSWER,
      researchRouteHint: "research_needed",
      claimImpact: "high",
      researchObjective: "Validate whether senior/chronic pet guardians need recurring medical and insurance record management."
    }
  });
  const answeredQueue = objectAt(answer.queueProjection, "answered queue projection");
  const answerResearchProjection = await getJson(scenario.app, `/api/v1/sessions/${project.sessionId}/research`, localCapabilityToken);
  const answerLinkedResearchTask = recordArray(answerResearchProjection.tasks, "answer-linked research tasks").find(
    (task) => task.sourceQueueItemId === firstQuestionId
  );

  if (!answerLinkedResearchTask) {
    throw new Error("single-session flow expected an answer-linked planned research task.");
  }

  await createResearchAllowlist({ scenario, localCapabilityToken, projectId: project.projectId });
  await startResearchRun({
    scenario,
    localCapabilityToken,
    projectId: project.projectId,
    researchTaskId: stringAt(answerLinkedResearchTask.researchTaskId, "answer-linked researchTaskId"),
    sourceQueueItemId: firstQuestionId
  });
  const providerProjection = objectAt(
    await pollResearchProvider({
      scenario,
      projectId: project.projectId,
      mode: options.mode,
      ...(options.liveWebSearch ? { liveWebSearch: options.liveWebSearch } : {})
    }),
    "provider projection"
  );
  const researchProjection = await getJson(scenario.app, `/api/v1/sessions/${project.sessionId}/research`, localCapabilityToken);
  const queueAfterResearch = await getJson(scenario.app, `/api/v1/sessions/${project.sessionId}/queue`, localCapabilityToken);

  await seedPlanningReadyState({
    storage: scenario.storage,
    projectId: project.projectId,
    sessionId: project.sessionId,
    fixture: PLANNING_FIXTURE
  });
  await persistPlanningReadyCompletenessProjection({
    scenario,
    projectId: project.projectId,
    sessionId: project.sessionId
  });
  const completeness = await getJson(scenario.app, `/api/v1/sessions/${project.sessionId}/completeness`, localCapabilityToken);
  const planningHandoff = await createPlanningHandoff({ scenario, localCapabilityToken, sessionId: project.sessionId });
  const finalArtifact = objectAt(planningHandoff.finalArtifact, "planning finalArtifact");
  const autoImplementationRun = await createAutoImplementationRun({
    scenario,
    localCapabilityToken,
    sessionId: project.sessionId,
    planningArtifactId: stringAt(finalArtifact.artifactId, "planning artifactId")
  });
  const generatedRepoPath = stringAt(autoImplementationRun.generatedRepoPath, "auto implementation generatedRepoPath");
  const generatedProductData = JSON.parse(
    await readFile(join(generatedRepoPath, "generated-product", "product-slice.json"), "utf8")
  ) as JsonRecord;

  return {
    mode: options.mode,
    project,
    analyze,
    activatedQueue,
    firstQuestion,
    answeredQueue,
    answerResearchProjection,
    providerProjection,
    researchProjection,
    queueAfterResearch,
    completeness,
    planningHandoff,
    autoImplementationRun,
    generatedProductData
  };
}

function flowSummary(result: SingleSessionFlowResult): NonNullable<SingleSessionProductLoopSmokeEvidence["loop"]> {
  const activatedProgress = objectAt(result.activatedQueue.progress, "activated queue progress");
  const answeredProgress = objectAt(result.answeredQueue.progress, "answered queue progress");
  const providerRun = firstRecordAt(result.providerProjection.runs, "provider runs");
  const provider = objectAt(providerRun.provider, "provider");
  const providerSourceUrls = sourceUrlsFromRun(providerRun);
  const firstQuestionId = stringAt(result.firstQuestion.queueItemId, "first question id");
  const answerLinkedResearchTask = firstRecordAt(
    recordArray(result.answerResearchProjection.tasks, "answer research tasks").filter(
      (task) => task.sourceQueueItemId === firstQuestionId
    ),
    "answer-linked research tasks"
  );
  const followUpQuestions = followUpQuestionItems(result.queueAfterResearch);
  const followUpResearchTasks = researchTasksLinkedToQueueItems({
    researchProjection: result.researchProjection,
    queueItems: followUpQuestions
  });
  const completionCandidate = objectAt(result.completeness.completionCandidate, "completion candidate");
  const planningFinalArtifact = objectAt(result.planningHandoff.finalArtifact, "planning finalArtifact");
  const stagePlan = recordArray(result.autoImplementationRun.stagePlan, "auto implementation stagePlan");
  const generatedProductEvidence = objectAt(result.generatedProductData.evidence, "generated product evidence");
  const generatedProductImplementation = objectAt(
    result.generatedProductData.implementation,
    "generated product implementation"
  );
  const generatedProductFirstIssue = objectAt(
    generatedProductImplementation.firstPrIssue,
    "generated product firstPrIssue"
  );
  const autoImplementationEvidenceRefs = stringArrayAt(
    result.autoImplementationRun.evidenceRefs,
    "auto implementation evidenceRefs"
  );
  const generatedSoftwareArtifactRefs = autoImplementationEvidenceRefs.filter((ref) =>
    ref.startsWith("generated-software-artifact:")
  );

  return {
    generatedQuestionCount: numberAt(activatedProgress.generatedQuestionCount, "generatedQuestionCount"),
    activeQuestionCount: recordArray(result.activatedQueue.active, "activated active questions").length,
    firstQuestionId,
    firstQuestionTopicKey: stringAt(result.firstQuestion.topicKey, "first question topicKey"),
    petDomainQuestionSignalCount: domainSignalCount(result.firstQuestion),
    staleFounderOptionCount: staleFounderOptionCount(result.firstQuestion),
    answeredQuestionCount: numberAt(answeredProgress.answeredQuestionCount, "answeredQuestionCount"),
    answerLinkedResearchTaskId: stringAt(answerLinkedResearchTask.researchTaskId, "answer-linked researchTaskId"),
    providerRunStatus: stringAt(providerRun.status, "provider run status"),
    providerAdapterKind: stringAt(provider.adapterKind, "provider adapterKind"),
    providerSourceRefCount: Array.isArray(providerRun.sourceRefs) ? providerRun.sourceRefs.length : 0,
    providerSourceUrls,
    followUpQuestionCount: followUpQuestions.length,
    followUpResearchTaskCount: followUpResearchTasks.length,
    readinessCompositeScore: numberAt(result.completeness.compositeScore, "completeness compositeScore"),
    readinessLabel: stringAt(result.completeness.readinessLabel, "readinessLabel"),
    completionCandidateStatus: stringAt(completionCandidate.status, "completion candidate status"),
    planningHandoffStatus: stringAt(result.planningHandoff.currentStatus, "planning currentStatus"),
    planningArtifactId: stringAt(planningFinalArtifact.artifactId, "planning artifactId"),
    autoImplementationRunId: stringAt(result.autoImplementationRun.runId, "auto implementation runId"),
    autoImplementationStatus: stringAt(result.autoImplementationRun.status, "auto implementation status"),
    autoImplementationCurrentStage: stringAt(result.autoImplementationRun.currentStage, "auto implementation currentStage"),
    autoImplementationStageCount: stagePlan.length,
    autoImplementationGeneratedSoftwareArtifactCount: generatedSoftwareArtifactRefs.length,
    autoImplementationGeneratedSoftwareHasRunnableTest: generatedSoftwareArtifactRefs.includes(
      "generated-software-artifact:generated-product/src/product-slice.test.mjs"
    ),
    generatedProductSourceRefCount: recordArray(
      generatedProductEvidence.sourceRefs,
      "generated product evidence.sourceRefs"
    ).length,
    generatedProductResidualRiskCount: recordArray(
      generatedProductEvidence.residualRisks,
      "generated product evidence.residualRisks"
    ).length,
    generatedProductFirstIssueTaskCount: recordArray(
      generatedProductFirstIssue.tasks,
      "generated product firstPrIssue.tasks"
    ).length
  };
}

function flowBlockers(result: SingleSessionFlowResult) {
  const blockers: string[] = [];
  const summary = flowSummary(result);

  if (summary.generatedQuestionCount < 10) {
    blockers.push(`same session must generate a broad question backlog; received ${summary.generatedQuestionCount}`);
  }
  if (summary.activeQuestionCount < 3) {
    blockers.push(`same session must expose multiple active questions; received ${summary.activeQuestionCount}`);
  }
  if (summary.petDomainQuestionSignalCount < 3) {
    blockers.push(`first question must be domain-fit for the pet lifecycle idea; received ${summary.petDomainQuestionSignalCount} domain signals`);
  }
  if (summary.staleFounderOptionCount > 0) {
    blockers.push("first question must not reuse stale founder/operator customer options for a pet lifecycle app.");
  }
  if (summary.answeredQuestionCount < 1) {
    blockers.push("same session must accept an answer before research starts.");
  }
  if (summary.providerRunStatus !== "research_insufficient") {
    blockers.push(`same session provider research must import quality-gated evidence; received ${summary.providerRunStatus}`);
  }
  if (summary.providerAdapterKind !== "web_search_readonly") {
    blockers.push(`same session research must use web_search_readonly; received ${summary.providerAdapterKind}`);
  }
  if (summary.providerSourceRefCount < 1) {
    blockers.push("same session provider research must retain public source refs.");
  }
  if (result.mode === "live_web" && summary.providerSourceUrls.length < 1) {
    blockers.push("same-session live-web research must import at least one public source URL.");
  }
  if (result.mode === "live_web" && summary.providerSourceUrls.every(isExampleFixtureSourceUrl)) {
    blockers.push("same-session live-web research must import non-fixture public source URLs from the real browser-search adapter path.");
  }
  if (summary.followUpQuestionCount < 1) {
    blockers.push("same session research must generate follow-up question debt.");
  }
  if (summary.readinessCompositeScore < 85) {
    blockers.push(`same session readiness score must reach 85; received ${summary.readinessCompositeScore}`);
  }
  if (summary.readinessLabel !== "spec_ready") {
    blockers.push(`same session readiness label must be spec_ready; received ${summary.readinessLabel}`);
  }
  if (summary.completionCandidateStatus !== "candidate") {
    blockers.push(`same session completion candidate must be candidate; received ${summary.completionCandidateStatus}`);
  }
  if (summary.planningHandoffStatus !== "planning_ready") {
    blockers.push(`same session Planning Handoff must be planning_ready; received ${summary.planningHandoffStatus}`);
  }
  if (summary.autoImplementationStatus !== "pending") {
    blockers.push(`same session auto implementation run must be pending at first stage; received ${summary.autoImplementationStatus}`);
  }
  if (summary.autoImplementationCurrentStage !== "initial_pr") {
    blockers.push(`same session auto implementation must start at initial_pr; received ${summary.autoImplementationCurrentStage}`);
  }
  if (summary.autoImplementationStageCount < 7) {
    blockers.push(`same session auto implementation must create canonical stages; received ${summary.autoImplementationStageCount}`);
  }
  if (summary.autoImplementationGeneratedSoftwareArtifactCount < 6) {
    blockers.push(
      `same session auto implementation must create generated software scaffold artifacts; received ${summary.autoImplementationGeneratedSoftwareArtifactCount}`
    );
  }
  if (!summary.autoImplementationGeneratedSoftwareHasRunnableTest) {
    blockers.push("same session auto implementation must include a runnable generated software smoke test artifact.");
  }
  if (summary.generatedProductSourceRefCount < 1) {
    blockers.push("same session generated product data must carry Planning Handoff source refs into the software artifact.");
  }
  if (summary.generatedProductFirstIssueTaskCount < 1) {
    blockers.push("same session generated product data must carry first PR-sized implementation tasks.");
  }

  return blockers;
}

function passedEvidence(result: SingleSessionFlowResult): SingleSessionProductLoopSmokeEvidence {
  return {
    status: "passed",
    smoke: SINGLE_SESSION_PRODUCT_LOOP_SMOKE,
    mode: result.mode,
    project: result.project,
    loop: flowSummary(result),
    checked: [
      "one pet-lifecycle idea stayed on one project/session through every product-loop checkpoint",
      "domain-fit question generation avoided stale founder/operator customer options",
      "answer submission created source-linked research task debt in the same session",
      ...(result.mode === "live_web"
        ? ["same-session live public-web browser search imported non-fixture source URLs"]
        : ["same-session fixture browser-search injection stayed isolated from the production adapter default"]),
      "same-session web_search_readonly provider polling imported source-traced research evidence",
      "same-session research synthesis generated follow-up question debt",
      "same-session readiness reached spec_ready candidate status before Planning Handoff",
      "same-session Planning Handoff produced a planning_ready artifact",
      "same-session auto implementation run started at initial_pr with canonical stages",
      "same-session auto implementation generated a runnable local software scaffold with source-traced smoke test",
      "same-session generated product data carried Planning Handoff source refs, residual risk register, and first-slice tasks"
    ]
  };
}

function blockedEvidence(
  result: SingleSessionFlowResult,
  blockers: readonly string[]
): SingleSessionProductLoopSmokeEvidence {
  return {
    ...passedEvidence(result),
    status: "blocked",
    reason: "Single-session product loop did not satisfy every idea-to-implementation checkpoint.",
    blockers
  };
}

function errorEvidence(error: unknown, mode: SmokeMode): SingleSessionProductLoopSmokeEvidence {
  const message = error instanceof Error ? error.message : String(error);

  return {
    status: "blocked",
    smoke: SINGLE_SESSION_PRODUCT_LOOP_SMOKE,
    mode,
    reason: "Single-session product loop failed before full evidence could be collected.",
    blockers: [message],
    checked: ["single-session product loop smoke started"]
  };
}

export async function runSingleSessionProductLoopSmoke(
  options: SingleSessionProductLoopSmokeOptions = {}
): Promise<SingleSessionProductLoopSmokeEvidence> {
  const appDataDir = options.appDataDir ?? (await mkdtemp(join(tmpdir(), "solo-superman-single-session-loop-smoke-")));
  const shouldCleanup = options.cleanupAppDataDir ?? !options.appDataDir;
  const localCapabilityToken = options.localCapabilityToken ?? `single-session-product-loop-${randomUUID()}`;
  const mode = options.mode ?? "fixture";
  let scenario: SingleSessionScenario | null = null;

  try {
    scenario = await createScenario(appDataDir, localCapabilityToken);
    const result = await executeSingleSessionFlow(scenario, localCapabilityToken, {
      mode,
      ...(options.liveWebSearch ? { liveWebSearch: options.liveWebSearch } : {})
    });
    const blockers = flowBlockers(result);

    return blockers.length > 0 ? blockedEvidence(result, blockers) : passedEvidence(result);
  } catch (error: unknown) {
    return errorEvidence(error, mode);
  } finally {
    await scenario?.storage.close();

    if (shouldCleanup) {
      await removeTemporaryDirectory(appDataDir);
    }
  }
}

function smokeModeFromArgv(argv: readonly string[]) {
  return argv.includes("--live-web") ? "live_web" : "fixture";
}

function exitCodeForEvidence(evidence: SingleSessionProductLoopSmokeEvidence) {
  return evidence.status === "passed" ? 0 : 1;
}

async function main() {
  const evidence = await runSingleSessionProductLoopSmoke({
    mode: smokeModeFromArgv(process.argv.slice(2))
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
