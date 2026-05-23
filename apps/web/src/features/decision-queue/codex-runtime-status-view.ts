import type { CodexRuntimeStatusDto } from "@solo-superman/contracts";

export type CodexRuntimeAvailabilityState = "available" | "unavailable" | "unknown";
export type CodexRuntimeLiveTurnState = "enabled" | "disabled" | "unknown";

export interface CodexRuntimeEvidenceView {
  readonly statusLabel: string;
  readonly executionModeLabel: string;
  readonly accountLabel: string;
  readonly checkedAtLabel: string | null;
  readonly adapterVersionLabel: string | null;
  readonly generatedSchemaVersionLabel: string | null;
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
  return {
    statusLabel: runtimeStatus?.status ?? "unknown",
    executionModeLabel: runtimeStatus?.executionMode ?? "unknown",
    accountLabel: codexRuntimeAccountLabel(runtimeStatus),
    checkedAtLabel: runtimeStatus?.checkedAt ?? null,
    adapterVersionLabel: runtimeStatus?.adapterVersion ?? null,
    generatedSchemaVersionLabel: runtimeStatus?.generatedSchemaVersion ?? null,
    transportLabel: runtimeStatus?.transport ?? null,
    liveTurnsState: runtimeStatus ? (runtimeStatus.liveTurnExecutionEnabled ? "enabled" : "disabled") : "unknown",
    manualHandoffState: runtimeStatus
      ? (runtimeStatus.manualHandoffAvailable ? "available" : "unavailable")
      : "unknown",
    reasonLabel: runtimeStatus?.reason ?? runtimeStatus?.account.reason ?? null
  };
}
