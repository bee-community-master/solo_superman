import { describe, expect, it } from "vitest";
import {
  type ProjectId,
  type ResearchAllowlistId,
  type ResearchConnectorId,
  type ResearchRunId,
  type ResearchTaskId,
} from "@solo-superman/contracts";
import {
  createSidecarClient,
} from "./sidecar-client";
import { connection, jsonResponse } from "./sidecar-client.test-helpers";

describe("sidecar client research", () => {
  it("calls Phase 1.5A allowlist governance routes with project ownership context", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        return jsonResponse({
          ok: true,
          data: {
            category: "accepted_with_projection",
            commandId: "cmd_allowlist",
            correlationId: "corr_allowlist",
            stateVersionBefore: 0,
            stateVersionAfter: 1,
            immediateProjection: {
              kind: "ResearchAllowlistGovernanceProjection",
              projectionKind: "ResearchAllowlistProjection",
              projectId: "proj_allowlist",
              version: 1,
              generatedAt: "2026-05-05T00:00:00.000Z",
              stale: false,
              refetchUrl: "/api/v1/projects/proj_allowlist/research-allowlists",
              pendingEffectSummary: {
                totalPending: 0,
                byType: {},
                visibleLabel: "No async ProductEngine effects are pending for this allowlist governance action."
              },
              allowlists: [],
              automaticRunStartPolicies: []
            },
            projectionHints: [
              {
                projectionKind: "ResearchAllowlistProjection",
                refetchUrl: "/api/v1/projects/proj_allowlist/research-allowlists"
              }
            ]
          },
          meta: {
            requestId: "req_allowlist",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });
    const projectId = "proj_allowlist" as ProjectId;
    const allowlistId = "research_allowlist_client" as ResearchAllowlistId;

    await client.createResearchAllowlist(projectId, {
      allowlistId,
      connectorIds: ["public_search" as ResearchConnectorId],
      sourceCategories: ["public_web"],
      approvedBy: "owner_client"
    });
    await client.updateResearchAllowlist(projectId, allowlistId, {
      sourceCategories: ["public_web", "official_docs"],
      status: "active",
      approvedBy: "owner_client_update"
    });
    await client.pauseResearchAllowlist(projectId, allowlistId, "User paused automatic research.");
    await client.revokeResearchAllowlist(projectId, allowlistId, "User revoked automatic research.");
    await client.listResearchAllowlists(projectId);

    expect(seenRequests[0]?.[0]).toBe("http://127.0.0.1:43110/api/v1/projects/proj_allowlist/research-allowlists");
    expect(JSON.parse(String(seenRequests[0]?.[1]?.body))).toMatchObject({
      allowlistId,
      connectorIds: ["public_search"],
      sourceCategories: ["public_web"],
      approvedBy: "owner_client"
    });
    expect(seenRequests[1]?.[0]).toBe(
      "http://127.0.0.1:43110/api/v1/projects/proj_allowlist/research-allowlists/research_allowlist_client"
    );
    expect(JSON.parse(String(seenRequests[1]?.[1]?.body))).toMatchObject({
      sourceCategories: ["public_web", "official_docs"],
      status: "active",
      approvedBy: "owner_client_update"
    });
    expect(seenRequests[2]?.[0]).toBe(
      "http://127.0.0.1:43110/api/v1/projects/proj_allowlist/research-allowlists/research_allowlist_client/pause"
    );
    expect(JSON.parse(String(seenRequests[2]?.[1]?.body))).toMatchObject({
      projectId,
      allowlistId,
      reason: "User paused automatic research."
    });
    expect(seenRequests[3]?.[0]).toBe(
      "http://127.0.0.1:43110/api/v1/projects/proj_allowlist/research-allowlists/research_allowlist_client/revoke"
    );
    expect(JSON.parse(String(seenRequests[3]?.[1]?.body))).toMatchObject({
      projectId,
      allowlistId,
      reason: "User revoked automatic research."
    });
    expect(seenRequests[4]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/projects/proj_allowlist/research-allowlists",
      expect.objectContaining({
        method: "GET"
      })
    ]);
  });

  it("calls Phase 1.5A disclosure routes without placing raw/private context in the URL", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        return jsonResponse({
          ok: true,
          data:
            init?.method === "POST"
              ? {
                  category: "accepted_with_projection",
                  commandId: "cmd_disclosure",
                  correlationId: "corr_disclosure",
                  stateVersionBefore: 0,
                  stateVersionAfter: 1,
                  immediateProjection: {
                    kind: "ResearchDisclosurePreparationResult",
                    status: "automatic_payload_ready",
                    automaticExternalTransferAllowed: true,
                    publicSafePayload: {
                      researchObjective: "Find public onboarding evidence.",
                      publicSafeSummary: "Research objective: Find public onboarding evidence."
                    },
                    disclosureLog: {
                      logId: "research_disclosure_client",
                      projectId: "proj_disclosure",
                      allowlistId: "research_allowlist_client",
                      connectorId: "public_search",
                      sourceCategory: "public_web",
                      researchObjective: "Find public onboarding evidence.",
                      objectiveSummary: "Find public onboarding evidence.",
                      publicSafeSummarySent: "Research objective: Find public onboarding evidence.",
                      sourceRefs: ["queue_item_1"],
                      automaticExternalTransferAllowed: true,
                      status: "automatic_payload_ready",
                      createdAt: "2026-05-05T00:00:00.000Z"
                    },
                    projection: {
                      kind: "ResearchDisclosureLogProjection",
                      version: 1,
                      projectId: "proj_disclosure",
                      generatedAt: "2026-05-05T00:00:00.000Z",
                      stale: false,
                      refetchUrl: "/api/v1/projects/proj_disclosure/research-disclosures",
                      disclosureLogs: []
                    }
                  }
                }
              : {
                  kind: "ResearchDisclosureLogProjection",
                  version: 1,
                  projectId: "proj_disclosure",
                  generatedAt: "2026-05-05T00:00:00.000Z",
                  stale: false,
                  refetchUrl: "/api/v1/projects/proj_disclosure/research-disclosures",
                  disclosureLogs: []
                },
          meta: {
            requestId: "req_disclosure",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });
    const projectId = "proj_disclosure" as ProjectId;

    await client.prepareResearchDisclosure(projectId, {
      allowlistId: "research_allowlist_client" as ResearchAllowlistId,
      connectorId: "public_search" as ResearchConnectorId,
      sourceCategory: "public_web",
      researchObjective: "Find public onboarding evidence.",
      rawIdea: "Private raw idea must stay inside the JSON body.",
      sourceRefs: ["queue_item_1"]
    });
    await client.listResearchDisclosures(projectId);

    expect(seenRequests[0]?.[0]).toBe("http://127.0.0.1:43110/api/v1/projects/proj_disclosure/research-disclosures");
    expect(JSON.parse(String(seenRequests[0]?.[1]?.body))).toMatchObject({
      connectorId: "public_search",
      sourceCategory: "public_web",
      researchObjective: "Find public onboarding evidence.",
      rawIdea: "Private raw idea must stay inside the JSON body."
    });
    expect(seenRequests[1]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/projects/proj_disclosure/research-disclosures",
      expect.objectContaining({
        method: "GET"
      })
    ]);
  });

  it("calls Phase 1.5A research run control routes with status/refetch recovery context", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        return jsonResponse({
          ok: true,
          data:
            init?.method === "GET"
              ? {
                  kind: "ResearchRunControlProjection",
                  projectionKind: "ResearchRunProjection",
                  projectId: "proj_run",
                  version: 1,
                  generatedAt: "2026-05-06T00:00:00.000Z",
                  stale: false,
                  refetchUrl: "/api/v1/projects/proj_run/research-runs",
                  statusUrl: "/api/v1/projects/proj_run/research-runs/research_run_client/status",
                  pendingEffectSummary: {
                    totalPending: 0,
                    byType: {},
                    visibleLabel: "No async ProductEngine effects are pending."
                  },
                  runs: [],
                  selectedRun: {
                    kind: "ResearchRunProjection",
                    researchRunId: "research_run_client",
                    status: "running"
                  },
                  recovery: {
                    statusUrl: "/api/v1/projects/proj_run/research-runs/research_run_client/status",
                    refetchUrl: "/api/v1/projects/proj_run/research-runs/research_run_client/status",
                    sseEventNames: ["projection.updated"],
                    projectionHints: [
                      {
                        projectionKind: "ResearchRunProjection",
                        refetchUrl: "/api/v1/projects/proj_run/research-runs/research_run_client/status"
                      }
                    ]
                  }
                }
              : {
                  category: "accepted_with_projection",
                  commandId: "cmd_run",
                  correlationId: "corr_run",
                  stateVersionBefore: 0,
                  stateVersionAfter: 1,
                  statusUrl: "/api/v1/projects/proj_run/research-runs/research_run_client/status",
                  immediateProjection: {
                    kind: "ResearchRunControlResult",
                    action: "start",
                    status: "started",
                    projectId: "proj_run",
                    researchRunId: "research_run_client",
                    statusUrl: "/api/v1/projects/proj_run/research-runs/research_run_client/status"
                  },
                  projectionHints: [
                    {
                      projectionKind: "ResearchRunProjection",
                      refetchUrl: "/api/v1/projects/proj_run/research-runs/research_run_client/status"
                    }
                  ]
                },
          meta: {
            requestId: "req_run",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });
    const projectId = "proj_run" as ProjectId;
    const researchRunId = "research_run_client" as ResearchRunId;

    await client.startResearchRun(projectId, {
      researchRunId,
      researchTaskId: "research_task_client" as ResearchTaskId,
      allowlistId: "research_allowlist_client" as ResearchAllowlistId,
      connectorId: "public_search" as ResearchConnectorId,
      sourceCategory: "public_web",
      researchObjective: "Find public onboarding evidence.",
      rawIdea: "Private raw idea stays in the POST body.",
      contextHash: "ctx_client_public_safe_summary"
    });
    await client.getResearchRunStatus(projectId, researchRunId);
    await client.cancelResearchRun(projectId, researchRunId, {
      reason: "User cancelled the read-only research run."
    });
    await client.retryResearchRun(projectId, researchRunId, {
      retryReason: "Retry after provider timeout.",
      contextHash: "ctx_client_public_safe_summary"
    });
    await client.listResearchRuns(projectId);

    expect(seenRequests[0]?.[0]).toBe("http://127.0.0.1:43110/api/v1/projects/proj_run/research-runs");
    expect(JSON.parse(String(seenRequests[0]?.[1]?.body))).toMatchObject({
      researchRunId,
      researchTaskId: "research_task_client",
      connectorId: "public_search",
      sourceCategory: "public_web",
      adapterKind: "web_search_readonly",
      researchObjective: "Find public onboarding evidence.",
      rawIdea: "Private raw idea stays in the POST body."
    });
    expect(seenRequests[1]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/projects/proj_run/research-runs/research_run_client/status",
      expect.objectContaining({ method: "GET" })
    ]);
    expect(seenRequests[2]?.[0]).toBe(
      "http://127.0.0.1:43110/api/v1/projects/proj_run/research-runs/research_run_client/cancel"
    );
    expect(JSON.parse(String(seenRequests[2]?.[1]?.body))).toMatchObject({
      projectId,
      researchRunId,
      reason: "User cancelled the read-only research run."
    });
    expect(seenRequests[3]?.[0]).toBe(
      "http://127.0.0.1:43110/api/v1/projects/proj_run/research-runs/research_run_client/retry"
    );
    expect(JSON.parse(String(seenRequests[3]?.[1]?.body))).toMatchObject({
      projectId,
      researchRunId,
      retryReason: "Retry after provider timeout."
    });
    expect(seenRequests[4]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/projects/proj_run/research-runs",
      expect.objectContaining({ method: "GET" })
    ]);
  });

});
