import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
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
  type CodexRuntimeAccountDto,
  type CodexRuntimeLoginStartDto,
  type CodexPreviewOutputEnvelope,
  type CodexRuntimeStatusDto,
  type CodexTurnPurpose,
  type Phase15bUpgradeHints
} from "@solo-superman/contracts";

export const RUNTIME_ADAPTER_VERSION = "codex-app-server-preview-pr-07" as const;

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
  readonly accountReader?: () => Promise<CodexRuntimeAccountDto>;
  readonly loginLauncher?: () => Promise<CodexRuntimeLoginStartDto>;
}

export interface CodexRuntimePreviewFixtureOptions {
  readonly createdAt?: string;
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

const CODEX_ACCOUNT_READ_TIMEOUT_MS = 5_000;
const CODEX_PROCESS_OUTPUT_CAPTURE_LIMIT = 2_000;
const CODEX_LOGIN_COMMAND = "codex auth login" as const;
const CODEX_LOGIN_STATUS_COMMAND = "codex login status" as const;
const CODEX_LOGIN_COMMAND_ARGS = ["codex", "auth", "login"] as const;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function baseCodexAccountStatus(
  status: CodexRuntimeAccountDto["status"],
  reason?: string
): CodexRuntimeAccountDto {
  return {
    status,
    loginCommand: CODEX_LOGIN_COMMAND,
    loginStatusCommand: CODEX_LOGIN_STATUS_COMMAND,
    ...(reason ? { reason } : {})
  };
}

function fixtureCodexAccountStatus(): CodexRuntimeAccountDto {
  return {
    ...baseCodexAccountStatus("authenticated", "Fixture mode simulates an authenticated Codex account."),
    accountType: "chatgpt",
    email: "fixture-codex@example.local",
    planType: "pro",
    requiresOpenaiAuth: true
  };
}

function codexLoginStartDto(input: {
  readonly status: CodexRuntimeLoginStartDto["status"];
  readonly startedAt: string;
  readonly terminal: string;
  readonly message: string;
  readonly reason?: string;
}): CodexRuntimeLoginStartDto {
  return {
    status: input.status,
    command: CODEX_LOGIN_COMMAND,
    statusCommand: CODEX_LOGIN_STATUS_COMMAND,
    startedAt: input.startedAt,
    terminal: input.terminal,
    message: input.message,
    ...(input.reason ? { reason: input.reason } : {})
  };
}

function fixtureCodexLoginStart(now: () => string): CodexRuntimeLoginStartDto {
  return codexLoginStartDto({
    status: "started",
    startedAt: now(),
    terminal: "fixture-terminal",
    message: "Fixture mode simulates opening `codex auth login` in a background terminal."
  });
}

export function codexAccountStatusFromAccountReadResponse(value: unknown): CodexRuntimeAccountDto {
  if (!isRecord(value)) {
    return baseCodexAccountStatus("unknown", "Codex app-server account/read returned a malformed response.");
  }

  const account = value.account;
  const requiresOpenaiAuth =
    typeof value.requiresOpenaiAuth === "boolean" ? value.requiresOpenaiAuth : undefined;

  if (account === null || account === undefined) {
    return {
      ...baseCodexAccountStatus("missing", "Codex CLI is not logged in for this local environment."),
      ...(requiresOpenaiAuth === undefined ? {} : { requiresOpenaiAuth })
    };
  }

  if (!isRecord(account) || typeof account.type !== "string") {
    return baseCodexAccountStatus("unknown", "Codex app-server returned an unrecognized account shape.");
  }

  const accountType =
    account.type === "apiKey" || account.type === "chatgpt" || account.type === "amazonBedrock"
      ? account.type
      : undefined;

  if (!accountType) {
    return baseCodexAccountStatus("unknown", `Codex account type is not supported: ${account.type}`);
  }

  return {
    ...baseCodexAccountStatus("authenticated"),
    accountType,
    ...(typeof account.email === "string" ? { email: account.email } : {}),
    ...(typeof account.planType === "string" ? { planType: account.planType } : {}),
    ...(requiresOpenaiAuth === undefined ? {} : { requiresOpenaiAuth })
  };
}

function codexSpawnEnv(env: Readonly<Record<string, string | undefined>>): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

function createLimitedTextCapture(limit = CODEX_PROCESS_OUTPUT_CAPTURE_LIMIT) {
  let text = "";

  return {
    append(chunk: unknown) {
      if (text.length >= limit) {
        return;
      }

      text = `${text}${String(chunk)}`.slice(0, limit);
    },
    trimmed() {
      return text.trim();
    }
  };
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function loginCommandString() {
  return CODEX_LOGIN_COMMAND_ARGS.map(shellQuote).join(" ");
}

function windowsCmdQuote(value: string) {
  return `"${value.replaceAll('"', '\\"')}"`;
}

export function windowsCodexLoginShellCommand(cwd: string) {
  return `cd /d ${windowsCmdQuote(cwd)} && ${CODEX_LOGIN_COMMAND}`;
}

async function spawnDetached(
  command: string,
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>>
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [...args], {
      detached: true,
      env: codexSpawnEnv(env),
      stdio: "ignore"
    });
    const onError = (error: Error) => {
      reject(error);
    };

    child.once("error", onError);
    child.once("spawn", () => {
      child.off("error", onError);
      child.unref();
      resolve();
    });
  });
}

