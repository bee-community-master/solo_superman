import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import {
  CONTRACT_SCHEMA_VERSION,
  AUTOMATIC_RESEARCH_SOURCE_CATEGORIES,
  AUTO_IMPLEMENTATION_GITHUB_ISSUE_ACTION_CLASS,
  AUTO_IMPLEMENTATION_GITHUB_ISSUE_APPROVAL_GRANULARITY,
  AUTO_IMPLEMENTATION_GITHUB_ISSUE_REQUEST_MODES,
  AUTO_IMPLEMENTATION_PULL_REQUEST_ACTION_CLASS,
  AUTO_IMPLEMENTATION_PULL_REQUEST_APPROVAL_GRANULARITY,
  AUTO_IMPLEMENTATION_PULL_REQUEST_MUTATION_ACTIONS,
  AUTO_IMPLEMENTATION_PULL_REQUEST_MUTATION_REQUEST_MODES,
  AUTO_IMPLEMENTATION_STAGE_ACTIONS,
  AUTO_IMPLEMENTATION_STAGES,
  BLOCKED_ACTION_TYPES,
  CODEX_TURN_PURPOSES,
  BACKGROUND_RESEARCH_ADAPTER_KINDS,
  BOUNDED_AGENT_FAILURE_MODES,
  BOUNDED_AGENT_NO_EXECUTION_POLICIES,
  BROWSER_ACTION_CREDENTIAL_MODES,
  BROWSER_ACTION_EXTERNAL_MUTATION_POLICIES,
  BROWSER_ACTION_PREVIEW_KINDS,
  CHATGPT_BROWSER_DELEGATION_CREATE_REQUEST_KEYS,
  CHATGPT_BROWSER_DELEGATION_REVOKE_REQUEST_KEYS,
  EXECUTION_APPROVAL_DECISIONS,
  EXECUTION_AUTHORITY_ACTION_CLASSES,
  EXECUTION_NETWORK_POLICIES,
  EXECUTION_ROLLBACK_KINDS,
  EXECUTION_SANDBOX_MODES,
  EXECUTION_SECRET_POLICIES,
  SERVICE_PAGE_USE_PERMISSION_ACTION_CLASSES,
  SERVICE_PAGE_USE_PERMISSION_APPROVAL_GRANULARITIES,
  SERVICE_PAGE_USE_PERMISSION_BLOCKED_ACTION_CLASSES,
  SERVICE_PAGE_USE_PERMISSION_DATA_CATEGORIES,
  IMPLEMENTATION_STEP_STATUSES,
  BUSINESS_CRITIC_INTENSITIES,
  PROJECT_PURPOSE_MODES,
  RESEARCH_AUTOMATION_PERMISSIONS,
  isAutoImplementationPullRequestIssueLink,
  isExecutionAuthorityIsoTimestamp,
  isChatGptBrowserDelegationApprovalDecision,
  isChatGptBrowserDelegationStatus,
  type ApiErrorCode,
  type ApiErrorEnvelope,
  type ApiResponseMeta,
  type ApiSuccessEnvelope,
  type AutomaticResearchSourceCategory,
  type BoundedAgentOutputRecord,
  type BackgroundResearchAdapterKind,
  type CommandId,
  type CommandResponse,
  type CancelResearchRunRequest,
  type AdvanceAutoImplementationWorkerStageRequest,
  type CompleteAutoImplementationWorkerJobRequest,
  type CreateAutoImplementationRunRequest,
  type CreateAutoImplementationWorkerJobRequest,
  type ImportAutoImplementationWorkerLedgerRequest,
  type RunAutoImplementationWorkerJobRequest,
  type RecordAutoImplementationPullRequestMutationRequest,
  type CreateExecutionAuthorityPayload,
  type CreateExecutionAuthorityRequest,
  type CreateChatGptBrowserDelegationRunPayload,
  type CreateChatGptBrowserDelegationRunRequest,
  type CreateServicePageUsePermissionPayload,
  type CreateServicePageUsePermissionRequest,
  type DeleteServicePageUsePermissionArtifactsRequest,
  type RecordAutoImplementationStageRequest,
  type RecordImplementationStepLedgerPayload,
  type RecordImplementationStepLedgerRequest,
  type RevokeChatGptBrowserDelegationRunRequest,
  type RevokeServicePageUsePermissionRequest,
  type BrowserActionPreviewDto,
  type ExecuteBrowserActionRequest,
  type ExecuteFileDiffRequest,
  type ExecuteShellCommandRequest,
  type AutoImplementationGitHubIssueApproval,
  type AutoImplementationPullRequestMutationApproval,
  type AutoImplementationStage,
  type AutoImplementationStageAction,
  type AutoImplementationStageBlocker,
  CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS,
  MANUAL_RESEARCH_SOURCE_CATEGORIES,
  type CreatePlanningHandoffRequest,
  type CreateResearchAllowlistRequest,
  type ExecutionApprovalDecision,
  type ExecutionAuthorityActionClass,
  type ExecutionAuthorityApprover,
  type ExecutionAuthorityPreconditionChecks,
  type ExecutionAuthorityRequestedScope,
  type ExecutionRollbackReference,
  type ExecutionSandboxBoundary,
  type PrepareResearchDisclosureRequest,
  type PlanningHandoffRequestedScopeDto,
  type PlanningHandoffSourceRefDto,
  type BusinessCriticIntensity,
  type ProjectPurposeMode,
  type ResearchAutomationPermission,
  type ProjectId,
  type QueueItemId,
  type ResearchAllowlistId,
  type ResearchAllowlistPolicyInput,
  type ResearchConnectorId,
  type ResearchSourceCategory,
  type ResearchRunId,
  type ResearchResultId,
  type ResearchQueueTerminalOutcome,
  type ResearchSourceReliability,
  type ResearchTaskId,
  type RuntimeArtifactId,
  type ProjectionUpdatedSseEvent,
  type SessionId,
  type SseEvent,
  type StartResearchRunRequest,
  type StateVersion,
  type StatusEndpointDto,
  type RetryResearchRunRequest,
  type UpdateResearchAllowlistRequest,
  type ValidateExecutionAuthorityPreflightRequest
} from "@solo-superman/contracts";
import type { MigrationStatus, SoloStorage } from "@solo-superman/db";
import {
  createProductEngineCommandService,
  ProductEngineServiceError,
  type ProductEngineCommandServiceOptions
} from "./product-engine/command-service";
import {
  GENERATED_AMBIGUITY_QUESTION_PROMPT_TEMPLATE_REF,
  GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
  parseGeneratedAmbiguityQuestionSet,
  parseGeneratedAmbiguityQuestionSetText
} from "@solo-superman/core";
import { buildGeneratedAmbiguityQuestionPrompt } from "./product-engine/generated-ambiguity-question-prompt";
import { loadSoloProjectConfig } from "./product-engine/project-config";
import type {
  AutoImplementationGitHubIssueMutationAdapter,
  AutoImplementationPullRequestMutationAdapter,
  AutoImplementationRemoteStatusProvider
} from "./product-engine/auto-implementation-workspace";
import { unmountedProductApiRoutePlaceholders } from "./routes/catalog";
import {
  CodexRuntimeTimeoutError,
  CodexRuntimeUnavailableError,
  createCodexRuntimeAdapter,
  type CodexRuntimeAdapter
} from "./runtime";

export interface CreateSidecarAppOptions {
  readonly localCapabilityToken: string;
  readonly migrationStatus?: MigrationStatus;
  readonly storage?: SoloStorage | null;
  readonly codexRuntimeAdapter?: CodexRuntimeAdapter;
  readonly autoImplementationWorkspaceRoot?: string;
  readonly autoImplementationRemoteStatusProvider?: AutoImplementationRemoteStatusProvider;
  readonly autoImplementationGitHubIssueMutationAdapter?: AutoImplementationGitHubIssueMutationAdapter;
  readonly autoImplementationPullRequestMutationAdapter?: AutoImplementationPullRequestMutationAdapter;
}

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "localhost"]);
const LOOPBACK_ORIGIN_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
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
  let originUrl: URL;

  try {
    originUrl = new URL(origin);
  } catch {
    return null;
  }

  if (originUrl.protocol !== "http:" || !LOOPBACK_ORIGIN_HOSTS.has(originUrl.hostname)) {
    return null;
  }

  return origin === originUrl.origin ? origin : null;
}

function explicitRequestOrigin(headers: Headers) {
  return headers.get("origin");
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

function sseFrame(event: SseEvent) {
  return `event: ${event.event}\ndata: ${JSON.stringify(event)}\n\n`;
}

function decisionQueueProjectionUpdatedEvent(
  sessionId: SessionId,
  projectionVersion: ProjectionUpdatedSseEvent["version"]
): ProjectionUpdatedSseEvent {
  return {
    event: "projection.updated",
    emittedAt: new Date().toISOString(),
    projectionKind: "DecisionQueueProjection",
    version: projectionVersion,
    affectedIds: [sessionId],
    refetchUrl: `/api/v1/sessions/${sessionId}/queue`
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

function stringContentFromBody(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be a non-empty string.`);
  }

  return value;
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

function questionCountFromBody(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "initialQuestionCount must be an object.");
  }

  const count = value as { readonly min?: unknown; readonly max?: unknown };
  const min = count.min === undefined ? undefined : numericQuestionCountFromBody(count.min, "initialQuestionCount.min");
  const max = count.max === undefined ? undefined : numericQuestionCountFromBody(count.max, "initialQuestionCount.max");

  return { ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) };
}

function numericQuestionCountFromBody(value: unknown, fieldName: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 30) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be an integer between 1 and 30.`);
  }

  return value;
}

function questionGenerationModeFromBody(value: unknown) {
  if (value === undefined) {
    return "live_preview" as const;
  }

  if (value === "live_preview" || value === "local_fallback") {
    return value;
  }

  throw new ProductEngineServiceError(
    "VALIDATION_FAILED",
    "generationMode must be live_preview or local_fallback."
  );
}

function domainKeywordExpansionsFromBody(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "domainKeywordExpansions must be an object.");
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([keyword, expansions]) => [
      keyword,
      optionalStringArrayFromBody(expansions, `domainKeywordExpansions.${keyword}`) ?? []
    ])
  );
}

function stringArrayFromBody(value: unknown, fieldName: string) {
  const strings = optionalStringArrayFromBody(value, fieldName);

  if (!strings) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be an array of non-empty strings.`);
  }

  return strings;
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

function projectPurposeModeFromBody(value: unknown, fieldName = "projectPurposeMode"): ProjectPurposeMode {
  const mode = stringFromBody(value, fieldName);

  if (!PROJECT_PURPOSE_MODES.includes(mode as ProjectPurposeMode)) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be business or personal.`);
  }

  return mode as ProjectPurposeMode;
}

function optionalProjectPurposeModeFromBody(value: unknown, fieldName = "projectPurposeMode") {
  if (value === undefined || value === null) {
    return undefined;
  }

  return projectPurposeModeFromBody(value, fieldName);
}

function businessCriticIntensityFromBody(
  value: unknown,
  fieldName = "businessCriticIntensity"
): BusinessCriticIntensity {
  const intensity = stringFromBody(value, fieldName);

  if (!BUSINESS_CRITIC_INTENSITIES.includes(intensity as BusinessCriticIntensity)) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      `${fieldName} must be balanced, strong, or investor_grade.`
    );
  }

  return intensity as BusinessCriticIntensity;
}

function optionalBusinessCriticIntensityFromBody(value: unknown, fieldName = "businessCriticIntensity") {
  if (value === undefined || value === null) {
    return undefined;
  }

  return businessCriticIntensityFromBody(value, fieldName);
}

function researchAutomationPermissionFromBody(
  value: unknown,
  fieldName = "initialResearchAutomationPermission"
): ResearchAutomationPermission {
  const permission = stringFromBody(value, fieldName);

  if (!RESEARCH_AUTOMATION_PERMISSIONS.includes(permission as ResearchAutomationPermission)) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      `${fieldName} must be manual_only, allow_codex, or allow_codex_and_chatgpt_visible.`
    );
  }

  return permission as ResearchAutomationPermission;
}

function optionalResearchAutomationPermissionFromBody(
  value: unknown,
  fieldName = "initialResearchAutomationPermission"
) {
  if (value === undefined || value === null) {
    return undefined;
  }

  return researchAutomationPermissionFromBody(value, fieldName);
}

function generatedQuestionSetContextHash(input: Readonly<Record<string, unknown>>) {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 32);
}

function generatedQuestionSetUnavailableResponse(reason: string) {
  return {
    status: "unavailable",
    promptTemplateRef: GENERATED_AMBIGUITY_QUESTION_PROMPT_TEMPLATE_REF,
    schemaVersion: GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
    source: "codex_runtime_unavailable",
    reason
  } as const;
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message.trim().length > 0 ? error.message.trim() : String(error);
}

function generatedQuestionSetPreviewFailureReason(error: unknown) {
  if (error instanceof CodexRuntimeUnavailableError || error instanceof CodexRuntimeTimeoutError) {
    return error.message;
  }

  const message = errorMessage(error);

  return message && message !== "[object Object]"
    ? `Codex live preview failed before producing a usable question artifact: ${message}`
    : "Codex live preview failed before producing a usable question artifact.";
}

function generatedQuestionSetLocalFallback(input: {
  readonly rawIdea: string;
  readonly intakeGoal: string;
  readonly businessCriticIntensity?: string | null;
}) {
  const context = [input.rawIdea, input.intakeGoal].filter(Boolean).join(" ").trim();
  const ideaLabel = (input.rawIdea || context || "이 아이디어").slice(0, 80);
  const pressureMinimum =
    input.businessCriticIntensity === "investor_grade"
      ? "investor_grade"
      : input.businessCriticIntensity === "strong"
        ? "strong"
        : "balanced";
  const pressureKind =
    pressureMinimum === "investor_grade"
      ? "investor_pressure_pass"
      : pressureMinimum === "strong"
        ? "core_assumption_challenge"
        : "balanced_con";

  return {
    schemaVersion: GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
    sourceSummary: ideaLabel,
    questions: [
      {
        sectionRef: "Target Customer",
        topicKey: "first_user_situation",
        uncertaintyType: "decision_required",
        severity: "high",
        summary: "첫 사용자 상황이 아직 넓습니다.",
        whyItMatters: `${ideaLabel}에서 누구의 어떤 순간을 먼저 돕는지 정해야 질문, 리서치, 첫 화면이 좁혀집니다.`,
        questionText: `${ideaLabel}에서 가장 먼저 좁힐 실제 사용자 상황은 무엇인가요?`,
        expectedAnswerType: "text",
        answerOptions: [],
        decisionItUnlocks: "첫 인터뷰 대상과 첫 문제 문장을 좁힙니다.",
        ambiguityDimension: "scope",
        ambiguityRoutingPath: "human_judgment",
        possibleRoutes: ["question", "decision_candidate"]
      },
      {
        sectionRef: "MVP Scope",
        topicKey: "first_version_scope",
        uncertaintyType: "vague",
        severity: "high",
        summary: "첫 버전 범위가 아직 넓습니다.",
        whyItMatters: `${ideaLabel}의 첫 버전 범위가 넓으면 사용자가 실제로 달라지는 한 가지 결정을 확인하기 어렵습니다.`,
        questionText: `${ideaLabel} 첫 버전에서 반드시 도울 결정 하나와 일부러 빼는 결정은 무엇인가요?`,
        expectedAnswerType: "text",
        answerOptions: [],
        decisionItUnlocks: "첫 기능 범위와 제외할 범위를 나눕니다.",
        ambiguityDimension: "scope",
        ambiguityRoutingPath: "human_judgment",
        possibleRoutes: ["question", "decision_candidate"]
      },
      {
        sectionRef: "Success Criteria",
        topicKey: "this_week_success_signal",
        uncertaintyType: "missing",
        severity: "high",
        summary: "이번 주 성공 기준이 아직 없습니다.",
        whyItMatters: `${ideaLabel}를 계속 만들지 판단하려면 말이 아니라 실제 행동으로 볼 기준이 필요합니다.`,
        questionText: `${ideaLabel} 이번 주 검증에서 어떤 사용자 행동이 나오면 계속 만들 기준으로 볼 건가요?`,
        expectedAnswerType: "text",
        answerOptions: [],
        decisionItUnlocks: "이번 주 검증 액션과 통과 기준을 정합니다.",
        ambiguityDimension: "success_criteria",
        ambiguityRoutingPath: "human_judgment",
        possibleRoutes: ["question", "decision_candidate"]
      },
      {
        sectionRef: "Current Alternatives",
        topicKey: "existing_alternative_counterexample",
        uncertaintyType: "missing_con_evidence",
        severity: "medium",
        summary: "기존 대체재로 충분하다는 반례가 필요합니다.",
        whyItMatters: `${ideaLabel}가 기존 방법보다 나은 이유가 약하면 첫 고객과 첫 기능을 다시 좁혀야 합니다.`,
        questionText: `${ideaLabel} 사용자가 기존 방법으로 충분하다고 말한다면 어떤 반례 때문에 계획을 바꿔야 하나요?`,
        expectedAnswerType: "text",
        answerOptions: [],
        decisionItUnlocks: "버릴 선택지와 유지할 가정을 분리합니다.",
        ambiguityDimension: "assumption_pressure",
        ambiguityRoutingPath: "current_research",
        businessCriticPressureKind: pressureKind,
        businessCriticIntensityMinimum: pressureMinimum,
        researchQuestion: `${ideaLabel}의 기존 대체재, 공개 후기, 커뮤니티 반응에서 새 도구가 필요 없다는 근거를 확인합니다.`,
        possibleRoutes: ["question", "research_needed", "missing_con_evidence"],
        suggestedResearchTask: `${ideaLabel} 관련 공개 커뮤니티, 후기, 가격, 경쟁/대체재 자료에서 기존 방법으로 충분하다는 반례를 찾고, 어떤 근거가 이 가정을 약하게 만드는지와 리서치로 정할 수 없는 남은 사용자 판단을 분리합니다.`
      }
    ]
  };
}

