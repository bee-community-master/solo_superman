import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "@solo-superman/db";
import { createSidecarApp } from "./server";
import { removeTemporaryDirectory } from "./test-cleanup";
import {
  firstRecord,
  getJson,
  objectAt,
  postJson,
  recordArray,
  stringAt,
  type JsonRecord,
  type SmokeRequestApp
} from "./smoke-helpers";
import { sessionEventCount } from "./auto-implementation-smoke-fixtures";

export const CLARIFICATION_PIPELINE_SMOKE = "clarification_pipeline" as const;

const PROJECT_IDEA = "A clarification pipeline smoke idea for founder validation.";
const INTAKE_ANSWER =
  "Help solo founders turn a rough idea into a source-traced product spec, ask sharper follow-up questions, and avoid building before the risks are visible.";
const ANSWER_TEXT =
  "Focus on paid-interview prep founders who need a safer validation workflow before committing implementation time.";

type SmokeStatus = "blocked" | "passed";
type SmokeStorage = Awaited<ReturnType<typeof createSoloStorage>>;

export interface ClarificationPipelineSmokeEvidence {
  readonly status: SmokeStatus;
  readonly smoke: typeof CLARIFICATION_PIPELINE_SMOKE;
  readonly mode: "fixture";
  readonly project?: {
    readonly projectId: string;
    readonly sessionId: string;
  };
  readonly clarification?: {
    readonly generatedQuestionCount: number;
    readonly activeQuestionCount: number;
    readonly answeredQuestionCount: number;
    readonly followUpQuestionCount: number;
    readonly visibleQuestionDebtCount: number;
    readonly researchTaskCount: number;
    readonly firstQuestionId: string;
    readonly firstQuestionTopicKey: string;
    readonly answerFormatKinds: readonly string[];
    readonly answerSelectionModes: readonly string[];
    readonly completenessStatus: string;
    readonly questionDebtGatePassed: boolean;
    readonly planningHandoffStatus: string;
  };
  readonly reason?: string;
  readonly blockers?: readonly string[];
  readonly checked: readonly string[];
}

export interface ClarificationPipelineSmokeOptions {
  readonly appDataDir?: string;
  readonly cleanupAppDataDir?: boolean;
  readonly localCapabilityToken?: string;
}

interface ClarificationScenario {
  readonly storage: SmokeStorage;
  readonly app: SmokeRequestApp;
}

interface ProjectContext {
  readonly projectId: string;
  readonly sessionId: string;
}

interface ClarificationFlowResult {
  readonly project: ProjectContext;
  readonly analyze: JsonRecord;
  readonly activatedQueue: JsonRecord;
  readonly answeredQueue: JsonRecord;
  readonly researchProjection: JsonRecord;
  readonly completenessProjection: JsonRecord;
  readonly planningHandoffProjection: JsonRecord;
  readonly firstQuestion: JsonRecord;
}

function numberAt(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number; received ${JSON.stringify(value)}.`);
  }

  return value;
}

function booleanAt(value: unknown, label: string) {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean; received ${JSON.stringify(value)}.`);
  }

  return value;
}

