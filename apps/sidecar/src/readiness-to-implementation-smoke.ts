import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "@solo-superman/db";
import {
  createSmokeProject,
  objectAt,
  planningReadySourceRefs,
  postJson,
  recordArray,
  seedPlanningReadyState,
  sessionEventCount,
  stringAt,
  getJson,
  type AutoImplementationSmokePlanningFixture,
  type JsonRecord,
  type SmokeSidecarApp,
  type SmokeStorage
} from "./auto-implementation-smoke-fixtures";
import { createSidecarApp } from "./server";
import { removeTemporaryDirectory } from "./test-cleanup";

export const READINESS_TO_IMPLEMENTATION_SMOKE = "readiness_to_implementation" as const;

const PROJECT_IDEA =
  "반려동물 전생애주기 의료 기록, 급여, 일상 돌봄, 보험 청구, 장례 준비 정보를 한 곳에서 관리하는 앱.";
const PROJECT_FOLDER_NAME = "readiness-to-implementation-smoke-demo";
const PLANNING_FIXTURE: AutoImplementationSmokePlanningFixture = {
  idPrefix: "readiness_to_impl_smoke",
  sourceLabelPrefix: "Readiness-to-implementation smoke",
  specTitle: "Readiness-to-implementation smoke ready spec",
  taskObjective: "Validate that enough pet-lifecycle app evidence exists before implementation.",
  resultSummary: "Balanced public evidence supports implementing the first pet-lifecycle management slice.",
  claim: "The first software slice can manage a pet profile plus evidence-backed care and insurance records.",
  decisionContext: "Pet lifecycle app first implementation slice",
  completionSummary: "Core metrics are concrete enough to request a Planning Handoff.",
  nextBuildSliceSummary: "Build the first local pet profile, care record, and insurance evidence slice."
};

type SmokeStatus = "blocked" | "passed";

interface ReadinessScenario {
  readonly app: SmokeSidecarApp;
  readonly storage: SmokeStorage;
  readonly workspaceRoot: string;
}

interface ReadinessFlowResult {
  readonly project: {
    readonly projectId: string;
    readonly sessionId: string;
  };
  readonly completeness: JsonRecord;
  readonly planningHandoff: JsonRecord;
  readonly autoImplementationRun: JsonRecord;
}

export interface ReadinessToImplementationSmokeEvidence {
  readonly status: SmokeStatus;
  readonly smoke: typeof READINESS_TO_IMPLEMENTATION_SMOKE;
  readonly mode: "fixture";
  readonly project?: {
    readonly projectId: string;
    readonly sessionId: string;
  };
  readonly readiness?: {
    readonly compositeScore: number;
    readonly readinessLabel: string;
    readonly completionCandidateStatus: string;
    readonly passedGateCount: number;
    readonly planningHandoffStatus: string;
    readonly planningArtifactId: string;
    readonly planningSourceRefTypes: readonly string[];
  };
  readonly implementation?: {
    readonly runId: string;
    readonly status: string;
    readonly currentStage: string;
    readonly initialStageStatus: string;
    readonly stageCount: number;
    readonly projectFolderName: string;
    readonly remoteStatus: string;
  };
  readonly reason?: string;
  readonly blockers?: readonly string[];
  readonly checked: readonly string[];
}

export interface ReadinessToImplementationSmokeOptions {
  readonly appDataDir?: string;
  readonly cleanupAppDataDir?: boolean;
  readonly localCapabilityToken?: string;
}

function numberAt(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }

  return value;
}

