import { randomUUID, timingSafeEqual } from "node:crypto";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import {
  CONTRACT_SCHEMA_VERSION,
  type ApiErrorCode,
  type ApiErrorEnvelope,
  type ApiResponseMeta,
  type ApiSuccessEnvelope,
  type CommandId,
  type CommandResponse,
  PR05_MOUNTED_PRODUCT_API_ROUTE_IDS,
  type ProjectId,
  type QueueItemId,
  type SessionId,
  type StateVersion,
  type StatusEndpointDto
} from "@solo-superman/contracts";
import type { MigrationStatus, SoloStorage } from "@solo-superman/db";
import { createProductEngineCommandService, ProductEngineServiceError } from "./product-engine/command-service";
import { productApiRoutePlaceholders } from "./routes/catalog";

export interface CreateSidecarAppOptions {
  readonly localCapabilityToken: string;
  readonly migrationStatus?: MigrationStatus;
  readonly storage?: SoloStorage | null;
}

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "localhost"]);
const LOCAL_CORS_ORIGINS = new Set([
  "http://127.0.0.1:1420",
  "http://localhost:1420",
  "http://[::1]:1420",
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost"
]);
function requestMeta(context: Context): ApiResponseMeta {
  const inboundRequestId = context.req.header("x-request-id")?.trim();
  const requestId = inboundRequestId && inboundRequestId.length <= 128 ? inboundRequestId : randomUUID();

  context.header("x-request-id", requestId);

  return {
    requestId,
    schemaVersion: CONTRACT_SCHEMA_VERSION
  };
}

function jsonError(
  context: Context,
  code: ApiErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>
): ApiErrorEnvelope {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(details ? { details } : {})
    },
    meta: requestMeta(context)
  };
}

function jsonSuccess<TData>(context: Context, data: TData): ApiSuccessEnvelope<TData> {
  return {
    ok: true,
    data,
    meta: requestMeta(context)
  };
}

function isPublicHealthPath(path: string) {
  return path === "/healthz" || path === "/readyz";
}

function bearerToken(authorizationHeader: string | undefined) {
  const prefix = "Bearer ";

  if (!authorizationHeader?.startsWith(prefix)) {
    return null;
  }

  return authorizationHeader.slice(prefix.length);
}

function safeTokenEquals(actual: string, expected: string) {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);

  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function isLoopbackAddress(value: string) {
  const firstValue = value.split(",")[0]?.trim();

  return firstValue !== undefined && LOOPBACK_ADDRESSES.has(firstValue);
}

function explicitClientAddress(headers: Headers) {
  return headers.get("x-forwarded-for") ?? headers.get("x-real-ip");
}

function allowedCorsOrigin(origin: string) {
  return LOCAL_CORS_ORIGINS.has(origin) ? origin : null;
}

function commandStatusUnavailableShape(commandId: CommandId): StatusEndpointDto {
  return {
    commandId,
    category: "accepted",
    commandStatus: "pending",
    eventIds: [],
    effects: [],
    pendingEffectSummary: {
      totalPending: 0,
      byType: {},
      visibleLabel: "No persisted command status is mounted before ProductEngine command handling."
    },
    projectionHints: [],
    lastUpdatedAt: new Date(0).toISOString()
  };
}

function defaultMigrationStatus(): MigrationStatus {
  return {
    state: "failed",
    databaseUrl: "not_configured",
    migrationsFolder: "not_configured",
    appliedMigrationCount: 0,
    latestMigrationMillis: null,
    checkedAt: new Date(0).toISOString(),
    errorMessage: "Storage readiness has not been initialized."
  };
}

function publicMigrationStatus(migrationStatus: MigrationStatus) {
  return {
    state: migrationStatus.state,
    appliedMigrationCount: migrationStatus.appliedMigrationCount,
    latestMigrationMillis: migrationStatus.latestMigrationMillis,
    checkedAt: migrationStatus.checkedAt,
    ...(migrationStatus.state === "failed" ? { errorCode: "MIGRATION_FAILED" } : {})
  };
}

