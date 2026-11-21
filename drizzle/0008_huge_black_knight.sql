CREATE TABLE `password_never_save_sites` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`host` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_password_never_save_profile_host` ON `password_never_save_sites` (`profile_id`,`host`);--> statement-breakpoint
CREATE TABLE `saved_passwords` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`origin` text NOT NULL,
	`host` text NOT NULL,
	`action_url` text,
	`username` text NOT NULL,
	`encrypted_password` blob NOT NULL,
	`title` text,
	`note` text,
	`times_used` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_used_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_saved_passwords_profile_origin_user` ON `saved_passwords` (`profile_id`,`origin`,`username`);--> statement-breakpoint
CREATE INDEX `idx_saved_passwords_profile_host` ON `saved_passwords` (`profile_id`,`host`);