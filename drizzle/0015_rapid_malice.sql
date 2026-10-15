-- Split the per-index behavior field into `_before` (tape into the print) and
-- `_after` (reaction after the print). Legacy single-value columns are kept
-- so historical rows still read.
ALTER TABLE `macro_events` ADD `spx_behavior_before` text;--> statement-breakpoint
ALTER TABLE `macro_events` ADD `spx_behavior_after` text;--> statement-breakpoint
ALTER TABLE `macro_events` ADD `qqq_behavior_before` text;--> statement-breakpoint
ALTER TABLE `macro_events` ADD `qqq_behavior_after` text;--> statement-breakpoint
ALTER TABLE `macro_events` ADD `smh_behavior_before` text;--> statement-breakpoint
ALTER TABLE `macro_events` ADD `smh_behavior_after` text;