function parsedGeneratedQuestionSetLocalFallback(input: {
  readonly rawIdea: string;
  readonly intakeGoal: string;
  readonly businessCriticIntensity?: string | null;
  readonly contextText: string;
}) {
  const fallbackQuestionSet = generatedQuestionSetLocalFallback(input);
  const fallbackParsed = parseGeneratedAmbiguityQuestionSet(fallbackQuestionSet, {
    contextText: input.contextText
  });

  return {
    fallbackQuestionSet,
    fallbackParsed
  };
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

function optionalResearchSourceReliabilityFromBody(
  value: unknown,
  fieldName: string
): ResearchSourceReliability | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (value === "high" || value === "medium" || value === "low" || value === "unknown") {
    return value;
  }

  throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be high, medium, low, or unknown.`);
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

function researchQueueTerminalOutcomeFromBody(value: unknown) {
  if (
    value === "approved" ||
    value === "revised" ||
    value === "rejected" ||
    value === "deferred" ||
    value === "risk_accepted" ||
    value === "research_insufficient"
  ) {
    return value as ResearchQueueTerminalOutcome;
  }

  throw new ProductEngineServiceError("VALIDATION_FAILED", "outcome must be a canonical research queue terminal outcome.");
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

function isBackgroundResearchAdapterKind(value: string): value is BackgroundResearchAdapterKind {
  return (BACKGROUND_RESEARCH_ADAPTER_KINDS as readonly string[]).includes(value);
}

function adapterKindFromBody(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const adapterKind = stringFromBody(value, "adapterKind");

  if (!isBackgroundResearchAdapterKind(adapterKind)) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "adapterKind must be a provider-neutral adapter kind.");
  }

  return adapterKind;
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

function booleanFromBody(value: unknown, fieldName: string) {
  if (typeof value !== "boolean") {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be a boolean.`);
  }

  return value;
}

const PLANNING_HANDOFF_REQUEST_BODY_KEYS = [
  "scaffoldOnly",
  "sessionId",
  "expectedStateVersion",
  "sourceRefs",
  "requestedScope"
] as const satisfies readonly (keyof CreatePlanningHandoffRequest)[];
const PLANNING_HANDOFF_SOURCE_REF_KEYS = [
  "sourceType",
  "sourceId",
  "sourceLabel",
  "required",
  "stale"
] as const satisfies readonly (keyof PlanningHandoffSourceRefDto)[];
const PLANNING_HANDOFF_REQUESTED_SCOPE_KEYS = [
  "productSlice",
  "userFacingJourneyLabel",
  "nonGoals",
  "excludedInternalPhases",
  "assumptions"
] as const satisfies readonly (keyof PlanningHandoffRequestedScopeDto)[];
const PLANNING_HANDOFF_EXECUTION_INTENT_KEY_PATTERN =
  /(?:execution|execute|file|shell|browser|deploy|credential|external(?:_|-)?mutation|write|command|patch)/iu;

function assertPlanningHandoffScaffoldOnly(value: unknown) {
  if (value !== undefined && value !== true) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "scaffoldOnly must be true when provided.", {
      fieldName: "scaffoldOnly"
    });
  }
}

function assertPlanningHandoffRecordKeys(
  record: Readonly<Record<string, unknown>>,
  allowedKeys: readonly string[],
  fieldName: string
) {
  const unsupportedKey = Object.keys(record).find((key) => !allowedKeys.includes(key));

  if (!unsupportedKey) {
    return;
  }

  const intentLabel = PLANNING_HANDOFF_EXECUTION_INTENT_KEY_PATTERN.test(unsupportedKey)
    ? " execution-intent"
    : "";

  throw new ProductEngineServiceError(
    "VALIDATION_FAILED",
    `${fieldName} includes unsupported${intentLabel} key "${unsupportedKey}".`,
    {
      fieldName,
      unsupportedKey,
      allowedKeys
    }
  );
}

function planningHandoffSourceRefFromBody(value: unknown, fieldName: string): PlanningHandoffSourceRefDto {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be a PlanningHandoffSourceRefDto object.`);
  }

  const sourceRef = value as Readonly<Record<string, unknown>>;

  assertPlanningHandoffRecordKeys(sourceRef, PLANNING_HANDOFF_SOURCE_REF_KEYS, fieldName);

  const sourceLabel = optionalStringFromBody(sourceRef.sourceLabel, `${fieldName}.sourceLabel`);

  return {
    sourceType: stringFromBody(sourceRef.sourceType, `${fieldName}.sourceType`) as PlanningHandoffSourceRefDto["sourceType"],
    sourceId: stringFromBody(sourceRef.sourceId, `${fieldName}.sourceId`),
    ...(sourceLabel ? { sourceLabel } : {}),
    required: booleanFromBody(sourceRef.required, `${fieldName}.required`),
    stale: booleanFromBody(sourceRef.stale, `${fieldName}.stale`)
  };
}

function planningHandoffSourceRefsFromBody(value: unknown): readonly PlanningHandoffSourceRefDto[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "sourceRefs must include at least one Planning Handoff source ref.");
  }

  return value.map((sourceRef, index) => planningHandoffSourceRefFromBody(sourceRef, `sourceRefs[${index}]`));
}

function optionalPlanningHandoffRequestedScopeFromBody(value: unknown): PlanningHandoffRequestedScopeDto | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "requestedScope must be a PlanningHandoffRequestedScopeDto object.");
  }

  const requestedScope = value as Readonly<Record<string, unknown>>;

  assertPlanningHandoffRecordKeys(
    requestedScope,
    PLANNING_HANDOFF_REQUESTED_SCOPE_KEYS,
    "requestedScope"
  );

  return requestedScope as unknown as PlanningHandoffRequestedScopeDto;
}

function createPlanningHandoffRequestFromBody(
  routeSessionId: SessionId,
  body: Readonly<Record<string, unknown>>
): CreatePlanningHandoffRequest {
  assertPlanningHandoffRecordKeys(body, PLANNING_HANDOFF_REQUEST_BODY_KEYS, "Planning Handoff request body");
  assertPlanningHandoffScaffoldOnly(body.scaffoldOnly);

  const bodySessionId = stringFromBody(body.sessionId, "sessionId") as SessionId;

  if (bodySessionId !== routeSessionId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "sessionId must match the route param.", {
      routeSessionId,
      bodySessionId
    });
  }

  const requestedScope = optionalPlanningHandoffRequestedScopeFromBody(body.requestedScope);

  return {
    sessionId: routeSessionId,
    expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
    sourceRefs: planningHandoffSourceRefsFromBody(body.sourceRefs),
    ...(requestedScope ? { requestedScope } : {})
  };
}

function requiredJsonObjectFromBody(value: unknown, fieldName: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be a JSON object.`);
  }

  return value as Readonly<Record<string, unknown>>;
}

function assertAllowedRecordKeys(
  record: Readonly<Record<string, unknown>>,
  allowedKeys: readonly string[],
  fieldName: string
) {
  const unsupportedKey = Object.keys(record).find((key) => !allowedKeys.includes(key));

  if (unsupportedKey) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} includes unsupported key "${unsupportedKey}".`, {
      fieldName,
      unsupportedKey,
      allowedKeys
    });
  }
}

const EXECUTION_AUTHORITY_REQUEST_BODY_KEYS = [
  "scaffoldOnly",
  "sessionId",
  "expectedStateVersion",
  "idempotencyKey",
  "sourcePlanningHandoffRef",
  "boundedAgentOutput",
  "actionClass",
  "previewArtifactRef",
  "previewArtifactHash",
  "reviewedPreviewArtifactHash",
  "requestedScope",
  "approvalDecision",
  "approver",
  "sandboxBoundary",
  "rollbackReference",
  "evidenceRefs",
  "auditRefs",
  "preconditionChecks"
] as const satisfies readonly (keyof CreateExecutionAuthorityRequest)[];
const EXECUTION_AUTHORITY_BOUNDED_OUTPUT_KEYS = [
  "outputId",
  "sourceRefs",
  "intendedDecisionImpact",
  "proposedActionPreviewRefs",
  "requiredApprovals",
  "evidenceRefs",
  "failureMode",
  "noExecutionPolicy"
] as const satisfies readonly (keyof BoundedAgentOutputRecord)[];
const EXECUTION_AUTHORITY_REQUESTED_SCOPE_KEYS = [
  "workspaceRef",
  "commandAllowlistRef",
  "browserTargetRef",
  "servicePagePermissionId",
  "servicePageActionClass",
  "serviceOrigin",
  "servicePageUrl",
  "filePathGlobs",
  "maxDurationMs"
] as const satisfies readonly (keyof ExecutionAuthorityRequestedScope)[];
const EXECUTION_AUTHORITY_APPROVER_KEYS = [
  "actorId",
  "actorType",
  "approvedAt",
  "decidedAt"
] as const satisfies readonly (keyof ExecutionAuthorityApprover)[];
const EXECUTION_AUTHORITY_SANDBOX_KEYS = [
  "mode",
  "networkPolicy",
  "secretPolicy"
] as const satisfies readonly (keyof ExecutionSandboxBoundary)[];
const EXECUTION_AUTHORITY_ROLLBACK_KEYS = [
  "kind",
  "ref"
] as const satisfies readonly (keyof ExecutionRollbackReference)[];
const EXECUTION_AUTHORITY_PRECONDITION_KEYS = [
  "planningSourceExists",
  "previewArtifactExists",
  "previewHashMatches",
  "rollbackAvailable",
  "credentialValueRequired",
  "sandboxEnforced"
] as const satisfies readonly (keyof ExecutionAuthorityPreconditionChecks)[];
const EXECUTION_AUTHORITY_PREFLIGHT_KEYS = [
  "scaffoldOnly",
  "sessionId",
  "idempotencyKey",
  "actionClass",
  "previewArtifactHash",
  "requestedAt",
  "approvalExpiresAt"
] as const satisfies readonly (keyof ValidateExecutionAuthorityPreflightRequest)[];
const FILE_DIFF_EXECUTION_KEYS = [
  "scaffoldOnly",
  "sessionId",
  "idempotencyKey",
  "previewArtifactHash",
  "requestedAt",
  "approvalExpiresAt",
  "workspaceRoot",
  "unifiedDiff"
] as const;
const SHELL_COMMAND_EXECUTION_KEYS = [
  "scaffoldOnly",
  "sessionId",
  "idempotencyKey",
  "previewArtifactHash",
  "requestedAt",
  "approvalExpiresAt",
  "workspaceRoot",
  "command",
  "workingDirectory"
] as const;
const BROWSER_ACTION_EXECUTION_KEYS = [
  "scaffoldOnly",
  "sessionId",
  "idempotencyKey",
  "previewArtifactHash",
  "requestedAt",
  "approvalExpiresAt",
  "targetUrl",
  "action",
  "servicePagePermissionId",
  "servicePageActionClass"
] as const;
const SERVICE_PAGE_USE_PERMISSION_REQUEST_BODY_KEYS = [
  "scaffoldOnly",
  "sessionId",
  "expectedStateVersion",
  "idempotencyKey",
  "serviceName",
  "serviceOrigin",
  "pageUrl",
  "purpose",
  "allowedActionClasses",
  "blockedActionClasses",
  "dataCategories",
  "approvalGranularity",
  "approvalDecision",
  "userApprovalRef",
  "promptPreviewRef",
  "redactionPreviewRef",
  "userExportDeleteControls",
  "finalSubmitRequested",
  "finalSubmitConfirmationRef",
  "finalSubmitExecutionAuthorityRef",
  "screenshotRefs",
  "logRefs",
  "evidenceRefs",
  "auditRefs",
  "activityFeedRefs"
] as const satisfies readonly (keyof CreateServicePageUsePermissionRequest)[];
const SERVICE_PAGE_USE_PERMISSION_REVOKE_REQUEST_BODY_KEYS = [
  "scaffoldOnly",
  "sessionId",
  "expectedStateVersion",
  "idempotencyKey",
  "permissionId",
  "reason",
  "auditRefs"
] as const satisfies readonly (keyof RevokeServicePageUsePermissionRequest)[];
const SERVICE_PAGE_USE_PERMISSION_ARTIFACT_DELETE_REQUEST_BODY_KEYS = [
  "scaffoldOnly",
  "sessionId",
  "expectedStateVersion",
  "idempotencyKey",
  "permissionId",
  "reason",
  "auditRefs"
] as const satisfies readonly (keyof DeleteServicePageUsePermissionArtifactsRequest)[];
const BROWSER_ACTION_PREVIEW_KEYS = [
  "kind",
  "visibleAction",
  "credentialMode",
  "externalMutation"
] as const satisfies readonly (keyof BrowserActionPreviewDto)[];

function executionAuthorityActionClassFromBody(value: unknown, fieldName: string): ExecutionAuthorityActionClass {
  const actionClass = stringFromBody(value, fieldName);

  if (!EXECUTION_AUTHORITY_ACTION_CLASSES.includes(actionClass as ExecutionAuthorityActionClass)) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be a Phase 3 execution action class.`);
  }

  return actionClass as ExecutionAuthorityActionClass;
}

function executionApprovalDecisionFromBody(value: unknown, fieldName: string): ExecutionApprovalDecision {
  const approvalDecision = stringFromBody(value, fieldName);

  if (!EXECUTION_APPROVAL_DECISIONS.includes(approvalDecision as ExecutionApprovalDecision)) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be a Phase 3 approval decision.`);
  }

  return approvalDecision as ExecutionApprovalDecision;
}

function boundedAgentOutputFromBody(value: unknown): BoundedAgentOutputRecord {
  const boundedAgentOutput = requiredJsonObjectFromBody(value, "boundedAgentOutput");

  assertAllowedRecordKeys(
    boundedAgentOutput,
    EXECUTION_AUTHORITY_BOUNDED_OUTPUT_KEYS,
    "boundedAgentOutput"
  );

  const failureMode = stringFromBody(boundedAgentOutput.failureMode, "boundedAgentOutput.failureMode");
  const noExecutionPolicy = stringFromBody(
    boundedAgentOutput.noExecutionPolicy,
    "boundedAgentOutput.noExecutionPolicy"
  );

  if (!BOUNDED_AGENT_FAILURE_MODES.includes(failureMode as BoundedAgentOutputRecord["failureMode"])) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "boundedAgentOutput.failureMode must be a Phase 3 bounded-agent failure mode."
    );
  }

  if (
    !BOUNDED_AGENT_NO_EXECUTION_POLICIES.includes(
      noExecutionPolicy as BoundedAgentOutputRecord["noExecutionPolicy"]
    )
  ) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "boundedAgentOutput.noExecutionPolicy must be a Phase 3 no-execution policy."
    );
  }

  const sourceRefs = stringArrayFromBody(boundedAgentOutput.sourceRefs, "boundedAgentOutput.sourceRefs");
  const proposedActionPreviewRefs = stringArrayFromBody(
    boundedAgentOutput.proposedActionPreviewRefs,
    "boundedAgentOutput.proposedActionPreviewRefs"
  );
  const requiredApprovals = stringArrayFromBody(
    boundedAgentOutput.requiredApprovals,
    "boundedAgentOutput.requiredApprovals"
  );
  const evidenceRefs = stringArrayFromBody(boundedAgentOutput.evidenceRefs, "boundedAgentOutput.evidenceRefs");

  if (failureMode === "ready_for_preview") {
    if (!sourceRefs.length) {
      throw new ProductEngineServiceError(
        "VALIDATION_FAILED",
        "boundedAgentOutput.sourceRefs must include at least one trace reference."
      );
    }

    if (!proposedActionPreviewRefs.length) {
      throw new ProductEngineServiceError(
        "VALIDATION_FAILED",
        "boundedAgentOutput.proposedActionPreviewRefs must include at least one trace reference."
      );
    }

    if (!requiredApprovals.length) {
      throw new ProductEngineServiceError(
        "VALIDATION_FAILED",
        "boundedAgentOutput.requiredApprovals must include at least one trace reference."
      );
    }

    if (!evidenceRefs.length) {
      throw new ProductEngineServiceError(
        "VALIDATION_FAILED",
        "boundedAgentOutput.evidenceRefs must include at least one trace reference."
      );
    }

    if (noExecutionPolicy !== "controlled_execution_required") {
      throw new ProductEngineServiceError(
        "VALIDATION_FAILED",
        "boundedAgentOutput.noExecutionPolicy must be controlled_execution_required when ready for preview."
      );
    }
  }

  return {
    outputId: stringFromBody(boundedAgentOutput.outputId, "boundedAgentOutput.outputId"),
    sourceRefs,
    intendedDecisionImpact: stringFromBody(
      boundedAgentOutput.intendedDecisionImpact,
      "boundedAgentOutput.intendedDecisionImpact"
    ),
    proposedActionPreviewRefs,
    requiredApprovals,
    evidenceRefs,
    failureMode: failureMode as BoundedAgentOutputRecord["failureMode"],
    noExecutionPolicy: noExecutionPolicy as BoundedAgentOutputRecord["noExecutionPolicy"]
  };
}

function optionalIsoTimestampFromBody(value: unknown, fieldName: string) {
  const timestamp = optionalStringFromBody(value, fieldName);

  if (timestamp && !isExecutionAuthorityIsoTimestamp(timestamp)) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be an ISO timestamp.`);
  }

  return timestamp;
}

