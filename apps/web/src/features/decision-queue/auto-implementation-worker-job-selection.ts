import type {
  AutoImplementationRun,
  AutoImplementationWorkerJob
} from "@solo-superman/contracts";

function autoImplementationWorkerJobs(run: AutoImplementationRun): readonly AutoImplementationWorkerJob[] {
  return Array.isArray((run as { readonly workerJobs?: unknown }).workerJobs)
    ? run.workerJobs
    : [];
}

const IMPORTABLE_WORKER_MISSING_EVIDENCE = new Set([
  "ImplementationStepLedger completed step",
  "ImplementationStepLedger import",
  "Local Codex worker execution"
]);

export function latestCurrentStageAutoImplementationWorkerJob(
  run: AutoImplementationRun | null
): AutoImplementationWorkerJob | null {
  if (!run) {
    return null;
  }

  return [...autoImplementationWorkerJobs(run)].reverse().find((job) => job.stage === run.currentStage) ?? null;
}

export function canImportAutoImplementationWorkerLedger(job: AutoImplementationWorkerJob | null): boolean {
  return job?.status === "planned" ||
    (
      job?.status === "blocked" &&
      job.missingEvidence.length === 1 &&
      IMPORTABLE_WORKER_MISSING_EVIDENCE.has(job.missingEvidence[0] ?? "")
    );
}
