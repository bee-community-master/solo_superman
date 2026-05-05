import { describe, expect, it } from "vitest";
import type {
  ProjectId,
  ProjectionVersion,
  ResearchAllowlistId,
  ResearchConnectorId,
  ResearchDisclosureLogId,
  ResearchRunId,
  ResearchTaskId
} from "@solo-superman/contracts";
import {
  buildResearchRunIdempotencyKey,
  validateResearchRunProjection,
  type ResearchRunProjection
} from "@solo-superman/contracts";
import { createFakeReadOnlyResearchAdapter } from "./background-research-runtime";

function runFixture(overrides: Partial<ResearchRunProjection> = {}): ResearchRunProjection {
  const researchRunId = (overrides.researchRunId ?? "research_run_fake") as ResearchRunId;
  const researchTaskId = (overrides.researchTaskId ?? "research_task_fake") as ResearchTaskId;
  const connectorId = (overrides.connectorId ?? "public_search") as ResearchConnectorId;

  return {
    kind: "ResearchRunProjection",
    version: 1 as ProjectionVersion,
    researchRunId,
    projectId: "proj_fake_research" as ProjectId,
    researchTaskId,
    allowlistId: "research_allowlist_fake" as ResearchAllowlistId,
    disclosureLogId: "research_disclosure_fake" as ResearchDisclosureLogId,
    connectorId,
    sourceCategory: "public_web",
    status: "queued",
    provider: {
      researchRunId,
      researchTaskId,
      adapterKind: "local_fake_readonly",
      adapterVersion: "solo-superman.fake-readonly-research-adapter.v1",
      sourceCategory: "public_web",
      idempotencyKey: buildResearchRunIdempotencyKey({
        taskObjective: "Find public onboarding evidence.",
        connectorId,
        contextHash: "ctx_fake_public_safe_summary",
        allowlistVersion: 1 as ProjectionVersion,
        attempt: 1
      }),
      attempt: 1
    },
    qualityGateStatus: "not_evaluated",
    sourceRefs: ["queue_item_fake"],
    createdAt: "2026-05-05T00:00:00.000Z",
    updatedAt: "2026-05-05T00:00:00.000Z",
    ...overrides
  } as ResearchRunProjection;
}

