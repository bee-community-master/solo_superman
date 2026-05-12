import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
    researchRunId: text("research_run_id"),
    sourceTitle: text("source_title"),
    sourceUrl: text("source_url"),
    sourceReliability: text("source_reliability"),
    sourcePublishedAt: text("source_published_at"),
    sourceRetrievedAt: text("source_retrieved_at"),
    resultSummary: text("result_summary").notNull(),
    limitationNotes: text("limitation_notes"),
    claim: text("claim"),
    decisionContext: text("decision_context"),
    specSectionRef: text("spec_section_ref"),
    questionRef: text("question_ref"),
    implicationScope: text("implication_scope"),
    staleSensitive: integer("stale_sensitive", { mode: "boolean" }),
    sourceRequiredAfter: text("source_required_after"),
    importedAt: text("imported_at").notNull(),
    schemaVersion: text("schema_version").notNull()
  },
  (table) => [
    index("research_results_task_idx").on(table.researchTaskId),
    index("research_results_session_idx").on(table.sessionId),
    index("research_results_run_idx").on(table.researchRunId)
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

export const decisionEvidencePacks = sqliteTable(
  "decision_evidence_packs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    sessionId: text("session_id").notNull(),
    researchTaskId: text("research_task_id").notNull(),
    researchResultId: text("research_result_id").notNull(),
    researchRunId: text("research_run_id"),
    claim: text("claim").notNull(),
    decisionContext: text("decision_context").notNull(),
    specSectionRef: text("spec_section_ref"),
    questionRef: text("question_ref"),
    sourceTitle: text("source_title"),
    sourceUrl: text("source_url"),
    sourceReliability: text("source_reliability").notNull(),
    sourcePublishedAt: text("source_published_at"),
    retrievedAt: text("retrieved_at").notNull(),
    gateStatus: text("gate_status").notNull(),
    gateChecksJson: text("gate_checks_json").notNull(),
    proEvidenceItemIdsJson: text("pro_evidence_item_ids_json").notNull(),
    conEvidenceItemIdsJson: text("con_evidence_item_ids_json").notNull(),
    uncertaintyItemIdsJson: text("uncertainty_item_ids_json").notNull(),
    limitationRefsJson: text("limitation_refs_json").notNull(),
    implicationScope: text("implication_scope").notNull(),
    knownRisk: text("known_risk"),
    nextValidationAction: text("next_validation_action"),
    createdAt: text("created_at").notNull(),
    schemaVersion: text("schema_version").notNull()
  },
  (table) => [
    uniqueIndex("decision_evidence_packs_result_idx").on(table.researchResultId, table.id),
    index("decision_evidence_packs_task_idx").on(table.researchTaskId),
    index("decision_evidence_packs_session_idx").on(table.sessionId),
    index("decision_evidence_packs_run_idx").on(table.researchRunId)
  ]
);

export const researchAllowlists = sqliteTable(
  "research_allowlists",
  {
    id: text("id").notNull(),
    version: integer("version").notNull(),
    projectId: text("project_id").notNull(),
    status: text("status").notNull(),
    connectorIdsJson: text("connector_ids_json").notNull(),
    sourceCategoriesJson: text("source_categories_json").notNull(),
    contextMode: text("context_mode").notNull(),
    rateBudgetPolicyJson: text("rate_budget_policy_json").notNull(),
    stalenessPolicyJson: text("staleness_policy_json").notNull(),
    disclosureLogPolicyJson: text("disclosure_log_policy_json").notNull(),
    approvedBy: text("approved_by").notNull(),
    approvedAt: text("approved_at").notNull(),
    pausedAt: text("paused_at"),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    schemaVersion: text("schema_version").notNull()
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.id] }),
    index("research_allowlists_project_status_idx").on(table.projectId, table.status),
    index("research_allowlists_updated_at_idx").on(table.updatedAt)
  ]
);

