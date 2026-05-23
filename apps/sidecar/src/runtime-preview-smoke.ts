import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { CodexRuntimeStatusDto, RuntimeActivityProjection } from "@solo-superman/contracts";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "@solo-superman/db";
import { createProductEngineCommandService } from "./product-engine/command-service";
import { createCodexRuntimeAdapter, type CodexRuntimeAdapter } from "./runtime";
import { createSidecarApp } from "./server";
import {
  authHeaders,
  dataRecord,
  firstRecord,
  jsonEnvelope,
  objectAt,
  stringAt,
  type JsonRecord
} from "./smoke-helpers";

export const LIVE_PREVIEW_TURN_VERIFY_ENV = "SOLO_VERIFY_CODEX_LIVE_PREVIEW_TURN" as const;
export const LIVE_TURNS_ENV = "SOLO_CODEX_APP_SERVER_LIVE_TURNS" as const;
export const RUNTIME_PREVIEW_TURN_SMOKE = "codex_runtime_preview_turn" as const;

const FIXTURE_NOW = "2026-05-23T00:00:00.000Z";
const PREVIEW_TURN_PURPOSE = "implementation_plan_preview";
const PREVIEW_CONTEXT_HASH = "runtime_preview_turn_smoke_ctx";
const REQUIRED_LIVE_GATE_BLOCKER = `${LIVE_TURNS_ENV}=1 is required before live runtime preview turns can be verified`;

type SmokeMode = "fixture" | "live";
type SmokeStatus = "blocked" | "passed";

export interface RuntimePreviewTurnGateEvidence {
  readonly status: "ready" | "blocked";
  readonly smoke: typeof RUNTIME_PREVIEW_TURN_SMOKE;
  readonly mode: SmokeMode;
  readonly reason?: string;
  readonly blockers?: readonly string[];
  readonly checked: readonly string[];
}

export interface RuntimePreviewTurnSmokeEvidence {
  readonly status: SmokeStatus;
  readonly smoke: typeof RUNTIME_PREVIEW_TURN_SMOKE;
  readonly mode: SmokeMode;
  readonly runtime?: {
    readonly status: CodexRuntimeStatusDto["status"];
    readonly executionMode: CodexRuntimeStatusDto["executionMode"];
    readonly liveTurnExecutionEnabled: boolean;
    readonly accountStatus: CodexRuntimeStatusDto["account"]["status"];
  };
  readonly preview?: {
    readonly sessionId: string;
    readonly commandStatus: string;
    readonly effectStatus: string;
    readonly artifactKind: string;
    readonly artifactStatus: string;
    readonly artifactSource: string;
    readonly applyPolicy: string;
  };
  readonly reason?: string;
  readonly blockers?: readonly string[];
  readonly checked: readonly string[];
}

export interface RuntimePreviewTurnSmokeOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly runtimeAdapter?: CodexRuntimeAdapter;
  readonly appDataDir?: string;
  readonly cleanupAppDataDir?: boolean;
  readonly localCapabilityToken?: string;
}

interface PreviewScenario {
  readonly storageApp: ReturnType<typeof createSidecarApp>;
  readonly storage: Awaited<ReturnType<typeof createSoloStorage>>;
  readonly codexRuntimeAdapter: CodexRuntimeAdapter;
}

interface PreviewExecutionResult {
  readonly sessionId: string;
  readonly executorResult: JsonRecord;
  readonly commandStatus: JsonRecord;
  readonly artifact: JsonRecord;
}

interface PreviewScenarioInput {
  readonly mode: SmokeMode;
  readonly gateChecked: readonly string[];
  readonly appDataDir: string;
  readonly localCapabilityToken: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly runtimeAdapter?: CodexRuntimeAdapter;
}

function envFlagEnabled(env: Readonly<Record<string, string | undefined>>, key: string) {
  return env[key] === "1";
}

export function livePreviewTurnVerificationRequested(env: Readonly<Record<string, string | undefined>> = process.env) {
  return envFlagEnabled(env, LIVE_PREVIEW_TURN_VERIFY_ENV);
}

