CREATE TABLE `workspace_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`teacher_style` text DEFAULT 'lecturer' NOT NULL,
	`interview_style` text,
	`review_style` text,
	`growth_goal` text,
	`daily_new_limit` integer DEFAULT 10 NOT NULL,
	`retention_target` real DEFAULT 0.85 NOT NULL,
	`answer_depth` text DEFAULT 'standard' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_settings_workspace_id_unique` ON `workspace_settings` (`workspace_id`);