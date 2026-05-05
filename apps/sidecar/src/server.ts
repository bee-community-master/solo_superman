import { randomUUID, timingSafeEqual } from "node:crypto";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import {
  CONTRACT_SCHEMA_VERSION,
  AUTOMATIC_RESEARCH_SOURCE_CATEGORIES,
  BLOCKED_ACTION_TYPES,
  CODEX_TURN_PURPOSES,
  BACKGROUND_RESEARCH_ADAPTER_KINDS,
  type ApiErrorCode,
  type ApiErrorEnvelope,
  type ApiResponseMeta,
  type ApiSuccessEnvelope,
  type AutomaticResearchSourceCategory,
  type CommandId,
  type CommandResponse,
  type CancelResearchRunRequest,
  CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS,
  MANUAL_RESEARCH_SOURCE_CATEGORIES,
  type CreateResearchAllowlistRequest,
  type PrepareResearchDisclosureRequest,
  type ProjectId,
  type QueueItemId,
  type ResearchAllowlistId,
  type ResearchAllowlistPolicyInput,
  type ResearchConnectorId,
  type ResearchSourceCategory,
  type ResearchRunId,
  type ResearchResultId,
  type ResearchTaskId,
  type RuntimeArtifactId,
  type SessionId,
  type StartResearchRunRequest,
  type StateVersion,
  type StatusEndpointDto,
  type RetryResearchRunRequest,
  type UpdateResearchAllowlistRequest
} from "@solo-superman/contracts";
import type { MigrationStatus, SoloStorage } from "@solo-superman/db";
import { createProductEngineCommandService, ProductEngineServiceError } from "./product-engine/command-service";
import { unmountedProductApiRoutePlaceholders } from "./routes/catalog";
import { createCodexRuntimeAdapter, type CodexRuntimeAdapter } from "./runtime";

export interface CreateSidecarAppOptions {
  readonly localCapabilityToken: string;
  readonly migrationStatus?: MigrationStatus;
  readonly storage?: SoloStorage | null;
  readonly codexRuntimeAdapter?: CodexRuntimeAdapter;
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
const REQUIRED_DECISION_REFS = new Set([
  "primary_customer",
  "problem",
  "value",
  "mvp_scope",
  "validation_plan",
  "success_criteria"
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
          codex: "runtime_status_endpoint_mounted_pr_07",
          completion: "e2e_dry_run_endpoints_mounted_pr_09"
        },
        migrations,
        implementedApiRouteIds: CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS
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
          codex: "runtime_status_endpoint_mounted_pr_07",
          completion: "e2e_dry_run_endpoints_mounted_pr_09"
        },
        migrations,
        implementedApiRouteIds: CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS
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
        codex: "runtime_status_endpoint_mounted_pr_07",
        completion: "e2e_dry_run_endpoints_mounted_pr_09"
      },
      migrations,
      implementedApiRouteIds: CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS
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

function optionalSectionsFromBody(value: unknown, fieldName: string) {
  const sections = optionalStringArrayFromBody(value, fieldName);

  if (sections && !sections.length) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must include at least one section.`);
  }

  return sections;
}

function requiredStringArrayFromBody(value: unknown, fieldName: string) {
  const strings = optionalStringArrayFromBody(value, fieldName);

  if (!strings?.length) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must include at least one trace reference.`);
  }

  return strings;
}

function requiredValueArrayFromBody(value: unknown, fieldName: string) {
  const strings = optionalStringArrayFromBody(value, fieldName);

  if (!strings?.length) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must include at least one value.`);
  }

  return strings;
}

function optionalStringFromBody(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return undefined;
  }

  return stringFromBody(value, fieldName);
}

function optionalPositiveIntegerFromBody(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be a positive integer.`);
  }

  return value;
}

function turnPurposeFromBody(value: unknown) {
  if (typeof value !== "string" || !CODEX_TURN_PURPOSES.includes(value as (typeof CODEX_TURN_PURPOSES)[number])) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "turnPurpose must be one of the canonical Codex values.");
  }

  return value;
}

function optionalBlockedActionTypeFromBody(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string" || !BLOCKED_ACTION_TYPES.includes(value as (typeof BLOCKED_ACTION_TYPES)[number])) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be a canonical blocked action type.`);
  }

  return value;
}

function optionalRequiredDecisionRefFromBody(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string" || !REQUIRED_DECISION_REFS.has(value)) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be a canonical required decision ref.`);
  }

  return value;
}

