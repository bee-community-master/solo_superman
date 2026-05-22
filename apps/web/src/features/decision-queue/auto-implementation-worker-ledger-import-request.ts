import type {
  AutoImplementationRun,
  ImportAutoImplementationWorkerLedgerRequest,
  RecordImplementationStepLedgerPayload,
  SessionId
} from "@solo-superman/contracts";
import {
  canImportAutoImplementationWorkerLedger,
  latestCurrentStageAutoImplementationWorkerJob
} from "./auto-implementation-worker-job-selection";

interface WorkerLedgerImportEnvelope {
  readonly ledgerTransitions: readonly RecordImplementationStepLedgerPayload[];
  readonly evidenceRefs?: readonly string[];
  readonly idempotencyKey?: string;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}

function parseWorkerLedgerImportEnvelope(rawDraft: string): WorkerLedgerImportEnvelope | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawDraft);
  } catch {
    return null;
  }

  if (Array.isArray(parsed)) {
    return {
      ledgerTransitions: parsed as readonly RecordImplementationStepLedgerPayload[]
    };
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.ledgerTransitions)) {
    return null;
  }

  const evidenceRefs = stringArray(parsed.evidenceRefs);
  const idempotencyKey = typeof parsed.idempotencyKey === "string" && parsed.idempotencyKey.trim()
    ? parsed.idempotencyKey.trim()
    : undefined;

  return {
    ledgerTransitions: parsed.ledgerTransitions as readonly RecordImplementationStepLedgerPayload[],
    ...(evidenceRefs ? { evidenceRefs } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {})
  };
}

export function buildAutoImplementationWorkerLedgerImportRequest(input: {
  readonly sessionId: SessionId;
  readonly run: AutoImplementationRun;
  readonly draft: string;
  readonly importedAt: string;
}): { readonly request: ImportAutoImplementationWorkerLedgerRequest | null; readonly error: string | null } {
  const workerJob = latestCurrentStageAutoImplementationWorkerJob(input.run);

  if (!workerJob) {
    return {
      request: null,
      error: "A current-stage local Codex worker job is required before importing ledger evidence."
    };
  }

  if (!canImportAutoImplementationWorkerLedger(workerJob)) {
    return {
      request: null,
      error: "The current-stage worker must be planned or blocked on ledger/worker-output evidence before importing ledger evidence."
    };
  }

  const envelope = parseWorkerLedgerImportEnvelope(input.draft.trim());

  if (!envelope) {
    return {
      request: null,
      error: "Paste worker ledger JSON as { ledgerTransitions, evidenceRefs? } or as a raw transition array."
    };
  }

  if (envelope.ledgerTransitions.length === 0) {
    return {
      request: null,
      error: "Worker ledger import requires at least one ImplementationStepLedger transition."
    };
  }

  return {
    request: {
      sessionId: input.sessionId,
      runId: input.run.runId,
      jobId: workerJob.jobId,
      idempotencyKey: envelope.idempotencyKey ??
        `auto-implementation-worker-ledger-import:${input.sessionId}:${input.run.runId}:${workerJob.jobId}:${workerJob.updatedAt}:${input.importedAt}`,
      ledgerTransitions: envelope.ledgerTransitions,
      evidenceRefs: envelope.evidenceRefs ?? [`ui-worker-ledger-import:${workerJob.jobId}`]
    },
    error: null
  };
}
