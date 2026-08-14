CREATE INDEX `review_cards_due_at_idx` ON `review_cards` (`due_at`);--> statement-breakpoint
CREATE INDEX `review_logs_card_review_idx` ON `review_logs` (`card_id`,`review_at`);--> statement-breakpoint
CREATE INDEX `review_logs_term_review_idx` ON `review_logs` (`term_id`,`review_at`);