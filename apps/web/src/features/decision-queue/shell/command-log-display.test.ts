import { describe, expect, it } from "vitest";
import type { CommandId, CorrelationId, StateVersion, StatusEndpointDto } from "@solo-superman/contracts";
import type { CommandLogEntry } from "./decision-queue-shell-model";
import { DECISION_QUEUE_COPY } from "./decision-queue-copy";
import { userFacingCommandLogStatus } from "./command-log-display";

function status(commandId: string, commandStatus: StatusEndpointDto["commandStatus"]): StatusEndpointDto {
  return {
    commandId: commandId as CommandId,
    category: "accepted",
    commandStatus,
    eventIds: [],
    effects: [],
    pendingEffectSummary: {
      totalPending: 0,
      byType: {},
      visibleLabel: "No pending effects."
    },
    projectionHints: [],
    lastUpdatedAt: "2026-06-15T00:00:00.000Z"
  };
}

describe("userFacingCommandLogStatus", () => {
  it("maps internal command states to user-facing recent activity labels", () => {
    const copy = DECISION_QUEUE_COPY.ko.rightRail;

    const pendingEntry = {
      id: "cmd_pending",
      label: "답변 저장",
      createdAt: "2026-06-15T00:00:00.000Z",
      status: status("cmd_pending", "pending")
    } satisfies CommandLogEntry;
    const blockedEntry = {
      id: "cmd_blocked",
      label: "리서치 시작",
      createdAt: "2026-06-15T00:00:00.000Z",
      status: status("cmd_blocked", "blocked")
    } satisfies CommandLogEntry;
    const acceptedEntry = {
      id: "cmd_accepted",
      label: "기획 반영",
      createdAt: "2026-06-15T00:00:00.000Z",
      response: {
        category: "accepted_with_projection",
        commandId: "cmd_accepted" as CommandId,
        correlationId: "corr_accepted" as CorrelationId,
        stateVersionBefore: 1 as StateVersion,
        stateVersionAfter: 2 as StateVersion
      }
    } satisfies CommandLogEntry;

    expect(userFacingCommandLogStatus(pendingEntry, copy)).toBe("저장 또는 확인 중");
    expect(userFacingCommandLogStatus(blockedEntry, copy)).toBe("확인이 필요함");
    expect(userFacingCommandLogStatus(acceptedEntry, copy)).toBe("기획에 반영됨");
  });

  it("keeps recent activity failure labels actionable without exposing raw status words", () => {
    const label = userFacingCommandLogStatus({
      id: "cmd_failed",
      label: "리서치 시작",
      createdAt: "2026-06-15T00:00:00.000Z",
      error: "timeout"
    }, DECISION_QUEUE_COPY.ko.rightRail);

    expect(label).toBe("작업 실패: timeout");
    expect(label).not.toContain("pending");
    expect(label).not.toContain("blocked");
    expect(label).not.toContain("accepted_with_projection");
  });
});
