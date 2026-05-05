CREATE TABLE `research_disclosure_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`allowlist_id` text,
	`connector_id` text NOT NULL,
	`source_category` text NOT NULL,
	`research_objective` text NOT NULL,
	`objective_summary` text NOT NULL,
	`public_safe_summary_sent` text NOT NULL,
	`source_refs_json` text NOT NULL,
	`automatic_external_transfer_allowed` integer NOT NULL,
	`status` text NOT NULL,
	`block_reason` text,
	`manual_handoff_reason` text,
	`created_at` text NOT NULL,
	`schema_version` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `research_disclosure_logs_project_created_idx` ON `research_disclosure_logs` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `research_disclosure_logs_allowlist_idx` ON `research_disclosure_logs` (`project_id`,`allowlist_id`);--> statement-breakpoint
CREATE INDEX `research_disclosure_logs_status_idx` ON `research_disclosure_logs` (`project_id`,`status`);