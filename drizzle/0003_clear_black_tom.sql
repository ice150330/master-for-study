ALTER TABLE `learning_events` ADD `workspace_id` text REFERENCES workspaces(id);--> statement-breakpoint
ALTER TABLE `learning_events` ADD `session_id` text REFERENCES sessions(id);--> statement-breakpoint
ALTER TABLE `learning_events` ADD `action` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `learning_events` ADD `object_type` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `learning_events` ADD `object_id` text;--> statement-breakpoint
ALTER TABLE `learning_events` ADD `result` text;--> statement-breakpoint
ALTER TABLE `learning_events` ADD `context` text;--> statement-breakpoint
ALTER TABLE `learning_events` ADD `schema_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `learning_events` ADD `idempotency_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `learning_events_idempotency_key_unique` ON `learning_events` (`idempotency_key`);--> statement-breakpoint
ALTER TABLE `messages` ADD `idempotency_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `messages_idempotency_key_unique` ON `messages` (`idempotency_key`);