function booleanAt(value: unknown, label: string) {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean.`);
  }

  return value;
}

function createScenario(appDataDir: string, localCapabilityToken: string): Promise<ReadinessScenario> {
  return createSoloStorage({ url: localDatabaseUrlFromAppDataDir(appDataDir) }).then(async (storage) => {
    const migrationStatus = await applyMigrations(storage);
    const workspaceRoot = join(appDataDir, "workspace");

    if (migrationStatus.state === "failed") {
      await storage.close();
      throw new Error(migrationStatus.errorMessage);
    }

    return {
      storage,
      workspaceRoot,
      app: createSidecarApp({
        localCapabilityToken,
        migrationStatus,
        storage,
        autoImplementationWorkspaceRoot: workspaceRoot
      })
    };
  });
}

async function createPlanningHandoff(input: {
  readonly scenario: ReadinessScenario;
  readonly localCapabilityToken: string;
  readonly projectId: string;
  readonly sessionId: string;
  readonly fixture: AutoImplementationSmokePlanningFixture;
}) {
  const expectedStateVersion = await sessionEventCount(input.scenario.storage, input.sessionId);
  const data = await postJson(
    input.scenario.app,
    `/api/v1/sessions/${input.sessionId}/planning-handoff`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      expectedStateVersion,
      sourceRefs: planningReadySourceRefs(input.sessionId, input.fixture)
    }
  );

  return objectAt(data.immediateProjection, "planning handoff immediateProjection");
}

async function createAutoImplementationRun(input: {
  readonly scenario: ReadinessScenario;
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
      idempotencyKey: "readiness-to-implementation-smoke:auto-run",
      projectFolderName: PROJECT_FOLDER_NAME,
      projectName: "Readiness-to-implementation Smoke Demo",
      trackerGoal: "Implement the first evidence-backed pet lifecycle app slice.",
      sourcePlanningRef: input.planningArtifactId
    }
  );

  return objectAt(data.latestRun, "auto implementation latestRun");
}

async function executeReadinessFlow(
  scenario: ReadinessScenario,
  localCapabilityToken: string
): Promise<ReadinessFlowResult> {
  const project = await createSmokeProject({
    app: scenario.app,
    localCapabilityToken,
    rawIdea: PROJECT_IDEA
  });

  await seedPlanningReadyState({
    storage: scenario.storage,
    projectId: project.projectId,
    sessionId: project.sessionId,
    fixture: PLANNING_FIXTURE
  });

  const completeness = await getJson(
    scenario.app,
    `/api/v1/sessions/${project.sessionId}/completeness`,
    localCapabilityToken
  );
  const planningHandoff = await createPlanningHandoff({
    scenario,
    localCapabilityToken,
    projectId: project.projectId,
    sessionId: project.sessionId,
    fixture: PLANNING_FIXTURE
  });
  const finalArtifact = objectAt(planningHandoff.finalArtifact, "planning handoff finalArtifact");
  const autoImplementationRun = await createAutoImplementationRun({
    scenario,
    localCapabilityToken,
    sessionId: project.sessionId,
    planningArtifactId: stringAt(finalArtifact.artifactId, "planning artifactId")
  });

  return {
    project,
    completeness,
    planningHandoff,
    autoImplementationRun
  };
}

function readinessBlockers(result: ReadinessFlowResult) {
  const blockers: string[] = [];
  const completionCandidate = objectAt(result.completeness.completionCandidate, "completion candidate");
  const gates = recordArray(result.completeness.gates, "completeness gates");
  const planningFinalArtifact = objectAt(result.planningHandoff.finalArtifact, "planning handoff finalArtifact");
  const planningSourceRefs = recordArray(planningFinalArtifact.sourceRefs, "planning handoff sourceRefs");
  const stagePlan = recordArray(result.autoImplementationRun.stagePlan, "auto implementation stagePlan");
  const initialStage = stagePlan.find((stage) => stage.stage === "initial_pr") ?? null;

  if (numberAt(result.completeness.compositeScore, "completeness compositeScore") < 85) {
    blockers.push("readiness composite score must be at least 85 before implementation starts.");
  }

  if (result.completeness.readinessLabel !== "spec_ready") {
    blockers.push(`readiness label must be spec_ready; received ${JSON.stringify(result.completeness.readinessLabel)}`);
  }

  if (completionCandidate.status !== "candidate") {
    blockers.push(`completion candidate must be candidate; received ${JSON.stringify(completionCandidate.status)}`);
  }

  if (!gates.every((gate) => booleanAt(gate.passed, "completeness gate passed"))) {
    blockers.push("all readiness gates must pass before Planning Handoff.");
  }

  if (result.planningHandoff.currentStatus !== "planning_ready") {
    blockers.push(`Planning Handoff must be planning_ready; received ${JSON.stringify(result.planningHandoff.currentStatus)}`);
  }

  const sourceTypes = planningSourceRefs.map((sourceRef) => stringAt(sourceRef.sourceType, "planning sourceRef sourceType"));
  for (const requiredType of [
    "spec_version",
    "completion_candidate",
    "decision_linked_evidence_pack",
    "research_updated_queue_item"
  ]) {
    if (!sourceTypes.includes(requiredType)) {
      blockers.push(`Planning Handoff must carry ${requiredType} source evidence.`);
    }
  }

  if (result.autoImplementationRun.status !== "pending") {
    blockers.push(`auto implementation run must be pending for the first stage; received ${JSON.stringify(result.autoImplementationRun.status)}`);
  }

  if (result.autoImplementationRun.currentStage !== "initial_pr") {
    blockers.push(`auto implementation run must start at initial_pr; received ${JSON.stringify(result.autoImplementationRun.currentStage)}`);
  }

  if (!initialStage || initialStage.status !== "ready") {
    blockers.push(`initial_pr stage must be ready; received ${JSON.stringify(initialStage?.status ?? null)}`);
  }

  if (stagePlan.length < 7) {
    blockers.push(`auto implementation stage plan must include every canonical stage; received ${stagePlan.length}`);
  }

  return blockers;
}

function passedEvidence(result: ReadinessFlowResult): ReadinessToImplementationSmokeEvidence {
  const completionCandidate = objectAt(result.completeness.completionCandidate, "completion candidate");
  const gates = recordArray(result.completeness.gates, "completeness gates");
  const planningFinalArtifact = objectAt(result.planningHandoff.finalArtifact, "planning handoff finalArtifact");
  const planningSourceRefs = recordArray(planningFinalArtifact.sourceRefs, "planning handoff sourceRefs");
  const stagePlan = recordArray(result.autoImplementationRun.stagePlan, "auto implementation stagePlan");
  const initialStage = objectAt(
    stagePlan.find((stage) => stage.stage === "initial_pr"),
    "initial_pr stage"
  );

  return {
    status: "passed",
    smoke: READINESS_TO_IMPLEMENTATION_SMOKE,
    mode: "fixture",
    project: result.project,
    readiness: {
      compositeScore: numberAt(result.completeness.compositeScore, "completeness compositeScore"),
      readinessLabel: stringAt(result.completeness.readinessLabel, "readinessLabel"),
      completionCandidateStatus: stringAt(completionCandidate.status, "completion candidate status"),
      passedGateCount: gates.filter((gate) => gate.passed === true).length,
      planningHandoffStatus: stringAt(result.planningHandoff.currentStatus, "planning handoff currentStatus"),
      planningArtifactId: stringAt(planningFinalArtifact.artifactId, "planning artifactId"),
      planningSourceRefTypes: planningSourceRefs.map((sourceRef) =>
        stringAt(sourceRef.sourceType, "planning sourceRef sourceType")
      )
    },
    implementation: {
      runId: stringAt(result.autoImplementationRun.runId, "auto implementation runId"),
      status: stringAt(result.autoImplementationRun.status, "auto implementation status"),
      currentStage: stringAt(result.autoImplementationRun.currentStage, "auto implementation currentStage"),
      initialStageStatus: stringAt(initialStage.status, "initial_pr stage status"),
      stageCount: stagePlan.length,
      projectFolderName: stringAt(result.autoImplementationRun.projectFolderName, "projectFolderName"),
      remoteStatus: stringAt(result.autoImplementationRun.remoteStatus, "remoteStatus")
    },
    checked: [
      "temporary local sidecar and app data created",
      "business-mode pet-lifecycle project created",
      "balanced evidence and completion-candidate readiness state seeded",
      "completeness projection reports score >=85, spec_ready label, candidate status, and passed gates",
      "Planning Handoff reaches planning_ready with spec, completion, evidence-pack, and research-queue source refs",
      "auto implementation run starts only after matching planning_ready artifact",
      "auto implementation run opens the canonical initial_pr stage as ready"
    ]
  };
}

function blockedEvidence(
  result: ReadinessFlowResult,
  blockers: readonly string[]
): ReadinessToImplementationSmokeEvidence {
  return {
    ...passedEvidence(result),
    status: "blocked",
    reason: "Readiness-to-implementation smoke did not satisfy every planning-to-build checkpoint.",
    blockers
  };
}

function errorEvidence(error: unknown): ReadinessToImplementationSmokeEvidence {
  const message = error instanceof Error ? error.message : String(error);

  return {
    status: "blocked",
    smoke: READINESS_TO_IMPLEMENTATION_SMOKE,
    mode: "fixture",
    reason: "Readiness-to-implementation smoke failed before full evidence could be collected.",
    blockers: [message],
    checked: ["temporary readiness-to-implementation smoke started"]
  };
}

export async function runReadinessToImplementationSmoke(
  options: ReadinessToImplementationSmokeOptions = {}
): Promise<ReadinessToImplementationSmokeEvidence> {
  const appDataDir = options.appDataDir ?? (await mkdtemp(join(tmpdir(), "solo-superman-readiness-to-implementation-smoke-")));
  const shouldCleanup = options.cleanupAppDataDir ?? !options.appDataDir;
  const localCapabilityToken = options.localCapabilityToken ?? `readiness-to-implementation-smoke-${randomUUID()}`;
  let scenario: ReadinessScenario | null = null;

  try {
    scenario = await createScenario(appDataDir, localCapabilityToken);
    const result = await executeReadinessFlow(scenario, localCapabilityToken);
    const blockers = readinessBlockers(result);

    return blockers.length > 0 ? blockedEvidence(result, blockers) : passedEvidence(result);
  } catch (error: unknown) {
    return errorEvidence(error);
  } finally {
    await scenario?.storage.close();

    if (shouldCleanup) {
      await removeTemporaryDirectory(appDataDir);
    }
  }
}

function exitCodeForEvidence(evidence: ReadinessToImplementationSmokeEvidence) {
  return evidence.status === "passed" ? 0 : 1;
}

async function main() {
  const evidence = await runReadinessToImplementationSmoke();

  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = exitCodeForEvidence(evidence);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
