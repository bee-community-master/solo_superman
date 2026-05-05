import { describe, expect, it } from "vitest";
import type { ProjectionVersion } from "../ids";
import type { ProjectionUpdatedSseEvent, SseEventName } from "./events";

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

  it("allows ResearchRunProjection refetch hints for missed run-control updates", () => {
    const event = {
      event: "projection.updated",
      emittedAt: "2026-05-06T00:00:00.000Z",
      projectionKind: "ResearchRunProjection",
      version: 2 as ProjectionVersion,
      affectedIds: ["research_run_sse"],
      refetchUrl: "/api/v1/projects/proj_sse/research-runs/research_run_sse/status"
    } as const satisfies ProjectionUpdatedSseEvent;

    expect(event).toMatchObject({
      event: "projection.updated",
      projectionKind: "ResearchRunProjection",
      refetchUrl: "/api/v1/projects/proj_sse/research-runs/research_run_sse/status"
    });
  });
});
