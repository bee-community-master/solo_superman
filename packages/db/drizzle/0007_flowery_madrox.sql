CREATE TABLE `decision_evidence_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`session_id` text NOT NULL,
	`research_task_id` text NOT NULL,
	`research_result_id` text NOT NULL,
	`research_run_id` text,
	`claim` text NOT NULL,
	`decision_context` text NOT NULL,
	`spec_section_ref` text,
	`question_ref` text,
	`source_title` text,
	`source_url` text,
	`source_reliability` text NOT NULL,
	`source_published_at` text,
	`retrieved_at` text NOT NULL,
	`gate_status` text NOT NULL,
	`gate_checks_json` text NOT NULL,
	`pro_evidence_item_ids_json` text NOT NULL,
	`con_evidence_item_ids_json` text NOT NULL,
	`uncertainty_item_ids_json` text NOT NULL,
	`limitation_refs_json` text NOT NULL,
	`implication_scope` text NOT NULL,
	`known_risk` text,
	`next_validation_action` text,
	`created_at` text NOT NULL,
	`schema_version` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `decision_evidence_packs_result_idx` ON `decision_evidence_packs` (`research_result_id`,`id`);--> statement-breakpoint
CREATE INDEX `decision_evidence_packs_task_idx` ON `decision_evidence_packs` (`research_task_id`);--> statement-breakpoint
CREATE INDEX `decision_evidence_packs_session_idx` ON `decision_evidence_packs` (`session_id`);--> statement-breakpoint
CREATE INDEX `decision_evidence_packs_run_idx` ON `decision_evidence_packs` (`research_run_id`);--> statement-breakpoint
ALTER TABLE `research_runs` ADD `quality_gate_review_reason` text;--> statement-breakpoint
ALTER TABLE `research_results` ADD `research_run_id` text;--> statement-breakpoint
ALTER TABLE `research_results` ADD `source_reliability` text;--> statement-breakpoint
ALTER TABLE `research_results` ADD `source_published_at` text;--> statement-breakpoint
ALTER TABLE `research_results` ADD `source_retrieved_at` text;--> statement-breakpoint
ALTER TABLE `research_results` ADD `claim` text;--> statement-breakpoint
ALTER TABLE `research_results` ADD `decision_context` text;--> statement-breakpoint
ALTER TABLE `research_results` ADD `spec_section_ref` text;--> statement-breakpoint
ALTER TABLE `research_results` ADD `question_ref` text;--> statement-breakpoint
ALTER TABLE `research_results` ADD `implication_scope` text;--> statement-breakpoint
ALTER TABLE `research_results` ADD `stale_sensitive` integer;--> statement-breakpoint
ALTER TABLE `research_results` ADD `source_required_after` text;--> statement-breakpoint
CREATE INDEX `research_results_run_idx` ON `research_results` (`research_run_id`);
