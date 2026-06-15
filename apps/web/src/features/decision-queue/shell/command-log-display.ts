import type { CommandLogEntry } from "./decision-queue-shell-model";

export interface CommandLogDisplayCopy {
  readonly pending: string;
  readonly activityInProgress: string;
  readonly activityReflected: string;
  readonly activityNeedsAction: string;
  readonly activityFailed: (error: string) => string;
}

export function userFacingCommandLogStatus(entry: CommandLogEntry, copy: CommandLogDisplayCopy) {
  if (entry.error) {
    return copy.activityFailed(entry.error);
  }

  switch (entry.status?.commandStatus) {
    case "pending":
    case "partially_complete":
      return copy.activityInProgress;
    case "blocked":
    case "failed":
      return copy.activityNeedsAction;
    case "complete":
      return copy.activityReflected;
    default:
      break;
  }

  if (entry.response?.category?.startsWith("accepted")) {
    return copy.activityReflected;
  }

  return entry.message ?? copy.pending;
}
