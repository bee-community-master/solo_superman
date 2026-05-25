import { pathToFileURL } from "node:url";
import {
  CLARIFICATION_PIPELINE_SMOKE,
  runClarificationPipelineSmoke,
  type ClarificationPipelineSmokeEvidence
} from "./clarification-pipeline-smoke";
import {
  RESEARCH_PIPELINE_SMOKE,
  runResearchPipelineSmoke,
  type ResearchPipelineSmokeEvidence
} from "./research-pipeline-smoke";
import {
  AUTO_IMPLEMENTATION_PIPELINE_SMOKE,
  runAutoImplementationPipelineSmoke,
  type AutoImplementationPipelineSmokeEvidence
} from "./auto-implementation-pipeline-smoke";
import {
  READINESS_TO_IMPLEMENTATION_SMOKE,
  runReadinessToImplementationSmoke,
  type ReadinessToImplementationSmokeEvidence
} from "./readiness-to-implementation-smoke";
import {
  SINGLE_SESSION_PRODUCT_LOOP_SMOKE,
  runSingleSessionProductLoopSmoke,
  type SingleSessionProductLoopSmokeEvidence
} from "./single-session-product-loop-smoke";
import {
  SINGLE_SESSION_LIVE_IMPLEMENTATION_SMOKE,
  runSingleSessionLiveImplementationSmoke,
  type SingleSessionLiveImplementationSmokeEvidence
} from "./single-session-live-implementation-smoke";

export const CORE_PRODUCT_LOOP_SMOKE = "core_product_loop" as const;

type SmokeStatus = "blocked" | "passed";
type SmokeRunner<T> = () => Promise<T>;
type CoreProductLoopSummary = NonNullable<CoreProductLoopSmokeEvidence["loop"]>;

export interface CoreProductLoopSmokeEvidence {
  readonly status: SmokeStatus;
  readonly smoke: typeof CORE_PRODUCT_LOOP_SMOKE;
  readonly mode: "fixture";
  readonly stages: {
    readonly singleSession: SingleSessionProductLoopSmokeEvidence;
    readonly singleSessionImplementation: SingleSessionLiveImplementationSmokeEvidence;
    readonly clarification: ClarificationPipelineSmokeEvidence;
    readonly research: ResearchPipelineSmokeEvidence;
    readonly readinessToImplementation: ReadinessToImplementationSmokeEvidence;
    readonly autoImplementation: AutoImplementationPipelineSmokeEvidence;
  };
  readonly loop?: {
    readonly generatedQuestionCount: number;
    readonly answeredQuestionCount: number;
    readonly clarificationResearchTaskCount: number;
    readonly researchFollowUpQuestionCount: number;
    readonly researchFollowUpTaskCount: number;
    readonly generatedFollowUpResearchSourceRefCount: number;
    readonly singleSessionGeneratedQuestionCount: number;
    readonly singleSessionPetDomainQuestionSignalCount: number;
    readonly singleSessionFollowUpQuestionCount: number;
    readonly singleSessionPlanningHandoffStatus: string;
    readonly singleSessionAutoImplementationCurrentStage: string;
    readonly singleSessionGeneratedSoftwareArtifactCount: number;
    readonly singleSessionGeneratedSoftwareHasRunnableTest: boolean;
    readonly sameSessionWorkerStageAfter: string;
    readonly sameSessionWorkerLedgerStatus: string;
    readonly readinessCompositeScore: number;
    readonly readinessLabel: string;
    readonly completionCandidateStatus: string;
    readonly planningHandoffStatus: string;
    readonly readinessImplementationStatus: string;
    readonly readinessImplementationCurrentStage: string;
    readonly readinessImplementationStageCount: number;
    readonly autoImplementationCompletedStageCount: number;
    readonly autoImplementationFinalStatus: string;
    readonly prMutationMergeStatus: string;
  };
  readonly reason?: string;
  readonly blockers?: readonly string[];
  readonly checked: readonly string[];
}

