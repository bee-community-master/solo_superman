import {
  BLOCKED_ACTION_TYPES,
  CODEX_APP_SERVER_GENERATED_VERSION,
  CODEX_APPLY_POLICY_BY_TURN_PURPOSE,
  CODEX_APPLY_POLICIES,
  CODEX_ARTIFACT_KIND_BY_TURN_PURPOSE,
  CODEX_ARTIFACT_KINDS,
  CODEX_RUNTIME_ADAPTER_VERSION,
  CODEX_RUNTIME_TRANSPORT,
  CODEX_TURN_PURPOSES,
  CONTRACT_SCHEMA_VERSION,
  PHASE15B_APPROVAL_TYPES,
  PHASE15B_ISO_UTC_TIMESTAMP_PATTERN,
  PHASE15B_NETWORK_MODES,
  PHASE15B_REQUIRED_ACTORS,
  PHASE15B_RISK_LEVELS,
  PHASE15B_SOURCE_REF_KINDS,
  PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION,
  assertPhase15bUpgradeHintsMatchBlockedAction,
  isPhase15bHintArtifactKind,
  validatePhase15bUpgradeHints,
  type BlockedActionType,
  type CodexApplyPolicy,
  type CodexAppServerClientRequest,
  type CodexAppServerJsonValue,
  type CodexArtifactKind,
  type CodexPreviewOutputEnvelope,
  type CodexRuntimeStatusDto,
  type CodexTurnPurpose,
  type Phase15bUpgradeHints
} from "@solo-superman/contracts";

export const RUNTIME_ADAPTER_STATUS = "codex-app-server-preview-pr-07" as const;

export interface CodexRuntimePreviewInput {
  readonly turnPurpose: CodexTurnPurpose;
  readonly contextHash: string;
  readonly prompt: string;
  readonly sourceRefs: readonly string[];
  readonly targetObject: string;
  readonly requestedActionType?: BlockedActionType;
  readonly requestedActionReason?: string;
}

export interface CodexRuntimeAdapterOptions {
  readonly now?: () => string;
  readonly fixtureMode?: boolean;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

type CodexClientRequestFor<Method extends CodexAppServerClientRequest["method"]> = Extract<
  CodexAppServerClientRequest,
  { method: Method }
>;

export interface CodexStdioTurnRequestOptions {
  readonly requestIdPrefix?: string;
  readonly cwd?: string;
}

export interface CodexStdioTurnRequestBundle {
  readonly initializeRequest: CodexClientRequestFor<"initialize">;
  readonly threadStartRequest: CodexClientRequestFor<"thread/start">;
  readonly buildTurnStartRequest: (threadId: string) => CodexClientRequestFor<"turn/start">;
}

export class CodexRuntimeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodexRuntimeUnavailableError";
  }
}

function isTurnPurpose(value: unknown): value is CodexTurnPurpose {
  return typeof value === "string" && CODEX_TURN_PURPOSES.includes(value as CodexTurnPurpose);
}

function isArtifactKind(value: unknown): value is CodexArtifactKind {
  return typeof value === "string" && CODEX_ARTIFACT_KINDS.includes(value as CodexArtifactKind);
}

function isApplyPolicy(value: unknown): value is CodexApplyPolicy {
  return typeof value === "string" && CODEX_APPLY_POLICIES.includes(value as CodexApplyPolicy);
}

function isBlockedActionType(value: unknown): value is BlockedActionType {
  return typeof value === "string" && BLOCKED_ACTION_TYPES.includes(value as BlockedActionType);
}

function stableBodyForTurnPurpose(turnPurpose: CodexTurnPurpose, prompt: string) {
  switch (turnPurpose) {
    case "question_generation":
      return `Question candidates for: ${prompt}`;
    case "ambiguity_analysis":
      return `Ambiguity analysis preview for: ${prompt}`;
    case "research_prompt":
      return `Manual research prompt: ${prompt}`;
    case "evidence_synthesis":
      return `Evidence synthesis preview for: ${prompt}`;
    case "spec_update_preview":
      return `Spec update preview for: ${prompt}`;
    case "implementation_plan_preview":
      return `Implementation plan preview for: ${prompt}`;
  }
}