function isoTimestampFromBody(value: unknown, fieldName: string) {
  const timestamp = stringFromBody(value, fieldName);

  if (!isExecutionAuthorityIsoTimestamp(timestamp)) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be an ISO timestamp.`);
  }

  return timestamp;
}

function optionalExecutionAuthorityApproverFromBody(value: unknown): ExecutionAuthorityApprover | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const approver = requiredJsonObjectFromBody(value, "approver");

  assertAllowedRecordKeys(approver, EXECUTION_AUTHORITY_APPROVER_KEYS, "approver");

  const actorType = stringFromBody(approver.actorType, "approver.actorType");
  const approvedAt = optionalIsoTimestampFromBody(approver.approvedAt, "approver.approvedAt");
  const decidedAt = optionalIsoTimestampFromBody(approver.decidedAt, "approver.decidedAt");

  if (actorType !== "user" && actorType !== "local_operator") {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "approver.actorType must be user or local_operator.");
  }

  return {
    actorId: stringFromBody(approver.actorId, "approver.actorId"),
    actorType,
    ...(approvedAt ? { approvedAt } : {}),
    ...(decidedAt ? { decidedAt } : {})
  };
}

function executionAuthorityRequestedScopeFromBody(value: unknown): ExecutionAuthorityRequestedScope {
  const requestedScope = requiredJsonObjectFromBody(value, "requestedScope");

  assertAllowedRecordKeys(requestedScope, EXECUTION_AUTHORITY_REQUESTED_SCOPE_KEYS, "requestedScope");

  const workspaceRef = optionalStringFromBody(requestedScope.workspaceRef, "requestedScope.workspaceRef");
  const commandAllowlistRef = optionalStringFromBody(
    requestedScope.commandAllowlistRef,
    "requestedScope.commandAllowlistRef"
  );
  const browserTargetRef = optionalStringFromBody(requestedScope.browserTargetRef, "requestedScope.browserTargetRef");
  const servicePagePermissionId = optionalStringFromBody(
    requestedScope.servicePagePermissionId,
    "requestedScope.servicePagePermissionId"
  );
  const servicePageActionClass = optionalStringFromBody(
    requestedScope.servicePageActionClass,
    "requestedScope.servicePageActionClass"
  );
  const serviceOrigin = optionalStringFromBody(requestedScope.serviceOrigin, "requestedScope.serviceOrigin");
  const servicePageUrl = optionalStringFromBody(requestedScope.servicePageUrl, "requestedScope.servicePageUrl");
  const filePathGlobs = optionalStringArrayFromBody(requestedScope.filePathGlobs, "requestedScope.filePathGlobs");
  const maxDurationMs = optionalPositiveIntegerFromBody(requestedScope.maxDurationMs, "requestedScope.maxDurationMs");

  if (
    servicePageActionClass !== undefined &&
    !SERVICE_PAGE_USE_PERMISSION_ACTION_CLASSES.includes(
      servicePageActionClass as (typeof SERVICE_PAGE_USE_PERMISSION_ACTION_CLASSES)[number]
    )
  ) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "requestedScope.servicePageActionClass must be a valid service page-use action class."
    );
  }

  const parsedServicePageActionClass = servicePageActionClass as
    | (typeof SERVICE_PAGE_USE_PERMISSION_ACTION_CLASSES)[number]
    | undefined;

  return {
    ...(workspaceRef ? { workspaceRef } : {}),
    ...(commandAllowlistRef ? { commandAllowlistRef } : {}),
    ...(browserTargetRef ? { browserTargetRef } : {}),
    ...(servicePagePermissionId ? { servicePagePermissionId } : {}),
    ...(parsedServicePageActionClass
      ? { servicePageActionClass: parsedServicePageActionClass }
      : {}),
    ...(serviceOrigin ? { serviceOrigin } : {}),
    ...(servicePageUrl ? { servicePageUrl } : {}),
    ...(filePathGlobs ? { filePathGlobs } : {}),
    ...(maxDurationMs ? { maxDurationMs } : {})
  };
}

function executionAuthoritySandboxBoundaryFromBody(value: unknown): ExecutionSandboxBoundary {
  const sandboxBoundary = requiredJsonObjectFromBody(value, "sandboxBoundary");

  assertAllowedRecordKeys(sandboxBoundary, EXECUTION_AUTHORITY_SANDBOX_KEYS, "sandboxBoundary");

  const mode = stringFromBody(sandboxBoundary.mode, "sandboxBoundary.mode");
  const networkPolicy = stringFromBody(sandboxBoundary.networkPolicy, "sandboxBoundary.networkPolicy");
  const secretPolicy = stringFromBody(sandboxBoundary.secretPolicy, "sandboxBoundary.secretPolicy");

  if (!EXECUTION_SANDBOX_MODES.includes(mode as ExecutionSandboxBoundary["mode"])) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "sandboxBoundary.mode must be a Phase 3 sandbox mode.");
  }

  if (!EXECUTION_NETWORK_POLICIES.includes(networkPolicy as ExecutionSandboxBoundary["networkPolicy"])) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "sandboxBoundary.networkPolicy must be a Phase 3 network policy.");
  }

  if (!EXECUTION_SECRET_POLICIES.includes(secretPolicy as ExecutionSandboxBoundary["secretPolicy"])) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "sandboxBoundary.secretPolicy must be a Phase 3 secret policy.");
  }

  return {
    mode: mode as ExecutionSandboxBoundary["mode"],
    networkPolicy: networkPolicy as ExecutionSandboxBoundary["networkPolicy"],
    secretPolicy: secretPolicy as ExecutionSandboxBoundary["secretPolicy"]
  };
}

function optionalExecutionAuthorityRollbackReferenceFromBody(value: unknown): ExecutionRollbackReference | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const rollbackReference = requiredJsonObjectFromBody(value, "rollbackReference");

  assertAllowedRecordKeys(rollbackReference, EXECUTION_AUTHORITY_ROLLBACK_KEYS, "rollbackReference");

  const kind = stringFromBody(rollbackReference.kind, "rollbackReference.kind");

  if (!EXECUTION_ROLLBACK_KINDS.includes(kind as ExecutionRollbackReference["kind"])) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "rollbackReference.kind must be a Phase 3 rollback kind.");
  }

  return {
    kind: kind as ExecutionRollbackReference["kind"],
    ref: stringFromBody(rollbackReference.ref, "rollbackReference.ref")
  };
}

function optionalExecutionAuthorityPreconditionChecksFromBody(
  value: unknown
): ExecutionAuthorityPreconditionChecks | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const preconditionChecks = requiredJsonObjectFromBody(value, "preconditionChecks");

  assertAllowedRecordKeys(preconditionChecks, EXECUTION_AUTHORITY_PRECONDITION_KEYS, "preconditionChecks");

  for (const [key, check] of Object.entries(preconditionChecks)) {
    if (typeof check !== "boolean") {
      throw new ProductEngineServiceError("VALIDATION_FAILED", `preconditionChecks.${key} must be a boolean.`);
    }
  }

  return preconditionChecks as unknown as ExecutionAuthorityPreconditionChecks;
}

function createExecutionAuthorityRequestFromBody(
  routeSessionId: SessionId,
  body: Readonly<Record<string, unknown>>
): CreateExecutionAuthorityRequest {
  assertAllowedRecordKeys(body, EXECUTION_AUTHORITY_REQUEST_BODY_KEYS, "Execution Authority request body");

  if (body.scaffoldOnly !== undefined && body.scaffoldOnly !== true) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "scaffoldOnly must be true when provided.");
  }

  const bodySessionId = stringFromBody(body.sessionId, "sessionId") as SessionId;
  const approver = optionalExecutionAuthorityApproverFromBody(body.approver);
  const rollbackReference = optionalExecutionAuthorityRollbackReferenceFromBody(body.rollbackReference);
  const evidenceRefs = optionalStringArrayFromBody(body.evidenceRefs, "evidenceRefs");
  const auditRefs = optionalStringArrayFromBody(body.auditRefs, "auditRefs");
  const preconditionChecks = optionalExecutionAuthorityPreconditionChecksFromBody(body.preconditionChecks);
  const sourcePlanningHandoffRef = optionalStringFromBody(
    body.sourcePlanningHandoffRef,
    "sourcePlanningHandoffRef"
  );
  const previewArtifactRef = optionalStringFromBody(body.previewArtifactRef, "previewArtifactRef");
  const previewArtifactHash = optionalStringFromBody(body.previewArtifactHash, "previewArtifactHash");
  const reviewedPreviewArtifactHash = optionalStringFromBody(
    body.reviewedPreviewArtifactHash,
    "reviewedPreviewArtifactHash"
  );

  if (bodySessionId !== routeSessionId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "sessionId must match the route param.", {
      routeSessionId,
      bodySessionId
    });
  }

  return {
    sessionId: routeSessionId,
    expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
    idempotencyKey: stringFromBody(body.idempotencyKey, "idempotencyKey"),
    ...(sourcePlanningHandoffRef ? { sourcePlanningHandoffRef } : {}),
    boundedAgentOutput: boundedAgentOutputFromBody(body.boundedAgentOutput),
    actionClass: executionAuthorityActionClassFromBody(body.actionClass, "actionClass"),
    ...(previewArtifactRef ? { previewArtifactRef } : {}),
    ...(previewArtifactHash ? { previewArtifactHash } : {}),
    ...(reviewedPreviewArtifactHash ? { reviewedPreviewArtifactHash } : {}),
    requestedScope: executionAuthorityRequestedScopeFromBody(body.requestedScope),
    approvalDecision: executionApprovalDecisionFromBody(body.approvalDecision, "approvalDecision"),
    ...(approver ? { approver } : {}),
    sandboxBoundary: executionAuthoritySandboxBoundaryFromBody(body.sandboxBoundary),
    ...(rollbackReference ? { rollbackReference } : {}),
    ...(evidenceRefs ? { evidenceRefs } : {}),
    ...(auditRefs ? { auditRefs } : {}),
    ...(preconditionChecks ? { preconditionChecks } : {})
  };
}

function executionAuthorityPayloadFromRequest(
  request: CreateExecutionAuthorityRequest
): Readonly<Record<string, unknown>> {
  const payload = {
    ...(request.sourcePlanningHandoffRef ? { sourcePlanningHandoffRef: request.sourcePlanningHandoffRef } : {}),
    boundedAgentOutput: request.boundedAgentOutput,
    actionClass: request.actionClass,
    ...(request.previewArtifactRef ? { previewArtifactRef: request.previewArtifactRef } : {}),
    ...(request.previewArtifactHash ? { previewArtifactHash: request.previewArtifactHash } : {}),
    ...(request.reviewedPreviewArtifactHash ? { reviewedPreviewArtifactHash: request.reviewedPreviewArtifactHash } : {}),
    requestedScope: request.requestedScope,
    approvalDecision: request.approvalDecision,
    ...(request.approver ? { approver: request.approver } : {}),
    sandboxBoundary: request.sandboxBoundary,
    ...(request.rollbackReference ? { rollbackReference: request.rollbackReference } : {}),
    ...(request.evidenceRefs ? { evidenceRefs: request.evidenceRefs } : {}),
    ...(request.auditRefs ? { auditRefs: request.auditRefs } : {}),
    ...(request.preconditionChecks ? { preconditionChecks: request.preconditionChecks } : {})
  } satisfies CreateExecutionAuthorityPayload;

  return payload;
}

function createChatGptBrowserDelegationRunRequestFromBody(
  routeSessionId: SessionId,
  body: Readonly<Record<string, unknown>>
): CreateChatGptBrowserDelegationRunRequest {
  assertAllowedRecordKeys(
    body,
    CHATGPT_BROWSER_DELEGATION_CREATE_REQUEST_KEYS,
    "ChatGPT browser delegation request body"
  );

  if (body.scaffoldOnly !== undefined && body.scaffoldOnly !== true) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "scaffoldOnly must be true when provided.");
  }

  const bodySessionId = stringFromBody(body.sessionId, "sessionId") as SessionId;

  if (bodySessionId !== routeSessionId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "sessionId must match the route param.", {
      routeSessionId,
      bodySessionId
    });
  }

  const browserActionAuthorityRef = optionalStringFromBody(
    body.browserActionAuthorityRef,
    "browserActionAuthorityRef"
  );
  const status = optionalChatGptDelegationStatusFromBody(body.status, "status");
  const userVisibleExplanation = optionalStringFromBody(
    body.userVisibleExplanation,
    "userVisibleExplanation"
  );
  const nextAction = optionalStringFromBody(body.nextAction, "nextAction");
  const resultImportRef = optionalStringFromBody(body.resultImportRef, "resultImportRef") as ResearchResultId | undefined;
  const resultImportGate = body.resultImportGate === undefined
    ? undefined
    : (requiredJsonObjectFromBody(
        body.resultImportGate,
        "resultImportGate"
      ) as unknown as NonNullable<CreateChatGptBrowserDelegationRunRequest["resultImportGate"]>);
  const fallbackApplied = body.fallbackApplied === undefined
    ? undefined
    : (requiredJsonObjectFromBody(
        body.fallbackApplied,
        "fallbackApplied"
      ) as unknown as NonNullable<CreateChatGptBrowserDelegationRunRequest["fallbackApplied"]>);
  const screenshotRefs = optionalStringArrayFromBody(body.screenshotRefs, "screenshotRefs");
  const logRefs = optionalStringArrayFromBody(body.logRefs, "logRefs");
  const auditRefs = optionalStringArrayFromBody(body.auditRefs, "auditRefs");
  const activityFeedRefs = optionalStringArrayFromBody(body.activityFeedRefs, "activityFeedRefs");

  return {
    sessionId: routeSessionId,
    expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
    idempotencyKey: stringFromBody(body.idempotencyKey, "idempotencyKey"),
    researchTaskId: stringFromBody(body.researchTaskId, "researchTaskId") as ResearchTaskId,
    ...(status !== undefined ? { status } : {}),
    ...(userVisibleExplanation !== undefined ? { userVisibleExplanation } : {}),
    ...(nextAction !== undefined ? { nextAction } : {}),
    promptPreviewRef: stringFromBody(body.promptPreviewRef, "promptPreviewRef"),
    dataDisclosurePreview: requiredJsonObjectFromBody(
      body.dataDisclosurePreview,
      "dataDisclosurePreview"
    ) as unknown as CreateChatGptBrowserDelegationRunRequest["dataDisclosurePreview"],
    redactionSummary: requiredJsonObjectFromBody(
      body.redactionSummary,
      "redactionSummary"
    ) as unknown as CreateChatGptBrowserDelegationRunRequest["redactionSummary"],
    policyRiskVerdict: requiredJsonObjectFromBody(
      body.policyRiskVerdict,
      "policyRiskVerdict"
    ) as unknown as CreateChatGptBrowserDelegationRunRequest["policyRiskVerdict"],
    sessionOwnershipVerdict: requiredJsonObjectFromBody(
      body.sessionOwnershipVerdict,
      "sessionOwnershipVerdict"
    ) as unknown as CreateChatGptBrowserDelegationRunRequest["sessionOwnershipVerdict"],
    approvalDecision: chatGptDelegationApprovalDecisionFromBody(body.approvalDecision, "approvalDecision"),
    ...(browserActionAuthorityRef !== undefined ? { browserActionAuthorityRef } : {}),
    ...(resultImportRef !== undefined ? { resultImportRef } : {}),
    ...(resultImportGate !== undefined ? { resultImportGate } : {}),
    ...(fallbackApplied !== undefined ? { fallbackApplied } : {}),
    ...(screenshotRefs ? { screenshotRefs } : {}),
    ...(logRefs ? { logRefs } : {}),
    ...(auditRefs ? { auditRefs } : {}),
    ...(activityFeedRefs ? { activityFeedRefs } : {})
  };
}

function optionalChatGptDelegationStatusFromBody(
  value: unknown,
  fieldName: string
): CreateChatGptBrowserDelegationRunRequest["status"] {
  const status = optionalStringFromBody(value, fieldName);

  if (status === undefined) {
    return undefined;
  }

  if (!isChatGptBrowserDelegationStatus(status)) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      `${fieldName} must be a valid ChatGPT browser delegation status.`
    );
  }

  return status as CreateChatGptBrowserDelegationRunRequest["status"];
}

function chatGptDelegationApprovalDecisionFromBody(
  value: unknown,
  fieldName: string
): CreateChatGptBrowserDelegationRunRequest["approvalDecision"] {
  const approvalDecision = stringFromBody(value, fieldName);

  if (!isChatGptBrowserDelegationApprovalDecision(approvalDecision)) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      `${fieldName} must be a valid ChatGPT browser delegation approval decision.`
    );
  }

  return approvalDecision;
}

function chatGptBrowserDelegationPayloadFromRequest(
  request: CreateChatGptBrowserDelegationRunRequest
): Readonly<Record<string, unknown>> {
  const payload = {
    researchTaskId: request.researchTaskId,
    ...(request.status ? { status: request.status } : {}),
    ...(request.userVisibleExplanation ? { userVisibleExplanation: request.userVisibleExplanation } : {}),
    ...(request.nextAction ? { nextAction: request.nextAction } : {}),
    promptPreviewRef: request.promptPreviewRef,
    dataDisclosurePreview: request.dataDisclosurePreview,
    redactionSummary: request.redactionSummary,
    policyRiskVerdict: request.policyRiskVerdict,
    sessionOwnershipVerdict: request.sessionOwnershipVerdict,
    approvalDecision: request.approvalDecision,
    ...(request.browserActionAuthorityRef ? { browserActionAuthorityRef: request.browserActionAuthorityRef } : {}),
    ...(request.resultImportRef ? { resultImportRef: request.resultImportRef } : {}),
    ...(request.resultImportGate ? { resultImportGate: request.resultImportGate } : {}),
    ...(request.fallbackApplied ? { fallbackApplied: request.fallbackApplied } : {}),
    ...(request.screenshotRefs ? { screenshotRefs: request.screenshotRefs } : {}),
    ...(request.logRefs ? { logRefs: request.logRefs } : {}),
    ...(request.auditRefs ? { auditRefs: request.auditRefs } : {}),
    ...(request.activityFeedRefs ? { activityFeedRefs: request.activityFeedRefs } : {})
  } satisfies CreateChatGptBrowserDelegationRunPayload;

  return payload;
}

function revokeChatGptBrowserDelegationRunRequestFromBody(
  routeSessionId: SessionId,
  routeRunId: string,
  body: Readonly<Record<string, unknown>>
): RevokeChatGptBrowserDelegationRunRequest {
  assertAllowedRecordKeys(
    body,
    CHATGPT_BROWSER_DELEGATION_REVOKE_REQUEST_KEYS,
    "ChatGPT browser delegation revoke request body"
  );

  if (body.scaffoldOnly !== undefined && body.scaffoldOnly !== true) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "scaffoldOnly must be true when provided.");
  }

  const bodySessionId = stringFromBody(body.sessionId, "sessionId") as SessionId;
  const bodyRunId = stringFromBody(body.runId, "runId");

  if (bodySessionId !== routeSessionId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "sessionId must match the route param.", {
      routeSessionId,
      bodySessionId
    });
  }

  if (bodyRunId !== routeRunId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "runId must match the route param.", {
      routeRunId,
      bodyRunId
    });
  }

  const auditRefs = optionalStringArrayFromBody(body.auditRefs, "auditRefs");

  return {
    sessionId: routeSessionId,
    expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
    idempotencyKey: stringFromBody(body.idempotencyKey, "idempotencyKey"),
    runId: routeRunId,
    reason: stringFromBody(body.reason, "reason"),
    ...(auditRefs ? { auditRefs } : {})
  };
}

function typedStringArrayFromBody<TValue extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: readonly TValue[]
): readonly TValue[] {
  const values = stringArrayFromBody(value, fieldName);

  if (!values.every((item): item is TValue => allowedValues.includes(item as TValue))) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      `${fieldName} includes an unsupported value.`
    );
  }

  return [...new Set(values)] as readonly TValue[];
}

function optionalBooleanFromBody(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be a boolean.`);
  }

  return value;
}

