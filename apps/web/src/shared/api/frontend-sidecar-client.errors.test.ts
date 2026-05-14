/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, expect, it } from "vitest";
import {
  IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
  type ProjectId,
  type QueueItemId,
  type ResearchAllowlistId,
  type ResearchConnectorId,
  type ResearchRunId,
  type ResearchTaskId,
  type RuntimeArtifactId,
  type SessionId,
  type StateVersion
} from "@solo-superman/contracts";
import {
  createSidecarClient,
  parseSseEvents,
  SidecarClientError,
  discoverSidecarConnection,
  sidecarConnectionFromEnv
} from "./sidecar-client";
import { connection, jsonResponse } from "./sidecar-client.test-helpers";

describe("sidecar client errors", () => {
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
        localPrivacyMode: "local_only",
        projectPurposeMode: "business",
        projectPurposeModeConfirmation: "user_confirmed",
        businessCriticIntensity: "balanced",
        businessCriticIntensityConfirmation: "user_confirmed"
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
      localPrivacyMode: "local_only",
      projectPurposeMode: "business",
      projectPurposeModeConfirmation: "user_confirmed",
      businessCriticIntensity: "balanced",
      businessCriticIntensityConfirmation: "user_confirmed"
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
