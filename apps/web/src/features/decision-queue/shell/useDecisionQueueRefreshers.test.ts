import { describe, expect, it, vi } from "vitest";
import type { ProjectId, SessionId } from "@solo-superman/contracts";
import type { SidecarClient } from "../../../shared/api/sidecar-client";
import { loadRefreshableDecisionQueueProjections } from "./useDecisionQueueRefreshers";

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
    } as unknown as SidecarClient;

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
});
