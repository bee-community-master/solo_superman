import { describe, expect, it, vi } from "vitest";
import type {
  ProjectId,
  ResearchAllowlistGovernanceProjection,
  ResearchDisclosureLogProjection,
  ResearchRunControlProjection,
  SessionId
} from "@solo-superman/contracts";
import {
  loadRefreshableDecisionQueueProjections,
  loadResearchSettledDecisionQueueRefresh,
  type ResearchOperationsRefreshClient,
  type RefreshableDecisionQueueClient
} from "./useDecisionQueueRefreshers";

describe("decision queue refreshers", () => {
  it("does not probe the optional Founder Brief endpoint during broad projection refresh", async () => {
    const getFounderBrief = vi.fn(async () => {
      throw new Error("Founder Brief should only be fetched by explicit Founder Brief actions.");
    });
    const client = {
      getSession: vi.fn(async () => ({ kind: "SessionShellProjection", version: 1 })),
      getSpec: vi.fn(async () => ({ kind: "LivingSpecProjection", version: 2 })),
      getQueue: vi.fn(async () => ({ kind: "DecisionQueueProjection", version: 3 })),
      getResearch: vi.fn(async () => ({ kind: "ResearchEvidenceProjection", version: 4 })),
      getActivity: vi.fn(async () => ({ kind: "RuntimeActivityProjection", version: 5 })),
      getCompleteness: vi.fn(async () => ({ kind: "ConfidenceCompletionProjection", version: 6 })),
      getFounderBrief,
      getPlanningHandoff: vi.fn(async () => ({ kind: "PlanningHandoffProjection", version: 7 })),
      getChatGptBrowserDelegation: vi.fn(async () => ({ kind: "ChatGptBrowserDelegationProjection", version: 8 })),
      getServicePageUsePermission: vi.fn(async () => ({ kind: "ServicePageUsePermissionProjection", version: 9 })),
      getImplementationStepLedger: vi.fn(async () => ({ kind: "ImplementationStepLedgerProjection", version: 10 })),
      getAutoImplementationRuns: vi.fn(async () => ({ kind: "AutoImplementationRunProjection", version: 11 }))
    } satisfies RefreshableDecisionQueueClient & { readonly getFounderBrief: typeof getFounderBrief };

    const refreshed = await loadRefreshableDecisionQueueProjections(
      client,
      "proj_refresh" as ProjectId,
      "sess_refresh" as SessionId
    );

    expect(getFounderBrief).not.toHaveBeenCalled();
    expect(refreshed).toMatchObject({
      session: { kind: "SessionShellProjection" },
      spec: { kind: "LivingSpecProjection" },
      queue: { kind: "DecisionQueueProjection" },
      research: { kind: "ResearchEvidenceProjection" },
      activity: { kind: "RuntimeActivityProjection" },
      confidence: { kind: "ConfidenceCompletionProjection" },
      planningHandoff: { kind: "PlanningHandoffProjection" },
      chatGptDelegation: { kind: "ChatGptBrowserDelegationProjection" },
      servicePageUsePermission: { kind: "ServicePageUsePermissionProjection" },
      implementationStepLedger: { kind: "ImplementationStepLedgerProjection" },
      autoImplementationRuns: { kind: "AutoImplementationRunProjection" }
    });
  });

  it("settles project-level research polling before loading dependent broad projections", async () => {
    const calls: string[] = [];
    let researchPollingSettled = false;
    const allowlists = { kind: "ResearchAllowlistGovernanceProjection" } as ResearchAllowlistGovernanceProjection;
    const disclosures = { kind: "ResearchDisclosureLogProjection" } as ResearchDisclosureLogProjection;
    const runs = { kind: "ResearchRunControlProjection" } as ResearchRunControlProjection;
    const client = {
      listResearchAllowlists: vi.fn(async () => {
        calls.push("listResearchAllowlists");
        return allowlists;
      }),
      listResearchDisclosures: vi.fn(async () => {
        calls.push("listResearchDisclosures");
        return disclosures;
      }),
      listResearchRuns: vi.fn(async () => {
        calls.push("listResearchRuns");
        researchPollingSettled = true;
        return runs;
      }),
      getSession: vi.fn(async () => ({ kind: "SessionShellProjection", researchPollingSettled })),
      getSpec: vi.fn(async () => ({ kind: "LivingSpecProjection", researchPollingSettled })),
      getQueue: vi.fn(async () => {
        calls.push("getQueue");
        return { kind: "DecisionQueueProjection", researchPollingSettled };
      }),
      getResearch: vi.fn(async () => {
        calls.push("getResearch");
        return { kind: "ResearchEvidenceProjection", researchPollingSettled };
      }),
      getActivity: vi.fn(async () => ({ kind: "RuntimeActivityProjection", researchPollingSettled })),
      getCompleteness: vi.fn(async () => ({ kind: "ConfidenceCompletionProjection", researchPollingSettled })),
      getPlanningHandoff: vi.fn(async () => ({ kind: "PlanningHandoffProjection", researchPollingSettled })),
      getChatGptBrowserDelegation: vi.fn(async () => ({
        kind: "ChatGptBrowserDelegationProjection",
        researchPollingSettled
      })),
      getServicePageUsePermission: vi.fn(async () => ({
        kind: "ServicePageUsePermissionProjection",
        researchPollingSettled
      })),
      getImplementationStepLedger: vi.fn(async () => ({
        kind: "ImplementationStepLedgerProjection",
        researchPollingSettled
      })),
      getAutoImplementationRuns: vi.fn(async () => ({
        kind: "AutoImplementationRunProjection",
        researchPollingSettled
      }))
    } satisfies RefreshableDecisionQueueClient & ResearchOperationsRefreshClient;

    const refreshed = await loadResearchSettledDecisionQueueRefresh(
      client,
      "proj_research_settled_refresh" as ProjectId,
      "sess_research_settled_refresh" as SessionId
    );

    expect(refreshed.researchOperations).toEqual({
      allowlists,
      disclosures,
      runs
    });
    expect(refreshed.projections.research).toMatchObject({
      kind: "ResearchEvidenceProjection",
      researchPollingSettled: true
    });
    expect(refreshed.projections.queue).toMatchObject({
      kind: "DecisionQueueProjection",
      researchPollingSettled: true
    });
    expect(calls.indexOf("listResearchRuns")).toBeLessThan(calls.indexOf("getResearch"));
    expect(calls.indexOf("listResearchRuns")).toBeLessThan(calls.indexOf("getQueue"));
  });
});
