ALTER TABLE `review_cards` ADD `variant` text DEFAULT 'definition' NOT NULL;--> statement-breakpoint
ALTER TABLE `review_cards` ADD `question` text;--> statement-breakpoint
ALTER TABLE `review_cards` ADD `answer` text;