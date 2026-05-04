CREATE TABLE `projections` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`session_id` text NOT NULL,
	`projection_kind` text NOT NULL,
	`version` integer NOT NULL,
	`payload_json` text NOT NULL,
	`updated_at` text NOT NULL,
	`schema_version` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projections_session_kind_idx` ON `projections` (`session_id`,`projection_kind`);--> statement-breakpoint
CREATE INDEX `projections_project_id_idx` ON `projections` (`project_id`);