function planningHandoffBlockerSourceRefs() {
  return [
    {
      sourceType: "spec_version",
      sourceId: "spec_version_clarification_pipeline_smoke",
      required: true,
      stale: false
    },
    {
      sourceType: "founder_brief",
      sourceId: "founder_brief_clarification_pipeline_smoke",
      required: true,
      stale: false
    },
    {
      sourceType: "decision_linked_evidence_pack",
      sourceId: "evidence_pack_clarification_pipeline_smoke",
      required: true,
      stale: false
    },
    {
      sourceType: "research_updated_queue_item",
      sourceId: "queue_clarification_pipeline_smoke",
      required: true,
      stale: false
    }
  ] as const;
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

async function expectedStateVersion(storage: SmokeStorage, sessionId: string) {
  return sessionEventCount(storage, sessionId);
}

async function postWithCurrentVersion(input: {
  readonly app: SmokeRequestApp;
  readonly storage: SmokeStorage;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly path: string;
  readonly body?: Readonly<Record<string, unknown>>;
}) {
  return postJson(input.app, input.path, input.localCapabilityToken, {
    expectedStateVersion: await expectedStateVersion(input.storage, input.sessionId),
    ...(input.body ?? {})
  });
}

async function runClarificationFlow(scenario: ClarificationScenario, localCapabilityToken: string): Promise<ClarificationFlowResult> {
  const project = await createProject(scenario.app, localCapabilityToken);

  await postWithCurrentVersion({
    app: scenario.app,
    storage: scenario.storage,
    localCapabilityToken,
    sessionId: project.sessionId,
    path: `/api/v1/sessions/${project.sessionId}/intake`,
    body: {
      answer: INTAKE_ANSWER
    }
  });
  await postWithCurrentVersion({
    app: scenario.app,
    storage: scenario.storage,
    localCapabilityToken,
    sessionId: project.sessionId,
    path: `/api/v1/sessions/${project.sessionId}/spec/initial`
  });
  const analyze = await postWithCurrentVersion({
    app: scenario.app,
    storage: scenario.storage,
    localCapabilityToken,
    sessionId: project.sessionId,
    path: `/api/v1/sessions/${project.sessionId}/spec/analyze`,
    body: {
      targetRef: "current_spec"
    }
  });
  const activate = await postWithCurrentVersion({
    app: scenario.app,
    storage: scenario.storage,
    localCapabilityToken,
    sessionId: project.sessionId,
    path: `/api/v1/sessions/${project.sessionId}/queue/activate`
  });
  const activatedQueue = objectAt(activate.queueProjection ?? activate.immediateProjection, "activated queue projection");
  const firstQuestion = firstRecord(activatedQueue.active, "activated active questions");
  const firstQuestionId = stringAt(firstQuestion.queueItemId, "first question id");
  const answer = await postWithCurrentVersion({
    app: scenario.app,
    storage: scenario.storage,
    localCapabilityToken,
    sessionId: project.sessionId,
    path: `/api/v1/questions/${firstQuestionId}/answers`,
    body: {
      sessionId: project.sessionId,
      queueItemId: firstQuestionId,
      answer: ANSWER_TEXT,
      researchRouteHint: "research_needed",
      claimImpact: "high",
      researchObjective: "Validate whether paid-interview prep founders need safer evidence before implementation."
    }
  });
  const planningHandoff = await postWithCurrentVersion({
    app: scenario.app,
    storage: scenario.storage,
    localCapabilityToken,
    sessionId: project.sessionId,
    path: `/api/v1/sessions/${project.sessionId}/planning-handoff`,
    body: {
      scaffoldOnly: true,
      sessionId: project.sessionId,
      sourceRefs: planningHandoffBlockerSourceRefs()
    }
  });

  return {
    project,
    analyze,
    activatedQueue,
    answeredQueue: objectAt(answer.queueProjection, "answered queue projection"),
    researchProjection: await getJson(scenario.app, `/api/v1/sessions/${project.sessionId}/research`, localCapabilityToken),
    completenessProjection: await getJson(scenario.app, `/api/v1/sessions/${project.sessionId}/completeness`, localCapabilityToken),
    planningHandoffProjection: objectAt(planningHandoff.immediateProjection, "planning handoff projection"),
    firstQuestion
  };
}

function queueProgress(queue: JsonRecord) {
  return objectAt(queue.progress, "queue progress");
}

function gateById(completenessProjection: JsonRecord, gateId: string) {
  return recordArray(completenessProjection.gates, "completeness gates").find((gate) => gate.gateId === gateId) ?? null;
}

function ambiguityIssueCount(analyze: JsonRecord) {
  const output = recordArray(analyze.deterministicOutputs, "analyze deterministicOutputs").find(
    (candidate) => candidate.outputType === "ambiguity_analysis"
  );
  const payload = objectAt(output?.payload, "ambiguity analysis payload");

  return numberAt(payload.issueCount, "ambiguity issueCount");
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function answerOptionsForQueueItem(item: JsonRecord) {
  return Array.isArray(item.answerOptions) ? item.answerOptions : [];
}

function queueItemLooksLikeBinaryChoice(item: JsonRecord) {
  const answerOptions = answerOptionsForQueueItem(item);
  const binaryOptionCount = answerOptions.filter((option) => {
    if (!option || typeof option !== "object") {
      return false;
    }

    const optionRecord = option as Record<string, unknown>;

    return /(?:찬성|반대|찬반|동의|비동의|예\s*[/·또는과]*\s*아니오|\b(?:yes|no|agree|disagree|support|oppose)\b)/iu.test(
      [optionRecord.id, optionRecord.label, optionRecord.value].filter(Boolean).join(" ")
    );
  }).length;

  return binaryOptionCount >= 2;
}

function answerFormatKindForQueueItem(item: JsonRecord) {
  const answerSelectionMode = optionalString(item.answerSelectionMode);
  const expectedAnswerType = optionalString(item.expectedAnswerType);
  const answerOptions = answerOptionsForQueueItem(item);

  if (answerSelectionMode === "multiple") {
    return "multi_select";
  }

  if (answerSelectionMode === "ranked") {
    return "ranked_choice";
  }

  if (expectedAnswerType === "text") {
    return "open_text";
  }

  if (expectedAnswerType === "rank") {
    return "ranked_choice";
  }

  if (expectedAnswerType === "experiment") {
    return "experiment_plan";
  }

  if (expectedAnswerType === "evidence") {
    return "evidence_judgment";
  }

  if (!answerOptions.length) {
    return "open_text";
  }

  return queueItemLooksLikeBinaryChoice(item) ? "binary_choice" : "single_choice";
}

function answerSelectionModeForQueueItem(item: JsonRecord) {
  const answerSelectionMode = optionalString(item.answerSelectionMode);

  if (answerSelectionMode) {
    return answerSelectionMode;
  }

  if (optionalString(item.expectedAnswerType) === "rank") {
    return "ranked";
  }

  return answerOptionsForQueueItem(item).length ? "single" : undefined;
}

function uniqueStrings(values: readonly string[]) {
  return [...new Set(values)].sort();
}

function activeQueueItems(...queues: readonly JsonRecord[]) {
  return queues.flatMap((queue, index) => recordArray(queue.active, `queue ${index + 1} active questions`));
}

function activeAnswerFormatKinds(...queues: readonly JsonRecord[]) {
  return uniqueStrings(activeQueueItems(...queues).map(answerFormatKindForQueueItem));
}

function activeAnswerSelectionModes(...queues: readonly JsonRecord[]) {
  return uniqueStrings(
    activeQueueItems(...queues)
      .map(answerSelectionModeForQueueItem)
      .filter((mode): mode is string => Boolean(mode))
  );
}

function flowBlockers(result: ClarificationFlowResult) {
  const blockers: string[] = [];
  const activatedProgress = queueProgress(result.activatedQueue);
  const answeredProgress = queueProgress(result.answeredQueue);
  const activeQuestions = recordArray(result.activatedQueue.active, "activated active questions");
  const answerFormatKinds = activeAnswerFormatKinds(result.activatedQueue, result.answeredQueue);
  const researchTasks = recordArray(result.researchProjection.tasks, "research tasks");
  const firstQuestionId = stringAt(result.firstQuestion.queueItemId, "first question id");
  const questionDebtGate = gateById(result.completenessProjection, "question_debt");
  const completionCandidate = objectAt(result.completenessProjection.completionCandidate, "completion candidate");
  const planningStatus = result.planningHandoffProjection.currentStatus;
  const planningBlocker = objectAt(result.planningHandoffProjection.blockerArtifact, "planning handoff blocker artifact");

  if (ambiguityIssueCount(result.analyze) < 10) {
    blockers.push("ambiguity analysis must generate a broad question backlog before activation");
  }

  if (activeQuestions.length < 1) {
    blockers.push(`active question flow must expose at least one question; received ${activeQuestions.length}`);
  }

  if (numberAt(activatedProgress.generatedQuestionCount, "activated generatedQuestionCount") < 10) {
    blockers.push("activated queue must expose generated question count for a long clarification session");
  }

  if (answerFormatKinds.length === 0) {
    blockers.push("single-question clarification queue must expose the current answer format");
  }

  if (stringAt(result.firstQuestion.cardType, "first question cardType") !== "question") {
    blockers.push(`first active card must be a question; received ${JSON.stringify(result.firstQuestion.cardType)}`);
  }

  if (numberAt(answeredProgress.answeredQuestionCount, "answeredQuestionCount") < 1) {
    blockers.push("answer submission must increment answered question count");
  }

  if (numberAt(answeredProgress.followUpQuestionCount, "followUpQuestionCount") < 1) {
    blockers.push("answer submission must expose generated follow-up question debt");
  }

  if (numberAt(answeredProgress.visibleQuestionDebtCount, "visibleQuestionDebtCount") < 1) {
    blockers.push("answered queue must keep visible question debt non-empty");
  }

  if (!researchTasks.some((task) => task.sourceQueueItemId === firstQuestionId && task.status === "planned")) {
    blockers.push("research-needed answer must create a planned research task tied to the answered question");
  }

  if (completionCandidate.status !== "not_ready") {
    blockers.push(`completeness candidate must remain not_ready; received ${JSON.stringify(completionCandidate.status)}`);
  }

  if (!questionDebtGate) {
    blockers.push("completeness projection must include the question_debt gate");
  } else if (questionDebtGate.passed !== false) {
    blockers.push(`question_debt gate must fail while debt remains; received ${JSON.stringify(questionDebtGate.passed)}`);
  }

  if (planningStatus === "planning_ready") {
    blockers.push("planning handoff smoke must keep incomplete source traces out of planning_ready state");
  }

  if (planningBlocker.noFinalLabelRule !== "must_not_use_planning_ready_label") {
    blockers.push("planning handoff blocker must forbid the final Planning-ready label");
  }

  return blockers;
}

function passedEvidence(result: ClarificationFlowResult): ClarificationPipelineSmokeEvidence {
  const answeredProgress = queueProgress(result.answeredQueue);
  const activeQuestions = recordArray(result.activatedQueue.active, "activated active questions");
  const researchTasks = recordArray(result.researchProjection.tasks, "research tasks");
  const questionDebtGate = objectAt(gateById(result.completenessProjection, "question_debt"), "question debt gate");
  const completionCandidate = objectAt(result.completenessProjection.completionCandidate, "completion candidate");
  const answerFormatKinds = activeAnswerFormatKinds(result.activatedQueue, result.answeredQueue);
  const answerSelectionModes = activeAnswerSelectionModes(result.activatedQueue, result.answeredQueue);

  return {
    status: "passed",
    smoke: CLARIFICATION_PIPELINE_SMOKE,
    mode: "fixture",
    project: result.project,
    clarification: {
      generatedQuestionCount: numberAt(answeredProgress.generatedQuestionCount, "generatedQuestionCount"),
      activeQuestionCount: activeQuestions.length,
      answeredQuestionCount: numberAt(answeredProgress.answeredQuestionCount, "answeredQuestionCount"),
      followUpQuestionCount: numberAt(answeredProgress.followUpQuestionCount, "followUpQuestionCount"),
      visibleQuestionDebtCount: numberAt(answeredProgress.visibleQuestionDebtCount, "visibleQuestionDebtCount"),
      researchTaskCount: researchTasks.length,
      firstQuestionId: stringAt(result.firstQuestion.queueItemId, "first question id"),
      firstQuestionTopicKey: stringAt(result.firstQuestion.topicKey, "first question topicKey"),
      answerFormatKinds,
      answerSelectionModes,
      completenessStatus: stringAt(completionCandidate.status, "completion candidate status"),
      questionDebtGatePassed: booleanAt(questionDebtGate.passed, "question debt gate passed"),
      planningHandoffStatus: stringAt(result.planningHandoffProjection.currentStatus, "planning handoff status")
    },
    checked: [
      "temporary local sidecar and app data created",
      "intake answer accepted for a business-mode founder idea",
      "initial Living Product Spec drafted and analyzed",
      "active question batch generated with progress metrics",
      "single-question active/refilled cards expose the current answer format without batching unrelated questions",
      "answer submission moved one active question and created follow-up debt",
      "research-needed answer produced a source-linked planned research task",
      "completeness projection keeps question debt blocking planning readiness",
      "Planning Handoff blocker artifact stays non-final until source traces are complete"
    ]
  };
}

function blockedEvidence(
  result: ClarificationFlowResult,
  blockers: readonly string[]
): ClarificationPipelineSmokeEvidence {
  return {
    ...passedEvidence(result),
    status: "blocked",
    reason: "Clarification pipeline smoke did not satisfy every critical-path fixture check.",
    blockers
  };
}

function errorEvidence(error: unknown): ClarificationPipelineSmokeEvidence {
  const message = error instanceof Error ? error.message : String(error);

  return {
    status: "blocked",
    smoke: CLARIFICATION_PIPELINE_SMOKE,
    mode: "fixture",
    reason: "Clarification pipeline smoke failed before full evidence could be collected.",
    blockers: [message],
    checked: ["temporary local clarification pipeline smoke started"]
  };
}

async function createScenario(appDataDir: string, localCapabilityToken: string): Promise<ClarificationScenario> {
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

export async function runClarificationPipelineSmoke(
  options: ClarificationPipelineSmokeOptions = {}
): Promise<ClarificationPipelineSmokeEvidence> {
  const appDataDir = options.appDataDir ?? (await mkdtemp(join(tmpdir(), "solo-superman-clarification-pipeline-smoke-")));
  const shouldCleanup = options.cleanupAppDataDir ?? !options.appDataDir;
  const localCapabilityToken = options.localCapabilityToken ?? `clarification-pipeline-smoke-${randomUUID()}`;
  let scenario: ClarificationScenario | null = null;

  try {
    scenario = await createScenario(appDataDir, localCapabilityToken);
    const result = await runClarificationFlow(scenario, localCapabilityToken);
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

function exitCodeForEvidence(evidence: ClarificationPipelineSmokeEvidence) {
  return evidence.status === "passed" ? 0 : 1;
}

async function main() {
  const evidence = await runClarificationPipelineSmoke();

  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = exitCodeForEvidence(evidence);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