function artifactKindForTurnPurpose(turnPurpose: CodexTurnPurpose): CodexArtifactKind {
  return CODEX_ARTIFACT_KIND_BY_TURN_PURPOSE[turnPurpose];
}

function applyPolicyForTurnPurpose(turnPurpose: CodexTurnPurpose): CodexApplyPolicy {
  return CODEX_APPLY_POLICY_BY_TURN_PURPOSE[turnPurpose];
}

function codexPreviewOutputJsonSchema(): CodexAppServerJsonValue {
  return {
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "turnPurpose", "artifactKind", "applyPolicy", "summary", "payload"],
    properties: {
      schemaVersion: { const: CONTRACT_SCHEMA_VERSION },
      turnPurpose: { enum: [...CODEX_TURN_PURPOSES] },
      artifactKind: { enum: [...CODEX_ARTIFACT_KINDS] },
      applyPolicy: { enum: [...CODEX_APPLY_POLICIES] },
      summary: { type: "string", minLength: 1 },
      payload: {
        type: "object",
        required: ["title", "body", "targetObject", "sourceRefs"],
        additionalProperties: true,
        properties: {
          title: { type: "string", minLength: 1 },
          body: { type: "string", minLength: 1 },
          targetObject: { type: "string", minLength: 1 },
          sourceRefs: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 }
          },
          blockedAction: {
            type: "object",
            required: ["actionType", "reason"],
            additionalProperties: false,
            properties: {
              actionType: { enum: [...BLOCKED_ACTION_TYPES] },
              reason: { type: "string", minLength: 1 },
              suggestedSafeAlternative: { type: "string" }
            }
          },
          phase15bUpgradeHints: phase15bUpgradeHintsJsonSchema()
        }
      }
    }
  };
}

