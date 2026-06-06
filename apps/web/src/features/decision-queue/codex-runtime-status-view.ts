import type { CodexRuntimeStatusDto } from "@solo-superman/contracts";

export type CodexRuntimeStatusState = CodexRuntimeStatusDto["status"] | "unknown";
export type CodexRuntimeExecutionModeState = CodexRuntimeStatusDto["executionMode"] | "unknown";
export type CodexRuntimeAccountStatusState = CodexRuntimeStatusDto["account"]["status"] | "unknown";
export type CodexRuntimeAvailabilityState = "available" | "unavailable" | "unknown";
export type CodexRuntimeLiveTurnState = "enabled" | "disabled" | "unknown";

export interface CodexRuntimeEvidenceView {
  readonly status: CodexRuntimeStatusState;
  readonly statusLabel: string;
  readonly executionMode: CodexRuntimeExecutionModeState;
  readonly executionModeLabel: string;
  readonly accountStatus: CodexRuntimeAccountStatusState;
  readonly accountType: CodexRuntimeStatusDto["account"]["accountType"] | null;
  readonly accountPlanType: string | null;
  readonly accountLabel: string;
  readonly checkedAtLabel: string | null;
  readonly adapterVersionLabel: string | null;
  readonly sdkPackageVersionLabel: string | null;
  readonly codexCliVersionLabel: string | null;
  readonly transportLabel: string | null;
  readonly liveTurnsState: CodexRuntimeLiveTurnState;
  readonly manualHandoffState: CodexRuntimeAvailabilityState;
  readonly reasonLabel: string | null;
}

export function codexRuntimeAccountLabel(runtimeStatus: CodexRuntimeStatusDto | null) {
  if (!runtimeStatus) {
    return "unknown";
  }

  const account = runtimeStatus.account;
  const details = [account.accountType, account.planType].filter(Boolean).join(" / ");

  return details ? `${account.status} (${details})` : account.status;
}

export function userFacingCodexRuntimeReason(reason: string | null | undefined) {
  if (!reason) {
    return null;
  }

  if (reason === "Live Codex SDK turn execution is enabled for preview-only artifacts.") {
    return "Live Codex 질문·리서치 preview 실행이 켜져 있습니다.";
  }

  if (
    reason ===
    "Codex CLI login is available, but set SOLO_CODEX_SDK_LIVE_TURNS=1 to enable preview-only live turn execution; manual handoff fallback is required until then."
  ) {
    return "Codex CLI 로그인은 확인됐지만 live preview 실행은 꺼져 있습니다. SOLO_CODEX_SDK_LIVE_TURNS=1로 재시작하거나 수동 handoff를 사용하세요.";
  }

  if (reason.startsWith("Live Codex SDK turn execution is not enabled")) {
    return "Live Codex preview 실행이 아직 켜져 있지 않습니다. 수동 handoff로 진행하거나 SOLO_CODEX_SDK_LIVE_TURNS=1로 재시작하세요.";
  }

  return reason;
}

export function codexRuntimeEvidenceView(runtimeStatus: CodexRuntimeStatusDto | null): CodexRuntimeEvidenceView {
  const account = runtimeStatus?.account ?? null;

  return {
    status: runtimeStatus?.status ?? "unknown",
    statusLabel: runtimeStatus?.status ?? "unknown",
    executionMode: runtimeStatus?.executionMode ?? "unknown",
    executionModeLabel: runtimeStatus?.executionMode ?? "unknown",
    accountStatus: account?.status ?? "unknown",
    accountType: account?.accountType ?? null,
    accountPlanType: account?.planType ?? null,
    accountLabel: codexRuntimeAccountLabel(runtimeStatus),
    checkedAtLabel: runtimeStatus?.checkedAt ?? null,
    adapterVersionLabel: runtimeStatus?.adapterVersion ?? null,
    sdkPackageVersionLabel: runtimeStatus?.sdkPackageVersion ?? null,
    codexCliVersionLabel: runtimeStatus?.codexCliVersion ?? null,
    transportLabel: runtimeStatus?.transport ?? null,
    liveTurnsState: runtimeStatus ? (runtimeStatus.liveTurnExecutionEnabled ? "enabled" : "disabled") : "unknown",
    manualHandoffState: runtimeStatus
      ? (runtimeStatus.manualHandoffAvailable ? "available" : "unavailable")
      : "unknown",
    reasonLabel: userFacingCodexRuntimeReason(runtimeStatus?.reason ?? runtimeStatus?.account.reason ?? null)
  };
}
