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

  it("formats live runtime evidence without hiding runtime reasons", () => {
    expect(codexRuntimeEvidenceView(codexRuntimeStatus({
      status: "available",
      executionMode: "live",
      liveTurnExecutionEnabled: true,
      reason: "Live Codex SDK turn execution is enabled for preview-only artifacts."
    }))).toMatchObject({
      statusLabel: "available",
      executionModeLabel: "live",
      liveTurnsState: "enabled",
      manualHandoffState: "available",
      reasonLabel: "Live Codex SDK turn execution is enabled for preview-only artifacts."
    });
  });
});
