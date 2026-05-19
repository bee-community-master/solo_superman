import type { CommandType } from "../product-engine";

export type ApiRouteMethod = "GET" | "POST";
export type ApiRouteCommandMapping = CommandType | "none";

export interface ApiRouteDefinition {
  readonly routeId: string;
  readonly clientName: string;
  readonly method: ApiRouteMethod;
  readonly path: string;
  readonly requiredQueryParams?: readonly string[];
  readonly commandType: ApiRouteCommandMapping;
  readonly implementedInPr01: boolean;
}

export const API_ROUTE_CATALOG = [
  {
    routeId: "healthz",
    clientName: "getHealth",
    method: "GET",
    path: "/healthz",
    commandType: "none",
    implementedInPr01: true
  },
  {
    routeId: "readyz",
    clientName: "getReadiness",
    method: "GET",
    path: "/readyz",
    commandType: "none",
    implementedInPr01: true
  },
  {
    routeId: "createProject",
    clientName: "createProject",
    method: "POST",
    path: "/api/v1/projects",
    commandType: "StartProject",
    implementedInPr01: false
  },
  {
    routeId: "listProjects",
    clientName: "listProjects",
    method: "GET",
    path: "/api/v1/projects",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "getProject",
    clientName: "getProject",
    method: "GET",
    path: "/api/v1/projects/:projectId",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "listResearchAllowlists",
    clientName: "listResearchAllowlists",
    method: "GET",
    path: "/api/v1/projects/:projectId/research-allowlists",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "createResearchAllowlist",
    clientName: "createResearchAllowlist",
    method: "POST",
    path: "/api/v1/projects/:projectId/research-allowlists",
    commandType: "CreateResearchAllowlist",
    implementedInPr01: false
  },
  {
    routeId: "updateResearchAllowlist",
    clientName: "updateResearchAllowlist",
    method: "POST",
    path: "/api/v1/projects/:projectId/research-allowlists/:allowlistId",
    commandType: "UpdateResearchAllowlist",
    implementedInPr01: false
  },
  {
    routeId: "pauseResearchAllowlist",
    clientName: "pauseResearchAllowlist",
    method: "POST",
    path: "/api/v1/projects/:projectId/research-allowlists/:allowlistId/pause",
    commandType: "PauseResearchAllowlist",
    implementedInPr01: false
  },
  {
    routeId: "revokeResearchAllowlist",
    clientName: "revokeResearchAllowlist",
    method: "POST",
    path: "/api/v1/projects/:projectId/research-allowlists/:allowlistId/revoke",
    commandType: "RevokeResearchAllowlist",
    implementedInPr01: false
  },
  {
    routeId: "prepareResearchDisclosure",
    clientName: "prepareResearchDisclosure",
    method: "POST",
    path: "/api/v1/projects/:projectId/research-disclosures",
    commandType: "PrepareResearchDisclosure",
    implementedInPr01: false
  },
  {
    routeId: "listResearchDisclosures",
    clientName: "listResearchDisclosures",
    method: "GET",
    path: "/api/v1/projects/:projectId/research-disclosures",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "listResearchRuns",
    clientName: "listResearchRuns",
    method: "GET",
    path: "/api/v1/projects/:projectId/research-runs",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "startResearchRun",
    clientName: "startResearchRun",
    method: "POST",
    path: "/api/v1/projects/:projectId/research-runs",
    commandType: "StartResearchRun",
    implementedInPr01: false
  },
  {
    routeId: "getResearchRunStatus",
    clientName: "getResearchRunStatus",
    method: "GET",
    path: "/api/v1/projects/:projectId/research-runs/:researchRunId/status",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "cancelResearchRun",
    clientName: "cancelResearchRun",
    method: "POST",
    path: "/api/v1/projects/:projectId/research-runs/:researchRunId/cancel",
    commandType: "CancelResearchRun",
    implementedInPr01: false
  },
  {
    routeId: "retryResearchRun",
    clientName: "retryResearchRun",
    method: "POST",
    path: "/api/v1/projects/:projectId/research-runs/:researchRunId/retry",
    commandType: "RetryResearchRun",
    implementedInPr01: false
  },
  {
    routeId: "listPhase15bUpgradeHints",
    clientName: "listPhase15bUpgradeHints",
    method: "GET",
    path: "/api/v1/projects/:projectId/phase15b-upgrade-hints",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "exportPhase15bUpgradeHints",
    clientName: "exportPhase15bUpgradeHints",
    method: "GET",
    path: "/api/v1/projects/:projectId/phase15b-upgrade-hints/export",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "startOrResumeSession",
    clientName: "startOrResumeSession",
    method: "POST",
    path: "/api/v1/projects/:projectId/sessions",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "getSession",
    clientName: "getSession",
    method: "GET",
    path: "/api/v1/projects/:projectId/sessions/:sessionId",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "changeProjectPurposeMode",
    clientName: "changeProjectPurposeMode",
    method: "POST",
    path: "/api/v1/sessions/:sessionId/project-purpose-mode",
    commandType: "ChangeProjectPurposeMode",
    implementedInPr01: false
  },
  {
    routeId: "changeBusinessCriticIntensity",
    clientName: "changeBusinessCriticIntensity",
    method: "POST",
    path: "/api/v1/sessions/:sessionId/business-critic-intensity",
    commandType: "ChangeBusinessCriticIntensity",
    implementedInPr01: false
  },
  {
    routeId: "captureIntake",
    clientName: "captureIntake",
    method: "POST",
    path: "/api/v1/sessions/:sessionId/intake",
    commandType: "CaptureIntake",
    implementedInPr01: false
  },
  {
    routeId: "draftInitialSpec",
    clientName: "draftInitialSpec",
    method: "POST",
    path: "/api/v1/sessions/:sessionId/spec/initial",
    commandType: "DraftInitialSpec",
    implementedInPr01: false
  },
  {
    routeId: "getLivingSpec",
    clientName: "getLivingSpec",
    method: "GET",
    path: "/api/v1/sessions/:sessionId/spec",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "analyzeAmbiguity",
    clientName: "analyzeAmbiguity",
    method: "POST",
    path: "/api/v1/sessions/:sessionId/spec/analyze",
    commandType: "AnalyzeAmbiguity",
    implementedInPr01: false
  },
  {
    routeId: "listSpecVersions",
    clientName: "listSpecVersions",
    method: "GET",
    path: "/api/v1/sessions/:sessionId/spec/versions",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "getDecisionQueue",
    clientName: "getDecisionQueue",
    method: "GET",
    path: "/api/v1/sessions/:sessionId/queue",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "activateQuestionBatch",
    clientName: "activateQuestionBatch",
    method: "POST",
    path: "/api/v1/sessions/:sessionId/queue/activate",
    commandType: "ActivateQuestionBatch",
    implementedInPr01: false
  },
  {
    routeId: "submitAnswer",
    clientName: "submitAnswer",
    method: "POST",
    path: "/api/v1/questions/:questionId/answers",
    commandType: "SubmitAnswer",
    implementedInPr01: false
  },
  {
    routeId: "deferQueueItem",
    clientName: "deferQueueItem",
    method: "POST",
    path: "/api/v1/queue-items/:queueItemId/defer",
    commandType: "DeferQueueItem",
    implementedInPr01: false
  },
  {
    routeId: "dismissQueueItem",
    clientName: "dismissQueueItem",
    method: "POST",
    path: "/api/v1/queue-items/:queueItemId/dismiss",
    commandType: "DismissQueueItem",
    implementedInPr01: false
  },
  {
    routeId: "planResearch",
    clientName: "planResearch",
    method: "POST",
    path: "/api/v1/sessions/:sessionId/research-tasks",
    commandType: "PlanResearch",
    implementedInPr01: false
  },
  {
    routeId: "getResearchEvidence",
    clientName: "getResearchEvidence",
    method: "GET",
    path: "/api/v1/sessions/:sessionId/research",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "importResearchResult",
    clientName: "importResearchResult",
    method: "POST",
    path: "/api/v1/research-tasks/:researchTaskId/results",
    commandType: "ImportResearchResult",
    implementedInPr01: false
  },
  {
    routeId: "synthesizeEvidence",
    clientName: "synthesizeEvidence",
    method: "POST",
    path: "/api/v1/research-results/:researchResultId/synthesize",
    commandType: "SynthesizeEvidence",
    implementedInPr01: false
  },
  {
    routeId: "resolveResearchQueueCard",
    clientName: "resolveResearchQueueCard",
    method: "POST",
    path: "/api/v1/research-cards/:cardId/resolve",
    commandType: "ResolveResearchQueueCard",
    implementedInPr01: false
  },
  {
    routeId: "createSpecUpdatePreview",
    clientName: "createSpecUpdatePreview",
    method: "POST",
    path: "/api/v1/spec-updates",
    commandType: "CreateSpecUpdatePreview",
    implementedInPr01: false
  },
  {
    routeId: "createDecisionCard",
    clientName: "createDecisionCard",
    method: "POST",
    path: "/api/v1/decisions",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "resolveDecision",
    clientName: "resolveDecision",
    method: "POST",
    path: "/api/v1/decisions/:decisionId/resolve",
    commandType: "ResolveDecision",
    implementedInPr01: false
  },
  {
    routeId: "createSpecVersion",
    clientName: "createSpecVersion",
    method: "POST",
    path: "/api/v1/sessions/:sessionId/spec/versions",
    commandType: "CreateSpecVersion",
    implementedInPr01: false
  },
  {
    routeId: "getRuntimeStatus",
    clientName: "getRuntimeStatus",
    method: "GET",
    path: "/api/v1/runtime/status",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "startCodexLogin",
    clientName: "startCodexLogin",
    method: "POST",
    path: "/api/v1/runtime/codex/login/start",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "createRuntimePreview",
    clientName: "createRuntimePreview",
    method: "POST",
    path: "/api/v1/runtime/codex/preview",
    commandType: "CreateRuntimePreview",
    implementedInPr01: false
  },
  {
    routeId: "createManualHandoff",
    clientName: "createManualHandoff",
    method: "POST",
    path: "/api/v1/runtime/manual-handoff",
    commandType: "CreateRuntimePreview",
    implementedInPr01: false
  },
  {
    routeId: "convertRuntimeArtifact",
    clientName: "convertRuntimeArtifact",
    method: "POST",
    path: "/api/v1/runtime/artifacts/:artifactId/convert",
    commandType: "ConvertRuntimeArtifact",
    implementedInPr01: false
  },
  {
    routeId: "blockRuntimeArtifact",
    clientName: "blockRuntimeArtifact",
    method: "POST",
    path: "/api/v1/runtime/artifacts/:artifactId/block",
    commandType: "ConvertRuntimeArtifact",
    implementedInPr01: false
  },
  {
    routeId: "getCompleteness",
    clientName: "getCompleteness",
    method: "GET",
    path: "/api/v1/sessions/:sessionId/completeness",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "scoreCompleteness",
    clientName: "scoreCompleteness",
    method: "POST",
    path: "/api/v1/sessions/:sessionId/completeness/score",
    commandType: "ScoreCompleteness",
    implementedInPr01: false
  },
  {
    routeId: "createCompletionCandidate",
    clientName: "createCompletionCandidate",
    method: "POST",
    path: "/api/v1/sessions/:sessionId/completion-candidate",
    commandType: "ScoreCompleteness",
    implementedInPr01: false
  },
  {
    routeId: "getFounderBrief",
    clientName: "getFounderBrief",
    method: "GET",
    path: "/api/v1/sessions/:sessionId/founder-brief",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "prepareFounderBriefExport",
    clientName: "prepareFounderBriefExport",
    method: "POST",
    path: "/api/v1/sessions/:sessionId/founder-brief/export",
    commandType: "PrepareFounderBrief",
    implementedInPr01: false
  },
  {
    routeId: "createPlanningHandoff",
    clientName: "createPlanningHandoff",
    method: "POST",
    path: "/api/v1/sessions/:sessionId/planning-handoff",
    commandType: "CreatePlanningHandoff",
    implementedInPr01: false
  },
  {
    routeId: "getPlanningHandoff",
    clientName: "getPlanningHandoff",
    method: "GET",
    path: "/api/v1/sessions/:sessionId/planning-handoff",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "createExecutionAuthority",
    clientName: "createExecutionAuthority",
    method: "POST",
    path: "/api/v1/sessions/:sessionId/execution-authority",
    commandType: "CreateExecutionAuthority",
    implementedInPr01: false
  },
  {
    routeId: "getExecutionAuthority",
    clientName: "getExecutionAuthority",
    method: "GET",
    path: "/api/v1/sessions/:sessionId/execution-authority",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "validateExecutionAuthorityPreflight",
    clientName: "validateExecutionAuthorityPreflight",
    method: "POST",
    path: "/api/v1/execution-authorities/:authorityRecordId/preflight",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "executeFileDiff",
    clientName: "executeFileDiff",
    method: "POST",
    path: "/api/v1/execution-authorities/:authorityRecordId/file-diff",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "executeShellCommand",
    clientName: "executeShellCommand",
    method: "POST",
    path: "/api/v1/execution-authorities/:authorityRecordId/shell-command",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "executeBrowserAction",
    clientName: "executeBrowserAction",
    method: "POST",
    path: "/api/v1/execution-authorities/:authorityRecordId/browser-action",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "createChatGptBrowserDelegationRun",
    clientName: "createChatGptBrowserDelegationRun",
    method: "POST",
    path: "/api/v1/sessions/:sessionId/chatgpt-browser-delegations",
    commandType: "CreateChatGptBrowserDelegationRun",
    implementedInPr01: false
  },
  {
    routeId: "getChatGptBrowserDelegationRuns",
    clientName: "getChatGptBrowserDelegationRuns",
    method: "GET",
    path: "/api/v1/sessions/:sessionId/chatgpt-browser-delegations",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "revokeChatGptBrowserDelegationRun",
    clientName: "revokeChatGptBrowserDelegationRun",
    method: "POST",
    path: "/api/v1/sessions/:sessionId/chatgpt-browser-delegations/:runId/revoke",
    commandType: "RevokeChatGptBrowserDelegationRun",
    implementedInPr01: false
  },
  {
    routeId: "createServicePageUsePermission",
    clientName: "createServicePageUsePermission",
    method: "POST",
    path: "/api/v1/sessions/:sessionId/service-page-use-permissions",
    commandType: "CreateServicePageUsePermission",
    implementedInPr01: false
  },
  {
    routeId: "getServicePageUsePermissions",
    clientName: "getServicePageUsePermissions",
    method: "GET",
    path: "/api/v1/sessions/:sessionId/service-page-use-permissions",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "revokeServicePageUsePermission",
    clientName: "revokeServicePageUsePermission",
    method: "POST",
    path: "/api/v1/sessions/:sessionId/service-page-use-permissions/:permissionId/revoke",
    commandType: "RevokeServicePageUsePermission",
    implementedInPr01: false
  },
  {
    routeId: "deleteServicePageUsePermissionArtifacts",
    clientName: "deleteServicePageUsePermissionArtifacts",
    method: "POST",
    path: "/api/v1/sessions/:sessionId/service-page-use-permissions/:permissionId/artifacts/delete",
    commandType: "DeleteServicePageUsePermissionArtifacts",
    implementedInPr01: false
  },
  {
    routeId: "recordImplementationStepLedger",
    clientName: "recordImplementationStepLedger",
    method: "POST",
    path: "/api/v1/sessions/:sessionId/implementation-step-ledger",
    commandType: "RecordImplementationStepLedger",
    implementedInPr01: false
  },
  {
    routeId: "getImplementationStepLedger",
    clientName: "getImplementationStepLedger",
    method: "GET",
    path: "/api/v1/sessions/:sessionId/implementation-step-ledger",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "createAutoImplementationRun",
    clientName: "createAutoImplementationRun",
    method: "POST",
    path: "/api/v1/sessions/:sessionId/auto-implementation-runs",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "getAutoImplementationRuns",
    clientName: "getAutoImplementationRuns",
    method: "GET",
    path: "/api/v1/sessions/:sessionId/auto-implementation-runs",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "getCommandStatus",
    clientName: "getCommandStatus",
    method: "GET",
    path: "/api/v1/commands/:commandId/status",
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "subscribeEventStream",
    clientName: "subscribeEventStream",
    method: "GET",
    path: "/api/v1/events/stream",
    requiredQueryParams: ["sessionId"],
    commandType: "none",
    implementedInPr01: false
  },
  {
    routeId: "getActivity",
    clientName: "getActivity",
    method: "GET",
    path: "/api/v1/sessions/:sessionId/activity",
    commandType: "none",
    implementedInPr01: false
  }
] as const satisfies readonly ApiRouteDefinition[];

