CREATE TABLE `message_resources` (
	`message_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_resources_message_resource_idx` ON `message_resources` (`message_id`,`resource_id`);--> statement-breakpoint
CREATE TABLE `resource_highlights` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`excerpt` text NOT NULL,
	`note` text,
	`locator` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `resource_highlights_resource_created_idx` ON `resource_highlights` (`resource_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `resource_terms` (
	`resource_id` text NOT NULL,
	`term_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_terms_resource_term_idx` ON `resource_terms` (`resource_id`,`term_id`);--> statement-breakpoint
CREATE INDEX `resource_terms_term_idx` ON `resource_terms` (`term_id`);--> statement-breakpoint
ALTER TABLE `resources` ADD `canonical_url` text;--> statement-breakpoint
ALTER TABLE `resources` ADD `site_name` text;--> statement-breakpoint
ALTER TABLE `resources` ADD `author` text;--> statement-breakpoint
ALTER TABLE `resources` ADD `description` text;--> statement-breakpoint
ALTER TABLE `resources` ADD `favicon_url` text;--> statement-breakpoint
ALTER TABLE `resources` ADD `progress` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `resources` ADD `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `resources` ADD `updated_at` integer;--> statement-breakpoint
UPDATE `resources` SET `canonical_url` = `url`, `updated_at` = `created_at` WHERE `canonical_url` IS NULL;--> statement-breakpoint
INSERT OR IGNORE INTO `resource_terms` (`resource_id`, `term_id`, `created_at`)
SELECT `id`, `term_id`, `created_at` FROM `resources` WHERE `term_id` IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `resources_workspace_canonical_url_idx` ON `resources` (`workspace_id`,`canonical_url`);--> statement-breakpoint
CREATE INDEX `resources_workspace_status_updated_idx` ON `resources` (`workspace_id`,`status`,`updated_at`);
