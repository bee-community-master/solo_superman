CREATE TABLE `research_allowlists` (
	`id` text NOT NULL,
	`version` integer NOT NULL,
	`project_id` text NOT NULL,
	`status` text NOT NULL,
	`connector_ids_json` text NOT NULL,
	`source_categories_json` text NOT NULL,
	`context_mode` text NOT NULL,
	`rate_budget_policy_json` text NOT NULL,
	`staleness_policy_json` text NOT NULL,
	`disclosure_log_policy_json` text NOT NULL,
	`approved_by` text NOT NULL,
	`approved_at` text NOT NULL,
	`paused_at` text,
	`revoked_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`schema_version` text NOT NULL,
	PRIMARY KEY(`project_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `research_allowlists_project_status_idx` ON `research_allowlists` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `research_allowlists_updated_at_idx` ON `research_allowlists` (`updated_at`);