export function runtimePreviewTurnGateEvidence(
  env: Readonly<Record<string, string | undefined>> = process.env
): RuntimePreviewTurnGateEvidence {
  if (!livePreviewTurnVerificationRequested(env)) {
    return {
      status: "ready",
      smoke: RUNTIME_PREVIEW_TURN_SMOKE,
      mode: "fixture",
      checked: [
        `${LIVE_PREVIEW_TURN_VERIFY_ENV} is not set; fixture preview-turn smoke will run`,
        "default smoke remains credential-free"
      ]
    };
  }

  if (!envFlagEnabled(env, LIVE_TURNS_ENV)) {
    return {
      status: "blocked",
      smoke: RUNTIME_PREVIEW_TURN_SMOKE,
      mode: "live",
      reason: `Live runtime preview-turn verification was requested, but ${LIVE_TURNS_ENV}=1 is missing.`,
      blockers: [REQUIRED_LIVE_GATE_BLOCKER],
      checked: [
        `${LIVE_PREVIEW_TURN_VERIFY_ENV}=1 requested live preview-turn verification`,
        REQUIRED_LIVE_GATE_BLOCKER
      ]
    };
  }

  return {
    status: "ready",
    smoke: RUNTIME_PREVIEW_TURN_SMOKE,
    mode: "live",
    checked: [
      `${LIVE_PREVIEW_TURN_VERIFY_ENV}=1 requested live preview-turn verification`,
      `${LIVE_TURNS_ENV}=1 enables preview-only live turns`
    ]
  };
}

function runtimePublicStatus(status: CodexRuntimeStatusDto) {
  return {
    status: status.status,
    executionMode: status.executionMode,
    liveTurnExecutionEnabled: status.liveTurnExecutionEnabled,
    accountStatus: status.account.status
  };
}

function runtimeStatusBlockers(mode: SmokeMode, status: CodexRuntimeStatusDto) {
  const blockers: string[] = [];

  if (status.status !== "available") {
    blockers.push(`runtime status must be available; received ${JSON.stringify(status.status)}`);
  }

  if (mode === "fixture" && status.executionMode !== "fixture") {
    blockers.push(`fixture smoke requires executionMode=fixture; received ${JSON.stringify(status.executionMode)}`);
  }

  if (mode === "live" && status.executionMode !== "live") {
    blockers.push(`live smoke requires executionMode=live; received ${JSON.stringify(status.executionMode)}`);
  }

  if (mode === "live" && status.liveTurnExecutionEnabled !== true) {
    blockers.push("live smoke requires liveTurnExecutionEnabled=true");
  }

  if (mode === "live" && status.account.status !== "authenticated") {
    blockers.push(`live smoke requires an authenticated Codex account; received ${JSON.stringify(status.account.status)}`);
  }

  return blockers;
}

function blockedRuntimeEvidence(input: PreviewScenarioInput, status: CodexRuntimeStatusDto, blockers: readonly string[]) {
  return {
    status: "blocked" as const,
    smoke: RUNTIME_PREVIEW_TURN_SMOKE,
    mode: input.mode,
    runtime: runtimePublicStatus(status),
    reason: "Runtime status is not ready for the requested preview-turn smoke mode.",
    blockers,
    checked: [...input.gateChecked, "runtime status read before queuing a preview effect"]
  };
}

async function createProject(storageApp: ReturnType<typeof createSidecarApp>, localCapabilityToken: string) {
  const response = await storageApp.request("/api/v1/projects", {
    method: "POST",
    headers: {
      ...authHeaders(localCapabilityToken),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      rawIdea: "A runtime preview turn smoke idea",
      localPrivacyMode: "local_only",
      projectPurposeMode: "business",
      projectPurposeModeConfirmation: "user_confirmed",
      businessCriticIntensity: "balanced",
      businessCriticIntensityConfirmation: "user_confirmed"
    })
  });
  const data = dataRecord(await jsonEnvelope(response, "create project"), "create project");
  const projection = objectAt(data.immediateProjection, "create project immediateProjection");

  return stringAt(projection.sessionId, "create project sessionId");
}

async function queuePreviewTurn(
  storageApp: ReturnType<typeof createSidecarApp>,
  localCapabilityToken: string,
  sessionId: string
) {
  const response = await storageApp.request("/api/v1/runtime/codex/preview", {
    method: "POST",
    headers: {
      ...authHeaders(localCapabilityToken),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sessionId,
      expectedStateVersion: 1,
      turnPurpose: PREVIEW_TURN_PURPOSE,
      contextHash: PREVIEW_CONTEXT_HASH,
      prompt: "Preview a bounded implementation plan without executing file, shell, browser, or network actions.",
      sourceRefs: ["runtime-preview-turn-smoke"],
      targetObject: "PlanningNote"
    })
  });
  const data = dataRecord(await jsonEnvelope(response, "queue runtime preview"), "queue runtime preview");
  const pendingEffectSummary = objectAt(data.pendingEffectSummary, "queue runtime preview pendingEffectSummary");
  const byType = objectAt(pendingEffectSummary.byType, "queue runtime preview pendingEffectSummary.byType");

  if (data.category !== "accepted" || byType.codex_runtime_preview_effect !== 1) {
    throw new Error(`queue runtime preview did not produce exactly one pending Codex runtime effect: ${JSON.stringify(data)}`);
  }

  return stringAt(data.statusUrl, "queue runtime preview statusUrl");
}

