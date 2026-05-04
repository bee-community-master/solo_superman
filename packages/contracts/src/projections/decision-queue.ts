import type { ProjectionVersion, QueueItemId } from "../ids";

export interface QueueItemProjection {
  readonly queueItemId: QueueItemId;
  readonly title: string;
  readonly state: "active" | "next" | "blocked" | "deferred" | "answered" | "resolved";
}

export interface DecisionQueueProjection {
  readonly kind: "DecisionQueueProjection";
  readonly version: ProjectionVersion;
  readonly active: readonly QueueItemProjection[];
  readonly next: readonly QueueItemProjection[];
  readonly blocked: readonly QueueItemProjection[];
  readonly deferred: readonly QueueItemProjection[];
}
