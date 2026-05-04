import { describe, expect, it } from "vitest";
import type { QueueItemId, SessionId, StateVersion } from "@solo-superman/contracts";
import { createSidecarClient, sidecarConnectionFromEnv, type SidecarConnection } from "./sidecar-client";

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
});
