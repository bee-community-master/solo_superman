import { describe, expect, it } from "vitest";
import {
  buildResearchRunIdempotencyKey,
  type ProjectId,
  type ProjectionVersion,
  type ResearchAllowlistId,
  type ResearchConnectorId,
  type ResearchDisclosureLogId,
  type ResearchRunId,
  type ResearchRunProjection,
  type ResearchTaskId
} from "@solo-superman/contracts";
import {
  createWebSearchReadOnlyResearchAdapter,
  WebSearchReadOnlyAdapterError,
  webSearchReadOnlyResearchAdapterOptionsFromEnv
} from "./web-search-readonly-adapter";

function runFixture(overrides: Partial<ResearchRunProjection> = {}): ResearchRunProjection {
  const researchRunId = (overrides.researchRunId ?? "research_run_web") as ResearchRunId;
  const researchTaskId = (overrides.researchTaskId ?? "research_task_web") as ResearchTaskId;
  const connectorId = (overrides.connectorId ?? "public_search") as ResearchConnectorId;

  return {
    kind: "ResearchRunProjection",
    version: 1 as ProjectionVersion,
    researchRunId,
    projectId: "proj_web_research" as ProjectId,
    researchTaskId,
    allowlistId: "research_allowlist_web" as ResearchAllowlistId,
    disclosureLogId: "research_disclosure_web" as ResearchDisclosureLogId,
    connectorId,
    sourceCategory: "public_web",
    status: "queued",
    provider: {
      researchRunId,
      researchTaskId,
      adapterKind: "web_search_readonly",
      adapterVersion: "solo-superman.web-search-readonly-playwright.v1",
      sourceCategory: "public_web",
      idempotencyKey: buildResearchRunIdempotencyKey({
        taskObjective: "Find public onboarding evidence.",
        connectorId,
        contextHash: "ctx_web_public_safe_summary",
        allowlistVersion: 1 as ProjectionVersion,
        attempt: 1
      }),
      attempt: 1
    },
    qualityGateStatus: "not_evaluated",
    sourceRefs: ["queue_item_web"],
    createdAt: "2026-05-05T00:00:00.000Z",
    updatedAt: "2026-05-05T00:00:00.000Z",
    ...overrides
  } as ResearchRunProjection;
}

const disclosurePayload = {
  researchObjective: "Find public onboarding evidence.",
  publicSafeSummary: "Research objective: Find public onboarding evidence for a founder workflow."
};

