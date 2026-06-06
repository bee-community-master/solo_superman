import { describe, expect, it } from "vitest";
import {
  CODEX_RUNTIME_ADAPTER_VERSION,
  CODEX_RUNTIME_TRANSPORT,
  CODEX_SDK_PACKAGE_VERSION,
  type CodexRuntimeStatusDto
} from "@solo-superman/contracts";
import { codexRuntimeEvidenceView } from "./codex-runtime-status-view";

const FIXTURE_CODEX_CLI_VERSION = "0.137.0" as const;

function codexRuntimeStatus(overrides: Partial<CodexRuntimeStatusDto> = {}): CodexRuntimeStatusDto {
  return {
    status: "unavailable",
    adapterVersion: CODEX_RUNTIME_ADAPTER_VERSION,
    sdkPackageVersion: CODEX_SDK_PACKAGE_VERSION,
    codexCliVersion: FIXTURE_CODEX_CLI_VERSION,
    transport: CODEX_RUNTIME_TRANSPORT,
    checkedAt: "2026-05-23T00:00:00.000Z",
    manualHandoffAvailable: true,
    liveTurnExecutionEnabled: false,
    executionMode: "manual_handoff",
    account: {
      status: "authenticated",
      loginCommand: "codex auth login",
      loginStatusCommand: "codex login status",
      accountType: "chatgpt",
      planType: "plus"
    },
    ...overrides
  };
}

describe("codexRuntimeEvidenceView", () => {
  it("keeps unknown runtime evidence explicit before status is loaded", () => {
    expect(codexRuntimeEvidenceView(null)).toMatchObject({
      status: "unknown",
      statusLabel: "unknown",
      executionMode: "unknown",
      executionModeLabel: "unknown",
      accountStatus: "unknown",
      accountType: null,
      accountPlanType: null,
      accountLabel: "unknown",
      checkedAtLabel: null,
      adapterVersionLabel: null,
      sdkPackageVersionLabel: null,
      codexCliVersionLabel: null,
      transportLabel: null,
      liveTurnsState: "unknown",
      manualHandoffState: "unknown",
      reasonLabel: null
    });
  });

  it("formats manual handoff account and runtime fallback evidence", () => {
    expect(codexRuntimeEvidenceView(codexRuntimeStatus())).toMatchObject({
      status: "unavailable",
      statusLabel: "unavailable",
      executionMode: "manual_handoff",
      executionModeLabel: "manual_handoff",
      accountStatus: "authenticated",
      accountType: "chatgpt",
      accountPlanType: "plus",
      accountLabel: "authenticated (chatgpt / plus)",
      checkedAtLabel: "2026-05-23T00:00:00.000Z",
      adapterVersionLabel: CODEX_RUNTIME_ADAPTER_VERSION,
      sdkPackageVersionLabel: CODEX_SDK_PACKAGE_VERSION,
      codexCliVersionLabel: FIXTURE_CODEX_CLI_VERSION,
      transportLabel: CODEX_RUNTIME_TRANSPORT,
      liveTurnsState: "disabled",
      manualHandoffState: "available"
    });
  });

  it("formats live runtime evidence without leaking internal runtime reasons", () => {
    expect(codexRuntimeEvidenceView(codexRuntimeStatus({
      status: "available",
      executionMode: "live",
      liveTurnExecutionEnabled: true,
      reason: "Live Codex SDK turn execution is enabled for preview-only artifacts."
    }), "ko")).toMatchObject({
      statusLabel: "available",
      executionModeLabel: "live",
      liveTurnsState: "enabled",
      manualHandoffState: "available",
      reasonLabel: "Live Codex 질문·리서치 preview 실행이 켜져 있습니다."
    });
  });

  it("formats manual fallback runtime reasons for the user-facing UI", () => {
    expect(codexRuntimeEvidenceView(codexRuntimeStatus({
      reason:
        "Codex CLI login is available, but set SOLO_CODEX_SDK_LIVE_TURNS=1 to enable preview-only live turn execution; manual handoff fallback is required until then."
    }), "ko")).toMatchObject({
      reasonLabel:
        "Codex CLI 로그인은 확인됐지만 live preview 실행은 꺼져 있습니다. SOLO_CODEX_SDK_LIVE_TURNS=1로 재시작하거나 수동 handoff를 사용하세요."
    });
  });

  it("keeps runtime reasons localized to the active app language", () => {
    const status = codexRuntimeStatus({
      status: "available",
      executionMode: "live",
      liveTurnExecutionEnabled: true,
      reason: "Live Codex SDK turn execution is enabled for preview-only artifacts."
    });

    expect(codexRuntimeEvidenceView(status, "en").reasonLabel).toBe(
      "Live Codex question and research preview execution is enabled."
    );
    expect(codexRuntimeEvidenceView(status, "ja").reasonLabel).toBe(
      "Live Codex の質問・リサーチ preview 実行が有効です。"
    );
    expect(codexRuntimeEvidenceView(status, "ko").reasonLabel).toBe(
      "Live Codex 질문·리서치 preview 실행이 켜져 있습니다."
    );
  });
});
