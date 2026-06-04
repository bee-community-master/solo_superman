import { describe, expect, it } from "vitest";
import {
  CODEX_SDK_PACKAGE_VERSION,
  CODEX_RUNTIME_ADAPTER_VERSION,
  CODEX_RUNTIME_TRANSPORT,
  type CodexRuntimeStatusDto
} from "@solo-superman/contracts";
import {
  LIVE_PREVIEW_TURN_VERIFY_ENV,
  LIVE_TURNS_ENV,
  runtimePreviewTurnGateEvidence,
  runRuntimePreviewTurnSmoke
} from "./runtime-preview-smoke";
import { CodexRuntimeUnavailableError, createCodexRuntimeAdapter, fixtureCodexPreviewOutput } from "./runtime";

function liveReadyStatus(): CodexRuntimeStatusDto {
  return {
    status: "available",
    adapterVersion: CODEX_RUNTIME_ADAPTER_VERSION,
    sdkPackageVersion: CODEX_SDK_PACKAGE_VERSION,
    transport: CODEX_RUNTIME_TRANSPORT,
    codexCliVersion: "0.137.0",
    checkedAt: "2026-05-23T00:00:00.000Z",
    manualHandoffAvailable: true,
    liveTurnExecutionEnabled: true,
    executionMode: "live",
    account: {
      status: "authenticated",
      loginCommand: "codex auth login",
      loginStatusCommand: "codex login status",
      accountType: "chatgpt",
      email: "fixture-codex@example.local"
    },
    reason: "Test fixture reports live runtime readiness."
  };
}

describe("runtime preview turn smoke", () => {
  it("runs a credential-free fixture preview effect and artifact smoke by default", async () => {
    const evidence = await runRuntimePreviewTurnSmoke({ env: {} });

    expect(evidence).toMatchObject({
      status: "passed",
      smoke: "codex_runtime_preview_turn",
      mode: "fixture",
      runtime: {
        status: "available",
        executionMode: "fixture",
        liveTurnExecutionEnabled: false,
        accountStatus: "authenticated"
      },
      preview: {
        commandStatus: "complete",
        effectStatus: "succeeded",
        artifactKind: "ImplementationPlanPreviewArtifact",
        artifactStatus: "preview_ready",
        artifactSource: "protocol_fixture",
        applyPolicy: "note_only"
      }
    });
    expect(evidence.checked).toContain("preview route queued one codex_runtime_preview_effect");
    expect(evidence.checked).toContain("runtime activity contains preview_ready ImplementationPlanPreviewArtifact");
  });

  it("blocks live preview-turn verification before side effects when live turns are not enabled", async () => {
    const evidence = await runRuntimePreviewTurnSmoke({
      env: {
        [LIVE_PREVIEW_TURN_VERIFY_ENV]: "1"
      }
    });

    expect(evidence).toMatchObject({
      status: "blocked",
      mode: "live",
      blockers: [`${LIVE_TURNS_ENV}=1 is required before live runtime preview turns can be verified`]
    });
    expect(evidence.preview).toBeUndefined();
  });

  it("documents the fixture, blocked-live, and ready-live gate states", () => {
    expect(runtimePreviewTurnGateEvidence({})).toMatchObject({
      status: "ready",
      mode: "fixture"
    });
    expect(runtimePreviewTurnGateEvidence({ [LIVE_PREVIEW_TURN_VERIFY_ENV]: "1" })).toMatchObject({
      status: "blocked",
      mode: "live"
    });
    expect(
      runtimePreviewTurnGateEvidence({
        [LIVE_PREVIEW_TURN_VERIFY_ENV]: "1",
        [LIVE_TURNS_ENV]: "1"
      })
    ).toMatchObject({
      status: "ready",
      mode: "live"
    });
  });

  it("passes live preview-turn mode only when the effect persists a Codex SDK artifact", async () => {
    const livePreviewAdapter = {
      ...createCodexRuntimeAdapter({ fixtureMode: true, env: {} }),
      async getStatus() {
        return liveReadyStatus();
      },
      async createPreview(input: Parameters<ReturnType<typeof createCodexRuntimeAdapter>["createPreview"]>[0]) {
        return fixtureCodexPreviewOutput(input, { createdAt: "2026-05-23T00:00:00.000Z" });
      }
    };

    const evidence = await runRuntimePreviewTurnSmoke({
      env: {
        [LIVE_PREVIEW_TURN_VERIFY_ENV]: "1",
        [LIVE_TURNS_ENV]: "1"
      },
      runtimeAdapter: livePreviewAdapter
    });

    expect(evidence).toMatchObject({
      status: "passed",
      mode: "live",
      preview: {
        commandStatus: "complete",
        effectStatus: "succeeded",
        artifactKind: "ImplementationPlanPreviewArtifact",
        artifactStatus: "preview_ready",
        artifactSource: "codex_sdk",
        applyPolicy: "note_only"
      }
    });
  });

  it("treats manual-handoff fallback as blocked rather than a live preview-turn pass", async () => {
    const liveFallbackAdapter = {
      ...createCodexRuntimeAdapter({ fixtureMode: true, env: {} }),
      async getStatus() {
        return liveReadyStatus();
      },
      async createPreview() {
        throw new CodexRuntimeUnavailableError("Injected live preview turn failure.");
      }
    };

    const evidence = await runRuntimePreviewTurnSmoke({
      env: {
        [LIVE_PREVIEW_TURN_VERIFY_ENV]: "1",
        [LIVE_TURNS_ENV]: "1"
      },
      runtimeAdapter: liveFallbackAdapter
    });

    expect(evidence).toMatchObject({
      status: "blocked",
      mode: "live",
      runtime: {
        status: "available",
        executionMode: "live",
        liveTurnExecutionEnabled: true,
        accountStatus: "authenticated"
      },
      preview: {
        commandStatus: "complete",
        effectStatus: "succeeded",
        artifactKind: "ImplementationPlanPreviewArtifact",
        artifactStatus: "manual_handoff",
        artifactSource: "manual_prompt_handoff",
        applyPolicy: "manual_handoff_required"
      }
    });
    expect(evidence.blockers).toEqual(
      expect.arrayContaining([
        "preview effect fell back to manual handoff instead of executing a Codex preview turn",
        "artifact applyPolicy must not be manual_handoff_required for a passed preview-turn smoke"
      ])
    );
  });
});
