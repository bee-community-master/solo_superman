import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";
import { describe, expect, it } from "vitest";
import {
  API_ROUTE_CATALOG,
  CONTRACT_SCHEMA_VERSION,
  CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS,
  type CommandId,
  type ProjectionVersion,
  type ResearchRunProjection
} from "@solo-superman/contracts";
import {
  applyMigrations,
  createEventRepository,
  createResearchRunRepository,
  createSoloStorage,
  localDatabaseUrlFromAppDataDir
} from "@solo-superman/db";
import { createProductEngineCommandService } from "./product-engine/command-service";
import { CodexRuntimeUnavailableError, createCodexRuntimeAdapter, fixtureCodexPreviewOutput } from "./runtime";
import { createSidecarApp } from "./server";

const localCapabilityToken = "test-local-capability-token";
const tempDirs: string[] = [];
const productApiRouteCount = API_ROUTE_CATALOG.filter((route) => route.path.startsWith("/api/v1")).length;
const unmountedProductApiRouteCount = productApiRouteCount - CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS.length;
const migratedStatus = {
  state: "migrated",
  databaseUrl: ":memory:",
  migrationsFolder: "packages/db/drizzle",
  appliedMigrationCount: 1,
  latestMigrationMillis: 1_700_000_000_000,
  checkedAt: "2026-05-05T00:00:00.000Z"
} as const;
const app = createSidecarApp({ localCapabilityToken, migrationStatus: migratedStatus });
const fixtureCodexRuntimeAdapter = createCodexRuntimeAdapter({
  fixtureMode: true,
  now: () => "2026-05-05T00:00:00.000Z",
  env: {}
});

async function makeTempAppDataDir() {
  const tempDir = await mkdtemp(join(tmpdir(), "solo-superman-sidecar-test-"));

  tempDirs.push(tempDir);

  return tempDir;
}

async function createMigratedStorageApp(codexRuntimeAdapter = fixtureCodexRuntimeAdapter) {
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
      storage,
      codexRuntimeAdapter
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

async function createProjectForTest(storageApp: ReturnType<typeof createSidecarApp>, rawIdea: string) {
  const start = await storageApp.request("/api/v1/projects", {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      rawIdea,
      localPrivacyMode: "local_only"
    })
  });
  const startBody = await jsonBody(start);
  const startData = startBody.data as Readonly<Record<string, unknown>>;
  const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;

  return {
    projectId: sessionProjection.projectId as string,
    sessionId: sessionProjection.sessionId as string
  };
}

async function createAllowlistForTest(
  storageApp: ReturnType<typeof createSidecarApp>,
  projectId: string,
  allowlistId: string,
  overrides: Readonly<Record<string, unknown>> = {}
) {
  return storageApp.request(`/api/v1/projects/${projectId}/research-allowlists`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      allowlistId,
      connectorIds: ["public_search"],
      sourceCategories: ["public_web"],
      approvedBy: "owner_research_run_route",
      ...overrides
    })
  });
}