describe("fake read-only background research adapter", () => {
  it("starts a queued local fake run with a provider-neutral reference", async () => {
    const adapter = createFakeReadOnlyResearchAdapter({ now: () => "2026-05-05T00:01:00.000Z" });

    await expect(
      adapter.start({
        researchRun: runFixture(),
        disclosurePayload: {
          researchObjective: "Find public onboarding evidence.",
          publicSafeSummary: "Research objective: Find public onboarding evidence."
        }
      })
    ).resolves.toEqual({
      status: "running",
      providerRunId: "fake_readonly_research_run_fake",
      startedAt: "2026-05-05T00:01:00.000Z"
    });
    expect(adapter).toMatchObject({
      adapterKind: "local_fake_readonly",
      readonlyExternalAccess: true
    });
  });

  it("returns needs_review fixture results without accepting evidence", async () => {
    const adapter = createFakeReadOnlyResearchAdapter({
      now: () => "2026-05-05T00:03:00.000Z",
      sourceUrl: "https://example.com/public-proof",
      resultSummary: "Pro: public evidence exists. Con: adoption risk remains."
    });
    const runningRun = runFixture({
      status: "running",
      provider: {
        ...runFixture().provider,
        providerRunId: "fake_readonly_research_run_fake",
        startedAt: "2026-05-05T00:01:00.000Z"
      },
      updatedAt: "2026-05-05T00:01:00.000Z"
    });

    await expect(adapter.pollResult({ researchRun: runningRun })).resolves.toMatchObject({
      status: "needs_review",
      providerRunId: "fake_readonly_research_run_fake",
      completedAt: "2026-05-05T00:03:00.000Z",
      sourceUrl: "https://example.com/public-proof",
      summary: "Pro: public evidence exists. Con: adoption risk remains.",
      limitations: ["Fixture result only; not accepted evidence until quality-gate review."]
    });
  });

  it("cancels a queued local fake run without requiring provider execution", async () => {
    const adapter = createFakeReadOnlyResearchAdapter({ now: () => "2026-05-05T00:02:00.000Z" });

    const cancellation = await adapter.cancel({
      researchRun: runFixture({ status: "queued" }),
      reason: "User cancelled before the read-only provider started."
    });

    expect(cancellation).toEqual({
      status: "cancelled",
      completedAt: "2026-05-05T00:02:00.000Z",
      reason: "User cancelled before the read-only provider started."
    });

    if (!cancellation.completedAt) {
      throw new Error("Expected queued cancellation to record completedAt.");
    }

    expect(
      validateResearchRunProjection(
        runFixture({
          status: "cancelled",
          provider: {
            ...runFixture().provider,
            completedAt: cancellation.completedAt
          },
          terminalReason: "cancelled_by_user",
          updatedAt: cancellation.completedAt
        })
      )
    ).toMatchObject({ status: "cancelled" });
  });

  it("keeps provider cancellation pending when a provider run id exists", async () => {
    const adapter = createFakeReadOnlyResearchAdapter();

    await expect(
      adapter.cancel({
        researchRun: runFixture({
          status: "running",
          provider: {
            ...runFixture().provider,
            providerRunId: "fake_readonly_research_run_fake",
            startedAt: "2026-05-05T00:01:00.000Z"
          },
          updatedAt: "2026-05-05T00:01:00.000Z"
        }),
        reason: "User cancelled after the provider started."
      })
    ).resolves.toMatchObject({
      status: "cancel_requested",
      providerRunId: "fake_readonly_research_run_fake"
    });
  });

  it("keeps running cancellation pending even when the provider has not returned a run id", async () => {
    const adapter = createFakeReadOnlyResearchAdapter({ now: () => "2026-05-05T00:02:00.000Z" });

    await expect(
      adapter.cancel({
        researchRun: runFixture({
          status: "running",
          provider: {
            ...runFixture().provider,
            startedAt: "2026-05-05T00:01:00.000Z"
          },
          updatedAt: "2026-05-05T00:01:00.000Z"
        }),
        reason: "User cancelled while provider startup is still being observed."
      })
    ).resolves.toEqual({
      status: "cancel_requested",
      reason: "User cancelled while provider startup is still being observed."
    });
  });

  it("rejects non-local fake adapter kinds and invalid transitions", async () => {
    const adapter = createFakeReadOnlyResearchAdapter();

    await expect(
      adapter.start({
        researchRun: runFixture({
          provider: {
            ...runFixture().provider,
            adapterKind: "web_search_readonly"
          }
        }),
        disclosurePayload: {
          researchObjective: "Find public onboarding evidence.",
          publicSafeSummary: "Research objective: Find public onboarding evidence."
        }
      })
    ).rejects.toThrow("local_fake_readonly");

    await expect(
      adapter.pollResult({
        researchRun: runFixture({ status: "queued" })
      })
    ).rejects.toThrow("queued to needs_review");
  });

  it("rejects non-local fake runs for polling and cancellation", async () => {
    const adapter = createFakeReadOnlyResearchAdapter();
    const webSearchProvider = {
      ...runFixture().provider,
      adapterKind: "web_search_readonly" as const
    };

    await expect(
      adapter.pollResult({
        researchRun: runFixture({
          status: "running",
          provider: {
            ...webSearchProvider,
            providerRunId: "provider_web_search_run",
            startedAt: "2026-05-05T00:01:00.000Z"
          },
          updatedAt: "2026-05-05T00:01:00.000Z"
        })
      })
    ).rejects.toThrow("local_fake_readonly");

    await expect(
      adapter.cancel({
        researchRun: runFixture({
          status: "running",
          provider: {
            ...webSearchProvider,
            providerRunId: "provider_web_search_run",
            startedAt: "2026-05-05T00:01:00.000Z"
          },
          updatedAt: "2026-05-05T00:01:00.000Z"
        }),
        reason: "User cancelled the read-only research run."
      })
    ).rejects.toThrow("local_fake_readonly");
  });
});