function servicePageUsePermissionRequestFromBody(
  routeSessionId: SessionId,
  body: Readonly<Record<string, unknown>>
): CreateServicePageUsePermissionRequest {
  assertAllowedRecordKeys(
    body,
    SERVICE_PAGE_USE_PERMISSION_REQUEST_BODY_KEYS,
    "service page-use permission request body"
  );

  if (body.scaffoldOnly !== undefined && body.scaffoldOnly !== true) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "scaffoldOnly must be true when provided.");
  }

  const bodySessionId = stringFromBody(body.sessionId, "sessionId") as SessionId;

  if (bodySessionId !== routeSessionId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "sessionId must match the route param.", {
      routeSessionId,
      bodySessionId
    });
  }

  const finalSubmitRequested = optionalBooleanFromBody(body.finalSubmitRequested, "finalSubmitRequested");
  const finalSubmitConfirmationRef = optionalStringFromBody(
    body.finalSubmitConfirmationRef,
    "finalSubmitConfirmationRef"
  );
  const finalSubmitExecutionAuthorityRef = optionalStringFromBody(
    body.finalSubmitExecutionAuthorityRef,
    "finalSubmitExecutionAuthorityRef"
  );
  const approvalGranularity = stringFromBody(body.approvalGranularity, "approvalGranularity");
  const approvalDecision = stringFromBody(body.approvalDecision, "approvalDecision");

  if (
    !SERVICE_PAGE_USE_PERMISSION_APPROVAL_GRANULARITIES.includes(
      approvalGranularity as (typeof SERVICE_PAGE_USE_PERMISSION_APPROVAL_GRANULARITIES)[number]
    )
  ) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "approvalGranularity must be a valid service page-use approval granularity."
    );
  }

  if (approvalDecision !== "approved") {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "approvalDecision must be approved after the user previews the service page-use permission."
    );
  }

  const screenshotRefs = optionalStringArrayFromBody(body.screenshotRefs, "screenshotRefs");
  const logRefs = optionalStringArrayFromBody(body.logRefs, "logRefs");
  const evidenceRefs = optionalStringArrayFromBody(body.evidenceRefs, "evidenceRefs");
  const auditRefs = optionalStringArrayFromBody(body.auditRefs, "auditRefs");
  const activityFeedRefs = optionalStringArrayFromBody(body.activityFeedRefs, "activityFeedRefs");

  return {
    sessionId: routeSessionId,
    expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
    idempotencyKey: stringFromBody(body.idempotencyKey, "idempotencyKey"),
    serviceName: stringFromBody(body.serviceName, "serviceName"),
    serviceOrigin: stringFromBody(body.serviceOrigin, "serviceOrigin"),
    pageUrl: stringFromBody(body.pageUrl, "pageUrl"),
    purpose: stringFromBody(body.purpose, "purpose"),
    allowedActionClasses: typedStringArrayFromBody(
      body.allowedActionClasses,
      "allowedActionClasses",
      SERVICE_PAGE_USE_PERMISSION_ACTION_CLASSES
    ),
    blockedActionClasses: typedStringArrayFromBody(
      body.blockedActionClasses,
      "blockedActionClasses",
      SERVICE_PAGE_USE_PERMISSION_BLOCKED_ACTION_CLASSES
    ),
    dataCategories: typedStringArrayFromBody(
      body.dataCategories,
      "dataCategories",
      SERVICE_PAGE_USE_PERMISSION_DATA_CATEGORIES
    ),
    approvalGranularity: approvalGranularity as CreateServicePageUsePermissionRequest["approvalGranularity"],
    approvalDecision: "approved",
    userApprovalRef: stringFromBody(body.userApprovalRef, "userApprovalRef"),
    promptPreviewRef: stringFromBody(body.promptPreviewRef, "promptPreviewRef"),
    redactionPreviewRef: stringFromBody(body.redactionPreviewRef, "redactionPreviewRef"),
    userExportDeleteControls: body.userExportDeleteControls === true
      ? true
      : (() => {
          throw new ProductEngineServiceError(
            "VALIDATION_FAILED",
            "userExportDeleteControls must be true."
          );
        })(),
    ...(finalSubmitRequested !== undefined ? { finalSubmitRequested } : {}),
    ...(finalSubmitConfirmationRef !== undefined ? { finalSubmitConfirmationRef } : {}),
    ...(finalSubmitExecutionAuthorityRef !== undefined ? { finalSubmitExecutionAuthorityRef } : {}),
    ...(screenshotRefs ? { screenshotRefs } : {}),
    ...(logRefs ? { logRefs } : {}),
    ...(evidenceRefs ? { evidenceRefs } : {}),
    ...(auditRefs ? { auditRefs } : {}),
    ...(activityFeedRefs ? { activityFeedRefs } : {})
  };
}

function servicePageUsePermissionPayloadFromRequest(
  request: CreateServicePageUsePermissionRequest
): Readonly<Record<string, unknown>> {
  const payload = {
    serviceName: request.serviceName,
    serviceOrigin: request.serviceOrigin,
    pageUrl: request.pageUrl,
    purpose: request.purpose,
    allowedActionClasses: request.allowedActionClasses,
    blockedActionClasses: request.blockedActionClasses,
    dataCategories: request.dataCategories,
    approvalGranularity: request.approvalGranularity,
    approvalDecision: request.approvalDecision,
    userApprovalRef: request.userApprovalRef,
    promptPreviewRef: request.promptPreviewRef,
    redactionPreviewRef: request.redactionPreviewRef,
    userExportDeleteControls: request.userExportDeleteControls,
    ...(request.finalSubmitRequested !== undefined ? { finalSubmitRequested: request.finalSubmitRequested } : {}),
    ...(request.finalSubmitConfirmationRef ? { finalSubmitConfirmationRef: request.finalSubmitConfirmationRef } : {}),
    ...(request.finalSubmitExecutionAuthorityRef ? { finalSubmitExecutionAuthorityRef: request.finalSubmitExecutionAuthorityRef } : {}),
    ...(request.screenshotRefs ? { screenshotRefs: request.screenshotRefs } : {}),
    ...(request.logRefs ? { logRefs: request.logRefs } : {}),
    ...(request.evidenceRefs ? { evidenceRefs: request.evidenceRefs } : {}),
    ...(request.auditRefs ? { auditRefs: request.auditRefs } : {}),
    ...(request.activityFeedRefs ? { activityFeedRefs: request.activityFeedRefs } : {})
  } satisfies CreateServicePageUsePermissionPayload;

  return payload;
}

function revokeServicePageUsePermissionRequestFromBody(
  routeSessionId: SessionId,
  routePermissionId: string,
  body: Readonly<Record<string, unknown>>
): RevokeServicePageUsePermissionRequest {
  assertAllowedRecordKeys(
    body,
    SERVICE_PAGE_USE_PERMISSION_REVOKE_REQUEST_BODY_KEYS,
    "service page-use permission revoke request body"
  );

  if (body.scaffoldOnly !== undefined && body.scaffoldOnly !== true) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "scaffoldOnly must be true when provided.");
  }

  const bodySessionId = stringFromBody(body.sessionId, "sessionId") as SessionId;
  const bodyPermissionId = stringFromBody(body.permissionId, "permissionId");

  if (bodySessionId !== routeSessionId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "sessionId must match the route param.", {
      routeSessionId,
      bodySessionId
    });
  }

  if (bodyPermissionId !== routePermissionId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "permissionId must match the route param.", {
      routePermissionId,
      bodyPermissionId
    });
  }

  const auditRefs = optionalStringArrayFromBody(body.auditRefs, "auditRefs");

  return {
    sessionId: routeSessionId,
    expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
    idempotencyKey: stringFromBody(body.idempotencyKey, "idempotencyKey"),
    permissionId: routePermissionId,
    reason: stringFromBody(body.reason, "reason"),
    ...(auditRefs ? { auditRefs } : {})
  };
}

function deleteServicePageUsePermissionArtifactsRequestFromBody(
  routeSessionId: SessionId,
  routePermissionId: string,
  body: Readonly<Record<string, unknown>>
): DeleteServicePageUsePermissionArtifactsRequest {
  assertAllowedRecordKeys(
    body,
    SERVICE_PAGE_USE_PERMISSION_ARTIFACT_DELETE_REQUEST_BODY_KEYS,
    "service page-use permission artifact delete request body"
  );

  if (body.scaffoldOnly !== undefined && body.scaffoldOnly !== true) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "scaffoldOnly must be true when provided.");
  }

  const bodySessionId = stringFromBody(body.sessionId, "sessionId") as SessionId;
  const bodyPermissionId = stringFromBody(body.permissionId, "permissionId");

  if (bodySessionId !== routeSessionId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "sessionId must match the route param.", {
      routeSessionId,
      bodySessionId
    });
  }

  if (bodyPermissionId !== routePermissionId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "permissionId must match the route param.", {
      routePermissionId,
      bodyPermissionId
    });
  }

  const auditRefs = optionalStringArrayFromBody(body.auditRefs, "auditRefs");

  return {
    sessionId: routeSessionId,
    expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
    idempotencyKey: stringFromBody(body.idempotencyKey, "idempotencyKey"),
    permissionId: routePermissionId,
    reason: stringFromBody(body.reason, "reason"),
    ...(auditRefs ? { auditRefs } : {})
  };
}

const IMPLEMENTATION_STEP_LEDGER_REQUEST_BODY_KEYS = [
  "scaffoldOnly",
  "sessionId",
  "expectedStateVersion",
  "idempotencyKey",
  "trackerDoc",
  "stepDoc",
  "targetStatus",
  "startedEvidenceRefs",
  "stepCommitRecord",
  "noCodeStepEvidence",
  "codeReviewRecord",
  "cleanCodeReviewRecord",
  "missingTestAuditRecord",
  "testEvidenceRecord",
  "blocker",
  "evidenceRefs"
] as const satisfies readonly (keyof RecordImplementationStepLedgerRequest)[];

function optionalJsonRecordFromBody(value: unknown, fieldName: string) {
  return value === undefined ? undefined : requiredJsonObjectFromBody(value, fieldName);
}

function implementationStepStatusFromBody(value: unknown) {
  const status = stringFromBody(value, "targetStatus");

  if (!IMPLEMENTATION_STEP_STATUSES.includes(status as (typeof IMPLEMENTATION_STEP_STATUSES)[number])) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "targetStatus must be an implementation step status.");
  }

  return status as RecordImplementationStepLedgerRequest["targetStatus"];
}

function implementationStepLedgerRequestFromBody(
  routeSessionId: SessionId,
  body: Readonly<Record<string, unknown>>
): RecordImplementationStepLedgerRequest {
  assertAllowedRecordKeys(
    body,
    IMPLEMENTATION_STEP_LEDGER_REQUEST_BODY_KEYS,
    "implementation step ledger request body"
  );

  if (body.scaffoldOnly !== undefined && body.scaffoldOnly !== true) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "scaffoldOnly must be true when provided.");
  }

  const bodySessionId = stringFromBody(body.sessionId, "sessionId") as SessionId;

  if (bodySessionId !== routeSessionId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "sessionId must match the route param.", {
      routeSessionId,
      bodySessionId
    });
  }

  const startedEvidenceRefs = optionalStringArrayFromBody(body.startedEvidenceRefs, "startedEvidenceRefs");
  const evidenceRefs = optionalStringArrayFromBody(body.evidenceRefs, "evidenceRefs");
  const stepCommitRecord = optionalJsonRecordFromBody(body.stepCommitRecord, "stepCommitRecord") as
    | RecordImplementationStepLedgerRequest["stepCommitRecord"]
    | undefined;
  const noCodeStepEvidence = optionalJsonRecordFromBody(body.noCodeStepEvidence, "noCodeStepEvidence") as
    | RecordImplementationStepLedgerRequest["noCodeStepEvidence"]
    | undefined;
  const codeReviewRecord = optionalJsonRecordFromBody(body.codeReviewRecord, "codeReviewRecord") as
    | RecordImplementationStepLedgerRequest["codeReviewRecord"]
    | undefined;
  const cleanCodeReviewRecord = optionalJsonRecordFromBody(body.cleanCodeReviewRecord, "cleanCodeReviewRecord") as
    | RecordImplementationStepLedgerRequest["cleanCodeReviewRecord"]
    | undefined;
  const missingTestAuditRecord = optionalJsonRecordFromBody(body.missingTestAuditRecord, "missingTestAuditRecord") as
    | RecordImplementationStepLedgerRequest["missingTestAuditRecord"]
    | undefined;
  const testEvidenceRecord = optionalJsonRecordFromBody(body.testEvidenceRecord, "testEvidenceRecord") as
    | RecordImplementationStepLedgerRequest["testEvidenceRecord"]
    | undefined;
  const blocker = optionalJsonRecordFromBody(body.blocker, "blocker") as
    | RecordImplementationStepLedgerRequest["blocker"]
    | undefined;

  return {
    sessionId: routeSessionId,
    expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
    idempotencyKey: stringFromBody(body.idempotencyKey, "idempotencyKey"),
    trackerDoc: requiredJsonObjectFromBody(body.trackerDoc, "trackerDoc") as unknown as RecordImplementationStepLedgerRequest["trackerDoc"],
    stepDoc: requiredJsonObjectFromBody(body.stepDoc, "stepDoc") as unknown as RecordImplementationStepLedgerRequest["stepDoc"],
    targetStatus: implementationStepStatusFromBody(body.targetStatus),
    ...(startedEvidenceRefs ? { startedEvidenceRefs } : {}),
    ...(stepCommitRecord !== undefined ? { stepCommitRecord } : {}),
    ...(noCodeStepEvidence !== undefined ? { noCodeStepEvidence } : {}),
    ...(codeReviewRecord !== undefined ? { codeReviewRecord } : {}),
    ...(cleanCodeReviewRecord !== undefined ? { cleanCodeReviewRecord } : {}),
    ...(missingTestAuditRecord !== undefined ? { missingTestAuditRecord } : {}),
    ...(testEvidenceRecord !== undefined ? { testEvidenceRecord } : {}),
    ...(blocker !== undefined ? { blocker } : {}),
    ...(evidenceRefs ? { evidenceRefs } : {})
  };
}