function hasOwnRecordKey(record: Readonly<Record<string, unknown>>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function optionalPhase15bUpgradeHints(payloadRecord: Readonly<Record<string, unknown>>): Phase15bUpgradeHints | undefined {
  return hasOwnRecordKey(payloadRecord, "phase15bUpgradeHints")
    ? validatePhase15bUpgradeHints(payloadRecord.phase15bUpgradeHints)
    : undefined;
}

function stringArrayJsonSchema(): CodexAppServerJsonValue {
  return {
    type: "array",
    items: { type: "string", minLength: 1 }
  };
}

function phase15bUpgradeHintsJsonSchema(): CodexAppServerJsonValue {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "executionIntent",
      "approvalRequirements",
      "sandboxRequirements",
      "rollbackReference",
      "expectedEvidence",
      "riskNormalization",
      "sourceRefs",
      "createdAt",
      "schemaVersion"
    ],
    properties: {
      executionIntent: {
        type: "object",
        additionalProperties: false,
        required: ["candidateActionType", "targetSurface", "nonExecutingSummary"],
        properties: {
          candidateActionType: { enum: [...BLOCKED_ACTION_TYPES] },
          targetSurface: { type: "string", minLength: 1 },
          nonExecutingSummary: { type: "string", minLength: 1 }
        }
      },
      approvalRequirements: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["approvalType", "reason", "scope", "requiredActor", "reconfirmRule"],
          properties: {
            approvalType: { enum: [...PHASE15B_APPROVAL_TYPES] },
            reason: { type: "string", minLength: 1 },
            scope: { type: "string", minLength: 1 },
            requiredActor: { enum: [...PHASE15B_REQUIRED_ACTORS] },
            reconfirmRule: { type: "string", minLength: 1 }
          }
        }
      },
      sandboxRequirements: {
        type: "object",
        additionalProperties: false,
        required: [
          "isolatedWorktreeRequired",
          "browserSandboxRequired",
          "networkMode",
          "commandAllowlist",
          "secretGrantBoundary",
          "environmentPolicy",
          "logCaptureRequired"
        ],
        properties: {
          isolatedWorktreeRequired: { type: "boolean" },
          browserSandboxRequired: { type: "boolean" },
          networkMode: { enum: [...PHASE15B_NETWORK_MODES] },
          commandAllowlist: stringArrayJsonSchema(),
          secretGrantBoundary: { type: "string", minLength: 1 },
          environmentPolicy: { type: "string", minLength: 1 },
          logCaptureRequired: { type: "boolean" }
        }
      },
      rollbackReference: {
        type: "object",
        additionalProperties: false,
        required: ["baseRef", "rollbackNote", "reversible", "cleanupExpectation"],
        properties: {
          baseRef: { type: "string", minLength: 1 },
          diffRef: { type: "string", minLength: 1 },
          rollbackNote: { type: "string", minLength: 1 },
          reversible: { type: "boolean" },
          cleanupExpectation: { type: "string", minLength: 1 }
        }
      },
      expectedEvidence: {
        type: "object",
        additionalProperties: false,
        required: ["tests", "smokeChecks", "artifactPaths", "manualInspection", "expectedLogs"],
        properties: {
          tests: stringArrayJsonSchema(),
          smokeChecks: stringArrayJsonSchema(),
          artifactPaths: stringArrayJsonSchema(),
          manualInspection: stringArrayJsonSchema(),
          expectedLogs: stringArrayJsonSchema()
        }
      },
      riskNormalization: {
        type: "object",
        additionalProperties: false,
        required: ["riskLevel", "blockedActionType", "blockReason", "userVisibleAction", "escalationTarget"],
        properties: {
          riskLevel: { enum: [...PHASE15B_RISK_LEVELS] },
          blockedActionType: { enum: [...BLOCKED_ACTION_TYPES] },
          blockReason: { type: "string", minLength: 1 },
          userVisibleAction: { type: "string", minLength: 1 },
          escalationTarget: { type: "string", minLength: 1 }
        }
      },
      sourceRefs: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "refId"],
          properties: {
            kind: { enum: [...PHASE15B_SOURCE_REF_KINDS] },
            refId: { type: "string", minLength: 1 },
            label: { type: "string", minLength: 1 }
          }
        }
      },
      createdAt: { type: "string", pattern: PHASE15B_ISO_UTC_TIMESTAMP_PATTERN },
      schemaVersion: { const: PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION }
    }
  };
}