describe("web_search_readonly background research adapter", () => {
  it("reads only non-secret browser execution limits from env", () => {
    expect(
      webSearchReadOnlyResearchAdapterOptionsFromEnv({
        SOLO_RESEARCH_WEB_MAX_RESULTS: "6",
        SOLO_RESEARCH_WEB_MAX_FETCHED_PAGES: "2",
        SOLO_RESEARCH_WEB_TIMEOUT_MS: "9000",
        SOLO_RESEARCH_WEB_MIN_DELAY_MS: "1000",
        SOLO_RESEARCH_WEB_MAX_DELAY_MS: "6000"
      })
    ).toEqual({
      maxResults: 6,
      maxFetchedPages: 2,
      timeoutMillis: 9000,
      minDelayMillis: 1000,
      maxDelayMillis: 6000
    });

    expect(() =>
      webSearchReadOnlyResearchAdapterOptionsFromEnv({
        SOLO_RESEARCH_WEB_MAX_RESULTS: "token=secret"
      })
    ).toThrow("SOLO_RESEARCH_WEB_MAX_RESULTS");

    expect(() =>
      webSearchReadOnlyResearchAdapterOptionsFromEnv({
        SOLO_RESEARCH_WEB_MAX_RESULTS: "99"
      })
    ).toThrow("at most 10");

    expect(() =>
      webSearchReadOnlyResearchAdapterOptionsFromEnv({
        SOLO_RESEARCH_WEB_MIN_DELAY_MS: "1"
      })
    ).toThrow("at least 1000");

    expect(() =>
      webSearchReadOnlyResearchAdapterOptionsFromEnv({
        SOLO_RESEARCH_WEB_MAX_DELAY_MS: "9000"
      })
    ).toThrow("at most 6000");
  });

  it("starts a queued public-web run without credential or write access", async () => {
    const adapter = createWebSearchReadOnlyResearchAdapter({ now: () => "2026-05-05T00:01:00.000Z" });

    await expect(adapter.start({ researchRun: runFixture(), disclosurePayload })).resolves.toEqual({
      status: "running",
      providerRunId: "web_search_readonly_research_run_web",
      startedAt: "2026-05-05T00:01:00.000Z"
    });
    expect(adapter).toMatchObject({
      adapterKind: "web_search_readonly",
      readonlyExternalAccess: true
    });
  });

  it("returns real-source-shaped public web results from an injected browser search", async () => {
    const adapter = createWebSearchReadOnlyResearchAdapter({
      now: () => "2026-05-05T00:03:00.000Z",
      minDelayMillis: 1,
      maxDelayMillis: 1,
      search: async (input) => [
        {
          title: `Result for ${input.query}`,
          url: "https://example.com/public-founder-evidence",
          snippet: "Public evidence snippet about founder workflow research.",
          retrievedAt: input.now()
        }
      ]
    });
    const runningRun = runFixture({
      status: "running",
      provider: {
        ...runFixture().provider,
        providerRunId: "web_search_readonly_research_run_web",
        startedAt: "2026-05-05T00:01:00.000Z"
      },
      updatedAt: "2026-05-05T00:01:00.000Z"
    });

    await expect(adapter.pollResult({ researchRun: runningRun, disclosurePayload })).resolves.toMatchObject({
      status: "needs_review",
      providerRunId: "web_search_readonly_research_run_web",
      completedAt: "2026-05-05T00:03:00.000Z",
      sourceTitle: expect.stringContaining("Result for"),
      sourceUrl: "https://example.com/public-founder-evidence",
      sourceRefs: expect.arrayContaining(["queue_item_web", "https://example.com/public-founder-evidence"]),
      limitations: expect.arrayContaining([
        expect.stringContaining("no login, CAPTCHA, anti-bot bypass, paid-service access, or external search API")
      ])
    });
  });

  it("fails safely when the browser search is blocked", async () => {
    const adapter = createWebSearchReadOnlyResearchAdapter({
      search: async () => {
        throw new WebSearchReadOnlyAdapterError(
          "captcha_or_antibot_required",
          "Public web search was blocked by CAPTCHA; no bypass was attempted."
        );
      }
    });
    const runningRun = runFixture({
      status: "running",
      provider: {
        ...runFixture().provider,
        providerRunId: "web_search_readonly_research_run_web",
        startedAt: "2026-05-05T00:01:00.000Z"
      },
      updatedAt: "2026-05-05T00:01:00.000Z"
    });

    await expect(adapter.pollResult({ researchRun: runningRun, disclosurePayload })).rejects.toMatchObject({
      code: "captcha_or_antibot_required"
    });
  });

  it("rejects localhost and private-network URLs from search results", async () => {
    const adapter = createWebSearchReadOnlyResearchAdapter({
      search: async (input) => [
        {
          title: "Local development service",
          url: "http://127.0.0.1:43110/private",
          snippet: "This should not be reachable through public web research.",
          retrievedAt: input.now()
        },
        {
          title: "Private network service",
          url: "http://192.168.0.10/internal",
          snippet: "This should not be reachable through public web research.",
          retrievedAt: input.now()
        },
        {
          title: "IPv4-mapped loopback service",
          url: "http://[::ffff:127.0.0.1]/private",
          snippet: "IPv4-mapped loopback must stay outside public web research.",
          retrievedAt: input.now()
        },
        {
          title: "Documentation IPv6 service",
          url: "http://[2001:db8::1]/internal",
          snippet: "Documentation-only IPv6 ranges are not public fetch targets.",
          retrievedAt: input.now()
        },
        {
          title: "Multicast IPv6 service",
          url: "http://[ff02::1]/internal",
          snippet: "Multicast IPv6 ranges are not public fetch targets.",
          retrievedAt: input.now()
        }
      ]
    });
    const runningRun = runFixture({
      status: "running",
      provider: {
        ...runFixture().provider,
        providerRunId: "web_search_readonly_research_run_web",
        startedAt: "2026-05-05T00:01:00.000Z"
      },
      updatedAt: "2026-05-05T00:01:00.000Z"
    });

    await expect(adapter.pollResult({ researchRun: runningRun, disclosurePayload })).rejects.toMatchObject({
      code: "no_public_results"
    });
  });

  it("rejects non-public-web or non-web adapter runs", async () => {
    const adapter = createWebSearchReadOnlyResearchAdapter();

    await expect(
      adapter.start({
        researchRun: runFixture({
          provider: {
            ...runFixture().provider,
            adapterKind: "local_fake_readonly"
          }
        }),
        disclosurePayload
      })
    ).rejects.toThrow("web_search_readonly");

    await expect(
      adapter.start({
        researchRun: runFixture({
          sourceCategory: "official_docs",
          provider: {
            ...runFixture().provider,
            sourceCategory: "official_docs"
          }
        }),
        disclosurePayload
      })
    ).rejects.toThrow("public_web");
  });
});
