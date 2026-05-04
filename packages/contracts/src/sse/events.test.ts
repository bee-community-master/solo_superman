import { describe, expect, it } from "vitest";
import type { SseEventName } from "./events";

describe("SSE contract placeholders", () => {
  it("keeps the docs/25 closed event names visible", () => {
    const eventNames = [
      "command.accepted",
      "command.rejected",
      "effect.queued",
      "effect.started",
      "effect.succeeded",
      "effect.failed",
      "effect.blocked",
      "projection.updated",
      "runtime.status.changed"
    ] as const satisfies readonly SseEventName[];

    expect(eventNames).toHaveLength(9);
  });
});
