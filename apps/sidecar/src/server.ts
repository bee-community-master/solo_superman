import { randomUUID, timingSafeEqual } from "node:crypto";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import {
  CONTRACT_SCHEMA_VERSION,
  type ApiErrorCode,
  type ApiErrorEnvelope,
  type ApiResponseMeta,
  type CommandId,
  PR02_MOUNTED_PRODUCT_API_ROUTE_IDS,
  type StatusEndpointDto
} from "@solo-superman/contracts";
import { productApiRoutePlaceholders } from "./routes/catalog";

export interface CreateSidecarAppOptions {
  readonly localCapabilityToken: string;
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
      visibleLabel: "No persisted command status exists before PR-03 storage."
    },
    projectionHints: [],
    lastUpdatedAt: new Date(0).toISOString()
  };
}

export function createSidecarApp(options: CreateSidecarAppOptions) {
  const { localCapabilityToken } = options;

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
      sidecarPhase: "pr_02_health_shell",
      checks: {
        process: "alive"
      },
      implementedApiRouteIds: PR02_MOUNTED_PRODUCT_API_ROUTE_IDS,
      productApiRoutePlaceholderCount: productApiRoutePlaceholders.length
    })
  );

  app.get("/readyz", (context) =>
    context.json({
      status: "not_ready",
      ready: false,
      code: "SIDECAR_NOT_READY",
      checks: {
        db: "not_initialized_until_pr_03",
        productEngine: "not_initialized_until_pr_04",
        codex: "not_checked_until_pr_07"
      },
      implementedApiRouteIds: PR02_MOUNTED_PRODUCT_API_ROUTE_IDS
    })
  );

  app.get("/api/v1/commands/:commandId/status", (context) => {
    const commandId = context.req.param("commandId") as CommandId;

    return context.json(
      jsonError(
        context,
        "EFFECT_STATUS_UNAVAILABLE",
        "Command status persistence is not available until storage is implemented.",
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
        jsonError(context, "RESOURCE_NOT_FOUND", "This Phase 1 API route is not mounted in PR-02.", {
          path: context.req.path,
          mountedRouteIds: PR02_MOUNTED_PRODUCT_API_ROUTE_IDS
        }),
        404
      );
    }

    return context.text("Not Found", 404);
  });

  return app;
}

export type SidecarApp = ReturnType<typeof createSidecarApp>;