export type ApiRoute = (typeof API_ROUTE_CATALOG)[number];
export type ApiRouteId = ApiRoute["routeId"];
export type ApiRouteClientName = ApiRoute["clientName"];

export const PR04_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  "createProject",
  "getSession",
  "captureIntake",
  "draftInitialSpec",
  "getLivingSpec",
  "analyzeAmbiguity",
  "getDecisionQueue",
  "activateQuestionBatch",
  "getCommandStatus"
] as const satisfies readonly ApiRouteId[];

export const PR05_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...PR04_MOUNTED_PRODUCT_API_ROUTE_IDS,
  "submitAnswer"
] as const satisfies readonly ApiRouteId[];

export const PR06_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...PR05_MOUNTED_PRODUCT_API_ROUTE_IDS,
  "planResearch",
  "getResearchEvidence",
  "importResearchResult",
  "synthesizeEvidence"
] as const satisfies readonly ApiRouteId[];

export const PR07_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...PR06_MOUNTED_PRODUCT_API_ROUTE_IDS,
  "getRuntimeStatus",
  "startCodexLogin",
  "createRuntimePreview",
  "createManualHandoff",
  "convertRuntimeArtifact",
  "blockRuntimeArtifact",
  "getActivity"
] as const satisfies readonly ApiRouteId[];

