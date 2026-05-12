import { describe, expect, it } from "vitest";
import type {
  ProjectId,
  QueueItemId,
  ResearchAllowlistId,
  ResearchConnectorId,
  ResearchRunId,
  ResearchTaskId,
  RuntimeArtifactId,
  SessionId,
  StateVersion
} from "@solo-superman/contracts";
import {
  createSidecarClient,
  parseSseEvents,
  SidecarClientError,
  discoverSidecarConnection,
  sidecarConnectionFromEnv,
  type SidecarConnection
} from "./sidecar-client";

const connection: SidecarConnection = {
  baseUrl: "http://127.0.0.1:43110",
  localCapabilityToken: "test-token",
  mode: "vite_env",
  status: "discovered",
  tokenSource: "vite_env"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

describe("sidecar client", () => {
  it("discovers the Vite dev connection without exposing sidecar auth through app state", () => {
    expect(
      sidecarConnectionFromEnv({
        VITE_SOLO_LOCAL_CAPABILITY_TOKEN: "shared-token",
        VITE_SOLO_SIDECAR_BASE_URL: "http://127.0.0.1:61234"
      })
    ).toMatchObject({
      baseUrl: "http://127.0.0.1:61234",
      localCapabilityToken: "shared-token",
      mode: "vite_env"
    });

    expect(sidecarConnectionFromEnv({})).toBeNull();
    expect(sidecarConnectionFromEnv({ VITE_SOLO_LOCAL_CAPABILITY_TOKEN: "shared-token" })).toBeNull();
    expect(sidecarConnectionFromEnv({ VITE_SOLO_SIDECAR_BASE_URL: "http://127.0.0.1:61234" })).toBeNull();
  });

  it("accepts an explicit IPv6 loopback Vite sidecar origin", () => {
    expect(
      sidecarConnectionFromEnv({
        VITE_SOLO_LOCAL_CAPABILITY_TOKEN: "shared-token",
        VITE_SOLO_SIDECAR_BASE_URL: "http://[::1]:61234"
      })
    ).toMatchObject({
      baseUrl: "http://[::1]:61234",
      localCapabilityToken: "shared-token",
      mode: "vite_env"
    });
  });

  it("does not fall back to a native shell bridge when Vite sidecar env is absent", async () => {
    await expect(discoverSidecarConnection()).resolves.toBeNull();
  });

  it("rejects non-loopback or non-origin Vite dev base URLs before sending the local token", () => {
    for (const baseUrl of [
      "https://127.0.0.1:61234",
      "http://192.0.2.10:61234",
      "http://127.0.0.1:61234/api",
      "http://127.0.0.1:61234/",
      "http://127.0.0.1:61234@evil.example"
    ]) {
      expect(
        sidecarConnectionFromEnv({
          VITE_SOLO_LOCAL_CAPABILITY_TOKEN: "shared-token",
          VITE_SOLO_SIDECAR_BASE_URL: baseUrl
        })
      ).toBeNull();
    }
  });

  it("posts commands with the local capability token and unwraps the success envelope", async () => {
    const requests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        requests.push([input, init]);

        return jsonResponse({
          ok: true,
          data: {
            category: "accepted_with_projection",
            commandId: "cmd_test",
            correlationId: "corr_test",
            stateVersionBefore: 0,
            stateVersionAfter: 1,
            immediateProjection: {
              kind: "SessionShellProjection",
              projectId: "proj_test",
              sessionId: "sess_test",
              version: 1,
              phase: "intake"
            }
          },
          meta: {
            requestId: "req_test",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });

    const response = await client.createProject({
      rawIdea: "A projection-backed queue shell",
      localPrivacyMode: "local_only"
    });
    const [url, init] = requests[0]!;

    expect(response.category).toBe("accepted_with_projection");
    expect(url).toBe("http://127.0.0.1:43110/api/v1/projects");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "Content-Type": "application/json"
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      rawIdea: "A projection-backed queue shell"
    });
  });

  it("submits answers through the documented question endpoint with session version context", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        return jsonResponse({
          ok: true,
          data: {
            category: "accepted_with_projection",
            commandId: "cmd_answer",
            correlationId: "corr_answer",
            stateVersionBefore: 5,
            stateVersionAfter: 6,
            queueProjection: {
              kind: "DecisionQueueProjection",
              version: 6,
              active: [],
              next: [],
              blocked: [],
              deferred: []
            }
          },
          meta: {
            requestId: "req_answer",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });

    await client.submitAnswer({
      sessionId: "sess_test" as SessionId,
      queueItemId: "queue_item_1" as QueueItemId,
      expectedStateVersion: 5 as StateVersion,
      answer: "The first answer"
    });

    const [url, init] = seenRequests[0]!;

    expect(url).toBe("http://127.0.0.1:43110/api/v1/questions/queue_item_1/answers");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "Content-Type": "application/json"
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      sessionId: "sess_test",
      queueItemId: "queue_item_1",
      expectedStateVersion: 5,
      answer: "The first answer"
    });
  });

  it("reads the authenticated SSE stream as notification-only refetch hints", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        return new Response(
          [
            "retry: 5000",
            "event: projection.updated",
            'data: {"event":"projection.updated","emittedAt":"2026-05-08T00:00:00.000Z","projectionKind":"DecisionQueueProjection","version":8,"affectedIds":["sess_test"],"refetchUrl":"/api/v1/sessions/sess_test/queue"}',
            ""
          ].join("\n"),
          {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream"
            }
          }
        );
      }
    });

    const notifications = await client.readSessionEventStreamSnapshot("sess_test" as SessionId);

    expect(seenRequests[0]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/events/stream?sessionId=sess_test",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token"
        })
      })
    ]);
    expect(notifications).toEqual([
      expect.objectContaining({
        event: "projection.updated",
        projectionKind: "DecisionQueueProjection",
        refetchUrl: "/api/v1/sessions/sess_test/queue"
      })
    ]);
    expect(parseSseEvents("event: projection.updated\n")).toEqual([]);
  });

  it("imports manual research results through the mounted research endpoint", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        return jsonResponse({
          ok: true,
          data: {
            category: "accepted_with_projection",
            commandId: "cmd_research",
            correlationId: "corr_research",
            stateVersionBefore: 7,
            stateVersionAfter: 9,
            immediateProjection: {
              kind: "ResearchEvidenceProjection",
              version: 9,
              taskIds: ["research_task_1"],
              tasks: [],
              results: [],
              evidenceMatrices: [],
              evidencePacks: [],
              reviewCards: [],
              knownRisks: [],
              nextValidationActions: [],
              proConBalanceStatus: "balanced"
            }
          },
          meta: {
            requestId: "req_research",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });

    await client.importResearchResult({
      sessionId: "sess_test" as SessionId,
      researchTaskId: "research_task_1" as ResearchTaskId,
      expectedStateVersion: 7 as StateVersion,
      result: "Pro: support. Con: risk."
    });

    const [url, init] = seenRequests[0]!;

    expect(url).toBe("http://127.0.0.1:43110/api/v1/research-tasks/research_task_1/results");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      sessionId: "sess_test",
      researchTaskId: "research_task_1",
      expectedStateVersion: 7,
      result: "Pro: support. Con: risk."
    });
  });

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

  it("calls Phase 1.5B hint query/export routes as authenticated metadata reads", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        return jsonResponse({
          ok: true,
          data: {
            kind: String(input).endsWith("/export")
              ? "Phase15bUpgradeHintExport"
              : "Phase15bUpgradeHintProjection",
            projectionKind: "Phase15bUpgradeHintProjection",
            projectId: "proj_hint",
            version: 0,
            generatedAt: "2026-05-06T00:00:00.000Z",
            stale: false,
            refetchUrl: "/api/v1/projects/proj_hint/phase15b-upgrade-hints",
            exportUrl: "/api/v1/projects/proj_hint/phase15b-upgrade-hints/export",
            pendingEffectSummary: {
              totalPending: 0,
              byType: {},
              visibleLabel: "No execution effects are pending."
            },
            metadataLabel: "readiness_preview_handoff_metadata",
            privatePayloadPolicy: "public_safe_metadata_only",
            noExecution: {
              semantic: "metadata_only_no_execution",
              productActionPerformed: false,
              delegationState: "not_active",
              credentialValueState: "omitted"
            },
            records: [],
            ...(String(input).endsWith("/export")
              ? {
                  exportedAt: "2026-05-06T00:00:00.000Z",
                  format: "json",
                  exportPolicy: {
                    privatePayloadsIncluded: false,
                    credentialValuesIncluded: false,
                    sourceRefLabelsIncluded: false,
                    reason: "phase15b_exports_are_public_safe_readiness_metadata_only"
                  }
                }
              : {})
          },
          meta: {
            requestId: "req_phase15b_hints",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });

    await client.listPhase15bUpgradeHints("proj_hint" as ProjectId);
    await client.exportPhase15bUpgradeHints("proj_hint" as ProjectId);

    expect(seenRequests[0]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/projects/proj_hint/phase15b-upgrade-hints",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token"
        })
      })
    ]);
    expect(seenRequests[1]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/projects/proj_hint/phase15b-upgrade-hints/export",
      expect.objectContaining({ method: "GET" })
    ]);
  });

  it("calls Phase 2 Planning Handoff POST and GET routes with the session path contract", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        return jsonResponse({
          ok: true,
          data: String(init?.method ?? "GET") === "POST"
            ? {
                category: "accepted_with_projection",
                commandId: "cmd_handoff",
                correlationId: "corr_handoff",
                stateVersionBefore: 3,
                stateVersionAfter: 4,
                eventIds: ["evt_handoff"],
                effectTaskIds: [],
                immediateProjection: {
                  kind: "PlanningHandoffProjection",
                  sessionId: "sess_handoff",
                  version: 4,
                  currentStatus: "source_trace_incomplete",
                  blockerArtifact: {
                    kind: "PlanningHandoffBlockerArtifact",
                    status: "source_trace_incomplete",
                    noFinalLabelRule: "must_not_use_planning_ready_label"
                  },
                  sourceRefs: [],
                  summary: "Planning Handoff blocker artifact",
                  refetchUrl: "/api/v1/sessions/sess_handoff/planning-handoff"
                }
              }
            : null,
          meta: {
            requestId: "req_handoff",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });

    await client.createPlanningHandoff({
      sessionId: "sess_handoff" as SessionId,
      expectedStateVersion: 3 as StateVersion,
      sourceRefs: [
        {
          sourceType: "spec_version",
          sourceId: "spec_version_handoff",
          required: true,
          stale: false
        }
      ]
    });
    await client.getPlanningHandoff("sess_handoff" as SessionId);

    expect(seenRequests[0]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/sessions/sess_handoff/planning-handoff",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          "Content-Type": "application/json"
        })
      })
    ]);
    expect(JSON.parse(String(seenRequests[0]?.[1]?.body))).toMatchObject({
      sessionId: "sess_handoff",
      expectedStateVersion: 3,
      sourceRefs: [
        expect.objectContaining({
          sourceType: "spec_version",
          sourceId: "spec_version_handoff"
        })
      ]
    });
    expect(seenRequests[1]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/sessions/sess_handoff/planning-handoff",
      expect.objectContaining({ method: "GET" })
    ]);
  });

  it("posts runtime artifact convert and block commands with session version context", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        return jsonResponse({
          ok: true,
          data: {
            category: "blocked",
            commandId: "cmd_runtime_block",
            correlationId: "corr_runtime_block",
            stateVersionBefore: 2,
            stateVersionAfter: 3,
            immediateProjection: {
              kind: "RuntimeActivityProjection",
              version: 3,
              effects: [],
              runtimeArtifacts: [],
              runtimeStatus: "blocked"
            }
          },
          meta: {
            requestId: "req_runtime_block",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });
    const artifactId = "runtime_artifact_1" as RuntimeArtifactId;

    await client.convertRuntimeArtifact({
      sessionId: "sess_test" as SessionId,
      artifactId,
      expectedStateVersion: 2 as StateVersion,
      target: "planning_note"
    });
    await client.blockRuntimeArtifact({
      sessionId: "sess_test" as SessionId,
      artifactId,
      expectedStateVersion: 3 as StateVersion,
      blockedActionType: "destructive_operation",
      reason: "Manual safety review blocked this preview."
    });

    expect(seenRequests[0]?.[0]).toBe(
      "http://127.0.0.1:43110/api/v1/runtime/artifacts/runtime_artifact_1/convert"
    );
    expect(JSON.parse(String(seenRequests[0]?.[1]?.body))).toMatchObject({
      sessionId: "sess_test",
      artifactId: "runtime_artifact_1",
      expectedStateVersion: 2,
      target: "planning_note"
    });
    expect(seenRequests[1]?.[0]).toBe(
      "http://127.0.0.1:43110/api/v1/runtime/artifacts/runtime_artifact_1/block"
    );
    expect(JSON.parse(String(seenRequests[1]?.[1]?.body))).toMatchObject({
      sessionId: "sess_test",
      artifactId: "runtime_artifact_1",
      expectedStateVersion: 3,
      blockedActionType: "destructive_operation",
      reason: "Manual safety review blocked this preview."
    });
  });

  it("calls runtime preview, manual handoff, status, and activity routes with the sidecar auth boundary", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        if (String(input).endsWith("/api/v1/runtime/status")) {
          return jsonResponse({
            ok: true,
            data: {
              status: "unavailable",
              adapterVersion: "codex-app-server-preview-v1",
              generatedSchemaVersion: "codex-cli-0.128.0",
              transport: "stdio",
              checkedAt: "2026-05-05T00:00:00.000Z",
              manualHandoffAvailable: true
            },
            meta: {
              requestId: "req_runtime_status",
              schemaVersion: "solo-superman.contracts.v1"
            }
          });
        }

        if (String(input).endsWith("/api/v1/sessions/sess_test/activity")) {
          return jsonResponse({
            ok: true,
            data: {
              kind: "RuntimeActivityProjection",
              version: 3,
              effects: [],
              runtimeArtifacts: [],
              runtimeStatus: "scaffold_placeholder"
            },
            meta: {
              requestId: "req_runtime_activity",
              schemaVersion: "solo-superman.contracts.v1"
            }
          });
        }

        return jsonResponse({
          ok: true,
          data: {
            category: "accepted",
            commandId: "cmd_runtime_preview",
            correlationId: "corr_runtime_preview",
            stateVersionBefore: 4,
            stateVersionAfter: 5
          },
          meta: {
            requestId: "req_runtime_preview",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });

    await client.createRuntimePreview({
      sessionId: "sess_test" as SessionId,
      expectedStateVersion: 4 as StateVersion,
      turnPurpose: "spec_update_preview",
      contextHash: "ctx_preview",
      prompt: "Preview a spec update.",
      sourceRefs: ["spec_current"],
      targetObject: "SpecUpdate"
    });
    await client.createManualHandoff({
      sessionId: "sess_test" as SessionId,
      expectedStateVersion: 5 as StateVersion,
      turnPurpose: "research_prompt",
      contextHash: "ctx_handoff",
      prompt: "Draft a manual research prompt.",
      sourceRefs: ["research_task_1"],
      targetObject: "ResearchTask"
    });
    await client.getRuntimeStatus();
    await client.getActivity("sess_test" as SessionId);

    expect(seenRequests[0]?.[0]).toBe("http://127.0.0.1:43110/api/v1/runtime/codex/preview");
    expect(seenRequests[0]?.[1]?.method).toBe("POST");
    expect(seenRequests[0]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "Content-Type": "application/json"
    });
    expect(JSON.parse(String(seenRequests[0]?.[1]?.body))).toMatchObject({
      sessionId: "sess_test",
      expectedStateVersion: 4,
      turnPurpose: "spec_update_preview",
      contextHash: "ctx_preview",
      sourceRefs: ["spec_current"]
    });
    expect(seenRequests[1]?.[0]).toBe("http://127.0.0.1:43110/api/v1/runtime/manual-handoff");
    expect(JSON.parse(String(seenRequests[1]?.[1]?.body))).toMatchObject({
      sessionId: "sess_test",
      expectedStateVersion: 5,
      turnPurpose: "research_prompt",
      sourceRefs: ["research_task_1"]
    });
    expect(seenRequests[2]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/runtime/status",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token"
        })
      })
    ]);
    expect(seenRequests[3]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/sessions/sess_test/activity",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token"
        })
      })
    ]);
  });

  it("resolves command status URLs on the discovered sidecar origin only", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        return jsonResponse({
          ok: true,
          data: {
            commandId: "cmd_status",
            category: "accepted",
            commandStatus: "pending",
            eventIds: [],
            effects: [],
            pendingEffectSummary: {
              totalPending: 0,
              byType: {},
              visibleLabel: "No pending effects."
            },
            projectionHints: [],
            lastUpdatedAt: "2026-05-12T00:00:00.000Z"
          },
          meta: {
            requestId: "req_status",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });

    await client.getCommandStatus("/api/v1/commands/cmd_status/status");
    await client.getCommandStatus("http://127.0.0.1:43110/api/v1/commands/cmd_status/status?attempt=1");

    expect(seenRequests.map(([url]) => url)).toEqual([
      "http://127.0.0.1:43110/api/v1/commands/cmd_status/status",
      "http://127.0.0.1:43110/api/v1/commands/cmd_status/status?attempt=1"
    ]);
    expect(seenRequests[0]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer test-token"
    });
    await expect(client.getCommandStatus("http://192.0.2.10:43110/api/v1/commands/cmd_status/status")).rejects.toThrow(
      "Sidecar request URL must stay on the discovered sidecar origin."
    );
  });

  it("preserves API error envelopes for recoverable UI states", async () => {
    const client = createSidecarClient({
      connection,
      fetchImpl: async () =>
        jsonResponse(
          {
            ok: false,
            error: {
              code: "SIDECAR_NOT_READY",
              message: "ProductEngine command handling requires migrated local storage."
            },
            meta: {
              requestId: "req_error",
              schemaVersion: "solo-superman.contracts.v1"
            }
          },
          503
        )
    });

    await expect(
      client.createProject({
        rawIdea: "Unavailable sidecar",
        localPrivacyMode: "local_only"
      })
    ).rejects.toMatchObject({
      httpStatus: 503,
      apiError: {
        code: "SIDECAR_NOT_READY"
      }
    });
  });

  it("normalizes non-JSON sidecar failures into a typed UI error", async () => {
    const client = createSidecarClient({
      connection,
      fetchImpl: async () =>
        new Response("Service unavailable", {
          status: 503,
          headers: {
            "Content-Type": "text/plain"
          }
        })
    });

    const request = client.createProject({
      rawIdea: "Unavailable sidecar",
      localPrivacyMode: "local_only"
    });

    await expect(request).rejects.toBeInstanceOf(SidecarClientError);
    await expect(request).rejects.toMatchObject({
      name: "SidecarClientError",
      httpStatus: 503,
      apiError: {
        code: "SIDECAR_NOT_READY",
        message: "Sidecar returned a non-JSON response."
      }
    });
  });
});
