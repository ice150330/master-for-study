CREATE TABLE `concept_mentions` (
	`id` text PRIMARY KEY NOT NULL,
	`term_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`session_id` text,
	`locator` text,
	`excerpt` text,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `concept_mentions_idempotency_key_unique` ON `concept_mentions` (`idempotency_key`);--> statement-breakpoint
ALTER TABLE `terms` ADD `canonical_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `terms` SET `canonical_name` = `name` WHERE `canonical_name` = '';--> statement-breakpoint
ALTER TABLE `terms` ADD `aliases` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `terms` ADD `example` text;--> statement-breakpoint
ALTER TABLE `terms` ADD `confidence` real DEFAULT 0.8 NOT NULL;