async function completedCommandStatus(
  storageApp: ReturnType<typeof createSidecarApp>,
  localCapabilityToken: string,
  statusUrl: string
) {
  const response = await storageApp.request(statusUrl, {
    headers: authHeaders(localCapabilityToken)
  });

  return dataRecord(await jsonEnvelope(response, "runtime preview command status"), "runtime preview command status");
}

async function runtimeActivity(
  storageApp: ReturnType<typeof createSidecarApp>,
  localCapabilityToken: string,
  sessionId: string
) {
  const response = await storageApp.request(`/api/v1/sessions/${sessionId}/activity`, {
    headers: authHeaders(localCapabilityToken)
  });

  return dataRecord(await jsonEnvelope(response, "runtime activity"), "runtime activity") as unknown as RuntimeActivityProjection;
}

function blockersFromPreviewResult(input: {
  readonly mode: SmokeMode;
  readonly executorResult: JsonRecord;
  readonly commandStatus: JsonRecord;
  readonly artifact: JsonRecord;
}) {
  const blockers: string[] = [];

  if (input.executorResult.status !== "succeeded") {
    blockers.push(`preview effect executor must succeed; received ${JSON.stringify(input.executorResult.status)}`);
  }

  if (input.executorResult.fallback === "manual_prompt_handoff") {
    blockers.push("preview effect fell back to manual handoff instead of executing a Codex preview turn");
  }

  if (input.commandStatus.commandStatus !== "complete") {
    blockers.push(`preview command status must be complete; received ${JSON.stringify(input.commandStatus.commandStatus)}`);
  }

  if (input.artifact.kind !== "ImplementationPlanPreviewArtifact") {
    blockers.push(`artifact kind must be ImplementationPlanPreviewArtifact; received ${JSON.stringify(input.artifact.kind)}`);
  }

  if (input.artifact.status !== "preview_ready") {
    blockers.push(`artifact status must be preview_ready; received ${JSON.stringify(input.artifact.status)}`);
  }

  if (input.mode === "live" && input.artifact.source !== "codex_app_server") {
    blockers.push(`live smoke artifact source must be codex_app_server; received ${JSON.stringify(input.artifact.source)}`);
  }

  if (input.mode === "fixture" && input.artifact.source !== "protocol_fixture") {
    blockers.push(`fixture smoke artifact source must be protocol_fixture; received ${JSON.stringify(input.artifact.source)}`);
  }

  if (input.artifact.applyPolicy === "manual_handoff_required") {
    blockers.push("artifact applyPolicy must not be manual_handoff_required for a passed preview-turn smoke");
  }

  return blockers;
}

function previewEvidence(input: PreviewExecutionResult) {
  return {
    sessionId: input.sessionId,
    commandStatus: stringAt(input.commandStatus.commandStatus, "runtime preview commandStatus"),
    effectStatus: stringAt(input.executorResult.status, "runtime preview effect status"),
    artifactKind: stringAt(input.artifact.kind, "runtime preview artifact kind"),
    artifactStatus: stringAt(input.artifact.status, "runtime preview artifact status"),
    artifactSource: stringAt(input.artifact.source, "runtime preview artifact source"),
    applyPolicy: stringAt(input.artifact.applyPolicy, "runtime preview artifact applyPolicy")
  };
}

function blockedPreviewEvidence(
  input: PreviewScenarioInput,
  status: CodexRuntimeStatusDto,
  result: PreviewExecutionResult,
  blockers: readonly string[]
) {
  return {
    status: "blocked" as const,
    smoke: RUNTIME_PREVIEW_TURN_SMOKE,
    mode: input.mode,
    runtime: runtimePublicStatus(status),
    preview: previewEvidence(result),
    reason: "Runtime preview turn did not produce a directly usable preview artifact.",
    blockers,
    checked: [
      ...input.gateChecked,
      "runtime status available before preview",
      "preview route queued one codex_runtime_preview_effect",
      "pending preview effect executor ran",
      "runtime activity artifact was inspected"
    ]
  };
}

function passedPreviewEvidence(input: PreviewScenarioInput, status: CodexRuntimeStatusDto, result: PreviewExecutionResult) {
  return {
    status: "passed" as const,
    smoke: RUNTIME_PREVIEW_TURN_SMOKE,
    mode: input.mode,
    runtime: runtimePublicStatus(status),
    preview: previewEvidence(result),
    checked: [
      ...input.gateChecked,
      "runtime status available before preview",
      "preview route queued one codex_runtime_preview_effect",
      "pending preview effect executor ran",
      "runtime command reached complete status",
      "runtime activity contains preview_ready ImplementationPlanPreviewArtifact"
    ]
  };
}

