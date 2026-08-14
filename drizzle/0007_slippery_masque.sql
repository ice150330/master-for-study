CREATE TABLE `note_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`block_key` text NOT NULL,
	`session_id` text,
	`start_message_id` text,
	`end_message_id` text,
	`excerpt` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`start_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`end_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `note_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`version` integer NOT NULL,
	`origin` text NOT NULL,
	`title` text NOT NULL,
	`markdown` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `notes` ADD `ai_snapshot` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `user_content` text;--> statement-breakpoint
ALTER TABLE `notes` ADD `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `updated_at` integer;
--> statement-breakpoint
UPDATE `notes` SET `ai_snapshot` = `content`, `updated_at` = `created_at`;
--> statement-breakpoint
INSERT INTO `note_versions` (`id`, `note_id`, `version`, `origin`, `title`, `markdown`, `tags`, `created_at`)
SELECT lower(hex(randomblob(16))), `id`, 1, 'ai', `title`, `markdown`, '[]', `created_at` FROM `notes`;