describe("PR-02 sidecar health shell", () => {
  it("serves health without auth before storage or ProductEngine initialization", async () => {
    const response = await app.request("/healthz");
    const body = await jsonBody(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      sidecarPhase: "phase_1_5a_pr_05_research_run_controls",
      checks: {
        process: "alive"
      },
      productApiRoutePlaceholderCount: unmountedProductApiRouteCount
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
        codex: "runtime_status_endpoint_mounted_pr_07"
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
          codex: "runtime_status_endpoint_mounted_pr_07"
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

  it("keeps mounted product query routes unavailable until migrated storage is mounted", async () => {
    const response = await app.request("/api/v1/sessions/sess_demo/spec/versions", {
      headers: authHeaders()
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(503);
    expect(body.error?.code).toBe("SIDECAR_NOT_READY");
  });

  it("rejects non-object JSON bodies before route field validation", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const response = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify([])
      });
      const body = await jsonBody(response);

      expect(response.status).toBe(400);
      expect(body.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "Request body must be a JSON object."
      });
    } finally {
      await storage.close();
    }
  });

  it("mounts Phase 1.5A allowlist governance create/update/pause/revoke without reducer effects", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A research allowlist governance route test idea",
          localPrivacyMode: "local_only"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const projectId = sessionProjection.projectId as string;
      const allowlistId = "research_allowlist_route";
      const create = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          projectId,
          allowlistId,
          connectorIds: ["public_search"],
          sourceCategories: ["public_web"],
          approvedBy: "owner_route_test"
        })
      });
      const createBody = await jsonBody(create);
      const createData = createBody.data as Readonly<Record<string, unknown>>;
      const createProjection = createData.immediateProjection as Readonly<Record<string, unknown>>;
      const policies = createProjection.automaticRunStartPolicies as readonly Readonly<Record<string, unknown>>[];

      expect(create.status).toBe(200);
      expect(createData).toMatchObject({
        category: "accepted_with_projection",
        projectionHints: [
          {
            projectionKind: "ResearchAllowlistProjection",
            refetchUrl: `/api/v1/projects/${projectId}/research-allowlists`
          }
        ],
        deterministicOutputs: [
          expect.objectContaining({
            payload: expect.objectContaining({
              productEngineReducerSideEffects: false
            })
          })
        ]
      });
      expect(createData.statusUrl).toBeUndefined();
      expect(createProjection).toMatchObject({
        kind: "ResearchAllowlistGovernanceProjection",
        projectionKind: "ResearchAllowlistProjection",
        projectId,
        refetchUrl: `/api/v1/projects/${projectId}/research-allowlists`,
        pendingEffectSummary: {
          totalPending: 0
        },
        selectedAllowlist: {
          allowlistId,
          status: "active",
          connectorIds: ["public_search"],
          sourceCategories: ["public_web"]
        }
      });
      expect(policies[0]).toMatchObject({
        allowed: true,
        reason: "active_public_safe_allowlist"
      });

      const list = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists`, {
        headers: authHeaders()
      });
      const listBody = await jsonBody(list);

      expect(list.status).toBe(200);
      expect(listBody.data).toMatchObject({
        allowlists: [
          expect.objectContaining({
            allowlistId,
            status: "active"
          })
        ]
      });

      const pauseReason = "Route test pauses automatic research.";
      const pause = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists/${allowlistId}/pause`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          projectId,
          allowlistId,
          reason: pauseReason
        })
      });
      const pauseBody = await jsonBody(pause);
      const pauseData = pauseBody.data as Readonly<Record<string, unknown>>;
      const pauseProjection = pauseData.immediateProjection as Readonly<Record<string, unknown>>;
      const pauseDeterministicOutputs = pauseData.deterministicOutputs as readonly Readonly<Record<string, unknown>>[];

      expect(pause.status).toBe(200);
      expect(pauseDeterministicOutputs[0]?.payload).toMatchObject({
        commandType: "PauseResearchAllowlist",
        governanceReason: pauseReason,
        productEngineReducerSideEffects: false
      });
      expect(pauseProjection).toMatchObject({
        selectedAllowlist: {
          status: "paused",
          pausedAt: expect.any(String)
        },
        automaticRunStartPolicies: [
          expect.objectContaining({
            allowed: false,
            blockedByStatus: "paused",
            reason: "allowlist_paused"
          })
        ]
      });

      const missingReactivationApproval = await storageApp.request(
        `/api/v1/projects/${projectId}/research-allowlists/${allowlistId}`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            status: "active"
          })
        }
      );
      const missingReactivationApprovalBody = await jsonBody(missingReactivationApproval);

      expect(missingReactivationApproval.status).toBe(400);
      expect(missingReactivationApprovalBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "approvedBy is required when updating allowlist policy or activating automatic research."
      });

      const reactivate = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists/${allowlistId}`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: "active",
          sourceCategories: ["public_web", "official_docs"],
          approvedBy: "owner_route_reactivation"
        })
      });
      const reactivateBody = await jsonBody(reactivate);
      const reactivateData = reactivateBody.data as Readonly<Record<string, unknown>>;
      const reactivateProjection = reactivateData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(reactivate.status).toBe(200);
      expect(reactivateProjection).toMatchObject({
        selectedAllowlist: {
          status: "active",
          sourceCategories: ["public_web", "official_docs"]
        },
        automaticRunStartPolicies: [
          expect.objectContaining({
            allowed: true
          })
        ]
      });

      const revoke = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists/${allowlistId}/revoke`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });
      const revokeBody = await jsonBody(revoke);
      const revokeData = revokeBody.data as Readonly<Record<string, unknown>>;
      const revokeProjection = revokeData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(revoke.status).toBe(200);
      expect(revokeProjection).toMatchObject({
        selectedAllowlist: {
          status: "revoked",
          revokedAt: expect.any(String)
        },
        automaticRunStartPolicies: [
          expect.objectContaining({
            allowed: false,
            blockedByStatus: "revoked",
            reason: "allowlist_revoked"
          })
        ]
      });
    } finally {
      await storage.close();
    }
  });

  it("increments the allowlist governance collection version across multiple allowlists", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A multi-allowlist governance projection test idea",
          localPrivacyMode: "local_only"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const projectId = sessionProjection.projectId as string;
      const firstAllowlistId = "research_allowlist_collection_first";
      const secondAllowlistId = "research_allowlist_collection_second";

      const firstCreate = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          allowlistId: firstAllowlistId,
          connectorIds: ["public_search"],
          sourceCategories: ["public_web"],
          approvedBy: "owner_collection_test"
        })
      });
      const firstCreateBody = await jsonBody(firstCreate);
      const firstCreateData = firstCreateBody.data as Readonly<Record<string, unknown>>;

      expect(firstCreate.status).toBe(200);
      expect(firstCreateData).toMatchObject({
        stateVersionBefore: 0,
        stateVersionAfter: 1,
        immediateProjection: {
          version: 1
        }
      });

      const secondCreate = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          allowlistId: secondAllowlistId,
          connectorIds: ["official_docs"],
          sourceCategories: ["official_docs"],
          approvedBy: "owner_collection_test"
        })
      });
      const secondCreateBody = await jsonBody(secondCreate);
      const secondCreateData = secondCreateBody.data as Readonly<Record<string, unknown>>;
      const secondCreateProjection = secondCreateData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(secondCreate.status).toBe(200);
      expect(secondCreateData).toMatchObject({
        stateVersionBefore: 1,
        stateVersionAfter: 2
      });
      expect(secondCreateProjection).toMatchObject({
        version: 2,
        allowlists: [
          expect.objectContaining({
            allowlistId: firstAllowlistId,
            version: 1
          }),
          expect.objectContaining({
            allowlistId: secondAllowlistId,
            version: 1
          })
        ]
      });

      const pause = await storageApp.request(
        `/api/v1/projects/${projectId}/research-allowlists/${firstAllowlistId}/pause`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        }
      );
      const pauseBody = await jsonBody(pause);
      const pauseData = pauseBody.data as Readonly<Record<string, unknown>>;
      const pauseProjection = pauseData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(pause.status).toBe(200);
      expect(pauseData).toMatchObject({
        stateVersionBefore: 2,
        stateVersionAfter: 3
      });
      expect(pauseProjection).toMatchObject({
        version: 3,
        selectedAllowlist: {
          allowlistId: firstAllowlistId,
          version: 2,
          status: "paused"
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("prepares public-safe disclosure payloads and persists queryable disclosure logs", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A disclosure-safe research route test idea",
          localPrivacyMode: "local_only"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const projectId = sessionProjection.projectId as string;
      const allowlistId = "research_allowlist_disclosure_route";

      await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          allowlistId,
          connectorIds: ["public_search"],
          sourceCategories: ["public_web"],
          approvedBy: "owner_disclosure_route"
        })
      });

      const disclosure = await storageApp.request(`/api/v1/projects/${projectId}/research-disclosures`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          allowlistId,
          connectorId: "public_search",
          sourceCategory: "public_web",
          researchObjective: "Find public onboarding examples for founder@example.com.",
          productCategory: "Founder workflow assistant",
          customerProblemHypothesis: "Early founders need safer validation research.",
          sourceRefs: ["queue_item_disclosure", "https://docs.example.com/report?token=secret-value"]
        })
      });
      const disclosureBody = await jsonBody(disclosure);
      const disclosureData = disclosureBody.data as Readonly<Record<string, unknown>>;
      const preparation = disclosureData.immediateProjection as Readonly<Record<string, unknown>>;
      const publicSafePayload = preparation.publicSafePayload as Readonly<Record<string, unknown>>;

      expect(disclosure.status).toBe(200);
      expect(disclosureData).toMatchObject({
        category: "accepted_with_projection",
        projectionHints: [
          {
            projectionKind: "ResearchDisclosureLogProjection",
            refetchUrl: `/api/v1/projects/${projectId}/research-disclosures`
          }
        ],
        deterministicOutputs: [
          expect.objectContaining({
            payload: expect.objectContaining({
              commandType: "PrepareResearchDisclosure",
              providerExecution: false,
              externalTransferPerformed: false
            })
          })
        ]
      });
      expect(preparation).toMatchObject({
        kind: "ResearchDisclosurePreparationResult",
        status: "automatic_payload_ready",
        automaticExternalTransferAllowed: true,
        disclosureLog: {
          allowlistId,
          connectorId: "public_search",
          sourceCategory: "public_web",
          publicSafeSummarySent: expect.stringContaining("Product category")
        },
        projection: {
          kind: "ResearchDisclosureLogProjection",
          projectId,
          refetchUrl: `/api/v1/projects/${projectId}/research-disclosures`
        }
      });
      expect(publicSafePayload.researchObjective).toBe("Find public onboarding examples for [redacted contact].");
      expect(JSON.stringify(disclosureBody)).not.toContain("founder@example.com");
      expect(JSON.stringify(disclosureBody)).not.toContain("secret-value");

      const list = await storageApp.request(`/api/v1/projects/${projectId}/research-disclosures`, {
        headers: authHeaders()
      });
      const listBody = await jsonBody(list);

      expect(list.status).toBe(200);
      expect(listBody.data).toMatchObject({
        kind: "ResearchDisclosureLogProjection",
        disclosureLogs: [
          expect.objectContaining({
            status: "automatic_payload_ready",
            sourceRefs: ["queue_item_disclosure", "https://docs.example.com/report?[redacted secret]"]
          })
        ],
        latestDisclosureLog: expect.objectContaining({
          status: "automatic_payload_ready"
        })
      });

      const rows = await storage.client.execute("SELECT source_refs_json FROM research_disclosure_logs");

      expect(JSON.stringify(rows.rows)).not.toContain("secret-value");
    } finally {
      await storage.close();
    }
  });

  it("blocks private or credentialed disclosure requests before automatic transfer and logs the blocker", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A disclosure blocked route test idea",
          localPrivacyMode: "local_only"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const projectId = sessionProjection.projectId as string;
      const blocked = await storageApp.request(`/api/v1/projects/${projectId}/research-disclosures`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          connectorId: "public_search",
          sourceCategory: "credentialed_source",
          researchObjective: "Compare private account session evidence for Jane Founder.",
          productCategory: "Founder workflow assistant",
          customerProblemHypothesis: "Jane Founder needs sensitive validation help.",
          rawIdea: "Raw idea with stealth pricing details must not leave the app.",
          detailedAnswers: ["Detailed willingness-to-pay answer must not leave the app."],
          privateCustomerNames: ["Jane Founder"],
          sourceRefs: ["queue_item_private"]
        })
      });
      const blockedBody = await jsonBody(blocked);
      const blockedData = blockedBody.data as Readonly<Record<string, unknown>>;
      const preparation = blockedData.immediateProjection as Readonly<Record<string, unknown>>;
      const disclosureLog = preparation.disclosureLog as Readonly<Record<string, unknown>>;

      expect(blocked.status).toBe(200);
      expect(blockedData).toMatchObject({
        category: "blocked",
        blockingCard: {
          userAction: "task_level_approval_or_manual_handoff"
        }
      });
      expect(preparation).toMatchObject({
        status: "blocked_manual_handoff",
        automaticExternalTransferAllowed: false,
        manualHandoff: {
          required: true,
          route: "task_level_approval_or_manual_handoff"
        }
      });
      expect(disclosureLog).toMatchObject({
        status: "blocked_manual_handoff",
        sourceCategory: "credentialed_source",
        automaticExternalTransferAllowed: false,
        blockReason: "manual_source_category"
      });

      const serialized = JSON.stringify(blockedBody);

      expect(serialized).not.toContain("Raw idea with stealth pricing");
      expect(serialized).not.toContain("willingness-to-pay");
      expect(serialized).not.toContain("Jane Founder");
      expect(serialized).toContain("[redacted private context]");

      const rows = await storage.client.execute("SELECT public_safe_summary_sent FROM research_disclosure_logs");

      expect(JSON.stringify(rows.rows)).not.toContain("Raw idea with stealth pricing");
    } finally {
      await storage.close();
    }
  });

  it("starts, observes, cancels, and retries Phase 1.5A research runs with refetch recovery hints", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const { projectId } = await createProjectForTest(storageApp, "A research run control route test idea");
      const allowlistId = "research_allowlist_run_route";

      await createAllowlistForTest(storageApp, projectId, allowlistId);

      const startRun = await storageApp.request(`/api/v1/projects/${projectId}/research-runs`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          researchRunId: "research_run_route",
          researchTaskId: "research_task_route",
          allowlistId,
          connectorId: "public_search",
          sourceCategory: "public_web",
          researchObjective: "Find public onboarding proof for founder validation tools.",
          productCategory: "Founder workflow assistant",
          customerProblemHypothesis: "Early founders need safer validation research.",
          contextHash: "ctx_research_run_route",
          sourceRefs: ["queue_item_run_route"]
        })
      });
      const startRunBody = await jsonBody(startRun);
      const startRunData = startRunBody.data as Readonly<Record<string, unknown>>;
      const startResult = startRunData.immediateProjection as Readonly<Record<string, unknown>>;
      const startedRun = startResult.researchRun as ResearchRunProjection;
      const statusUrl = startRunData.statusUrl as string;

      expect(startRun.status).toBe(200);
      expect(startRunData).toMatchObject({
        category: "accepted_with_projection",
        statusUrl: `/api/v1/projects/${projectId}/research-runs/research_run_route/status`,
        projectionHints: [
          {
            projectionKind: "ResearchRunProjection",
            refetchUrl: `/api/v1/projects/${projectId}/research-runs/research_run_route/status`
          }
        ],
        deterministicOutputs: [
          expect.objectContaining({
            payload: expect.objectContaining({
              commandType: "StartResearchRun",
              sseEventHints: ["projection.updated"],
              externalMutationPerformed: false
            })
          })
        ]
      });
      expect(startResult).toMatchObject({
        kind: "ResearchRunControlResult",
        action: "start",
        status: "started",
        disclosureLog: expect.objectContaining({
          status: "automatic_payload_ready",
          automaticExternalTransferAllowed: true
        }),
        recovery: {
          refetchUrl: `/api/v1/projects/${projectId}/research-runs/research_run_route/status`,
          sseEventNames: ["projection.updated"]
        }
      });
      expect(startedRun).toMatchObject({
        researchRunId: "research_run_route",
        status: "running",
        provider: {
          adapterKind: "local_fake_readonly",
          providerRunId: "fake_readonly_research_run_route",
          attempt: 1
        }
      });

      const status = await storageApp.request(statusUrl, { headers: authHeaders() });
      const statusBody = await jsonBody(status);

      expect(status.status).toBe(200);
      expect(statusBody.data).toMatchObject({
        kind: "ResearchRunControlProjection",
        selectedRun: {
          researchRunId: "research_run_route",
          status: "running"
        },
        recovery: {
          projectionHints: [
            {
              projectionKind: "ResearchRunProjection",
              refetchUrl: statusUrl
            }
          ]
        }
      });

      const cancel = await storageApp.request(`/api/v1/projects/${projectId}/research-runs/research_run_route/cancel`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          researchRunId: "research_run_route",
          reason: "User cancelled after provider start."
        })
      });
      const cancelBody = await jsonBody(cancel);
      const cancelData = cancelBody.data as Readonly<Record<string, unknown>>;
      const cancelResult = cancelData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(cancel.status).toBe(200);
      expect(cancelResult).toMatchObject({
        action: "cancel",
        status: "cancel_requested",
        researchRun: {
          researchRunId: "research_run_route",
          status: "cancel_requested"
        }
      });

      const retrySourceStart = await storageApp.request(`/api/v1/projects/${projectId}/research-runs`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          researchRunId: "research_run_failed_source",
          researchTaskId: "research_task_retry_route",
          allowlistId,
          connectorId: "public_search",
          sourceCategory: "public_web",
          researchObjective: "Find public onboarding proof for retry behavior.",
          productCategory: "Founder workflow assistant",
          customerProblemHypothesis: "Early founders need safer validation research.",
          contextHash: "ctx_research_run_retry_route",
          sourceRefs: ["queue_item_retry_route"]
        })
      });
      const retrySourceBody = await jsonBody(retrySourceStart);
      const retrySourceData = retrySourceBody.data as Readonly<Record<string, unknown>>;
      const retrySourceResult = retrySourceData.immediateProjection as Readonly<Record<string, unknown>>;
      const retrySourceRun = retrySourceResult.researchRun as ResearchRunProjection;
      const repository = createResearchRunRepository(storage.db);
      const failedRun = {
        ...retrySourceRun,
        version: 3 as ProjectionVersion,
        status: "failed",
        provider: {
          ...retrySourceRun.provider,
          completedAt: "2026-05-06T00:10:00.000Z"
        },
        terminalReason: "timeout",
        updatedAt: "2026-05-06T00:10:00.000Z"
      } satisfies ResearchRunProjection;

      await repository.update({
        run: failedRun,
        expectedVersion: 2 as ProjectionVersion,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      const retry = await storageApp.request(`/api/v1/projects/${projectId}/research-runs/research_run_failed_source/retry`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          researchRunId: "research_run_failed_source",
          retryReason: "Retry after provider timeout.",
          contextHash: "ctx_research_run_retry_route"
        })
      });
      const retryBody = await jsonBody(retry);
      const retryData = retryBody.data as Readonly<Record<string, unknown>>;
      const retryResult = retryData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(retry.status).toBe(200);
      expect(retryResult).toMatchObject({
        action: "retry",
        status: "retry_started",
        retryAfterSeconds: 30,
        priorFailure: {
          researchRunId: "research_run_failed_source",
          terminalReason: "timeout",
          status: "failed",
          disclosureSummary: expect.stringContaining("Product category")
        },
        researchRun: {
          status: "running",
          retryOfRunId: "research_run_failed_source",
          retryReason: "Retry after provider timeout.",
          provider: {
            attempt: 2,
            idempotencyKey: expect.stringContaining("attempt=2")
          }
        }
      });

      const list = await storageApp.request(`/api/v1/projects/${projectId}/research-runs`, { headers: authHeaders() });
      const listBody = await jsonBody(list);

      expect(list.status).toBe(200);
      expect(listBody.data).toMatchObject({
        runs: [
          expect.objectContaining({ researchRunId: "research_run_route", status: "cancel_requested" }),
          expect.objectContaining({ researchRunId: "research_run_failed_source", status: "failed" }),
          expect.objectContaining({ retryOfRunId: "research_run_failed_source", status: "running" })
        ]
      });
    } finally {
      await storage.close();
    }
  });

  it("returns an existing research run for duplicate starts before applying rate budget blockers", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    async function postStart(projectId: string, body: Readonly<Record<string, unknown>>) {
      return storageApp.request(`/api/v1/projects/${projectId}/research-runs`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
    }

    try {
      const { projectId } = await createProjectForTest(storageApp, "A duplicate research run start test idea");
      const allowlistId = "research_allowlist_idempotent_run";
      const startBody = {
        researchTaskId: "research_task_idempotent",
        allowlistId,
        connectorId: "public_search",
        sourceCategory: "public_web",
        researchObjective: "Find public onboarding proof for idempotent start behavior.",
        productCategory: "Founder workflow assistant",
        customerProblemHypothesis: "Early founders need safe duplicate retry recovery.",
        contextHash: "ctx_research_run_idempotent",
        sourceRefs: ["queue_item_idempotent"]
      };

      await createAllowlistForTest(storageApp, projectId, allowlistId, {
        rateBudgetPolicy: {
          maxConcurrentRunsPerProject: 1,
          maxRunsPerSession: 12,
          maxAutomaticRetriesPerRun: 2,
          runTimeoutSeconds: 600,
          retryBackoffSeconds: [30, 120]
        }
      });

      const first = await postStart(projectId, startBody);
      const firstBody = await jsonBody(first);
      const firstData = firstBody.data as Readonly<Record<string, unknown>>;
      const firstResult = firstData.immediateProjection as Readonly<Record<string, unknown>>;
      const firstRun = firstResult.researchRun as ResearchRunProjection;

      expect(first.status).toBe(200);
      expect(firstResult).toMatchObject({
        action: "start",
        status: "started",
        researchRun: {
          status: "running"
        }
      });

      const duplicate = await postStart(projectId, startBody);
      const duplicateBody = await jsonBody(duplicate);
      const duplicateData = duplicateBody.data as Readonly<Record<string, unknown>>;
      const duplicateResult = duplicateData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(duplicate.status).toBe(200);
      expect(duplicateData).toMatchObject({
        category: "accepted_with_projection"
      });
      expect(duplicateResult).toMatchObject({
        action: "start",
        status: "started",
        researchRun: {
          researchRunId: firstRun.researchRunId,
          status: "running"
        }
      });
      expect(duplicateResult).not.toHaveProperty("blocker");

      const conflicting = await postStart(projectId, {
        ...startBody,
        researchTaskId: "research_task_rate_budget_conflict",
        researchObjective: "Find public onboarding proof for a second concurrent run.",
        contextHash: "ctx_research_run_rate_budget_conflict"
      });
      const conflictingBody = await jsonBody(conflicting);

      expect(conflicting.status).toBe(200);
      expect(conflictingBody.data).toMatchObject({
        category: "blocked",
        immediateProjection: {
          status: "blocked_precondition",
          blocker: {
            code: "rate_budget_exhausted"
          }
        }
      });

      const runRows = await storage.client.execute("SELECT id FROM research_runs");
      const disclosureRows = await storage.client.execute("SELECT id FROM research_disclosure_logs");

      expect(runRows.rows).toHaveLength(1);
      expect(disclosureRows.rows).toHaveLength(2);
    } finally {
      await storage.close();
    }
  });

  it("keeps manual retry idempotent while enforcing rate budget for new retry attempts", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    async function postStart(projectId: string, body: Readonly<Record<string, unknown>>) {
      return storageApp.request(`/api/v1/projects/${projectId}/research-runs`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
    }

    async function postRetry(projectId: string, researchRunId: string, body: Readonly<Record<string, unknown>>) {
      return storageApp.request(`/api/v1/projects/${projectId}/research-runs/${researchRunId}/retry`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
    }

    try {
      const { projectId } = await createProjectForTest(storageApp, "A manual retry idempotency and budget test idea");
      const allowlistId = "research_allowlist_retry_budget";

      await createAllowlistForTest(storageApp, projectId, allowlistId, {
        rateBudgetPolicy: {
          maxConcurrentRunsPerProject: 1,
          maxRunsPerSession: 12,
          maxAutomaticRetriesPerRun: 2,
          runTimeoutSeconds: 600,
          retryBackoffSeconds: [30, 120]
        }
      });

      const sourceStart = await postStart(projectId, {
        researchRunId: "research_run_retry_source",
        researchTaskId: "research_task_retry_source",
        allowlistId,
        connectorId: "public_search",
        sourceCategory: "public_web",
        researchObjective: "Find public onboarding proof for manual retry idempotency.",
        productCategory: "Founder workflow assistant",
        customerProblemHypothesis: "Early founders need safe retry recovery.",
        contextHash: "ctx_research_run_retry_source",
        sourceRefs: ["queue_item_retry_source"]
      });
      const sourceStartBody = await jsonBody(sourceStart);
      const sourceStartData = sourceStartBody.data as Readonly<Record<string, unknown>>;
      const sourceStartResult = sourceStartData.immediateProjection as Readonly<Record<string, unknown>>;
      const sourceRun = sourceStartResult.researchRun as ResearchRunProjection;
      const repository = createResearchRunRepository(storage.db);
      const failedSourceRun = {
        ...sourceRun,
        version: (Number(sourceRun.version) + 1) as ProjectionVersion,
        status: "failed",
        provider: {
          ...sourceRun.provider,
          completedAt: "2026-05-06T00:10:00.000Z"
        },
        terminalReason: "timeout",
        updatedAt: "2026-05-06T00:10:00.000Z"
      } satisfies ResearchRunProjection;

      const savedFailedSourceRun = await repository.update({
        run: failedSourceRun,
        expectedVersion: sourceRun.version,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      expect(savedFailedSourceRun).not.toBeNull();

      const retryBody = {
        researchRunId: "research_run_retry_source",
        retryReason: "Retry after provider timeout.",
        contextHash: "ctx_research_run_retry_source"
      };
      const retry = await postRetry(projectId, "research_run_retry_source", retryBody);
      const retryResponseBody = await jsonBody(retry);
      const retryData = retryResponseBody.data as Readonly<Record<string, unknown>>;
      const retryResult = retryData.immediateProjection as Readonly<Record<string, unknown>>;
      const attemptTwoRun = retryResult.researchRun as ResearchRunProjection;

      expect(retry.status).toBe(200);
      expect(retryResult).toMatchObject({
        action: "retry",
        status: "retry_started",
        researchRun: {
          retryOfRunId: "research_run_retry_source",
          status: "running",
          provider: {
            attempt: 2
          }
        }
      });

      const duplicateRetry = await postRetry(projectId, "research_run_retry_source", retryBody);
      const duplicateRetryBody = await jsonBody(duplicateRetry);
      const duplicateRetryData = duplicateRetryBody.data as Readonly<Record<string, unknown>>;
      const duplicateRetryResult = duplicateRetryData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(duplicateRetry.status).toBe(200);
      expect(duplicateRetryResult).toMatchObject({
        action: "retry",
        status: "retry_started",
        researchRun: {
          researchRunId: attemptTwoRun.researchRunId,
          status: "running",
          provider: {
            attempt: 2
          }
        }
      });
      expect(duplicateRetryResult).not.toHaveProperty("blocker");

      const rowsAfterDuplicate = await storage.client.execute("SELECT id FROM research_runs");

      expect(rowsAfterDuplicate.rows).toHaveLength(2);

      const failedAttemptTwoRun = {
        ...attemptTwoRun,
        version: (Number(attemptTwoRun.version) + 1) as ProjectionVersion,
        status: "failed",
        provider: {
          ...attemptTwoRun.provider,
          completedAt: "2026-05-06T00:20:00.000Z"
        },
        terminalReason: "timeout",
        updatedAt: "2026-05-06T00:20:00.000Z"
      } satisfies ResearchRunProjection;

      const savedFailedAttemptTwoRun = await repository.update({
        run: failedAttemptTwoRun,
        expectedVersion: attemptTwoRun.version,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      expect(savedFailedAttemptTwoRun).not.toBeNull();

      const terminalDuplicateRetry = await postRetry(projectId, "research_run_retry_source", retryBody);
      const terminalDuplicateRetryBody = await jsonBody(terminalDuplicateRetry);
      const terminalDuplicateRetryData = terminalDuplicateRetryBody.data as Readonly<Record<string, unknown>>;
      const terminalDuplicateRetryResult =
        terminalDuplicateRetryData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(terminalDuplicateRetry.status).toBe(200);
      expect(terminalDuplicateRetryResult).toMatchObject({
        action: "retry",
        status: "status",
        researchRun: {
          researchRunId: attemptTwoRun.researchRunId,
          status: "failed",
          provider: {
            attempt: 2
          }
        }
      });
      expect(terminalDuplicateRetryResult).not.toHaveProperty("retryAfterSeconds");
      expect(terminalDuplicateRetryData.deterministicOutputs).toEqual([
        expect.objectContaining({
          payload: expect.objectContaining({
            providerExecution: false
          })
        })
      ]);

      const attemptThreeRetry = await postRetry(projectId, attemptTwoRun.researchRunId, {
        researchRunId: attemptTwoRun.researchRunId,
        retryReason: "Retry the failed second attempt.",
        contextHash: "ctx_research_run_retry_attempt_three"
      });
      const attemptThreeRetryBody = await jsonBody(attemptThreeRetry);
      const attemptThreeRetryData = attemptThreeRetryBody.data as Readonly<Record<string, unknown>>;
      const attemptThreeRetryResult = attemptThreeRetryData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(attemptThreeRetry.status).toBe(200);
      expect(attemptThreeRetryResult).toMatchObject({
        action: "retry",
        status: "retry_started",
        researchRun: {
          retryOfRunId: attemptTwoRun.researchRunId,
          status: "running",
          provider: {
            attempt: 3
          }
        }
      });

      const savedBudgetBlockedPriorRun = await repository.create({
        run: {
          ...failedSourceRun,
          version: 1 as ProjectionVersion,
          researchRunId: "research_run_retry_budget_blocked" as ResearchRunProjection["researchRunId"],
          researchTaskId: "research_task_retry_budget_blocked" as ResearchRunProjection["researchTaskId"],
          provider: {
            ...failedSourceRun.provider,
            researchRunId: "research_run_retry_budget_blocked" as ResearchRunProjection["researchRunId"],
            researchTaskId: "research_task_retry_budget_blocked" as ResearchRunProjection["researchTaskId"],
            providerRunId: "fake_readonly_research_run_retry_budget_blocked",
            idempotencyKey:
              "research-run:v1:objective=Budget+blocked:connector=public_search:context=ctx_retry_budget_blocked:allowlistVersion=1:attempt=1",
            startedAt: "2026-05-06T00:30:00.000Z",
            completedAt: "2026-05-06T00:31:00.000Z",
            attempt: 1
          },
          createdAt: "2026-05-06T00:30:00.000Z",
          updatedAt: "2026-05-06T00:31:00.000Z"
        } satisfies ResearchRunProjection,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      expect(savedBudgetBlockedPriorRun).not.toBeNull();

      const budgetBlockedRetry = await postRetry(projectId, "research_run_retry_budget_blocked", {
        researchRunId: "research_run_retry_budget_blocked",
        retryReason: "Retry should respect the active retry budget.",
        contextHash: "ctx_retry_budget_blocked"
      });
      const budgetBlockedRetryBody = await jsonBody(budgetBlockedRetry);

      expect(budgetBlockedRetry.status).toBe(200);
      expect(budgetBlockedRetryBody.data).toMatchObject({
        category: "blocked",
        immediateProjection: {
          action: "retry",
          status: "blocked_precondition",
          researchRun: {
            researchRunId: "research_run_retry_budget_blocked",
            status: "failed"
          },
          blocker: {
            code: "rate_budget_exhausted"
          }
        }
      });

      const rowsAfterBudgetBlock = await storage.client.execute(
        "SELECT id FROM research_runs WHERE retry_of_run_id = 'research_run_retry_budget_blocked'"
      );

      expect(rowsAfterBudgetBlock.rows).toHaveLength(0);
    } finally {
      await storage.close();
    }
  });

  it("blocks research run start when allowlist state or public-safe preconditions are not satisfied", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    async function postStart(projectId: string, body: Readonly<Record<string, unknown>>) {
      return storageApp.request(`/api/v1/projects/${projectId}/research-runs`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          researchTaskId: "research_task_blocked",
          connectorId: "public_search",
          sourceCategory: "public_web",
          researchObjective: "Find public evidence.",
          contextHash: "ctx_blocked_run",
          ...body
        })
      });
    }

    try {
      const { projectId } = await createProjectForTest(storageApp, "A research run blocker route test idea");
      const missing = await postStart(projectId, {});
      const missingBody = await jsonBody(missing);

      expect(missing.status).toBe(200);
      expect(missingBody.data).toMatchObject({
        category: "blocked",
        immediateProjection: {
          status: "blocked_manual_handoff",
          blocker: {
            code: "allowlist_or_context_blocked"
          }
        }
      });

      await createAllowlistForTest(storageApp, projectId, "research_allowlist_paused_run");
      await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists/research_allowlist_paused_run/pause`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          reason: "Pause before automatic run start."
        })
      });

      const paused = await postStart(projectId, { allowlistId: "research_allowlist_paused_run" });
      const pausedBody = await jsonBody(paused);

      expect(paused.status).toBe(200);
      expect(pausedBody.data).toMatchObject({
        category: "blocked",
        immediateProjection: {
          status: "blocked_manual_handoff",
          manualHandoff: {
            route: "task_level_approval_or_manual_handoff"
          }
        }
      });

      await createAllowlistForTest(storageApp, projectId, "research_allowlist_stale_run");
      const malformedFreshness = await postStart(projectId, {
        allowlistId: "research_allowlist_stale_run",
        taskFreshnessDeadline: "not-a-date"
      });
      const malformedFreshnessBody = await jsonBody(malformedFreshness);

      expect(malformedFreshness.status).toBe(400);
      expect(malformedFreshnessBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "taskFreshnessDeadline must be an ISO timestamp."
      });

      const malformedSourceTimestamp = await postStart(projectId, {
        allowlistId: "research_allowlist_stale_run",
        sourcePublishedAt: "not-a-date"
      });
      const malformedSourceTimestampBody = await jsonBody(malformedSourceTimestamp);

      expect(malformedSourceTimestamp.status).toBe(400);
      expect(malformedSourceTimestampBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "sourcePublishedAt must be an ISO timestamp."
      });

      const stale = await postStart(projectId, {
        allowlistId: "research_allowlist_stale_run",
        taskFreshnessDeadline: "2026-05-05T00:00:00.000Z"
      });
      const staleBody = await jsonBody(stale);

      expect(stale.status).toBe(200);
      expect(staleBody.data).toMatchObject({
        category: "blocked",
        immediateProjection: {
          status: "blocked_precondition",
          blocker: {
            code: "staleness_policy_failed"
          }
        }
      });

      const rows = await storage.client.execute("SELECT * FROM research_runs");

      expect(rows.rows).toHaveLength(0);
    } finally {
      await storage.close();
    }
  });

  it("rejects secret-like disclosure connector ids before they can be stored in the disclosure log", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A disclosure connector secret guard test idea",
          localPrivacyMode: "local_only"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const projectId = sessionProjection.projectId as string;
      const rejected = await storageApp.request(`/api/v1/projects/${projectId}/research-disclosures`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          connectorId: "sk-secret-token-value",
          sourceCategory: "public_web",
          researchObjective: "Find public onboarding evidence."
        })
      });
      const rejectedBody = await jsonBody(rejected);

      expect(rejected.status).toBe(400);
      expect(rejectedBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "connectorIds must not contain secret-like values."
      });

      const rows = await storage.client.execute("SELECT connector_id FROM research_disclosure_logs");

      expect(rows.rows).toHaveLength(0);
      expect(JSON.stringify(rows.rows)).not.toContain("sk-secret-token-value");
    } finally {
      await storage.close();
    }
  });

  it("normalizes allowlist governance ownership and source-category failures", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const missingProject = await storageApp.request("/api/v1/projects/proj_missing/research-allowlists", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          connectorIds: ["public_search"],
          sourceCategories: ["public_web"],
          approvedBy: "owner_route_test"
        })
      });
      const missingProjectBody = await jsonBody(missingProject);

      expect(missingProject.status).toBe(404);
      expect(missingProjectBody.error?.code).toBe("RESOURCE_NOT_FOUND");

      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A route failure normalization test idea",
          localPrivacyMode: "local_only"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const projectId = sessionProjection.projectId as string;
      const mismatchedProject = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          projectId: "proj_wrong",
          connectorIds: ["public_search"],
          sourceCategories: ["public_web"],
          approvedBy: "owner_route_test"
        })
      });
      const mismatchedProjectBody = await jsonBody(mismatchedProject);

      expect(mismatchedProject.status).toBe(400);
      expect(mismatchedProjectBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "projectId must match the route param."
      });

      const unsupportedSource = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          connectorIds: ["public_search"],
          sourceCategories: ["credentialed_source"],
          approvedBy: "owner_route_test"
        })
      });
      const unsupportedSourceBody = await jsonBody(unsupportedSource);

      expect(unsupportedSource.status).toBe(400);
      expect(unsupportedSourceBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: expect.stringContaining("Unsupported source categories")
      });

      const create = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          allowlistId: "research_allowlist_policy_approval",
          connectorIds: ["public_search"],
          sourceCategories: ["public_web"],
          approvedBy: "owner_route_test"
        })
      });

      expect(create.status).toBe(200);

      const duplicateCreate = await storageApp.request(`/api/v1/projects/${projectId}/research-allowlists`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          allowlistId: "research_allowlist_policy_approval",
          connectorIds: ["public_search"],
          sourceCategories: ["public_web"],
          approvedBy: "owner_route_test"
        })
      });
      const duplicateCreateBody = await jsonBody(duplicateCreate);

      expect(duplicateCreate.status).toBe(400);
      expect(duplicateCreateBody.error).toMatchObject({
        code: "COMMAND_PRECONDITION_FAILED",
        message: "Research allowlist already exists for this project."
      });

      const invalidLifecycleReason = await storageApp.request(
        `/api/v1/projects/${projectId}/research-allowlists/research_allowlist_policy_approval/pause`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            reason: 123
          })
        }
      );
      const invalidLifecycleReasonBody = await jsonBody(invalidLifecycleReason);

      expect(invalidLifecycleReason.status).toBe(400);
      expect(invalidLifecycleReasonBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "reason must be a non-empty string."
      });

      const mismatchedLifecycleBody = await storageApp.request(
        `/api/v1/projects/${projectId}/research-allowlists/research_allowlist_policy_approval/pause`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            allowlistId: "research_allowlist_wrong"
          })
        }
      );
      const mismatchedLifecycleBodyError = await jsonBody(mismatchedLifecycleBody);

      expect(mismatchedLifecycleBody.status).toBe(400);
      expect(mismatchedLifecycleBodyError.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "allowlistId must match the route param."
      });

      const emptyUpdate = await storageApp.request(
        `/api/v1/projects/${projectId}/research-allowlists/research_allowlist_policy_approval`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        }
      );
      const emptyUpdateBody = await jsonBody(emptyUpdate);

      expect(emptyUpdate.status).toBe(400);
      expect(emptyUpdateBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "UpdateResearchAllowlistRequest must include at least one allowlist update field."
      });

      const approvalOnlyUpdate = await storageApp.request(
        `/api/v1/projects/${projectId}/research-allowlists/research_allowlist_policy_approval`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            approvedBy: "owner_without_policy_change"
          })
        }
      );
      const approvalOnlyUpdateBody = await jsonBody(approvalOnlyUpdate);

      expect(approvalOnlyUpdate.status).toBe(400);
      expect(approvalOnlyUpdateBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "UpdateResearchAllowlistRequest must include at least one allowlist update field."
      });

      const missingUpdateApproval = await storageApp.request(
        `/api/v1/projects/${projectId}/research-allowlists/research_allowlist_policy_approval`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            sourceCategories: ["official_docs"]
          })
        }
      );
      const missingUpdateApprovalBody = await jsonBody(missingUpdateApproval);

      expect(missingUpdateApproval.status).toBe(400);
      expect(missingUpdateApprovalBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "approvedBy is required when updating allowlist policy or activating automatic research."
      });

      const revoke = await storageApp.request(
        `/api/v1/projects/${projectId}/research-allowlists/research_allowlist_policy_approval/revoke`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        }
      );

      expect(revoke.status).toBe(200);

      const updateAfterRevoke = await storageApp.request(
        `/api/v1/projects/${projectId}/research-allowlists/research_allowlist_policy_approval`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            sourceCategories: ["official_docs"],
            approvedBy: "owner_after_revoke"
          })
        }
      );
      const updateAfterRevokeBody = await jsonBody(updateAfterRevoke);

      expect(updateAfterRevoke.status).toBe(400);
      expect(updateAfterRevokeBody.error).toMatchObject({
        code: "COMMAND_PRECONDITION_FAILED",
        message: "Revoked research allowlists are immutable."
      });

      const pauseAfterRevoke = await storageApp.request(
        `/api/v1/projects/${projectId}/research-allowlists/research_allowlist_policy_approval/pause`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        }
      );
      const pauseAfterRevokeBody = await jsonBody(pauseAfterRevoke);

      expect(pauseAfterRevoke.status).toBe(400);
      expect(pauseAfterRevokeBody.error).toMatchObject({
        code: "COMMAND_PRECONDITION_FAILED",
        message: "Revoked research allowlists cannot be paused."
      });
    } finally {
      await storage.close();
    }
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
      const draftData = draftBody.data as Readonly<Record<string, unknown>>;
      const draftProjection = draftData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(draft.status).toBe(200);
      expect(draftBody.data).toMatchObject({
        category: "accepted_with_projection",
        stateVersionAfter: 3
      });
      expect(draftProjection).toMatchObject({
        kind: "LivingSpecProjection",
        title: "초기 제품 스펙 초안: A focused founder brief generator",
        sections: ["Problem", "Target customer", "Value proposition", "Validation risks"],
        sectionCount: 4
      });

      const spec = await storageApp.request(`/api/v1/sessions/${sessionId}/spec`, {
        headers: authHeaders()
      });
      const specBody = await jsonBody(spec);

      expect(spec.status).toBe(200);
      expect(specBody.data).toMatchObject({
        title: "초기 제품 스펙 초안: A focused founder brief generator",
        sections: ["Problem", "Target customer", "Value proposition", "Validation risks"],
        sectionCount: 4
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

      const firstQuestionId = (activeItems[0] as Readonly<Record<string, unknown>>).queueItemId as string;
      const missingQueueItemId = await storageApp.request(`/api/v1/questions/${firstQuestionId}/answers`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 5,
          answer: "This answer is missing the shared contract queueItemId."
        })
      });
      const missingQueueItemIdBody = await jsonBody(missingQueueItemId);

      expect(missingQueueItemId.status).toBe(400);
      expect(missingQueueItemIdBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "queueItemId must be a non-empty string."
      });

      const mismatchedQueueItemId = await storageApp.request(`/api/v1/questions/${firstQuestionId}/answers`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          queueItemId: "queue_wrong",
          expectedStateVersion: 5,
          answer: "This answer must not bind to a different route question."
        })
      });
      const mismatchedQueueItemIdBody = await jsonBody(mismatchedQueueItemId);

      expect(mismatchedQueueItemId.status).toBe(400);
      expect(mismatchedQueueItemIdBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "queueItemId must match the question route param."
      });

      const invalidAnswer = await storageApp.request(`/api/v1/questions/${firstQuestionId}/answers`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          queueItemId: firstQuestionId,
          expectedStateVersion: 5,
          answer: {
            kind: "single_choice"
          }
        })
      });
      const invalidAnswerBody = await jsonBody(invalidAnswer);

      expect(invalidAnswer.status).toBe(400);
      expect(invalidAnswerBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "answer must be a non-empty string."
      });

      const answer = await storageApp.request(`/api/v1/questions/${firstQuestionId}/answers`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          queueItemId: firstQuestionId,
          expectedStateVersion: 5,
          answer: "Paid solo founders need sharper evidence before building the MVP."
        })
      });
      const answerBody = await jsonBody(answer);
      const answerData = answerBody.data as Readonly<Record<string, unknown>>;
      const answeredQueue = answerData.queueProjection as Readonly<Record<string, unknown>>;

      expect(answer.status).toBe(200);
      expect(answerData).toMatchObject({
        category: "accepted_with_projection",
        stateVersionAfter: 7,
        pendingEffectSummary: {
          totalPending: 1,
          byType: {
            research_evidence_effect: 1
          }
        }
      });
      expect(answerData.statusUrl).toEqual(expect.any(String));
      expect(answeredQueue).toMatchObject({
        kind: "DecisionQueueProjection",
        active: expect.arrayContaining([
          expect.objectContaining({
            queueItemId: firstQuestionId,
            state: "answered"
          })
        ]),
        next: expect.arrayContaining([
          expect.objectContaining({
            state: "next"
          })
        ])
      });

      const research = await storageApp.request(`/api/v1/sessions/${sessionId}/research`, {
        headers: authHeaders()
      });
      const researchBody = await jsonBody(research);
      const researchData = researchBody.data as Readonly<Record<string, unknown>>;
      const researchTasks = researchData.tasks as readonly Readonly<Record<string, unknown>>[];
      const researchTaskId = researchTasks[0]?.researchTaskId as string;

      expect(research.status).toBe(200);
      expect(researchData).toMatchObject({
        kind: "ResearchEvidenceProjection",
        proConBalanceStatus: "unknown",
        tasks: [
          expect.objectContaining({
            sourceQueueItemId: firstQuestionId,
            status: "planned"
          })
        ],
        reviewCards: [
          expect.objectContaining({
            state: "pending_manual_result"
          })
        ]
      });

      const answerStatus = await storageApp.request(answerData.statusUrl as string, {
        headers: authHeaders()
      });
      const answerStatusBody = await jsonBody(answerStatus);

      expect(answerStatus.status).toBe(200);
      expect(answerStatusBody.data).toMatchObject({
        commandStatus: "pending",
        projectionHints: [
          {
            projectionKind: "ResearchEvidenceProjection",
            refetchUrl: `/api/v1/sessions/${sessionId}/research`
          }
        ],
        effects: [
          expect.objectContaining({
            effectType: "research_evidence_effect",
            maxAttempts: 2,
            idempotencyKey: `research:${researchTaskId}`
          })
        ]
      });

      const answerCompleteness = await storageApp.request(`/api/v1/sessions/${sessionId}/completeness`, {
        headers: authHeaders()
      });
      const answerCompletenessBody = await jsonBody(answerCompleteness);

      expect(answerCompleteness.status).toBe(200);
      expect(answerCompletenessBody.data).toMatchObject({
        kind: "ConfidenceCompletionProjection",
        version: 7,
        completionCandidate: {
          status: "not_ready"
        },
        gates: expect.arrayContaining([
          expect.objectContaining({
            gateId: "question_debt",
            passed: false
          })
        ])
      });

      const refetchedQueue = await storageApp.request(`/api/v1/sessions/${sessionId}/queue`, {
        headers: authHeaders()
      });
      const refetchedQueueBody = await jsonBody(refetchedQueue);

      expect(refetchedQueue.status).toBe(200);
      expect(refetchedQueueBody.data).toMatchObject({
        active: expect.arrayContaining([
          expect.objectContaining({
            queueItemId: firstQuestionId,
            state: "answered"
          })
        ])
      });

      const secondQuestionId = (activeItems[1] as Readonly<Record<string, unknown>>).queueItemId as string;
      const staleAnswer = await storageApp.request(`/api/v1/questions/${secondQuestionId}/answers`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          queueItemId: secondQuestionId,
          expectedStateVersion: 6,
          answer: "This command carries the pre-answer state version."
        })
      });
      const staleAnswerBody = await jsonBody(staleAnswer);

      expect(staleAnswer.status).toBe(200);
      expect(staleAnswerBody.data).toMatchObject({
        category: "rejected",
        error: {
          code: "STATE_VERSION_CONFLICT"
        }
      });

      const duplicateAnswer = await storageApp.request(`/api/v1/questions/${firstQuestionId}/answers`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          queueItemId: firstQuestionId,
          expectedStateVersion: 7,
          answer: "The answered card cannot be submitted a second time."
        })
      });
      const duplicateAnswerBody = await jsonBody(duplicateAnswer);

      expect(duplicateAnswer.status).toBe(200);
      expect(duplicateAnswerBody.data).toMatchObject({
        category: "rejected",
        error: {
          code: "COMMAND_PRECONDITION_FAILED",
          message: "SubmitAnswer requires an active question card."
        }
      });

      const importResult = await storageApp.request(`/api/v1/research-tasks/${researchTaskId}/results`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          researchTaskId,
          expectedStateVersion: 7,
          result: "Pro: founders report urgency and willingness to pay. Risk: replacement workflows may be good enough.",
          limitationNotes: "Manual import includes both support and risk, but source breadth is still limited."
        })
      });
      const importResultBody = await jsonBody(importResult);
      const importResultData = importResultBody.data as Readonly<Record<string, unknown>>;

      expect(importResult.status).toBe(200);
      expect(importResultData).toMatchObject({
        category: "accepted",
        stateVersionAfter: 8,
        pendingEffectSummary: {
          byType: {
            research_evidence_effect: 1
          }
        }
      });
      expect(importResultData.immediateProjection).toBeUndefined();

      const importedStatus = await storageApp.request(importResultData.statusUrl as string, {
        headers: authHeaders()
      });
      const importedStatusBody = await jsonBody(importedStatus);
      const importedStatusData = importedStatusBody.data as Readonly<Record<string, unknown>>;
      const importedEffects = importedStatusData.effects as readonly Readonly<Record<string, unknown>>[];

      expect(importedStatus.status).toBe(200);
      expect(importedStatusData).toMatchObject({
        commandStatus: "pending"
      });
      expect(importedEffects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            effectType: "research_evidence_effect",
            status: "queued",
            maxAttempts: 2
          })
        ])
      );

      const executorResults = await createProductEngineCommandService(storage).runPendingResearchEvidenceEffects();

      expect(executorResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "succeeded",
            balanceStatus: "balanced"
          })
        ])
      );

      const completedResearch = await storageApp.request(`/api/v1/sessions/${sessionId}/research`, {
        headers: authHeaders()
      });
      const completedResearchBody = await jsonBody(completedResearch);

      expect(completedResearch.status).toBe(200);
      expect(completedResearchBody.data).toMatchObject({
        kind: "ResearchEvidenceProjection",
        proConBalanceStatus: "balanced",
        evidenceMatrices: [
          expect.objectContaining({
            balanceStatus: "balanced",
            decisionBlocked: false
          })
        ]
      });

      const completedQueue = await storageApp.request(`/api/v1/sessions/${sessionId}/queue`, {
        headers: authHeaders()
      });
      const completedQueueBody = await jsonBody(completedQueue);

      expect(completedQueue.status).toBe(200);
      expect(completedQueueBody.data).toMatchObject({
        next: expect.arrayContaining([
          expect.objectContaining({
            state: "next"
          })
        ])
      });

      const completedStatus = await storageApp.request(importResultData.statusUrl as string, {
        headers: authHeaders()
      });
      const completedStatusBody = await jsonBody(completedStatus);
      const completedStatusData = completedStatusBody.data as Readonly<Record<string, unknown>>;
      const completedProjectionHints = completedStatusData.projectionHints as readonly Readonly<Record<string, unknown>>[];
      const completedEffects = completedStatusData.effects as readonly Readonly<Record<string, unknown>>[];

      expect(completedStatus.status).toBe(200);
      expect(completedStatusData).toMatchObject({
        commandStatus: "complete"
      });
      expect(completedProjectionHints).toEqual(
        expect.arrayContaining([
          {
            projectionKind: "ResearchEvidenceProjection",
            refetchUrl: `/api/v1/sessions/${sessionId}/research`
          }
        ])
      );
      expect(importedEffects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            effectType: "research_evidence_effect",
            status: "queued"
          })
        ])
      );
      expect(completedEffects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            effectType: "research_evidence_effect",
            status: "succeeded",
            maxAttempts: 2,
            outputRef: expect.objectContaining({
              refType: "effect_output_json"
            })
          })
        ])
      );
    } finally {
      await storage.close();
    }
  });

  it("rejects untraceable or duplicate PlanResearch commands without leaking DB idempotency errors", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A duplicate research task test idea",
          localPrivacyMode: "local_only"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const untraceable = await storageApp.request(`/api/v1/sessions/${sessionId}/research-tasks`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 1,
          objective: "This research task is missing a source ref"
        })
      });
      const untraceableBody = await jsonBody(untraceable);

      expect(untraceable.status).toBe(400);
      expect(untraceableBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "sourceQueueItemId is required for PlanResearch traceability."
      });

      const planRequest = {
        expectedStateVersion: 1,
        objective: "Validate paid founder urgency",
        sourceQueueItemId: "queue_traceable_research",
        impact: "high"
      };
      const firstPlan = await storageApp.request(`/api/v1/sessions/${sessionId}/research-tasks`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(planRequest)
      });
      const firstPlanBody = await jsonBody(firstPlan);
      const duplicatePlan = await storageApp.request(`/api/v1/sessions/${sessionId}/research-tasks`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...planRequest,
          expectedStateVersion: 2
        })
      });
      const duplicatePlanBody = await jsonBody(duplicatePlan);

      expect(firstPlan.status).toBe(200);
      expect(firstPlanBody.data).toMatchObject({
        category: "accepted_with_projection",
        stateVersionAfter: 2
      });
      expect(duplicatePlan.status).toBe(200);
      expect(duplicatePlanBody.data).toMatchObject({
        category: "rejected",
        error: {
          code: "IDEMPOTENCY_CONFLICT"
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("exposes runtime status and creates manual handoff RuntimePreviewArtifact without Codex execution", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A runtime handoff test idea",
          localPrivacyMode: "local_only"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const status = await storageApp.request("/api/v1/runtime/status", {
        headers: authHeaders()
      });
      const statusBody = await jsonBody(status);

      expect(status.status).toBe(200);
      expect(statusBody.data).toMatchObject({
        status: "available",
        adapterVersion: "codex-app-server-preview-v1",
        generatedSchemaVersion: "codex-cli-0.128.0",
        transport: "stdio",
        manualHandoffAvailable: true
      });

      const handoff = await storageApp.request("/api/v1/runtime/manual-handoff", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 1,
          turnPurpose: "research_prompt",
          contextHash: "ctx_manual_research_prompt",
          prompt: "Draft a skeptical research prompt for the founder.",
          sourceRefs: ["research_task_manual"],
          targetObject: "ResearchTask"
        })
      });
      const handoffBody = await jsonBody(handoff);
      const handoffData = handoffBody.data as Readonly<Record<string, unknown>>;
      const runtimeProjection = handoffData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(handoff.status).toBe(200);
      expect(handoffData).toMatchObject({
        category: "accepted_with_projection",
        stateVersionAfter: 2
      });
      expect(runtimeProjection).toMatchObject({
        kind: "RuntimeActivityProjection",
        runtimeStatus: "unavailable",
        runtimeArtifacts: [
          expect.objectContaining({
            turnPurpose: "research_prompt",
            kind: "ResearchPromptArtifact",
            applyPolicy: "manual_handoff_required",
            status: "manual_handoff",
            source: "manual_prompt_handoff"
          })
        ]
      });

      const activity = await storageApp.request(`/api/v1/sessions/${sessionId}/activity`, {
        headers: authHeaders()
      });
      const activityBody = await jsonBody(activity);

      expect(activity.status).toBe(200);
      expect(activityBody.data).toMatchObject({
        kind: "RuntimeActivityProjection",
        runtimeStatus: "unavailable",
        runtimeArtifacts: [
          expect.objectContaining({
            contextHash: "ctx_manual_research_prompt"
          })
        ]
      });
    } finally {
      await storage.close();
    }
  });

  it("blocks an existing runtime artifact through the block route without executing it", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A runtime artifact block route test idea",
          localPrivacyMode: "local_only"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const handoff = await storageApp.request("/api/v1/runtime/manual-handoff", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 1,
          turnPurpose: "implementation_plan_preview",
          contextHash: "ctx_block_existing_artifact",
          prompt: "Prepare a planning handoff but do not execute it.",
          sourceRefs: ["spec_current"],
          targetObject: "PlanningNote"
        })
      });
      const handoffBody = await jsonBody(handoff);
      const handoffData = handoffBody.data as Readonly<Record<string, unknown>>;
      const runtimeProjection = handoffData.immediateProjection as Readonly<Record<string, unknown>>;
      const artifacts = runtimeProjection.runtimeArtifacts as readonly Readonly<Record<string, unknown>>[];
      const artifactId = artifacts[0]?.artifactId as string;

      const block = await storageApp.request(`/api/v1/runtime/artifacts/${artifactId}/block`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          artifactId,
          expectedStateVersion: 2,
          blockedActionType: "destructive_operation",
          reason: "Manual safety review blocked this preview before any execution."
        })
      });
      const blockBody = await jsonBody(block);
      const blockData = blockBody.data as Readonly<Record<string, unknown>>;
      const blockProjection = blockData.immediateProjection as Readonly<Record<string, unknown>>;

      expect(block.status).toBe(200);
      expect(blockData).toMatchObject({
        category: "blocked",
        stateVersionAfter: 3
      });
      expect(blockProjection).toMatchObject({
        kind: "RuntimeActivityProjection",
        runtimeStatus: "blocked",
        runtimeArtifacts: [
          expect.objectContaining({
            artifactId,
            kind: "BlockedActionArtifact",
            applyPolicy: "blocked",
            status: "blocked",
            targetObject: "blocked_action",
            blockedAction: {
              actionType: "destructive_operation",
              reason: "Manual safety review blocked this preview before any execution."
            }
          })
        ]
      });
      expect(blockData.queueProjection).toMatchObject({
        blocked: [
          expect.objectContaining({
            state: "blocked",
            queueItemId: `runtime_preview_${artifactId}`
          })
        ]
      });

      const queue = await storageApp.request(`/api/v1/sessions/${sessionId}/queue`, {
        headers: authHeaders()
      });
      const queueBody = await jsonBody(queue);

      expect(queueBody.data).toMatchObject({
        blocked: [
          expect.objectContaining({
            state: "blocked",
            queueItemId: `runtime_preview_${artifactId}`
          })
        ]
      });

      const completeness = await storageApp.request(`/api/v1/sessions/${sessionId}/completeness`, {
        headers: authHeaders()
      });
      const completenessBody = await jsonBody(completeness);

      expect(completeness.status).toBe(200);
      expect(completenessBody.data).toMatchObject({
        kind: "ConfidenceCompletionProjection",
        completionCandidate: {
          status: "not_ready"
        },
        gates: expect.arrayContaining([
          expect.objectContaining({
            gateId: "blocking_incidents",
            passed: false
          })
        ]),
        topRiskCards: expect.arrayContaining([
          expect.objectContaining({
            severity: "high",
            sourceRefs: expect.arrayContaining([artifactId])
          })
        ])
      });

      const convertAgain = await storageApp.request(`/api/v1/runtime/artifacts/${artifactId}/convert`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          artifactId,
          expectedStateVersion: 3,
          target: "ExecutionPlan"
        })
      });
      const convertAgainBody = await jsonBody(convertAgain);
      const convertAgainData = convertAgainBody.data as Readonly<Record<string, unknown>>;

      expect(convertAgain.status).toBe(200);
      expect(convertAgainData).toMatchObject({
        category: "blocked",
        stateVersionAfter: 4
      });
    } finally {
      await storage.close();
    }
  });

  it("rejects runtime preview requests without traceable sourceRefs", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const missingSourceRefs = await storageApp.request("/api/v1/runtime/codex/preview", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId: "sess_missing_source_refs",
          expectedStateVersion: 1,
          turnPurpose: "spec_update_preview",
          contextHash: "ctx_missing_source_refs",
          prompt: "Preview a spec update."
        })
      });
      const missingBody = await jsonBody(missingSourceRefs);
      const emptySourceRefs = await storageApp.request("/api/v1/runtime/manual-handoff", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId: "sess_empty_source_refs",
          expectedStateVersion: 1,
          turnPurpose: "research_prompt",
          contextHash: "ctx_empty_source_refs",
          prompt: "Draft a handoff prompt.",
          sourceRefs: []
        })
      });
      const emptyBody = await jsonBody(emptySourceRefs);

      expect(missingSourceRefs.status).toBe(400);
      expect(missingBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "sourceRefs must include at least one trace reference."
      });
      expect(emptySourceRefs.status).toBe(400);
      expect(emptyBody.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "sourceRefs must include at least one trace reference."
      });
    } finally {
      await storage.close();
    }
  });

  it("mounts PR-08 completeness scoring and Founder Brief metadata routes without async scoring effects", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A completion route test idea",
          localPrivacyMode: "local_only"
        })
      });
      const startData = (await jsonBody(start)).data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;

      const intake = await storageApp.request(`/api/v1/sessions/${sessionId}/intake`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 1,
          answer: "Help founders produce a stop-now brief with explicit risks."
        })
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
      const score = await storageApp.request(`/api/v1/sessions/${sessionId}/completeness/score`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 3
        })
      });
      const scoreBody = await jsonBody(score);
      const scoreData = scoreBody.data as Readonly<Record<string, unknown>>;
      const confidence = scoreData.immediateProjection as Readonly<Record<string, unknown>>;
      const fetchedCompleteness = await storageApp.request(`/api/v1/sessions/${sessionId}/completeness`, {
        headers: authHeaders()
      });
      const fetchedCompletenessBody = await jsonBody(fetchedCompleteness);
      const candidate = await storageApp.request(`/api/v1/sessions/${sessionId}/completion-candidate`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 4
        })
      });
      const candidateBody = await jsonBody(candidate);
      const candidateData = candidateBody.data as Readonly<Record<string, unknown>>;
      const founderBrief = await storageApp.request(`/api/v1/sessions/${sessionId}/founder-brief/export`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 4,
          requestedFormat: "markdown"
        })
      });
      const founderBriefBody = await jsonBody(founderBrief);
      const founderBriefData = founderBriefBody.data as Readonly<Record<string, unknown>>;
      const founderBriefProjection = founderBriefData.immediateProjection as Readonly<Record<string, unknown>>;
      const fetchedFounderBrief = await storageApp.request(`/api/v1/sessions/${sessionId}/founder-brief`, {
        headers: authHeaders()
      });
      const fileWrite = await storageApp.request(`/api/v1/sessions/${sessionId}/founder-brief/export`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 5,
          fileWriteRequested: true
        })
      });
      const fileWriteBody = await jsonBody(fileWrite);
      const fileWriteData = fileWriteBody.data as Readonly<Record<string, unknown>>;
      const legacyWriteFile = await storageApp.request(`/api/v1/sessions/${sessionId}/founder-brief/export`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 5,
          writeFile: true
        })
      });
      const legacyWriteFileBody = await jsonBody(legacyWriteFile);
      const legacyWriteFileData = legacyWriteFileBody.data as Readonly<Record<string, unknown>>;
      const externalExport = await storageApp.request(`/api/v1/sessions/${sessionId}/founder-brief/export`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 5,
          externalExportRequested: true,
          exportUrl: "https://example.invalid/founder-brief"
        })
      });
      const externalExportBody = await jsonBody(externalExport);
      const externalExportData = externalExportBody.data as Readonly<Record<string, unknown>>;
      const unsupportedFormat = await storageApp.request(`/api/v1/sessions/${sessionId}/founder-brief/export`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedStateVersion: 5,
          requestedFormat: "pdf"
        })
      });
      const unsupportedFormatBody = await jsonBody(unsupportedFormat);
      const unsupportedFormatData = unsupportedFormatBody.data as Readonly<Record<string, unknown>>;

      expect(intake.status).toBe(200);
      expect(draft.status).toBe(200);
      expect(score.status).toBe(200);
      expect(scoreData).toMatchObject({
        category: "accepted_with_projection",
        stateVersionAfter: 4
      });
      expect(scoreData.statusUrl).toBeUndefined();
      expect(confidence).toMatchObject({
        kind: "ConfidenceCompletionProjection",
        completionCandidate: {
          status: "not_ready"
        }
      });
      expect(fetchedCompleteness.status).toBe(200);
      expect(fetchedCompletenessBody.data).toMatchObject({
        kind: "ConfidenceCompletionProjection",
        completionCandidate: {
          status: "not_ready"
        }
      });
      expect(candidate.status).toBe(200);
      expect(candidateData).toMatchObject({
        category: "rejected",
        error: {
          code: "COMMAND_PRECONDITION_FAILED",
          details: {
            completionCandidate: {
              status: "not_ready"
            },
            gates: expect.any(Array),
            topRisks: expect.any(Array)
          }
        }
      });
      expect(founderBrief.status).toBe(200);
      expect(founderBriefProjection).toMatchObject({
        kind: "FounderBriefProjection",
        exportReady: false,
        exportMetadata: {
          writePolicy: "metadata_only_no_file_write"
        }
      });
      expect(fetchedFounderBrief.status).toBe(200);
      expect(fileWrite.status).toBe(200);
      expect(fileWriteData).toMatchObject({
        category: "rejected",
        error: {
          code: "RUNTIME_ACTION_BLOCKED"
        }
      });
      expect(legacyWriteFile.status).toBe(200);
      expect(legacyWriteFileData).toMatchObject({
        category: "rejected",
        error: {
          code: "RUNTIME_ACTION_BLOCKED"
        }
      });
      expect(externalExport.status).toBe(200);
      expect(externalExportData).toMatchObject({
        category: "rejected",
        error: {
          code: "RUNTIME_ACTION_BLOCKED"
        }
      });
      expect(unsupportedFormat.status).toBe(200);
      expect(unsupportedFormatData).toMatchObject({
        category: "rejected",
        error: {
          code: "VALIDATION_FAILED"
        }
      });
    } finally {
      await storage.close();
    }
  });

  it("queues codex runtime preview effects and persists fixture artifacts with durable idempotency", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A runtime fixture test idea",
          localPrivacyMode: "local_only"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const preview = await storageApp.request("/api/v1/runtime/codex/preview", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 1,
          turnPurpose: "implementation_plan_preview",
          contextHash: "ctx_fixture_plan",
          prompt: "Preview an implementation plan without executing it.",
          sourceRefs: ["spec_current"],
          targetObject: "PlanningNote"
        })
      });
      const previewBody = await jsonBody(preview);
      const previewData = previewBody.data as Readonly<Record<string, unknown>>;

      expect(preview.status).toBe(200);
      expect(previewData).toMatchObject({
        category: "accepted",
        stateVersionAfter: 2,
        pendingEffectSummary: {
          byType: {
            codex_runtime_preview_effect: 1
          }
        }
      });
      expect(previewData.statusUrl).toEqual(expect.any(String));

      const queuedStatus = await storageApp.request(previewData.statusUrl as string, {
        headers: authHeaders()
      });
      const queuedStatusBody = await jsonBody(queuedStatus);

      expect(queuedStatusBody.data).toMatchObject({
        commandStatus: "pending",
        projectionHints: [
          {
            projectionKind: "RuntimeActivityProjection",
            refetchUrl: `/api/v1/sessions/${sessionId}/activity`
          }
        ],
        effects: [
          expect.objectContaining({
            effectType: "codex_runtime_preview_effect",
            maxAttempts: 1,
            idempotencyKey: `codex:${sessionId}:implementation_plan_preview:ctx_fixture_plan:codex-app-server-preview-v1`
          })
        ]
      });

      const executorResults = await createProductEngineCommandService(
        storage,
        fixtureCodexRuntimeAdapter
      ).runPendingCodexRuntimePreviewEffects();

      expect(executorResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "succeeded",
            kind: "ImplementationPlanPreviewArtifact"
          })
        ])
      );

      const completedStatus = await storageApp.request(previewData.statusUrl as string, {
        headers: authHeaders()
      });
      const completedStatusBody = await jsonBody(completedStatus);

      expect(completedStatusBody.data).toMatchObject({
        commandStatus: "complete",
        effects: [
          expect.objectContaining({
            effectType: "codex_runtime_preview_effect",
            status: "succeeded",
            outputRef: expect.objectContaining({
              refType: "effect_output_json"
            })
          })
        ]
      });

      const activity = await storageApp.request(`/api/v1/sessions/${sessionId}/activity`, {
        headers: authHeaders()
      });
      const activityBody = await jsonBody(activity);

      expect(activityBody.data).toMatchObject({
        runtimeStatus: "available",
        runtimeArtifacts: [
          expect.objectContaining({
            turnPurpose: "implementation_plan_preview",
            kind: "ImplementationPlanPreviewArtifact",
            source: "protocol_fixture",
            status: "preview_ready"
          })
        ]
      });

      const activityData = activityBody.data as Readonly<Record<string, unknown>>;
      const artifacts = activityData.runtimeArtifacts as readonly Readonly<Record<string, unknown>>[];
      const artifactId = artifacts[0]?.artifactId as string;
      const convert = await storageApp.request(`/api/v1/runtime/artifacts/${artifactId}/convert`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          artifactId,
          expectedStateVersion: 3,
          target: "planning_note"
        })
      });
      const convertBody = await jsonBody(convert);
      const convertData = convertBody.data as Readonly<Record<string, unknown>>;
      const convertEvents = await createEventRepository(storage.db).listForCommand(convertData.commandId as CommandId);

      expect(convert.status).toBe(200);
      expect(convertData).toMatchObject({
        category: "accepted",
        stateVersionAfter: 4
      });
      expect(convertEvents.at(-1)?.payload).toMatchObject({
        conversionStatus: "preview_only",
        target: "planning_note"
      });
    } finally {
      await storage.close();
    }
  });

  it("allows manual handoff and later Codex preview for the same runtime context without DB conflicts", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A cross-source runtime context test idea",
          localPrivacyMode: "local_only"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const commonPayload = {
        sessionId,
        turnPurpose: "implementation_plan_preview",
        contextHash: "ctx_cross_source_runtime",
        prompt: "Prepare a planning preview for the same context.",
        sourceRefs: ["spec_current"],
        targetObject: "PlanningNote"
      };
      const handoff = await storageApp.request("/api/v1/runtime/manual-handoff", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...commonPayload,
          expectedStateVersion: 1
        })
      });
      const handoffBody = await jsonBody(handoff);
      const handoffData = handoffBody.data as Readonly<Record<string, unknown>>;
      const handoffProjection = handoffData.immediateProjection as Readonly<Record<string, unknown>>;
      const handoffArtifacts = handoffProjection.runtimeArtifacts as readonly Readonly<Record<string, unknown>>[];
      const preview = await storageApp.request("/api/v1/runtime/codex/preview", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...commonPayload,
          expectedStateVersion: 2
        })
      });
      const previewBody = await jsonBody(preview);
      const previewData = previewBody.data as Readonly<Record<string, unknown>>;
      const executorResults = await createProductEngineCommandService(
        storage,
        fixtureCodexRuntimeAdapter
      ).runPendingCodexRuntimePreviewEffects();
      const activity = await storageApp.request(`/api/v1/sessions/${sessionId}/activity`, {
        headers: authHeaders()
      });
      const activityBody = await jsonBody(activity);
      const activityData = activityBody.data as Readonly<Record<string, unknown>>;
      const artifacts = activityData.runtimeArtifacts as readonly Readonly<Record<string, unknown>>[];

      expect(preview.status).toBe(200);
      expect(previewData).toMatchObject({
        category: "accepted",
        pendingEffectSummary: {
          byType: {
            codex_runtime_preview_effect: 1
          }
        }
      });
      expect(executorResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "succeeded"
          })
        ])
      );
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]).toMatchObject({
        artifactId: handoffArtifacts[0]?.artifactId,
        source: "protocol_fixture",
        status: "preview_ready"
      });
    } finally {
      await storage.close();
    }
  });

  it("fails Codex runtime preview effects when adapter output does not match the request trace", async () => {
    const mismatchedAdapter = {
      ...fixtureCodexRuntimeAdapter,
      async createPreview(input: Parameters<typeof fixtureCodexRuntimeAdapter.createPreview>[0]) {
        return fixtureCodexPreviewOutput({
          ...input,
          turnPurpose: "research_prompt"
        });
      }
    };
    const { app: storageApp, storage } = await createMigratedStorageApp(mismatchedAdapter);

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A mismatched runtime adapter output test idea",
          localPrivacyMode: "local_only"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const preview = await storageApp.request("/api/v1/runtime/codex/preview", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 1,
          turnPurpose: "spec_update_preview",
          contextHash: "ctx_mismatched_adapter_output",
          prompt: "Preview a spec update with mismatched adapter output.",
          sourceRefs: ["spec_current"],
          targetObject: "SpecUpdate"
        })
      });
      const previewBody = await jsonBody(preview);
      const previewData = previewBody.data as Readonly<Record<string, unknown>>;
      const executorResults = await createProductEngineCommandService(
        storage,
        mismatchedAdapter
      ).runPendingCodexRuntimePreviewEffects();
      const failedStatus = await storageApp.request(previewData.statusUrl as string, {
        headers: authHeaders()
      });
      const failedStatusBody = await jsonBody(failedStatus);
      const activity = await storageApp.request(`/api/v1/sessions/${sessionId}/activity`, {
        headers: authHeaders()
      });
      const activityBody = await jsonBody(activity);

      expect(preview.status).toBe(200);
      expect(executorResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "failed",
            error: "Codex preview output turnPurpose must match the requested turnPurpose."
          })
        ])
      );
      expect(failedStatusBody.data).toMatchObject({
        commandStatus: "failed",
        effects: [
          expect.objectContaining({
            status: "failed",
            error: expect.objectContaining({
              code: "CODEX_RUNTIME_PREVIEW_FAILED"
            })
          })
        ]
      });
      expect(activityBody.data).toMatchObject({
        runtimeStatus: "scaffold_placeholder",
        runtimeArtifacts: []
      });
    } finally {
      await storage.close();
    }
  });

  it("scopes Codex runtime preview idempotency to each session", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const sessionIds: string[] = [];

      for (const rawIdea of ["First same-context session", "Second same-context session"]) {
        const start = await storageApp.request("/api/v1/projects", {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            rawIdea,
            localPrivacyMode: "local_only"
          })
        });
        const startBody = await jsonBody(start);
        const startData = startBody.data as Readonly<Record<string, unknown>>;
        const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;

        sessionIds.push(sessionProjection.sessionId as string);
      }

      for (const sessionId of sessionIds) {
        const preview = await storageApp.request("/api/v1/runtime/codex/preview", {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            sessionId,
            expectedStateVersion: 1,
            turnPurpose: "implementation_plan_preview",
            contextHash: "ctx_shared_across_sessions",
            prompt: "Preview the same context hash in separate sessions.",
            sourceRefs: ["spec_current"],
            targetObject: "PlanningNote"
          })
        });
        const previewBody = await jsonBody(preview);

        expect(preview.status).toBe(200);
        expect(previewBody.data).toMatchObject({
          category: "accepted",
          pendingEffectSummary: {
            byType: {
              codex_runtime_preview_effect: 1
            }
          }
        });
      }
    } finally {
      await storage.close();
    }
  });

  it("falls back to manual handoff when Codex runtime preview execution is unavailable", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();
    const unavailableAdapter = {
      ...fixtureCodexRuntimeAdapter,
      async createPreview() {
        throw new CodexRuntimeUnavailableError("Synthetic Codex app-server unavailable.");
      }
    };

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A runtime unavailable fallback test idea",
          localPrivacyMode: "local_only"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const preview = await storageApp.request("/api/v1/runtime/codex/preview", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 1,
          turnPurpose: "spec_update_preview",
          contextHash: "ctx_unavailable_fallback",
          prompt: "Preview a spec update with unavailable runtime.",
          sourceRefs: ["spec_current"],
          targetObject: "SpecUpdate"
        })
      });
      const previewBody = await jsonBody(preview);
      const previewData = previewBody.data as Readonly<Record<string, unknown>>;
      const executorResults = await createProductEngineCommandService(
        storage,
        unavailableAdapter
      ).runPendingCodexRuntimePreviewEffects();
      const completedStatus = await storageApp.request(previewData.statusUrl as string, {
        headers: authHeaders()
      });
      const completedStatusBody = await jsonBody(completedStatus);
      const activity = await storageApp.request(`/api/v1/sessions/${sessionId}/activity`, {
        headers: authHeaders()
      });
      const activityBody = await jsonBody(activity);

      expect(preview.status).toBe(200);
      expect(executorResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "succeeded",
            fallback: "manual_prompt_handoff"
          })
        ])
      );
      expect(completedStatusBody.data).toMatchObject({
        commandStatus: "complete",
        effects: [
          expect.objectContaining({
            status: "succeeded",
            attemptCount: 1,
            outputRef: expect.objectContaining({
              refType: "effect_output_json"
            })
          })
        ]
      });
      expect(activityBody.data).toMatchObject({
        runtimeStatus: "unavailable",
        runtimeArtifacts: [
          expect.objectContaining({
            source: "manual_prompt_handoff",
            status: "manual_handoff"
          })
        ]
      });

      const retryPreview = await storageApp.request("/api/v1/runtime/codex/preview", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 3,
          turnPurpose: "spec_update_preview",
          contextHash: "ctx_unavailable_fallback",
          prompt: "Preview a spec update with unavailable runtime.",
          sourceRefs: ["spec_current"],
          targetObject: "SpecUpdate"
        })
      });
      const retryBody = await jsonBody(retryPreview);
      const retryData = retryBody.data as Readonly<Record<string, unknown>>;
      const retryResults = await createProductEngineCommandService(
        storage,
        fixtureCodexRuntimeAdapter
      ).runPendingCodexRuntimePreviewEffects();
      const retryActivity = await storageApp.request(`/api/v1/sessions/${sessionId}/activity`, {
        headers: authHeaders()
      });
      const retryActivityBody = await jsonBody(retryActivity);

      expect(retryPreview.status).toBe(200);
      expect(retryData).toMatchObject({
        category: "accepted",
        stateVersionAfter: 4,
        pendingEffectSummary: {
          byType: {
            codex_runtime_preview_effect: 1
          }
        }
      });
      expect(retryResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "succeeded",
            kind: "SpecUpdatePreviewArtifact"
          })
        ])
      );
      expect(retryActivityBody.data).toMatchObject({
        runtimeStatus: "available",
        runtimeArtifacts: [
          expect.objectContaining({
            source: "protocol_fixture",
            status: "preview_ready"
          })
        ]
      });
    } finally {
      await storage.close();
    }
  });

  it("marks Codex runtime preview effects failed after a non-recoverable adapter error", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();
    const failingAdapter = {
      ...fixtureCodexRuntimeAdapter,
      async createPreview() {
        throw new Error("Synthetic non-recoverable Codex preview failure.");
      }
    };

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A runtime failure test idea",
          localPrivacyMode: "local_only"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const preview = await storageApp.request("/api/v1/runtime/codex/preview", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 1,
          turnPurpose: "spec_update_preview",
          contextHash: "ctx_nonrecoverable_failure",
          prompt: "Preview a spec update with generic runtime failure.",
          sourceRefs: ["spec_current"],
          targetObject: "SpecUpdate"
        })
      });
      const previewBody = await jsonBody(preview);
      const previewData = previewBody.data as Readonly<Record<string, unknown>>;
      const executorResults = await createProductEngineCommandService(
        storage,
        failingAdapter
      ).runPendingCodexRuntimePreviewEffects();
      const failedStatus = await storageApp.request(previewData.statusUrl as string, {
        headers: authHeaders()
      });
      const failedStatusBody = await jsonBody(failedStatus);

      expect(preview.status).toBe(200);
      expect(executorResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "failed",
            error: "Synthetic non-recoverable Codex preview failure."
          })
        ])
      );
      expect(failedStatusBody.data).toMatchObject({
        commandStatus: "failed",
        effects: [
          expect.objectContaining({
            status: "failed",
            attemptCount: 1,
            error: expect.objectContaining({
              code: "CODEX_RUNTIME_PREVIEW_FAILED",
              retryAvailable: false
            })
          })
        ]
      });
    } finally {
      await storage.close();
    }
  });

  it("converts forbidden runtime action requests into blocked artifacts and blocked command status", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const start = await storageApp.request("/api/v1/projects", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawIdea: "A runtime blocked action test idea",
          localPrivacyMode: "local_only"
        })
      });
      const startBody = await jsonBody(start);
      const startData = startBody.data as Readonly<Record<string, unknown>>;
      const sessionProjection = startData.immediateProjection as Readonly<Record<string, unknown>>;
      const sessionId = sessionProjection.sessionId as string;
      const blockedPreview = await storageApp.request("/api/v1/runtime/codex/preview", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          expectedStateVersion: 1,
          turnPurpose: "implementation_plan_preview",
          contextHash: "ctx_block_shell",
          prompt: "Suggest a shell command but do not execute it.",
          sourceRefs: ["spec_current"],
          targetObject: "blocked_action",
          requestedActionType: "shell_command",
          requestedActionReason: "The preview suggested running pnpm verify."
        })
      });
      const blockedPreviewBody = await jsonBody(blockedPreview);
      const blockedPreviewData = blockedPreviewBody.data as Readonly<Record<string, unknown>>;
      const executorResults = await createProductEngineCommandService(
        storage,
        fixtureCodexRuntimeAdapter
      ).runPendingCodexRuntimePreviewEffects();

      expect(blockedPreview.status).toBe(200);
      expect(executorResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "blocked",
            blockedActionType: "shell_command"
          })
        ])
      );

      const blockedStatus = await storageApp.request(blockedPreviewData.statusUrl as string, {
        headers: authHeaders()
      });
      const blockedStatusBody = await jsonBody(blockedStatus);

      expect(blockedStatusBody.data).toMatchObject({
        commandStatus: "blocked",
        effects: [
          expect.objectContaining({
            effectType: "codex_runtime_preview_effect",
            status: "blocked",
            outputRef: expect.objectContaining({
              refType: "effect_output_json"
            }),
            error: expect.objectContaining({
              code: "RUNTIME_ACTION_BLOCKED"
            })
          })
        ]
      });

      const activity = await storageApp.request(`/api/v1/sessions/${sessionId}/activity`, {
        headers: authHeaders()
      });
      const activityBody = await jsonBody(activity);

      expect(activityBody.data).toMatchObject({
        runtimeStatus: "blocked",
        runtimeArtifacts: [
          expect.objectContaining({
            kind: "BlockedActionArtifact",
            applyPolicy: "blocked",
            blockedAction: expect.objectContaining({
              actionType: "shell_command"
            })
          })
        ]
      });

      const queue = await storageApp.request(`/api/v1/sessions/${sessionId}/queue`, {
        headers: authHeaders()
      });
      const queueBody = await jsonBody(queue);

      expect(queueBody.data).toMatchObject({
        blocked: [
          expect.objectContaining({
            state: "blocked"
          })
        ]
      });
    } finally {
      await storage.close();
    }
  });

  it("rejects synthesize requests when the body researchResultId does not match the route param", async () => {
    const { app: storageApp, storage } = await createMigratedStorageApp();

    try {
      const response = await storageApp.request("/api/v1/research-results/research_result_path/synthesize", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId: "sess_synthesize_mismatch",
          researchResultId: "research_result_body",
          expectedStateVersion: 1
        })
      });
      const body = await jsonBody(response);

      expect(response.status).toBe(400);
      expect(body.error).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "researchResultId must match the route param."
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