async function createPreviewScenario(
  appDataDir: string,
  localCapabilityToken: string,
  mode: SmokeMode,
  env: Readonly<Record<string, string | undefined>>,
  runtimeAdapter?: CodexRuntimeAdapter
): Promise<PreviewScenario> {
  const storage = await createSoloStorage({ url: localDatabaseUrlFromAppDataDir(appDataDir) });
  const migrationStatus = await applyMigrations(storage);

  if (migrationStatus.state === "failed") {
    await storage.close();
    throw new Error(migrationStatus.errorMessage);
  }

  const codexRuntimeAdapter = runtimeAdapter ?? createCodexRuntimeAdapter({
    fixtureMode: mode === "fixture",
    env,
    now: () => FIXTURE_NOW
  });

  return {
    storage,
    codexRuntimeAdapter,
    storageApp: createSidecarApp({
      localCapabilityToken,
      migrationStatus,
      storage,
      codexRuntimeAdapter
    })
  };
}

async function executePreviewTurn(
  scenario: PreviewScenario,
  localCapabilityToken: string
): Promise<PreviewExecutionResult> {
  const sessionId = await createProject(scenario.storageApp, localCapabilityToken);
  const statusUrl = await queuePreviewTurn(scenario.storageApp, localCapabilityToken, sessionId);
  const executorResults = await createProductEngineCommandService(
    scenario.storage,
    scenario.codexRuntimeAdapter
  ).runPendingCodexRuntimePreviewEffects();
  const commandStatus = await completedCommandStatus(scenario.storageApp, localCapabilityToken, statusUrl);
  const activity = await runtimeActivity(scenario.storageApp, localCapabilityToken, sessionId);

  return {
    sessionId,
    executorResult: firstRecord(executorResults, "runtime preview effect executor results"),
    commandStatus,
    artifact: firstRecord(activity.runtimeArtifacts, "runtime activity artifacts")
  };
}

async function runPreviewScenario(input: PreviewScenarioInput) {
  const scenario = await createPreviewScenario(
    input.appDataDir,
    input.localCapabilityToken,
    input.mode,
    input.env,
    input.runtimeAdapter
  );

  try {
    const status = await scenario.codexRuntimeAdapter.getStatus();
    const runtimeBlockers = runtimeStatusBlockers(input.mode, status);

    if (runtimeBlockers.length > 0) {
      return blockedRuntimeEvidence(input, status, runtimeBlockers);
    }

    const previewResult = await executePreviewTurn(scenario, input.localCapabilityToken);
    const previewBlockers = blockersFromPreviewResult({
      mode: input.mode,
      executorResult: previewResult.executorResult,
      commandStatus: previewResult.commandStatus,
      artifact: previewResult.artifact
    });

    if (previewBlockers.length > 0) {
      return blockedPreviewEvidence(input, status, previewResult, previewBlockers);
    }

    return passedPreviewEvidence(input, status, previewResult);
  } finally {
    await scenario.storage.close();
  }
}

export async function runRuntimePreviewTurnSmoke(
  options: RuntimePreviewTurnSmokeOptions = {}
): Promise<RuntimePreviewTurnSmokeEvidence> {
  const env = options.env ?? process.env;
  const gate = runtimePreviewTurnGateEvidence(env);

  if (gate.status === "blocked") {
    return {
      status: "blocked",
      smoke: gate.smoke,
      mode: gate.mode,
      ...(gate.reason ? { reason: gate.reason } : {}),
      ...(gate.blockers ? { blockers: gate.blockers } : {}),
      checked: gate.checked
    };
  }

  const appDataDir = options.appDataDir ?? (await mkdtemp(join(tmpdir(), "solo-superman-runtime-preview-turn-")));
  const shouldCleanup = options.cleanupAppDataDir ?? !options.appDataDir;
  const localCapabilityToken = options.localCapabilityToken ?? `runtime-preview-turn-smoke-${randomUUID()}`;

  try {
    return await runPreviewScenario({
      mode: gate.mode,
      gateChecked: gate.checked,
      appDataDir,
      localCapabilityToken,
      env,
      ...(options.runtimeAdapter ? { runtimeAdapter: options.runtimeAdapter } : {})
    });
  } finally {
    if (shouldCleanup) {
      await rm(appDataDir, { recursive: true, force: true });
    }
  }
}

function exitCodeForEvidence(evidence: RuntimePreviewTurnSmokeEvidence) {
  return evidence.status === "passed" ? 0 : 1;
}

async function main() {
  const evidence = await runRuntimePreviewTurnSmoke();

  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = exitCodeForEvidence(evidence);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
