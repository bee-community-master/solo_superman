import type { CommandId, EventId, ProjectId, SchemaVersion, SessionId, StateVersion } from "../ids";
import type { CommandType } from "./commands";

export type ProductEngineEventType =
  | "project.started"
  | "intake.captured"
  | "spec.drafted"
  | "queue.updated"
  | "research.updated"
  | "runtime.updated"
  | "decision.resolved"
  | "completion.scored"
  | "founder_brief.prepared"
  | "system.scaffold_placeholder";

export interface ProductEngineEventDraft {
  readonly eventType: ProductEngineEventType;
  readonly commandId: CommandId;
  readonly commandType: CommandType;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly schemaVersion: SchemaVersion;
}

export interface ProductEngineEvent extends ProductEngineEventDraft {
  readonly eventId: EventId;
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
  readonly stateVersionAfter: StateVersion;
  readonly occurredAt: string;
}
