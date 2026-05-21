import type {
  BackgroundResearchAdapterKind,
  PublicSafeResearchDisclosurePayload,
  ResearchRunProjection
} from "@solo-superman/contracts";
import { assertResearchRunStatusTransition, validateResearchRunProjection } from "@solo-superman/contracts";

export interface BackgroundResearchAdapterStartInput {
  readonly researchRun: ResearchRunProjection;
  readonly disclosurePayload: PublicSafeResearchDisclosurePayload;
}

export interface BackgroundResearchAdapterStartResult {
  readonly status: "running";
  readonly providerRunId: string;
  readonly startedAt: string;
}

export interface BackgroundResearchAdapterCancelInput {
  readonly researchRun: ResearchRunProjection;
  readonly reason: string;
}

export interface BackgroundResearchAdapterCancelResult {
  readonly status: "cancel_requested" | "cancelled";
  readonly providerRunId?: string;
  readonly completedAt?: string;
  readonly reason: string;
}

export interface BackgroundResearchAdapterResultInput {
  readonly researchRun: ResearchRunProjection;
  readonly disclosurePayload?: PublicSafeResearchDisclosurePayload;
}

export interface BackgroundResearchAdapterResult {
  readonly status: "needs_review";
  readonly providerRunId: string;
  readonly completedAt: string;
  readonly sourceTitle?: string;
  readonly sourceUrl?: string;
  readonly summary: string;
  readonly limitations: readonly string[];
  readonly sourceRefs: readonly string[];
}

export interface BackgroundResearchRuntimeAdapter {
  readonly adapterKind: BackgroundResearchAdapterKind;
  readonly adapterVersion: string;
  readonly readonlyExternalAccess: true;
  start(input: BackgroundResearchAdapterStartInput): Promise<BackgroundResearchAdapterStartResult>;
  pollResult(input: BackgroundResearchAdapterResultInput): Promise<BackgroundResearchAdapterResult>;
  cancel(input: BackgroundResearchAdapterCancelInput): Promise<BackgroundResearchAdapterCancelResult>;
}

export interface FakeReadOnlyResearchAdapterOptions {
  readonly now?: () => string;
  readonly adapterVersion?: string;
  readonly resultSummary?: string;
  readonly sourceUrl?: string;
  readonly sourceTitle?: string;
  readonly limitations?: readonly string[];
}

function defaultNow() {
  return new Date().toISOString();
}

function assertPublicSafeDisclosurePayload(payload: PublicSafeResearchDisclosurePayload) {
  if (!payload.researchObjective.trim() || !payload.publicSafeSummary.trim()) {
    throw new Error("Fake read-only research adapter requires a public-safe disclosure payload.");
  }
}

function providerRunIdFor(run: ResearchRunProjection) {
  return `fake_readonly_${run.researchRunId}`;
}

function assertLocalFakeRun(run: ResearchRunProjection) {
  if (run.provider.adapterKind !== "local_fake_readonly") {
    throw new Error("Fake read-only adapter can only handle local_fake_readonly runs.");
  }
}

function cancellationStatusFor(run: ResearchRunProjection): BackgroundResearchAdapterCancelResult["status"] {
  return (run.status === "queued" || run.status === "paused") && !run.provider.providerRunId
    ? "cancelled"
    : "cancel_requested";
}

export function createFakeReadOnlyResearchAdapter(
  options: FakeReadOnlyResearchAdapterOptions = {}
): BackgroundResearchRuntimeAdapter {
  const now = options.now ?? defaultNow;
  const adapterVersion = options.adapterVersion ?? "solo-superman.fake-readonly-research-adapter.v1";

  return {
    adapterKind: "local_fake_readonly",
    adapterVersion,
    readonlyExternalAccess: true,

    async start(input) {
      const run = validateResearchRunProjection(input.researchRun);

      assertResearchRunStatusTransition(run.status, "running");
      assertPublicSafeDisclosurePayload(input.disclosurePayload);
      assertLocalFakeRun(run);

      return {
        status: "running",
        providerRunId: providerRunIdFor(run),
        startedAt: now()
      };
    },

    async pollResult(input) {
      const run = validateResearchRunProjection(input.researchRun);

      assertResearchRunStatusTransition(run.status, "needs_review");
      assertLocalFakeRun(run);

      return {
        status: "needs_review",
        providerRunId: run.provider.providerRunId ?? providerRunIdFor(run),
        completedAt: now(),
        ...(options.sourceTitle ? { sourceTitle: options.sourceTitle } : {}),
        ...(options.sourceUrl ? { sourceUrl: options.sourceUrl } : {}),
        summary:
          options.resultSummary ??
          `Read-only fake research result for ${run.researchTaskId}; requires quality gate review before EvidenceMatrix acceptance.`,
        limitations: options.limitations ?? ["Fixture result only; not accepted evidence until quality-gate review."],
        sourceRefs: run.sourceRefs
      };
    },

    async cancel(input) {
      const run = validateResearchRunProjection(input.researchRun);
      const status = cancellationStatusFor(run);

      assertResearchRunStatusTransition(run.status, status);
      assertLocalFakeRun(run);

      return {
        status,
        ...(run.provider.providerRunId ? { providerRunId: run.provider.providerRunId } : {}),
        ...(status === "cancelled" ? { completedAt: now() } : {}),
        reason: input.reason
      };
    }
  };
}
