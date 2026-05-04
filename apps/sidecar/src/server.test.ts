import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";
import { describe, expect, it } from "vitest";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "@solo-superman/db";
import { createSidecarApp } from "./server";

const localCapabilityToken = "test-local-capability-token";
const tempDirs: string[] = [];
const migratedStatus = {
  state: "migrated",
  databaseUrl: ":memory:",
  migrationsFolder: "packages/db/drizzle",
  appliedMigrationCount: 1,
  latestMigrationMillis: 1_700_000_000_000,
  checkedAt: "2026-05-05T00:00:00.000Z"
} as const;
const app = createSidecarApp({ localCapabilityToken, migrationStatus: migratedStatus });

async function makeTempAppDataDir() {
  const tempDir = await mkdtemp(join(tmpdir(), "solo-superman-sidecar-test-"));

  tempDirs.push(tempDir);

  return tempDir;
}

async function createMigratedStorageApp() {
  const appDataDir = await makeTempAppDataDir();
  const storage = await createSoloStorage({ url: localDatabaseUrlFromAppDataDir(appDataDir) });
  const migrationStatus = await applyMigrations(storage);

  if (migrationStatus.state === "failed") {
    await storage.close();
    throw new Error(migrationStatus.errorMessage);
  }

  return {
    storage,
    app: createSidecarApp({
      localCapabilityToken,
      migrationStatus,
      storage
    })
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
});

function authHeaders(token = localCapabilityToken) {
  return {
    Authorization: `Bearer ${token}`
  };
}

interface JsonResponseBody {
  readonly error?: {
    readonly code: string;
    readonly message?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };
  readonly [key: string]: unknown;
}

async function jsonBody(response: Response) {
  return (await response.json()) as JsonResponseBody;
}

