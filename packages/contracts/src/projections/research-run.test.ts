import { describe, expect, it } from "vitest";
import type {
  ProjectId,
  ProjectionVersion,
  ResearchAllowlistId,
  ResearchConnectorId,
  ResearchDisclosureLogId,
  ResearchRunId,
  ResearchTaskId
} from "../ids";
import {
  assertResearchRunStatusTransition,
  buildResearchRunIdempotencyKey,
  canCreateManualResearchRunRetry,
  canTransitionResearchRunStatus,
  type ResearchRunProjection,
  ResearchRunValidationError,
  validateResearchRunProjection
} from "./research-run";

function idempotencyKey(attempt = 1) {
  return buildResearchRunIdempotencyKey({
    taskObjective: "Compare public onboarding proof for founder validation tools.",
    connectorId: "public_search" as ResearchConnectorId,
    contextHash: "ctx_public_summary_hash_001",
    allowlistVersion: 3 as ProjectionVersion,
    attempt
  });
}

function runFixture(overrides: Partial<ResearchRunProjection> = {}): ResearchRunProjection {
  const run = {
    kind: "ResearchRunProjection",
    version: 1 as ProjectionVersion,
    researchRunId: "research_run_contract" as ResearchRunId,
    projectId: "proj_research_run_contract" as ProjectId,
    researchTaskId: "research_task_contract" as ResearchTaskId,
    allowlistId: "research_allowlist_contract" as ResearchAllowlistId,
    disclosureLogId: "research_disclosure_contract" as ResearchDisclosureLogId,
    connectorId: "public_search" as ResearchConnectorId,
    sourceCategory: "public_web",
    status: "queued",
    provider: {
      researchRunId: "research_run_contract" as ResearchRunId,
      researchTaskId: "research_task_contract" as ResearchTaskId,
      adapterKind: "web_search_readonly",
      adapterVersion: "solo-superman.research-runtime.v1",
      sourceCategory: "public_web",
      idempotencyKey: idempotencyKey(),
      attempt: 1
    },
    qualityGateStatus: "not_evaluated",
    sourceRefs: ["queue_item_contract"],
    createdAt: "2026-05-05T00:00:00.000Z",
    updatedAt: "2026-05-05T00:00:00.000Z",
    ...overrides
  } as ResearchRunProjection;

  return run;
}

