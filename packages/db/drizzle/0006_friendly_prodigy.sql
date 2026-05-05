CREATE TABLE `research_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`project_id` text NOT NULL,
	`research_task_id` text NOT NULL,
	`allowlist_id` text NOT NULL,
	`disclosure_log_id` text NOT NULL,
	`connector_id` text NOT NULL,
	`source_category` text NOT NULL,
	`status` text NOT NULL,
	`adapter_kind` text NOT NULL,
	`adapter_version` text NOT NULL,
	`provider_run_id` text,
	`idempotency_key` text NOT NULL,
	`attempt` integer NOT NULL,
	`quality_gate_status` text NOT NULL,
	`terminal_reason` text,
	`retry_of_run_id` text,
	`retry_reason` text,
	`source_refs_json` text NOT NULL,
	`started_at` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`schema_version` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `research_runs_project_idempotency_key_idx` ON `research_runs` (`project_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `research_runs_project_status_idx` ON `research_runs` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `research_runs_task_idx` ON `research_runs` (`research_task_id`);--> statement-breakpoint
CREATE INDEX `research_runs_allowlist_idx` ON `research_runs` (`project_id`,`allowlist_id`);--> statement-breakpoint
CREATE INDEX `research_runs_disclosure_idx` ON `research_runs` (`disclosure_log_id`);