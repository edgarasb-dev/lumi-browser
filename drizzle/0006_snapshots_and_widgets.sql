CREATE TABLE `workspace_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`space_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`tabs_json` text NOT NULL,
	`tab_groups_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_workspace_snapshots_space_id` ON `workspace_snapshots` (`space_id`);