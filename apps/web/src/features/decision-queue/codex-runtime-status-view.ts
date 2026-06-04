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
    reasonLabel: runtimeStatus?.reason ?? runtimeStatus?.account.reason ?? null
  };
}