function implementationStepLedgerPayloadFromRequest(
  request: RecordImplementationStepLedgerRequest
): Readonly<Record<string, unknown>> {
  const payload = {
    trackerDoc: request.trackerDoc,
    stepDoc: request.stepDoc,
    targetStatus: request.targetStatus,
    ...(request.startedEvidenceRefs ? { startedEvidenceRefs: request.startedEvidenceRefs } : {}),
    ...(request.stepCommitRecord ? { stepCommitRecord: request.stepCommitRecord } : {}),
    ...(request.noCodeStepEvidence ? { noCodeStepEvidence: request.noCodeStepEvidence } : {}),
    ...(request.codeReviewRecord ? { codeReviewRecord: request.codeReviewRecord } : {}),
    ...(request.cleanCodeReviewRecord ? { cleanCodeReviewRecord: request.cleanCodeReviewRecord } : {}),
    ...(request.missingTestAuditRecord ? { missingTestAuditRecord: request.missingTestAuditRecord } : {}),
    ...(request.testEvidenceRecord ? { testEvidenceRecord: request.testEvidenceRecord } : {}),
    ...(request.blocker ? { blocker: request.blocker } : {}),
    ...(request.evidenceRefs ? { evidenceRefs: request.evidenceRefs } : {})
  } satisfies RecordImplementationStepLedgerPayload;

  return payload;
}


const AUTO_IMPLEMENTATION_RUN_REQUEST_BODY_KEYS = [
  "sessionId",
  "idempotencyKey",
  "projectFolderName",
  "projectName",
  "sourcePlanningRef",
  "trackerTitle",
  "trackerGoal",
  "issueTitles",
  "planningIssueId",
  "githubIssueCreation"
] as const satisfies readonly (keyof CreateAutoImplementationRunRequest)[];

const AUTO_IMPLEMENTATION_GITHUB_ISSUE_CREATION_KEYS = [
  "mode",
  "approval",
  "verifierEvidenceRefs"
] as const satisfies readonly (keyof NonNullable<CreateAutoImplementationRunRequest["githubIssueCreation"]>)[];

const AUTO_IMPLEMENTATION_GITHUB_ISSUE_APPROVAL_KEYS = [
  "approvalId",
  "approvedBy",
  "approvedAt",
  "actionClass",
  "approvalGranularity",
  "remoteStatusAtApproval",
  "rollbackPlan",
  "evidenceRefs"
] as const satisfies readonly (keyof AutoImplementationGitHubIssueApproval)[];

function optionalGithubIssueApprovalFromBody(
  value: unknown,
  fieldName: string
): AutoImplementationGitHubIssueApproval | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const approval = requiredJsonObjectFromBody(value, fieldName);

  assertAllowedRecordKeys(
    approval,
    AUTO_IMPLEMENTATION_GITHUB_ISSUE_APPROVAL_KEYS,
    fieldName
  );

  const approvedAt = isoTimestampFromBody(approval.approvedAt, `${fieldName}.approvedAt`);
  const actionClass = stringFromBody(approval.actionClass, `${fieldName}.actionClass`);
  const approvalGranularity = stringFromBody(approval.approvalGranularity, `${fieldName}.approvalGranularity`);
  const remoteStatusAtApproval = stringFromBody(
    approval.remoteStatusAtApproval,
    `${fieldName}.remoteStatusAtApproval`
  );
  const evidenceRefs = optionalStringArrayFromBody(approval.evidenceRefs, `${fieldName}.evidenceRefs`);

  if (actionClass !== AUTO_IMPLEMENTATION_GITHUB_ISSUE_ACTION_CLASS) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      `${fieldName}.actionClass must be ${AUTO_IMPLEMENTATION_GITHUB_ISSUE_ACTION_CLASS}.`
    );
  }

  if (approvalGranularity !== AUTO_IMPLEMENTATION_GITHUB_ISSUE_APPROVAL_GRANULARITY) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      `${fieldName}.approvalGranularity must be ${AUTO_IMPLEMENTATION_GITHUB_ISSUE_APPROVAL_GRANULARITY}.`
    );
  }

  if (remoteStatusAtApproval !== "connected") {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      `${fieldName}.remoteStatusAtApproval must be connected.`
    );
  }

  if (!evidenceRefs?.length) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      `${fieldName}.evidenceRefs must include at least one approval evidence reference.`
    );
  }

  return {
    approvalId: stringFromBody(approval.approvalId, `${fieldName}.approvalId`),
    approvedBy: stringFromBody(approval.approvedBy, `${fieldName}.approvedBy`),
    approvedAt,
    actionClass: AUTO_IMPLEMENTATION_GITHUB_ISSUE_ACTION_CLASS,
    approvalGranularity: AUTO_IMPLEMENTATION_GITHUB_ISSUE_APPROVAL_GRANULARITY,
    remoteStatusAtApproval: "connected",
    rollbackPlan: stringFromBody(approval.rollbackPlan, `${fieldName}.rollbackPlan`),
    evidenceRefs
  };
}

function optionalGithubIssueCreationFromBody(
  value: unknown
): CreateAutoImplementationRunRequest["githubIssueCreation"] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const creation = requiredJsonObjectFromBody(value, "githubIssueCreation");

  assertAllowedRecordKeys(
    creation,
    AUTO_IMPLEMENTATION_GITHUB_ISSUE_CREATION_KEYS,
    "githubIssueCreation"
  );

  const mode = stringFromBody(creation.mode, "githubIssueCreation.mode");

  if (!AUTO_IMPLEMENTATION_GITHUB_ISSUE_REQUEST_MODES.includes(
    mode as NonNullable<CreateAutoImplementationRunRequest["githubIssueCreation"]>["mode"]
  )) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "githubIssueCreation.mode must be not_requested, dry_run, or approved."
    );
  }

  const approval = optionalGithubIssueApprovalFromBody(
    creation.approval,
    "githubIssueCreation.approval"
  );
  const verifierEvidenceRefs = optionalStringArrayFromBody(
    creation.verifierEvidenceRefs,
    "githubIssueCreation.verifierEvidenceRefs"
  );

  if (mode === "approved" && !verifierEvidenceRefs?.length) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "githubIssueCreation.verifierEvidenceRefs must include at least one verifier evidence reference for approved mode."
    );
  }

  return {
    mode: mode as NonNullable<CreateAutoImplementationRunRequest["githubIssueCreation"]>["mode"],
    ...(approval ? { approval } : {}),
    ...(verifierEvidenceRefs ? { verifierEvidenceRefs } : {})
  };
}

const AUTO_IMPLEMENTATION_PULL_REQUEST_MUTATION_REQUEST_BODY_KEYS = [
  "sessionId",
  "runId",
  "action",
  "requestMode",
  "idempotencyKey",
  "pullRequestUrl",
  "pullRequestTitle",
  "issueLinks",
  "implementationScope",
  "reviewStreakRefs",
  "verificationCommands",
  "knownGaps",
  "rollbackNotes",
  "mergeEvidenceRefs",
  "bodyEvidenceRefs",
  "approval",
  "verifierEvidenceRefs"
] as const satisfies readonly (keyof RecordAutoImplementationPullRequestMutationRequest)[];

const AUTO_IMPLEMENTATION_PULL_REQUEST_MUTATION_APPROVAL_KEYS = [
  "approvalId",
  "approvedBy",
  "approvedAt",
  "actionClass",
  "approvalGranularity",
  "remoteStatusAtApproval",
  "rollbackPlan",
  "evidenceRefs"
] as const satisfies readonly (keyof AutoImplementationPullRequestMutationApproval)[];

function optionalPullRequestMutationApprovalFromBody(
  value: unknown,
  fieldName: string
): AutoImplementationPullRequestMutationApproval | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const approval = requiredJsonObjectFromBody(value, fieldName);

  assertAllowedRecordKeys(
    approval,
    AUTO_IMPLEMENTATION_PULL_REQUEST_MUTATION_APPROVAL_KEYS,
    fieldName
  );

  const approvedAt = isoTimestampFromBody(approval.approvedAt, `${fieldName}.approvedAt`);
  const actionClass = stringFromBody(approval.actionClass, `${fieldName}.actionClass`);
  const approvalGranularity = stringFromBody(approval.approvalGranularity, `${fieldName}.approvalGranularity`);
  const remoteStatusAtApproval = stringFromBody(
    approval.remoteStatusAtApproval,
    `${fieldName}.remoteStatusAtApproval`
  );
  const evidenceRefs = optionalStringArrayFromBody(approval.evidenceRefs, `${fieldName}.evidenceRefs`);

  if (actionClass !== AUTO_IMPLEMENTATION_PULL_REQUEST_ACTION_CLASS) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      `${fieldName}.actionClass must be ${AUTO_IMPLEMENTATION_PULL_REQUEST_ACTION_CLASS}.`
    );
  }

  if (approvalGranularity !== AUTO_IMPLEMENTATION_PULL_REQUEST_APPROVAL_GRANULARITY) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      `${fieldName}.approvalGranularity must be ${AUTO_IMPLEMENTATION_PULL_REQUEST_APPROVAL_GRANULARITY}.`
    );
  }

  if (remoteStatusAtApproval !== "connected") {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      `${fieldName}.remoteStatusAtApproval must be connected.`
    );
  }

  if (!evidenceRefs?.length) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      `${fieldName}.evidenceRefs must include at least one approval evidence reference.`
    );
  }

  return {
    approvalId: stringFromBody(approval.approvalId, `${fieldName}.approvalId`),
    approvedBy: stringFromBody(approval.approvedBy, `${fieldName}.approvedBy`),
    approvedAt,
    actionClass: AUTO_IMPLEMENTATION_PULL_REQUEST_ACTION_CLASS,
    approvalGranularity: AUTO_IMPLEMENTATION_PULL_REQUEST_APPROVAL_GRANULARITY,
    remoteStatusAtApproval: "connected",
    rollbackPlan: stringFromBody(approval.rollbackPlan, `${fieldName}.rollbackPlan`),
    evidenceRefs
  };
}

function requiredPullRequestIssueLinksFromBody(value: unknown, fieldName: string) {
  const issueLinks = requiredStringArrayFromBody(value, fieldName);
  const hasInvalidIssueLink = issueLinks.some((issueLink) => !isAutoImplementationPullRequestIssueLink(issueLink));

  if (hasInvalidIssueLink) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      `${fieldName} must include only canonical local issue ids like local-001 or canonical GitHub issue URLs.`
    );
  }

  return issueLinks;
}

function recordAutoImplementationPullRequestMutationRequestFromBody(
  routeSessionId: SessionId,
  routeRunId: string,
  body: Readonly<Record<string, unknown>>
): RecordAutoImplementationPullRequestMutationRequest {
  assertAllowedRecordKeys(
    body,
    AUTO_IMPLEMENTATION_PULL_REQUEST_MUTATION_REQUEST_BODY_KEYS,
    "auto implementation pull request mutation request body"
  );
  const bodySessionId = optionalStringFromBody(body.sessionId, "sessionId") as SessionId | undefined;
  const bodyRunId = optionalStringFromBody(body.runId, "runId");

  if (bodySessionId && bodySessionId !== routeSessionId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "sessionId must match route sessionId.", {
      routeSessionId,
      bodySessionId
    });
  }

  if (bodyRunId && bodyRunId !== routeRunId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "runId must match route runId.", {
      routeRunId,
      bodyRunId
    });
  }

  const action = stringFromBody(body.action, "action");
  const requestMode = stringFromBody(body.requestMode, "requestMode");

  if (!AUTO_IMPLEMENTATION_PULL_REQUEST_MUTATION_ACTIONS.includes(
    action as RecordAutoImplementationPullRequestMutationRequest["action"]
  )) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "action must be open_pr, update_pr_body, or merge_pr."
    );
  }

  if (!AUTO_IMPLEMENTATION_PULL_REQUEST_MUTATION_REQUEST_MODES.includes(
    requestMode as RecordAutoImplementationPullRequestMutationRequest["requestMode"]
  )) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "requestMode must be dry_run or approved."
    );
  }

  const approval = optionalPullRequestMutationApprovalFromBody(
    body.approval,
    "approval"
  );
  const knownGaps = optionalStringArrayFromBody(body.knownGaps, "knownGaps");
  const mergeEvidenceRefs = optionalStringArrayFromBody(body.mergeEvidenceRefs, "mergeEvidenceRefs");
  const bodyEvidenceRefs = optionalStringArrayFromBody(body.bodyEvidenceRefs, "bodyEvidenceRefs");
  const verifierEvidenceRefs = optionalStringArrayFromBody(body.verifierEvidenceRefs, "verifierEvidenceRefs");

  return {
    sessionId: routeSessionId,
    runId: routeRunId,
    action: action as RecordAutoImplementationPullRequestMutationRequest["action"],
    requestMode: requestMode as RecordAutoImplementationPullRequestMutationRequest["requestMode"],
    idempotencyKey: stringFromBody(body.idempotencyKey, "idempotencyKey"),
    ...(body.pullRequestUrl !== undefined
      ? { pullRequestUrl: stringFromBody(body.pullRequestUrl, "pullRequestUrl") }
      : {}),
    ...(body.pullRequestTitle !== undefined
      ? { pullRequestTitle: stringFromBody(body.pullRequestTitle, "pullRequestTitle") }
      : {}),
    issueLinks: requiredPullRequestIssueLinksFromBody(body.issueLinks, "issueLinks"),
    implementationScope: stringFromBody(body.implementationScope, "implementationScope"),
    reviewStreakRefs: stringArrayFromBody(body.reviewStreakRefs, "reviewStreakRefs"),
    verificationCommands: requiredStringArrayFromBody(body.verificationCommands, "verificationCommands"),
    ...(knownGaps ? { knownGaps } : {}),
    rollbackNotes: stringFromBody(body.rollbackNotes, "rollbackNotes"),
    ...(mergeEvidenceRefs ? { mergeEvidenceRefs } : {}),
    ...(bodyEvidenceRefs ? { bodyEvidenceRefs } : {}),
    ...(approval ? { approval } : {}),
    ...(verifierEvidenceRefs ? { verifierEvidenceRefs } : {})
  };
}

function createAutoImplementationRunRequestFromBody(
  routeSessionId: SessionId,
  body: Readonly<Record<string, unknown>>
): CreateAutoImplementationRunRequest {
  assertAllowedRecordKeys(
    body,
    AUTO_IMPLEMENTATION_RUN_REQUEST_BODY_KEYS,
    "auto implementation run request body"
  );
  const bodySessionId = optionalStringFromBody(body.sessionId, "sessionId") as SessionId | undefined;

  if (bodySessionId && bodySessionId !== routeSessionId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "sessionId must match route sessionId.", {
      routeSessionId,
      bodySessionId
    });
  }

  const issueTitles = optionalStringArrayFromBody(body.issueTitles, "issueTitles");

  if (issueTitles && issueTitles.length > AUTO_IMPLEMENTATION_STAGES.length) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      `issueTitles must include at most ${AUTO_IMPLEMENTATION_STAGES.length} values.`
    );
  }

  const projectFolderName = optionalStringFromBody(body.projectFolderName, "projectFolderName");
  const projectName = optionalStringFromBody(body.projectName, "projectName");
  const sourcePlanningRef = optionalStringFromBody(body.sourcePlanningRef, "sourcePlanningRef");
  const trackerTitle = optionalStringFromBody(body.trackerTitle, "trackerTitle");
  const trackerGoal = optionalStringFromBody(body.trackerGoal, "trackerGoal");
  const planningIssueId = optionalStringFromBody(body.planningIssueId, "planningIssueId");
  const githubIssueCreation = optionalGithubIssueCreationFromBody(body.githubIssueCreation);

  return {
    sessionId: routeSessionId,
    idempotencyKey: stringFromBody(body.idempotencyKey, "idempotencyKey"),
    ...(projectFolderName ? { projectFolderName } : {}),
    ...(projectName ? { projectName } : {}),
    ...(sourcePlanningRef ? { sourcePlanningRef } : {}),
    ...(trackerTitle ? { trackerTitle } : {}),
    ...(trackerGoal ? { trackerGoal } : {}),
    ...(issueTitles ? { issueTitles } : {}),
    ...(planningIssueId ? { planningIssueId } : {}),
    ...(githubIssueCreation ? { githubIssueCreation } : {})
  };
}

const AUTO_IMPLEMENTATION_STAGE_REQUEST_BODY_KEYS = [
  "sessionId",
  "runId",
  "stage",
  "action",
  "idempotencyKey",
  "implementationStepId",
  "blocker",
  "evidenceRefs",
  "tickedAt"
] as const satisfies readonly (keyof RecordAutoImplementationStageRequest)[];

const AUTO_IMPLEMENTATION_WORKER_JOB_REQUEST_BODY_KEYS = [
  "sessionId",
  "runId",
  "idempotencyKey",
  "executionAuthorityRef"
] as const satisfies readonly (keyof CreateAutoImplementationWorkerJobRequest)[];

