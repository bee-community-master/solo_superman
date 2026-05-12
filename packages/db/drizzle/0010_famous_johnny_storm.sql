CREATE TABLE `phase25_research_comparison_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`comparison_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`source_label` text,
	`required` integer NOT NULL,
	`stale` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `phase25_research_comparison_sources_comparison_idx` ON `phase25_research_comparison_sources` (`comparison_id`);--> statement-breakpoint
CREATE INDEX `phase25_research_comparison_sources_source_idx` ON `phase25_research_comparison_sources` (`source_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `phase25_research_comparisons` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`session_id` text NOT NULL,
	`source_command_id` text NOT NULL,
	`source_event_id` text NOT NULL,
	`status` text NOT NULL,
	`gate_verdict` text NOT NULL,
	`candidate_lane` text NOT NULL,
	`quality_lift_claimed` integer NOT NULL,
	`source_state_version` integer NOT NULL,
	`summary` text NOT NULL,
	`artifact_json` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`schema_version` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `phase25_research_comparisons_session_created_idx` ON `phase25_research_comparisons` (`session_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `phase25_research_comparisons_source_command_idx` ON `phase25_research_comparisons` (`source_command_id`);--> statement-breakpoint
CREATE INDEX `phase25_research_comparisons_session_verdict_idx` ON `phase25_research_comparisons` (`session_id`,`gate_verdict`);