export const researchRuns = sqliteTable(
  "research_runs",
  {
    id: text("id").primaryKey(),
    version: integer("version").notNull(),
    projectId: text("project_id").notNull(),
    researchTaskId: text("research_task_id").notNull(),
    allowlistId: text("allowlist_id").notNull(),
    disclosureLogId: text("disclosure_log_id").notNull(),
    connectorId: text("connector_id").notNull(),
    sourceCategory: text("source_category").notNull(),
    status: text("status").notNull(),
    adapterKind: text("adapter_kind").notNull(),
    adapterVersion: text("adapter_version").notNull(),
    providerRunId: text("provider_run_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    attempt: integer("attempt").notNull(),
    qualityGateStatus: text("quality_gate_status").notNull(),
    qualityGateReviewReason: text("quality_gate_review_reason"),
    terminalReason: text("terminal_reason"),
    retryOfRunId: text("retry_of_run_id"),
    retryReason: text("retry_reason"),
    sourceRefsJson: text("source_refs_json").notNull(),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    schemaVersion: text("schema_version").notNull()
  },
  (table) => [
    uniqueIndex("research_runs_project_idempotency_key_idx").on(table.projectId, table.idempotencyKey),
    index("research_runs_project_status_idx").on(table.projectId, table.status),
    index("research_runs_task_idx").on(table.researchTaskId),
    index("research_runs_allowlist_idx").on(table.projectId, table.allowlistId),
    index("research_runs_disclosure_idx").on(table.disclosureLogId)
  ]
);

export const researchDisclosureLogs = sqliteTable(
  "research_disclosure_logs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    allowlistId: text("allowlist_id"),
    connectorId: text("connector_id").notNull(),
    sourceCategory: text("source_category").notNull(),
    researchObjective: text("research_objective").notNull(),
    objectiveSummary: text("objective_summary").notNull(),
    publicSafeSummarySent: text("public_safe_summary_sent").notNull(),
    sourceRefsJson: text("source_refs_json").notNull(),
    automaticExternalTransferAllowed: integer("automatic_external_transfer_allowed", { mode: "boolean" }).notNull(),
    status: text("status").notNull(),
    blockReason: text("block_reason"),
    manualHandoffReason: text("manual_handoff_reason"),
    createdAt: text("created_at").notNull(),
    schemaVersion: text("schema_version").notNull()
  },
  (table) => [
    index("research_disclosure_logs_project_created_idx").on(table.projectId, table.createdAt),
    index("research_disclosure_logs_allowlist_idx").on(table.projectId, table.allowlistId),
    index("research_disclosure_logs_status_idx").on(table.projectId, table.status)
  ]
);

export const runtimePreviewArtifacts = sqliteTable(
  "runtime_preview_artifacts",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    sessionId: text("session_id").notNull(),
    sourceEffectTaskId: text("source_effect_task_id"),
    turnPurpose: text("turn_purpose").notNull(),
    artifactKind: text("artifact_kind").notNull(),
    applyPolicy: text("apply_policy").notNull(),
    status: text("status").notNull(),
    source: text("source").notNull(),
    targetObject: text("target_object").notNull(),
    contextHash: text("context_hash").notNull(),
    runtimeAdapterVersion: text("runtime_adapter_version").notNull(),
    summary: text("summary").notNull(),
    payloadJson: text("payload_json").notNull(),
    sourceRefsJson: text("source_refs_json").notNull(),
    blockedActionType: text("blocked_action_type"),
    blockReason: text("block_reason"),
    suggestedSafeAlternative: text("suggested_safe_alternative"),
    createdAt: text("created_at").notNull(),
    schemaVersion: text("schema_version").notNull()
  },
  (table) => [
    uniqueIndex("runtime_artifacts_context_idx").on(
      table.sessionId,
      table.turnPurpose,
      table.contextHash,
      table.runtimeAdapterVersion
    ),
    index("runtime_artifacts_session_idx").on(table.sessionId),
    index("runtime_artifacts_source_effect_idx").on(table.sourceEffectTaskId)
  ]
);

export const phase15bUpgradeHints = sqliteTable(
  "phase15b_upgrade_hints",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    sessionId: text("session_id").notNull(),
    artifactId: text("artifact_id").notNull(),
    artifactKind: text("artifact_kind").notNull(),
    blockedActionType: text("blocked_action_type").notNull(),
    riskLevel: text("risk_level").notNull(),
    hintsJson: text("hints_json").notNull(),
    createdAt: text("created_at").notNull(),
    schemaVersion: text("schema_version").notNull()
  },
  (table) => [
    uniqueIndex("phase15b_upgrade_hints_artifact_idx").on(table.artifactId),
    index("phase15b_upgrade_hints_session_idx").on(table.sessionId),
    index("phase15b_upgrade_hints_risk_idx").on(table.projectId, table.riskLevel)
  ]
);

export const planningHandoffs = sqliteTable(
  "planning_handoffs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    sessionId: text("session_id").notNull(),
    sourceCommandId: text("source_command_id").notNull(),
    sourceEventId: text("source_event_id").notNull(),
    artifactKind: text("artifact_kind").notNull(),
    status: text("status").notNull(),
    gateVerdict: text("gate_verdict").notNull(),
    sourceStateVersion: integer("source_state_version").notNull(),
    summary: text("summary").notNull(),
    artifactJson: text("artifact_json").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    schemaVersion: text("schema_version").notNull()
  },
  (table) => [
    index("planning_handoffs_session_created_idx").on(table.sessionId, table.createdAt),
    uniqueIndex("planning_handoffs_source_command_idx").on(table.sourceCommandId),
    index("planning_handoffs_session_verdict_idx").on(table.sessionId, table.gateVerdict)
  ]
);