export const PR08_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...PR07_MOUNTED_PRODUCT_API_ROUTE_IDS,
  "getCompleteness",
  "scoreCompleteness",
  "createCompletionCandidate",
  "getFounderBrief",
  "prepareFounderBriefExport"
] as const satisfies readonly ApiRouteId[];

export const PR09_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...PR08_MOUNTED_PRODUCT_API_ROUTE_IDS,
  "listSpecVersions",
  "createSpecUpdatePreview",
  "resolveDecision",
  "createSpecVersion"
] as const satisfies readonly ApiRouteId[];

export const PR02_MOUNTED_PRODUCT_API_ROUTE_IDS = ["getCommandStatus"] as const satisfies readonly ApiRouteId[];

export const PHASE15A_PR02_ALLOWLIST_ROUTE_IDS = [
  "listResearchAllowlists",
  "createResearchAllowlist",
  "updateResearchAllowlist",
  "pauseResearchAllowlist",
  "revokeResearchAllowlist"
] as const satisfies readonly ApiRouteId[];

export const PHASE15A_PR02_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...PR09_MOUNTED_PRODUCT_API_ROUTE_IDS,
  ...PHASE15A_PR02_ALLOWLIST_ROUTE_IDS
] as const satisfies readonly ApiRouteId[];

export const PHASE15A_PR03_DISCLOSURE_ROUTE_IDS = [
  "prepareResearchDisclosure",
  "listResearchDisclosures"
] as const satisfies readonly ApiRouteId[];