function optionalJsonObjectFromBody(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be a JSON object.`);
  }

  return value as Readonly<Record<string, unknown>>;
}

function jsonObjectFromBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "Request body must be a JSON object.");
  }

  return value as Readonly<Record<string, unknown>>;
}

async function jsonBody(context: Context) {
  let body: unknown;

  try {
    body = await context.req.json();
  } catch {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "Request body must be valid JSON.");
  }

  return jsonObjectFromBody(body);
}

function projectIdFromBody(value: unknown) {
  return optionalStringFromBody(value, "projectId") as ProjectId | undefined;
}

function allowlistIdFromBody(value: unknown) {
  return optionalStringFromBody(value, "allowlistId") as ResearchAllowlistId | undefined;
}

function optionalAllowlistPolicyFromBody(body: Readonly<Record<string, unknown>>) {
  const policy: Record<string, unknown> = {};
  const connectorIds = optionalStringArrayFromBody(body.connectorIds, "connectorIds");
  const sourceCategories = optionalStringArrayFromBody(body.sourceCategories, "sourceCategories");
  const contextMode = optionalStringFromBody(body.contextMode, "contextMode");

  if (connectorIds) {
    policy.connectorIds = connectorIds as unknown as readonly ResearchConnectorId[];
  }

  if (sourceCategories) {
    policy.sourceCategories = sourceCategories as readonly AutomaticResearchSourceCategory[];
  }

  if (contextMode) {
    policy.contextMode = contextMode as "public_safe_summary";
  }

  if (body.rateBudgetPolicy !== undefined) {
    policy.rateBudgetPolicy = optionalJsonObjectFromBody(
      body.rateBudgetPolicy,
      "rateBudgetPolicy"
    ) as ResearchAllowlistPolicyInput["rateBudgetPolicy"];
  }

  if (body.stalenessPolicy !== undefined) {
    policy.stalenessPolicy = optionalJsonObjectFromBody(
      body.stalenessPolicy,
      "stalenessPolicy"
    ) as ResearchAllowlistPolicyInput["stalenessPolicy"];
  }

  if (body.disclosureLogPolicy !== undefined) {
    policy.disclosureLogPolicy = optionalJsonObjectFromBody(
      body.disclosureLogPolicy,
      "disclosureLogPolicy"
    ) as ResearchAllowlistPolicyInput["disclosureLogPolicy"];
  }

  return policy as ResearchAllowlistPolicyInput;
}

function createResearchAllowlistRequestFromBody(body: Readonly<Record<string, unknown>>): CreateResearchAllowlistRequest {
  const projectId = projectIdFromBody(body.projectId);
  const allowlistId = allowlistIdFromBody(body.allowlistId);

  return {
    ...(projectId ? { projectId } : {}),
    ...(allowlistId ? { allowlistId } : {}),
    connectorIds: requiredValueArrayFromBody(body.connectorIds, "connectorIds") as unknown as readonly ResearchConnectorId[],
    sourceCategories: requiredValueArrayFromBody(body.sourceCategories, "sourceCategories") as readonly AutomaticResearchSourceCategory[],
    approvedBy: stringFromBody(body.approvedBy, "approvedBy"),
    ...optionalAllowlistPolicyFromBody({
      ...body,
      connectorIds: undefined,
      sourceCategories: undefined
    })
  };
}

function updateResearchAllowlistRequestFromBody(body: Readonly<Record<string, unknown>>): UpdateResearchAllowlistRequest {
  const projectId = projectIdFromBody(body.projectId);
  const allowlistId = allowlistIdFromBody(body.allowlistId);
  const approvedBy = optionalStringFromBody(body.approvedBy, "approvedBy");
  const status = optionalStringFromBody(body.status, "status");

  if (status !== undefined && status !== "active" && status !== "paused" && status !== "revoked") {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "status must be active, paused, or revoked.");
  }

  return {
    ...(projectId ? { projectId } : {}),
    ...(allowlistId ? { allowlistId } : {}),
    ...(approvedBy ? { approvedBy } : {}),
    ...(status ? { status } : {}),
    ...optionalAllowlistPolicyFromBody(body)
  };
}

function assertOptionalProjectIdMatchesRoute(routeProjectId: ProjectId, bodyProjectId: ProjectId | undefined) {
  if (bodyProjectId && bodyProjectId !== routeProjectId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "projectId must match the route param.");
  }
}

function assertOptionalAllowlistIdMatchesRoute(
  routeAllowlistId: ResearchAllowlistId,
  bodyAllowlistId: ResearchAllowlistId | undefined
) {
  if (bodyAllowlistId && bodyAllowlistId !== routeAllowlistId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "allowlistId must match the route param.");
  }
}

function allowlistLifecycleRouteInput(
  routeProjectId: ProjectId,
  routeAllowlistId: ResearchAllowlistId,
  body: Readonly<Record<string, unknown>>
) {
  assertOptionalProjectIdMatchesRoute(routeProjectId, projectIdFromBody(body.projectId));
  assertOptionalAllowlistIdMatchesRoute(routeAllowlistId, allowlistIdFromBody(body.allowlistId));
  const reason = optionalStringFromBody(body.reason, "reason");

  return {
    projectId: routeProjectId,
    allowlistId: routeAllowlistId,
    ...(reason ? { reason } : {})
  };
}

function researchSourceCategoryFromBody(value: unknown) {
  const sourceCategory = stringFromBody(value, "sourceCategory");
  const supported = [
    ...AUTOMATIC_RESEARCH_SOURCE_CATEGORIES,
    ...MANUAL_RESEARCH_SOURCE_CATEGORIES
  ] as readonly string[];

  if (!supported.includes(sourceCategory)) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "sourceCategory must be a canonical research source category.");
  }

  return sourceCategory as ResearchSourceCategory;
}

function prepareResearchDisclosureRequestFromBody(
  body: Readonly<Record<string, unknown>>
): PrepareResearchDisclosureRequest {
  const projectId = projectIdFromBody(body.projectId);
  const allowlistId = allowlistIdFromBody(body.allowlistId);
  const optionalStringFields = {
    productCategory: optionalStringFromBody(body.productCategory, "productCategory"),
    customerProblemHypothesis: optionalStringFromBody(body.customerProblemHypothesis, "customerProblemHypothesis"),
    highLevelContext: optionalStringFromBody(body.highLevelContext, "highLevelContext"),
    rawIdea: optionalStringFromBody(body.rawIdea, "rawIdea")
  };
  const optionalArrayFields = {
    detailedAnswers: optionalStringArrayFromBody(body.detailedAnswers, "detailedAnswers"),
    privateCustomerNames: optionalStringArrayFromBody(body.privateCustomerNames, "privateCustomerNames"),
    unreleasedPartnerNames: optionalStringArrayFromBody(body.unreleasedPartnerNames, "unreleasedPartnerNames"),
    contactDetails: optionalStringArrayFromBody(body.contactDetails, "contactDetails"),
    privateDocumentRefs: optionalStringArrayFromBody(body.privateDocumentRefs, "privateDocumentRefs"),
    sourceRefs: optionalStringArrayFromBody(body.sourceRefs, "sourceRefs")
  };

  return {
    ...(projectId ? { projectId } : {}),
    ...(allowlistId ? { allowlistId } : {}),
    connectorId: stringFromBody(body.connectorId, "connectorId") as ResearchConnectorId,
    sourceCategory: researchSourceCategoryFromBody(body.sourceCategory),
    researchObjective: stringFromBody(body.researchObjective, "researchObjective"),
    ...Object.fromEntries(Object.entries(optionalStringFields).filter(([, value]) => value !== undefined)),
    ...Object.fromEntries(Object.entries(optionalArrayFields).filter(([, value]) => value !== undefined))
  } as PrepareResearchDisclosureRequest;
}

function researchRunIdFromBody(value: unknown) {
  return optionalStringFromBody(value, "researchRunId") as ResearchRunId | undefined;
}

function adapterKindFromBody(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const adapterKind = stringFromBody(value, "adapterKind");

  if (!BACKGROUND_RESEARCH_ADAPTER_KINDS.includes(adapterKind as never)) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "adapterKind must be a provider-neutral adapter kind.");
  }

  return adapterKind as StartResearchRunRequest["adapterKind"];
}

function startResearchRunRequestFromBody(body: Readonly<Record<string, unknown>>): StartResearchRunRequest {
  const projectId = projectIdFromBody(body.projectId);
  const researchRunId = researchRunIdFromBody(body.researchRunId);
  const allowlistId = allowlistIdFromBody(body.allowlistId);
  const adapterKind = adapterKindFromBody(body.adapterKind);
  const disclosureRequest = prepareResearchDisclosureRequestFromBody(body);
  const contextHash = optionalStringFromBody(body.contextHash, "contextHash");
  const taskFreshnessDeadline = optionalStringFromBody(body.taskFreshnessDeadline, "taskFreshnessDeadline");
  const sourcePublishedAt = optionalStringFromBody(body.sourcePublishedAt, "sourcePublishedAt");
  const sourceRequiredAfter = optionalStringFromBody(body.sourceRequiredAfter, "sourceRequiredAfter");

  return {
    ...disclosureRequest,
    ...(projectId ? { projectId } : {}),
    ...(researchRunId ? { researchRunId } : {}),
    researchTaskId: stringFromBody(body.researchTaskId, "researchTaskId") as ResearchTaskId,
    ...(allowlistId ? { allowlistId } : {}),
    ...(adapterKind ? { adapterKind } : {}),
    ...(contextHash ? { contextHash } : {}),
    ...(taskFreshnessDeadline ? { taskFreshnessDeadline } : {}),
    ...(sourcePublishedAt ? { sourcePublishedAt } : {}),
    ...(sourceRequiredAfter ? { sourceRequiredAfter } : {})
  };
}

function cancelResearchRunRequestFromBody(body: Readonly<Record<string, unknown>>): CancelResearchRunRequest {
  const projectId = projectIdFromBody(body.projectId);
  const researchRunId = researchRunIdFromBody(body.researchRunId);
  const reason = optionalStringFromBody(body.reason, "reason");

  return {
    ...(projectId ? { projectId } : {}),
    ...(researchRunId ? { researchRunId } : {}),
    ...(reason ? { reason } : {})
  };
}

function retryResearchRunRequestFromBody(body: Readonly<Record<string, unknown>>): RetryResearchRunRequest {
  const projectId = projectIdFromBody(body.projectId);
  const researchRunId = researchRunIdFromBody(body.researchRunId);
  const contextHash = optionalStringFromBody(body.contextHash, "contextHash");

  return {
    ...(projectId ? { projectId } : {}),
    ...(researchRunId ? { researchRunId } : {}),
    retryReason: stringFromBody(body.retryReason, "retryReason"),
    ...(contextHash ? { contextHash } : {})
  };
}

export function createSidecarApp(options: CreateSidecarAppOptions) {
  const { localCapabilityToken, migrationStatus = defaultMigrationStatus(), storage = null } = options;
  const codexRuntimeAdapter = options.codexRuntimeAdapter ?? createCodexRuntimeAdapter();
  const commandService = storage ? createProductEngineCommandService(storage, codexRuntimeAdapter) : null;

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
      sidecarPhase: "phase_1_5a_pr_05_research_run_controls",
      checks: {
        process: "alive"
      },
      implementedApiRouteIds: CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS,
      productApiRoutePlaceholderCount: unmountedProductApiRoutePlaceholders.length
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

  app.get("/api/v1/projects/:projectId/research-allowlists", async (context) =>
    withProductEngine(context, (service) =>
      service.listResearchAllowlists(context.req.param("projectId") as ProjectId)
    )
  );

  app.post("/api/v1/projects/:projectId/research-allowlists", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);

      return service.createResearchAllowlist({
        projectId: context.req.param("projectId") as ProjectId,
        request: createResearchAllowlistRequestFromBody(body)
      });
    })
  );

  app.post("/api/v1/projects/:projectId/research-allowlists/:allowlistId", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);

      return service.updateResearchAllowlist({
        projectId: context.req.param("projectId") as ProjectId,
        allowlistId: context.req.param("allowlistId") as ResearchAllowlistId,
        request: updateResearchAllowlistRequestFromBody(body)
      });
    })
  );

  app.post("/api/v1/projects/:projectId/research-allowlists/:allowlistId/pause", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);
      const routeProjectId = context.req.param("projectId") as ProjectId;
      const routeAllowlistId = context.req.param("allowlistId") as ResearchAllowlistId;

      return service.pauseResearchAllowlist(allowlistLifecycleRouteInput(routeProjectId, routeAllowlistId, body));
    })
  );

  app.post("/api/v1/projects/:projectId/research-allowlists/:allowlistId/revoke", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);
      const routeProjectId = context.req.param("projectId") as ProjectId;
      const routeAllowlistId = context.req.param("allowlistId") as ResearchAllowlistId;

      return service.revokeResearchAllowlist(allowlistLifecycleRouteInput(routeProjectId, routeAllowlistId, body));
    })
  );

  app.get("/api/v1/projects/:projectId/research-disclosures", async (context) =>
    withProductEngine(context, (service) =>
      service.listResearchDisclosures(context.req.param("projectId") as ProjectId)
    )
  );

  app.post("/api/v1/projects/:projectId/research-disclosures", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);

      return service.prepareResearchDisclosure({
        projectId: context.req.param("projectId") as ProjectId,
        request: prepareResearchDisclosureRequestFromBody(body)
      });
    })
  );

  app.get("/api/v1/projects/:projectId/research-runs", async (context) =>
    withProductEngine(context, (service) =>
      service.listResearchRuns(context.req.param("projectId") as ProjectId)
    )
  );

  app.post("/api/v1/projects/:projectId/research-runs", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);

      return service.startResearchRun({
        projectId: context.req.param("projectId") as ProjectId,
        request: startResearchRunRequestFromBody(body)
      });
    })
  );

  app.get("/api/v1/projects/:projectId/research-runs/:researchRunId/status", async (context) =>
    withProductEngine(context, (service) =>
      service.getResearchRunStatus({
        projectId: context.req.param("projectId") as ProjectId,
        researchRunId: context.req.param("researchRunId") as ResearchRunId
      })
    )
  );

  app.post("/api/v1/projects/:projectId/research-runs/:researchRunId/cancel", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);

      return service.cancelResearchRun({
        projectId: context.req.param("projectId") as ProjectId,
        researchRunId: context.req.param("researchRunId") as ResearchRunId,
        request: cancelResearchRunRequestFromBody(body)
      });
    })
  );

  app.post("/api/v1/projects/:projectId/research-runs/:researchRunId/retry", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);

      return service.retryResearchRun({
        projectId: context.req.param("projectId") as ProjectId,
        researchRunId: context.req.param("researchRunId") as ResearchRunId,
        request: retryResearchRunRequestFromBody(body)
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
          answer: stringFromBody(body.answer, "answer"),
          ...(typeof body.researchRouteHint === "string" ? { researchRouteHint: body.researchRouteHint } : {}),
          ...(typeof body.claimImpact === "string" ? { claimImpact: body.claimImpact } : {}),
          ...(typeof body.evidenceBalanceHint === "string" ? { evidenceBalanceHint: body.evidenceBalanceHint } : {}),
          ...(typeof body.researchObjective === "string" ? { researchObjective: body.researchObjective } : {})
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

  app.get("/api/v1/sessions/:sessionId/spec/versions", async (context) =>
    withProductEngine(context, (service) => service.listSpecVersions(context.req.param("sessionId") as SessionId))
  );

  app.get("/api/v1/sessions/:sessionId/queue", async (context) =>
    withProductEngine(context, (service) => service.getQueue(context.req.param("sessionId") as SessionId))
  );

  app.post("/api/v1/sessions/:sessionId/research-tasks", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);
      const sourceQueueItemId = optionalStringFromBody(body.sourceQueueItemId, "sourceQueueItemId");

      if (!sourceQueueItemId) {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "sourceQueueItemId is required for PlanResearch traceability.");
      }

      return service.runSessionCommand({
        sessionId: context.req.param("sessionId") as SessionId,
        commandType: "PlanResearch",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          objective: stringFromBody(body.objective, "objective"),
          sourceQueueItemId,
          ...(typeof body.routeOutcome === "string" ? { routeOutcome: body.routeOutcome } : {}),
          ...(typeof body.impact === "string" ? { impact: body.impact } : {})
        }
      });
    })
  );

  app.get("/api/v1/sessions/:sessionId/research", async (context) =>
    withProductEngine(context, (service) => service.getResearch(context.req.param("sessionId") as SessionId))
  );

  app.post("/api/v1/research-tasks/:researchTaskId/results", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);
      const researchTaskId = context.req.param("researchTaskId") as ResearchTaskId;
      const bodyResearchTaskId = stringFromBody(body.researchTaskId, "researchTaskId") as ResearchTaskId;
      const sourceTitle = optionalStringFromBody(body.sourceTitle, "sourceTitle");
      const sourceUrl = optionalStringFromBody(body.sourceUrl, "sourceUrl");
      const limitationNotes = optionalStringFromBody(body.limitationNotes, "limitationNotes");
      const synthesisVersion = optionalPositiveIntegerFromBody(body.synthesisVersion, "synthesisVersion");

      if (bodyResearchTaskId !== researchTaskId) {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "researchTaskId must match the route param.");
      }

      return service.runSessionCommand({
        sessionId: stringFromBody(body.sessionId, "sessionId") as SessionId,
        commandType: "ImportResearchResult",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          researchTaskId,
          result: stringFromBody(body.result, "result"),
          ...(sourceTitle ? { sourceTitle } : {}),
          ...(sourceUrl ? { sourceUrl } : {}),
          ...(limitationNotes ? { limitationNotes } : {}),
          ...(synthesisVersion ? { synthesisVersion } : {})
        }
      });
    })
  );

  app.post("/api/v1/research-results/:researchResultId/synthesize", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);
      const researchResultId = context.req.param("researchResultId") as ResearchResultId;
      const bodyResearchResultId = stringFromBody(body.researchResultId, "researchResultId") as ResearchResultId;
      const synthesisVersion = optionalPositiveIntegerFromBody(body.synthesisVersion, "synthesisVersion");

      if (bodyResearchResultId !== researchResultId) {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "researchResultId must match the route param.");
      }

      return service.runSessionCommand({
        sessionId: stringFromBody(body.sessionId, "sessionId") as SessionId,
        commandType: "SynthesizeEvidence",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          researchResultId,
          ...(synthesisVersion ? { synthesisVersion } : {})
        }
      });
    })
  );

  app.post("/api/v1/spec-updates", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);
      const sections = optionalSectionsFromBody(body.sections, "sections");
      const requiredDecisionRef = optionalRequiredDecisionRefFromBody(body.requiredDecisionRef, "requiredDecisionRef");

      return service.runSessionCommand({
        sessionId: stringFromBody(body.sessionId, "sessionId") as SessionId,
        commandType: "CreateSpecUpdatePreview",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          sourceRef: stringFromBody(body.sourceRef, "sourceRef"),
          ...(requiredDecisionRef ? { requiredDecisionRef } : {}),
          ...(typeof body.title === "string" ? { title: body.title } : {}),
          ...(sections ? { sections } : {})
        }
      });
    })
  );

  app.post("/api/v1/decisions/:decisionId/resolve", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);
      const decisionId = context.req.param("decisionId");
      const bodyDecisionId = stringFromBody(body.decisionId, "decisionId");

      if (bodyDecisionId !== decisionId) {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "decisionId must match the route param.");
      }

      return service.runSessionCommand({
        sessionId: stringFromBody(body.sessionId, "sessionId") as SessionId,
        commandType: "ResolveDecision",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          decisionId,
          outcome: stringFromBody(body.outcome, "outcome"),
          ...(typeof body.rationale === "string" ? { rationale: body.rationale } : {})
        }
      });
    })
  );

  app.post("/api/v1/sessions/:sessionId/spec/versions", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);
      const sections = optionalSectionsFromBody(body.sections, "sections");

      return service.runSessionCommand({
        sessionId: context.req.param("sessionId") as SessionId,
        commandType: "CreateSpecVersion",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          approvedPreviewRef: stringFromBody(body.approvedPreviewRef, "approvedPreviewRef"),
          ...(typeof body.title === "string" ? { title: body.title } : {}),
          ...(sections ? { sections } : {})
        }
      });
    })
  );

  app.get("/api/v1/runtime/status", async (context) =>
    context.json(jsonSuccess(context, await codexRuntimeAdapter.getStatus()))
  );

  app.post("/api/v1/runtime/codex/preview", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);
      const requestedActionType = optionalBlockedActionTypeFromBody(body.requestedActionType, "requestedActionType");

      return service.runSessionCommand({
        sessionId: stringFromBody(body.sessionId, "sessionId") as SessionId,
        commandType: "CreateRuntimePreview",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          turnPurpose: turnPurposeFromBody(body.turnPurpose),
          contextHash: stringFromBody(body.contextHash, "contextHash"),
          prompt: stringFromBody(body.prompt, "prompt"),
          sourceRefs: requiredStringArrayFromBody(body.sourceRefs, "sourceRefs"),
          ...(typeof body.targetObject === "string" ? { targetObject: body.targetObject } : {}),
          ...(requestedActionType ? { requestedActionType } : {}),
          ...(typeof body.requestedActionReason === "string"
            ? { requestedActionReason: body.requestedActionReason }
            : {})
        }
      });
    })
  );

  app.post("/api/v1/runtime/manual-handoff", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);

      return service.runSessionCommand({
        sessionId: stringFromBody(body.sessionId, "sessionId") as SessionId,
        commandType: "CreateRuntimePreview",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          mode: "manual_handoff",
          turnPurpose: turnPurposeFromBody(body.turnPurpose),
          contextHash: stringFromBody(body.contextHash, "contextHash"),
          prompt: stringFromBody(body.prompt, "prompt"),
          sourceRefs: requiredStringArrayFromBody(body.sourceRefs, "sourceRefs"),
          ...(typeof body.targetObject === "string" ? { targetObject: body.targetObject } : {})
        }
      });
    })
  );

  app.post("/api/v1/runtime/artifacts/:artifactId/convert", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);
      const artifactId = context.req.param("artifactId") as RuntimeArtifactId;
      const bodyArtifactId = stringFromBody(body.artifactId, "artifactId") as RuntimeArtifactId;

      if (bodyArtifactId !== artifactId) {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "artifactId must match the route param.");
      }

      return service.runSessionCommand({
        sessionId: stringFromBody(body.sessionId, "sessionId") as SessionId,
        commandType: "ConvertRuntimeArtifact",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          artifactId,
          target: stringFromBody(body.target, "target")
        }
      });
    })
  );

  app.post("/api/v1/runtime/artifacts/:artifactId/block", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);
      const artifactId = context.req.param("artifactId") as RuntimeArtifactId;
      const bodyArtifactId = stringFromBody(body.artifactId, "artifactId") as RuntimeArtifactId;
      const blockedActionType = optionalBlockedActionTypeFromBody(body.blockedActionType, "blockedActionType");

      if (bodyArtifactId !== artifactId) {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "artifactId must match the route param.");
      }

      if (!blockedActionType) {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "blockedActionType is required for blocked artifacts.");
      }

      return service.runSessionCommand({
        sessionId: stringFromBody(body.sessionId, "sessionId") as SessionId,
        commandType: "ConvertRuntimeArtifact",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          artifactId,
          target: "blocked_action",
          blockedActionType,
          blockReason: stringFromBody(body.reason, "reason")
        }
      });
    })
  );

  app.get("/api/v1/sessions/:sessionId/activity", async (context) =>
    withProductEngine(context, (service) => service.getActivity(context.req.param("sessionId") as SessionId))
  );

  app.get("/api/v1/sessions/:sessionId/completeness", async (context) =>
    withProductEngine(context, (service) => service.getCompleteness(context.req.param("sessionId") as SessionId))
  );

  app.post("/api/v1/sessions/:sessionId/completeness/score", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);

      return service.runSessionCommand({
        sessionId: context.req.param("sessionId") as SessionId,
        commandType: "ScoreCompleteness",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          mode: "score"
        }
      });
    })
  );

  app.post("/api/v1/sessions/:sessionId/completion-candidate", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);

      return service.runSessionCommand({
        sessionId: context.req.param("sessionId") as SessionId,
        commandType: "ScoreCompleteness",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          mode: "completion_candidate",
          candidateRequested: true
        }
      });
    })
  );

  app.get("/api/v1/sessions/:sessionId/founder-brief", async (context) =>
    withProductEngine(context, (service) => service.getFounderBrief(context.req.param("sessionId") as SessionId))
  );

  app.post("/api/v1/sessions/:sessionId/founder-brief/export", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);

      return service.runSessionCommand({
        sessionId: context.req.param("sessionId") as SessionId,
        commandType: "PrepareFounderBrief",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          ...(body.requestedFormat !== undefined ? { requestedFormat: body.requestedFormat } : {}),
          fileWriteRequested: body.fileWriteRequested === true || body.writeFile === true,
          ...(body.externalExportRequested === true ? { externalExportRequested: true } : {}),
          ...(typeof body.destinationPath === "string" ? { destinationPath: body.destinationPath } : {}),
          ...(typeof body.exportUrl === "string" ? { exportUrl: body.exportUrl } : {})
        }
      });
    })
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
          mountedRouteIds: CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS
        }),
        404
      );
    }

    return context.text("Not Found", 404);
  });

  return app;
}

export type SidecarApp = ReturnType<typeof createSidecarApp>;
