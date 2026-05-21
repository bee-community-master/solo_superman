import { describe, expect, it } from "vitest";
import {
  type QueueItemId,
  type ResearchTaskId,
  type SessionId,
  type StateVersion
} from "@solo-superman/contracts";
import {
  createSidecarClient,
  parseSseEvents,
} from "./sidecar-client";
import { connection, jsonResponse } from "./sidecar-client.test-helpers";

describe("sidecar client commands", () => {
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
      localPrivacyMode: "local_only",
      projectPurposeMode: "personal",
      projectPurposeModeConfirmation: "user_confirmed"
    });
    const [url, init] = requests[0]!;

    expect(response.category).toBe("accepted_with_projection");
    expect(url).toBe("http://127.0.0.1:43110/api/v1/projects");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "Content-Type": "application/json"
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      rawIdea: "A projection-backed queue shell",
      projectPurposeMode: "personal",
      projectPurposeModeConfirmation: "user_confirmed"
    });
  });

  it("changes project purpose mode through the auditable session endpoint", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        return jsonResponse({
          ok: true,
          data: {
            category: "accepted_with_projection",
            commandId: "cmd_mode",
            correlationId: "corr_mode",
            stateVersionBefore: 4,
            stateVersionAfter: 5,
            immediateProjection: {
              kind: "SessionShellProjection",
              projectId: "proj_test",
              sessionId: "sess_test",
              version: 5,
              phase: "validation",
              projectPurposeMode: "personal",
              projectPurposeModeLabel: "개인 workflow 구현 중심",
              projectPurposeModeEffect: "개인 workflow 기준으로 질문과 리서치를 조정합니다."
            }
          },
          meta: {
            requestId: "req_mode",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });

    await client.changeProjectPurposeMode({
      sessionId: "sess_test" as SessionId,
      expectedStateVersion: 4 as StateVersion,
      projectPurposeMode: "personal",
      suggestedProjectPurposeMode: "personal",
      reason: "User clarified this is a personal workflow tool."
    });

    const [url, init] = seenRequests[0]!;

    expect(url).toBe("http://127.0.0.1:43110/api/v1/sessions/sess_test/project-purpose-mode");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "Content-Type": "application/json"
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      sessionId: "sess_test",
      expectedStateVersion: 4,
      projectPurposeMode: "personal",
      suggestedProjectPurposeMode: "personal",
      reason: "User clarified this is a personal workflow tool."
    });
  });

  it("changes business critic intensity through the auditable session endpoint", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        return jsonResponse({
          ok: true,
          data: {
            category: "accepted_with_projection",
            commandId: "cmd_business_critic",
            correlationId: "corr_business_critic",
            stateVersionBefore: 5,
            stateVersionAfter: 6,
            immediateProjection: {
              kind: "SessionShellProjection",
              projectId: "proj_test",
              sessionId: "sess_test",
              version: 6,
              phase: "validation",
              projectPurposeMode: "business",
              projectPurposeModeLabel: "사업화 검증 중심",
              businessCriticIntensity: "strong",
              businessCriticIntensitySelectionStatus: "confirmed",
              businessCriticIntensityLabel: "강한 사업 검증"
            }
          },
          meta: {
            requestId: "req_business_critic",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });

    await client.changeBusinessCriticIntensity({
      sessionId: "sess_test" as SessionId,
      expectedStateVersion: 5 as StateVersion,
      businessCriticIntensity: "strong",
      businessCriticIntensityConfirmation: "user_confirmed",
      reason: "User wants stronger pressure testing."
    });

    const [url, init] = seenRequests[0]!;

    expect(url).toBe("http://127.0.0.1:43110/api/v1/sessions/sess_test/business-critic-intensity");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "Content-Type": "application/json"
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      sessionId: "sess_test",
      expectedStateVersion: 5,
      businessCriticIntensity: "strong",
      businessCriticIntensityConfirmation: "user_confirmed",
      reason: "User wants stronger pressure testing."
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

  it("can request an explicit next question batch through the queue activation endpoint", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        return jsonResponse({
          ok: true,
          data: {
            category: "accepted_with_projection",
            commandId: "cmd_activate_queue",
            correlationId: "corr_activate_queue",
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
            requestId: "req_activate_queue",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });

    await client.activateQuestionBatch("sess_test" as SessionId, 5 as StateVersion, [
      "queue_item_2",
      "queue_item_3"
    ]);

    const [url, init] = seenRequests[0]!;

    expect(url).toBe("http://127.0.0.1:43110/api/v1/sessions/sess_test/queue/activate");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      expectedStateVersion: 5,
      queueItemIds: ["queue_item_2", "queue_item_3"]
    });
  });

  it("defers and dismisses queue items through mounted queue item endpoints", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        return jsonResponse({
          ok: true,
          data: {
            category: "accepted_with_projection",
            commandId: "cmd_queue_route",
            correlationId: "corr_queue_route",
            stateVersionBefore: 6,
            stateVersionAfter: 7,
            queueProjection: {
              kind: "DecisionQueueProjection",
              version: 7,
              active: [],
              next: [],
              blocked: [],
              deferred: []
            }
          },
          meta: {
            requestId: "req_queue_route",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });

    await client.deferQueueItem({
      sessionId: "sess_test" as SessionId,
      queueItemId: "queue_item_1" as QueueItemId,
      expectedStateVersion: 6 as StateVersion,
      reason: "Carry as known risk with a validation action.",
      riskDisposition: "known_risk_next_validation_action",
      nextValidationAction: "Run a pricing smoke test."
    });
    await client.dismissQueueItem({
      sessionId: "sess_test" as SessionId,
      queueItemId: "queue_item_2" as QueueItemId,
      expectedStateVersion: 7 as StateVersion,
      reason: "Covered by an existing decision."
    });

    expect(seenRequests.map(([url]) => url)).toEqual([
      "http://127.0.0.1:43110/api/v1/queue-items/queue_item_1/defer",
      "http://127.0.0.1:43110/api/v1/queue-items/queue_item_2/dismiss"
    ]);
    expect(JSON.parse(String(seenRequests[0]![1]?.body))).toMatchObject({
      sessionId: "sess_test",
      queueItemId: "queue_item_1",
      expectedStateVersion: 6,
      reason: "Carry as known risk with a validation action.",
      riskDisposition: "known_risk_next_validation_action",
      nextValidationAction: "Run a pricing smoke test."
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

});
