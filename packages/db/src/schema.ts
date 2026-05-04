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

export const projections = sqliteTable(
  "projections",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    sessionId: text("session_id").notNull(),
    projectionKind: text("projection_kind").notNull(),
    version: integer("version").notNull(),
    payloadJson: text("payload_json").notNull(),
    updatedAt: text("updated_at").notNull(),
    schemaVersion: text("schema_version").notNull()
  },
  (table) => [
    uniqueIndex("projections_session_kind_idx").on(table.sessionId, table.projectionKind),
    index("projections_project_id_idx").on(table.projectId)
  ]
);

export const researchTasks = sqliteTable(
  "research_tasks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    sessionId: text("session_id").notNull(),
    sourceQueueItemId: text("source_queue_item_id"),
    sourceAnswerRef: text("source_answer_ref"),
    objective: text("objective").notNull(),
    routeOutcome: text("route_outcome").notNull(),
    impact: text("impact").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    schemaVersion: text("schema_version").notNull()
  },
  (table) => [
    index("research_tasks_session_status_idx").on(table.sessionId, table.status),
    index("research_tasks_source_queue_item_idx").on(table.sourceQueueItemId)
  ]
);

export const researchResults = sqliteTable(
  "research_results",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    sessionId: text("session_id").notNull(),
    researchTaskId: text("research_task_id").notNull(),
    sourceTitle: text("source_title"),
    sourceUrl: text("source_url"),
    resultSummary: text("result_summary").notNull(),
    limitationNotes: text("limitation_notes"),
    importedAt: text("imported_at").notNull(),
    schemaVersion: text("schema_version").notNull()
  },
  (table) => [
    index("research_results_task_idx").on(table.researchTaskId),
    index("research_results_session_idx").on(table.sessionId)
  ]
);

export const evidenceMatrices = sqliteTable(
  "evidence_matrices",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    sessionId: text("session_id").notNull(),
    researchTaskId: text("research_task_id").notNull(),
    researchResultId: text("research_result_id").notNull(),
    synthesisVersion: integer("synthesis_version").notNull(),
    balanceStatus: text("balance_status").notNull(),
    proEvidenceJson: text("pro_evidence_json").notNull(),
    conEvidenceJson: text("con_evidence_json").notNull(),
    uncertaintiesJson: text("uncertainties_json").notNull(),
    additionalQuestionsJson: text("additional_questions_json").notNull(),
    decisionBlocked: integer("decision_blocked", { mode: "boolean" }).notNull(),
    missingConEvidenceReason: text("missing_con_evidence_reason"),
    knownRisk: text("known_risk"),
    createdAt: text("created_at").notNull(),
    schemaVersion: text("schema_version").notNull()
  },
  (table) => [
    uniqueIndex("evidence_matrices_result_version_idx").on(table.researchResultId, table.synthesisVersion),
    index("evidence_matrices_task_idx").on(table.researchTaskId)
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
