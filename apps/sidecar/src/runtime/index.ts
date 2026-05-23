import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
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
  IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
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
  type AutoImplementationStage,
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
  type ImplementationStepDoc,
  type Phase15bUpgradeHints,
  type RecordImplementationStepLedgerPayload,
  type TrackerDoc
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

export interface CodexWorkerExecutionInput {
  readonly jobId: string;
  readonly runId: string;
  readonly stage: AutoImplementationStage;
  readonly workingDirectory: string;
  readonly issueDocumentPath: string;
  readonly executionAuthorityRef: string;
  readonly allowedWriteScope: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly forbiddenActions: readonly string[];
  readonly sourceRefs: readonly string[];
  readonly ledgerTrackerDoc: TrackerDoc;
  readonly ledgerStepDoc: ImplementationStepDoc;
}

export interface CodexWorkerExecutionOutputEnvelope {
  readonly schemaVersion: typeof CONTRACT_SCHEMA_VERSION;
  readonly jobId: string;
  readonly status: "completed" | "blocked";
  readonly summary: string;
  readonly ledgerTransitions: readonly RecordImplementationStepLedgerPayload[];
  readonly evidenceRefs: readonly string[];
  readonly blockedReason?: string;
  readonly missingEvidence?: readonly string[];
  readonly nextRequiredAction?: string;
}

export interface CodexRuntimeAdapterOptions {
  readonly now?: () => string;
  readonly fixtureMode?: boolean;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly accountReader?: () => Promise<CodexRuntimeAccountDto>;
  readonly loginLauncher?: () => Promise<CodexRuntimeLoginStartDto>;
  readonly livePreviewCreator?: (input: CodexRuntimePreviewInput) => Promise<CodexPreviewOutputEnvelope>;
  readonly liveWorkerExecutor?: (input: CodexWorkerExecutionInput) => Promise<CodexWorkerExecutionOutputEnvelope>;
  readonly processFactory?: CodexAppServerProcessFactory;
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

export type CodexAppServerProcessFactory = (
  command: string,
  args: readonly string[],
  options: { readonly env: NodeJS.ProcessEnv }
) => ChildProcessWithoutNullStreams;

export class CodexRuntimeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodexRuntimeUnavailableError";
  }
}

const CODEX_ACCOUNT_READ_TIMEOUT_MS = 5_000;
const CODEX_PREVIEW_TURN_TIMEOUT_MS = 60_000;
const CODEX_PROCESS_OUTPUT_CAPTURE_LIMIT = 2_000;
const CODEX_LOGIN_COMMAND = "codex auth login" as const;
const CODEX_LOGIN_STATUS_COMMAND = "codex login status" as const;
const CODEX_LOGIN_COMMAND_ARGS = ["codex", "auth", "login"] as const;
const CODEX_LIVE_TURNS_ENV = "SOLO_CODEX_APP_SERVER_LIVE_TURNS" as const;
const CODEX_LIVE_TURN_TIMEOUT_ENV = "SOLO_CODEX_APP_SERVER_LIVE_TURN_TIMEOUT_MS" as const;
const CODEX_WINDOWS_MODE_ENV = "SOLO_CODEX_WINDOWS_MODE" as const;
const CODEX_LEGACY_COMMAND_MODE_ENV = "SOLO_CODEX_COMMAND_MODE" as const;
const CODEX_WSL_DISTRO_ENV = "SOLO_SUPERMAN_CODEX_WSL_DISTRO" as const;
const CODEX_WSL_NODE_MAJOR_ENV = "SOLO_SUPERMAN_CODEX_WSL_NODE_MAJOR" as const;
const DEFAULT_CODEX_WSL_DISTRO = "Ubuntu" as const;
const DEFAULT_CODEX_WSL_NODE_MAJOR = "22" as const;

function logCodexRuntimeDiagnostic(
  level: "info" | "warn",
  event: string,
  details: Readonly<Record<string, unknown>> = {}
) {
  console[level](
    JSON.stringify({
      type: "codex-runtime-diagnostic",
      event,
      at: new Date().toISOString(),
      ...details
    })
  );
}

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

function envFlagEnabled(env: Readonly<Record<string, string | undefined>>, name: string) {
  return env[name] === "1";
}

