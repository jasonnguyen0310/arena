ALTER TABLE `trades` ADD `setup_type` text;--> statement-breakpoint
ALTER TABLE `trades` ADD `criteria_coiling` integer;--> statement-breakpoint
ALTER TABLE `trades` ADD `criteria_resistance` integer;--> statement-breakpoint
ALTER TABLE `trades` ADD `criteria_hh_hl` integer;--> statement-breakpoint
ALTER TABLE `trades` ADD `criteria_rel_strength` integer;--> statement-breakpoint
ALTER TABLE `trades` ADD `key_level` real;--> statement-breakpoint
ALTER TABLE `trades` ADD `on_watchlist` integer;--> statement-breakpoint
ALTER TABLE `trades` ADD `exit_strategy` text;--> statement-breakpoint
ALTER TABLE `trades` ADD `setup_worked` text;