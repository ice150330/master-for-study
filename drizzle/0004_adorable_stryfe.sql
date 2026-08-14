ALTER TABLE `messages` ADD `status` text DEFAULT 'complete' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `error` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `pinned_at` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `archived_at` integer;