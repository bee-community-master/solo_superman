CREATE TABLE `app_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `effect_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`session_id` text NOT NULL,
	`source_event_id` text NOT NULL,
	`source_event_ids_json` text NOT NULL,
	`source_command_id` text NOT NULL,
	`correlation_id` text NOT NULL,
	`effect_type` text NOT NULL,
	`status` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer NOT NULL,
	`lease_owner` text,
	`lease_expires_at` text,
	`input_json` text NOT NULL,
	`output_json` text,
	`last_error_code` text,
	`last_error_message` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`schema_version` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `effect_tasks_idempotency_key_idx` ON `effect_tasks` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `effect_tasks_session_status_idx` ON `effect_tasks` (`session_id`,`status`);--> statement-breakpoint
CREATE INDEX `effect_tasks_source_event_id_idx` ON `effect_tasks` (`source_event_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence` integer NOT NULL,
	`project_id` text NOT NULL,
	`session_id` text NOT NULL,
	`event_type` text NOT NULL,
	`source_command_id` text NOT NULL,
	`causation_id` text,
	`correlation_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`schema_version` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_session_sequence_idx` ON `events` (`session_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `events_project_id_idx` ON `events` (`project_id`);--> statement-breakpoint
CREATE INDEX `events_correlation_id_idx` ON `events` (`correlation_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`raw_idea_text` text NOT NULL,
	`privacy_mode` text DEFAULT 'local_only' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `secret_refs` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`description` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`status` text NOT NULL,
	`current_phase` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_project_id_idx` ON `sessions` (`project_id`);