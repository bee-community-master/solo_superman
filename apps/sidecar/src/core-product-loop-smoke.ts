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

export const CORE_PRODUCT_LOOP_SMOKE = "core_product_loop" as const;

type SmokeStatus = "blocked" | "passed";
type SmokeRunner<T> = () => Promise<T>;
type CoreProductLoopSummary = NonNullable<CoreProductLoopSmokeEvidence["loop"]>;

export interface CoreProductLoopSmokeEvidence {
  readonly status: SmokeStatus;
  readonly smoke: typeof CORE_PRODUCT_LOOP_SMOKE;
  readonly mode: "fixture";
  readonly stages: {
    readonly clarification: ClarificationPipelineSmokeEvidence;
    readonly research: ResearchPipelineSmokeEvidence;
    readonly autoImplementation: AutoImplementationPipelineSmokeEvidence;
  };
  readonly loop?: {
    readonly generatedQuestionCount: number;
    readonly answeredQuestionCount: number;
    readonly clarificationResearchTaskCount: number;
    readonly researchFollowUpQuestionCount: number;
    readonly researchFollowUpTaskCount: number;
    readonly generatedFollowUpResearchSourceRefCount: number;
    readonly autoImplementationCompletedStageCount: number;
    readonly autoImplementationFinalStatus: string;
    readonly prMutationMergeStatus: string;
  };
  readonly reason?: string;
  readonly blockers?: readonly string[];
  readonly checked: readonly string[];
}

export interface CoreProductLoopSmokeOptions {
  readonly runClarification?: SmokeRunner<ClarificationPipelineSmokeEvidence>;
  readonly runResearch?: SmokeRunner<ResearchPipelineSmokeEvidence>;
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
    autoImplementationCompletedStageCount: completedStageCount(stages.autoImplementation),
    autoImplementationFinalStatus: stages.autoImplementation.stages.reviewLoop.run?.finalStatus ?? "unknown",
    prMutationMergeStatus: stages.autoImplementation.stages.prMutation.prMutation?.mergeStatus ?? "unknown"
  };
}

function loopBlockers(stages: CoreProductLoopSmokeEvidence["stages"]) {
  const blockers = [
    ...stageStatusBlocker(CLARIFICATION_PIPELINE_SMOKE, stages.clarification),
    ...stageStatusBlocker(RESEARCH_PIPELINE_SMOKE, stages.research),
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
    "clarification answer submission created visible follow-up and research task debt",
    "public-web research provider polling imported source-traced evidence and generated follow-up questions",
    "generated follow-up research starts with prior source refs or markdown memory as baseline context",
    "planning/readiness remains evidence-gated before auto implementation claims completion",
    "auto implementation pipeline reached runtime preview, worker ledger import, PR mutation, review-loop, and merge_main fixture evidence",
    `clarification checked: ${stages.clarification.checked.length}`,
    `research checked: ${stages.research.checked.length}`,
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
    const clarification = await runStage(
      CLARIFICATION_PIPELINE_SMOKE,
      options.runClarification ?? (() => runClarificationPipelineSmoke())
    );
    const research = await runStage(
      RESEARCH_PIPELINE_SMOKE,
      options.runResearch ?? (() => runResearchPipelineSmoke())
    );
    const autoImplementation = await runStage(
      AUTO_IMPLEMENTATION_PIPELINE_SMOKE,
      options.runAutoImplementation ?? (() => runAutoImplementationPipelineSmoke())
    );
    const stages = {
      clarification,
      research,
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
      research: {
        status: "blocked",
        smoke: RESEARCH_PIPELINE_SMOKE,
        mode: "fixture",
        reason: "Research stage did not return evidence.",
        blockers: [errorMessage(error)],
        checked: []
      } satisfies ResearchPipelineSmokeEvidence,
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