function positiveIntegerEnvValue(
  env: Readonly<Record<string, string | undefined>>,
  name: string,
  fallback: number
) {
  const value = env[name];

  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }

  if (!/^\d+$/u.test(value)) {
    throw new Error(`${name} must be a positive integer number of milliseconds.`);
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer number of milliseconds.`);
  }

  return parsed;
}

function codexPreviewTurnTimeoutMs(env: Readonly<Record<string, string | undefined>>) {
  return positiveIntegerEnvValue(env, CODEX_LIVE_TURN_TIMEOUT_ENV, CODEX_PREVIEW_TURN_TIMEOUT_MS);
}

function defaultCodexAppServerProcessFactory(
  command: string,
  args: readonly string[],
  options: { readonly env: NodeJS.ProcessEnv }
) {
  return spawn(command, [...args], {
    env: options.env,
    stdio: ["pipe", "pipe", "pipe"]
  });
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

function codexWslDistro(env: Readonly<Record<string, string | undefined>>) {
  return env[CODEX_WSL_DISTRO_ENV]?.trim() || DEFAULT_CODEX_WSL_DISTRO;
}

function codexWslNodeMajor(env: Readonly<Record<string, string | undefined>>) {
  const value = env[CODEX_WSL_NODE_MAJOR_ENV]?.trim();

  return value && /^\d+$/u.test(value) ? value : DEFAULT_CODEX_WSL_NODE_MAJOR;
}

function codexCommandMode(
  env: Readonly<Record<string, string | undefined>>,
  platform: NodeJS.Platform = process.platform
) {
  const mode = (env[CODEX_WINDOWS_MODE_ENV] ?? env[CODEX_LEGACY_COMMAND_MODE_ENV] ?? "").toLowerCase();
  if (mode === "native" || mode === "wsl") {
    return mode;
  }

  return platform === "win32" ? "wsl" : "native";
}

function codexWslNvmSourceCommand(env: Readonly<Record<string, string | undefined>>) {
  const nodeMajor = codexWslNodeMajor(env);
  const linuxPathOnlyBlock = [
    "clean_path=",
    "old_ifs=\\$IFS",
    "IFS=:",
    "for path_entry in \\$PATH; do case \"\\$path_entry\" in /mnt/?/*|/mnt/??/*) ;; *) clean_path=\"\\${clean_path:+\\$clean_path:}\\$path_entry\" ;; esac; done",
    "IFS=\\$old_ifs",
    "export PATH=\\$clean_path"
  ].join("; ");
  const nvmSourceBlock = [
    "if [ -s \"\\$NVM_DIR/nvm.sh\" ]; then . \"\\$NVM_DIR/nvm.sh\"",
    `nvm use --silent ${nodeMajor} >/dev/null 2>&1 || true`,
    "hash -r",
    "fi"
  ].join("; ");

  return [
    "wsl_home=\\$HOME",
    "if [ -z \"\\$wsl_home\" ]; then wsl_home=\\$(getent passwd \\$(id -u) | cut -d: -f6 || true); fi",
    "export HOME=\"\\$wsl_home\"",
    "if [ -z \"\\$NVM_DIR\" ]; then NVM_DIR=\"\\$HOME/.nvm\"; fi",
    "export NVM_DIR",
    linuxPathOnlyBlock,
    nvmSourceBlock
  ].join("; ");
}

function codexWslPreflightCommand() {
  return "if ! command -v codex >/dev/null 2>&1; then echo \"Solo Superman could not find the Linux Codex CLI inside WSL after filtering Windows PATH entries. Re-run the installer or install @openai/codex inside WSL.\" >&2; exit 127; fi";
}

export function codexWslShellCommand(
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  return `${codexWslNvmSourceCommand(env)}; ${codexWslPreflightCommand()}; exec ${["codex", ...args].map(shellQuote).join(" ")}`;
}

function codexWslSpawnArgs(
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>>
) {
  return ["-d", codexWslDistro(env), "--", "bash", "-lc", codexWslShellCommand(args, env)] as const;
}

export function codexAppServerSpawnPlan(
  env: Readonly<Record<string, string | undefined>> = process.env,
  platform: NodeJS.Platform = process.platform
) {
  if (codexCommandMode(env, platform) === "wsl") {
    return {
      command: "wsl.exe",
      args: codexWslSpawnArgs(["app-server", "--listen", "stdio://"], env),
      transport: CODEX_RUNTIME_TRANSPORT,
      generatedSchemaVersion: CODEX_APP_SERVER_GENERATED_VERSION
    } as const;
  }

  return {
    command: "codex",
    args: ["app-server", "--listen", "stdio://"],
    transport: CODEX_RUNTIME_TRANSPORT,
    generatedSchemaVersion: CODEX_APP_SERVER_GENERATED_VERSION
  } as const;
}

export function windowsCodexLoginShellCommand(
  cwd: string,
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  if (codexCommandMode(env, "win32") === "wsl") {
    return [
      "wsl.exe",
      "-d",
      codexWslDistro(env),
      "--",
      "bash",
      "-lc",
      windowsCmdQuote(codexWslShellCommand(["auth", "login"], env))
    ].join(" ");
  }

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
      const terminal = codexCommandMode(env, "win32") === "wsl" ? "Windows cmd.exe + WSL" : "Windows cmd.exe";
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
        terminal,
        message:
          terminal === "Windows cmd.exe + WSL"
            ? "Opened WSL-backed `codex auth login` in a background terminal. Complete the browser login, then refresh Codex login status."
            : "Opened `codex auth login` in a background terminal. Complete the browser login, then refresh Codex login status."
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
      terminal:
        process.platform === "darwin"
          ? "Terminal.app"
          : process.platform === "win32"
            ? codexCommandMode(env, "win32") === "wsl"
              ? "Windows cmd.exe + WSL"
              : "Windows cmd.exe"
            : env.TERMINAL ?? "none",
      message: "Could not open `codex auth login` in a background terminal.",
      reason: message
    });
  }
}

function responseErrorMessage(
  response: Readonly<Record<string, unknown>>,
  fallback = "Codex app-server account/read failed."
) {
  const error = response.error;

  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}

async function readAccountBeforeLogin(accountReader: () => Promise<CodexRuntimeAccountDto>) {
  try {
    return await accountReader();
  } catch {
    return null;
  }
}

export async function readCodexAccountStatus(
  env: Readonly<Record<string, string | undefined>> = process.env
): Promise<CodexRuntimeAccountDto> {
  return await new Promise((resolve) => {
    let settled = false;
    const spawnPlan = codexAppServerSpawnPlan(env);
    const startedAt = Date.now();

    logCodexRuntimeDiagnostic("info", "account-read-spawn", {
      command: spawnPlan.command,
      args: spawnPlan.args,
      transport: spawnPlan.transport,
      generatedSchemaVersion: spawnPlan.generatedSchemaVersion,
      timeoutMs: CODEX_ACCOUNT_READ_TIMEOUT_MS
    });

    const child = spawn(spawnPlan.command, [...spawnPlan.args], {
      env: codexSpawnEnv(env),
      stdio: ["pipe", "pipe", "pipe"]
    });
    const stderr = createLimitedTextCapture();
    const lineReader = createInterface({ input: child.stdout });
    const finish = (status: CodexRuntimeAccountDto, cause: string, details: Readonly<Record<string, unknown>> = {}) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      lineReader.close();
      child.kill();
      logCodexRuntimeDiagnostic(status.status === "authenticated" || status.status === "missing" ? "info" : "warn", "account-read-finished", {
        cause,
        elapsedMs: Date.now() - startedAt,
        accountStatus: status.status,
        accountType: status.accountType ?? null,
        hasEmail: Boolean(status.email),
        hasPlanType: Boolean(status.planType),
        reason: status.reason ?? null,
        ...details
      });
      resolve(status);
    };
    const timer = setTimeout(() => {
      finish(baseCodexAccountStatus("unknown", "Timed out while checking Codex login status."), "timeout");
    }, CODEX_ACCOUNT_READ_TIMEOUT_MS);

    child.stderr.on("data", (chunk) => {
      stderr.append(chunk);
    });
    child.stdin.on("error", (error) => {
      finish(
        baseCodexAccountStatus("unknown", `Could not send account/read to Codex app-server: ${error.message}`),
        "stdin-error"
      );
    });
    child.on("error", (error) => {
      finish(
        baseCodexAccountStatus("unknown", `Could not start Codex app-server via ${spawnPlan.command}: ${error.message}`),
        "spawn-error"
      );
    });
    child.on("exit", (code, signal) => {
      if (!settled) {
        const stderrText = stderr.trimmed();
        finish(
          baseCodexAccountStatus(
            "unknown",
            stderrText ? `Codex app-server exited before account status was available: ${stderrText}` : "Codex app-server exited before account status was available."
          ),
          "process-exit",
          {
            exitCode: code,
            signal,
            stderr: stderrText || null
          }
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
        finish(codexAccountStatusFromAccountReadResponse(response.result), "account-read-result");
        return;
      }

      finish(baseCodexAccountStatus("unknown", responseErrorMessage(response)), "account-read-error");
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

function codexPreviewPayloadJsonSchema(input: CodexRuntimePreviewInput): CodexAppServerJsonValue {
  const blockedProperties = input.requestedActionType
    ? {
        blockedAction: {
          type: "object",
          required: ["actionType", "reason"],
          additionalProperties: false,
          properties: {
            actionType: { type: "string", enum: [...BLOCKED_ACTION_TYPES] },
            reason: { type: "string", minLength: 1 },
            suggestedSafeAlternative: { type: "string", minLength: 1 }
          }
        },
        phase15bUpgradeHints: phase15bUpgradeHintsJsonSchema()
      }
    : {};

  return {
    type: "object",
    required: [
      "title",
      "body",
      "targetObject",
      "sourceRefs",
      ...(input.requestedActionType ? ["blockedAction", "phase15bUpgradeHints"] : [])
    ],
    additionalProperties: false,
    properties: {
      title: { type: "string", minLength: 1 },
      body: { type: "string", minLength: 1 },
      targetObject: { type: "string", minLength: 1 },
      sourceRefs: {
        type: "array",
        minItems: 1,
        items: { type: "string", minLength: 1 }
      },
      ...blockedProperties
    }
  };
}

function codexPreviewOutputJsonSchema(input: CodexRuntimePreviewInput): CodexAppServerJsonValue {
  return {
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "turnPurpose", "artifactKind", "applyPolicy", "summary", "payload"],
    properties: {
      schemaVersion: { type: "string", const: CONTRACT_SCHEMA_VERSION },
      turnPurpose: { type: "string", enum: [...CODEX_TURN_PURPOSES] },
      artifactKind: { type: "string", enum: [...CODEX_ARTIFACT_KINDS] },
      applyPolicy: { type: "string", enum: [...CODEX_APPLY_POLICIES] },
      summary: { type: "string", minLength: 1 },
      payload: codexPreviewPayloadJsonSchema(input)
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
          candidateActionType: { type: "string", enum: [...BLOCKED_ACTION_TYPES] },
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
            approvalType: { type: "string", enum: [...PHASE15B_APPROVAL_TYPES] },
            reason: { type: "string", minLength: 1 },
            scope: { type: "string", minLength: 1 },
            requiredActor: { type: "string", enum: [...PHASE15B_REQUIRED_ACTORS] },
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
          networkMode: { type: "string", enum: [...PHASE15B_NETWORK_MODES] },
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
          riskLevel: { type: "string", enum: [...PHASE15B_RISK_LEVELS] },
          blockedActionType: { type: "string", enum: [...BLOCKED_ACTION_TYPES] },
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
            kind: { type: "string", enum: [...PHASE15B_SOURCE_REF_KINDS] },
            refId: { type: "string", minLength: 1 },
            label: { type: "string", minLength: 1 }
          }
        }
      },
      createdAt: { type: "string", pattern: PHASE15B_ISO_UTC_TIMESTAMP_PATTERN },
      schemaVersion: { type: "string", const: PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION }
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
          effort: "low",
          outputSchema: codexPreviewOutputJsonSchema(input)
        }
      };
    }
  };
}


function codexWorkerOutputJsonSchema(): CodexAppServerJsonValue {
  return {
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "jobId", "status", "summary", "ledgerTransitions", "evidenceRefs"],
    properties: {
      schemaVersion: { type: "string", const: CONTRACT_SCHEMA_VERSION },
      jobId: { type: "string", minLength: 1 },
      status: { type: "string", enum: ["completed", "blocked"] },
      summary: { type: "string", minLength: 1 },
      ledgerTransitions: {
        type: "array",
        items: { type: "object" }
      },
      evidenceRefs: stringArrayJsonSchema(),
      blockedReason: { type: "string", minLength: 1 },
      missingEvidence: stringArrayJsonSchema(),
      nextRequiredAction: { type: "string", minLength: 1 }
    }
  };
}

function codexWorkerPrompt(input: CodexWorkerExecutionInput) {
  return [
    "Execute one Solo Superman auto-implementation worker job in the local generated workspace.",
    "Stay inside the allowed workspace write scope. Do not request credentials, read secret values, perform network writes, deploy, submit to production, or mutate external accounts.",
    "Implement the issue slice if it is safe, run local verification, perform the required code-review and clean-code review loops, and return ImplementationStepLedger transitions as JSON.",
    "If any required evidence cannot be produced safely, return status blocked with missingEvidence and nextRequiredAction.",
    "Return exactly one JSON object matching the provided output schema.",
    "",
    `schemaVersion: ${CONTRACT_SCHEMA_VERSION}`,
    `jobId: ${input.jobId}`,
    `runId: ${input.runId}`,
    `stage: ${input.stage}`,
    `workingDirectory: ${input.workingDirectory}`,
    `issueDocumentPath: ${input.issueDocumentPath}`,
    `executionAuthorityRef: ${input.executionAuthorityRef}`,
    `allowedWriteScope: ${JSON.stringify(input.allowedWriteScope)}`,
    `requiredEvidence: ${JSON.stringify(input.requiredEvidence)}`,
    `forbiddenActions: ${JSON.stringify(input.forbiddenActions)}`,
    `sourceRefs: ${JSON.stringify(input.sourceRefs)}`,
    `ledgerTrackerDoc: ${JSON.stringify(input.ledgerTrackerDoc)}`,
    `ledgerStepDoc: ${JSON.stringify(input.ledgerStepDoc)}`,
    "Every ledgerTransitions item MUST copy ledgerTrackerDoc as trackerDoc and ledgerStepDoc as stepDoc exactly."
  ].join("\n");
}

export function buildCodexWorkerTurnRequests(
  input: CodexWorkerExecutionInput,
  options: CodexStdioTurnRequestOptions = {}
): CodexStdioTurnRequestBundle {
  const requestIdPrefix = options.requestIdPrefix ?? `codex-worker-${input.jobId}`;
  const cwd = options.cwd ?? input.workingDirectory;

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
        sandbox: "workspace-write",
        config: null,
        serviceName: "solo-superman-auto-worker",
        baseInstructions:
          "You are a local sandboxed Codex worker for Solo Superman auto implementation. You may edit only the generated workspace and must return ledger evidence.",
        developerInstructions:
          "Never request or store secrets. Never perform external writes, production deploys, account actions, or destructive operations. Return JSON only.",
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
              text: codexWorkerPrompt(input),
              text_elements: []
            }
          ],
          cwd,
          approvalPolicy: "never",
          approvalsReviewer: "user",
          sandboxPolicy: {
            type: "workspaceWrite",
            writableRoots: [input.workingDirectory],
            networkAccess: false,
            excludeTmpdirEnvVar: true,
            excludeSlashTmp: true
          },
          effort: "high",
          outputSchema: codexWorkerOutputJsonSchema()
        }
      };
    }
  };
}

function resultThreadId(value: unknown) {
  if (!isRecord(value) || !isRecord(value.thread) || typeof value.thread.id !== "string") {
    throw new Error("Codex app-server thread/start returned an invalid thread id.");
  }

  return value.thread.id;
}

function resultTurnId(value: unknown) {
  if (!isRecord(value) || !isRecord(value.turn) || typeof value.turn.id !== "string") {
    throw new Error("Codex app-server turn/start returned an invalid turn id.");
  }

  return value.turn.id;
}

function textFromRawResponseItem(value: unknown) {
  if (!isRecord(value) || value.type !== "message" || !Array.isArray(value.content)) {
    return null;
  }

  const outputText = value.content
    .filter((item): item is Readonly<Record<string, unknown>> => isRecord(item) && item.type === "output_text")
    .map((item) => (typeof item.text === "string" ? item.text : ""))
    .join("");

  return outputText.trim().length > 0 ? outputText : null;
}

function textFromCompletedThreadItem(value: unknown) {
  if (!isRecord(value) || value.type !== "agentMessage" || typeof value.text !== "string") {
    return null;
  }

  return value.text.trim().length > 0 ? value.text : null;
}

function turnFailureMessage(value: unknown) {
  if (!isRecord(value)) {
    return "Codex live preview turn failed.";
  }

  const error = value.error;

  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }

  return "Codex live preview turn failed.";
}

export async function createLiveCodexPreview(
  input: CodexRuntimePreviewInput,
  options: {
    readonly env?: Readonly<Record<string, string | undefined>>;
    readonly now?: () => string;
    readonly processFactory?: CodexAppServerProcessFactory;
  } = {}
): Promise<CodexPreviewOutputEnvelope> {
  const env = options.env ?? process.env;
  const spawnPlan = codexAppServerSpawnPlan(env);
  const processFactory = options.processFactory ?? defaultCodexAppServerProcessFactory;
  const timeoutMs = codexPreviewTurnTimeoutMs(env);
  const requestBundle = buildCodexStdioTurnRequests(input, { cwd: process.cwd() });
  const child = processFactory(spawnPlan.command, [...spawnPlan.args], { env: codexSpawnEnv(env) });
  const lineReader = createInterface({ input: child.stdout });
  const stderr = createLimitedTextCapture();
  const pendingResponses = new Map<
    string,
    {
      readonly resolve: (value: unknown) => void;
      readonly reject: (error: Error) => void;
    }
  >();
  let threadId: string | null = null;
  let turnId: string | null = null;
  let outputDeltaText = "";
  let completedMessageText: string | null = null;
  let settled = false;

  logCodexRuntimeDiagnostic("info", "live-preview-spawn", {
    command: spawnPlan.command,
    args: spawnPlan.args,
    transport: spawnPlan.transport,
    generatedSchemaVersion: spawnPlan.generatedSchemaVersion,
    timeoutMs
  });

  function rejectPending(error: Error) {
    for (const pending of pendingResponses.values()) {
      pending.reject(error);
    }
    pendingResponses.clear();
  }

  function sendRequest(request: CodexAppServerClientRequest) {
    return new Promise<unknown>((resolve, reject) => {
      pendingResponses.set(String(request.id), { resolve, reject });
      child.stdin.write(`${JSON.stringify(request)}\n`, (error) => {
        if (error) {
          pendingResponses.delete(String(request.id));
          reject(error);
        }
      });
    });
  }

  const completedTurn = new Promise<CodexPreviewOutputEnvelope>((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    function finishWithError(error: Error) {
      if (settled) {
        return;
      }

      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      rejectPending(error);
      reject(error);
    }

    timeout = setTimeout(() => {
      finishWithError(new Error(`Codex live preview did not finish within ${timeoutMs}ms.`));
    }, timeoutMs);

    child.stderr.on("data", (chunk) => {
      stderr.append(chunk);
    });
    child.once("error", (error) => {
      finishWithError(error);
    });
    child.once("exit", (code, signal) => {
      if (settled) {
        return;
      }

      const detail = stderr.trimmed() || signal || `exit ${code ?? "unknown"}`;
      finishWithError(new Error(`Codex app-server exited before live preview completed: ${detail}`));
    });
    lineReader.on("line", (line) => {
      let message: unknown;

      try {
        message = JSON.parse(line) as unknown;
      } catch {
        return;
      }

      if (!isRecord(message)) {
        return;
      }

      if (typeof message.id === "string") {
        const pending = pendingResponses.get(message.id);

        if (!pending) {
          return;
        }

        pendingResponses.delete(message.id);

        if (Object.prototype.hasOwnProperty.call(message, "error")) {
          pending.reject(new Error(responseErrorMessage(message, `Codex app-server request ${message.id} failed.`)));
          return;
        }

        pending.resolve(message.result);
        return;
      }

      if (typeof message.method !== "string" || !isRecord(message.params)) {
        return;
      }

      const params = message.params;

      if (threadId && params.threadId !== threadId) {
        return;
      }

      const notificationTurnId =
        typeof params.turnId === "string"
          ? params.turnId
          : isRecord(params.turn) && typeof params.turn.id === "string"
            ? params.turn.id
            : null;

      if (turnId && notificationTurnId && notificationTurnId !== turnId) {
        return;
      }

      if (message.method === "item/agentMessage/delta" && typeof params.delta === "string") {
        outputDeltaText = `${outputDeltaText}${params.delta}`;
        return;
      }

      if (message.method === "rawResponseItem/completed") {
        completedMessageText = textFromRawResponseItem(params.item) ?? completedMessageText;
        return;
      }

      if (message.method === "item/completed") {
        completedMessageText = textFromCompletedThreadItem(params.item) ?? completedMessageText;
        return;
      }

      if (message.method === "turn/completed" && isRecord(params.turn)) {
        const turn = params.turn;

        if (turn.status !== "completed") {
          finishWithError(new Error(turnFailureMessage(turn)));
          return;
        }

        try {
          const output = parseCodexPreviewOutput(completedMessageText ?? outputDeltaText);

          assertCodexPreviewOutputMatchesInput(input, output);
          settled = true;
          if (timeout) {
            clearTimeout(timeout);
          }
          resolve(output);
        } catch (error) {
          finishWithError(error instanceof Error ? error : new Error(String(error)));
        }
      }
    });
  });
  void completedTurn.catch(() => undefined);

  try {
    await sendRequest(requestBundle.initializeRequest);
    threadId = resultThreadId(await sendRequest(requestBundle.threadStartRequest));
    turnId = resultTurnId(await sendRequest(requestBundle.buildTurnStartRequest(threadId)));

    return await completedTurn;
  } finally {
    lineReader.close();
    if (!child.killed) {
      child.kill();
    }
  }
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


function isWorkerOutputStatus(value: unknown): value is CodexWorkerExecutionOutputEnvelope["status"] {
  return value === "completed" || value === "blocked";
}

function recordArray(value: unknown, fieldName: string) {
  if (!Array.isArray(value) || value.some((item) => !isRecord(item))) {
    throw new Error(`${fieldName} must be an array of objects.`);
  }

  return value as readonly Readonly<Record<string, unknown>>[];
}

const WORKER_OUTPUT_SECRET_VALUE_PATTERN =
  /\b(?:sk-[A-Za-z0-9_-]{8,}|(?:api[_-]?key|access[_-]?token|auth[_-]?token|refresh[_-]?token|session[_-]?cookie|password|secret|npm[_-]?token|github[_-]?token)\s*[:=]\s*[^\s"',;]{6,})/iu;
const WORKER_OUTPUT_EXTERNAL_MUTATION_REF_PATTERN =
  /^(?:deploy:production|production-deploy|external-mutation:(?:performed|completed|executed)|final-submit:(?:performed|completed|executed)|account-action:(?:performed|completed|executed)|destructive-operation:(?:performed|completed|executed))/iu;
const WORKER_OUTPUT_EXTERNAL_MUTATION_TEXT_PATTERN =
  /\b(?:performed|executed|completed|ran)\b.{0,80}\b(?:production deploy|external mutation|final submit|account action|destructive operation)\b|\b(?:production deploy|external mutation|final submit|account action|destructive operation)\b.{0,80}\b(?:performed|executed|completed|ran)\b/iu;

function collectWorkerOutputStrings(value: unknown, strings: string[] = []): readonly string[] {
  if (typeof value === "string") {
    strings.push(value);

    return strings;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectWorkerOutputStrings(item, strings);
    }

    return strings;
  }

  if (isRecord(value)) {
    for (const item of Object.values(value)) {
      collectWorkerOutputStrings(item, strings);
    }
  }

  return strings;
}

function assertCodexWorkerExecutionOutputSafety(output: CodexWorkerExecutionOutputEnvelope) {
  const outputStrings = collectWorkerOutputStrings(output);

  if (outputStrings.some((value) => WORKER_OUTPUT_SECRET_VALUE_PATTERN.test(value))) {
    throw new Error("Codex worker execution output must not contain credential, token, session cookie, or secret-like values.");
  }

  if (
    output.status === "completed" &&
    outputStrings.some((value) =>
      WORKER_OUTPUT_EXTERNAL_MUTATION_REF_PATTERN.test(value) ||
      WORKER_OUTPUT_EXTERNAL_MUTATION_TEXT_PATTERN.test(value)
    )
  ) {
    throw new Error("Completed Codex worker execution output must not claim external, production, final-submit, account, or destructive mutations.");
  }
}

function sameWorkerStringArray(left: unknown, right: readonly string[]) {
  return Array.isArray(left) &&
    left.length === right.length &&
    left.every((item, index) => item === right[index]);
}

function hasOnlyWorkerLedgerDocKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]) {
  const valueKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();

  return valueKeys.length === expectedKeys.length &&
    valueKeys.every((key, index) => key === expectedKeys[index]);
}

function sameWorkerTrackerDoc(value: unknown, expected: TrackerDoc) {
  return isRecord(value) &&
    hasOnlyWorkerLedgerDocKeys(value, ["trackerId", "title", "goal", "sourceRefs"]) &&
    value.trackerId === expected.trackerId &&
    value.title === expected.title &&
    value.goal === expected.goal &&
    sameWorkerStringArray(value.sourceRefs, expected.sourceRefs);
}

function sameWorkerStepDoc(value: unknown, expected: ImplementationStepDoc) {
  return isRecord(value) &&
    hasOnlyWorkerLedgerDocKeys(value, ["stepId", "title", "description", "sourceRefs", "expectedChangeScope"]) &&
    value.stepId === expected.stepId &&
    value.title === expected.title &&
    value.description === expected.description &&
    value.expectedChangeScope === expected.expectedChangeScope &&
    sameWorkerStringArray(value.sourceRefs, expected.sourceRefs);
}

export function assertCodexWorkerExecutionOutputMatchesInput(
  input: CodexWorkerExecutionInput,
  output: CodexWorkerExecutionOutputEnvelope
) {
  if (output.jobId !== input.jobId) {
    throw new Error("Codex worker execution output jobId must match the requested job.");
  }

  if (output.status !== "completed") {
    return;
  }

  for (const [index, transition] of output.ledgerTransitions.entries()) {
    if (!sameWorkerTrackerDoc(transition.trackerDoc, input.ledgerTrackerDoc)) {
      throw new Error(`Codex worker ledger transition ${index + 1} must use the planned ImplementationStepLedger trackerDoc.`);
    }
    if (!sameWorkerStepDoc(transition.stepDoc, input.ledgerStepDoc)) {
      throw new Error(`Codex worker ledger transition ${index + 1} must use the planned ImplementationStepLedger stepDoc.`);
    }
  }
}

export function validateCodexWorkerExecutionOutput(value: unknown): CodexWorkerExecutionOutputEnvelope {
  if (!isRecord(value)) {
    throw new Error("Codex worker execution output must be an object.");
  }

  if (value.schemaVersion !== CONTRACT_SCHEMA_VERSION) {
    throw new Error("Codex worker execution output schemaVersion does not match the internal contract.");
  }

  if (typeof value.jobId !== "string" || value.jobId.trim().length === 0) {
    throw new Error("Codex worker execution output jobId is required.");
  }

  if (!isWorkerOutputStatus(value.status)) {
    throw new Error("Codex worker execution output status must be completed or blocked.");
  }

  if (typeof value.summary !== "string" || value.summary.trim().length === 0) {
    throw new Error("Codex worker execution output summary is required.");
  }

  const ledgerTransitions = recordArray(value.ledgerTransitions, "ledgerTransitions") as unknown as
    readonly RecordImplementationStepLedgerPayload[];
  const evidenceRefs = stringArray(value.evidenceRefs, "evidenceRefs");
  const missingEvidence = value.missingEvidence === undefined
    ? undefined
    : stringArray(value.missingEvidence, "missingEvidence");

  if (value.status === "completed" && ledgerTransitions.length === 0) {
    throw new Error("Completed Codex worker execution output must include ledgerTransitions.");
  }

  if (value.status === "blocked" && typeof value.blockedReason !== "string") {
    throw new Error("Blocked Codex worker execution output must include blockedReason.");
  }

  const output: CodexWorkerExecutionOutputEnvelope = {
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    jobId: value.jobId.trim(),
    status: value.status,
    summary: value.summary.trim(),
    ledgerTransitions,
    evidenceRefs,
    ...(typeof value.blockedReason === "string" && value.blockedReason.trim().length > 0
      ? { blockedReason: value.blockedReason.trim() }
      : {}),
    ...(missingEvidence ? { missingEvidence } : {}),
    ...(typeof value.nextRequiredAction === "string" && value.nextRequiredAction.trim().length > 0
      ? { nextRequiredAction: value.nextRequiredAction.trim() }
      : {})
  };

  assertCodexWorkerExecutionOutputSafety(output);

  return output;
}

export function parseCodexWorkerExecutionOutput(raw: string): CodexWorkerExecutionOutputEnvelope {
  try {
    return validateCodexWorkerExecutionOutput(parseJsonObject(raw));
  } catch {
    return validateCodexWorkerExecutionOutput(parseJsonObject(repairCodexJsonOutput(raw)));
  }
}

function fixtureCodexWorkerExecutionTransitions(input: CodexWorkerExecutionInput): readonly RecordImplementationStepLedgerPayload[] {
  const fixtureStepCommitRecord = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.stepCommitRecords[0]!;
  const fixtureMissingTestAuditRecord = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.missingTestAuditRecords[0]!;
  const fixtureTestEvidenceRecord = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.testEvidenceRecords[0]!;
  const stepCommitRecord = {
    ...fixtureStepCommitRecord,
    stepId: input.ledgerStepDoc.stepId
  };
  const testEvidenceRecord = {
    ...fixtureTestEvidenceRecord,
    stepId: input.ledgerStepDoc.stepId,
    verifiedCommitSha: stepCommitRecord.commitSha
  };
  const missingTestAuditRecord = {
    ...fixtureMissingTestAuditRecord,
    stepId: input.ledgerStepDoc.stepId
  };
  const baseTransition = {
    trackerDoc: input.ledgerTrackerDoc,
    stepDoc: input.ledgerStepDoc
  };

  return [
    { ...baseTransition, targetStatus: "ready" },
    { ...baseTransition, targetStatus: "implementing", startedEvidenceRefs: ["codex-worker:fixture:started"] },
    { ...baseTransition, targetStatus: "committed", stepCommitRecord },
    { ...baseTransition, targetStatus: "review_required", stepCommitRecord },
    ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.codeReviewRecords.map((codeReviewRecord) => ({
      ...baseTransition,
      targetStatus: "review_required" as const,
      stepCommitRecord,
      codeReviewRecord: {
        ...codeReviewRecord,
        stepId: input.ledgerStepDoc.stepId
      }
    })),
    ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.cleanCodeReviewRecords.map((cleanCodeReviewRecord) => ({
      ...baseTransition,
      targetStatus: "clean_code_review_required" as const,
      stepCommitRecord,
      cleanCodeReviewRecord: {
        ...cleanCodeReviewRecord,
        stepId: input.ledgerStepDoc.stepId
      }
    })),
    { ...baseTransition, targetStatus: "tests_required", stepCommitRecord },
    {
      ...baseTransition,
      targetStatus: "completed",
      stepCommitRecord,
      missingTestAuditRecord,
      testEvidenceRecord,
      evidenceRefs: ["codex-worker:fixture:completed"]
    }
  ];
}

export function fixtureCodexWorkerExecutionOutput(input: CodexWorkerExecutionInput): CodexWorkerExecutionOutputEnvelope {
  return {
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    jobId: input.jobId,
    status: "completed",
    summary: `Fixture local Codex worker completed ${input.stage}.`,
    ledgerTransitions: fixtureCodexWorkerExecutionTransitions(input),
    evidenceRefs: [
      `codex-worker:${input.jobId}:fixture`,
      "codex-worker:fixture:completed"
    ]
  };
}

export async function createLiveCodexWorkerExecution(
  input: CodexWorkerExecutionInput,
  options: {
    readonly env?: Readonly<Record<string, string | undefined>>;
    readonly processFactory?: CodexAppServerProcessFactory;
  } = {}
): Promise<CodexWorkerExecutionOutputEnvelope> {
  const env = options.env ?? process.env;
  const spawnPlan = codexAppServerSpawnPlan(env);
  const processFactory = options.processFactory ?? defaultCodexAppServerProcessFactory;
  const timeoutMs = codexPreviewTurnTimeoutMs(env);
  const requestBundle = buildCodexWorkerTurnRequests(input, { cwd: input.workingDirectory });
  const child = processFactory(spawnPlan.command, [...spawnPlan.args], { env: codexSpawnEnv(env) });
  const lineReader = createInterface({ input: child.stdout });
  const stderr = createLimitedTextCapture();
  const pendingResponses = new Map<
    string,
    {
      readonly resolve: (value: unknown) => void;
      readonly reject: (error: Error) => void;
    }
  >();
  let threadId: string | null = null;
  let turnId: string | null = null;
  let outputDeltaText = "";
  let completedMessageText: string | null = null;
  let settled = false;

  logCodexRuntimeDiagnostic("info", "worker-spawn", {
    command: spawnPlan.command,
    args: spawnPlan.args,
    transport: spawnPlan.transport,
    generatedSchemaVersion: spawnPlan.generatedSchemaVersion,
    timeoutMs,
    jobId: input.jobId,
    workingDirectory: input.workingDirectory
  });

  function rejectPending(error: Error) {
    for (const pending of pendingResponses.values()) {
      pending.reject(error);
    }
    pendingResponses.clear();
  }

  function sendRequest(request: CodexAppServerClientRequest) {
    return new Promise<unknown>((resolve, reject) => {
      pendingResponses.set(String(request.id), { resolve, reject });
      child.stdin.write(`${JSON.stringify(request)}\n`, (error) => {
        if (error) {
          pendingResponses.delete(String(request.id));
          reject(error);
        }
      });
    });
  }

  const completedTurn = new Promise<CodexWorkerExecutionOutputEnvelope>((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    function finishWithError(error: Error) {
      if (settled) {
        return;
      }

      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      rejectPending(error);
      reject(error);
    }

    timeout = setTimeout(() => {
      finishWithError(new Error(`Codex worker execution did not finish within ${timeoutMs}ms.`));
    }, timeoutMs);

    child.stderr.on("data", (chunk) => {
      stderr.append(chunk);
    });
    child.once("error", (error) => {
      finishWithError(error);
    });
    child.once("exit", (code, signal) => {
      if (settled) {
        return;
      }

      const detail = stderr.trimmed() || signal || `exit ${code ?? "unknown"}`;
      finishWithError(new Error(`Codex app-server exited before worker execution completed: ${detail}`));
    });
    lineReader.on("line", (line) => {
      let message: unknown;

      try {
        message = JSON.parse(line) as unknown;
      } catch {
        return;
      }

      if (!isRecord(message)) {
        return;
      }

      if (typeof message.id === "string") {
        const pending = pendingResponses.get(message.id);

        if (!pending) {
          return;
        }

        pendingResponses.delete(message.id);

        if (Object.prototype.hasOwnProperty.call(message, "error")) {
          pending.reject(new Error(responseErrorMessage(message, `Codex app-server request ${message.id} failed.`)));
          return;
        }

        pending.resolve(message.result);
        return;
      }

      if (typeof message.method !== "string" || !isRecord(message.params)) {
        return;
      }

      const params = message.params;

      if (threadId && params.threadId !== threadId) {
        return;
      }

      const notificationTurnId =
        typeof params.turnId === "string"
          ? params.turnId
          : isRecord(params.turn) && typeof params.turn.id === "string"
            ? params.turn.id
            : null;

      if (turnId && notificationTurnId && notificationTurnId !== turnId) {
        return;
      }

      if (message.method === "item/agentMessage/delta" && typeof params.delta === "string") {
        outputDeltaText = `${outputDeltaText}${params.delta}`;
        return;
      }

      if (message.method === "rawResponseItem/completed") {
        completedMessageText = textFromRawResponseItem(params.item) ?? completedMessageText;
        return;
      }

      if (message.method === "item/completed") {
        completedMessageText = textFromCompletedThreadItem(params.item) ?? completedMessageText;
        return;
      }

      if (message.method === "turn/completed" && isRecord(params.turn)) {
        const turn = params.turn;

        if (turn.status !== "completed") {
          finishWithError(new Error(turnFailureMessage(turn)));
          return;
        }

        try {
          const output = parseCodexWorkerExecutionOutput(completedMessageText ?? outputDeltaText);

          assertCodexWorkerExecutionOutputMatchesInput(input, output);

          settled = true;
          if (timeout) {
            clearTimeout(timeout);
          }
          resolve(output);
        } catch (error) {
          finishWithError(error instanceof Error ? error : new Error(String(error)));
        }
      }
    });
  });
  void completedTurn.catch(() => undefined);

  try {
    await sendRequest(requestBundle.initializeRequest);
    threadId = resultThreadId(await sendRequest(requestBundle.threadStartRequest));
    turnId = resultTurnId(await sendRequest(requestBundle.buildTurnStartRequest(threadId)));

    return await completedTurn;
  } finally {
    lineReader.close();
    if (!child.killed) {
      child.kill();
    }
  }
}

function statusDto(input: {
  readonly status: CodexRuntimeStatusDto["status"];
  readonly checkedAt: string;
  readonly account: CodexRuntimeAccountDto;
  readonly liveTurnExecutionEnabled: boolean;
  readonly executionMode: CodexRuntimeStatusDto["executionMode"];
  readonly reason?: string;
}): CodexRuntimeStatusDto {
  return {
    status: input.status,
    adapterVersion: CODEX_RUNTIME_ADAPTER_VERSION,
    generatedSchemaVersion: CODEX_APP_SERVER_GENERATED_VERSION,
    transport: CODEX_RUNTIME_TRANSPORT,
    checkedAt: input.checkedAt,
    manualHandoffAvailable: true,
    liveTurnExecutionEnabled: input.liveTurnExecutionEnabled,
    executionMode: input.executionMode,
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
  const livePreviewCreator =
    options.livePreviewCreator ??
    ((input: CodexRuntimePreviewInput) =>
      createLiveCodexPreview(input, {
        env,
        now,
        ...(options.processFactory ? { processFactory: options.processFactory } : {})
      }));
  const liveWorkerExecutor =
    options.liveWorkerExecutor ??
    ((input: CodexWorkerExecutionInput) =>
      createLiveCodexWorkerExecution(input, {
        env,
        ...(options.processFactory ? { processFactory: options.processFactory } : {})
      }));
  const liveTurnExecutionEnabled = envFlagEnabled(env, CODEX_LIVE_TURNS_ENV);

  return {
    async getStatus(): Promise<CodexRuntimeStatusDto> {
      if (fixtureMode) {
        return statusDto({
          status: "available",
          checkedAt: now(),
          account: fixtureCodexAccountStatus(),
          liveTurnExecutionEnabled: false,
          executionMode: "fixture",
          reason: "Fixture mode simulates Codex preview execution."
        });
      }

      if (env.SOLO_CODEX_APP_SERVER_DISABLED === "1") {
        return statusDto({
          status: "unavailable",
          checkedAt: now(),
          account: baseCodexAccountStatus("blocked", "SOLO_CODEX_APP_SERVER_DISABLED skips Codex account probing."),
          liveTurnExecutionEnabled: false,
          executionMode: "manual_handoff",
          reason: "SOLO_CODEX_APP_SERVER_DISABLED disables live app-server probing."
        });
      }

      const account = await accountReader();
      const isAuthenticated = account.status === "authenticated";

      if (liveTurnExecutionEnabled && isAuthenticated) {
        return statusDto({
          status: "available",
          checkedAt: now(),
          account,
          liveTurnExecutionEnabled: true,
          executionMode: "live",
          reason: "Live Codex app-server turn execution is enabled for preview-only artifacts."
        });
      }

      return statusDto({
        status: "unavailable",
        checkedAt: now(),
        account,
        liveTurnExecutionEnabled,
        executionMode: "manual_handoff",
        reason:
          isAuthenticated
            ? `Codex CLI login is available, but set ${CODEX_LIVE_TURNS_ENV}=1 to enable preview-only live turn execution; manual handoff fallback is required until then.`
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

      const account = await readAccountBeforeLogin(accountReader);

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
      return codexAppServerSpawnPlan(env);
    },

    buildPreviewTurnRequests(input: CodexRuntimePreviewInput, requestOptions?: CodexStdioTurnRequestOptions) {
      return buildCodexStdioTurnRequests(input, requestOptions);
    },

    buildWorkerTurnRequests(input: CodexWorkerExecutionInput, requestOptions?: CodexStdioTurnRequestOptions) {
      return buildCodexWorkerTurnRequests(input, requestOptions);
    },

    async createPreview(input: CodexRuntimePreviewInput): Promise<CodexPreviewOutputEnvelope> {
      if (fixtureMode) {
        return fixtureCodexPreviewOutput(input, { createdAt: now() });
      }

      if (!liveTurnExecutionEnabled) {
        throw new CodexRuntimeUnavailableError(
          `Live Codex app-server turn execution is not enabled. Set ${CODEX_LIVE_TURNS_ENV}=1 to enable preview-only turns; manual handoff fallback is required.`
        );
      }

      const account = await accountReader();

      if (account.status !== "authenticated") {
        throw new CodexRuntimeUnavailableError(
          "Codex CLI login is required before live Codex app-server turn execution can start."
        );
      }

      return livePreviewCreator(input);
    },

    async executeWorker(input: CodexWorkerExecutionInput): Promise<CodexWorkerExecutionOutputEnvelope> {
      if (fixtureMode) {
        return fixtureCodexWorkerExecutionOutput(input);
      }

      if (!liveTurnExecutionEnabled) {
        throw new CodexRuntimeUnavailableError(
          `Live Codex app-server worker execution is not enabled. Set ${CODEX_LIVE_TURNS_ENV}=1 to enable bounded local worker turns; the worker job remains blocked until runtime evidence is available.`
        );
      }

      const account = await accountReader();

      if (account.status !== "authenticated") {
        throw new CodexRuntimeUnavailableError(
          "Codex CLI login is required before live Codex worker execution can start."
        );
      }

      return liveWorkerExecutor(input);
    }
  };
}

export type CodexRuntimeAdapter = ReturnType<typeof createCodexRuntimeAdapter>;
