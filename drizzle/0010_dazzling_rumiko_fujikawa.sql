CREATE TABLE `practice_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`concept_id` text,
	`challenge_id` text NOT NULL,
	`status` text NOT NULL,
	`error_type` text,
	`run_count` integer NOT NULL,
	`hint_count` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`sql` text NOT NULL,
	`result` text NOT NULL,
	`skills` text DEFAULT '[]' NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`concept_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `practice_attempts_idempotency_key_unique` ON `practice_attempts` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `practice_attempts_challenge_created_idx` ON `practice_attempts` (`challenge_id`,`created_at`);