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
  planPublicWebSearchQueries,
  rankedSearchCandidates,
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
          snippet: "Founder workflow reviews compare pricing, willingness to pay, paid alternatives, and repeat use for onboarding tools.",
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

    const result = await adapter.pollResult({ researchRun: runningRun, disclosurePayload });

    expect(result).toMatchObject({
      status: "needs_review",
      providerRunId: "web_search_readonly_research_run_web",
      completedAt: "2026-05-05T00:03:00.000Z",
      sourceTitle: expect.stringContaining("Result for"),
      sourceUrl: "https://example.com/public-founder-evidence",
      sourceRefs: expect.arrayContaining(["queue_item_web", "https://example.com/public-founder-evidence"]),
      limitations: expect.arrayContaining([
        expect.stringContaining("Only publicly reachable web pages were checked")
      ])
    });
    expect(result.summary).toContain("Research objective:");
    expect(result.summary).toContain("Usable findings:");
    expect(result.summary).toContain("Founder workflow reviews compare pricing");
    expect(result.summary).not.toContain("quality-gate review");
    expect(result.summary).not.toContain("snippet retained for review");
    expect(result.summary).not.toContain("Con: Browser search snippets can be incomplete");
  });

  it("cleans browser-search fallback titles and timeout notes before returning provider results", async () => {
    const adapter = createWebSearchReadOnlyResearchAdapter({
      now: () => "2026-05-05T00:03:00.000Z",
      search: async (input) => [
        {
          title: "zhihu.comhttps://www.zhihu.com › question",
          url: "https://www.zhihu.com/question/123",
          snippet:
            "반려동물 보호자 후기는 의료 기록, 보험 비용, 돌봄 상담 대체재를 함께 비교한다. Full page text was unavailable before timeout, so only the search-result summary is shown.",
          retrievedAt: input.now()
        }
      ]
    });
    const runningRun = runFixture({
      status: "running",
      provider: {
        ...runFixture().provider,
        providerRunId: "web_search_readonly_research_run_web_clean",
        startedAt: "2026-05-05T00:01:00.000Z"
      },
      updatedAt: "2026-05-05T00:01:00.000Z"
    });

    const result = await adapter.pollResult({
      researchRun: runningRun,
      disclosurePayload: {
        researchObjective: "반려동물 보호자 보험/의료 관리 니즈 검증",
        publicSafeSummary: "Product category: 반려동물 전생애주기 통합 관리 앱. Customer/problem hypothesis: 반려동물 보호자가 의료 기록과 보험 비용, 돌봄 상담 대체재를 비교한다."
      }
    });

    expect(result.sourceTitle).toBe("zhihu.com — 123");
    expect(result.summary).toContain("반려동물 보호자 후기는 의료 기록, 보험 비용, 돌봄 상담 대체재를 함께 비교한다.");
    expect(result.summary).not.toContain("zhihu.comhttps://");
    expect(result.summary).not.toContain("Full page text was unavailable");
    expect(result.summary).not.toContain("search-result summary is shown");
  });

  it("builds public web queries from idea context instead of generic ambiguity wording", async () => {
    const seenQueries: string[] = [];
    const adapter = createWebSearchReadOnlyResearchAdapter({
      now: () => "2026-05-05T00:03:00.000Z",
      search: async (input) => {
        seenQueries.push(input.query);

        return [
          {
            title: "Public pet market report",
            url: "https://example.com/pet-market-report",
            snippet: "반려동물 보호자 유형과 의료비, 보험 니즈, 돌봄 후기, 상담 대체재를 다룬 공개 리포트.",
            retrievedAt: input.now()
          }
        ];
      }
    });
    const runningRun = runFixture({
      status: "running",
      provider: {
        ...runFixture().provider,
        providerRunId: "web_search_readonly_research_run_web_query",
        startedAt: "2026-05-05T00:01:00.000Z"
      },
      updatedAt: "2026-05-05T00:01:00.000Z"
    });

    await adapter.pollResult({
      researchRun: runningRun,
      disclosurePayload: {
        researchObjective: "첫 고객 세그먼트가 너무 넓음을 구체화하기",
        publicSafeSummary:
          "Product category: 반려동물 전생애주기 통합 관리 앱. Customer/problem hypothesis: 의료 기록, 급여, 일상 돌봄, 보험 청구, 장례 준비 정보를 한 곳에서 관리한다. Research objective: 첫 고객 세그먼트가 너무 넓음을 구체화하기."
      }
    });

    const joinedQueries = seenQueries.join(" ");
    expect(seenQueries.length).toBeGreaterThanOrEqual(2);
    expect(joinedQueries).toContain("반려동물");
    expect(joinedQueries).toContain("보험");
    expect(joinedQueries).toContain("보호자 유형");
    expect(joinedQueries).not.toContain("Product category:");
    expect(joinedQueries).not.toContain("첫 고객 세그먼트가 너무 넓음");
  });

  it("plans short Korean-first queries for divorce runway paid-intent research without internal labels", () => {
    const plan = planPublicWebSearchQueries({
      researchObjective:
        "Find decision evidence for: 이혼 준비자를 위한 현금 runway와 유료 의향 검증. Original ambiguity: 구매 의향이 확인되지 않음. Decision this should inform: MVP paid coaching scope. Ambiguity dimension: assumption_pressure",
      publicSafeSummary:
        "Product category: 이혼 준비 재무 코칭 앱. Customer/problem hypothesis: 이혼 준비자가 별거/소송 전 현금흐름과 생계비 runway를 계산하고 유료 상담 또는 앱 결제 의향이 있는지 확인한다. Research objective: 이혼 준비자를 위한 현금 runway와 유료 의향 검증."
    });

    const joinedQueries = plan.queries.join(" ");

    expect(plan.queries.length).toBeGreaterThanOrEqual(2);
    expect(plan.queries.length).toBeLessThanOrEqual(4);
    expect(plan.queries.every((query) => query.length <= 220)).toBe(true);
    expect(joinedQueries).toContain("이혼 준비");
    expect(joinedQueries).toContain("재무");
    expect(joinedQueries).toMatch(/현금흐름|현금 runway/u);
    expect(joinedQueries).toContain("생계비");
    expect(joinedQueries).toMatch(/결제 의향|유료 의향/u);
    expect(joinedQueries).toMatch(/후기|상담|대체재/u);
    expect(joinedQueries).not.toContain("Find decision evidence for");
    expect(joinedQueries).not.toContain("Original ambiguity");
    expect(joinedQueries).not.toContain("Decision this should inform");
    expect(joinedQueries).not.toContain("Ambiguity dimension");
  });

  it("keeps only relevant source-linked findings when public search returns unrelated encyclopedia and OS help noise", async () => {
    const adapter = createWebSearchReadOnlyResearchAdapter({
      now: () => "2026-05-05T00:03:00.000Z",
      search: async (input) => [
        {
          title: "인류의 기원",
          url: "https://encykorea.aks.ac.kr/Article/E0047400",
          snippet: "인류의 기원과 진화에 대한 백과사전 설명.",
          retrievedAt: input.now()
        },
        {
          title: "PC 초기화 방법",
          url: "https://support.microsoft.com/ko-kr/windows/reset-your-pc",
          snippet: "Windows PC 초기화와 복구 옵션을 설명합니다.",
          retrievedAt: input.now()
        },
        {
          title: "현금영수증 unrelated forum",
          url: "https://example.net/forum/cash-receipt",
          snippet: "편의점 현금영수증 발급 방법을 묻는 무관 포럼 글.",
          retrievedAt: input.now()
        },
        {
          title: "이혼 전 재무 상담 후기와 비용",
          url: "https://example.org/divorce-financial-planning-pricing",
          snippet:
            "이혼 준비 과정에서 현금흐름, 생계비, 재무 상담 비용, 유료 상담 결제 의향, 대체재로 무료 커뮤니티 조언을 비교한 후기.",
          retrievedAt: input.now()
        }
      ]
    });
    const runningRun = runFixture({
      status: "running",
      provider: {
        ...runFixture().provider,
        providerRunId: "web_search_readonly_research_run_divorce",
        startedAt: "2026-05-05T00:01:00.000Z"
      },
      updatedAt: "2026-05-05T00:01:00.000Z"
    });

    const result = await adapter.pollResult({
      researchRun: runningRun,
      disclosurePayload: {
        researchObjective:
          "Find decision evidence for: 이혼 준비자를 위한 현금 runway와 유료 의향 검증. Original ambiguity: 구매 의향이 확인되지 않음. Decision this should inform: MVP paid coaching scope. Ambiguity dimension: assumption_pressure",
        publicSafeSummary:
          "Product category: 이혼 준비 재무 코칭 앱. Customer/problem hypothesis: 이혼 준비자가 별거/소송 전 현금흐름과 생계비 runway를 계산하고 유료 상담 또는 앱 결제 의향이 있는지 확인한다."
      }
    });

    expect(result.sourceTitle).toBe("이혼 전 재무 상담 후기와 비용");
    expect(result.sourceUrl).toBe("https://example.org/divorce-financial-planning-pricing");
    expect(result.sourceRefs).toEqual(expect.arrayContaining(["https://example.org/divorce-financial-planning-pricing"]));
    expect(result.sourceRefs).not.toContain("https://encykorea.aks.ac.kr/Article/E0047400");
    expect(result.summary).toContain("Usable findings:");
    expect(result.summary).toContain("[weakens]");
    expect(result.summary).toContain("이혼 준비 과정에서 현금흐름");
    expect(result.summary).toContain("Rejected noise:");
    expect(result.summary).toContain("- count: 3");
    expect(result.summary).not.toContain("인류의 기원");
    expect(result.summary).not.toContain("PC 초기화");
    expect(result.summary).not.toContain("support.microsoft");
  });

  it("does not use unrelated public results as fallback evidence when no usable source is found", async () => {
    const adapter = createWebSearchReadOnlyResearchAdapter({
      now: () => "2026-05-05T00:03:00.000Z",
      search: async (input) => [
        {
          title: "인류의 기원",
          url: "https://encykorea.aks.ac.kr/Article/E0047400",
          snippet: "인류의 기원과 진화에 대한 백과사전 설명.",
          retrievedAt: input.now()
        },
        {
          title: "PC 초기화 방법",
          url: "https://support.microsoft.com/ko-kr/windows/reset-your-pc",
          snippet: "Windows PC 초기화와 복구 옵션을 설명합니다.",
          retrievedAt: input.now()
        }
      ]
    });
    const runningRun = runFixture({
      status: "running",
      provider: {
        ...runFixture().provider,
        providerRunId: "web_search_readonly_research_run_noise_only",
        startedAt: "2026-05-05T00:01:00.000Z"
      },
      updatedAt: "2026-05-05T00:01:00.000Z"
    });

    const result = await adapter.pollResult({
      researchRun: runningRun,
      disclosurePayload: {
        researchObjective: "이혼 준비자를 위한 현금 runway와 유료 의향 검증",
        publicSafeSummary:
          "Product category: 이혼 준비 재무 코칭 앱. Customer/problem hypothesis: 이혼 준비자가 현금흐름과 생계비 runway를 계산하고 유료 상담 또는 결제 의향이 있는지 확인한다."
      }
    });

    expect(result.sourceTitle).toBeUndefined();
    expect(result.sourceUrl).toBeUndefined();
    expect(result.sourceRefs).toEqual(["queue_item_web"]);
    expect(result.summary).toContain("Usable findings:");
    expect(result.summary).toContain("usable finding 없음");
    expect(result.summary).toContain("source_quality_insufficient");
    expect(result.summary).toContain("공개 리서치에서 유의미한 근거를 찾지 못했으니 사용자가 직접 판단/검증 기준을 정해야 합니다.");
    expect(result.summary).not.toContain("인류의 기원");
    expect(result.summary).not.toContain("PC 초기화");
    expect(result.summary).not.toContain("support.microsoft");
  });

  it("drops unrelated search-engine noise when relevant public-web candidates are available", () => {
    const ranked = rankedSearchCandidates(
      [
        {
          title: "ChatGPT Translate launch discussion",
          url: "https://tinhte.vn/thread/chatgpt-translate-launch",
          snippet: "A forum discussion about translation features and AI product news."
        },
        {
          title: "반려동물 보호자 유형과 의료비 보험 시장 조사",
          url: "https://www.nias.go.kr/companion/new_petBoard.do?cmCode=M210524110205412",
          snippet: "반려동물 보호자 유형, 의료비 부담, 보험과 돌봄 니즈를 다룬 공개 통계 자료."
        }
      ],
      "반려동물 전생애주기 통합 관리 앱 의료 기록 보험 청구 반려동물 보호자 유형 의료비 보험 돌봄 시장 조사 통계 니즈",
      5
    );

    expect(ranked.map((candidate) => candidate.url)).toEqual([
      "https://www.nias.go.kr/companion/new_petBoard.do?cmCode=M210524110205412"
    ]);
  });

  it("prefers institutional market evidence over broad wiki or forum matches", () => {
    const ranked = rankedSearchCandidates(
      [
        {
          title: "반려 - 나무위키",
          url: "https://namu.wiki/w/%EB%B0%98%EB%A0%A4",
          snippet: "반려동물과 관련된 일반적인 wiki 설명."
        },
        {
          title: "ChatGPT Translate launch discussion",
          url: "https://tinhte.vn/thread/chatgpt-translate-launch",
          snippet: "A forum thread about translation features and AI product news."
        },
        {
          title: "반려동물 보호자 유형과 의료비 보험 시장 조사",
          url: "https://www.nias.go.kr/companion/new_petBoard.do?cmCode=M210524110205412",
          snippet: "반려동물 보호자 유형, 의료비 부담, 보험과 돌봄 니즈를 다룬 공개 통계 자료."
        }
      ],
      "반려동물 전생애주기 통합 관리 앱 의료 기록 보험 청구 반려동물 보호자 유형 의료비 보험 돌봄 시장 조사 통계 니즈",
      5
    );

    expect(ranked.map((candidate) => candidate.url)).toEqual([
      "https://www.nias.go.kr/companion/new_petBoard.do?cmCode=M210524110205412"
    ]);
  });

  it("drops fallback candidates when public search exposes no relevance signal", () => {
    const ranked = rankedSearchCandidates(
      [
        {
          title: "Untitled result",
          url: "https://example.com/a",
          snippet: "No overlap with the requested idea."
        },
        {
          title: "Another generic page",
          url: "https://example.com/b",
          snippet: "Still no overlap with the requested idea."
        }
      ],
      "반려동물 전생애주기 의료 보험 돌봄",
      1
    );

    expect(ranked).toEqual([]);
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
          title: "IPv4-compatible loopback service",
          url: "http://[::127.0.0.1]/private",
          snippet: "IPv4-compatible loopback must stay outside public web research.",
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
