CREATE TABLE `runtime_preview_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`session_id` text NOT NULL,
	`source_effect_task_id` text,
	`turn_purpose` text NOT NULL,
	`artifact_kind` text NOT NULL,
	`apply_policy` text NOT NULL,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`target_object` text NOT NULL,
	`context_hash` text NOT NULL,
	`runtime_adapter_version` text NOT NULL,
	`summary` text NOT NULL,
	`payload_json` text NOT NULL,
	`source_refs_json` text NOT NULL,
	`blocked_action_type` text,
	`block_reason` text,
	`suggested_safe_alternative` text,
	`created_at` text NOT NULL,
	`schema_version` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `runtime_artifacts_context_idx` ON `runtime_preview_artifacts` (`session_id`,`turn_purpose`,`context_hash`,`runtime_adapter_version`);--> statement-breakpoint
CREATE INDEX `runtime_artifacts_session_idx` ON `runtime_preview_artifacts` (`session_id`);--> statement-breakpoint
CREATE INDEX `runtime_artifacts_source_effect_idx` ON `runtime_preview_artifacts` (`source_effect_task_id`);--> statement-breakpoint
CREATE TABLE `runtime_task_refs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`session_id` text NOT NULL,
	`effect_task_id` text NOT NULL,
	`artifact_id` text NOT NULL,
	`runtime_adapter_version` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`schema_version` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `runtime_task_refs_effect_artifact_idx` ON `runtime_task_refs` (`effect_task_id`,`artifact_id`);--> statement-breakpoint
CREATE INDEX `runtime_task_refs_session_idx` ON `runtime_task_refs` (`session_id`);