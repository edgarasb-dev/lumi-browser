CREATE INDEX `idx_history_urls_profile_last_visit` ON `history_urls` (`profile_id`,`last_visit_time`);--> statement-breakpoint
CREATE INDEX `idx_history_visits_url_visit_time` ON `history_visits` (`url_id`,`visit_time`);--> statement-breakpoint
CREATE INDEX `idx_history_visits_visit_time_id` ON `history_visits` (`visit_time`,`id`);