export interface CoreProductLoopSmokeOptions {
  readonly runSingleSession?: SmokeRunner<SingleSessionProductLoopSmokeEvidence>;
  readonly runSingleSessionImplementation?: SmokeRunner<SingleSessionLiveImplementationSmokeEvidence>;
  readonly runClarification?: SmokeRunner<ClarificationPipelineSmokeEvidence>;
  readonly runResearch?: SmokeRunner<ResearchPipelineSmokeEvidence>;
  readonly runReadinessToImplementation?: SmokeRunner<ReadinessToImplementationSmokeEvidence>;
  readonly runAutoImplementation?: SmokeRunner<AutoImplementationPipelineSmokeEvidence>;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function stageStatusBlocker(stage: string, evidence: { readonly status: SmokeStatus; readonly blockers?: readonly string[] }) {
  return evidence.status === "passed"
    ? []
    : [`${stage} smoke is ${evidence.status}`, ...(evidence.blockers ?? [])];
}

function completedStageCount(evidence: AutoImplementationPipelineSmokeEvidence) {
  return evidence.stages.reviewLoop.run?.completedStageCount ?? 0;
}

function loopSummary(stages: CoreProductLoopSmokeEvidence["stages"]): CoreProductLoopSummary {
  return {
    generatedQuestionCount: stages.clarification.clarification?.generatedQuestionCount ?? 0,
    answeredQuestionCount: stages.clarification.clarification?.answeredQuestionCount ?? 0,
    clarificationResearchTaskCount: stages.clarification.clarification?.researchTaskCount ?? 0,
    researchFollowUpQuestionCount: stages.research.research?.followUpQuestionCount ?? 0,
    researchFollowUpTaskCount: stages.research.research?.followUpResearchTaskCount ?? 0,
    generatedFollowUpResearchSourceRefCount: stages.research.research?.followUpResearchSourceRefCount ?? 0,
    singleSessionGeneratedQuestionCount: stages.singleSession.loop?.generatedQuestionCount ?? 0,
    singleSessionPetDomainQuestionSignalCount: stages.singleSession.loop?.petDomainQuestionSignalCount ?? 0,
    singleSessionFollowUpQuestionCount: stages.singleSession.loop?.followUpQuestionCount ?? 0,
    singleSessionPlanningHandoffStatus: stages.singleSession.loop?.planningHandoffStatus ?? "unknown",
    singleSessionAutoImplementationCurrentStage: stages.singleSession.loop?.autoImplementationCurrentStage ?? "unknown",
    singleSessionGeneratedSoftwareArtifactCount:
      stages.singleSession.loop?.autoImplementationGeneratedSoftwareArtifactCount ?? 0,
    singleSessionGeneratedSoftwareHasRunnableTest:
      stages.singleSession.loop?.autoImplementationGeneratedSoftwareHasRunnableTest ?? false,
    sameSessionWorkerStageAfter: stages.singleSessionImplementation.worker?.stageAfter ?? "unknown",
    sameSessionWorkerLedgerStatus: stages.singleSessionImplementation.worker?.ledgerStatus ?? "unknown",
    readinessCompositeScore: stages.readinessToImplementation.readiness?.compositeScore ?? 0,
    readinessLabel: stages.readinessToImplementation.readiness?.readinessLabel ?? "unknown",
    completionCandidateStatus: stages.readinessToImplementation.readiness?.completionCandidateStatus ?? "unknown",
    planningHandoffStatus: stages.readinessToImplementation.readiness?.planningHandoffStatus ?? "unknown",
    readinessImplementationStatus: stages.readinessToImplementation.implementation?.status ?? "unknown",
    readinessImplementationCurrentStage: stages.readinessToImplementation.implementation?.currentStage ?? "unknown",
    readinessImplementationStageCount: stages.readinessToImplementation.implementation?.stageCount ?? 0,
    autoImplementationCompletedStageCount: completedStageCount(stages.autoImplementation),
    autoImplementationFinalStatus: stages.autoImplementation.stages.reviewLoop.run?.finalStatus ?? "unknown",
    prMutationMergeStatus: stages.autoImplementation.stages.prMutation.prMutation?.mergeStatus ?? "unknown"
  };
}

function loopBlockers(stages: CoreProductLoopSmokeEvidence["stages"]) {
  const blockers = [
    ...stageStatusBlocker(SINGLE_SESSION_PRODUCT_LOOP_SMOKE, stages.singleSession),
    ...stageStatusBlocker(SINGLE_SESSION_LIVE_IMPLEMENTATION_SMOKE, stages.singleSessionImplementation),
    ...stageStatusBlocker(CLARIFICATION_PIPELINE_SMOKE, stages.clarification),
    ...stageStatusBlocker(RESEARCH_PIPELINE_SMOKE, stages.research),
    ...stageStatusBlocker(READINESS_TO_IMPLEMENTATION_SMOKE, stages.readinessToImplementation),
    ...stageStatusBlocker(AUTO_IMPLEMENTATION_PIPELINE_SMOKE, stages.autoImplementation)
  ];
  const loop = loopSummary(stages);

  if (loop.generatedQuestionCount < 10) {
    blockers.push(`core loop must start from a broad idea-fit question backlog; received ${loop.generatedQuestionCount}`);
  }
  if (loop.answeredQuestionCount < 1) {
    blockers.push("core loop must accept at least one clarification answer before research.");
  }
  if (loop.clarificationResearchTaskCount < 1) {
    blockers.push("core loop must turn clarification answers into research task debt.");
  }
  if (loop.researchFollowUpQuestionCount < 1) {
    blockers.push("core loop must turn research evidence into follow-up question debt.");
  }
  if (loop.researchFollowUpTaskCount < 1) {
    blockers.push("core loop must create generated follow-up research tasks after evidence synthesis.");
  }
  if (loop.generatedFollowUpResearchSourceRefCount < 1) {
    blockers.push("core loop must attach prior source refs/memory to generated follow-up research runs.");
  }
  if (loop.singleSessionGeneratedQuestionCount < 10) {
    blockers.push(`single-session core loop must generate many idea-fit questions; received ${loop.singleSessionGeneratedQuestionCount}`);
  }
  if (loop.singleSessionPetDomainQuestionSignalCount < 3) {
    blockers.push(
      `single-session core loop must keep generated questions fitted to the pet lifecycle idea; received ${loop.singleSessionPetDomainQuestionSignalCount}`
    );
  }
  if (loop.singleSessionFollowUpQuestionCount < 1) {
    blockers.push("single-session core loop must generate research follow-up questions in the same session.");
  }
  if (loop.singleSessionPlanningHandoffStatus !== "planning_ready") {
    blockers.push(`single-session core loop must reach planning_ready; received ${loop.singleSessionPlanningHandoffStatus}`);
  }
  if (loop.singleSessionAutoImplementationCurrentStage !== "initial_pr") {
    blockers.push(
      `single-session core loop must start auto implementation at initial_pr; received ${loop.singleSessionAutoImplementationCurrentStage}`
    );
  }
  if (loop.singleSessionGeneratedSoftwareArtifactCount < 5) {
    blockers.push(
      `single-session core loop must generate a runnable software scaffold; received ${loop.singleSessionGeneratedSoftwareArtifactCount} artifacts`
    );
  }
  if (!loop.singleSessionGeneratedSoftwareHasRunnableTest) {
    blockers.push("single-session core loop must include the generated software smoke test artifact.");
  }
  if (loop.sameSessionWorkerLedgerStatus !== "completed") {
    blockers.push(`single-session worker proof must complete an implementation ledger; received ${loop.sameSessionWorkerLedgerStatus}`);
  }
  if (loop.sameSessionWorkerStageAfter === "initial_pr" || loop.sameSessionWorkerStageAfter === "unknown") {
    blockers.push(`single-session worker proof must advance beyond initial_pr; received ${loop.sameSessionWorkerStageAfter}`);
  }
  if (loop.readinessCompositeScore < 85) {
    blockers.push(`core loop readiness score must reach 85 before implementation; received ${loop.readinessCompositeScore}`);
  }
  if (loop.readinessLabel !== "spec_ready") {
    blockers.push(`core loop readiness label must be spec_ready; received ${loop.readinessLabel}`);
  }
  if (loop.completionCandidateStatus !== "candidate") {
    blockers.push(`core loop completion candidate must be candidate before Planning Handoff; received ${loop.completionCandidateStatus}`);
  }
  if (loop.planningHandoffStatus !== "planning_ready") {
    blockers.push(`core loop must produce a planning_ready handoff before implementation; received ${loop.planningHandoffStatus}`);
  }
  if (loop.readinessImplementationStatus !== "pending") {
    blockers.push(`core loop readiness handoff must start an implementation run in pending state; received ${loop.readinessImplementationStatus}`);
  }
  if (loop.readinessImplementationCurrentStage !== "initial_pr") {
    blockers.push(`core loop readiness handoff must start at initial_pr; received ${loop.readinessImplementationCurrentStage}`);
  }
  if (loop.readinessImplementationStageCount < 7) {
    blockers.push(`core loop readiness handoff must create every canonical implementation stage; received ${loop.readinessImplementationStageCount}`);
  }
  if (loop.autoImplementationFinalStatus !== "completed") {
    blockers.push(`core loop auto implementation must finish the review-loop fixture; received ${loop.autoImplementationFinalStatus}`);
  }
  if (loop.autoImplementationCompletedStageCount < 7) {
    blockers.push(`core loop auto implementation must complete every canonical stage; received ${loop.autoImplementationCompletedStageCount}`);
  }
  if (loop.prMutationMergeStatus !== "applied") {
    blockers.push(`core loop PR mutation boundary must apply fixture merge evidence; received ${loop.prMutationMergeStatus}`);
  }

  return blockers;
}

function checkedEvidence(stages: CoreProductLoopSmokeEvidence["stages"]) {
  return [
    "idea intake reached a broad generated question backlog before implementation",
    "single-session pet-lifecycle idea reached domain-fit questions, answer-linked research, follow-up questions, planning_ready, initial_pr, and generated software scaffold",
    "same-session worker proof reused the Planning Handoff run and advanced beyond initial_pr with completed ledger evidence",
    "clarification answer submission created visible follow-up and research task debt",
    "public-web research provider polling imported source-traced evidence and generated follow-up questions",
    "generated follow-up research starts with prior source refs or markdown memory as baseline context",
    "positive readiness handoff proved spec_ready candidate, planning_ready artifact, and initial_pr auto implementation start",
    "auto implementation pipeline reached runtime preview, worker ledger import, PR mutation, review-loop, and merge_main fixture evidence",
    `single-session checked: ${stages.singleSession.checked.length}`,
    `same-session worker checked: ${stages.singleSessionImplementation.checked.length}`,
    `clarification checked: ${stages.clarification.checked.length}`,
    `research checked: ${stages.research.checked.length}`,
    `readiness-to-implementation checked: ${stages.readinessToImplementation.checked.length}`,
    `auto implementation checked: ${stages.autoImplementation.checked.length}`
  ];
}

async function runStage<T>(stageName: string, runner: SmokeRunner<T>): Promise<T> {
  try {
    return await runner();
  } catch (error: unknown) {
    throw new Error(`${stageName} smoke threw before returning evidence: ${errorMessage(error)}`, {
      cause: error
    });
  }
}

export async function runCoreProductLoopSmoke(
  options: CoreProductLoopSmokeOptions = {}
): Promise<CoreProductLoopSmokeEvidence> {
  try {
    const singleSession = await runStage(
      SINGLE_SESSION_PRODUCT_LOOP_SMOKE,
      options.runSingleSession ?? (() => runSingleSessionProductLoopSmoke())
    );
    const singleSessionImplementation = await runStage(
      SINGLE_SESSION_LIVE_IMPLEMENTATION_SMOKE,
      options.runSingleSessionImplementation ?? (() => runSingleSessionLiveImplementationSmoke())
    );
    const clarification = await runStage(
      CLARIFICATION_PIPELINE_SMOKE,
      options.runClarification ?? (() => runClarificationPipelineSmoke())
    );
    const research = await runStage(
      RESEARCH_PIPELINE_SMOKE,
      options.runResearch ?? (() => runResearchPipelineSmoke())
    );
    const readinessToImplementation = await runStage(
      READINESS_TO_IMPLEMENTATION_SMOKE,
      options.runReadinessToImplementation ?? (() => runReadinessToImplementationSmoke())
    );
    const autoImplementation = await runStage(
      AUTO_IMPLEMENTATION_PIPELINE_SMOKE,
      options.runAutoImplementation ?? (() => runAutoImplementationPipelineSmoke())
    );
    const stages = {
      singleSession,
      singleSessionImplementation,
      clarification,
      research,
      readinessToImplementation,
      autoImplementation
    };
    const loop = loopSummary(stages);
    const blockers = loopBlockers(stages);
    const checked = checkedEvidence(stages);

    if (blockers.length > 0) {
      return {
        status: "blocked",
        smoke: CORE_PRODUCT_LOOP_SMOKE,
        mode: "fixture",
        stages,
        loop,
        reason: "Core product loop smoke did not satisfy every idea-to-software fixture checkpoint.",
        blockers,
        checked
      };
    }

    return {
      status: "passed",
      smoke: CORE_PRODUCT_LOOP_SMOKE,
      mode: "fixture",
      stages,
      loop,
      checked
    };
  } catch (error: unknown) {
    const blockedStages = {
      clarification: {
        status: "blocked",
        smoke: CLARIFICATION_PIPELINE_SMOKE,
        mode: "fixture",
        reason: "Clarification stage did not return evidence.",
        blockers: [errorMessage(error)],
        checked: []
      } satisfies ClarificationPipelineSmokeEvidence,
      singleSession: {
        status: "blocked",
        smoke: SINGLE_SESSION_PRODUCT_LOOP_SMOKE,
        mode: "fixture",
        reason: "Single-session stage did not return evidence.",
        blockers: [errorMessage(error)],
        checked: []
      } satisfies SingleSessionProductLoopSmokeEvidence,
      singleSessionImplementation: {
        status: "blocked",
        smoke: SINGLE_SESSION_LIVE_IMPLEMENTATION_SMOKE,
        mode: "fixture",
        reason: "Same-session implementation worker stage did not return evidence.",
        blockers: [errorMessage(error)],
        checked: []
      } satisfies SingleSessionLiveImplementationSmokeEvidence,
      research: {
        status: "blocked",
        smoke: RESEARCH_PIPELINE_SMOKE,
        mode: "fixture",
        reason: "Research stage did not return evidence.",
        blockers: [errorMessage(error)],
        checked: []
      } satisfies ResearchPipelineSmokeEvidence,
      readinessToImplementation: {
        status: "blocked",
        smoke: READINESS_TO_IMPLEMENTATION_SMOKE,
        mode: "fixture",
        reason: "Readiness-to-implementation stage did not return evidence.",
        blockers: [errorMessage(error)],
        checked: []
      } satisfies ReadinessToImplementationSmokeEvidence,
      autoImplementation: {
        status: "blocked",
        smoke: AUTO_IMPLEMENTATION_PIPELINE_SMOKE,
        mode: "fixture",
        stages: {
          runtimePreviewTurn: {
            status: "blocked",
            smoke: "codex_runtime_preview_turn",
            mode: "fixture",
            reason: "Core product loop stopped before runtime preview evidence.",
            blockers: [errorMessage(error)],
            checked: []
          },
          workerJob: {
            status: "blocked",
            smoke: "auto_implementation_worker_job",
            mode: "fixture",
            reason: "Core product loop stopped before worker-job evidence.",
            blockers: [errorMessage(error)],
            checked: []
          },
          prMutation: {
            status: "blocked",
            smoke: "auto_implementation_pr_mutation",
            mode: "fixture",
            reason: "Core product loop stopped before PR mutation evidence.",
            blockers: [errorMessage(error)],
            checked: []
          },
          reviewLoop: {
            status: "blocked",
            smoke: "auto_implementation_review_loop",
            mode: "fixture",
            reason: "Core product loop stopped before review-loop evidence.",
            blockers: [errorMessage(error)],
            checked: []
          }
        },
        reason: "Auto implementation aggregate stage did not return evidence.",
        blockers: [errorMessage(error)],
        checked: []
      } satisfies AutoImplementationPipelineSmokeEvidence
    };

    return {
      status: "blocked",
      smoke: CORE_PRODUCT_LOOP_SMOKE,
      mode: "fixture",
      stages: blockedStages,
      reason: "Core product loop smoke failed before all stage evidence could be collected.",
      blockers: [errorMessage(error)],
      checked: ["core product loop runner failed before complete evidence could be collected"]
    };
  }
}

function exitCodeForEvidence(evidence: CoreProductLoopSmokeEvidence) {
  return evidence.status === "passed" ? 0 : 1;
}

async function main() {
  const evidence = await runCoreProductLoopSmoke();

  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = exitCodeForEvidence(evidence);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