export const PHASE15A_PR03_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...PHASE15A_PR02_MOUNTED_PRODUCT_API_ROUTE_IDS,
  ...PHASE15A_PR03_DISCLOSURE_ROUTE_IDS
] as const satisfies readonly ApiRouteId[];

export const PHASE15A_PR05_RESEARCH_RUN_ROUTE_IDS = [
  "listResearchRuns",
  "startResearchRun",
  "getResearchRunStatus",
  "cancelResearchRun",
  "retryResearchRun"
] as const satisfies readonly ApiRouteId[];

export const PHASE15A_PR05_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...PHASE15A_PR03_MOUNTED_PRODUCT_API_ROUTE_IDS,
  ...PHASE15A_PR05_RESEARCH_RUN_ROUTE_IDS
] as const satisfies readonly ApiRouteId[];

export const PHASE15A_PR07_RESEARCH_QUEUE_ROUTE_IDS = [
  "resolveResearchQueueCard"
] as const satisfies readonly ApiRouteId[];

export const PHASE15A_PR07_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...PHASE15A_PR05_MOUNTED_PRODUCT_API_ROUTE_IDS,
  ...PHASE15A_PR07_RESEARCH_QUEUE_ROUTE_IDS
] as const satisfies readonly ApiRouteId[];

export const PHASE15B_PR10_HINT_ROUTE_IDS = [
  "listPhase15bUpgradeHints",
  "exportPhase15bUpgradeHints"
] as const satisfies readonly ApiRouteId[];