const AUTO_IMPLEMENTATION_WORKER_JOB_COMPLETION_REQUEST_BODY_KEYS = [
  "sessionId",
  "runId",
  "jobId",
  "idempotencyKey",
  "implementationStepId",
  "evidenceRefs"
] as const satisfies readonly (keyof CompleteAutoImplementationWorkerJobRequest)[];

const AUTO_IMPLEMENTATION_WORKER_LEDGER_IMPORT_REQUEST_BODY_KEYS = [
  "sessionId",
  "runId",
  "jobId",
  "idempotencyKey",
  "ledgerTransitions",
  "evidenceRefs"
] as const satisfies readonly (keyof ImportAutoImplementationWorkerLedgerRequest)[];

const AUTO_IMPLEMENTATION_WORKER_RUN_REQUEST_BODY_KEYS = [
  "sessionId",
  "runId",
  "jobId",
  "idempotencyKey",
  "evidenceRefs"
] as const satisfies readonly (keyof RunAutoImplementationWorkerJobRequest)[];

const AUTO_IMPLEMENTATION_WORKER_STAGE_ADVANCE_REQUEST_BODY_KEYS = [
  "sessionId",
  "runId",
  "jobId",
  "idempotencyKey",
  "evidenceRefs",
  "tickedAt"
] as const satisfies readonly (keyof AdvanceAutoImplementationWorkerStageRequest)[];

const AUTO_IMPLEMENTATION_STAGE_BLOCKER_KEYS = [
  "stage",
  "reason",
  "missingEvidence",
  "nextRequiredAction",
  "evidenceRefs"
] as const satisfies readonly (keyof AutoImplementationStageBlocker)[];

function autoImplementationStageFromValue(value: unknown, fieldName: string): AutoImplementationStage {
  const stage = stringFromBody(value, fieldName);

  if (!AUTO_IMPLEMENTATION_STAGES.includes(stage as AutoImplementationStage)) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be a canonical auto implementation stage.`);
  }

  return stage as AutoImplementationStage;
}

function autoImplementationStageActionFromValue(value: unknown): AutoImplementationStageAction {
  const action = stringFromBody(value, "action");

  if (!AUTO_IMPLEMENTATION_STAGE_ACTIONS.includes(action as AutoImplementationStageAction)) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "action must be tick, start, pause, block, or complete.");
  }

  return action as AutoImplementationStageAction;
}

function nonEmptyStringArrayFromBody(value: unknown, fieldName: string) {
  const strings = optionalStringArrayFromBody(value, fieldName);

  if (!strings?.length) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must include at least one value.`);
  }

  return strings;
}

function optionalAutoImplementationStageBlockerFromBody(
  value: unknown,
  routeStage: AutoImplementationStage
): AutoImplementationStageBlocker | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const blocker = requiredJsonObjectFromBody(value, "blocker");

  assertAllowedRecordKeys(blocker, AUTO_IMPLEMENTATION_STAGE_BLOCKER_KEYS, "blocker");

  const stage = autoImplementationStageFromValue(blocker.stage, "blocker.stage");

  if (stage !== routeStage) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "blocker.stage must match the route stage.");
  }

  return {
    stage,
    reason: stringFromBody(blocker.reason, "blocker.reason"),
    missingEvidence: nonEmptyStringArrayFromBody(blocker.missingEvidence, "blocker.missingEvidence"),
    nextRequiredAction: stringFromBody(blocker.nextRequiredAction, "blocker.nextRequiredAction"),
    evidenceRefs: nonEmptyStringArrayFromBody(blocker.evidenceRefs, "blocker.evidenceRefs")
  };
}

function recordAutoImplementationStageRequestFromBody(
  routeSessionId: SessionId,
  routeRunId: string,
  routeStage: AutoImplementationStage,
  body: Readonly<Record<string, unknown>>
): RecordAutoImplementationStageRequest {
  assertAllowedRecordKeys(
    body,
    AUTO_IMPLEMENTATION_STAGE_REQUEST_BODY_KEYS,
    "auto implementation stage request body"
  );

  const bodySessionId = optionalStringFromBody(body.sessionId, "sessionId") as SessionId | undefined;
  const bodyRunId = optionalStringFromBody(body.runId, "runId");
  const bodyStage = body.stage === undefined ? undefined : autoImplementationStageFromValue(body.stage, "stage");

  if (bodySessionId && bodySessionId !== routeSessionId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "sessionId must match route sessionId.", {
      routeSessionId,
      bodySessionId
    });
  }
  if (bodyRunId && bodyRunId !== routeRunId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "runId must match route runId.", {
      routeRunId,
      bodyRunId
    });
  }
  if (bodyStage && bodyStage !== routeStage) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "stage must match route stage.", {
      routeStage,
      bodyStage
    });
  }

  const tickedAt = optionalIsoTimestampFromBody(body.tickedAt, "tickedAt");
  const implementationStepId = optionalStringFromBody(body.implementationStepId, "implementationStepId");
  const evidenceRefs = optionalStringArrayFromBody(body.evidenceRefs, "evidenceRefs");
  const blocker = optionalAutoImplementationStageBlockerFromBody(body.blocker, routeStage);

  return {
    sessionId: routeSessionId,
    runId: routeRunId,
    stage: routeStage,
    action: autoImplementationStageActionFromValue(body.action),
    idempotencyKey: stringFromBody(body.idempotencyKey, "idempotencyKey"),
    ...(implementationStepId ? { implementationStepId } : {}),
    ...(blocker ? { blocker } : {}),
    ...(evidenceRefs ? { evidenceRefs } : {}),
    ...(tickedAt ? { tickedAt } : {})
  };
}

function createAutoImplementationWorkerJobRequestFromBody(
  routeSessionId: SessionId,
  routeRunId: string,
  body: Readonly<Record<string, unknown>>
): CreateAutoImplementationWorkerJobRequest {
  assertAllowedRecordKeys(
    body,
    AUTO_IMPLEMENTATION_WORKER_JOB_REQUEST_BODY_KEYS,
    "auto implementation worker job request body"
  );

  const bodySessionId = optionalStringFromBody(body.sessionId, "sessionId") as SessionId | undefined;

  if (bodySessionId && bodySessionId !== routeSessionId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "sessionId must match route sessionId.", {
      routeSessionId,
      bodySessionId
    });
  }

  const bodyRunId = optionalStringFromBody(body.runId, "runId");

  if (bodyRunId && bodyRunId !== routeRunId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "runId must match route runId.", {
      routeRunId,
      bodyRunId
    });
  }

  const executionAuthorityRef = optionalStringFromBody(body.executionAuthorityRef, "executionAuthorityRef");

  return {
    sessionId: routeSessionId,
    runId: routeRunId,
    idempotencyKey: stringFromBody(body.idempotencyKey, "idempotencyKey"),
    ...(executionAuthorityRef ? { executionAuthorityRef } : {})
  };
}

function completeAutoImplementationWorkerJobRequestFromBody(
  routeSessionId: SessionId,
  routeRunId: string,
  routeJobId: string,
  body: Readonly<Record<string, unknown>>
): CompleteAutoImplementationWorkerJobRequest {
  assertAllowedRecordKeys(
    body,
    AUTO_IMPLEMENTATION_WORKER_JOB_COMPLETION_REQUEST_BODY_KEYS,
    "auto implementation worker job completion request body"
  );

  routeScopedWorkerJobBody(
    routeSessionId,
    routeRunId,
    routeJobId,
    body,
    "auto implementation worker job completion request body"
  );

  const evidenceRefs = optionalStringArrayFromBody(body.evidenceRefs, "evidenceRefs");

  return {
    sessionId: routeSessionId,
    runId: routeRunId,
    jobId: routeJobId,
    idempotencyKey: stringFromBody(body.idempotencyKey, "idempotencyKey"),
    implementationStepId: stringFromBody(body.implementationStepId, "implementationStepId"),
    ...(evidenceRefs ? { evidenceRefs } : {})
  };
}

function routeScopedWorkerJobBody(
  routeSessionId: SessionId,
  routeRunId: string,
  routeJobId: string,
  body: Readonly<Record<string, unknown>>,
  bodyLabel: string
) {
  const bodySessionId = optionalStringFromBody(body.sessionId, "sessionId") as SessionId | undefined;

  if (bodySessionId && bodySessionId !== routeSessionId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "sessionId must match route sessionId.", {
      routeSessionId,
      bodySessionId
    });
  }

  const bodyRunId = optionalStringFromBody(body.runId, "runId");

  if (bodyRunId && bodyRunId !== routeRunId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "runId must match route runId.", {
      routeRunId,
      bodyRunId
    });
  }

  const bodyJobId = optionalStringFromBody(body.jobId, "jobId");

  if (bodyJobId && bodyJobId !== routeJobId) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "jobId must match route jobId.", {
      routeJobId,
      bodyJobId,
      bodyLabel
    });
  }
}

function importAutoImplementationWorkerLedgerRequestFromBody(
  routeSessionId: SessionId,
  routeRunId: string,
  routeJobId: string,
  body: Readonly<Record<string, unknown>>
): ImportAutoImplementationWorkerLedgerRequest {
  assertAllowedRecordKeys(
    body,
    AUTO_IMPLEMENTATION_WORKER_LEDGER_IMPORT_REQUEST_BODY_KEYS,
    "auto implementation worker ledger import request body"
  );
  routeScopedWorkerJobBody(
    routeSessionId,
    routeRunId,
    routeJobId,
    body,
    "auto implementation worker ledger import request body"
  );

  if (!Array.isArray(body.ledgerTransitions) || body.ledgerTransitions.length === 0) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "ledgerTransitions must include at least one implementation ledger transition."
    );
  }

  if (body.ledgerTransitions.some((transition) => !transition || typeof transition !== "object" || Array.isArray(transition))) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "ledgerTransitions must contain object payloads."
    );
  }

  const evidenceRefs = optionalStringArrayFromBody(body.evidenceRefs, "evidenceRefs");

  return {
    sessionId: routeSessionId,
    runId: routeRunId,
    jobId: routeJobId,
    idempotencyKey: stringFromBody(body.idempotencyKey, "idempotencyKey"),
    ledgerTransitions: body.ledgerTransitions as unknown as ImportAutoImplementationWorkerLedgerRequest["ledgerTransitions"],
    ...(evidenceRefs ? { evidenceRefs } : {})
  };
}

function runAutoImplementationWorkerJobRequestFromBody(
  routeSessionId: SessionId,
  routeRunId: string,
  routeJobId: string,
  body: Readonly<Record<string, unknown>>
): RunAutoImplementationWorkerJobRequest {
  assertAllowedRecordKeys(
    body,
    AUTO_IMPLEMENTATION_WORKER_RUN_REQUEST_BODY_KEYS,
    "auto implementation worker run request body"
  );
  routeScopedWorkerJobBody(
    routeSessionId,
    routeRunId,
    routeJobId,
    body,
    "auto implementation worker run request body"
  );

  const evidenceRefs = optionalStringArrayFromBody(body.evidenceRefs, "evidenceRefs");

  return {
    sessionId: routeSessionId,
    runId: routeRunId,
    jobId: routeJobId,
    idempotencyKey: stringFromBody(body.idempotencyKey, "idempotencyKey"),
    ...(evidenceRefs ? { evidenceRefs } : {})
  };
}

function advanceAutoImplementationWorkerStageRequestFromBody(
  routeSessionId: SessionId,
  routeRunId: string,
  routeJobId: string,
  body: Readonly<Record<string, unknown>>
): AdvanceAutoImplementationWorkerStageRequest {
  assertAllowedRecordKeys(
    body,
    AUTO_IMPLEMENTATION_WORKER_STAGE_ADVANCE_REQUEST_BODY_KEYS,
    "auto implementation worker stage advance request body"
  );
  routeScopedWorkerJobBody(
    routeSessionId,
    routeRunId,
    routeJobId,
    body,
    "auto implementation worker stage advance request body"
  );

  const evidenceRefs = optionalStringArrayFromBody(body.evidenceRefs, "evidenceRefs");
  const tickedAt = optionalIsoTimestampFromBody(body.tickedAt, "tickedAt");

  return {
    sessionId: routeSessionId,
    runId: routeRunId,
    jobId: routeJobId,
    idempotencyKey: stringFromBody(body.idempotencyKey, "idempotencyKey"),
    ...(evidenceRefs ? { evidenceRefs } : {}),
    ...(tickedAt ? { tickedAt } : {})
  };
}

interface ExecutionAdapterBaseRequest {
  readonly sessionId: SessionId;
  readonly idempotencyKey: string;
  readonly previewArtifactHash: string;
  readonly requestedAt: string;
  readonly approvalExpiresAt?: string;
}

function executionAdapterBaseRequestFromBody(
  body: Readonly<Record<string, unknown>>,
  allowedKeys: readonly string[],
  bodyName: string
): ExecutionAdapterBaseRequest {
  assertAllowedRecordKeys(body, allowedKeys, bodyName);

  if (body.scaffoldOnly !== undefined && body.scaffoldOnly !== true) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "scaffoldOnly must be true when provided.");
  }

  const approvalExpiresAt = optionalIsoTimestampFromBody(body.approvalExpiresAt, "approvalExpiresAt");

  return {
    sessionId: stringFromBody(body.sessionId, "sessionId") as SessionId,
    idempotencyKey: stringFromBody(body.idempotencyKey, "idempotencyKey"),
    previewArtifactHash: stringFromBody(body.previewArtifactHash, "previewArtifactHash"),
    requestedAt: isoTimestampFromBody(body.requestedAt, "requestedAt"),
    ...(approvalExpiresAt ? { approvalExpiresAt } : {})
  };
}

function validateExecutionAuthorityPreflightRequestFromBody(
  body: Readonly<Record<string, unknown>>
): ValidateExecutionAuthorityPreflightRequest {
  return {
    ...executionAdapterBaseRequestFromBody(
      body,
      EXECUTION_AUTHORITY_PREFLIGHT_KEYS,
      "Execution Authority preflight body"
    ),
    actionClass: executionAuthorityActionClassFromBody(body.actionClass, "actionClass")
  };
}

function executeFileDiffRequestFromBody(body: Readonly<Record<string, unknown>>): ExecuteFileDiffRequest {
  const baseRequest = executionAdapterBaseRequestFromBody(body, FILE_DIFF_EXECUTION_KEYS, "file_diff execution body");

  return {
    ...baseRequest,
    workspaceRoot: stringFromBody(body.workspaceRoot, "workspaceRoot"),
    unifiedDiff: stringContentFromBody(body.unifiedDiff, "unifiedDiff")
  };
}

function executeShellCommandRequestFromBody(body: Readonly<Record<string, unknown>>): ExecuteShellCommandRequest {
  const baseRequest = executionAdapterBaseRequestFromBody(
    body,
    SHELL_COMMAND_EXECUTION_KEYS,
    "shell_command execution body"
  );
  const workingDirectory = optionalStringFromBody(body.workingDirectory, "workingDirectory");

  return {
    ...baseRequest,
    workspaceRoot: stringFromBody(body.workspaceRoot, "workspaceRoot"),
    command: stringArrayFromBody(body.command, "command"),
    ...(workingDirectory ? { workingDirectory } : {})
  };
}

function browserActionPreviewFromBody(value: unknown): BrowserActionPreviewDto {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "action must be a browser action preview object.");
  }

  const action = value as Readonly<Record<string, unknown>>;

  assertAllowedRecordKeys(action, BROWSER_ACTION_PREVIEW_KEYS, "browser_action preview");

  const kind = stringFromBody(action.kind, "action.kind");

  if (!BROWSER_ACTION_PREVIEW_KINDS.includes(kind as BrowserActionPreviewDto["kind"])) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "action.kind must be a browser action preview kind.");
  }

  const credentialMode = stringFromBody(action.credentialMode, "action.credentialMode");

  if (!BROWSER_ACTION_CREDENTIAL_MODES.includes(credentialMode as BrowserActionPreviewDto["credentialMode"])) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", "action.credentialMode must be a browser credential mode.");
  }

  const externalMutation = stringFromBody(action.externalMutation, "action.externalMutation");

  if (
    !BROWSER_ACTION_EXTERNAL_MUTATION_POLICIES.includes(
      externalMutation as BrowserActionPreviewDto["externalMutation"]
    )
  ) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "action.externalMutation must be a browser external mutation policy."
    );
  }

  return {
    kind: kind as BrowserActionPreviewDto["kind"],
    visibleAction: booleanFromBody(action.visibleAction, "action.visibleAction"),
    credentialMode: credentialMode as BrowserActionPreviewDto["credentialMode"],
    externalMutation: externalMutation as BrowserActionPreviewDto["externalMutation"]
  };
}

