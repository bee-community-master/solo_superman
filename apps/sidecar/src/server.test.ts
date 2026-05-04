import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";
import { describe, expect, it } from "vitest";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "@solo-superman/db";
import { createProductEngineCommandService } from "./product-engine/command-service";
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
      sidecarPhase: "pr_06_research_evidence_loop",
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