describe("ResearchRun projection contract", () => {
  it("validates a queued provider-neutral read-only research run", () => {
    const run = validateResearchRunProjection(runFixture());

    expect(run).toMatchObject({
      kind: "ResearchRunProjection",
      status: "queued",
      connectorId: "public_search",
      sourceCategory: "public_web",
      provider: {
        adapterKind: "web_search_readonly",
        adapterVersion: "solo-superman.research-runtime.v1",
        attempt: 1
      },
      qualityGateStatus: "not_evaluated"
    });
  });

  it("builds an idempotency key from objective, connector, context hash, allowlist version, and attempt", () => {
    expect(idempotencyKey(2)).toBe(
      "research-run:v1:objective=Compare+public+onboarding+proof+for+founder+validation+tools.:connector=public_search:context=ctx_public_summary_hash_001:allowlistVersion=3:attempt=2"
    );

    expect(() =>
      buildResearchRunIdempotencyKey({
        taskObjective: "sk-secret-token",
        connectorId: "public_search" as ResearchConnectorId,
        contextHash: "ctx_public_summary_hash_001",
        allowlistVersion: 3 as ProjectionVersion,
        attempt: 1
      })
    ).toThrow("taskObjective must not contain credential-like values");
  });

  it("requires lifecycle timestamps and quality gate status to match run status", () => {
    expect(
      validateResearchRunProjection(
        runFixture({
          status: "running",
          provider: {
            ...runFixture().provider,
            providerRunId: "provider_run_001",
            startedAt: "2026-05-05T00:01:00.000Z"
          },
          updatedAt: "2026-05-05T00:01:00.000Z"
        })
      )
    ).toMatchObject({ status: "running" });

    expect(() =>
      validateResearchRunProjection(
        runFixture({
          status: "running"
        })
      )
    ).toThrow("provider.startedAt");

    expect(() =>
      validateResearchRunProjection(
        runFixture({
          status: "accepted",
          provider: {
            ...runFixture().provider,
            providerRunId: "provider_run_001",
            startedAt: "2026-05-05T00:01:00.000Z",
            completedAt: "2026-05-05T00:03:00.000Z"
          },
          qualityGateStatus: "pending_review",
          terminalReason: "quality_gate_accepted",
          updatedAt: "2026-05-05T00:03:00.000Z"
        })
      )
    ).toThrow("qualityGateStatus must be passed");

    expect(() =>
      validateResearchRunProjection(
        runFixture({
          status: "failed",
          provider: {
            ...runFixture().provider,
            completedAt: "2026-05-05T00:03:00.000Z"
          },
          terminalReason: "timeout",
          updatedAt: "2026-05-05T00:03:00.000Z"
        })
      )
    ).toThrow("non-cancelled terminal runs require provider.startedAt");

    expect(() =>
      validateResearchRunProjection(
        runFixture({
          status: "failed",
          provider: {
            ...runFixture().provider,
            providerRunId: "provider_run_001",
            startedAt: "2026-05-05T00:04:00.000Z",
            completedAt: "2026-05-05T00:03:00.000Z"
          },
          terminalReason: "timeout",
          updatedAt: "2026-05-05T00:04:00.000Z"
        })
      )
    ).toThrow("completedAt must not be earlier");
  });

  it("keeps gate-unknown provider results in needs_review with an explicit review reason", () => {
    expect(
      validateResearchRunProjection(
        runFixture({
          version: 3 as ProjectionVersion,
          status: "needs_review",
          provider: {
            ...runFixture().provider,
            providerRunId: "provider_run_needs_review",
            startedAt: "2026-05-05T00:01:00.000Z",
            completedAt: "2026-05-05T00:03:00.000Z"
          },
          qualityGateStatus: "pending_review",
          qualityGateReviewReason: "Source reliability requires manual review before evidence acceptance.",
          updatedAt: "2026-05-05T00:03:00.000Z"
        })
      )
    ).toMatchObject({
      status: "needs_review",
      qualityGateStatus: "pending_review",
      qualityGateReviewReason: expect.stringContaining("manual review")
    });

    expect(() =>
      validateResearchRunProjection(
        runFixture({
          status: "needs_review",
          provider: {
            ...runFixture().provider,
            providerRunId: "provider_run_missing_reason",
            startedAt: "2026-05-05T00:01:00.000Z",
            completedAt: "2026-05-05T00:03:00.000Z"
          },
          qualityGateStatus: "pending_review",
          updatedAt: "2026-05-05T00:03:00.000Z"
        })
      )
    ).toThrow("qualityGateReviewReason");
  });

  it("allows queued cancellation to complete without a provider start timestamp", () => {
    expect(
      validateResearchRunProjection(
        runFixture({
          status: "cancelled",
          provider: {
            ...runFixture().provider,
            completedAt: "2026-05-05T00:01:00.000Z"
          },
          terminalReason: "cancelled_by_user",
          updatedAt: "2026-05-05T00:01:00.000Z"
        })
      )
    ).toMatchObject({
      status: "cancelled",
      terminalReason: "cancelled_by_user",
      provider: {
        completedAt: "2026-05-05T00:01:00.000Z"
      }
    });

    expect(() =>
      validateResearchRunProjection(
        runFixture({
          status: "cancelled",
          provider: {
            ...runFixture().provider,
            completedAt: "2026-05-05T00:01:00.000Z"
          },
          terminalReason: "provider_cancelled",
          updatedAt: "2026-05-05T00:01:00.000Z"
        })
      )
    ).toThrow("pre-start cancelled runs must use cancelled_by_user");
  });

  it("rejects provider-specific secrets and unsupported projection fields", () => {
    expect(() =>
      validateResearchRunProjection({
        ...runFixture(),
        provider: {
          ...runFixture().provider,
          providerRunId: "sk-secret-token"
        }
      })
    ).toThrow("credential-like");

    expect(() =>
      validateResearchRunProjection({
        ...runFixture(),
        provider: {
          ...runFixture().provider,
          idempotencyKey: "research-run:v1:objective=sk-secret-token:connector=public_search"
        }
      })
    ).toThrow("credential-like");

    expect(() =>
      validateResearchRunProjection({
        ...runFixture(),
        providerApiKey: "sk-secret"
      } as unknown as ResearchRunProjection)
    ).toThrow(ResearchRunValidationError);
  });

  it("allows docs/30 same-run transitions and blocks terminal same-run retry", () => {
    expect(canTransitionResearchRunStatus("queued", "running")).toBe(true);
    expect(canTransitionResearchRunStatus("running", "needs_review")).toBe(true);
    expect(canTransitionResearchRunStatus("needs_review", "accepted")).toBe(true);
    expect(canTransitionResearchRunStatus("queued", "cancelled")).toBe(true);
    expect(canTransitionResearchRunStatus("queued", "cancel_requested")).toBe(true);
    expect(canTransitionResearchRunStatus("cancel_requested", "cancelled")).toBe(true);

    expect(canTransitionResearchRunStatus("failed", "queued")).toBe(false);
    expect(canCreateManualResearchRunRetry("failed")).toBe(true);
    expect(canCreateManualResearchRunRetry("accepted")).toBe(false);
    expect(() => assertResearchRunStatusTransition("stale", "queued")).toThrow("same run id");
  });

  it("validates manual retry attempts only as a new run id with prior run trace and explicit reason", () => {
    const retry = validateResearchRunProjection(
      runFixture({
        version: 1 as ProjectionVersion,
        researchRunId: "research_run_retry" as ResearchRunId,
        provider: {
          ...runFixture().provider,
          researchRunId: "research_run_retry" as ResearchRunId,
          idempotencyKey: idempotencyKey(2),
          attempt: 2
        },
        retryOfRunId: "research_run_contract" as ResearchRunId,
        retryReason: "Prior run failed after read-only provider timeout."
      })
    );

    expect(retry).toMatchObject({
      researchRunId: "research_run_retry",
      retryOfRunId: "research_run_contract",
      retryReason: "Prior run failed after read-only provider timeout.",
      provider: {
        attempt: 2,
        idempotencyKey: expect.stringContaining("attempt=2")
      }
    });

    expect(() =>
      validateResearchRunProjection(
        runFixture({
          researchRunId: "research_run_retry_without_incremented_attempt" as ResearchRunId,
          provider: {
            ...runFixture().provider,
            researchRunId: "research_run_retry_without_incremented_attempt" as ResearchRunId
          },
          retryOfRunId: "research_run_contract" as ResearchRunId,
          retryReason: "Prior run failed after read-only provider timeout."
        })
      )
    ).toThrow("incremented provider.attempt");

    expect(() =>
      validateResearchRunProjection(
        runFixture({
          retryOfRunId: "research_run_contract" as ResearchRunId,
          retryReason: "Self-referential retry should not be accepted.",
          provider: {
            ...runFixture().provider,
            idempotencyKey: idempotencyKey(2),
            attempt: 2
          }
        })
      )
    ).toThrow("different prior research run");
  });
});
