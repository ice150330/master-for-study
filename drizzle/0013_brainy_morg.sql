CREATE TABLE `knowledge_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`source_node_id` text NOT NULL,
	`target_node_id` text NOT NULL,
	`relation` text NOT NULL,
	`evidence_type` text NOT NULL,
	`evidence_id` text,
	`weight` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_node_id`) REFERENCES `knowledge_nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_node_id`) REFERENCES `knowledge_nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_edges_semantic_idx` ON `knowledge_edges` (`source_node_id`,`target_node_id`,`relation`);--> statement-breakpoint
CREATE INDEX `knowledge_edges_workspace_relation_idx` ON `knowledge_edges` (`workspace_id`,`relation`);--> statement-breakpoint
CREATE INDEX `knowledge_edges_target_idx` ON `knowledge_edges` (`target_node_id`);--> statement-breakpoint
CREATE TABLE `knowledge_node_layouts` (
	`node_id` text NOT NULL,
	`view_key` text DEFAULT 'knowledge' NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`node_id`) REFERENCES `knowledge_nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_node_layouts_node_view_idx` ON `knowledge_node_layouts` (`node_id`,`view_key`);--> statement-breakpoint
CREATE TABLE `knowledge_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`term_id` text,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`origin` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_nodes_workspace_label_idx` ON `knowledge_nodes` (`workspace_id`,`label`);--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_nodes_workspace_term_idx` ON `knowledge_nodes` (`workspace_id`,`term_id`);--> statement-breakpoint
CREATE INDEX `knowledge_nodes_workspace_kind_idx` ON `knowledge_nodes` (`workspace_id`,`kind`);