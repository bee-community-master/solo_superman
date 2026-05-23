import { pathToFileURL } from "node:url";
import {
  LIVE_PREVIEW_TURN_VERIFY_ENV,
  LIVE_TURNS_ENV,
  RUNTIME_PREVIEW_TURN_SMOKE,
  runRuntimePreviewTurnSmoke,
  type RuntimePreviewTurnSmokeEvidence
} from "./runtime-preview-smoke";
import {
  LIVE_WORKER_JOB_VERIFY_ENV,
  AUTO_IMPLEMENTATION_WORKER_SMOKE,
  runAutoImplementationWorkerSmoke,
  type AutoImplementationWorkerSmokeEvidence
} from "./auto-implementation-worker-smoke";
import {
  AUTO_IMPLEMENTATION_PR_MUTATION_SMOKE,
  runAutoImplementationPrMutationSmoke,
  type AutoImplementationPrMutationSmokeEvidence
} from "./auto-implementation-pr-mutation-smoke";
import {
  AUTO_IMPLEMENTATION_REVIEW_LOOP_SMOKE,
  runAutoImplementationReviewLoopSmoke,
  type AutoImplementationReviewLoopSmokeEvidence
} from "./auto-implementation-review-loop-smoke";

export const AUTO_IMPLEMENTATION_PIPELINE_SMOKE = "auto_implementation_pipeline" as const;

type SmokeStatus = "blocked" | "passed";
type SmokeRunner<T> = () => Promise<T>;
type SmokeEvidence =
  | RuntimePreviewTurnSmokeEvidence
  | AutoImplementationWorkerSmokeEvidence
  | AutoImplementationPrMutationSmokeEvidence
  | AutoImplementationReviewLoopSmokeEvidence;

export interface AutoImplementationPipelineSmokeEvidence {
  readonly status: SmokeStatus;
  readonly smoke: typeof AUTO_IMPLEMENTATION_PIPELINE_SMOKE;
  readonly mode: "fixture";
  readonly stages: {
    readonly runtimePreviewTurn: RuntimePreviewTurnSmokeEvidence;
    readonly workerJob: AutoImplementationWorkerSmokeEvidence;
    readonly prMutation: AutoImplementationPrMutationSmokeEvidence;
    readonly reviewLoop: AutoImplementationReviewLoopSmokeEvidence;
  };
  readonly reason?: string;
  readonly blockers?: readonly string[];
  readonly checked: readonly string[];
}

export interface AutoImplementationPipelineSmokeOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly runRuntimePreviewTurn?: SmokeRunner<RuntimePreviewTurnSmokeEvidence>;
  readonly runWorkerJob?: SmokeRunner<AutoImplementationWorkerSmokeEvidence>;
  readonly runPrMutation?: SmokeRunner<AutoImplementationPrMutationSmokeEvidence>;
  readonly runReviewLoop?: SmokeRunner<AutoImplementationReviewLoopSmokeEvidence>;
}

export function credentialFreePipelineSmokeEnv(
  env: Readonly<Record<string, string | undefined>> = process.env
): Readonly<Record<string, string | undefined>> {
  const fixtureEnv = { ...env };

  delete fixtureEnv[LIVE_PREVIEW_TURN_VERIFY_ENV];
  delete fixtureEnv[LIVE_WORKER_JOB_VERIFY_ENV];
  delete fixtureEnv[LIVE_TURNS_ENV];

  return fixtureEnv;
}

function stageBlocker(stageName: string, evidence: SmokeEvidence) {
  if (evidence.status === "passed") {
    return null;
  }

  return `${stageName} smoke reported ${evidence.status}${evidence.reason ? `: ${evidence.reason}` : ""}`;
}

function pipelineBlockers(stages: AutoImplementationPipelineSmokeEvidence["stages"]) {
  return [
    stageBlocker("runtime-preview-turn", stages.runtimePreviewTurn),
    stageBlocker("worker-job", stages.workerJob),
    stageBlocker("pr-mutation", stages.prMutation),
    stageBlocker("review-loop", stages.reviewLoop)
  ].filter((blocker): blocker is string => Boolean(blocker));
}