function readyzStatus(migrationStatus: MigrationStatus, hasStorage: boolean) {
  const migrations = publicMigrationStatus(migrationStatus);

  if (migrationStatus.state === "failed") {
    return {
      httpStatus: 503,
      body: {
        status: "not_ready",
        ready: false,
        code: "MIGRATION_FAILED",
        checks: {
          db: "migration_failed",
          productEngine: "not_initialized_until_pr_04",
          codex: "not_checked_until_pr_07"
        },
        migrations,
        implementedApiRouteIds: PR05_MOUNTED_PRODUCT_API_ROUTE_IDS
      }
    } as const;
  }

  if (!hasStorage) {
    return {
      httpStatus: 200,
      body: {
        status: "not_ready",
        ready: false,
        code: "SIDECAR_NOT_READY",
        checks: {
          db: "migrated",
          productEngine: "not_initialized_until_storage_available",
          codex: "not_checked_until_pr_07"
        },
        migrations,
        implementedApiRouteIds: PR05_MOUNTED_PRODUCT_API_ROUTE_IDS
      }
    } as const;
  }

  return {
    httpStatus: 200,
    body: {
      status: "ready",
      ready: true,
      checks: {
        db: "migrated",
        productEngine: "initialized_pr_04",
        codex: "not_checked_until_pr_07"
      },
      migrations,
      implementedApiRouteIds: PR05_MOUNTED_PRODUCT_API_ROUTE_IDS
    }
  } as const;
}

function stateVersionFromBody(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "expectedStateVersion must be a non-negative integer.");
  }

  return value as StateVersion;
}