function codexPreviewPrompt(input: CodexRuntimePreviewInput) {
  return [
    "Create a Solo Superman Phase 1 runtime preview artifact.",
    "Return exactly one JSON object matching the provided output schema.",
    "Do not apply patches, run shell commands, browse, call network resources, request credentials, or perform destructive actions.",
    "If the requested content implies one of those actions, return a BlockedActionArtifact instead.",
    "",
    `schemaVersion: ${CONTRACT_SCHEMA_VERSION}`,
    `turnPurpose: ${input.turnPurpose}`,
    `contextHash: ${input.contextHash}`,
    `targetObject: ${input.targetObject}`,
    `sourceRefs: ${JSON.stringify(input.sourceRefs)}`,
    input.requestedActionType ? `requestedActionType: ${input.requestedActionType}` : null,
    input.requestedActionReason ? `requestedActionReason: ${input.requestedActionReason}` : null,
    "",
    "Prompt:",
    input.prompt
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export function buildCodexStdioTurnRequests(
  input: CodexRuntimePreviewInput,
  options: CodexStdioTurnRequestOptions = {}
): CodexStdioTurnRequestBundle {
  const requestIdPrefix = options.requestIdPrefix ?? `codex-preview-${input.contextHash}`;
  const cwd = options.cwd ?? null;

  return {
    initializeRequest: {
      method: "initialize",
      id: `${requestIdPrefix}:initialize`,
      params: {
        clientInfo: {
          name: "solo-superman-sidecar",
          title: "Solo Superman Sidecar",
          version: RUNTIME_ADAPTER_STATUS
        },
        capabilities: {
          experimentalApi: true,
          optOutNotificationMethods: null
        }
      }
    },
    threadStartRequest: {
      method: "thread/start",
      id: `${requestIdPrefix}:thread-start`,
      params: {
        cwd,
        approvalPolicy: "never",
        approvalsReviewer: "user",
        sandbox: "read-only",
        config: null,
        serviceName: "solo-superman-runtime-preview",
        baseInstructions:
          "You are producing preview-only artifacts for Solo Superman Phase 1. You never execute actions.",
        developerInstructions:
          "Return only the requested JSON preview artifact. Forbidden runtime actions must become blocked artifacts.",
        ephemeral: true,
        sessionStartSource: "clear"
      }
    },
    buildTurnStartRequest(threadId: string) {
      return {
        method: "turn/start",
        id: `${requestIdPrefix}:turn-start`,
        params: {
          threadId,
          input: [
            {
              type: "text",
              text: codexPreviewPrompt(input),
              text_elements: []
            }
          ],
          cwd,
          approvalPolicy: "never",
          approvalsReviewer: "user",
          sandboxPolicy: {
            type: "readOnly",
            networkAccess: false
          },
          outputSchema: codexPreviewOutputJsonSchema()
        }
      };
    }
  };
}

function parseJsonObject(raw: string) {
  const parsed = JSON.parse(raw) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Codex preview output must be a JSON object.");
  }

  return parsed as Readonly<Record<string, unknown>>;
}

export function repairCodexJsonOutput(raw: string) {
  const trimmed = raw.trim();
  const fencedMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/u.exec(trimmed);
  const candidate = fencedMatch?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  const objectSlice = start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;

  return objectSlice.replace(/,\s*([}\]])/gu, "$1");
}

function stringArray(value: unknown, fieldName: string) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== "string" || item.trim().length === 0)
  ) {
    throw new Error(`${fieldName} must be an array of non-empty strings.`);
  }

  return value.map((item) => item.trim());
}