function checkedEvidence(stages: AutoImplementationPipelineSmokeEvidence["stages"]) {
  return [
    "credential-free aggregate smoke forced fixture mode for preview, worker, PR, and review-loop checks",
    ...stages.runtimePreviewTurn.checked.map((item) => `runtime-preview-turn: ${item}`),
    ...stages.workerJob.checked.map((item) => `worker-job: ${item}`),
    ...stages.prMutation.checked.map((item) => `pr-mutation: ${item}`),
    ...stages.reviewLoop.checked.map((item) => `review-loop: ${item}`)
  ];
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function runRuntimePreviewStage(
  runner: SmokeRunner<RuntimePreviewTurnSmokeEvidence>
): Promise<RuntimePreviewTurnSmokeEvidence> {
  try {
    return await runner();
  } catch (error: unknown) {
    return {
      status: "blocked",
      smoke: RUNTIME_PREVIEW_TURN_SMOKE,
      mode: "fixture",
      reason: "Runtime preview turn smoke failed before it could return evidence.",
      blockers: [errorMessage(error)],
      checked: ["runtime-preview-turn runner failed before evidence could be collected"]
    };
  }
}

async function runWorkerJobStage(
  runner: SmokeRunner<AutoImplementationWorkerSmokeEvidence>
): Promise<AutoImplementationWorkerSmokeEvidence> {
  try {
    return await runner();
  } catch (error: unknown) {
    return {
      status: "blocked",
      smoke: AUTO_IMPLEMENTATION_WORKER_SMOKE,
      mode: "fixture",
      reason: "Worker-job smoke failed before it could return evidence.",
      blockers: [errorMessage(error)],
      checked: ["worker-job runner failed before evidence could be collected"]
    };
  }
}

async function runPrMutationStage(
  runner: SmokeRunner<AutoImplementationPrMutationSmokeEvidence>
): Promise<AutoImplementationPrMutationSmokeEvidence> {
  try {
    return await runner();
  } catch (error: unknown) {
    return {
      status: "blocked",
      smoke: AUTO_IMPLEMENTATION_PR_MUTATION_SMOKE,
      mode: "fixture",
      reason: "PR mutation smoke failed before it could return evidence.",
      blockers: [errorMessage(error)],
      checked: ["pr-mutation runner failed before evidence could be collected"]
    };
  }
}

async function runReviewLoopStage(
  runner: SmokeRunner<AutoImplementationReviewLoopSmokeEvidence>
): Promise<AutoImplementationReviewLoopSmokeEvidence> {
  try {
    return await runner();
  } catch (error: unknown) {
    return {
      status: "blocked",
      smoke: AUTO_IMPLEMENTATION_REVIEW_LOOP_SMOKE,
      mode: "fixture",
      reason: "Review-loop smoke failed before it could return evidence.",
      blockers: [errorMessage(error)],
      checked: ["review-loop runner failed before evidence could be collected"]
    };
  }
}

export async function runAutoImplementationPipelineSmoke(
  options: AutoImplementationPipelineSmokeOptions = {}
): Promise<AutoImplementationPipelineSmokeEvidence> {
  const env = credentialFreePipelineSmokeEnv(options.env);
  const runtimePreviewTurn = await runRuntimePreviewStage(
    options.runRuntimePreviewTurn ?? (() => runRuntimePreviewTurnSmoke({ env }))
  );
  const workerJob = await runWorkerJobStage(options.runWorkerJob ?? (() => runAutoImplementationWorkerSmoke({ env })));
  const prMutation = await runPrMutationStage(options.runPrMutation ?? (() => runAutoImplementationPrMutationSmoke()));
  const reviewLoop = await runReviewLoopStage(
    options.runReviewLoop ?? (() => runAutoImplementationReviewLoopSmoke())
  );
  const stages = {
    runtimePreviewTurn,
    workerJob,
    prMutation,
    reviewLoop
  };
  const blockers = pipelineBlockers(stages);
  const checked = checkedEvidence(stages);

  if (blockers.length > 0) {
    return {
      status: "blocked",
      smoke: AUTO_IMPLEMENTATION_PIPELINE_SMOKE,
      mode: "fixture",
      stages,
      reason: "Auto implementation aggregate smoke did not satisfy every critical-path fixture stage.",
      blockers,
      checked
    };
  }

  return {
    status: "passed",
    smoke: AUTO_IMPLEMENTATION_PIPELINE_SMOKE,
    mode: "fixture",
    stages,
    checked
  };
}

function exitCodeForEvidence(evidence: AutoImplementationPipelineSmokeEvidence) {
  return evidence.status === "passed" ? 0 : 1;
}

async function main() {
  const evidence = await runAutoImplementationPipelineSmoke();

  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = exitCodeForEvidence(evidence);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
