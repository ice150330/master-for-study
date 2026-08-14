CREATE TABLE `interview_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`interview_id` text NOT NULL,
	`version` integer NOT NULL,
	`answer` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`scores` text NOT NULL,
	`evidence` text DEFAULT '[]' NOT NULL,
	`summary` text NOT NULL,
	`strengths` text DEFAULT '[]' NOT NULL,
	`improvements` text DEFAULT '[]' NOT NULL,
	`model_answer` text NOT NULL,
	`correct` integer NOT NULL,
	`next_strategy` text NOT NULL,
	`prerequisite` text,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`interview_id`) REFERENCES `interviews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `interview_attempts_idempotency_key_unique` ON `interview_attempts` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `interview_attempts_interview_version_idx` ON `interview_attempts` (`interview_id`,`version`);--> statement-breakpoint
CREATE TABLE `interview_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`role` text NOT NULL,
	`topic` text NOT NULL,
	`initial_difficulty` text NOT NULL,
	`current_difficulty` text NOT NULL,
	`total_rounds` integer NOT NULL,
	`current_round` integer DEFAULT 1 NOT NULL,
	`teacher_style` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_strategy` text,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `interview_sessions_idempotency_key_unique` ON `interview_sessions` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `interview_sessions_workspace_status_idx` ON `interview_sessions` (`workspace_id`,`status`,`updated_at`);--> statement-breakpoint
ALTER TABLE `interviews` ADD `workspace_id` text REFERENCES workspaces(id);--> statement-breakpoint
ALTER TABLE `interviews` ADD `interview_session_id` text REFERENCES interview_sessions(id);--> statement-breakpoint
ALTER TABLE `interviews` ADD `term_id` text REFERENCES terms(id);--> statement-breakpoint
ALTER TABLE `interviews` ADD `round_index` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `interviews` ADD `skill` text DEFAULT '通用技术能力' NOT NULL;--> statement-breakpoint
ALTER TABLE `interviews` ADD `difficulty` text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `interviews` ADD `rubric` text DEFAULT '{"correctness":"技术判断正确","structure":"回答结构清晰","evidence":"有事实或权衡依据","communication":"表达准确简洁"}' NOT NULL;--> statement-breakpoint
ALTER TABLE `interviews` ADD `follow_up` text;--> statement-breakpoint
CREATE INDEX `interviews_session_round_idx` ON `interviews` (`interview_session_id`,`round_index`);