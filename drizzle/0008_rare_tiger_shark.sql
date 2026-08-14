CREATE TABLE `review_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`term_id` text NOT NULL,
	`state` text NOT NULL,
	`due_at` integer NOT NULL,
	`stability` real NOT NULL,
	`difficulty` real NOT NULL,
	`scheduled_days` integer DEFAULT 0 NOT NULL,
	`learning_steps` integer DEFAULT 0 NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`last_review_at` integer,
	`is_difficult` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_cards_term_id_unique` ON `review_cards` (`term_id`);--> statement-breakpoint
CREATE TABLE `review_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`card_id` text NOT NULL,
	`term_id` text NOT NULL,
	`rating` text NOT NULL,
	`state` text NOT NULL,
	`due_at` integer NOT NULL,
	`stability` real NOT NULL,
	`difficulty` real NOT NULL,
	`elapsed_days` integer NOT NULL,
	`last_elapsed_days` integer NOT NULL,
	`scheduled_days` integer NOT NULL,
	`learning_steps` integer NOT NULL,
	`review_at` integer NOT NULL,
	`state_after` text NOT NULL,
	`due_after` integer NOT NULL,
	`stability_after` real NOT NULL,
	`difficulty_after` real NOT NULL,
	`scheduled_days_after` integer NOT NULL,
	`learning_steps_after` integer NOT NULL,
	`reps_after` integer NOT NULL,
	`lapses_after` integer NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`answer_mode` text NOT NULL,
	`recall_text` text,
	`algorithm_version` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_id`) REFERENCES `review_cards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_logs_idempotency_key_unique` ON `review_logs` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `review_undos` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`card_id` text NOT NULL,
	`review_log_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_id`) REFERENCES `review_cards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`review_log_id`) REFERENCES `review_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_undos_review_log_id_unique` ON `review_undos` (`review_log_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `review_undos_idempotency_key_unique` ON `review_undos` (`idempotency_key`);--> statement-breakpoint
INSERT INTO `review_cards` (
	`id`, `workspace_id`, `term_id`, `state`, `due_at`, `stability`, `difficulty`,
	`scheduled_days`, `learning_steps`, `reps`, `lapses`, `last_review_at`,
	`is_difficult`, `created_at`, `updated_at`
)
SELECT
	lower(hex(randomblob(16))),
	(SELECT `id` FROM `workspaces` ORDER BY `created_at` LIMIT 1),
	`term_id`,
	`state`,
	coalesce(`due_at`, strftime('%s', 'now') * 1000),
	coalesce(`stability`, 0),
	coalesce(`difficulty`, 0),
	max(0, cast(round(coalesce(`stability`, 0)) AS integer)),
	0,
	CASE WHEN `last_reviewed_at` IS NULL THEN 0 ELSE 1 END,
	CASE WHEN `state` = 'relearning' THEN 1 ELSE 0 END,
	`last_reviewed_at`,
	false,
	coalesce(`last_reviewed_at`, strftime('%s', 'now') * 1000),
	strftime('%s', 'now') * 1000
FROM `term_masteries`;