function executeBrowserActionRequestFromBody(body: Readonly<Record<string, unknown>>): ExecuteBrowserActionRequest {
  const baseRequest = executionAdapterBaseRequestFromBody(
    body,
    BROWSER_ACTION_EXECUTION_KEYS,
    "browser_action execution body"
  );
  const servicePagePermissionId = optionalStringFromBody(
    body.servicePagePermissionId,
    "servicePagePermissionId"
  );
  const servicePageActionClass = optionalStringFromBody(
    body.servicePageActionClass,
    "servicePageActionClass"
  );

  if (
    servicePageActionClass !== undefined &&
    !SERVICE_PAGE_USE_PERMISSION_ACTION_CLASSES.includes(
      servicePageActionClass as (typeof SERVICE_PAGE_USE_PERMISSION_ACTION_CLASSES)[number]
    )
  ) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "servicePageActionClass must be a valid service page-use action class."
    );
  }

  const parsedServicePageActionClass = servicePageActionClass as
    | (typeof SERVICE_PAGE_USE_PERMISSION_ACTION_CLASSES)[number]
    | undefined;

  return {
    ...baseRequest,
    targetUrl: stringFromBody(body.targetUrl, "targetUrl"),
    action: browserActionPreviewFromBody(body.action),
    ...(servicePagePermissionId ? { servicePagePermissionId } : {}),
    ...(parsedServicePageActionClass
      ? { servicePageActionClass: parsedServicePageActionClass }
      : {})
  };
}