export const PHASE15B_PR10_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...PHASE15A_PR07_MOUNTED_PRODUCT_API_ROUTE_IDS,
  ...PHASE15B_PR10_HINT_ROUTE_IDS
] as const satisfies readonly ApiRouteId[];

export const PHASE2_PR04_PLANNING_HANDOFF_ROUTE_IDS = [
  "createPlanningHandoff",
  "getPlanningHandoff"
] as const satisfies readonly ApiRouteId[];

export const PHASE2_PR04_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...PHASE15B_PR10_MOUNTED_PRODUCT_API_ROUTE_IDS,
  ...PHASE2_PR04_PLANNING_HANDOFF_ROUTE_IDS
] as const satisfies readonly ApiRouteId[];

export const PHASE1_QUEUE_RECOVERY_ROUTE_IDS = [
  "subscribeEventStream"
] as const satisfies readonly ApiRouteId[];

export const PHASE1_QUEUE_RECOVERY_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...PHASE2_PR04_MOUNTED_PRODUCT_API_ROUTE_IDS,
  ...PHASE1_QUEUE_RECOVERY_ROUTE_IDS
] as const satisfies readonly ApiRouteId[];

export const PHASE3_PR02_EXECUTION_AUTHORITY_ROUTE_IDS = [
  "createExecutionAuthority",
  "getExecutionAuthority",
  "validateExecutionAuthorityPreflight"
] as const satisfies readonly ApiRouteId[];

