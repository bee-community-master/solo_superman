import type {
  AutoImplementationRun,
  AutoImplementationWorkerJob
} from "@solo-superman/contracts";

function autoImplementationWorkerJobs(run: AutoImplementationRun): readonly AutoImplementationWorkerJob[] {
  return Array.isArray((run as { readonly workerJobs?: unknown }).workerJobs)
    ? run.workerJobs
    : [];
}

export function latestCurrentStageAutoImplementationWorkerJob(
  run: AutoImplementationRun | null
): AutoImplementationWorkerJob | null {
  if (!run) {
    return null;
  }

  return [...autoImplementationWorkerJobs(run)].reverse().find((job) => job.stage === run.currentStage) ?? null;
}
