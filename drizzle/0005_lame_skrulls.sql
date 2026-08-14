ALTER TABLE `sessions` ADD `root_session_id` text REFERENCES sessions(id);--> statement-breakpoint
ALTER TABLE `sessions` ADD `forked_from_message_id` text REFERENCES messages(id);