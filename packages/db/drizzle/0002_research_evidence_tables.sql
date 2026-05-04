CREATE TABLE `evidence_matrices` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`session_id` text NOT NULL,
	`research_task_id` text NOT NULL,
	`research_result_id` text NOT NULL,
	`synthesis_version` integer NOT NULL,
	`balance_status` text NOT NULL,
	`pro_evidence_json` text NOT NULL,
	`con_evidence_json` text NOT NULL,
	`uncertainties_json` text NOT NULL,
	`additional_questions_json` text NOT NULL,
	`decision_blocked` integer NOT NULL,
	`missing_con_evidence_reason` text,
	`known_risk` text,
	`created_at` text NOT NULL,
	`schema_version` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evidence_matrices_result_version_idx` ON `evidence_matrices` (`research_result_id`,`synthesis_version`);--> statement-breakpoint
CREATE INDEX `evidence_matrices_task_idx` ON `evidence_matrices` (`research_task_id`);--> statement-breakpoint
CREATE TABLE `research_results` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`session_id` text NOT NULL,
	`research_task_id` text NOT NULL,
	`source_title` text,
	`source_url` text,
	`result_summary` text NOT NULL,
	`limitation_notes` text,
	`imported_at` text NOT NULL,
	`schema_version` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `research_results_task_idx` ON `research_results` (`research_task_id`);--> statement-breakpoint
CREATE INDEX `research_results_session_idx` ON `research_results` (`session_id`);--> statement-breakpoint
CREATE TABLE `research_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`session_id` text NOT NULL,
	`source_queue_item_id` text,
	`source_answer_ref` text,
	`objective` text NOT NULL,
	`route_outcome` text NOT NULL,
	`impact` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`schema_version` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `research_tasks_session_status_idx` ON `research_tasks` (`session_id`,`status`);--> statement-breakpoint
CREATE INDEX `research_tasks_source_queue_item_idx` ON `research_tasks` (`source_queue_item_id`);
