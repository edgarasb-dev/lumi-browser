CREATE TABLE `downloads` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`url` text NOT NULL,
	`final_url` text NOT NULL,
	`filename` text NOT NULL,
	`save_path` text NOT NULL,
	`mime_type` text,
	`total_bytes` integer DEFAULT 0 NOT NULL,
	`received_bytes` integer DEFAULT 0 NOT NULL,
	`state` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer
);
--> statement-breakpoint
CREATE INDEX `idx_downloads_profile_id` ON `downloads` (`profile_id`);--> statement-breakpoint
CREATE INDEX `idx_downloads_start_time` ON `downloads` (`start_time`);