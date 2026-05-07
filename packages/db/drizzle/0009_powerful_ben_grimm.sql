CREATE TABLE `planning_handoff_pr_issue_items` (
	`id` text PRIMARY KEY NOT NULL,
	`handoff_id` text NOT NULL,
	`sequence_order` integer NOT NULL,
	`summary` text NOT NULL,
	`included_task_ids_json` text NOT NULL,
	`entry_prerequisites_json` text NOT NULL,
	`exit_evidence_json` text NOT NULL,
	`blocked_by_json` text NOT NULL,
	`phase_boundary` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `planning_handoff_pr_issue_items_handoff_order_idx` ON `planning_handoff_pr_issue_items` (`handoff_id`,`sequence_order`);--> statement-breakpoint
CREATE TABLE `planning_handoff_risks` (
	`id` text PRIMARY KEY NOT NULL,
	`handoff_id` text NOT NULL,
	`risk_kind` text NOT NULL,
	`risk_class` text NOT NULL,
	`severity` text NOT NULL,
	`title` text NOT NULL,
	`source_refs_json` text NOT NULL,
	`owner_role` text NOT NULL,
	`follow_up_trigger` text NOT NULL,
	`required_action` text
);
--> statement-breakpoint
CREATE INDEX `planning_handoff_risks_handoff_idx` ON `planning_handoff_risks` (`handoff_id`);--> statement-breakpoint
CREATE INDEX `planning_handoff_risks_class_idx` ON `planning_handoff_risks` (`risk_class`,`severity`);--> statement-breakpoint
CREATE TABLE `planning_handoff_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`handoff_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`source_label` text,
	`required` integer NOT NULL,
	`stale` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `planning_handoff_sources_handoff_idx` ON `planning_handoff_sources` (`handoff_id`);--> statement-breakpoint
CREATE INDEX `planning_handoff_sources_source_idx` ON `planning_handoff_sources` (`source_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `planning_handoff_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`handoff_id` text NOT NULL,
	`sequence_order` integer NOT NULL,
	`title` text NOT NULL,
	`intent` text NOT NULL,
	`owner_role` text NOT NULL,
	`source_refs_json` text NOT NULL,
	`depends_on_json` text NOT NULL,
	`acceptance_evidence_json` text NOT NULL,
	`non_goals_json` text NOT NULL,
	`risk_refs_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `planning_handoff_tasks_handoff_order_idx` ON `planning_handoff_tasks` (`handoff_id`,`sequence_order`);--> statement-breakpoint
CREATE TABLE `planning_handoffs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`session_id` text NOT NULL,
	`source_command_id` text NOT NULL,
	`source_event_id` text NOT NULL,
	`artifact_kind` text NOT NULL,
	`status` text NOT NULL,
	`gate_verdict` text NOT NULL,
	`source_state_version` integer NOT NULL,
	`summary` text NOT NULL,
	`artifact_json` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`schema_version` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `planning_handoffs_session_created_idx` ON `planning_handoffs` (`session_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `planning_handoffs_source_command_idx` ON `planning_handoffs` (`source_command_id`);--> statement-breakpoint
CREATE INDEX `planning_handoffs_session_verdict_idx` ON `planning_handoffs` (`session_id`,`gate_verdict`);
