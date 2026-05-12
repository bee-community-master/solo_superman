CREATE TABLE `bounded_agent_output_records` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`session_id` text NOT NULL,
	`authority_record_id` text NOT NULL,
	`source_refs_json` text NOT NULL,
	`intended_decision_impact` text NOT NULL,
	`proposed_action_preview_refs_json` text NOT NULL,
	`required_approvals_json` text NOT NULL,
	`evidence_refs_json` text NOT NULL,
	`failure_mode` text NOT NULL,
	`no_execution_policy` text NOT NULL,
	`created_at` text NOT NULL,
	`schema_version` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bounded_agent_output_records_session_idx` ON `bounded_agent_output_records` (`session_id`);--> statement-breakpoint
CREATE INDEX `bounded_agent_output_records_authority_idx` ON `bounded_agent_output_records` (`authority_record_id`);--> statement-breakpoint
CREATE INDEX `bounded_agent_output_records_failure_mode_idx` ON `bounded_agent_output_records` (`failure_mode`);--> statement-breakpoint
CREATE TABLE `execution_authority_records` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`session_id` text NOT NULL,
	`source_command_id` text NOT NULL,
	`source_event_id` text NOT NULL,
	`source_state_version` integer NOT NULL,
	`source_planning_handoff_ref` text NOT NULL,
	`bounded_agent_output_id` text NOT NULL,
	`action_class` text NOT NULL,
	`approval_decision` text NOT NULL,
	`execution_result` text NOT NULL,
	`preview_artifact_ref` text,
	`preview_artifact_hash` text,
	`reviewed_preview_artifact_hash` text,
	`requested_scope_json` text NOT NULL,
	`approver_json` text,
	`sandbox_boundary_json` text NOT NULL,
	`rollback_reference_json` text,
	`block_reasons_json` text NOT NULL,
	`evidence_refs_json` text NOT NULL,
	`audit_refs_json` text NOT NULL,
	`created_at` text NOT NULL,
	`schema_version` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `execution_authority_records_session_created_idx` ON `execution_authority_records` (`session_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `execution_authority_records_source_command_idx` ON `execution_authority_records` (`source_command_id`);--> statement-breakpoint
CREATE INDEX `execution_authority_records_session_result_idx` ON `execution_authority_records` (`session_id`,`execution_result`);--> statement-breakpoint
CREATE INDEX `execution_authority_records_bounded_output_idx` ON `execution_authority_records` (`bounded_agent_output_id`);