export function createSidecarApp(options: CreateSidecarAppOptions) {
  const { localCapabilityToken, migrationStatus = defaultMigrationStatus(), storage = null } = options;
  const codexRuntimeAdapter = options.codexRuntimeAdapter ?? createCodexRuntimeAdapter();
  const commandServiceOptions: ProductEngineCommandServiceOptions = {
    ...(options.autoImplementationWorkspaceRoot
      ? { autoImplementationWorkspaceRoot: options.autoImplementationWorkspaceRoot }
      : {}),
    ...(options.autoImplementationRemoteStatusProvider
      ? { autoImplementationRemoteStatusProvider: options.autoImplementationRemoteStatusProvider }
      : {}),
    ...(options.autoImplementationGitHubIssueMutationAdapter
      ? { autoImplementationGitHubIssueMutationAdapter: options.autoImplementationGitHubIssueMutationAdapter }
      : {}),
    ...(options.autoImplementationPullRequestMutationAdapter
      ? { autoImplementationPullRequestMutationAdapter: options.autoImplementationPullRequestMutationAdapter }
      : {})
  };
  const commandService = storage
    ? createProductEngineCommandService(storage, codexRuntimeAdapter, commandServiceOptions)
    : null;

  if (localCapabilityToken.trim().length === 0) {
    throw new Error("localCapabilityToken must not be empty");
  }

  const app = new Hono();

  app.onError((error, context) => {
    if (context.req.path.startsWith("/api/v1")) {
      return context.json(
        jsonError(context, "RUNTIME_UNAVAILABLE", "Sidecar route failed before it could complete the API response.", {
          errorName: error.name,
          reason: error.message
        }),
        500
      );
    }

    return context.text("Internal Server Error", 500);
  });

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

  app.use("*", async (context, next) => {
    const origin = explicitRequestOrigin(context.req.raw.headers);

    if (context.req.path.startsWith("/api/v1") && origin && !allowedCorsOrigin(origin)) {
      return context.json(
        jsonError(context, "AUTH_REQUIRED", "Sidecar API accepts only explicit local web origins.", {
          policy: "explicit_local_cors_allowlist",
          receivedOrigin: origin
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
      sidecarPhase: "phase_1_queue_sse_refetch_recovery",
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
      const projectPurposeMode = projectPurposeModeFromBody(body.projectPurposeMode);
      const suggestedProjectPurposeMode = optionalProjectPurposeModeFromBody(
        body.suggestedProjectPurposeMode,
        "suggestedProjectPurposeMode"
      );
      const businessCriticIntensity = optionalBusinessCriticIntensityFromBody(body.businessCriticIntensity);
      const initialResearchAutomationPermission = optionalResearchAutomationPermissionFromBody(
        body.initialResearchAutomationPermission
      );

      if (localPrivacyMode !== "local_only" && localPrivacyMode !== "local_with_manual_export") {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "localPrivacyMode must be a supported local privacy mode.");
      }

      if (body.projectPurposeModeConfirmation !== "user_confirmed") {
        throw new ProductEngineServiceError(
          "VALIDATION_FAILED",
          "projectPurposeModeConfirmation must be user_confirmed."
        );
      }

      if (businessCriticIntensity && body.businessCriticIntensityConfirmation !== "user_confirmed") {
        throw new ProductEngineServiceError(
          "VALIDATION_FAILED",
          "businessCriticIntensityConfirmation must be user_confirmed when businessCriticIntensity is provided."
        );
      }

      return service.startProject({
        rawIdea,
        localPrivacyMode,
        projectPurposeMode,
        projectPurposeModeConfirmation: "user_confirmed",
        ...(suggestedProjectPurposeMode ? { suggestedProjectPurposeMode } : {}),
        ...(typeof body.projectPurposeModeReason === "string"
          ? { projectPurposeModeReason: body.projectPurposeModeReason }
          : {}),
        ...(businessCriticIntensity
          ? {
              businessCriticIntensity,
              businessCriticIntensityConfirmation: "user_confirmed" as const,
              ...(typeof body.businessCriticIntensityReason === "string"
                ? { businessCriticIntensityReason: body.businessCriticIntensityReason }
                : {})
            }
          : {}),
        ...(initialResearchAutomationPermission ? { initialResearchAutomationPermission } : {}),
        ...(typeof body.sourceNote === "string" ? { sourceNote: body.sourceNote } : {})
      });
    })
  );

  app.post("/api/v1/sessions/:sessionId/project-purpose-mode", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);
      const routeSessionId = context.req.param("sessionId") as SessionId;
      const bodySessionId = stringFromBody(body.sessionId, "sessionId") as SessionId;
      const suggestedProjectPurposeMode = optionalProjectPurposeModeFromBody(
        body.suggestedProjectPurposeMode,
        "suggestedProjectPurposeMode"
      );

      if (bodySessionId !== routeSessionId) {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "sessionId must match the route param.", {
          routeSessionId,
          bodySessionId
        });
      }

      return service.runSessionCommand({
        sessionId: routeSessionId,
        commandType: "ChangeProjectPurposeMode",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          projectPurposeMode: projectPurposeModeFromBody(body.projectPurposeMode),
          reason: stringFromBody(body.reason, "reason"),
          ...(suggestedProjectPurposeMode ? { suggestedProjectPurposeMode } : {})
        }
      });
    })
  );

  app.post("/api/v1/sessions/:sessionId/business-critic-intensity", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);
      const routeSessionId = context.req.param("sessionId") as SessionId;
      const bodySessionId = stringFromBody(body.sessionId, "sessionId") as SessionId;

      if (bodySessionId !== routeSessionId) {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "sessionId must match the route param.", {
          routeSessionId,
          bodySessionId
        });
      }

      if (body.businessCriticIntensityConfirmation !== "user_confirmed") {
        throw new ProductEngineServiceError(
          "VALIDATION_FAILED",
          "businessCriticIntensityConfirmation must be user_confirmed."
        );
      }

      return service.runSessionCommand({
        sessionId: routeSessionId,
        commandType: "ChangeBusinessCriticIntensity",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          businessCriticIntensity: businessCriticIntensityFromBody(body.businessCriticIntensity),
          businessCriticIntensityConfirmation: "user_confirmed",
          reason: stringFromBody(body.reason, "reason")
        }
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

  app.get("/api/v1/projects/:projectId/phase15b-upgrade-hints", async (context) =>
    withProductEngine(context, (service) =>
      service.listPhase15bUpgradeHints(context.req.param("projectId") as ProjectId)
    )
  );

  app.get("/api/v1/projects/:projectId/phase15b-upgrade-hints/export", async (context) =>
    withProductEngine(context, (service) =>
      service.exportPhase15bUpgradeHints(context.req.param("projectId") as ProjectId)
    )
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

  app.post("/api/v1/sessions/:sessionId/questions/generate", async (context) =>
    withProductEngine(context, async () => {
      const body = await jsonBody(context);
      const bodySessionId = stringFromBody(body.sessionId, "sessionId") as SessionId;
      const pathSessionId = context.req.param("sessionId") as SessionId;

      if (bodySessionId !== pathSessionId) {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "sessionId in the path and body must match.");
      }

      const request = {
        sessionId: pathSessionId,
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        rawIdea: stringContentFromBody(body.rawIdea, "rawIdea"),
        intakeGoal: stringContentFromBody(body.intakeGoal, "intakeGoal"),
        projectPurposeMode: projectPurposeModeFromBody(body.projectPurposeMode),
        businessCriticIntensity: optionalBusinessCriticIntensityFromBody(body.businessCriticIntensity),
        generationMode: questionGenerationModeFromBody(body.generationMode),
        reviewAxes: optionalStringArrayFromBody(body.reviewAxes, "reviewAxes") ?? [],
        ambiguityDimensions: optionalStringArrayFromBody(body.ambiguityDimensions, "ambiguityDimensions") ?? [],
        language: typeof body.language === "string" ? body.language : undefined,
        initialQuestionCount: questionCountFromBody(body.initialQuestionCount),
        domainKeywordExpansions: domainKeywordExpansionsFromBody(body.domainKeywordExpansions)
      };
      const questionSetContext = {
        contextText: [request.rawIdea, request.intakeGoal].filter(Boolean).join("\n")
      };

      if (request.generationMode === "local_fallback") {
        const { fallbackParsed, fallbackQuestionSet } = parsedGeneratedQuestionSetLocalFallback({
          rawIdea: request.rawIdea,
          intakeGoal: request.intakeGoal,
          businessCriticIntensity: request.businessCriticIntensity ?? null,
          contextText: questionSetContext.contextText
        });

        if (fallbackParsed.ok) {
          return {
            status: "generated",
            promptTemplateRef: GENERATED_AMBIGUITY_QUESTION_PROMPT_TEMPLATE_REF,
            schemaVersion: GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
            source: "local_fallback",
            generatedQuestionSet: fallbackQuestionSet,
            reason: "Solo Superman used a conservative local fallback question set so planning can start immediately."
          } as const;
        }

        return {
          status: "invalid",
          promptTemplateRef: GENERATED_AMBIGUITY_QUESTION_PROMPT_TEMPLATE_REF,
          schemaVersion: GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
          source: "local_fallback",
          validationIssues: fallbackParsed.issues,
          reason: "Local fallback question set did not match the generated question JSON schema."
        } as const;
      }
      const projectConfig = loadSoloProjectConfig();
      const questionConfig = projectConfig.questionGeneration;
      const effectiveLanguage = request.language ?? questionConfig?.language;
      const effectiveQuestionCount = request.initialQuestionCount ?? questionConfig?.initialQuestionCount;
      const effectiveKeywordExpansions = request.domainKeywordExpansions ?? questionConfig?.domainKeywordExpansions;
      const prompt = buildGeneratedAmbiguityQuestionPrompt({
        rawIdea: request.rawIdea,
        intakeGoal: request.intakeGoal,
        projectPurposeMode: request.projectPurposeMode,
        businessCriticIntensity: request.businessCriticIntensity ?? null,
        reviewAxes: request.reviewAxes.length ? request.reviewAxes : questionConfig?.reviewAxes ?? [],
        ...(request.ambiguityDimensions.length
          ? { ambiguityDimensions: request.ambiguityDimensions }
          : questionConfig?.ambiguityDimensions
            ? { ambiguityDimensions: questionConfig.ambiguityDimensions }
            : {}),
        ...(effectiveLanguage ? { language: effectiveLanguage } : {}),
        ...(effectiveQuestionCount ? { initialQuestionCount: effectiveQuestionCount } : {}),
        ...(effectiveKeywordExpansions ? { domainKeywordExpansions: effectiveKeywordExpansions } : {})
      });
      const status = await codexRuntimeAdapter.getStatus();

      if (status.executionMode !== "live" || status.status !== "available") {
        return generatedQuestionSetUnavailableResponse(
          status.reason ?? "Codex runtime is not available for live question generation."
        );
      }

      let preview: Awaited<ReturnType<CodexRuntimeAdapter["createPreview"]>>;

      try {
        preview = await codexRuntimeAdapter.createPreview({
          turnPurpose: "question_generation",
          contextHash: generatedQuestionSetContextHash({
            sessionId: request.sessionId,
            expectedStateVersion: request.expectedStateVersion,
            rawIdea: request.rawIdea,
            intakeGoal: request.intakeGoal,
            projectPurposeMode: request.projectPurposeMode,
            businessCriticIntensity: request.businessCriticIntensity ?? null,
            reviewAxes: request.reviewAxes,
            ambiguityDimensions: request.ambiguityDimensions,
            language: request.language ?? null,
            initialQuestionCount: request.initialQuestionCount ?? null,
            domainKeywordExpansions: request.domainKeywordExpansions ?? null
          }),
          prompt,
          sourceRefs: [
            `session:${request.sessionId}`,
            `state_version:${request.expectedStateVersion}`,
            GENERATED_AMBIGUITY_QUESTION_PROMPT_TEMPLATE_REF
          ],
          targetObject: "generated_ambiguity_question_set"
        });
      } catch (error) {
        return generatedQuestionSetUnavailableResponse(generatedQuestionSetPreviewFailureReason(error));
      }

      const hasStructuredQuestionSet = Object.prototype.hasOwnProperty.call(preview.payload, "structuredBody");
      let parsed: ReturnType<typeof parseGeneratedAmbiguityQuestionSet>;
      let generatedQuestionSet: unknown;

      if (hasStructuredQuestionSet) {
        parsed = parseGeneratedAmbiguityQuestionSet(preview.payload.structuredBody, questionSetContext);
        generatedQuestionSet = preview.payload.structuredBody;
      } else {
        const parsedText = parseGeneratedAmbiguityQuestionSetText(preview.payload.body, questionSetContext);

        parsed = parsedText;
        generatedQuestionSet = parsedText.value;
      }

      if (!parsed.ok || generatedQuestionSet === undefined) {
        const { fallbackParsed, fallbackQuestionSet } = parsedGeneratedQuestionSetLocalFallback({
          rawIdea: request.rawIdea,
          intakeGoal: request.intakeGoal,
          businessCriticIntensity: request.businessCriticIntensity ?? null,
          contextText: questionSetContext.contextText
        });

        if (fallbackParsed.ok) {
          return {
            status: "generated",
            promptTemplateRef: GENERATED_AMBIGUITY_QUESTION_PROMPT_TEMPLATE_REF,
            schemaVersion: GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
            source: "local_fallback",
            generatedQuestionSet: fallbackQuestionSet,
            validationIssues: parsed.issues,
            reason:
              "Codex returned a question-generation artifact that did not match the generated question JSON schema, so Solo Superman used a conservative open-text fallback question set."
          } as const;
        }

        return {
          status: "invalid",
          promptTemplateRef: GENERATED_AMBIGUITY_QUESTION_PROMPT_TEMPLATE_REF,
          schemaVersion: GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
          source: "codex_runtime_invalid_json",
          validationIssues: [...parsed.issues, ...fallbackParsed.issues],
          reason: `Codex returned a question-generation artifact, but its body did not match the generated question JSON schema. ${parsed.issues
            .slice(0, 3)
            .join(" ")}`
        } as const;
      }

      return {
        status: "generated",
        promptTemplateRef: GENERATED_AMBIGUITY_QUESTION_PROMPT_TEMPLATE_REF,
        schemaVersion: GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
        source: "codex_runtime_preview",
        generatedQuestionSet
      } as const;
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
          targetRef: stringFromBody(body.targetRef, "targetRef"),
          ...(Object.prototype.hasOwnProperty.call(body, "generatedQuestionSet")
            ? { generatedQuestionSet: body.generatedQuestionSet }
            : {})
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

  app.post("/api/v1/queue-items/:queueItemId/defer", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);
      const routeQueueItemId = context.req.param("queueItemId") as QueueItemId;
      const bodyQueueItemId = stringFromBody(body.queueItemId, "queueItemId") as QueueItemId;

      if (bodyQueueItemId !== routeQueueItemId) {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "queueItemId must match the queue item route param.");
      }

      return service.runSessionCommand({
        sessionId: stringFromBody(body.sessionId, "sessionId") as SessionId,
        commandType: "DeferQueueItem",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          queueItemId: routeQueueItemId,
          reason: stringFromBody(body.reason, "reason"),
          ...(typeof body.nextValidationAction === "string"
            ? { nextValidationAction: body.nextValidationAction }
            : {}),
          ...(body.riskDisposition === "known_risk_next_validation_action"
            ? { riskDisposition: "known_risk_next_validation_action" }
            : {})
        }
      });
    })
  );

  app.post("/api/v1/queue-items/:queueItemId/dismiss", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);
      const routeQueueItemId = context.req.param("queueItemId") as QueueItemId;
      const bodyQueueItemId = stringFromBody(body.queueItemId, "queueItemId") as QueueItemId;

      if (bodyQueueItemId !== routeQueueItemId) {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "queueItemId must match the queue item route param.");
      }

      return service.runSessionCommand({
        sessionId: stringFromBody(body.sessionId, "sessionId") as SessionId,
        commandType: "DismissQueueItem",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          queueItemId: routeQueueItemId,
          reason: stringFromBody(body.reason, "reason")
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
      const researchRunId = optionalStringFromBody(body.researchRunId, "researchRunId") as ResearchRunId | undefined;
      const sourceTitle = optionalStringFromBody(body.sourceTitle, "sourceTitle");
      const sourceUrl = optionalStringFromBody(body.sourceUrl, "sourceUrl");
      const sourceReliability = optionalResearchSourceReliabilityFromBody(body.sourceReliability, "sourceReliability");
      const sourcePublishedAt = optionalStringFromBody(body.sourcePublishedAt, "sourcePublishedAt");
      const sourceRetrievedAt = optionalStringFromBody(body.sourceRetrievedAt, "sourceRetrievedAt");
      const limitationNotes = optionalStringFromBody(body.limitationNotes, "limitationNotes");
      const claim = optionalStringFromBody(body.claim, "claim");
      const decisionContext = optionalStringFromBody(body.decisionContext, "decisionContext");
      const specSectionRef = optionalStringFromBody(body.specSectionRef, "specSectionRef");
      const questionRef = optionalStringFromBody(body.questionRef, "questionRef");
      const implicationScope = optionalStringFromBody(body.implicationScope, "implicationScope");
      const sourceRequiredAfter = optionalStringFromBody(body.sourceRequiredAfter, "sourceRequiredAfter");
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
          ...(researchRunId ? { researchRunId } : {}),
          ...(sourceTitle ? { sourceTitle } : {}),
          ...(sourceUrl ? { sourceUrl } : {}),
          ...(sourceReliability ? { sourceReliability } : {}),
          ...(sourcePublishedAt ? { sourcePublishedAt } : {}),
          ...(sourceRetrievedAt ? { sourceRetrievedAt } : {}),
          ...(limitationNotes ? { limitationNotes } : {}),
          ...(claim ? { claim } : {}),
          ...(decisionContext ? { decisionContext } : {}),
          ...(specSectionRef ? { specSectionRef } : {}),
          ...(questionRef ? { questionRef } : {}),
          ...(implicationScope ? { implicationScope } : {}),
          ...(typeof body.staleSensitive === "boolean" ? { staleSensitive: body.staleSensitive } : {}),
          ...(sourceRequiredAfter ? { sourceRequiredAfter } : {}),
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

  app.post("/api/v1/research-cards/:cardId/resolve", async (context) =>
    withCommandResponse(context, async (service) => {
      const body = await jsonBody(context);
      const cardId = context.req.param("cardId") as QueueItemId;
      const bodyCardId = stringFromBody(body.cardId, "cardId") as QueueItemId;
      const rationale = optionalStringFromBody(body.rationale, "rationale");

      if (bodyCardId !== cardId) {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "cardId must match the route param.");
      }

      return service.runSessionCommand({
        sessionId: stringFromBody(body.sessionId, "sessionId") as SessionId,
        commandType: "ResolveResearchQueueCard",
        expectedStateVersion: stateVersionFromBody(body.expectedStateVersion),
        payload: {
          cardId,
          outcome: researchQueueTerminalOutcomeFromBody(body.outcome),
          ...(rationale ? { rationale } : {})
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

  app.get("/api/v1/runtime/status", async (context) => {
    const status = await codexRuntimeAdapter.getStatus();

    console.log(JSON.stringify({
      type: "sidecar-runtime-status",
      status: status.status,
      executionMode: status.executionMode,
      liveTurnExecutionEnabled: status.liveTurnExecutionEnabled,
      accountStatus: status.account.status,
      hasAccountEmail: Boolean(status.account.email),
      reason: status.account.reason ?? status.reason ?? null,
      origin: context.req.header("origin") ?? null,
      at: new Date().toISOString()
    }));

    return context.json(jsonSuccess(context, status));
  });

  app.post("/api/v1/runtime/codex/login/start", async (context) => {
    const loginStart = await codexRuntimeAdapter.startLogin();

    console.log(JSON.stringify({
      type: "sidecar-codex-login-start",
      status: loginStart.status,
      terminal: loginStart.terminal,
      reason: loginStart.reason ?? null,
      origin: context.req.header("origin") ?? null,
      at: new Date().toISOString()
    }));

    return context.json(jsonSuccess(context, loginStart));
  });

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

  app.post("/api/v1/sessions/:sessionId/planning-handoff", async (context) =>
    withCommandResponse(context, async (service) => {
      const routeSessionId = context.req.param("sessionId") as SessionId;
      const request = createPlanningHandoffRequestFromBody(routeSessionId, await jsonBody(context));

      return service.runSessionCommand({
        sessionId: routeSessionId,
        commandType: "CreatePlanningHandoff",
        expectedStateVersion: request.expectedStateVersion,
        payload: {
          sourceRefs: request.sourceRefs,
          ...(request.requestedScope ? { requestedScope: request.requestedScope } : {})
        }
      });
    })
  );

  app.get("/api/v1/sessions/:sessionId/planning-handoff", async (context) =>
    withProductEngine(context, (service) =>
      service.getPlanningHandoff(context.req.param("sessionId") as SessionId)
    )
  );

  app.post("/api/v1/sessions/:sessionId/execution-authority", async (context) =>
    withCommandResponse(context, async (service) => {
      const routeSessionId = context.req.param("sessionId") as SessionId;
      const request = createExecutionAuthorityRequestFromBody(routeSessionId, await jsonBody(context));

      return service.runSessionCommand({
        sessionId: routeSessionId,
        commandType: "CreateExecutionAuthority",
        expectedStateVersion: request.expectedStateVersion,
        idempotencyKey: request.idempotencyKey,
        payload: executionAuthorityPayloadFromRequest(request)
      });
    })
  );

  app.get("/api/v1/sessions/:sessionId/execution-authority", async (context) =>
    withProductEngine(context, (service) =>
      service.getExecutionAuthority(context.req.param("sessionId") as SessionId)
    )
  );

  app.post("/api/v1/sessions/:sessionId/chatgpt-browser-delegations", async (context) =>
    withCommandResponse(context, async (service) => {
      const routeSessionId = context.req.param("sessionId") as SessionId;
      const request = createChatGptBrowserDelegationRunRequestFromBody(routeSessionId, await jsonBody(context));

      return service.runSessionCommand({
        sessionId: routeSessionId,
        commandType: "CreateChatGptBrowserDelegationRun",
        expectedStateVersion: request.expectedStateVersion,
        idempotencyKey: request.idempotencyKey,
        payload: chatGptBrowserDelegationPayloadFromRequest(request)
      });
    })
  );

  app.post("/api/v1/sessions/:sessionId/chatgpt-browser-delegations/:runId/revoke", async (context) =>
    withCommandResponse(context, async (service) => {
      const routeSessionId = context.req.param("sessionId") as SessionId;
      const routeRunId = context.req.param("runId");
      const request = revokeChatGptBrowserDelegationRunRequestFromBody(
        routeSessionId,
        routeRunId,
        await jsonBody(context)
      );

      return service.runSessionCommand({
        sessionId: routeSessionId,
        commandType: "RevokeChatGptBrowserDelegationRun",
        expectedStateVersion: request.expectedStateVersion,
        idempotencyKey: request.idempotencyKey,
        payload: {
          runId: request.runId,
          reason: request.reason,
          ...(request.auditRefs ? { auditRefs: request.auditRefs } : {})
        }
      });
    })
  );

  app.get("/api/v1/sessions/:sessionId/chatgpt-browser-delegations", async (context) =>
    withProductEngine(context, (service) =>
      service.getChatGptBrowserDelegation(context.req.param("sessionId") as SessionId)
    )
  );

  app.post("/api/v1/sessions/:sessionId/service-page-use-permissions", async (context) =>
    withCommandResponse(context, async (service) => {
      const routeSessionId = context.req.param("sessionId") as SessionId;
      const request = servicePageUsePermissionRequestFromBody(routeSessionId, await jsonBody(context));

      return service.runSessionCommand({
        sessionId: routeSessionId,
        commandType: "CreateServicePageUsePermission",
        expectedStateVersion: request.expectedStateVersion,
        idempotencyKey: request.idempotencyKey,
        payload: servicePageUsePermissionPayloadFromRequest(request)
      });
    })
  );

  app.post("/api/v1/sessions/:sessionId/service-page-use-permissions/:permissionId/revoke", async (context) =>
    withCommandResponse(context, async (service) => {
      const routeSessionId = context.req.param("sessionId") as SessionId;
      const routePermissionId = context.req.param("permissionId");
      const request = revokeServicePageUsePermissionRequestFromBody(
        routeSessionId,
        routePermissionId,
        await jsonBody(context)
      );

      return service.runSessionCommand({
        sessionId: routeSessionId,
        commandType: "RevokeServicePageUsePermission",
        expectedStateVersion: request.expectedStateVersion,
        idempotencyKey: request.idempotencyKey,
        payload: {
          permissionId: request.permissionId,
          reason: request.reason,
          ...(request.auditRefs ? { auditRefs: request.auditRefs } : {})
        }
      });
    })
  );

  app.post("/api/v1/sessions/:sessionId/service-page-use-permissions/:permissionId/artifacts/delete", async (context) =>
    withCommandResponse(context, async (service) => {
      const routeSessionId = context.req.param("sessionId") as SessionId;
      const routePermissionId = context.req.param("permissionId");
      const request = deleteServicePageUsePermissionArtifactsRequestFromBody(
        routeSessionId,
        routePermissionId,
        await jsonBody(context)
      );

      return service.runSessionCommand({
        sessionId: routeSessionId,
        commandType: "DeleteServicePageUsePermissionArtifacts",
        expectedStateVersion: request.expectedStateVersion,
        idempotencyKey: request.idempotencyKey,
        payload: {
          permissionId: request.permissionId,
          reason: request.reason,
          ...(request.auditRefs ? { auditRefs: request.auditRefs } : {})
        }
      });
    })
  );

  app.get("/api/v1/sessions/:sessionId/service-page-use-permissions", async (context) =>
    withProductEngine(context, (service) =>
      service.getServicePageUsePermission(context.req.param("sessionId") as SessionId)
    )
  );


  app.post("/api/v1/sessions/:sessionId/implementation-step-ledger", async (context) =>
    withCommandResponse(context, async (service) => {
      const routeSessionId = context.req.param("sessionId") as SessionId;
      const request = implementationStepLedgerRequestFromBody(routeSessionId, await jsonBody(context));

      return service.runSessionCommand({
        sessionId: routeSessionId,
        commandType: "RecordImplementationStepLedger",
        expectedStateVersion: request.expectedStateVersion,
        idempotencyKey: request.idempotencyKey,
        payload: implementationStepLedgerPayloadFromRequest(request)
      });
    })
  );

  app.get("/api/v1/sessions/:sessionId/implementation-step-ledger", async (context) =>
    withProductEngine(context, (service) =>
      service.getImplementationStepLedger(context.req.param("sessionId") as SessionId)
    )
  );


  app.post("/api/v1/sessions/:sessionId/auto-implementation-runs", async (context) =>
    withProductEngine(context, async (service) => {
      const routeSessionId = context.req.param("sessionId") as SessionId;
      const request = createAutoImplementationRunRequestFromBody(routeSessionId, await jsonBody(context));

      return service.createAutoImplementationRun(request);
    })
  );

  app.get("/api/v1/sessions/:sessionId/auto-implementation-runs", async (context) =>
    withProductEngine(context, (service) =>
      service.getAutoImplementationRuns(context.req.param("sessionId") as SessionId)
    )
  );

  app.post("/api/v1/sessions/:sessionId/auto-implementation-runs/:runId/pr-mutations", async (context) =>
    withProductEngine(context, async (service) => {
      const routeSessionId = context.req.param("sessionId") as SessionId;
      const routeRunId = context.req.param("runId");
      const request = recordAutoImplementationPullRequestMutationRequestFromBody(
        routeSessionId,
        routeRunId,
        await jsonBody(context)
      );

      return service.recordAutoImplementationPullRequestMutation(request);
    })
  );

  app.post("/api/v1/sessions/:sessionId/auto-implementation-runs/:runId/worker-jobs", async (context) =>
    withProductEngine(context, async (service) => {
      const routeSessionId = context.req.param("sessionId") as SessionId;
      const routeRunId = context.req.param("runId");
      const request = createAutoImplementationWorkerJobRequestFromBody(
        routeSessionId,
        routeRunId,
        await jsonBody(context)
      );

      return service.createAutoImplementationWorkerJob(request);
    })
  );

  app.post("/api/v1/sessions/:sessionId/auto-implementation-runs/:runId/worker-jobs/:jobId/complete", async (context) =>
    withProductEngine(context, async (service) => {
      const routeSessionId = context.req.param("sessionId") as SessionId;
      const routeRunId = context.req.param("runId");
      const routeJobId = context.req.param("jobId");
      const request = completeAutoImplementationWorkerJobRequestFromBody(
        routeSessionId,
        routeRunId,
        routeJobId,
        await jsonBody(context)
      );

      return service.completeAutoImplementationWorkerJob(request);
    })
  );

  app.post("/api/v1/sessions/:sessionId/auto-implementation-runs/:runId/worker-jobs/:jobId/ledger-import", async (context) =>
    withProductEngine(context, async (service) => {
      const routeSessionId = context.req.param("sessionId") as SessionId;
      const routeRunId = context.req.param("runId");
      const routeJobId = context.req.param("jobId");
      const request = importAutoImplementationWorkerLedgerRequestFromBody(
        routeSessionId,
        routeRunId,
        routeJobId,
        await jsonBody(context)
      );

      return service.importAutoImplementationWorkerLedger(request);
    })
  );

  app.post("/api/v1/sessions/:sessionId/auto-implementation-runs/:runId/worker-jobs/:jobId/run", async (context) =>
    withProductEngine(context, async (service) => {
      const routeSessionId = context.req.param("sessionId") as SessionId;
      const routeRunId = context.req.param("runId");
      const routeJobId = context.req.param("jobId");
      const request = runAutoImplementationWorkerJobRequestFromBody(
        routeSessionId,
        routeRunId,
        routeJobId,
        await jsonBody(context)
      );

      return service.runAutoImplementationWorkerJob(request);
    })
  );

  app.post("/api/v1/sessions/:sessionId/auto-implementation-runs/:runId/worker-jobs/:jobId/advance-stage", async (context) =>
    withProductEngine(context, async (service) => {
      const routeSessionId = context.req.param("sessionId") as SessionId;
      const routeRunId = context.req.param("runId");
      const routeJobId = context.req.param("jobId");
      const request = advanceAutoImplementationWorkerStageRequestFromBody(
        routeSessionId,
        routeRunId,
        routeJobId,
        await jsonBody(context)
      );

      return service.advanceAutoImplementationWorkerStage(request);
    })
  );

  app.post("/api/v1/sessions/:sessionId/auto-implementation-runs/:runId/stages/:stage", async (context) =>
    withProductEngine(context, async (service) => {
      const routeSessionId = context.req.param("sessionId") as SessionId;
      const routeRunId = context.req.param("runId");
      const routeStage = autoImplementationStageFromValue(context.req.param("stage"), "route stage");
      const request = recordAutoImplementationStageRequestFromBody(
        routeSessionId,
        routeRunId,
        routeStage,
        await jsonBody(context)
      );

      return service.recordAutoImplementationStage(request);
    })
  );

  app.post("/api/v1/execution-authorities/:authorityRecordId/preflight", async (context) =>
    withProductEngine(context, async (service) => {
      const request = validateExecutionAuthorityPreflightRequestFromBody(await jsonBody(context));

      return service.validateExecutionAuthorityPreflight({
        ...request,
        authorityRecordId: context.req.param("authorityRecordId")
      });
    })
  );

  app.post("/api/v1/execution-authorities/:authorityRecordId/file-diff", async (context) =>
    withProductEngine(context, async (service) => {
      const request = executeFileDiffRequestFromBody(await jsonBody(context));

      return service.executeFileDiff({
        ...request,
        authorityRecordId: context.req.param("authorityRecordId")
      });
    })
  );

  app.post("/api/v1/execution-authorities/:authorityRecordId/shell-command", async (context) =>
    withProductEngine(context, async (service) => {
      const request = executeShellCommandRequestFromBody(await jsonBody(context));

      return service.executeShellCommand({
        ...request,
        authorityRecordId: context.req.param("authorityRecordId")
      });
    })
  );

  app.post("/api/v1/execution-authorities/:authorityRecordId/browser-action", async (context) =>
    withProductEngine(context, async (service) => {
      const request = executeBrowserActionRequestFromBody(await jsonBody(context));

      return service.executeBrowserAction({
        ...request,
        authorityRecordId: context.req.param("authorityRecordId")
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

  app.get("/api/v1/events/stream", async (context) => {
    const sessionId = context.req.query("sessionId")?.trim() as SessionId | undefined;

    if (!sessionId) {
      return context.json(
        jsonError(context, "STREAM_SESSION_REQUIRED", "SSE event stream requires a sessionId query parameter.", {
          requiredQueryParams: ["sessionId"]
        }),
        400
      );
    }

    if (!commandService) {
      return context.json(
        jsonError(context, "SIDECAR_NOT_READY", "SSE event stream requires migrated local storage.", {
          migrationState: migrationStatus.state
        }),
        503
      );
    }

    try {
      const queue = await commandService.getQueue(sessionId);
      const body = `retry: 5000\n${sseFrame(decisionQueueProjectionUpdatedEvent(sessionId, queue.version))}`;

      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no"
        }
      });
    } catch (error) {
      if (error instanceof ProductEngineServiceError) {
        return context.json(
          jsonError(context, error.code, error.message, error.details),
          error.code === "RESOURCE_NOT_FOUND" ? 404 : 400
        );
      }

      throw error;
    }
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