export const PHASE3_PR02_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...PHASE1_QUEUE_RECOVERY_MOUNTED_PRODUCT_API_ROUTE_IDS,
  ...PHASE3_PR02_EXECUTION_AUTHORITY_ROUTE_IDS
] as const satisfies readonly ApiRouteId[];

export const PHASE3_PR03_FILE_DIFF_ROUTE_IDS = [
  "executeFileDiff"
] as const satisfies readonly ApiRouteId[];

export const PHASE3_PR03_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...PHASE3_PR02_MOUNTED_PRODUCT_API_ROUTE_IDS,
  ...PHASE3_PR03_FILE_DIFF_ROUTE_IDS
] as const satisfies readonly ApiRouteId[];

export const PHASE3_PR04_SHELL_COMMAND_ROUTE_IDS = [
  "executeShellCommand"
] as const satisfies readonly ApiRouteId[];

export const PHASE3_PR04_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...PHASE3_PR03_MOUNTED_PRODUCT_API_ROUTE_IDS,
  ...PHASE3_PR04_SHELL_COMMAND_ROUTE_IDS
] as const satisfies readonly ApiRouteId[];

export const PHASE3_PR05_BROWSER_ACTION_ROUTE_IDS = [
  "executeBrowserAction"
] as const satisfies readonly ApiRouteId[];

export const PHASE3_PR05_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...PHASE3_PR04_MOUNTED_PRODUCT_API_ROUTE_IDS,
  ...PHASE3_PR05_BROWSER_ACTION_ROUTE_IDS
] as const satisfies readonly ApiRouteId[];

