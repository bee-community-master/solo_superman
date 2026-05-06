CREATE TABLE `phase15b_upgrade_hints` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`session_id` text NOT NULL,
	`artifact_id` text NOT NULL,
	`artifact_kind` text NOT NULL,
	`blocked_action_type` text NOT NULL,
	`risk_level` text NOT NULL,
	`hints_json` text NOT NULL,
	`created_at` text NOT NULL,
	`schema_version` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `phase15b_upgrade_hints_artifact_idx` ON `phase15b_upgrade_hints` (`artifact_id`);--> statement-breakpoint
CREATE INDEX `phase15b_upgrade_hints_session_idx` ON `phase15b_upgrade_hints` (`session_id`);--> statement-breakpoint
CREATE INDEX `phase15b_upgrade_hints_risk_idx` ON `phase15b_upgrade_hints` (`project_id`,`risk_level`);