describe("PR-02 sidecar health shell", () => {
  it("serves health without auth before storage or ProductEngine initialization", async () => {
    const response = await app.request("/healthz");
    const body = await jsonBody(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      sidecarPhase: "pr_02_health_shell",
      checks: {
        process: "alive"
      }
    });
  });

  it("serves readiness with migrated storage status until later ProductEngine PRs", async () => {
    const response = await app.request("/readyz");
    const body = await jsonBody(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "not_ready",
      ready: false,
      code: "SIDECAR_NOT_READY",
      checks: {
        db: "migrated",
        productEngine: "not_initialized_until_storage_available",
        codex: "not_checked_until_pr_07"
      },
      migrations: {
        state: "migrated",
        appliedMigrationCount: 1
      }
    });
  });

  it("reports readiness after migrated storage and ProductEngine command handling are mounted", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const response = await storageApp.request("/readyz");
      const body = await jsonBody(response);

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        status: "ready",
        ready: true,
        checks: {
          db: "migrated",
          productEngine: "initialized_pr_04",
          codex: "not_checked_until_pr_07"
        },
        migrations: {
          state: "migrated"
        }
      });
      expect(body.code).toBeUndefined();
    } finally {
      await storage.close();
    }
  });

  it("redacts migration diagnostics from the unauthenticated readiness response", async () => {
    const fileApp = createSidecarApp({
      localCapabilityToken,
      migrationStatus: {
        ...migratedStatus,
        databaseUrl: "file:/Users/founder/Library/Application Support/Solo Superman/dev/solo-superman.db"
      }
    });
    const response = await fileApp.request("/readyz");
    const body = await jsonBody(response);
    const migrations = body.migrations as Readonly<Record<string, unknown>>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      migrations: {
        state: "migrated",
        appliedMigrationCount: 1
      }
    });
    expect(migrations.databaseUrl).toBeUndefined();
    expect(migrations.migrationsFolder).toBeUndefined();
  });

  it("keeps readiness unavailable when migration execution fails", async () => {
    const failedApp = createSidecarApp({
      localCapabilityToken,
      migrationStatus: {
        state: "failed",
        databaseUrl: "libsql://future-remote.example",
        migrationsFolder: "packages/db/drizzle",
        appliedMigrationCount: 0,
        latestMigrationMillis: null,
        checkedAt: "2026-05-05T00:00:00.000Z",
        errorMessage: "synthetic migration failure"
      }
    });
    const response = await failedApp.request("/readyz");
    const body = await jsonBody(response);

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: "not_ready",
      ready: false,
      code: "MIGRATION_FAILED",
      checks: {
        db: "migration_failed"
      },
      migrations: {
        state: "failed",
        errorCode: "MIGRATION_FAILED"
      }
    });
    expect((body.migrations as Readonly<Record<string, unknown>>).errorMessage).toBeUndefined();
  });

  it("rejects non-health API routes without the local capability token", async () => {
    const response = await app.request("/api/v1/projects");
    const body = await jsonBody(response);

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "AUTH_REQUIRED"
      },
      meta: {
        schemaVersion: expect.any(String)
      }
    });
  });

  it("rejects non-health API routes with the wrong local capability token", async () => {
    const response = await app.request("/api/v1/projects", {
      headers: {
        ...authHeaders("wrong-token"),
        "X-Request-Id": "req_wrong_token"
      }
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(401);
    expect(body.error?.code).toBe("AUTH_REQUIRED");
    expect(body.meta).toMatchObject({
      requestId: "req_wrong_token",
      schemaVersion: expect.any(String)
    });
    expect(response.headers.get("x-request-id")).toBe("req_wrong_token");
  });

  it("rejects empty app-local capability token configuration", () => {
    expect(() => createSidecarApp({ localCapabilityToken: "   " })).toThrow("localCapabilityToken must not be empty");
  });

  it("answers CORS preflight for the Tauri development WebView before the auth guard", async () => {
    const response = await app.request("/api/v1/projects", {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:1420",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Authorization, X-Request-Id"
      }
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:1420");
    expect(response.headers.get("access-control-allow-headers")).toContain("Authorization");
    expect(response.headers.get("access-control-allow-headers")).toContain("X-Request-Id");
  });

  it("exposes request ids to the local WebView for correlation", async () => {
    const response = await app.request("/api/v1/commands/cmd_demo/status", {
      headers: {
        ...authHeaders(),
        Origin: "http://127.0.0.1:1420",
        "X-Request-Id": "req_command_status"
      }
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("x-request-id")).toBe("req_command_status");
    expect(response.headers.get("access-control-expose-headers")).toContain("x-request-id");
  });

  it("does not grant CORS to non-local origins", async () => {
    const response = await app.request("/api/v1/projects", {
      method: "OPTIONS",
      headers: {
        Origin: "https://example.com",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Authorization"
      }
    });

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rejects explicitly non-loopback preflight before CORS handling", async () => {
    const response = await app.request("/api/v1/projects", {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:1420",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Authorization",
        "X-Forwarded-For": "203.0.113.10"
      }
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(403);
    expect(body.error?.details?.policy).toBe("loopback_only");
  });

  it("rejects explicitly non-loopback API requests before route handling", async () => {
    const response = await app.request("/api/v1/projects", {
      headers: {
        ...authHeaders(),
        "X-Forwarded-For": "203.0.113.10"
      }
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "AUTH_REQUIRED",
        details: {
          policy: "loopback_only"
        }
      },
      meta: {
        requestId: expect.any(String),
        schemaVersion: expect.any(String)
      }
    });
  });

  it("mounts the authenticated command-status placeholder without ProductEngine backing", async () => {
    const response = await app.request("/api/v1/commands/cmd_demo/status", {
      headers: authHeaders()
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "EFFECT_STATUS_UNAVAILABLE",
        details: {
          commandId: "cmd_demo",
          statusEndpointShape: {
            commandId: "cmd_demo",
            commandStatus: "pending",
            effects: [],
            projectionHints: []
          }
        }
      },
      meta: {
        requestId: expect.any(String),
        schemaVersion: expect.any(String)
      }
    });
  });

  it("keeps product command routes unavailable until migrated storage is mounted", async () => {
    const response = await app.request("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify({
        rawIdea: "Storage unavailable",
        localPrivacyMode: "local_only"
      }),
      headers: authHeaders()
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(503);
    expect(body.error?.code).toBe("SIDECAR_NOT_READY");
  });

  it("keeps non-PR-04 product API routes unimplemented behind the token guard", async () => {
    const response = await app.request("/api/v1/runtime/status", {
      headers: authHeaders()
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(404);
    expect(body.error?.code).toBe("RESOURCE_NOT_FOUND");
    expect(body.error?.message).toBe("This Phase 1 API route is not mounted yet.");
  });

  it("runs the PR-04 ProductEngine command path through first active question batch", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A focused founder brief generator",
          localPrivacyMode: "local_only"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const startResponse = startData as Readonly<Record<string, unknown>>;
      const sessionProjection = startResponse.immediateProjection as Readonly<Record<string, unknown>>;
      const projectId = sessionProjection.projectId as string;
      const sessionId = sessionProjection.sessionId as string;

      expect(start.status).toBe(200);
      expect(startData).toMatchObject({
        category: "accepted_with_projection",
        stateVersionBefore: 0,
        stateVersionAfter: 1
      });
      expect(sessionProjection).toMatchObject({
        kind: "SessionShellProjection",
        phase: "intake"
      });

      const intake = await storageApp.request(`/api/v1/sessions/${sessionId}/intake`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 1,
          answer: "Help solo founders turn a rough idea into a traceable product spec."
        })
      });
      const intakeBody = await jsonBody(intake);
      const intakeData = intakeBody.data as Readonly<Record<string, unknown>>;

      expect(intake.status).toBe(200);
      expect(intakeData).toMatchObject({
        category: "accepted",
        stateVersionAfter: 2
      });

      const intakeStatus = await storageApp.request(`/api/v1/commands/${intakeData.commandId as string}/status`, {
        headers: authHeaders()
      });
      const intakeStatusBody = await jsonBody(intakeStatus);

      expect(intakeStatus.status).toBe(200);
      expect(intakeStatusBody.data).toMatchObject({
        category: "accepted",
        commandStatus: "complete",
        pendingEffectSummary: {
          totalPending: 0
        },
        projectionHints: []
      });

      const draft = await storageApp.request(`/api/v1/sessions/${sessionId}/spec/initial`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 2
        })
      });
      const draftBody = await jsonBody(draft);

      expect(draft.status).toBe(200);
      expect(draftBody.data).toMatchObject({
        category: "accepted_with_projection",
        stateVersionAfter: 3
      });

      const specSession = await storageApp.request(`/api/v1/projects/${projectId}/sessions/${sessionId}`, {
        headers: authHeaders()
      });
      const specSessionBody = await jsonBody(specSession);

      expect(specSession.status).toBe(200);
      expect(specSessionBody.data).toMatchObject({
        kind: "SessionShellProjection",
        version: 3,
        phase: "spec"
      });

      const analyze = await storageApp.request(`/api/v1/sessions/${sessionId}/spec/analyze`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 3,
          targetRef: "current_spec"
        })
      });
      const analyzeBody = await jsonBody(analyze);
      const analyzeData = analyzeBody.data as Readonly<Record<string, unknown>>;

      expect(analyze.status).toBe(200);
      expect(analyzeData).toMatchObject({
        category: "accepted",
        stateVersionAfter: 4,
        pendingEffectSummary: {
          totalPending: 1,
          byType: {
            queue_projection_effect: 1
          }
        }
      });

      const activate = await storageApp.request(`/api/v1/sessions/${sessionId}/queue/activate`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 4
        })
      });
      const activateBody = await jsonBody(activate);
      const activateData = activateBody.data as Readonly<Record<string, unknown>>;
      const queueProjection = activateData.queueProjection as Readonly<Record<string, unknown>>;
      const activeItems = queueProjection.active as readonly unknown[];

      expect(activate.status).toBe(200);
      expect(activateData).toMatchObject({
        category: "accepted_with_projection",
        stateVersionAfter: 5,
        pendingEffectSummary: {
          totalPending: 1
        }
      });
      expect(queueProjection).toMatchObject({
        kind: "DecisionQueueProjection"
      });
      expect(activeItems).toHaveLength(4);

      const validationSession = await storageApp.request(`/api/v1/projects/${projectId}/sessions/${sessionId}`, {
        headers: authHeaders()
      });
      const validationSessionBody = await jsonBody(validationSession);

      expect(validationSession.status).toBe(200);
      expect(validationSessionBody.data).toMatchObject({
        kind: "SessionShellProjection",
        version: 5,
        phase: "validation"
      });

      const wrongProjectSession = await storageApp.request(`/api/v1/projects/proj_wrong/sessions/${sessionId}`, {
        headers: authHeaders()
      });
      const wrongProjectBody = await jsonBody(wrongProjectSession);

      expect(wrongProjectSession.status).toBe(404);
      expect(wrongProjectBody.error?.code).toBe("RESOURCE_NOT_FOUND");

      const queue = await storageApp.request(`/api/v1/sessions/${sessionId}/queue`, {
        headers: authHeaders()
      });
      const queueBody = await jsonBody(queue);

      expect(queue.status).toBe(200);
      expect(queueBody.data).toMatchObject({
        kind: "DecisionQueueProjection",
        active: expect.arrayContaining([
          expect.objectContaining({
            state: "active"
          })
        ])
      });

      const statusUrl = activateData.statusUrl as string;
      const status = await storageApp.request(statusUrl, {
        headers: authHeaders()
      });
      const statusBody = await jsonBody(status);
      const statusData = statusBody.data as Readonly<Record<string, unknown>>;
      const effects = statusData.effects as readonly Readonly<Record<string, unknown>>[];
      const activateEventIds = activateData.eventIds as readonly string[];

      expect(status.status).toBe(200);
      expect(statusData).toMatchObject({
        category: "accepted_with_projection",
        commandStatus: "pending",
        pendingEffectSummary: {
          totalPending: 1
        },
        projectionHints: [
          {
            projectionKind: "DecisionQueueProjection",
            refetchUrl: `/api/v1/sessions/${sessionId}/queue`
          }
        ]
      });
      expect(effects[0]).toMatchObject({
        idempotencyKey: `${activateEventIds[0]}:decision_queue`
      });
    } finally {
      await storage.close();
    }
  });

  it("rejects ambiguity analysis when the required targetRef is missing", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const response = await storageApp.request("/api/v1/sessions/sess_missing_target/spec/analyze", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 3
        })
      });
      const body = await jsonBody(response);

      expect(response.status).toBe(400);
      expect(body.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "targetRef must be a non-empty string."
      });
    } finally {
      await storage.close();
    }
  });

  it("rejects stale ProductEngine expectedStateVersion without appending events", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A stale version test idea",
          localPrivacyMode: "local_only"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const response = await storageApp.request(`/api/v1/sessions/${sessionId}/intake`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 0,
          answer: "This stale command should not append an event."
        })
      });
      const body = await jsonBody(response);

      expect(response.status).toBe(200);
      expect(body.data).toMatchObject({
        category: "rejected",
        error: {
          code: "STATE_VERSION_CONFLICT"
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("serializes same-session commands so concurrent stale writes return an enveloped rejection", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A concurrent command test idea",
          localPrivacyMode: "local_only"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const requestInit = {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 1,
          answer: "Only one concurrent intake command should win."
        })
      };
      const responses = await Promise.all([
        storageApp.request(`/api/v1/sessions/${sessionId}/intake`, requestInit),
        storageApp.request(`/api/v1/sessions/${sessionId}/intake`, requestInit)
      ]);
      const bodies = await Promise.all(responses.map(jsonBody));
      const categories = bodies.map((body) => (body.data as Readonly<Record<string, unknown>>).category).sort();

      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      expect(categories).toEqual(["accepted", "rejected"]);
      expect(
        bodies.some((body) => {
          const data = body.data as Readonly<Record<string, unknown>>;
          const error = data.error as Readonly<Record<string, unknown>> | undefined;

          return error?.code === "STATE_VERSION_CONFLICT";
        })
      ).toBe(true);
    } finally {
      await storage.close();
    }
  });
});