function stringFromBody(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function optionalStringArrayFromBody(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be an array of non-empty strings.`);
  }

  return value.map((item) => stringFromBody(item, fieldName));
}

function payloadObject(value: unknown) {
  return value && typeof value === "object" ? (value as Readonly<Record<string, unknown>>) : {};
}

async function jsonBody(context: Context) {
  try {
    return payloadObject(await context.req.json());
  } catch {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "Request body must be valid JSON.");
  }
}

export function createSidecarApp(options: CreateSidecarAppOptions) {
  const { localCapabilityToken, migrationStatus = defaultMigrationStatus(), storage = null } = options;
  const commandService = storage ? createProductEngineCommandService(storage) : null;

  if (localCapabilityToken.trim().length === 0) {
    throw new Error("localCapabilityToken must not be empty");
  }

  const app = new Hono();

  app.use("*", async (context, next) => {
    const clientAddress = explicitClientAddress(context.req.raw.headers);

    if (clientAddress && !isLoopbackAddress(clientAddress)) {
      return context.json(
        jsonError(context, "AUTH_REQUIRED", "Sidecar API accepts only loopback clients.", {
          policy: "loopback_only",
          receivedAddress: clientAddress
        }),
        403
      );
    }

    return next();
  });

  app.use(
    "*",
    cors({
      origin: allowedCorsOrigin,
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
      exposeHeaders: ["x-request-id"],
      maxAge: 600
    })
  );

  app.use("*", async (context, next) => {
    if (isPublicHealthPath(context.req.path)) {
      return next();
    }

    if (!context.req.path.startsWith("/api/v1")) {
      return next();
    }

    const token = bearerToken(context.req.header("authorization"));

    if (!token || !safeTokenEquals(token, localCapabilityToken)) {
      return context.json(
        jsonError(context, "AUTH_REQUIRED", "Local capability token is required for sidecar API routes.", {
          authScheme: "Bearer"
        }),
        401
      );
    }

    return next();
  });

  app.get("/healthz", (context) =>
    context.json({
      status: "ok",
      service: "solo-superman-sidecar",
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      sidecarPhase: "pr_05_decision_queue_shell",
      checks: {
        process: "alive"
      },
      implementedApiRouteIds: PR05_MOUNTED_PRODUCT_API_ROUTE_IDS,
      productApiRoutePlaceholderCount: productApiRoutePlaceholders.length
    })
  );

  app.get("/readyz", (context) => {
    const readiness = readyzStatus(migrationStatus, Boolean(storage));

    return context.json(readiness.body, readiness.httpStatus);
  });

  async function withProductEngine<TData>(
    context: Context,
    handler: (service: NonNullable<typeof commandService>) => Promise<TData>
  ) {
    if (!commandService) {
      return context.json(
        jsonError(context, "SIDECAR_NOT_READY", "ProductEngine command handling requires migrated local storage.", {
          migrationState: migrationStatus.state
        }),
        503
      );
    }

    try {
      return context.json(jsonSuccess(context, await handler(commandService)));
    } catch (error) {
      if (error instanceof ProductEngineServiceError) {
        return context.json(jsonError(context, error.code, error.message, error.details), error.code === "RESOURCE_NOT_FOUND" ? 404 : 400);
      }

      throw error;
    }
  }

  async function withCommandResponse(
    context: Context,
    handler: (service: NonNullable<typeof commandService>) => Promise<CommandResponse>
  ) {
    return withProductEngine(context, handler);
  }

  app.post("/api/v1/projects", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);
      const rawIdea = stringFromBody(body.rawIdea, "rawIdea");
      const localPrivacyMode = body.localPrivacyMode;

      if (localPrivacyMode !== "local_only" && localPrivacyMode !== "local_with_manual_export") {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "localPrivacyMode must be a supported local privacy mode.");
      }

      return service.startProject({
        rawIdea,
        localPrivacyMode,
        ...(typeof body.sourceNote === "string" ? { sourceNote: body.sourceNote } : {})
      });
    })
  );

  app.post("/api/v1/sessions/:sessionId/intake", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);

      return service.runSessionCommand({
        sessionId: context.req.param("sessionId") as SessionId,
        commandType: "CaptureIntake",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          answer: stringFromBody(body.answer, "answer")
        }
      });
    })
  );

  app.post("/api/v1/sessions/:sessionId/spec/initial", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);

      return service.runSessionCommand({
        sessionId: context.req.param("sessionId") as SessionId,
        commandType: "DraftInitialSpec",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {}
      });
    })
  );

  app.post("/api/v1/sessions/:sessionId/spec/analyze", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);

      return service.runSessionCommand({
        sessionId: context.req.param("sessionId") as SessionId,
        commandType: "AnalyzeAmbiguity",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          targetRef: stringFromBody(body.targetRef, "targetRef")
        }
      });
    })
  );

  app.post("/api/v1/sessions/:sessionId/queue/activate", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);
      const queueItemIds = optionalStringArrayFromBody(body.queueItemIds, "queueItemIds");

      return service.runSessionCommand({
        sessionId: context.req.param("sessionId") as SessionId,
        commandType: "ActivateQuestionBatch",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          ...(queueItemIds ? { queueItemIds } : {})
        }
      });
    })
  );

  app.post("/api/v1/questions/:questionId/answers", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);
      const questionId = context.req.param("questionId") as QueueItemId;
      const bodyQueueItemId = stringFromBody(body.queueItemId, "queueItemId") as QueueItemId;

      if (bodyQueueItemId !== questionId) {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "queueItemId must match the question route param.");
      }

      return service.runSessionCommand({
        sessionId: stringFromBody(body.sessionId, "sessionId") as SessionId,
        commandType: "SubmitAnswer",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          queueItemId: questionId,
          answer: stringFromBody(body.answer, "answer")
        }
      });
    })
  );

  app.get("/api/v1/projects/:projectId/sessions/:sessionId", async (context) =>
    withProductEngine(context, (service) =>
      service.getSession(context.req.param("projectId") as ProjectId, context.req.param("sessionId") as SessionId)
    )
  );

  app.get("/api/v1/sessions/:sessionId/spec", async (context) =>
    withProductEngine(context, (service) => service.getSpec(context.req.param("sessionId") as SessionId))
  );

  app.get("/api/v1/sessions/:sessionId/queue", async (context) =>
    withProductEngine(context, (service) => service.getQueue(context.req.param("sessionId") as SessionId))
  );

  app.get("/api/v1/commands/:commandId/status", (context) => {
    const commandId = context.req.param("commandId") as CommandId;

    if (commandService) {
      return withProductEngine(context, async (service) => {
        const status = await service.getCommandStatus(commandId);

        if (!status) {
          throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Command status was not found.", {
            commandId
          });
        }

        return status;
      });
    }

    return context.json(
      jsonError(
        context,
        "EFFECT_STATUS_UNAVAILABLE",
        "Command status persistence is not mounted until ProductEngine command handling is implemented.",
        {
          commandId,
          statusEndpointShape: commandStatusUnavailableShape(commandId)
        }
      ),
      503
    );
  });

  app.notFound((context) => {
    if (context.req.path.startsWith("/api/v1")) {
      return context.json(
        jsonError(context, "RESOURCE_NOT_FOUND", "This Phase 1 API route is not mounted yet.", {
          path: context.req.path,
          mountedRouteIds: PR05_MOUNTED_PRODUCT_API_ROUTE_IDS
        }),
        404
      );
    }

    return context.text("Not Found", 404);
  });

  return app;
}

export type SidecarApp = ReturnType<typeof createSidecarApp>;