export function validateCodexPreviewOutput(value: unknown): CodexPreviewOutputEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Codex preview output must be an object.");
  }

  const record = value as Readonly<Record<string, unknown>>;
  const payload = record.payload;

  if (record.schemaVersion !== CONTRACT_SCHEMA_VERSION) {
    throw new Error("Codex preview output schemaVersion does not match the internal contract.");
  }

  if (!isTurnPurpose(record.turnPurpose)) {
    throw new Error("Codex preview output turnPurpose is not canonical.");
  }

  if (!isArtifactKind(record.artifactKind)) {
    throw new Error("Codex preview output artifactKind is not canonical.");
  }

  if (!isApplyPolicy(record.applyPolicy)) {
    throw new Error("Codex preview output applyPolicy is not canonical.");
  }

  if (typeof record.summary !== "string" || record.summary.trim().length === 0) {
    throw new Error("Codex preview output summary is required.");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Codex preview output payload must be an object.");
  }

  const payloadRecord = payload as Readonly<Record<string, unknown>>;

  if (typeof payloadRecord.title !== "string" || payloadRecord.title.trim().length === 0) {
    throw new Error("Codex preview output payload.title is required.");
  }

  if (typeof payloadRecord.body !== "string" || payloadRecord.body.trim().length === 0) {
    throw new Error("Codex preview output payload.body is required.");
  }

  if (typeof payloadRecord.targetObject !== "string" || payloadRecord.targetObject.trim().length === 0) {
    throw new Error("Codex preview output payload.targetObject is required.");
  }

  const sourceRefs = stringArray(payloadRecord.sourceRefs, "payload.sourceRefs");
  const blockedAction = payloadRecord.blockedAction;
  const phase15bUpgradeHints = optionalPhase15bUpgradeHints(payloadRecord);

  if (phase15bUpgradeHints && !isPhase15bHintArtifactKind(record.artifactKind)) {
    throw new Error(
      "phase15bUpgradeHints may only be attached to ImplementationPlanPreviewArtifact or BlockedActionArtifact."
    );
  }

  if (record.artifactKind === "BlockedActionArtifact") {
    if (!blockedAction || typeof blockedAction !== "object" || Array.isArray(blockedAction)) {
      throw new Error("BlockedActionArtifact requires payload.blockedAction.");
    }

    const blocked = blockedAction as Readonly<Record<string, unknown>>;

    if (!isBlockedActionType(blocked.actionType)) {
      throw new Error("BlockedActionArtifact actionType is not canonical.");
    }

    if (phase15bUpgradeHints) {
      assertPhase15bUpgradeHintsMatchBlockedAction(phase15bUpgradeHints, blocked.actionType);
    }

    if (typeof blocked.reason !== "string" || blocked.reason.trim().length === 0) {
      throw new Error("BlockedActionArtifact reason is required.");
    }
  }

  return {
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    turnPurpose: record.turnPurpose,
    artifactKind: record.artifactKind,
    applyPolicy: record.applyPolicy,
    summary: record.summary.trim(),
    payload: {
      title: payloadRecord.title.trim(),
      body: payloadRecord.body.trim(),
      targetObject: payloadRecord.targetObject.trim(),
      sourceRefs,
      ...(blockedAction && typeof blockedAction === "object" && !Array.isArray(blockedAction)
        ? {
            blockedAction: {
              actionType: (blockedAction as Readonly<Record<string, unknown>>).actionType as BlockedActionType,
              reason: String((blockedAction as Readonly<Record<string, unknown>>).reason).trim(),
              ...(typeof (blockedAction as Readonly<Record<string, unknown>>).suggestedSafeAlternative === "string"
                ? {
                    suggestedSafeAlternative: String(
                      (blockedAction as Readonly<Record<string, unknown>>).suggestedSafeAlternative
                    ).trim()
                  }
                : {})
            }
          }
        : {}),
      ...(phase15bUpgradeHints ? { phase15bUpgradeHints } : {})
    }
  };
}

function sameStringArray(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => item === right[index]);
}

export function assertCodexPreviewOutputMatchesInput(
  input: CodexRuntimePreviewInput,
  output: CodexPreviewOutputEnvelope
) {
  const outputIsBlocked =
    output.artifactKind === "BlockedActionArtifact" ||
    output.applyPolicy === "blocked" ||
    Boolean(output.payload.blockedAction);

  if (output.turnPurpose !== input.turnPurpose) {
    throw new Error("Codex preview output turnPurpose must match the requested turnPurpose.");
  }

  if (!sameStringArray(output.payload.sourceRefs, input.sourceRefs.map((sourceRef) => sourceRef.trim()))) {
    throw new Error("Codex preview output sourceRefs must match the requested trace references.");
  }

  if (outputIsBlocked) {
    if (
      output.artifactKind !== "BlockedActionArtifact" ||
      output.applyPolicy !== "blocked" ||
      !output.payload.blockedAction
    ) {
      throw new Error("Blocked Codex preview output must use the blocked artifact, policy, and payload taxonomy.");
    }

    if (output.payload.targetObject !== "blocked_action") {
      throw new Error("Blocked Codex preview output targetObject must be blocked_action.");
    }

    return;
  }

  if (output.artifactKind !== artifactKindForTurnPurpose(input.turnPurpose)) {
    throw new Error("Codex preview output artifactKind must match the requested turnPurpose.");
  }

  if (output.applyPolicy !== applyPolicyForTurnPurpose(input.turnPurpose)) {
    throw new Error("Codex preview output applyPolicy must match the requested turnPurpose.");
  }

  if (output.payload.targetObject !== input.targetObject) {
    throw new Error("Codex preview output targetObject must match the requested target.");
  }
}