export const planningHandoffSources = sqliteTable(
  "planning_handoff_sources",
  {
    id: text("id").primaryKey(),
    handoffId: text("handoff_id").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    sourceLabel: text("source_label"),
    required: integer("required", { mode: "boolean" }).notNull(),
    stale: integer("stale", { mode: "boolean" }).notNull(),
    createdAt: text("created_at").notNull()
  },
  (table) => [
    index("planning_handoff_sources_handoff_idx").on(table.handoffId),
    index("planning_handoff_sources_source_idx").on(table.sourceType, table.sourceId)
  ]
);

export const planningHandoffTasks = sqliteTable(
  "planning_handoff_tasks",
  {
    id: text("id").primaryKey(),
    handoffId: text("handoff_id").notNull(),
    sequenceOrder: integer("sequence_order").notNull(),
    title: text("title").notNull(),
    intent: text("intent").notNull(),
    ownerRole: text("owner_role").notNull(),
    sourceRefsJson: text("source_refs_json").notNull(),
    dependsOnJson: text("depends_on_json").notNull(),
    acceptanceEvidenceJson: text("acceptance_evidence_json").notNull(),
    nonGoalsJson: text("non_goals_json").notNull(),
    riskRefsJson: text("risk_refs_json").notNull()
  },
  (table) => [index("planning_handoff_tasks_handoff_order_idx").on(table.handoffId, table.sequenceOrder)]
);

export const planningHandoffPrIssueItems = sqliteTable(
  "planning_handoff_pr_issue_items",
  {
    id: text("id").primaryKey(),
    handoffId: text("handoff_id").notNull(),
    sequenceOrder: integer("sequence_order").notNull(),
    summary: text("summary").notNull(),
    includedTaskIdsJson: text("included_task_ids_json").notNull(),
    entryPrerequisitesJson: text("entry_prerequisites_json").notNull(),
    exitEvidenceJson: text("exit_evidence_json").notNull(),
    blockedByJson: text("blocked_by_json").notNull(),
    phaseBoundary: text("phase_boundary").notNull()
  },
  (table) => [
    index("planning_handoff_pr_issue_items_handoff_order_idx").on(table.handoffId, table.sequenceOrder)
  ]
);

export const planningHandoffRisks = sqliteTable(
  "planning_handoff_risks",
  {
    id: text("id").primaryKey(),
    handoffId: text("handoff_id").notNull(),
    riskKind: text("risk_kind").notNull(),
    riskClass: text("risk_class").notNull(),
    severity: text("severity").notNull(),
    title: text("title").notNull(),
    sourceRefsJson: text("source_refs_json").notNull(),
    ownerRole: text("owner_role").notNull(),
    followUpTrigger: text("follow_up_trigger").notNull(),
    requiredAction: text("required_action")
  },
  (table) => [
    index("planning_handoff_risks_handoff_idx").on(table.handoffId),
    index("planning_handoff_risks_class_idx").on(table.riskClass, table.severity)
  ]
);

export const phase25ResearchComparisons = sqliteTable(
  "phase25_research_comparisons",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    sessionId: text("session_id").notNull(),
    sourceCommandId: text("source_command_id").notNull(),
    sourceEventId: text("source_event_id").notNull(),
    status: text("status").notNull(),
    gateVerdict: text("gate_verdict").notNull(),
    candidateLane: text("candidate_lane").notNull(),
    qualityLiftClaimed: integer("quality_lift_claimed", { mode: "boolean" }).notNull(),
    sourceStateVersion: integer("source_state_version").notNull(),
    summary: text("summary").notNull(),
    artifactJson: text("artifact_json").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    schemaVersion: text("schema_version").notNull()
  },
  (table) => [
    index("phase25_research_comparisons_session_created_idx").on(table.sessionId, table.createdAt),
    uniqueIndex("phase25_research_comparisons_source_command_idx").on(table.sourceCommandId),
    index("phase25_research_comparisons_session_verdict_idx").on(table.sessionId, table.gateVerdict)
  ]
);

export const phase25ResearchComparisonSources = sqliteTable(
  "phase25_research_comparison_sources",
  {
    id: text("id").primaryKey(),
    comparisonId: text("comparison_id").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    sourceLabel: text("source_label"),
    required: integer("required", { mode: "boolean" }).notNull(),
    stale: integer("stale", { mode: "boolean" }).notNull(),
    createdAt: text("created_at").notNull()
  },
  (table) => [
    index("phase25_research_comparison_sources_comparison_idx").on(table.comparisonId),
    index("phase25_research_comparison_sources_source_idx").on(table.sourceType, table.sourceId)
  ]
);

export const runtimeTaskRefs = sqliteTable(
  "runtime_task_refs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    sessionId: text("session_id").notNull(),
    effectTaskId: text("effect_task_id").notNull(),
    artifactId: text("artifact_id").notNull(),
    runtimeAdapterVersion: text("runtime_adapter_version").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    schemaVersion: text("schema_version").notNull()
  },
  (table) => [
    uniqueIndex("runtime_task_refs_effect_artifact_idx").on(table.effectTaskId, table.artifactId),
    index("runtime_task_refs_session_idx").on(table.sessionId)
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