export const POST_PHASE3_PR01_PROJECT_PURPOSE_ROUTE_IDS = [
  "changeProjectPurposeMode"
] as const satisfies readonly ApiRouteId[];

export const POST_PHASE3_PR01_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...PHASE3_PR05_MOUNTED_PRODUCT_API_ROUTE_IDS,
  ...POST_PHASE3_PR01_PROJECT_PURPOSE_ROUTE_IDS
] as const satisfies readonly ApiRouteId[];

export const POST_PHASE3_PR02_BUSINESS_CRITIC_ROUTE_IDS = [
  "changeBusinessCriticIntensity",
  "deferQueueItem",
  "dismissQueueItem"
] as const satisfies readonly ApiRouteId[];

export const POST_PHASE3_PR02_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...POST_PHASE3_PR01_MOUNTED_PRODUCT_API_ROUTE_IDS,
  ...POST_PHASE3_PR02_BUSINESS_CRITIC_ROUTE_IDS
] as const satisfies readonly ApiRouteId[];

export const POST_PHASE3_PR03_CHATGPT_DELEGATION_ROUTE_IDS = [
  "createChatGptBrowserDelegationRun",
  "getChatGptBrowserDelegationRuns"
] as const satisfies readonly ApiRouteId[];

export const POST_PHASE3_PR03_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...POST_PHASE3_PR02_MOUNTED_PRODUCT_API_ROUTE_IDS,
  ...POST_PHASE3_PR03_CHATGPT_DELEGATION_ROUTE_IDS
] as const satisfies readonly ApiRouteId[];

export const POST_PHASE3_PR04_CHATGPT_DELEGATION_RUN_ROUTE_IDS = [
  "revokeChatGptBrowserDelegationRun"
] as const satisfies readonly ApiRouteId[];

export const POST_PHASE3_PR04_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...POST_PHASE3_PR03_MOUNTED_PRODUCT_API_ROUTE_IDS,
  ...POST_PHASE3_PR04_CHATGPT_DELEGATION_RUN_ROUTE_IDS
] as const satisfies readonly ApiRouteId[];

export const POST_PHASE3_PR05_SERVICE_PAGE_PERMISSION_ROUTE_IDS = [
  "createServicePageUsePermission",
  "getServicePageUsePermissions",
  "revokeServicePageUsePermission",
  "deleteServicePageUsePermissionArtifacts"
] as const satisfies readonly ApiRouteId[];

export const POST_PHASE3_PR05_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...POST_PHASE3_PR04_MOUNTED_PRODUCT_API_ROUTE_IDS,
  ...POST_PHASE3_PR05_SERVICE_PAGE_PERMISSION_ROUTE_IDS
] as const satisfies readonly ApiRouteId[];

export const POST_PHASE3_PR06_IMPLEMENTATION_STEP_LEDGER_ROUTE_IDS = [
  "recordImplementationStepLedger",
  "getImplementationStepLedger"
] as const satisfies readonly ApiRouteId[];

export const POST_PHASE3_PR06_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...POST_PHASE3_PR05_MOUNTED_PRODUCT_API_ROUTE_IDS,
  ...POST_PHASE3_PR06_IMPLEMENTATION_STEP_LEDGER_ROUTE_IDS
] as const satisfies readonly ApiRouteId[];


export const POST_PHASE3_PR07_AUTO_IMPLEMENTATION_ROUTE_IDS = [
  "createAutoImplementationRun",
  "getAutoImplementationRuns"
] as const satisfies readonly ApiRouteId[];

export const POST_PHASE3_PR07_MOUNTED_PRODUCT_API_ROUTE_IDS = [
  ...POST_PHASE3_PR06_MOUNTED_PRODUCT_API_ROUTE_IDS,
  ...POST_PHASE3_PR07_AUTO_IMPLEMENTATION_ROUTE_IDS
] as const satisfies readonly ApiRouteId[];

export const CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS = POST_PHASE3_PR07_MOUNTED_PRODUCT_API_ROUTE_IDS;