export function parseCodexPreviewOutput(raw: string): CodexPreviewOutputEnvelope {
  try {
    return validateCodexPreviewOutput(parseJsonObject(raw));
  } catch {
    return validateCodexPreviewOutput(parseJsonObject(repairCodexJsonOutput(raw)));
  }
}

export function fixtureCodexPreviewOutput(input: CodexRuntimePreviewInput): CodexPreviewOutputEnvelope {
  const isBlocked = Boolean(input.requestedActionType);
  const artifactKind = isBlocked ? "BlockedActionArtifact" : artifactKindForTurnPurpose(input.turnPurpose);
  const applyPolicy = isBlocked ? "blocked" : applyPolicyForTurnPurpose(input.turnPurpose);
  const summary = isBlocked ? "Forbidden runtime action blocked" : `${input.turnPurpose} preview ready`;
  const body = stableBodyForTurnPurpose(input.turnPurpose, input.prompt);

  return {
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    turnPurpose: input.turnPurpose,
    artifactKind,
    applyPolicy,
    summary,
    payload: {
      title: summary,
      body,
      targetObject: isBlocked ? "blocked_action" : input.targetObject,
      sourceRefs: input.sourceRefs,
      ...(isBlocked && input.requestedActionType
        ? {
            blockedAction: {
              actionType: input.requestedActionType,
              reason:
                input.requestedActionReason ??
                "Phase 1 creates RuntimePreviewArtifact only and never executes forbidden runtime actions.",
              suggestedSafeAlternative: "Store a preview artifact or request a later controlled-execution phase."
            }
          }
        : {})
    }
  };
}

function statusDto(input: {
  readonly status: CodexRuntimeStatusDto["status"];
  readonly checkedAt: string;
  readonly reason?: string;
}): CodexRuntimeStatusDto {
  return {
    status: input.status,
    adapterVersion: CODEX_RUNTIME_ADAPTER_VERSION,
    generatedSchemaVersion: CODEX_APP_SERVER_GENERATED_VERSION,
    transport: CODEX_RUNTIME_TRANSPORT,
    checkedAt: input.checkedAt,
    manualHandoffAvailable: true,
    ...(input.reason ? { reason: input.reason } : {})
  };
}

export function createCodexRuntimeAdapter(options: CodexRuntimeAdapterOptions = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const env = options.env ?? process.env;
  const fixtureMode = options.fixtureMode ?? env.SOLO_CODEX_APP_SERVER_USE_FIXTURES === "1";

  return {
    async getStatus(): Promise<CodexRuntimeStatusDto> {
      if (fixtureMode) {
        return statusDto({
          status: "available",
          checkedAt: now()
        });
      }

      if (env.SOLO_CODEX_APP_SERVER_DISABLED === "1") {
        return statusDto({
          status: "unavailable",
          checkedAt: now(),
          reason: "SOLO_CODEX_APP_SERVER_DISABLED disables live app-server probing."
        });
      }

      return statusDto({
        status: "unavailable",
        checkedAt: now(),
        reason:
          "Live Codex app-server probing and turn execution are disabled for Phase 1; manual handoff fallback is required."
      });
    },

    buildStdioSpawnPlan() {
      return {
        command: "codex",
        args: ["app-server", "--listen", "stdio://"],
        transport: CODEX_RUNTIME_TRANSPORT,
        generatedSchemaVersion: CODEX_APP_SERVER_GENERATED_VERSION
      } as const;
    },

    buildPreviewTurnRequests(input: CodexRuntimePreviewInput, requestOptions?: CodexStdioTurnRequestOptions) {
      return buildCodexStdioTurnRequests(input, requestOptions);
    },

    async createPreview(input: CodexRuntimePreviewInput): Promise<CodexPreviewOutputEnvelope> {
      if (fixtureMode) {
        return fixtureCodexPreviewOutput(input);
      }

      throw new CodexRuntimeUnavailableError(
        "Live Codex app-server turn execution is not enabled; manual handoff fallback is required."
      );
    }
  };
}

export type CodexRuntimeAdapter = ReturnType<typeof createCodexRuntimeAdapter>;
