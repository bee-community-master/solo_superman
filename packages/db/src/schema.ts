import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  rawIdeaText: text("raw_idea_text").notNull(),
  privacyMode: text("privacy_mode").notNull().default("local_only"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    status: text("status").notNull(),
    currentPhase: text("current_phase").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [index("sessions_project_id_idx").on(table.projectId)]
);

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    sequence: integer("sequence").notNull(),
    projectId: text("project_id").notNull(),
    sessionId: text("session_id").notNull(),
    eventType: text("event_type").notNull(),
    sourceCommandId: text("source_command_id").notNull(),
    causationId: text("causation_id"),
    correlationId: text("correlation_id").notNull(),
    payloadJson: text("payload_json").notNull(),
    schemaVersion: text("schema_version").notNull(),
    createdAt: text("created_at").notNull()
  },
  (table) => [
    uniqueIndex("events_session_sequence_idx").on(table.sessionId, table.sequence),
    index("events_project_id_idx").on(table.projectId),
    index("events_correlation_id_idx").on(table.correlationId)
  ]
);

export const effectTasks = sqliteTable(
  "effect_tasks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    sessionId: text("session_id").notNull(),
    sourceEventId: text("source_event_id").notNull(),
    sourceEventIdsJson: text("source_event_ids_json").notNull(),
    sourceCommandId: text("source_command_id").notNull(),
    correlationId: text("correlation_id").notNull(),
    effectType: text("effect_type").notNull(),
    status: text("status").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull(),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: text("lease_expires_at"),
    inputJson: text("input_json").notNull(),
    outputJson: text("output_json"),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    schemaVersion: text("schema_version").notNull()
  },
  (table) => [
    uniqueIndex("effect_tasks_idempotency_key_idx").on(table.idempotencyKey),
    index("effect_tasks_session_status_idx").on(table.sessionId, table.status),
    index("effect_tasks_source_event_id_idx").on(table.sourceEventId)
  ]
);

export const appConfig = sqliteTable("app_config", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const secretRefs = sqliteTable("secret_refs", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  description: text("description").notNull(),
  createdAt: text("created_at").notNull()
});