async function spawnAndWait(
  command: string,
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>>
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [...args], {
      env: codexSpawnEnv(env),
      stdio: ["ignore", "ignore", "pipe"]
    });
    const stderr = createLimitedTextCapture();

    child.stderr?.on("data", (chunk) => {
      stderr.append(chunk);
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      const detail = stderr.trimmed() || signal || `exit ${code ?? "unknown"}`;
      reject(new Error(`${command} failed while launching Codex login: ${detail}`));
    });
  });
}

export async function startCodexLoginInBackgroundTerminal(
  env: Readonly<Record<string, string | undefined>> = process.env,
  cwd = process.cwd(),
  now = () => new Date().toISOString()
): Promise<CodexRuntimeLoginStartDto> {
  const loginShellCommand = `cd ${shellQuote(cwd)}; ${loginCommandString()}`;

  try {
    if (process.platform === "darwin") {
      await spawnAndWait(
        "osascript",
        [
          "-e",
          [
            'tell application "Terminal"',
            `  do script ${JSON.stringify(loginShellCommand)}`,
            "end tell"
          ].join("\n")
        ],
        env
      );

      return codexLoginStartDto({
        status: "started",
        startedAt: now(),
        terminal: "Terminal.app",
        message: "Opened `codex auth login` in a background Terminal window. Complete the browser login, then refresh Codex login status."
      });
    }

    if (process.platform === "win32") {
      await spawnAndWait(
        "cmd.exe",
        [
          "/d",
          "/s",
          "/c",
          "start",
          "Solo Superman Codex Login",
          "cmd.exe",
          "/k",
          windowsCodexLoginShellCommand(cwd)
        ],
        env
      );

      return codexLoginStartDto({
        status: "started",
        startedAt: now(),
        terminal: "Windows cmd.exe",
        message: "Opened `codex auth login` in a background terminal. Complete the browser login, then refresh Codex login status."
      });
    }

    if (env.TERMINAL) {
      await spawnDetached(env.TERMINAL, ["-e", "sh", "-lc", loginShellCommand], env);

      return codexLoginStartDto({
        status: "started",
        startedAt: now(),
        terminal: env.TERMINAL,
        message: "Opened `codex auth login` in the configured background terminal. Complete the browser login, then refresh Codex login status."
      });
    }

    return codexLoginStartDto({
      status: "unavailable",
      startedAt: now(),
      terminal: "none",
      message: "No supported local terminal launcher was detected for `codex auth login`.",
      reason: "Set the TERMINAL environment variable or run `codex auth login` directly in a terminal."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return codexLoginStartDto({
      status: "unavailable",
      startedAt: now(),
      terminal: process.platform === "darwin" ? "Terminal.app" : process.platform === "win32" ? "Windows cmd.exe" : env.TERMINAL ?? "none",
      message: "Could not open `codex auth login` in a background terminal.",
      reason: message
    });
  }
}

function responseErrorMessage(response: Readonly<Record<string, unknown>>) {
  const error = response.error;

  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }

  return "Codex app-server account/read failed.";
}

export async function readCodexAccountStatus(
  env: Readonly<Record<string, string | undefined>> = process.env
): Promise<CodexRuntimeAccountDto> {
  return await new Promise((resolve) => {
    let settled = false;
    const child = spawn("codex", ["app-server", "--listen", "stdio://"], {
      env: codexSpawnEnv(env),
      stdio: ["pipe", "pipe", "pipe"]
    });
    const stderr = createLimitedTextCapture();
    const lineReader = createInterface({ input: child.stdout });
    const finish = (status: CodexRuntimeAccountDto) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      lineReader.close();
      child.kill();
      resolve(status);
    };
    const timer = setTimeout(() => {
      finish(baseCodexAccountStatus("unknown", "Timed out while checking Codex login status."));
    }, CODEX_ACCOUNT_READ_TIMEOUT_MS);

    child.stderr.on("data", (chunk) => {
      stderr.append(chunk);
    });
    child.stdin.on("error", (error) => {
      finish(baseCodexAccountStatus("unknown", `Could not send account/read to Codex app-server: ${error.message}`));
    });
    child.on("error", (error) => {
      finish(baseCodexAccountStatus("unknown", `Could not start Codex app-server: ${error.message}`));
    });
    child.on("exit", () => {
      if (!settled) {
        const stderrText = stderr.trimmed();
        finish(
          baseCodexAccountStatus(
            "unknown",
            stderrText ? `Codex app-server exited before account status was available: ${stderrText}` : "Codex app-server exited before account status was available."
          )
        );
      }
    });
    lineReader.on("line", (line) => {
      let response: unknown;

      try {
        response = JSON.parse(line) as unknown;
      } catch {
        return;
      }

      if (!isRecord(response) || response.id !== "solo-superman:account-read") {
        return;
      }

      if (Object.prototype.hasOwnProperty.call(response, "result")) {
        finish(codexAccountStatusFromAccountReadResponse(response.result));
        return;
      }

      finish(baseCodexAccountStatus("unknown", responseErrorMessage(response)));
    });

    child.stdin.write(
      `${JSON.stringify({
        method: "initialize",
        id: "solo-superman:initialize",
        params: {
          clientInfo: {
            name: "solo-superman-sidecar",
            title: "Solo Superman Sidecar",
            version: RUNTIME_ADAPTER_VERSION
          },
          capabilities: {
            experimentalApi: true,
            optOutNotificationMethods: null
          }
        }
      })}\n`
    );
    child.stdin.write(
      `${JSON.stringify({
        method: "account/read",
        id: "solo-superman:account-read",
        params: {
          refreshToken: false
        }
      })}\n`
    );
  });
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

function phase15bSafeRefFragment(value: string) {
  return value.replace(/[^A-Za-z0-9_:-]/gu, "_").replace(/^_+|_+$/gu, "") || "unknown";
}

function phase15bApprovalTypeForBlockedAction(
  actionType: BlockedActionType
): Phase15bUpgradeHints["approvalRequirements"][number]["approvalType"] {
  switch (actionType) {
    case "browser_action":
      return "browser_action";
    case "network_write":
      return "network_write";
    case "credential_access":
      return "credential_grant";
    case "destructive_operation":
      return "destructive_action";
    case "chatgpt_web_automation":
      return "phase3_safe_execution";
    case "file_patch":
    case "shell_command":
      return "task_level_execution";
  }
}

function phase15bNetworkModeForBlockedAction(
  actionType: BlockedActionType
): Phase15bUpgradeHints["sandboxRequirements"]["networkMode"] {
  return actionType === "network_write" ? "restricted_write_requires_phase3_approval" : "offline";
}

function phase15bSourceKindForRef(refId: string): Phase15bUpgradeHints["sourceRefs"][number]["kind"] {
  if (refId.startsWith("research_run_")) {
    return "research_run";
  }

  if (refId.startsWith("evidence_matrix_")) {
    return "evidence_matrix";
  }

  if (refId.startsWith("decision_evidence_pack_") || refId.startsWith("evidence_pack_")) {
    return "decision_evidence_pack";
  }

  if (refId.startsWith("research_allowlist_")) {
    return "research_allowlist";
  }

  if (refId.startsWith("research_disclosure_")) {
    return "research_disclosure_log";
  }

  if (refId.startsWith("audit_log_")) {
    return "audit_log";
  }

  if (refId.startsWith("runtime_artifact_")) {
    return "preview_artifact";
  }

  return "spec_section";
}

function phase15bSourceRefsForBlockedAction(
  input: CodexRuntimePreviewInput,
  actionType: BlockedActionType
): Phase15bUpgradeHints["sourceRefs"] {
  const contextRef = phase15bSafeRefFragment(input.contextHash);
  const previewArtifactRef = `runtime_artifact_${contextRef}`;
  const sourceRefs = [
    {
      kind: "preview_artifact" as const,
      refId: previewArtifactRef,
      label: "Blocked runtime preview readiness source"
    },
    {
      kind: "blocked_action" as const,
      refId: `${previewArtifactRef}:${actionType}`,
      label: "Blocked action readiness source"
    },
    ...input.sourceRefs.map((refId) => ({
      kind: phase15bSourceKindForRef(refId),
      refId,
      label: "Input trace source for non-executing readiness handoff"
    }))
  ];
  const seen = new Set<string>();

  return sourceRefs.filter((sourceRef) => {
    const key = `${sourceRef.kind}:${sourceRef.refId}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function phase15bReadinessHintsForBlockedAction(
  input: CodexRuntimePreviewInput,
  actionType: BlockedActionType,
  createdAt = new Date().toISOString()
): Phase15bUpgradeHints {
  const actionLabel = actionType.replaceAll("_", " ");
  const contextRef = phase15bSafeRefFragment(input.contextHash);
  const blockedReason =
    input.requestedActionReason ??
    "Phase 1.5B records readiness metadata only and must not execute forbidden runtime actions.";

  return {
    executionIntent: {
      candidateActionType: actionType,
      targetSurface: input.targetObject,
      nonExecutingSummary: `Readiness handoff for a future ${actionLabel}; no product action was performed.`
    },
    approvalRequirements: [
      {
        approvalType: phase15bApprovalTypeForBlockedAction(actionType),
        reason: `Future ${actionLabel} requires explicit approval outside Phase 1.5B.`,
        scope: `${input.turnPurpose}:${input.targetObject}:${contextRef}`,
        requiredActor: "user",
        reconfirmRule: "Reconfirm immediately before any later controlled-execution phase uses this hint."
      }
    ],
    sandboxRequirements: {
      isolatedWorktreeRequired: actionType === "file_patch" || actionType === "shell_command",
      browserSandboxRequired: actionType === "browser_action" || actionType === "chatgpt_web_automation",
      networkMode: phase15bNetworkModeForBlockedAction(actionType),
      commandAllowlist: ["pnpm verify", "git diff --check"],
      secretGrantBoundary: "No credential values are stored or granted by Phase 1.5B readiness metadata.",
      environmentPolicy: "Use local-only preview/readiness state until a later approved execution phase.",
      logCaptureRequired: true
    },
    rollbackReference: {
      baseRef: "origin/main",
      diffRef: `runtime_artifact_${contextRef}:preview_diff`,
      rollbackNote: "Discard this readiness hint or revert the later approved implementation change.",
      reversible: true,
      cleanupExpectation: "Remove temporary preview logs and sandbox worktrees after later review."
    },
    expectedEvidence: {
      tests: ["pnpm verify", "git diff --check"],
      smokeChecks: ["GET /api/v1/projects/:projectId/phase15b-upgrade-hints/export"],
      artifactPaths: ["apps/sidecar/src/runtime/index.ts", "apps/sidecar/src/e2e-dry-run.test.ts"],
      manualInspection: ["Confirm UI copy says readiness, preview, blocked, or handoff only."],
      expectedLogs: ["phase15b readiness metadata exported without execution"]
    },
    riskNormalization: {
      riskLevel: actionType === "destructive_operation" || actionType === "credential_access" ? "high" : "medium",
      blockedActionType: actionType,
      blockReason: blockedReason,
      userVisibleAction: `Treat ${actionLabel} as a blocked readiness handoff until a later phase asks for approval.`,
      escalationTarget: "phase3_safe_execution"
    },
    sourceRefs: phase15bSourceRefsForBlockedAction(input, actionType),
    createdAt,
    schemaVersion: PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION
  };
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
    "Create a Solo Superman Phase 1/1.5B runtime preview artifact.",
    "Return exactly one JSON object matching the provided output schema.",
    "Do not apply patches, run shell commands, browse, call network resources, request credentials, or perform destructive actions.",
    "If the requested content implies one of those actions, return a BlockedActionArtifact with phase15bUpgradeHints readiness metadata instead.",
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
          version: RUNTIME_ADAPTER_VERSION
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
          "You are producing preview-only artifacts for Solo Superman Phase 1/1.5B. You never execute actions.",
        developerInstructions:
          "Return only the requested JSON preview artifact. Forbidden runtime actions must become blocked artifacts with Phase 1.5B readiness hints.",
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

    if (!phase15bUpgradeHints) {
      throw new Error("BlockedActionArtifact requires payload.phase15bUpgradeHints readiness metadata.");
    }

    assertPhase15bUpgradeHintsMatchBlockedAction(phase15bUpgradeHints, blocked.actionType);

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

  if (input.requestedActionType && !outputIsBlocked) {
    throw new Error("Requested forbidden Codex preview actions must return a blocked output.");
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

    if (input.requestedActionType && output.payload.blockedAction.actionType !== input.requestedActionType) {
      throw new Error("Blocked Codex preview output actionType must match the requested actionType.");
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

export function fixtureCodexPreviewOutput(
  input: CodexRuntimePreviewInput,
  options: CodexRuntimePreviewFixtureOptions = {}
): CodexPreviewOutputEnvelope {
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
                "Phase 1.5B records readiness metadata only and never executes forbidden runtime actions.",
              suggestedSafeAlternative: "Store a preview artifact or request a later controlled-execution phase."
            },
            phase15bUpgradeHints: phase15bReadinessHintsForBlockedAction(
              input,
              input.requestedActionType,
              options.createdAt
            )
          }
        : {})
    }
  };
}

function statusDto(input: {
  readonly status: CodexRuntimeStatusDto["status"];
  readonly checkedAt: string;
  readonly account: CodexRuntimeAccountDto;
  readonly reason?: string;
}): CodexRuntimeStatusDto {
  return {
    status: input.status,
    adapterVersion: CODEX_RUNTIME_ADAPTER_VERSION,
    generatedSchemaVersion: CODEX_APP_SERVER_GENERATED_VERSION,
    transport: CODEX_RUNTIME_TRANSPORT,
    checkedAt: input.checkedAt,
    manualHandoffAvailable: true,
    account: input.account,
    ...(input.reason ? { reason: input.reason } : {})
  };
}

export function createCodexRuntimeAdapter(options: CodexRuntimeAdapterOptions = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const env = options.env ?? process.env;
  const fixtureMode = options.fixtureMode ?? env.SOLO_CODEX_APP_SERVER_USE_FIXTURES === "1";
  const accountReader = options.accountReader ?? (() => readCodexAccountStatus(env));
  const loginLauncher = options.loginLauncher ?? (() => startCodexLoginInBackgroundTerminal(env, process.cwd(), now));

  return {
    async getStatus(): Promise<CodexRuntimeStatusDto> {
      if (fixtureMode) {
        return statusDto({
          status: "available",
          checkedAt: now(),
          account: fixtureCodexAccountStatus()
        });
      }

      if (env.SOLO_CODEX_APP_SERVER_DISABLED === "1") {
        return statusDto({
          status: "unavailable",
          checkedAt: now(),
          account: baseCodexAccountStatus("blocked", "SOLO_CODEX_APP_SERVER_DISABLED skips Codex account probing."),
          reason: "SOLO_CODEX_APP_SERVER_DISABLED disables live app-server probing."
        });
      }

      const account = await accountReader();

      return statusDto({
        status: "unavailable",
        checkedAt: now(),
        account,
        reason:
          account.status === "authenticated"
            ? "Codex CLI login is available, but live turn execution is still disabled for Phase 1; manual handoff fallback is required."
            : "Codex CLI login is required before backend question or research preview work can use the local Codex runtime."
      });
    },

    async startLogin(): Promise<CodexRuntimeLoginStartDto> {
      if (fixtureMode) {
        return fixtureCodexLoginStart(now);
      }

      if (env.SOLO_CODEX_APP_SERVER_DISABLED === "1") {
        return codexLoginStartDto({
          status: "unavailable",
          startedAt: now(),
          terminal: "none",
          message: "`codex auth login` was not started because live Codex probing is disabled.",
          reason: "SOLO_CODEX_APP_SERVER_DISABLED disables Codex CLI login helpers."
        });
      }

      const account = await accountReader().catch(() => null);

      if (account?.status === "authenticated") {
        return codexLoginStartDto({
          status: "already_authenticated",
          startedAt: now(),
          terminal: "not_started",
          message: "Codex CLI is already authenticated for this local environment."
        });
      }

      return loginLauncher();
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
        return fixtureCodexPreviewOutput(input, { createdAt: now() });
      }

      throw new CodexRuntimeUnavailableError(
        "Live Codex app-server turn execution is not enabled; manual handoff fallback is required."
      );
    }
  };
}

export type CodexRuntimeAdapter = ReturnType<typeof createCodexRuntimeAdapter>;
